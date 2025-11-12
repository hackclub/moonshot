import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID not provided' }, { status: 400 });
  }

  try {
    // Check authentication
    const session = await getServerSession(opts);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if requester is admin or reviewer
    const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
    const isReviewer = session.user.role === 'Reviewer';
    const canViewEmail = isAdmin || isReviewer || session.user.id === userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true, // Always fetch email, but remove from response if not authorized
        image: true,
        createdAt: true,
        isAdmin: true,
        role: true,
        status: true,
        hackatimeId: true,
        // identityToken deliberately excluded - should never be exposed in API responses
        purchasedProgressHours: true,
        totalCurrencySpent: true,
        adminCurrencyAdjustment: true,
        projects: {
          include: {
            hackatimeLinks: true,
          },
        },
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove email from response if user doesn't have permission to view it
    if (!canViewEmail) {
      const { email, ...userWithoutEmail } = user;
      return NextResponse.json(userWithoutEmail);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
} 