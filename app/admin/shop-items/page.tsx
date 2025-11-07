'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { calculateCurrencyPrice } from '@/lib/shop-utils';
import { apiFetch } from '@/lib/apiFetch';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  price: number;
  active: boolean;
  useRandomizedPricing: boolean;
  usdCost?: number;
  costType?: 'fixed' | 'config';
  config?: unknown;
  maxInventory?: number | null;
  maxPurchasesPerUser?: number | null;
  availableInventory?: number | null;  // Calculated dynamically from orders
  soldQuantity?: number;                // Total sold (from orders)
  discountPercent?: number | null;
  discountEndsAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GlobalConfig {
  dollars_per_hour?: string;
  price_random_min_percent?: string;
  price_random_max_percent?: string;
}

interface PricingConfig {
  minPercent: string;
  maxPercent: string;
}

interface ShopOrder {
  id: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const TIME_RANGES = [
  { label: '1h', value: '1h', ms: 60 * 60 * 1000 },
  { label: '24h', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7d', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: 'All Time', value: 'all', ms: null },
];

export default function ShopItemsPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({
    minPercent: '90',
    maxPercent: '110'
  });
  const [dollarsPerHour, setDollarsPerHour] = useState<string>('');
  const [isShopAdmin, setIsShopAdmin] = useState(false);
  const [isShopItemAdmin, setIsShopItemAdmin] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    image: string;
    price: string;
    usdCost: string;
    costType: 'fixed' | 'config';
    config: string;
    useRandomizedPricing: boolean;
    maxInventory: string;
    maxPurchasesPerUser: string;
  }>({
    name: '',
    description: '',
    image: '',
    price: '',
    usdCost: '',
    costType: 'fixed',
    config: '',
    useRandomizedPricing: true,
    maxInventory: '',
    maxPurchasesPerUser: '',
  });
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState(TIME_RANGES[3]);
  const [itemStats, setItemStats] = useState<Record<string, {
    unitsSold: number;
    totalRevenue: number;
    avgPrice: number;
  }>>({});

