"use client";

import { useState, useRef, useEffect } from "react";

export default function Floating({
  children,
  seed,
}: {
  children: React.ReactNode;
  seed: number;
}) {
  const [position, setPosition] = useState({
    x: seed * 800,
    y: seed * 400,
  });
  const [direction, setDirection] = useState({
    x: seed > 0.5 ? 1 : -1,
    y: seed > 0.5 ? -1 : 1,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.parentElement!.clientWidth;
      const containerHeight = containerRef.current.parentElement!.clientHeight;

      setPosition((prevPosition) => {
        const newX = prevPosition.x + direction.x;
        const newY = prevPosition.y + direction.y;
        const newDirection = { ...direction };

        // Check for horizontal boundary collision
        if (newX + 255 >= containerWidth || newX <= 0) {
          newDirection.x *= -1;
        }

        // Check for vertical boundary collision
        if (newY + 255 >= containerHeight || newY <= 0) {
          newDirection.y *= -1;
        }

        setDirection(newDirection);
        return { x: newX, y: newY };
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [direction]);

  return (
    <div
      ref={containerRef}
      style={{
        left: position.x,
        top: position.y,
        animationDuration: "5s",
      }}
      className="absolute z-20 hidden h-[240px] w-[240px] animate-spin md:block"
    >
      {children}
    </div>
  );
}
