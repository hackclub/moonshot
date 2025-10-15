import { NextRequest, NextResponse } from 'next/server';

export function handleMoonshotReferralRedirect(request: NextRequest): NextResponse | null {
  const hostHeader = request.headers.get('host') || '';
  const hostname = hostHeader.split(':')[0].toLowerCase();

  if (hostname !== 'moonshot.hack.club') {
    return null;
  }

  const url = new URL(request.url);
  const pathname = url.pathname || '/';

  if (pathname === '/health') {
    return new NextResponse('ok', { status: 200 });
  }

  const TARGET = 'https://moonshot.hackclub.com';

  if (pathname === '/' || pathname === '') {
    return NextResponse.redirect(TARGET, { status: 302 });
  }

  const slug = pathname.replace(/^\/+/, '');
  if (!slug) {
    return NextResponse.redirect(TARGET, { status: 302 });
  }

  const location = `${TARGET}/?r=${encodeURIComponent(slug)}`;
  return NextResponse.redirect(location, { status: 302 });
}


