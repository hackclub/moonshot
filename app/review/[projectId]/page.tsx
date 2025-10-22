'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { useSession } from 'next-auth/react';
import ProjectStatus from '@/components/common/ProjectStatus';
import ReviewSection from '@/components/common/ReviewSection';
import ProjectClassificationBadge from '@/components/common/ProjectClassificationBadge';
import ProjectHistogramChart from '@/components/common/ProjectHistogramChart';
import UserClusterChart from '@/components/common/UserClusterChart';
import { lazy, Suspense } from 'react';
import { useMDXComponents } from '@/mdx-components';
import { ReviewModeProvider, useReviewMode } from '../../contexts/ReviewModeContext';

const MDXShippedApproval = lazy(() => import('../review-guidelines/shipped-approval.mdx'));
const MDXShipUpdateApproval = lazy(() => import('../review-guidelines/ship-update-approval.mdx'));
const MDXOther = lazy(() => import('../review-guidelines/other.mdx'));

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Review {
  id: string;
  comment: string;
  createdAt: string;
  projectID: string;
  reviewerId: string;
  reviewer: User;
  reviewType?: string;
}

function ReviewProjectPageInner() {
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId as string;
  const { status, data: session } = useSession();
  const router = useRouter();
  const components = useMDXComponents({});

  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { enableReviewMode } = useReviewMode();

  useEffect(() => {
    enableReviewMode();
  }, [enableReviewMode]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id || !projectId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/review`);
        if (!res.ok) throw new Error('Failed to load review projects');
        const list = await res.json();
        const found = Array.isArray(list) ? list.find((p: any) => p.projectID === projectId) : null;
        if (!found) throw new Error('Project not in review or not found');
        setProject(found);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load project');
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session?.user?.id, projectId]);

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-black/60 text-white flex items-center justify-center">Loading…</div>;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-black/60 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">{error || 'Project not found'}</p>
          <button onClick={() => router.push('/review')} className="px-3 py-2 rounded bg-white/10 border border-white/20">Back to Review</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen starspace-bg">
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold truncate">{project.name}</h1>
          <button onClick={() => router.push('/review')} className="px-3 py-2 rounded bg-white/10 border border-white/20">Back</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-black/60 p-4 rounded-lg border border-white/10">
            <h2 className="text-lg font-semibold mb-2">Review Guidelines</h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <Suspense fallback={<div>Loading…</div>}>
                {project.latestReview?.reviewType === 'ShippedApproval' && <MDXShippedApproval components={components} />}
                {project.latestReview?.reviewType === 'HoursApproval' && <MDXShipUpdateApproval components={components} />}
                {(project.latestReview?.reviewType || 'Other') === 'Other' && <MDXOther components={components} />}
              </Suspense>
            </div>
          </div>
          <div className="bg-black/60 rounded-lg border border-white/10 overflow-hidden">
            <ReviewSection
              projectID={project.projectID}
              projectOwnerUserId={project.userId}
              initialFlags={{ shipped: project.shipped, viral: project.viral, in_review: project.in_review, hackatimeLinkOverrides: {} }}
              onFlagsUpdated={() => {}}
              reviewType={project.latestReview?.reviewType || 'Other'}
              hackatimeLinks={project.hackatimeLinks || []}
              rawHours={project.rawHours}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReviewProjectPage() {
  return (
    <ReviewModeProvider>
      <ReviewProjectPageInner />
    </ReviewModeProvider>
  );
}

