import { useId } from 'react';

/**
 * Locally drawn recreation of the EdgeNet Consulting Ltd. mark + wordmark (SVG, no image file).
 * To use an official logo instead, replace this component's body with an <img> of the approved asset.
 *  tone="onDark"  -> white wordmark, bright cyan mark (navy backgrounds)
 *  tone="onLight" -> navy wordmark, deeper blue mark (white card)
 *  size           -> font-size in rem; the whole logo scales with it.
 */
export function EdgeNetLogo({ tone, size = 2.2 }: { tone: 'onDark' | 'onLight'; size?: number }) {
  const id = useId().replace(/:/g, '');
  const dark = tone === 'onDark';
  const word = dark ? '#ffffff' : '#0c2547';
  const [c1, c2] = dark ? ['#46e1ff', '#1c7df0'] : ['#1bb3e8', '#0a3f9e'];
  return (
    <span
      role="img"
      aria-label="EdgeNet Consulting Ltd."
      style={{ display: 'inline-flex', alignItems: 'center', gap: '.42em', fontSize: `${size}rem`, lineHeight: 1 }}
    >
      <svg viewBox="0 0 104 70" style={{ width: '2.5em', height: '1.68em', flex: 'none' }} fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`g${id}`} x1="8" y1="8" x2="96" y2="62" gradientUnits="userSpaceOnUse">
            <stop stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
        </defs>
        <g stroke={`url(#g${id})`} strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="50" cy="37" rx="41" ry="22" transform="rotate(-18 50 37)" strokeWidth="7.5" strokeDasharray="112 14 62 26" />
          <path d="M24 49 L41 31 L53 43 L80 17" strokeWidth="6.5" />
          <path d="M68 15 H82 V29" strokeWidth="6" />
        </g>
        <circle cx="91" cy="12" r="5" fill={`url(#g${id})`} />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column' }} aria-hidden="true">
        <span style={{ fontSize: '1em', fontWeight: 600, letterSpacing: '-.01em', color: word }}>EdgeNet</span>
        <span style={{ fontSize: '.36em', fontWeight: 500, letterSpacing: '.2em', marginTop: '.3em', color: word }}>CONSULTING LTD.</span>
      </span>
    </span>
  );
}
