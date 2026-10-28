type Row = { basis: string; values: string[]; b: string };

type State = {
  title: string;
  columns: string[];
  rows: Row[];
  objective: string[];
  note: string;
};

const states: State[] = [
  {
    title: 'Начальная таблица',
    columns: ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'],
    rows: [
      { basis: 'x₃', values: ['1', '3', '1', '0', '0'], b: '15' },
      { basis: 'x₄', values: ['1', '1', '0', '1', '0'], b: '7' },
      { basis: 'x₅', values: ['2', '1', '0', '0', '1'], b: '12' },
    ],
    objective: ['−2', '−3', '0', '0', '0'],
    note: 'Свободные x₁ и x₂ равны нулю. В базисе стоят балансовые переменные, поэтому план (0; 0) допустим.',
  },
  {
    title: 'Вводим x₂',
    columns: ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'],
    rows: [
      { basis: 'x₂', values: ['1/3', '1', '1/3', '0', '0'], b: '5' },
      { basis: 'x₄', values: ['2/3', '0', '−1/3', '1', '0'], b: '2' },
      { basis: 'x₅', values: ['5/3', '0', '−1/3', '0', '1'], b: '7' },
    ],
    objective: ['−1', '0', '1', '0', '0'],
    note: 'Самая отрицательная оценка у x₂. Отношения 15/3, 7/1, 12/1 равны 5, 7, 12: x₂ входит, x₃ выходит.',
  },
  {
    title: 'Оптимальная вершина',
    columns: ['x₁', 'x₂', 'x₃', 'x₄', 'x₅'],
    rows: [
      { basis: 'x₁', values: ['1', '0', '−1/2', '3/2', '0'], b: '3' },
      { basis: 'x₂', values: ['0', '1', '1/2', '−1/2', '0'], b: '4' },
      { basis: 'x₅', values: ['0', '0', '1/2', '−5/2', '1'], b: '2' },
    ],
    objective: ['0', '0', '1/2', '3/2', '0'],
    note: 'Все оценки неотрицательны. Оптимальный план: x₁ = 3, x₂ = 4, запас лака x₅ = 2, f = 18.',
  },
];

function table(state: State) {
  const head = `<tr><th>Базис</th>${state.columns.map((c) => `<th>${c}</th>`).join('')}<th>b</th></tr>`;
  const rows = state.rows.map((row) => `<tr><th>${row.basis}</th>${row.values.map((v) => `<td>${v}</td>`).join('')}<td class="rhs">${row.b}</td></tr>`).join('');
  const objective = `<tr class="objective"><th>Δ</th>${state.objective.map((v) => `<td>${v}</td>`).join('')}<td>—</td></tr>`;
  return `<table><thead>${head}</thead><tbody>${rows}${objective}</tbody></table>`;
}

function render(root: HTMLElement) {
  let index = 0;
  const draw = () => {
    const state = states[index];
    root.innerHTML = `<section class="simplex-demo"><div class="demo-head"><div><span class="eyebrow">Шаг ${index + 1} из ${states.length}</span><h2>${state.title}</h2></div><div class="demo-actions"><button data-dir="prev" ${index === 0 ? 'disabled' : ''}>Назад</button><button data-dir="next" ${index === states.length - 1 ? 'disabled' : ''}>Дальше</button></div></div><div class="table-wrap">${table(state)}</div><p class="demo-note">${state.note}</p><div class="demo-dots">${states.map((_, i) => `<button aria-label="Шаг ${i + 1}" class="${i === index ? 'on' : ''}" data-step="${i}"></button>`).join('')}</div></section>`;
    root.querySelectorAll<HTMLButtonElement>('[data-dir]').forEach((button) => button.addEventListener('click', () => { index += button.dataset.dir === 'next' ? 1 : -1; draw(); }));
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => button.addEventListener('click', () => { index = Number(button.dataset.step); draw(); }));
    window.parent.postMessage({ type: 'dojo:resize', height: root.scrollHeight }, '*');
  };
  draw();
}

window.addEventListener('message', (event) => {
  if (event.data?.type !== 'dojo:init') return;
  const root = document.getElementById('app');
  if (root) render(root);
}, { once: true });
