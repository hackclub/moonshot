"use client"
import { SessionProvider } from "next-auth/react";
import Header from "@/components/common/Header";
import { useSession } from "next-auth/react";

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionWrapper>
        <div className="theme-reset">{children}</div>
      </SessionWrapper>
    </SessionProvider>
  );
}

function SessionWrapper({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  // Only show header when authenticated
  if (status === "authenticated") {
    return (
      <>
        <Header 
          session={session}
          status={status}
        />
        <div className="theme-reset">{children}</div>
      </>
    );
  }
  
  // When not authenticated, just show children (which will handle its own auth flow)
  return <div className="theme-reset">{children}</div>;
} 