import { PrismaClient } from "@/app/generated/prisma/client";
import metrics from "@/metrics";

const prismaClient = new PrismaClient();

// Test database connection on startup
async function testDatabaseConnection() {
    try {
        console.log('[PRISMA] Testing database connection...');
        await prismaClient.$connect();
        await prismaClient.$queryRaw`SELECT 1`;
        console.log('[PRISMA] ✅ Database connection successful');
    } catch (error) {
        console.error('[PRISMA] ❌ FATAL: Cannot connect to database');
        console.error('[PRISMA] Error:', error);
        console.error('[PRISMA] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
        console.error('[PRISMA] Exiting process...');
        process.exit(1);
    }
}

// Run connection test immediately
testDatabaseConnection();

export const prisma = prismaClient.$extends({
    name: "slackUserExtension",
    model: {
        user: {
            async slack(email: string) {
                return (await prisma.account.findFirst({
                    where: {
                        provider: 'slack',
                        user: { email }
                    },
                    select: {
                        providerAccountId: true
                    }
                }))?.providerAccountId
            }
        }
    },
    query: {
        async $allOperations({ operation, model, args, query }) {
            const metricKey = `${operation}_${model}`;
            try {
                const start = performance.now();
                const queryResult = await query(args);
                const time = performance.now() - start;

                metrics.timing(metricKey, time);
                return queryResult;
            } catch (err) {
                metrics.increment(`errors.${metricKey}`, 1);
            }
            return;
        }
    }
});
