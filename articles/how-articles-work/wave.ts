// Интерактивный блок: синусоида с ползунками и анимацией фазы. Образец для авторов статей.
import type { ArticleCtx } from '../../src/articles/runtime';

export function wave(el: HTMLElement, props: Record<string, unknown>, ctx: ArticleCtx) {
  const st = ctx.store.get('wave', { a: Number(props.amplitude ?? 1), k: 2 });
  el.innerHTML = `
    <div class="wave">
      <svg viewBox="0 0 400 160" role="img" aria-label="График y = a·sin(kx + φ)"><line class="ax" x1="0" y1="80" x2="400" y2="80"/><path class="ln"/></svg>
      <div class="wave-controls">
        <label>a <input type="range" min="0.2" max="2" step="0.1" data-k="a" value="${st.a}"></label>
        <label>k <input type="range" min="1" max="6" step="1" data-k="k" value="${st.k}"></label>
        <button class="btn small" type="button">Пауза</button>
      </div>
      <div class="wave-f"></div>
    </div>`;
  const path = el.querySelector<SVGPathElement>('.ln')!;
  const f = el.querySelector<HTMLElement>('.wave-f')!;
  const btn = el.querySelector('button')!;
  let phase = 0;
  let playing = !ctx.reducedMotion;
  const draw = () => {
    let d = '';
    for (let x = 0; x <= 400; x += 4) d += `${x ? 'L' : 'M'}${x},${(80 - st.a * 30 * Math.sin((x / 400) * Math.PI * 2 * st.k + phase)).toFixed(1)}`;
    path.setAttribute('d', d);
  };
  const formula = () => ctx.tex(f, `y = ${st.a}\\cdot\\sin(${st.k}x + \\varphi)`, true);
  el.querySelectorAll<HTMLInputElement>('input').forEach((inp) =>
    inp.addEventListener('input', () => {
      st[inp.dataset.k as 'a' | 'k'] = Number(inp.value);
      ctx.store.set('wave', st);
      draw();
      formula();
    }),
  );
  btn.textContent = playing ? 'Пауза' : 'Пуск';
  btn.addEventListener('click', () => {
    playing = !playing;
    btn.textContent = playing ? 'Пауза' : 'Пуск';
  });
  let raf = 0;
  const tick = () => {
    if (playing) {
      phase += 0.04;
      draw();
    }
    raf = requestAnimationFrame(tick);
  };
  draw();
  formula();
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
