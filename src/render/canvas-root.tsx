import React, { useRef, useEffect, useCallback } from 'react';

interface CanvasRootProps {
  onReady: (canvas: HTMLCanvasElement) => void;
  className?: string;
}

export const CanvasRoot: React.FC<CanvasRootProps> = ({ onReady, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', handleResize);
    onReady(canvas);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [onReady, handleResize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100vw',
        height: '100vh',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
};
