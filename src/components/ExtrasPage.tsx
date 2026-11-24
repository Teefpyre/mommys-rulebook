import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ExtraTask,
  formatExtraDue,
  isExtraExpired,
  isoUtcToLocalInput,
  localInputToIsoUtc,
  MAX_EXTRA_STARS,
  MIN_EXTRA_STARS,
} from '../lib/storage';
import { InkCheckbox } from './Charms';
import { Folio, PageHeading, RunningHeader } from './PaperBits';

export interface CompletingExtraSnapshot {
  text: string;
  dueAt: string | null;
  stars: number;
}

interface ExtrasPageProps {
  extras: ExtraTask[];
  completingExtras?: Record<string, CompletingExtraSnapshot>;
  reducedMotion: boolean;
  now: Date;
  onUpdateExtra: (
    id: string,
    patch: Partial<Pick<ExtraTask, 'text' | 'dueAt' | 'stars'>>,
    immediate?: boolean
  ) => void;
  onToggleExtra: (id: string, originEl?: HTMLElement | null) => void;
  onClearExtra: (id: string) => void;
  onFlushEdit?: () => void;
}

export const ExtrasPage: React.FC<ExtrasPageProps> = ({
  extras,
  completingExtras = {},
  reducedMotion,
  now,
  onUpdateExtra,
  onToggleExtra,
  onClearExtra,
  onFlushEdit,
}) => {
  const [starDrafts, setStarDrafts] = useState<Record<string, string>>({});

  const clearStarDraft = (id: string) => {
    setStarDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const displayExtras: ExtraTask[] = extras.map((extra) => {
    const completing = completingExtras[extra.id];
    if (!completing) return extra;
    return {
      ...extra,
      text: completing.text,
      dueAt: completing.dueAt,
      stars: completing.stars,
      checked: true,
    };
  });

  const liveCount = displayExtras.filter((extra) => extra.text.trim().length > 0).length;

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex min-h-0 flex-1 flex-col">
        <RunningHeader
          left="Extras"
          right={
            <span className="text-[13px] font-bold tabular-nums text-strawberry-600">
              {liveCount} of {displayExtras.length}
            </span>
          }
        />

        <PageHeading
          title="Bonus tasks"
          subtitle="Optional tasks with custom deadlines and star rewards."
        />

        <div className="h-px bg-gradient-to-r from-strawberry-200/90 via-strawberry-200/50 to-transparent pb-0" aria-hidden="true" />

        <div className="page-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          <ol>
            {displayExtras.map((extra, idx) => {
              const expired = isExtraExpired(extra, now);
              const trimmed = extra.text.trim();
              const dueLabel = extra.dueAt ? formatExtraDue(extra.dueAt) : '';
              const numLabel = `${idx + 1}.`;
              const starValue =
                !extra.checked && extra.id in starDrafts
                  ? starDrafts[extra.id]
                  : String(extra.stars);
              const parsedDraftStars = Number.parseInt(starValue, 10);
              const starUnitCount =
                Number.isFinite(parsedDraftStars) && parsedDraftStars >= MIN_EXTRA_STARS
                  ? parsedDraftStars
                  : extra.stars;

              return (
                <li key={extra.id} className="relative">
                  {expired ? (
                    <div className="flex w-full items-start gap-3 px-1 py-3.5 text-left">
                      <span
                        className="mt-[3px] w-5 shrink-0 select-none text-right text-[13px] font-semibold tabular-nums text-cocoa-soft/60"
                        aria-hidden="true"
                      >
                        {numLabel}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-semibold leading-[1.45] text-cocoa-soft/60 line-through decoration-strawberry-300">
                          {extra.text}
                        </span>
                        {dueLabel && (
                          <span className="mt-0.5 block text-[13px] font-medium leading-snug text-cocoa-soft/60">
                            {dueLabel} has passed
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            clearStarDraft(extra.id);
                            onClearExtra(extra.id);
                          }}
                          className="mt-1 text-[12.5px] font-bold text-strawberry-600 underline decoration-strawberry-300 underline-offset-4 transition-colors hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
                        >
                          Clear item
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="flex w-full items-start gap-3 px-1 py-3.5">
                      <span
                        className="mt-[3px] w-5 shrink-0 select-none text-right text-[13px] font-semibold tabular-nums text-cocoa-soft"
                        aria-hidden="true"
                      >
                        {numLabel}
                      </span>
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          if (!trimmed || extra.checked) return;
                          clearStarDraft(extra.id);
                          onToggleExtra(extra.id, e.currentTarget);
                        }}
                        disabled={!trimmed || extra.checked}
                        whileTap={reducedMotion || !trimmed || extra.checked ? undefined : { scale: 0.995 }}
                        aria-pressed={extra.checked}
                        aria-label={
                          trimmed
                            ? `Complete bonus task ${idx + 1}: ${trimmed} (${extra.stars} ${extra.stars === 1 ? 'star' : 'stars'})`
                            : `Bonus task ${idx + 1}`
                        }
                        className={`group mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500 ${
                          trimmed && !extra.checked ? '' : 'cursor-default'
                        }`}
                      >
                        <span data-ink-checkbox>
                          <InkCheckbox
                            checked={extra.checked}
                            reducedMotion={reducedMotion}
                            className="h-6 w-6"
                          />
                        </span>
                      </motion.button>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-baseline gap-2">
                          <input
                            type="text"
                            size={1}
                            value={extra.text}
                            disabled={extra.checked}
                            onChange={(e) => onUpdateExtra(extra.id, { text: e.target.value })}
                            onBlur={() => onFlushEdit?.()}
                            placeholder="Write a bonus task..."
                            maxLength={120}
                            aria-label={`Bonus task ${idx + 1} text`}
                            className="w-full min-w-0 flex-1 border-b border-transparent bg-transparent pb-0.5 text-[15.5px] font-semibold leading-[1.45] text-cocoa transition-colors placeholder:font-medium placeholder:text-cocoa-light hover:border-strawberry-200 focus:border-strawberry-500 focus:outline-none"
                          />
                          <label className="inline-flex shrink-0 items-baseline gap-1">
                            <input
                              type="text"
                              size={1}
                              inputMode="numeric"
                              value={starValue}
                              disabled={extra.checked}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) => {
                                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                                setStarDrafts((prev) => ({ ...prev, [extra.id]: digits }));
                                if (digits === '') return;
                                const parsed = Number.parseInt(digits, 10);
                                if (Number.isFinite(parsed) && parsed >= MIN_EXTRA_STARS) {
                                  onUpdateExtra(extra.id, {
                                    stars: Math.min(MAX_EXTRA_STARS, parsed),
                                  });
                                }
                              }}
                              onBlur={() => {
                                clearStarDraft(extra.id);
                                onFlushEdit?.();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  clearStarDraft(extra.id);
                                  onUpdateExtra(
                                    extra.id,
                                    { stars: Math.min(MAX_EXTRA_STARS, extra.stars + 1) },
                                    true
                                  );
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  clearStarDraft(extra.id);
                                  onUpdateExtra(
                                    extra.id,
                                    { stars: Math.max(MIN_EXTRA_STARS, extra.stars - 1) },
                                    true
                                  );
                                }
                              }}
                              aria-label={`Bonus task ${idx + 1} stars`}
                              className="w-8 border-b border-strawberry-200 bg-transparent pb-0.5 text-right font-display text-[13.5px] font-bold tabular-nums text-strawberry-600 transition-colors hover:border-strawberry-300 focus:border-strawberry-500 focus:outline-none"
                            />
                            <span className="text-[12px] font-semibold text-cocoa-soft">
                              {starUnitCount === 1 ? 'star' : 'stars'}
                            </span>
                          </label>
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[12.5px] font-semibold text-cocoa-soft/80">
                            due by
                          </span>
                          <input
                            type="datetime-local"
                            value={isoUtcToLocalInput(extra.dueAt)}
                            disabled={extra.checked}
                            onChange={(e) =>
                              onUpdateExtra(
                                extra.id,
                                { dueAt: e.target.value ? localInputToIsoUtc(e.target.value) : null },
                                true
                              )
                            }
                            aria-label={`Bonus task ${idx + 1} deadline`}
                            className="border-b border-transparent bg-transparent pb-0.5 text-[12.5px] font-bold tabular-nums text-cocoa-soft transition-colors hover:border-strawberry-200 focus:border-strawberry-500 focus:outline-none"
                          />
                          {extra.dueAt ? (
                            <>
                              <span className="text-[12.5px] font-medium text-cocoa-soft">
                                by {dueLabel}
                              </span>
                              <button
                                type="button"
                                disabled={extra.checked}
                                onClick={() => onUpdateExtra(extra.id, { dueAt: null }, true)}
                                className="text-[12px] font-bold text-strawberry-600 transition-colors hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
                              >
                                Clear deadline
                              </button>
                            </>
                          ) : (
                            <span className="text-[12px] font-medium text-cocoa-soft/70">
                              no deadline
                            </span>
                          )}
                        </span>
                      </span>
                    </div>
                  )}
                  {idx < displayExtras.length - 1 && (
                    <span
                      className="pointer-events-none absolute inset-x-1 bottom-0 block h-px bg-gradient-to-r from-strawberry-200/70 via-strawberry-100/60 to-transparent"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <Folio page={6} />
    </div>
  );
};
