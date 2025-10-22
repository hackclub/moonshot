'use client';

import { useState, useEffect } from 'react';

interface ReviewChecklistProps {
  isSubmitting: boolean;
  onChecklistStateChange: (complete: boolean, justification: string) => void;
}

export default function ReviewChecklist({ isSubmitting, onChecklistStateChange }: ReviewChecklistProps) {
  const [checklistItems, setChecklistItems] = useState({
    understandProcess: false,
    expectPeerReview: false,
  });
  
  const [justification, setJustification] = useState('');

  const allItemsChecked = Object.values(checklistItems).every(item => item);
  const isChecklistComplete = allItemsChecked && !!justification.trim();

  // Notify parent on every change
  useEffect(() => {
    onChecklistStateChange(isChecklistComplete, justification.trim());
  }, [allItemsChecked, justification, onChecklistStateChange, isChecklistComplete]);

  return (
    <div className="bg-black/60 text-white p-4 rounded-lg border-l-4 border-orange-600 mb-4">
      <h3 className="text-sm font-bold text-white mb-3">Review Checklist</h3>
      <p className="text-sm text-white/80 mb-4">
        Please complete all checklist items before approving this review.
      </p>
      <div className="mb-4 space-y-2">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={checklistItems.understandProcess}
            onChange={() => setChecklistItems(prev => ({ ...prev, understandProcess: !prev.understandProcess }))}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 rounded accent-orange-600"
            disabled={isSubmitting}
          />
          <span className="text-sm text-white">I have carefully considered this, and I have been trained on how we are supposed to approve hours and cerify ships.</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={checklistItems.expectPeerReview}
            onChange={() => setChecklistItems(prev => ({ ...prev, expectPeerReview: !prev.expectPeerReview }))}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 rounded accent-orange-600"
            disabled={isSubmitting}
          />
          <span className="text-sm text-white">I understand my work will be reviewed by others.</span>
        </label>
      </div>
      {/* Justification Field */}
      <div className="mb-4">
        <label htmlFor="justification" className="block text-sm font-medium text-white mb-1">
          Justification for approval
        </label>
        <textarea
          id="justification"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Add auditable details about your decision"
          rows={3}
          className="w-full px-3 py-2 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-black/40 text-white placeholder-white/70"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
} 