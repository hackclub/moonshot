import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;
  if (!userId) {
    return NextResponse.json({ error: 'User ID not provided' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
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
    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
} 