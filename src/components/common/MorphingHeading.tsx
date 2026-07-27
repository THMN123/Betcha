import React from 'react';
import { motion } from 'motion/react';

interface MorphingHeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: 'h1' | 'h2' | 'h3' | 'span';
  glowColor?: 'emerald' | 'amber' | 'indigo' | 'white';
}

export const MorphingHeading: React.FC<MorphingHeadingProps> = ({
  children,
  className = '',
  as = 'h2',
  glowColor = 'emerald',
}) => {
  const Component = motion[as];

  const glowShadows = {
    emerald: [
      '0 0 0px rgba(16,185,129,0)',
      '0 0 16px rgba(16,185,129,0.4)',
      '0 0 6px rgba(16,185,129,0.15)',
      '0 0 0px rgba(16,185,129,0)',
    ],
    amber: [
      '0 0 0px rgba(245,158,11,0)',
      '0 0 16px rgba(245,158,11,0.4)',
      '0 0 6px rgba(245,158,11,0.15)',
      '0 0 0px rgba(245,158,11,0)',
    ],
    indigo: [
      '0 0 0px rgba(99,102,241,0)',
      '0 0 16px rgba(99,102,241,0.4)',
      '0 0 6px rgba(99,102,241,0.15)',
      '0 0 0px rgba(99,102,241,0)',
    ],
    white: [
      '0 0 0px rgba(255,255,255,0)',
      '0 0 12px rgba(255,255,255,0.3)',
      '0 0 4px rgba(255,255,255,0.1)',
      '0 0 0px rgba(255,255,255,0)',
    ],
  };

  return (
    <Component
      className={`font-display inline-block transition-all ${className}`}
      initial={{ letterSpacing: '-0.02em' }}
      animate={{
        letterSpacing: ['-0.03em', '0.025em', '-0.01em', '-0.03em'],
        textShadow: glowShadows[glowColor],
        scale: [1, 1.008, 1, 1],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        repeatType: 'mirror',
        ease: 'easeInOut',
      }}
    >
      {children}
    </Component>
  );
};

export default MorphingHeading;

