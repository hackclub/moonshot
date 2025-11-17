export interface ProgressMetrics {
  shippedHours: number;
  viralHours: number;
  otherHours: number;
  totalHours: number;
  totalPercentage: number;
  rawHours: number;
  availablecurrency: number;
}

// Helper to get project hours with our matching logic
export function getProjectHackatimeHours(project: any): number {
  // Safety check for null/undefined project
  if (!project) return 0;
  
  // If project has hackatimeLinks, calculate total from all links
  if (project.hackatimeLinks && project.hackatimeLinks.length > 0) {
    return project.hackatimeLinks.reduce((sum: number, link: any) => {
      // Use the link's hoursOverride if it exists, otherwise use rawHours
      const effectiveHours = (link.hoursOverride !== undefined && link.hoursOverride !== null)
        ? link.hoursOverride
        : (typeof link.rawHours === 'number' ? link.rawHours : 0);
      
      return sum + effectiveHours;
    }, 0);
  }
  
  // Fallback for backward compatibility - use project-level rawHours
  return project?.rawHours || 0;
}


export function getProjectApprovedHours(project: any): number {
  // Safety check for null/undefined project
  if (!project) return 0;
  
  let hackatimeApprovedHours = 0;
  
  // If project has hackatimeLinks, calculate total from ONLY approved hours
  if (project.hackatimeLinks && project.hackatimeLinks.length > 0) {
    hackatimeApprovedHours = project.hackatimeLinks.reduce((sum: number, link: any) => {
      // Only count hoursOverride as approved hours
      if (link.hoursOverride !== undefined && link.hoursOverride !== null) {
        return sum + link.hoursOverride;
      }
      // No hoursOverride means no approved hours for this link
      return sum;
    }, 0);
  } else {
    // Fallback for backward compatibility - use project-level hoursOverride
    hackatimeApprovedHours = project?.hoursOverride || 0;
  }
  
  // Add journal approved hours
  const journalApprovedHours = getProjectJournalApprovedHours(project);
  
  return hackatimeApprovedHours + journalApprovedHours;
}

// Journal helpers
function getProjectJournalRawHours(project: any): number {
  const v = (project as any)?.journalRawHours
  return typeof v === 'number' && isFinite(v) ? v : 0
}

function getProjectJournalApprovedHours(project: any): number {
  const v = (project as any)?.journalApprovedHours
  return typeof v === 'number' && isFinite(v) ? v : 0
}

/**
 * Fetches and aggregates journal hours (raw and approved) for multiple projects in a single query.
 * Returns a map of projectID -> { raw: number, approved: number }
 * Projects without journal entries will have zeros.
 */
async function getJournalHoursForProjects(
  projectIDs: string[]
): Promise<Record<string, { raw: number; approved: number }>> {
  const journalHoursMap: Record<string, { raw: number; approved: number }> = {};
  
  // Initialize all projects with zero hours
  projectIDs.forEach(id => {
    journalHoursMap[id] = { raw: 0, approved: 0 };
  });

  // Aggregate all chat messages for all projects at once
  if (projectIDs.length > 0) {
    const { prisma } = await import('@/lib/prisma');
    const chatMessages = await prisma.chatMessage.findMany({
      where: {
        room: {
          projectID: { in: projectIDs }
        }
      },
      select: {
        hours: true,
        approvedHours: true,
        room: {
          select: {
            projectID: true
          }
        }
      }
    });

    // Group and sum by projectID
    chatMessages.forEach(msg => {
      const projectID = msg.room.projectID;
      if (projectID && journalHoursMap[projectID]) {
        journalHoursMap[projectID].raw += typeof msg.hours === 'number' ? msg.hours : 0;
        journalHoursMap[projectID].approved += typeof msg.approvedHours === 'number' ? msg.approvedHours : 0;
      }
    });
  }

  return journalHoursMap;
}

