// Поиск по курсам: Ctrl/⌘+K. Индекс (по шагу урока) грузится лениво при первом открытии.
import { KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import type { SearchEntry } from '../core/searchIndex';
import { findCourse, lessonHref } from '../content';
import { notesList } from '../state/notes';
import { useProgress } from '../state/progress';
import { I } from './ui/icons';

let indexP: Promise<SearchEntry[]> | null = null;
const loadIndex = () => (indexP ??= import('virtual:dojo-search').then((m) => (m.default as SearchEntry[]).filter((e) => !e.draft)));
// курсы, скрытые от этого посетителя (owners), в поиск не попадают
const visibleEntries = (list: SearchEntry[]) => list.filter((e) => findCourse(e.course));

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

interface Hit {
  key: string;
  course: string;
  title: string;
  sub: string;
  snippet: ReactNode;
  href: string;
  score: number;
  kind: 'lesson' | 'note';
}

function snippet(text: string, tokens: string[]): ReactNode {
  const t = norm(text);
  let pos = -1;
  for (const tok of tokens) {
    pos = t.indexOf(tok);
    if (pos >= 0) break;
  }
  if (pos < 0) return text.slice(0, 120);
  const start = Math.max(0, pos - 50);
  const piece = (start ? '…' : '') + text.slice(start, start + 160) + (start + 160 < text.length ? '…' : '');
  // подсветка всех токенов
  const re = new RegExp(`(${tokens.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return piece.split(re).map((part, i) => (tokens.includes(norm(part)) ? <mark key={i}>{part}</mark> : part));
}

export function useSearchHotkey(open: () => void) {
  useEffect(() => {
    const h = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open]);
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const loc = useLocation();
  const nav = useNavigate();
  const p = useProgress();
  const currentCourse = loc.pathname.match(/^\/c\/([^/]+)/)?.[1];
  const [all, setAll] = useState(!currentCourse);
  const [q, setQ] = useState('');
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadIndex().then((l) => setIndex(visibleEntries(l)));
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const tokens = norm(q).split(/\s+/).filter((x) => x.length > 1);
    if (!tokens.length || !index) return [];
    const out: Hit[] = [];
    for (const e of index) {
      if (!all && e.course !== currentCourse) continue;
      const lt = norm(e.lessonTitle);
      const stt = norm(e.stepTitle);
      const tx = norm(e.text);
      if (!tokens.every((t) => lt.includes(t) || stt.includes(t) || tx.includes(t))) continue;
      const score = tokens.reduce((a, t) => a + (lt.includes(t) ? 10 : 0) + (stt.includes(t) ? 6 : 0) + Math.min(tx.split(t).length - 1, 5), 0);
      out.push({
        key: `${e.course}:${e.lessonKey}:${e.step}`,
        course: e.courseTitle,
        title: e.stepTitle === e.lessonTitle ? e.lessonTitle : `${e.lessonTitle} — ${e.stepTitle}`,
        sub: `${all ? `${e.courseTitle}, ` : ''}${e.module}`,
        snippet: snippet(e.text, tokens),
        href: lessonHref(e.course, e.lessonKey, e.step),
        score,
        kind: 'lesson',
      });
    }
    // заметки ученика тоже ищутся
    for (const n of notesList(p)) {
      if (!findCourse(n.course)) continue;
      if (!all && n.course !== currentCourse) continue;
      const tx = norm(n.text);
      if (!tokens.every((t) => tx.includes(t))) continue;
      const c = findCourse(n.course);
      const lesson = c?.modules.flatMap((m) => m.lessons).find((l) => l.key === n.lesson);
      out.push({
        key: `note:${n.course}:${n.lesson}:${n.step}`,
        course: c?.meta.title ?? n.course,
        title: `Заметка: ${lesson?.meta.title ?? n.lesson}`,
        sub: `шаг ${n.step + 1}`,
        snippet: snippet(n.text, tokens),
        href: lessonHref(n.course, n.lesson, n.step),
        score: 8,
        kind: 'note',
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 40);
  }, [q, index, all, currentCourse, p]);

  useEffect(() => setSel(0), [q, all]);
  useEffect(() => {
    list.current?.querySelector('.sr-item.on')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const go = (h: Hit) => {
    onClose();
    nav(h.href);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && hits[sel]) go(hits[sel]);
  };

  return createPortal(
    <div className="sr-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sr-box" role="dialog" aria-label="Поиск по курсу" onKeyDown={onKey}>
        <div className="sr-input">
          <I.search />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={all ? 'Поиск по всем курсам' : `Поиск по курсу «${findCourse(currentCourse)?.meta.title ?? ''}»`} aria-label="Что искать" />
          {currentCourse && (
            <button className={`btn ghost small${all ? ' on' : ''}`} onClick={() => setAll((a) => !a)} title="Искать во всех курсах">
              {all ? 'Все курсы' : 'Этот курс'}
            </button>
          )}
        </div>
        <div className="sr-list" ref={list} role="listbox">
          {!index && <div className="ws-empty">Загружаю индекс…</div>}
          {index && q.trim().length > 1 && !hits.length && <div className="ws-empty">Ничего не нашлось. Попробуй другое слово или «Все курсы».</div>}
          {index && q.trim().length < 2 && <div className="ws-empty">Ищет по названиям уроков и шагов, тексту теории, вопросам, задачам и твоим заметкам.</div>}
          {hits.map((h, i) => (
            <button key={h.key} role="option" aria-selected={i === sel} className={`sr-item${i === sel ? ' on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
              <span className="sr-ic">{h.kind === 'note' ? <I.pen width={16} height={16} /> : <I.book width={16} height={16} />}</span>
              <span className="sr-body">
                <span className="sr-title">{h.title}</span>
                <span className="sr-sub">{h.sub}</span>
                <span className="sr-snip">{h.snippet}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="sr-foot">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> выбор
          </span>
          <span>
            <kbd>Enter</kbd> открыть
          </span>
          <span>
            <kbd>Esc</kbd> закрыть
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
