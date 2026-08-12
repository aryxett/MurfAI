'use client';

import React, { useMemo } from 'react';
import { useVoiceAssistant, DisconnectButton, useLocalParticipant, useTrackVolume, useTrackTranscription, TrackToggle, useTracks, useDataChannel } from '@livekit/components-react';
import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura';
import { StatusBadge } from './StatusBadge';
import { Track, LocalAudioTrack } from 'livekit-client';
import { Phone, Check } from 'lucide-react';

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

  // Popup State
  const [showEscalation, setShowEscalation] = React.useState(false);
  const [escalationData, setEscalationData] = React.useState<any>(null);
  const [isDispatched, setIsDispatched] = React.useState(false);

  const { message: dataChannelMessage } = useDataChannel();

  React.useEffect(() => {
    if (!dataChannelMessage) return;
    try {
      const payload = JSON.parse(new TextDecoder().decode(dataChannelMessage.payload));
      if (payload.type === 'escalation') {
        setEscalationData(payload.data);
        setShowEscalation(true);
        setIsDispatched(false);

        // Transition to Dispatched state after 3 seconds
        setTimeout(() => {
          setIsDispatched(true);
        }, 3000);

        // Hide after 7.5 seconds
        setTimeout(() => {
          setShowEscalation(false);
          setEscalationData(null);
        }, 7500);
      }
    } catch (e) {
      console.error('Failed to parse escalation data channel message', e);
    }
  }, [dataChannelMessage]);

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
      
      {/* Escalation Overlay */}
      {showEscalation && escalationData && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl transition-all duration-300">
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            {/* Icon & Title */}
            {!isDispatched ? (
              <div className="flex flex-col items-center mb-6">
                <div className="relative flex items-center justify-center h-16 w-16 mb-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-40"></span>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#e60026] shadow-[0_0_30px_rgba(220,38,38,0.5)]">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white tracking-wide">Calling Rescue Team</h2>
                <div className="flex gap-1.5 mt-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center mb-6">
                <div className="relative flex items-center justify-center h-16 w-16 mb-4">
                  <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[#10b981] opacity-20"></span>
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#10b981] shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                    <Check className="h-8 w-8 text-white" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-[#10b981] tracking-wide">Request Dispatched</h2>
                <p className="text-sm text-gray-400 mt-1">Team has been alerted</p>
              </div>
            )}

            {/* Card */}
            <div className="w-[340px] rounded-xl border border-white/5 bg-[#111111]/80 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Reference</span>
                <span className="text-sm font-bold text-white">{escalationData.id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Urgency</span>
                <span className="rounded-full bg-[#ca8a04]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#ca8a04] uppercase tracking-wider">{escalationData.urgency || 'HIGH'}</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-3 mb-3">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Caller</span>
                <span className="text-sm font-medium text-white">{escalationData.who}</span>
              </div>
              <div className="pt-1">
                <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase block mb-2">Situation</span>
                <p className="text-sm text-gray-300 leading-relaxed font-body">
                  {escalationData.what_happened} {escalationData.what_agent_checked}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
