import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Volume2, X, Send } from 'lucide-react';
import { auth } from '../firebase';
import { BankStandardValuationResult, DentalIntakeData } from '../types';
import { formatGbp } from '../utils/valuationEngine';

interface TranscriptEntry {
  id: string;
  role: 'user' | 'advisor';
  text: string;
}

interface LiveVoiceAdvisorProps {
  intakeData: DentalIntakeData;
  report: BankStandardValuationResult;
}

function floatTo16BitPcmBase64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

export const LiveVoiceAdvisor: React.FC<LiveVoiceAdvisorProps> = ({ intakeData, report }) => {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [micMuted, setMicMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [textInput, setTextInput] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micMutedRef = useRef<boolean>(false);

  useEffect(() => {
    micMutedRef.current = micMuted;
  }, [micMuted]);

  const stopPlayback = () => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
      } catch {
        // Ignore already stopped
      }
    });
    activeSourcesRef.current.clear();
    if (playbackCtxRef.current) {
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    }
  };

  const enqueueAudioChunk = (base64Pcm: string) => {
    if (!playbackCtxRef.current) {
      playbackCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    }
    const ctx = playbackCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const float32 = base64Pcm16ToFloat32(base64Pcm);
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  };

  const cleanupSession = () => {
    stopPlayback();
    try {
      processorRef.current?.disconnect();
    } catch {}
    processorRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;

    captureCtxRef.current?.close().catch(() => {});
    captureCtxRef.current = null;

    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }));
        }
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setStatus('idle');
  };

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  const appendTranscript = (role: 'user' | 'advisor', text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: `${last.text} ${clean}` }];
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, role, text: clean }];
    });
  };

  const startSession = async () => {
    setErrorMsg(null);
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-voice`);
      wsRef.current = ws;

      const idToken = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : '';
      const practiceContext = `Practice: ${intakeData.practiceName} (${intakeData.practiceType}, ${intakeData.region}, ${intakeData.surgeriesCount} surgeries). Gross Fees: ${formatGbp(intakeData.turnover)}, FMOP: ${formatGbp(report.fmop)}, Adopted YP: ${report.ypMultiplierAdopted}x, MV1 Goodwill: ${formatGbp(report.mv1MarketValueGoodwill)}, Readiness Score: ${report.buyerReadinessScore}/100.`;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            idToken,
            practiceContext,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ready') {
            setStatus('live');
            const captureCtx = new AudioContext({ sampleRate: 16000 });
            captureCtxRef.current = captureCtx;
            const source = captureCtx.createMediaStreamSource(stream);
            const processor = captureCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (audioEvent) => {
              if (micMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                return;
              }
              const inputData = audioEvent.inputBuffer.getChannelData(0);
              const b64 = floatTo16BitPcmBase64(inputData);
              wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }));
            };

            source.connect(processor);
            processor.connect(captureCtx.destination);
          } else if (msg.type === 'audio' && msg.data) {
            enqueueAudioChunk(msg.data);
          } else if (msg.type === 'interrupted') {
            stopPlayback();
          } else if (msg.type === 'input_transcript' && msg.text) {
            appendTranscript('user', msg.text);
          } else if (msg.type === 'output_transcript' && msg.text) {
            appendTranscript('advisor', msg.text);
          } else if (msg.type === 'error') {
            setErrorMsg(msg.message || 'Voice advisor session error.');
            setStatus('error');
          } else if (msg.type === 'closed') {
            setStatus('idle');
          }
        } catch {
          // Ignore malformed WS frame
        }
      };

      ws.onerror = () => {
        setErrorMsg('Unable to connect to the live voice valuation advisor.');
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('idle');
      };
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Microphone access is required for live voice conversation.'
      );
      setStatus('error');
      cleanupSession();
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = textInput.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    appendTranscript('user', clean);
    setTextInput('');
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 px-4 py-3 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold text-white transition-transform hover:scale-105"
        style={{ backgroundColor: '#26231E', border: '2px solid #A6521C' }}
      >
        <PhoneCall className="w-4 h-4 text-[#F3C9A3]" />
        <span>Live Voice Valuation Advisor</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-5 right-5 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-[8px] border shadow-2xl flex flex-col overflow-hidden text-left"
      style={{ borderColor: '#D6BC9E' }}
    >
      <div className="p-4 bg-[#26231E] text-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#F3C9A3]" />
            <span className="text-sm font-bold">UK Dental M&amp;A Voice Advisor</span>
          </div>
          <p className="text-[11px] text-amber-100/80 mt-0.5">
            {status === 'live'
              ? 'Live audio connected — speak naturally'
              : status === 'connecting'
              ? 'Connecting secure voice channel...'
              : 'Discuss your valuation, YP multiple & fixes live'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            cleanupSession();
            setOpen(false);
          }}
          className="p-1 rounded hover:bg-white/10"
          aria-label="Close voice advisor"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3 bg-[#FAF8F4] max-h-[300px] overflow-y-auto min-h-[180px]">
        {transcripts.length === 0 ? (
          <p className="text-xs text-[#6B6459] leading-relaxed">
            Start a voice session to talk through your practice&apos;s{' '}
            <strong>{formatGbp(report.mv1MarketValueGoodwill)}</strong> valuation, NHS clawback mitigation, Denplan conversion strategy, or associate covenants.
          </p>
        ) : (
          transcripts.map((t) => (
            <div
              key={t.id}
              className={`p-2.5 rounded-[6px] text-xs leading-relaxed ${
                t.role === 'user'
                  ? 'bg-[#26231E] text-white ml-6'
                  : 'bg-white border border-[#E2DBD0] text-[#26231E] mr-6'
              }`}
            >
              <span className="block text-[10px] font-bold uppercase opacity-70 mb-0.5">
                {t.role === 'user' ? 'Principal' : 'Valuation Advisor'}
              </span>
              {t.text}
            </div>
          ))
        )}

        {errorMsg && (
          <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}
      </div>

      {status === 'live' && (
        <form onSubmit={handleSendText} className="p-2.5 border-t bg-white flex gap-1.5" style={{ borderColor: 'var(--color-border)' }}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Or type a follow-up question..."
            className="flex-1 px-2.5 py-1.5 text-xs rounded border bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded bg-[#A6521C] text-white text-xs font-bold"
            aria-label="Send text prompt"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      <div className="p-3 border-t bg-white flex items-center justify-between gap-2" style={{ borderColor: 'var(--color-border)' }}>
        {status !== 'live' ? (
          <button
            type="button"
            disabled={status === 'connecting'}
            onClick={startSession}
            className="btn-primary w-full !py-2 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PhoneCall className="w-4 h-4" />
            {status === 'connecting' ? 'Connecting...' : 'Start Live Voice Call'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              className={`flex-1 py-2 px-3 rounded-[6px] text-xs font-bold border flex items-center justify-center gap-1.5 ${
                micMuted
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-[#FAF8F4] border-[#E2DBD0] text-[#26231E]'
              }`}
            >
              {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {micMuted ? 'Unmute Mic' : 'Mute Mic'}
            </button>
            <button
              type="button"
              onClick={cleanupSession}
              className="flex-1 py-2 px-3 rounded-[6px] text-xs font-bold bg-red-700 text-white hover:bg-red-800 flex items-center justify-center gap-1.5"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </button>
          </>
        )}
      </div>
    </div>
  );
};
