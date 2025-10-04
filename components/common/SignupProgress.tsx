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

  const safeCount = count ?? 0;
  const progress = Math.min((safeCount / 5000) * 100, 100);

  return (
    <div className="relative z-20 mb-4 flex w-full flex-col items-center">
      <p className="font-luckiest text-sm md:text-base mb-1">
        {safeCount}/5000
      </p>
      <div className="relative h-3 w-72 md:w-96 rounded-full border border-[#333333] bg-[#333333] overflow-hidden">
        <div
          style={{ width: `${progress}%` }}
          className="absolute top-0 left-0 h-full rounded-full bg-[#7EA6FF]"
        ></div>
      </div>
    </div>
  );
} 