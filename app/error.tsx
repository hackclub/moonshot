'use client';

import { useEffect } from 'react';
import Image from 'next/image';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
      <div className="rounded-lg shadow-lg text-center max-w-md p-8 border" style={{ backgroundColor: 'rgba(17,24,39,1)', borderColor: 'rgba(255,255,255,0.1)', color: 'var(--foreground)' }}>
        <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>Your rocket exploded!</h1>
        <p className="text-base mb-6" style={{ color: 'var(--foreground)' }}>
          An unexpected error occurred.
        </p>
        <button
          onClick={reset}
          className="py-2 px-4 rounded-md border transition cursor-pointer"
          style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(255,255,255,0.2)' }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
} 