import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { getUserProjectsWithMetrics } from '@/lib/project-client';

export async function GET() {
  // Check authentication
  const session = await getServerSession(opts);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get the user ID from the session
    const userId = session.user.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        totalCurrencySpent: true, 
        adminCurrencyAdjustment: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get projects, enhance with journal hours, and calculate metrics
    const { metrics } = await getUserProjectsWithMetrics(
      userId,
      user.totalCurrencySpent,
      user.adminCurrencyAdjustment
    );

    return NextResponse.json({ 
      currency: metrics.availablecurrency,
      earnedcurrency: metrics.availablecurrency,
      totalSpent: user.totalCurrencySpent,
      adminCurrencyAdjustment: user.adminCurrencyAdjustment,
      availablecurrency: metrics.availablecurrency
    });
  } catch (error) {
    console.error('Error fetching user currency:', error);
    return NextResponse.json({ error: 'Failed to fetch user currency' }, { status: 500 });
  }
}
