'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/StatusBadge';

export default function EscalationsDashboard() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEscalations = async () => {
      try {
        const res = await fetch(`/escalations.json?t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setEscalations(data.reverse());
        }
      } catch (err) {
        console.error('Failed to fetch escalations', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEscalations();
    const interval = setInterval(fetchEscalations, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-radial-navy relative min-h-screen w-full flex-col overflow-x-hidden p-8 font-body text-off-white">
      {/* Absolute background grid with vignette mask, separated from content */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-radar-grid"></div>

      <div className="mx-auto max-w-6xl relative z-10">
        <div className="mb-12 flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-off-white mb-2">Human Escalation Dashboard</h1>
            <p className="font-mono text-xs tracking-widest text-slate-500 uppercase">Live feed of critical requests escalated by Rakshika</p>
          </div>
          <div className="mt-4 sm:mt-0">
            <StatusBadge color="amber" pulse>Live System Active</StatusBadge>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center font-mono text-slate-500">Loading escalations...</div>
        ) : escalations.length === 0 ? (
          <div className="rounded-xl border border-line bg-navy-800/50 py-16 text-center font-mono text-slate-400">
            No open escalations at the moment. All clear.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {escalations.map((req: any, index: number) => (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -5, boxShadow: '0 0 20px rgba(245, 158, 11, 0.15)' }}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-700 bg-[#1e293b] shadow-xl transition-all"
              >
                <div className="border-b border-slate-700 bg-[#0f172a] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-amber">{req.id}</span>
                    <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-400 border border-red-500/30">
                      {req.urgency}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-xs text-slate-400">
                    {new Date(req.timestamp).toLocaleString()}
                  </div>
                </div>
                
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-5">
                    <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">Who Needs Help</h3>
                    <p className="mt-1 font-medium text-white text-lg">{req.who}</p>
                  </div>
                  
                  <div className="mb-5">
                    <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">What Happened</h3>
                    <p className="mt-1 text-base text-slate-200 leading-relaxed">{req.what_happened}</p>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">Agent Checked</h3>
                    <p className="mt-1 text-base text-slate-200 leading-relaxed">{req.what_agent_checked}</p>
                  </div>
                  
                  <div className="mt-auto grid grid-cols-2 gap-4 border-t border-slate-700 pt-5">
                    <div>
                      <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">Language</h3>
                      <p className="mt-1 text-base font-medium text-white">{req.language}</p>
                    </div>
                    <div>
                      <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">Contact</h3>
                      <p className="mt-1 text-base font-medium text-white">{req.preferred_contact}</p>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-slate-700 bg-[#0f172a] p-4">
                  <button className="w-full rounded-md bg-amber/10 border border-amber/20 hover:bg-amber hover:text-navy-950 px-4 py-2 text-sm font-semibold text-amber transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber">
                    Acknowledge Request
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
