import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, X } from 'lucide-react';
import { RewardItem } from '../data/rules';
import { ClaimedReward } from '../lib/storage';
import { FleuronSvg, SatinBowSvg, TallyHeart, WaxSeal } from './Charms';

interface TreatMenuModalProps {
  rewards: RewardItem[];
  claimedRewards: ClaimedReward[];
  totalStarsEarned: number;
  reducedMotion: boolean;
  onClaimReward: (reward: RewardItem) => void;
  onFulfillClaim: (claimId: string) => void;
  onClose: () => void;
}

const CLAIM_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});

function formatClaimDay(dayKey: string): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return dayKey;
  return CLAIM_DATE_FORMAT.format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
}

const StarBadge: React.FC<{ muted?: boolean; className?: string }> = ({
  muted = false,
  className = 'h-4 w-4',
}) => (
  <Star
    className={`${className} ${
      muted ? 'fill-butter-100 text-cocoa-light' : 'fill-butter-300 text-cocoa'
    }`}
    strokeWidth={1.75}
    aria-hidden="true"
  />
);

export const TreatMenuModal: React.FC<TreatMenuModalProps> = ({
  rewards,
  claimedRewards,
  totalStarsEarned,
  reducedMotion,
  onClaimReward,
  onFulfillClaim,
  onClose,
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-cocoa/35 px-2 py-6 backdrop-blur-[1.5px] sm:px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Reward menu"
    >
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.32, 0, 0.24, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-full w-full max-w-[535px] flex-col"
      >
        <div
          className="pointer-events-none absolute -top-5 left-1/2 z-20 -translate-x-1/2"
          aria-hidden="true"
        >
          <SatinBowSvg className="h-10 w-[68px] drop-shadow-sm" />
        </div>

        <div className="paper-surface page-scroll relative max-h-full w-full overflow-y-auto rounded-[3px] border border-strawberry-200 px-3 pb-6 pt-7 shadow-book sm:px-7 sm:pb-7 sm:pt-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close reward menu"
            className="absolute right-3 top-3 rounded-sm p-1.5 text-cocoa-soft transition-colors hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 sm:right-3.5 sm:top-3.5"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-center">
            <h2 className="type-press font-display text-[25px] font-bold leading-tight text-cocoa sm:text-[28px]">
              Reward menu
            </h2>
            <p className="mt-1 text-[13.5px] font-semibold leading-snug text-cocoa-soft sm:text-[14px]">
              Redeem earned stars for rewards
            </p>
            <div className="mt-2 flex justify-center">
              <FleuronSvg className="h-3.5 w-24" />
            </div>

            <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-display text-[15px] font-bold text-strawberry-600">
                <StarBadge className="h-4 w-4 shrink-0 translate-y-[-0.5px]" />
                <span>
                  {totalStarsEarned} {totalStarsEarned === 1 ? 'star' : 'stars'} in the jar
                </span>
              </span>
              {claimedRewards.length > 0 && (
                <>
                  <span className="text-strawberry-300" aria-hidden="true">
                    &middot;
                  </span>
                  <span className="text-[13.5px] font-semibold text-cocoa-soft">
                    {claimedRewards.length}{' '}
                    {claimedRewards.length === 1 ? 'reward' : 'rewards'} pending
                  </span>
                </>
              )}
            </p>
          </div>

          <section className="mt-4 border-y border-strawberry-200/80 py-1">
            {rewards.length === 0 ? (
              <p className="py-5 text-center text-[14px] font-semibold text-cocoa-soft">
                No rewards configured yet.
              </p>
            ) : (
              <ol>
                {rewards.map((reward, index) => {
                  const canAfford = totalStarsEarned >= reward.cost;
                  const unitLabel = reward.cost === 1 ? 'star' : 'stars';

                  const rowContent = (
                    <span className="flex w-full items-baseline gap-1 sm:gap-2">
                      <span
                        className="w-[15px] shrink-0 select-none text-right font-display text-[12px] font-semibold tabular-nums text-cocoa-soft sm:w-5 sm:text-[13px]"
                        aria-hidden="true"
                      >
                        {index + 1}.
                      </span>

                      <span
                        className={`text-[12.5px] font-semibold leading-snug transition-colors sm:text-[15px] ${
                          canAfford
                            ? 'text-cocoa group-hover:text-strawberry-700'
                            : 'text-cocoa-soft'
                        }`}
                      >
                        {reward.title}
                      </span>

                      <span
                        className={`mx-0.5 min-w-[10px] flex-1 translate-y-[-4px] border-b-2 border-dotted transition-colors sm:mx-2 sm:min-w-[24px] ${
                          canAfford
                            ? 'border-strawberry-200 group-hover:border-strawberry-300'
                            : 'border-strawberry-200/65'
                        }`}
                        aria-hidden="true"
                      />

                      <span className="inline-flex shrink-0 items-baseline whitespace-nowrap">
                        {canAfford && (
                          <>
                            <span className="text-[12px] font-bold text-strawberry-700 underline decoration-strawberry-300 underline-offset-4 transition-colors group-hover:decoration-strawberry-700 sm:text-[13px]">
                              Claim
                            </span>
                            <span
                              className="mx-0.5 text-strawberry-300 sm:mx-1.5"
                              aria-hidden="true"
                            >
                              &middot;
                            </span>
                          </>
                        )}
                        <span
                          className={`inline-flex w-[33px] shrink-0 items-center justify-end gap-0.5 font-display text-[13px] tabular-nums sm:w-[78px] sm:gap-1.5 sm:text-[14.5px] ${
                            canAfford
                              ? 'font-bold text-strawberry-600'
                              : 'font-semibold text-cocoa-soft'
                          }`}
                        >
                          <StarBadge
                            muted={!canAfford}
                            className="h-3.5 w-3.5 shrink-0 translate-y-[0.5px]"
                          />
                          <span className="min-w-[15px] text-right sm:min-w-[17px]">
                            {reward.cost}
                          </span>
                          <span className="hidden min-w-[32px] text-left sm:inline">
                            {unitLabel}
                          </span>
                        </span>
                      </span>
                    </span>
                  );

                  if (!canAfford) {
                    return (
                      <li
                        key={reward.id}
                        className="relative py-2.5 text-left sm:py-3"
                      >
                        {rowContent}
                        {index < rewards.length - 1 && (
                          <span
                            className="pointer-events-none absolute inset-x-0 bottom-0 block h-px bg-gradient-to-r from-strawberry-200/60 via-strawberry-100/50 to-transparent"
                            aria-hidden="true"
                          />
                        )}
                      </li>
                    );
                  }

                  return (
                    <li key={reward.id} className="relative">
                      <motion.button
                        type="button"
                        whileTap={reducedMotion ? undefined : { scale: 0.985 }}
                        onClick={() => onClaimReward(reward)}
                        aria-label={`Claim ${reward.title} for ${reward.cost} ${unitLabel}`}
                        className="group flex w-full rounded-sm py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 sm:py-3"
                      >
                        {rowContent}
                      </motion.button>
                      {index < rewards.length - 1 && (
                        <span
                          className="pointer-events-none absolute inset-x-0 bottom-0 block h-px bg-gradient-to-r from-strawberry-200/60 via-strawberry-100/50 to-transparent"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {claimedRewards.length > 0 && (
            <section className="mt-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-[13.5px] font-bold text-strawberry-600">
                  Claimed rewards
                </p>
                <p className="text-[12.5px] font-semibold text-cocoa-soft">
                  {claimedRewards.length} pending
                </p>
              </div>
              <ul className="mt-1.5 divide-y divide-strawberry-100/90 border-t border-strawberry-200/80">
                {claimedRewards.map((claim) => (
                  <li key={claim.id}>
                    <button
                      type="button"
                      onClick={() => onFulfillClaim(claim.id)}
                      className="group flex w-full items-start justify-between gap-3 pb-1 pt-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <TallyHeart
                          filled
                          className="mt-[3px] h-3.5 w-3.5 shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-[14px] font-semibold leading-snug text-cocoa transition-colors group-hover:text-strawberry-700 sm:text-[14.5px]">
                            {claim.title}
                          </span>
                          <span className="mt-0.5 block text-[12.5px] font-medium text-cocoa-soft">
                            {formatClaimDay(claim.dayKey)} &middot; {claim.cost}{' '}
                            {claim.cost === 1 ? 'star' : 'stars'}
                          </span>
                        </span>
                      </span>
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-cocoa-soft underline decoration-strawberry-200 underline-offset-4 transition-colors group-hover:text-strawberry-700 group-hover:decoration-strawberry-700">
                        <Check className="h-3.5 w-3.5 text-strawberry-600" />
                        <span>Fulfilled</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <WaxSeal className="pointer-events-none absolute -bottom-3 -right-2.5 z-20 h-10 w-10 drop-shadow-sm sm:-right-3" />
      </motion.div>
    </motion.div>
  );
};
