import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { opts as authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: { projectId: string } }
) {
  // Await context to get params (Next.js 13/14 requirement)
  const { params } = await Promise.resolve(context);
  const { projectId } = params;
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    if (session.user.role !== 'Admin' && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('start_time') || '2024-01-01';
    const endTime = searchParams.get('end_time') || new Date().toISOString().split('T')[0];
    
    // Get project and user info
    const project = await prisma.project.findUnique({
      where: { projectID: projectId },
      include: {
        user: {
          select: {
            id: true,
            hackatimeId: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (!project.user.hackatimeId) {
      return NextResponse.json({ 
        error: 'User does not have a Hackatime ID configured',
        spans: []
      }, { status: 200 });
    }
    
    // Check if we have the Hackatime API token
    const hackatimeApiToken = process.env.HACKATIME_API_TOKEN;
    if (!hackatimeApiToken) {
      return NextResponse.json({ 
        error: 'HACKATIME_API_TOKEN environment variable not configured' 
      }, { status: 500 });
    }
    
    // Fetch spans from Hackatime API
    const spansUrl = `https://hackatime.hackclub.com/api/v1/users/${project.user.hackatimeId}/heartbeats/spans?start_date=${startTime}&end_date=${endTime}&project=${encodeURIComponent(project.name)}`;
    
    console.log('Fetching spans:', spansUrl);
    
    const spansResponse = await fetch(spansUrl, {
      headers: {
        'Authorization': `Bearer ${hackatimeApiToken}`
      }
    });
    
    if (!spansResponse.ok) {
      const responseText = await spansResponse.text();
      console.error('Spans API error response:', responseText);
      return NextResponse.json({ 
        error: `Failed to fetch spans (status ${spansResponse.status})`,
        spans: []
      }, { status: 200 });
    }
    
    const spansData = await spansResponse.json();
    
    // Process spans data
    const projectSpans = spansData.spans || [];
    
    // Calculate total time from spans (duration is in seconds)
    const totalSeconds = projectSpans.reduce((sum: number, span: any) => sum + (span.duration || 0), 0);
    
    // For now, we'll assume spans don't have claim information directly
    // We might need to fetch heartbeats for claim status or use a different approach
    // Let's also fetch heartbeats to get claim information
    const heartbeatsUrl = `https://hackatime.hackclub.com/api/v1/${project.user.hackatimeId}/heartbeats?start_time=${startTime}&end_time=${endTime}`;
    
    const heartbeatsResponse = await fetch(heartbeatsUrl, {
      headers: {
        'Authorization': `Bearer ${hackatimeApiToken}`
      }
    });
    
    let claimsSummary = {};
    let claimedSeconds = 0;
    let unclaimedSeconds = totalSeconds;
    
    if (heartbeatsResponse.ok) {
      const heartbeatsData = await heartbeatsResponse.json();
      
      // Filter heartbeats for this specific project
      const projectHeartbeats = heartbeatsData.heartbeats?.filter((hb: any) => 
        hb.project && hb.project.toLowerCase().includes(project.name.toLowerCase())
      ) || [];
      
      // Group heartbeats by claim status
      const claimedHeartbeats = projectHeartbeats.filter((hb: any) => hb.ysws_program && hb.ysws_program !== 0);
      
      // Calculate claimed time from heartbeats
      claimedSeconds = claimedHeartbeats.reduce((sum: number, hb: any) => sum + (hb.time || 0), 0);
      unclaimedSeconds = totalSeconds - claimedSeconds;
      
      // Map ysws_program values to program names
      const programMap: { [key: number]: string } = {
        1: 'high_seas',
        2: 'arcade', 
        3: 'shipwrecked',
        0: 'unclaimed'
      };
      
      claimsSummary = claimedHeartbeats.reduce((acc: any, hb: any) => {
        const program = programMap[hb.ysws_program] || `program_${hb.ysws_program}`;
        if (!acc[program]) {
          acc[program] = { count: 0, seconds: 0 };
        }
        acc[program].count++;
        acc[program].seconds += hb.time || 0;
        return acc;
      }, {});
    }
    
    return NextResponse.json({
      success: true,
      project: {
        id: project.projectID,
        name: project.name,
        user: project.user
      },
      summary: {
        totalSpans: projectSpans.length,
        totalHours: totalSeconds / 3600,
        claimedHours: claimedSeconds / 3600,
        unclaimedHours: unclaimedSeconds / 3600,
        claimsByProgram: claimsSummary
      },
      spans: projectSpans.slice(0, 50) // Limit to first 50 spans for performance
    });
  } catch (error) {
    console.error('Error fetching project claims:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 