'use client';
import { useEffect, useState } from 'react';
import styles from './LoadingModal.module.css';

interface LoadingModalProps {
  onLoadComplete: () => void;
  titles: string[];
  imageUrls: string[];
}

const LoadingModal: React.FC<LoadingModalProps> = ({ 
  onLoadComplete, 
  titles,
  imageUrls 
}) => {
  const [progress, setProgress] = useState(0);
  const [showLoader, setShowLoader] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(() => 
    titles[Math.floor(Math.random() * titles.length)]
  );
  
  const areImagesCached = async (): Promise<boolean> => {
    // Always return false to force showing the loader
    return false;
  };

  const preloadImages = async () => {
    const imageCount = imageUrls.length;
    let loadedCount = 0;

    const loadImage = (src: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / imageCount) * 100));
          resolve();
        };
        img.onerror = () => {
          loadedCount++;
          setProgress(Math.round((loadedCount / imageCount) * 100));
          resolve();
        };
        img.src = src;
      });
    };

    // Load all images
    const imagePromises = imageUrls.map(url => loadImage(url));

    try {
      await Promise.all(imagePromises);
      setTimeout(() => {
        onLoadComplete();
      }, 500);
    } catch (error) {
      console.error('Error preloading images:', error);
      setTimeout(() => {
        onLoadComplete();
      }, 1000);
    }
  };

  useEffect(() => {
    const checkCacheAndLoad = async () => {
      const cached = await areImagesCached();
      if (cached) {
        // If all images are cached, skip the loader
        onLoadComplete();
      } else {
        // If not all images are cached, show loader and preload
        setShowLoader(true);
        preloadImages();
      }
    };

    checkCacheAndLoad();
  }, [onLoadComplete, imageUrls]);

  // Rotate through titles every 2 seconds
  useEffect(() => {
    if (!showLoader) return;
    
    const interval = setInterval(() => {
      setCurrentTitle(prevTitle => {
        // Get all titles except the current one
        const otherTitles = titles.filter(t => t !== prevTitle);
        // Pick a random one
        return otherTitles[Math.floor(Math.random() * otherTitles.length)];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [showLoader, titles]);

  if (!showLoader) return null;

  return (
    <div className="loading-modal-cosmic">
      <div className="stellar-background" aria-hidden="true">
        <div className="nebula-layer"></div>
        <div className="starfield-layer"></div>
        <div className="shooting-stars"></div>
      </div>
      
      <div className="loading-container">
        <h1 className="loading-title">{currentTitle}</h1>
        <div className="cosmic-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-subtitle">Preparing your cosmic journey</p>
      </div>
      
      <style jsx>{`
        .loading-modal-cosmic {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #0a0a0a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          z-index: 1000;
        }
        
        .stellar-background {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        
        .nebula-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(ellipse at 20% 30%, rgba(139, 92, 246, 0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(59, 130, 246, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 40% 70%, rgba(139, 92, 246, 0.2) 0%, transparent 50%);
          animation: nebulaDrift 15s ease-in-out infinite;
        }
        
        .starfield-layer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: 
            radial-gradient(2px 2px at 20% 30%, #ffffff, transparent),
            radial-gradient(2px 2px at 40% 70%, #8b5cf6, transparent),
            radial-gradient(1px 1px at 90% 40%, #3b82f6, transparent),
            radial-gradient(2px 2px at 10% 80%, #ffffff, transparent),
            radial-gradient(1px 1px at 60% 20%, #8b5cf6, transparent);
          background-repeat: no-repeat;
          background-size: 100% 100%;
          animation: starTwinkle 3s ease-in-out infinite;
        }
        
        .shooting-stars {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        .shooting-stars::before,
        .shooting-stars::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          background: #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 20px #ffffff, 0 0 30px #8b5cf6;
        }
        
        .shooting-stars::before {
          top: 20%;
          left: 10%;
          animation: shootingStar 3s linear infinite;
        }
        
        .shooting-stars::after {
          top: 60%;
          left: 80%;
          animation: shootingStar 4s linear infinite 2s;
        }
        
        .loading-container {
          text-align: center;
          z-index: 10;
          position: relative;
        }
        
        .loading-title {
          font-size: 2.5rem;
          font-weight: bold;
          color: #ffffff;
          margin-bottom: 2rem;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
          animation: glow 2s ease-in-out infinite alternate;
          font-family: var(--font-kavoon), 'Kavoon', cursive;
        }
        
        .loading-subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 1.2rem;
          margin-top: 1rem;
        }
        
        .cosmic-spinner {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 2rem auto;
        }
        
        .spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top: 3px solid #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .spinner-ring:nth-child(2) {
          width: 70%;
          height: 70%;
          top: 15%;
          left: 15%;
          border-top-color: #3b82f6;
          animation-duration: 1.5s;
          animation-direction: reverse;
        }
        
        .spinner-ring:nth-child(3) {
          width: 40%;
          height: 40%;
          top: 30%;
          left: 30%;
          border-top-color: #ffffff;
          animation-duration: 2s;
        }
        
        @keyframes nebulaDrift {
          0%, 100% { transform: translateX(0px) translateY(0px) rotate(0deg); opacity: 0.6; }
          25% { transform: translateX(-20px) translateY(-10px) rotate(1deg); opacity: 0.8; }
          50% { transform: translateX(10px) translateY(-20px) rotate(-1deg); opacity: 0.7; }
          75% { transform: translateX(-15px) translateY(-5px) rotate(0.5deg); opacity: 0.9; }
        }
        
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.6; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.5); }
        }
        
        @keyframes shootingStar {
          0% { transform: translateX(0) translateY(0); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translateX(400px) translateY(200px); opacity: 0; }
        }
        
        @keyframes glow {
          from { text-shadow: 0 0 20px rgba(255, 255, 255, 0.5); }
          to { text-shadow: 0 0 30px rgba(255, 255, 255, 0.8), 0 0 40px rgba(139, 92, 246, 0.3); }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingModal; 