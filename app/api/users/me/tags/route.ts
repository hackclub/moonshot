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

    const userTags = await prisma.userTag.findMany({
      where: { userId: session.user.id },
      include: { tag: { select: { id: true, name: true, description: true, color: true } } },
    });

    const tags = userTags.map((ut) => ut.tag);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching current user tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}


