const style = `
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #20242b; font: 14px/1.5 system-ui, sans-serif; }
    #app { padding: 16px; }
    .lp { display: grid; gap: 14px; }
    .lp-head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
    .eyebrow { color: #68707d; font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
    h2 { font-size: 19px; line-height: 1.2; margin: 3px 0 0; }
    p { margin: 0; }
    button { appearance: none; border: 1px solid #c7ccd4; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; font: inherit; padding: 6px 10px; }
    button:hover:not(:disabled) { border-color: #536dca; background: #edf1ff; }
    button:focus-visible { outline: 2px solid #536dca; outline-offset: 2px; }
    button:disabled { cursor: default; opacity: .45; }
    .actions, .choices { display: flex; flex-wrap: wrap; gap: 7px; }
    .choices button.on { border-color: #536dca; background: #edf1ff; font-weight: 650; }
    .note { border-left: 3px solid #536dca; background: #edf1ff; padding: 10px 12px; }
    .formula, table { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .formula { overflow: auto; border: 1px solid #d8dce3; border-radius: 6px; background: #f8f9fb; padding: 10px 12px; white-space: pre-wrap; }
    .table-wrap { overflow: auto; }
    table { border-collapse: collapse; font-size: 13px; min-width: 480px; width: 100%; }
    th, td { border: 1px solid #c7ccd4; padding: 7px 9px; text-align: center; }
    th { background: #f1f3f5; font-weight: 650; }
    .mark { background: #edf1ff; font-weight: 650; }
    .svg { width: 100%; max-width: 540px; height: auto; border: 1px solid #d8dce3; border-radius: 6px; background: #fafbfc; }
    .svg text { fill: #20242b; font: 12px system-ui, sans-serif; }
    .svg .axis, .svg .line { stroke: #596271; stroke-width: 1.5; fill: none; }
    .svg .secondary { stroke: #9ca3af; stroke-dasharray: 4 3; }
    .svg .area { fill: #536dca; opacity: .15; }
    .svg .point { fill: #536dca; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; }
    .card { border: 1px solid #d8dce3; border-radius: 6px; padding: 10px; }
    .card strong { display: block; margin-bottom: 3px; }
    @media (prefers-color-scheme: dark) {
      body { color: #e5e7eb; background: #161a21; }
      .formula, .svg { background: #1c222c; border-color: #4a5362; }
      th { background: #232a35; }
      th, td, button { border-color: #4a5362; }
      .note, button:hover:not(:disabled), .choices button.on { background: #222c43; border-color: #768ce4; }
      .svg text { fill: #e5e7eb; }
      .svg .axis, .svg .line { stroke: #bec5d0; }
    }
  </style>`;

function resize(root) {
  window.parent.postMessage({ type: 'dojo:resize', height: root.scrollHeight }, '*');
}

function shell(title, body, eyebrow = 'Интерактивный разбор') {
  return `${style}<section class="lp"><div class="lp-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2></div></div>${body}</section>`;
}

