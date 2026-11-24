import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChapterData,
  CHECK_FEEDBACK_LINES,
  DEFAULT_BOOK_META,
  EXTRA_FEEDBACK_LINES,
  RewardItem,
} from './data/rules';
import { soundEngine } from './lib/sound';
import {
  applyRulebookAction,
  createClientUid,
  RulebookAction,
} from './lib/rulebookActions';
import {
  computeCozyStreak,
  ExtraTask,
  formatEasternDisplayDate,
  getActiveChapters,
  getActiveRewards,
  getResetCountdownLabel,
  isExtraExpired,
  isRuleLocked,
  isValidBackupPayload,
  reconcileDailyReset,
  RulebookState,
  sanitizeExtraStars,
} from './lib/storage';
import {
  createRulebookSync,
  DispatchOptions,
  getInitialLocalState,
  RulebookSyncHandle,
} from './lib/sync';
import {
  isStudioRemembered,
  setStudioRemembered,
} from './lib/studioKey';
import { BookShell, RibbonTab } from './components/BookShell';
import { HeartNote } from './components/HeartNote';
import { TreatMenuModal } from './components/TreatMenuModal';
import { ChapterPage } from './components/ChapterPage';
import { CoverPage } from './components/CoverPage';
import { CompletingExtraSnapshot, ExtrasPage } from './components/ExtrasPage';
import { OverviewPage } from './components/OverviewPage';
import { StarFlight, StarFlightLayer } from './components/StarFlight';
import { StarJar } from './components/StarJar';
import { StudioDrawer } from './components/StudioDrawer';
import { WelcomePage } from './components/WelcomePage';

const TOTAL_SPREADS = 4;
const TOTAL_MOBILE_PAGES = 8;
const STAR_FLIGHT_MS = 420;

