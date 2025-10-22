'use client';
import { useEffect, useState } from "react";
import LoginOptions from "./options";
import { useRouter } from "next/navigation";

// Login Page (/launchpad/login)
export default function LoginPage() {
  const [visible, setVisible] = useState(false);

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
      <LoginOptions />
    </div>
  );
}

import AccessDenied from '@/components/common/AccessDenied';
