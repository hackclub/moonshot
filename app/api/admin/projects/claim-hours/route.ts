import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { opts as authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

// Program name to ID mapping
const PROGRAM_IDS = {
  'shipwrecked': 51,
  'high_seas': 1,
  'arcade': 2
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    if (session.user.role !== 'Admin' && !session.user.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await request.json();
    const { start_time, end_time, project_id } = body;
    
    if (!start_time || !end_time || !project_id) {
      return NextResponse.json({ 
        error: 'Missing required fields: start_time, end_time, project_id' 
      }, { status: 400 });
    }
    
    // Convert date strings to Unix timestamps (integers)
    const startTimestamp = Math.floor(new Date(start_time).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end_time).getTime() / 1000);
    
    // Automatically set program_id to 51 (shipwrecked) since this is the Shipwrecked admin interface
    const program_id = 51;
    
    // Look up the project and get the author's hackatimeId
    const projectData = await prisma.project.findUnique({
      where: { projectID: project_id },
      include: {
        user: {
          select: {
            id: true,
            hackatimeId: true,
            name: true
          }
        }
      }
    });
    
    if (!projectData) {
      return NextResponse.json({ 
        error: 'Project not found' 
      }, { status: 404 });
    }
    
    if (!projectData.user.hackatimeId) {
      return NextResponse.json({ 
        error: 'Project author does not have a Hackatime ID configured' 
      }, { status: 400 });
    }
    
    // Check if the user has a HACKATIME_API_TOKEN environment variable
    const hackatimeApiToken = process.env.HACKATIME_API_TOKEN;
    if (!hackatimeApiToken) {
      return NextResponse.json({ 
        error: 'HACKATIME_API_TOKEN environment variable not configured' 
      }, { status: 500 });
    }

    // Try to get CSRF token first
    let csrfToken = null;
    try {
      console.log('=== CSRF TOKEN ATTEMPT ===');
      
      // Try 1: Get from main API endpoint
      console.log('Trying to get CSRF token from /api/v1/ysws_programs...');
      const csrfResponse = await fetch('https://hackatime.hackclub.com/api/v1/ysws_programs', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${hackatimeApiToken}`,
          'User-Agent': 'Shipwrecked-Admin/1.0'
        }
      });
      
      console.log('CSRF response status:', csrfResponse.status);
      console.log('CSRF response headers:', Object.fromEntries(csrfResponse.headers.entries()));
      
      // Look for CSRF token in response headers
      const csrfHeader = csrfResponse.headers.get('X-CSRF-Token') || 
                        csrfResponse.headers.get('csrf-token') ||
                        csrfResponse.headers.get('x-csrf-token') ||
                        csrfResponse.headers.get('X-CSRF-TOKEN') ||
                        csrfResponse.headers.get('CSRF-TOKEN');
      
      if (csrfHeader) {
        csrfToken = csrfHeader;
        console.log('Found CSRF token in headers:', csrfToken);
      } else {
        console.log('No CSRF token found in response headers');
        
        // Try 2: Get from main HackTime page
        console.log('Trying to get CSRF token from main page...');
        const mainPageResponse = await fetch('https://hackatime.hackclub.com/', {
          headers: {
            'User-Agent': 'Shipwrecked-Admin/1.0'
          }
        });
        
        if (mainPageResponse.ok) {
          const htmlContent = await mainPageResponse.text();
          console.log('HTML content length:', htmlContent.length);
          
          // Look for CSRF token in meta tag - try multiple patterns
          const csrfMatch = htmlContent.match(/name=["']?csrf-token["']?\s+content=["']?([^"'\s/>]+)["']?/i) ||
                           htmlContent.match(/content=["']?([^"'\s/>]+)["']?\s+name=["']?csrf-token["']?/i) ||
                           htmlContent.match(/<meta[^>]*name=["']?csrf-token["']?[^>]*content=["']?([^"'\s/>]+)["']?/i) ||
                           htmlContent.match(/<meta[^>]*content=["']?([^"'\s/>]+)["']?[^>]*name=["']?csrf-token["']?/i);
          
          if (csrfMatch) {
            csrfToken = csrfMatch[1];
            console.log('Found CSRF token in HTML meta tag:', csrfToken);

            const metaSection = htmlContent.match(/<head>[\s\S]*?<\/head>/i);
            if (metaSection) {
              console.log('Meta section preview:', metaSection[0]);
            }

          } else {
            console.log('No CSRF token found in HTML meta tag');
            // Log a snippet of the HTML around meta tags for debugging
            const metaSection = htmlContent.match(/<head>[\s\S]*?<\/head>/i);
            if (metaSection) {
              console.log('Meta section preview:', metaSection[0]);
            }
          }
        } else {
          console.log('Failed to fetch main page, status:', mainPageResponse.status);
        }
      }
      
      console.log('=== END CSRF TOKEN ATTEMPT ===');
    } catch (error) {
      console.log('Error getting CSRF token:', error);
      console.log('=== END CSRF TOKEN ATTEMPT ===');
    }
    
    // Make the API call to claim hours using the project author's hackatimeId
    const requestBody = {
      start_time: startTimestamp,
      end_time: endTimestamp,
      user_id: projectData.user.hackatimeId,
      program_id: program_id,
      project: projectData.name
    };
    
    console.log('Claiming hours with request:', JSON.stringify(requestBody, null, 2));
    console.log('Project author:', projectData.user.name, 'Hackatime ID:', projectData.user.hackatimeId);
    console.log('Original timestamps:', { start_time, end_time });
    console.log('Converted to Unix timestamps:', { start_time: startTimestamp, end_time: endTimestamp });
    
    // Prepare headers
    const headers = {
      'Authorization': `Bearer ${hackatimeApiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Shipwrecked-Admin/1.0',
      ...(csrfToken && { 'X-CSRF-Token': csrfToken })
    };
    
    // Log complete HTTP request details
    console.log('=== COMPLETE HTTP REQUEST DEBUG ===');
    console.log('URL:', 'https://hackatime.hackclub.com/api/v1/ysws_programs/claim');
    console.log('Method:', 'POST');
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', JSON.stringify(requestBody, null, 2));
    console.log('Body (raw string):', JSON.stringify(requestBody));
    console.log('CSRF Token found:', csrfToken ? 'YES' : 'NO');
    if (csrfToken) {
      console.log('CSRF Token value:', csrfToken);
    }
    console.log('=== END REQUEST DEBUG ===');
    
    const claimResponse = await fetch('https://hackatime.hackclub.com/api/v1/ysws_programs/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });
    
    console.log('Claim response status:', claimResponse.status);
    console.log('Claim response headers:', Object.fromEntries(claimResponse.headers.entries()));
    
    if (!claimResponse.ok) {
      const responseText = await claimResponse.text();
      console.error('Claim hours API error response:', responseText);
      
      // Try to parse as JSON, but fall back to text if it fails
      let errorMessage = 'Failed to claim hours from Hackatime API';
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Response is not JSON, likely HTML error page
        errorMessage = `API returned non-JSON response (status ${claimResponse.status}). Check endpoint URL and permissions.`;
      }
      
      return NextResponse.json({ 
        error: errorMessage 
      }, { status: claimResponse.status });
    }
    
    const responseText = await claimResponse.text();
    console.log('Claim hours API success response:', responseText);
    
    let claimData;
    try {
      claimData = JSON.parse(responseText);
    } catch (e) {
      return NextResponse.json({ 
        error: 'API returned non-JSON response' 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: claimData,
      project: {
        id: projectData.projectID,
        name: projectData.name,
        author: projectData.user.name
      }
    });
    
  } catch (error) {
    console.error('Error claiming hours:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
} 