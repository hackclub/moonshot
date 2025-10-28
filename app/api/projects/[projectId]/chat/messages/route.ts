import { prisma } from '@/lib/prisma';
import { logProjectEvent, AuditLogEventType } from '@/lib/auditLogger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '../../../../auth/[...nextauth]/route';
import { withRateLimit } from '@/lib/rateLimit';

// GET - Get chat messages for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    
    // Get optional 'since' timestamp from query parameters
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const sinceTimestamp = sinceParam ? new Date(sinceParam) : null;

    // Check if the project exists and has chat enabled
    const project = await prisma.project.findUnique({
      where: {
        projectID: projectId,
      },
      select: {
        chat_enabled: true,
        userId: true, // Include userId to determine author
        projectTags: {
          select: {
            tag: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Chat gating removed: always allow fetching messages

    // Check if this is an island project
    const isIslandProject = project.projectTags.some(pt => pt.tag.name === 'event-project');

    // Get the chat room for this project
    const chatRoom = await prisma.chatRoom.findFirst({
      where: {
        projectID: projectId,
      },
    });

    if (!chatRoom) {
      // No chat room yet, return empty array
      return NextResponse.json([]);
    }

    // Build the where clause for messages
    const whereClause: any = {
      roomId: chatRoom.id,
    };

    // If a since timestamp is provided, only get messages newer than that
    if (sinceTimestamp && !isNaN(sinceTimestamp.getTime())) {
      whereClause.createdAt = {
        gt: sinceTimestamp,
      };
    }

    // Get messages from the chat room
    const messageQueryOptions: any = {
      where: whereClause,
      orderBy: {
        createdAt: sinceTimestamp ? 'asc' : 'desc', // If since timestamp, get oldest first; otherwise newest first
      },
      take: sinceTimestamp ? undefined : 100, // If since timestamp, get all new messages; otherwise limit to 100
    };

    // Only add include clause for island projects
    if (isIslandProject) {
      messageQueryOptions.include = {
        user: {
          select: {
            name: true
          }
        }
      };
    }

    const messages = await prisma.chatMessage.findMany(messageQueryOptions);

    // If no since timestamp, reverse to get chronological order (oldest to newest) for display
    const chronologicalMessages = sinceTimestamp ? messages : messages.reverse();

    // Format messages for the client - include isAuthor flag and user name for island projects
    const formattedMessages = chronologicalMessages.map(message => ({
      id: message.id,
      content: message.content,
      userId: message.userId,
      createdAt: message.createdAt.toISOString(),
      hours: (message as any).hours ?? 0,
      approvedHours: (message as any).approvedHours ?? null,
      isAuthor: message.userId === project.userId, // Flag to indicate if message is from project author
      userName: isIslandProject && (message as any).user ? (message as any).user.name : undefined, // Include real name for island projects
    }));

    return NextResponse.json(formattedMessages);

  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST - Send a new chat message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const session = await getServerSession(opts);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { projectId } = await params;
  const userId = session.user.id;

  // Apply rate limiting: 1 message every 5 seconds per user per project
  return withRateLimit(
    {
      window: 5, // 5 seconds
      maxRequests: 1, // 1 message max
      keyPrefix: `chat_message:${userId}:${projectId}` // Per user per project
    },
    async () => {
      try {
        const body = await request.json();

        if (!body.content || typeof body.content !== 'string' || !body.content.trim()) {
          return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
        }

        // Increase message length limit to 10KB-equivalent (~10,000 characters)
        if (body.content.trim().length > 10000) {
          return NextResponse.json({ error: 'Message too long. Maximum 10,000 characters allowed.' }, { status: 400 });
        }

        // Check if the project exists and has chat enabled
        const project = await prisma.project.findUnique({
          where: {
            projectID: projectId,
          },
          select: {
            chat_enabled: true,
            in_review: true,
            userId: true, // Include userId to determine author
            projectTags: {
              select: {
                tag: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        });

        if (!project) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Chat gating removed: always allow posting messages

        // Block posting new journal entries while in review
        if (project.in_review) {
          return NextResponse.json({ error: 'Project is in review; posting new journal entries is disabled.' }, { status: 403 });
        }

        // Check if this is an island project
        const isIslandProject = project.projectTags.some(pt => pt.tag.name === 'event-project');
        const isEventProject = project.projectTags.some(pt => pt.tag.name === 'event-project') || isIslandProject;

        // CRITICAL: Only the project owner can write journal entries to their own project
        // Admins and reviewers can bypass this check if needed for support purposes
        const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
        const isReviewer = session.user.role === 'Reviewer';
        const canBypassOwnershipCheck = isAdmin || isReviewer;
        
        if (!canBypassOwnershipCheck && session.user.id !== project.userId) {
          return NextResponse.json({ error: 'You can only write journal entries to your own projects.' }, { status: 403 });
        }

        // Get or create the chat room for this project
        let chatRoom = await prisma.chatRoom.findFirst({
          where: {
            projectID: projectId,
          },
        });

        if (!chatRoom) {
          // Create a chat room if it doesn't exist
          chatRoom = await prisma.chatRoom.create({
            data: {
              projectID: projectId,
              name: 'General Discussion',
            }
          });
        }

        // Create the message
        const messageCreateOptions: any = {
          data: {
            content: body.content.trim(),
            userId: session.user.id,
            roomId: chatRoom.id,
          }
        };

        // Optional hours from client; clamp to reasonable bounds
        // Require hours field now; must be > 0 and <= 24
        const rawHours = typeof body.hours === 'number' ? body.hours : Number(body.hours)
        if (isNaN(rawHours) || !isFinite(rawHours) || rawHours <= 0 || rawHours > 24) {
          return NextResponse.json({ error: 'Invalid hours. Provide a value between 0 and 24.' }, { status: 400 });
        }
        const clamped = Math.max(0, Math.min(24, rawHours))
        messageCreateOptions.data.hours = clamped

        // Only add include clause for island projects
        if (isIslandProject) {
          messageCreateOptions.include = {
            user: {
              select: {
                name: true
              }
            }
          };
        }

        const message = await prisma.chatMessage.create(messageCreateOptions);

        // Format message for the client
        const formattedMessage = {
          id: message.id,
          content: message.content,
          userId: message.userId,
          createdAt: message.createdAt.toISOString(),
          isAuthor: message.userId === project.userId, // Flag to indicate if message is from project author
          userName: isIslandProject && (message as any).user ? (message as any).user.name : undefined, // Include real name for island projects
        };

        return NextResponse.json(formattedMessage);

      } catch (error) {
        console.error('Error sending chat message:', error);
        return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
      }
    }
  );
} 

// PATCH - Update approvedHours (reviewers/admins)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;

    // Only Admins or Reviewers can modify approved hours
    const role = session.user.role;
    const isAdmin = role === 'Admin' || session.user.isAdmin === true;
    const isReviewer = role === 'Reviewer';
    if (!isAdmin && !isReviewer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { messageId, approvedHours } = body || {};
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    // Validate approvedHours: allow null to clear, or a number between 0 and 24 inclusive
    let nextApproved: number | null = null;
    if (approvedHours === null || approvedHours === undefined || approvedHours === '') {
      nextApproved = null;
    } else {
      const parsed = typeof approvedHours === 'number' ? approvedHours : Number(approvedHours);
      if (isNaN(parsed) || parsed < 0 || parsed > 24) {
        return NextResponse.json({ error: 'approvedHours must be between 0 and 24' }, { status: 400 });
      }
      nextApproved = parsed;
    }

    // Ensure message belongs to the project's room
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, room: { select: { projectID: true } } }
    });
    if (!message || message.room.projectID !== projectId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { approvedHours: nextApproved }
    });

    // Write audit event (target user is the project owner)
    try {
      const projectOwner = await prisma.project.findUnique({
        where: { projectID: projectId },
        select: { userId: true, name: true }
      });
      if (projectOwner?.userId) {
        await logProjectEvent({
          eventType: AuditLogEventType.ProjectReviewCompleted,
          description: `Updated approved hours on chat message ${messageId} to ${nextApproved ?? 'null'}`,
          projectId,
          userId: projectOwner.userId,
          actorUserId: session.user.id,
          metadata: { messageId, approvedHours: nextApproved }
        });
      }
    } catch (e) {
      console.error('Failed to write audit log for approved hours update:', e);
    }

    return NextResponse.json({ id: updated.id, approvedHours: updated.approvedHours });
  } catch (error) {
    console.error('Error updating approved hours:', error);
    return NextResponse.json({ error: 'Failed to update approved hours' }, { status: 500 });
  }
}

// DELETE - Delete a chat message (admins or project owners only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    // Load project to check ownership
    const project = await prisma.project.findUnique({
      where: { projectID: projectId },
      select: { userId: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Permission: admins or project owner
    const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
    const isOwner = session.user.id === project.userId;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ensure message exists and belongs to this project's room
    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, room: { select: { projectID: true } } },
    });
    if (!message || message.room.projectID !== projectId) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    await prisma.chatMessage.delete({ where: { id: messageId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat message:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}