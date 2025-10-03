'use client'

import { useContext } from "react";
import { ScrollProgressContext } from "./Story";
import { AnimatePresence, motion } from "motion/react";
import TriggerButton from "./TriggerButton";
import Image from "next/image";
// import { motion } from "motion/react";

// 0.45 - 0.55
export default function Info({ start, end, previous, next }: { start: number, end: number, previous: number, next: number }) {
  const [scrollPercent, scrollToPercent] = useContext(ScrollProgressContext);

  const middle = start + (end - start) / 2;

  return (
    <div className="fixed inset-0 z-0">
      <div className="h-screen w-screen aspect-video flex " style={{
        backgroundImage: `url('/hut.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "right center",
      }}>
        <div className="w-screen h-screen flex flex-col items-start justify-center p-8 relative text-dark-brown">
          <div className="bg-sand/60 border border-sand p-6 rounded-md w-full max-w-4xl backdrop-blur-md">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">What&apos;s Hack Club Moonshot?</h1>            
          </div>
        </div>        
      </div>
    </div>
  )
}