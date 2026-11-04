// Состояние k хранит самый длинный суффикс входа, равный собственному префиксу образца.
export function buildPatternMachine(pattern) {
  if (!/^[AB]{1,12}$/.test(pattern)) throw Error('Образец: от 1 до 12 латинских букв A или B.');
  const table = Array.from(pattern, (_, state) => Object.fromEntries(['A', 'B'].map(input => {
    const candidate = pattern.slice(0, state) + input;
    const output = candidate.endsWith(pattern) ? 'X' : 'Y';
    let next = pattern.length - 1;
    while (!candidate.endsWith(pattern.slice(0, next))) next--;
    return [input, { next, output, candidate }];
  })));
  return { pattern, table };
}

export function runPatternMachine(machine, word) {
  if (!/^[AB]{0,120}$/.test(word)) throw Error('Вход: до 120 латинских букв A или B; пустой вход тоже допустим.');
  let state = 0;
  const steps = Array.from(word, (input, index) => {
    const from = state, transition = machine.table[state][input];
    state = transition.next;
    return { index, input, from, to: state, output: transition.output, candidate: transition.candidate };
  });
  return { steps, output: steps.map(step => step.output).join('') };
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const table = (headers, rows) => '<div class="tscroll"><table class="dt"><tr>' + headers.map(h => '<th>' + escape(h) + '</th>').join('') + '</tr>' + rows.map(row => '<tr>' + row.map(cell => '<td class="fr">' + escape(cell) + '</td>').join('') + '</tr>').join('') + '</table></div>';

export function mountPattern(root, ctx, Stepper, mkG) {
  const get = id => root.querySelector('#' + id);
  const example = buildPatternMachine('ABAA');
  function graph(machine, through = machine.table.length - 1) {
    const nodes = machine.table.map((_, i) => ['q' + i, (i % 4) * 180, Math.floor(i / 4) * 160, i === 0 ? 's' : '']);
    const g = mkG(nodes, []);
    machine.table.forEach((row, i) => {
      if (i > through) return;
      for (const input of ['A', 'B']) {
        const t = row[input];
        g.edges.push({id: 'pattern-' + i + '-' + input, from: 'q' + i, to: 'q' + t.next, re: {t: 'sym', v: input + '/' + t.output}});
      }
    });
    return g;
  }
  const stateRows = machine => machine.table.map((row, i) => [
    (i === 0 ? '→' : '') + 'q' + i + ': ' + (machine.pattern.slice(0, i) || 'ничего'),
    'q' + row.A.next + ' / ' + row.A.output,
    'q' + row.B.next + ' / ' + row.B.output,
  ]);
  const explanations = [
    '<p>Из q₀ по A получаем начало A — переходим в q₁. По B подходящего начала на конце нет — остаёмся в q₀. В обоих случаях выдаём Y.</p>',
    '<p>Из q₁ по A получается AA. Полного ABAA нет, но последняя A подходит как новое начало: q₁ / Y. По B получается AB: q₂ / Y.</p>',
    '<p>Из q₂ по A получается ABA: q₃ / Y. По B — ABB. Ни A, ни AB, ни ABA на конце нет: q₀ / Y.</p>',
    '<p>Из q₃ по A получается ABAA — выдаём X. Последняя A может начать следующее совпадение, поэтому переходим в q₁. По B получается ABAB: на конце AB, значит q₂ / Y.</p>',
  ];
  new Stepper(get('demo-pattern-build'), [
    {title:'1. Что проверяем после каждой буквы',html:'<div class="trace">Вход: A B A A B A A<br>Выход: Y Y Y X Y Y X</div>',text:'<p>Четвёртая и седьмая буквы завершают ABAA. На каждом другом шаге выдаём Y. Первые три выхода тоже Y: четырёх прочитанных букв ещё нет.</p>'},
    {title:'2. Состояния — память о подходящем конце',html:table(['Состояние','Какое начало ABAA уже есть на конце'],[['q₀','ничего'],['q₁','A'],['q₂','AB'],['q₃','ABA']]),text:'<p>q₂ означает: прочитанное заканчивается на AB. Всё слово могло быть длиннее, например BBBAB. Храним полезный конец AB; предыстория для следующих переходов уже не нужна.</p>'},
    ...explanations.map((text, i) => ({title:'3. Заполняем переходы из q' + i,g:graph(example,i),o:{ncls:{['q'+i]:'nw fresh'},ecls:{['pattern-'+i+'-A']:'nw fresh',['pattern-'+i+'-B']:'nw fresh'}},text})),
    {title:'4. Все переходы готовы',g:graph(example),text:'<p>Ровно одна стрелка по A и одна по B из каждой вершины. Метка A/X означает «читаем A, выдаём X». Двойных кружков здесь нет: это преобразователь Мили, выход записан на переходах.</p>'+table(['Состояние','По A: куда / выход','По B: куда / выход'],stateRows(example))},
    {title:'5. Проверяем повторные совпадения',html:'<div class="trace">q₀ —A/Y→ q₁ —B/Y→ q₂ —A/Y→ q₃ —A/X→ q₁<br>q₁ —B/Y→ q₂ —A/Y→ q₃ —A/X→ q₁</div>',text:'<p>Вход ABAABAA даёт YYYXYYX. После первого X остаёмся с памятью A: четвёртая буква одновременно завершает первое ABAA и начинает второе. Если сброситься в q₀, второе совпадение потеряется.</p>'},
  ]);

  let replay;
  function run() {
    replay?.stop();
    get('pattern-run').replaceChildren();
    try {
      const machine = buildPatternMachine(get('pattern-target').value.trim());
      const word = get('pattern-word').value.trim();
      const result = runPatternMachine(machine, word);
      get('pattern-output').innerHTML = table(['Состояние и память','A: куда / выход','B: куда / выход'],stateRows(machine)) + '<p class="ansbox">Выход: ' + escape(result.output || 'ε') + '</p>';
      const g = graph(machine);
      const steps = [{title:'Начало: q₀, ни одной буквы не прочитано',g,o:{ncls:{q0:'nw fresh'}},text:'<p>Образец '+escape(machine.pattern)+'. Вход '+escape(word||'ε')+'. Ни одного выходного символа пока нет.</p>'}];
      for (const step of result.steps) {
        const retained = machine.pattern.slice(0, step.to);
        steps.push({title:'Буква '+(step.index+1)+': '+step.input+' → выход '+step.output,g,o:{ncls:{['q'+step.to]:'nw fresh'},ecls:{['pattern-'+step.from+'-'+step.input]:'nw fresh'}},text:'<p>Были в q'+step.from+': помнили '+escape(machine.pattern.slice(0,step.from)||'пустой конец')+'. Добавили '+step.input+', проверяем '+escape(step.candidate)+'. '+(step.output==='X'?'Образец полностью совпал — выдаём X.':'Образец не завершился — выдаём Y.')+'</p><p>Сохраняем подходящее начало '+escape(retained||'ε')+' на конце: переходим в q'+step.to+'.</p><div class="trace">Прочитано: '+escape(word.slice(0,step.index+1))+'<br>Выдано: '+escape(result.output.slice(0,step.index+1))+'</div>'});
      }
      replay = new Stepper(get('pattern-run'), steps);
    } catch (error) {
      get('pattern-output').innerHTML = '<p class="err">'+escape(error.message)+'</p>';
    }
  }
  ctx.on(get('pattern-go'),'click',run);
  for (const id of ['pattern-target','pattern-word']) ctx.on(get(id),'keydown',event=>{if(event.key==='Enter')run()});
  run();
}
