'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
import LoadingOverlay from '@/components/common/LoadingOverlay'
import AccessDenied from '@/components/common/AccessDenied'
import { useSession } from 'next-auth/react'
import { apiFetch } from '@/lib/apiFetch'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })
const DynamicMarkdown = dynamic(() => import('@uiw/react-markdown-preview'), { ssr: false })

function JournalEditorPage() {
  const { data: session, status } = useSession()
  const [content, setContent] = useState<string>('')
  const searchParams = useSearchParams()
  const initialProjectId = searchParams.get('projectId') || ''
  const modeParam = searchParams.get('mode') || ''
  const isReviewOnly = modeParam === 'review'
  const [projectId, setProjectId] = useState<string>(initialProjectId)
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
          if (!initialProjectId && Array.isArray(data) && data.length > 0) {
            setProjectId(data[0].projectID)
          }
        } else {
          setProjects([])
        }
      } finally {
        setIsLoadingProjects(false)
      }
    })()
  }, [status, initialProjectId])

  if (status === 'loading') return <LoadingOverlay />
  if (status === 'unauthenticated') return <AccessDenied />

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="journal-font-sans max-w-4xl mx-auto px-4 pt-28 md:pt-32 pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Journal Editor</h1>
          <Link
            href="/launchpad"
            className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Back to Launchpad
          </Link>
        </div>

        {/* Hours worked at the top */}
        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div className="mb-4">
          <label className="block text-sm text-white/80 mb-1">Hours worked</label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            placeholder="e.g. 1.5"
            className="w-20 px-3 py-2 bg-white text-black placeholder:text-black/50 border border-black/20 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          <div className="mt-1 text-xs text-white/60">Enter a positive number; partial hours allowed (e.g., 0.5).</div>
        </div>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div
          ref={containerRef}
          className={`relative ${isDragging ? 'ring-2 ring-blue-500' : ''}`}
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
            previewOptions={{ remarkPlugins: [remarkGfm] }}
          />
        </div>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
          <>
            <h4 className="mt-6 text-sm font-semibold text-white/80">Markdown preview</h4>
            <div className="mt-2 bg-black/60 border border-white/10 rounded-lg p-4 prose prose-invert max-w-none" data-color-mode="dark">
              <DynamicMarkdown source={content} />
            </div>
          </>
        )}

        {!(isReviewOnly || (projects.find(p => p.projectID === projectId)?.in_review)) && (
        <div className="mt-4 flex items-center gap-3">
          <button
              className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <ProjectChatInline projectId={projectId} refreshTrigger={publishTick} isReviewOnly={isReviewOnly} />
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
      {/* Scoped font overrides for markdown/editor for better readability */}
      <style jsx global>{`
        /* Override site's decorative font inside the journal editor */
        .journal-font-sans,
        .journal-font-sans *,
        .journal-font-sans .w-md-editor,
        .journal-font-sans .w-md-editor *,
        .journal-font-sans .wmde-markdown,
        .journal-font-sans .wmde-markdown * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important;
          line-height: 1.6;
        }
        /* Ensure typing/cursor metrics are correct in text inputs */
        .journal-font-sans textarea,
        .journal-font-sans .w-md-editor-text-input {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif !important;
        }
        /* Monospace for inline and block code */
        .journal-font-sans code,
        .journal-font-sans pre,
        .journal-font-sans .wmde-markdown code,
        .journal-font-sans .wmde-markdown pre {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace !important;
        }
        .journal-video { width: 100%; height: auto; display: block; background: #000; border-radius: 8px; }
        /* Ensure markdown preview uses dark background */
        .journal-font-sans .wmde-markdown { background-color: transparent !important; }
      `}</style>
    </div>
  )
}

export default function JournalEditorPageWrapper() {
  return (
    <Suspense fallback={<div />}> 
      <JournalEditorPage />
    </Suspense>
  )
}

// Minimal inline chat viewer using existing chat APIs
function ProjectChatInline({ projectId, refreshTrigger = 0, isReviewOnly = false }: { projectId: string; refreshTrigger?: number; isReviewOnly?: boolean }) {
  const { data: session } = useSession()
  const userRole = session?.user?.role
  const canApprove = userRole === 'Admin' || userRole === 'Reviewer'
  const [messages, setMessages] = useState<Array<{ id: string; content: string; createdAt: string; hours?: number | null; approvedHours?: number | null }>>([])
  const [loading, setLoading] = useState<boolean>(true)
  const lastTsRef = useRef<string>('')
  const idsRef = useRef<Set<string>>(new Set())
  const [approvedDrafts, setApprovedDrafts] = useState<Record<string, string>>({})
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
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
  return (
    <div className="p-3">
      {loading ? (
        <div className="text-white/60 text-sm">Loading…</div>
      ) : messages.length === 0 ? (
        <div className="text-white/60 text-sm">No messages yet.</div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className="text-sm text-white/90">
              <div className="text-white/50 text-xs mb-1 flex items-center gap-2">
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
                              const deltaMsg = `Reviewer adjusted approved journal hours: ${oldVal}h → ${newVal}h. Justification: ${justification.trim()}`
                              try {
                                await apiFetch('/api/reviews', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ projectID: projectId, comment: deltaMsg, reviewType: 'HoursApproval', justification })
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
              </div>
              <DynamicMarkdown source={m.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


