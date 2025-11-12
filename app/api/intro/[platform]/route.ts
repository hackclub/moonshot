import { checkHackatimeUserExists } from "@/lib/hackatime";
import { checkSlackUserExists } from "@/lib/slack";
import { NextRequest } from "next/server";
import { getServerSession } from 'next-auth';
import { opts } from '@/app/api/auth/[...nextauth]/route';

/*
 * API Call to check the existance of certain platforms
 * Current platforms/features to be checked: slack, hackatime, hackatime_heartbeat
 * 
 * 
 * The query search paramater defines the object to be queried
 *  + platform: slack, query: email@example.com ; Checks if slack user with the query email exists
 *  + platform: hackatime, query: slackid ; Checks if a hackatime user with that query slackid exists
 *  + platform: hackatime_heartbeat, query: slackid ; Checks if a hackatime heartbeat for the user with the query slackid exists
 * 
 * SECURITY: This endpoint requires authentication to prevent user enumeration attacks.
 * Users can only check their own email/slackId during onboarding.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
    // Check authentication - this endpoint is used during onboarding but still requires a session
    const session = await getServerSession(opts);
    if (!session?.user) {
        return Response.json({ ok: false, msg: "Unauthorized" }, { status: 401 });
    }

    const platform = (await params).platform

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query)
        return Response.json({ ok: false, msg: "No query value passed" }, { status: 400 })

    // Security: Verify users can only check their own data to prevent enumeration attacks
    if (platform === "slack") {
        // For slack, verify the query email matches the session user's email
        if (query !== session.user.email) {
            return Response.json({ ok: false, msg: "You can only check your own email" }, { status: 403 });
        }
    } else if (platform === "hackatime" || platform === "hackatime_heartbeat") {
        // For hackatime, verify the query slackId belongs to the authenticated user
        // We need to fetch the user's slackId from their email to verify
        const { getUserByEmail } = await import("@/lib/slack");
        try {
            const slackUser = await getUserByEmail(session.user.email!);
            if (!slackUser || slackUser.id !== query) {
                return Response.json({ ok: false, msg: "You can only check your own Slack ID" }, { status: 403 });
            }
        } catch (error) {
            // If we can't verify, deny access for security
            return Response.json({ ok: false, msg: "Unable to verify Slack ID ownership" }, { status: 403 });
        }
    }

    let exists = false;
    switch (platform) {
        case "slack":
            exists = await checkSlackUserExists(query)
            break;
        case "hackatime":
            exists = await checkHackatimeUserExists(query)
            break;
        case "hackatime_heartbeat":
            // TODO: Hackatime Heartbeat currently not available, assume it exists
            // exists = (await fetchRecentHeartbeat(query)).has_heartbeat
            exists = true
            break;
        default:
            return Response.json({ ok: false, msg: "No matching platform found" })
    }

    return Response.json({ ok: true, exists: exists, platform: platform, query: query });
}