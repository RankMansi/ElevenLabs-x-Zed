import React, { useState, useCallback, useEffect } from 'react';

const ITEMS = [
  {
    key: 'dispatch',
    head: 'Guides → Dispatch',
    title: 'Dispatch VO',
    body: 'ElevenLabs TTS briefing on each run when the server key is set.',
    detail:
      'Briefings stream as generated speech over the local /api/tts proxy. Without keys, copy still advances—audio is optional evidence, not a gate.',
  },
  {
    key: 'ears',
    head: 'Flights → Ears',
    title: 'Spatial cues',
    body: 'Stereo mix: exit hum pans as you move through the concrete.',
    detail:
      'Web Audio buses separate hum, SFX, and music. Hum follows exit position in the maze so your ears can triangulate before your eyes commit.',
  },
  {
    key: 'shifts',
    head: 'Transfers → Shifts',
    title: 'Timed shifts',
    body: 'Authorable walls · deterministic topology beats.',
    detail:
      'Major and minor shift tables drive when the maze rewrites. You learn the schedule—or it learns you.',
  },
  {
    key: 'lantern',
    head: 'Hotel → Lantern',
    title: '2 m light',
    body: 'Dark maze · radius follows the runner.',
    detail:
      'Roughly two meters of clarity; dread can shrink it. Slow-walk to listen when the stone starts lying.',
  },
];

export const IncludedGrid: React.FC = () => {
  const [open, setOpen] = useState<string | null>(null);

  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <>
      <div className="ms-included-grid">
        {ITEMS.map((it) => (
          <button
            key={it.key}
            type="button"
            className="ms-included-card"
            onClick={() => setOpen(it.key)}
          >
            <span className="ms-included-card__eyebrow">{it.head}</span>
            <span className="ms-included-card__icon" aria-hidden />
            <h3 className="ms-included-card__title">{it.title}</h3>
            <p className="ms-included-card__body">{it.body}</p>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="ms-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ms-modal-title"
          tabIndex={-1}
          onClick={close}
        >
          <div
            className="ms-modal"
            onClick={(e) => e.stopPropagation()}
            role="document"
          >
            <h3 id="ms-modal-title" className="ms-modal__title">
              {ITEMS.find((i) => i.key === open)?.title}
            </h3>
            <p className="ms-modal__detail">
              {ITEMS.find((i) => i.key === open)?.detail}
            </p>
            <button type="button" className="ms-modal__close" onClick={close}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
