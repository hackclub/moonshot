import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const incomingUrl = new URL(request.url);
    const redirectParam = incomingUrl.searchParams.get('redirect_uri');

    const params = {
    client_id: process.env.IDENTITY_CLIENT_ID || '',
    redirect_uri: `${process.env.NEXTAUTH_URL}/${redirectParam ?? 'identity'}`,
    response_type: "code",
    ...(redirectParam ? { scope: "email" } : { scope: "basic_info address" }),
  };
    const queryString = new URLSearchParams(params).toString();
    console.log(`${process.env.IDENTITY_URL}/oauth/authorize?${queryString}`)
    return NextResponse.json({ url: `${process.env.IDENTITY_URL}/oauth/authorize?${queryString}` });
}