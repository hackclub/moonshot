import { HacaktimeMostRecentHeartbeat, HackatimeProject, HackatimeStatsProject } from "@/types/hackatime";
import { prisma } from "@/lib/prisma";
import metrics from "@/metrics";

const HACKATIME_MOCK = process.env.HACKATIME_MOCK === 'true' || process.env.HACKATIME_MOCK === '1';
if (!process.env.HACKATIME_API_TOKEN && !HACKATIME_MOCK) {
  throw new Error('HACKATIME_API_TOKEN environment variable must be set');
}

const HACKATIME_API_TOKEN = process.env.HACKATIME_API_TOKEN || (HACKATIME_MOCK ? 'mock-token' : '');
const HACKATIME_RACK_ATTACK_BYPASS_TOKEN = process.env.HACKATIME_RACK_ATTACK_BYPASS_TOKEN;

async function makeHackatimeRequest(uri: string) {
  const response = await fetch(uri, {
    headers: {
      'Authorization': `Bearer ${HACKATIME_API_TOKEN}`,
      'Rack-Attack-Bypass': HACKATIME_RACK_ATTACK_BYPASS_TOKEN || '',
    }
  });
  return response;
}

export async function fetchHackatimeProjects(
  hackatimeUserId: string,
): Promise<Array<HackatimeProject>> {
  if (HACKATIME_MOCK) {
    // Return a diverse set of mock projects to exercise UI states
    const MOCK_PROJECTS: HackatimeProject[] = [
      { name: 'Arduino Rover', total_seconds: 3 * 3600 + 15 * 60, hours: 3.25, minutes: 15, text: '3 hrs 15 mins', digital: '3:15', percent: 12.3 },
      { name: 'React Game Engine', total_seconds: 12 * 3600 + 45 * 60, hours: 12.75, minutes: 45, text: '12 hrs 45 mins', digital: '12:45', percent: 48.9 },
      { name: 'Pixel Art Sprites', total_seconds: 55 * 60, hours: 0.92, minutes: 55, text: '55 mins', digital: '0:55', percent: 3.1 },
      { name: '3D Printer Mods', total_seconds: 6 * 3600, hours: 6, minutes: 0, text: '6 hrs', digital: '6:00', percent: 21.0 },
      { name: 'Music Visualizer', total_seconds: 95 * 60, hours: 1.58, minutes: 35, text: '1 hr 35 mins', digital: '1:35', percent: 6.7 },
      { name: 'Rust CLI Tools', total_seconds: 14 * 3600 + 30 * 60, hours: 14.5, minutes: 30, text: '14 hrs 30 mins', digital: '14:30', percent: 54.2 },
      { name: 'iOS Swift App', total_seconds: 2 * 3600 + 5 * 60, hours: 2.08, minutes: 5, text: '2 hrs 5 mins', digital: '2:05', percent: 8.4 },
      { name: 'Blender Animation', total_seconds: 45 * 60, hours: 0.75, minutes: 45, text: '45 mins', digital: '0:45', percent: 2.6 },
      { name: 'ESP32 Sensor Board', total_seconds: 9 * 3600 + 10 * 60, hours: 9.17, minutes: 10, text: '9 hrs 10 mins', digital: '9:10', percent: 33.5 },
      { name: 'Website Redesign', total_seconds: 4 * 3600 + 20 * 60, hours: 4.33, minutes: 20, text: '4 hrs 20 mins', digital: '4:20', percent: 15.2 },
      { name: 'Shader Experiments', total_seconds: 25 * 60, hours: 0.42, minutes: 25, text: '25 mins', digital: '0:25', percent: 1.1 },
      { name: 'Node API Server', total_seconds: 7 * 3600 + 5 * 60, hours: 7.08, minutes: 5, text: '7 hrs 5 mins', digital: '7:05', percent: 26.8 },
    ];
    console.log('🧪 HACKATIME_MOCK enabled — returning mocked project list');
    return MOCK_PROJECTS;
  }
  console.log(`🎮 Fetching Hackatime projects for user ID: ${hackatimeUserId}`);
  
  const uri = `https://hackatime.hackclub.com/api/v1/users/${hackatimeUserId}/stats?features=projects&start_date=2024-10-06`;
  console.log(`📡 Hackatime API Request: ${uri}`);

  try {
    const response = await makeHackatimeRequest(uri);
    console.log(`📥 Hackatime Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Hackatime API error: ${response.status} ${response.statusText}`);
      console.error(`Response headers:`, Object.fromEntries(response.headers.entries()));
      const errorText = await response.text();
      console.error(`Error response body:`, errorText);
      throw new Error(`Hackatime API error: ${response.status} ${response.statusText}`);
    }

    const data: HackatimeStatsProject = await response.json();
    // console.log('📦 Full Hackatime response:', JSON.stringify(data, null, 2));
    console.log(`✅ Hackatime projects fetched successfully. Found ${data.data.projects.length} projects`);
    
    // Log hours for debugging
    console.log(`📊 Hours for projects:`, data.data.projects.map(p => ({ 
      name: p.name, 
      hours: p.hours, 
      total_seconds: p.total_seconds,
      precise_hours: p.total_seconds / 3600
    })));

    metrics.increment("success.fetch_hackatime", 1);
    return data.data.projects;
  } catch (error) {
    console.error(`💥 Error fetching Hackatime projects:`, error);
    console.error(`For user ID: ${hackatimeUserId}`);
    metrics.increment("errors.fetch_hackatime", 1);
    throw error; // Re-throw to handle in calling code
  }
}

