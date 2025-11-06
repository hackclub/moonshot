'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  [key: string]: any;
}

/**
 * Check if a URL looks like a valid image URL
 */
const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  
  // Check if it's a valid HTTP/HTTPS URL
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
  } catch {
    // If URL parsing fails, it's not a valid URL
    return false;
  }
  
  return true;
};

/**
 * ImageWithFallback component that handles image loading errors
 * and displays a fallback UI when images fail to load
 */
const ImageWithFallback = ({ src, alt, ...props }: ImageWithFallbackProps) => {
  const [imgSrc, setImgSrc] = useState(src);
  const [error, setError] = useState(!isValidImageUrl(src));

  useEffect(() => {
    setImgSrc(src);
    setError(!isValidImageUrl(src));
  }, [src]);

  if (error || !isValidImageUrl(src)) {
    return (
      <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
        <span className="text-gray-500">Image could not be loaded</span>
      </div>
    );
  }

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      onError={() => setError(true)}
    />
  );
};

export default ImageWithFallback; 