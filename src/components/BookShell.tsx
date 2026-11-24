import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, PanInfo } from 'framer-motion';

export interface RibbonTab {
  id: string;
  label: string;
  spreadIndex: number;
  mobilePageIndex: number;
  badge?: string;
}

interface BookShellProps {
  spreadIndex: number;
  mobilePageIndex: number;
  totalSpreads: number;
  totalMobilePages: number;
  direction: number;
  desktopTabs: RibbonTab[];
  mobileTabs: RibbonTab[];
  reducedMotion: boolean;
  leftPage: React.ReactNode;
  rightPage: React.ReactNode;
  mobilePage: React.ReactNode;
  onSelectSpread: (spreadIndex: number, mobilePageIndex: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

const TURN_EASE = [0.32, 0, 0.24, 1] as const;
const TURN_MS = 300;
const TURN_MS_REDUCED = 130;

const PAGE_PADDING = 'px-9 pb-5 pt-6 lg:px-11 lg:py-7';

export const BOOK_FRAME =
  'h-[calc(100dvh-196px)] max-h-[620px] min-h-[520px] min-[900px]:h-[calc(100vh-164px)] min-[900px]:max-h-[780px] min-[900px]:min-h-[620px]';

const PageCornerFold: React.FC<{
  side: 'left' | 'right';
  reducedMotion: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}> = ({ side, reducedMotion, ariaLabel, onClick }) => {
  const cornerPos = side === 'left' ? 'bottom-1.5 left-1.5' : 'bottom-1.5 right-1.5';
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  if (!onClick) {
    return null;
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      initial={false}
      whileHover={reducedMotion ? undefined : { scale: 1.08 }}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={
        reducedMotion ? { duration: 0 } : { duration: 0.16, ease: [0.32, 0, 0.24, 1] }
      }
      className={`absolute ${cornerPos} z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-strawberry-200 bg-paper/90 text-cocoa-soft shadow-sm transition-colors hover:border-strawberry-300 hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </motion.button>
  );
};

const PageFace: React.FC<{
  side: 'left' | 'right';
  children: React.ReactNode;
  className?: string;
  showCornerFold?: boolean;
  reducedMotion?: boolean;
  cornerAriaLabel?: string;
  onCornerClick?: () => void;
}> = ({
  side,
  children,
  className = '',
  showCornerFold = false,
  reducedMotion = false,
  cornerAriaLabel,
  onCornerClick,
}) => (
  <div
    className={`paper-surface ${
      side === 'left' ? 'book-gutter-left' : 'book-gutter-right'
    } relative h-full min-w-0 overflow-hidden ${PAGE_PADDING} ${className}`}
  >
    {children}
    {showCornerFold && (
      <PageCornerFold
        side={side}
        reducedMotion={reducedMotion}
        ariaLabel={cornerAriaLabel}
        onClick={onCornerClick}
      />
    )}
  </div>
);

interface Turn {
  dir: 1 | -1;
  fromSpread: number;
  fromMobileIdx: number;
  fromLeft: React.ReactNode;
  fromRight: React.ReactNode;
  fromMobile: React.ReactNode;
}

export const BookShell: React.FC<BookShellProps> = ({
  spreadIndex,
  mobilePageIndex,
  totalSpreads,
  totalMobilePages,
  direction,
  desktopTabs,
  mobileTabs,
  reducedMotion,
  leftPage,
  rightPage,
  mobilePage,
  onSelectSpread,
  onPrev,
  onNext,
}) => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const activeMobileTabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (isDesktop) return;
    activeMobileTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [isDesktop, mobilePageIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onNext, onPrev]);

  const handleMobileDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -55) {
      onNext();
    } else if (info.offset.x > 55) {
      onPrev();
    }
  };

  const prevRef = useRef({
    spreadIndex,
    mobilePageIndex,
    leftPage,
    rightPage,
    mobilePage,
  });
  const [turn, setTurn] = useState<Turn | null>(null);
  const turnTimer = useRef<number | null>(null);

  useLayoutEffect(() => {
    const prev = prevRef.current;
    const moved =
      prev.spreadIndex !== spreadIndex || prev.mobilePageIndex !== mobilePageIndex;

    if (!moved) {
      prevRef.current = { spreadIndex, mobilePageIndex, leftPage, rightPage, mobilePage };
      return;
    }

    const forward =
      spreadIndex !== prev.spreadIndex
        ? spreadIndex > prev.spreadIndex
        : mobilePageIndex > prev.mobilePageIndex;

    setTurn({
      dir: forward || (spreadIndex === prev.spreadIndex && direction > 0) ? 1 : -1,
      fromSpread: prev.spreadIndex,
      fromMobileIdx: prev.mobilePageIndex,
      fromLeft: prev.leftPage,
      fromRight: prev.rightPage,
      fromMobile: prev.mobilePage,
    });
    prevRef.current = { spreadIndex, mobilePageIndex, leftPage, rightPage, mobilePage };

    if (turnTimer.current) window.clearTimeout(turnTimer.current);
    turnTimer.current = window.setTimeout(
      () => setTurn(null),
      reducedMotion ? TURN_MS_REDUCED : TURN_MS + 40
    );
  }, [spreadIndex, mobilePageIndex, leftPage, rightPage, mobilePage, direction, reducedMotion]);

  useEffect(
    () => () => {
      if (turnTimer.current) window.clearTimeout(turnTimer.current);
    },
    []
  );

  const turnMs = reducedMotion ? TURN_MS_REDUCED : TURN_MS;

  const underLeft = turn ? (turn.dir === 1 ? turn.fromLeft : leftPage) : leftPage;
  const underRight = turn ? (turn.dir === 1 ? rightPage : turn.fromRight) : rightPage;
  const leafFront = turn ? (turn.dir === 1 ? turn.fromRight : rightPage) : null;
  const leafBack = turn ? (turn.dir === 1 ? leftPage : turn.fromLeft) : null;

  const canGoNext = isDesktop
    ? spreadIndex < totalSpreads - 1
    : mobilePageIndex < totalMobilePages - 1;

  const atFirstPage = isDesktop ? spreadIndex === 0 : mobilePageIndex === 0;

  const underRightSpread = turn ? (turn.dir === 1 ? spreadIndex : turn.fromSpread) : spreadIndex;
  const underRightHasFold = underRightSpread < totalSpreads - 1;
  const leafFrontSpread = turn ? (turn.dir === 1 ? turn.fromSpread : spreadIndex) : spreadIndex;
  const leafFrontHasFold = leafFrontSpread < totalSpreads - 1;

  const pageLabel = isDesktop
    ? `Pages ${spreadIndex * 2 + 1}-${spreadIndex * 2 + 2} of ${totalSpreads * 2}`
    : `Page ${mobilePageIndex + 1} of ${totalMobilePages}`;

  const prevLabel = atFirstPage ? 'Close book to cover' : 'Previous page';

  return (
    <div className="mx-auto w-full max-w-[600px] shrink-0 pb-12 sm:pb-1 min-[900px]:max-w-[1380px] min-[900px]:pb-0">
      <span className="sr-only" aria-live="polite">
        {pageLabel}
      </span>

      {!isDesktop && (
        <nav
          aria-label="Rulebook pages"
          className="relative z-10 -mb-[5px] flex gap-1.5 overflow-x-auto px-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {mobileTabs.map((tab) => {
            const isActive = tab.mobilePageIndex === mobilePageIndex;
            return (
              <motion.button
                key={tab.id}
                type="button"
                ref={isActive ? activeMobileTabRef : undefined}
                onClick={() => onSelectSpread(tab.spreadIndex, tab.mobilePageIndex)}
                aria-current={isActive ? 'page' : undefined}
                data-star-jar-tab={tab.id === 'tab-jar' ? 'mobile' : undefined}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                className={`shrink-0 rounded-t-lg border border-b-0 bg-paper px-3.5 pb-2.5 pt-1.5 text-[13px] font-bold transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500 ${
                  isActive
                    ? 'border-strawberry-300 text-cocoa shadow-sm'
                    : 'translate-y-[3px] border-strawberry-200/80 text-cocoa-soft hover:translate-y-0'
                }`}
              >
                {tab.label}
                {tab.badge && (
                  <span className="font-semibold tabular-nums text-strawberry-600">
                    <span className="mx-1.5 text-strawberry-300" aria-hidden="true">
                      &middot;
                    </span>
                    {tab.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>
      )}

      <div className="relative flex items-stretch">
        <div className="cloth book-perspective relative flex-1 rounded-[14px] border-2 border-strawberry-300 p-3 shadow-book sm:p-4">
          <div
            className="pointer-events-none absolute inset-[8px] rounded-[9px] border-2 border-dashed border-paper/75"
            aria-hidden="true"
          />

          {isDesktop ? (
            <div className="open-pages-frame relative mx-1 overflow-hidden rounded-[8px] bg-paper">
              <div className={`grid w-full shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${BOOK_FRAME}`}>
                <PageFace
                  side="left"
                  showCornerFold
                  reducedMotion={reducedMotion}
                  cornerAriaLabel={prevLabel}
                  onCornerClick={onPrev}
                >
                  {underLeft}
                </PageFace>
                <PageFace
                  side="right"
                  showCornerFold={underRightHasFold}
                  reducedMotion={reducedMotion}
                  cornerAriaLabel="Next page"
                  onCornerClick={canGoNext ? onNext : undefined}
                >
                  {underRight}
                </PageFace>
              </div>

              {turn && (
                <motion.div
                  key={`cast-${turn.dir}-${spreadIndex}-${mobilePageIndex}`}
                  className="pointer-events-none absolute inset-y-0 z-20"
                  style={{
                    left: turn.dir === 1 ? '50%' : 0,
                    right: turn.dir === 1 ? 0 : '50%',
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.55, 0] }}
                  transition={{ duration: turnMs / 1000, times: [0, 0.45, 1], ease: 'easeInOut' }}
                  aria-hidden="true"
                >
                  <div
                    className="h-full w-full"
                    style={{
                      background:
                        turn.dir === 1
                          ? 'linear-gradient(90deg, rgba(110,52,72,0.20) 0%, rgba(110,52,72,0.06) 45%, transparent 78%)'
                          : 'linear-gradient(270deg, rgba(110,52,72,0.20) 0%, rgba(110,52,72,0.06) 45%, transparent 78%)',
                    }}
                  />
                </motion.div>
              )}

              {turn && (
                <div
                  className="pointer-events-none absolute inset-y-0 left-1/2 right-0 z-30"
                  style={{ perspective: 2400 }}
                  aria-hidden="true"
                >
                  <motion.div
                    key={`leaf-${turn.dir}-${spreadIndex}-${mobilePageIndex}`}
                    className="relative h-full w-full"
                    style={{
                      transformStyle: 'preserve-3d',
                      transformOrigin: 'left center',
                    }}
                    initial={{ rotateY: reducedMotion ? 0 : turn.dir === 1 ? 0 : -180 }}
                    animate={{ rotateY: reducedMotion ? 0 : turn.dir === 1 ? -180 : 0 }}
                    transition={{ duration: turnMs / 1000, ease: TURN_EASE }}
                  >
                    <div
                      className="absolute inset-0 shadow-[0_0_28px_rgba(110,52,72,0.18)]"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <PageFace
                        side="right"
                        showCornerFold={leafFrontHasFold}
                        reducedMotion={reducedMotion}
                      >
                        {leafFront}
                      </PageFace>
                    </div>
                    <div
                      className="absolute inset-0"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    >
                      <PageFace side="left" showCornerFold reducedMotion={reducedMotion}>
                        {leafBack}
                      </PageFace>
                    </div>
                  </motion.div>
                </div>
              )}

              <div
                className="pointer-events-none absolute inset-y-0 left-1/2 z-40 w-14 -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(140,75,95,0.07)_38%,rgba(120,60,80,0.18)_50%,rgba(140,75,95,0.07)_62%,transparent)]"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-y-0 left-1/2 z-40 w-px -translate-x-1/2 bg-strawberry-300/80"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute left-1/2 top-0 z-40 h-3 w-4 -translate-x-1/2 rounded-b-sm bg-strawberry-500"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute bottom-0 left-1/2 z-40 h-2.5 w-4 -translate-x-1/2 rounded-t-sm bg-strawberry-500"
                aria-hidden="true"
              />
            </div>
          ) : (
            <div className="open-pages-frame relative mx-0.5 overflow-hidden rounded-[8px] bg-paper">
              <motion.div
                key={`mobile-${mobilePageIndex}`}
                drag={reducedMotion ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleMobileDragEnd}
                className={`paper-surface book-page-mobile relative shrink-0 overflow-hidden px-6 pb-3.5 pt-4 ${BOOK_FRAME}`}
              >
                {mobilePage}
                <PageCornerFold
                  side="left"
                  reducedMotion={reducedMotion}
                  ariaLabel={prevLabel}
                  onClick={onPrev}
                />
                {canGoNext && (
                  <PageCornerFold
                    side="right"
                    reducedMotion={reducedMotion}
                    ariaLabel="Next page"
                    onClick={onNext}
                  />
                )}
              </motion.div>

              {turn && (
                <div
                  className="pointer-events-none absolute inset-0 z-30"
                  style={{ perspective: 2000 }}
                  aria-hidden="true"
                >
                  <motion.div
                    key={`mleaf-${turn.dir}-${mobilePageIndex}`}
                    className="relative h-full w-full"
                    style={{
                      transformStyle: 'preserve-3d',
                      transformOrigin: 'left center',
                    }}
                    initial={{ rotateY: reducedMotion ? 0 : turn.dir === 1 ? 0 : -180 }}
                    animate={{ rotateY: reducedMotion ? 0 : turn.dir === 1 ? -180 : 0 }}
                    transition={{ duration: turnMs / 1000, ease: TURN_EASE }}
                  >
                    <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                      <div className="paper-surface book-page-mobile relative h-full overflow-hidden px-6 pb-3.5 pt-4">
                        {turn.fromMobile}
                      </div>
                    </div>
                    <div
                      className="paper-surface book-page-mobile absolute inset-0"
                      style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                      }}
                    />
                  </motion.div>
                </div>
              )}
            </div>
          )}

          <div
            className="ribbon-v-tail pointer-events-none absolute -bottom-7 left-[22%] h-9 w-[16px] overflow-hidden bg-strawberry-500 shadow-sm min-[900px]:left-[74%]"
            aria-hidden="true"
          >
            <div className="ribbon-sheen absolute inset-0" aria-hidden="true" />
          </div>
        </div>

        {isDesktop && (
          <nav
            aria-label="Rulebook chapter tabs"
            className="-ml-1 flex flex-col justify-center gap-2.5 py-8"
          >
            {desktopTabs.map((tab) => {
              const isActive = tab.spreadIndex === spreadIndex;
              return (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectSpread(tab.spreadIndex, tab.mobilePageIndex)}
                  aria-current={isActive ? 'page' : undefined}
                  data-star-jar-tab={tab.id === 'desk-jar' ? 'desktop' : undefined}
                  initial={false}
                  animate={{ x: isActive ? 8 : 0 }}
                  whileHover={reducedMotion || isActive ? undefined : { x: 4 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.32, 0, 0.24, 1] }}
                  className={`ribbon-tab-tail relative flex w-[142px] items-center justify-between gap-2 overflow-hidden border-y py-2.5 pl-4 pr-5 text-left text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 ${
                    isActive
                      ? 'border-strawberry-700 bg-strawberry-700 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                      : 'border-strawberry-200 bg-paper text-cocoa-soft hover:text-cocoa'
                  }`}
                >
                  {!isActive && (
                    <span className="ribbon-sheen pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
                  )}
                  {isActive && (
                    <span className="ribbon-sheen pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
                  )}
                  <span className="relative whitespace-nowrap">{tab.label}</span>
                  {tab.badge && (
                    <motion.span
                      key={tab.badge}
                      initial={reducedMotion ? undefined : { scale: 1 }}
                      animate={reducedMotion ? undefined : { scale: [1, 1.35, 1] }}
                      transition={{ duration: 0.36, ease: 'easeOut' }}
                      className={`relative text-[12px] font-extrabold leading-none ${
                        isActive ? 'text-paper/90' : 'text-strawberry-600'
                      }`}
                    >
                      {tab.badge}
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
};
