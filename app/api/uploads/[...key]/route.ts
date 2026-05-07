export async function GET() {
  return new Response('Uploads are disabled. Moonshot is in read-only mode.', { status: 410 });
}

