'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import Link from 'next/link';
import Icon from '@hackclub/icons';
import { ReviewModeProvider, useReviewMode } from '../contexts/ReviewModeContext';
import ProjectStatus from '@/components/common/ProjectStatus';
import ReviewSection from '@/components/common/ReviewSection';
import ProjectClassificationBadge from '@/components/common/ProjectClassificationBadge';
import ProjectHistogramChart from '@/components/common/ProjectHistogramChart';
import UserClusterChart from '@/components/common/UserClusterChart';
import UserCategoryBadge from '@/components/common/UserCategoryBadge';
import TagManagement from '@/components/common/TagManagement';
import TrustStats from '@/components/common/TrustStats';
import { useMDXComponents } from '@/mdx-components';
import { lazy, Suspense } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { AppConfig } from '@/lib/config';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import ImageWithFallback from '@/components/common/ImageWithFallback';

// Custom sanitization schema that allows video tags while blocking scripts
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'video'],
  attributes: {
    ...defaultSchema.attributes,
    video: ['class', 'controls', 'playsinline', 'src', 'style', 'width', 'height'],
  },
};

// Custom CSS for static glow effect
const glowStyles = `
  .goal-completing-glow {
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.4), 0 0 40px rgba(251, 191, 36, 0.3), 0 0 60px rgba(251, 191, 36, 0.2);
  }
`;

// Constants for the 60-hour goal calculation
const TOTAL_HOURS_GOAL = 60;
const MAX_HOURS_PER_PROJECT = 15;
const GOAL_COMPLETION_MIN_HOURS = 40; // Minimum project owner hours to be in "goal completing" range

const MDXShippedApproval = lazy(() => import('./review-guidelines/shipped-approval.mdx'));
const MDXShipUpdateApproval = lazy(() => import('./review-guidelines/ship-update-approval.mdx'));
const MDXOther = lazy(() => import('./review-guidelines/other.mdx'));

import LoadingOverlay from '@/components/common/LoadingOverlay';

import AccessDenied from '@/components/common/AccessDenied';

// Type definitions for review page
enum UserStatus {
  Unknown = "Unknown",
  L1 = "L1", 
  L2 = "L2",
  FraudSuspect = "FraudSuspect"
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: UserStatus;
}

interface Review {
  id: string;
  comment: string;
  createdAt: string;
  projectID: string;
  reviewerId: string;
  reviewer: User;
  reviewType?: string; // Optional for backward compatibility
}

interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
}

interface ProjectTag {
  id: string;
  tagId: string;
  createdAt: string;
  tag: Tag;
}

interface AIAnalysis {
  summary: string;
  setupInstructions: string;
  error?: string;
}

interface Project {
  projectID: string;
  name: string | null;
  description: string;
  codeUrl: string;
  playableUrl: string;
  screenshot: string;
  hackatime: string;
  submitted: boolean;
  userId: string;
  viral: boolean;
  shipped: boolean;
  in_review: boolean;
  approved: boolean;
  user: User;
  reviews: Review[];
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  userHackatimeId: string | null;
  userSlack: string | null;
  latestReview: Review | null;
  reviewCount: number;
  rawHours: number;
  ownerApprovedHours: number;
  hoursOverride?: number;
  hackatimeLinks?: {
    id: string;
    hackatimeName: string;
    rawHours: number;
    hoursOverride?: number;
  }[];
  projectTags?: ProjectTag[];
}

// Helper function to check if a project would complete the project owner's 60-hour goal
function wouldCompleteGoal(project: Project): boolean {
  // Get the project owner's current approved hours (already calculated in API)
  const ownerCurrentHours = project.ownerApprovedHours || 0;

  // Check if user already has 60+ hours - if so, don't show final project indicators
  if (ownerCurrentHours >= TOTAL_HOURS_GOAL) {
    return false;
  }

  // Get the project's hours
  const projectHours = project.rawHours || 0;

  // Check if owner currently has >40 approved hours and this project has ≥15 hours
  const ownerHasEnoughHours = ownerCurrentHours > GOAL_COMPLETION_MIN_HOURS;
  const projectIsSignificant = projectHours >= MAX_HOURS_PER_PROJECT;

  return ownerHasEnoughHours && projectIsSignificant;
}

