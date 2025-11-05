'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import LoadingOverlay from '@/components/common/LoadingOverlay'
import AccessDenied from '@/components/common/AccessDenied'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/apiFetch'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const DynamicMarkdown = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false })

// Custom sanitization schema that allows video tags while blocking scripts
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'video'],
  attributes: {
    ...defaultSchema.attributes,
    video: ['class', 'controls', 'playsinline', 'src', 'style', 'width', 'height'],
  },
}

function JournalEditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params)
  const { data: session, status } = useSession()
  const [content, setContent] = useState<string>('')
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode') || ''
  
  // Only allow review mode for admins and reviewers
  const userRole = session?.user?.role
  const isAdmin = userRole === 'Admin' || session?.user?.isAdmin === true
  const isReviewer = userRole === 'Reviewer'
  const canAccessReviewMode = isAdmin || isReviewer
  const isReviewOnly = modeParam === 'review' && canAccessReviewMode
  const [projects, setProjects] = useState<Array<{ projectID: string; name: string; in_review?: boolean; chat_enabled?: boolean }>>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false)
  const [uploadTotalFiles, setUploadTotalFiles] = useState<number>(0)
  const [uploadCompletedFiles, setUploadCompletedFiles] = useState<number>(0)
  const [isPublishing, setIsPublishing] = useState<boolean>(false)
  const [publishTick, setPublishTick] = useState<number>(0)
  const [hoursWorked, setHoursWorked] = useState<string>('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isValidatingProject, setIsValidatingProject] = useState<boolean>(true)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Find UIW inner textarea for caret insertion
    if (!containerRef.current) return
    const el = containerRef.current.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null
    if (el) {
      textareaRef.current = el
    }
  })

  // Ensure clicks anywhere in the editor area place the caret in the text input
  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    // Let toolbar and textarea clicks behave natively
    if (target.closest('.w-md-editor-toolbar')) return
    if (target.tagName === 'TEXTAREA' || target.closest('.w-md-editor-text-input')) return
    // For clicks on the empty container/background, just focus without changing caret
    if (textareaRef.current) {
      const el = textareaRef.current
      requestAnimationFrame(() => {
        try { el.focus() } catch {}
      })
    }
  }

  // Load user's projects for selection
  useEffect(() => {
    (async () => {
      if (status !== 'authenticated') return
      try {
        setIsLoadingProjects(true)
        const res = await apiFetch('/api/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(Array.isArray(data) ? data : [])
        } else {
          setProjects([])
        }
      } finally {
        setIsLoadingProjects(false)
      }
    })()
  }, [status])

  // Validate project access upfront
  useEffect(() => {
    (async () => {
      if (status !== 'authenticated' || !projectId) return
      
      setIsValidatingProject(true)
      setProjectError(null)
      
      try {
        // Try to fetch the specific project to validate access
        const res = await apiFetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
        
        if (!res.ok) {
          if (res.status === 404) {
            setProjectError('Project not found. It may have been deleted or you may not have access to it.')
          } else if (res.status === 403) {
            setProjectError('You do not have permission to write journal entries for this project.')
          } else {
            setProjectError('Unable to load project. Please try again.')
          }
          return
        }
        
        const data = await res.json()
        const project = Array.isArray(data) ? data.find((p: any) => p.projectID === projectId) : data
        
        if (!project) {
          setProjectError('Project not found. It may have been deleted or you may not have access to it.')
          return
        }
        
        // Check if user owns this project (unless they're an admin/reviewer)
        // Admins/reviewers can view any project in review mode, but can only write to projects they own
        const userRole = session?.user?.role
        const isAdmin = userRole === 'Admin' || session?.user?.isAdmin === true
        const isReviewer = userRole === 'Reviewer'
        const canBypassOwnershipCheck = isAdmin || isReviewer
        const requestedReviewMode = searchParams.get('mode') === 'review'
        
        // For write mode (not review): must own the project unless admin/reviewer
        if (!canBypassOwnershipCheck && project.userId !== session?.user?.id) {
          setProjectError('You can only write journal entries to your own projects.')
          return
        }
        
        // For review mode: must be admin/reviewer AND project must be in review
        if (requestedReviewMode && !canBypassOwnershipCheck) {
          setProjectError('Review mode is only available to administrators and reviewers.')
          return
        }
        
        // Project is valid and accessible
        setProjectError(null)
      } catch (error) {
        console.error('Error validating project:', error)
        setProjectError('Unable to validate project access. Please try again.')
      } finally {
        setIsValidatingProject(false)
      }
    })()
  }, [status, projectId, session, searchParams])

  if (status === 'loading' || isValidatingProject) return <LoadingOverlay />
  if (status === 'unauthenticated') return <AccessDenied />

  // Require a projectId to be provided in the URL
  if (!projectId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 pt-28 md:pt-32 pb-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">No Project Selected</h2>
            <p className="text-white/80 mb-4">
              The journal editor requires a specific project context. Please navigate to this page from your project details.
            </p>
            <Link
              href="/launchpad"
              className="inline-block px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors"
            >
              Go to Launchpad
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Show error if project validation failed
  if (projectError) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 pt-28 md:pt-32 pb-8">
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
            <p className="text-white/80 mb-4">{projectError}</p>
            <Link
              href="/launchpad"
              className="inline-block px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors"
            >
              Go to Launchpad
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Find the selected project for display
  const selectedProject = projects.find(p => p.projectID === projectId)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Cosmic Background Layers */}
      <div className="journal-stellar-background" aria-hidden="true">
        <div className="journal-nebula-layer"></div>
        <div className="journal-starfield-layer"></div>
        <div className="journal-shooting-stars"></div>
      </div>
      <div className="journal-font-kavoon max-w-4xl mx-auto px-4 pt-28 md:pt-32 pb-8 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="journal-title-enhanced font-kavoon inline-flex items-center gap-3">
            <span>Journal Editor</span>
            <img src="/workingCat.png" alt="Journal icon" className="journal-title-icon" />
          </h1>
          <Link
            href="/launchpad"
            className="journal-back-button"
          >
            ← Back to Launchpad
          </Link>
        </div>
        {selectedProject && (
          <p className="text-sm text-white/70 mb-4">
            Writing to: <span className="text-white/90 font-medium">{selectedProject.name}</span>
          </p>
        )}

        {/* Hours worked at the top */}
        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div className="mb-4">
          <label className="block text-sm text-white/80 mb-2">Hours worked</label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            placeholder="e.g. 1.5"
            className="journal-hours-input"
            required
          />
          <div className="mt-6 text-xs text-white/60">Enter a positive number - partial hours allowed (e.g., 0.5).</div>
        </div>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div
          ref={containerRef}
          className={`journal-editor-container relative ${isDragging ? 'ring-2 ring-blue-500' : ''}`}
          data-color-mode="dark"
          onMouseDown={handleEditorMouseDown}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = Array.from(e.dataTransfer.files || [])
            if (files.length === 0) return;
            setUploadTotalFiles(files.length)
            setUploadCompletedFiles(0)
            setShowUploadModal(true)
            setIsUploading(true)

            for (const file of files) {
              try {
                // 1) Upload to temp storage
                const form = new FormData()
                form.append('file', file)
                const presignRes = await apiFetch('/api/uploads', { method: 'POST', body: form })
                if (!presignRes.ok) {
                  setUploadCompletedFiles((n) => n + 1)
                  continue
                }
                const { tempUrl } = await presignRes.json()

                // 2) Ask CDN to ingest
                const cdnRes = await apiFetch('/api/cdn/ingest', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tempPath: tempUrl })
                })
                if (!cdnRes.ok) {
                  let errMsg = 'Failed to upload to CDN'
                  try {
                    const body = await cdnRes.json()
                    if (body?.error) errMsg += `: ${body.error}`
                    if (body?.details) errMsg += ` — ${body.details}`
                  } catch {}
                  alert(errMsg)
                  setUploadCompletedFiles((n) => n + 1)
                  continue
                }
                const cdn = await cdnRes.json()
                const deployedUrl = cdn?.deployedUrl || `${location.origin}${tempUrl}`

                // 3) Insert media at caret (or append)
                let markdown = ''
                if (file.type.startsWith('image')) {
                  markdown = `![](${deployedUrl})`
                } else if (file.type.startsWith('video')) {
                  // Try to discover natural aspect ratio
                  let aspect = '16/9'
                  try {
                    const probe = document.createElement('video')
                    probe.preload = 'metadata'
                    probe.src = deployedUrl
                    await new Promise<void>((resolve, reject) => {
                      probe.onloadedmetadata = () => {
                        const w = probe.videoWidth || 16
                        const h = probe.videoHeight || 9
                        if (w > 0 && h > 0) aspect = `${w}/${h}`
                        resolve()
                      }
                      probe.onerror = () => resolve()
                    })
                  } catch {}
                  markdown = `<video class="journal-video" controls playsinline style="aspect-ratio: ${aspect};" src="${deployedUrl}"></video>`
                } else {
                  markdown = `[${file.name}](${deployedUrl})`
                }
                const el = textareaRef.current
                if (el) {
                  const start = el.selectionStart ?? content.length
                  const end = el.selectionEnd ?? content.length
                  const before = content.slice(0, start)
                  const after = content.slice(end)
                  const next = `${before}${markdown}${after}`
                  setContent(next)
                  setTimeout(() => {
                    try { el.focus(); const pos = (before + markdown).length; el.setSelectionRange(pos, pos) } catch {}
                  })
                } else {
                  setContent((prev) => `${prev}\n\n${markdown}`)
                }
              } catch (_) {
                // ignore per-file errors
              } finally {
                setUploadCompletedFiles((n) => n + 1)
              }
            }
            setShowUploadModal(false)
            setIsUploading(false)
          }}
        >
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center text-blue-200 text-sm">
              Drop files to upload
            </div>
          )}
          <MDEditor
            value={content}
            onChange={(v) => setContent(v || '')}
            height={500}
            preview="edit"
            previewOptions={{ 
              remarkPlugins: [remarkGfm],
              rehypePlugins: [[rehypeSanitize, sanitizeSchema]]
            }}
          />
        </div>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
          <>
            <h4 className="mt-6 text-sm font-semibold text-white/80">Markdown preview</h4>
            <div className="mt-2 bg-black/60 border border-white/10 rounded-lg p-4 prose prose-invert max-w-none" data-color-mode="dark">
              <DynamicMarkdown 
                source={content}
                rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
              />
            </div>
          </>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div className="mt-4 flex items-center gap-3">
          <button
              className="journal-publish-button"
              disabled={
                isPublishing ||
                isUploading ||
                !projectId ||
                content.trim().length === 0 ||
                content.trim().length > 10000 ||
                hoursWorked === '' ||
                isNaN(Number(hoursWorked)) ||
                Number(hoursWorked) <= 0 ||
                Number(hoursWorked) > 24
              }
            onClick={async () => {
              const text = content.trim()
                if (!projectId || text.length === 0) return
                const hoursNum = Number(hoursWorked)
                if (
                  hoursWorked === '' ||
                  isNaN(hoursNum) ||
                  hoursNum <= 0 ||
                  hoursNum > 24
                ) {
                  alert('Please enter hours worked between 0 and 24.')
                  return
                }
              if (text.length > 10000) {
                alert('Message too long. Maximum 10,000 characters allowed.')
                return
              }
              try {
                setIsPublishing(true)
                const res = await apiFetch(`/api/projects/${projectId}/chat/messages`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: text, hours: hoursNum }),
                })
                if (!res.ok) {
                  const body = await res.json().catch(() => ({} as any))
                  alert(body?.error || 'Failed to publish entry')
                  return
                }
                setPublishTick(t => t + 1)
                setContent('')
                  setHoursWorked('')
                // Scroll editor into view after publish
                window.scrollTo({ top: 0, behavior: 'smooth' })
              } catch (e) {
                alert('Failed to publish entry')
              } finally {
                setIsPublishing(false)
              }
            }}
          >
            {isPublishing ? 'Publishing…' : 'Publish'}
          </button>
        </div>
        )}

        {/* Project Chat Panel */}
        <div className="mt-8 bg-black/60 border border-white/10 rounded-lg">
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <h2 className="text-lg font-semibold">Journal Entries</h2>
          </div>
          <ProjectChatInline projectId={projectId} projectName={selectedProject?.name || ''} refreshTrigger={publishTick} isReviewOnly={isReviewOnly} />
        </div>
      </div>
      {/* Blocking upload modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="w-full max-w-sm bg-black border border-white/10 rounded-lg p-5 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              <div className="text-sm">Uploading media to CDN…</div>
            </div>
            <div className="text-xs text-white/60 mb-2">{uploadCompletedFiles} / {uploadTotalFiles} completed</div>
            <div className="w-full h-2 bg-white/10 rounded">
              <div
                className="h-2 bg-blue-500 rounded transition-all"
                style={{ width: `${uploadTotalFiles > 0 ? Math.min(100, Math.round((uploadCompletedFiles / uploadTotalFiles) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Graphics-only styling for the journaling UI */}
      <style jsx global>{`
        /* Cosmic Background - Darker */
        .journal-stellar-background { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: hidden; background: linear-gradient(135deg, #0a0515 0%, #150920 20%, #1a0d25 40%, #1f112a 60%, #1a0d25 80%, #0a0515 100%); }
        /* Darker Nebula layer with reduced brightness - static */
        .journal-nebula-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(ellipse 800px 600px at 15% 25%, rgba(255, 215, 0, 0.2) 0%, transparent 60%), radial-gradient(ellipse 700px 500px at 85% 15%, rgba(139, 92, 246, 0.25) 0%, transparent 55%), radial-gradient(ellipse 600px 800px at 35% 75%, rgba(59, 130, 246, 0.22) 0%, transparent 60%), radial-gradient(ellipse 900px 500px at 90% 85%, rgba(252, 211, 77, 0.2) 0%, transparent 55%), radial-gradient(ellipse 700px 600px at 5% 50%, rgba(167, 139, 250, 0.15) 0%, transparent 50%), radial-gradient(ellipse 800px 700px at 95% 60%, rgba(100, 181, 246, 0.18) 0%, transparent 55%); opacity: 0.6; }
        /* Enhanced starfield with many more stars - static background, twinkling stars */
        .journal-starfield-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(5px 5px at 5% 10%, #ffffff, transparent), radial-gradient(4px 4px at 15% 25%, #fcd34d, transparent), radial-gradient(3px 3px at 25% 5%, #ffffff, transparent), radial-gradient(4px 4px at 35% 40%, #8b5cf6, transparent), radial-gradient(5px 5px at 45% 20%, #ffffff, transparent), radial-gradient(3px 3px at 55% 60%, #3b82f6, transparent), radial-gradient(4px 4px at 65% 15%, #fcd34d, transparent), radial-gradient(5px 5px at 75% 80%, #ffffff, transparent), radial-gradient(3px 3px at 85% 45%, #8b5cf6, transparent), radial-gradient(4px 4px at 95% 70%, #3b82f6, transparent), radial-gradient(5px 5px at 10% 50%, #ffffff, transparent), radial-gradient(4px 4px at 20% 90%, #fcd34d, transparent), radial-gradient(3px 3px at 30% 30%, #8b5cf6, transparent), radial-gradient(5px 5px at 40% 75%, #ffffff, transparent), radial-gradient(4px 4px at 50% 10%, #3b82f6, transparent), radial-gradient(3px 3px at 60% 55%, #fcd34d, transparent), radial-gradient(5px 5px at 70% 95%, #ffffff, transparent), radial-gradient(4px 4px at 80% 35%, #8b5cf6, transparent), radial-gradient(3px 3px at 90% 65%, #3b82f6, transparent), radial-gradient(5px 5px at 12% 85%, #ffffff, transparent), radial-gradient(4px 4px at 22% 15%, #fcd34d, transparent), radial-gradient(3px 3px at 32% 50%, #8b5cf6, transparent), radial-gradient(5px 5px at 42% 90%, #ffffff, transparent), radial-gradient(4px 4px at 52% 30%, #3b82f6, transparent), radial-gradient(3px 3px at 62% 75%, #fcd34d, transparent), radial-gradient(5px 5px at 72% 5%, #ffffff, transparent), radial-gradient(4px 4px at 82% 40%, #8b5cf6, transparent), radial-gradient(3px 3px at 92% 20%, #3b82f6, transparent), radial-gradient(5px 5px at 8% 30%, #ffffff, transparent), radial-gradient(4px 4px at 18% 70%, #fcd34d, transparent), radial-gradient(3px 3px at 28% 95%, #8b5cf6, transparent), radial-gradient(5px 5px at 38% 60%, #ffffff, transparent), radial-gradient(4px 4px at 48% 85%, #3b82f6, transparent), radial-gradient(3px 3px at 58% 25%, #fcd34d, transparent), radial-gradient(5px 5px at 68% 50%, #ffffff, transparent), radial-gradient(4px 4px at 78% 10%, #8b5cf6, transparent), radial-gradient(3px 3px at 88% 80%, #3b82f6, transparent); background-repeat: no-repeat; background-size: 100% 100%; animation: journalStarTwinkle 4s ease-in-out infinite; opacity: 1; }
        @keyframes journalStarTwinkle { 0%, 100% { opacity: 0.6; filter: brightness(0.8); } 25% { opacity: 1; filter: brightness(1.8); } 50% { opacity: 0.7; filter: brightness(1.2); } 75% { opacity: 1; filter: brightness(2); } }
        /* Shooting stars removed - no animation */
        .journal-shooting-stars { display: none; }

        /* Enhanced Journal Title */
        .journal-title-enhanced { font-size: 2.5rem !important; font-weight: bold !important; color: #fcd34d !important; text-shadow: 0 0 10px rgba(252, 211, 77, 0.8), 0 0 20px rgba(252, 211, 77, 0.6), 0 0 30px rgba(252, 211, 77, 0.4), 0 0 40px rgba(252, 211, 77, 0.2) !important; animation: titleGlow 3s ease-in-out infinite alternate; letter-spacing: 0.05em !important; }
        .journal-title-icon { height: 4.5rem; width: 4.5rem; filter: drop-shadow(0 0 10px rgba(252, 211, 77, 0.6)) drop-shadow(0 0 20px rgba(252, 211, 77, 0.4)); animation: iconFloat 2s ease-in-out infinite; transition: transform 0.3s ease; }
        .journal-title-icon:hover { transform: scale(1.15) rotate(5deg); }

        /* Enhanced Back Button */
        .journal-back-button { padding: 0.75rem 1.5rem; border-radius: 0.5rem; background: linear-gradient(135deg, rgba(252, 211, 77, 0.9) 0%, rgba(245, 224, 24, 0.9) 100%); color: #1a1a2e; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4); animation: buttonPulse 2s ease-in-out infinite; }
        .journal-back-button:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 20px rgba(252, 211, 77, 0.6); background: linear-gradient(135deg, rgba(252, 211, 77, 1) 0%, rgba(245, 224, 24, 1) 100%); color: white; }
        .journal-back-button:active, .journal-back-button:active:hover { transform: translateY(0) scale(1) !important; color: white !important; background: linear-gradient(135deg, rgba(252, 211, 77, 0.9) 0%, rgba(245, 224, 24, 0.9) 100%) !important; box-shadow: 0 4px 15px rgba(252, 211, 77, 0.5) !important; animation: none !important; }

        /* Enhanced Hours Input */
        .journal-hours-input { width: 8rem; padding: 0.75rem 1rem; background: linear-gradient(135deg, rgba(252, 211, 77, 0.15) 0%, rgba(245, 224, 24, 0.15) 100%); border: 2px solid rgba(252, 211, 77, 0.5); border-radius: 0.75rem; color: #fcd34d; font-size: 1.125rem; font-weight: 600; text-align: center; transition: all 0.3s ease; box-shadow: 0 2px 10px rgba(252, 211, 77, 0.2); }
        .journal-hours-input::placeholder { color: rgba(252, 211, 77, 0.5); }
        .journal-hours-input:focus { outline: none; border-color: #fcd34d; background: linear-gradient(135deg, rgba(252, 211, 77, 0.25) 0%, rgba(245, 224, 24, 0.25) 100%); box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4), 0 0 20px rgba(252, 211, 77, 0.3); transform: scale(1.05); }

        /* Enhanced Publish Button */
        .journal-publish-button { padding: 0.875rem 2rem; border-radius: 0.75rem; background: linear-gradient(135deg, #fcd34d 0%, #f5e018 100%); color: #1a1a2e; font-weight: 600; font-size: 1rem; border: none; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4); animation: buttonGlow 2.5s ease-in-out infinite; position: relative; overflow: hidden; }
        .journal-publish-button::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent); transition: left 0.5s ease; }
        .journal-publish-button:hover::before { left: 100%; }
        .journal-publish-button:hover { transform: translateY(-2px) scale(1.05); box-shadow: 0 6px 25px rgba(252, 211, 77, 0.6), 0 0 30px rgba(252, 211, 77, 0.3); background: linear-gradient(135deg, #fde047 0%, #fcd34d 100%); }
        .journal-publish-button:active { transform: translateY(0) scale(1); }
        .journal-publish-button:disabled { opacity: 0.5; cursor: not-allowed; animation: none; transform: none; }
        .journal-publish-button:disabled:hover { transform: none; box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4); }

        @keyframes titleGlow { from { text-shadow: 0 0 10px rgba(252, 211, 77, 0.8), 0 0 20px rgba(252, 211, 77, 0.6), 0 0 30px rgba(252, 211, 77, 0.4), 0 0 40px rgba(252, 211, 77, 0.2); } to { text-shadow: 0 0 15px rgba(252, 211, 77, 1), 0 0 25px rgba(252, 211, 77, 0.8), 0 0 35px rgba(252, 211, 77, 0.6), 0 0 45px rgba(252, 211, 77, 0.4), 0 0 55px rgba(252, 211, 77, 0.2); } }
        @keyframes iconFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
        @keyframes buttonPulse { 0%, 100% { box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4); } 50% { box-shadow: 0 4px 20px rgba(252, 211, 77, 0.6); } }
        @keyframes buttonGlow { 0%, 100% { box-shadow: 0 4px 15px rgba(252, 211, 77, 0.4); } 50% { box-shadow: 0 4px 20px rgba(252, 211, 77, 0.6), 0 0 30px rgba(252, 211, 77, 0.3); } }

        /* Apply Kavoon by default; keep editor/markdown readable with sans-serif */
        .journal-font-kavoon { font-family: var(--font-kavoon), 'Kavoon', cursive !important; }
        .journal-font-kavoon * { font-family: var(--font-kavoon), 'Kavoon', cursive !important; }
        .journal-font-kavoon .w-md-editor,
        .journal-font-kavoon .w-md-editor *,
        .journal-font-kavoon .wmde-markdown,
        .journal-font-kavoon .wmde-markdown *:not(code):not(pre) { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important; line-height: 1.6; }
        .journal-font-kavoon textarea, .journal-font-kavoon .w-md-editor-text-input, .journal-font-kavoon input[type="number"], .journal-font-kavoon input[type="text"] { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important; }
        /* Monospace for code */
        .journal-font-kavoon code, .journal-font-kavoon pre, .journal-font-kavoon .wmde-markdown code, .journal-font-kavoon .wmde-markdown pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important; }
        .journal-video { width: 100%; height: auto; display: block; background: #000; border-radius: 8px; }
        .journal-font-kavoon .wmde-markdown { background-color: transparent !important; }

        /* Enhanced Editor Container with animated glow */
        .journal-editor-container { border-radius: 1rem; overflow: hidden; box-shadow: 0 0 30px rgba(252, 211, 77, 0.4), 0 0 60px rgba(139, 92, 246, 0.3), 0 0 90px rgba(252, 211, 77, 0.2), inset 0 0 30px rgba(0, 0, 0, 0.3); background: rgba(10, 5, 21, 0.7); border: 2px solid rgba(252, 211, 77, 0.5); transition: all 0.3s ease; animation: editorGlowPulse 3s ease-in-out infinite; position: relative; }
        .journal-editor-container::before { content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px; border-radius: 1rem; background: linear-gradient(135deg, rgba(252, 211, 77, 0.3), rgba(139, 92, 246, 0.3), rgba(252, 211, 77, 0.3)); background-size: 200% 200%; z-index: -1; animation: editorBorderGlow 4s ease infinite; opacity: 0.8; }
        @keyframes editorGlowPulse { 0%, 100% { box-shadow: 0 0 30px rgba(252, 211, 77, 0.4), 0 0 60px rgba(139, 92, 246, 0.3), 0 0 90px rgba(252, 211, 77, 0.2), inset 0 0 30px rgba(0, 0, 0, 0.3); border-color: rgba(252, 211, 77, 0.5); } 50% { box-shadow: 0 0 50px rgba(252, 211, 77, 0.6), 0 0 100px rgba(139, 92, 246, 0.5), 0 0 150px rgba(252, 211, 77, 0.3), inset 0 0 40px rgba(0, 0, 0, 0.4); border-color: rgba(252, 211, 77, 0.7); } }
        @keyframes editorBorderGlow { 0%, 100% { background-position: 0% 50%; opacity: 0.8; } 50% { background-position: 100% 50%; opacity: 1; } }
        .journal-editor-container:hover { border-color: rgba(252, 211, 77, 0.8); animation: editorGlowPulseHover 2s ease-in-out infinite; }
        @keyframes editorGlowPulseHover { 0%, 100% { box-shadow: 0 0 40px rgba(252, 211, 77, 0.6), 0 0 80px rgba(139, 92, 246, 0.5), 0 0 120px rgba(252, 211, 77, 0.4), inset 0 0 50px rgba(0, 0, 0, 0.4); } 50% { box-shadow: 0 0 60px rgba(252, 211, 77, 0.8), 0 0 120px rgba(139, 92, 246, 0.7), 0 0 180px rgba(252, 211, 77, 0.5), inset 0 0 60px rgba(0, 0, 0, 0.5); } }
        .journal-editor-container:focus-within { border-color: rgba(252, 211, 77, 1); animation: editorGlowPulseFocus 1.5s ease-in-out infinite; }
        @keyframes editorGlowPulseFocus { 0%, 100% { box-shadow: 0 0 50px rgba(252, 211, 77, 0.7), 0 0 100px rgba(139, 92, 246, 0.6), 0 0 150px rgba(252, 211, 77, 0.5), inset 0 0 60px rgba(0, 0, 0, 0.5); } 50% { box-shadow: 0 0 70px rgba(252, 211, 77, 0.9), 0 0 140px rgba(139, 92, 246, 0.8), 0 0 200px rgba(252, 211, 77, 0.6), inset 0 0 70px rgba(0, 0, 0, 0.6); } }

        /* Ensure journal entry markdown content is readable */
        .journal-entry-markdown, .journal-entry-markdown *, .journal-entry-markdown p, .journal-entry-markdown h1, .journal-entry-markdown h2, .journal-entry-markdown h3, .journal-entry-markdown h4, .journal-entry-markdown h5, .journal-entry-markdown h6, .journal-entry-markdown li, .journal-entry-markdown strong, .journal-entry-markdown em, .journal-entry-markdown code:not(pre code), .journal-entry-markdown pre, .journal-entry-markdown blockquote { color: white !important; }
        .journal-entry-markdown a { color: #60a5fa !important; }
        .journal-entry-markdown a:hover { color: #93c5fd !important; }
      `}</style>
    </div>
  )
}

