import { ChapterData, DEFAULT_CHAPTERS, RewardItem } from '../data/rules';
import {
  appendActivity,
  ClaimedReward,
  createInitialState,
  DEFAULT_EXTRA_STARS,
  getActiveChapters,
  getActiveRewards,
  isExtraExpired,
  isRuleLocked,
  isValidBackupPayload,
  reconcileDailyReset,
  RulebookState,
  sanitizeDueAt,
  sanitizeExtraStars,
  sanitizeRewards,
  sanitizeRulebookState,
  sanitizeSingleChapter,
  touchState,
} from './storage';

export const MAX_STUDIO_STAR_DELTA = 9999;

export type RulebookAction =
  | {
      type: 'toggleRule';
      ruleId: string;
      at: number;
      logId: string;
      perfectLogId?: string;
    }
  | {
      type: 'updateChapter';
      chapter: ChapterData;
      at: number;
      logId: string;
    }
  | {
      type: 'restoreDefaultChapters';
      at: number;
      logId: string;
    }
  | {
      type: 'updateRewards';
      rewards: RewardItem[];
      at: number;
      logId: string;
    }
  | {
      type: 'restoreDefaultRewards';
      at: number;
      logId: string;
    }
  | {
      type: 'updateExtra';
      extraId: string;
      patch: { text?: string; dueAt?: string | null; stars?: number };
      at: number;
    }
  | {
      type: 'completeExtra';
      extraId: string;
      at: number;
      logId: string;
    }
  | {
      type: 'clearExtra';
      extraId: string;
      at: number;
      logId: string;
    }
  | {
      type: 'adjustStars';
      delta: number;
      at: number;
      logId: string;
    }
  | {
      type: 'openNote';
      noteId: string;
      label?: string;
      at: number;
      logId: string;
    }
  | {
      type: 'claimReward';
      reward: RewardItem;
      claimId: string;
      at: number;
      logId: string;
    }
  | {
      type: 'fulfillClaim';
      claimId: string;
      at: number;
      logId: string;
    }
  | {
      type: 'clearClaimedRewards';
      at: number;
      logId: string;
    }
  | {
      type: 'resetToday';
      at: number;
      logId: string;
    }
  | {
      type: 'clearLog';
      at: number;
    }
  | {
      type: 'importBackup';
      backup: Partial<RulebookState>;
      at: number;
      logId: string;
    };

export function createClientUid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return Math.floor(fallback);
}

