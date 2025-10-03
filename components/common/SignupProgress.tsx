'use client';

import { useEffect, useState } from 'react';
import ProgressBar from './ProgressBar';

export default function SignupProgress() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        console.log("client received count", data);
        setCount(data.count);
      } catch (error) {
        console.error('Error fetching signup count:', error);
      }
    };

    // Fetch immediately
    fetchCount();

    // Then fetch every 10 seconds
    const interval = setInterval(fetchCount, 10000);

    return () => clearInterval(interval);
  }, []);

  if (count === null) return null;

  const progress = Math.min((count / 5000) * 100, 100);

  return (
    <div className="bg-sand/60 border border-sand p-2 rounded-md backdrop-blur-md text-dark-brown mb-2">
      <h2 className="text-lg font-bold mb-1">🎉 Submit your projects to Moonshot!</h2>
      <ProgressBar earnedProgress={progress} showLabels={false} compact className="mb-1" />
      <p className="text-xs sm:text-sm">
        RSVPs so far: <span className="font-semibold">{count.toLocaleString()}</span>
      </p>
    </div>
  );
} 