export default JournalEditorPage

// Minimal inline chat viewer using existing chat APIs
function ProjectChatInline({ projectId, projectName, refreshTrigger = 0, isReviewOnly = false }: { projectId: string; projectName: string; refreshTrigger?: number; isReviewOnly?: boolean }) {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const isAdmin = userRole === 'Admin' || session?.user?.isAdmin === true
  const isReviewer = userRole === 'Reviewer'
  const canApprove = isAdmin || isReviewer
  const [messages, setMessages] = useState<Array<{ id: string; content: string; createdAt: string; hours?: number | null; approvedHours?: number | null }>>([])
  const [loading, setLoading] = useState<boolean>(true)
  const lastTsRef = useRef<string>('')
  const idsRef = useRef<Set<string>>(new Set())
  const [approvedDrafts, setApprovedDrafts] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [projectInReview, setProjectInReview] = useState<boolean>(false)
  // Load project to check review status
  useEffect(() => {
    (async () => {
      if (!projectId) return
      try {
        const res = await apiFetch(`/api/projects?projectId=${encodeURIComponent(projectId)}`)
        if (res.ok) {
          const data = await res.json()
          const project = Array.isArray(data) ? data.find((p: any) => p.projectID === projectId) : data
          if (project) {
            setProjectInReview(project.in_review || false)
          }
        }
      } catch (e) {
        console.error('Failed to load project review status:', e)
      }
    })()
  }, [projectId])
  
  useEffect(() => {
    let timer: any
    const initialLoad = async () => {
      if (!projectId) return
      setLoading(true)
      try {
        const res = await apiFetch(`/api/projects/${projectId}/chat/messages`)
        if (res.ok) {
          const data = await res.json()
          // Display newest first in the UI
          if (Array.isArray(data)) {
            const newestFirst = data.slice().reverse()
            idsRef.current = new Set(newestFirst.map((m: any) => m.id))
            setMessages(newestFirst)
          } else {
            idsRef.current = new Set()
            setMessages([])
          }
          if (Array.isArray(data) && data.length > 0) {
            lastTsRef.current = data[data.length - 1]?.createdAt || ''
          } else {
            lastTsRef.current = ''
          }
        }
      } finally { setLoading(false) }
    }
    const poll = async () => {
      if (!projectId) return
      try {
        let url = `/api/projects/${projectId}/chat/messages`
        if (lastTsRef.current) url += `?since=${encodeURIComponent(lastTsRef.current)}`
        const res = await apiFetch(url)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            // Prepend new items (so newest stays at the top). Data is oldest->newest; reverse before prepending
            const newItems = data.slice().reverse()
            setMessages(prev => {
              const existing = new Set(idsRef.current)
              const filtered = newItems.filter((m: any) => !existing.has(m.id))
              filtered.forEach((m: any) => existing.add(m.id))
              idsRef.current = existing
              return [...filtered, ...prev]
            })
            lastTsRef.current = data[data.length - 1]?.createdAt || lastTsRef.current
          }
        }
      } catch {}
    }
    // reset on project change
    setMessages([])
    lastTsRef.current = ''
    initialLoad()
    timer = setInterval(poll, 5000)
    return () => clearInterval(timer)
  }, [projectId])
  // react to explicit refresh (publish) - skip initial mount to avoid duplicate initial fetch
  useEffect(() => {
    if (!projectId) return
    if (!refreshTrigger) return
    // Try a quick poll for any new content since lastTs
    (async () => {
      try {
        let url = `/api/projects/${projectId}/chat/messages`
        if (lastTsRef.current) url += `?since=${encodeURIComponent(lastTsRef.current)}`
        const res = await apiFetch(url)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            const newItems = data.slice().reverse()
            setMessages(prev => {
              const existing = new Set(idsRef.current)
              const filtered = newItems.filter((m: any) => !existing.has(m.id))
              filtered.forEach((m: any) => existing.add(m.id))
              idsRef.current = existing
              return [...filtered, ...prev]
            })
            lastTsRef.current = data[data.length - 1]?.createdAt || lastTsRef.current
          }
        }
      } catch {}
    })()
  }, [refreshTrigger, projectId])
  
  // Handle delete journal entry
  const handleDelete = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) {
      return
    }
    
    setDeletingIds(prev => new Set(prev).add(messageId))
    try {
      const res = await apiFetch(`/api/projects/${projectId}/chat/messages?messageId=${encodeURIComponent(messageId)}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as any))
        alert(body?.error || 'Failed to delete journal entry')
        return
      }
      
      // Remove from local state
      setMessages(prev => prev.filter(m => m.id !== messageId))
      idsRef.current.delete(messageId)
    } catch (e) {
      console.error('Error deleting journal entry:', e)
      alert('Failed to delete journal entry')
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev)
        next.delete(messageId)
        return next
      })
    }
  }
  
  return (
    <div className="p-3">
      {loading ? (
        <div className="text-white/60 text-sm">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="text-white/60 text-sm">No messages yet.</div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} id={`entry-${m.id}`} className="text-sm text-white/90 scroll-mt-24">
              <div className="text-white/50 text-xs mb-1 flex items-center gap-2 flex-wrap">
                <span>{new Date(m.createdAt).toLocaleString()}</span>
                <span className="ml-2">hours</span>
                <input
                  type="text"
                  readOnly
                  value={`${m.hours ?? 0}`}
                  className="w-16 px-2 py-0.5 bg-transparent border-0 focus:ring-0 focus:outline-none text-xs text-white/80"
                />
                <span className="ml-2">approved</span>
                {canApprove ? (
                  <>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      step={0.25}
                      value={approvedDrafts[m.id] ?? (m.approvedHours ?? '')}
                      onChange={(e) => {
                        const val = e.currentTarget.value
                        setApprovedDrafts(prev => ({ ...prev, [m.id]: val }))
                        const base = m.approvedHours == null ? '' : String(m.approvedHours)
                        setDirtyIds(prev => {
                          const next = new Set(prev)
                          if (val !== base) next.add(m.id); else next.delete(m.id)
                          return next
                        })
                      }}
                      className="w-20 px-2 py-0.5 bg-white text-black border border-black/20 rounded text-xs"
                    />
                    {dirtyIds.has(m.id) && (
                      <button
                        className="ml-2 px-2 py-0.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                        disabled={savingIds.has(m.id)}
                        onClick={async () => {
                          const val = approvedDrafts[m.id]
                          setSavingIds(prev => new Set(prev).add(m.id))
                          try {
                            let justification = ''
                            try {
                              justification = window.prompt('Add a short justification for this approval change (required):', '') || ''
                            } catch {}
                            const res = await apiFetch(`/api/projects/${projectId}/chat/messages`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ messageId: m.id, approvedHours: val === '' ? null : Number(val) })
                            })
                            if (!res.ok) {
                              const body = await res.json().catch(() => ({} as any))
                              alert(body?.error || 'Failed to update approved hours')
                              return
                            }
                            const upd = await res.json()
                            setMessages(prev => prev.map(pm => pm.id === m.id ? { ...pm, approvedHours: upd.approvedHours } : pm))
                            setApprovedDrafts(prev => ({ ...prev, [m.id]: upd.approvedHours == null ? '' : String(upd.approvedHours) }))
                            setDirtyIds(prev => { const next = new Set(prev); next.delete(m.id); return next })

                            // Create a review comment noting the change
                            if (justification.trim().length > 0) {
                              const oldVal = m.approvedHours ?? 0
                              const newVal = upd.approvedHours ?? 0
                              const rawHours = m.hours ?? 0
                              
                              // Determine approval status
                              let status = 'Approved'
                              if (newVal === 0) {
                                status = 'Rejected'
                              } else if (newVal < rawHours) {
                                status = 'Partially approved'
                              }
                              
                              // Create the message with links and status
                              const journalEntryLink = `${window.location.origin}/launchpad/journal-editor/${encodeURIComponent(projectId)}?mode=review#entry-${m.id}`
                              const projectLink = `${window.location.origin}/launchpad`
                              
                              const deltaMsg = `✅ ${status}\n\n` +
                                `**Project:** [${projectName}](${projectLink})\n\n` +
                                `**Journal Entry:** [View Entry](${journalEntryLink})\n\n` +
                                `**Hours:** ${oldVal}h → ${newVal}h (${rawHours}h raw)\n\n` +
                                `**Justification:** ${justification.trim()}`
                              
                              try {
                                await apiFetch('/api/reviews', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ 
                                    projectID: projectId, 
                                    comment: deltaMsg, 
                                    reviewType: 'HoursApproval', 
                                    justification,
                                    result: newVal === 0 ? 'reject' : 'approve'
                                  })
                                })
                              } catch {}
                            }
                          } catch {
                            alert('Failed to update approved hours')
                          } finally {
                            setSavingIds(prev => { const next = new Set(prev); next.delete(m.id); return next })
                          }
                        }}
                      >
                        {savingIds.has(m.id) ? 'Saving…' : 'Apply'}
                      </button>
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    readOnly
                    value={`${m.approvedHours ?? 0}`}
                    className="w-16 px-2 py-0.5 bg-transparent border-0 focus:ring-0 focus:outline-none text-xs text-white/80"
                  />
                )}
                {/* Delete button - disabled if reviewed (for non-admins/reviewers) or if project is in review */}
                {(() => {
                  const isReviewed = m.approvedHours !== null && m.approvedHours !== undefined
                  const cannotDelete = (!canApprove && (isReviewed || projectInReview))
                  const getTooltip = () => {
                    if (isReviewed && !canApprove) {
                      return 'Cannot delete journal entries that have been reviewed. Please contact a reviewer or admin for assistance.'
                    }
                    if (projectInReview && !canApprove) {
                      return 'Cannot delete while project is in review (reviewers/admins can delete)'
                    }
                    return 'Delete this journal entry'
                  }
                  
                  return (
                    <button
                      className="ml-auto px-2 py-0.5 text-xs rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
                      disabled={deletingIds.has(m.id) || cannotDelete}
                      onClick={() => handleDelete(m.id)}
                      title={getTooltip()}
                    >
                      {deletingIds.has(m.id) ? 'Deleting…' : 'Delete'}
                    </button>
                  )
                })()}
              </div>
              <div className="journal-entry-markdown">
                <DynamicMarkdown 
                  source={m.content}
                  rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


