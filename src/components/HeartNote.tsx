import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';

interface HeartNoteProps {
  speech: string | null;
  pulse: number;
  reducedMotion: boolean;
  onTap: () => void;
}

export const HeartNote: React.FC<HeartNoteProps> = ({
  speech,
  pulse,
  reducedMotion,
  onTap,
}) => {
  const [hearts, setHearts] = useState<number[]>([]);
  const controls = useAnimationControls();

  useEffect(() => {
    if (pulse === 0 || reducedMotion) return;
    controls.start({
      y: [0, -10, 0],
      rotate: [0, -7, 6, 0],
      transition: { duration: 0.55 },
    });
  }, [pulse, reducedMotion, controls]);

  const handleTap = () => {
    onTap();
    if (!reducedMotion) {
      const id = Date.now() + Math.random();
      setHearts((prev) => [...prev.slice(-2), id]);
      window.setTimeout(() => {
        setHearts((prev) => prev.filter((item) => item !== id));
      }, 900);
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-1.5 right-2 z-40 flex flex-col items-end sm:bottom-4 sm:right-5">
      <AnimatePresence initial={false}>
        {speech && (
          <motion.div
            key={pulse}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.22 }}
            className="paper-surface pointer-events-none relative mb-2.5 max-w-[235px] rounded-[3px] border border-strawberry-200 px-4 py-2.5 text-center shadow-card"
          >
            <p className="text-[14px] font-bold leading-snug text-cocoa">{speech}</p>
            <span
              className="absolute -bottom-[6px] right-6 h-2.5 w-2.5 rotate-45 border-b border-r border-strawberry-200 bg-white sm:right-8"
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        <AnimatePresence>
          {hearts.map((id, idx) => (
            <motion.span
              key={id}
              initial={{ opacity: 0.95, y: 0, x: (idx % 2 === 0 ? -1 : 1) * 10, scale: 0.7 }}
              animate={{ opacity: 0, y: -44, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.85, ease: 'easeOut' }}
              className="pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 text-strawberry-500"
              aria-hidden="true"
            >
              <Heart className="h-4 w-4 fill-current" />
            </motion.span>
          ))}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={handleTap}
          aria-label="Open reward menu"
          animate={reducedMotion ? undefined : controls}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full bg-strawberry-700 text-paper shadow-card transition-colors hover:bg-strawberry-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cocoa focus-visible:ring-offset-2 sm:h-14 sm:w-14"
        >
          <Heart className="h-6 w-6 fill-current sm:h-7 sm:w-7" aria-hidden="true" />
        </motion.button>
      </div>
    </div>
  );
};
