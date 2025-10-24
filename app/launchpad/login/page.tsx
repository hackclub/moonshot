'use client';
import { useEffect, useState } from "react";
import LoginOptions from "./options";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Login Page (/launchpad/login)
export default function LoginPage() {
  const [visible, setVisible] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    console.log("from page [/login] session", session);
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0">
      <div className="relative flex items-center justify-center h-full">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.5s ease-in"
          }}
        >
            <LoginOptions />
        </div>
      </div>
    </div>
  );
}

import AccessDenied from '@/components/common/AccessDenied';
