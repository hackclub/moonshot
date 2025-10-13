import { describe, test, expect } from 'vitest';

function getProjectHackatimeHours(project: any): number {
  if (!project) return 0;
  
  if (project.hackatimeLinks && project.hackatimeLinks.length > 0) {
    return project.hackatimeLinks.reduce((sum: number, link: any) => {
      const effectiveHours = (link.hoursOverride !== undefined && link.hoursOverride !== null)
        ? link.hoursOverride
        : (typeof link.rawHours === 'number' ? link.rawHours : 0);
      
      return sum + effectiveHours;
    }, 0);
  }
  
  return project?.rawHours || 0;
}

function getProjectApprovedHours(project: any): number {
  if (!project) return 0;
  
  if (project.hackatimeLinks && project.hackatimeLinks.length > 0) {
    return project.hackatimeLinks.reduce((sum: number, link: any) => {
      if (link.hoursOverride !== undefined && link.hoursOverride !== null) {
        return sum + link.hoursOverride;
      }
      return sum;
    }, 0);
  }
  
  return project?.hoursOverride || 0;
}

function calculateProgressMetrics(
  projects: any[], 
  purchasedProgressHours: number = 0,
  totalShellsSpent: number = 0,
  adminShellAdjustment: number = 0
) {
  if (!projects || !Array.isArray(projects)) {
    return {
      shippedHours: 0,
      viralHours: 0,
      otherHours: 0,
      totalHours: 0,
      totalPercentage: 0,
      rawHours: 0,
      availableShells: Math.max(0, 0 - totalShellsSpent + adminShellAdjustment),
      purchasedProgressHours,
      totalProgressWithPurchased: purchasedProgressHours,
      totalPercentageWithPurchased: Math.min(purchasedProgressHours, 100)
    };
  }

  let shippedHours = 0;
  let viralHours = 0;
  let otherHours = 0;
  let rawHours = 0;
  let availableShells = 0;

  const allProjectsWithHours = projects
    .map(project => ({
      project,
      hours: getProjectHackatimeHours(project)
    }))
    .sort((a, b) => b.hours - a.hours);

  const top4Projects = allProjectsWithHours.slice(0, 4);
  
  top4Projects.forEach(({ project, hours }) => {
    let cappedHours = Math.min(hours, 15);
    const approvedHours = getProjectApprovedHours(project);
    
    if (project?.shipped === true && approvedHours > 0) {
      shippedHours += cappedHours;
    } 
    else {
      otherHours += Math.min(cappedHours, 14.75);
    }
  });

  const phi = (1 + Math.sqrt(5)) / 2;
  const top4ProjectIds = new Set(top4Projects.map(({ project }) => project.projectID));
  
  allProjectsWithHours.forEach(({ project, hours }) => {
    rawHours += hours;
    
    if (project?.shipped === true) {
      const approvedHours = getProjectApprovedHours(project);
      
      if (approvedHours > 0) {
        if (top4ProjectIds.has(project.projectID)) {
          if (approvedHours > 15) {
            availableShells += (approvedHours - 15) * (phi * 10);
          }
        } else {
          availableShells += approvedHours * (phi * 10);
        }
      }
    }
  });

  const totalHours = Math.min(shippedHours + viralHours + otherHours, 60);
  const totalPercentage = Math.min((totalHours / 60) * 100, 100);
  const totalProgressWithPurchased = Math.min(totalHours + (purchasedProgressHours * 0.6), 60);
  const totalPercentageWithPurchased = Math.min(totalPercentage + purchasedProgressHours, 100);
  const finalAvailableShells = Math.max(0, Math.floor(availableShells) - totalShellsSpent + adminShellAdjustment);

  return {
    shippedHours,
    viralHours: 0,
    otherHours,
    totalHours,
    totalPercentage,
    rawHours: rawHours,
    availableShells: finalAvailableShells,
    purchasedProgressHours,
    totalProgressWithPurchased,
    totalPercentageWithPurchased
  };
}

function createMockProject(options: {
  projectID?: string;
  shipped?: boolean;
  viral?: boolean;
  rawHours?: number;
  hackatimeLinks?: Array<{
    rawHours?: number;
    hoursOverride?: number | null;
  }>;
}) {
  return {
    projectID: options.projectID || 'test-project-' + Math.random(),
    name: 'Test Project',
    shipped: options.shipped || false,
    viral: options.viral || false,
    rawHours: options.rawHours || 0,
    hackatimeLinks: options.hackatimeLinks || [],
  };
}

