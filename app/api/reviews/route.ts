import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '../auth/[...nextauth]/route';
import { sendNotificationEmail } from '@/lib/loops';

// GET reviews for a specific project
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project ID from URL params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const reviews = await prisma.review.findMany({
      where: {
        projectID: projectId,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST a new review
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reviewerId = session.user.id;
    const body = await request.json();
    
    // Validate required fields
    if (!body.projectID || !body.comment) {
      return NextResponse.json({ error: 'Project ID and comment are required' }, { status: 400 });
    }

    // Check if the project exists
    const project = await prisma.project.findUnique({
      where: {
        projectID: body.projectID,
      },
      include: {
        user: {
          select: { email: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        comment: body.comment,
        projectID: body.projectID,
        reviewerId: reviewerId,
        reviewType: body.reviewType,
        justification: body.justification || null,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Send email notification to project owner
    if (project.user.email) {
      try {
        // Log email domain only for privacy (e.g., user@example.com -> @example.com)
        const emailDomain = project.user.email.includes('@') 
          ? '@' + project.user.email.split('@')[1] 
          : '[redacted]';
        console.log(`📧 Attempting to send review email to: [redacted]${emailDomain}`);
        
        const host = process.env.NEXTAUTH_URL || 'http://localhost:3000';
        // Still include result text in notifications if provided in the request
        const resultText = body.result ? `${body.result === 'approve' ? 'Approved' : (body.result === 'reject' ? 'Rejected' : 'Commented')}` : '';
        const updateContent = `Review Update for ${project.name} just came in! ${resultText}.  Check it out at https://${host}/launchpad`;

        const date = new Date();
        const datetime = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} - ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
              
        await sendNotificationEmail(project.user.email, project.name, datetime, updateContent);
        console.log(`✅ Review email sent successfully to: [redacted]${emailDomain}`);
      } catch (emailError) {
        // Log error without exposing email address
        console.error(`❌ Failed to send review email:`, emailError instanceof Error ? emailError.message : 'Unknown error');
        // Don't fail the review creation if email fails
      }
    } else {
      console.log(`⚠️ Skipping email notification - project owner has no email address`);
    }

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

// DELETE a review
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 });
    }

    // Find the review to check ownership
    const review = await prisma.review.findUnique({
      where: {
        id: reviewId,
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Only allow the user who created the review to delete it
    if (review.reviewerId !== session.user.id) {
      return NextResponse.json({ error: 'You can only delete your own reviews' }, { status: 403 });
    }

    // Delete the review
    await prisma.review.delete({
      where: {
        id: reviewId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
} 