import React from 'react';
import { BookMeta } from '../data/rules';
import { TallyHeart } from './Charms';
import { Folio, LedgerRow, PageHeading, RunningHeader } from './PaperBits';
import { SecretNote } from './SecretNote';

interface WelcomePageProps {
  meta: BookMeta;
  displayDate: string;
  resetCountdown: string;
  completedCount: number;
  totalCount: number;
  streak: number;
  totalStars: number;
  openedNoteIds: string[];
  reducedMotion: boolean;
  onFirstOpenNote: (noteId: string, label?: string) => void;
  onJumpToJar: () => void;
}

const MAX_TALLY_HEARTS = 24;

export const WelcomePage: React.FC<WelcomePageProps> = ({
  meta,
  displayDate,
  resetCountdown,
  completedCount,
  totalCount,
  streak,
  totalStars,
  openedNoteIds,
  reducedMotion,
  onFirstOpenNote,
  onJumpToJar,
}) => {
  const heartSlots = Math.min(totalCount, MAX_TALLY_HEARTS);
  const filledHearts =
    totalCount <= MAX_TALLY_HEARTS
      ? completedCount
      : Math.round((completedCount / Math.max(totalCount, 1)) * MAX_TALLY_HEARTS);

  const heartGroups: number[][] = [];
  for (let i = 0; i < heartSlots; i += 4) {
    const group: number[] = [];
    for (let j = i; j < Math.min(i + 4, heartSlots); j += 1) {
      group.push(j);
    }
    heartGroups.push(group);
  }

  const heartRows: number[][][] = [];
  if (heartGroups.length > 3) {
    const perRow = Math.ceil(heartGroups.length / 2);
    for (let i = 0; i < heartGroups.length; i += perRow) {
      heartRows.push(heartGroups.slice(i, i + perRow));
    }
  } else if (heartGroups.length > 0) {
    heartRows.push(heartGroups);
  }

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="page-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <RunningHeader left="" right={displayDate} />

        <div className="mt-2">
          <PageHeading centered title={meta.dedicationTitle} />
        </div>

        <p className="mt-4 text-[15px] font-medium leading-[1.7] text-cocoa first-letter:font-display first-letter:text-[22px] first-letter:font-bold first-letter:text-strawberry-600">
          {meta.dedicationBody}
        </p>

        <div className="mt-5 border-y border-strawberry-200/80 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-display text-[13px] font-bold uppercase tracking-[0.18em] text-strawberry-600">
              Today
            </span>
            <span className="text-[12.5px] font-semibold text-cocoa-soft">
              resets in {resetCountdown}
            </span>
          </div>

          {heartRows.length > 0 && (
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div
                className="flex flex-col gap-y-1"
                role="img"
                aria-label={`${completedCount} of ${totalCount} items completed today`}
              >
                {heartRows.map((row, rIdx) => (
                  <div key={rIdx} className="flex items-center gap-x-2">
                    {row.map((group, gIdx) => (
                      <span key={gIdx} className="inline-flex items-center gap-[2px]">
                        {group.map((idx) => (
                          <TallyHeart
                            key={idx}
                            filled={idx < filledHearts}
                            className="h-[15px] w-[15px]"
                          />
                        ))}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <span className="type-press shrink-0 font-display text-[17px] font-bold text-strawberry-600">
                {completedCount} of {totalCount}
              </span>
            </div>
          )}

          <div className="mt-3 space-y-1.5 border-t border-strawberry-100 pt-2.5">
            <LedgerRow
              label="Current streak"
              value={`${streak} ${streak === 1 ? 'day' : 'days'}`}
            />
            <LedgerRow
              label="Star balance"
              value={
                <span className="text-strawberry-600 transition-colors group-hover:text-strawberry-700 group-hover:underline">
                  {totalStars} {totalStars === 1 ? 'star' : 'stars'}
                </span>
              }
              onClick={onJumpToJar}
            />
          </div>
        </div>

        <SecretNote
          note={meta.welcomeNote}
          isOpenedPreviously={openedNoteIds.includes(meta.welcomeNote.id)}
          reducedMotion={reducedMotion}
          onFirstOpen={(noteId) => onFirstOpenNote(noteId, meta.welcomeNote.label)}
        />
      </div>

      <Folio page={1} />
    </div>
  );
};
