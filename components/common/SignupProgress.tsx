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
    <div className="relative z-20 h-6 w-80 rounded-t-lg border-2 border-b-0 border-[#333333] bg-[#333333] md:w-96">
    <p className="font-quintessential relative bottom-8 w-full text-center text-lg">
      {progress}% to liftoff
    </p>
    <div
      style={{ width: `${progress}%` }}
      className="absolute top-0 left-0 h-full rounded-t-lg bg-red-500"
    ></div>
  </div>
  );
} 