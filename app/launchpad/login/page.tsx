'use client';
import { useEffect, useState } from "react";
import LoginOptions from "./options";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Login Page (/launchpad/login)
export default function LoginPage() {
  const [visible, setVisible] = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      signIn("hc-identity", { code, callbackUrl: "/launchpad/login/success" });
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 0.5s ease-in"
      }}
    >
      {/* Home button (top left) */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-[200] font-luckiest uppercase tracking-wide text-white bg-black/70 hover:bg-black/80 transition px-4 py-2 rounded-lg border-2 border-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-black/30"
      >
        ← HOME
      </Link>

      {/* FAQ button (top right) */}
      <Link
        href="/faq"
        className="fixed top-4 right-4 z-[200] font-kavoon uppercase tracking-wide text-white bg-black/70 hover:bg-black/80 transition px-4 py-2 rounded-lg border-2 border-white/90 shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-2 ring-black/30"
      >
        FAQ
      </Link>

      <LoginOptions />
    </div>
  );
}

import AccessDenied from '@/components/common/AccessDenied';import { signIn } from "next-auth/react";

