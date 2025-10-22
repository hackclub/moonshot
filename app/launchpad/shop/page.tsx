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
  
}

interface ShellBalance {
  currency: number;
  earnedcurrency: number;
  totalSpent: number;
  availablecurrency: number;
}

export default function ShopPage() {
  const { status } = useSession();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usercurrency, setUsercurrency] = useState<ShellBalance | null>(null);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (status !== 'authenticated') {
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
  }, [status]);

  const handlePurchase = async () => {
    if (!selectedItem) return;
    if (status !== 'authenticated') return;

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
      
      // Refresh shell balance
      const currencyResponse = await apiFetch('/api/users/me/currency');
      if (currencyResponse.ok) {
        const currencyData = await currencyResponse.json();
        setUsercurrency(currencyData);
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

  return (
    <div className={`${styles.stardustBackground} pt-24`} style={{ minHeight: '100vh' }}>
      {/* HACK CLUB banner in top left corner */}
      <img 
        src="/HC.png" 
        alt="HACK CLUB" 
        className={styles.hackClubBanner}
      />
      
      {/* Animated starfield background */}
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

      {/* Shop Items */}
      <div className={styles.stardustGrid}>
        {items.sort((a, b) => a.price - b.price).map((item) => (
          <div
            key={item.id}
            className={styles.stardustCard}
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
            </div>

            {/* Item Content */}
            <div>
              <h3 className={styles.stardustItemTitle}>{item.name}</h3>
              <p className={styles.stardustItemDescription}>{item.description}</p>
              
              {/* Price */}
              <div className="flex items-center justify-between mb-4">
                <div className={styles.stardustPrice}>
                  <img 
                    src="/stardust.png" 
                    alt="Stardust" 
                    className="w-5 h-5"
                  />
                  <span>{item.price}</span>
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

              {/* Buy Button */}
              <button
                onClick={() => setSelectedItem(item)}
                disabled={usercurrency !== null && usercurrency.currency < item.price}
                className={`${styles.stardustBuyButton} ${
                  usercurrency !== null && usercurrency.currency < item.price
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                {usercurrency !== null && usercurrency.currency < item.price ? 'Not enough stardust' : 'Buy Now'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Purchase Confirmation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className={`${styles.stardustModal} max-w-md w-full p-6 shadow-2xl transform transition-all`}>
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
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
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
                disabled={isPurchasing}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold text-white transition ${
                  isPurchasing 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : styles.stardustBuyButton
                }`}
              >
                {isPurchasing ? 'Processing...' : '✨ Confirm Purchase ✨'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
