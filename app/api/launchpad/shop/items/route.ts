import { NextResponse } from 'next/server';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { calculateRandomizedPrice, calculateCurrencyPrice } from '@/lib/shop-utils';

export async function GET() {
  const session = await getServerSession(opts);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user for randomized pricing
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all active shop items from database
    const items = await prisma.shopItem.findMany({
      where: { 
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate available inventory for each item dynamically
    // This handles refunds/cancellations automatically!
    const itemsWithAvailability = await Promise.all(
      items.map(async (item) => {
        let availableInventory: number | null = null;
        
        if (item.maxInventory !== null && item.maxInventory !== undefined) {
          // Count total quantity ordered for this item
          const totalOrdered = await prisma.shopOrder.aggregate({
            where: { itemId: item.id },
            _sum: { quantity: true },
          });
          
          const quantitySold = totalOrdered._sum.quantity || 0;
          availableInventory = item.maxInventory - quantitySold;
        }
        
        return { ...item, availableInventory };
      })
    );

    // Filter out items with 0 inventory (null means unlimited)
    const itemsInStock = itemsWithAvailability.filter(
      (item) => item.availableInventory === null || item.availableInventory > 0
    );

    // Get pricing bounds from global config
    const globalConfigs = await prisma.globalConfig.findMany({
      where: {
        key: {
          in: ['price_random_min_percent', 'price_random_max_percent', 'dollars_per_hour']
        }
      }
    });

    const configMap = globalConfigs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {} as Record<string, string>);

    const minPercent = parseFloat(configMap.price_random_min_percent || '90');
    const maxPercent = parseFloat(configMap.price_random_max_percent || '110');
    const globalDollarsPerHour = parseFloat(configMap.dollars_per_hour || '10');

    // Get user's purchase counts for items with per-user limits
    const userPurchaseCounts = await prisma.shopOrder.groupBy({
      by: ['itemId'],
      where: {
        userId: user.id,
      },
      _sum: {
        quantity: true,
      },
    });

    // Create a map of itemId -> total quantity purchased by user
    const purchaseCountMap = userPurchaseCounts.reduce((acc, item) => {
      acc[item.itemId] = item._sum.quantity || 0;
      return acc;
    }, {} as Record<string, number>);

    // Filter out items where user has reached their purchase limit
    // Note: Items with 0 inventory are already filtered out above (inventory trumps per-user limits)
    const availableItems = itemsInStock.filter((item) => {
      // If item has maxPurchasesPerUser set
      if (item.maxPurchasesPerUser !== null && item.maxPurchasesPerUser !== undefined) {
        const userPurchased = purchaseCountMap[item.id] || 0;
        let remainingAllowance = item.maxPurchasesPerUser - userPurchased;
        
        // IMPORTANT: Global inventory always trumps per-user limit
        // If inventory is lower than remaining allowance, inventory wins
        if (item.availableInventory !== null) {
          remainingAllowance = Math.min(remainingAllowance, item.availableInventory);
        }
        
        // Only show item if user can purchase at least 1 more
        return remainingAllowance > 0;
      }
      // If no per-user limit, include the item (inventory already filtered above)
      return true;
    });

    // Apply correct pricing logic
    const publicItems = availableItems.map(item => {
      // If travel stipend, use calculateShellPrice with dollars_per_hour from config or global
      if (
        item.name.toLowerCase().includes('travel stipend') &&
        item.costType === 'config' &&
        item.config && typeof item.config === 'object' && 'dollars_per_hour' in item.config
      ) {
        const dollarsPerHour = parseFloat(String(item.config.dollars_per_hour)) || globalDollarsPerHour;
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.image,
          price: calculateCurrencyPrice(item.usdCost, dollarsPerHour),
        };
      }
      // Check if randomized pricing is enabled for this item
      else if (item.useRandomizedPricing) {
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.image,
          price: calculateRandomizedPrice(user.id, item.id, item.price, minPercent, maxPercent),
        };
      }
      // Otherwise, use static price
      else {
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          image: item.image,
          price: item.price,
        };
      }
    });

    return NextResponse.json({ items: publicItems });
  } catch (error) {
    console.error('Error loading shop items:', error);
    return NextResponse.json({ error: 'Failed to load shop items' }, { status: 500 });
  }
} 