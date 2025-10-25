import NextAuth from "next-auth";
import SlackProvider from "next-auth/providers/slack";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import { randomBytes } from "crypto";
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import metrics from "@/metrics";
import { sendAuthEmail, sendNotificationEmail } from "@/lib/loops";
import { AdapterUser } from "next-auth/adapters";

import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";

const baseAdapter = PrismaAdapter(prisma);

const adapter = {
  ...baseAdapter,
  // Override verification token methods - the v1.0.7 adapter returns undefined
  async createVerificationToken(data: { identifier: string; token: string; expires: Date }) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[CUSTOM-ADAPTER] createVerificationToken CALLED');
    console.log('  identifier:', data.identifier);
    console.log('  token (full):', data.token);
    console.log('  token length:', data.token.length);
    console.log('  expires:', data.expires);
    console.log('  Stack trace:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
    
    // Prisma returns undefined for models with composite keys, so we create then read back
    try {
      await prisma.verificationToken.create({ data });
      console.log('[CUSTOM-ADAPTER] Prisma create succeeded (no error)');
    } catch (err) {
      console.log('[CUSTOM-ADAPTER] PRISMA CREATE FAILED:', err);
      throw err;
    }
    
    // Read it back since create returns undefined for composite key models
    const result = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: data.identifier, token: data.token } }
    });
    
    if (!result) {
      console.log('[CUSTOM-ADAPTER] ERROR: Token not found after create!');
      throw new Error('Token not found after create');
    }
    
    console.log('[CUSTOM-ADAPTER] Token read back successfully');
    
    console.log('[CUSTOM-ADAPTER] Token STORED in DB:');
    console.log('  identifier:', result.identifier);
    console.log('  token (full):', result.token);
    console.log('  token length:', result.token.length);
    console.log('  expires:', result.expires);
    
    // Verify it was actually stored by reading it back
    const verification = await prisma.verificationToken.findUnique({
      where: { identifier_token: { identifier: result.identifier, token: result.token } }
    });
    console.log('[CUSTOM-ADAPTER] Verification read-back:', verification ? 'SUCCESS' : 'FAILED');
    if (verification) {
      console.log('  Read token matches stored:', verification.token === result.token);
    }
    
    // List all tokens in DB for this identifier
    const allTokens = await prisma.verificationToken.findMany({
      where: { identifier: data.identifier }
    });
    console.log('[CUSTOM-ADAPTER] All tokens for', data.identifier, ':', allTokens.length);
    allTokens.forEach((t, i) => {
      console.log(`  Token ${i + 1}: ${t.token.slice(0, 20)}... (expires: ${t.expires})`);
    });
    console.log('═══════════════════════════════════════════════════════');
    
    return result;
  },
  async useVerificationToken(params: { identifier: string; token: string }) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[CUSTOM-ADAPTER] useVerificationToken CALLED');
    console.log('  identifier:', params.identifier);
    console.log('  token (full):', params.token);
    console.log('  token length:', params.token.length);
    console.log('  Stack trace:', new Error().stack?.split('\n').slice(1, 4).join('\n'));
    
    // First, list ALL tokens for this identifier
    const allTokens = await prisma.verificationToken.findMany({
      where: { identifier: params.identifier }
    });
    console.log('[CUSTOM-ADAPTER] All tokens in DB for', params.identifier, ':', allTokens.length);
    allTokens.forEach((t, i) => {
      console.log(`  Token ${i + 1}:`);
      console.log(`    Full: ${t.token}`);
      console.log(`    Length: ${t.token.length}`);
      console.log(`    Expires: ${t.expires}`);
      console.log(`    Matches lookup: ${t.token === params.token}`);
    });
    
    try {
      const result = await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: params.identifier, token: params.token } },
      });
      
      console.log('[CUSTOM-ADAPTER] Token FOUND and DELETED:');
      console.log('  identifier:', result.identifier);
      console.log('  token (full):', result.token);
      console.log('  Match confirmed:', result.token === params.token);
      console.log('═══════════════════════════════════════════════════════');
      
      return result;
    } catch (error) {
      console.log('[CUSTOM-ADAPTER] Token NOT FOUND in DB');
      console.log('  Error:', error);
      console.log('  Searched for token:', params.token);
      console.log('  Token length:', params.token.length);
      
      // Do a manual search to see if there's a similar token
      const similarTokens = await prisma.verificationToken.findMany({
        where: { 
          identifier: params.identifier,
        }
      });
      console.log('[CUSTOM-ADAPTER] Similar tokens found:', similarTokens.length);
      similarTokens.forEach((t, i) => {
        const diff = [];
        for (let j = 0; j < Math.min(t.token.length, params.token.length); j++) {
          if (t.token[j] !== params.token[j]) {
            diff.push(j);
          }
        }
        console.log(`  Token ${i + 1} differs at positions:`, diff.length > 0 ? diff.slice(0, 10) : 'NONE (but lengths differ?)');
      });
      console.log('═══════════════════════════════════════════════════════');
      return null;
    }
  },
  // Custom createUser method to add auditing
  createUser: async (user: AdapterUser) => {
    console.log("Creating user:", user.email);

    try {
      // Create the user using Prisma
      const userCreated = await prisma.user.create({
        data: user,
      });

      // Ensure we have a valid user with an ID before proceeding
      if (!userCreated || !userCreated.id) {
        console.error("User creation failed: no ID returned");
        throw new Error("User creation failed: no ID returned");
      }

      // Log the user creation event
      try {
        // Import dynamically to avoid circular imports
        const { logUserEvent, AuditLogEventType } = await import(
          "@/lib/auditLogger"
        );

        await logUserEvent({
          eventType: AuditLogEventType.UserCreated,
          description: `User account created with email ${user.email}`,
          targetUserId: userCreated.id,
          metadata: {
            provider: "system",
            email: user.email,
            timestamp: new Date().toISOString(),
          },
        });

        console.log("User creation audit log created successfully");
      } catch (error) {
        console.error("Failed to create audit log for user creation:", error);
        // Don't fail user creation if audit log fails
      }

      return userCreated;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error; // Re-throw the error so NextAuth can handle it
    }
  },
  // Override updateUser to log when email is verified
  updateUser: async (
    user: { id: string; emailVerified?: Date | null } & Record<string, any>,
  ) => {
    console.log("Updating user:", user.id, "with data:", JSON.stringify(user));

    // If emailVerified is being set and it's not null
    if (user.emailVerified) {
      try {
        // Get the user first to get their email for the audit log
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true },
        });

        if (existingUser) {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: user,
          });

          // Create audit log for email verification
          try {
            // Import dynamically to avoid circular imports
            const { logUserEvent, AuditLogEventType } = await import(
              "@/lib/auditLogger"
            );

            await logUserEvent({
              eventType: AuditLogEventType.UserVerified,
              description: `User verified email address: ${existingUser.email}`,
              targetUserId: user.id,
              metadata: {
                email: existingUser.email,
                verifiedAt:
                  user.emailVerified instanceof Date
                    ? user.emailVerified.toISOString()
                    : new Date().toISOString(),
              },
            });

            console.log("Email verification audit log created successfully");
          } catch (error) {
            console.error(
              "Failed to create audit log for email verification:",
              error,
            );
          }

          return updatedUser;
        }
      } catch (error) {
        console.error("Error in custom updateUser with verification:", error);
      }
    }

    // Fall back to default update behavior
    return prisma.user.update({
      where: { id: user.id },
      data: user,
    });
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  linkAccount: async ({ ok, state, ...data }: any) => {
    console.log("Linking account:", {
      provider: data.provider,
      userId: data.userId,
    });

    // If this is a Slack account, update the user with their Slack ID
    if (data.provider === "slack") {
      console.log("Updating user with Slack ID");
      console.log("Slack data received:", {
        providerAccountId: data.providerAccountId,
        profile: data.profile,
        userData: data,
      });

      try {
        // Get existing user data to check if name is already set
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { name: true, email: true },
        });

        // Prepare update data with Slack user ID
        const updateData: any = {
          slack: data.providerAccountId, // Slack's user ID
        };

        // Extract name from ID token if available
        let userName = null;
        if (data.id_token) {
          try {
            // Decode the JWT token without verification (we just need the payload)
            const tokenParts = data.id_token.split(".");
            if (tokenParts.length >= 2) {
              const payload = JSON.parse(
                Buffer.from(tokenParts[1], "base64").toString(),
              );
              if (payload.name) {
                userName = payload.name;
                console.log("Extracted name from ID token:", userName);
              }
            }
          } catch (err) {
            console.error("Error extracting name from ID token:", err);
          }
        }

        // Use name from profile or ID token
        if (data.profile?.name || userName) {
          const nameToUse = data.profile?.name || userName;
          console.log("Setting user name from Slack:", nameToUse);
          updateData.name = nameToUse;
        }

        // Update the user with Slack ID and potentially name
        await prisma.user.update({
          where: { id: data.userId },
          data: updateData,
        });

        // Create audit log for Slack connection
        try {
          // Import dynamically to avoid circular imports
          const { logUserEvent, AuditLogEventType } = await import(
            "@/lib/auditLogger"
          );

          await logUserEvent({
            eventType: AuditLogEventType.SlackConnected,
            description: `User connected Slack account`,
            targetUserId: data.userId,
            metadata: {
              provider: "slack",
              slackId: data.providerAccountId,
              email: user?.email,
              timestamp: new Date().toISOString(),
            },
          });

          console.log("Slack connection audit log created successfully");
        } catch (error) {
          console.error(
            "Failed to create audit log for Slack connection:",
            error,
          );
        }

        metrics.increment("success.link_account_id", 1);
      } catch (err) {
        console.error("Error updating user with Slack data:", err);
        metrics.increment("errors.link_account_id", 1);
      }
    }

    const account = await prisma.account.create({
      data: {
        ...data,
        access_token: data.access_token ?? null,
        token_type: data.token_type ?? null,
        id_token: data.id_token ?? null,
        refresh_token: data.refresh_token ?? null,
        scope: data.scope ?? null,
        expires_at: data.expires_at ?? null,
        session_state: data.session_state ?? null,
      },
    });
    return void account;
  },
};

