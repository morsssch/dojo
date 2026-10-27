// Полноэкранное рабочее место для задачи: слева условие, справа рабочая зона, снизу вывод.
// Разделители двигаются мышью/пальцем, размеры запоминаются.
import { PointerEvent as RPE, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { I } from './ui/icons';

const load = (k: string, d: number) => {
  try {
    const v = Number(localStorage.getItem(`dojo:ws:${k}`));
    return v > 0 ? v : d;
  } catch {
    return d;
  }
};
const save = (k: string, v: number) => {
  try {
    localStorage.setItem(`dojo:ws:${k}`, String(Math.round(v)));
  } catch {
    /* ignore */
  }
};

interface Props {
  title: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
  left: ReactNode;
  main: ReactNode;
  bottom?: ReactNode;
  onClose: () => void;
  /** ключ для запоминания размеров (разный у кода и git) */
  layoutKey?: string;
}

export function Workspace({ title, tags, actions, left, main, bottom, onClose, layoutKey = 'code' }: Props) {
  const [leftW, setLeftW] = useState(() => load(`${layoutKey}:left`, 36)); // % ширины
  const [bottomH, setBottomH] = useState(() => load(`${layoutKey}:bottom`, 34)); // % высоты правой части
  const body = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !e.defaultPrevented && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const dragX = (e: RPE<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = body.current!.getBoundingClientRect();
    const mv = (ev: PointerEvent) => setLeftW(Math.min(65, Math.max(20, ((ev.clientX - rect.left) / rect.width) * 100)));
    const upFn = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', upFn);
      save(`${layoutKey}:left`, ((ev.clientX - rect.left) / rect.width) * 100);
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', upFn);
  };
  const dragY = (e: RPE<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = right.current!.getBoundingClientRect();
    const calc = (y: number) => Math.min(75, Math.max(12, ((rect.bottom - y) / rect.height) * 100));
    const mv = (ev: PointerEvent) => setBottomH(calc(ev.clientY));
    const upFn = (ev: PointerEvent) => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', upFn);
      save(`${layoutKey}:bottom`, calc(ev.clientY));
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', upFn);
  };

  return createPortal(
    <div className="ws" role="dialog" aria-modal="true" aria-label="Полноэкранный режим задачи">
      <div className="ws-top">
        <div className="ws-title">{title}</div>
        {tags}
        <span className="grow" />
        {actions}
        <button className="btn ghost small" onClick={onClose} title="Свернуть (Esc)">
          <I.shrink /> <span className="hide-sm">Свернуть</span>
        </button>
      </div>
      <div className="ws-body" ref={body} style={{ gridTemplateColumns: `${leftW}% 6px minmax(0, 1fr)` }}>
        <aside className="ws-left">{left}</aside>
        <div className="ws-split-x" onPointerDown={dragX} role="separator" aria-orientation="vertical" aria-label="Изменить ширину панелей" />
        <div className="ws-right" ref={right} style={{ gridTemplateRows: bottom ? `minmax(0, 1fr) 6px ${bottomH}%` : 'minmax(0, 1fr)' }}>
          <div className="ws-main">{main}</div>
          {bottom && (
            <>
              <div className="ws-split-y" onPointerDown={dragY} role="separator" aria-orientation="horizontal" aria-label="Изменить высоту вывода" />
              <div className="ws-bottom">{bottom}</div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
