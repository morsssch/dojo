import { compareMealy, numberWord, refineMealy, wordNumber } from './learning.js';
import { buildPatternMachine, runPatternMachine } from './pattern.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));
const answer = text => '<p class="ansbox">' + escape(text) + '</p>';
function table(headers, rows) {
  const row = (cells, tag) => '<tr>' + cells.map(cell =>
    '<' + tag + '>' + escape(cell) + '</' + tag + '>'
  ).join('') + '</tr>';
  return '<div class="tscroll"><table class="dt"><thead>' + row(headers, 'th') +
    '</thead><tbody>' + rows.map(cells => row(cells, 'td')).join('') + '</tbody></table></div>';
}

export function parseMealy(text) {
  const states = new Set();
  const alphabet = new Set();
  const transitions = Object.create(null);
  let start;
  for (const [index, raw] of text.split('\n').entries()) {
    const line = raw.split('#', 1)[0].trim();
    if (!line) continue;
    const initial = /^(?:начало|старт|start)\s*:\s*([\p{L}\p{N}_]{1,16})$/iu.exec(line);
    if (initial) {
      if (start !== undefined) throw Error('Укажи только одно начальное состояние.');
      start = initial[1];
      continue;
    }
    const match = /^([\p{L}\p{N}_]{1,16})\s+([\p{L}\p{N}])\s+([\p{L}\p{N}_]{1,16})\s+([\p{L}\p{N}])$/u.exec(line);
    if (!match) throw Error('Строка ' + (index + 1) + ': введи «откуда вход куда выход», например q0 0 q1 a.');
    const [, from, input, to, output] = match;
    const row = transitions[from] ??= Object.create(null);
    if (Object.hasOwn(row, input)) throw Error('Два перехода из ' + from + ' по ' + input + '.');
    row[input] = [to, output];
    states.add(from);
    states.add(to);
    alphabet.add(input);
  }
  if (!states.size) throw Error('Введи хотя бы один переход.');
  if (states.size > 16 || alphabet.size > 8) throw Error('Допустимо до 16 состояний и 8 входных символов.');
  if (start !== undefined && !states.has(start)) throw Error('Начальное состояние ' + start + ' отсутствует в переходах.');
  const alpha = [...alphabet].sort();
  for (const q of states) for (const x of alpha) {
    if (!transitions[q]?.[x]) throw Error('Добавь переход из ' + q + ' по ' + x + '. Нужна полная таблица Мили.');
  }
  return { start, alpha, table: transitions };
}

function reachable(start, next) {
  const words = new Map([[start, '']]);
  for (const [state, word] of words) {
    for (const [input, to] of next(state)) {
      if (!words.has(to)) words.set(to, word + input);
    }
  }
  return words;
}

const groupNames = part => Object.fromEntries(
  part.flatMap((group, index) => group.map(q => [q, 'C' + index]))
);

function labeledGraph(m, mkG) {
  const states = Object.keys(m.table);
  if (states.length > 12 || states.length * m.alpha.length > 36) return {};
  const nodes = states.map((q, i) => [q, (i % 4) * 180, Math.floor(i / 4) * 150, q === m.start ? 's' : '']);
  const g = mkG(nodes, []);
  for (const from of states) for (const input of m.alpha) {
    const [to, output] = m.table[from][input];
    g.edges.push({ id: 'e' + g.edges.length, from, to, re: { t: 'sym', v: input + '/' + output } });
  }
  return { g };
}

