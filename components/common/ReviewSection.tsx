'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import Icon from '@hackclub/icons';
import { useReviewMode } from '@/app/contexts/ReviewModeContext';
import ProjectFlagsEditor, { ProjectFlags } from './ProjectFlagsEditor';
import HackatimeLanguageStats from './HackatimeLanguageStats';
import ReviewChecklist from './ReviewChecklist';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { AppConfig } from '@/lib/config';

// Custom sanitization schema that allows video tags while blocking scripts
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'video'],
  attributes: {
    ...defaultSchema.attributes,
    video: ['class', 'controls', 'playsinline', 'src', 'style', 'width', 'height'],
  },
};

interface ReviewerInfo {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface ReviewType {
  id: string;
  comment: string;
  createdAt: string;
  projectID: string;
  reviewerId: string;
  reviewer: ReviewerInfo;
  result?: 'approve' | 'reject';
}

interface ReviewSectionProps {
  projectID: string;
  projectOwnerUserId?: string; // ID of the project owner for fetching language stats
  initialFlags?: ProjectFlags;
  onFlagsUpdated?: (updatedProject: unknown) => void;
  onReviewSubmitted?: () => void; // Callback after successful review submission
  rawHours?: number;
  reviewType?: string;
  hackatimeLinks?: Array<{
    id: string;
    hackatimeName: string;
    rawHours: number;
    hoursOverride?: number | null;
  }>;
  journalRawHours?: number;
  journalApprovedHours?: number;
  codeUrl?: string;
  playableUrl?: string;
  userHackatimeId?: string | null;
  userEmail?: string | null;
  userSlack?: string | null;
}

export default function ReviewSection({ 
  projectID, 
  projectOwnerUserId,
  initialFlags,
  onFlagsUpdated,
  onReviewSubmitted,
  reviewType,
  hackatimeLinks = [],
  journalRawHours = 0,
  journalApprovedHours = 0,
  codeUrl,
  playableUrl,
  userHackatimeId,
  userEmail,
  userSlack,
}: ReviewSectionProps) {
  const { data: session, status } = useSession();
  const { isReviewMode } = useReviewMode();
  const [reviews, setReviews] = useState<ReviewType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [reviewResult, setReviewResult] = useState<'approve' | 'reject' | 'comment' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [isDeletingReview, setIsDeletingReview] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  // Add state for checklist completion and justification
  const [isChecklistComplete, setIsChecklistComplete] = useState(false);
  const [checklistJustification, setChecklistJustification] = useState('');
  
  // State to track flag changes
  const [flagsChanged, setFlagsChanged] = useState(false);
  const [currentFlags, setCurrentFlags] = useState<ProjectFlags>({
    shipped: initialFlags?.shipped || false,
    viral: initialFlags?.viral || false,
    in_review: initialFlags?.in_review || false,
    hackatimeLinkOverrides: {}
  });
  const [originalFlags, setOriginalFlags] = useState<ProjectFlags>({
    shipped: initialFlags?.shipped || false,
    viral: initialFlags?.viral || false,
    in_review: initialFlags?.in_review || false,
    hackatimeLinkOverrides: {}
  });

  // Initialize flags just once when component mounts
  useEffect(() => {
    console.log('[DEBUG] ReviewSection initializing flags on mount');
    
    if (!initialFlags) return;
    
    // Create a new object for hackatimeLinkOverrides from hackatimeLinks
    const linkOverrides: Record<string, number | undefined> = {};
    
    // Fill it with existing values from hackatimeLinks
    if (hackatimeLinks && hackatimeLinks.length > 0) {
      hackatimeLinks.forEach(link => {
        linkOverrides[link.id] = link.hoursOverride === null ? undefined : link.hoursOverride;
      });
    }
    
    // Set initial flags once
    const baseFlags = {
      shipped: initialFlags.shipped,
      viral: initialFlags.viral,
      in_review: initialFlags.in_review,
    };
    
    // Set both state values with the same initial values
    setOriginalFlags({
      ...baseFlags,
      hackatimeLinkOverrides: {...linkOverrides}
    });
    
    setCurrentFlags({
      ...baseFlags,
      hackatimeLinkOverrides: {...linkOverrides}
    });
    
    // No changes initially
    setFlagsChanged(false);
  }, []); // Only run once on mount

  // Fetch reviews for the project
  const fetchReviews = async () => {
    if (!projectID) return;
    if (status !== 'authenticated' || !session?.user?.id) return;
    
    try {
      setIsFetchingReviews(true);
    const response = await apiFetch(`/api/reviews?projectId=${projectID}`);
      if (!response.ok) {
        throw new Error('Failed to fetch reviews');
      }
      
      const data = await response.json();
      setReviews(data);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsFetchingReviews(false);
    }
  };

  // Load reviews when component mounts or projectID changes
  useEffect(() => {
    fetchReviews();
  }, [projectID, status, session?.user?.id]);
  
  // Handle flag changes from ProjectFlagsEditor
  const handleFlagsChange = (flags: ProjectFlags) => {
    // Simply update the current flags state
    setCurrentFlags({
      shipped: flags.shipped,
      viral: flags.viral,
      in_review: flags.in_review,
      hackatimeLinkOverrides: flags.hackatimeLinkOverrides ? {...flags.hackatimeLinkOverrides} : {}
    });
    
    // Check if any flags have changed
    const hasShippedChanged = flags.shipped !== originalFlags.shipped;
    const hasViralChanged = flags.viral !== originalFlags.viral;
    const hasInReviewChanged = flags.in_review !== originalFlags.in_review;
    
    // Check if any hours have changed
    const origOverrides = originalFlags.hackatimeLinkOverrides || {};
    const newOverrides = flags.hackatimeLinkOverrides || {};
    
    let hasHourChanges = false;
    const allKeys = new Set([...Object.keys(origOverrides), ...Object.keys(newOverrides)]);
    
    for (const key of allKeys) {
      if (origOverrides[key] !== newOverrides[key]) {
        hasHourChanges = true;
        break;
      }
    }
    
    const hasAnyChanges = hasShippedChanged || hasViralChanged || hasInReviewChanged || hasHourChanges;
    
    // Update flagsChanged based on any changes
    setFlagsChanged(hasAnyChanges);
    
    // Call onFlagsUpdated if there are changes and a callback exists
    if (hasAnyChanges && onFlagsUpdated) {
      onFlagsUpdated(flags);
    }
  };
  
  // Generate a description of flag changes for the review comment
  const getFlagChangesDescription = (): string => {
    const changes: string[] = [];
    
    console.log('[DEBUG] getFlagChangesDescription comparing flags:', {
      original: originalFlags,
      current: currentFlags
    });
    
    // Always check flag changes regardless of the flagsChanged state
    if (currentFlags.shipped !== originalFlags.shipped) {
      changes.push(`Shipped: ${originalFlags.shipped ? 'Yes' : 'No'} → ${currentFlags.shipped ? 'Yes' : 'No'}`);
    }
    
    if (currentFlags.viral !== originalFlags.viral) {
      console.log('[DEBUG] Viral flag change detected:', {
        original: originalFlags.viral,
        current: currentFlags.viral
      });
      changes.push(`Viral: ${originalFlags.viral ? 'Yes' : 'No'} → ${currentFlags.viral ? 'Yes' : 'No'}`);
    }
    
    // Check for changes in Hackatime link overrides
    const originalOverrides = originalFlags.hackatimeLinkOverrides || {};
    const currentOverrides = currentFlags.hackatimeLinkOverrides || {};
    
    const linkChanges: string[] = [];
    
    // Force check all hackatime links for any differences
    hackatimeLinks.forEach(link => {
      // Handle null, undefined, or absent values consistently
      const getNumberValue = (obj: Record<string, unknown>, key: string): number | undefined => {
        const value = obj[key];
        // Treat null and undefined the same way - as undefined (no override)
        if (value === null || value === undefined) return undefined;
        // Ensure we're working with numbers
        return typeof value === 'number' ? value : undefined;
      };
      
      const originalValue = getNumberValue(originalOverrides, link.id);
      const currentValue = getNumberValue(currentOverrides, link.id);
      
      console.log(`[DEBUG] Comparing hours for ${link.hackatimeName}:`, {
        original: originalValue,
        current: currentValue,
        equal: originalValue === currentValue
      });
      
      // IMPORTANT: Force comparison of numerical values carefully
      const isValueDifferent = (() => {
        // If both are undefined/null, they're equal
        if (originalValue === undefined && currentValue === undefined) return false;
        // If one is undefined/null but the other isn't, they're different
        if (originalValue === undefined || currentValue === undefined) return true;
        // Compare the actual numerical values with small epsilon for floating point precision
        return Math.abs(originalValue - currentValue) > 0.001;
      })();
      
      if (isValueDifferent) {
        // Format the hours values with proper units for display
        const originalDisplay = originalValue !== undefined ? `${originalValue}h` : 'none';
        const currentDisplay = currentValue !== undefined ? `${currentValue}h` : 'none';
        
        console.log(`[DEBUG] Found override change: ${link.hackatimeName}: ${originalDisplay} → ${currentDisplay}`);
        linkChanges.push(`${link.hackatimeName}: ${originalDisplay} → ${currentDisplay}`);
      }
    });
    
    if (linkChanges.length > 0) {
      console.log(`[DEBUG] Found ${linkChanges.length} link changes:`, linkChanges);
      if (linkChanges.length === 1) {
        changes.push(`Hours Approved: ${linkChanges[0]}`);
      } else {
        // For multiple link changes, use a more structured format
        changes.push(`Hours Approved:\n` + 
          linkChanges.map(change => `  • ${change}`).join('\n')
        );
      }
    }
    
    if (currentFlags.in_review !== originalFlags.in_review) {
      changes.push(`In Review: ${originalFlags.in_review ? 'Yes' : 'No'} → ${currentFlags.in_review ? 'Yes' : 'No'}`);
    }
    
    // Add "Review completed" indicator if the project was in review
    const reviewCompleted = originalFlags.in_review && !currentFlags.in_review;
    
    console.log(`[DEBUG] Changes:`, {
      changesCount: changes.length,
      reviewCompleted,
      changes
    });
    
    if (changes.length === 0 && !reviewCompleted) return '';
    
    if (reviewCompleted) {
      return '\n\n[✓ Review completed' + (changes.length > 0 ? '. Status changes: ' + changes.join(', ') : '') + ']';
    } else {
      return '\n\n[Status changes: ' + changes.join(', ') + ']';
    }
  };

  // Submit a new review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that a result is selected
    if (!reviewResult) {
      toast.error('Please select a review result');
      return;
    }
    
    // If approving and checklist hasn't been completed, show it
    if (reviewResult === 'approve' && !isChecklistComplete) {
      setShowChecklist(true);
      return;
    }
    
    // Validate that rejections have a comment
    if ((reviewResult === 'reject' || reviewResult === 'comment') && !newComment.trim()) {
      toast.error('Please provide a comment');
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('[Review] Begin submit', {
        projectID,
        reviewResult,
        isChecklistComplete,
        currentFlags,
        originalFlags,
      });
      
      // Store whether the project was in review before changes
      const wasInReview = originalFlags.in_review;
      
      // Set in_review to false when submitting a review if approved or rejected
      const updatedFlags = {
        ...currentFlags,
        in_review: reviewResult === 'comment',
      };
      console.log('[Review] Computed updatedFlags', updatedFlags);
      
      // Check if flags are different after setting in_review to false
      const hasChanges =
        updatedFlags.shipped !== originalFlags.shipped ||
        updatedFlags.viral !== originalFlags.viral ||
        updatedFlags.in_review !== originalFlags.in_review;
      
      // Deep compare hackatimeLinkOverrides
      const updatedOverrides = updatedFlags.hackatimeLinkOverrides || {};
      const originalOverrides = originalFlags.hackatimeLinkOverrides || {};
      const allKeys = new Set([
        ...Object.keys(updatedOverrides),
        ...Object.keys(originalOverrides)
      ]);
      
      const hasOverrideChanges = Array.from(allKeys).some(key => {
        const original = originalOverrides[key] === null ? undefined : originalOverrides[key];
        const updated = updatedOverrides[key] === null ? undefined : updatedOverrides[key];
        return original !== updated;
      });
      
      const hasAnyChanges = hasChanges || hasOverrideChanges;
      
      // Update current flags and mark as changed
      setCurrentFlags(updatedFlags);
      setFlagsChanged(hasAnyChanges || wasInReview);
      
      // Update flags if they've changed or if review is completed
      if (hasAnyChanges || wasInReview) {
        // Make sure we're explicitly including the hackatimeLinkOverrides
        // even if they're empty or unchanged, to ensure they're processed by the API
        const requestBody = {
          projectID,
          shipped: updatedFlags.shipped,
          viral: updatedFlags.viral,
          in_review: updatedFlags.in_review,
          hackatimeLinkOverrides: updatedFlags.hackatimeLinkOverrides || {}
        };
        
        console.log('[Review] Sending flags PATCH payload -> /api/projects/flags', requestBody);
        
        const flagsResponse = await apiFetch('/api/projects/flags', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        console.log('[Review] Flags PATCH response', flagsResponse.status, flagsResponse.statusText);
        if (!flagsResponse.ok) {
          const errText = await flagsResponse.text().catch(() => '');
          console.error('[Review] Flags PATCH failed', { status: flagsResponse.status, text: errText });
          throw new Error('Failed to update project flags');
        }
        
        const updatedProject = await flagsResponse.json();
        console.log('[Review] Flags PATCH succeeded, updatedProject:', updatedProject?.projectID);
        
        // Notify parent component of the flag updates
        if (onFlagsUpdated) {
          onFlagsUpdated(updatedProject);
        }
        
        // Update original flags to match current flags
        setOriginalFlags(updatedFlags);
        setFlagsChanged(false);
      }
      
      // Use only ONE source of text:
      // - Approve: use justification only
      // - Reject/Comment: use comment only
      let finalComment = '';
      if (reviewResult === 'approve') {
        finalComment = checklistJustification ? `Justification for approved hours: ${checklistJustification}` : '';
      } else {
        finalComment = newComment.trim();
      }
      
      // Then submit the review with result and flag changes noted in the comment
      const resultPrefix = reviewResult === 'approve' ? '✅ Approved' : (reviewResult === 'reject' ? '❌ Rejected' : '💬 Commented');
      const commentContent = finalComment ? `\n${finalComment}` : '';
      const flagChanges = getFlagChangesDescription();
      const reviewCompleted = !flagChanges && wasInReview ? '\n\n[✓ Review completed]' : '';
      
      const finalReviewComment = `${resultPrefix}${commentContent}${flagChanges}${reviewCompleted}`;
      
      const reviewResponse = await apiFetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectID,
          comment: finalReviewComment,
          result: reviewResult, // Include for email notifications
          reviewType: reviewResult === 'comment' ? reviewType : null,
          justification: reviewResult === 'approve' ? checklistJustification : undefined,
        }),
      });
      
      console.log('[Review] /api/reviews POST response', reviewResponse.status, reviewResponse.statusText);
      if (!reviewResponse.ok) {
        const errText = await reviewResponse.text().catch(() => '');
        console.error('[Review] Review POST failed', { status: reviewResponse.status, text: errText });
        throw new Error('Failed to submit review');
      }
      
      const newReview = await reviewResponse.json();
      console.log('[Review] Review POST succeeded id=', newReview?.id);

      console.log(reviews)
      
      // Add the new review to the top of the list
      setReviews([newReview, ...reviews]);
      setNewComment('');
      setReviewResult(null); // Reset result
      setChecklistJustification(''); // Clear checklist justification
      setShowChecklist(false); // Hide checklist
      toast.success('Review submitted successfully');
      
      // Call the onReviewSubmitted callback if provided
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (error) {
      console.error('[Review] Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setIsLoading(false);
      console.log('[Review] Submit finished');
    }
  };

  // Update checklist state handler
  const handleChecklistStateChange = (complete: boolean, justification: string) => {
    setIsChecklistComplete(complete);
    setChecklistJustification(justification);
  };

  const handleReviewResultChange = (result: 'approve' | 'reject' | 'comment' | null) => {
    setReviewResult(result);
    // Clear checklist justification if switching away from approval
    if (result !== 'approve') {
      setChecklistJustification('');
      setIsChecklistComplete(false); // Hide checklist if switching away
    } else if (!isChecklistComplete) {
      setShowChecklist(true); // Show checklist immediately when Approve is clicked and not yet completed
    }
  };

  // Delete a review
  const handleDeleteReview = async (reviewId: string) => {
    try {
      setIsDeletingReview(reviewId);
      const response = await apiFetch(`/api/reviews?id=${reviewId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete review');
      }
      
      // Remove the deleted review from the list
      setReviews(reviews.filter(review => review.id !== reviewId));
      toast.success('Review deleted successfully');
    } catch (error) {
      console.error('Error deleting review:', error);
      toast.error('Failed to delete review');
    } finally {
      setIsDeletingReview(null);
      setShowDeleteConfirm(null);
    }
  };
  
  // Check if the current user is the reviewer
  const isCurrentUserReviewer = (reviewerId: string) => {
    return session?.user?.id === reviewerId;
  };

  // Format date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Generate Fraud Analysis URL with date range in EST timezone
  const getFraudAnalysisUrl = (): string | null => {
    // Only show fraud analysis link to admins and reviewers
    const isAdmin = session?.user?.role === 'Admin' || session?.user?.isAdmin === true;
    const isReviewer = session?.user?.role === 'Reviewer';
    
    if (!isAdmin && !isReviewer) {
      return null;
    }
    
    if (!userHackatimeId) return null;
    
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
    
    return `https://billy.3kh0.net/?u=${userHackatimeId}&d=${startDate}-${endDate}`;
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
    <div className="space-y-6 bg-black/60 text-white p-4 sm:p-6 rounded-lg mb-12 w-full max-w-full border border-white/10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-2">
        <h3 className="text-lg font-semibold text-white">Project Reviews</h3>
        {/* Hackatime Language Stats Dropdown - only visible in review mode */}
        {isReviewMode && (
          <div className="w-full sm:w-80">
            <HackatimeLanguageStats 
              userId={projectOwnerUserId} 
              projectNames={hackatimeLinks?.map(link => link.hackatimeName) || []}
            />
          </div>
        )}
      </div>
      
      {/* Project Links - Show if available */}
      {(codeUrl || playableUrl || getFraudAnalysisUrl()) && (
        <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 p-3 rounded-lg border border-blue-400/20">
          <h4 className="text-sm font-medium text-white mb-2">Quick Links</h4>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1.5">
            {codeUrl && (
              <a 
                href={codeUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-blue-300 hover:text-blue-200 transition-colors text-xs"
              >
                <Icon glyph="github" size={14} />
                <span>Code Repository</span>
              </a>
            )}
            {playableUrl && (
              <a 
                href={playableUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-purple-300 hover:text-purple-200 transition-colors text-xs"
              >
                <Icon glyph="link" size={14} />
                <span>Live Demo</span>
              </a>
            )}
            {getFraudAnalysisUrl() && (
              <a 
                href={getFraudAnalysisUrl()!} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-red-300 hover:text-red-200 transition-colors text-xs"
              >
                <Icon glyph="analytics" size={14} />
                <span>Fraud (Billy)</span>
              </a>
            )}
            {/* Fraud (Joe) button - copies identifier to clipboard then navigates */}
            {(() => {
              const identifierToCopy = userHackatimeId || userSlack || null;
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
                  className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-red-300 hover:text-red-200 transition-colors text-xs"
                >
                  <Icon glyph="analytics" size={14} />
                  <span>Fraud (Joe)</span>
                </button>
              );
            })()}
            {userHackatimeId && (
              <button
                onClick={() => handleCopy(userHackatimeId, 'hackatime')}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-green-300 hover:text-green-200 transition-colors text-xs"
                title="Copy Hackatime ID"
              >
                <Icon glyph="copy" size={14} />
                <span>{copiedItem === 'hackatime' ? 'Copied!' : 'Copy HackatimeId'}</span>
              </button>
            )}
            {userEmail && (
              <button
                onClick={() => handleCopy(userEmail, 'email')}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-blue-300 hover:text-blue-200 transition-colors text-xs"
                title="Copy Email"
              >
                <Icon glyph="copy" size={14} />
                <span>{copiedItem === 'email' ? 'Copied!' : 'Copy Email'}</span>
              </button>
            )}
            {userSlack && (
              <button
                onClick={() => handleCopy(userSlack, 'slack')}
                className="flex items-center gap-1.5 px-2 py-1.5 bg-black/40 hover:bg-black/60 border border-white/20 rounded text-purple-300 hover:text-purple-200 transition-colors text-xs"
                title="Copy Slack ID"
              >
                <Icon glyph="copy" size={14} />
                <span>{copiedItem === 'slack' ? 'Copied!' : 'Copy Slack ID'}</span>
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Project Flags Editor */}
      {isReviewMode && initialFlags && (
        <div className="mb-6">
          <ProjectFlagsEditor
            projectID={projectID}
            initialShipped={currentFlags.shipped}
            initialViral={currentFlags.viral}
            initialInReview={currentFlags.in_review}
            hackatimeLinks={hackatimeLinks}
            journalRawHours={journalRawHours}
            journalApprovedHours={journalApprovedHours}
            onChange={handleFlagsChange}
          />
          
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
            <p>Add a review comment and click <strong>Submit Review</strong> below to save these changes.</p>
          </div>
        </div>
      )}
      
      {/* Add new review form - only visible in review mode */}
      {isReviewMode && (
        <form onSubmit={handleSubmitReview} className="mb-6">
          {/* Review Result Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-white mb-2">
              Review Result*
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleReviewResultChange('approve')}
                className={`flex-1 px-4 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 ${
                  reviewResult === 'approve'
                    ? 'bg-green-600/20 border-green-400 text-green-200'
                    : 'border-white/20 hover:bg-white/10'
                }`}
              >
                <Icon glyph="checkmark" size={16} className={reviewResult === 'approve' ? 'text-green-600' : 'text-gray-500'} />
                <span>Approve</span>
              </button>
              <button
                type="button"
                onClick={() => handleReviewResultChange('reject')}
                className={`flex-1 px-4 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 ${
                  reviewResult === 'reject'
                    ? 'bg-red-600/20 border-red-400 text-red-200'
                    : 'border-white/20 hover:bg-white/10'
                }`}
              >
                <Icon glyph="important" size={16} className={reviewResult === 'reject' ? 'text-red-600' : 'text-gray-500'} />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => handleReviewResultChange('comment')}
                className={`flex-1 px-4 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 ${
                  reviewResult === 'comment'
                    ? 'bg-white/10 border-white/30 text-white'
                    : 'border-white/20 hover:bg-white/10 text-white'
                }`}
              >
                <Icon glyph="message" size={16} className={reviewResult === 'reject' ? 'text-gray-600' : 'text-gray-500'} />
                <span>Comment</span>
              </button>
            </div>
            {reviewResult === 'reject' && (
              <p className="mt-1 text-xs text-red-300">A comment explaining the rejection reason is required.</p>
            )}
            {reviewResult === 'comment' && (
              <p className="mt-1 text-xs text-white/70">A comment is required.</p>
            )}
            {reviewResult === 'approve' && !isChecklistComplete && (
              <p className="mt-1 text-xs text-green-300">✓ You will need to complete a review checklist before approval</p>
            )}
            {reviewResult === 'approve' && isChecklistComplete && (
              <p className="mt-1 text-xs text-green-300">✓ Review checklist completed</p>
            )}

            {/* Checklist directly under review result (only for Approve) */}
            {reviewResult === 'approve' && showChecklist && (
              <div className="mt-4">
                <ReviewChecklist
                  isSubmitting={isLoading}
                  onChecklistStateChange={handleChecklistStateChange}
                />
              </div>
            )}
          </div>

          {reviewResult !== 'approve' && (
            <div className="mb-3">
              <label htmlFor="comment" className="block text-sm font-medium text-white mb-1">
                {reviewResult === 'reject' || reviewResult === 'comment' ? 'Comment (required)' : 'Comment (optional)'}
              </label>
              <textarea
                id="comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-black/40 text-white placeholder-white/70 ${
                  reviewResult === 'reject' && !newComment.trim()
                    ? 'border-red-400 focus:ring-red-500'
                    : 'border-white/20 focus:ring-orange-500'
                }`}
                placeholder={reviewResult === 'reject' 
                  ? "Please explain why this project is being rejected and what changes are needed"
                  : "Add your comment here..."}
                disabled={isLoading}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={
              isLoading ||
              !reviewResult ||
              ((reviewResult === 'reject' || reviewResult === 'comment') && !newComment.trim()) ||
              (reviewResult === 'approve' && !isChecklistComplete)
            }
            className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Submitting...' : (flagsChanged ? 'Submit Review with Flag Changes' : 'Submit Review')}
          </button>
          
          {/* Preview */}
          <div className="mt-2 text-xs text-orange-400">
            <p>Preview:</p>
            <pre className="mt-1 p-2 bg-black/40 border border-white/10 rounded text-xs whitespace-pre-wrap text-white">
              {reviewResult === 'approve' ? '✅ Approved' : (reviewResult === 'reject' ? '❌ Rejected' : (reviewResult === 'comment' ? '💬 Commented' : ''))}
              {(() => {
                const commentText = reviewResult === 'approve'
                  ? (checklistJustification ? `Justification for approved hours: ${checklistJustification}` : '')
                  : newComment.trim();
                return commentText ? '\n' + commentText : '';
              })()}
              
              {/* Direct simple comparison of flags */}
              {(() => {
                // Track changes
                const changes: string[] = [];
                
                // Check for basic flag changes
                if (currentFlags.shipped !== originalFlags.shipped) {
                  changes.push(`Shipped: ${originalFlags.shipped ? 'Yes' : 'No'} → ${currentFlags.shipped ? 'Yes' : 'No'}`);
                }
                
                if (currentFlags.viral !== originalFlags.viral) {
                  changes.push(`Viral: ${originalFlags.viral ? 'Yes' : 'No'} → ${currentFlags.viral ? 'Yes' : 'No'}`);
                }
                
                if (currentFlags.in_review !== originalFlags.in_review) {
                  changes.push(`In Review: ${originalFlags.in_review ? 'Yes' : 'No'} → ${currentFlags.in_review ? 'Yes' : 'No'}`);
                }
                
                // Check hour changes
                const origOverrides = originalFlags.hackatimeLinkOverrides || {};
                const currOverrides = currentFlags.hackatimeLinkOverrides || {};
                
                const hourChanges: string[] = [];
                
                // Simple comparison of each link's hours
                hackatimeLinks.forEach(link => {
                  const origValue = origOverrides[link.id];
                  const currValue = currOverrides[link.id];
                  
                  if (origValue !== currValue) {
                    hourChanges.push(`${link.hackatimeName}: ${origValue !== undefined ? origValue + 'h' : 'none'} → ${currValue !== undefined ? currValue + 'h' : 'none'}`);
                  }
                });
                
                // Add hour changes
                if (hourChanges.length === 1) {
                  changes.push(`Hours Approved: ${hourChanges[0]}`);
                } else if (hourChanges.length > 1) {
                  changes.push(`Hours Approved:\n` + hourChanges.map(c => `  • ${c}`).join('\n'));
                }
                
                // Return formatted changes or review completed message
                if (changes.length > 0) {
                  return `\n\n[Status changes: ${changes.join(', ')}]`;
                } else if (originalFlags.in_review) {
                  return '\n\n[✓ Review completed]';
                } else {
                  return '';
                }
              })()}
            </pre>
          </div>
        </form>
      )}
      
      {/* List of reviews */}
      <div className="space-y-4">
        {isFetchingReviews ? (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
            <p className="mt-2 text-white/70">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-white/70 text-center py-4">No reviews yet. {isReviewMode ? 'Be the first to review this project!' : ''}</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-black/60 text-white p-4 rounded-lg shadow-sm border border-white/10">
                <div className="flex items-start space-x-3">
                  {review.reviewer.image && (
                    <img
                      src={review.reviewer.image}
                      alt={review.reviewer.name || 'Reviewer'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center">
                        <h5 className="font-medium text-yellow-300">{review.reviewer.name || review.reviewer.email}</h5>
                        {review.result && (
                          <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                            review.result === 'approve' 
                              ? 'bg-green-600/20 text-green-300' 
                              : 'bg-red-600/20 text-red-300'
                          }`}>
                            {review.result === 'approve' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/60">{formatDate(review.createdAt)}</span>
                        
                        {/* Delete button - only visible in review mode and for the user's own reviews */}
                        {isReviewMode && isCurrentUserReviewer(review.reviewerId) && (
                          <>
                            {showDeleteConfirm === review.id ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteReview(review.id)}
                                  className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition-colors"
                                  disabled={isDeletingReview === review.id}
                                >
                                  {isDeletingReview === review.id ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  className="text-xs bg-white/20 text-white px-2 py-1 rounded hover:bg-white/30 transition-colors"
                                  disabled={isDeletingReview === review.id}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowDeleteConfirm(review.id)}
                                className="text-white/40 hover:text-red-500 transition-colors"
                                title="Delete review"
                              >
                                <Icon glyph="delete" size={16} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-white prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}>
                        {review.comment}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 
