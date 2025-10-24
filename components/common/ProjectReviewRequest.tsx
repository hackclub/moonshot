'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useReviewMode } from '@/app/contexts/ReviewModeContext';
import ProjectMetadataWarning from './ProjectMetadataWarning';

// Define review request types
export type ReviewRequestType = 'ShippedApproval' | 'HoursApproval' | 'HourReview' | 'Other';

interface ProjectReviewRequestProps {
  projectID: string;
  isInReview: boolean;
  isShipped?: boolean; // Add shipped status prop
  isViral?: boolean; // Add viral status prop
  codeUrl?: string; // Add codeUrl prop
  playableUrl?: string; // Add playableUrl prop
  screenshot?: string; // Add screenshot prop
  onRequestSubmitted: (updatedProject: any, review: any) => void;
  onEditProject: () => void; // Add callback to open project editor
  isIslandProject?: boolean; // Add island project flag
}

export default function ProjectReviewRequest({
  projectID,
  isInReview,
  isShipped = false, // Default to false if not provided
  isViral = false, // Default to false if not provided
  codeUrl,
  playableUrl,
  screenshot,
  onRequestSubmitted,
  onEditProject,
  isIslandProject = false
}: ProjectReviewRequestProps) {
  const { isReviewMode } = useReviewMode();
  const [comment, setComment] = useState('');
  const [reviewType, setReviewType] = useState<ReviewRequestType>(
    isIslandProject ? 'ShippedApproval' : (isShipped ? 'HoursApproval' : 'ShippedApproval')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRequestUI, setShowRequestUI] = useState(false);
  
  // Checklist state
  const [checklist, setChecklist] = useState({
    codeComplete: false,
    easyToRun: false,
    experienceableBuild: false,
    wellDocumented: false,
    polished: false
  });

  // Effect to update default reviewType when isShipped, isViral, or isIslandProject changes
  useEffect(() => {
    // Island projects can only submit for ship approval
    if (isIslandProject) {
      setReviewType('ShippedApproval');
    } else {
      // If project is already shipped, default to HoursApproval
      // Otherwise default to ShippedApproval
      setReviewType(isShipped ? 'HoursApproval' : 'ShippedApproval');
    }
  }, [isShipped, isIslandProject]);

  // Reset the Request review collapse state when switching selected project
  useEffect(() => {
    setShowRequestUI(false);
    setComment('');
    setChecklist({
      codeComplete: false,
      easyToRun: false,
      experienceableBuild: false,
      wellDocumented: false,
      polished: false
    });
  }, [projectID]);

  // Don't show this component in review mode or if project is already in review
  if (isReviewMode || isInReview) {
    return null;
  }

  // Check if all required metadata is present
  const hasCodeUrl = codeUrl && codeUrl.trim() !== '';
  const hasPlayableUrl = playableUrl && playableUrl.trim() !== '';
  const hasScreenshot = screenshot && screenshot.trim() !== '';
  const hasAllRequiredMetadata = hasCodeUrl && hasPlayableUrl && hasScreenshot;

  // Gate both metadata warning and submit UI behind a single Request Review button
  if (!showRequestUI) {
    return (
      <button
        onClick={() => setShowRequestUI(true)}
        className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-colors"
      >
        Request review
      </button>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!comment.trim()) {
      toast.error('Please specify what you need reviewed');
      return;
    }

    // Check if all checklist items are completed
    const allChecklistComplete = Object.values(checklist).every(checked => checked);
    if (!allChecklistComplete) {
      toast.error('Please complete all checklist items before submitting');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const response = await fetch('/api/projects/review-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectID,
          comment: comment.trim(),
          reviewType,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit project for review');
      }
      
      const data = await response.json();
      toast.success('Project submitted for review');
      
      // Clear the form
      setComment('');
      // Reset checklist
      setChecklist({
        codeComplete: false,
        easyToRun: false,
        experienceableBuild: false,
        wellDocumented: false,
        polished: false
      });
      
      // Notify parent component
      onRequestSubmitted(data.project, data.review);
    } catch (error) {
      console.error('Error submitting project for review:', error);
      toast.error('Failed to submit project for review');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to handle checklist changes
  const handleChecklistChange = (key: keyof typeof checklist) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if all checklist items are completed
  const allChecklistComplete = Object.values(checklist).every(checked => checked);

  // Helper text based on selected review type
  const getPlaceholderText = () => {
    switch (reviewType) {
      case 'ShippedApproval':
        return "Explain why this project should be approved as 'shipped'. Include any relevant details about deployment and functionality.";
      case 'HourReview':
        return "Request a review focused on hours evidence (journals, screenshots, links). List what evidence you'd like checked.";
      case 'HoursApproval':
        return "Provide details about the updates you've made to this project since it was approved as shipped. (ex. I implemented feature X, Y, & Z.) Please keep it short & use bullets for readability.";
      case 'Other':
        return "Specify what you need reviewed about this project.";
      default:
        return "Provide details about your review request.";
    }
  };
  
  return (
    <div className="p-4 rounded-lg border-l-4 border-amber-600 bg-amber-900/30 text-white">
      {!hasAllRequiredMetadata ? (
        <ProjectMetadataWarning
          projectID={projectID}
          isInReview={isInReview}
          codeUrl={codeUrl}
          playableUrl={playableUrl}
          screenshot={screenshot}
          onEditProject={onEditProject}
        />
      ) : (
      <>
        <h3 className="text-sm font-bold text-white mb-3">Submit for Review</h3>
        <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="reviewType" className="block text-sm font-medium text-white mb-1">
            What type of review do you need?*
          </label>
          <select
            id="reviewType"
            value={reviewType}
            onChange={(e) => setReviewType(e.target.value as ReviewRequestType)}
            className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-black/40 text-white border border-white/20"
            disabled={isSubmitting}
            required
          >
            {isIslandProject ? (
              // Island projects can only submit for ship approval
              <option value="ShippedApproval">I want this project approved as shipped</option>
            ) : (
              // Regular voyage projects have all options
              <>
                {!isShipped && (
                  <option value="ShippedApproval">I want this project marked as shipped</option>
                )}
                {isShipped && (
                  <option value="HoursApproval">I want to ship an update to this project</option>
                )}
                <option value="HourReview">I need my hours reviewed and approved</option>
                <option value="Other">Other</option>
              </>
            )}
          </select>
        </div>
        
        <div className="mb-3">
          <label htmlFor="reviewComment" className="block text-sm font-medium text-white mb-1">
            Additional details*
          </label>
          <textarea
            id="reviewComment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={getPlaceholderText()}
            rows={3}
            className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 bg-black/40 text-white border border-white/20 placeholder-white/70"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Pre-submission Checklist */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-white mb-2">
            Pre-submission Checklist*
          </label>
          <div className="space-y-2 bg-black/40 p-3 rounded border border-white/10">
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="codeComplete"
                checked={checklist.codeComplete}
                onChange={() => handleChecklistChange('codeComplete')}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-white/30 rounded accent-amber-600"
                disabled={isSubmitting}
              />
              <label htmlFor="codeComplete" className="text-sm text-white">
                ✅ My project works!
              </label>
            </div>
            
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="easyToRun"
                checked={checklist.easyToRun}
                onChange={() => handleChecklistChange('easyToRun')}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-white/30 rounded accent-amber-600"
                disabled={isSubmitting}
              />
              <label htmlFor="easyToRun" className="text-sm text-white">
                📦 Easy to run
              </label>
            </div>
            
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="experienceableBuild"
                checked={checklist.experienceableBuild}
                onChange={() => handleChecklistChange('experienceableBuild')}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-white/30 rounded accent-amber-600"
                disabled={isSubmitting}
              />
              <label htmlFor="experienceableBuild" className="text-sm text-white">
              🌐 Experienceable build
              </label>
            </div>
            
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="wellDocumented"
                checked={checklist.wellDocumented}
                onChange={() => handleChecklistChange('wellDocumented')}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-white/30 rounded accent-amber-600"
                disabled={isSubmitting}
              />
              <label htmlFor="wellDocumented" className="text-sm text-white">
                📄 Well-documented
              </label>
            </div>
            
            <div className="flex items-start space-x-2">
              <input
                type="checkbox"
                id="polished"
                checked={checklist.polished}
                onChange={() => handleChecklistChange('polished')}
                className="mt-1 h-4 w-4 text-amber-600 focus:ring-amber-500 border-white/30 rounded accent-amber-600"
                disabled={isSubmitting}
              />
              <label htmlFor="polished" className="text-sm text-white">
                🧹 Polished and presentable
              </label>
            </div>
          </div>
        </div>
        
          <button
            type="submit"
            disabled={isSubmitting || !comment.trim() || !allChecklistComplete}
            className="w-full px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </form>
      </>
      )}
    </div>
  );
} 