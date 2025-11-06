'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/apiFetch';

type ShopOrder = {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  status: string;
  createdAt: string;
};

export default function PurchaseHistoryPage() {
  const { status, data: session } = useSession();
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await apiFetch('/api/users/me/shop-orders');
        if (!response.ok) {
          if (response.status === 401) {
            setOrders([]);
            return;
          }
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to fetch orders');
        }
        const data = await response.json();
        setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated' && session?.user?.id) {
      fetchOrders();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [status, session?.user?.id]);

  const grouped = useMemo(() => {
    const byStatus: Record<string, ShopOrder[]> = { fulfilled: [], pending: [], rejected: [], refunded: [], other: [] };
    for (const o of orders) {
      const key = (o.status || '').toLowerCase();
      if (key in byStatus) {
        byStatus[key].push(o);
      } else {
        byStatus.other.push(o);
      }
    }
    return byStatus;
  }, [orders]);

  const totalSpent = useMemo(() => {
    if (!orders || orders.length === 0) return 0;
    return orders
      .filter((o) => {
        const s = (o.status || '').toLowerCase();
        return s !== 'refunded' && s !== 'rejected';
      })
      .reduce((sum, o) => sum + (o.price || 0) * (o.quantity || 0), 0);
  }, [orders]);

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading your purchase history…</h2>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center text-white">
        <div className="text-center max-w-md px-6">
          <h2 className="text-2xl font-bold mb-2">Purchase History</h2>
          <p className="text-white/80">Please sign in to view your orders.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-white" style={{ minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Purchase History</h1>
          <p className="text-white/70 mt-1">All your shop purchases in one place.</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <div className="inline-flex items-center gap-3 bg-white/10 border border-white/20 rounded-lg px-4 py-3">
            <img src="/stardust.png" alt="Stardust" className="w-6 h-6" />
            <div>
              <div className="text-xs uppercase tracking-wide text-white/60">Total Stardust Spent</div>
              <div className="text-xl font-bold tabular-nums">{totalSpent}</div>
            </div>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white/10 border border-white/20 rounded-lg p-6 text-center">
            <p className="text-white/80">No purchases yet. Visit the shop to get started!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(['pending', 'fulfilled', 'refunded', 'rejected', 'other'] as const).map((section) => {
              const list = grouped[section];
              if (!list || list.length === 0) return null;
              const sectionTitle = section.charAt(0).toUpperCase() + section.slice(1);
              const chipClasses =
                section === 'fulfilled'
                  ? 'bg-green-500/20 text-green-200 border-green-500/30'
                  : section === 'pending'
                  ? 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30'
                  : section === 'refunded'
                  ? 'bg-blue-500/20 text-blue-200 border-blue-500/30'
                  : section === 'rejected'
                  ? 'bg-red-500/20 text-red-200 border-red-500/30'
                  : 'bg-white/10 text-white/70 border-white/20';

              return (
                <div key={section}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-xl font-semibold">{sectionTitle}</h2>
                    <span className={`text-xs px-2 py-1 rounded-full border ${chipClasses}`}>{list.length}</span>
                  </div>
                  <div className="divide-y divide-white/10 rounded-lg overflow-hidden border border-white/10 bg-black/20">
                    {list.map((order) => {
                      const date = new Date(order.createdAt);
                      return (
                        <div key={order.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{order.itemName}</div>
                            <div className="text-sm text-white/70">Qty: {order.quantity} • <span className="inline-flex items-center"><img src="/stardust.png" alt="Stardust" className="w-4 h-4 mr-1" />{order.price}</span></div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                            <span className={`text-xs px-2 py-1 rounded-full border ${chipClasses}`}>{sectionTitle}</span>
                            <div className="text-xs text-white/60 whitespace-nowrap">{date.toLocaleString()}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


