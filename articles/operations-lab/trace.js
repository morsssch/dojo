import { traces } from './frames.js';
import { defense } from './defense.js';

const sources = import.meta.glob('./source/*.txt', { query: '?raw', import: 'default', eager: true });
const sourceLines = Object.fromEntries(
  Object.entries(sources).map(([path, text]) => [
    path.slice('./source/'.length, -'.txt'.length),
    text.trimEnd().split('\n'),
  ]),
);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function findFunction(source, name) {
  const lines = sourceLines[source];
  const declaration = new RegExp('^( +)(?:function ' + name + '\\(|const ' + name + ' =.*=>|' +
    name + '\\(.*\\{\\s*$)');
  const start = lines.findIndex(line => declaration.test(line));
  if (start < 0) throw new Error('Функция не найдена: ' + source + ':' + name);

  const signature = lines[start];
  const indent = signature.match(declaration)[1];
  if (signature.includes('const ' + name + ' =') && signature.endsWith(';')) {
    return { lines, start, end: start + 1 };
  }
  const closing = lines.findIndex((line, index) => index > start &&
    (line === indent + '}' || line === indent + '};'));
  if (closing < 0) throw new Error('Не найден конец функции ' + source + ':' + name);
  return { lines, start, end: closing + 1 };
}

function codeBlock(lines, start, end, highlightStart = -1, highlightEnd = -1) {
  const outer = element('pre', 'op-code');
  outer.tabIndex = 0;
  outer.setAttribute('aria-label', 'Фрагмент исходного JavaScript');
  const code = element('code');
  const indent = lines.slice(start, end).filter(line => line.trim()).reduce(
    (least, line) => Math.min(least, line.match(/^ */)[0].length), Infinity,
  );

  for (let index = start; index < end; index += 1) {
    const row = element('span', 'op-line');
    if (index >= highlightStart && index <= highlightEnd) row.classList.add('op-active');
    const number = element('span', 'op-line-number', String(index + 1));
    number.setAttribute('aria-hidden', 'true');
    row.append(number, element('span', 'op-line-text', lines[index].slice(indent)));
    code.append(row);
  }
  outer.append(code);
  return outer;
}

function sourceExcerpt(host, ctx) {
  const [source, name] = host.dataset.source.split(':');
  const place = host.querySelector('.op-excerpt');
  let rendered = false;

  function show() {
    if (!host.open || rendered) return;
    const { lines, start, end } = findFunction(source, name);
    place.append(element('p', 'op-caption', source + '.js · строки ' + (start + 1) + '–' + end));
    const previewEnd = Math.min(start + 9, end);
    place.append(codeBlock(lines, start, previewEnd));

    if (previewEnd < end) {
      const full = element('details', 'op-more');
      full.append(element('summary', '', 'Все строки функции'));
      ctx.on(full, 'toggle', () => {
        if (full.open && !full.querySelector('pre')) {
          full.append(codeBlock(lines, previewEnd, end));
        }
      });
      place.append(full);
    }
    rendered = true;
  }

  ctx.on(host, 'toggle', show);
  show();
}

function traceCode(source, [name, first, last, label], animate = false) {
  const { lines, start, end } = findFunction(source, name);
  const body = lines.slice(start, end);
  const localFirst = body.findIndex(line => line.includes(first));
  const localLast = body.findIndex((line, index) => index >= localFirst && line.includes(last));
  if (localFirst < 0 || localLast < 0) throw new Error('Нет выделяемых строк в ' + source + ':' + name);
  const highlightStart = start + localFirst;
  const highlightEnd = start + localLast;
  const visibleStart = Math.max(start, highlightStart - 1);
  const visibleEnd = Math.min(end, highlightEnd + 2);
  const wrap = element('div', 'op-frame-code');
  const code = codeBlock(lines, visibleStart, visibleEnd, highlightStart, highlightEnd);
  if (animate) code.classList.add('op-trace-update');
  const range = highlightStart === highlightEnd
    ? 'строка ' + (highlightStart + 1)
    : 'строки ' + (highlightStart + 1) + '–' + (highlightEnd + 1);
  if (label) wrap.append(element('p', 'op-defense-place', label));
  wrap.append(element('p', 'op-caption', source + '.js · ' + name + '() · ' + range), code);
  return wrap;
}