describe('Project Calculations', () => {
  describe('getProjectHackatimeHours', () => {
    test('returns 0 for null/undefined project', () => {
      expect(getProjectHackatimeHours(null)).toBe(0);
      expect(getProjectHackatimeHours(undefined)).toBe(0);
    });

    test('uses rawHours when no hackatimeLinks', () => {
      const project = createMockProject({ rawHours: 10 });
      expect(getProjectHackatimeHours(project)).toBe(10);
    });

    test('sums rawHours from hackatimeLinks when present', () => {
      const project = createMockProject({
        rawHours: 100,
        hackatimeLinks: [
          { rawHours: 5 },
          { rawHours: 8 },
          { rawHours: 3 }
        ]
      });
      expect(getProjectHackatimeHours(project)).toBe(16);
    });

    test('uses hoursOverride when available', () => {
      const project = createMockProject({
        hackatimeLinks: [
          { rawHours: 10, hoursOverride: 15 },
          { rawHours: 5, hoursOverride: null },
          { rawHours: 8 }
        ]
      });
      expect(getProjectHackatimeHours(project)).toBe(28);
    });
  });

  describe('getProjectApprovedHours', () => {
    test('returns 0 for null/undefined project', () => {
      expect(getProjectApprovedHours(null)).toBe(0);
      expect(getProjectApprovedHours(undefined)).toBe(0);
    });

    test('only counts hoursOverride as approved hours', () => {
      const project = createMockProject({
        rawHours: 100,
        hackatimeLinks: [
          { rawHours: 10, hoursOverride: 8 },
          { rawHours: 5, hoursOverride: null },
          { rawHours: 15 }
        ]
      });
      expect(getProjectApprovedHours(project)).toBe(8);
    });
  });

  describe('calculateProgressMetrics', () => {
    test('handles empty projects array', () => {
      const result = calculateProgressMetrics([]);
      expect(result.shippedHours).toBe(0);
      expect(result.otherHours).toBe(0);
      expect(result.totalHours).toBe(0);
      expect(result.availableShells).toBe(0);
    });

    test('calculates basic progress for single projects', () => {
      const shippedProject = [createMockProject({ 
        shipped: true, 
        rawHours: 12,
        hackatimeLinks: [{ rawHours: 12, hoursOverride: 12 }]
      })];
      const shippedResult = calculateProgressMetrics(shippedProject);
      expect(shippedResult.shippedHours).toBe(12);
      expect(shippedResult.otherHours).toBe(0);

      const unshippedProject = [createMockProject({ 
        shipped: false, 
        rawHours: 8
      })];
      const unshippedResult = calculateProgressMetrics(unshippedProject);
      expect(unshippedResult.shippedHours).toBe(0);
      expect(unshippedResult.otherHours).toBe(8);
    });

    test('caps hours per project at 15 for island calculation', () => {
      const projects = [
        createMockProject({ 
          shipped: true, 
          rawHours: 20,
          hackatimeLinks: [{ rawHours: 20, hoursOverride: 20 }]
        }),
      ];
      const result = calculateProgressMetrics(projects);
      expect(result.shippedHours).toBe(15);
      expect(result.rawHours).toBe(20);
    });

    test('calculates clamshells for excess approved hours', () => {
      const phi = (1 + Math.sqrt(5)) / 2;
      const projects = [
        createMockProject({ 
          shipped: true, 
          rawHours: 20,
          hackatimeLinks: [{ rawHours: 20, hoursOverride: 20 }]
        }),
      ];
      const result = calculateProgressMetrics(projects);
      const expectedShells = Math.floor(5 * (phi * 10));
      expect(result.availableShells).toBe(expectedShells);
    });

    test('handles admin shell adjustments', () => {
      const projects = [
        createMockProject({
          shipped: true,
          rawHours: 20,
          hackatimeLinks: [{ rawHours: 20, hoursOverride: 20 }]
        })
      ];

      const phi = (1 + Math.sqrt(5)) / 2;
      const expectedEarnedShells = Math.floor(5 * (phi * 10));

      const positiveResult = calculateProgressMetrics(projects, 0, 0, 25);
      expect(positiveResult.availableShells).toBe(expectedEarnedShells + 25);

      const negativeResult = calculateProgressMetrics(projects, 0, 0, -10);
      expect(negativeResult.availableShells).toBe(expectedEarnedShells - 10);

      const clampedResult = calculateProgressMetrics(projects, 0, 100, -50);
      expect(clampedResult.availableShells).toBe(0);
    });

    test('only projects with approved hours count toward shipped', () => {
      const projects = [
        createMockProject({ 
          projectID: '1',
          shipped: true, 
          rawHours: 20,
          hackatimeLinks: [{ rawHours: 20 }]
        }),
        createMockProject({ 
          projectID: '2',
          shipped: true, 
          rawHours: 15,
          hackatimeLinks: [{ rawHours: 15, hoursOverride: 15 }]
        }),
      ];
      
      const result = calculateProgressMetrics(projects);
      expect(result.shippedHours).toBe(15);
      expect(result.otherHours).toBe(14.75);
    });

    test('handles multiple project types correctly', () => {
      const projects = [
        createMockProject({ 
          projectID: '1',
          shipped: true, 
          rawHours: 12,
          hackatimeLinks: [{ rawHours: 12, hoursOverride: 12 }]
        }),
        createMockProject({ 
          projectID: '2',
          shipped: false, 
          rawHours: 8
        }),
      ];
      
      const result = calculateProgressMetrics(projects);
      expect(result.shippedHours).toBe(12);
      expect(result.otherHours).toBe(8);
      expect(result.totalHours).toBe(20);
    });
  });
});