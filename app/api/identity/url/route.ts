import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const incomingUrl = new URL(request.url);
    const redirectParam = incomingUrl.searchParams.get('redirect_uri');

    // Strip any path from IDENTITY_URL to get base URL only
    const identityBaseUrl = process.env.IDENTITY_URL?.replace(/\/oauth\/.*$/, '') || 'https://identity.hackclub.com';

    const params = {
    client_id: process.env.IDENTITY_CLIENT_ID || '',
    redirect_uri: `${process.env.NEXTAUTH_URL}/${redirectParam ?? 'identity'}`,
    response_type: "code",
    ...(redirectParam ? { scope: "email" } : { scope: "basic_info address" }),
  };
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${identityBaseUrl}/oauth/authorize?${queryString}`;
    console.log('Identity authorize URL:', fullUrl);
    return NextResponse.json({ url: fullUrl });
}