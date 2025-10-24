import { NextRequest, NextResponse } from 'next/server';

function resolvePublicOrigin(req: NextRequest): string {
  const fromEnv = process.env.PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_PUBLIC_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Only use the server-side CDN_PASSWORD env var for Bearer auth to the CDN.
    // Do NOT accept client-provided tokens (e.g., headers or public env vars).
    const token = process.env.CDN_PASSWORD;
    if (!token) {
      return NextResponse.json({ error: 'Missing CDN_PASSWORD env var on the server.' }, { status: 400 });
    }
    const { tempPath } = await request.json();
    if (typeof tempPath !== 'string' || !tempPath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid tempPath' }, { status: 400 });
    }

    // Optional tunnel/public URL override solely for CDN fetching
    // Example: set CDN_PUBLIC_ORIGIN to your ngrok URL (https://abc.ngrok.io)
    const base = (process.env.CDN_PUBLIC_ORIGIN || '').replace(/\/$/, '') || resolvePublicOrigin(request);
    const fileUrl = `${base}${tempPath}`;

    const res = await fetch('https://cdn.hackclub.com/api/v3/new', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([fileUrl]),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('CDN ingest failed', res.status, text);
      return NextResponse.json({ error: 'CDN ingest failed', status: res.status, details: text }, { status: 502 });
    }

    const data = await res.json();
    const deployedUrl = data?.files?.[0]?.deployedUrl;
    return NextResponse.json({ deployedUrl });
  } catch (e: any) {
    console.error('Ingest error', e);
    return NextResponse.json({ error: 'Ingest error', details: e?.message || String(e) }, { status: 500 });
  }
}


