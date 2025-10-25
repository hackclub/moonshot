import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { opts } from '../../auth/[...nextauth]/route';
import { getServerSession } from 'next-auth';

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    const session = await getServerSession(opts);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // ID Service Parameters
    const params = {
      code,
      client_id: process.env.IDENTITY_CLIENT_ID,
      client_secret: process.env.IDENTITY_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXTAUTH_URL}/identity`,
      grant_type: "authorization_code",
    };

    // Exchange code (from url params) for token
    console.log('Exchanging code for token with params:', { ...params, client_secret: '***' });
    const response = await fetch(`${process.env.IDENTITY_URL}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    console.log('Identity OAuth response:', response.status, data);
    
    if (!response.ok) {
      console.error('Identity OAuth error:', data);
      return NextResponse.json({ error: 'Failed to exchange code', details: data }, { status: response.status });
    }
    
    if (!data.access_token) {
      console.error('No access_token in response:', data);
      return NextResponse.json({ error: 'No access token received' }, { status: 500 });
    }
    
    // Update user with token
    await prisma.user.update({
      where: {
        id: session?.user?.id,
      },
      data: {
        identityToken: data.access_token,
      },
    });

    console.log("Successfully stored identity token for user:", session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Identity token exchange error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
} 