function cellContent(value) {
  const string = String(value);
  const fraction = /^(-?\d+)\/(\d+)$/.exec(string);
  if (!fraction) return document.createTextNode(string.replace(/^-/, '−'));

  const split = element('span', 'fr');
  split.setAttribute('aria-label', string);
  const numerator = element('span', '', fraction[1].replace(/^-/, '−'));
  const denominator = element('span', '', fraction[2]);
  numerator.setAttribute('aria-hidden', 'true');
  denominator.setAttribute('aria-hidden', 'true');
  split.append(numerator, denominator);
  return split;
}

function frameTable([headers, rows, active], motion, hasUpdate) {
  const outer = element('div', 'op-table op-frame-table');
  outer.tabIndex = 0;
  outer.setAttribute('role', 'region');
  outer.setAttribute('aria-label', 'Таблица текущего шага');

  const table = element('table');
  const header = table.createTHead().insertRow();
  for (const value of headers) {
    const th = element('th', '', value);
    th.scope = 'col';
    header.append(th);
  }
  const body = table.createTBody();

  for (const [rowIndex, values] of rows.entries()) {
    const row = body.insertRow();
    for (const [columnIndex, value] of values.entries()) {
      const cell = element(columnIndex === 0 ? 'th' : 'td');
      if (columnIndex === 0) cell.scope = 'row';
      const content = element('span', 'op-cell');
      content.append(cellContent(value));
      if (active.includes(rowIndex + ':' + columnIndex)) {
        cell.classList.add('op-focus-cell');
        if (motion && hasUpdate) content.classList.add('fresh');
      }
      cell.append(content);
      row.append(cell);
    }
  }
  outer.append(table);
  return outer;
}

function frameValues(values) {
  const list = element('dl', 'op-values');
  for (const [name, value] of values) {
    const pair = element('div');
    const term = element('dt');
    term.append(element('code', '', name));
    const description = element('dd');
    description.append(element('code', '', value));
    pair.append(term, description);
    list.append(pair);
  }
  return list;
}

function button(label) {
  const node = element('button', 'btn small', label);
  node.type = 'button';
  return node;
}

function statement(label, text) {
  const line = element('p');
  line.append(element('strong', '', label), document.createTextNode(' ' + text));
  return line;
}

function mountTrace(host, trace, ctx, requestPlay) {
  const { source, frames } = trace;
  host.classList.add('stepper');
  host.tabIndex = 0;
  host.setAttribute('role', 'region');

  const bar = element('div', 'sp-bar');
  const previous = button('Назад');
  const next = button('Дальше');
  const play = button('Воспроизвести');
  const middle = element('div', 'sp-mid');
  const count = element('span', 'sp-count');
  const slider = element('input', 'sp-range');
  slider.type = 'range';
  slider.min = '1';
  slider.max = String(frames.length);
  slider.setAttribute('aria-label', 'Шаг разбора');

  middle.append(count, slider);
  bar.append(previous, middle, next, play);

  const stage = element('div', 'sp-stage');
  const body = element('div', 'sp-text');
  const title = element('div', 'sp-title');
  title.setAttribute('aria-live', 'polite');
  const explanation = element('div', 'sp-body');
  body.append(title, explanation);
  host.append(bar, stage, body);

  let current = 0;
  let timer = null;
  let hasRendered = false;

  function render() {
    const frame = frames[current];
    count.textContent = (current + 1) + ' / ' + frames.length;
    slider.value = String(current + 1);
    slider.setAttribute('aria-valuetext', 'Шаг ' + (current + 1) + ' из ' + frames.length + '. ' + frame.title);
    previous.disabled = current === 0;
    next.disabled = current === frames.length - 1;
    title.textContent = frame.title;
    explanation.replaceChildren(statement('На бумаге.', frame.paper), statement('В коде.', frame.code));

    const paper = element('div', 'op-frame-paper');
    paper.append(element('p', 'op-caption', 'Данные шага'),
      frameTable(frame.grid, !ctx.reducedMotion, hasRendered), frameValues(frame.values));
    const layout = element('div', 'op-frame-layout');
    layout.append(paper, traceCode(source, frame.at, !ctx.reducedMotion && hasRendered));
    stage.replaceChildren(layout);
    hasRendered = true;
  }

  function stop() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    play.textContent = 'Воспроизвести';
    play.setAttribute('aria-pressed', 'false');
  }

  function goTo(index) {
    const position = Math.max(0, Math.min(frames.length - 1, index));
    if (position === current) return;
    current = position;
    render();
  }

  function manually(index) {
    stop();
    goTo(index);
  }

  ctx.on(previous, 'click', () => manually(current - 1));
  ctx.on(next, 'click', () => manually(current + 1));
  ctx.on(slider, 'input', () => manually(Number(slider.value) - 1));
  ctx.on(play, 'click', () => {
    if (timer !== null) {
      stop();
      return;
    }

    requestPlay(stop);
    if (current === frames.length - 1) goTo(0);
    play.textContent = 'Пауза';
    play.setAttribute('aria-pressed', 'true');
    timer = window.setInterval(() => {
      goTo(current + 1);
      if (current === frames.length - 1) stop();
    }, 2200);
  });
  ctx.on(host, 'keydown', event => {
    if (event.target !== host) return;
    const destinations = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: frames.length - 1,
    };
    if (!(event.key in destinations)) return;
    event.preventDefault();
    manually(destinations[event.key]);
  });
  ctx.onCleanup(stop);
  stop();
  render();
}

