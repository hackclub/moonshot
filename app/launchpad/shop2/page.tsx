'use client';

import React from 'react';

export default function Shop2Page() {
  // Add custom CSS for slow spin animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin-slow {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .animate-spin-slow {
        animation: spin-slow 8s linear infinite;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-900 relative">
      {/* Full-page image that scales properly */}
      <img
        src="/stardust-shop.png"
        alt="Stardust Shop"
        className="w-full h-auto object-contain"
        style={{
          minHeight: '100vh',
          objectPosition: 'top center'
        }}
      />
      
      {/* Cool overlay with filter effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-indigo-900/40 backdrop-blur-[1px]">
        {/* Animated stars effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-10 left-10 w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <div className="absolute top-20 right-20 w-1 h-1 bg-cyan-300 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute top-32 left-1/4 w-1.5 h-1.5 bg-yellow-300 rounded-full animate-pulse delay-2000"></div>
          <div className="absolute top-40 right-1/3 w-1 h-1 bg-white rounded-full animate-pulse delay-500"></div>
          <div className="absolute top-60 left-1/2 w-2 h-2 bg-blue-300 rounded-full animate-pulse delay-1500"></div>
          <div className="absolute top-80 right-1/4 w-1 h-1 bg-purple-300 rounded-full animate-pulse delay-3000"></div>
        </div>
        
        {/* Disclaimer overlay - Sticky position to follow scroll */}
        <div className="sticky top-0 h-screen flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center pointer-events-auto transform transition-all duration-500 hover:scale-105">
            <div className="mb-6 animate-bounce">
              <img 
                src="/workingCat.png" 
                alt="Working Cat" 
                className="w-20 h-20 mx-auto drop-shadow-lg animate-spin-slow"
                style={{
                  animation: 'spin 8s linear infinite'
                }}
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-purple-400 mb-4 tracking-wide animate-pulse drop-shadow-lg">
              Shop not opened yet...
            </h1>
            <p className="text-xl md:text-2xl text-blue-400 font-semibold mb-4 animate-pulse delay-1000 drop-shadow-lg">
              see ya very soon!!
            </p>
            <div className="flex justify-center space-x-3 mt-6">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce drop-shadow-lg"></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce delay-200 drop-shadow-lg"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce delay-400 drop-shadow-lg"></div>
            </div>
            <div className="mt-4 text-sm text-purple-300 animate-pulse delay-2000 drop-shadow-lg">
              <p>✨ Coming soon with amazing rewards! ✨</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
