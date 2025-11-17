'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Summary = {
  total: number;
  byTag: Record<'v1' | 'v2' | 'v3' | 'v4' | 'v5', number>;
};

const LABELS: Record<keyof Summary['byTag'], string> = {
  v1: 'Florida + shop',
  v2: 'Florida',
  v3: 'Shop',
  v4: 'Watching',
  v5: 'Not sure',
};

export default function ParticipationDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/admin/poll/summary', { cache: 'no-store' });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Failed to load summary');
        }
        const data = (await res.json()) as Summary;
        if (!cancelled) setSummary(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData =
    summary
      ? (Object.entries(summary.byTag) as Array<[keyof Summary['byTag'], number]>).map(([key, value]) => ({
          key,
          label: LABELS[key],
          value,
        }))
      : [];

  return (
    <div className="p-8 text-black">
      <h1 className="text-2xl font-bold mb-6">Participation rate</h1>

      {loading && <div className="text-gray-600">Loading...</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {summary && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Totals list */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-4">Totals</h2>
            <ul className="space-y-3">
              {Object.entries(summary.byTag).map(([key, val]) => (
                <li key={key} className="flex justify-between border-b last:border-none pb-2">
                  <span className="font-medium">{LABELS[key as keyof Summary['byTag']]} <span className="text-xs text-gray-500">[{key}]</span></span>
                  <span className="tabular-nums">{val}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-sm text-gray-600">
              Total votes: <span className="font-semibold">{summary.total}</span>
            </div>
          </div>

          {/* Small graph */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-4">Distribution</h2>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


