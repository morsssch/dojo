// Формулы в статьях: KaTeX, грузится лениво — только когда на странице есть формулы.
// Поддерживаются $…$ / $$…$$ в Markdown (remark-math → .math-tex) и \(…\) / \[…\] где угодно в HTML.
type Katex = typeof import('katex').default;
type AutoRender = (el: HTMLElement, opts: Record<string, unknown>) => void;

let loading: Promise<{ katex: Katex; auto: AutoRender }> | null = null;
function loadKatex() {
  loading ??= Promise.all([import('katex'), import('katex/contrib/auto-render'), import('katex/dist/katex.min.css')]).then(([k, a]) => ({ katex: k.default, auto: (a as unknown as { default: AutoRender }).default }));
  return loading;
}

const OPTS = { throwOnError: false, strict: false, trust: false } as const;
const DELIMS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
];

const hasMath = (el: Element) => !!el.querySelector('.math-tex') || /\\\(|\\\[|\$\$/.test(el.textContent ?? '');

/** Отрисовать все формулы внутри элемента (можно вызывать повторно — уже отрисованные пропускаются). */
export async function typeset(el: Element | null | undefined) {
  if (!el || !hasMath(el)) return;
  const { katex, auto } = await loadKatex();
  el.querySelectorAll<HTMLElement>('.math-tex:not([data-done])').forEach((m) => {
    katex.render(m.textContent ?? '', m, { ...OPTS, displayMode: m.dataset.display === 'true' });
    m.dataset.done = '1';
  });
  auto(el as HTMLElement, { ...OPTS, delimiters: DELIMS, ignoredClasses: ['katex', 'math-tex'], ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option', 'input'] });
}

/** Одна формула в элемент (замена MathJax.tex2svg). Пока KaTeX грузится — текстом. */
export function tex(el: HTMLElement, src: string, display = false) {
  if (!loading) el.textContent = src;
  loadKatex().then(({ katex }) => katex.render(src, el, { ...OPTS, displayMode: display }));
}
export const preloadMath = () => void loadKatex();
