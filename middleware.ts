import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { handleMoonshotReferralRedirect } from './lib/redirectMoonshotReferral';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - ....
     */
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

export default async function middleware(request: NextRequest) {
  const moonshotRedirect = handleMoonshotReferralRedirect(request);
  if (moonshotRedirect) return moonshotRedirect;

  return NextResponse.next();
}