function minimize(m, mkG) {
  const states = Object.keys(m.table);
  const live = m.start === undefined ? states : [...reachable(m.start, q => m.alpha.map(x => [x, m.table[q][x][0]])).keys()];
  const removed = states.filter(q => !live.includes(q));
  const active = { ...m, table: Object.fromEntries(live.map(q => [q, m.table[q]])) };
  const history = refineMealy(active);
  const partition = history.at(-1);
  const cls = groupNames(partition);
  const quotient = {
    alpha: m.alpha,
    start: cls[m.start],
    table: Object.fromEntries(partition.map(([q]) => [cls[q], Object.fromEntries(m.alpha.map(x => {
      const [to, output] = m.table[q][x];
      return [x, [cls[to], output]];
    }))])),
  };
  const rows = partition.map(group => {
    const q = cls[group[0]];
    return [(q === quotient.start ? '→' : '') + q, group.join(', '), ...m.alpha.map(x => quotient.table[q][x].join(' / '))];
  });
  return [
    {
      title: 'Достижимость и начальное разбиение',
      html: table(['Состояние', 'Класс', ...m.alpha.map(x => 'Выход по ' + x)],
        live.map(q => [q, groupNames(history[0])[q], ...m.alpha.map(x => m.table[q][x][1])])),
      text: '<p>' + (m.start === undefined ? 'Начало не задано, поэтому рассматриваем все состояния.' :
        removed.length ? 'Удалили недостижимые: ' + escape(removed.join(', ')) + '.' : 'Все состояния достижимы.') +
        ' Объединяем строки с одинаковыми выходами.</p>',
    },
    ...history.slice(1).map((part, i) => {
      const before = groupNames(history[i]), after = groupNames(part);
      return {
        title: 'Уточнение ' + (i + 1),
        html: table(['Состояние', 'Старый класс', ...m.alpha.map(x => 'Класс назначения по ' + x), 'Новый класс'],
          live.map(q => [q, before[q], ...m.alpha.map(x => before[m.table[q][x][0]]), after[q]])),
        text: '<p>' + (part.length === history[i].length ? 'Классы больше не делятся.' :
          'Внутри каждого старого класса разделили состояния с разными классами назначения.') + '</p>',
      };
    }),
    {
      title: 'Минимальный преобразователь',
      ...labeledGraph(quotient, mkG),
      text: answer('Состояний: ' + partition.length) + table(['Класс', 'Содержит', ...m.alpha], rows),
    },
  ].map(step => step.g || step.html ? step : { ...step, html: step.text, text: '' });
}

export function product(a, b) {
  if (a.start === undefined || b.start === undefined) throw Error('Укажи «начало: …» для обоих автоматов.');
  const comparison = compareMealy(a, b);
  const key = (q, s) => JSON.stringify([q, s]);
  const rows = new Map();
  for (const q of Object.keys(a.table)) for (const s of Object.keys(b.table)) {
    rows.set(key(q, s), a.alpha.map(input => {
      const [toA, outA] = a.table[q][input], [toB, outB] = b.table[s][input];
      return { input, to: key(toA, toB), outputs: [outA, outB] };
    }));
  }
  const start = key(a.start, b.start);
  const words = reachable(start, pair => rows.get(pair).map(({ input, to }) => [input, to]));
  return { start, rows, words, comparison };
}

function comparisonSteps(a, b, mkG) {
  const { start, rows, words, comparison } = product(a, b);
  const label = pair => '(' + JSON.parse(pair).join(', ') + ')';
  const headers = ['Пара', ...a.alpha, 'Вход из старта'];
  const row = ([pair, edges]) => [
    (pair === start ? '→' : '') + label(pair),
    ...edges.map(e => label(e.to) + ' / (' + e.outputs.join(', ') + ')'),
    words.has(pair) ? words.get(pair) || 'ε' : '—',
  ];
  const live = [...words.keys()];
  const names = new Map(live.map((pair, i) => [pair, 'P' + i]));
  const graph = labeledGraph({
    start: names.get(start),
    alpha: a.alpha,
    table: Object.fromEntries(live.map(pair => [names.get(pair), Object.fromEntries(rows.get(pair).map(e =>
      [e.input, [names.get(e.to), '(' + e.outputs.join(',') + ')']]
    ))])),
  }, mkG);
  const summary = comparison.equal ? 'Автоматы эквивалентны' :
    'Автоматы неэквивалентны. Кратчайший вход: ' + comparison.word;
  const finalRows = live.map(pair => [names.get(pair), ...row([pair, rows.get(pair)])]);
  let trace = '';
  if (!comparison.equal) {
    let pair = start;
    const outputA = [], outputB = [];
    const steps = Array.from(comparison.word, input => {
      const edge = rows.get(pair).find(e => e.input === input);
      const cells = [label(pair), input, label(edge.to), ...edge.outputs];
      outputA.push(edge.outputs[0]);
      outputB.push(edge.outputs[1]);
      pair = edge.to;
      return cells;
    });
    trace = table(['Из пары', 'Вход', 'В пару', 'Выход A', 'Выход B'], steps) +
      '<p>Выход A: ' + escape(outputA.join('')) + '. Выход B: ' + escape(outputB.join('')) + '.</p>';
  }
  return [
    { title: 'Полное прямое произведение', html: table(headers, [...rows].map(row)),
      text: '<p>Заполняем все пары. В клетке указаны пара назначения и два выхода на одном входном символе.</p>' },
    { title: 'Оставляем достижимые пары', ...graph,
      ...(graph.g ? {} : { html: table(['Имя', ...headers], finalRows) }),
      text: '<p>Достижимых пар: ' + live.length + ' из ' + rows.size + '.</p>' +
        (graph.g ? table(['Имя', ...headers], finalRows) : '') },
    { title: 'Сравниваем выходы', html: answer(summary) + trace,
      text: '<p>' + (comparison.equal ? 'Выходы совпали на всех переходах из достижимых пар.' :
        'До последней буквы выходы совпадают. На последней букве они расходятся.') + '</p>' },
  ];
}

