import type { ArticleCtx } from '../../src/articles/runtime';
import cards from './cards.json';

type State = { queue: number[]; index: number; marks: Record<number, 'know' | 'again'> };
const fresh = (): State => ({ queue: cards.map(c => c.id), index: 0, marks: {} });

export function mount(el: HTMLElement, _props: Record<string, unknown>, ctx: ArticleCtx) {
  let state = ctx.store.get<State>('progress-v1', fresh());
  if (!state || !Array.isArray(state.queue) || !state.queue.length ||
      !state.queue.every(id => cards.some(c => c.id === id)) ||
      !Number.isInteger(state.index) || state.index < 0 || state.index > state.queue.length ||
      !state.marks || typeof state.marks !== 'object') state = fresh();
  let revealed = false;
  let drag: { id: number; x: number; y: number; dx: number } | null = null;
  const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const save = () => ctx.store.set('progress-v1', state);
  const mark = (value: 'know' | 'again') => {
    if (!revealed || state.index >= state.queue.length) return;
    state.marks[state.queue[state.index]] = value;
    state.index++;
    revealed = false;
    save();
    draw(true);
  };
  const reset = (repeat: boolean) => {
    const queue = repeat ? cards.filter(c => state.marks[c.id] === 'again').map(c => c.id) : cards.map(c => c.id);
    if (!queue.length) return;
    state = { queue, index: 0, marks: repeat ? state.marks : {} };
    revealed = false;
    save();
    draw(true);
  };
  const draw = (focus = false) => {
    drag = null;
    const known = cards.filter(c => state.marks[c.id] === 'know').length;
    const again = cards.filter(c => state.marks[c.id] === 'again').length;
    const current = cards.find(c => c.id === state.queue[state.index]);
    el.innerHTML = `<section class="dbf-deck" aria-label="Карточки по базам данных">
      <p class="dbf-status" role="status" aria-live="polite">Помню: ${known} из ${cards.length}. Повторить: ${again}. ${current ? `В проходе: ${state.index + 1} из ${state.queue.length}.` : 'Проход завершён.'}</p>
      ${current ? `<article class="dbf-card" tabindex="0" aria-label="Вопрос ${current.id}" aria-describedby="dbf-help">
        <p class="dbf-number">Вопрос ${current.id} из 33</p>
        <h3>${esc(current.q)}</h3>
        ${revealed ? `<div class="dbf-answer"><p class="dbf-label">Образец полного ответа</p>${current.id === 12 ? '<pre class="dbf-diagram" aria-label="Связи библиотеки">Читатель 1 ── N Выдача N ── 1 Книга</pre>' : ''}${current.a.split('\n\n').map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')}<p><a href="#/c/db-colloquium-1/${current.lesson}">Разобрать тему в курсе</a></p></div>` : '<p class="dbf-prompt">Ответь по памяти: определение, основные пункты, пример.</p>'}
      </article>
      <p id="dbf-help" class="dbf-help">${revealed ? 'Смахни влево — не помню, вправо — помню. Или используй кнопки.' : 'Сначала вспомни ответ, затем открой образец для проверки.'}</p>
      <div class="dbf-actions"><button type="button" class="btn" data-action="again" ${revealed ? '' : 'disabled'}>← Не помню</button><button type="button" class="btn primary" data-action="reveal" ${revealed ? 'disabled' : ''}>Показать ответ</button><button type="button" class="btn" data-action="know" ${revealed ? '' : 'disabled'}>Помню →</button></div>` : `<div class="dbf-result" tabindex="-1"><h3>Проход завершён</h3><p>${again ? `Осталось повторить ${again} из 33 вопросов. Вернись к ним и попробуй снова без подсказок.` : 'Отлично. Теперь выбери три вопроса и напиши ответы на бумаге без подсказок.'}</p><div class="dbf-actions"><button type="button" class="btn primary" data-action="repeat" ${again ? '' : 'disabled'}>Повторить забытое (${again})</button><button type="button" class="btn" data-action="reset">Все 33 заново</button></div></div>`}
    </section>`;
    if (focus) el.querySelector<HTMLElement>('.dbf-card, .dbf-result')?.focus({ preventScroll: true });
  };
  // Delegation keeps one set of listeners across card changes; ctx removes them on unmount.
  ctx.on(el, 'click', ((e: MouseEvent) => {
    const action = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!action || action.disabled) return;
    if (action.dataset.action === 'reveal') { revealed = true; draw(true); }
    if (action.dataset.action === 'again') mark('again');
    if (action.dataset.action === 'know') mark('know');
    if (action.dataset.action === 'repeat') reset(true);
    if (action.dataset.action === 'reset') reset(false);
  }) as EventListener);
  ctx.on(el, 'keydown', ((e: KeyboardEvent) => {
    if (!(e.target as HTMLElement).matches('.dbf-card')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); mark(e.key === 'ArrowLeft' ? 'again' : 'know'); }
    if ((e.key === 'Enter' || e.key === ' ') && !revealed) { e.preventDefault(); revealed = true; draw(true); }
  }) as EventListener);
  ctx.on(el, 'pointerdown', ((e: PointerEvent) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.dbf-card');
    if (!card || !revealed || !e.isPrimary || e.button !== 0 || target.closest('a,button')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0 };
  }) as EventListener);
  ctx.on(el, 'pointermove', ((e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    const card = el.querySelector<HTMLElement>('.dbf-card')!;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) { card.style.transform = ''; drag = null; return; }
    drag.dx = dx;
    if (Math.abs(dx) > 12) {
      if (!card.hasPointerCapture(e.pointerId)) card.setPointerCapture(e.pointerId);
      card.style.transform = `translateX(${Math.max(-100, Math.min(100, dx))}px)`;
      card.dataset.direction = dx < -60 ? 'again' : dx > 60 ? 'know' : '';
    }
  }) as EventListener);
  const cancel = () => {
    const card = el.querySelector<HTMLElement>('.dbf-card');
    if (card) { card.style.transform = ''; delete card.dataset.direction; }
    drag = null;
  };
  ctx.on(el, 'pointerup', ((e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = drag.dx;
    cancel();
    if (Math.abs(dx) >= 70) mark(dx > 0 ? 'know' : 'again');
  }) as EventListener);
  ctx.on(el, 'pointercancel', cancel);
  ctx.on(el, 'lostpointercapture', ((e: PointerEvent) => {
    // Touch starts with implicit capture on a text child. Transferring it to the
    // card must not cancel the gesture when that child loses capture.
    if ((e.target as HTMLElement).matches('.dbf-card')) cancel();
  }) as EventListener);
  draw();
}