export function validateRulebookAction(raw: unknown): RulebookAction | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== 'string') return null;

  const at = normalizeAt(obj.at, Date.now());
  const logId = typeof obj.logId === 'string' && obj.logId ? obj.logId.slice(0, 80) : createClientUid('log');

  switch (type) {
    case 'toggleRule':
      if (typeof obj.ruleId !== 'string' || !obj.ruleId) return null;
      return {
        type: 'toggleRule',
        ruleId: obj.ruleId.slice(0, 80),
        at,
        logId,
        ...(typeof obj.perfectLogId === 'string' && obj.perfectLogId
          ? { perfectLogId: obj.perfectLogId.slice(0, 80) }
          : {}),
      };

    case 'updateChapter':
      if (!obj.chapter || typeof obj.chapter !== 'object' || Array.isArray(obj.chapter)) return null;
      if (typeof (obj.chapter as Partial<ChapterData>).id !== 'string') return null;
      return {
        type: 'updateChapter',
        chapter: obj.chapter as ChapterData,
        at,
        logId,
      };

    case 'restoreDefaultChapters':
      return { type: 'restoreDefaultChapters', at, logId };

    case 'updateRewards':
      if (!Array.isArray(obj.rewards)) return null;
      return {
        type: 'updateRewards',
        rewards: obj.rewards as RewardItem[],
        at,
        logId,
      };

    case 'restoreDefaultRewards':
      return { type: 'restoreDefaultRewards', at, logId };

    case 'updateExtra': {
      if (typeof obj.extraId !== 'string' || !obj.extraId) return null;
      if (!obj.patch || typeof obj.patch !== 'object' || Array.isArray(obj.patch)) return null;
      const rawPatch = obj.patch as Record<string, unknown>;
      const patch: { text?: string; dueAt?: string | null; stars?: number } = {};
      if (typeof rawPatch.text === 'string') {
        patch.text = rawPatch.text.slice(0, 120);
      }
      if ('dueAt' in rawPatch) {
        patch.dueAt = rawPatch.dueAt === null ? null : sanitizeDueAt(rawPatch.dueAt);
      }
      if (typeof rawPatch.stars === 'number' && Number.isFinite(rawPatch.stars)) {
        patch.stars = sanitizeExtraStars(rawPatch.stars);
      }
      return {
        type: 'updateExtra',
        extraId: obj.extraId.slice(0, 40),
        patch,
        at,
      };
    }

    case 'completeExtra':
      if (typeof obj.extraId !== 'string' || !obj.extraId) return null;
      return { type: 'completeExtra', extraId: obj.extraId.slice(0, 40), at, logId };

    case 'clearExtra':
      if (typeof obj.extraId !== 'string' || !obj.extraId) return null;
      return { type: 'clearExtra', extraId: obj.extraId.slice(0, 40), at, logId };

    case 'adjustStars': {
      if (typeof obj.delta !== 'number' || !Number.isFinite(obj.delta)) return null;
      const rounded = Math.trunc(obj.delta);
      if (rounded === 0) return null;
      const delta = Math.max(-MAX_STUDIO_STAR_DELTA, Math.min(MAX_STUDIO_STAR_DELTA, rounded));
      return { type: 'adjustStars', delta, at, logId };
    }

    case 'openNote':
      if (typeof obj.noteId !== 'string' || !obj.noteId) return null;
      return {
        type: 'openNote',
        noteId: obj.noteId.slice(0, 80),
        ...(typeof obj.label === 'string' && obj.label.trim()
          ? { label: obj.label.trim().slice(0, 100) }
          : {}),
        at,
        logId,
      };

    case 'claimReward': {
      if (!obj.reward || typeof obj.reward !== 'object' || Array.isArray(obj.reward)) return null;
      const r = obj.reward as Partial<RewardItem>;
      if (typeof r.id !== 'string' || typeof r.title !== 'string') return null;
      const cost =
        typeof r.cost === 'number' && Number.isFinite(r.cost)
          ? Math.min(999, Math.max(1, Math.round(r.cost)))
          : 1;
      const claimId =
        typeof obj.claimId === 'string' && obj.claimId
          ? obj.claimId.slice(0, 80)
          : createClientUid('claim');
      return {
        type: 'claimReward',
        reward: { id: r.id.slice(0, 80), title: r.title.slice(0, 120), cost },
        claimId,
        at,
        logId,
      };
    }

    case 'fulfillClaim':
      if (typeof obj.claimId !== 'string' || !obj.claimId) return null;
      return { type: 'fulfillClaim', claimId: obj.claimId.slice(0, 80), at, logId };

    case 'clearClaimedRewards':
      return { type: 'clearClaimedRewards', at, logId };

    case 'resetToday':
      return { type: 'resetToday', at, logId };

    case 'clearLog':
      return { type: 'clearLog', at };

    case 'importBackup':
      if (!isValidBackupPayload(obj.backup)) return null;
      return { type: 'importBackup', backup: obj.backup, at, logId };

    default:
      return null;
  }
}