function patternSteps(pattern, word, mkG) {
  const machine = buildPatternMachine(pattern);
  const run = runPatternMachine(machine, word);
  const alpha = ['A', 'B'];
  const m = {
    start: 'q0', alpha,
    table: Object.fromEntries(machine.table.map((row, i) => ['q' + i,
      Object.fromEntries(alpha.map(x => [x, ['q' + row[x].next, row[x].output]]))])),
  };
  const steps = machine.table.map((row, i) => ({
    title: 'Переходы из q' + i,
    html: table(['Вход', 'Память + буква', 'Новая память', 'Куда', 'Выход'], alpha.map(x => {
      const { candidate, next, output } = row[x];
      return [x, candidate, pattern.slice(0, next) || 'ε', 'q' + next, output];
    })),
    text: '<p>Память q' + i + ' — «' + (pattern.slice(0, i) || 'ε') +
      '». Выход X появляется при полном совпадении. Затем сохраняем самый длинный хвост, который начинает образец.</p>',
  }));
  const graph = labeledGraph(m, mkG);
  const result = table(['Состояние', 'Память', ...alpha], Object.keys(m.table).map((q, i) =>
    [(i === 0 ? '→' : '') + q, pattern.slice(0, i) || 'ε', ...alpha.map(x => m.table[q][x].join(' / '))]
  )) + answer('Выход для ' + (word || 'ε') + ': ' + (run.output || 'ε')) +
    (run.steps.length ? table(['Шаг', 'Вход', 'Из', 'В', 'Выход'],
      run.steps.map(s => [s.index + 1, s.input, 'q' + s.from, 'q' + s.to, s.output])) : '');
  return [...steps, { title: 'Готовый преобразователь Мили', ...graph,
    ...(graph.g ? { text: result } : { html: result, text: '' }) }];
}

