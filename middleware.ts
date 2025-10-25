import { NextRequest, NextResponse } from 'next/server';
import { handleMoonshotReferralRedirect } from './lib/redirectMoonshotReferral';

export const config = {
  matcher: [
    // Protect everything in staging, including static assets
    '/:path*',
  ],
};

function redirectToCanonicalHostIfNeeded(request: NextRequest): NextResponse | null {
  const canonicalHost = (process.env.CANONICAL_HOST || '').toLowerCase();
  if (!canonicalHost) return null;

  const forwardedHost = request.headers.get('x-forwarded-host');
  const incomingHost = (forwardedHost || request.headers.get('host') || request.nextUrl.host || '').split(':')[0].toLowerCase();
  // If a proxy forwarded host is present and already matches the canonical host, do NOT redirect.
  // This prevents loops when request.nextUrl.host reflects the internal bind address (e.g., 0.0.0.0)
  // while the proxy has already set the correct public host via X-Forwarded-Host.
  if ((forwardedHost || '').split(':')[0].toLowerCase() === canonicalHost) {
    return null;
  }
  if (incomingHost && incomingHost !== canonicalHost) {
    const proto = (request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'https');
    const url = `${proto}://${canonicalHost}${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(url, 307);
  }
  return null;
}

function enforceBasicAuthIfEnabled(request: NextRequest): Response | null {
  // DISABLED: Basic auth temporarily disabled
  return null;
  
  /* COMMENTED OUT: Basic auth enforcement
  const authPassword = process.env.AUTH_PASSWD;
  if (!authPassword) return null;

  const expectedUser = 'admin';
  const expectedPass = authPassword;

  // If production canonical host, only gate /launchpad (RSVP/FAQ remain open)
  const canonicalHostEnv = (process.env.CANONICAL_HOST || '').toLowerCase();
  const isProdCanonical = canonicalHostEnv === 'moonshot.hackclub.com';
  if (isProdCanonical) {
    const path = request.nextUrl.pathname || '/';
    if (!path.startsWith('/launchpad')) {
      return null; // do not gate non-launchpad routes
    }
  }

  const authHeader = request.headers.get('authorization') || '';
  const unauthorized = () => new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Moonshot"' },
  });

  if (!authHeader.startsWith('Basic ')) {
    return unauthorized();
  }

  const base64Credentials = authHeader.slice('Basic '.length).trim();
  let decoded = '';
  try {
    decoded = atob(base64Credentials);
  } catch {
    return unauthorized();
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return unauthorized();
  }
  const providedUser = decoded.slice(0, separatorIndex);
  const providedPass = decoded.slice(separatorIndex + 1);

  if (providedUser !== expectedUser || providedPass !== expectedPass) {
    return unauthorized();
  }

  return null;
  */
}

export default async function middleware(request: NextRequest) {
  // Allow unauthenticated, unredirected access for temporary upload URLs so the CDN can fetch them
  // This bypass prevents canonical redirects and basic auth challenges for /api/uploads resources
  const path = request.nextUrl.pathname || '/';
  if (path.startsWith('/api/uploads')) {
    return NextResponse.next();
  }
  // Handle hack.club → hackclub.com referral redirects FIRST so we can append r=slug
  const moonshotRedirect = handleMoonshotReferralRedirect(request);
  if (moonshotRedirect) return moonshotRedirect;

  const canonicalRedirect = redirectToCanonicalHostIfNeeded(request);
  if (canonicalRedirect) return canonicalRedirect;

  const authResponse = enforceBasicAuthIfEnabled(request);
  if (authResponse) return authResponse;

  return NextResponse.next();
}