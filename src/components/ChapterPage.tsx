import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Check, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { ChapterData, RuleItem } from '../data/rules';
import {
  formatUnlockLabel,
  isRuleLocked,
  summarizeChapterLocks,
} from '../lib/storage';
import { ChapterCharm, InkCheckbox } from './Charms';
import { Folio, RunningHeader } from './PaperBits';
import { SecretNote } from './SecretNote';

interface ChapterPageProps {
  chapter: ChapterData;
  pageNumber: number;
  checkedRuleIds: string[];
  openedNoteIds: string[];
  reducedMotion: boolean;
  canEdit: boolean;
  autoEditNonce?: number;
  now: Date;
  onToggleRule: (ruleId: string, originEl?: HTMLElement | null) => void;
  onFirstOpenNote: (noteId: string, label?: string) => void;
  onUpdateChapter: (updated: ChapterData, immediate?: boolean) => void;
  onFlushEdit?: () => void;
}

export const ChapterPage: React.FC<ChapterPageProps> = ({
  chapter,
  pageNumber,
  checkedRuleIds,
  openedNoteIds,
  reducedMotion,
  canEdit,
  autoEditNonce = 0,
  now,
  onToggleRule,
  onFirstOpenNote,
  onUpdateChapter,
  onFlushEdit,
}) => {
  const [editing, setEditing] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleHint, setNewRuleHint] = useState('');

  useEffect(() => {
    if (!canEdit) setEditing(false);
  }, [canEdit]);

  useEffect(() => {
    if (autoEditNonce > 0 && canEdit) {
      setEditing(true);
    }
  }, [autoEditNonce, canEdit]);

  const chapterCompleted = chapter.rules.filter((r) => checkedRuleIds.includes(r.id)).length;
  const locks = summarizeChapterLocks(chapter, now, checkedRuleIds);
  const compact = chapter.rules.length > 6;
  const note = chapter.secretNote;

  const labelCounts = new Map<string, number>();
  for (const rule of chapter.rules) {
    labelCounts.set(rule.text, (labelCounts.get(rule.text) ?? 0) + 1);
  }

  const updateRule = (ruleId: string, patch: Partial<RuleItem>, immediate = false) => {
    onUpdateChapter(
      {
        ...chapter,
        rules: chapter.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
      },
      immediate
    );
  };

  const removeRule = (ruleId: string) => {
    onUpdateChapter(
      {
        ...chapter,
        rules: chapter.rules.filter((r) => r.id !== ruleId),
      },
      true
    );
  };

  const moveRule = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= chapter.rules.length) return;
    const copy = [...chapter.rules];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item);
    onUpdateChapter({ ...chapter, rules: copy }, true);
  };

  const addRule = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRuleText.trim();
    if (!trimmed) return;
    const id = `${chapter.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nextRule: RuleItem = {
      id,
      text: trimmed,
      ...(newRuleHint.trim() ? { hint: newRuleHint.trim() } : {}),
    };
    onUpdateChapter(
      {
        ...chapter,
        rules: [...chapter.rules, nextRule],
      },
      true
    );
    setNewRuleText('');
    setNewRuleHint('');
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex min-h-0 flex-1 flex-col">
        <RunningHeader
          left={`${chapter.numberLabel} · ${chapter.tabLabel}`}
          right={
            <span className="inline-flex items-center gap-2.5">
              {!editing && (
                <span className="text-[13px] font-bold tabular-nums text-strawberry-600">
                  {chapterCompleted} of {chapter.rules.length}
                </span>
              )}
              {canEdit && (
                <>
                  <span className="text-strawberry-200" aria-hidden="true">
                    &middot;
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (editing) onFlushEdit?.();
                      setEditing((prev) => !prev);
                    }}
                    className={`inline-flex items-center gap-1 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500 ${
                      editing
                        ? 'text-strawberry-600 underline underline-offset-4'
                        : 'text-cocoa-soft hover:text-strawberry-600 hover:underline hover:underline-offset-4'
                    }`}
                  >
                    {editing ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3 w-3" />
                        <span>Edit</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </span>
          }
        />

        <div className="flex items-center gap-3.5 pb-3">
          <ChapterCharm kind={chapter.charm} className="h-14 w-14 shrink-0" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                type="text"
                value={chapter.title}
                onChange={(e) => onUpdateChapter({ ...chapter, title: e.target.value })}
                onBlur={() => onFlushEdit?.()}
                aria-label="Chapter title"
                className="w-full border-b border-strawberry-300 bg-transparent pb-0.5 font-display text-[22px] font-bold text-cocoa focus:border-strawberry-500 focus:outline-none"
              />
            ) : (
              <h2 className="type-press font-display text-[25px] font-bold leading-tight text-cocoa lg:text-[27px]">
                {chapter.title}
              </h2>
            )}

            {editing ? (
              <input
                type="text"
                value={chapter.subtitle}
                onChange={(e) => onUpdateChapter({ ...chapter, subtitle: e.target.value })}
                onBlur={() => onFlushEdit?.()}
                aria-label="Chapter subtitle"
                placeholder="Chapter subtitle..."
                className="mt-1 w-full border-b border-strawberry-200 bg-transparent pb-0.5 text-[13px] font-semibold text-cocoa-soft focus:border-strawberry-500 focus:outline-none"
              />
            ) : (
              <p className="mt-0.5 text-balance text-[14px] font-semibold leading-snug text-cocoa-soft">
                {chapter.subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-strawberry-200/90 via-strawberry-200/50 to-transparent" aria-hidden="true" />

        {!editing && locks.sealed > 0 && (
          <p className="pt-2 text-[12.5px] font-semibold text-cocoa-soft">
            {locks.sealed} locked
            {locks.nextLabel ? ` · next at ${locks.nextLabel}` : ''}
          </p>
        )}

        <div className="page-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
          {!editing ? (
            chapter.rules.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[15px] font-semibold text-cocoa-soft">
                  No items on this page yet.
                </p>
              </div>
            ) : (
              <ol>
                {chapter.rules.map((rule, idx) => {
                  const checked = checkedRuleIds.includes(rule.id);
                  const locked = isRuleLocked(rule, now, checked);
                  const numLabel = `${idx + 1}.`;
                  const repeated = (labelCounts.get(rule.text) ?? 0) > 1;

                  const prevRule = idx > 0 ? chapter.rules[idx - 1] : undefined;
                  const prevLocked =
                    !!prevRule &&
                    isRuleLocked(prevRule, now, checkedRuleIds.includes(prevRule.id));
                  const showUnlockTime =
                    locked && !(prevLocked && prevRule?.unlockAt === rule.unlockAt);

                  const rowBody = (
                    <>
                      <span
                        className="mt-[3px] w-5 shrink-0 select-none text-right text-[13px] font-bold tabular-nums text-cocoa-soft"
                        aria-hidden="true"
                      >
                        {numLabel}
                      </span>
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                        {locked ? (
                          <Lock
                            className="h-[15px] w-[15px] text-strawberry-300"
                            aria-hidden="true"
                          />
                        ) : (
                          <span data-ink-checkbox>
                            <InkCheckbox
                              checked={checked}
                              reducedMotion={reducedMotion}
                              className="h-6 w-6"
                            />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-semibold leading-[1.45] transition-colors duration-500 ${
                            locked ? '' : 'group-hover:text-strawberry-600'
                          } ${
                            compact
                              ? 'text-[14.5px] min-[900px]:text-[15.5px]'
                              : 'text-[15.5px]'
                          } ${checked || locked ? 'text-cocoa-soft' : 'text-cocoa'}`}
                        >
                          {rule.text}
                        </span>
                        {showUnlockTime ? (
                          <span className="mt-0.5 block text-[12.5px] font-medium leading-snug text-cocoa-soft/80">
                            opens {formatUnlockLabel(rule.unlockAt, now)}
                          </span>
                        ) : (
                          !locked &&
                          rule.hint && (
                            <span className="mt-0.5 block text-[13.5px] font-medium leading-snug text-cocoa-soft">
                              {rule.hint}
                            </span>
                          )
                        )}
                      </span>
                    </>
                  );

                  return (
                    <li key={rule.id} className="relative">
                      {locked ? (
                        <div
                          className={`flex w-full items-start gap-3 px-1 text-left ${
                            compact ? 'py-1.5 min-[900px]:py-3.5' : 'py-3.5'
                          }`}
                        >
                          {rowBody}
                        </div>
                      ) : (
                        <motion.button
                          type="button"
                          onClick={(e) => onToggleRule(rule.id, e.currentTarget)}
                          whileTap={reducedMotion ? undefined : { scale: 0.995 }}
                          className={`group flex w-full items-start gap-3 px-1 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-strawberry-500 ${
                            compact ? 'py-1.5 min-[900px]:py-3.5' : 'py-3.5'
                          }`}
                          aria-pressed={checked}
                          aria-label={
                            repeated
                              ? `${rule.text}, ${idx + 1} of ${chapter.rules.length}`
                              : undefined
                          }
                        >
                          {rowBody}
                        </motion.button>
                      )}
                      {idx < chapter.rules.length - 1 && (
                        <span
                          className="pointer-events-none absolute inset-x-1 bottom-0 block h-px bg-gradient-to-r from-strawberry-200/70 via-strawberry-100/60 to-transparent"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  );
                })}
              </ol>
            )
          ) : (
            <div className="divide-y divide-strawberry-100 pb-1">
              {chapter.rules.map((rule, idx) => (
                <div key={rule.id} className="py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={rule.text}
                        onChange={(e) => updateRule(rule.id, { text: e.target.value })}
                        onBlur={() => onFlushEdit?.()}
                        placeholder="Item title..."
                        aria-label={`Item ${idx + 1} text`}
                        className="w-full border-b border-strawberry-200 bg-transparent pb-1 text-[13.5px] font-bold text-cocoa focus:border-strawberry-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={rule.hint ?? ''}
                        onChange={(e) =>
                          updateRule(rule.id, {
                            hint: e.target.value || undefined,
                          })
                        }
                        onBlur={() => onFlushEdit?.()}
                        placeholder="Optional note..."
                        aria-label={`Item ${idx + 1} note`}
                        className="w-full bg-transparent text-[12.5px] font-semibold text-cocoa-soft focus:outline-none"
                      />
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-cocoa-soft">
                          <span>Opens</span>
                          <input
                            type="time"
                            value={rule.unlockAt ?? ''}
                            onChange={(e) =>
                              updateRule(
                                rule.id,
                                {
                                  unlockAt: e.target.value || undefined,
                                },
                                true
                              )
                            }
                            aria-label="Unlock time (Eastern Time)"
                            className="border-b border-strawberry-200 bg-transparent pb-0.5 text-[12.5px] font-bold tabular-nums text-cocoa focus:border-strawberry-500 focus:outline-none"
                          />
                          <span className="text-[11px] font-bold text-cocoa-soft/75">ET</span>
                        </label>
                        {rule.unlockAt ? (
                          <>
                            <button
                              type="button"
                              onClick={() => updateRule(rule.id, { unlockAt: undefined }, true)}
                              className="text-[11.5px] font-bold text-strawberry-600 transition-colors hover:text-strawberry-700"
                            >
                              Always open
                            </button>
                            <span className="text-[11.5px] font-medium tabular-nums text-cocoa-soft/70">
                              {formatUnlockLabel(rule.unlockAt, now)} local
                            </span>
                          </>
                        ) : (
                          <span className="text-[11.5px] font-semibold text-cocoa-soft/70">
                            always open
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 pt-0.5">
                      <button
                        type="button"
                        onClick={() => moveRule(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Move item up"
                        className="p-1 text-cocoa-soft transition-colors hover:text-strawberry-600 disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveRule(idx, 1)}
                        disabled={idx === chapter.rules.length - 1}
                        aria-label="Move item down"
                        className="p-1 text-cocoa-soft transition-colors hover:text-strawberry-600 disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        aria-label="Remove item"
                        className="p-1 text-strawberry-500 transition-colors hover:text-strawberry-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <form onSubmit={addRule} className="pt-3">
                <p className="mb-1 text-[12px] font-bold text-strawberry-600">Add a new item</p>
                <input
                  type="text"
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="Write a new item..."
                  aria-label="New item text"
                  className="w-full border-b border-strawberry-200 bg-transparent pb-1 text-[13.5px] font-bold text-cocoa focus:border-strawberry-500 focus:outline-none"
                />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={newRuleHint}
                    onChange={(e) => setNewRuleHint(e.target.value)}
                    placeholder="Optional note..."
                    aria-label="New item note"
                    className="min-w-0 flex-1 border-b border-strawberry-100 bg-transparent pb-1 text-[12.5px] font-semibold text-cocoa-soft focus:border-strawberry-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-strawberry-500 px-3 py-1 text-[12.5px] font-bold text-paper transition-colors hover:bg-strawberry-600"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </form>

              {note && (
                <div className="mt-3 pt-3">
                  <p className="mb-1 text-[12px] font-bold text-strawberry-600">
                    Chapter note
                  </p>
                  <input
                    type="text"
                    value={note.label}
                    onChange={(e) =>
                      onUpdateChapter({
                        ...chapter,
                        secretNote: { ...note, label: e.target.value },
                      })
                    }
                    onBlur={() => onFlushEdit?.()}
                    placeholder="Note label..."
                    aria-label="Note label"
                    className="mb-1.5 w-full border-b border-strawberry-200 bg-transparent pb-1 text-[13.5px] font-bold text-cocoa focus:border-strawberry-500 focus:outline-none"
                  />
                  <textarea
                    rows={2}
                    value={note.message}
                    onChange={(e) =>
                      onUpdateChapter({
                        ...chapter,
                        secretNote: { ...note, message: e.target.value },
                      })
                    }
                    onBlur={() => onFlushEdit?.()}
                    placeholder="Note message..."
                    aria-label="Note message"
                    className="w-full resize-none border-b border-strawberry-200 bg-transparent pb-1 text-[13px] font-semibold text-cocoa focus:border-strawberry-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={note.signoff}
                    onChange={(e) =>
                      onUpdateChapter({
                        ...chapter,
                        secretNote: { ...note, signoff: e.target.value },
                      })
                    }
                    onBlur={() => onFlushEdit?.()}
                    placeholder="Sign-off..."
                    aria-label="Note sign-off"
                    className="mt-1.5 w-full border-b border-strawberry-100 bg-transparent pb-1 text-[12.5px] font-semibold text-cocoa-soft focus:border-strawberry-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {!editing && note && (
            <SecretNote
              note={note}
              isOpenedPreviously={openedNoteIds.includes(note.id)}
              reducedMotion={reducedMotion}
              onFirstOpen={(noteId) => onFirstOpenNote(noteId, note.label)}
            />
          )}
        </div>
      </div>

      <Folio page={pageNumber} />
    </div>
  );
};
