'use client'

import { useContext } from "react";
import { ScrollProgressContext } from "./Story";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import TriggerButton from "./TriggerButton";

// import { motion } from "motion/react";

export default function Bay({ start, end, previous, next }:{ start: number, end: number, previous: number, next: number }) {
  const [scrollPercent] = useContext(ScrollProgressContext);

  const startWithWaveOffset = start + 0.075;
  const endWithWaveOffset = end - 0.075;

  const duration = endWithWaveOffset - startWithWaveOffset

  const subsections = {
    intro: { start: start, end: startWithWaveOffset + (duration * 1 / 3) },
    viral: { start: startWithWaveOffset + (duration * 1 / 3), end: startWithWaveOffset + (duration * 2 / 3) },
    teamwork: { start: startWithWaveOffset + (duration * 2 / 3), end: endWithWaveOffset },
  }
  
  return (
    <div className="fixed inset-0 z-0">
      <div className="h-screen w-screen aspect-video flex" style={{
        backgroundImage: `url('/bay.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "center right",
      }}>
        <div className="absolute top-8 right-8 z-50">
          <TriggerButton targetPercent={1} waves>Sign up</TriggerButton>
        </div>
        
      </div>
    </div>
  )
}