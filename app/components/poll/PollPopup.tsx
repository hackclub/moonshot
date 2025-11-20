'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/common/Modal';

type PollOption = {
  id: 'v1' | 'v2' | 'v3' | 'v4' | 'v5';
  label: string;
};

const OPTIONS: PollOption[] = [
  { id: 'v1', label: 'Attend the event in Florida + purchase from the shop 🚀🛍️' },
  { id: 'v2', label: 'Attend only the event in Florida 🚀' },
  { id: 'v3', label: 'Only purchase from the shop 🛍️' },
  { id: 'v4', label: "I'm here for the popcorn (just watching, doing nothing)🍿" },
  { id: 'v5', label: "I'm not sure yet ❓" },
];

export default function PollPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<PollOption['id'] | null>(null);

  const question = useMemo(() => "What’s your goal with Moonshot?", []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/poll/status', { cache: 'no-store' });
        if (res.status === 401) {
          // Not logged in; do not show the poll
          if (!cancelled) setIsOpen(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) setIsOpen(Boolean(data?.needsVote));
      } catch (e) {
        // Fail-safe: do not show if tags cannot be checked
        if (!cancelled) setIsOpen(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch('/api/poll/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: selected }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Failed to submit vote');
      }
      setIsOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => null}
      hideFooter
      hideCloseButton
      frameless
    >
      <div className="relative">
        {/* Decorative background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-40"
          style={{
            backgroundImage:
              "url('/star-tile.webp')",
            backgroundSize: '300px 300px',
            backgroundRepeat: 'repeat',
            maskImage:
              'radial-gradient(120% 120% at 50% 0%, black 55%, transparent 80%)',
            WebkitMaskImage:
              'radial-gradient(120% 120% at 50% 0%, black 55%, transparent 80%)',
          }}
        />
        {/* Soft glow */}
        <div aria-hidden="true" className="absolute -top-10 left-1/2 -translate-x-1/2 h-32 w-72 rounded-full blur-3xl bg-indigo-500/20" />

        {/* Gradient border card */}
        <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-indigo-500/40 via-fuchsia-500/30 to-amber-400/40">
          <div className="rounded-3xl bg-black/80 backdrop-blur-sm p-5 sm:p-6">
            {/* Header (single title, Modal header disabled via frameless) */}
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/universal-orph-sticker.webp"
                alt="Moonshot"
                className="h-20 sm:h-24 w-auto object-contain animate-pulse"
              />
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold leading-tight">
                  {question}
                </h3>
                <div className="mt-1 text-sm text-white/70">
                  Pick one. This helps tailor your experience.
                </div>
              </div>
              
            </div>

            {/* Options */}
            <div
              role="group"
              aria-labelledby="poll-question"
              className="flex flex-col gap-3"
            >
              {OPTIONS.map((opt) => {
                const checked = selected === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`group relative flex items-start gap-3 cursor-pointer rounded-2xl border px-4 py-3 transition-all duration-300
                      ${checked ? 'border-indigo-400/60 bg-indigo-500/10 shadow-lg shadow-indigo-900/30' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-lg'}
                    `}
                  >
                    <input
                      type="radio"
                      name="moonshot-poll"
                      value={opt.id}
                      checked={checked}
                      onChange={() => setSelected(opt.id)}
                      className="mt-1 accent-indigo-500"
                      aria-label={opt.label}
                    />
                    <div className="flex flex-col">
                      <span className={`text-base leading-relaxed ${checked ? 'text-white' : 'text-white'}`}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-white/60">
                        Single choice
                      </span>
                    </div>
                    {/* Right-side glow indicator */}
                    <div
                      aria-hidden="true"
                      className={`ml-auto h-2 w-2 rounded-full self-center transition-colors duration-300 ${checked ? 'bg-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.9)]' : 'bg-white/30'}`}
                    />
                  </label>
                );
              })}
            </div>

            {/* Error */}
            {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}

            {/* Submit */}
            <div className="mt-5">
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className={`inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-rose-600
                  text-white px-6 py-2 text-lg font-semibold transition-all duration-200
                  hover:brightness-110 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}


