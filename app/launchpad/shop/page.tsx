'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/apiFetch';
import { AppConfig } from '@/lib/config';
import styles from './shop.module.css';

interface ShopItem {
  id: string;
  name: string;
  description: string;
  image?: string;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number | null;
  discountEndsAt?: string | null;
  availableInventory?: number | null;
  userHasPurchased?: boolean;
  maxPurchasesPerUser?: number | null;
  userRemainingAllowance?: number | null;
}

interface ShellBalance {
  currency: number;
  earnedcurrency: number;
  totalSpent: number;
  availablecurrency: number;
}

export default function ShopPage() {
  const { status, data: session } = useSession();
  const authReady = status === 'authenticated' && !!session?.user?.id;
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usercurrency, setUsercurrency] = useState<ShellBalance | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [nowTs, setNowTs] = useState<number>(Date.now());

  useEffect(() => {
    const fetchData = async () => {
      if (status !== 'authenticated' || !session?.user?.id) {
        if (status !== 'loading') setLoading(false);
        return;
      }
      try {
        // Fetch shop items
        const itemsResponse = await apiFetch('/api/launchpad/shop/items');
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData.items);
        }

        // Fetch user currency
        const currencyResponse = await apiFetch('/api/users/me/currency');
        if (currencyResponse.ok) {
          const currencyData = await currencyResponse.json();
          setUsercurrency(currencyData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [status, session?.user?.id]);

  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handlePurchase = async () => {
    if (!selectedItem) return;
    if (!authReady) {
      setError('Please sign in again and try your purchase.');
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const response = await apiFetch('/api/launchpad/shop/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Purchase failed');
      }

      // Close modal and show success
      setSelectedItem(null);
      setQuantity(1);
      
      // Show success message
      setSuccessMessage(`Successfully purchased ${quantity}x ${selectedItem.name}!`);
      setShowSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setSuccessMessage('');
      }, 3000);
      
      // Refresh shell balance only if session is still valid
      if (authReady) {
        const currencyResponse = await apiFetch('/api/users/me/currency');
        if (currencyResponse.ok) {
          const currencyData = await currencyResponse.json();
          setUsercurrency(currencyData);
        }

        // Refresh items to update availability counters
        const itemsResponse = await apiFetch('/api/launchpad/shop/items');
        if (itemsResponse.ok) {
          const itemsData = await itemsResponse.json();
          setItems(itemsData.items);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setIsPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${styles.stardustBackground} flex items-center justify-center`}>
        <div className="text-center">
          <div className={`${styles.stardustSpinner} h-16 w-16 mx-auto mb-4`}></div>
          <h2 className="text-xl font-semibold text-white">Loading the Stardust Shop</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${styles.stardustBackground} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-4">Error: {error}</h2>
          <button 
            onClick={() => window.location.reload()} 
            className={`${styles.stardustBuyButton} px-6 py-2`}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const featuredItem = items.find((i) => i.name && i.name.trim() === 'Moonshot Ticket') || null;
  const otherItems = featuredItem ? items.filter((i) => i.id !== featuredItem.id) : items;

  const renderCountdown = (item: ShopItem) => {
    if (!item.discountEndsAt) return null;
    const end = new Date(item.discountEndsAt).getTime();
    const remaining = end - nowTs;
    if (remaining <= 0) return null;
    const s = Math.floor(remaining / 1000);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return (
      <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-200 border border-yellow-500/30">
        Ends in {hrs}h {mins}m {secs}s
      </span>
    );
  };

  return (
    <div className={`${styles.stardustBackground} pt-24`} style={{ minHeight: '100vh' }}>
      {/* Cosmic Background */}
      <div className={styles.stellarBackground} aria-hidden="true">
        <div className={styles.nebulaLayer}></div>
        <div className={styles.starfieldLayer}></div>
        <div className={styles.shootingStars}></div>
      </div>

      {/* HACK CLUB banner in top left corner */}
      <img 
        src="/HC.png" 
        alt="HACK CLUB" 
        className={styles.hackClubBanner}
      />
      
      {/* Legacy starfield background - keeping for compatibility */}
      <div className={styles.stardustStarfield}></div>
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className={`${styles.stardustToast} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
            <span className="text-xl">✨</span>
            <span className="font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className={`${styles.stardustHeader} relative z-10`}>
        <div className="text-center">
          <h1 className={styles.stardustTitle}>
            <img 
              src="/stardust-bag.png" 
              alt="Stardust Bag" 
              className={styles.stardustTitleCat}
            />
            <img 
              src="/shop_title.png" 
              alt="Stardust Shop" 
              className={styles.stardustTitleImage}
            />
          </h1>
          <div className={styles.stardustSubtitle}>
            <img 
              src="/shop_subtitle.png" 
              alt="Use your project hours to redeem very cool stuff. enjoy :)" 
              className={styles.stardustSubtitleImage}
            />
          </div>
          
          {/* Shop Opening Soon Warning */}
          {items.length === 0 && (
            <div className={`${styles.stardustWarning} mb-6 max-w-2xl mx-auto`}>
              <div className="flex items-center justify-center gap-3">
                <span className="text-purple-300 text-2xl">⚠️</span>
                <div className="text-center">
                  <h3 className="text-purple-200 font-bold text-lg mb-1">Shop Opening Soon!</h3>
                  <p className="text-purple-300 text-sm">
                    The Stardust Shop is currently under construction. Check back soon for amazing rewards!
                  </p>
                </div>
                <span className="text-purple-300 text-2xl">⚠️</span>
              </div>
            </div>
          )}
          
          {/* Stardust Balance Display */}
          {usercurrency !== null && (
            <div className={styles.stardustCurrency}>
              <img 
                src="/stardust.png" 
                alt="Stardust" 
                className="w-6 h-6"
              />
              <span className="text-xl font-bold">{usercurrency.currency}</span>
              <span className="ml-2 font-medium">available</span>
            </div>
          )}
        </div>
      </div>

      {/* Featured Item */}
      {featuredItem && (
        <div className="px-4 mb-6">
          <div
            className={`${styles.stardustCard} ${featuredItem.originalPrice ? styles.discountedGlow : ''} ${featuredItem.name && featuredItem.name.trim() === 'Moonshot Ticket' ? styles.glowMoonshotTicket : ''} mx-auto max-w-sm`}
          >
            {/* Item Image */}
            <div className={styles.stardustImageContainer}>
              {featuredItem.image ? (
                <img
                  src={featuredItem.image}
                  alt={featuredItem.name}
                  className="object-contain w-full h-28"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">✨</span>
                </div>
              )}
              {/* Countdown overlay */}
              {featuredItem.discountEndsAt && featuredItem.originalPrice ? (
                <div className={styles.countdownBadge}>{renderCountdown(featuredItem)}</div>
              ) : null}
            </div>

            {/* Item Content */}
            <div>
              <h3 className={styles.stardustItemTitle}>{featuredItem.name}</h3>
              <p className={styles.stardustItemDescription}>{featuredItem.description}</p>
              
              {/* Price and Availability */}
              <div className="flex items-center justify-between mb-4">
                <div className={styles.stardustPrice}>
                  <img 
                    src="/stardust.png" 
                    alt="Stardust" 
                    className="w-5 h-5"
                  />
                  {featuredItem.originalPrice ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm line-through text-white/60">{featuredItem.originalPrice}</span>
                      <span className="font-semibold text-green-300">{featuredItem.price}</span>
                      {featuredItem.discountPercent ? (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">-{featuredItem.discountPercent}%</span>
                      ) : null}
                    </div>
                  ) : (
                    <span>{featuredItem.price}</span>
                  )}
                </div>
                
                {/* Check if user can afford */}
                {usercurrency !== null && !(featuredItem.name && featuredItem.name.trim() === 'Moonshot Ticket' && featuredItem.userHasPurchased) && (
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    usercurrency.currency >= featuredItem.price 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {usercurrency.currency >= featuredItem.price ? 'Can afford' : 'Not enough stardust'}
                  </div>
                )}
              </div>

              {typeof featuredItem.availableInventory === 'number' && (
                <div
                  className={`${styles.stardustAvailability} ${styles.stardustAvailabilityFeatured} ${featuredItem.availableInventory <= 0 ? styles.soldOut : ''} mb-4`}
                >
                  <span className={styles.stardustAvailabilityIcon}>🎟️</span>
                  <span className={styles.stardustAvailabilityLabel}>Remaining</span>
                  <span className={styles.stardustAvailabilityCount}>{Math.max(0, featuredItem.availableInventory)}</span>
                </div>
              )}

              {/* Buy Button */}
              {featuredItem.name && featuredItem.name.trim() === 'Moonshot Ticket' && featuredItem.userHasPurchased ? (
                <button
                  disabled={true}
                  className={styles.stardustInvitedButton}
                >
                  You're invited!
                </button>
              ) : (
                <button
                  onClick={() => setSelectedItem(featuredItem)}
                  disabled={(usercurrency !== null && usercurrency.currency < featuredItem.price) || (typeof featuredItem.availableInventory === 'number' && featuredItem.availableInventory <= 0)}
                  className={`${styles.stardustBuyButton} ${
                    (usercurrency !== null && usercurrency.currency < featuredItem.price) || (typeof featuredItem.availableInventory === 'number' && featuredItem.availableInventory <= 0)
                      ? 'opacity-50 cursor-not-allowed'
                      : ''
                  }`}
                >
                  {typeof featuredItem.availableInventory === 'number' && featuredItem.availableInventory <= 0
                    ? 'Sold out'
                    : (usercurrency !== null && usercurrency.currency < featuredItem.price ? 'Not enough stardust' : 'Buy Now')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shop Items */}
      <div className={styles.stardustGrid}>
        {otherItems.sort((a, b) => a.price - b.price).map((item) => (
          <div
            key={item.id}
            className={`${styles.stardustCard} ${item.originalPrice ? styles.discountedGlow : ''} ${item.name && item.name.trim() === 'Moonshot Ticket' ? styles.glowMoonshotTicket : ''}`}
          >
            {/* Item Image */}
            <div className={styles.stardustImageContainer}>
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="object-contain w-full h-32"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-purple-200 to-blue-200 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">✨</span>
                </div>
              )}
              {/* Countdown overlay */}
              {item.discountEndsAt && item.originalPrice ? (
                <div className={styles.countdownBadge}>{renderCountdown(item)}</div>
              ) : null}
            </div>

            {/* Item Content */}
            <div>
              <h3 className={styles.stardustItemTitle}>{item.name}</h3>
              <p className={styles.stardustItemDescription}>{item.description}</p>
              
              {/* Price and Availability */}
              <div className="flex items-center justify-between mb-2">
                <div className={styles.stardustPrice}>
                  <img 
                    src="/stardust.png" 
                    alt="Stardust" 
                    className="w-5 h-5"
                  />
                  {item.originalPrice ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm line-through text-white/60">{item.originalPrice}</span>
                      <span className="font-semibold text-green-300">{item.price}</span>
                      {item.discountPercent ? (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">-{item.discountPercent}%</span>
                      ) : null}
                    </div>
                  ) : (
                    <span>{item.price}</span>
                  )}
                </div>
                
                {/* Check if user can afford */}
                {usercurrency !== null && (
                  <div className={`text-sm px-2 py-1 rounded-full ${
                    usercurrency.currency >= item.price 
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                      : 'bg-red-500/20 text-red-300 border border-red-500/30'
                  }`}>
                    {usercurrency.currency >= item.price ? 'Can afford' : 'Not enough stardust'}
                  </div>
                )}
              </div>

              {typeof item.availableInventory === 'number' && (
                <div
                  className={`${styles.stardustAvailability} ${item.availableInventory <= 0 ? styles.soldOut : ''} mb-4`}
                >
                  <span className={styles.stardustAvailabilityIcon}>🎟️</span>
                  <span className={styles.stardustAvailabilityLabel}>Remaining</span>
                  <span className={styles.stardustAvailabilityCount}>{Math.max(0, item.availableInventory)}</span>
                </div>
              )}

              {/* Per-user remaining allowance (non-ticket items only) */}
              {item.name && item.name.trim() !== 'Moonshot Ticket' && typeof item.maxPurchasesPerUser === 'number' && (
                <div className={`${styles.stardustLimit} mb-4`}>
                  <span className={styles.stardustLimitLabel}>You can buy</span>
                  <span className={styles.stardustLimitCount}>{Math.max(0, Number(item.userRemainingAllowance ?? 0))}</span>
                </div>
              )}

              {/* Buy Button */}
              <button
                onClick={() => setSelectedItem(item)}
                disabled={(usercurrency !== null && usercurrency.currency < item.price) || (typeof item.availableInventory === 'number' && item.availableInventory <= 0)}
                className={`${styles.stardustBuyButton} ${
                  (usercurrency !== null && usercurrency.currency < item.price) || (typeof item.availableInventory === 'number' && item.availableInventory <= 0)
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {typeof item.availableInventory === 'number' && item.availableInventory <= 0
                  ? 'Sold out'
                  : (usercurrency !== null && usercurrency.currency < item.price ? 'Not enough stardust' : 'Buy Now')}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Confirmation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`${styles.stardustModal} ${/request/i.test(selectedItem.name) ? 'max-w-3xl' : 'max-w-md'} w-full p-6 shadow-2xl transform transition-all`}>
            <div className={/request/i.test(selectedItem.name) ? 'grid md:grid-cols-2 gap-6 items-start' : ''}>
              {/request/i.test(selectedItem.name) && (
                <div className={`${styles.requestInfoBox} hidden md:block`}>
                  <div className={styles.requestInfoCloud}></div>
                  <div className={styles.requestInfoContent}>
                    <h3 className={styles.requestInfoTitle}>How does it work?</h3>
                    <p className={styles.requestInfoText}>
                      For now, you don’t need to fill out any form — just buy this item, and Emma will reach out to you on Slack!
                    </p>
                    <p className={styles.requestInfoNote}>
                      (It might take a bit, so please be patient!)
                    </p>
                    <div className={styles.requestInfoDivider}></div>
                    <h4 className={styles.requestInfoSubtitle}>Note</h4>
                    <p className={styles.requestInfoText}>
                      Don’t DM her directly. If you do, you’ll lose this prize.
                    </p>
                    <p className={styles.requestInfoText}>
                      Instead, ping her in <strong>#moonshot-help</strong> if you haven’t received a message within 3 business days.
                    </p>
                    <div className={styles.requestInfoDivider}></div>
                    <h3 className={styles.requestInfoTitle}>What can I ask for?</h3>
                    <p className={styles.requestInfoText}>Anything that:</p>
                    <ul className={styles.requestInfoList}>
                      <li>• You can find on Amazon</li>
                      <li>• Isn’t offensive, inappropriate or illegal</li>
                    </ul>
                    <p className={styles.requestInfoText}>
                      Just remember that buying this item doesn’t guarantee it’ll be added, but if you followed all the steps above, it’s almost certain!
                    </p>
                  </div>
                </div>
              )}
              <div>
                <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">✨ Confirm Purchase ✨</h2>
              <p className="text-white/80 mb-3">
                Are you sure you want to purchase <strong className="text-purple-300">{selectedItem.name}</strong>?
              </p>
              <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 text-left">
                <h4 className="font-medium text-purple-300 mb-2">Item Description:</h4>
                <p className="text-white/80 text-sm">{selectedItem.description}</p>
              </div>
                </div>
            
                <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <span className="text-yellow-300 text-lg mr-2">⚠️</span>
                    <p className="text-yellow-200 text-sm">
                      This is a one-way operation. Your stardust will be deducted immediately.
                    </p>
                  </div>
                </div>
            
                <div className="mb-6">
                  <label className="block text-sm font-medium text-white/90 mb-2">Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    max={`${typeof selectedItem.availableInventory === 'number' ? Math.max(1, selectedItem.availableInventory) : 1000}`}
                    value={quantity}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value) || 1;
                      const maxAllowed = typeof selectedItem.availableInventory === 'number' 
                        ? Math.max(1, selectedItem.availableInventory)
                        : 1000;
                      setQuantity(Math.max(1, Math.min(maxAllowed, parsed)));
                    }}
                    className="w-full p-3 bg-white/10 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-white/50"
                    placeholder="Enter quantity"
                  />
                </div>

                <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">Total:</span>
                    <div className="flex items-center">
                      <img 
                        src="/stardust.png" 
                        alt="Stardust" 
                        className="w-5 h-5 mr-1"
                      />
                      <span className="text-xl font-bold text-purple-300">{selectedItem.price * quantity}</span>
                      <span className="text-white/70 ml-1">stardust</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setQuantity(1);
                      setError(null);
                    }}
                    className="flex-1 py-3 px-4 border border-white/30 rounded-lg text-white hover:bg-white/10 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePurchase}
                    disabled={isPurchasing || !authReady}
                    className={`flex-1 py-3 px-4 rounded-lg font-semibold text-white transition ${
                      isPurchasing || !authReady
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : styles.stardustBuyButton
                    }`}
                  >
                    {isPurchasing ? 'Processing...' : (!authReady ? 'Sign in required' : '✨ Confirm Purchase ✨')}
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