export const App: React.FC = () => {
  const initialStateRef = useRef<RulebookState | null>(null);
  if (!initialStateRef.current) {
    initialStateRef.current = getInitialLocalState();
  }
  const [state, setState] = useState<RulebookState>(initialStateRef.current);
  const [bookOpen, setBookOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [mobilePageIndex, setMobilePageIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [now, setNow] = useState(() => new Date());
  const [treatMenuOpen, setTreatMenuOpen] = useState(false);

  const [studioOpen, setStudioOpen] = useState(false);
  const [studioUnlocked, setStudioUnlocked] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : isStudioRemembered()
  );
  const [studioRemembered, setStudioRememberedState] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : isStudioRemembered()
  );
  const [chapterEditNonces, setChapterEditNonces] = useState<Record<string, number>>({});

  const [flights, setFlights] = useState<StarFlight[]>([]);
  const [inFlightStars, setInFlightStars] = useState(0);
  const flightIdRef = useRef(0);

  const [completingExtras, setCompletingExtras] = useState<
    Record<string, CompletingExtraSnapshot>
  >({});

  const [heartSpeech, setHeartSpeech] = useState<string | null>(null);
  const [heartPulse, setHeartPulse] = useState(0);
  const speechTimerRef = useRef<number | null>(null);
  const activeTimersRef = useRef<Set<number>>(new Set());

  const syncRef = useRef<RulebookSyncHandle | null>(null);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      activeTimersRef.current.delete(id);
      fn();
    }, ms);
    activeTimersRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    const handle = createRulebookSync(initialStateRef.current!, (next) => {
      setState(next);
    });
    syncRef.current = handle;
    return () => {
      handle.destroy();
      syncRef.current = null;
    };
  }, []);

  const dispatchAction = useCallback(
    (action: RulebookAction, options?: DispatchOptions) => {
      if (syncRef.current) {
        syncRef.current.dispatch(action, options);
      } else {
        setState((prev) => applyRulebookAction(prev, action, new Date(action.at)));
      }
    },
    []
  );

  const flushSync = useCallback(() => {
    syncRef.current?.flush();
  }, []);

  const handleUnlockStudio = useCallback((remember: boolean) => {
    setStudioRemembered(remember);
    setStudioRememberedState(remember);
    setStudioUnlocked(true);
  }, []);

  const handleLockStudio = useCallback(() => {
    flushSync();
    setStudioRemembered(false);
    setStudioRememberedState(false);
    setStudioUnlocked(false);
    setStudioOpen(false);
    soundEngine.playPageFlip();
  }, [flushSync]);

  const handleToggleRemember = useCallback((remember: boolean) => {
    setStudioRemembered(remember);
    setStudioRememberedState(remember);
  }, []);

  useEffect(
    () => () => {
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      for (const id of activeTimersRef.current) {
        window.clearTimeout(id);
      }
      activeTimersRef.current.clear();
    },
    []
  );

  const chapters = useMemo(() => getActiveChapters(state), [state]);
  const rewards = useMemo(() => getActiveRewards(state), [state]);
  const allRuleIds = useMemo(
    () => chapters.flatMap((ch) => ch.rules.map((r) => r.id)),
    [chapters]
  );

  const validCheckedIds = useMemo(() => {
    const allowed = new Set(allRuleIds);
    return state.checkedRuleIds.filter((id) => allowed.has(id));
  }, [allRuleIds, state.checkedRuleIds]);

  const completedCount = validCheckedIds.length;
  const totalRules = allRuleIds.length;
  const displayedStars = Math.max(0, state.totalStarsEarned - inFlightStars);
  const streak = useMemo(
    () => computeCozyStreak(state.completedDays, state.activeDayKey),
    [state.completedDays, state.activeDayKey]
  );

  useEffect(() => {
    let timerId: number | null = null;

    const syncClock = () => {
      const current = new Date();
      setNow(current);
      syncRef.current?.reconcileClock(current);
    };

    const scheduleNextMinute = () => {
      const delay = 60_000 - (Date.now() % 60_000) + 120;
      timerId = window.setTimeout(() => {
        syncClock();
        scheduleNextMinute();
      }, delay);
    };

    scheduleNextMinute();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncClock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timerId !== null) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const showHeartLine = useCallback((line: string, durationMs = 3000) => {
    setHeartSpeech(line);
    setHeartPulse((n) => n + 1);

    if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
    speechTimerRef.current = window.setTimeout(() => {
      setHeartSpeech(null);
    }, durationMs);
  }, []);

  useEffect(() => {
    if (!bookOpen) {
      if (speechTimerRef.current) window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
      setHeartSpeech(null);
    }
  }, [bookOpen]);

  const closeToCover = useCallback(() => {
    flushSync();
    soundEngine.playPageFlip();
    setBookOpen(false);
    setFlights([]);
    setInFlightStars(0);
    setStudioOpen(false);
    setTreatMenuOpen(false);
    if (!studioRemembered) {
      setStudioUnlocked(false);
    }
  }, [flushSync, studioRemembered]);

  const handleOpenBook = () => {
    soundEngine.playPageFlip();
    setBookOpen(true);
    setHasOpened(true);
    setSpreadIndex(0);
    setMobilePageIndex(0);
  };

  const handleSelectSpread = (nextSpread: number, nextMobile: number) => {
    flushSync();
    setDirection(nextSpread >= spreadIndex ? 1 : -1);
    setSpreadIndex(nextSpread);
    setMobilePageIndex(nextMobile);
    soundEngine.playPageFlip();
  };

  const isDesktopNow = () =>
    typeof window !== 'undefined' && window.innerWidth >= 900;

  const handlePrev = useCallback(() => {
    if (isDesktopNow()) {
      if (spreadIndex === 0) {
        closeToCover();
        return;
      }
      flushSync();
      setDirection(-1);
      const nextSpread = spreadIndex - 1;
      setSpreadIndex(nextSpread);
      setMobilePageIndex(nextSpread * 2);
      soundEngine.playPageFlip();
    } else {
      if (mobilePageIndex === 0) {
        closeToCover();
        return;
      }
      flushSync();
      setDirection(-1);
      const nextMobile = mobilePageIndex - 1;
      setMobilePageIndex(nextMobile);
      setSpreadIndex(Math.floor(nextMobile / 2));
      soundEngine.playPageFlip();
    }
  }, [closeToCover, flushSync, mobilePageIndex, spreadIndex]);

  const handleNext = useCallback(() => {
    if (isDesktopNow()) {
      if (spreadIndex >= TOTAL_SPREADS - 1) return;
      flushSync();
      setDirection(1);
      const nextSpread = spreadIndex + 1;
      setSpreadIndex(nextSpread);
      setMobilePageIndex(nextSpread * 2);
      soundEngine.playPageFlip();
    } else {
      if (mobilePageIndex >= TOTAL_MOBILE_PAGES - 1) return;
      flushSync();
      setDirection(1);
      const nextMobile = mobilePageIndex + 1;
      setMobilePageIndex(nextMobile);
      setSpreadIndex(Math.floor(nextMobile / 2));
      soundEngine.playPageFlip();
    }
  }, [flushSync, mobilePageIndex, spreadIndex]);

  const launchStarFlight = useCallback(
    (originEl: HTMLElement | null | undefined, fly: boolean, count = 1) => {
      if (!fly || state.preferences.reducedMotion || typeof window === 'undefined') {
        return;
      }

      const box = originEl?.querySelector('[data-ink-checkbox]') as HTMLElement | null;
      const originRect = (box ?? originEl)?.getBoundingClientRect();
      if (!originRect) return;

      const jarTab = document.querySelector('[data-star-jar-tab]') as HTMLElement | null;
      const jarRect = jarTab?.getBoundingClientRect();
      const hasJar = !!jarRect && jarRect.width > 0 && jarRect.height > 0;

      setInFlightStars((n) => n + count);

      const visualFlights = Math.min(count, 6);
      for (let i = 0; i < visualFlights; i += 1) {
        const id = flightIdRef.current++;
        const lag = i * 90;
        scheduleTimeout(() => {
          setFlights((prev) => [
            ...prev,
            {
              id,
              fromX: originRect.left + originRect.width / 2,
              fromY: originRect.top + originRect.height / 2,
              toX: hasJar ? jarRect.left + 14 : window.innerWidth - 30,
              toY: hasJar ? jarRect.top + jarRect.height / 2 : originRect.top,
            },
          ]);
          scheduleTimeout(
            () => setFlights((prev) => prev.filter((f) => f.id !== id)),
            STAR_FLIGHT_MS + 160
          );
        }, lag);
      }

      scheduleTimeout(() => {
        setInFlightStars((n) => Math.max(0, n - count));
      }, STAR_FLIGHT_MS + (visualFlights - 1) * 90);
    },
    [scheduleTimeout, state.preferences.reducedMotion]
  );

  const handleToggleRule = (ruleId: string, originEl?: HTMLElement | null) => {
    const current = new Date();
    const reconciledNow = reconcileDailyReset(state, current);
    const alreadyChecked = reconciledNow.checkedRuleIds.includes(ruleId);

    const activeChapters = getActiveChapters(reconciledNow);
    const targetRule = activeChapters
      .flatMap((chapter) => chapter.rules)
      .find((rule) => rule.id === ruleId);
    if (!targetRule) return;
    if (!alreadyChecked && isRuleLocked(targetRule, current, false)) {
      return;
    }

    const activeIds = activeChapters.flatMap((c) => c.rules.map((r) => r.id));
    const willBeChecked = alreadyChecked
      ? reconciledNow.checkedRuleIds.filter((id) => id !== ruleId)
      : [...reconciledNow.checkedRuleIds, ruleId];
    const willCompleteAll =
      activeIds.length > 0 &&
      willBeChecked.filter((id) => activeIds.includes(id)).length === activeIds.length;
    const justFinishedDay = !alreadyChecked && willCompleteAll && !reconciledNow.dailyCelebrated;

    const at = current.getTime();
    dispatchAction({
      type: 'toggleRule',
      ruleId,
      at,
      logId: createClientUid('log'),
      perfectLogId: createClientUid('log'),
    });

    if (justFinishedDay) {
      scheduleTimeout(() => {
        soundEngine.playCelebration();
        showHeartLine('All daily items finished for today!');
      }, 180);
    }

    if (!alreadyChecked && !willCompleteAll) {
      soundEngine.playCheckPop();
      scheduleTimeout(() => soundEngine.playStarChime(), 130);
      const line =
        CHECK_FEEDBACK_LINES[Math.floor(Math.random() * CHECK_FEEDBACK_LINES.length)];
      showHeartLine(line);
    } else if (alreadyChecked) {
      soundEngine.playUncheck();
    }

    if (!alreadyChecked) {
      launchStarFlight(originEl, !willCompleteAll, 1);
    }
  };

  const handleUpdateChapter = (updated: ChapterData, immediate = false) => {
    const prior = chapters.find((ch) => ch.id === updated.id);
    const structuralChange =
      immediate ||
      !prior ||
      prior.rules.length !== updated.rules.length ||
      prior.rules.some((r, idx) => updated.rules[idx]?.id !== r.id);

    dispatchAction(
      {
        type: 'updateChapter',
        chapter: updated,
        at: Date.now(),
        logId: createClientUid('log'),
      },
      structuralChange
        ? undefined
        : { coalesceKey: `chapter:${updated.id}`, debounceMs: 220 }
    );
  };

  const handleUpdateExtra = (
    id: string,
    patch: Partial<Pick<ExtraTask, 'text' | 'dueAt' | 'stars'>>,
    immediate = false
  ) => {
    const coalesceField =
      patch.text !== undefined && patch.stars === undefined
        ? 'text'
        : patch.stars !== undefined && patch.text === undefined
          ? 'stars'
          : 'all';
    dispatchAction(
      {
        type: 'updateExtra',
        extraId: id,
        patch,
        at: Date.now(),
      },
      immediate ? undefined : { coalesceKey: `extra:${id}:${coalesceField}`, debounceMs: 220 }
    );
  };

  const handleClearExtra = (id: string) => {
    soundEngine.playPageFlip();
    dispatchAction({
      type: 'clearExtra',
      extraId: id,
      at: Date.now(),
      logId: createClientUid('log'),
    });
  };

  const handleToggleExtra = (id: string, originEl?: HTMLElement | null) => {
    if (completingExtras[id]) return;
    const target = state.extras.find((extra) => extra.id === id);
    if (!target || !target.text.trim()) return;
    const current = new Date();
    if (isExtraExpired(target, current)) return;

    const rewardStars = sanitizeExtraStars(target.stars);
    setCompletingExtras((prev) => ({
      ...prev,
      [id]: { text: target.text, dueAt: target.dueAt, stars: rewardStars },
    }));

    dispatchAction({
      type: 'completeExtra',
      extraId: id,
      at: current.getTime(),
      logId: createClientUid('log'),
    });

    soundEngine.playCheckPop();
    scheduleTimeout(() => soundEngine.playStarChime(), 130);
    launchStarFlight(originEl, true, rewardStars);
    showHeartLine(
      EXTRA_FEEDBACK_LINES[Math.floor(Math.random() * EXTRA_FEEDBACK_LINES.length)]
    );

    scheduleTimeout(() => {
      setCompletingExtras((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 600);
  };

  const handleAdjustStars = (delta: number) => {
    const rounded = Math.trunc(delta);
    if (!Number.isFinite(rounded) || rounded === 0) return;
    if (rounded < 0 && state.totalStarsEarned <= 0) return;
    if (rounded > 0) {
      soundEngine.playStarChime();
    } else {
      soundEngine.playUncheck();
    }
    dispatchAction({
      type: 'adjustStars',
      delta: rounded,
      at: Date.now(),
      logId: createClientUid('log'),
    });
  };

  const handleFirstOpenNote = (noteId: string, label?: string) => {
    if (state.openedNoteIds.includes(noteId)) return;
    dispatchAction({
      type: 'openNote',
      noteId,
      label,
      at: Date.now(),
      logId: createClientUid('log'),
    });
  };

  const handleHeartTap = () => {
    soundEngine.playHeartTap();
    setTreatMenuOpen((prev) => !prev);
  };

  const handleClaimReward = (reward: RewardItem) => {
    if (state.totalStarsEarned < reward.cost) {
      soundEngine.playGentleError();
      return;
    }
    soundEngine.playStarChime();
    dispatchAction({
      type: 'claimReward',
      reward,
      claimId: createClientUid('claim'),
      at: Date.now(),
      logId: createClientUid('log'),
    });
  };

  const handleFulfillClaimedReward = (claimId: string) => {
    soundEngine.playCheckPop();
    dispatchAction({
      type: 'fulfillClaim',
      claimId,
      at: Date.now(),
      logId: createClientUid('log'),
    });
  };

  const handleUpdateRewards = (nextRewards: RewardItem[], immediate = false) => {
    const structuralChange =
      immediate ||
      rewards.length !== nextRewards.length ||
      rewards.some((r, idx) => nextRewards[idx]?.id !== r.id);

    dispatchAction(
      {
        type: 'updateRewards',
        rewards: nextRewards,
        at: Date.now(),
        logId: createClientUid('log'),
      },
      structuralChange ? undefined : { coalesceKey: 'rewards', debounceMs: 220 }
    );
  };

  const handleExportLog = () => {
    const blob = new Blob([JSON.stringify(state.activityLog, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rulebook-log-${state.activeDayKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLog = () => {
    soundEngine.playPageFlip();
    dispatchAction({
      type: 'clearLog',
      at: Date.now(),
    });
  };

  const handleExportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rulebook-backup-${state.activeDayKey}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (jsonText: string): boolean => {
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (!isValidBackupPayload(parsed)) return false;
      dispatchAction({
        type: 'importBackup',
        backup: parsed,
        at: Date.now(),
        logId: createClientUid('log'),
      });
      return true;
    } catch {
      return false;
    }
  };

  const displayDate = formatEasternDisplayDate(now);
  const resetCountdown = getResetCountdownLabel(now);

  const handleJumpToChapter = (chapterId: string) => {
    const chapterIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
    if (chapterIndex < 0) return;
    flushSync();
    const pageIndex = chapterIndex + 1;
    setDirection(pageIndex >= mobilePageIndex ? 1 : -1);
    setMobilePageIndex(pageIndex);
    setSpreadIndex(Math.floor(pageIndex / 2));
    setChapterEditNonces((prev) => ({
      ...prev,
      [chapterId]: (prev[chapterId] ?? 0) + 1,
    }));
    setStudioOpen(false);
    soundEngine.playPageFlip();
  };

  const tabs: RibbonTab[] = [
    {
      id: 'tab-welcome',
      label: 'Welcome',
      spreadIndex: 0,
      mobilePageIndex: 0,
    },
    {
      id: 'tab-morning',
      label: chapters[0]?.tabLabel || 'Check in',
      spreadIndex: 0,
      mobilePageIndex: 1,
    },
    {
      id: 'tab-rules',
      label: chapters[1]?.tabLabel || 'Daily Habits',
      spreadIndex: 1,
      mobilePageIndex: 2,
    },
    {
      id: 'tab-body',
      label: chapters[2]?.tabLabel || 'Hydrate & Stretch',
      spreadIndex: 1,
      mobilePageIndex: 3,
    },
    {
      id: 'tab-bedtime',
      label: chapters[3]?.tabLabel || 'Evening',
      spreadIndex: 2,
      mobilePageIndex: 4,
    },
    {
      id: 'tab-extras',
      label: 'Extras',
      spreadIndex: 2,
      mobilePageIndex: 5,
    },
    {
      id: 'tab-jar',
      label: 'Star jar',
      spreadIndex: 3,
      mobilePageIndex: 6,
    },
    {
      id: 'tab-overview',
      label: 'Overview',
      spreadIndex: 3,
      mobilePageIndex: 7,
    },
  ];

  const pages: React.ReactNode[] = [
    <WelcomePage
      key="page-welcome"
      meta={DEFAULT_BOOK_META}
      displayDate={displayDate}
      resetCountdown={resetCountdown}
      completedCount={completedCount}
      totalCount={totalRules}
      streak={streak}
      totalStars={displayedStars}
      openedNoteIds={state.openedNoteIds}
      reducedMotion={state.preferences.reducedMotion}
      onFirstOpenNote={handleFirstOpenNote}
      onJumpToJar={() => handleSelectSpread(3, 6)}
    />,
    <ChapterPage
      key={chapters[0].id}
      chapter={chapters[0]}
      pageNumber={2}
      checkedRuleIds={validCheckedIds}
      openedNoteIds={state.openedNoteIds}
      reducedMotion={state.preferences.reducedMotion}
      canEdit={studioUnlocked}
      autoEditNonce={chapterEditNonces[chapters[0].id] ?? 0}
      now={now}
      onToggleRule={handleToggleRule}
      onFirstOpenNote={handleFirstOpenNote}
      onUpdateChapter={handleUpdateChapter}
      onFlushEdit={flushSync}
    />,
    <ChapterPage
      key={chapters[1].id}
      chapter={chapters[1]}
      pageNumber={3}
      checkedRuleIds={validCheckedIds}
      openedNoteIds={state.openedNoteIds}
      reducedMotion={state.preferences.reducedMotion}
      canEdit={studioUnlocked}
      autoEditNonce={chapterEditNonces[chapters[1].id] ?? 0}
      now={now}
      onToggleRule={handleToggleRule}
      onFirstOpenNote={handleFirstOpenNote}
      onUpdateChapter={handleUpdateChapter}
      onFlushEdit={flushSync}
    />,
    <ChapterPage
      key={chapters[2].id}
      chapter={chapters[2]}
      pageNumber={4}
      checkedRuleIds={validCheckedIds}
      openedNoteIds={state.openedNoteIds}
      reducedMotion={state.preferences.reducedMotion}
      canEdit={studioUnlocked}
      autoEditNonce={chapterEditNonces[chapters[2].id] ?? 0}
      now={now}
      onToggleRule={handleToggleRule}
      onFirstOpenNote={handleFirstOpenNote}
      onUpdateChapter={handleUpdateChapter}
      onFlushEdit={flushSync}
    />,
    <ChapterPage
      key={chapters[3].id}
      chapter={chapters[3]}
      pageNumber={5}
      checkedRuleIds={validCheckedIds}
      openedNoteIds={state.openedNoteIds}
      reducedMotion={state.preferences.reducedMotion}
      canEdit={studioUnlocked}
      autoEditNonce={chapterEditNonces[chapters[3].id] ?? 0}
      now={now}
      onToggleRule={handleToggleRule}
      onFirstOpenNote={handleFirstOpenNote}
      onUpdateChapter={handleUpdateChapter}
      onFlushEdit={flushSync}
    />,
    <ExtrasPage
      key="page-extras"
      extras={state.extras}
      completingExtras={completingExtras}
      reducedMotion={state.preferences.reducedMotion}
      now={now}
      onUpdateExtra={handleUpdateExtra}
      onToggleExtra={handleToggleExtra}
      onClearExtra={handleClearExtra}
      onFlushEdit={flushSync}
    />,
    <StarJar
      key="page-jar"
      totalStarsEarned={displayedStars}
      reducedMotion={state.preferences.reducedMotion}
    />,
    <OverviewPage
      key="page-overview"
      chapters={chapters}
      displayDate={displayDate}
      activeDayKey={state.activeDayKey}
      checkedRuleIds={validCheckedIds}
      completedDays={state.completedDays}
      dayHistory={state.dayHistory}
      streak={streak}
      totalStarsEarned={displayedStars}
      onOpenStudio={() => {
        soundEngine.playPageFlip();
        setStudioOpen(true);
      }}
    />,
  ];

  const desktopTabs: RibbonTab[] = [
    {
      id: 'desk-morning',
      label: 'Check in',
      spreadIndex: 0,
      mobilePageIndex: 0,
    },
    {
      id: 'desk-rules',
      label: 'Daily habits',
      spreadIndex: 1,
      mobilePageIndex: 2,
    },
    {
      id: 'desk-bedtime',
      label: 'Evening',
      spreadIndex: 2,
      mobilePageIndex: 4,
    },
    {
      id: 'desk-jar',
      label: 'Overview',
      spreadIndex: 3,
      mobilePageIndex: 6,
    },
  ];

  return (
    <main className="desk-backdrop relative flex min-h-screen flex-col items-center justify-center px-3 py-3 sm:px-5 sm:py-4">
      <AnimatePresence mode="wait" initial={false}>
        {!bookOpen ? (
          <CoverPage
            key="cover"
            meta={DEFAULT_BOOK_META}
            streak={streak}
            reducedMotion={state.preferences.reducedMotion}
            replayHinge={hasOpened}
            onOpen={handleOpenBook}
          />
        ) : (
          <motion.div
            key="open-book"
            className="flex w-full justify-center"
            initial={
              state.preferences.reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.965, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              state.preferences.reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.975, y: 8 }
            }
            transition={{ duration: state.preferences.reducedMotion ? 0.14 : 0.45, ease: [0.32, 0, 0.24, 1] }}
          >
            <BookShell
              spreadIndex={spreadIndex}
              mobilePageIndex={mobilePageIndex}
              totalSpreads={TOTAL_SPREADS}
              totalMobilePages={TOTAL_MOBILE_PAGES}
              direction={direction}
              desktopTabs={desktopTabs}
              mobileTabs={tabs}
              reducedMotion={state.preferences.reducedMotion}
              leftPage={pages[spreadIndex * 2]}
              rightPage={pages[spreadIndex * 2 + 1]}
              mobilePage={pages[mobilePageIndex]}
              onSelectSpread={handleSelectSpread}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <StarFlightLayer flights={flights} reducedMotion={state.preferences.reducedMotion} />

      {bookOpen && (
        <HeartNote
          speech={heartSpeech}
          pulse={heartPulse}
          reducedMotion={state.preferences.reducedMotion}
          onTap={handleHeartTap}
        />
      )}

      <AnimatePresence>
        {treatMenuOpen && (
          <TreatMenuModal
            key="treat-menu"
            rewards={rewards}
            claimedRewards={state.claimedRewards}
            totalStarsEarned={displayedStars}
            reducedMotion={state.preferences.reducedMotion}
            onClaimReward={handleClaimReward}
            onFulfillClaim={handleFulfillClaimedReward}
            onClose={() => setTreatMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {studioOpen && (
          <StudioDrawer
            key="studio"
            chapters={chapters}
            rewards={rewards}
            totalStarsEarned={state.totalStarsEarned}
            hasCustomChapters={state.customChapters !== null}
            hasCustomRewards={state.customRewards !== null}
            claimedCount={state.claimedRewards.length}
            unlocked={studioUnlocked}
            remembered={studioRemembered}
            reducedMotion={state.preferences.reducedMotion}
            activityLog={state.activityLog}
            onClose={() => setStudioOpen(false)}
            onUnlock={handleUnlockStudio}
            onLock={handleLockStudio}
            onToggleRemember={handleToggleRemember}
            onAdjustStars={handleAdjustStars}
            onJumpToChapter={handleJumpToChapter}
            onUpdateRewards={handleUpdateRewards}
            onFlushEdit={flushSync}
            onExportBackup={handleExportBackup}
            onImportBackup={handleImportBackup}
            onExportLog={handleExportLog}
            onClearLog={handleClearLog}
            onResetToday={() => {
              soundEngine.playPageFlip();
              dispatchAction({
                type: 'resetToday',
                at: Date.now(),
                logId: createClientUid('log'),
              });
            }}
            onClearClaimedRewards={() => {
              soundEngine.playPageFlip();
              dispatchAction({
                type: 'clearClaimedRewards',
                at: Date.now(),
                logId: createClientUid('log'),
              });
            }}
            onRestoreDefaultChapters={() => {
              soundEngine.playPageFlip();
              dispatchAction({
                type: 'restoreDefaultChapters',
                at: Date.now(),
                logId: createClientUid('log'),
              });
            }}
            onRestoreDefaultRewards={() => {
              soundEngine.playPageFlip();
              dispatchAction({
                type: 'restoreDefaultRewards',
                at: Date.now(),
                logId: createClientUid('log'),
              });
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
};

export default App;
