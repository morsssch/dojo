// Активность и серии: тепловая карта, неделя по дням, поповер у огонька.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Achievement } from '../state/achievements';
import { ProgressState, streak, useProgress } from '../state/progress';
import { I } from './ui/icons';

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Heatmap({ p, weeks = 18 }: { p: ProgressState; weeks?: number }) {
  const days: { key: string; n: number }[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // последняя колонка заканчивается воскресеньем текущей недели
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7) - (weeks * 7 - 1));
  for (let i = 0; i < weeks * 7; i++) {
    days.push({ key: dayKey(d), n: p.activity[dayKey(d)] ?? 0 });
    d.setDate(d.getDate() + 1);
  }
  const today = dayKey(new Date());
  return (
    <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }} aria-label={`Активность за последние ${weeks} недель`}>
      {days.map((x) => (
        <i key={x.key} className={`${x.n >= 12 ? 'l3' : x.n >= 5 ? 'l2' : x.n > 0 ? 'l1' : ''}${x.key === today ? ' today' : ''}`} title={`${x.key}: ${x.n ? `${x.n} действ.` : 'нет активности'}`} />
      ))}
    </div>
  );
}

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function WeekRow({ p }: { p: ProgressState }) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // понедельник
  const today = dayKey(new Date());
  return (
    <div className="week">
      {WD.map((w, i) => {
        const k = dayKey(d);
        const active = !!p.activity[k];
        const future = k > today;
        d.setDate(d.getDate() + 1);
        return (
          <div key={w} className={`wd${active ? ' on' : ''}${k === today ? ' today' : ''}${future ? ' future' : ''}`}>
            <span className="dot">{active && <I.check width={12} height={12} strokeWidth={3} />}</span>
            <span>{w}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StreakButton() {
  const p = useProgress();
  const s = streak(p);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const todayDone = !!p.activity[dayKey(new Date())];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className="pop-wrap" ref={box}>
      <button className={`streak-chip${s.current ? ' hot' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" title="Серия занятий">
        <I.flame width={15} height={15} /> {s.current}
      </button>
      {open && (
        <div className="popover streak-pop" role="dialog" aria-label="Серия занятий">
          <div className="streak-big">
            <I.flame width={30} height={30} />
            <div>
              <b>
                {s.current} {plural(s.current, 'день', 'дня', 'дней')} подряд
              </b>
              <span className="muted">рекорд — {s.best}, всего дней с занятиями — {s.days}</span>
            </div>
          </div>
          <p className={`streak-today${todayDone ? ' ok' : ''}`}>
            {todayDone ? 'Сегодня уже занимался — серия продлена.' : s.current ? 'Сегодня ещё не занимался: реши любое задание, чтобы не потерять серию.' : 'Реши любое задание сегодня, чтобы начать серию.'}
          </p>
          <WeekRow p={p} />
          <div className="ws-section-title" style={{ marginTop: 14 }}>
            Последние 18 недель
          </div>
          <Heatmap p={p} />
          <Link to="/achievements" className="btn small" style={{ marginTop: 14 }} onClick={() => setOpen(false)}>
            <I.trophy /> Все достижения
          </Link>
        </div>
      )}
    </div>
  );
}

export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export function AchBadge({ a, got, size = 20 }: { a: Achievement; got: boolean; size?: number }) {
  const Ic = I[a.icon];
  return (
    <span className={`ach${got ? ' got' : ''}`} aria-hidden>
      <Ic width={size} height={size} />
    </span>
  );
}
