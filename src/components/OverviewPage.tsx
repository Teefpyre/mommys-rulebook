import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import { ChapterData } from '../data/rules';
import { LedgerRow, PageHeading, RunningHeader } from './PaperBits';

interface OverviewPageProps {
  chapters: ChapterData[];
  displayDate: string;
  activeDayKey: string;
  checkedRuleIds: string[];
  completedDays: string[];
  dayHistory: Record<string, string[]>;
  streak: number;
  totalStarsEarned: number;
  onOpenStudio: () => void;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});

interface MonthShape {
  daysInMonth: number;
  firstWeekday: number;
  label: string;
}

function readMonth(dayKey: string): MonthShape {
  const [year, month] = dayKey.split('-').map(Number);
  return {
    daysInMonth: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
    label: MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1))),
  };
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  chapters,
  displayDate,
  activeDayKey,
  checkedRuleIds,
  completedDays,
  dayHistory,
  streak,
  totalStarsEarned,
  onOpenStudio,
}) => {
  const totalRules = useMemo(
    () => chapters.reduce((sum, chapter) => sum + chapter.rules.length, 0),
    [chapters]
  );

  const month = useMemo(() => readMonth(activeDayKey), [activeDayKey]);

  const checkedFor = (dayKey: string) =>
    dayKey === activeDayKey ? checkedRuleIds.length : dayHistory[dayKey]?.length ?? 0;

  const isComplete = (dayKey: string) =>
    dayKey === activeDayKey
      ? totalRules > 0 && checkedRuleIds.length === totalRules
      : completedDays.includes(dayKey);

  const monthPrefix = activeDayKey.slice(0, 7);

  const tally = useMemo(() => {
    let complete = 0;
    let partial = 0;
    let quiet = 0;
    for (let day = 1; day <= month.daysInMonth; day += 1) {
      const dayKey = `${monthPrefix}-${String(day).padStart(2, '0')}`;
      if (dayKey > activeDayKey) continue;
      if (isComplete(dayKey)) complete += 1;
      else if (checkedFor(dayKey) > 0) partial += 1;
      else quiet += 1;
    }
    return { complete, partial, quiet };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.daysInMonth, monthPrefix, activeDayKey, checkedRuleIds, completedDays, dayHistory, totalRules]);

  const cells: Array<{ day: number; dayKey: string } | null> = [
    ...Array.from({ length: month.firstWeekday }, () => null),
    ...Array.from({ length: month.daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, dayKey: `${monthPrefix}-${String(day).padStart(2, '0')}` };
    }),
  ];

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="min-h-0 flex-1 overflow-hidden">
        <RunningHeader
          left="Summary"
          right={<span className="text-[13px] font-bold text-strawberry-600">{month.label}</span>}
        />

        <PageHeading centered title="Daily summary" />

        <section className="mt-3 border-y border-strawberry-200/80 py-2.5">
          <p className="font-display text-[13px] font-bold uppercase tracking-[0.16em] text-cocoa-soft">{displayDate}</p>
          <div className="mt-1.5 space-y-0.5">
            {chapters.map((chapter) => {
              const done = chapter.rules.filter((rule) =>
                checkedRuleIds.includes(rule.id)
              ).length;
              return (
                <LedgerRow
                  key={chapter.id}
                  label={chapter.tabLabel}
                  value={`${done} of ${chapter.rules.length}`}
                />
              );
            })}
          </div>
          <p className="mt-1.5 text-[13px] font-bold text-cocoa">
            {checkedRuleIds.length} of {totalRules} items
            <span className="mx-1.5 text-strawberry-300" aria-hidden="true">
              &middot;
            </span>
            {chapters.filter(
              (chapter) =>
                chapter.rules.length > 0 &&
                chapter.rules.every((rule) => checkedRuleIds.includes(rule.id))
            ).length}{' '}
            of {chapters.length} chapters complete
          </p>
        </section>

        <section className="mt-3">
          <div className="grid grid-cols-7 gap-y-1">
            {WEEKDAY_INITIALS.map((initial, index) => (
              <span
                key={`${initial}-${index}`}
                className="text-center font-display text-[11px] font-bold uppercase tracking-[0.12em] text-cocoa-light"
                aria-hidden="true"
              >
                {initial}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-y-1">
            {cells.map((cell, index) => {
              if (!cell) return <span key={`blank-${index}`} aria-hidden="true" />;

              const complete = isComplete(cell.dayKey);
              const partial = !complete && checkedFor(cell.dayKey) > 0;
              const isToday = cell.dayKey === activeDayKey;

              return (
                <span key={cell.dayKey} className="flex justify-center">
                  <span
                    className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-display text-[12px] font-bold tabular-nums transition-colors ${
                      complete
                        ? 'bg-strawberry-500 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]'
                        : partial
                          ? 'text-strawberry-600 ring-1 ring-inset ring-strawberry-300'
                          : 'text-cocoa-soft'
                    } ${isToday ? 'ring-1 ring-strawberry-700 ring-offset-1 ring-offset-paper' : ''}`}
                  >
                    {cell.day}
                  </span>
                </span>
              );
            })}
          </div>

          <p className="mt-2 text-[12.5px] font-bold text-cocoa-soft">
            {tally.complete} complete
            <span className="mx-1.5 text-strawberry-300" aria-hidden="true">
              &middot;
            </span>
            {tally.partial} partial
            <span className="mx-1.5 text-strawberry-300" aria-hidden="true">
              &middot;
            </span>
            {tally.quiet} empty
          </p>
        </section>

        <section className="mt-3 space-y-0.5 border-t border-strawberry-200/80 pt-2.5">
          <LedgerRow label="Current streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
          <LedgerRow label="Total stars" value={`${totalStarsEarned}`} />
          <LedgerRow label="Completed days" value={`${completedDays.length}`} />
        </section>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2.5">
        <span className="h-px w-8 bg-strawberry-200" aria-hidden="true" />
        <button
          type="button"
          onClick={onOpenStudio}
          aria-label="Open editor studio"
          className="inline-flex items-center justify-center rounded-sm p-1 text-cocoa-light transition-colors hover:text-strawberry-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
        >
          <Lock className="h-3.5 w-3.5" />
        </button>
        <p className="text-[12.5px] font-bold text-cocoa-soft">Page 8</p>
        <span className="h-px w-8 bg-strawberry-200" aria-hidden="true" />
      </div>
    </div>
  );
};
