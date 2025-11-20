import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const VOTE_TAGS = ['v1', 'v2', 'v3', 'v4', 'v5'] as const;

export async function GET() {
  try {
    const session = await getServerSession(opts);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch counts for each vote tag
    const counts = await Promise.all(
      VOTE_TAGS.map(async (tag) => {
        const count = await prisma.userTag.count({
          where: {
            tag: { name: tag },
          },
        });
        return { tag, count };
      })
    );

    const totals = counts.reduce(
      (acc, { tag, count }) => {
        acc.byTag[tag] = count;
        acc.total += count;
        return acc;
      },
      { total: 0, byTag: {} as Record<(typeof VOTE_TAGS)[number], number> }
    );

    return NextResponse.json(totals);
  } catch (error) {
    console.error('Error fetching poll summary:', error);
    return NextResponse.json({ error: 'Failed to fetch poll summary' }, { status: 500 });
  }
}