function table(head, rows, marked) {
  return `<div class="table-wrap"><table><thead><tr>${head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((row, rowIndex) => `<tr>${row.map((cell, colIndex) => `<td class="${marked?.row === rowIndex && marked?.col === colIndex ? 'mark' : ''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function paged(root, title, states) {
  let index = 0;
  const draw = () => {
    const state = states[index];
    root.innerHTML = shell(title, `<div class="eyebrow">Шаг ${index + 1} из ${states.length} · ${state.label}</div>${state.body}<div class="actions"><button data-nav="prev" ${index === 0 ? 'disabled' : ''}>Назад</button><button data-nav="next" ${index === states.length - 1 ? 'disabled' : ''}>Дальше</button></div>`);
    root.querySelector('[data-nav="prev"]')?.addEventListener('click', () => { index--; draw(); });
    root.querySelector('[data-nav="next"]')?.addEventListener('click', () => { index++; draw(); });
    resize(root);
  };
  draw();
}

function slau(root) {
  paged(root, 'Система уравнений на плоскости', [
    { label: 'Одно уравнение', body: `<p>Одно линейное уравнение с двумя неизвестными задаёт прямую: решений бесконечно много.</p><div class="formula">x₁ + x₂ = 4</div><svg class="svg" viewBox="0 0 420 190"><path class="axis" d="M36 158H400M54 176V14"/><path class="line" d="M70 38L360 142"/><text x="350" y="176">x₁</text><text x="18" y="24">x₂</text><text x="278" y="105">x₁ + x₂ = 4</text></svg>` },
    { label: 'Одно решение', body: `<p>Две непараллельные прямые пересекаются в одной точке: это единственное решение системы.</p><div class="formula">x₁ + x₂ = 4
x₁ − x₂ = 0

x₁ = x₂ = 2</div><svg class="svg" viewBox="0 0 420 190"><path class="axis" d="M36 158H400M54 176V14"/><path class="line" d="M70 38L360 142"/><path class="line secondary" d="M70 142L360 38"/><circle class="point" cx="215" cy="90" r="5"/><text x="220" y="82">(2; 2)</text></svg>` },
    { label: 'Нет или бесконечно много', body: `<div class="cards"><div class="card"><strong>Параллельные</strong>x₁+x₂=4 и x₁+x₂=6: общей точки нет.</div><div class="card"><strong>Совпадающие</strong>x₁+x₂=4 и 2x₁+2x₂=8: это одна прямая, решений бесконечно много.</div></div><div class="note">Перед переходом к базисам важно увидеть: число записанных строк ещё не равно числу независимых условий.</div>` },
  ]);
}

function rank(root) {
  let reduced = false;
  const draw = () => {
    const matrix = reduced ? `1   2 | 5\n0   0 | 0` : `1   2 | 5\n2   4 | 10`;
    root.innerHTML = shell('Ранг показывает число независимых строк', `<p>Вторая строка равна удвоенной первой. Преобразование Гаусса это делает видимым.</p><div class="formula">${matrix}</div><div class="note">${reduced ? 'Осталась одна ненулевая строка: ранг системы равен 1.' : 'Пока видно две строки, но независимое условие только одно.'}</div><div class="actions"><button data-action="reduce">${reduced ? 'Вернуть исходную матрицу' : 'Вычесть 2 × первую строку'}</button></div>`);
    root.querySelector('[data-action="reduce"]')?.addEventListener('click', () => { reduced = !reduced; draw(); });
    resize(root);
  };
  draw();
}

function basis(root) {
  paged(root, 'От базиса к вершине', [
    { label: 'Выбираем свободные', body: `<p>В мастерской 3 независимых уравнения и 5 переменных. Значит, 2 переменные можно сделать свободными и приравнять нулю.</p><div class="formula">n = 5, r = 3 → n − r = 2 свободные переменные</div>` },
    { label: 'Находим остальные', body: `<p>Если свободны x₁ и x₂, то x₁=x₂=0. Система сразу даёт базисные значения x₃=15, x₄=7, x₅=12.</p>${table(['базис', 'значение'], [['x₃', '15'], ['x₄', '7'], ['x₅', '12']])}` },
    { label: 'Проверяем допустимость', body: `<p>Все пять значений неотрицательны. Это опорное решение — геометрически вершина ОДР.</p><div class="note">Если среди значений есть отрицательное, базисное решение существует, но опорным не является.</div>` },
  ]);
}

const basisCases = [
  { label: 'x₁=x₂=0', point: '(0; 0; 15; 7; 12)', note: 'Начальная вершина O: все балансовые переменные положительны.' },
  { label: 'x₃=x₄=0', point: '(3; 4; 0; 0; 2)', note: 'Вершина C: доски и время израсходованы полностью.' },
  { label: 'x₄=x₅=0', point: '(5; 2; 4; 0; 0)', note: 'Вершина, где полностью израсходованы время и лак.' },
  { label: 'x₃=x₅=0', point: '(21/5; 18/5; 0; −4/5; 0)', note: 'Есть отрицательное x₄: это базисное, но не опорное решение.' },
];

function picker(root) {
  let selected = 0;
  const draw = () => {
    const item = basisCases[selected];
    root.innerHTML = shell('Выбери свободные переменные', `<p>Нажми пару, которую приравняем нулю. Остальные три переменные найдём из системы.</p><div class="choices">${basisCases.map((value, index) => `<button class="${index === selected ? 'on' : ''}" data-case="${index}">${value.label}</button>`).join('')}</div><div class="formula">x = ${item.point}</div><div class="note">${item.note}</div>`);
    root.querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', () => { selected = Number(button.dataset.case); draw(); }));
    resize(root);
  };
  draw();
}

function basisPlane(root) {
  let show = false;
  const draw = () => {
    const extra = show ? table(['(x₁; x₂)', '(x₁; x₂; x₃; x₄)'], [['(0; 0)', '(0; 0; 1; 2)'], ['(2; 0)', '(2; 0; 3; 0)'], ['(1/2; 3/2)', '(1/2; 3/2; 0; 0)'], ['(0; 1)', '(0; 1; 0; 1)']]) : `<p>Для задачи Б2 после выражения x₃ и x₄ получаются ограничения: −x₁+x₂≤1, x₁+x₂≤2, x₁,x₂≥0.</p>`;
    root.innerHTML = shell('Вершины множества X', `<svg class="svg" viewBox="0 0 420 220"><path class="axis" d="M42 180H390M56 198V18"/><path class="area" d="M56 180 L315 180 L186 51 L56 93 Z"/><path class="line" d="M56 93L186 51"/><path class="line" d="M186 51L315 180"/><circle class="point" cx="56" cy="180" r="4"/><circle class="point" cx="315" cy="180" r="4"/><circle class="point" cx="186" cy="51" r="4"/><circle class="point" cx="56" cy="93" r="4"/><text x="321" y="196">x₁</text><text x="25" y="28">x₂</text></svg>${extra}<div class="actions"><button data-show="1">${show ? 'Скрыть таблицу вершин' : 'Показать полные векторы вершин'}</button></div>`);
    root.querySelector('[data-show]')?.addEventListener('click', () => { show = !show; draw(); });
    resize(root);
  };
  draw();
}

function jordan(root, variant) {
  const data = variant === 'a'
    ? { head: ['базис', 'x₂', 'x₁', 'x₅', 'b'], rows: [['x₄', '0', '2', '−7/4', '2'], ['x₃', '−1', '−1', '−1/4', '0']], solution: 'Свободные x₂=x₁=x₅=0; базисные x₄=2, x₃=0. x=(0; 0; 0; 2; 0).' }
    : { head: ['базис', 'x₁', 'x₃', 'x₆', 'b'], rows: [['x₂', '−1', '2', '1/2', '6'], ['x₄', '3', '5', '−1/2', '5'], ['x₅', '1/2', '−3/2', '2', '4']], solution: 'Свободные x₁=x₃=x₆=0; базисные x₂=6, x₄=5, x₅=4. x=(0; 6; 0; 5; 4; 0).' };
  let answer = false;
  const draw = () => {
    root.innerHTML = shell(`Жорданова таблица: вариант ${variant}`, `${table(data.head, data.rows)}<p>Столбцы — свободные переменные, строки — базисные. Положи свободные переменные равными нулю.</p>${answer ? `<div class="note">${data.solution}</div>` : ''}<div class="actions"><button data-answer="1">${answer ? 'Скрыть ответ' : 'Проверить себя'}</button></div>`);
    root.querySelector('[data-answer]')?.addEventListener('click', () => { answer = !answer; draw(); });
    resize(root);
  };
  draw();
}

function graph(root) {
  paged(root, 'Графический метод: мастерская', [
    { label: 'Границы', body: `<p>Каждое ограничение заменяем равенством и строим прямую. Пересечение нужных полуплоскостей — ОДР.</p><div class="formula">x₁ + 3x₂ = 15
x₁ + x₂ = 7
2x₁ + x₂ = 12</div>` },
    { label: 'ОДР', body: `<p>Начало координат удовлетворяет всем ограничениям, поэтому выбираем стороны с началом координат.</p><svg class="svg" viewBox="0 0 420 230"><path class="axis" d="M42 192H400M56 208V16"/><path class="line secondary" d="M70 42L360 177"/><path class="line secondary" d="M70 75L340 188"/><path class="line secondary" d="M82 188L315 28"/><path class="area" d="M56 192 L266 192 L239 138 L159 75 L56 125 Z"/><text x="364" y="208">x₁</text><text x="20" y="26">x₂</text></svg>` },
    { label: 'Оптимум', body: `<p>Вектор c=(2;3) задаёт направление роста f. Последняя точка касания — C=(3;4).</p><div class="formula">f(3, 4) = 2·3 + 3·4 = 18</div><div class="note">Минимум в этой задаче достигается в O=(0;0): f=0.</div>` },
  ]);
}

const simplexStates = [
  { label: 'Начальная таблица', rows: [['x₃', '1', '3', '1', '0', '0', '15'], ['x₄', '1', '1', '0', '1', '0', '7'], ['x₅', '2', '1', '0', '0', '1', '12'], ['Δ', '−2', '−3', '0', '0', '0', '—']], note: 'Самая отрицательная оценка у x₂. Отношения: 15/3=5, 7/1=7, 12/1=12.' },
  { label: 'Первый поворот', rows: [['x₂', '1/3', '1', '1/3', '0', '0', '5'], ['x₄', '2/3', '0', '−1/3', '1', '0', '2'], ['x₅', '5/3', '0', '−1/3', '0', '1', '7'], ['Δ', '−1', '0', '1', '0', '0', '—']], note: 'x₂ вошла в базис, x₃ вышла. Теперь отрицательна только оценка x₁.' },
  { label: 'Оптимальная таблица', rows: [['x₁', '1', '0', '−1/2', '3/2', '0', '3'], ['x₂', '0', '1', '1/2', '−1/2', '0', '4'], ['x₅', '0', '0', '1/2', '−5/2', '1', '2'], ['Δ', '0', '0', '1/2', '3/2', '0', '—']], note: 'Все Δ≥0. Поэтому x₁=3, x₂=4, f=18 — оптимальный план.' },
];

function simplex(root) {
  let index = 0;
  const draw = () => {
    const state = simplexStates[index];
    root.innerHTML = shell('Симплекс-таблица', `<div class="eyebrow">Шаг ${index + 1} из ${simplexStates.length} · ${state.label}</div>${table(['базис', 'x₁', 'x₂', 'x₃', 'x₄', 'x₅', 'b'], state.rows, index === 0 ? { row: 3, col: 2 } : undefined)}<div class="note">${state.note}</div><div class="actions"><button data-nav="prev" ${index === 0 ? 'disabled' : ''}>Назад</button><button data-nav="next" ${index === simplexStates.length - 1 ? 'disabled' : ''}>Дальше</button></div>`);
    root.querySelector('[data-nav="prev"]')?.addEventListener('click', () => { index--; draw(); });
    root.querySelector('[data-nav="next"]')?.addEventListener('click', () => { index++; draw(); });
    resize(root);
  };
  draw();
}

function artificial(root) {
  paged(root, 'Метод искусственного базиса', [
    { label: 'Проблемная строка', body: `<p>Для ограничения «≥» после вычитания балансовой переменной единичного столбца в базисе нет.</p><div class="formula">x₁ + x₂ − x₃ = 4</div>` },
    { label: 'Фаза I', body: `<p>Добавляем искусственную переменную w и временно максимизируем отрицательную сумму искусственных переменных.</p><div class="formula">x₁ + x₂ − x₃ + w₁ = 4
F = −w₁ − … → max</div>` },
    { label: 'Решение', body: `<p>Если max F=0, все w удалось убрать: исходная задача допустима. Если max F<0, ограничения несовместны.</p><div class="note">После фазы I искусственные столбцы вычёркивают и возвращают исходную целевую функцию.</div>` },
  ]);
}

function dual(root) {
  let inverse = false;
  const draw = () => {
    const direct = inverse ? 'Двойственная' : 'Прямая';
    const other = inverse ? 'Прямая' : 'Двойственная';
    const left = inverse ? 'g = 15y₁ + 7y₂ + 12y₃ → min' : 'f = 2x₁ + 3x₂ → max';
    const right = inverse ? 'f = 2x₁ + 3x₂ → max' : 'g = 15y₁ + 7y₂ + 12y₃ → min';
    const constraints = inverse ? 'Aᵀy ≥ c, y ≥ 0' : 'Ax ≤ b, x ≥ 0';
    root.innerHTML = shell('Прямая и двойственная задачи', `<div class="cards"><div class="card"><strong>${direct}</strong><div class="formula">${left}\n${constraints}</div></div><div class="card"><strong>${other}</strong><div class="formula">${right}\n${inverse ? 'Ax ≤ b, x ≥ 0' : 'Aᵀy ≥ c, y ≥ 0'}</div></div></div><p>Столбцы A прямой становятся ограничениями двойственной, а правая часть b — коэффициентами её цели.</p><div class="note">Слабая двойственность: f(x)≤g(y). Если допустимые планы дают одинаковое значение, оба оптимальны.</div><div class="actions"><button data-switch="1">Поменять прямую и двойственную местами</button></div>`);
    root.querySelector('[data-switch]')?.addEventListener('click', () => { inverse = !inverse; draw(); });
    resize(root);
  };
  draw();
}

function dualSimplex(root) {
  paged(root, 'Двойственный симплекс-метод', [
    { label: 'Когда применять', body: `<p>Все оценки уже неотрицательны, но среди правых частей есть отрицательная. Обычный симплекс исправляет оценки; двойственный сначала исправляет план.</p>${table(['условие', 'обычный', 'двойственный'], [['старт', 'b≥0', 'Δ≥0'], ['выбор', 'отрицательная Δ', 'самое отрицательное b']])}` },
    { label: 'Выбор ведущего элемента', body: `<p>Берём строку с самым отрицательным b. В ней рассматриваем только отрицательные коэффициенты aᵢⱼ и выбираем столбец по минимуму Δⱼ/|aᵢⱼ|.</p><div class="formula">bᵣ = min bᵢ < 0
aᵣⱼ < 0 → min Δⱼ / |aᵣⱼ|</div>` },
    { label: 'Остановка', body: `<p>Когда все b≥0, допустимый план восстановлен; Δ≥0 сохранялись, значит план оптимален.</p><div class="note">Если в выбранной строке нет отрицательного коэффициента, восстановить допустимость нельзя: система несовместна.</div>` },
  ]);
}

function render(root, scene) {
  switch (scene) {
    case 'slau': return slau(root);
    case 'rank': return rank(root);
    case 'basis': return basis(root);
    case 'picker': return picker(root);
    case 'basis-plane': return basisPlane(root);
    case 'jordan-a': return jordan(root, 'a');
    case 'jordan-b': return jordan(root, 'b');
    case 'graph': return graph(root);
    case 'simplex': return simplex(root);
    case 'artificial': return artificial(root);
    case 'dual': return dual(root);
    case 'dual-simplex': return dualSimplex(root);
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type !== 'dojo:init') return;
  const root = document.getElementById('app');
  const scene = event.data.props?.scene;
  if (root && scene) render(root, scene);
}, { once: true });
