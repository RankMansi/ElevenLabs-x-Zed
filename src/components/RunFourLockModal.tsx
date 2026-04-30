import React from 'react';

export interface RunFourLockModalProps {
  open: boolean;
  onClose: () => void;
  eggCount: number;
  /** Runs I→II→III won in order (0–3). */
  mazeWinsOrdered: number;
}

export const RunFourLockModal: React.FC<RunFourLockModalProps> = ({
  open,
  onClose,
  eggCount,
  mazeWinsOrdered,
}) => {
  if (!open) return null;

  return (
    <div
      className="run4-lock-overlay"
      role="dialog"
      aria-modal
      aria-labelledby="run4-lock-title"
    >
      <button
        type="button"
        className="run4-lock-scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="run4-lock-card">
        <h2 id="run4-lock-title" className="run4-lock-title">
          Run IV stays sealed
        </h2>
        <p className="run4-lock-body">
          Beat runs I, then II, then III to the real exit <em>and</em> collect each run&apos;s
          hidden mark — all in one session. Both must be complete; order for wins is I → II →
          III.
        </p>
        <p className="run4-lock-progress">
          Marks: <strong>{eggCount}</strong> / 3 · Mazes cleared in order:{' '}
          <strong>{mazeWinsOrdered}</strong> / 3
        </p>
        <button type="button" className="menu-btn" onClick={onClose}>
          Understood
        </button>
      </div>
    </div>
  );
};
