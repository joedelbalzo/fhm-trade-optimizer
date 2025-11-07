import React, { useEffect, useRef, useState } from 'react';

type Props = {
  left: React.ReactNode;
  right: React.ReactNode;
  /** initial left width percentage */
  initialLeftPct?: number;   // default 70
  /** px minimums */
  minLeftPx?: number;        // default 520
  minRightPx?: number;       // default 360
  storageKey?: string;       // persists split
};

export default function SplitCols({
  left,
  right,
  initialLeftPct = 70,
  minLeftPx = 520,
  minRightPx = 360,
  storageKey = 'hroster.split.leftPct.v1',
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [leftPct, setLeftPct] = useState<number>(() => {
    const raw = localStorage.getItem(storageKey);
    const n = raw ? Number(raw) : initialLeftPct;
    return Number.isFinite(n) ? n : initialLeftPct;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, String(leftPct));
  }, [leftPct, storageKey]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const total = rect.width;
      const x = Math.min(Math.max(e.clientX - rect.left, 0), total);

      let pct = (x / total) * 100;

      // enforce min widths
      const leftPx = (pct / 100) * total;
      const rightPx = total - leftPx;
      if (leftPx < minLeftPx) pct = (minLeftPx / total) * 100;
      if (rightPx < minRightPx) pct = 100 - (minRightPx / total) * 100;

      // hard clamps so handle stays visible
      pct = Math.min(90, Math.max(35, pct));
      setLeftPct(pct);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, minLeftPx, minRightPx]);

  return (
    <div
      ref={wrapRef}
      className={`split ${dragging ? 'split--dragging' : ''}`}
      style={{ ['--left' as any]: `${leftPct}%` }}
    >
      <div className="split__left"><div className="panel">{left}</div></div>
      <div
        className="split__handle"
        onMouseDown={() => setDragging(true)}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        title="Drag to resize"
      />
      <div className="split__right"><div className="panel">{right}</div></div>
    </div>
  );
}
