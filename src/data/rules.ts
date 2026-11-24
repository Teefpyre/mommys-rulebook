export type CharmKind = 'sun' | 'milk' | 'ribbon' | 'moon';
export type NoteStyle = 'envelope' | 'sticky' | 'flap';

export interface RuleItem {
  id: string;
  text: string;
  hint?: string;
  unlockAt?: string;
}

export interface SecretNoteData {
  id: string;
  style: NoteStyle;
  label: string;
  message: string;
  signoff: string;
}

export interface ChapterData {
  id: string;
  tabLabel: string;
  numberLabel: string;
  title: string;
  subtitle: string;
  charm: CharmKind;
  accentColor: 'pink' | 'butter' | 'rose' | 'lavender';
  rules: RuleItem[];
  secretNote?: SecretNoteData;
}

export interface RewardItem {
  id: string;
  title: string;
  cost: number;
}

export interface BookMeta {
  coverKicker: string;
  coverTitle: string;
  coverSubtitle: string;
  dedicationTitle: string;
  dedicationBody: string;
  welcomeNote: SecretNoteData;
}

export const DEFAULT_BOOK_META: BookMeta = {
  coverKicker: '',
  coverTitle: 'Daily Rulebook',
  coverSubtitle: 'routine & habit tracker',
  dedicationTitle: 'Daily Overview',
  dedicationBody:
    'Check off scheduled items throughout the day, track bonus tasks, and collect stars.',
  welcomeNote: {
    id: 'note-welcome',
    style: 'sticky',
    label: 'Daily reminder',
    message: 'Take things one step at a time and pace your day comfortably.',
    signoff: 'Note',
  },
};

export const DEFAULT_CHAPTERS: ChapterData[] = [
  {
    id: 'morning',
    tabLabel: 'Check in',
    numberLabel: 'Chapter One',
    title: 'Morning Routine',
    subtitle: 'Simple check-in items to start the day.',
    charm: 'sun',
    accentColor: 'butter',
    rules: [
      {
        id: 'morning-stretch',
        text: 'Morning stretch for 30 seconds',
        hint: 'Loosen up shoulders and back.',
      },
      {
        id: 'morning-water',
        text: 'Drink a full glass of water',
        hint: 'Start hydrated before coffee or tea.',
      },
      {
        id: 'morning-freshen',
        text: 'Wash face and brush teeth',
      },
      {
        id: 'morning-bed',
        text: 'Eat breakfast and prepare for the day',
        hint: 'Even a light snack counts.',
      },
    ],
    secretNote: {
      id: 'note-morning',
      style: 'envelope',
      label: 'Morning memo',
      message: 'Keep a steady pace this morning and focus on one step at a time.',
      signoff: 'Morning note',
    },
  },
  {
    id: 'house-rules',
    tabLabel: 'Daily Habits',
    numberLabel: 'Chapter Two',
    title: 'Daily Habits',
    subtitle: 'scheduled checkpoints unlocked through the day',
    charm: 'ribbon',
    accentColor: 'rose',
    rules: [
      { id: 'house-truth', text: 'review today schedule and priorities' },
      { id: 'house-scared', text: 'clear desk and workspace clutter' },
      { id: 'house-come-first', text: 'finish top morning focus block', unlockAt: '10:00' },
      { id: 'house-promises', text: 'reply to pending messages', unlockAt: '10:00' },
      { id: 'house-small', text: 'take a midday step away from screens', unlockAt: '15:00' },
      { id: 'house-sorry', text: 'check afternoon progress and errands', unlockAt: '15:00' },
      { id: 'house-ask', text: 'set out items needed for tomorrow', unlockAt: '20:00' },
      { id: 'house-bad-day', text: 'wrap up work and close open tabs', unlockAt: '20:00' },
    ],
  },
  {
    id: 'body-care',
    tabLabel: 'Hydrate & Stretch',
    numberLabel: 'Chapter Three',
    title: 'Hydrate & Stretch',
    subtitle: 'timed reminders across four checkpoints',
    charm: 'milk',
    accentColor: 'pink',
    rules: [
      { id: 'body-hydrate-1', text: 'Hydrate' },
      { id: 'body-stretch-1', text: 'Stretch' },
      { id: 'body-hydrate-2', text: 'Hydrate', unlockAt: '10:00' },
      { id: 'body-stretch-2', text: 'Stretch', unlockAt: '10:00' },
      { id: 'body-hydrate-3', text: 'Hydrate', unlockAt: '15:00' },
      { id: 'body-stretch-3', text: 'Stretch', unlockAt: '15:00' },
      { id: 'body-hydrate-4', text: 'Hydrate', unlockAt: '20:00' },
      { id: 'body-stretch-4', text: 'Stretch', unlockAt: '20:00' },
    ],
  },
  {
    id: 'bedtime',
    tabLabel: 'Evening',
    numberLabel: 'Chapter Four',
    title: 'Evening Wind-Down',
    subtitle: 'unlocks in the evening to wrap up the day',
    charm: 'moon',
    accentColor: 'lavender',
    rules: [
      {
        id: 'bed-skincare',
        text: 'Evening skincare and brush teeth',
        unlockAt: '20:00',
      },
      {
        id: 'bed-prep',
        text: 'Plug in phone and set water beside bed',
        hint: 'Limit late-night scrolling.',
        unlockAt: '20:00',
      },
      {
        id: 'bed-gratitude',
        text: 'Note one highlight from today',
        unlockAt: '20:00',
      },
      {
        id: 'bed-tuckin',
        text: 'Lights out on schedule',
        unlockAt: '20:00',
      },
    ],
    secretNote: {
      id: 'note-bedtime',
      style: 'sticky',
      label: 'Evening reminder',
      message: 'Set aside unfinished tasks until tomorrow and get a good night of rest.',
      signoff: 'Good night',
    },
  },
];

export const DEFAULT_REWARDS: RewardItem[] = [
  { id: 'reward-movie', title: 'Pick tonight movie', cost: 8 },
  { id: 'reward-game', title: 'Play a game session', cost: 12 },
  { id: 'reward-late', title: 'Stay up an extra hour', cost: 20 },
  { id: 'reward-takeout', title: 'Order favorite takeout', cost: 24 },
  { id: 'reward-show', title: 'Start a new series episode', cost: 60 },
  { id: 'reward-dayoff', title: 'Full day off chores', cost: 100 },
];

export const CHECK_FEEDBACK_LINES = [
  'Nice progress',
  'Checked off',
  'Keep going',
];

export const EXTRA_FEEDBACK_LINES = [
  'Bonus task done',
  'All cleared',
];
