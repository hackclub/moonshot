#!/usr/bin/env tsx
/**
 * Synchronize Hackatime hours with the database
 * 
 * This script:
 * 1. Fetches all users with hackatimeId
 * 2. For each user, fetches their Hackatime projects
 * 3. Updates HackatimeProjectLink records with the latest rawHours
 */

import { PrismaClient } from '../../../app/generated/prisma/client';
import * as dotenv from 'dotenv';
import { exponentialFetchRetry } from '../exponentialRetry/exponentialRetry';
import { AppConfig } from '../../../lib/config';

// Load environment variables
dotenv.config();

// Check for dry run mode
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error']
});

// Hackatime API base URL and token
const HACKATIME_API_URL = process.env.HACKATIME_API_URL || 'https://hackatime.hackclub.com/api';
const HACKATIME_API_TOKEN = process.env.HACKATIME_API_TOKEN;
const HACKATIME_RACK_ATTACK_BYPASS_TOKEN = process.env.HACKATIME_RACK_ATTACK_BYPASS_TOKEN;

if (!HACKATIME_API_TOKEN) {
  console.error('HACKATIME_API_TOKEN environment variable must be set');
  process.exit(1);
}

interface HackatimeProject {
  name: string;
  total_seconds: number;
  hours: number; // Keep for backward compatibility, but we'll use total_seconds for precision
}

interface UpdatedLink {
  projectName: string;
  hackatimeName: string;
  oldHours: number;
  newHours: number;
  delta: number;
}

async function getHackatimeProjects(hackatimeId: string): Promise<HackatimeProject[]> {
  try {
    const uri = `${HACKATIME_API_URL}/v1/users/${hackatimeId}/stats?features=projects&start_date=${AppConfig.hackatimeStartDate}`;
    
    const response = await exponentialFetchRetry(uri, {
      headers: {
        'Authorization': `Bearer ${HACKATIME_API_TOKEN}`,
        'Rack-Attack-Bypass': `${HACKATIME_RACK_ATTACK_BYPASS_TOKEN}`
      }
    });
    
    if (!response.ok) {
      console.error(`Error fetching Hackatime projects for user ${hackatimeId}: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data || !data.data || !data.data.projects || !Array.isArray(data.data.projects)) {
      console.error(`Unexpected response format for user ${hackatimeId}`);
      return [];
    }
    
    return data.data.projects as HackatimeProject[];
  } catch (error) {
    console.error(`Failed to fetch Hackatime projects for user ${hackatimeId}:`, error);
    return [];
  }
}

async function main(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting Hackatime hours synchronization...`);
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No database changes will be made');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  try {
    console.log('Connecting to database...');
    
    // Find all users with hackatimeId
    const users = await prisma.user.findMany({
      where: { 
        hackatimeId: { 
          not: null 
        } 
      },
      select: {
        id: true,
        name: true,
        email: true,
        hackatimeId: true
      }
    });
    
    console.log(`Found ${users.length} users with Hackatime IDs`);
    
    let totalUpdatedLinks = 0;
    let totalDelta = 0; // Track total change in hours
    
    // Process each user
    for (const user of users) {
      if (!user.hackatimeId) continue;
      
      console.log(`Processing user ${user.name || user.email || user.id} (Hackatime ID: ${user.hackatimeId})`);
      
      try {
        // Get Hackatime projects for this user
        const hackatimeProjects = await getHackatimeProjects(user.hackatimeId);
        
        if (!hackatimeProjects || hackatimeProjects.length === 0) {
          console.log(`No Hackatime projects found for user ${user.id}`);
          continue;
        }
        
        // Get all projects for this user with their Hackatime links
        const userProjects = await prisma.project.findMany({
          where: { userId: user.id },
          select: {
            projectID: true,
            name: true,
            hackatimeLinks: {
              select: {
                id: true,
                hackatimeName: true,
                rawHours: true
              }
            }
          }
        });
        
        // Track which links were updated
        const updatedLinks: UpdatedLink[] = [];
        
        // Update each HackatimeProjectLink with matching hackatime name
        for (const project of userProjects) {
          for (const link of project.hackatimeLinks) {
            const hackatimeProject = hackatimeProjects.find(hp => hp.name === link.hackatimeName);
            
            if (hackatimeProject) {
              // Calculate precise hours from total_seconds and round to 2 decimal places for aesthetics
              const hours = Math.round((hackatimeProject.total_seconds / 3600) * 100) / 100;
              
              // Only update if hours are different to avoid unnecessary database writes
              if (link.rawHours !== hours) {
                try {
                  if (!DRY_RUN) {
                    await prisma.hackatimeProjectLink.update({
                      where: { id: link.id },
                      data: { rawHours: hours }
                    });
                  }
                  
                  // Calculate delta (change in hours)
                  const delta = hours - link.rawHours;
                  
                  // Track the update (or would-be update in dry run mode)
                  updatedLinks.push({
                    projectName: project.name,
                    hackatimeName: link.hackatimeName,
                    oldHours: link.rawHours,
                    newHours: hours,
                    delta: delta
                  });
                } catch (updateError) {
                  console.error(`Failed to update link ${link.hackatimeName}:`, updateError);
                }
              }
            }
          }
        }
        
        if (updatedLinks.length > 0) {
          const action = DRY_RUN ? 'Would update' : 'Updated';
          console.log(`${action} ${updatedLinks.length} Hackatime links for user ${user.id}:`);
          
          let userDelta = 0;
          for (const link of updatedLinks) {
            const deltaSign = link.delta >= 0 ? '+' : '';
            console.log(`  - ${link.projectName} -> ${link.hackatimeName}: ${link.oldHours} -> ${link.newHours} hours (${deltaSign}${link.delta.toFixed(2)}h)`);
            userDelta += link.delta;
            totalDelta += link.delta;
          }
          
          const userDeltaSign = userDelta >= 0 ? '+' : '';
          console.log(`  Total delta for user: ${userDeltaSign}${userDelta.toFixed(2)} hours`);
          
          totalUpdatedLinks += updatedLinks.length;
        } else {
          console.log(`No Hackatime links needed updating for user ${user.id}`);
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
      }
    }
    
    const deltaSign = totalDelta >= 0 ? '+' : '';
    const summary = DRY_RUN 
      ? `Dry run completed successfully. Would update ${totalUpdatedLinks} total Hackatime links.`
      : `Synchronization completed successfully. Updated ${totalUpdatedLinks} total Hackatime links.`;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(summary);
    console.log(`Total delta: ${deltaSign}${totalDelta.toFixed(2)} hours`);
    
    if (DRY_RUN) {
      console.log('\n💡 This was a dry run. No changes were made to the database.');
      console.log('   Run without --dry-run flag to apply these changes.');
    }
  } catch (error) {
    console.error(`Error during synchronization:`, error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main(); 
