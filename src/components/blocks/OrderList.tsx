// Список с перетаскиванием на pointer-событиях (мышь, тач, перо) + кнопки ↑↓ и клавиатура.
import { KeyboardEvent, PointerEvent, ReactNode, useRef, useState } from 'react';
import { I } from '../ui/icons';

interface Props {
  order: number[];
  render: (item: number) => ReactNode;
  onMove: (from: number, to: number) => void;
  locked?: boolean;
}

export function OrderList({ order, render, onMove, locked }: Props) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ pos: number; startY: number; pointer: number } | null>(null);
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [dy, setDy] = useState(0);

  const down = (e: PointerEvent<HTMLDivElement>, pos: number) => {
    if (locked || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { pos, startY: e.clientY, pointer: e.pointerId };
    setDragPos(pos);
    setDy(0);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    let offset = e.clientY - d.startY;
    // Перешли середину соседа — меняемся местами и сдвигаем точку отсчёта на его высоту.
    const next = refs.current[d.pos + 1];
    const prev = refs.current[d.pos - 1];
    const gap = 6;
    if (offset > 0 && next && offset > next.offsetHeight / 2) {
      onMove(d.pos, d.pos + 1);
      d.startY += next.offsetHeight + gap;
      d.pos += 1;
      setDragPos(d.pos);
      offset = e.clientY - d.startY;
    } else if (offset < 0 && prev && -offset > prev.offsetHeight / 2) {
      onMove(d.pos, d.pos - 1);
      d.startY -= prev.offsetHeight + gap;
      d.pos -= 1;
      setDragPos(d.pos);
      offset = e.clientY - d.startY;
    }
    setDy(offset);
  };

  const up = () => {
    drag.current = null;
    setDragPos(null);
    setDy(0);
  };

  const key = (e: KeyboardEvent<HTMLDivElement>, pos: number) => {
    if (locked) return;
    if (e.key === 'ArrowUp' && pos > 0) {
      e.preventDefault();
      onMove(pos, pos - 1);
      requestAnimationFrame(() => refs.current[pos - 1]?.focus());
    } else if (e.key === 'ArrowDown' && pos < order.length - 1) {
      e.preventDefault();
      onMove(pos, pos + 1);
      requestAnimationFrame(() => refs.current[pos + 1]?.focus());
    }
  };

  return (
    <div className="order-list" role="list" aria-label="Перетащи строки или двигай стрелками ↑↓">
      {order.map((item, pos) => (
        <div
          key={item}
          ref={(el) => (refs.current[pos] = el)}
          role="listitem"
          tabIndex={locked ? -1 : 0}
          className={`order-item${dragPos === pos ? ' dragging' : ''}${locked ? ' locked' : ''}`}
          style={dragPos === pos ? { transform: `translateY(${dy}px)` } : undefined}
          onPointerDown={(e) => down(e, pos)}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={(e) => key(e, pos)}
        >
          {!locked && <I.grip className="grip" />}
          <span className="n">{pos + 1}</span>
          {render(item)}
          {!locked && (
            <span className="moves">
              <button className="icon-btn" onClick={() => onMove(pos, pos - 1)} disabled={pos === 0} aria-label="Выше">
                <I.chevron style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <button className="icon-btn" onClick={() => onMove(pos, pos + 1)} disabled={pos === order.length - 1} aria-label="Ниже">
                <I.chevron style={{ transform: 'rotate(90deg)' }} />
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
