import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const usersRaw = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                image: true,
                createdAt: true,
                projects: {
                    include: {
                        hackatimeLinks: true,
                    },
                },
                purchasedProgressHours: true,
                totalCurrencySpent: true,
                adminCurrencyAdjustment: true,
            },
            orderBy: {
                createdAt: 'desc',
              },
        });
        // Ensure all values are JSON-serializable (Prisma Decimal/Date conversions)
        const users = usersRaw.map((u) => ({
            ...u,
            createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
            totalCurrencySpent: u.totalCurrencySpent != null ? Number(u.totalCurrencySpent as unknown as number) : 0,
            adminCurrencyAdjustment: u.adminCurrencyAdjustment != null ? Number(u.adminCurrencyAdjustment as unknown as number) : 0,
        }));
        return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}