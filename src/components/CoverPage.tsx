import React, { useEffect, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { BookMeta } from '../data/rules';
import { soundEngine } from '../lib/sound';
import { FleuronSvg, WaxSeal } from './Charms';
import { BOOK_FRAME } from './BookShell';

interface CoverPageProps {
  meta: BookMeta;
  streak: number;
  reducedMotion: boolean;
  replayHinge: boolean;
  onOpen: () => void;
}

const SEAL_CRUMBS: {
  dx: number;
  dy: number;
  size: number;
  color: string;
  round: boolean;
  spin: number;
  dur: number;
}[] = Array.from({ length: 14 }, (_, i) => {
  const angle = i * 2.39996 + 0.4;
  const dist = 36 + (i % 4) * 11 + (i % 3) * 6;
  const colors = ['#DF688D', '#F4A7B9', '#A83B5E', '#C9922C', '#FFFDF9', '#9A7882'];
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist - 12,
    size: 4 + (i % 3) * 2 + (i % 2),
    color: colors[i % colors.length],
    round: i % 3 !== 0,
    spin: (i % 2 === 0 ? 1 : -1) * (90 + (i % 4) * 60),
    dur: 0.55 + (i % 3) * 0.14,
  };
});

export const CoverPage: React.FC<CoverPageProps> = ({
  meta,
  streak,
  reducedMotion,
  replayHinge,
  onOpen,
}) => {
  const hinge = { rotateY: -118, opacity: 0, x: -34, scale: 0.985 };
  const swing = {
    duration: reducedMotion ? 0.14 : 0.42,
    ease: [0.32, 0, 0.24, 1] as const,
    opacity: { duration: reducedMotion ? 0.14 : 0.26, delay: reducedMotion ? 0 : 0.16 },
  };

  const [untying, setUntying] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const untieTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (untieTimer.current) window.clearTimeout(untieTimer.current);
    },
    []
  );

  const handlePress = () => {
    if (untying) return;
    if (reducedMotion) {
      onOpen();
      return;
    }
    setUntying(true);
    setBurstKey((k) => k + 1);
    soundEngine.playEnvelopeOpen();
    untieTimer.current = window.setTimeout(onOpen, 560);
  };

  const idleDanceOn = !reducedMotion && !untying;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-4"
      style={{ perspective: 2600 }}
    >
      <motion.div
        initial={!replayHinge || reducedMotion ? false : { ...hinge, rotateY: -104 }}
        animate={{ rotateY: 0, opacity: 1, x: 0, scale: 1 }}
        exit={
          reducedMotion
            ? { opacity: 0 }
            : {
                ...hinge,
                transition: {
                  duration: 0.45,
                  ease: [0.32, 0, 0.24, 1],
                  opacity: { duration: 0.3 },
                  scale: { duration: 0.45 },
                  x: { duration: 0.45 },
                },
              }
        }
        transition={swing}
        className={`pointer-events-auto relative mx-auto flex w-full max-w-[600px] shrink-0 flex-col ${BOOK_FRAME}`}
        style={{
          transformOrigin: 'left center',
          transformStyle: 'preserve-3d',
          backfaceVisibility: 'hidden',
        }}
      >
        <div
          className="page-stack pointer-events-none absolute inset-0 translate-x-[9px] translate-y-[8px] rounded-[8px_16px_16px_8px] border border-strawberry-300 shadow-book"
          aria-hidden="true"
        />

        <div className="cloth relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[8px_16px_16px_8px] border-2 border-strawberry-400/70 px-8 py-8 shadow-book sm:px-14">
          <div
            className="pointer-events-none absolute inset-[10px] rounded-[11px] border-2 border-dashed border-paper/80"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-4 w-[6px] bg-gradient-to-r from-strawberry-400/35 via-paper/50 to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-3 left-[26px] w-px bg-white/40"
            aria-hidden="true"
          />

          <motion.div
            className="pointer-events-none absolute inset-y-0 right-7 z-20 w-[18px] border-x border-strawberry-600/25 bg-strawberry-400/90 shadow-sm sm:right-9"
            aria-hidden="true"
            initial={false}
            animate={untying ? { x: 46, opacity: 0, rotate: 6 } : { x: 0, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.42, ease: [0.32, 0, 0.24, 1] }}
          >
            <div className="ribbon-sheen absolute inset-0" aria-hidden="true" />
            <div className="absolute inset-y-1 left-1/2 border-l border-dashed border-paper/60" aria-hidden="true" />
          </motion.div>

          <motion.button
            type="button"
            onClick={handlePress}
            disabled={untying}
            whileTap={reducedMotion ? undefined : { scale: 0.88 }}
            aria-label="Open rulebook"
            className="absolute right-[-6px] top-[56%] z-30 flex h-24 w-24 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cocoa focus-visible:ring-offset-2 focus-visible:ring-offset-[#f3bccd] disabled:cursor-default sm:right-[2px]"
          >
            <motion.span
              className="relative flex items-center justify-center"
              initial={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
              animate={
                untying
                  ? {
                      x: [0, -7, 7, -3, 34],
                      y: [0, -5, 4, 2, 14],
                      rotate: [0, -14, 12, -6, 42],
                      scale: [1, 1.08, 0.94, 1.02, 1],
                      opacity: [1, 1, 1, 1, 0],
                    }
                  : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
              }
              transition={
                untying
                  ? { duration: 0.56, times: [0, 0.28, 0.48, 0.68, 1], ease: 'easeInOut' }
                  : { duration: 0.2, ease: 'easeOut' }
              }
            >
              <span
                className="pointer-events-none absolute h-20 w-20 rounded-full border border-cloth-deep/20 shadow-[inset_0_1px_3px_rgba(110,53,72,0.18)]"
                aria-hidden="true"
              />
              {idleDanceOn && (
                <>
                  <span
                    className="seal-ring-ping pointer-events-none absolute h-16 w-16 rounded-full border-2 border-strawberry-500/70"
                    aria-hidden="true"
                  />
                  <span
                    className="seal-ring-ping-delayed pointer-events-none absolute h-16 w-16 rounded-full border-2 border-strawberry-500/50"
                    aria-hidden="true"
                  />
                </>
              )}
              <span className={idleDanceOn ? 'seal-idle-dance relative flex items-center justify-center' : 'relative flex items-center justify-center'}>
                <WaxSeal className="h-14 w-14 drop-shadow-[0_2px_3px_rgba(80,34,50,0.35)]" />
              </span>
            </motion.span>
          </motion.button>

          {burstKey > 0 && !reducedMotion && (
            <div
              key={burstKey}
              className="pointer-events-none absolute right-[-6px] top-[56%] z-40 flex h-24 w-24 items-center justify-center sm:right-[2px]"
              aria-hidden="true"
            >
              {SEAL_CRUMBS.map((crumb, i) => (
                <motion.span
                  key={`${burstKey}-${i}`}
                  className="absolute"
                  style={{
                    width: crumb.size,
                    height: crumb.size,
                    background: crumb.color,
                    borderRadius: crumb.round ? 9999 : 2,
                  }}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
                  animate={{ x: crumb.dx, y: crumb.dy + 22, scale: 0.15, opacity: 0, rotate: crumb.spin }}
                  transition={{ duration: crumb.dur, ease: [0.22, 0.61, 0.36, 1] }}
                />
              ))}
            </div>
          )}

          <div className="label-plate relative z-10 mx-auto w-full max-w-[360px] shrink-0 rounded-[14px] border border-dashed border-strawberry-300/80 px-8 pb-7 pt-8 text-center">
            {meta.coverKicker && (
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-strawberry-600">
                {meta.coverKicker}
              </p>
            )}
            <h1 className="type-press mt-1.5 font-display text-[34px] font-bold leading-[1.05] tracking-[-0.01em] text-cocoa sm:text-[40px]">
              {meta.coverTitle}
            </h1>
            <p className="mt-1 font-display text-[19px] font-semibold leading-snug text-strawberry-500">
              {meta.coverSubtitle}
            </p>

            <div className="mt-3 flex justify-center">
              <FleuronSvg className="h-3.5 w-24" />
            </div>

            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border border-strawberry-200 bg-strawberry-50/70 text-strawberry-600">
              <BookOpen className="h-10 w-10 stroke-[1.6]" aria-hidden="true" />
            </div>
          </div>

          {streak > 0 && (
            <p className="relative z-10 mb-1 mt-5 text-center text-[13.5px] font-semibold text-cocoa">
              {streak} {streak === 1 ? 'day' : 'days'} in a row
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
