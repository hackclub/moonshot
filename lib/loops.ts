const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
const LOOPS_TRANSACTIONAL_SIGNIN_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_SIGNIN_EMAIL_ID;
const LOOPS_TRANSACTIONAL_NOTIFICATION_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_NOTIFICATION_EMAIL_ID;
const LOOPS_TRANSACTIONAL_PERSONALIZED_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_PERSONALIZED_EMAIL_ID;
const LOOPS_TRANSACTIONAL_RSVP_EMAIL_ID = process.env.LOOPS_TRANSACTIONAL_RSVP_EMAIL_ID;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';
const LOOPS_MOCK_KEY = (LOOPS_API_KEY || '').toLowerCase() === 'mock';
const LOOPS_USE_MOCK = LOOPS_MOCK_KEY && !IS_PRODUCTION;

// In-memory store for the most recent mocked sign-in URL (dev/testing only)
let LAST_MOCK_SIGNIN_URL: string | null = null;

// Validation function - only runs at runtime, not during build
function validateLoopsConfig() {
    // Skip validation during Next.js build phase
    if (IS_BUILD_PHASE) {
        return;
    }

    if (IS_PRODUCTION && LOOPS_MOCK_KEY) {
        throw new Error("LOOPS_API_KEY cannot be set to 'mock' in production");
    }

    if (!LOOPS_USE_MOCK) {
        if (!LOOPS_TRANSACTIONAL_SIGNIN_EMAIL_ID) throw new Error("Please set LOOPS_TRANSACTIONAL_SIGNIN_EMAIL_ID");
        if (!LOOPS_TRANSACTIONAL_NOTIFICATION_EMAIL_ID) throw new Error("Please set LOOPS_TRANSACTIONAL_NOTIFICATION_EMAIL_ID");
        if (!LOOPS_TRANSACTIONAL_PERSONALIZED_EMAIL_ID) throw new Error("Please set LOOPS_TRANSACTIONAL_PERSONALIZED_EMAIL_ID");
        if (!LOOPS_TRANSACTIONAL_RSVP_EMAIL_ID) throw new Error("Please set LOOPS_TRANSACTIONAL_RSVP_EMAIL_ID");
    }
}

async function sendEmailWithLoops(
    transactionEmailId: string,
    targetEmail: string,
    emailParams: Record<string, string>,
) {
    // Validate configuration at runtime (not during build)
    validateLoopsConfig();
    
    if (LOOPS_USE_MOCK) {
        console.log('[MOCK LOOPS] Transactional email', {
            transactionalId: transactionEmailId,
            email: targetEmail,
            dataVariables: { ...emailParams }
        });
        if (emailParams.signin) {
            LAST_MOCK_SIGNIN_URL = emailParams.signin;
        }
        return;
    }
    const response = await fetch("https://app.loops.so/api/v1/transactional", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LOOPS_API_KEY}`
        },
        body: JSON.stringify({
            transactionalId: transactionEmailId,
            "email": targetEmail,
            "dataVariables": {
                ...emailParams,
            }
        })
    });

    const result = await response.json();
    console.log(result);
    if (!result.success) throw new Error("Failed to send loops email");
}

export async function sendAuthEmail(targetEmail: string, host: string, signin_url: string, datetime: string) {
    await sendEmailWithLoops(
        LOOPS_TRANSACTIONAL_SIGNIN_EMAIL_ID!,
        targetEmail,
        {
            "hostname": host,
            "signin": signin_url,
            "datetime": datetime
        }
    );
}

// Dev/testing helper to expose the last mocked sign-in URL
export function getLastMockSignInUrl(): string | null {
    return LAST_MOCK_SIGNIN_URL;
}

export async function sendNotificationEmail(targetEmail: string, name: string, date: string, content: string) {
    await sendEmailWithLoops(
        LOOPS_TRANSACTIONAL_NOTIFICATION_EMAIL_ID!,
        targetEmail, { content, name, date });
}

export async function sendPersonalizedEmail(targetEmail: string, name: string, reviewer: string, slackId: string, content: string) {
    console.log(targetEmail, name, reviewer, slackId, content);
    await sendEmailWithLoops(
        LOOPS_TRANSACTIONAL_PERSONALIZED_EMAIL_ID!,
        targetEmail, { name, content, reviewer, slackId });
}

export async function sendRSVPEmail(targetEmail: string, name: string, link: string) {
    await sendEmailWithLoops(
        LOOPS_TRANSACTIONAL_RSVP_EMAIL_ID!,
        targetEmail, { name, link });
}