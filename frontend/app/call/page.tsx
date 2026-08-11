'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react';
import { CallExperience } from '@/components/CallExperience';
import { Seismograph } from '@/components/Seismograph';
import { StatusBadge } from '@/components/StatusBadge';

type Phase =
  | 'ready'
  | 'requesting-mic'
  | 'mic-denied'
  | 'fetching-token'
  | 'token-error'
  | 'incoming-call'
  | 'live'
  | 'ended';

export default function CallPage() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [tokenInfo, setTokenInfo] = useState<{ token: string; url: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleStartConversation = async (isOutbound = false) => {
    setPhase('requesting-mic');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately, we just needed permission
      stream.getTracks().forEach((track) => track.stop());

      // Permission granted, fetch token
      setPhase('fetching-token');
      const storedUserId = localStorage.getItem('rakshika_user_id');
      const base = storedUserId ? `/api/token?userId=${storedUserId}` : '/api/token';
      const url = isOutbound ? (base.includes('?') ? `${base}&outbound=true` : `${base}?outbound=true`) : base;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch token: ${res.statusText}`);
      }
      const data = await res.json();
      if (!data.participantToken || !data.serverUrl) {
        throw new Error('Invalid token response from server');
      }
      
      if (!storedUserId && data.participantIdentity) {
        localStorage.setItem('rakshika_user_id', data.participantIdentity);
      }
      
      setTokenInfo({ token: data.participantToken, url: data.serverUrl });
      setPhase('live');
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
          setPhase('mic-denied');
        } else {
          setErrorMsg(err.message || 'An unknown error occurred');
          setPhase('token-error');
        }
      } else {
        setErrorMsg('An unknown error occurred');
        setPhase('token-error');
      }
    }
  };

  const handleReset = () => {
    setTokenInfo(null);
    setPhase('ready');
  };

  // Shared wrapper for transitions
  const PhaseShell = ({ children, keyName }: { children: React.ReactNode; keyName: string }) => (
    <motion.div
      key={keyName}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-4 text-center"
    >
      {children}
    </motion.div>
  );

  return (
    <main className="bg-radial-navy bg-radar-grid relative flex h-screen w-full flex-col overflow-hidden">
      {/* Header */}
      <header className="z-10 flex w-full flex-col items-center justify-between gap-4 p-6 sm:flex-row">
        <Link
          href="/"
          className="group focus-visible:outline-amber flex items-center gap-3 rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <div className="bg-navy-800 border-line font-display text-off-white flex h-8 w-8 items-center justify-center rounded border font-bold">
            R
          </div>
          <div className="flex flex-col text-left">
            <span className="font-display text-off-white text-lg leading-none font-bold tracking-tight">
              RAKSHIKA
            </span>
            <span className="mt-1 font-mono text-[10px] tracking-widest text-slate-500 uppercase">
              Disaster response desk
            </span>
          </div>
        </Link>
        <div className="hidden sm:flex items-center gap-4 text-slate-500 font-mono text-[10px] tracking-widest uppercase">
          MURF FALCON &middot; LIVEKIT &middot; DEEPGRAM NOVA-3
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative flex h-full w-full flex-1 flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === 'ready' && (
            <PhaseShell keyName="ready">
              <StatusBadge color="slate">Standing by</StatusBadge>
              <h2 className="font-display text-off-white mt-8 mb-8 text-4xl font-bold tracking-tight">
                Ready to assist
              </h2>

              <div className="mb-12 grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  'Evacuation Routes',
                  'First Aid Guidance',
                  'Shelter Info',
                  'Emergency Contacts',
                ].map((item) => (
                  <motion.div
                    key={item}
                    className="bg-navy-800/50 border-line rounded-lg border p-4 text-left font-mono text-sm text-slate-400"
                    whileHover={{ x: 6, color: 'var(--off-white)' }}
                  >
                    {item}
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row w-full sm:w-auto">
                <motion.button
                  onClick={() => handleStartConversation(false)}
                  className="bg-amber text-navy-950 font-display hover:bg-amber/90 focus-visible:outline-amber inline-flex w-full items-center justify-center rounded-full px-8 py-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Start conversation
                </motion.button>
                <motion.button
                  onClick={() => setPhase('incoming-call')}
                  className="border border-amber text-amber font-display hover:bg-amber/10 focus-visible:outline-amber inline-flex w-full items-center justify-center rounded-full px-8 py-4 font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 sm:w-auto"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Simulate Incoming Call
                </motion.button>
              </div>

              <div className="mt-8 font-mono text-[10px] leading-relaxed text-slate-500 sm:text-xs">
                For life-threatening emergencies, contact local emergency services directly.
                Rakshika provides general guidance only.
              </div>
            </PhaseShell>
          )}

          {phase === 'incoming-call' && (
            <PhaseShell keyName="incoming-call">
              <StatusBadge color="green" pulse>
                Incoming Call
              </StatusBadge>
              <h2 className="font-display text-off-white mt-8 mb-4 text-4xl font-bold tracking-tight">
                Rakshika
              </h2>
              <p className="font-mono text-slate-400 mb-12">Emergency Response System</p>
              
              <div className="flex gap-8">
                <motion.button
                  onClick={() => setPhase('ready')}
                  className="bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 flex h-20 w-20 items-center justify-center rounded-full transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Decline
                </motion.button>
                <motion.button
                  onClick={() => handleStartConversation(true)}
                  className="bg-safe-green text-navy-950 hover:bg-safe-green/90 flex h-20 w-20 items-center justify-center rounded-full transition-colors shadow-[0_0_20px_rgba(34,197,94,0.4)] animate-pulse"
                  whileHover={{ scale: 1.05, animation: 'none' }}
                  whileTap={{ scale: 0.95 }}
                >
                  Answer
                </motion.button>
              </div>
            </PhaseShell>
          )}

          {phase === 'requesting-mic' && (
            <PhaseShell keyName="requesting-mic">
              <StatusBadge color="amber" pulse>
                Requesting Microphone
              </StatusBadge>
              <div className="my-12 w-full">
                <Seismograph mode="connecting" />
              </div>
              <p className="font-body text-slate-400">
                Please allow microphone access in your browser prompt to continue.
              </p>
            </PhaseShell>
          )}

          {phase === 'fetching-token' && (
            <PhaseShell keyName="fetching-token">
              <StatusBadge color="amber" pulse>
                Connecting
              </StatusBadge>
              <div className="my-12 w-full">
                <Seismograph mode="connecting" />
              </div>
              <p className="font-body text-slate-400">
                Establishing secure connection to the response desk...
              </p>
            </PhaseShell>
          )}

          {phase === 'mic-denied' && (
            <PhaseShell keyName="mic-denied">
              <StatusBadge color="red">Microphone Blocked</StatusBadge>
              <h2 className="font-display text-off-white mt-6 mb-4 text-3xl font-bold">
                We can&apos;t hear you yet
              </h2>
              <p className="font-body mb-8 max-w-md text-slate-400">
                Your browser has blocked microphone access. Rakshika needs to hear your voice to
                assist you.
              </p>

              <ol className="font-body bg-navy-900 border-line mb-10 w-full max-w-sm space-y-3 rounded-lg border p-6 text-left text-sm text-slate-400">
                <li>1. Click the lock icon in your address bar.</li>
                <li>2. Find &quot;Microphone&quot; in the menu.</li>
                <li>3. Change the setting to &quot;Allow&quot;.</li>
                <li>4. Click try again below.</li>
              </ol>

              <motion.button
                onClick={handleStartConversation}
                className="border-line text-off-white hover:bg-navy-800 rounded-full border px-6 py-3 font-mono text-sm font-medium transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Try again
              </motion.button>
            </PhaseShell>
          )}

          {phase === 'token-error' && (
            <PhaseShell keyName="token-error">
              <StatusBadge color="red">Connection Error</StatusBadge>
              <h2 className="font-display text-off-white mt-6 mb-4 text-3xl font-bold">
                Connection Failed
              </h2>
              <p className="text-alert-red bg-alert-red/10 border-alert-red/20 mb-10 max-w-md rounded border p-4 font-mono text-sm break-words">
                {errorMsg}
              </p>
              <motion.button
                onClick={handleStartConversation}
                className="border-line text-off-white hover:bg-navy-800 rounded-full border px-6 py-3 font-mono text-sm font-medium transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Retry connection
              </motion.button>
            </PhaseShell>
          )}

          {phase === 'ended' && (
            <PhaseShell keyName="ended">
              <StatusBadge color="slate">Call Ended</StatusBadge>
              <div className="my-12 w-full opacity-30">
                <Seismograph mode="idle" />
              </div>
              <h2 className="font-display text-off-white mb-10 text-3xl font-bold tracking-tight">
                Conversation ended
              </h2>
              <motion.button
                onClick={handleReset}
                className="bg-off-white text-navy-950 font-display rounded-full px-8 py-3 font-semibold transition-colors hover:bg-slate-300"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                Start again
              </motion.button>
            </PhaseShell>
          )}

          {phase === 'live' && tokenInfo && (
            <motion.div
              key="live"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 h-full w-full"
            >
              <LiveKitRoom
                serverUrl={tokenInfo.url}
                token={tokenInfo.token}
                connect={true}
                audio={true}
                video={false}
                onDisconnected={() => setPhase('ended')}
                onError={(err) => {
                  setErrorMsg(err.message);
                  setPhase('token-error');
                }}
                className="h-full w-full"
              >
                <RoomAudioRenderer />
                <CallExperience />
              </LiveKitRoom>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
