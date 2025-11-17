import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { UserStatus } from '@/app/generated/prisma/client';
import { createAuditLog, AuditLogEventType } from '@/lib/auditLogger';
import { getUserProjectsWithMetrics } from '@/lib/project-client';

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // Check authentication
  const session = await getServerSession(opts);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for admin role or isAdmin flag
  const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { userId } = await params;
    
    // Fetch the specific user with their projects and tags
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
        hackatimeId: true,
        slack: true,
        purchasedProgressHours: true,
        totalCurrencySpent: true,
        adminCurrencyAdjustment: true,
        projects: {
          include: {
            hackatimeLinks: true,
            reviews: {
              select: {
                id: true
              }
            }
          }
        },
        userTags: {
          include: {
            tag: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get projects with journal hours and calculate metrics using the shared function
    const { projects: projectsWithJournalHours, metrics } = await getUserProjectsWithMetrics(
      userId,
      user.totalCurrencySpent || 0,
      user.adminCurrencyAdjustment || 0
    );
    
    // Enhance projects with additional admin-specific properties
    const enhancedProjects = projectsWithJournalHours.map((project) => {
      // Get the main Hackatime name (for backwards compatibility)
      const hackatimeName = project.hackatimeLinks.length > 0 
        ? project.hackatimeLinks[0].hackatimeName 
        : '';
      
      // Calculate total raw hours from all links, applying individual overrides when available
      const rawHours = project.hackatimeLinks.reduce(
        (sum: number, link: any) => {
          // Use the link's hoursOverride if it exists, otherwise use rawHours
          const effectiveHours = (link.hoursOverride !== undefined && link.hoursOverride !== null)
            ? link.hoursOverride
            : (typeof link.rawHours === 'number' ? link.rawHours : 0);
          
          return sum + effectiveHours;
        }, 
        0
      );
      
      // Find review count from original projects
      const originalProject = user.projects.find(p => p.projectID === project.projectID);
      const reviewCount = originalProject?.reviews?.length || 0;
      
      // Return the enhanced project with additional properties
      return {
        ...project,
        hackatimeName,
        rawHours,
        reviewCount
      };
    });

    return NextResponse.json({
      ...user,
      projects: enhancedProjects,
      currencyMetrics: metrics // Include calculated metrics
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // Check authentication
  const session = await getServerSession(opts);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for admin role or isAdmin flag
  const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { userId } = await params;
    const data = await request.json();
    
    // Only allow updating specific fields for security
    const { role, status } = data;
    
    // Check if this is a downgrade from Admin
    const userBeforeUpdate = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAdmin: true, status: true, name: true, email: true },
    });
    
    if (!userBeforeUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const isDowngrade = 
      (userBeforeUpdate?.role === 'Admin' && role && role !== 'Admin') || 
      (userBeforeUpdate?.isAdmin === true && data.isAdmin === false);
    
    // Check if status is changing
    const isStatusChanging = status && status !== userBeforeUpdate.status;
      
    // Update the user
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        role: role || undefined,
        status: status ? status as UserStatus : undefined,
        // If isAdmin is explicitly set in the request, update it
        ...(data.isAdmin !== undefined ? { isAdmin: data.isAdmin } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
        hackatimeId: true,
        slack: true,
      },
    });
    
    // Create audit log for status change
    if (isStatusChanging) {
      const adminName = session.user.name || session.user.email || 'Unknown Admin';
      const targetName = userBeforeUpdate.name || userBeforeUpdate.email || 'Unknown User';
      
      await createAuditLog({
        eventType: AuditLogEventType.OtherEvent,
        description: `Admin ${adminName} changed user status from ${userBeforeUpdate.status} to ${status} for user ${targetName}`,
        targetUserId: userId,
        actorUserId: session.user.id,
        metadata: {
          eventSubtype: 'UserStatusChanged',
          previousStatus: userBeforeUpdate.status,
          newStatus: status,
          adminEmail: session.user.email,
          targetUserEmail: userBeforeUpdate.email
        }
      });
    }
    
    // If this was a downgrade from Admin role, invalidate any active sessions for this user
    if (isDowngrade) {
      // Delete the sessions for this user to force them to log in again with new permissions
      await prisma.session.deleteMany({
        where: { userId: userId }
      });
      
      console.log(`User ${userId} was downgraded from Admin. All sessions invalidated.`);
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  // Check authentication
  const session = await getServerSession(opts);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check for admin role or isAdmin flag
  const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const userId = params.userId;
    
    // Delete the user
    await prisma.user.delete({
      where: {
        id: userId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
} 