export const opts: NextAuthOptions = {
  adapter: adapter,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      id: "hc-identity",
      name: "Identity",
      type: "credentials",
      credentials: {
        code: { type: "text" },
      },
      async authorize(credentials) {
        try {
          const code = credentials?.code;
          if (!code) return null;

          // Construct token request parameters
          const tokenUrl = `${process.env.IDENTITY_URL}/oauth/token`;
          const tokenParams = new URLSearchParams({
            code: String(code),
            client_id: process.env.IDENTITY_CLIENT_ID ?? "",
            client_secret: process.env.IDENTITY_CLIENT_SECRET ?? "",
            redirect_uri: `${process.env.NEXTAUTH_URL ?? ""}/launchpad/login`,
            grant_type: "authorization_code",
          }).toString();

          // Exchange code for token
          const tokenResponse = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams,
          });
          if (!tokenResponse.ok) return null;

          const { access_token } = await tokenResponse.json();

          // Fetch user info from identity provider
          const userInfoResponse = await fetch(
            `${process.env.IDENTITY_URL}/api/v1/me`,
            {
              headers: { Authorization: `Bearer ${access_token}` },
            },
          );
          if (!userInfoResponse.ok) return null;

          const { identity } = await userInfoResponse.json();
          const email = identity?.primary_email;
          const name = `${identity?.first_name ?? ""}${identity?.last_name ?? ""}`;

          if (!email || !name) return null;

          // Upsert user record in database
          const userRecord = await prisma.user.upsert({
            where: { email },
            update: { name, identityToken: access_token },
            create: { email, name, identityToken: access_token },
          });

          return userRecord;
        } catch {
          return null;
        }
      },
    }),
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID ?? "",
      clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER as string,
      from: process.env.EMAIL_FROM as string,
      maxAge: 60 * 10, // make email links valid for 10 minutes
      sendVerificationRequest: async ({
        identifier: email,
        url,
        token,
        provider,
      }) => {
        // Log what token we received vs what's in the URL
        const urlObj = new URL(url);
        const urlToken = urlObj.searchParams.get('token');
        console.log('[AUTH-EMAIL] sendVerificationRequest', {
          email,
          host: urlObj.host,
          path: urlObj.pathname,
          search: urlObj.search,
          tokenHead: token.slice(0, 10) + '...',
          urlTokenHead: urlToken?.slice(0, 10) + '...',
          tokensMatch: token === urlToken
        });
        
        const { host } = new URL(url);
        try {
          const date = new Date();
          const datetime = `[${date.getDate()}/${date.getMonth()}/${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}] `;
          await sendAuthEmail(email, host, url, datetime);
          metrics.increment("success.send_auth_email", 1);
        } catch (err) {
          metrics.increment("errors.send_auth_email", 1);
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Persist user id in token on initial sign-in
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).sub = (user as unknown as { id: string }).id;
      }
      return token;
    },
    async session({ session, token }) {
      const userId = (token?.sub as string | undefined) ?? undefined;
      if (!userId) {
        return session;
      }

      try {
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        if (dbUser) {
          const { isAttendee } = await import("@/lib/userTags");
          const isAttendeeFlag = await isAttendee(dbUser.id);

          return {
            ...session,
            user: {
              ...session.user,
              id: dbUser.id,
              hackatimeId: dbUser.hackatimeId,
              role: dbUser.role,
              isAdmin: dbUser.isAdmin,
              status: dbUser.status,
              emailVerified: dbUser.emailVerified,
              isAttendee: isAttendeeFlag,
            },
          };
        }
      } catch (err) {
        console.error("Error enriching session from DB:", err);
      }

      return session;
    },
    async signIn({ user, account, profile }) {
      // Log the sign in attempt
      console.log("Sign in attempt:", {
        email: user.email,
        provider: account?.provider,
        hasHackatimeId: !!user.hackatimeId,
        isAdmin: user.isAdmin,
      });

      if (!user.email) {
        metrics.increment("errors.sign_in", 1);
        return false;
      }

      // If signing in with email, check if a Slack account exists
      if (account?.provider === "email") {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true },
        });

        if (existingUser) {
          // Update the current user with any existing hackatimeId
          await prisma.user.update({
            where: { id: user.id },
            data: {
              hackatimeId: existingUser.hackatimeId,
              slack: existingUser.slack,
            },
          });
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      // Check if the URL is a callback URL with slackConnected parameter
      if (url.includes("slackConnected=true")) {
        console.log("Redirecting to:", url);
        return url;
      }

      // Clear experience mode cookie on login so it gets reset based on user status
      // Note: We need to add a flag to clear this on the client side since we can't
      // access cookies directly in the redirect callback
      return `${baseUrl}/launchpad?clearExperience=true`;
    },
  },
  pages: {
    signIn: "/launchpad/login",
    verifyRequest: "/launchpad/login/verify",
    error: "/launchpad/login/error",
  },
  debug: true, // Temporarily enable debug mode to see what's happening
};

