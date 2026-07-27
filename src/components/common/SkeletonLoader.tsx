import React from 'react';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
}

export const SkeletonBlock: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{
        opacity: [0.3, 0.7, 0.3],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`bg-zinc-800/60 rounded-xl ${className}`}
    />
  );
};

export const HomeSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Featured Banner Skeleton */}
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <SkeletonBlock className="h-5 w-44 rounded-full" />
        <SkeletonBlock className="h-8 w-3/4 rounded-xl" />
        <SkeletonBlock className="h-4 w-full rounded-lg" />
        <div className="flex gap-3 pt-2">
          <SkeletonBlock className="h-12 w-36 rounded-2xl" />
          <SkeletonBlock className="h-12 w-32 rounded-2xl" />
        </div>
      </div>

      {/* Arcade Games Grid Skeleton */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <SkeletonBlock className="h-6 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <div className="flex justify-between">
                <SkeletonBlock className="h-4 w-20 rounded-md" />
                <SkeletonBlock className="h-4 w-16 rounded-md" />
              </div>
              <SkeletonBlock className="h-6 w-32 rounded-lg" />
              <SkeletonBlock className="h-4 w-full rounded-md" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <SkeletonBlock className="h-9 w-full rounded-xl" />
                <SkeletonBlock className="h-9 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Friend Rooms Skeleton */}
      <div className="space-y-3">
        <SkeletonBlock className="h-6 w-40 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <SkeletonBlock className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-32 rounded-md" />
                  <SkeletonBlock className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <SkeletonBlock className="h-8 w-20 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const WalletSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Wallet Balance Card Skeleton */}
      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <SkeletonBlock className="h-5 w-36 rounded-full" />
          <SkeletonBlock className="h-4 w-28 rounded-full" />
        </div>
        <SkeletonBlock className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 p-3.5 bg-zinc-950 rounded-2xl">
          <SkeletonBlock className="h-8 w-full rounded-lg" />
          <SkeletonBlock className="h-8 w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
          <SkeletonBlock className="h-12 w-full rounded-2xl" />
        </div>
      </div>

      {/* Transaction History Filter & List Skeleton */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <SkeletonBlock className="h-8 w-24 rounded-xl" />
          <SkeletonBlock className="h-8 w-32 rounded-xl" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-3.5 flex justify-between items-center">
              <div className="flex gap-3 items-center">
                <SkeletonBlock className="w-9 h-9 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <SkeletonBlock className="h-4 w-36 rounded-md" />
                  <SkeletonBlock className="h-3 w-24 rounded-md" />
                </div>
              </div>
              <SkeletonBlock className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
