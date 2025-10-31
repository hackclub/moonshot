"use client"

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiFetch';
import { Toaster } from 'sonner';
import UserCategoryDisplay from '@/components/common/UserCategoryDisplay';
import { calculateProgressMetrics, getProjectHackatimeHours, getProjectApprovedHours, ProgressMetrics } from '@/lib/project-client';
import { AppConfig } from '@/lib/config';
import { ProjectType } from '@/app/api/projects/route';
import { SessionProvider, useSession } from 'next-auth/react';
import Header from '@/components/common/Header';
// MultiPartProgressBar removed from UI by request
import Tooltip from '@/components/common/Tooltip';
import Modal from '@/components/common/Modal';

// Force dynamic rendering to prevent prerendering errors during build
export const dynamic = 'force-dynamic';

enum UserStatus {
  Unknown = "Unknown",
  L1 = "L1", 
  L2 = "L2",
  FraudSuspect = "FraudSuspect"
}

enum UserRole {
  User = "User",
  Reviewer = "Reviewer", 
  Admin = "Admin"
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  emailVerified: Date | null;
  image: string | null;
  createdAt: Date;
  isAdmin: boolean;
  role: string;
  status: UserStatus;
  hackatimeId?: string;
  category?: {
    category: 'whale' | 'shipper' | 'newbie';
    description: string;
  } | null;
  projects: ProjectType[],
  identityToken?: string;
  purchasedProgressHours?: number;
  totalCurrencySpent?: number;
  adminCurrencyAdjustment?: number;
}

// Sorting types
type SortField = 'role' | 'name' | 'shipped' | 'raw_hours' | 'approved_hours' | 'stardust' | 'default';
type SortOrder = 'asc' | 'desc';

