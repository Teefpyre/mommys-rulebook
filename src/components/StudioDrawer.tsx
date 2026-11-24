import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Code2,
  Download,
  KeyRound,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ChapterData, RewardItem } from '../data/rules';
import { MAX_STUDIO_STAR_DELTA } from '../lib/rulebookActions';
import {
  ActivityEntry,
  formatActivityAt,
  generateRulesTsSnippet,
} from '../lib/storage';
import { isStudioPassword } from '../lib/studioKey';
import { soundEngine } from '../lib/sound';

interface StudioDrawerProps {
  chapters: ChapterData[];
  rewards: RewardItem[];
  totalStarsEarned: number;
  hasCustomChapters: boolean;
  hasCustomRewards: boolean;
  claimedCount: number;
  unlocked: boolean;
  remembered: boolean;
  reducedMotion: boolean;
  activityLog: ActivityEntry[];
  onClose: () => void;
  onUnlock: (remember: boolean) => void;
  onLock: () => void;
  onToggleRemember: (remember: boolean) => void;
  onAdjustStars: (delta: number) => void;
  onJumpToChapter: (chapterId: string) => void;
  onUpdateRewards: (rewards: RewardItem[], immediate?: boolean) => void;
  onFlushEdit?: () => void;
  onExportBackup: () => void;
  onImportBackup: (jsonText: string) => boolean;
  onExportLog: () => void;
  onClearLog: () => void;
  onResetToday: () => void;
  onClearClaimedRewards: () => void;
  onRestoreDefaultChapters: () => void;
  onRestoreDefaultRewards: () => void;
}

