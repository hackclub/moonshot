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
                        chatRooms: {
                            include: {
                                messages: {
                                    select: {
                                        hours: true,
                                        approvedHours: true,
                                    },
                                },
                            },
                        },
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
        const rawList = Array.isArray(usersRaw) ? usersRaw : [];
        
        // Ensure all values are JSON-serializable (Prisma Decimal/Date conversions)
        // and calculate journal hours for each project
        const users = rawList.map((u) => ({
            ...u,
            createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : u.createdAt,
            totalCurrencySpent: u.totalCurrencySpent != null ? Number(u.totalCurrencySpent as unknown as number) : 0,
            adminCurrencyAdjustment: u.adminCurrencyAdjustment != null ? Number(u.adminCurrencyAdjustment as unknown as number) : 0,
            projects: u.projects.map((project) => {
                // Calculate journal hours from chat messages
                let journalRawHours = 0;
                let journalApprovedHours = 0;
                
                if (project.chatRooms && project.chatRooms.length > 0) {
                    project.chatRooms.forEach(room => {
                        if (room.messages) {
                            room.messages.forEach(message => {
                                journalRawHours += typeof message.hours === 'number' ? message.hours : 0;
                                const approved = (message.approvedHours !== undefined && message.approvedHours !== null)
                                    ? message.approvedHours
                                    : 0;
                                journalApprovedHours += approved;
                            });
                        }
                    });
                }
                
                // Remove chatRooms from the response (we only needed it for calculation)
                const { chatRooms, ...projectWithoutChatRooms } = project;
                
                return {
                    ...projectWithoutChatRooms,
                    journalRawHours,
                    journalApprovedHours,
                };
            }),
        }));
        return NextResponse.json(users);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}