  const [discountingItem, setDiscountingItem] = useState<ShopItem | null>(null);
  const [discountForm, setDiscountForm] = useState<{ percent: string; hours: string; deadline: string }>({ percent: '', hours: '', deadline: '' });
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    fetchData();
  }, [status, session?.user?.id]);

  // Fetch shop admin status
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      apiFetch('/api/users/me')
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setIsShopAdmin(!!data.isShopAdmin);
            setIsShopItemAdmin(!!data.isShopItemAdmin);
          }
        })
        .finally(() => setAuthResolved(true));
    } else if (status === 'unauthenticated') {
      setAuthResolved(true);
    }
  }, [status, session?.user?.id]);

  // Add effect to auto-calculate price for config items
  useEffect(() => {
    if (formData.costType === 'config') {
      let configObj: Record<string, unknown> = {};
      try {
        configObj = formData.config ? JSON.parse(formData.config) : {};
      } catch {}
      const usdCost = parseFloat(formData.usdCost);
      
      if (configObj.dollars_per_hour && !isNaN(usdCost)) {

        const itemDollarsPerHour = parseFloat(configObj.dollars_per_hour as string);
        const hours = usdCost / itemDollarsPerHour; // Convert USD to hours using item's rate
        const currency = Math.round(hours * 256);
        if (formData.price !== currency.toString()) {
          setFormData((prev) => ({ ...prev, price: currency.toString() }));
        }
      }
    }
    // For other config types, do not auto-calculate
    // eslint-disable-next-line
  }, [formData.config, formData.usdCost, formData.costType]);

  // Fetch fulfilled orders for analytics
  useEffect(() => {
    async function fetchOrders() {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const res = await apiFetch('/api/admin/shop-orders?status=fulfilled');
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data = await res.json();
        setOrders(data.orders || []);
      } catch (err) {
        setAnalyticsError(err instanceof Error ? err.message : 'Failed to fetch orders');
      } finally {
        setAnalyticsLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Compute item stats for selected time range
  useEffect(() => {
    if (!orders.length || !items.length) {
      setItemStats({});
      return;
    }
    const now = Date.now();
    const rangeMs = selectedRange.ms;
    const stats: Record<string, { unitsSold: number; totalRevenue: number; avgPrice: number }> = {};
    for (const item of items) {
      stats[item.id] = { unitsSold: 0, totalRevenue: 0, avgPrice: 0 };
    }
    for (const order of orders) {
      const orderTime = new Date(order.createdAt).getTime();
      if (rangeMs && now - orderTime > rangeMs) continue;
      if (!order.itemId || !stats[order.itemId]) continue;
      stats[order.itemId].unitsSold += order.quantity;
      stats[order.itemId].totalRevenue += order.price;
    }
    for (const itemId in stats) {
      const s = stats[itemId];
      s.avgPrice = s.unitsSold > 0 ? Math.round(s.totalRevenue / s.unitsSold) : 0;
    }
    setItemStats(stats);
  }, [orders, items, selectedRange]);

  const fetchData = async () => {
    try {
      // Fetch shop items
      const itemsResponse = await apiFetch('/api/admin/shop-items');
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setItems(itemsData.items);
      }

      // Fetch global config
      const configResponse = await apiFetch('/api/admin/global-config');
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setGlobalConfig(configData.config);
        
        // Initialize pricing config state
        setPricingConfig({
          minPercent: configData.config.price_random_min_percent || '90',
          maxPercent: configData.config.price_random_max_percent || '110'
        });
        
        // Initialize dollars per hour state
        setDollarsPerHour(configData.config.dollars_per_hour || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };



  const savePricingConfig = async () => {
    try {
      setError(null);
      console.log('Saving pricing config:', pricingConfig);
      
      const oldDollarsPerHour = parseFloat(globalConfig.dollars_per_hour || '0');
      const newDollarsPerHour = parseFloat(dollarsPerHour || '0');
      
      // Update dollars per hour
      if (dollarsPerHour !== (globalConfig.dollars_per_hour || '')) {
        const dollarsResponse = await apiFetch('/api/admin/global-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'dollars_per_hour', value: dollarsPerHour }),
        });
        
        const dollarsResult = await dollarsResponse.json();
        console.log('Dollars per hour response:', dollarsResult);
        
        if (!dollarsResponse.ok) {
          throw new Error(dollarsResult.error || 'Failed to update dollars per hour');
        }
        
        // Recalculate prices for fixed items when dollars per hour changes
        if (oldDollarsPerHour !== newDollarsPerHour && newDollarsPerHour > 0) {
          console.log('Recalculating prices for fixed items...');
          
          const recalculateResponse = await apiFetch('/api/admin/shop-items/recalculate-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dollarsPerHour: newDollarsPerHour }),
          });
          
          if (!recalculateResponse.ok) {
            const recalculateResult = await recalculateResponse.json();
            console.warn('Price recalculation failed:', recalculateResult.error);
            // Don't fail the whole operation, just warn
          } else {
            const recalculateResult = await recalculateResponse.json();
            console.log('Price recalculation result:', recalculateResult);
          }
        }
      }
      
      // Update min percent
      const minResponse = await apiFetch('/api/admin/global-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'price_random_min_percent', value: pricingConfig.minPercent }),
      });
      
      const minResult = await minResponse.json();
      console.log('Min percent response:', minResult);
      
      if (!minResponse.ok) {
        throw new Error(minResult.error || 'Failed to update min percent');
      }
      
      // Update max percent
      const maxResponse = await apiFetch('/api/admin/global-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'price_random_max_percent', value: pricingConfig.maxPercent }),
      });
      
      const maxResult = await maxResponse.json();
      console.log('Max percent response:', maxResult);
      
      if (!maxResponse.ok) {
        throw new Error(maxResult.error || 'Failed to update max percent');
      }
      
      // Update the global config state to reflect the new values
      setGlobalConfig(prev => ({
        ...prev,
        dollars_per_hour: dollarsPerHour,
        price_random_min_percent: pricingConfig.minPercent,
        price_random_max_percent: pricingConfig.maxPercent
      }));
      
      console.log('Successfully saved configuration');
      setSuccessMessage('Global configuration saved successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Refresh items to show updated prices
      await fetchData();
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const config = formData.config ? JSON.parse(formData.config) : null;
      
      // Auto-calculate shell price for fixed (non-dynamic) items only
      let finalPrice = parseInt(formData.price);
      const usdCost = parseFloat(formData.usdCost);
      const dollarsPerHour = parseFloat(globalConfig.dollars_per_hour || '0');

      if (formData.costType !== 'config' && usdCost > 0 && dollarsPerHour > 0) {
        finalPrice = calculateCurrencyPrice(usdCost, dollarsPerHour);
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        image: formData.image || null,
        price: finalPrice,
        usdCost,
        costType: formData.costType,
        config,
        useRandomizedPricing: formData.useRandomizedPricing,
        maxInventory: formData.maxInventory ? parseInt(formData.maxInventory) : null,
        maxPurchasesPerUser: formData.maxPurchasesPerUser ? parseInt(formData.maxPurchasesPerUser) : null,
      };

      const url = editingItem 
        ? `/api/admin/shop-items/${editingItem.id}`
        : '/api/admin/shop-items';
      
      const method = editingItem ? 'PUT' : 'POST';

      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save item');
      }

      // Reset form and close modal
      setFormData({ name: '', description: '', image: '', price: '', usdCost: '', costType: 'fixed', config: '', useRandomizedPricing: true, maxInventory: '', maxPurchasesPerUser: '' });
      setEditingItem(null);
      setShowAddModal(false);
      
      // Refresh items
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    }
  };

  const handleEdit = (item: ShopItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      image: item.image || '',
      price: item.price.toString(),
      usdCost: item.usdCost?.toString() || '',
      costType: item.costType || 'fixed',
      config: item.config ? JSON.stringify(item.config, null, 2) : '',
      useRandomizedPricing: item.useRandomizedPricing ?? true,
      maxInventory: (item.maxInventory !== null && item.maxInventory !== undefined) ? item.maxInventory.toString() : '',
      maxPurchasesPerUser: (item.maxPurchasesPerUser !== null && item.maxPurchasesPerUser !== undefined) ? item.maxPurchasesPerUser.toString() : '',
    });
    setShowAddModal(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await apiFetch(`/api/admin/shop-items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const toggleActive = async (item: ShopItem) => {
    try {
      const response = await apiFetch(`/api/admin/shop-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          image: item.image,
          price: item.price,
          usdCost: item.usdCost,
          costType: item.costType,
          config: item.config,
          active: !item.active,
          maxInventory: item.maxInventory,
          maxPurchasesPerUser: item.maxPurchasesPerUser,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const openDiscountModal = (item: ShopItem) => {
    setDiscountingItem(item);
    const toLocalInput = (iso: string | null | undefined) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    };
    setDiscountForm({
      percent: item.discountPercent ? String(item.discountPercent) : '',
      hours: '',
      deadline: toLocalInput(item.discountEndsAt),
    });
  };

  const applyDiscount = async () => {
    if (!discountingItem) return;
    try {
      setDiscountError(null);
      const raw = discountForm.percent.trim();
      if (raw === '' || isNaN(parseInt(raw, 10))) {
        setDiscountError('Please enter a discount percent (1-99).');
        return;
      }
      const percentVal = Math.max(1, Math.min(99, parseInt(raw, 10)));
      let endsAt: string | null = null;
      if (discountForm.deadline?.trim()) {
        const d = new Date(discountForm.deadline);
        if (isNaN(d.getTime())) {
          setDiscountError('Invalid deadline. Please use a valid date and time.');
          return;
        }
        endsAt = d.toISOString();
      } else if (discountForm.hours.trim() !== '') {
        const hours = Math.max(0.1, parseFloat(discountForm.hours));
        const d = new Date(Date.now() + Math.round(hours * 60 * 60 * 1000));
        endsAt = d.toISOString();
      }

      const payload = {
        name: discountingItem.name,
        description: discountingItem.description,
        image: discountingItem.image || null,
        price: discountingItem.price,
        usdCost: discountingItem.usdCost ?? 0,
        costType: discountingItem.costType ?? 'fixed',
        config: discountingItem.config ?? null,
        active: discountingItem.active,
        useRandomizedPricing: discountingItem.useRandomizedPricing,
        maxInventory: discountingItem.maxInventory ?? null,
        maxPurchasesPerUser: discountingItem.maxPurchasesPerUser ?? null,
        discountPercent: percentVal,
        discountEndsAt: endsAt,
      };

      setDiscountSaving(true);
      const response = await apiFetch(`/api/admin/shop-items/${discountingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to apply discount');
      }

      setDiscountingItem(null);
      setDiscountForm({ percent: '', hours: '', deadline: '' });
      await fetchData();
      setSuccessMessage('Discount updated successfully');
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : 'Failed to apply discount');
    }
    finally {
      setDiscountSaving(false);
    }
  };

  const clearDiscount = async (item: ShopItem) => {
    try {
      const response = await apiFetch(`/api/admin/shop-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          description: item.description,
          image: item.image || null,
          price: item.price,
          usdCost: item.usdCost ?? 0,
          costType: item.costType ?? 'fixed',
          config: item.config ?? null,
          active: item.active,
          useRandomizedPricing: item.useRandomizedPricing,
          maxInventory: item.maxInventory ?? null,
          maxPurchasesPerUser: item.maxPurchasesPerUser ?? null,
          discountPercent: null,
          discountEndsAt: null,
        }),
      });
      if (!response.ok) throw new Error('Failed to clear discount');
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear discount');
    }
  };

  if (!authResolved) return null; // avoid flicker while resolving auth

  if (status === 'unauthenticated' || session?.user?.role !== 'Admin' || !isShopItemAdmin) {
    return <div>Access denied. Only authorized shop administrators can access this page.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Shop Items Management</h1>
        <button
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', description: '', image: '', price: '', usdCost: '', costType: 'fixed', config: '', useRandomizedPricing: true, maxInventory: '', maxPurchasesPerUser: '' });
            setShowAddModal(true);
          }}
          className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition"
        >
          Add New Item
        </button>
      </div>

      {/* Global Config Section */}
      <div className="bg-black/60 text-white shadow rounded-lg p-6 border border-white/10">
        <h2 className="text-xl font-semibold mb-4 text-white">Global Configuration</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-white">Dollars per Hour:</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={dollarsPerHour}
              onChange={(e) => setDollarsPerHour(e.target.value)}
              className="border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
              placeholder="Set global rate"
            />
            <span className="text-sm text-white/70">
              Used to auto-calculate shell prices for non-special items
            </span>
          </div>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-medium text-white mb-3">Randomized Pricing</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-white">Min Percent:</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  step="1"
                  value={pricingConfig.minPercent}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, minPercent: e.target.value })}
                  className="border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 w-20 bg-white text-black"
                  placeholder="90"
                />
                <span className="text-sm text-white/70">%</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-white">Max Percent:</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={pricingConfig.maxPercent}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, maxPercent: e.target.value })}
                  className="border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 w-20 bg-white text-black"
                  placeholder="110"
                />
                <span className="text-sm text-white/70">%</span>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-3">
              Each user gets randomized pricing hourly within this range. For example, 90-110% means 10% off to 10% more expensive.
            </p>
            <div className="flex justify-end">
              <button
                onClick={savePricingConfig}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition font-medium"
              >
                Save Global Config
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-500/40 rounded-lg p-4 text-white">
          <p className="text-white">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/30 border border-green-500/40 rounded-lg p-4 text-white">
          <p className="text-white">{successMessage}</p>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-black/60 text-white shadow rounded-lg overflow-x-auto w-full border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                USD Cost
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                Pricing Mode
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                Inventory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-white/70 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-transparent divide-y divide-white/10">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-white/5">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-10 h-10 rounded-lg object-cover mr-3"
                      />
                    )}
                    <div>
                      <div className="text-sm font-medium text-white">{item.name}</div>
                      <div className="text-sm text-white/70">{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 inline-block rounded-full border border-white/10" />
                    {item.discountPercent && (!item.discountEndsAt || new Date(item.discountEndsAt) > new Date()) ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs line-through text-white/60">{item.price}</span>
                        <span className="text-sm font-semibold text-green-300">{Math.max(0, Math.floor(item.price * (100 - item.discountPercent) / 100))}</span>
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">-{item.discountPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-sm text-white">{item.price}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-white">${item.usdCost?.toFixed(2) || '0.00'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.costType === 'config'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.costType === 'config' ? 'Special' : 'Auto-calculated'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.useRandomizedPricing
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.useRandomizedPricing ? 'Randomized' : 'Static'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.maxInventory !== null && item.maxInventory !== undefined ? (
                    <div className="flex flex-col">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        (item.availableInventory ?? 0) === 0
                          ? 'bg-red-100 text-red-800'
                          : (item.availableInventory ?? 0) < 10
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {item.availableInventory ?? 0} left of {item.maxInventory}
                      </span>
                      <span className="text-xs text-white/50 mt-1">({item.soldQuantity ?? 0} sold)</span>
                    </div>
                  ) : (
                    <span className="text-sm text-white/70">Unlimited</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`px-3 py-1 rounded text-xs ${
                        item.active
                          ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-800 hover:bg-green-200'
                      }`}
                    >
                      {item.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => openDiscountModal(item)}
                      className="px-3 py-1 rounded text-xs bg-purple-100 text-purple-800 hover:bg-purple-200"
                    >
                      Discount
                    </button>
                    <button
                      onClick={() => handleEdit(item)}
                      className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded text-xs bg-blue-50 hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-900 px-3 py-1 rounded text-xs bg-red-50 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-[95vw] sm:max-w-2xl shadow-lg rounded-md bg-black/80 text-white border-white/10">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-white mb-4">
                {editingItem ? 'Edit Shop Item' : 'Add New Shop Item'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Description</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Image URL (optional)</label>
                  <input
                    type="url"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">USD Cost (per unit)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.usdCost}
                    onChange={(e) => setFormData({ ...formData, usdCost: e.target.value })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                  />
                  <p className="text-xs text-white/70 mt-1">
                    This is the base USD price for one unit of this item. This includes manual fullfillment costs (e.g shipping).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Cost Type</label>
                  <select
                    required
                    value={formData.costType}
                    onChange={(e) => setFormData({ ...formData, costType: e.target.value as 'fixed' | 'config' })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                  >
                    <option value="fixed">Fixed</option>
                    <option value="config">Config (dynamic)</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useRandomizedPricing"
                    checked={formData.useRandomizedPricing}
                    onChange={(e) => setFormData({ ...formData, useRandomizedPricing: e.target.checked })}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useRandomizedPricing" className="text-sm font-medium text-white">
                    Use randomized pricing
                  </label>
                  <div className="ml-2">
                    <span className="text-xs text-white/70">
                      (If unchecked, item will use static price)
                    </span>
                  </div>
                </div>
                {formData.costType === 'config' && (
                  <div>
                    <label className="block text-sm font-medium text-white">Config (JSON, required for dynamic cost)</label>
                    <textarea
                      required
                      value={formData.config}
                      onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                      rows={4}
                      placeholder='{"dollars_per_hour": 10}'
                      className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 font-mono text-sm bg-white text-black"
                    />
                    <p className="text-xs text-white/70 mt-1">
                      For travel stipend: <code>{'{"dollars_per_hour": 10}'}</code> (custom hourly rate for this item)
                    </p>
                  </div>
                )}
                {formData.costType !== 'config' && formData.usdCost && globalConfig.dollars_per_hour && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Auto-calculated shell price:</strong> {calculateCurrencyPrice(parseFloat(formData.usdCost), parseFloat(globalConfig.dollars_per_hour))} currency
                      <br />
                      <span className="text-xs">Formula: (${parseFloat(formData.usdCost)} ÷ {parseFloat(globalConfig.dollars_per_hour)}) × φ × 10 = {calculateCurrencyPrice(parseFloat(formData.usdCost), parseFloat(globalConfig.dollars_per_hour))} currency</span>
                    </p>
                  </div>
                )}
                {formData.costType === 'config' && formData.config && (() => {
                  try {
                    const configObj = JSON.parse(formData.config || '{}');
                    
                    if (configObj.dollars_per_hour && formData.usdCost) {
                      const usdCost = parseFloat(formData.usdCost);
                      const itemDollarsPerHour = parseFloat(configObj.dollars_per_hour as string);
                      const hours = usdCost / itemDollarsPerHour;
                      const currency = Math.round(hours * 256);
                      return (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-sm text-green-800">
                            <strong>Auto-calculated shell price (Travel Stipend):</strong> {currency} currency
                            <br />
                            <span className="text-xs">Auto-calculated: {currency} currency</span>
                          </p>
                        </div>
                      );
                    }
                    // No other special previews
                  } catch {
                    // Invalid JSON, don't show anything
                  }
                  return null;
                })()}
                <div>
                  <label className="block text-sm font-medium text-white">Max Inventory (optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.maxInventory}
                    onChange={(e) => setFormData({ ...formData, maxInventory: e.target.value })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                    placeholder="Leave empty for unlimited"
                  />
                  <p className="text-xs text-white/70 mt-1">
                    Maximum number of this item that can be sold globally across all users. Available inventory is calculated automatically from orders. Leave empty for unlimited inventory.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Max Purchases Per User (optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.maxPurchasesPerUser}
                    onChange={(e) => setFormData({ ...formData, maxPurchasesPerUser: e.target.value })}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                    placeholder="Leave empty for unlimited"
                  />
                  <p className="text-xs text-white/70 mt-1">
                    Maximum number of this item that each individual user can purchase. Leave empty for unlimited purchases per user.
                  </p>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      setFormData({ name: '', description: '', image: '', price: '', usdCost: '', costType: 'fixed', config: '', useRandomizedPricing: true, maxInventory: '', maxPurchasesPerUser: '' });
                    }}
                    className="px-4 py-2 border border-white/20 rounded-md text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                  >
                    {editingItem ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Discount Modal */}
      {discountingItem && (
        <div className="fixed inset-0 bg-black/70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-24 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-black/80 text-white border-white/10">
            <div className="mt-2">
              <h3 className="text-lg font-medium text-white mb-4">Set Discount for {discountingItem.name}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white">Discount Percent</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={discountForm.percent}
                      onChange={(e) => setDiscountForm({ ...discountForm, percent: e.target.value })}
                      className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                      placeholder="e.g. 10 for 10%"
                    />
                    <span className="text-sm">%</span>
                  </div>
                  {discountError && <p className="text-xs text-red-300 mt-1">{discountError}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Time Limit (hours, optional)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={discountForm.hours}
                    onChange={(e) => setDiscountForm({ ...discountForm, hours: e.target.value, deadline: '' })}
                    disabled={!!discountForm.deadline?.trim()}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                    placeholder="e.g. 0.5 for 30 minutes (leave empty for none)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white">Deadline (optional)</label>
                  <input
                    type="datetime-local"
                    value={discountForm.deadline}
                    onChange={(e) => setDiscountForm({ ...discountForm, deadline: e.target.value, hours: '' })}
                    disabled={!!discountForm.hours?.trim()}
                    className="mt-1 block w-full border border-white/20 rounded-md px-3 py-2 focus:outline-none focus:ring-orange-500 focus:border-orange-500 bg-white text-black"
                    placeholder="Pick a date and time"
                  />
                  <p className="text-xs text-white/60 mt-1">If set, this exact time will be used instead of hours.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => { setDiscountingItem(null); setDiscountForm({ percent: '', hours: '', deadline: '' }); }}
                    className="px-4 py-2 border border-white/20 rounded-md text-white hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  {discountingItem?.discountPercent ? (
                    <button
                      onClick={() => discountingItem && clearDiscount(discountingItem)}
                      className="px-4 py-2 border border-white/20 rounded-md text-white hover:bg-white/10"
                    >
                      Clear discount
                    </button>
                  ) : null}
                  <button
                    onClick={applyDiscount}
                    disabled={discountSaving}
                    className={`px-4 py-2 rounded-md text-white ${discountSaving ? 'bg-purple-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {discountSaving ? 'Saving…' : 'Save Discount'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
