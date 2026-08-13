'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/StatusBadge';
import { PhoneCall, CheckCircle2, XCircle, Activity } from 'lucide-react';

// Utility to mask sensitive data (PII) like phone numbers and emails
function maskSensitiveData(text: string) {
  if (!text) return text;
  // Mask phone numbers (10 digits) - e.g. 9876543210 -> 98******10
  let masked = text.replace(/\b(\d{2})\d{6}(\d{2})\b/g, '$1******$2');
  
  // Mask emails - e.g. user@gmail.com -> u***@gmail.com
  masked = masked.replace(/\b([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, '$1***$2');
  
  return masked;
}

export default function EscalationsDashboard() {
  const [escalations, setEscalations] = useState([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loadingEscalations, setLoadingEscalations] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch escalations
      try {
        const res = await fetch(`/api/escalations_data?t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setEscalations(data.reverse());
        }
      } catch (err) {
        console.error('Failed to fetch escalations', err);
      } finally {
        setLoadingEscalations(false);
      }

      // Fetch analytics
      try {
        const res = await fetch(`/api/analytics?t=${new Date().getTime()}`);
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error('Failed to fetch analytics', err);
      } finally {
        setLoadingAnalytics(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const totalCalls = analytics.length;
  const successfulCalls = analytics.filter(log => log.status === 'Success').length;
  const failedCalls = analytics.filter(log => log.status === 'Failed').length;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  return (
    <div className="bg-radial-navy relative min-h-screen w-full flex-col overflow-x-hidden p-8 font-body text-off-white selection:bg-amber/30">
      {/* Absolute background grid with vignette mask, separated from content */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-radar-grid"></div>

      <div className="mx-auto max-w-6xl relative z-10">
        <div className="mb-10 flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-off-white mb-2 flex items-center gap-3">
              <Activity className="w-8 h-8 text-amber" />
              Admin Dashboard
            </h1>
            <p className="font-mono text-xs tracking-widest text-slate-500 uppercase">Live Call Analytics & Human Escalations</p>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="mb-12">
          <h2 className="font-mono text-lg font-bold tracking-widest text-white mb-4 uppercase">System Analytics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-700 bg-[#1e293b]/80 backdrop-blur-sm p-6 shadow-xl">
              <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-400 uppercase">Total Calls</h3>
                <PhoneCall className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-white">{loadingAnalytics ? '-' : totalCalls}</div>
                <p className="font-mono text-[10px] text-slate-500 mt-2 uppercase">All recorded sessions</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-[#1e293b]/80 backdrop-blur-sm p-6 shadow-xl">
              <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-400 uppercase">Successful</h3>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-emerald-400">{loadingAnalytics ? '-' : successfulCalls}</div>
                <p className="font-mono text-[10px] text-slate-500 mt-2 uppercase">Actionable outcomes</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-[#1e293b]/80 backdrop-blur-sm p-6 shadow-xl">
              <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-400 uppercase">Failed</h3>
                <XCircle className="h-4 w-4 text-rose-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-rose-400">{loadingAnalytics ? '-' : failedCalls}</div>
                <p className="font-mono text-[10px] text-slate-500 mt-2 uppercase">Dropped / Unfulfilled</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-[#1e293b]/80 backdrop-blur-sm p-6 shadow-xl">
              <div className="flex flex-row items-center justify-between pb-2">
                <h3 className="font-mono text-xs font-semibold tracking-widest text-slate-400 uppercase">Success Rate</h3>
                <Activity className="h-4 w-4 text-indigo-400" />
              </div>
              <div>
                <div className="text-3xl font-bold text-indigo-400">{loadingAnalytics ? '-' : `${successRate}%`}</div>
                <p className="font-mono text-[10px] text-slate-500 mt-2 uppercase">Overall performance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Escalations Section */}
        <div>
          <h2 className="font-mono text-lg font-bold tracking-widest text-white mb-4 uppercase flex items-center justify-between">
            Active Escalations
          </h2>
          
          {loadingEscalations ? (
            <div className="py-12 text-center font-mono text-slate-500">Loading escalations...</div>
          ) : escalations.length === 0 ? (
            <div className="rounded-xl border border-line bg-navy-800/50 py-16 text-center font-mono text-slate-400 shadow-xl">
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
                      <p className="mt-1 font-medium text-white text-lg">{maskSensitiveData(req.who)}</p>
                    </div>
                    
                    <div className="mb-5">
                      <h3 className="font-mono text-xs font-semibold tracking-widest text-amber/80 uppercase">What Happened</h3>
                      <p className="mt-1 text-base text-slate-200 leading-relaxed">{maskSensitiveData(req.what_happened)}</p>
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
    </div>
  );
}
