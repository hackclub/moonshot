import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    await getServerSession(opts);
    const base = 'https://hca.dinosaurbbq.org';
    const origin = process.env.NEXTAUTH_URL || (() => { try { return new URL(req.url).origin; } catch { return 'http://localhost:3000'; } })();
    const redirectUri = process.env.IDENTITY_REDIRECT_URI || process.env.REDIRECT_URI || `${origin}/identity`;
    const clientId = process.env.IDENTITY_CLIENT_ID || process.env.CLIENT_ID;
    if (!clientId) {
      return new NextResponse('Server misconfiguration: missing IDENTITY_CLIENT_ID', { status: 500 });
    }
    const url = new URL('/oauth/authorize', base);
    url.search = new URLSearchParams({
      client_id: clientId,
      scope: 'email',
      response_type: 'code',
      redirect_uri: redirectUri,
    }).toString();
    return NextResponse.redirect(url);
  } catch (err) {
    return new NextResponse('Failed to start authorization', { status: 500 });
  }
}


