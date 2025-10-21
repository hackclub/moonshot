'use client'
import type { Project, ProjectType } from "@/app/api/projects/route"
import Icon from "@hackclub/icons"
import { toast } from "sonner"
import { useState, useEffect } from "react";
import { useIsMobile } from "@/lib/hooks";

type ProjectProps = Project & { 
    userId: string, 
    hoursOverride?: number,
    rawHours?: number,
    hackatime?: string,
    editHandler?: (project: ProjectType) => void,
    selected?: boolean,
    islandProjectType?: string
};

export function Project({ name, description, codeUrl, playableUrl, screenshot, hackatime, submitted, projectID, editHandler, userId, hoursOverride, rawHours = 0, selected, viral, shipped, in_review, islandProjectType }: ProjectProps) {
    // Detect mobile screen size
    const isMobile = useIsMobile();

    const handleRowClick = (e: React.MouseEvent) => {
        if (editHandler) {
            editHandler({ 
                name, 
                description, 
                codeUrl, 
                playableUrl, 
                screenshot, 
                hackatime, 
                userId, 
                projectID, 
                submitted,
                viral: !!viral,
                shipped: !!shipped,
                in_review: !!in_review,
                chat_enabled: false,
                hoursOverride,
                rawHours
            });
        }
    };

    const displayHours = typeof hoursOverride === 'number' ? hoursOverride : (rawHours || 0);
    return (
        <div 
            className={`flex items-center p-3 cursor-pointer transition-colors border-b border-white/10 ${
                selected ? 'bg-orange-600/20 border-l-4 border-l-orange-500' : in_review ? 'bg-black/60 border-l-4 border-l-red-400' : 'bg-black/60'
            } ${
                isMobile ? 'active:bg-white/10' : 'hover:bg-white/10'
            } text-white`}
            onClick={handleRowClick}
        >
            <div className="flex items-center gap-2 min-w-0 w-full">
                {/* Hide hours for island projects since they use blog/vlog tracking */}
                {!islandProjectType && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-black text-white text-xs font-bold">
                        {displayHours} hours
                    </span>
                )}
                <span className={`font-medium flex-shrink-0 sm:truncate sm:max-w-[12rem] ${selected ? 'text-orange-400' : 'text-white'}`}>
                    {islandProjectType && <span className="text-blue-300 font-semibold mr-2">[{islandProjectType}]</span>}
                    {name}
                    {in_review && <span className="ml-2 text-xs text-red-400 font-semibold">(IN REVIEW)</span>}
                </span>
                {description && (
                  <span className="text-white/70 flex-grow truncate min-w-0 ml-2">{description}</span>
                )}
            </div>
        </div>
    )
}