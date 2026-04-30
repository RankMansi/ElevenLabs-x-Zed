import React from "react";
import { formatMs } from "../utils/format-time";

interface ShiftCountdownProps {
  nextMajorMs: number;
  nextMinorMs: number | null; // null = not Run III, don't show
  warning: boolean; // true when ≤ 5 s before major shift
}

export const ShiftCountdown: React.FC<ShiftCountdownProps> = ({
  nextMajorMs,
  nextMinorMs,
  warning,
}) => {
  return (
    <div className="shift-timers">
      {/* Major shift timer — always shown during a run */}
      <div
        className={["shift-timer", warning ? "shift-timer--warning" : ""]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="shift-timer__label">
          {nextMinorMs !== null ? "MAJOR" : "NEXT SHIFT"}
        </span>
        <span className="shift-timer__value">{formatMs(nextMajorMs)}</span>
      </div>

      {/* Minor shift timer — Run III only */}
      {nextMinorMs !== null && (
        <div className="shift-timer shift-timer--minor">
          <span className="shift-timer__label">MINOR</span>
          <span className="shift-timer__value">{formatMs(nextMinorMs)}</span>
        </div>
      )}
    </div>
  );
};
