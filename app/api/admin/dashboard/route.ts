import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { opts } from '@/app/api/auth/[...nextauth]/route';

// Helper function to get audit logs time series data
async function getAuditLogTimeSeries() {
  // Get data for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Get all audit logs within the date range
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: {
        gte: thirtyDaysAgo
      }
    },
    select: {
      eventType: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'asc'
    }
  });
  
  // Group logs by date and event type
  const groupedData = new Map();
  
  // Initialize with dates for the past 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dateString = date.toISOString().split('T')[0];
    groupedData.set(dateString, {
      date: dateString,
      ProjectCreated: 0,
      ProjectSubmittedForReview: 0,
      ProjectMarkedShipped: 0,
      ProjectMarkedViral: 0,
      UserCreated: 0,
      UserRoleChanged: 0,
      UserVerified: 0,
      ProjectDeleted: 0,
      SlackConnected: 0,
      OtherEvent: 0
    });
  }
  
  // Count events by type and date
  auditLogs.forEach(log => {
    const dateString = log.createdAt.toISOString().split('T')[0];
    
    if (groupedData.has(dateString)) {
      const dateData = groupedData.get(dateString);
      // Increment the count for this event type
      if (dateData[log.eventType] !== undefined) {
        dateData[log.eventType] += 1;
      } else {
        dateData.OtherEvent += 1;
      }
    }
  });
  
  // Convert Map to array for the response
  return Array.from(groupedData.values());
}

