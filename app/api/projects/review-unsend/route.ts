import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { logProjectEvent, AuditLogEventType } from '@/lib/auditLogger';

// POST - Unsend a project from the review queue (owner only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectID } = await request.json();
    if (!projectID) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // Fetch project and verify ownership
    const project = await prisma.project.findUnique({
      where: { projectID },
      select: {
        projectID: true,
        userId: true,
        in_review: true,
        shipped: true,
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Disallow unsend if already approved/shipped
    if (project.shipped) {
      return NextResponse.json({ error: 'Cannot unsend: project already approved' }, { status: 400 });
    }

    // If not in review, nothing to do
    if (!project.in_review) {
      return NextResponse.json({ success: true, project }, { status: 200 });
    }

    // Unsend: mark as not in review
    const updated = await prisma.project.update({
      where: { projectID },
      data: { in_review: false },
    });

    await logProjectEvent({
      eventType: AuditLogEventType.ProjectRemovedFromReview,
      description: 'Project removed from review queue by owner',
      projectId: projectID,
      userId: session.user.id,
      actorUserId: session.user.id,
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error('Error unsending project:', error);
    return NextResponse.json({ error: 'Failed to unsend project' }, { status: 500 });
  }
}



