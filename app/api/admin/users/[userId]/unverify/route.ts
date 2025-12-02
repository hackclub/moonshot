import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { createAuditLog, AuditLogEventType } from '@/lib/auditLogger';

export async function POST(
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
    
    // Get user info before update for audit log
    const userBeforeUpdate = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, identityToken: true },
    });
    
    if (!userBeforeUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    if (!userBeforeUpdate.identityToken) {
      return NextResponse.json({ error: 'User does not have an identity token to clear' }, { status: 400 });
    }
    
    // Clear the identity token
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        identityToken: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        identityToken: true,
      },
    });
    
    // Create audit log
    const adminName = session.user.name || session.user.email || 'Unknown Admin';
    const targetName = userBeforeUpdate.name || userBeforeUpdate.email || 'Unknown User';
    
    await createAuditLog({
      eventType: AuditLogEventType.OtherEvent,
      description: `Admin ${adminName} unverified user ${targetName} by clearing identity token`,
      targetUserId: userId,
      actorUserId: session.user.id,
      metadata: {
        eventSubtype: 'UserUnverified',
        adminEmail: session.user.email,
        targetUserEmail: userBeforeUpdate.email
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'User identity token cleared successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error unverifying user:', error);
    return NextResponse.json(
      { error: 'Failed to unverify user' },
      { status: 500 }
    );
  }
}