// Create a wrapper component that uses Suspense
function LeaderboardContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false); // deprecated
  const [progressData, setProgressData] = useState<Record<string, unknown>>({}); // deprecated
  const { data: session, status } = useSession();
  
  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await apiFetch('/api/users');
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        } else {
          console.error('Failed to fetch users:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchUsers();
  }, []);

  /*
          //filter users by most overrided hours
        const usersWithMetrics = users.map(user => {
            const metrics = calculateProgressMetrics(user.projects);
            return {
                ...user,
                metrics,
            };
        });
        //sort users by most overrided hours
        const sortedUsers = usersWithMetrics.sort((a, b) => (b.metrics.shippedHours + b.metrics.viralHours) - (a.metrics.shippedHours + a.metrics.viralHours));
  */
  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle sort order if same field is clicked
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to appropriate order
      setSortField(field);
      // Default to desc for numeric fields where higher is better
      setSortOrder(['approved_hours', 'raw_hours', 'shipped', 'stardust'].includes(field) ? 'desc' : 'asc');
    }
  };

  // Get sort icon
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };
const usersWithMetrics = users.map(user => {
  const metrics = calculateProgressMetrics(user.projects, user.totalCurrencySpent || 0, user.adminCurrencyAdjustment || 0);
  return {
    ...user,
    metrics,
  };
});
const sortedUsers = usersWithMetrics.sort((a, b) => (b.metrics.shippedHours + b.metrics.viralHours) - (a.metrics.shippedHours + a.metrics.viralHours));
  const filteredUsers = sortedUsers.filter(user => 
    (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ).map(user => {
    try {
      return { ...user, stats: calculateProgressMetrics(user.projects || [], user.totalCurrencySpent || 0, user.adminCurrencyAdjustment || 0) };
    } catch (error) {
      console.error('Error calculating progress metrics for user:', user.id, error);
      return { 
        ...user, 
        stats: {
          shippedHours: 0,
          viralHours: 0,
          otherHours: 0,
          totalHours: 0,
          totalPercentage: 0,
          rawHours: 0,
          availablecurrency: 0
        }
      };
    }
  }).sort((a, b) => {
    let result = 0;
    
    try {
      switch (sortField) {
        case 'name':
          const nameA = (a.name || a.email || '').toLowerCase();
          const nameB = (b.name || b.email || '').toLowerCase();
          result = nameA.localeCompare(nameB);
          break;
        case 'shipped':
          result = (b.projects.filter(project => project.shipped).length || 0) - (a.projects.filter(project => project.shipped).length || 0);
          break;
        case 'raw_hours':
          result = (b.stats.rawHours || 0) - (a.stats.rawHours || 0);
          break;
        case 'approved_hours':
          const approvedA = (a.projects || []).reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
          const approvedB = (b.projects || []).reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
          result = approvedB - approvedA;
          break;
        case 'stardust':
          const stardustA = calculateProgressMetrics(
            a.projects,
            a.totalCurrencySpent || 0,
            a.adminCurrencyAdjustment || 0
          ).availablecurrency;
          const stardustB = calculateProgressMetrics(
            b.projects,
            b.totalCurrencySpent || 0,
            b.adminCurrencyAdjustment || 0
          ).availablecurrency;
          result = stardustB - stardustA;
          break;
        default:
          // Default sort: 1. approved hours, 2. # ships, 3. raw hours, 4. stardust
          const approvedHoursA = (a.projects || []).reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
          const approvedHoursB = (b.projects || []).reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
          result = approvedHoursB - approvedHoursA;
          
          if (result === 0) {
            // Tie-breaker: # ships
            const shipsA = a.projects.filter(project => project.shipped).length || 0;
            const shipsB = b.projects.filter(project => project.shipped).length || 0;
            result = shipsB - shipsA;
            
            if (result === 0) {
              // Tie-breaker: raw hours
              result = (b.stats.rawHours || 0) - (a.stats.rawHours || 0);
              
              if (result === 0) {
                // Tie-breaker: stardust
                const stardustA = calculateProgressMetrics(
                  a.projects,
                  a.totalCurrencySpent || 0,
                  a.adminCurrencyAdjustment || 0
                ).availablecurrency;
                const stardustB = calculateProgressMetrics(
                  b.projects,
                  b.totalCurrencySpent || 0,
                  b.adminCurrencyAdjustment || 0
                ).availablecurrency;
                result = stardustB - stardustA;
              }
            }
          }
          break;
      }
      
      return sortOrder === 'asc' ? result : -result;
    } catch (error) {
      console.error('Error in sorting:', error);
      return 0;
    }
  });

   // Fetch shell balance and progress data
  useEffect(() => {
   const fetchShellBalance = async () => {
     if (status !== 'authenticated' || !session?.user?.id) return;
     try {
       const response = await apiFetch('/api/users/me/currency');
       if (response.ok) {
         const data = await response.json();
         setProgressData(data.progress);
       } else if (response.status !== 401) {
         console.error('Failed to fetch shell balance:', response.status);
       }
     } catch (error) {
       console.error('Error fetching shell balance:', error);
     }
   };

   fetchShellBalance();
 }, [status, session?.user?.id]);

  const getProgressBadge = (user: User, projects: ProjectType[]) => {
    try {
      const progressMetrics = calculateProgressMetrics(projects, user.totalCurrencySpent || 0, user.adminCurrencyAdjustment || 0);

      return (
        <div className="text-xs text-gray-500">Progress hidden</div>
      );
    } catch (error) {
      console.error('Error calculating progress metrics:', error);
      return (
        <div className="text-gray-400">Error</div>
      );
    }
  };

  // Debug logging can be removed in production
  // console.log('Users array length:', users.length);
  // console.log('Filtered users length:', filteredUsers.length);
  // console.log('Sort field:', sortField, 'Sort order:', sortOrder);
  // console.log('Search term:', searchTerm);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Moonshot Leaderboard</h1>
      </div>
      
      <div className="mb-6">
        <div className="relative" style={{ width: '400px', maxWidth: '100%' }}>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black placeholder:text-gray-500"
          />
          <span className="absolute right-3 top-3 text-gray-400">
            🔍
          </span>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block rounded-lg shadow overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              <thead style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
                <tr>
                  <th 
                    scope="col" 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-40 cursor-pointer select-none"
                    onClick={() => handleSort('name')}
                    style={{ transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-1">
                      User
                      <span className="text-xs">{getSortIcon('name')}</span>
                    </div>
                  </th>
                  {/* Progress column removed */}
                  <th 
                    scope="col" 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-30 cursor-pointer select-none"
                    onClick={() => handleSort('approved_hours')}
                    style={{ transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-1">
                      Approved hours
                      <span className="text-xs">{getSortIcon('approved_hours')}</span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-30 cursor-pointer select-none"
                    onClick={() => handleSort('shipped')}
                    style={{ transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-1">
                      # Shipped
                      <span className="text-xs">{getSortIcon('shipped')}</span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-30 cursor-pointer select-none"
                    onClick={() => handleSort('raw_hours')}
                    style={{ transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-1">
                      Raw Hours
                      <span className="text-xs">{getSortIcon('raw_hours')}</span>
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider min-w-30 cursor-pointer select-none"
                    onClick={() => handleSort('stardust')}
                    style={{ transition: 'background-color 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div className="flex items-center gap-1">
                      {AppConfig.currencyName}
                      <span className="text-xs">{getSortIcon('stardust')}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-gray-300">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => (
                    <tr key={user.id}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          {user.image ? (
                            <img className="h-8 w-8 rounded-full mr-2" src={user.image} alt={user.name || 'User'} />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center mr-2">
                              <span className="text-gray-200 font-bold text-xs">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white flex items-center gap-4">
                              {user.name || 'Unknown'}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Progress badge removed */}
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {(() => {
                            try {
                              const projects = user.projects || [];
                              const approved = projects.reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
                              return approved.toFixed(1);
                            } catch {
                              return '0.0';
                            }
                          })()}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {user.projects.filter(project => project.shipped).length}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {user.stats.rawHours.toFixed(1)}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm text-white">
                          {calculateProgressMetrics(
                            user.projects, 
                            user.totalCurrencySpent || 0,
                            user.adminCurrencyAdjustment || 0
                          ).availablecurrency}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden">
            {/* Mobile Sort Controls */}
            <div className="mb-4 rounded-lg shadow p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
              <div className="text-sm font-medium text-gray-300 mb-2">Sort by:</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSort('name')}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    sortField === 'name' 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'border-gray-500 text-gray-300'
                  }`}
                  style={sortField !== 'name' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                >
                  Name {sortField === 'name' && getSortIcon('name')}
                </button>
                <button
                  onClick={() => handleSort('approved_hours')}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    sortField === 'approved_hours' 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'border-gray-500 text-gray-300'
                  }`}
                  style={sortField !== 'approved_hours' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                >
                  Approved Hours {sortField === 'approved_hours' && getSortIcon('approved_hours')}
                </button>
                <button
                  onClick={() => handleSort('shipped')}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    sortField === 'shipped' 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'border-gray-500 text-gray-300'
                  }`}
                  style={sortField !== 'shipped' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                >
                  # Shipped {sortField === 'shipped' && getSortIcon('shipped')}
                </button>
                <button
                  onClick={() => handleSort('raw_hours')}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    sortField === 'raw_hours' 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'border-gray-500 text-gray-300'
                  }`}
                  style={sortField !== 'raw_hours' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                >
                  Raw Hours {sortField === 'raw_hours' && getSortIcon('raw_hours')}
                </button>
                <button
                  onClick={() => handleSort('stardust')}
                  className={`px-3 py-1 text-xs rounded-full border ${
                    sortField === 'stardust' 
                      ? 'bg-blue-600 border-blue-500 text-white' 
                      : 'border-gray-500 text-gray-300'
                  }`}
                  style={sortField !== 'stardust' ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
                >
                  {AppConfig.currencyName} {sortField === 'stardust' && getSortIcon('stardust')}
                </button>
                {/* Progress sort removed */}
                
              </div>
            </div>
            
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 rounded-lg shadow" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <p className="text-gray-300">No users found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredUsers.map((user, index) => (
                  <div 
                    key={user.id}
                    className="block rounded-lg shadow-md overflow-hidden"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                  >
                    <div className="p-4">
                      <div className="flex items-center mb-3">
                        {user.image ? (
                          <img className="h-12 w-12 rounded-full mr-3" src={user.image} alt={user.name || 'User'} />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-600 flex items-center justify-center mr-3">
                            <span className="text-gray-200 font-bold">{(user.name || user.email || 'U').charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <div className="text-base font-medium text-white flex items-center gap-1">
                            {user.name || 'Unknown'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-3 text-sm">
                        <div>
                          <span className="text-gray-300 block">Approved Hours</span>
                          <span className="text-white">
                            {(() => {
                              try {
                                const projects = user.projects || [];
                                const approved = projects.reduce((sum, p) => sum + getProjectApprovedHours(p), 0);
                                return approved.toFixed(1);
                              } catch {
                                return '0.0';
                              }
                            })()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-300 block"># Shipped</span>
                          <span className="text-white">
                            {user.projects.filter(project => project.shipped).length}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-300 block">Raw Hours</span>
                          <span className="text-white">
                            {user.stats.rawHours.toFixed(1)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-300 block">{AppConfig.currencyName}</span>
                          <span className="text-white">
                            {calculateProgressMetrics(
                              user.projects, 
                              user.totalCurrencySpent || 0,
                              user.adminCurrencyAdjustment || 0
                            ).availablecurrency}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

                     {/* Progress Information Modal */}
                     <Modal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        title="Progress Information"
        okText="Got it!"
      >
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-3">Your Journey to Moonshot</h3>
          <p className="mb-4">
            The progress bar shows your completion percentage towards the 60-hour goal required to qualify for Moonshot.
          </p>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-2">Requirements for Moonshot:</h4>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Complete at least 60 hours of development time (roughly 15 hours per project) and ship 4 fully deployed projects
              </li>
              <li>
                Make at least one of your projects go viral according to our <a href="/info/go-viral" className="text-blue-600 hover:underline">defined criteria</a>
              </li>
            </ol>
          </div>
        </div>
      </Modal>
      

      <Toaster richColors />
    </div>
  );
}

// Main component that wraps the content with Suspense
export default function Users() {
  function PageShell() {
    const { data: session, status } = useSession();
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'transparent', color: 'var(--foreground)' }}>
        <Suspense fallback={<div className="w-full h-16" />}> 
          <Header session={session} status={status} />
        </Suspense>
        <div className="flex-1 p-6 pt-24">
          <Suspense fallback={<div className="flex justify-center items-center h-64">Loading users...</div>}>
            <LeaderboardContent />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <SessionProvider>
      <PageShell />
    </SessionProvider>
  );
}
