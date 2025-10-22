'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import Toast from '@/components/common/Toast';
import './verify.css';

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="verify-standalone">
        {/* Dynamic stellar background */}
        <div className="stellar-background" aria-hidden="true">
          <div className="nebula-layer"></div>
          <div className="starfield-layer"></div>
        </div>

        <div className="container">
          <h1 className="title">Email Verification</h1>
          
          <div className="verify-card">
            <p className="description">
              Please <span className="highlight-text">check your email</span> for a verification link.
            </p>
            <p className="important-text">
              <strong>Important:</strong> Be sure to check your spam or junk folder if you don't see the email in your inbox.
            </p>
            
            {/* Loading spinner centered at bottom */}
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('error');
  const canonical = (process.env.CANONICAL_HOST || '').toLowerCase();

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const email = searchParams.get('email');

      // It is expected for this to be called once with no token or email - we will hit the flow below after user clicks the link in the email
      if (!token || !email) {
        return;
      }

      try {
        console.log('Verifying email with token and email:', { tokenLength: token.length, email });
        
        const response = await fetch(`/api/auth/verify?token=${token}&email=${email}`);
        console.log('Verification API response status:', response.status);
        const data = await response.json();
        console.log('Verification API response:', data);

        if (data.success) {
          console.log('Verification successful, attempting sign in');
          setToastMessage('Email verified successfully! Signing you in...');
          setToastType('success');
          
          // Sign in the user
          console.log('Calling NextAuth signIn with email provider...');
          const result = await signIn('email', {
            email,
            token,
            redirect: false,
          });
          console.log('SignIn result details:', { 
            ok: result?.ok, 
            error: result?.error,
            url: result?.url,
            status: result?.status
          });

          if (result?.ok) {
            console.log('SignIn successful, redirecting to /launchpad');
            // Wait a moment for session to be established
            setTimeout(() => {
              router.push('/launchpad');
            }, 1000);
          } else {
            console.error('SignIn failed:', result?.error);
            setToastMessage('Failed to sign in after verification');
            setToastType('error');
          }
        } else {
          console.error('Verification failed:', data.message);
          setToastMessage(data.message || 'Verification failed');
          setToastType('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setToastMessage('An error occurred during verification');
        setToastType('error');
      }
    };

    // If token/email present, run normal verification
    if (searchParams.get('token') && searchParams.get('email')) {
      verifyEmail();
      return;
    }

    // no dev-magic behavior
  }, [searchParams, router]);

  return (
    <div className="verify-standalone">
      {/* Dynamic stellar background */}
      <div className="stellar-background" aria-hidden="true">
        <div className="nebula-layer"></div>
        <div className="starfield-layer"></div>
      </div>

      <div className="container">
        <h1 className="title">Email Verification</h1>
        
          <div className="verify-card">
            <p className="description">
              Please <span className="highlight-text">check your email</span> for a verification link.
            </p>
            <p className="important-text">
              <strong>Important:</strong> Be sure to check your spam or junk folder if you don't see the email in your inbox.
            </p>
            
            {/* Loading spinner centered at bottom */}
            <div className="loading-spinner"></div>
            
            {/* Toast messages */}
            {toastMessage && (
              <Toast
                message={toastMessage}
                type={toastType}
                onClose={() => setToastMessage(null)}
              />
            )}
          </div>
      </div>
    </div>
  );
} 