export async function checkHackatimeUserExists(
  id: string
): Promise<boolean> {
  const uri = `https://hackatime.hackclub.com/api/v1/users/${id}/stats`;
  const response = await makeHackatimeRequest(uri);

  if (response.status == 404) return false;
  
  if (response.ok) {
    const data = await response.json();
    console.log('📦 Full Hackatime response:', JSON.stringify(data, null, 2));
  }
  
  return true;
}

export async function fetchRecentHeartbeat(id: string): Promise<HacaktimeMostRecentHeartbeat> {
  const uri = `https://hackatime.hackclub.com/api/v1/${id}/heartbeats/most_recent`;
  const response = await makeHackatimeRequest(uri);
  const data = await response.json();
  console.log('📦 Full Hackatime response:', JSON.stringify(data, null, 2));
  return data;
}

export async function lookupHackatimeIdByEmail(email: string): Promise<string | null> {
  console.log(`🔍 Looking up Hackatime ID for email: ${email}`);
  const uri = `https://hackatime.hackclub.com/api/v1/users/lookup_email/${encodeURIComponent(email)}`;
  
  try {
    const response = await fetch(uri, {
      headers: {
        'Authorization': `Bearer ${process.env.HACKATIME_API_TOKEN}`,
        'Rack-Attack-Bypass': HACKATIME_RACK_ATTACK_BYPASS_TOKEN || '',
      }
    });
    console.log(`📥 Lookup Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      console.log('⚠️ No Hackatime user found for email');
      return null;
    }
    
    if (!response.ok) {
      metrics.increment("errors.hackatime_api_error", 1);
      console.error(`❌ Hackatime API error: ${response.status} ${response.statusText}`);
      throw new Error(`Hackatime API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    metrics.increment("success.hackatime_by_email", 1);
    console.log('📦 Full Hackatime response:', JSON.stringify(data, null, 2));
    console.log(`✅ Found Hackatime ID: ${data.user_id}`);
    return data.user_id as string;
  } catch (error) {
    metrics.increment("errors.hackatime_by_email", 1);
    console.error(`💥 Error looking up Hackatime ID by email:`, error);
    throw error;
  }
}

export async function lookupHackatimeIdBySlack(slackId: string): Promise<string | null> {
  console.log(`🔍 Looking up Hackatime ID for Slack ID: ${slackId}`);
  const uri = `https://hackatime.hackclub.com/api/v1/users/lookup_slack_uid/${slackId}`;
  
  try {
    const response = await fetch(uri, {
      headers: {
        'Authorization': `Bearer ${process.env.HACKATIME_API_TOKEN}`,
        'Rack-Attack-Bypass': HACKATIME_RACK_ATTACK_BYPASS_TOKEN || '',
      }
    });
    console.log(`📥 Lookup Response Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 404) {
      console.log('⚠️ No Hackatime user found for Slack ID');
      return null;
    }
    
    if (!response.ok) {
      metrics.increment("errors.hackatime_api_error", 1);
      console.error(`❌ Hackatime API error: ${response.status} ${response.statusText}`);
      throw new Error(`Hackatime API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    metrics.increment("success.hackatime_by_email", 1);
    console.log('📦 Full Hackatime response:', JSON.stringify(data, null, 2));
    console.log(`✅ Found Hackatime ID: ${data.user_id}`);
    return data.user_id as string;
  } catch (error) {
    metrics.increment("errors.hackatime_by_email", 1);
    console.error(`💥 Error looking up Hackatime ID by Slack ID:`, error);
    throw error;
  }
}

export interface HackatimeSetupStatus {
  isSetup: boolean;
  error?: string;
}

/**
 * Checks if a user has Hackatime properly set up by verifying their Hackatime ID
 * exists in our database or can be found via their email.
 */
export async function checkHackatimeSetup(userId: string, userEmail: string): Promise<HackatimeSetupStatus> {
  if (HACKATIME_MOCK) {
    return { isSetup: true };
  }

  try {
    // First check if we already have a Hackatime ID stored
    console.log('🔍 Checking database for existing Hackatime ID...');
    const dbUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!dbUser) {
      console.log('❌ User not found in database');
      return { isSetup: false, error: 'User not found' };
    }

    console.log('👤 Found user:', { 
      id: dbUser.id, 
      email: dbUser.email,
      hasSlack: !!dbUser.slack,
      hasHackatime: !!dbUser.hackatimeId 
    });

    // If we have a Hackatime ID stored, they're set up
    if (dbUser.hackatimeId) {
      console.log('✅ User already has Hackatime ID:', dbUser.hackatimeId);
      return { isSetup: true };
    }

    // Try Slack ID first if available
    let hackatimeId: string | null = null;
    if (dbUser.slack) {
      console.log('🔍 Looking up Hackatime ID by Slack ID:', dbUser.slack);
      hackatimeId = await lookupHackatimeIdBySlack(dbUser.slack);
      console.log(hackatimeId ? '✅ Found Hackatime ID via Slack' : '❌ No Hackatime ID found via Slack');
    } else {
      console.log('⏭️ Skipping Slack lookup - no Slack ID available');
    }

    // If no Slack ID or lookup failed, try email
    if (!hackatimeId) {
      console.log('🔍 Attempting email lookup with:', dbUser.email);
      hackatimeId = await lookupHackatimeIdByEmail(userEmail);
      console.log(hackatimeId ? '✅ Found Hackatime ID via email' : '❌ No Hackatime ID found via email');
    }
    
    if (hackatimeId) {
      // Found ID, save it and return success
      console.log('💾 Saving Hackatime ID to database:', hackatimeId);
      await prisma.user.update({
        where: { id: userId },
        data: { hackatimeId: hackatimeId.toString() }
      });
      console.log('✅ Successfully saved Hackatime ID');
      return { isSetup: true };
    }

    metrics.increment("errors.get_hackatime_id", 1);
    console.log('❌ No Hackatime ID found through any method');
    return { isSetup: false };
  } catch (error) {
    metrics.increment("errors.hackatime_status", 1);
    console.error('💥 Error checking Hackatime status:', error);
    return { isSetup: false, error: 'Failed to check Hackatime status' };
  }
}