export function applyRulebookAction(
  prev: RulebookState,
  action: RulebookAction,
  now: Date = new Date()
): RulebookState {
  const reconciled = reconcileDailyReset(prev, now);
  const at = normalizeAt(action.at, now.getTime());

  switch (action.type) {
    case 'toggleRule': {
      const activeChapters = getActiveChapters(reconciled);
      const targetRule = activeChapters
        .flatMap((chapter) => chapter.rules)
        .find((rule) => rule.id === action.ruleId);
      if (!targetRule) return reconciled;

      const alreadyChecked = reconciled.checkedRuleIds.includes(action.ruleId);
      if (!alreadyChecked && isRuleLocked(targetRule, now, false)) {
        return reconciled;
      }

      const validIds = activeChapters.flatMap((c) => c.rules.map((r) => r.id));
      const nextChecked = alreadyChecked
        ? reconciled.checkedRuleIds.filter((id) => id !== action.ruleId)
        : [...reconciled.checkedRuleIds, action.ruleId];

      const dayKey = reconciled.activeDayKey;
      const priorDay = reconciled.dayHistory[dayKey] ?? [];
      const nextDay = alreadyChecked
        ? priorDay.filter((id) => id !== action.ruleId)
        : Array.from(new Set([...priorDay, action.ruleId]));
      const nextDayHistory = { ...reconciled.dayHistory };
      if (nextDay.length > 0) {
        nextDayHistory[dayKey] = nextDay;
      } else {
        delete nextDayHistory[dayKey];
      }

      const validCheckedCount = nextChecked.filter((id) => validIds.includes(id)).length;
      const nowAllDone = validIds.length > 0 && validCheckedCount === validIds.length;

      let nextCompletedDays = reconciled.completedDays;
      if (nowAllDone) {
        if (!nextCompletedDays.includes(dayKey)) {
          nextCompletedDays = [...nextCompletedDays, dayKey].sort();
        }
      } else if (nextCompletedDays.includes(dayKey)) {
        nextCompletedDays = nextCompletedDays.filter((day) => day !== dayKey);
      }

      const perfectDay = nowAllDone && !reconciled.dailyCelebrated && !alreadyChecked;
      const nextCelebrated = reconciled.dailyCelebrated || nowAllDone;
      const nextStars = alreadyChecked
        ? Math.max(0, reconciled.totalStarsEarned - 1)
        : reconciled.totalStarsEarned + 1;

      const ruleName = targetRule.text.trim().slice(0, 80) || action.ruleId;

      let nextState: RulebookState = {
        ...reconciled,
        checkedRuleIds: nextChecked,
        completedDays: nextCompletedDays,
        dailyCelebrated: nextCelebrated,
        dayHistory: nextDayHistory,
        totalStarsEarned: nextStars,
      };

      if (alreadyChecked) {
        nextState = appendActivity(nextState, 'uncheck', `Unchecked: ${ruleName}`, at, action.logId);
      } else {
        nextState = appendActivity(nextState, 'check', `Checked: ${ruleName}`, at, action.logId);
        if (perfectDay) {
          nextState = appendActivity(
            nextState,
            'check',
            'Finished every item',
            at + 1,
            action.perfectLogId || `${action.logId}-all`
          );
        }
      }

      return touchState(nextState, at);
    }

    case 'updateChapter': {
      const currentChapters = getActiveChapters(reconciled);
      const chapterIdx = currentChapters.findIndex((ch) => ch.id === action.chapter.id);
      if (chapterIdx < 0) return reconciled;

      const prior = currentChapters[chapterIdx];
      const fallback = DEFAULT_CHAPTERS[chapterIdx] ?? prior;
      const cleanUpdated = sanitizeSingleChapter(action.chapter, fallback);
      const nextChapters = currentChapters.map((ch, idx) => (idx === chapterIdx ? cleanUpdated : ch));

      let nextState: RulebookState = {
        ...reconciled,
        customChapters: nextChapters,
      };

      const priorIds = new Set(prior.rules.map((r) => r.id));
      const nextIds = new Set(cleanUpdated.rules.map((r) => r.id));
      const added = cleanUpdated.rules.find((r) => !priorIds.has(r.id));
      if (added) {
        nextState = appendActivity(
          nextState,
          'edit',
          `Added item to ${prior.title}: ${added.text.slice(0, 80)}`,
          at,
          action.logId
        );
      } else {
        const removed = prior.rules.find((r) => !nextIds.has(r.id));
        if (removed) {
          nextState = appendActivity(
            nextState,
            'edit',
            `Removed item from ${prior.title}: ${removed.text.slice(0, 80)}`,
            at,
            action.logId
          );
        }
      }

      return touchState(nextState, at);
    }

    case 'restoreDefaultChapters': {
      if (reconciled.customChapters === null) return reconciled;
      return touchState(
        appendActivity(
          { ...reconciled, customChapters: null },
          'edit',
          'Restored default items',
          at,
          action.logId
        ),
        at
      );
    }

    case 'updateRewards': {
      const cleanRewards = sanitizeRewards(action.rewards);
      if (cleanRewards === null) return reconciled;

      const prior = getActiveRewards(reconciled);
      const priorIds = new Set(prior.map((r) => r.id));
      const nextIds = new Set(cleanRewards.map((r) => r.id));

      let nextState: RulebookState = {
        ...reconciled,
        customRewards: cleanRewards,
      };

      const added = cleanRewards.find((r) => !priorIds.has(r.id));
      if (added) {
        nextState = appendActivity(
          nextState,
          'edit',
          `Added reward: ${added.title.slice(0, 80)} (${added.cost} ${added.cost === 1 ? 'star' : 'stars'})`,
          at,
          action.logId
        );
      } else {
        const removed = prior.find((r) => !nextIds.has(r.id));
        if (removed) {
          nextState = appendActivity(
            nextState,
            'edit',
            `Removed reward: ${removed.title.slice(0, 80)}`,
            at,
            action.logId
          );
        }
      }

      return touchState(nextState, at);
    }

    case 'restoreDefaultRewards': {
      if (reconciled.customRewards === null) return reconciled;
      return touchState(
        appendActivity(
          { ...reconciled, customRewards: null },
          'edit',
          'Restored default rewards',
          at,
          action.logId
        ),
        at
      );
    }

    case 'updateExtra': {
      const exists = reconciled.extras.some((extra) => extra.id === action.extraId);
      if (!exists) return reconciled;
      const nextExtras = reconciled.extras.map((extra) =>
        extra.id === action.extraId
          ? {
              ...extra,
              text:
                action.patch.text !== undefined ? action.patch.text.slice(0, 120) : extra.text,
              dueAt:
                action.patch.dueAt !== undefined
                  ? action.patch.dueAt === null
                    ? null
                    : sanitizeDueAt(action.patch.dueAt)
                  : extra.dueAt,
              stars:
                action.patch.stars !== undefined
                  ? sanitizeExtraStars(action.patch.stars, extra.stars)
                  : extra.stars,
              checked: false,
            }
          : extra
      );
      return touchState({ ...reconciled, extras: nextExtras }, at);
    }

    case 'completeExtra': {
      const target = reconciled.extras.find((extra) => extra.id === action.extraId);
      if (!target || !target.text.trim()) return reconciled;
      if (isExtraExpired(target, now)) return reconciled;

      const label = target.text.trim().slice(0, 80);
      const rewardStars = sanitizeExtraStars(target.stars);
      const nextExtras = reconciled.extras.map((extra) =>
        extra.id === action.extraId
          ? { ...extra, text: '', dueAt: null, stars: DEFAULT_EXTRA_STARS, checked: false }
          : extra
      );
      return touchState(
        appendActivity(
          {
            ...reconciled,
            extras: nextExtras,
            totalStarsEarned: reconciled.totalStarsEarned + rewardStars,
          },
          'extra',
          `Bonus task done: ${label} (+${rewardStars} ${rewardStars === 1 ? 'star' : 'stars'})`,
          at,
          action.logId
        ),
        at
      );
    }

    case 'clearExtra': {
      const target = reconciled.extras.find((extra) => extra.id === action.extraId);
      if (!target) return reconciled;
      const text = target.text.trim().slice(0, 80);
      if (!text && !target.dueAt && target.stars === DEFAULT_EXTRA_STARS) return reconciled;

      const nextExtras = reconciled.extras.map((extra) =>
        extra.id === action.extraId
          ? { ...extra, text: '', dueAt: null, stars: DEFAULT_EXTRA_STARS, checked: false }
          : extra
      );
      const base: RulebookState = { ...reconciled, extras: nextExtras };
      const withLog = text
        ? appendActivity(base, 'edit', `Cleared bonus task: ${text}`, at, action.logId)
        : base;
      return touchState(withLog, at);
    }

    case 'adjustStars': {
      if (typeof action.delta !== 'number' || !Number.isFinite(action.delta)) return reconciled;
      const clamped = Math.max(
        -MAX_STUDIO_STAR_DELTA,
        Math.min(MAX_STUDIO_STAR_DELTA, Math.trunc(action.delta))
      );
      if (clamped === 0) return reconciled;
      const nextStars = Math.max(0, reconciled.totalStarsEarned + clamped);
      const applied = nextStars - reconciled.totalStarsEarned;
      if (applied === 0) return reconciled;
      const abs = Math.abs(applied);
      const unit = abs === 1 ? 'star' : 'stars';
      const detail =
        applied > 0
          ? `Added ${abs} ${unit} to jar`
          : `Removed ${abs} ${unit} from jar`;
      return touchState(
        appendActivity(
          { ...reconciled, totalStarsEarned: nextStars },
          'edit',
          detail,
          at,
          action.logId
        ),
        at
      );
    }

    case 'openNote': {
      if (reconciled.openedNoteIds.includes(action.noteId)) return reconciled;
      const detail = action.label?.trim()
        ? `Opened note: ${action.label.trim().slice(0, 80)}`
        : 'Opened note';
      return touchState(
        appendActivity(
          {
            ...reconciled,
            openedNoteIds: [...reconciled.openedNoteIds, action.noteId],
          },
          'note',
          detail,
          at,
          action.logId
        ),
        at
      );
    }

    case 'claimReward': {
      const liveReward =
        getActiveRewards(reconciled).find((r) => r.id === action.reward.id) ?? action.reward;
      const cost = Math.min(999, Math.max(1, Math.round(liveReward.cost)));
      if (reconciled.totalStarsEarned < cost) return reconciled;

      const claim: ClaimedReward = {
        id: action.claimId,
        rewardId: liveReward.id,
        title: liveReward.title.slice(0, 120),
        cost,
        dayKey: reconciled.activeDayKey,
      };
      return touchState(
        appendActivity(
          {
            ...reconciled,
            totalStarsEarned: Math.max(0, reconciled.totalStarsEarned - cost),
            claimedRewards: [claim, ...reconciled.claimedRewards],
          },
          'claim',
          `Claimed reward: ${claim.title.slice(0, 80)} (${cost} ${cost === 1 ? 'star' : 'stars'})`,
          at,
          action.logId
        ),
        at
      );
    }

    case 'fulfillClaim': {
      const target = reconciled.claimedRewards.find((item) => item.id === action.claimId);
      if (!target) return reconciled;
      return touchState(
        appendActivity(
          {
            ...reconciled,
            claimedRewards: reconciled.claimedRewards.filter((item) => item.id !== action.claimId),
          },
          'fulfill',
          `Fulfilled reward: ${target.title.slice(0, 80)}`,
          at,
          action.logId
        ),
        at
      );
    }

    case 'clearClaimedRewards': {
      if (reconciled.claimedRewards.length === 0) return reconciled;
      const count = reconciled.claimedRewards.length;
      return touchState(
        appendActivity(
          { ...reconciled, claimedRewards: [] },
          'edit',
          `Cleared ${count} claimed ${count === 1 ? 'reward' : 'rewards'}`,
          at,
          action.logId
        ),
        at
      );
    }

    case 'resetToday': {
      const nextHistory = { ...reconciled.dayHistory };
      delete nextHistory[reconciled.activeDayKey];
      return touchState(
        appendActivity(
          {
            ...reconciled,
            checkedRuleIds: [],
            dailyCelebrated: false,
            completedDays: reconciled.completedDays.filter(
              (day) => day !== reconciled.activeDayKey
            ),
            dayHistory: nextHistory,
          },
          'reset',
          'Cleared today checkmarks',
          at,
          action.logId
        ),
        at
      );
    }

    case 'clearLog': {
      if (reconciled.activityLog.length === 0) return reconciled;
      return touchState({ ...reconciled, activityLog: [] }, at);
    }

    case 'importBackup': {
      if (!isValidBackupPayload(action.backup)) return reconciled;
      const restored = sanitizeRulebookState(action.backup, createInitialState(now), now);
      return touchState(
        appendActivity(restored, 'edit', 'Imported backup', at, action.logId),
        at
      );
    }

    default:
      return reconciled;
  }
}
