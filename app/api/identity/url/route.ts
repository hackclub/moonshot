import { NextResponse } from 'next/server';

export async function GET() {
  const identityBase = process.env.IDENTITY_URL || 'https://hca.dinosaurbbq.org';
  const url = new URL('/oauth/authorize', identityBase);
  url.search = new URLSearchParams({
    client_id: process.env.IDENTITY_CLIENT_ID || '',
    redirect_uri: `${process.env.NEXTAUTH_URL}/identity`,
    response_type: 'code',
    scope: 'basic_info address',
  }).toString();
  return NextResponse.json({ url: url.toString() });
}