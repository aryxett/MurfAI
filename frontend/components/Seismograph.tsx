'use client';

import React, { useEffect, useRef } from 'react';

export type SeismoMode = 'idle' | 'connecting' | 'listening' | 'speaking';
export type SeismoAgent = 'rakshika' | 'doctor';

interface SeismographProps {
  mode: SeismoMode;
  amplitude?: number;
  label?: string;
  className?: string;
  /**
   * Which agent is currently active on the call. Only affects color while
   * mode === 'speaking' (rakshika = red, doctor = blue). Defaults to
   * 'rakshika' so existing usages of this component keep working unchanged.
   */
  activeAgent?: SeismoAgent;
}

export function Seismograph({
  mode,
  amplitude = 0,
  label = 'Voice visualizer',
  className = '',
  activeAgent = 'rakshika',
}: SeismographProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let animationFrame: number;
    let time = 0;

    // Configuration
    const POINTS = 96;
    const WIDTH = 640;
    const HEIGHT = 120;
    const CENTER_Y = HEIGHT / 2;
    const DX = WIDTH / (POINTS - 1);

    const render = () => {
      time += 0.05;

      // Update path
      if (pathRef.current) {
        let pathData = `M 0 ${CENTER_Y}`;

        for (let i = 1; i < POINTS; i++) {
          const x = i * DX;
          let y = CENTER_Y;

          if (mode === 'listening') {
            // gentle sine wave
            const wave = Math.sin(i * 0.2 - time * 2) * 12;
            y = CENTER_Y + wave;
          } else if (mode === 'speaking') {
            // jagged layered noise + amplitude scaling
            const targetAmp = 10 + amplitude * 46; // base 10, up to 56
            const freq1 = Math.sin(i * 0.5 - time * 3);
            const freq2 = Math.sin(i * 1.3 + time * 5) * 0.5;
            const noise = Math.random() * 0.4 - 0.2; // slight random noise
            y = CENTER_Y + (freq1 + freq2 + noise) * targetAmp;
          }
          // idle & connecting remain flat

          pathData += ` L ${x} ${y}`;
        }

        pathRef.current.setAttribute('d', pathData);
      }

      // Update dot for connecting mode
      if (dotRef.current) {
        if (mode === 'connecting') {
          dotRef.current.style.display = 'block';
          // Sweep left to right, loop every ~3 seconds
          const progress = (time * 0.5) % 1;
          const x = progress * WIDTH;
          dotRef.current.setAttribute('cx', x.toString());
          // Pulsing opacity
          const opacity = ((Math.sin(time * 4) + 1) / 2) * 0.8 + 0.2;
          dotRef.current.style.opacity = opacity.toString();
        } else {
          dotRef.current.style.display = 'none';
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrame);
  }, [mode, amplitude]);

  // Color mapping based on mode
  let strokeColor = 'var(--line)';
  let filter = 'none';

  if (mode === 'listening') {
    strokeColor = 'var(--safe-green)';
  } else if (mode === 'speaking') {
    strokeColor = activeAgent === 'doctor' ? 'var(--doctor-blue)' : 'var(--alert-red)';
    filter = `drop-shadow(0 0 8px ${strokeColor})`;
  } else if (mode === 'connecting') {
    strokeColor = 'var(--amber)';
  }

  return (
    <div
      className={`relative mx-auto flex w-full max-w-4xl items-center justify-center overflow-hidden ${className}`}
      aria-label={label}
      role="img"
    >
      <svg
        viewBox="0 0 640 120"
        className="h-auto w-full drop-shadow-sm"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Baseline */}
        <line
          x1="0"
          y1="60"
          x2="640"
          y2="60"
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* The Wave Path */}
        <path
          ref={pathRef}
          fill="none"
          stroke={strokeColor}
          strokeWidth={mode === 'speaking' || mode === 'listening' ? '2' : '1'}
          strokeLinejoin="round"
          style={{ transition: 'stroke 300ms ease, filter 300ms ease', filter }}
        />

        {/* Connecting sweep dot */}
        <circle
          ref={dotRef}
          cx="0"
          cy="60"
          r="4"
          fill="var(--amber)"
          style={{ display: 'none', filter: 'drop-shadow(0 0 4px var(--amber))' }}
        />
      </svg>
    </div>
  );
}
