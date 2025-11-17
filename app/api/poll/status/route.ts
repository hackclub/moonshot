import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Return only a boolean; do not expose any tag data or names
    const userId = session.user.id;
    const voted = await prisma.userTag.findFirst({
      where: {
        userId,
        tag: { name: 'voted' },
      },
      select: { id: true },
    });

    return NextResponse.json({ needsVote: !voted });
  } catch (error) {
    console.error('Error checking poll status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}


