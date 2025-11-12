import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { getIslandProjectTypesForClient } from '@/lib/islandProjectTypes';

/**
 * API endpoint to get available island project types
 * This allows the client to access the environment variables that program this feature, securely
 */
export async function GET() {
  try {
    // Check authentication - project types should only be available to authenticated users
    const session = await getServerSession(opts);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectTypes = getIslandProjectTypesForClient();
    return NextResponse.json(projectTypes);
  } catch (error) {
    console.error('Error fetching island project types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch island project types' },
      { status: 500 }
    );
  }
}