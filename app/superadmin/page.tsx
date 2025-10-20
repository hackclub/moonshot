"use client"

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

export default function SuperAdminPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Function to handle superadmin auth attempt
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      
      const response = await fetch('/api/superadmin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Authentication failed');
      }
      
      // Update the session to include the admin role
      await update();
      
      toast.success('Admin privileges granted!');
      
      // Redirect to admin dashboard after a brief delay
      setTimeout(() => {
        router.push('/admin');
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      toast.error('Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center starspace-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center starspace-bg">
        <div className="bg-black/70 text-white p-8 shadow-lg rounded-lg max-w-md w-full border border-white/10">
          <h1 className="text-2xl font-bold text-center mb-6">Authentication Required</h1>
          <p className="text-white/80 mb-4 text-center">
            You need to be logged in to access the super admin page.
          </p>
          <div className="flex justify-center">
            <a
              href="/api/auth/signin"
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center starspace-bg">
      <div className="bg-black/70 text-white p-8 shadow-lg rounded-lg max-w-md w-full border border-white/10">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Super Admin Authentication</h1>
          <p className="text-white/80">
            Enter the super admin password to gain administrator privileges.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white mb-1">
              Super Admin Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-white/20 bg-black/60 text-white placeholder-white/50 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Enter password"
              autoComplete="off"
            />
            {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              isSubmitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isSubmitting ? 'Authenticating...' : 'Authenticate'}
          </button>
        </form>
      </div>
      <Toaster richColors />
    </div>
  );
} 