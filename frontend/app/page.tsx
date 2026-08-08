'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Seismograph } from '@/components/Seismograph';

const MotionLink = motion.create(Link);

export default function LandingPage() {
  return (
    <main className="bg-radial-navy bg-radar-grid relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      {/* Top Bar (Absolute) */}
      <div className="pointer-events-none absolute top-0 left-0 z-10 flex w-full items-start justify-between p-6">
        <div className="font-mono text-[10px] tracking-widest text-slate-500 uppercase sm:text-xs">
          Voice for Bharat &middot; Day 3
        </div>
        <div className="bg-navy-900/50 border-line text-safe-green flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider uppercase backdrop-blur-sm sm:text-xs">
          <span className="relative flex h-2 w-2">
            <span className="bg-safe-green absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"></span>
            <span className="bg-safe-green relative inline-flex h-2 w-2 rounded-full"></span>
          </span>
          Agent Online
        </div>
      </div>

      {/* Ambient Seismograph Texture */}
      <div className="pointer-events-none absolute bottom-10 left-0 z-0 w-full opacity-10">
        <Seismograph mode="idle" />
      </div>

      {/* Main Centered Content */}
      <motion.div
        className="relative z-10 flex flex-col items-center px-4 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="mb-4 font-mono text-xs tracking-[0.2em] text-slate-500 uppercase sm:text-sm flex flex-col gap-2">
          <span>MURF FALCON &middot; LIVEKIT &middot; DEEPGRAM NOVA-3</span>
        </div>

        <h1 className="font-display text-off-white mb-6 text-6xl font-bold tracking-tighter md:text-8xl">
          RAKSHIKA
        </h1>

        {/* Signature Amber Rule */}
        <div className="bg-amber mb-8 h-1 w-16 rounded-full"></div>

        <p className="font-body mb-10 max-w-[28rem] text-base leading-relaxed text-slate-400 md:text-lg">
          Real-time disaster guidance, evacuation steps, and emergency coordination powered by voice
          AI.
        </p>

        <MotionLink
          href="/call"
          className="bg-amber text-navy-950 font-display hover:bg-amber/90 focus-visible:outline-amber inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          Begin conversation &rarr;
        </MotionLink>

        <div className="mt-8 max-w-sm font-mono text-[10px] leading-relaxed text-slate-500 sm:text-xs">
          For life-threatening emergencies, contact local emergency services directly. Rakshika
          provides general guidance only.
        </div>
      </motion.div>
    </main>
  );
}
