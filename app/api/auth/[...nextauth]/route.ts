import NextAuth from "next-auth";
import SlackProvider from "next-auth/providers/slack";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { NextAuthOptions } from "next-auth";
import { randomBytes } from "crypto";
import metrics from "@/metrics";
import { sendAuthEmail, sendNotificationEmail } from "@/lib/loops";
import { AdapterUser } from "next-auth/adapters";

const adapter = {
  ...PrismaAdapter(prisma),
  // Custom createUser method to add auditing
  createUser: async (user: AdapterUser) => {
    console.log('Creating user:', user.email);
    
    try {
      // Create the user using Prisma
      const userCreated = await prisma.user.create({
        data: user
      });
      
      // Ensure we have a valid user with an ID before proceeding
      if (!userCreated || !userCreated.id) {
        console.error('User creation failed: no ID returned');
        throw new Error('User creation failed: no ID returned');
      }
      
      // Log the user creation event
      try {
        // Import dynamically to avoid circular imports
        const { logUserEvent, AuditLogEventType } = await import('@/lib/auditLogger');
        
        await logUserEvent({
          eventType: AuditLogEventType.UserCreated,
          description: `User account created with email ${user.email}`,
          targetUserId: userCreated.id,
          metadata: {
            provider: 'system',
            email: user.email,
            timestamp: new Date().toISOString()
          }
        });
        
        console.log('User creation audit log created successfully');
      } catch (error) {
        console.error('Failed to create audit log for user creation:', error);
        // Don't fail user creation if audit log fails
      }
      
      return userCreated;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error; // Re-throw the error so NextAuth can handle it
    }
  },
  // Override updateUser to log when email is verified
  updateUser: async (user: { id: string; emailVerified?: Date | null } & Record<string, any>) => {
    console.log('Updating user:', user.id, 'with data:', JSON.stringify(user));
    
    // If emailVerified is being set and it's not null
    if (user.emailVerified) {
      try {
        // Get the user first to get their email for the audit log
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { email: true }
        });
        
        if (existingUser) {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: user
          });
          
          // Create audit log for email verification
          try {
            // Import dynamically to avoid circular imports
            const { logUserEvent, AuditLogEventType } = await import('@/lib/auditLogger');
            
            await logUserEvent({
              eventType: AuditLogEventType.UserVerified,
              description: `User verified email address: ${existingUser.email}`,
              targetUserId: user.id,
              metadata: {
                email: existingUser.email,
                verifiedAt: user.emailVerified instanceof Date 
                  ? user.emailVerified.toISOString() 
                  : new Date().toISOString()
              }
            });
            
            console.log('Email verification audit log created successfully');
          } catch (error) {
            console.error('Failed to create audit log for email verification:', error);
          }
          
          return updatedUser;
        }
      } catch (error) {
        console.error('Error in custom updateUser with verification:', error);
      }
    }
    
    // Fall back to default update behavior
    return prisma.user.update({
      where: { id: user.id },
      data: user
    });
  },
  // Add explicit verification token methods to fix the "in" operator error
  createVerificationToken: async (verificationToken: { identifier: string; expires: Date; token: string }) => {
    console.log('Creating verification token for:', verificationToken.identifier);
    try {
      const result = await prisma.verificationToken.create({
        data: verificationToken,
      });
      console.log('Verification token created successfully');
      return result;
    } catch (error) {
      console.error('Error creating verification token:', error);
      throw error;
    }
  },
  useVerificationToken: async ({ identifier, token }: { identifier: string; token: string }) => {
    console.log('Using verification token for:', identifier, 'with token:', token?.substring(0, 10) + '...');
    try {
      const verificationToken = await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier,
            token,
          },
        },
      });
      console.log('Verification token used and deleted successfully');
      return verificationToken;
    } catch (error) {
      console.error('Error using verification token:', error);
      // Return null if token not found or expired, which is expected behavior
      return null;
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  linkAccount: async ({ ok, state, ...data }: any) => {
    console.log('Linking account:', { provider: data.provider, userId: data.userId });
    
    // If this is a Slack account, update the user with their Slack ID
    if (data.provider === 'slack') {
      console.log('Updating user with Slack ID');
      console.log('Slack data received:', { 
        providerAccountId: data.providerAccountId,
        profile: data.profile,
        userData: data
      });

      try {
        // Get existing user data to check if name is already set
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { name: true, email: true }
        });
        
        // Prepare update data with Slack user ID
        const updateData: any = {
          slack: data.providerAccountId  // Slack's user ID
        };
        
        // Extract name from ID token if available
        let userName = null;
        if (data.id_token) {
          try {
            // Decode the JWT token without verification (we just need the payload)
            const tokenParts = data.id_token.split('.');
            if (tokenParts.length >= 2) {
              const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
              if (payload.name) {
                userName = payload.name;
                console.log('Extracted name from ID token:', userName);
              }
            }
          } catch (err) {
            console.error('Error extracting name from ID token:', err);
          }
        }
        
        // Use name from profile or ID token
        if (data.profile?.name || userName) {
          const nameToUse = data.profile?.name || userName;
          console.log('Setting user name from Slack:', nameToUse);
          updateData.name = nameToUse;
        }
        
        // Update the user with Slack ID and potentially name
        await prisma.user.update({
          where: { id: data.userId },
          data: updateData
        });
        
        // Create audit log for Slack connection
        try {
          // Import dynamically to avoid circular imports
          const { logUserEvent, AuditLogEventType } = await import('@/lib/auditLogger');
          
          await logUserEvent({
            eventType: AuditLogEventType.SlackConnected,
            description: `User connected Slack account`,
            targetUserId: data.userId,
            metadata: {
              provider: 'slack',
              slackId: data.providerAccountId,
              email: user?.email,
              timestamp: new Date().toISOString()
            }
          });
          
          console.log('Slack connection audit log created successfully');
        } catch (error) {
          console.error('Failed to create audit log for Slack connection:', error);
        }
        
        metrics.increment("success.link_account_id", 1);
      } catch (err) {
        console.error('Error updating user with Slack data:', err);
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
}

export const opts: NextAuthOptions = {
  adapter: adapter,
  session: {
    strategy: "database"
  },
  providers: [
    CredentialsProvider({
      id: 'identity',
      name: 'Hack Club Identity',
      type: 'credentials',
      credentials: {
        code: { label: 'Authorization Code', type: 'text' }
      },
      async authorize(credentials) {
        console.log("authorize credentials", credentials);
        try {
          const code = credentials?.code as string | undefined;
          if (!code) return null;

          const clientId = process.env.IDENTITY_CLIENT_ID || process.env.CLIENT_ID || '';
          const clientSecret = process.env.IDENTITY_CLIENT_SECRET || process.env.CLIENT_SECRET || '';
          if (!clientId || !clientSecret) return null;

          const origin = process.env.NEXTAUTH_URL || 'http://localhost:3000';
          const redirectUri = process.env.IDENTITY_REDIRECT_URI || process.env.REDIRECT_URI || `${origin}/identity`;

          const tokenUrl = new URL('/oauth/token', 'https://hca.dinosaurbbq.org');
          const tokenParams = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          });
          const tokenResp = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString(),
          });
          const tokenJson = await tokenResp.json().catch(() => null);
          if (!tokenResp.ok || !tokenJson?.access_token) return null;

          const meUrl = new URL('/api/v1/me', 'https://hca.dinosaurbbq.org');
          const meResp = await fetch(meUrl, { headers: { Authorization: `Bearer ${tokenJson.access_token}` }, cache: 'no-store' });
          const meJson = await meResp.json().catch(() => null);
          if (!meResp.ok || !meJson) return null;
          const me = meJson && typeof meJson === 'object' && 'identity' in meJson ? (meJson as any).identity : meJson;

          console.log("got here with me", me);

          const email = (me?.primary_email || '').toString().trim();
          if (!email) return null;

          const name = ((me?.first_name || '') + ' ' + (me?.last_name || '')).trim() || null;
          // Try to construct Slack avatar URL from slack_id if available
          const image = me?.slack_id
            ? `https://avatars.slack-edge.com/2024-01-01/${me.slack_id}_1024.jpg`
            : null;
          const isVerified = (me?.verification_status === 'verified') || (me?.verified === true);

          // Upsert user and persist identity token
          // const existing = await prisma.user.findUnique({ where: { email } });
          const userRecord = await prisma.user.upsert({
            where: { email },
            update: {
              name: name ?? undefined,
              image: image ?? undefined,
              identityToken: tokenJson.access_token,
              emailVerified: isVerified ? undefined : undefined, // Do not overwrite emailVerified if not verified
            },
            create: {
              email,
              name: name ?? undefined,
              image: image ?? undefined,
              identityToken: tokenJson.access_token,
              emailVerified: isVerified ? new Date() : undefined,
            },
          });

          // If the user is now verified, and they weren't before, update emailVerified
          if (isVerified && !userRecord.emailVerified) {
            await prisma.user.update({
              where: { id: userRecord.id },
              data: { emailVerified: new Date() },
            });
            userRecord.emailVerified = new Date();
          }

          console.log("got here with userRecord", userRecord);

          return {
            id: userRecord.id,
            email: userRecord.email,
            name: userRecord.name ?? undefined,
            image: userRecord.image ?? undefined,
          } as any;
        } catch {
          return null;
        }
      },
    }),
    SlackProvider({
      clientId: process.env.SLACK_CLIENT_ID ?? "",
      clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true // Allow linking accounts with same email
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER as string,
      from: process.env.EMAIL_FROM as string,
      maxAge: 60 * 10, // make email links valid for 10 minutes
      generateVerificationToken: async () => {
        // Generate a more secure token that matches NextAuth's expectations
        return new Promise((resolve, reject) => {
          randomBytes(32, (err, buf) => {
            if (err) reject(err);
            else resolve(buf.toString('hex'));
          });
        });
      },
      sendVerificationRequest: async ({ identifier: email, url, token, provider }) => {
        // Customize the verification email
        const { host } = new URL(url);
        try {
          const date = new Date();
          const datetime = `[${date.getDate()}/${date.getMonth()}/${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}] `
          await sendAuthEmail(email, host, url, datetime);
          metrics.increment("success.send_auth_email", 1);
        } catch (err) {
          metrics.increment("errors.send_auth_email", 1);
        }
     },
    })
  ],
  callbacks: {
    async session({ session, user }) {
      // With database strategy, we get the fresh user data on every request
      // Check if user is an island attendee
      const { isAttendee } = await import('@/lib/userTags');
      const isAttendeeFlag = await isAttendee(user.id);
      
      return {
        ...session,
        user: {
          ...session.user,
          id: user.id,
          hackatimeId: user.hackatimeId,
          name: user.name,
          image: user.image,
          role: user.role,
          isAdmin: user.isAdmin,
          status: user.status,
          emailVerified: user.emailVerified,
          isAttendee: isAttendeeFlag
        }
      };
    },
    async signIn({ user, account, profile }) {
      // Log the sign in attempt
      console.log('Sign in attempt:', {
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
      if (account?.provider === 'email') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
          include: { accounts: true }
        });

        if (existingUser) {
          // Update the current user with any existing hackatimeId
          await prisma.user.update({
            where: { id: user.id },
            data: { 
              hackatimeId: existingUser.hackatimeId,
              slack: existingUser.slack
            }
          });
        }
      }
      // TODO: implement check if Slack account exists when signing in with Hack Club Identity

      return true;
    },
    async redirect({ url, baseUrl }) {
      try {
        const parsed = new URL(url, baseUrl);
        const callbackUrl = parsed.searchParams.get('callbackUrl');
        if (callbackUrl) return callbackUrl;
      } catch {}
      return `${baseUrl}/launchpad`;
      // return `${baseUrl}/`;
    }
  },
  pages: {
    signIn: '/launchpad/login',
    verifyRequest: '/launchpad/login/verify',
    error: '/launchpad/login/error',
  },
  debug: true  // Temporarily enable debug mode to see what's happening
}

const handler = NextAuth(opts)

export { handler as GET, handler as POST }
