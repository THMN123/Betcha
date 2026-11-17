import React from 'react';

interface MorphingHeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span';
  glowColor?: 'emerald' | 'amber' | 'indigo' | 'white';
}

// A static glow. The previous version animated letter-spacing and text-shadow forever, which forced
// a full page layout every frame (on 25 headings, including the in-game header) and caused jank.
const GLOW: Record<NonNullable<MorphingHeadingProps['glowColor']>, string> = {
  emerald: '0 0 14px rgba(16,185,129,0.35)',
  amber: '0 0 14px rgba(245,158,11,0.35)',
  indigo: '0 0 14px rgba(99,102,241,0.35)',
  white: '0 0 12px rgba(255,255,255,0.25)',
};

export const MorphingHeading: React.FC<MorphingHeadingProps> = ({ children, className = '', as = 'h2', glowColor = 'emerald' }) => {
  const Component = as;
  return (
    <Component className={`font-display inline-block tracking-tight ${className}`} style={{ textShadow: GLOW[glowColor] }}>
      {children}
    </Component>
  );
};

export default MorphingHeading;
