import {
  ChapterData,
  DEFAULT_CHAPTERS,
  DEFAULT_REWARDS,
  RewardItem,
  RuleItem,
} from '../data/rules';

export const STORAGE_KEY = 'daily_rulebook_v1';
export const RULEBOOK_STATE_VERSION = 1;

export interface RulebookPreferences {
  muted: boolean;
  reducedMotion: boolean;
}

export const ALWAYS_ON_PREFERENCES: RulebookPreferences = {
  muted: false,
  reducedMotion: false,
};

export interface ClaimedReward {
  id: string;
  rewardId: string;
  title: string;
  cost: number;
  dayKey: string;
}

export interface ExtraTask {
  id: string;
  text: string;
  dueAt: string | null;
  stars: number;
  checked: boolean;
}

export const EXTRA_TASK_COUNT = 6;
export const DEFAULT_EXTRA_STARS = 2;
export const MIN_EXTRA_STARS = 1;
export const MAX_EXTRA_STARS = 999;

export function sanitizeExtraStars(value: unknown, fallback = DEFAULT_EXTRA_STARS): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_EXTRA_STARS, Math.max(MIN_EXTRA_STARS, Math.round(value)));
}

export interface ActivityEntry {
  id: string;
  at: number;
  kind: 'check' | 'uncheck' | 'extra' | 'claim' | 'fulfill' | 'note' | 'reset' | 'edit';
  detail: string;
}

export const ACTIVITY_LOG_LIMIT = 200;

export interface RulebookState {
  version: number;
  updatedAt: number;
  activeDayKey: string;
  checkedRuleIds: string[];
  dailyCelebrated: boolean;
  completedDays: string[];
  dayHistory: Record<string, string[]>;
  totalStarsEarned: number;
  openedNoteIds: string[];
  customChapters: ChapterData[] | null;
  customRewards: RewardItem[] | null;
  claimedRewards: ClaimedReward[];
  extras: ExtraTask[];
  activityLog: ActivityEntry[];
  preferences: RulebookPreferences;
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeDayHistory(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [day, ids] of Object.entries(value as Record<string, unknown>)) {
    if (!DAY_KEY_PATTERN.test(day) || !Array.isArray(ids)) continue;
    const clean = ids.filter((id): id is string => typeof id === 'string');
    if (clean.length > 0) result[day] = Array.from(new Set(clean));
  }
  return result;
}

export function sanitizeRewards(value: unknown): RewardItem[] | null {
  if (!Array.isArray(value)) return null;
  const result: RewardItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<RewardItem>;
    if (typeof item.id !== 'string' || typeof item.title !== 'string') continue;
    const rawCost = typeof item.cost === 'number' && Number.isFinite(item.cost) ? Math.round(item.cost) : 1;
    const cost = Math.min(999, Math.max(1, rawCost));
    result.push({ id: item.id.slice(0, 80), title: item.title.slice(0, 120), cost });
  }
  return result;
}

