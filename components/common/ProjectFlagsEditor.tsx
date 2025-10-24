'use client';

import { useState, useEffect } from 'react';
import { useReviewMode } from '@/app/contexts/ReviewModeContext';

export interface ProjectFlags {
  shipped: boolean;
  viral: boolean;
  in_review: boolean;
  hackatimeLinkOverrides?: Record<string, number | undefined>;
}

interface HackatimeLink {
  id: string;
  hackatimeName: string;
  rawHours: number;
  hoursOverride?: number | null | undefined;
}

interface ProjectFlagsEditorProps {
  projectID: string;
  initialShipped: boolean;
  initialViral: boolean;
  initialInReview: boolean;
  hackatimeLinks?: HackatimeLink[];
  journalRawHours?: number;
  journalApprovedHours?: number;
  onChange: (flags: ProjectFlags) => void;
}

export default function ProjectFlagsEditor({
  projectID,
  initialShipped,
  initialViral,
  initialInReview,
  hackatimeLinks = [],
  journalRawHours = 0,
  journalApprovedHours = 0,
  onChange
}: ProjectFlagsEditorProps) {
  const { isReviewMode } = useReviewMode();
  const [shipped, setShipped] = useState(initialShipped);
  const [viral, setViral] = useState(false);
  const [inReview, setInReview] = useState(initialInReview);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, number | undefined>>({});
  
  // Track input field values separately from the actual override values
  // This prevents the input from being reset while typing
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Initialize link overrides from hackatimeLinks - only run once on initial render or when hackatimeLinks change
  useEffect(() => {
    if (hackatimeLinks && hackatimeLinks.length > 0) {
      console.log('Initializing link overrides from hackatimeLinks');
      const initialOverrides: Record<string, number | undefined> = {};
      const initialInputs: Record<string, string> = {};
      
      hackatimeLinks.forEach(link => {
        // Use the existing hoursOverride value from the link
        initialOverrides[link.id] = link.hoursOverride ?? undefined;
        
        // Initialize input values too
        initialInputs[link.id] = link.hoursOverride !== undefined && link.hoursOverride !== null 
          ? String(link.hoursOverride) 
          : '';
      });
      
      // Use a function updater to avoid dependencies on linkOverrides
      setLinkOverrides(prevOverrides => {
        // If we already have some overrides, only update for new links
        if (Object.keys(prevOverrides).length > 0) {
          const updatedOverrides = { ...prevOverrides };
          
          // Only add entries for links that don't already have overrides
          hackatimeLinks.forEach(link => {
            if (!(link.id in prevOverrides)) {
              updatedOverrides[link.id] = link.hoursOverride ?? undefined;
            }
          });
          
          return updatedOverrides;
        }
        
        // Otherwise use the initial overrides
        return initialOverrides;
      });
      
      // Similarly for input values
      setInputValues(prevInputs => {
        // If we already have some input values, preserve them
        if (Object.keys(prevInputs).length > 0) {
          const updatedInputs = { ...prevInputs };
          
          // Only add entries for links that don't have input values
          hackatimeLinks.forEach(link => {
            if (!(link.id in prevInputs)) {
              updatedInputs[link.id] = link.hoursOverride !== undefined && link.hoursOverride !== null 
                ? String(link.hoursOverride) 
                : '';
            }
          });
          
          return updatedInputs;
        }
        
        // Otherwise use the initial input values
        return initialInputs;
      });
    }
  }, [hackatimeLinks]);

  // Only show editor in review mode
  if (!isReviewMode) {
    return null;
  }

  // Notify parent when flags change
  const handleFlagChange = (field: string, value: boolean) => {
    console.log(`[DEBUG] handleFlagChange: ${field} = ${value}`);
    
    // First update the local state variables
    let updatedShipped = shipped;
    let updatedViral = viral;
    
    // Update the specific flag and handle special cases
    switch (field) {
      case 'shipped':
        updatedShipped = value;
        setShipped(value);
        break;
      case 'viral':
        // Viral flag removed from UI; force to false
        updatedViral = false;
        setViral(false);
        break;
    }
    
    // Create a new flags object with the updated flag values
    const newFlags: ProjectFlags = { 
      shipped: updatedShipped, 
      viral: updatedViral, 
      in_review: inReview,
      // IMPORTANT: Always create a deep copy of the linkOverrides object
      hackatimeLinkOverrides: { ...(linkOverrides || {}) }
    };
    
    console.log(`[DEBUG] Flag change sending full state with preserved overrides:`, JSON.stringify(newFlags));
    console.log(`[DEBUG] After change - shipped: ${updatedShipped}, viral: ${updatedViral}`);
    
    // Send the complete update to the parent, including all hour overrides
    onChange(newFlags);
  };

  // Handle input change without immediately updating the actual override
  const handleInputChange = (linkId: string, value: string) => {
    // Update the input field value immediately for a responsive UI
    setInputValues(prev => ({
      ...prev,
      [linkId]: value
    }));
  };
  
  // Handle blur event to commit the final value
  const handleInputBlur = (linkId: string, value: string) => {
    console.log(`[DEBUG] handleInputBlur: linkId=${linkId}, value="${value}"`);
    
    // Convert input value to number or undefined
    let numValue: number | undefined = undefined;
    
    if (value.trim() !== '') {
      const parsed = parseFloat(value);
      // Only use the value if it's a valid number
      if (!isNaN(parsed)) {
        numValue = parsed;
        
        // Ensure the value is non-negative
        if (numValue < 0) numValue = 0;
        
        // Limit to 2 decimal places
        numValue = parseFloat(numValue.toFixed(2));
      }
    }
    
    // Get current value to compare
    const currentValue = linkOverrides[linkId];
    
    console.log(`[DEBUG] Comparing values: current=${currentValue}, new=${numValue}`);
    
    // Check if there's an actual change to avoid unnecessary updates
    // Treat null and undefined as equivalent
    const isEquivalent = 
      (currentValue === numValue) || 
      ((currentValue === null || currentValue === undefined) && 
       (numValue === null || numValue === undefined));
       
    if (isEquivalent) {
      console.log(`[DEBUG] No change in value, skipping update`);
      return;
    }
    
    // Create a new overrides object to avoid mutating state
    const newOverrides = { ...linkOverrides };
    
    if (numValue === undefined) {
      // For blank inputs (meaning no override), make sure they're explicitly 
      // included in the overrides object with a value of undefined
      newOverrides[linkId] = undefined;
      
      // Also update the input field to show empty string instead of "undefined"
      setInputValues(prev => ({
        ...prev,
        [linkId]: ''
      }));
    } else {
      newOverrides[linkId] = numValue;
      
      // Update input field to show formatted value
      setInputValues(prev => ({
        ...prev,
        [linkId]: String(numValue)
      }));
    }
    
    console.log(`[DEBUG] Updating override for ${linkId} to ${newOverrides[linkId]}`);
    console.log(`[DEBUG] Full overrides object:`, newOverrides);
    
    // Update local state first
    setLinkOverrides(newOverrides);
    
    // Send update to parent component with all the details
    console.log(`[DEBUG] Sending update to parent with hour override: ${linkId}=${numValue}`);
    
    // Create immutable copy of updated flags to pass to parent
    const updatedFlags: ProjectFlags = {
      shipped,
      viral,
      in_review: inReview,
      hackatimeLinkOverrides: { ...newOverrides } as Record<string, number | undefined>
    };
    console.log(`[DEBUG] Sending to parent:`, JSON.stringify(updatedFlags));
    onChange(updatedFlags);
  };

  // Calculate total raw hours from Hackatime links only
  const totalRawHackatimeHours = hackatimeLinks.reduce(
    (sum, link) => sum + (typeof link.rawHours === 'number' ? link.rawHours : 0),
    0
  );

  // Calculate total approved hours from Hackatime links only (with overrides applied)
  const totalApprovedHackatimeHours = hackatimeLinks.reduce(
    (sum, link) => {
      // Only include hours that have been explicitly overridden/approved
      const linkHours = linkOverrides[link.id] !== undefined 
        ? linkOverrides[link.id] 
        : (typeof link.hoursOverride === 'number' ? link.hoursOverride : undefined);
      
      // Only add to sum if there's an actual approved value
      return sum + (typeof linkHours === 'number' ? linkHours : 0);
    },
    0
  );

  // Include Journal entry aggregates in totals (with dynamic fallback from chat messages)
  const [journalSums, setJournalSums] = useState<{raw:number, approved:number}>({raw:0, approved:0})
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectID}/chat/messages`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data)) return
        const raw = data.reduce((s:number,m:any)=> s + (typeof m.hours==='number'?m.hours:0), 0)
        const appr = data.reduce((s:number,m:any)=> s + (typeof m.approvedHours==='number'?m.approvedHours:0), 0)
        setJournalSums({raw, approved: appr})
      } catch {}
    })()
  }, [projectID])

  const resolvedJournalRaw = (journalSums.raw > 0 ? journalSums.raw : (journalRawHours || 0))
  const resolvedJournalApproved = (journalSums.approved > 0 ? journalSums.approved : (journalApprovedHours || 0))
  const totalRawAll = (totalRawHackatimeHours || 0) + resolvedJournalRaw
  const totalApprovedAll = (totalApprovedHackatimeHours || 0) + resolvedJournalApproved

  return (
    <div className="bg-black/60 text-white p-3 sm:p-4 rounded-lg border border-white/10">
      <h3 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Review Mode: Project Status Flags</h3>
      
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-3">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="shipped"
            checked={shipped}
            onChange={() => handleFlagChange('shipped', !shipped)}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 rounded"
          />
          <label htmlFor="shipped" className="text-xs sm:text-sm font-medium text-white">Shipped</label>
        </div>
        
        {/* Viral option removed */}
      </div>
      
      {/* Hackatime Hours Override Section */}
      {hackatimeLinks && hackatimeLinks.length > 0 && (
        <div className="mt-4 sm:mt-6">
          <h4 className="text-xs sm:text-sm font-bold text-white mb-2 sm:mb-3">Time Tracking</h4>
          
          <div className="bg-black/40 rounded-lg border border-white/10 overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-black/60">
                <tr>
                  <th className="px-2 py-2 sm:px-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider w-1/2">
                    Project
                  </th>
                  <th className="px-2 py-2 sm:px-3 text-center text-xs font-medium text-white/70 uppercase tracking-wider w-1/4">
                    <span className="hidden sm:inline">Raw Hours</span>
                    <span className="sm:hidden">Raw</span>
                  </th>
                  <th className="px-2 py-2 sm:px-3 text-center text-xs font-medium text-white/70 uppercase tracking-wider w-1/4">
                    <span className="hidden sm:inline">APPROVED</span>
                    <span className="sm:hidden">Apprv</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-transparent divide-y divide-white/10">
                {hackatimeLinks.map((link) => (
                  <tr key={link.id}>
                    <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm text-white max-w-[120px] sm:max-w-none truncate">
                      {link.hackatimeName}
                    </td>
                    <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm text-white/80 text-center">
                      {link.rawHours !== null && typeof link.rawHours === 'number' ? `${link.rawHours}h` : '—'}
                    </td>
                    <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm">
                      <div className="relative flex items-center justify-center">
                        <input 
                          type="text"
                          inputMode="decimal"
                          value={inputValues[link.id] || ''}
                          onChange={(e) => handleInputChange(link.id, e.target.value)}
                          onBlur={(e) => handleInputBlur(link.id, e.target.value)}
                          placeholder="none"
                          className="block w-12 sm:w-20 py-1 px-1 sm:px-2 text-center border-white/20 rounded-md shadow-sm focus:border-orange-500 focus:ring-orange-500 text-xs sm:text-sm bg-black/40 text-white placeholder-white/50"
                        />
                        <span className="ml-0.5 sm:ml-1 text-white/60">h</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Journal entries aggregated row */}
                <tr>
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm text-white">
                    {inReview ? (
                      <a
                        href={`/launchpad/journal-editor?projectId=${encodeURIComponent(projectID)}&mode=review`}
                        className="text-blue-300 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Journal entries
                      </a>
                    ) : (
                      'Journal entries'
                    )}
                  </td>
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm text-white/80 text-center">
                    {Number(resolvedJournalRaw || 0).toFixed(1)}h
                  </td>
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm font-medium text-orange-400 text-center">
                    {Number(resolvedJournalApproved || 0).toFixed(1)}h
                  </td>
                </tr>
                <tr className="bg-black/60">
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm font-medium text-white">
                    Total
                  </td>
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm font-medium text-white text-center">
                    {totalRawAll.toFixed(1)}h
                  </td>
                  <td className="px-2 py-2 sm:px-3 whitespace-nowrap text-xs sm:text-sm font-medium text-orange-400 text-center">
                    {totalApprovedAll.toFixed(1)}h
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="text-xs text-white/70 mt-2">
            <p>Enter hour values to approve the raw hours from Hackatime. Leave blank for no approval.</p>
          </div>
        </div>
      )}
    </div>
  );
} 