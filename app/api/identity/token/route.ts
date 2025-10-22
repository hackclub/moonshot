import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const clientId = process.env.IDENTITY_CLIENT_ID || process.env.CLIENT_ID;
    const clientSecret = process.env.IDENTITY_CLIENT_SECRET || process.env.CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      console.error('IDENTITY_CLIENT_ID/IDENTITY_CLIENT_SECRET not set');
      return NextResponse.json({ error: 'Server misconfiguration: identity credentials missing' }, { status: 500 });
    }

    // Optionally attach token to user if session exists
    const session = await getServerSession(opts);

    const origin = process.env.NEXTAUTH_URL || (new URL(req.url).origin);
    const redirectUri = process.env.IDENTITY_REDIRECT_URI || process.env.REDIRECT_URI || `${origin}/identity`;

    // ID Service Parameters
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    // Exchange code (from url params) for token
    const tokenUrl = new URL('/oauth/token', 'https://hca.dinosaurbbq.org');
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    let tokenResponse: any = null;
    try {
      tokenResponse = await response.json();
    } catch {
      return NextResponse.json({ error: 'Failed to parse token response as JSON' }, { status: response.status || 500 });
    }

    if (!response.ok || !tokenResponse?.access_token) {
      return NextResponse.json(tokenResponse || { error: 'Failed to exchange code for token' }, { status: response.status });
    }

    // Persist identity access token on the current user for later /me calls
    if (session?.user?.id) {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { identityToken: tokenResponse.access_token },
        });
      } catch (e) {
        console.error('Failed to save identity token to user:', e);
      }
    }

    // Fetch user info from identity using the access token
    try {
      const meUrl = new URL('/api/v1/me', 'https://hca.dinosaurbbq.org');
      const meResp = await fetch(meUrl, {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        cache: 'no-store',
      });
      let meJson: any = null;
      try {
        meJson = await meResp.json();
      } catch {
        return NextResponse.json({ ...tokenResponse, me: null, error: 'Failed to parse identity response as JSON' }, { status: meResp.status || 500 });
      }
      const meData = meJson && typeof meJson === 'object' && 'identity' in meJson ? (meJson as any).identity : meJson;
      return NextResponse.json({ ...tokenResponse, me: meData }, { status: meResp.ok ? 200 : meResp.status });
    } catch (e) {
      console.error('Failed to fetch identity /me:', e);
      // Return token even if /me fails so client can decide next steps
      return NextResponse.json(tokenResponse, { status: 200 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
} 