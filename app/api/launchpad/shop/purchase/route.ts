import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditLogEventType } from '@/lib/auditLogger';
import { getUserProjectsWithMetrics } from '@/lib/project-client';
import { calculateRandomizedPrice, calculateCurrencyPrice } from '@/lib/shop-utils';

async function getUserShellBalance(userId: string): Promise<number> {
  // Get user with all shell-related fields
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      totalCurrencySpent: true,
      adminCurrencyAdjustment: true,
      purchasedProgressHours: true
    }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Get projects, enhance with journal hours, and calculate metrics
  const { metrics } = await getUserProjectsWithMetrics(
    userId,
    user.totalCurrencySpent,
    user.adminCurrencyAdjustment
  );
  
  return metrics.availablecurrency; // This now includes admin adjustment!
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(opts);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, quantity = 1 } = await request.json();

    if (quantity <= 0 || isNaN(quantity)) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check eligibility (not fraud suspect, identity verified, or admin)
    if (user.status === 'FraudSuspect' && user.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check identity verification: allow if status is L1/L2, or if verified via identity service
    // This handles the case where identity is verified but status hasn't been synced yet
    if (user.status === 'Unknown' && user.role !== 'Admin') {
      // Check if user has identity token and is verified via identity service
      let isVerified = false;
      
      // Mock mode: allow if enabled
      if (process.env.IDENTITY_MOCK === 'true' || process.env.IDENTITY_MOCK === '1') {
        isVerified = true;
      } else if (user.identityToken) {
        // Check external identity service
        const identityBaseUrl = process.env.IDENTITY_URL?.replace(/\/oauth\/.*$/, '') || 'https://identity.hackclub.com';
        try {
          const identityResponse = await fetch(`${identityBaseUrl}/api/v1/me`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${user.identityToken}`,
            },
          });
          
          if (identityResponse.ok) {
            const identityData = await identityResponse.json();
            // Allow if verified or pending (pending means verification is in progress)
            isVerified = identityData?.identity?.verification_status === 'verified' || 
                        identityData?.identity?.verification_status === 'pending';
          }
        } catch (error) {
          console.error('Error checking identity verification:', error);
          // If identity service is unavailable, fall back to database status check
          // This maintains security while being resilient to service outages
        }
      }
      
      if (!isVerified) {
        return NextResponse.json({ error: 'Identity verification required' }, { status: 403 });
      }
    }

    // Get shop item from database
    const item = await prisma.shopItem.findFirst({
      where: { 
        id: itemId,
        active: true 
      },
    });
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

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

    // Calculate price
    let unitPrice: number;
    let appliedDiscountPercent: number | null = null;
    if (
      item.name.toLowerCase().includes('travel stipend') &&
      item.costType === 'config' &&
      item.config && typeof item.config === 'object' && 'dollars_per_hour' in item.config
    ) {
      const dollarsPerHour = parseFloat(String(item.config.dollars_per_hour)) || globalDollarsPerHour;
      unitPrice = calculateCurrencyPrice(item.usdCost, dollarsPerHour);
    } else if (item.useRandomizedPricing) {
      unitPrice = calculateRandomizedPrice(user.id, item.id, item.price, minPercent, maxPercent);
    } else {
      unitPrice = item.price;
    }

    // Apply active discount if present
    const now = new Date();
    const hasPercent = typeof (item as any).discountPercent === 'number' && (item as any).discountPercent! > 0;
    const notExpired = !(item as any).discountEndsAt || new Date((item as any).discountEndsAt as any) > now;
    if (hasPercent && notExpired) {
      const percent = Number((item as any).discountPercent);
      unitPrice = Math.max(0, Math.floor(unitPrice * (100 - percent) / 100));
      appliedDiscountPercent = percent;
    }

    const totalPrice = unitPrice * quantity;

    // Check if user has enough currency
    const usercurrency = await getUserShellBalance(user.id);
    if (usercurrency < totalPrice) {
      return NextResponse.json({ 
        error: 'Insufficient currency', 
        currentcurrency: usercurrency,
        requiredcurrency: totalPrice
      }, { status: 400 });
    }

    // Calculate available inventory dynamically (this ALWAYS takes precedence)
    // This approach automatically handles refunds/cancellations correctly
    let availableInventory: number | null = null;
    if (item.maxInventory !== null && item.maxInventory !== undefined) {
      // Count total quantity of this item that has been ordered (all orders, any status)
      const totalOrdered = await prisma.shopOrder.aggregate({
        where: {
          itemId: item.id,
        },
        _sum: {
          quantity: true,
        },
      });

      const quantitySold = totalOrdered._sum.quantity || 0;
      availableInventory = item.maxInventory - quantitySold;

      if (availableInventory < quantity) {
        return NextResponse.json({ 
          error: 'Insufficient inventory', 
          availableInventory: availableInventory,
          requestedQuantity: quantity
        }, { status: 400 });
      }
    }

    // Check per-user purchase limit (but inventory always trumps this)
    if (item.maxPurchasesPerUser !== null && item.maxPurchasesPerUser !== undefined) {
      // Count how many of this item the user has already purchased
      const userPurchaseCount = await prisma.shopOrder.aggregate({
        where: {
          userId: user.id,
          itemId: item.id,
        },
        _sum: {
          quantity: true,
        },
      });

      const totalPurchased = userPurchaseCount._sum.quantity || 0;
      let remainingAllowance = item.maxPurchasesPerUser - totalPurchased;

      // IMPORTANT: Global inventory always trumps per-user limit
      // If there's less inventory available than the user's remaining allowance, cap it
      if (availableInventory !== null) {
        remainingAllowance = Math.min(remainingAllowance, availableInventory);
      }

      if (quantity > remainingAllowance) {
        // Determine which limit was hit for better error message
        const hitInventoryLimit = availableInventory !== null && 
                                   availableInventory < (item.maxPurchasesPerUser - totalPurchased);
        
        return NextResponse.json({ 
          error: hitInventoryLimit ? 'Insufficient inventory (less than your purchase limit)' : 'Purchase limit exceeded',
          maxPurchasesPerUser: item.maxPurchasesPerUser,
          alreadyPurchased: totalPurchased,
          remainingAllowance: remainingAllowance,
          requestedQuantity: quantity,
          ...(availableInventory !== null && { availableInventory })
        }, { status: 400 });
      }
    }

    // Prepare order config for dynamic items
    function safeConfigObject(config: unknown) {
      return (config && typeof config === 'object' && !Array.isArray(config)) ? config : {};
    }
    let orderConfig = item.config || undefined;
    if (item.costType === 'config') {
      if (item.name.toLowerCase().includes('travel stipend')) {
        // For travel stipend, store hours (default to quantity)
        orderConfig = { ...safeConfigObject(item.config as unknown), hours: quantity };
      }
      // Add more dynamic item types as needed
    }
    if (appliedDiscountPercent !== null) {
      orderConfig = { ...safeConfigObject(orderConfig as unknown), discountPercentApplied: appliedDiscountPercent };
    }

    // Use transaction to atomically create order, update user currency, and decrement inventory
    const order = await prisma.$transaction(async (tx) => {
      // Create shop order
      const newOrder = await tx.shopOrder.create({
        data: {
          userId: user.id,
          itemId: item.id,
          itemName: item.name,
          price: totalPrice,
          quantity,
          config: orderConfig,
        },
      });

      // Update user's total currency spent
      await tx.user.update({
        where: { id: user.id },
        data: {
          totalCurrencySpent: {
            increment: totalPrice
          }
          // Note: purchasedProgressHours is NOT incremented here - it will be applied when the order is fulfilled
        }
      });

      // No need to decrement inventory - it's calculated dynamically from orders!
      // This automatically handles refunds/cancellations correctly

      return newOrder;
    });

    // Log audit event
    await createAuditLog({
      eventType: AuditLogEventType.ShopOrderCreated,
      description: `User purchased ${quantity}x ${item.name} for ${totalPrice} currency`,
      targetUserId: user.id,
      metadata: {
        orderId: order.id,
        itemId: item.id,
        itemName: item.name,
        price: totalPrice,
        quantity,
      },
    });

    return NextResponse.json({ 
      success: true, 
      orderId: order.id,
      currencySpent: totalPrice,
      remainingcurrency: usercurrency - totalPrice
    });
  } catch (error) {
    console.error('Purchase error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 