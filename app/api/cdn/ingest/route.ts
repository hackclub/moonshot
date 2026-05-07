import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Uploads are disabled. Moonshot is in read-only mode.' },
    { status: 410 }
  );
}

