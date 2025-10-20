"use client";
import { SessionProvider } from "next-auth/react";
import Header from "@/components/common/Header";
import { useSession } from "next-auth/react";

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PageShell>{children}</PageShell>
    </SessionProvider>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'transparent' }}>
      <Header session={session as any} status={(status as any) || 'unauthenticated'} />
      <main className="flex-1 pt-16">{children}</main>
    </div>
  );
}