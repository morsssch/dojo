// Небольшие примеры для первого знакомства; вычисления не зависят от DOM.
export function wordNumber(alphabet, word) {
  const a = Array.from(alphabet), w = Array.from(word === 'ε' ? '' : word);
  validateAlphabet(a);
  if (w.length > 2000) throw Error('Для пошагового разбора возьми слово не длиннее 2000 символов.');
  let n = 0n; const rows = [];
  for (const c of w) {
    const d = a.indexOf(c) + 1;
    if (!d) throw Error(`Буквы «${c}» нет в алфавите.`);
    const old = n; n = n * BigInt(a.length) + BigInt(d);
    rows.push([old.toString(), c, d, n.toString()]);
  }
  return { value: n.toString(), rows };
}
function validateAlphabet(a) {
  if (!a.length || new Set(a).size !== a.length || a.some(c => /[\s,;ε]/u.test(c))) throw Error('Задай непустой алфавит из разных символов без разделителей и ε.');
}
export function numberWord(alphabet, raw) {
  const a = Array.from(alphabet); validateAlphabet(a);
  if (!/^\d{1,1000}$/.test(raw)) throw Error('Номер должен быть целым неотрицательным числом (до 1000 цифр).');
  let n = BigInt(raw), word = []; const rows = [], base = BigInt(a.length);
  if (base === 1n && n > 2000n) throw Error('Для односимвольного алфавита возьми номер не больше 2000.');
  while (n > 0n) {
    const old = n, d = (n - 1n) % base + 1n;
    n = (n - d) / base; word.push(a[Number(d - 1n)]);
    rows.push([old.toString(), d.toString(), a[Number(d - 1n)], n.toString()]);
    if (rows.length > 2000) throw Error('Получилось больше 2000 букв. Возьми номер поменьше.');
  }
  return { value: word.reverse().join('') || 'ε', rows };
}
export const mealyExample = {
  alpha: ['a', 'b'],
  table: {q0:{a:['q1','0'],b:['q1','2']},q1:{a:['q2','1'],b:['q5','0']},q2:{a:['q2','1'],b:['q0','0']},q3:{a:['q4','2'],b:['q2','1']},q4:{a:['q1','1'],b:['q4','1']},q5:{a:['q2','0'],b:['q1','2']}}
};
export function refineMealy(m) {
  const ids = Object.keys(m.table);
  const group = (list, signature) => {
    const groups = new Map();
    for (const q of list) { const k = JSON.stringify(signature(q)); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(q); }
    return [...groups.values()];
  };
  let part = group(ids, q => m.alpha.map(a => m.table[q][a][1]));
  const history = [part];
  for (;;) {
    const cls = Object.fromEntries(part.flatMap((c,i)=>c.map(q=>[q,i])));
    const next = part.flatMap(c => group(c, q => m.alpha.map(a => cls[m.table[q][a][0]])));
    history.push(next);
    if (next.length === part.length) return history;
    part = next;
  }
}
export const machineA = {start:'q1',alpha:['0','1'],table:{q1:{0:['q2','b'],1:['q3','a']},q2:{0:['q2','b'],1:['q3','b']},q3:{0:['q3','b'],1:['q3','a']}}};
export const machineB = {start:'s2',alpha:['0','1'],table:{s1:{0:['s1','b'],1:['s3','a']},s2:{0:['s3','a'],1:['s1','a']},s3:{0:['s1','a'],1:['s3','b']}}};
export function compareMealy(a,b) {
  if (JSON.stringify([...a.alpha].sort()) !== JSON.stringify([...b.alpha].sort())) throw Error('Входные алфавиты должны совпадать.');
  const queue = [[a.start,b.start,'']], seen = new Set([JSON.stringify([a.start,b.start])]), edges=[];
  for (let i=0;i<queue.length;i++) {
    const [q,s,word]=queue[i];
    for (const x of a.alpha) {
      const u=a.table[q][x],v=b.table[s][x];
      if (!u || !v) throw Error('Этот пример предполагает полные преобразователи.');
      edges.push({from:[q,s],input:x,to:[u[0],v[0]],outputs:[u[1],v[1]],word:word+x});
      if (u[1]!==v[1]) return {equal:false,word:word+x,edges,pairs:queue.map(p=>p.slice(0,2))};
      const key=JSON.stringify([u[0],v[0]]);
      if (!seen.has(key)) {seen.add(key);queue.push([u[0],v[0],word+x]);}
    }
  }
  return {equal:true,edges,pairs:queue.map(p=>p.slice(0,2))};
}
const esc = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table = (heads,rows) => '<div class="tscroll"><table class="dt"><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</table></div>';
export function mountLearning(root,ctx,Stepper,mkG) {
  const $=id=>root.querySelector('#'+id);
  function numbering() {
    try {
      const alpha=$('num-alpha').value, raw=$('num-value').value.trim();
      const numeric=/^\d+$/.test(raw);
      const result=numeric?numberWord(alpha,raw):wordNumber(alpha,raw);
      $('num-out').innerHTML=table(numeric?['N до','d','Буква справа','N после']:['N до','Буква','d','N после'],result.rows)+'<p class="ansbox">Ответ: '+esc(result.value)+'</p><p class="hint">'+(numeric?'Прочитай найденные буквы снизу вверх.':'На каждом шаге: новый N = старый N · размер алфавита + номер буквы.')+'</p>';
    }catch(e){$('num-out').innerHTML='<p class="err">'+esc(e.message)+'</p>';}
  }
  ctx.on($('num-go'),'click',numbering); numbering();
  const parts=refineMealy(mealyExample), p=parts.at(-1), cls=Object.fromEntries(p.flatMap((c,i)=>c.map(q=>[q,i])));
  new Stepper($('demo-mealy'),[
    {title:'1. Сначала сравниваем выходы',html:table(['Состояние','Выход по a','Выход по b'],Object.entries(mealyExample.table).map(([q,r])=>[q,r.a[1],r.b[1]])),text:'<p>q₀ и q₅: (0,2). q₁ и q₂: (1,0). q₃: (2,1). q₄: (1,1). Получились четыре разных типа поведения на одном символе.</p>'},
    {title:'2. Начальные классы',html:table(['Класс','Состояния'],p.map((c,i)=>['C'+(i+1),c.join(', ')])),text:'<p>Разные векторы выходов уже различают состояния. Далее можно только дробить эти классы.</p>'},
    {title:'3. Проверяем назначения по старым классам',html:table(['Состояние','Класс по a','Класс по b'],Object.entries(mealyExample.table).map(([q,r])=>[q,'C'+(cls[r.a[0]]+1),'C'+(cls[r.b[0]]+1)])),text:'<p>В C₁ у обоих состояний подпись (C₂,C₂). В C₂ у обоих (C₂,C₁). Одноэлементные C₃ и C₄ разделить нельзя. Значит ≡¹=≡⁰. Стоп.</p>'},
    {title:'4. Переносим переходы и сохраняем выходы',html:table(['Класс','a: назначение / выход','b: назначение / выход'],p.map((c,i)=>['C'+(i+1),...mealyExample.alpha.map(a=>'C'+(cls[mealyExample.table[c[0]][a][0]]+1)+' / '+mealyExample.table[c[0]][a][1])])),text:'<p>Представители: C₁=[q₀], C₂=[q₁], C₃=[q₃], C₄=[q₄]. Любой другой представитель из того же класса даст ту же таблицу.</p>'}
  ]);
  const comparison=compareMealy(machineA,machineB),edge=comparison.edges[0];
  new Stepper($('demo-equivalence'),[
    {title:'1. Начальная пара (q₁,s₂)',html:'<div class="trace">(q₁,s₂), прочитано ε; выходы ε и ε.</div>',text:'<p>Пустой вход ничего не различает. Берём первый входной символ 0 и смотрим оба исходных автомата.</p>'},
    {title:'2. По входу 0 выходы разные',html:table(['Автомат','Откуда','Вход','Куда','Выход'],[['Первый',edge.from[0],edge.input,edge.to[0],edge.outputs[0]],['Второй',edge.from[1],edge.input,edge.to[1],edge.outputs[1]]]),text:'<p>Совместная дуга: (q₁,s₂) —0/ba→ (q₂,s₃). Выходы b и a различаются. Это достижимая дуга прямо из начала.</p>'},
    {title:'3. Контрпример найден',html:'<div class="ansbox">Вход 0: первый выход b, второй a. Автоматы неэквивалентны.</div>',text:'<p>Дорисовывать остальные пары для доказательства уже не нужно. Если бы выходы совпали, добавили бы новую пару в очередь и проверили из неё каждую входную букву.</p>'}
  ]);
  // Один и тот же маленький граф сопровождает весь первый разбор.
  const original=mkG([['q0',0,40,'s'],['q1',170,-50],['q2',340,-50,'f'],['q3',170,140]],[['q0','a','q1'],['q0','ε','q3'],['q1','ε','q2'],['q1','a','q3'],['q3','a','q2'],['q3','b','q3']]);
  const without=mkG([['q0',0,40,'s'],['q1',170,-50,'f'],['q2',340,-50,'f'],['q3',170,140]],[['q0','a','q1'],['q0','a','q2'],['q0','b','q3'],['q1','a','q3'],['q3','a','q2'],['q3','b','q3']]);
  const headers=['Состояние','a','b'];
  const rows=[['→q₀','{q₁,q₂}','{q₃}'],['*q₁','{q₃}','∅'],['*q₂','∅','∅'],['q₃','{q₂}','{q₃}']];
  new Stepper($('demo-epsilon-first'),[
    {title:'1. Что дано и что нужно получить',g:original,text:'<p>Старт q₀. Единственный старый финал q₂. По ε можно перемещаться бесплатно. Хотим убрать ε, сохранив все принимаемые слова. Сначала разберём только переход из q₀ по a.</p>'},
    {title:'2. До буквы: из q₀ бесплатно доступны q₀ и q₃',g:original,o:{ncls:{q0:'nw',q3:'nw'},ecls:{e2:'lp'}},text:'<p>Начни с {q₀}. Из q₀ есть ε-дуга в q₃ — добавь q₃. Из q₃ ε-дуг нет. Стоп: Ξ(q₀)={q₀,q₃}. По дуге a сейчас не идём: мы ещё не читаем букву.</p>'},
    {title:'3. Читаем одну a из каждого доступного состояния',g:original,o:{ecls:{e1:'nw',e5:'nw'},ncls:{q1:'nw',q2:'nw'}},text:'<p>Из q₀ по a идём в q₁. Из q₃ по a идём в q₂. Собираем оба результата: {q₁,q₂}. Буква a прочитана ровно один раз на каждом возможном пути.</p>'},
    {title:'4. После буквы: добавляем бесплатные продолжения',g:original,o:{ecls:{e3:'lp'},ncls:{q1:'nw',q2:'nw'}},text:'<p>Из q₁ по ε достижимо q₂, которое уже есть. Из q₂ ε-дуг нет. В итоге {q₁,q₂}. Пишем клетку: δ′(q₀,a)={q₁,q₂}. Не выбирай одну из вершин: нужны все варианты.</p>'},
    {title:'5. Теперь отдельно клетка (q₀,b)',g:original,o:{ecls:{e6:'nw'},ncls:{q3:'nw'}},text:'<p>До буквы снова доступны {q₀,q₃}. Из q₀ b-дуги нет; из q₃ есть b-петля в q₃. После неё бесплатных продолжений нет. Клетка δ′(q₀,b)={q₃}.</p>'},
    {title:'6. Заполняем остальные строки тем же правилом',html:table(headers,rows),text:'<p>Из q₁ до буквы доступны {q₁,q₂}; по a из них есть только q₁→q₃, по b ничего. У q₂ ни одной буквенной дуги: обе клетки ∅. У q₃ по a получаем q₂, по b — q₃.</p>'},
    {title:'7. Переносим финальность и стираем ε',g:without,text:'<p>q₁ становится финальным: из него можно было бесплатно попасть в старый финал q₂. q₂ остаётся финальным. q₀ и q₃ не финальные. Старт остаётся q₀. Теперь ε-дуг нет, но по a из q₀ всё ещё две стрелки — нужна детерминизация.</p>'},
    {title:'8. Один набор — одна новая вершина',html:table(['Вершина ДКА','Что она хранит'],[['→P₀','{q₀}']]),text:'<p>Мы уже учли ε в новой таблице, поэтому начинаем с {q₀}. Назовём этот набор P₀. Когда ДКА попадает в P₀, это означает: НКА мог находиться в q₀. Сейчас нам нужна именно таблица без ε с предыдущих шагов.</p>'},
    {title:'9. Строка P₀: создаём два набора',html:table(['Набор','a','b'],[['P₀={q₀}','P₁={q₁,q₂}','P₂={q₃}']]),text:'<p>В строке q₀ по a стоит {q₁,q₂} — это одна новая вершина P₁. По b стоит {q₃} — одна новая вершина P₂. Даже набор из одной вершины получает имя P. P₁ финальное: содержит хотя бы одно финальное q.</p>'},
    {title:'10. Строка P₁: объединяем две строки',html:table(['Читаем','Из q₁','Из q₂','Объединение','Готовое имя'],[['a','{q₃}','∅','{q₃}','P₂'],['b','∅','∅','∅','перехода нет']]),text:'<p>P₁ хранит {q₁,q₂}. По a объединяем результаты для обоих: {q₃}∪∅={q₃}. Такой набор уже есть — P₂. По b обе строки пусты, значит и результат пуст. Новую вершину не создаём.</p>'},
    {title:'11. Обрабатываем новые строки до конца',html:table(['Набор','a','b'],[['→P₀={q₀}','P₁','P₂'],['*P₁={q₁,q₂}','P₂','∅'],['P₂={q₃}','P₃','P₂'],['*P₃={q₂}','∅','∅']]),text:'<p>Из P₂ по a получается новый набор {q₂}=P₃, по b — уже известный P₂. Для P₃ тоже заполняем строку: обе клетки пусты. Все четыре строки готовы, новых наборов нет. Стоп. Финальные P₁ и P₃.</p>'},
    {title:'12. Проверяем слово abba',html:'<div class="trace">P₀ —a→ P₁ —b→ ∅: abba отвергается.<br>P₀ —b→ P₂ —b→ P₂ —a→ P₃: bba принимается.<br>P₀ —a→ P₁: a принимается.</div>',text:'<p>Слово a в исходном графе тоже принимается: q₀ —a→ q₁ —ε→ q₂. Это показывает, зачем q₁ стало финальным. А bba: q₀ —ε→ q₃ —b→ q₃ —b→ q₃ —a→ q₂. Переходы поменялись, язык сохранился.</p>'}
  ]);
}
