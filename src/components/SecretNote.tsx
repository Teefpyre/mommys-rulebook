import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { SecretNoteData } from '../data/rules';
import { soundEngine } from '../lib/sound';
import { WaxSeal } from './Charms';

interface SecretNoteProps {
  note: SecretNoteData;
  isOpenedPreviously: boolean;
  reducedMotion: boolean;
  onFirstOpen: (noteId: string) => void;
}

const FOLD_EASE = [0.22, 0.61, 0.36, 1] as const;
const FOLD_MS = 0.34;

const Message: React.FC<{ note: SecretNoteData; className?: string }> = ({
  note,
  className = '',
}) => (
  <span className={`block ${className}`}>
    <span className="block text-[15px] font-semibold leading-[26px] text-cocoa">
      {note.message}
    </span>
    <span className="mt-1 block text-right font-display text-[14.5px] font-bold text-strawberry-600">
      &mdash; {note.signoff}
    </span>
  </span>
);

interface FoldRevealProps {
  open: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  tilt?: number;
  revealDelay?: number;
}

const FoldReveal: React.FC<FoldRevealProps> = ({
  open,
  reducedMotion,
  children,
  className = '',
  innerClassName = '',
  tilt = 8,
  revealDelay = 0.05,
}) => {
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const node = innerRef.current;
    if (!node) return;
    const measure = () => setContentHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      className={`relative overflow-hidden ${className}`}
      initial={false}
      animate={
        reducedMotion
          ? { opacity: open ? 1 : 0 }
          : { height: open ? contentHeight : 0 }
      }
      transition={
        reducedMotion
          ? { duration: 0.18, ease: 'easeOut' }
          : { height: { duration: FOLD_MS, ease: FOLD_EASE, delay: open ? revealDelay : 0 } }
      }
      style={reducedMotion ? { height: open ? 'auto' : 0 } : undefined}
      aria-hidden={!open}
    >
      <motion.div
        ref={innerRef}
        initial={false}
        animate={
          reducedMotion
            ? { opacity: open ? 1 : 0 }
            : {
                opacity: open ? 1 : 0,
                y: open ? 0 : -5,
                rotateX: open ? 0 : -tilt,
              }
        }
        transition={{
          duration: 0.3,
          ease: FOLD_EASE,
          delay: open ? revealDelay : 0,
          opacity: { duration: 0.2, ease: 'easeOut', delay: open ? revealDelay : 0 },
        }}
        style={{
          transformOrigin: 'top center',
          transformPerspective: 900,
          backfaceVisibility: 'hidden',
        }}
        className={innerClassName}
      >
        {children}
      </motion.div>

      {!reducedMotion && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b from-[rgba(110,52,72,0.12)] to-transparent"
          initial={false}
          animate={{ opacity: open ? 0 : 1 }}
          transition={{ duration: 0.26, ease: 'easeOut' }}
        />
      )}
    </motion.div>
  );
};

export const SecretNote: React.FC<SecretNoteProps> = ({
  note,
  isOpenedPreviously,
  reducedMotion,
  onFirstOpen,
}) => {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      soundEngine.playEnvelopeOpen();
      if (!isOpenedPreviously) {
        onFirstOpen(note.id);
      }
    } else {
      soundEngine.playPageFlip();
    }
  };

  if (note.style === 'sticky') {
    return (
      <div className="relative mx-2 mb-2 mt-5">
        <div className="sticky-note relative rounded-[2px]">
          <button
            type="button"
            onClick={toggle}
            className="group relative flex w-full items-baseline justify-between gap-3 border-b border-strawberry-200/70 px-4 pb-2.5 pt-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500"
            aria-expanded={open}
          >
            <span className="type-press font-display text-[16px] font-bold text-cocoa">{note.label}</span>
            <span className="shrink-0 text-[12.5px] font-bold text-strawberry-600 group-hover:underline">
              {open ? 'Hide note' : isOpenedPreviously ? 'Read again' : 'Open note'}
            </span>
          </button>

          <FoldReveal open={open} reducedMotion={reducedMotion} tilt={9}>
            <div className="px-4 pb-3.5 pt-2.5">
              <Message note={note} />
            </div>
          </FoldReveal>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-1.5 mb-2 mt-5">
      <div className="relative rounded-[3px] border border-strawberry-200 bg-white shadow-[0_8px_18px_-12px_rgba(110,52,72,0.22)]">
        <button
          type="button"
          onClick={toggle}
          className="group relative flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500"
          aria-expanded={open}
        >
          <span className="inline-flex items-center gap-2.5">
            <WaxSeal className="h-6 w-6 shrink-0" />
            <span className="type-press font-display text-[16px] font-bold text-cocoa">{note.label}</span>
          </span>
          <span className="shrink-0 text-[12.5px] font-bold text-strawberry-600 group-hover:underline">
            {open ? 'Close' : isOpenedPreviously ? 'Read again' : 'Open'}
          </span>
        </button>

        <FoldReveal open={open} reducedMotion={reducedMotion} tilt={6} revealDelay={0.08}>
          <div className="px-3 pb-3">
            <div className="lined-paper rounded-[2px] py-2.5 pl-10 pr-4 shadow-[0_6px_14px_-10px_rgba(110,52,72,0.28)]">
              <Message note={note} />
            </div>
          </div>
        </FoldReveal>
      </div>
    </div>
  );
};
