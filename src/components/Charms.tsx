import React from 'react';
import { motion } from 'framer-motion';
import { Bookmark, Check, Droplets, Heart, Moon, Ribbon, Sun } from 'lucide-react';
import { CharmKind } from '../data/rules';

interface CharmProps {
  kind: CharmKind;
  className?: string;
}

export const ChapterCharm: React.FC<CharmProps> = ({ kind, className = 'w-11 h-11' }) => {
  const Icon =
    kind === 'sun'
      ? Sun
      : kind === 'milk'
        ? Droplets
        : kind === 'ribbon'
          ? Bookmark
          : Moon;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-strawberry-200 bg-paper text-strawberry-600 ${className}`}
      aria-hidden="true"
    >
      <Icon className="h-6 w-6 stroke-[1.8]" />
    </span>
  );
};

export const SatinBowSvg: React.FC<{ className?: string }> = ({ className = 'w-14 h-9' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full border border-strawberry-300 bg-strawberry-100 text-strawberry-700 ${className}`}
    aria-hidden="true"
  >
    <Ribbon className="h-5 w-5" />
  </span>
);

export const InkCheckbox: React.FC<{
  checked: boolean;
  reducedMotion?: boolean;
  className?: string;
}> = ({ checked, reducedMotion = false, className = 'w-6 h-6' }) => (
  <motion.span
    initial={false}
    animate={{
      backgroundColor: checked ? '#DF688D' : '#FFFDF9',
      borderColor: checked ? '#462E35' : '#D99FB2',
      scale: checked && !reducedMotion ? [1, 1.08, 1] : 1,
    }}
    transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}
    className={`relative inline-flex items-center justify-center rounded-[5px] border-2 ${className}`}
    aria-hidden="true"
  >
    {checked && <Check className="h-3.5 w-3.5 stroke-[3] text-paper" />}
  </motion.span>
);

export const FleuronSvg: React.FC<{ className?: string }> = ({ className = 'w-24 h-3.5' }) => (
  <span className={`inline-flex items-center justify-center gap-1.5 ${className}`} aria-hidden="true">
    <span className="h-px flex-1 bg-strawberry-300" />
    <span className="h-1.5 w-1.5 rounded-full bg-strawberry-400" />
    <span className="h-px flex-1 bg-strawberry-300" />
  </span>
);

export const WaxSeal: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full border-2 border-cocoa bg-strawberry-600 text-paper shadow-sm ${className}`}
    aria-hidden="true"
  >
    <Heart className="h-1/2 w-1/2 fill-current" />
  </span>
);

export const TallyHeart: React.FC<{ filled: boolean; className?: string }> = ({
  filled,
  className = 'w-4 h-4',
}) => (
  <Heart
    className={`${className} ${
      filled ? 'fill-strawberry-400 text-cocoa' : 'fill-paper text-strawberry-300'
    }`}
    strokeWidth={1.75}
    aria-hidden="true"
  />
);