function sanitizeClaimedRewards(value: unknown): ClaimedReward[] {
  if (!Array.isArray(value)) return [];
  const result: ClaimedReward[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const claim = entry as Partial<ClaimedReward>;
    if (typeof claim.id !== 'string' || typeof claim.title !== 'string') continue;
    result.push({
      id: claim.id.slice(0, 80),
      rewardId: typeof claim.rewardId === 'string' ? claim.rewardId.slice(0, 80) : claim.id.slice(0, 80),
      title: claim.title.slice(0, 120),
      cost: typeof claim.cost === 'number' && claim.cost >= 0 ? Math.min(999, Math.round(claim.cost)) : 0,
      dayKey: typeof claim.dayKey === 'string' ? claim.dayKey : '',
    });
  }
  return result;
}

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const ISO_WITH_TZ_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function localInputToIsoUtc(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const match = LOCAL_DATETIME_PATTERN.exec(trimmed);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function isoUtcToLocalInput(dueAt: string | null): string {
  if (!dueAt) return '';
  const dt = new Date(dueAt);
  if (Number.isNaN(dt.getTime())) return '';
  const y = String(dt.getFullYear()).padStart(4, '0');
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  const h = String(dt.getHours()).padStart(2, '0');
  const mi = String(dt.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function sanitizeDueAt(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  if (ISO_WITH_TZ_PATTERN.test(raw)) {
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  if (LOCAL_DATETIME_PATTERN.test(raw)) {
    return localInputToIsoUtc(raw);
  }
  return null;
}

function createBlankExtras(): ExtraTask[] {
  return Array.from({ length: EXTRA_TASK_COUNT }, (_, idx) => ({
    id: `extra-${idx + 1}`,
    text: '',
    dueAt: null,
    stars: DEFAULT_EXTRA_STARS,
    checked: false,
  }));
}

function sanitizeExtras(value: unknown): ExtraTask[] {
  const blank = createBlankExtras();
  if (!Array.isArray(value)) return blank;
  return blank.map((slot, idx) => {
    const entry = value[idx];
    if (!entry || typeof entry !== 'object') return slot;
    const task = entry as Partial<ExtraTask>;
    const text = typeof task.text === 'string' ? task.text.slice(0, 120) : '';
    return {
      ...slot,
      text,
      dueAt: sanitizeDueAt(task.dueAt),
      stars: sanitizeExtraStars(task.stars),
      checked: false,
    };
  });
}

const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const ET_DISPLAY_DATE = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

const LOCAL_CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
});

const LOCAL_LOG_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const LOGICAL_DAY_DISPLAY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

interface EasternParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getEasternParts(date: Date): EasternParts {
  const parts = ET_FORMATTER.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour === 24 ? 0 : map.hour,
    minute: map.minute,
    second: map.second,
  };
}

function formatUtcYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getEasternLogicalDayKey(now: Date = new Date()): string {
  const { year, month, day, hour } = getEasternParts(now);
  const utcCalendar = new Date(Date.UTC(year, month - 1, day));
  if (hour < 1) {
    utcCalendar.setUTCDate(utcCalendar.getUTCDate() - 1);
  }
  return formatUtcYmd(utcCalendar);
}

export function formatEasternDisplayDate(now: Date = new Date()): string {
  const dayKey = getEasternLogicalDayKey(now);
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return ET_DISPLAY_DATE.format(now);
  return LOGICAL_DAY_DISPLAY.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return formatUtcYmd(dt);
}

function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return formatUtcYmd(dt);
}

