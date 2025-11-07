// src/components/Loader.tsx

type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';

export default function Loader({
  label = 'Loading…',
  size = 'lg',
}: {
  label?: string;
  size?: LoaderSize;
}) {
  const dims: Record<LoaderSize, { px: number; bw: number; fontRem: number; gap: number }> = {
    sm: { px: 14, bw: 2, fontRem: 0.95, gap: 8 },
    md: { px: 18, bw: 2, fontRem: 1.0, gap: 10 },
    lg: { px: 26, bw: 3, fontRem: 1.08, gap: 12 },
    xl: { px: 34, bw: 4, fontRem: 1.18, gap: 14 },
  };

  const { px, bw, fontRem, gap } = dims[size];

  return (
    <span
      className="loader"
      role="status"
      aria-live="polite"
      aria-label={label}
      style={{ gap, fontSize: `${fontRem}rem` }}
    >
      <span
        className="spinner"
        aria-hidden="true"
        style={{ width: px, height: px, borderWidth: bw }}
      />
      <span>{label}</span>
    </span>
  );
}
