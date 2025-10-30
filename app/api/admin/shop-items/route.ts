import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditLogEventType } from '@/lib/auditLogger';
import { verifyShopItemAdminAccess } from '@/lib/shop-admin-auth';

// GET - Fetch all shop items with calculated inventory
export async function GET() {
  try {
    const authResult = await verifyShopItemAdminAccess();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const items = await prisma.shopItem.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Calculate current inventory for each item dynamically
    const itemsWithInventory = await Promise.all(
      items.map(async (item) => {
        let availableInventory: number | null = null;
        let soldQuantity = 0;
        
        if (item.maxInventory !== null && item.maxInventory !== undefined) {
          // Count total quantity ordered for this item
          const totalOrdered = await prisma.shopOrder.aggregate({
            where: { itemId: item.id },
            _sum: { quantity: true },
          });
          
          soldQuantity = totalOrdered._sum.quantity || 0;
          availableInventory = item.maxInventory - soldQuantity;
        }
        
        return { 
          ...item, 
          availableInventory,
          soldQuantity 
        };
      })
    );

    return NextResponse.json({ items: itemsWithInventory });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new shop item
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyShopItemAdminAccess();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    const user = authResult.user;

    const { name, description, image, price, usdCost, costType, config, useRandomizedPricing, maxInventory, maxPurchasesPerUser } = await request.json();

    // Validate required fields
    if (!name || !description || price === undefined || price === null) {
      return NextResponse.json({ 
        error: 'Name, description, and price are required' 
      }, { status: 400 });
    }

    if (price <= 0) {
      return NextResponse.json({ 
        error: 'Price must be greater than 0' 
      }, { status: 400 });
    }

    // Validate inventory fields
    if (maxInventory !== undefined && maxInventory !== null && maxInventory < 1) {
      return NextResponse.json({ 
        error: 'Max inventory must be 1 or greater' 
      }, { status: 400 });
    }

    if (maxPurchasesPerUser !== undefined && maxPurchasesPerUser !== null && maxPurchasesPerUser < 1) {
      return NextResponse.json({ 
        error: 'Max purchases per user must be 1 or greater' 
      }, { status: 400 });
    }

    const item = await prisma.shopItem.create({
      data: {
        name,
        description,
        image: image || null,
        price, // Always use the provided price
        usdCost: usdCost !== undefined ? usdCost : 0,
        costType: costType || 'fixed',
        config: config || null,
        useRandomizedPricing: useRandomizedPricing !== undefined ? useRandomizedPricing : true,
        maxInventory: maxInventory !== undefined ? maxInventory : null,
        maxPurchasesPerUser: maxPurchasesPerUser !== undefined ? maxPurchasesPerUser : null,
      },
    });

    // Log audit event
    await createAuditLog({
      eventType: AuditLogEventType.OtherEvent,
      description: `Admin created shop item: ${name}`,
      targetUserId: user.id,
      actorUserId: user.id,
      metadata: {
        itemId: item.id,
        itemName: item.name,
        price: item.price,
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error creating shop item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 