function searchWords(text) {
  return text.toLowerCase().replaceAll('ё', 'е').replace(/[∆δ]/g, ' дельта ')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function mountDefense(host, ctx) {
  const input = host.querySelector('input');
  const clear = host.querySelector('[data-clear-defense]');
  const status = host.querySelector('[data-defense-status]');
  const groups = [...host.querySelectorAll('[data-defense-group]')].map(section => {
    const source = section.dataset.defenseGroup;
    const list = section.querySelector('[data-defense-cards]');
    const cards = defense[source].map(item => {
      const card = element('details', 'op-function op-defense-card');
      const places = element('div', 'op-defense-places');
      const answer = statement('Что ответить.', item.answer);
      card.append(element('summary', '', item.question), answer, places);

      ctx.on(card, 'toggle', () => {
        if (card.open && !places.childElementCount) {
          for (const location of item.places) places.append(traceCode(source, location));
        }
      });
      list.append(card);
      const words = searchWords([item.question, item.answer, item.keywords, source,
        ...item.places.map(([name]) => name)].join(' '));
      return { card, words };
    });
    return { section, cards };
  });

  function filter() {
    const query = searchWords(input.value);
    let matches = 0;
    for (const { section, cards } of groups) {
      let groupMatches = 0;
      for (const { card, words } of cards) {
        const visible = query.every(term => words.some(word => word.startsWith(term)));
        card.hidden = !visible;
        if (visible) groupMatches += 1;
      }
      section.hidden = groupMatches === 0;
      matches += groupMatches;
    }
    clear.hidden = !input.value;
    status.textContent = query.length
      ? (matches ? 'Совпадений: ' + matches : 'Ничего не найдено. Введи название одного шага.')
      : '';
  }

  function reset() {
    input.value = '';
    filter();
  }

  ctx.on(input, 'input', filter);
  ctx.on(clear, 'click', () => {
    reset();
    input.focus();
  });
  ctx.on(ctx.root, 'click', event => {
    if (event.target.closest?.('a[href="#defense-simplex"], a[href="#defense-optimality"]')) reset();
  }, { capture: true });
}

export function mount(root, ctx) {
  const defenseHost = root.querySelector('[data-defense]');
  if (defenseHost) mountDefense(defenseHost, ctx);

  let activeStop;
  for (const host of root.querySelectorAll('[data-trace]')) {
    mountTrace(host, traces[host.dataset.trace], ctx, stop => {
      activeStop?.();
      activeStop = stop;
    });
  }
  for (const host of root.querySelectorAll('[data-source]')) sourceExcerpt(host, ctx);

  const links = [...root.querySelectorAll('.op-nav a')];
  const sections = links.map(link => root.querySelector(link.getAttribute('href')));
  function updateNav() {
    let index = 0;
    sections.forEach((section, next) => {
      if (section.getBoundingClientRect().top <= 140) index = next;
    });
    links.forEach((link, current) => {
      link.classList.toggle('on', current === index);
      if (current === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  ctx.on(window, 'scroll', updateNav, { passive: true });
  ctx.on(window, 'resize', updateNav);
  updateNav();
}