export function getResetCountdownLabel(now: Date = new Date()): string {
  const activeDay = getEasternLogicalDayKey(now);
  const nextResetUtc = easternWallToUtcMs(nextDayKey(activeDay), 60);
  const diffMs = Math.max(0, nextResetUtc - now.getTime());
  const minutesRemaining = Math.max(1, Math.ceil(diffMs / 60_000));

  const h = Math.floor(minutesRemaining / 60);
  const m = minutesRemaining % 60;
  if (h === 0) {
    return `${m}m`;
  }
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function getEasternMinutes(now: Date = new Date()): number {
  const { hour, minute } = getEasternParts(now);
  return hour * 60 + minute;
}

export function toLogicalEasternMinutes(wallMinutes: number): number {
  return (wallMinutes - 60 + 1440) % 1440;
}

const UNLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseUnlockMinutes(unlockAt?: string): number | null {
  if (!unlockAt) return null;
  const match = UNLOCK_PATTERN.exec(unlockAt);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isRuleLocked(rule: RuleItem, now: Date, checked: boolean): boolean {
  if (checked) return false;
  const unlock = parseUnlockMinutes(rule.unlockAt);
  if (unlock === null) return false;
  return toLogicalEasternMinutes(getEasternMinutes(now)) < toLogicalEasternMinutes(unlock);
}

export function easternWallToUtcMs(dayKey: string, minutes: number): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const targetWallUtc = Date.UTC(y, m - 1, d, hour, minute, 0);
  const offsetFor = (utcMs: number): number => {
    const p = getEasternParts(new Date(utcMs));
    const easternAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
    return easternAsUtc - utcMs;
  };
  let offset = offsetFor(targetWallUtc);
  let utc = targetWallUtc - offset;
  offset = offsetFor(utc);
  utc = targetWallUtc - offset;
  return utc;
}

export function logicalEasternWallToUtcMs(dayKey: string, minutes: number): number {
  const calendarDay = minutes < 60 ? nextDayKey(dayKey) : dayKey;
  return easternWallToUtcMs(calendarDay, minutes);
}

export function formatUnlockLabel(unlockAt?: string, now: Date = new Date()): string {
  const minutes = parseUnlockMinutes(unlockAt);
  if (minutes === null) return '';
  const dayKey = getEasternLogicalDayKey(now);
  const utc = logicalEasternWallToUtcMs(dayKey, minutes);
  return LOCAL_CLOCK_FORMAT.format(new Date(utc));
}

export interface ChapterLockSummary {
  sealed: number;
  nextLabel: string | null;
}

export function summarizeChapterLocks(
  chapter: ChapterData,
  now: Date,
  checkedRuleIds: string[]
): ChapterLockSummary {
  let sealed = 0;
  let nextLogical = Number.POSITIVE_INFINITY;
  let nextLabel: string | null = null;

  for (const rule of chapter.rules) {
    if (!isRuleLocked(rule, now, checkedRuleIds.includes(rule.id))) continue;
    sealed += 1;
    const minutes = parseUnlockMinutes(rule.unlockAt);
    if (minutes !== null) {
      const logical = toLogicalEasternMinutes(minutes);
      if (logical < nextLogical) {
        nextLogical = logical;
        nextLabel = formatUnlockLabel(rule.unlockAt, now);
      }
    }
  }

  return { sealed, nextLabel };
}

export function isExtraExpired(extra: ExtraTask, now: Date = new Date()): boolean {
  if (extra.checked || !extra.dueAt) return false;
  const dueMs = Date.parse(extra.dueAt);
  if (Number.isNaN(dueMs)) return false;
  return dueMs <= now.getTime();
}

export function formatExtraDue(dueAt: string): string {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return '';
  return LOCAL_LOG_FORMAT.format(due);
}

export function computeCozyStreak(completedDays: string[], activeDayKey: string): number {
  if (completedDays.length === 0) return 0;
  const set = new Set(completedDays);
  let cursor = set.has(activeDayKey) ? activeDayKey : previousDayKey(activeDayKey);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}

function sanitizeActivityLog(value: unknown): ActivityEntry[] {
  if (!Array.isArray(value)) return [];
  const kinds: ActivityEntry['kind'][] = ['check', 'uncheck', 'extra', 'claim', 'fulfill', 'note', 'reset', 'edit'];
  const result: ActivityEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<ActivityEntry>;
    if (typeof item.id !== 'string' || typeof item.detail !== 'string') continue;
    if (typeof item.at !== 'number' || !Number.isFinite(item.at)) continue;
    if (typeof item.kind !== 'string' || !kinds.includes(item.kind as ActivityEntry['kind'])) continue;
    result.push({
      id: item.id.slice(0, 80),
      at: Math.floor(item.at),
      kind: item.kind as ActivityEntry['kind'],
      detail: item.detail.slice(0, 200),
    });
  }
  result.sort((a, b) => b.at - a.at);
  return result.slice(0, ACTIVITY_LOG_LIMIT);
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string')));
}

function sanitizeDayList(value: unknown): string[] {
  return Array.from(new Set(sanitizeStringList(value).filter((d) => DAY_KEY_PATTERN.test(d)))).sort();
}

const VALID_CHARMS = new Set<ChapterData['charm']>(['sun', 'milk', 'ribbon', 'moon']);
const VALID_ACCENTS = new Set<ChapterData['accentColor']>(['pink', 'butter', 'rose', 'lavender']);
const VALID_NOTE_STYLES = new Set(['envelope', 'sticky', 'flap']);

