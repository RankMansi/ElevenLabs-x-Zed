import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { RunId } from '../types/maze';
import type { AudioDirector } from '../audio/audio-director';
import { getBriefingText } from '../content/briefings';
import { fetchTtsMp3, TtsRequestError } from '../audio/tts-client';
import { RUN_CONFIGS } from '../game/run-controller';

const EYE_POS: { left: string; top: string }[] = [
  { left: '7%', top: '28%' },
  { left: '14%', top: '52%' },
  { left: '86%', top: '24%' },
  { left: '91%', top: '48%' },
  { left: '10%', top: '72%' },
  { left: '88%', top: '68%' },
];

export interface BriefingModalProps {
  runId: RunId;
  audio: AudioDirector | null;
  onComplete: (runId: RunId) => void;
}

function ttsFailureUserLine(err: TtsRequestError): string {
  const head = `Narration unavailable (${err.status}).`;
  try {
    const j = JSON.parse(err.body) as { detail?: unknown };
    if (typeof j.detail === 'string' && j.detail.trim()) {
      return `${head} ${j.detail.trim()}`;
    }
  } catch {
    /* ignore */
  }
  return head;
}

function disposeAudio(
  audioEl: HTMLAudioElement | null,
  url: string | null,
): void {
  if (audioEl) {
    audioEl.pause();
    audioEl.src = '';
    audioEl.load();
  }
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export const BriefingModal: React.FC<BriefingModalProps> = ({
  runId,
  audio,
  onComplete,
}) => {
  const fullText = getBriefingText(runId);
  const runCfg = RUN_CONFIGS[runId];

  const [caption, setCaption] = useState('');
  const [readyEnabled, setReadyEnabled] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charIndexRef = useRef(0);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const backupTimerRef = useRef<number | null>(null);

  const clearTyping = () => {
    if (typingTimerRef.current !== null) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  const startTypewriter = useCallback(
    (durationHintSec: number) => {
      clearTyping();
      charIndexRef.current = 0;
      setCaption('');
      const cps = Math.max(
        14,
        fullText.length / Math.max(durationHintSec * 0.92, 0.5),
      );
      const step = () => {
        charIndexRef.current += 1;
        setCaption(fullText.slice(0, charIndexRef.current));
        if (charIndexRef.current < fullText.length) {
          typingTimerRef.current = setTimeout(step, 1000 / cps);
        }
      };
      typingTimerRef.current = setTimeout(step, 120);
    },
    [fullText],
  );

  const enableReadyAndFullCaption = useCallback(() => {
    setReadyEnabled(true);
    setCaption(fullText);
    clearTyping();
  }, [fullText]);

  useEffect(() => {
    let cancelled = false;
    setReadyEnabled(false);
    setExiting(false);
    setErrorHint(null);
    audio?.beginLiveBriefing();

    const fallbackDuration = Math.max(18, fullText.length / 14);
    startTypewriter(fallbackDuration);

    const run = async () => {
      try {
        const blob = await fetchTtsMp3({ text: fullText });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const el = new Audio(url);
        narrationRef.current = el;

        const onMeta = () => {
          if (!cancelled && el.duration && Number.isFinite(el.duration)) {
            clearTyping();
            startTypewriter(el.duration);
          }
        };
        el.addEventListener('loadedmetadata', onMeta, { once: true });

        el.onended = () => {
          if (cancelled) return;
          enableReadyAndFullCaption();
        };

        el.onerror = () => {
          if (cancelled) return;
          setErrorHint('Audio playback failed. Read the briefing and press READY.');
          enableReadyAndFullCaption();
        };

        try {
          await el.play();
        } catch {
          if (cancelled) return;
          setErrorHint('Playback blocked until you interact. Press READY when you have read the briefing.');
          enableReadyAndFullCaption();
        }

        backupTimerRef.current = window.setTimeout(() => {
          if (!cancelled) setReadyEnabled(true);
        }, 120_000);
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof TtsRequestError ? ttsFailureUserLine(e) : 'Narration unavailable.';
        setErrorHint(`${msg} Press READY to continue with text only.`);
        enableReadyAndFullCaption();
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (backupTimerRef.current !== null) {
        window.clearTimeout(backupTimerRef.current);
        backupTimerRef.current = null;
      }
      clearTyping();
      disposeAudio(narrationRef.current, blobUrlRef.current);
      narrationRef.current = null;
      blobUrlRef.current = null;
      audio?.endBriefingDuck();
    };
  }, [runId, audio, fullText, startTypewriter, enableReadyAndFullCaption]);

  const handleSkip = () => {
    audio?.playUiClick();
    disposeAudio(narrationRef.current, blobUrlRef.current);
    narrationRef.current = null;
    blobUrlRef.current = null;
    if (backupTimerRef.current !== null) {
      window.clearTimeout(backupTimerRef.current);
      backupTimerRef.current = null;
    }
    audio?.endBriefingDuck();
    enableReadyAndFullCaption();
  };

  const handleReady = () => {
    if (!readyEnabled) return;
    audio?.playUiClick();
    if (backupTimerRef.current !== null) {
      window.clearTimeout(backupTimerRef.current);
      backupTimerRef.current = null;
    }
    disposeAudio(narrationRef.current, blobUrlRef.current);
    narrationRef.current = null;
    blobUrlRef.current = null;
    audio?.endBriefingDuck();
    setExiting(true);
    window.setTimeout(() => onComplete(runId), 420);
  };

  return (
    <div
      className={`briefing-modal briefing-modal--abyss${exiting ? ' briefing-modal--exit' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="briefing-title"
    >
      <div className="briefing-modal__atmo" aria-hidden>
        <div className="briefing-modal__beam" />
        <div className="briefing-modal__ridge briefing-modal__ridge--l" />
        <div className="briefing-modal__ridge briefing-modal__ridge--r" />
        <div className="briefing-modal__eyes">
          {EYE_POS.map((p, i) => (
            <span key={i} className="briefing-modal__eye" style={{ left: p.left, top: p.top }} />
          ))}
        </div>
      </div>

      <div className="briefing-modal__panel">
        <header className="briefing-modal__mast">
          <div className="briefing-modal__slit-wrap">
            <span className="briefing-modal__slit-glow" />
            <span className="briefing-modal__figure" />
          </div>
          <h1 className="briefing-modal__run-title" id="briefing-title">
            {runCfg.name}
          </h1>
          <p className="briefing-modal__run-sub">{runCfg.subtitle}</p>
          <p className="briefing-modal__voice-tag">Voice briefing · Chronos Grid</p>
        </header>

        {errorHint && (
          <p className="briefing-modal__error" role="status">
            {errorHint}
          </p>
        )}

        <div className="briefing-modal__caption" aria-live="polite">
          {caption}
          {!readyEnabled && caption.length < fullText.length && (
            <span className="briefing-modal__cursor" aria-hidden="true" />
          )}
        </div>

        <div className="briefing-modal__actions">
          <button
            type="button"
            className="briefing-modal__ready"
            disabled={!readyEnabled}
            onClick={handleReady}
          >
            <span className="briefing-modal__ready-stripe" aria-hidden="true" />
            <span className="briefing-modal__ready-label">[ READY ]</span>
          </button>
          <button type="button" className="briefing-modal__skip" onClick={handleSkip}>
            Skip narration
          </button>
        </div>
      </div>
    </div>
  );
};