const quietAction =
  'inline-flex items-center gap-1.5 text-[12.5px] font-bold text-cocoa-soft transition-colors hover:text-strawberry-600 hover:underline hover:underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500';

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  chapters,
  rewards,
  totalStarsEarned,
  hasCustomChapters,
  hasCustomRewards,
  claimedCount,
  unlocked,
  remembered,
  reducedMotion,
  activityLog,
  onClose,
  onUnlock,
  onLock,
  onToggleRemember,
  onAdjustStars,
  onJumpToChapter,
  onUpdateRewards,
  onFlushEdit,
  onExportBackup,
  onImportBackup,
  onExportLog,
  onClearLog,
  onResetToday,
  onClearClaimedRewards,
  onRestoreDefaultChapters,
  onRestoreDefaultRewards,
}) => {
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shakeCount, setShakeCount] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [confirmResetToday, setConfirmResetToday] = useState(false);
  const [confirmClearClaimed, setConfirmClearClaimed] = useState(false);
  const [confirmRestoreDefaults, setConfirmRestoreDefaults] = useState(false);
  const [confirmRestoreRewards, setConfirmRestoreRewards] = useState(false);
  const [confirmClearLog, setConfirmClearLog] = useState(false);
  const [starAmountInput, setStarAmountInput] = useState('1');
  const [newTreatTitle, setNewTreatTitle] = useState('');
  const [newTreatCost, setNewTreatCost] = useState('10');
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const parsedStarAmount = Number.parseInt(starAmountInput, 10);
  const validStarAmount =
    Number.isFinite(parsedStarAmount) && parsedStarAmount >= 1
      ? Math.min(MAX_STUDIO_STAR_DELTA, parsedStarAmount)
      : 0;
  const canAddStars = validStarAmount > 0;
  const canRemoveStars = validStarAmount > 0 && totalStarsEarned > 0;

  const handleAdjustStars = (sign: 1 | -1) => {
    if (validStarAmount <= 0) return;
    if (sign < 0 && totalStarsEarned <= 0) return;
    onAdjustStars(sign * validStarAmount);
  };

  const handleClose = () => {
    onFlushEdit?.();
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onFlushEdit?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, onFlushEdit]);

  useEffect(() => {
    if (unlocked) {
      setPassword('');
      setErrorMsg(null);
    } else {
      passwordInputRef.current?.focus();
    }
  }, [unlocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isStudioPassword(password)) {
      soundEngine.playCheckPop();
      window.setTimeout(() => soundEngine.playStarChime(), 120);
      setPassword('');
      setErrorMsg(null);
      onUnlock(rememberMe);
      return;
    }
    setErrorMsg('Incorrect studio password.');
    setShakeCount((count) => count + 1);
    soundEngine.playGentleError();
  };

  const handleCopyRulesTs = async () => {
    try {
      await navigator.clipboard.writeText(generateRulesTsSnippet(chapters, rewards));
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2400);
    } catch {
      setImportStatus('Could not access the clipboard automatically.');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = onImportBackup(String(reader.result || ''));
      setImportStatus(
        ok ? 'Backup restored.' : 'Invalid backup file.'
      );
      window.setTimeout(() => setImportStatus(null), 3200);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateReward = (id: string, patch: Partial<RewardItem>, immediate = false) => {
    onUpdateRewards(
      rewards.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      immediate
    );
  };

  const moveReward = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= rewards.length) return;
    const copy = [...rewards];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    onUpdateRewards(copy, true);
  };

  const removeReward = (id: string) => {
    setCostDrafts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onUpdateRewards(
      rewards.filter((item) => item.id !== id),
      true
    );
  };

  const handleAddReward = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTreatTitle.trim();
    if (!title) return;
    const parsedCost = Number.parseInt(newTreatCost, 10);
    const cost =
      Number.isFinite(parsedCost) && parsedCost > 0 ? Math.min(999, parsedCost) : 10;
    onUpdateRewards(
      [
        ...rewards,
        {
          id: `reward-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title,
          cost,
        },
      ],
      true
    );
    setNewTreatTitle('');
    setNewTreatCost('10');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-cocoa/30 px-4 py-6"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Editor studio"
    >
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: [0.32, 0, 0.24, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="paper-surface page-scroll relative max-h-full w-full max-w-[440px] overflow-y-auto rounded-[6px] border border-strawberry-200 px-6 py-6 shadow-book sm:px-7"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close studio"
          className="absolute right-3 top-3 rounded-sm p-1 text-cocoa-light transition-colors hover:text-strawberry-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[12px] font-bold text-strawberry-600">
          {unlocked ? 'Studio access · unlocked' : 'Studio access'}
        </p>
        <h2 className="mt-0.5 font-display text-[23px] font-bold leading-tight text-cocoa">
          Editor studio
        </h2>

        {!unlocked ? (
          <motion.form
            key={shakeCount}
            onSubmit={handleSubmit}
            animate={
              shakeCount > 0 && !reducedMotion ? { x: [0, -7, 7, -5, 5, 0] } : undefined
            }
            transition={{ duration: 0.36 }}
            className="mt-4 space-y-3.5"
          >
            <div className="relative">
              <KeyRound
                className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-strawberry-400"
                aria-hidden="true"
              />
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                autoComplete="off"
                aria-label="Studio password"
                className="w-full border-b-2 border-strawberry-200 bg-transparent py-2 pl-8 pr-3 text-[14.5px] font-bold text-cocoa placeholder:font-semibold placeholder:text-cocoa-light focus:border-strawberry-500 focus:outline-none"
              />
            </div>

            {errorMsg && (
              <p className="text-[12.5px] font-bold text-strawberry-600" role="alert">
                {errorMsg}
              </p>
            )}

            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-cocoa-soft">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 accent-strawberry-600"
              />
              <span>Remember on this browser</span>
            </label>

            <button
              type="submit"
              className="group inline-flex rounded-[2px] focus:outline-none focus-visible:ring-2 focus-visible:ring-cocoa focus-visible:ring-offset-2"
            >
              <span className="ribbon-band inline-flex items-center bg-strawberry-700 px-7 py-2 font-display text-[15px] font-bold text-paper transition-colors group-hover:bg-strawberry-600">
                Unlock
              </span>
            </button>
          </motion.form>
        ) : (
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12.5px] font-bold text-strawberry-600">
                Editing unlocked{remembered ? ' · remembered here' : ' · session only'}
              </p>
              <button
                type="button"
                onClick={onLock}
                className="text-[12.5px] font-bold text-cocoa-soft underline underline-offset-4 transition-colors hover:text-strawberry-600"
              >
                Lock
              </button>
            </div>

            <section className="mt-3 border-y border-strawberry-200/80 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-bold text-cocoa-soft">Star jar</p>
                <p className="font-display text-[13.5px] font-bold tabular-nums text-strawberry-600">
                  {totalStarsEarned} {totalStarsEarned === 1 ? 'star' : 'stars'}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="inline-flex items-baseline gap-1.5">
                  <input
                    type="text"
                    size={1}
                    inputMode="numeric"
                    value={starAmountInput}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) =>
                      setStarAmountInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAdjustStars(1);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setStarAmountInput(
                          String(Math.min(MAX_STUDIO_STAR_DELTA, validStarAmount + 1))
                        );
                      } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setStarAmountInput(String(Math.max(1, validStarAmount - 1)));
                      }
                    }}
                    aria-label="Stars to add or remove"
                    className="w-12 border-b border-strawberry-200 bg-transparent py-0.5 text-center font-display text-[14.5px] font-bold tabular-nums text-cocoa focus:border-strawberry-500 focus:outline-none"
                  />
                  <span className="text-[12.5px] font-semibold text-cocoa-soft">
                    {validStarAmount === 1 ? 'star' : 'stars'}
                  </span>
                </label>

                <div className="ml-auto flex items-center gap-3">
                  <motion.button
                    type="button"
                    whileTap={reducedMotion || !canAddStars ? undefined : { scale: 0.97 }}
                    disabled={!canAddStars}
                    onClick={() => handleAdjustStars(1)}
                    className="inline-flex items-center gap-1 text-[13px] font-bold text-strawberry-600 underline decoration-strawberry-300 underline-offset-4 transition-colors hover:text-strawberry-700 hover:decoration-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 disabled:opacity-35 disabled:no-underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </motion.button>
                  <span className="text-strawberry-300" aria-hidden="true">
                    &middot;
                  </span>
                  <motion.button
                    type="button"
                    whileTap={reducedMotion || !canRemoveStars ? undefined : { scale: 0.97 }}
                    disabled={!canRemoveStars}
                    onClick={() => handleAdjustStars(-1)}
                    className="inline-flex items-center gap-1 text-[13px] font-bold text-cocoa-soft underline decoration-strawberry-200 underline-offset-4 transition-colors hover:text-strawberry-600 hover:decoration-strawberry-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 disabled:opacity-35 disabled:no-underline"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </motion.button>
                </div>
              </div>
            </section>

            <section className="mt-3 border-b border-strawberry-200/80 pb-3">
              <p className="text-[12px] font-bold text-cocoa-soft">Edit chapter</p>
              <ul className="mt-1.5 divide-y divide-strawberry-100">
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <button
                      type="button"
                      onClick={() => onJumpToChapter(chapter.id)}
                      className="group flex w-full items-baseline justify-between gap-3 py-1.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
                    >
                      <span className="min-w-0">
                        <span className="block text-[14.5px] font-bold text-cocoa group-hover:text-strawberry-600">
                          {chapter.title}
                        </span>
                        <span className="block text-[12px] font-semibold text-cocoa-soft">
                          {chapter.rules.length}{' '}
                          {chapter.rules.length === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-bold text-strawberry-600">
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-3 border-b border-strawberry-200/80 pb-3">
              <p className="text-[12px] font-bold text-cocoa-soft">Activity log</p>
              {activityLog.length === 0 ? (
                <p className="mt-1.5 text-[13px] font-medium leading-snug text-cocoa-soft">
                  No activity recorded yet.
                </p>
              ) : (
                <ol className="mt-1.5 max-h-[180px] divide-y divide-strawberry-100/90 overflow-y-auto pr-1">
                  {activityLog.map((entry) => (
                    <li key={entry.id} className="flex items-baseline gap-2 py-1.5">
                      <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-cocoa-light">
                        {formatActivityAt(entry.at)}
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-cocoa">
                        {entry.detail}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button type="button" onClick={onExportLog} className={quietAction}>
                  <Download className="h-3.5 w-3.5" />
                  <span>Save log</span>
                </button>
                {activityLog.length > 0 &&
                  (confirmClearLog ? (
                    <span className="inline-flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClearLog();
                          setConfirmClearLog(false);
                        }}
                        className="text-[13px] font-bold text-strawberry-600 underline underline-offset-4 hover:text-strawberry-700"
                      >
                        Yes, clear log
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearLog(false)}
                        className="text-[13px] font-bold text-cocoa-soft hover:text-cocoa"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearLog(true)}
                      className={quietAction}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Clear log</span>
                    </button>
                  ))}
              </div>
            </section>

            <section className="mt-3 border-b border-strawberry-200/80 pb-3">
              <p className="text-[12px] font-bold text-cocoa-soft">Reward menu</p>
              <ul className="mt-1.5 divide-y divide-strawberry-100">
                {rewards.map((reward, index) => (
                  <li key={reward.id} className="flex items-center gap-1.5 py-1.5">
                    <input
                      type="text"
                      value={reward.title}
                      onChange={(e) =>
                        updateReward(reward.id, { title: e.target.value })
                      }
                      onBlur={() => onFlushEdit?.()}
                      aria-label={`Reward ${index + 1} title`}
                      className="min-w-0 flex-1 border-b border-strawberry-200 bg-transparent py-0.5 text-[13.5px] font-bold text-cocoa focus:border-strawberry-500 focus:outline-none"
                    />
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={costDrafts[reward.id] ?? String(reward.cost)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setCostDrafts((prev) => ({ ...prev, [reward.id]: raw }));
                        if (raw.trim() === '') return;
                        const val = Number.parseInt(raw, 10);
                        if (Number.isFinite(val) && val > 0) {
                          updateReward(reward.id, { cost: Math.min(999, val) });
                        }
                      }}
                      onBlur={() => {
                        setCostDrafts((prev) => {
                          if (!(reward.id in prev)) return prev;
                          const next = { ...prev };
                          delete next[reward.id];
                          return next;
                        });
                        onFlushEdit?.();
                      }}
                      aria-label={`Reward ${index + 1} star cost`}
                      className="w-12 border-b border-strawberry-200 bg-transparent py-0.5 text-right font-display text-[13.5px] font-bold tabular-nums text-strawberry-600 focus:border-strawberry-500 focus:outline-none"
                    />
                    <span className="text-[11.5px] font-semibold text-cocoa-soft">
                      {reward.cost === 1 ? 'star' : 'stars'}
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5 pl-1">
                      <button
                        type="button"
                        onClick={() => moveReward(index, -1)}
                        disabled={index === 0}
                        aria-label="Move reward up"
                        className="rounded p-1 text-cocoa-soft hover:text-strawberry-600 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveReward(index, 1)}
                        disabled={index === rewards.length - 1}
                        aria-label="Move reward down"
                        className="rounded p-1 text-cocoa-soft hover:text-strawberry-600 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeReward(reward.id)}
                        aria-label="Delete reward"
                        className="rounded p-1 text-cocoa-soft hover:text-strawberry-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddReward} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newTreatTitle}
                  onChange={(e) => setNewTreatTitle(e.target.value)}
                  placeholder="New reward..."
                  aria-label="New reward title"
                  className="min-w-0 flex-1 border-b border-strawberry-200 bg-transparent py-1 text-[13.5px] font-semibold text-cocoa placeholder:text-cocoa-light focus:border-strawberry-500 focus:outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={newTreatCost}
                  onChange={(e) => setNewTreatCost(e.target.value)}
                  aria-label="New reward star cost"
                  className="w-12 border-b border-strawberry-200 bg-transparent py-1 text-right font-display text-[13.5px] font-bold tabular-nums text-strawberry-600 focus:border-strawberry-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-bold text-strawberry-600 hover:text-strawberry-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </section>

            <section className="mt-3">
              <p className="text-[12px] font-bold text-cocoa-soft">Export &amp; backup</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button type="button" onClick={handleCopyRulesTs} className={quietAction}>
                  {copiedCode ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Code2 className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedCode ? 'Copied rules.ts' : 'Copy rules.ts'}</span>
                </button>

                <button type="button" onClick={onExportBackup} className={quietAction}>
                  <Download className="h-3.5 w-3.5" />
                  <span>Save backup</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={quietAction}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Load backup</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </div>

              {importStatus && (
                <p className="mt-1.5 text-[12.5px] font-bold text-strawberry-600">
                  {importStatus}
                </p>
              )}
            </section>

            <section className="mt-3 space-y-2 border-t border-strawberry-100 pt-2.5">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-cocoa-soft">
                <input
                  type="checkbox"
                  checked={remembered}
                  onChange={(e) => onToggleRemember(e.target.checked)}
                  className="h-3.5 w-3.5 accent-strawberry-600"
                />
                <span>Remember on this browser</span>
              </label>

              {confirmResetToday ? (
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      onResetToday();
                      setConfirmResetToday(false);
                    }}
                    className="text-[13px] font-bold text-strawberry-600 underline underline-offset-4 hover:text-strawberry-700"
                  >
                    Yes, clear today
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetToday(false)}
                    className="text-[13px] font-bold text-cocoa-soft hover:text-cocoa"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmResetToday(true)}
                  className={quietAction}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear today&apos;s boxes</span>
                </button>
              )}

              {claimedCount > 0 && (
                <div className="border-t border-strawberry-100 pt-2">
                  {confirmClearClaimed ? (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onClearClaimedRewards();
                          setConfirmClearClaimed(false);
                        }}
                        className="text-[13px] font-bold text-strawberry-600 underline underline-offset-4 hover:text-strawberry-700"
                      >
                        Yes, clear claimed rewards
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearClaimed(false)}
                        className="text-[13px] font-bold text-cocoa-soft hover:text-cocoa"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearClaimed(true)}
                      className={quietAction}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Clear claimed rewards ({claimedCount})</span>
                    </button>
                  )}
                </div>
              )}

              {hasCustomChapters && (
                <div className="border-t border-strawberry-100 pt-2">
                  {confirmRestoreDefaults ? (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreDefaultChapters();
                          setConfirmRestoreDefaults(false);
                        }}
                        className="text-[13px] font-bold text-strawberry-600 underline underline-offset-4 hover:text-strawberry-700"
                      >
                        Restore default items
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreDefaults(false)}
                        className="text-[13px] font-bold text-cocoa-soft hover:text-cocoa"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreDefaults(true)}
                      className={quietAction}
                    >
                      <span>Restore default items</span>
                    </button>
                  )}
                </div>
              )}

              {hasCustomRewards && (
                <div className="border-t border-strawberry-100 pt-2">
                  {confirmRestoreRewards ? (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreDefaultRewards();
                          setConfirmRestoreRewards(false);
                        }}
                        className="text-[13px] font-bold text-strawberry-600 underline underline-offset-4 hover:text-strawberry-700"
                      >
                        Restore default rewards
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreRewards(false)}
                        className="text-[13px] font-bold text-cocoa-soft hover:text-cocoa"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRestoreRewards(true)}
                      className={quietAction}
                    >
                      <span>Restore default rewards</span>
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
