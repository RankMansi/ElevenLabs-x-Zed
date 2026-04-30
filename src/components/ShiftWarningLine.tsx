import React, { useEffect, useState } from 'react';

interface ShiftWarningLineProps {
  active: boolean;
}

export const ShiftWarningLine: React.FC<ShiftWarningLineProps> = ({ active }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(timer);
    }
  }, [active]);

  return (
    <div
      className={`scanline-warning${visible ? ' active' : ''}`}
      aria-hidden="true"
    />
  );
};
