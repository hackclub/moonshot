"use client"
import { SessionProvider } from "next-auth/react";
import Header from "@/components/common/Header";
import { useSession } from "next-auth/react";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionWrapper>
        {children}
      </SessionWrapper>
    </SessionProvider>
  );
}

function SessionWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  // Only show header when authenticated
  if (status === "authenticated") {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'transparent' }}>
        <Header session={session} status={status} />
        <main className="flex-1 pt-24">{children}</main>
      </div>
    );
  }
  
  // When not authenticated, just show children (which will handle its own auth flow)
  return children;
} 