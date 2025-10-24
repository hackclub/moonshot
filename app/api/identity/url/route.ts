import { NextResponse } from 'next/server';

export async function GET() {
    const params = {
    client_id: process.env.IDENTITY_CLIENT_ID || '',
    // redirect_uri: `${process.env.NEXTAUTH_URL}/identity`,
    redirect_uri: `${process.env.NEXTAUTH_URL}/launchpad/login`,
    response_type: "code",
    // scope: "basic_info address",
    scope: "email",
  };
    const url = new URL("/oauth/authorize", process.env.IDENTITY_URL)
    url.search = new URLSearchParams(params).toString();


  console.log(url.href);
    // const queryString = new URLSearchParams(params).toString();
    // console.log(`${process.env.IDENTITY_URL}/oauth/authorize?${queryString}`)
    // return NextResponse.json({ url: `${process.env.IDENTITY_URL}/oauth/authorize?${queryString}` });
    return NextResponse.json({ url: url.href });
}
