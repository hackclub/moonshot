import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

const ALLOWED = new Set(['v1', 'v2', 'v3', 'v4', 'v5']);
const VOTED_TAG = 'voted';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const answerRaw: unknown = body?.answer;
    if (typeof answerRaw !== 'string') {
      return NextResponse.json({ error: 'Missing answer' }, { status: 400 });
    }
    const answer = answerRaw.toLowerCase().trim();
    if (!ALLOWED.has(answer)) {
      return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
    }

    // Find or create the 'voted' tag
    const votedTag = await prisma.tag.upsert({
      where: { name: VOTED_TAG },
      create: { name: VOTED_TAG },
      update: {},
    });

    // Find or create the answer tag
    const answerTag = await prisma.tag.upsert({
      where: { name: answer },
      create: { name: answer },
      update: {},
    });

    // Add associations idempotently
    const ensureUserTag = async (tagId: string) => {
      const existing = await prisma.userTag.findUnique({
        where: { userId_tagId: { userId, tagId } },
      });
      if (existing) return existing;
      return prisma.userTag.create({ data: { userId, tagId } });
    };

    await ensureUserTag(votedTag.id);
    await ensureUserTag(answerTag.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting poll vote:', error);
    return NextResponse.json({ error: 'Failed to submit vote' }, { status: 500 });
  }
}


