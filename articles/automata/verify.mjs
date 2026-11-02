import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {wordNumber,numberWord,refineMealy,mealyExample,compareMealy,machineA,machineB} from './learning.js';
const text=fs.readFileSync(new URL('./automata.js',import.meta.url),'utf8');
const code=text.slice(text.indexOf('export function mount'),text.indexOf('var RM=ctx')).replace('export function mount(root, ctx) {','');
const c=vm.createContext({ctx:{},console});vm.runInContext(code,c);
const {mkG,clearDetSteps,detSteps,minSteps,nfaFromGraph,nfaFromRe,parseRe,regexSteps,elimSteps,closure}=c;
function equiv(a,b) {
 const close=(m,s)=>Array.from(closure(m,s)).sort();
 const move=(m,s,a)=>close(m,[...new Set(s.flatMap(q=>(m.tr[q]||[]).filter(t=>t[0]===a).map(t=>t[1])))]);
 const alpha=[...new Set([...Object.values(a.tr),...Object.values(b.tr)].flat().map(t=>t[0]).filter(x=>x!==null))];
 const queue=[[close(a,a.start),close(b,b.start),'']],seen=new Set();
 for (const [x,y,w] of queue) {
  const key=JSON.stringify([x,y]);if(seen.has(key))continue;seen.add(key);
  assert.equal(x.some(q=>a.fin[q]),y.some(q=>b.fin[q]),'Языки различаются на '+(w||'ε'));
  for(const z of alpha)queue.push([move(a,x,z),move(b,y,z),w+z]);
 }
}
assert.equal(numberWord('abc','689').value,'bbaaab');assert.equal(wordNumber('abcd','ccabd').value,'988');
for(const alphabet of ['a','ab','abc','abcd'])for(let i=0;i<250;i++){const w=numberWord(alphabet,''+i).value;assert.equal(wordNumber(alphabet,w).value,''+i);}
assert.throws(()=>wordNumber('aab','ab'));assert.throws(()=>numberWord('ab','-1'));assert.throws(()=>wordNumber('ab','c'));
assert.deepEqual(refineMealy(mealyExample).at(-1),[['q0','q5'],['q1','q2'],['q3'],['q4']]);
assert.equal(compareMealy(machineA,machineB).word,'0');assert.equal(compareMealy(machineA,machineA).equal,true);
const b=structuredClone(machineA);b.table.q3[1][1]='b';assert.equal(compareMealy(machineA,b).word,'11');
const g=mkG([['q0',0,0,'s'],['q1',100,0],['q2',200,0,'f'],['q3',100,100]],[['q0','a','q1'],['q0','ε','q3'],['q1','ε','q2'],['q1','a','q3'],['q3','a','q2'],['q3','b','q3']]);
for(const source of [g,mkG([['p',0,0,'sf']],[]),mkG([['p',0,0,'s'],['q',100,0]],[['p','a','q']]),mkG([['p',0,0,'s'],['q',100,0,'f']],[['p','ε','q'],['q','ε','p'],['q','a','q']])]) {
 const simple=clearDetSteps(source,'');equiv(nfaFromGraph(source),nfaFromGraph(simple.at(-1).g));
 const d=detSteps(source,'');equiv(nfaFromGraph(source),nfaFromGraph(d.at(-1).g));
 const m=minSteps(source);equiv(nfaFromGraph(source),nfaFromGraph(m.mini));
}
const empty=mkG([['p',0,0,'s'],['q',100,0]],[['p','a','q']]);assert.equal(minSteps(empty).mini.nodes.length,1);
for(const re of ['a','ε','∅','(a+b)*abb','ab*c+(a+b)*(c+a*)','(a^++b)*b+b^++(bc)*+a']) {
 const parsed=parseRe(re),steps=regexSteps(re);equiv(nfaFromRe(parsed),nfaFromGraph(steps.at(-1).g));
 const result=elimSteps(steps.at(-1).g);equiv(nfaFromRe(parsed),nfaFromRe(result.at(-1).answer));
}
let seed=34;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<50;i++) {
 const n=2+Math.floor(rand()*3),nodes=Array.from({length:n},(_,j)=>['q'+j,j*120,0,(j===0?'s':'')+(rand()<.4?'f':'')]),edges=[];
 for(let j=0;j<n;j++)for(const a of ['a','b','ε'])for(let k=0;k<n;k++)if(rand()<.15)edges.push(['q'+j,a,'q'+k]);
 const g=mkG(nodes,edges),simple=clearDetSteps(g,'');equiv(nfaFromGraph(g),nfaFromGraph(simple.at(-1).g));
 const d=detSteps(g,'');equiv(nfaFromGraph(g),nfaFromGraph(d.at(-1).g));
 const min=minSteps(g);equiv(nfaFromGraph(g),nfaFromGraph(min.mini));
}
console.log('Проверены оба алгоритма детерминизации;  1000 преобразований номер↔слово; классы Мили и контрпримеры; ε-циклы, пустой язык, неполные ДКА; 50 случайных автоматов точным обходом пар множеств; 6 регулярок в обе стороны.');
