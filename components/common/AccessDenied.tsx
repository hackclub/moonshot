'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  redirectTo?: string;
  fadeMs?: number;
};

export default function AccessDenied({ redirectTo = '/launchpad/login', fadeMs = 1000 }: Props) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setVisible(true), 10);
    const redirectTimer = setTimeout(() => {
      router.push(redirectTo);
    }, 1750);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(redirectTimer);
    };
  }, [router, redirectTo]);

  return (
    <div className="fixed inset-0">
      <div className="relative flex items-center justify-center h-full">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${Math.max(100, fadeMs)}ms ease-in`,
            display: 'inline-block'
          }}
          className="text-center"
        >
          <p className="text-5xl md:text-6xl font-serif text-white font-bold">
            Redirecting you to the login page...
          </p>
        </div>
      </div>
    </div>
  );
}


