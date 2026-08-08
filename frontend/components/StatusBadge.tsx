import React from 'react';

type BadgeColor = 'slate' | 'amber' | 'green' | 'red';

interface StatusBadgeProps {
  color: BadgeColor;
  pulse?: boolean;
  children: React.ReactNode;
}

const colorMap = {
  slate: {
    border: 'border-slate-500',
    text: 'text-slate-400',
    dot: 'bg-slate-500',
    bg: 'bg-navy-900',
  },
  amber: {
    border: 'border-amber/50',
    text: 'text-amber',
    dot: 'bg-amber',
    bg: 'bg-amber/10',
  },
  green: {
    border: 'border-safe-green/50',
    text: 'text-safe-green',
    dot: 'bg-safe-green',
    bg: 'bg-safe-green/10',
  },
  red: {
    border: 'border-alert-red/50',
    text: 'text-alert-red',
    dot: 'bg-alert-red',
    bg: 'bg-alert-red/10',
  },
};

export function StatusBadge({ color, pulse = false, children }: StatusBadgeProps) {
  const styles = colorMap[color];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs font-medium tracking-widest uppercase ${styles.border} ${styles.text} ${styles.bg}`}
    >
      <div className="relative flex h-2 w-2 items-center justify-center">
        {pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${styles.dot}`}
          ></span>
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${styles.dot}`}></span>
      </div>
      {children}
    </div>
  );
}