export async function GET(request: NextRequest) {
  // Copious logging for diagnosing intermittent 401s
  try {
    const debugLoggingEnabled =
      process.env.NODE_ENV !== 'production' && process.env.ADMIN_DASHBOARD_DEBUG === '1';
    if (debugLoggingEnabled) {
      const cookieHeader = request.headers.get('cookie') || '';
      console.log('[ADMIN DASHBOARD] Incoming request', {
        method: request.method,
        url: request.nextUrl?.pathname || 'unknown',
        cookiePresent: cookieHeader.length > 0,
      });
    }
  } catch (e) {
    // Swallow logging errors silently in production-safe way
    console.log('[ADMIN DASHBOARD] Failed to log request headers');
  }

  // Check authentication
  const session = await getServerSession(opts);
  if (!session?.user) {
    console.log('[ADMIN DASHBOARD] getServerSession returned no user – sending 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const debugLoggingEnabled =
      process.env.NODE_ENV !== 'production' && process.env.ADMIN_DASHBOARD_DEBUG === '1';
    if (debugLoggingEnabled) {
      console.log('[ADMIN DASHBOARD] Session resolved', {
        role: session.user.role,
        isAdminFlag: session.user.isAdmin === true,
      });
    }
  } catch {}

  // Check for admin role or isAdmin flag
  const isAdmin = session.user.role === 'Admin' || session.user.isAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    // Count total users
    const totalUsers = await prisma.user.count();

    // Count total projects
    const totalProjects = await prisma.project.count();

    // Count shipped projects
    const shippedProjects = await prisma.project.count({
      where: {
        shipped: true
      }
    });

    // Count viral projects
    const viralProjects = await prisma.project.count({
      where: {
        viral: true
      }
    });

    // Count projects in review
    const projectsInReview = await prisma.project.count({
      where: {
        in_review: true
      }
    });
    
    // Count total audit logs
    const totalLogs = await prisma.auditLog.count();

    // Count users with Hackatime connected
    const usersWithHackatime = await prisma.user.count({
      where: {
        hackatimeId: {
          not: null
        }
      }
    });

    // Users without Hackatime
    const usersWithoutHackatime = totalUsers - usersWithHackatime;

    // Calculate project hour statistics
    const projects = await prisma.project.findMany({
      select: {
        shipped: true,
        in_review: true,
        hackatimeLinks: {
          select: {
            rawHours: true,
            hoursOverride: true
          }
        },
        chatRooms: {
          select: {
            messages: {
              select: {
                hours: true,
                approvedHours: true
              }
            }
          }
        }
      }
    });

    // Sum up different hour types
    let totalRawHours = 0;
    let totalEffectiveHours = 0;
    let shippedHours = 0;
    let reviewHours = 0;
    let totalHackatimeRawHours = 0;
    let totalJournalRawHours = 0;

    if (projects && projects.length > 0) {
      projects.forEach(project => {
        // Calculate raw hours and effective hours from hackatime links
        const hackatimeRawHours = project.hackatimeLinks.reduce(
          (sum, link) => sum + (typeof link.rawHours === 'number' ? link.rawHours : 0),
          0
        );
        
        // Calculate effective hours with overrides if present
        const hackatimeEffectiveHours = project.hackatimeLinks.reduce(
          (sum, link) => {
            const linkHours = (link.hoursOverride !== undefined && link.hoursOverride !== null)
              ? link.hoursOverride
              : (typeof link.rawHours === 'number' ? link.rawHours : 0);
            return sum + linkHours;
          },
          0
        );
        
        // Calculate journal hours from chat messages
        let journalRawHours = 0;
        let journalApprovedHours = 0;
        
        if (project.chatRooms && project.chatRooms.length > 0) {
          project.chatRooms.forEach(room => {
            if (room.messages && room.messages.length > 0) {
              room.messages.forEach(message => {
                // Add raw hours from journal entries
                journalRawHours += typeof message.hours === 'number' ? message.hours : 0;
                
                // Add approved hours (use approvedHours if present, otherwise fall back to hours)
                const approved = (message.approvedHours !== undefined && message.approvedHours !== null)
                  ? message.approvedHours
                  : (typeof message.hours === 'number' ? message.hours : 0);
                journalApprovedHours += approved;
              });
            }
          });
        }
        
        // Combine hackatime and journal hours
        const rawHours = hackatimeRawHours + journalRawHours;
        const effectiveHours = hackatimeEffectiveHours + journalApprovedHours;
        
        // Add to totals
        totalRawHours += rawHours;
        totalEffectiveHours += effectiveHours;
        totalHackatimeRawHours += hackatimeRawHours;
        totalJournalRawHours += journalRawHours;
        
        // Add to shipped hours if project is shipped
        if (project.shipped) {
          shippedHours += effectiveHours;
        }
        
        // Add to review hours if project is in review
        if (project.in_review) {
          reviewHours += effectiveHours;
        }
      });
    }

    // Get projects counts per user for mean and median calculation
    const userProjectCounts = await prisma.user.findMany({
      select: {
        id: true,
        _count: {
          select: {
            projects: true
          }
        }
      }
    });

    // Calculate mean projects per user
    const totalProjectsCount = userProjectCounts.reduce((sum, user) => sum + user._count.projects, 0);
    const meanProjectsPerUser = totalUsers > 0 ? totalProjectsCount / totalUsers : 0;
    
    // Calculate median projects per user
    const projectCountsArray = userProjectCounts.map(user => user._count.projects).sort((a, b) => a - b);
    let medianProjectsPerUser = 0;
    
    if (projectCountsArray.length > 0) {
      const midIndex = Math.floor(projectCountsArray.length / 2);
      if (projectCountsArray.length % 2 === 0) {
        // Even number of elements, average the middle two
        medianProjectsPerUser = (projectCountsArray[midIndex - 1] + projectCountsArray[midIndex]) / 2;
      } else {
        // Odd number of elements, take the middle one
        medianProjectsPerUser = projectCountsArray[midIndex];
      }
    }

    // Get audit log time series data
    const auditLogTimeSeries = await getAuditLogTimeSeries();

    // Count users with identity token
    const usersWithIdentityToken = await prisma.user.count({
      where: {
        identityToken: {
          not: null
        }
      }
    });
    const usersWithoutIdentityToken = totalUsers - usersWithIdentityToken;

    // Return all stats
    return NextResponse.json({
      totalUsers,
      totalProjects,
      projectsInReview,
      totalLogs,
      hackatimeStats: {
        withHackatime: usersWithHackatime,
        withoutHackatime: usersWithoutHackatime,
        // For pie chart data format
        pieData: [
          { name: 'With Hackatime', value: usersWithHackatime },
          { name: 'Without Hackatime', value: usersWithoutHackatime }
        ]
      },
      hourStats: {
        totalRawHours: Math.round(totalRawHours),
        totalEffectiveHours: Math.round(totalEffectiveHours),
        shippedHours: Math.round(shippedHours),
        reviewHours: Math.round(reviewHours),
        rawHoursBreakdown: {
          hackatimeRawHours: Math.round(totalHackatimeRawHours),
          journalRawHours: Math.round(totalJournalRawHours),
          pieData: [
            { name: 'Hackatime Raw Hours', value: Math.round(totalHackatimeRawHours) },
            { name: 'Journal Raw Hours', value: Math.round(totalJournalRawHours) }
          ]
        }
      },
      projectStats: {
        shipped: shippedProjects,
        notShipped: totalProjects - shippedProjects,
        viral: viralProjects,
        notViral: totalProjects - viralProjects,
        inReview: projectsInReview,
        notInReview: totalProjects - projectsInReview,
        // Pre-formatted pie chart data
        shippedPieData: [
          { name: 'Shipped', value: shippedProjects },
          { name: 'Not Shipped', value: totalProjects - shippedProjects }
        ],
        viralPieData: [
          { name: 'Viral', value: viralProjects },
          { name: 'Not Viral', value: totalProjects - viralProjects }
        ],
        reviewPieData: [
          { name: 'In Review', value: projectsInReview },
          { name: 'Not In Review', value: totalProjects - projectsInReview }
        ]
      },
      projectsPerUser: {
        mean: parseFloat(meanProjectsPerUser.toFixed(2)),
        median: parseFloat(medianProjectsPerUser.toFixed(2))
      },
      auditLogTimeSeries,
      identityTokenStats: {
        withIdentityToken: usersWithIdentityToken,
        withoutIdentityToken: usersWithoutIdentityToken,
        pieData: [
          { name: 'With Identity Token', value: usersWithIdentityToken },
          { name: 'Without Identity Token', value: usersWithoutIdentityToken }
        ]
      },
      // v1/v2 per-user hours for admin-only consumption
      // Each chartData entry: { label: user display name, v1: number, v2: number }
      ...(await (async () => {
        try {
          // Helper functions for distributions
          function calculatePercentile(sortedArray: number[], percentile: number): number {
            if (sortedArray.length === 0) return 0;
            const index = (percentile / 100) * (sortedArray.length - 1);
            const lower = Math.floor(index);
            const upper = Math.ceil(index);
            if (lower === upper) return sortedArray[lower];
            const weight = index - lower;
            return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
          }
          function generateSingleHistogramBins(values: number[]) {
            const all = values.filter(v => isFinite(v) && v >= 0);
            if (all.length === 0) return [] as Array<{ min: number; max: number; count: number }>;
            all.sort((a, b) => a - b);
            const q1 = calculatePercentile(all, 25);
            const q3 = calculatePercentile(all, 75);
            const iqr = Math.max(0, q3 - q1);
            const binWidth = Math.max(1, (2 * iqr) / Math.pow(all.length, 1/3));
            const actualMin = Math.min(...all);
            const minVal = Math.min(0, actualMin); // ensure starting at 0.0h
            const maxVal = Math.max(...all);
            const range = Math.max(1, maxVal - minVal);
            const numBins = Math.max(5, Math.ceil(range / binWidth));
            const actualWidth = range / numBins;
            const bins: Array<{ min: number; max: number; count: number }> = [];
            for (let i = 0; i < numBins; i++) {
              const binMin = minVal + (i * actualWidth);
              const binMax = i === numBins - 1 ? maxVal : minVal + ((i + 1) * actualWidth);
              bins.push({ min: binMin, max: binMax, count: 0 });
            }
            const put = (value: number) => {
              if (!isFinite(value) || value < minVal) return;
              let idx = Math.floor((value - minVal) / actualWidth);
              if (idx >= bins.length) idx = bins.length - 1;
              if (idx < 0) idx = 0;
              bins[idx].count += 1;
            };
            all.forEach(v => put(v));
            return bins;
          }

          // Find all users that have either v1 or v2 tag
          const usersWithVTags = await prisma.user.findMany({
            where: {
              userTags: {
                some: {
                  tag: {
                    name: { in: ['v1', 'v2'] }
                  }
                }
              }
            },
            select: {
              id: true,
              name: true,
              userTags: {
                select: { tag: { select: { name: true } } }
              }
            }
          });
          
          if (!usersWithVTags || usersWithVTags.length === 0) {
            return {
              vTagHours: {
                rawChartData: [] as Array<{ label: string; v1: number; v2: number }>,
                approvedChartData: [] as Array<{ label: string; v1: number; v2: number }>
              }
            };
          }
          
          // Map userId -> vTag ('v1' | 'v2')
          const userIdToVTag = new Map<string, 'v1' | 'v2'>();
          const userIdToName = new Map<string, string>();
          for (const u of usersWithVTags) {
            const tags = (u.userTags || []).map(t => t.tag?.name?.toLowerCase());
            if (tags.includes('v1')) {
              userIdToVTag.set(u.id, 'v1');
            } else if (tags.includes('v2')) {
              userIdToVTag.set(u.id, 'v2');
            }
            userIdToName.set(u.id, u.name || '');
          }
          
          const targetUserIds = Array.from(userIdToVTag.keys());
          if (targetUserIds.length === 0) {
            return {
              vTagHours: {
                rawChartData: [] as Array<{ label: string; v1: number; v2: number }>,
                approvedChartData: [] as Array<{ label: string; v1: number; v2: number }>
              }
            };
          }
          
          // Fetch all projects owned by those users with hours sources
          const projectsForUsers = await prisma.project.findMany({
            where: { userId: { in: targetUserIds } },
            select: {
              userId: true,
              shipped: true,
              hackatimeLinks: {
                select: { rawHours: true, hoursOverride: true }
              },
              chatRooms: {
                select: {
                  messages: {
                    select: { hours: true, approvedHours: true }
                  }
                }
              }
            }
          });
          
          // Aggregate per-user raw and approved hours
          const perUserAgg: Record<string, { rawHours: number; shippedApprovedHours: number }> = {};
          for (const userId of targetUserIds) {
            perUserAgg[userId] = { rawHours: 0, shippedApprovedHours: 0 };
          }
          
          for (const p of projectsForUsers) {
            let hackatimeRaw = 0;
            let hackatimeEffective = 0;
            for (const link of p.hackatimeLinks) {
              const raw = typeof link.rawHours === 'number' ? link.rawHours : 0;
              const effective = (link.hoursOverride !== undefined && link.hoursOverride !== null)
                ? link.hoursOverride
                : raw;
              hackatimeRaw += raw;
              hackatimeEffective += effective;
            }
            
            let journalRaw = 0;
            let journalApproved = 0;
            for (const room of p.chatRooms) {
              for (const msg of room.messages) {
                const raw = typeof msg.hours === 'number' ? msg.hours : 0;
                const approved = (msg.approvedHours !== undefined && msg.approvedHours !== null)
                  ? msg.approvedHours
                  : raw;
                journalRaw += raw;
                journalApproved += approved;
              }
            }
            
            const rawHours = hackatimeRaw + journalRaw;
            const approvedHours = hackatimeEffective + journalApproved;
            
            if (perUserAgg[p.userId]) {
              perUserAgg[p.userId].rawHours += rawHours;
              // Only count approved hours for shipped projects (in hours, not stardust)
              if (p.shipped) {
                perUserAgg[p.userId].shippedApprovedHours += approvedHours;
              }
            }
          }
          
          // Prepare chart data entries: one per user, with v1/v2 series
          const rawChartData: Array<{ label: string; v1: number; v2: number }> = [];
          const approvedChartData: Array<{ label: string; v1: number; v2: number }> = [];
          const rawValues: number[] = [];
          const approvedValues: number[] = [];
          
          for (const userId of targetUserIds) {
            const vTag = userIdToVTag.get(userId);
            if (!vTag) continue;
            const name = (userIdToName.get(userId) || '').trim() || `User ${userId.slice(0, 6)}`;
            const raw = Math.round(perUserAgg[userId]?.rawHours || 0);
            const shippedApprovedHours = Math.round(perUserAgg[userId]?.shippedApprovedHours || 0);
            rawValues.push(raw);
            approvedValues.push(shippedApprovedHours);
            
            rawChartData.push({
              label: name,
              v1: vTag === 'v1' ? raw : 0,
              v2: vTag === 'v2' ? raw : 0
            });
            approvedChartData.push({
              label: name,
              v1: vTag === 'v1' ? shippedApprovedHours : 0,
              v2: vTag === 'v2' ? shippedApprovedHours : 0
            });
          }
          
          // Sort by total descending for readability
          const byTotalDesc = (a: { v1: number; v2: number }, b: { v1: number; v2: number }) =>
            (b.v1 + b.v2) - (a.v1 + a.v2);
          rawChartData.sort(byTotalDesc);
          approvedChartData.sort(byTotalDesc);

          // Generate distributions (single series)
          const rawDistribution = generateSingleHistogramBins(rawValues);
          const approvedDistribution = generateSingleHistogramBins(approvedValues);

          // Helper to compute analysis summary similar to project histogram
          function computeAnalysis(values: number[], bins: Array<{ min: number; max: number; count: number }>) {
            const sorted = values.slice().sort((a, b) => a - b);
            const mean = sorted.length > 0 ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
            const median = calculatePercentile(sorted, 50);
            const p25 = calculatePercentile(sorted, 25);
            const p75 = calculatePercentile(sorted, 75);
            const p90 = calculatePercentile(sorted, 90);
            const analysis = {
              bins,
              mean,
              median,
              percentiles: { p25, p50: median, p75, p90 },
              classifications: {
                veryLow: p25,
                low: median,
                normal: p75,
                high: p90,
                veryHigh: Infinity
              },
              lastUpdated: new Date()
            };
            return analysis;
          }

          const rawAnalysis = computeAnalysis(rawValues, rawDistribution);
          const approvedAnalysis = computeAnalysis(approvedValues, approvedDistribution);
          
          return {
            vTagHours: {
              rawChartData,
              approvedChartData
            },
            vTagDistributions: {
              raw: rawDistribution,
              approved: approvedDistribution
            },
            vTagDistributionAnalysis: {
              raw: rawAnalysis,
              approved: approvedAnalysis
            }
          };
        } catch (e) {
          console.error('Failed to compute v1/v2 per-user hours for admin dashboard:', e);
          return {
            vTagHours: {
              rawChartData: [] as Array<{ label: string; v1: number; v2: number }>,
              approvedChartData: [] as Array<{ label: string; v1: number; v2: number }>
            },
            vTagDistributions: {
              raw: [] as Array<{ min: number; max: number; count: number }>,
              approved: [] as Array<{ min: number; max: number; count: number }>
            },
            vTagDistributionAnalysis: {
              raw: {
                bins: [] as Array<{ min: number; max: number; count: number }>,
                mean: 0,
                median: 0,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
                classifications: { veryLow: 0, low: 0, normal: 0, high: 0, veryHigh: Infinity },
                lastUpdated: new Date()
              },
              approved: {
                bins: [] as Array<{ min: number; max: number; count: number }>,
                mean: 0,
                median: 0,
                percentiles: { p25: 0, p50: 0, p75: 0, p90: 0 },
                classifications: { veryLow: 0, low: 0, normal: 0, high: 0, veryHigh: Infinity },
                lastUpdated: new Date()
              }
            }
          };
        }
      })())
    });
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin dashboard statistics' },
      { status: 500 }
    );
  }
} 