// Helper function to check if a project owner would hit the 60-hour cap if their pending projects get approved
function hasHighHours(project: Project): boolean {
  // Get the project owner's current approved hours (calculated in API using identical logic as progress bar)
  const ownerCurrentHours = project.ownerApprovedHours || 0;
  
  // Check if they would hit the 60-hour cap (this requires additional calculation)
  // For now, we'll flag users with 45+ current hours as they're close to the cap
  return ownerCurrentHours >= 45;
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const reviewTypeLabels: Record<string, { label: string, color: string }> = {
    ShippedApproval: { label: 'Shipped', color: 'blue' },
    ViralApproval: { label: 'Viral', color: 'purple' },
    HoursApproval: { label: 'Ship Updates', color: 'green' },
    Other: { label: 'Other', color: 'gray' }
  };

  // Get the review type from the latest review or default to Other
  const reviewType = project.latestReview?.reviewType || 'Other';
  const { label, color } = reviewTypeLabels[reviewType] || reviewTypeLabels.Other;

  // Calculate days in review
  const calculateDaysInReview = () => {
    if (!project.latestReview?.createdAt) return null;
    
    const reviewDate = new Date(project.latestReview.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - reviewDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysInReview = calculateDaysInReview();
  const userHasHighHours = hasHighHours(project);

  return (
    <div 
      className="bg-black/60 text-white border border-white/10 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {/* Project Screenshot */}
      {project.screenshot && (
        <div className="relative h-48 w-full">
          <ImageWithFallback
            src={project.screenshot}
            alt={project.name || 'Project screenshot'}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className={`p-4 border-l-4 ${color === 'blue' ? 'border-l-blue-400' : color === 'purple' ? 'border-l-purple-400' : color === 'green' ? 'border-l-green-400' : 'border-l-gray-400'}`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold truncate">{project.name}</h3>
          <span className={`text-xs ${
            color === 'blue' ? 'bg-blue-600/20 text-blue-300' : 
            color === 'purple' ? 'bg-purple-600/20 text-purple-300' : 
            color === 'green' ? 'bg-green-600/20 text-green-300' : 
            'bg-white/10 text-white'
          } rounded-full px-2 py-1`}>
            {label}
          </span>
        </div>
        
        <p className="text-sm text-white/80 mb-3 line-clamp-2">{project.description}</p>
        
        {/* Project Tags */}
        {project.projectTags && project.projectTags.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1">
              {project.projectTags.slice(0, 3).map((projectTag) => (
                <span
                  key={projectTag.id}
                  className="inline-flex items-center px-2 py-1 text-xs rounded-full border"
                  style={{
                    backgroundColor: projectTag.tag.color ? `${projectTag.tag.color}20` : '#f3f4f6',
                    borderColor: projectTag.tag.color || '#d1d5db',
                    color: projectTag.tag.color || '#374151'
                  }}
                  title={projectTag.tag.description || undefined}
                >
                  {projectTag.tag.name}
                </span>
              ))}
              {project.projectTags.length > 3 && (
                <span className="inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded-full border border-gray-200">
                  +{project.projectTags.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            {project.userImage ? (
              <img 
                src={project.userImage} 
                alt={project.userName || ''} 
                className="w-6 h-6 rounded-full mr-2"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/20 mr-2 flex items-center justify-center">
                <span className="text-xs text-white/80">
                  {project.userName?.charAt(0) || '?'}
                </span>
              </div>
            )}
            <span className="text-xs text-white/80">{project.userName}</span>
            {project.userHackatimeId && (
              <div className="ml-2">
                <TrustStats 
                  hackatimeId={project.userHackatimeId} 
                  userName={project.userName || 'User'} 
                  size="sm" 
                  showStats={true} 
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-xs text-white/70">
            {daysInReview !== null && (
              <div className="flex items-center gap-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  daysInReview <= 1 ? 'bg-green-100 text-green-800' :
                  daysInReview <= 3 ? 'bg-yellow-100 text-yellow-800' :
                  daysInReview <= 7 ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {daysInReview === 0 ? 'Today' : 
                   daysInReview === 1 ? '1 day' : 
                   `${daysInReview} days`}
                </span>
              </div>
            )}
            {userHasHighHours && (
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Last project
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>Reviews: {project.reviewCount}</span>
              {project.reviewCount >= 5 && (
                <img 
                  src="/thisisfine.gif" 
                  alt="This is fine - many reviews" 
                  className="w-6 h-6"
                  title={`This project has ${project.reviewCount} reviews on the review thread. Be cautious!`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIAnalysisSection({ project }: { project: Project }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [analysisData, setAnalysisData] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchAnalysis = async () => {
    if (hasLoaded || !project.codeUrl) return;
    
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/review/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          githubUrl: project.codeUrl
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analysis');
      }

      const data = await response.json();
      setAnalysisData(data);
      setHasLoaded(true);
    } catch (error) {
      console.error('Error fetching AI analysis:', error);
      setAnalysisData({
        summary: '',
        setupInstructions: '',
        error: error instanceof Error ? error.message : 'Failed to load analysis'
      });
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded && !hasLoaded) {
      fetchAnalysis();
    }
  };

  // Don't show if there's no GitHub URL
  if (!project.codeUrl) {
    return null;
  }

  return (
    <div className="bg-black/60 text-white rounded-lg overflow-hidden border border-white/10">
      <button
        onClick={handleToggle}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon glyph="analytics" size={16} />
          <h3 className="text-sm font-medium text-white">AI Project Analysis</h3>
        </div>
        <Icon 
          glyph={isExpanded ? "view-close" : "view-forward"} 
          size={16} 
          className="text-white/50" 
        />
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-white/70">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
              <span className="text-sm">Analyzing project...</span>
            </div>
          )}
          
          {analysisData?.error && (
            <div className="text-red-300 text-sm bg-red-900/30 p-3 rounded border border-red-700/40">
              Error: {analysisData.error}
            </div>
          )}
          
          {analysisData && !analysisData.error && (
            <div className="space-y-4">
              {/* AI Warning */}
              <div className="bg-orange-900/30 border border-orange-700/40 rounded p-3">
                <div className="flex items-center gap-2">
                  <Icon glyph="important" size={16} className="text-orange-400" />
                  <span className="text-sm text-orange-300 font-medium">
                    This content was AI generated. AI is occasionally wrong.
                  </span>
                </div>
              </div>
              
              {analysisData.summary && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Project Summary</h4>
                  <div className="bg-black/40 p-3 rounded border border-white/10 prose prose-sm max-w-none ai-analysis-content text-white">
                    <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}>
                      {analysisData.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              
              {analysisData.setupInstructions && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Setup Instructions</h4>
                  <div className="bg-black/40 p-3 rounded border border-white/10 prose prose-sm max-w-none ai-analysis-content text-white">
                    <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}>
                      {analysisData.setupInstructions}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectDetail({ project, onClose, onReviewSubmitted }: { 
  project: Project; 
  onClose: () => void;
  onReviewSubmitted: () => void;
}) {
  const { data: session } = useSession();
  // Add debugging
  console.log('ProjectDetail selected project:', project);
  
  // Calculate days in review
  const calculateDaysInReview = () => {
    if (!project.latestReview?.createdAt) return null;
    
    const reviewDate = new Date(project.latestReview.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - reviewDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  };

  const daysInReview = calculateDaysInReview();
  const userHasHighHours = hasHighHours(project);
  
  const [projectFlags, setProjectFlags] = useState({
    shipped: !!project.shipped,
    viral: !!project.viral,
    in_review: !!project.in_review,
    approved: !!project.approved,
  });
  
  // Handle project flag updates
  const handleFlagsUpdated = (updatedProject: any) => {
    setProjectFlags({
      shipped: !!updatedProject.shipped,
      viral: !!updatedProject.viral,
      in_review: !!updatedProject.in_review,
      approved: !!updatedProject.approved,
    });
    
    // If in_review was changed to false, notify the parent component to refresh the list
    if (project.in_review && !updatedProject.in_review) {
      onReviewSubmitted();
    }
  };

  // Generate Fraud Analysis URL with date range in EST timezone
  const getFraudAnalysisUrl = (): string | null => {
    // Only show fraud analysis link to admins and reviewers
    const isAdmin = session?.user?.role === 'Admin' || session?.user?.isAdmin === true;
    const isReviewer = session?.user?.role === 'Reviewer';
    
    if (!isAdmin && !isReviewer) {
      return null;
    }
    
    if (!project.userHackatimeId) return null;
    
    // Get start date from config
    const startDate = AppConfig.hackatimeStartDate;
    
    // Get today's date in EST timezone
    const now = new Date();
    // Convert to EST using Intl.DateTimeFormat
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const endDate = `${year}-${month}-${day}`;
    
    return `https://billy.3kh0.net/?u=${project.userHackatimeId}&d=${startDate}-${endDate}`;
  };

  // Copy to clipboard functions
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  
  const handleCopy = async (text: string, itemType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemType);
      setTimeout(() => setCopiedItem(null), 2000);
      toast.success(`Copied ${itemType}!`);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <div className="bg-black/60 text-white border border-white/10 rounded-lg overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h2 className="text-xl font-bold">{project.name}</h2>
        <button 
          onClick={onClose}
          className="text-white hover:opacity-80"
        >
          <span className="sr-only">Close</span>
          <Icon glyph="view-close" size={24} />
        </button>
      </div>
      
      <div className="p-4 space-y-4">
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">Description</h3>
          <p className="text-base text-white">{project.description || "No description provided."}</p>
        </div>
        
        {/* Project Screenshot - shown prominently after description */}
        {project.screenshot && (
          <div className="bg-black/60 p-4 rounded-lg border border-white/10">
            <h3 className="text-sm font-medium text-white mb-3">Screenshot</h3>
            <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-lg border border-white/20 overflow-hidden">
              <ImageWithFallback
                src={project.screenshot}
                alt={`Screenshot of ${project.name}`}
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
        
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">Created By</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {project.userImage ? (
                <img 
                  src={project.userImage} 
                  alt={project.userName || ''} 
                  className="w-8 h-8 rounded-full mr-2"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 mr-2 flex items-center justify-center">
                  <span className="text-sm text-white/80">
                    {project.userName?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm text-white">{project.userName}</span>
                {project.userHackatimeId && (
                  <div className="mt-1">
                    <TrustStats 
                      hackatimeId={project.userHackatimeId} 
                      userName={project.userName || 'User'} 
                      size="md" 
                      showStats={true} 
                    />
                  </div>
                )}
              </div>
            </div>
            <UserCategoryBadge 
              userId={project.userId} 
              hackatimeId={project.userHackatimeId || undefined} 
              size="small" 
              showMetrics={true} 
            />
          </div>
        </div>
        
        {/* Project Tags Section */}
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <TagManagement
            entityType="project"
            entityId={project.projectID}
            entityName={project.name}
            currentTags={project.projectTags || []}
            onTagsUpdated={() => onReviewSubmitted()}
            compact={true}
          />
        </div>
        
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <div className="text-center text-sm">
            <ProjectStatus 
              viral={projectFlags.viral} 
              shipped={projectFlags.shipped} 
              in_review={projectFlags.in_review}
            />
            {daysInReview !== null && (
              <div className="mt-3 flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  daysInReview <= 1 ? 'bg-green-600/20 text-green-300' :
                  daysInReview <= 3 ? 'bg-yellow-600/20 text-yellow-300' :
                  daysInReview <= 7 ? 'bg-orange-600/20 text-orange-300' :
                  'bg-red-600/20 text-red-300'
                }`}>
                  🕒 {daysInReview === 0 ? 'Submitted today' : 
                      daysInReview === 1 ? 'In review for 1 day' : 
                      `In review for ${daysInReview} days`}
                </span>
              </div>
            )}
            {userHasHighHours && (
              <div className="mt-3 flex justify-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-600/20 text-yellow-300">
                  ⭐ Last project for this user
                </span>
              </div>
            )}
            {project.reviewCount >= 5 && (
              <div className="mt-3 flex justify-center items-center gap-2">
                <img 
                  src="/thisisfine.gif" 
                  alt="This is fine - many reviews" 
                  className="w-10 h-10"
                />
                <span className="text-sm text-orange-400 font-medium">
                  {project.reviewCount} reviews on the review thread. Be cautious!
                </span>
              </div>
            )}
          </div>
        </div>
        
        {(project.codeUrl || project.playableUrl || project.userHackatimeId) && (
          <div className="bg-black/60 p-4 rounded-lg border border-white/10">
            <h3 className="text-sm font-medium text-white mb-3">Links</h3>
            <div className="flex flex-col gap-2">
              {project.codeUrl && (
                <a 
                  href={project.codeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-2"
                >
                  <Icon glyph="github" size={16} />
                  View Code Repository
                </a>
              )}
              {project.playableUrl && (
                <a 
                  href={project.playableUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-2"
                >
                  <Icon glyph="link" size={16} />
                  Try It Out
                </a>
              )}
              {project.userHackatimeId && (
                <button
                  onClick={() => {
                    const today = new Date().toISOString().split('T')[0];
                    const hackatimeUrl = `https://hackatime.hackclub.com/admin/timeline?date=${today}&user_ids=${project.userHackatimeId}`;
                    window.open(hackatimeUrl, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-purple-300 hover:underline flex items-center gap-2 text-left"
                >
                  <Icon glyph="analytics" size={16} />
                  View Hackatime Timeline
                </button>
              )}
              {project.userHackatimeId && (
                <button
                  onClick={() => {
                    const impersonateButton = `https://hackatime.hackclub.com/impersonate/${project.userHackatimeId}`;
                    window.open(impersonateButton, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-purple-300 hover:underline flex items-center gap-2 text-left"
                >
                  <Icon glyph="view" size={16} />
                  Impersonate User
                </button>
              )}
              {getFraudAnalysisUrl() && (
                <a 
                  href={getFraudAnalysisUrl()!} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red-400 hover:underline flex items-center gap-2"
                >
                  <Icon glyph="analytics" size={16} />
                  Fraud (Billy)
                </a>
              )}
              {/* Fraud (Joe) button - copies identifier to clipboard then navigates */}
              {(() => {
                const identifierToCopy = project.userHackatimeId || project.userSlack || project.user?.name || null;
                if (!identifierToCopy) return null;
                
                return (
                  <button
                    onClick={async () => {
                      try {
                        const joeURL = `https://dash.fraud.land/profile/${identifierToCopy}`;
                        await navigator.clipboard.writeText(identifierToCopy);
                        toast.success('Copied to clipboard!');
                        // Small delay to ensure clipboard write completes before navigation
                        setTimeout(() => {
                          window.open(joeURL, '_blank', 'noopener,noreferrer');
                        }, 100);
                      } catch (err) {
                        console.error('Failed to copy:', err);
                        toast.error('Failed to copy to clipboard');
                        // Still navigate even if copy fails
                        window.open(joeURL, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    className="text-red-400 hover:underline flex items-center gap-2 text-left"
                  >
                    <Icon glyph="analytics" size={16} />
                    Fraud (Joe)
                  </button>
                );
              })()}
              {project.userHackatimeId && (
                <button
                  onClick={() => handleCopy(project.userHackatimeId!, 'hackatime')}
                  className="text-green-400 hover:underline flex items-center gap-2 text-left"
                  title="Copy Hackatime ID"
                >
                  <Icon glyph="copy" size={16} />
                  {copiedItem === 'hackatime' ? 'Copied!' : 'Copy HackatimeId'}
                </button>
              )}
              {project.userEmail && (
                <button
                  onClick={() => handleCopy(project.userEmail!, 'email')}
                  className="text-blue-400 hover:underline flex items-center gap-2 text-left"
                  title="Copy Email"
                >
                  <Icon glyph="copy" size={16} />
                  {copiedItem === 'email' ? 'Copied!' : 'Copy Email'}
                </button>
              )}
              {project.userSlack && (
                <button
                  onClick={() => handleCopy(project.userSlack!, 'slack')}
                  className="text-purple-400 hover:underline flex items-center gap-2 text-left"
                  title="Copy Slack ID"
                >
                  <Icon glyph="copy" size={16} />
                  {copiedItem === 'slack' ? 'Copied!' : 'Copy Slack ID'}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Project Hours Section */}
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <h3 className="text-sm font-medium text-white mb-3">Project Hours</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-white/80">
                  Raw Hours: <span className="font-semibold">{project.rawHours}h</span>
                </div>
                {project.hoursOverride !== undefined && project.hoursOverride !== null && (
                  <div className="text-sm text-white/80">
                    Override: <span className="font-semibold text-blue-400">{project.hoursOverride}h</span>
                  </div>
                )}
                {project.hackatimeLinks && project.hackatimeLinks.length > 0 && (
                  <div className="text-xs text-white/70 mt-1">
                    Total from {project.hackatimeLinks.length} Hackatime link(s)
                  </div>
                )}
              </div>
              <ProjectClassificationBadge
                hours={project.hoursOverride ?? project.rawHours}
                showPercentile={true}
                size="md"
              />
            </div>
          </div>
        </div>
        
        {/* Project Reviews Section */}
        <div className="bg-black/60 p-4 rounded-lg border border-white/10">
          <ReviewSection 
            projectID={project.projectID} 
            projectOwnerUserId={project.userId}
            initialFlags={projectFlags}
            journalRawHours={(project as any).journalRawHours || 0}
            journalApprovedHours={(project as any).journalApprovedHours || 0}
            onFlagsUpdated={handleFlagsUpdated}
            rawHours={project.rawHours}
            reviewType={project.latestReview?.reviewType || 'Other'}
            hackatimeLinks={project.hackatimeLinks}
            codeUrl={project.codeUrl}
            playableUrl={project.playableUrl}
            userHackatimeId={project.userHackatimeId}
            userEmail={project.userEmail}
            userSlack={project.userSlack}
          />
        </div>

        {/* AI Analysis Section */}
        <AIAnalysisSection project={project} />
      </div>
    </div>
  );
}

function ReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { enableReviewMode } = useReviewMode();
  const components = useMDXComponents({});
  
  // Add filter state
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  // Persisted dashboard collapse
  const [dashCollapsed, setDashCollapsed] = useState(false);
  useEffect(() => {
    try {
      const cookie = document.cookie.split('; ').find((r) => r.startsWith('reviewDashCollapsed='));
      if (cookie) {
        const v = cookie.split('=')[1];
        setDashCollapsed(v === '1' || v === 'true');
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      document.cookie = `reviewDashCollapsed=${dashCollapsed ? '1' : '0'}; max-age=31536000; path=/`;
    } catch {}
  }, [dashCollapsed]);
  // Auto-enable review mode when the component mounts
  useEffect(() => {
    enableReviewMode();
  }, [enableReviewMode]);

  // Fetch projects that are in review
  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchProjectsInReview();
    }
  }, [status, session?.user?.id]);

  // Fetch available tags
  useEffect(() => {
    async function fetchTags() {
      try {
        setIsLoadingTags(true);
        const response = await apiFetch('/api/admin/tags');
        if (response.ok) {
          const tags = await response.json();
          setAvailableTags(tags);
        } else {
          console.error('Failed to fetch tags:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching tags:', error);
      } finally {
        setIsLoadingTags(false);
      }
    }
    if (status === 'authenticated' && session?.user?.id) {
      fetchTags();
    }
  }, [status, session?.user?.id]);
  
  // Apply filter when projects or filter changes
  useEffect(() => {
    let filtered = projects;

    // Apply text search filter
    if (searchTerm) {
      filtered = filtered.filter(project => 
        ((project.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(project => 
        selectedTags.every(selectedTagId => 
          project.projectTags?.some(projectTag => projectTag.tag.id === selectedTagId)
        )
      );
    }

    // Apply review type filter
    if (activeFilter === "FraudSuspect") {
      filtered = filtered.filter(project => 
        project.user.status === UserStatus.FraudSuspect
      );
    } else if (activeFilter) {
      filtered = filtered.filter(project => 
        (project.latestReview?.reviewType || 'Other') === activeFilter &&
        project.user.status !== UserStatus.FraudSuspect
      );
    } else {
      filtered = filtered.filter(project => 
        project.user.status !== UserStatus.FraudSuspect
      );
    }

    setFilteredProjects(filtered);
  }, [projects, activeFilter, searchTerm, selectedTags]);

  // Close modal when escape key is pressed
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
       if (event.key === 'Escape') {
        setSelectedProject(null);
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);
  
  // Function to fetch projects in review - moved outside useEffect for reusability
  const fetchProjectsInReview = async () => {
    try {
      setIsLoading(true);
      console.log('[REVIEW DEBUG] fetching /api/review …');
      const response = await apiFetch('/api/review');
      console.log('[REVIEW DEBUG] /api/review status:', response.status);
      
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn('[REVIEW DEBUG] /api/review not ok:', response.status, text);
        throw new Error('Failed to fetch projects in review');
      }
      
      const data = await response.json();
      console.log('[REVIEW DEBUG] received projects:', Array.isArray(data) ? data.length : typeof data);
      setProjects(data);
      setFilteredProjects(data); // Initialize filtered projects with all projects
    } catch (err) {
      console.error('[REVIEW DEBUG] Error fetching projects in review:', err);
      setError('Failed to load projects that need review. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle review submissions and refresh the project list
  const handleReviewSubmitted = () => {
    // Close the modal
    setSelectedProject(null);
    
    // Refresh the projects list
    fetchProjectsInReview();
    
    // Show toast
    toast.success("Review completed. Project removed from review list.");
  };

  // Render loading state
  if (status === "loading") {
    return <LoadingOverlay />;
  }
  
  // Authentication and access control is now handled by the layout
  return (
    <div className="min-h-screen starspace-bg">
      <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Project Review Dashboard</h1>
            <p className="text-white/80">Review and provide feedback on submitted projects</p>
          </div>
        </div>

        {/* Analytics Charts with collapse */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Review Analytics</h2>
          <button
            onClick={() => setDashCollapsed((v) => !v)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${dashCollapsed ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-orange-600/20 border-orange-500/40 text-orange-300 hover:bg-orange-600/30'}`}
          >
            {dashCollapsed ? 'Show dashboards' : 'Hide dashboards'}
          </button>
        </div>
        {!dashCollapsed && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <div className="bg-black/60 p-4 rounded-lg border border-white/10 text-white">
              <ProjectHistogramChart />
            </div>
            <div className="bg-black/60 p-4 rounded-lg border border-white/10 text-white">
              <UserClusterChart />
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <Icon glyph="important" size={24} className="text-red-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Filter buttons */}
        {!isLoading && projects.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveFilter(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === null
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('ShippedApproval')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === 'ShippedApproval'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Shipped Approval
              </button>
              <button
                onClick={() => setActiveFilter('ViralApproval')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === 'ViralApproval'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                Viral Approval
              </button>
              <button
                onClick={() => setActiveFilter('HoursApproval')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === 'HoursApproval'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Ship Updates
              </button>
              <button
                onClick={() => setActiveFilter('Other')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === 'Other'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Other Requests
              </button>
              <button
                onClick={() => setActiveFilter('FraudSuspect')}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === 'FraudSuspect'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Banned Users
              </button>
            </div>
          </div>
        )}

        {/* Tag Filter */}
        {!isLoading && projects.length > 0 && availableTags.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-white mr-2">Filter by tags:</span>
              {availableTags.map((tag) => {
                const tagProjectCount = projects.filter(project =>
                  project.projectTags?.some(projectTag => projectTag.tag.id === tag.id)
                ).length;

                if (tagProjectCount === 0) return null;

                const isSelected = selectedTags.includes(tag.id);
                
                // Helper function to determine if a color is light/white
                const isLightColor = (color: string) => {
                  if (!color) return false;
                  // Handle hex colors
                  if (color.startsWith('#')) {
                    const hex = color.slice(1);
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);
                    // Calculate brightness using standard formula
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    return brightness > 200; // Threshold for "light" colors
                  }
                  // Handle named colors - assume white/light colors are problematic
                  return ['white', 'lightgray', 'lightgrey', 'silver', 'whitesmoke'].includes(color.toLowerCase());
                };

                const hasValidColor = tag.color && !isLightColor(tag.color);

                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTags(selectedTags.filter(id => id !== tag.id));
                      } else {
                        setSelectedTags([...selectedTags, tag.id]);
                      }
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                      isSelected
                        ? hasValidColor
                          ? `text-white border-2 border-gray-300`
                          : 'bg-blue-600 text-white'
                        : hasValidColor
                          ? `text-gray-800 border border-gray-300 hover:bg-gray-100`
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    style={isSelected && hasValidColor ? { backgroundColor: tag.color } : 
                           !isSelected && hasValidColor ? { backgroundColor: `${tag.color}20` } : {}}
                  >
                    {tag.name} ({tagProjectCount})
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="px-3 py-1.5 text-sm font-medium rounded-full transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ml-2"
                >
                  Clear Tags
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative mb-6">
            <input
              type="text"
              placeholder="Search project reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-3 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-black/60 text-white placeholder-white/70 border border-white/10"
            />
            <span className="absolute right-3 top-3 text-white/60">
              🔍
            </span>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="ml-2">Loading projects...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.length === 0 ? (
              <div className="col-span-full bg-black/60 text-white border border-white/10 p-6 rounded-lg shadow text-center">
                <Icon glyph="checkmark" size={48} className="mx-auto text-green-500 mb-2" />
                <h2 className="text-xl font-semibold text-white mb-1">
                  {projects.length === 0 ? "All caught up!" : "No matching projects"}
                </h2>
                <p className="text-white/80">
                  {projects.length === 0 
                    ? "There are no projects waiting for review at the moment." 
                    : "Try a different filter to see more projects."}
                </p>
              </div>
            ) : (
              filteredProjects.map((project) => (
                <ProjectCard 
                  key={project.projectID} 
                  project={project} 
                  onClick={() => router.push(`/review/${project.projectID}`)}
                />
              ))
            )}
          </div>
        )}
        
        {/* Project Detail Modal */}
        {selectedProject && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-20 md:pt-24 z-[9999] w-[100vw]">
            <div className="max-w-8xl h-full overflow-auto md:m-5">
              <div className="flex flex-col md:flex-row gap-4 h-full">
                {/* Guidelines panel from MDX file */}
                <div className="bg-black/60 text-white border border-white/10 shadow-lg rounded-lg overflow-hidden w-full md:w-1/2 h-1/3 md:h-full flex flex-col">
                  <div className="p-4 bg-transparent border-b border-white/10 flex-shrink-0">
                    <h2 className="text-xl font-bold text-orange-400">Review Guidelines</h2>
                  </div>
                  <div className="p-4 flex-grow overflow-hidden">
                    <div className="prose prose-invert prose-sm max-w-none overflow-y-auto h-full">
                      <Suspense fallback={<div>Loading guidelines...</div>}>
                        {selectedProject.latestReview?.reviewType == 'ShippedApproval' && <MDXShippedApproval components={components} />}
                        {selectedProject.latestReview?.reviewType == 'HoursApproval' && <MDXShipUpdateApproval components={components} />}
                        {(selectedProject.latestReview?.reviewType || 'Other') == 'Other' && <MDXOther components={components} />}
                      </Suspense>
                    </div>
                  </div>
                </div>
                
                {/* Project detail panel */}
                <div className="w-full md:w-1/2 h-2/3 md:h-full overflow-auto rounded-lg">
                  <ProjectDetail 
                    project={selectedProject} 
                    onClose={() => setSelectedProject(null)}
                    onReviewSubmitted={handleReviewSubmitted}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Toaster richColors />
    </div>
  );
}

export default function ReviewPageWithProvider() {
  return (
    <ReviewModeProvider>
      <ReviewPage />
    </ReviewModeProvider>
  );
}
