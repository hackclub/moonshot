import NextAuth from "next-auth";
import SlackProvider from "next-auth/providers/slack";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import { randomBytes } from "crypto";
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import metrics from "@/metrics";
import { sendAuthEmail, sendNotificationEmail } from "@/lib/loops";
import { AdapterUser } from "next-auth/adapters";

import { SignJWT, jwtVerify } from "jose";

const baseAdapter = PrismaAdapter(prisma);

const adapter = {
  ...baseAdapter,
  // Wrap verification token methods to add logging
  createVerificationToken: async (verificationToken: any) => {
    console.log('[ADAPTER] createVerificationToken called with:', {
      identifier: verificationToken.identifier,
      tokenHead: verificationToken.token?.substring(0, 10) + '...',
      expires: verificationToken.expires
    });
    try {
      const result = await baseAdapter.createVerificationToken!(verificationToken);
      console.log('[ADAPTER] createVerificationToken result:', result);
      return result;
    } catch (error) {
      console.error('[ADAPTER] createVerificationToken error:', error);
      throw error;
    }
  },
  useVerificationToken: async (params: any) => {
    console.log('[ADAPTER] useVerificationToken called with:', {
      identifier: params.identifier,
      tokenHead: params.token?.substring(0, 10) + '...'
    });
    try {
      const result = await baseAdapter.useVerificationToken!(params);
      console.log('[ADAPTER] useVerificationToken result:', result);
      return result;
    } catch (error) {
      console.error('[ADAPTER] useVerificationToken error:', error);
      throw error;
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
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" 
          ? (process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : undefined)
          : undefined,
      },
    },
  },
  jwt: {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    async encode({ token, secret, maxAge }) {
      if (!token) return "";
      const secretInput = secret ?? process.env.NEXTAUTH_SECRET ?? "";
      const signingKey =
        typeof secretInput === "string"
          ? new TextEncoder().encode(secretInput)
          // Buffer is a Uint8Array; ensure it's typed as such
          : new Uint8Array(secretInput);
      const expiresIn = Math.floor(Date.now() / 1000) + (maxAge ?? 60 * 60 * 24 * 30);
      return await new SignJWT(token as Record<string, unknown>)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(signingKey);
    },
    async decode({ token, secret }) {
      if (!token) return null;
      const secretInput = secret ?? process.env.NEXTAUTH_SECRET ?? "";
      const verifyKey =
        typeof secretInput === "string"
          ? new TextEncoder().encode(secretInput)
          : new Uint8Array(secretInput);
      const { payload } = await jwtVerify(token, verifyKey);
      return payload as Record<string, unknown>;
    },
  },
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
        try {
          const u = new URL(url);
          console.log('[AUTH-EMAIL] sendVerificationRequest', {
            email,
            host: u.host,
            path: u.pathname,
            search: u.search,
            tokenHead: String(token).slice(0, 10) + '...'
          });
        } catch (e) {
          console.log('[AUTH-EMAIL] sendVerificationRequest url-parse-error', e);
        }
        // Customize the verification email
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