export function sanitizeSingleChapter(entry: unknown, fallback: ChapterData): ChapterData {
  if (!entry || typeof entry !== 'object') return fallback;
  const chapter = entry as Partial<ChapterData>;
  const rules: RuleItem[] = [];
  if (Array.isArray(chapter.rules)) {
    const seenIds = new Set<string>();
    for (const rule of chapter.rules) {
      if (!rule || typeof rule !== 'object') continue;
      const item = rule as Partial<RuleItem>;
      if (typeof item.id !== 'string' || !item.id || typeof item.text !== 'string') continue;
      const cleanId = item.id.slice(0, 80);
      if (seenIds.has(cleanId)) continue;
      seenIds.add(cleanId);
      rules.push({
        id: cleanId,
        text: item.text.slice(0, 200),
        ...(typeof item.hint === 'string' && item.hint ? { hint: item.hint.slice(0, 200) } : {}),
        ...(typeof item.unlockAt === 'string' && UNLOCK_PATTERN.test(item.unlockAt)
          ? { unlockAt: item.unlockAt }
          : {}),
      });
    }
  } else {
    rules.push(...fallback.rules);
  }

  let secretNote = fallback.secretNote;
  if (chapter.secretNote && typeof chapter.secretNote === 'object') {
    const rawNote = chapter.secretNote;
    const baseNote = fallback.secretNote;
    const style =
      typeof rawNote.style === 'string' && VALID_NOTE_STYLES.has(rawNote.style)
        ? rawNote.style
        : (baseNote?.style ?? 'sticky');
    secretNote = {
      id: typeof rawNote.id === 'string' && rawNote.id ? rawNote.id.slice(0, 80) : (baseNote?.id ?? `note-${fallback.id}`),
      style,
      label: typeof rawNote.label === 'string' ? rawNote.label.slice(0, 120) : (baseNote?.label ?? ''),
      message: typeof rawNote.message === 'string' ? rawNote.message.slice(0, 600) : (baseNote?.message ?? ''),
      signoff: typeof rawNote.signoff === 'string' ? rawNote.signoff.slice(0, 120) : (baseNote?.signoff ?? ''),
    };
  } else if (chapter.secretNote === undefined && !fallback.secretNote) {
    secretNote = undefined;
  }

  return {
    id: fallback.id,
    tabLabel:
      typeof chapter.tabLabel === 'string' && chapter.tabLabel.trim()
        ? chapter.tabLabel.slice(0, 40)
        : fallback.tabLabel,
    numberLabel:
      typeof chapter.numberLabel === 'string' && chapter.numberLabel.trim()
        ? chapter.numberLabel.slice(0, 40)
        : fallback.numberLabel,
    title: typeof chapter.title === 'string' ? chapter.title.slice(0, 120) : fallback.title,
    subtitle: typeof chapter.subtitle === 'string' ? chapter.subtitle.slice(0, 200) : fallback.subtitle,
    charm:
      typeof chapter.charm === 'string' && VALID_CHARMS.has(chapter.charm as ChapterData['charm'])
        ? (chapter.charm as ChapterData['charm'])
        : fallback.charm,
    accentColor:
      typeof chapter.accentColor === 'string' &&
      VALID_ACCENTS.has(chapter.accentColor as ChapterData['accentColor'])
        ? (chapter.accentColor as ChapterData['accentColor'])
        : fallback.accentColor,
    rules,
    ...(secretNote ? { secretNote } : {}),
  };
}

function sanitizeChapters(value: unknown): ChapterData[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const byId = new Map<string, unknown>();
  for (const entry of value) {
    if (entry && typeof entry === 'object' && typeof (entry as Partial<ChapterData>).id === 'string') {
      byId.set((entry as ChapterData).id, entry);
    }
  }
  let matchedAny = false;
  const aligned = DEFAULT_CHAPTERS.map((def, idx) => {
    const candidate = byId.get(def.id) ?? value[idx];
    if (candidate && typeof candidate === 'object') {
      matchedAny = true;
      return sanitizeSingleChapter(candidate, def);
    }
    return def;
  });
  return matchedAny ? aligned : null;
}

export function isValidBackupPayload(value: unknown): value is Partial<RulebookState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    (typeof obj.activeDayKey === 'string' && DAY_KEY_PATTERN.test(obj.activeDayKey)) ||
    Array.isArray(obj.checkedRuleIds) ||
    typeof obj.totalStarsEarned === 'number' ||
    Array.isArray(obj.customChapters) ||
    Array.isArray(obj.customRewards) ||
    Array.isArray(obj.extras)
  );
}

