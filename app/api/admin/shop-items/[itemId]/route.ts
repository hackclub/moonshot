import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog, AuditLogEventType } from '@/lib/auditLogger';
import { verifyShopItemAdminAccess } from '@/lib/shop-admin-auth';

// PUT - Update shop item
export async function PUT(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const authResult = await verifyShopItemAdminAccess();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    if (!authResult.user) {
      return NextResponse.json({ error: 'User data not available' }, { status: 500 });
    }
    const user = authResult.user;

    const { itemId } = params;
    const {
      name,
      description,
      image,
      price,
      usdCost,
      costType,
      config,
      active,
      useRandomizedPricing,
      maxInventory,
      maxPurchasesPerUser,
      discountPercent,
      discountEndsAt,
    } = await request.json();

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

    // Fetch previous item state for audit log
    const previousItem = await prisma.shopItem.findUnique({ where: { id: itemId } });

    const item = await prisma.shopItem.update({
      where: { id: itemId },
      data: {
        name,
        description,
        image: image || null,
        price, // Always use the provided price
        usdCost: usdCost !== undefined ? usdCost : 0,
        costType: costType || 'fixed',
        config: config || null,
        active: active !== undefined ? active : true,
        useRandomizedPricing: useRandomizedPricing !== undefined ? useRandomizedPricing : true,
        maxInventory: maxInventory !== undefined ? maxInventory : undefined,
        maxPurchasesPerUser: maxPurchasesPerUser !== undefined ? maxPurchasesPerUser : undefined,
        discountPercent: (discountPercent === null || discountPercent === undefined)
          ? null
          : Number(discountPercent),
        discountEndsAt: (discountEndsAt === null || discountEndsAt === undefined || discountEndsAt === '')
          ? null
          : new Date(discountEndsAt),
      },
    });

    const changedFields: Record<string, { old: unknown, new: unknown }> = {};
    if (previousItem) {
      if (previousItem.name !== name) changedFields.name = { old: previousItem.name, new: name };
      if (previousItem.description !== description) changedFields.description = { old: previousItem.description, new: description };
      if (previousItem.image !== image) changedFields.image = { old: previousItem.image, new: image };
      if (previousItem.price !== price) changedFields.price = { old: previousItem.price, new: price };
      if (previousItem.usdCost !== usdCost) changedFields.usdCost = { old: previousItem.usdCost, new: usdCost };
      if (previousItem.costType !== costType) changedFields.costType = { old: previousItem.costType, new: costType };
      if (JSON.stringify(previousItem.config) !== JSON.stringify(config)) changedFields.config = { old: previousItem.config, new: config };
      if (previousItem.active !== active) changedFields.active = { old: previousItem.active, new: active };
      if (previousItem.maxInventory !== maxInventory) changedFields.maxInventory = { old: previousItem.maxInventory, new: maxInventory };
      if (previousItem.maxPurchasesPerUser !== maxPurchasesPerUser) changedFields.maxPurchasesPerUser = { old: previousItem.maxPurchasesPerUser, new: maxPurchasesPerUser };
      if (previousItem.discountPercent !== (discountPercent === undefined ? previousItem.discountPercent : discountPercent)) {
        changedFields.discountPercent = { old: previousItem.discountPercent, new: discountPercent };
      }
      const prevEnds = previousItem.discountEndsAt ? previousItem.discountEndsAt.toISOString() : null;
      const nextEnds = discountEndsAt ? new Date(discountEndsAt).toISOString() : null;
      if (prevEnds !== nextEnds) {
        changedFields.discountEndsAt = { old: previousItem.discountEndsAt, new: discountEndsAt ? new Date(discountEndsAt) : null };
      }
    }

    // Log audit event (do not fail the request if logging fails)
    try {
      if (user?.id) {
        await createAuditLog({
          eventType: AuditLogEventType.OtherEvent,
          description: `Admin updated shop item: ${name}. Old price: ${previousItem?.price}, new price: ${item.price}`,
          targetUserId: user.id,
          actorUserId: user.id,
          metadata: {
            itemId: item.id,
            itemName: item.name,
            changedFields,
            previous: previousItem,
            updated: item,
          },
        });
      }
    } catch (auditErr) {
      console.error('Audit log failed for shop item update:', auditErr);
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('Error updating shop item:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE - Delete shop item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { itemId: string } }
) {
  try {
    const authResult = await verifyShopItemAdminAccess();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    
    if (!authResult.user) {
      return NextResponse.json({ error: 'User data not available' }, { status: 500 });
    }
    const user = authResult.user;

    const { itemId } = params;

    // Get item details before deletion for audit log
    const item = await prisma.shopItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await prisma.shopItem.delete({
      where: { id: itemId },
    });

    // Log audit event (do not fail the request if logging fails)
    try {
      if (user?.id) {
        await createAuditLog({
          eventType: AuditLogEventType.OtherEvent,
          description: `Admin deleted shop item: ${item.name}`,
          targetUserId: user.id,
          actorUserId: user.id,
          metadata: {
            itemId: item.id,
            itemName: item.name,
            price: item.price,
          },
        });
      }
    } catch (auditErr) {
      console.error('Audit log failed for shop item delete:', auditErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shop item:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 