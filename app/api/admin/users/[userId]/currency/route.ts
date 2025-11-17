import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { logShellModification } from '@/lib/auditLogger';
import { getUserProjectsWithMetrics } from '@/lib/project-client';

// Admin endpoint for adjusting user currency balance (formerly "shells" in Shipwrecked)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const session = await getServerSession(opts);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'Admin' && !session.user.isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { adjustment, reason } = await request.json();

    if (typeof adjustment !== 'number' || adjustment === 0) {
      return NextResponse.json(
        { error: 'Invalid adjustment value. Must be a non-zero number.' },
        { status: 400 }
      );
    }

    if (Math.abs(adjustment) > 1000) {
      return NextResponse.json(
        { error: 'Adjustment too large. Maximum adjustment is ±1000 currency.' },
        { status: 400 }
      );
    }

    if (reason !== undefined && (typeof reason !== 'string' || reason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Reason must be a non-empty string if provided.' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalCurrencySpent: true,
        adminCurrencyAdjustment: true
      }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get current metrics before adjustment
    const { metrics: currentMetrics } = await getUserProjectsWithMetrics(
      userId,
      targetUser.totalCurrencySpent,
      targetUser.adminCurrencyAdjustment
    );

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        adminCurrencyAdjustment: {
          increment: adjustment
        }
      },
      select: {
        totalCurrencySpent: true,
        adminCurrencyAdjustment: true
      }
    });

    // Get new metrics after adjustment
    const { metrics: newMetrics } = await getUserProjectsWithMetrics(
      userId,
      updatedUser.totalCurrencySpent,
      updatedUser.adminCurrencyAdjustment
    );

    await logShellModification({
      targetUserId: userId,
      actorUserId: session.user.id!,
      adjustment,
      reason: reason?.trim(),
      previousBalance: currentMetrics.availablecurrency,
      newBalance: newMetrics.availablecurrency
    });

    return NextResponse.json({
      success: true,
      previousBalance: currentMetrics.availablecurrency,
      newBalance: newMetrics.availablecurrency,
      adjustment,
      adminCurrencyAdjustment: updatedUser.adminCurrencyAdjustment,
      shellBreakdown: {
        availablecurrency: newMetrics.availablecurrency
      }
    });
  } catch (error) {
    console.error('Error modifying user currency:', error);
    return NextResponse.json(
      { error: 'Failed to modify user currency' },
      { status: 500 }
    );
  }
}