/**
 * Enhances projects with journal hours from chat messages.
 * Fetches all journal hours in a single query and adds them to each project.
 */
async function enhanceProjectsWithJournalHours<T extends { projectID: string }>(
  projects: T[]
): Promise<(T & { journalRawHours: number; journalApprovedHours: number })[]> {
  const projectIDs = projects.map(p => p.projectID);
  const journalHoursMap = await getJournalHoursForProjects(projectIDs);

  return projects.map(project => ({
    ...project,
    journalRawHours: journalHoursMap[project.projectID]?.raw || 0,
    journalApprovedHours: journalHoursMap[project.projectID]?.approved || 0,
  }));
}

/**
 * Fetches all projects for a user, enhances them with journal hours, and calculates progress metrics.
 * This is the complete flow for getting user currency/stardust balance.
 */
export async function getUserProjectsWithMetrics(
  userId: string,
  totalCurrencySpent: number = 0,
  adminCurrencyAdjustment: number = 0
): Promise<{
  projects: any[];
  metrics: ProgressMetrics;
}> {
  // Get ALL projects for the user (including those with only journal entries, no hackatime)
  // include: { hackatimeLinks: true } just adds the relation data, it doesn't filter projects
  const { prisma } = await import('@/lib/prisma');
  const projectsRaw = await prisma.project.findMany({
    where: { userId },
    include: { hackatimeLinks: true }
  });

  // Enhance projects with journal hours from chat messages
  const projects = await enhanceProjectsWithJournalHours(projectsRaw);

  // Calculate comprehensive currency balance
  const metrics = calculateProgressMetrics(
    projects,
    totalCurrencySpent,
    adminCurrencyAdjustment
  );

  return { projects, metrics };
}

// Centralized function to calculate all progress metrics
export function calculateProgressMetrics(
  projects: any[], 
  totalCurrencySpent: number = 0,
  adminCurrencyAdjustment: number = 0
): ProgressMetrics {
  if (!projects || !Array.isArray(projects)) {
    return {
      shippedHours: 0,
      viralHours: 0,
      otherHours: 0,
      totalHours: 0,
      totalPercentage: 0,
      rawHours: 0,
      availablecurrency: Math.max(0, 0 - totalCurrencySpent + adminCurrencyAdjustment) // Final available currency
    };
  }

  let shippedHours = 0;
  let viralHours = 0;
  let otherHours = 0;
  let rawHours = 0;
  let earnedCurrency = 0;

  // Get all projects and their hours (for reporting only)
  const allProjectsWithHours = projects
    .map(project => ({ 
      project, 
      // Raw hours now include Hackatime raw/overrides + journal raw
      hours: getProjectHackatimeHours(project) + getProjectJournalRawHours(project)
    }))
    .sort((a, b) => b.hours - a.hours);


  // Sum raw hours across all projects (for reporting only)
  allProjectsWithHours.forEach(({ hours }) => {
    rawHours += hours;
  });

  // New simple currency model: currency = approvedHours * 2^8 (256)
  // Only pay out for approved hours on shipped projects
  const approvedHoursAcrossAllProjects = projects.reduce((sum, project) => {
    if (project?.shipped === true) {
      // getProjectApprovedHours already includes hackatime approved (overrides) + journal approved
      return sum + getProjectApprovedHours(project);
    }
    return sum;
  }, 0);
  earnedCurrency = approvedHoursAcrossAllProjects * 256;

  // Percentages and progress are no longer used
  const totalHours = 0;
  const totalPercentage = 0;

  // availablecurrency now represents final available currency (earned - spent + admin adjustment)
  const finalAvailablecurrency = Math.max(0, Math.floor(earnedCurrency) - totalCurrencySpent + adminCurrencyAdjustment);

  return {
    shippedHours,
    viralHours,
    otherHours,
    totalHours,
    totalPercentage,
    rawHours: rawHours,
    availablecurrency: finalAvailablecurrency
  };
} 