const handler = NextAuth(opts);
// Wrap GET/POST to log request/callback cookie info for the email flow
export async function GET(req: NextRequest, ctx: any) {
  console.log('[AUTH-ROUTE][GET]', { href: req.nextUrl.href, path: req.nextUrl.pathname, search: req.nextUrl.search });
  const res: NextResponse = await (handler as any)(req, ctx);
  if (req.nextUrl.pathname.includes('/api/auth/callback/email')) {
    console.log('[AUTH-ROUTE][CALLBACK][GET] incoming-cookie:', (req.headers.get('cookie') || '(none)').slice(0, 200));
    console.log('[AUTH-ROUTE][CALLBACK][GET] set-cookie:', res.headers.get('set-cookie') || '(none)');
    console.log('[AUTH-ROUTE][CALLBACK][GET] status:', res.status);
  }
  return res;
}

export async function POST(req: NextRequest, ctx: any) {
  console.log('[AUTH-ROUTE][POST]', { href: req.nextUrl.href, path: req.nextUrl.pathname, search: req.nextUrl.search });
  if (req.nextUrl.pathname.includes('/api/auth/signin/email')) {
    console.log('[AUTH-ROUTE][SIGNIN-EMAIL][POST] headers', {
      host: req.headers.get('host'),
      referer: req.headers.get('referer'),
      cookieHead: (req.headers.get('cookie') || '(none)').slice(0, 200)
    });
  }
  const res: NextResponse = await (handler as any)(req, ctx);
  if (req.nextUrl.pathname.includes('/api/auth/signin/email')) {
    console.log('[AUTH-ROUTE][SIGNIN-EMAIL][POST] status:', res.status);
    console.log('[AUTH-ROUTE][SIGNIN-EMAIL][POST] set-cookie:', res.headers.get('set-cookie') || '(none)');
  }
  return res;
}
