import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { calculateProgressMetrics } from '@/lib/project-client';

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
        purchasedProgressHours: true,
        adminCurrencyAdjustment: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get projects with their Hackatime links for the current user
    const projects = await prisma.project.findMany({
      where: { userId },
      include: { hackatimeLinks: true }
    });

    // Calculate comprehensive currency balance using the enhanced function
    const metrics = calculateProgressMetrics(
      projects,
      user.totalCurrencySpent,
      user.adminCurrencyAdjustment
    );

    return NextResponse.json({ 
      currency: metrics.availablecurrency,
      earnedcurrency: metrics.availablecurrency,
      totalSpent: user.totalCurrencySpent,
      adminCurrencyAdjustment: user.adminCurrencyAdjustment,
      availablecurrency: metrics.availablecurrency,
      progress: {
        earned: {
          totalHours: metrics.totalHours,
          totalPercentage: metrics.totalPercentage,
          shippedHours: metrics.shippedHours,
          viralHours: metrics.viralHours,
          otherHours: metrics.otherHours
        },
        purchased: {
          hours: metrics.purchasedProgressHours,
          percentage: metrics.purchasedProgressHours
        },
        total: {
          hours: metrics.totalProgressWithPurchased,
          percentage: metrics.totalPercentageWithPurchased
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user currency:', error);
    return NextResponse.json({ error: 'Failed to fetch user currency' }, { status: 500 });
  }
}
