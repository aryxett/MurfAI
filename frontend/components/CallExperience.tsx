'use client';

import React, { useMemo } from 'react';
import { useVoiceAssistant, DisconnectButton, useLocalParticipant, useTrackVolume, useTrackTranscription, TrackToggle, useTracks } from '@livekit/components-react';
import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura';
import { StatusBadge } from './StatusBadge';
import { Track, LocalAudioTrack } from 'livekit-client';

export function CallExperience() {
  const { state, audioTrack, agentTranscriptions } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  
  const microphoneTrack = localParticipant?.getTrackPublication(Track.Source.Microphone)?.track as LocalAudioTrack | undefined;
  
  // Real audio volume for driving amplitude
  const remoteVolume = useTrackVolume(audioTrack);
  const localVolume = useTrackVolume(microphoneTrack);

  const micTracks = useTracks([Track.Source.Microphone]);
  const microphoneTrackRef = micTracks.find(
    (t) => t.participant.identity === localParticipant?.identity
  );
  
  const { segments: userTranscriptions } = useTrackTranscription(microphoneTrackRef);

  // Map state to UI text & color
  const stateConfig = useMemo(() => {
    switch (state) {
      case 'listening':
        return {
          label: 'Listening to you',
          hint: 'Speak now — describe the situation clearly',
          color: 'green' as const,
        };
      case 'thinking':
        return {
          label: 'Processing',
          hint: 'Checking guidance for your situation',
          color: 'amber' as const,
        };
      case 'speaking':
        return {
          label: 'Rakshika is speaking',
          hint: 'Playing back guidance',
          color: 'red' as const,
        };
      default:
        // connecting / initializing / idle
        return {
          label: 'Connecting',
          hint: 'Reaching the response desk — please wait',
          color: 'amber' as const,
        };
    }
  }, [state]);

  const latestAgentText = agentTranscriptions[agentTranscriptions.length - 1]?.text;
  const latestUserText = userTranscriptions[userTranscriptions.length - 1]?.text;

  const [activeSubtitle, setActiveSubtitle] = React.useState({ text: '', label: '', isUser: false });
  const prevAgentText = React.useRef(latestAgentText);
  const prevUserText = React.useRef(latestUserText);

  React.useEffect(() => {
    if (latestAgentText && latestAgentText !== prevAgentText.current) {
      prevAgentText.current = latestAgentText;
      setActiveSubtitle({ text: latestAgentText, label: 'Rakshika', isUser: false });
    }
  }, [latestAgentText]);

  React.useEffect(() => {
    if (latestUserText && latestUserText !== prevUserText.current) {
      prevUserText.current = latestUserText;
      setActiveSubtitle({ text: latestUserText, label: 'You', isUser: true });
    }
  }, [latestUserText]);

  React.useEffect(() => {
    if (!activeSubtitle.text) return;
    const timeout = setTimeout(() => {
      setActiveSubtitle({ text: '', label: '', isUser: false });
    }, 4000);
    return () => clearTimeout(timeout);
  }, [activeSubtitle.text]);

  const activeText = activeSubtitle.text;
  const activeLabel = activeSubtitle.label;
  const isActiveUser = activeSubtitle.isUser;

  return (
    <div className="flex flex-col items-center justify-between h-full w-full py-8">
      
      {/* Top Status */}
      <div className="flex flex-col items-center justify-center space-y-4">
        <StatusBadge color={stateConfig.color} pulse={true}>
          {stateConfig.label}
        </StatusBadge>
        <p className="text-slate-400 font-mono text-sm uppercase tracking-wide">
          {stateConfig.hint}
        </p>
      </div>

      {/* Center Vis */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative">
        <AgentAudioVisualizerAura
          size="xl"
          state={state}
          audioTrack={audioTrack}
          color="#e60026"
          colorShift={0.1}
          className="mb-12"
        />
        
        {/* Subtitles */}
        {activeText && (
          <div className="absolute bottom-10 px-8 w-full max-w-2xl text-center">
            <span className="text-amber text-xs font-mono mb-2 uppercase tracking-widest block">
              {activeLabel}
            </span>
            <div className={`italic text-lg md:text-xl font-body ${isActiveUser ? 'text-slate-300' : 'text-off-white'}`}>
              &quot;{activeText}&quot;
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="pb-8 flex items-center justify-center gap-4">
        <TrackToggle
          source={Track.Source.Microphone}
          className="px-6 py-3 rounded-full border-2 border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors uppercase font-mono font-bold tracking-widest text-sm data-[state=on]:border-safe-green data-[state=on]:text-safe-green data-[state=off]:border-alert-red data-[state=off]:text-alert-red"
        />
        <DisconnectButton className="px-8 py-3 rounded-full border-2 border-alert-red text-alert-red hover:bg-alert-red hover:text-white transition-colors uppercase font-mono font-bold tracking-widest text-sm">
          End Call
        </DisconnectButton>
      </div>
      
    </div>
  );
}