export function mountCalculator(root, ctx, engine) {
  const { Stepper, mkG, parseAutomaton, regexSteps, elimSteps, clearDetSteps, minSteps } = engine;
  const get = id => root.querySelector('#calc-' + id);
  const select = get('kind'), form = get('form'), fields = get('fields');
  const result = get('result'), player = get('player'), jump = get('answer');
  let replay;
  let lastStep;
  const dfa = 'начало: q0\nфинал: q3\nq0 a q1\nq0 b q2\nq1 a q1\nq1 b q3\nq2 a q2\nq2 b q3\nq3 a,b q3';
  const nfa = 'начало: q0\nфинал: q2\nq0 eps q1\nq0 b q2\nq1 a q0\nq1 a q2\nq1 b q1\nq2 eps q1';
  const mealyA = 'начало: q0\nq0 0 q0 a\nq0 1 q1 b\nq1 0 q1 b\nq1 1 q0 a';
  const mealyB = 'начало: s0\ns0 0 s1 a\ns0 1 s2 b\ns1 0 s0 a\ns1 1 s2 b\ns2 0 s2 b\ns2 1 s1 b';
  const modes = {
    rank: { fields: [['Алфавит по порядку, без пробелов', 'abcd'], ['Слово (ε для пустого)', 'ccabd']], solve: ([a, w]) => {
      const r = wordNumber(a, w);
      return { html: table(['N до', 'Буква', 'Её номер', 'N после'], r.rows) + answer('Номер: ' + r.value) };
    } },
    unrank: { fields: [['Алфавит по порядку, без пробелов', 'abc'], ['Номер слова', '689']], solve: ([a, n]) => {
      const r = numberWord(a, n);
      return { html: table(['N до', 'Номер буквы', 'Буква справа', 'N после'], r.rows) +
        '<p>Читаем буквы снизу вверх.</p>' + answer('Слово: ' + r.value) };
    } },
    r2a: { fields: [['Регулярное выражение', '(a+b)*ab']], solve: ([r]) => ({ steps: regexSteps(r) }) },
    a2r: { hint: 'Переходы: «откуда метка куда». Для ε напиши eps. Порядок удаления можно задать строкой «порядок: q0 q1».',
      fields: [['Автомат', 'начало: q0\nфинал: q1\nq0 a q0\nq0 b q1\nq1 b q1', true]],
      solve: ([raw]) => { const { g, order } = readGraph(raw); return { steps: elimSteps(g, order) }; } },
    det: { hint: 'Переходы: «откуда буква куда». Для ε напиши eps. Если слово не задано, будет только построение.',
      fields: [['Автомат', nfa, true], ['Слово для проверки (ε для пустого)', 'bb']],
      solve: ([raw, word]) => ({ steps: clearDetSteps(readGraph(raw).g, word || undefined, { complete: true }) }) },
    dfa: { hint: 'Переходы: «откуда буква куда». Метка a,b означает два перехода. Для автомата без финалов убери строку «финал».',
      fields: [['Распознаватель', dfa, true]], solve: ([raw]) => ({ steps: minSteps(readGraph(raw).g) }) },
    mealy: { hint: 'Одна строка на переход: «откуда вход куда выход». При заданном начале недостижимые состояния удаляются.',
      fields: [['Преобразователь Мили', 'начало: q0\nq0 a q1 0\nq0 b q2 1\nq1 a q0 0\nq1 b q2 1\nq2 a q2 1\nq2 b q0 0', true]],
      solve: ([raw]) => ({ steps: minimize(parseMealy(raw), mkG) }) },
    compare: { hint: 'В обоих автоматах укажи «начало: …». Переходы: «откуда вход куда выход». Входные алфавиты должны совпадать.',
      fields: [['Автомат A', mealyA, true], ['Автомат B', mealyB, true]],
      solve: ([a, b]) => ({ steps: comparisonSteps(parseMealy(a), parseMealy(b), mkG) }) },
    pattern: { hint: 'Мили выдаёт X, когда образец завершился, иначе Y. Вводи латинские A и B.',
      fields: [['Образец', 'ABAA'], ['Вход для проверки', 'ABAABAA']],
      solve: ([pattern, word]) => ({ steps: patternSteps(pattern, word, mkG) }) },
  };
  function readGraph(raw) {
    const parsed = parseAutomaton(raw);
    if (parsed.g.nodes.length > 24 || parsed.g.edges.length > 160) throw Error('Для разбора допустимо до 24 состояний и 160 дуг.');
    return parsed;
  }
  const drafts = new Map();
  let mode = select.value;
  const inputs = () => Array.from(fields.querySelectorAll('[data-calc-input]'));
  function reset() {
    replay?.stop();
    replay = undefined;
    player.replaceChildren();
    result.replaceChildren();
    jump.hidden = true;
  }
  function drawFields() {
    const config = modes[mode];
    get('hint').textContent = config.hint || '';
    fields.innerHTML = config.fields.map(([label, , multiline], i) => {
      const attrs = 'class="tx aut-calc-input" id="calc-input-' + i + '" data-calc-input spellcheck="false" autocomplete="off"';
      return '<div class="aut-calc-field"><label for="calc-input-' + i + '">' + escape(label) + '</label>' +
        (multiline ? '<textarea ' + attrs + ' rows="7" maxlength="8000"></textarea>' :
          '<input ' + attrs + ' maxlength="2000">') + '</div>';
    }).join('');
    const values = drafts.get(mode) || config.fields.map(field => field[1]);
    inputs().forEach((input, i) => { input.value = values[i]; });
  }
  ctx.on(select, 'change', () => {
    drafts.set(mode, inputs().map(input => input.value));
    mode = select.value;
    reset();
    drawFields();
  });
  ctx.on(fields, 'input', reset);
  ctx.on(form, 'submit', event => {
    event.preventDefault();
    reset();
    try {
      const { html, steps } = modes[mode].solve(inputs().map(input => input.value.trim()));
      if (html) result.innerHTML = html;
      if (steps) {
        const host = root.ownerDocument.createElement('div');
        player.appendChild(host);
        replay = new Stepper(host, steps);
        lastStep = steps.length - 1;
        jump.hidden = lastStep === 0;
      }
    } catch (error) {
      reset();
      result.innerHTML = '<p class="err">' + escape(error.message) + '</p>';
    }
  });
  ctx.on(jump, 'click', () => { replay?.stop(); replay?.go(lastStep); });
  drawFields();
}
