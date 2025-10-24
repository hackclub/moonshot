"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

function IdentityCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading'|'success'|'error'|'pending'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setMessage('No authorization code found in the URL.');
      return;
    }

    async function completeLogin() {
      setStatus('loading');
      try {
        // Delegate session creation to NextAuth Credentials provider
        // const result = await signIn('credentials', { code, callbackUrl: '/launchpad/login/success', redirect: true });
        const result = await signIn('identity', { code, redirect: true });
        // const result = {};
  
        // console.log("result", result);
        // When redirect: true, NextAuth navigates away. If it returns, treat as error.
        if (result === undefined) return; // navigation initiated
        setStatus('error');
        setMessage('Failed to start session. Please try again.');
      } catch {
        setStatus('error');
        setMessage('Failed to start session. Please try again.');
      }
    }
    completeLogin();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Identity Verification</h1>
        {status === 'loading' && <p className="mb-4">Verifying your identity...</p>}
        {status === 'success' && <p className="mb-4 text-green-600">{message}</p>}
        {status === 'pending' && <p className="mb-4 text-yellow-600">{message}</p>}
        {status === 'error' && (
          <p className="mb-4 text-red-600">
            {message.includes('identity.hackclub.com') ? (
              <>
                Your submission got rejected! Go to{' '}
                <a 
                  href="https://identity.hackclub.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline hover:text-red-800"
                >
                  identity.hackclub.com
                </a>{' '}
                to fix.
              </>
            ) : (
              message
            )}
          </p>
        )}
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => router.push('/launchpad')}
        >
          Return to Moonshot
        </button>
      </div>
    </div>
  );
}

export default function IdentityCallback() {
  return (
    <SessionProvider>
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded shadow max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Identity Verification</h1>
          <p className="mb-4">Loading...</p>
        </div>
      </div>
    }>
      <IdentityCallbackContent />
    </Suspense>
  </SessionProvider>
  );
} 