export function sanitizeRulebookState(
  parsed: Partial<RulebookState> | null | undefined,
  fallback: RulebookState = createInitialState(),
  now: Date = new Date()
): RulebookState {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
  const merged: RulebookState = {
    version: RULEBOOK_STATE_VERSION,
    updatedAt:
      typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) && parsed.updatedAt > 0
        ? Math.floor(parsed.updatedAt)
        : (fallback.updatedAt ?? 0),
    activeDayKey:
      typeof parsed.activeDayKey === 'string' && DAY_KEY_PATTERN.test(parsed.activeDayKey)
        ? parsed.activeDayKey
        : fallback.activeDayKey,
    checkedRuleIds: sanitizeStringList(parsed.checkedRuleIds),
    dailyCelebrated: Boolean(parsed.dailyCelebrated),
    completedDays: sanitizeDayList(parsed.completedDays),
    dayHistory: sanitizeDayHistory(parsed.dayHistory),
    totalStarsEarned:
      typeof parsed.totalStarsEarned === 'number' &&
      Number.isFinite(parsed.totalStarsEarned) &&
      parsed.totalStarsEarned >= 0
        ? Math.floor(parsed.totalStarsEarned)
        : 0,
    openedNoteIds: sanitizeStringList(parsed.openedNoteIds),
    customChapters: sanitizeChapters(parsed.customChapters),
    customRewards: sanitizeRewards(parsed.customRewards),
    claimedRewards: sanitizeClaimedRewards(parsed.claimedRewards),
    extras: sanitizeExtras(parsed.extras),
    activityLog: sanitizeActivityLog(parsed.activityLog),
    preferences: { ...ALWAYS_ON_PREFERENCES },
  };
  return reconcileDailyReset(merged, now);
}

export function mergeRulebookStates(local: RulebookState, remote: RulebookState): RulebookState {
  return remote.updatedAt >= local.updatedAt ? remote : local;
}

export function touchState(state: RulebookState, at: number = Date.now()): RulebookState {
  return { ...state, version: RULEBOOK_STATE_VERSION, updatedAt: Math.floor(at) };
}

export function appendActivity(
  state: RulebookState,
  kind: ActivityEntry['kind'],
  detail: string,
  at: number = Date.now(),
  id?: string
): RulebookState {
  const clean = detail.trim().slice(0, 200);
  if (!clean) return state;
  const entry: ActivityEntry = {
    id: id?.slice(0, 80) || `log-${Math.floor(at).toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: Math.floor(at),
    kind,
    detail: clean,
  };
  return { ...state, activityLog: [entry, ...state.activityLog].slice(0, ACTIVITY_LOG_LIMIT) };
}

export function formatActivityAt(at: number): string {
  return LOCAL_LOG_FORMAT.format(new Date(at));
}

export function createInitialState(now: Date = new Date()): RulebookState {
  return {
    version: RULEBOOK_STATE_VERSION,
    updatedAt: 0,
    activeDayKey: getEasternLogicalDayKey(now),
    checkedRuleIds: [],
    dailyCelebrated: false,
    completedDays: [],
    dayHistory: {},
    totalStarsEarned: 0,
    openedNoteIds: [],
    customChapters: null,
    customRewards: null,
    claimedRewards: [],
    extras: createBlankExtras(),
    activityLog: [],
    preferences: { ...ALWAYS_ON_PREFERENCES },
  };
}

export function reconcileDailyReset(state: RulebookState, now: Date = new Date()): RulebookState {
  const currentDayKey = getEasternLogicalDayKey(now);
  if (state.activeDayKey === currentDayKey) {
    return state;
  }
  return {
    ...state,
    activeDayKey: currentDayKey,
    checkedRuleIds: [],
    dailyCelebrated: false,
  };
}

interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserLocalStorage(): BrowserStorageLike | null {
  try {
    const g = globalThis as { localStorage?: BrowserStorageLike };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadRulebookState(): RulebookState {
  const fallback = createInitialState();
  const storage = getBrowserLocalStorage();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return sanitizeRulebookState(JSON.parse(raw) as Partial<RulebookState>, fallback);
  } catch {
    return fallback;
  }
}

export function saveRulebookState(state: RulebookState): void {
  const storage = getBrowserLocalStorage();
  if (!storage) return;
  try {
    const clean: RulebookState = {
      ...state,
      extras: state.extras.map((extra) => ({ ...extra, checked: false })),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota or private-mode failures.
  }
}

export function getActiveChapters(state: RulebookState): ChapterData[] {
  return state.customChapters ?? DEFAULT_CHAPTERS;
}

export function getActiveRewards(state: RulebookState): RewardItem[] {
  return state.customRewards ?? DEFAULT_REWARDS;
}

export function generateRulesTsSnippet(
  chapters: ChapterData[],
  rewards: RewardItem[] = DEFAULT_REWARDS
): string {
  return [
    `export const DEFAULT_CHAPTERS: ChapterData[] = ${JSON.stringify(chapters, null, 2)};`,
    '',
    `export const DEFAULT_REWARDS: RewardItem[] = ${JSON.stringify(rewards, null, 2)};`,
    '',
  ].join('\n');
}
