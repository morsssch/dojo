// Интерактив статьи «Линейное программирование с нуля» — перенесён из артефакта почти без правок:
// точные дроби и симплекс-движок, пошаговые разборы с анимацией, графики, решения задач в точных дробях.
// Отличия от оригинала: document → root (корень статьи), формулы — ctx.typeset / ctx.tex (KaTeX), прокрутка — через ctx.on.
// @ts-nocheck

/** @param {HTMLElement} root @param {import('../../src/articles/runtime').ArticleCtx} ctx */
export function mount(root, ctx) {
"use strict";
var $id = function (id) { return root.querySelector("#" + CSS.escape(id)); };

/* ---------- точные дроби и симплекс-движок ---------- */
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=a%b;a=b;b=t}return a||1}
function Fr(n,d){if(d===undefined)d=1;if(d<0){n=-n;d=-d}var g=gcd(n,d);this.n=n/g;this.d=d/g}
Fr.prototype.add=function(o){o=F(o);return new Fr(this.n*o.d+o.n*this.d,this.d*o.d)};
Fr.prototype.sub=function(o){o=F(o);return new Fr(this.n*o.d-o.n*this.d,this.d*o.d)};
Fr.prototype.mul=function(o){o=F(o);return new Fr(this.n*o.n,this.d*o.d)};
Fr.prototype.div=function(o){o=F(o);return new Fr(this.n*o.d,this.d*o.n)};
Fr.prototype.neg=function(){return new Fr(-this.n,this.d)};
Fr.prototype.sign=function(){return Math.sign(this.n)};
Fr.prototype.cmp=function(o){return this.sub(o).sign()};
Fr.prototype.val=function(){return this.n/this.d};
function F(x){if(x instanceof Fr)return x;return new Fr(+x)}
function cost(c,v){return F((c&&c[v])||0)}
function clone(t){return{cols:t.cols.slice(),rows:t.rows.slice(),M:t.M.map(function(r){return r.slice()}),objs:t.objs.slice(),O:t.O.map(function(r){return r.slice()})}}
function mk(cols,rows,A,b){return{cols:cols.slice(),rows:rows.slice(),M:A.map(function(r,i){return r.map(F).concat([F(b[i])])}),objs:[],O:[]}}
function objRow(t,c){var n=t.cols.length,out=[];for(var j=0;j<=n;j++){var s=F(0);for(var i=0;i<t.rows.length;i++)s=s.add(cost(c,t.rows[i]).mul(t.M[i][j]));if(j<n)s=s.sub(cost(c,t.cols[j]));out.push(s)}return out}
function addObj(t,label,c){t=clone(t);t.objs.push(label);t.O.push(objRow(t,c));return t}
function dropObj(t,k){t=clone(t);t.objs.splice(k,1);t.O.splice(k,1);return t}
function dropCol(t,j){t=clone(t);t.cols.splice(j,1);t.M.forEach(function(r){r.splice(j,1)});t.O.forEach(function(r){r.splice(j,1)});return t}
function pivot(t,r,s){var p=t.M[r][s],pr=t.M[r];
  function tr(row,isP){return row.map(function(a,j){if(isP&&j===s)return F(1).div(p);if(isP)return a.div(p);if(j===s)return a.neg().div(p);return a.mul(p).sub(pr[j].mul(row[s])).div(p)})}
  var n=clone(t);n.M=t.M.map(function(row,i){return tr(row,i===r)});n.O=t.O.map(function(row){return tr(row,false)});
  var tmp=n.cols[s];n.cols[s]=n.rows[r];n.rows[r]=tmp;return n}
function chooseCol(t,k){var best=-1,bv=null;for(var j=0;j<t.cols.length;j++){var v=t.O[k][j];if(v.sign()<0&&(bv===null||v.cmp(bv)<0)){bv=v;best=j}}return best}
function ratios(t,s){var n=t.cols.length;return t.M.map(function(row){return row[s].sign()>0?row[n].div(row[s]):null})}
function chooseRow(t,s){var rs=ratios(t,s),best=-1,bv=null;rs.forEach(function(v,i){if(v&&(bv===null||v.cmp(bv)<0)){bv=v;best=i}});return best}

function chooseRowDual(t){var n=t.cols.length,best=-1,bv=null;t.M.forEach(function(r,i){if(r[n].sign()<0&&(bv===null||r[n].cmp(bv)<0)){bv=r[n];best=i}});return best}
function dualRatios(t,r,k){return t.cols.map(function(c,j){var a=t.M[r][j];return a.sign()<0?t.O[k][j].div(a.neg()):null})}
function chooseColDual(t,r,k){var rs=dualRatios(t,r,k),best=-1,bv=null;rs.forEach(function(v,j){if(v&&(bv===null||v.cmp(bv)<0)){bv=v;best=j}});return best}
function cell(t,i,j){var m=t.rows.length;return i<m?t.M[i][j]:t.O[i-m][j]}

/* ---------- форматирование: HTML и TeX ---------- */
function nm(s){return s.replace(/^([a-zA-Z]+)(\d+)$/,function(_,a,d){return a+"<sub>"+d+"</sub>"})}
function fmt(x){x=F(x);var s=x.n<0?"−":"",a=Math.abs(x.n);if(x.d===1)return s+a;return s+'<span class="fr"><span>'+a+'</span><span>'+x.d+'</span></span>'}
function tv(s){return s.replace(/^([a-zA-Z]+)(\d+)$/,"$1_{$2}")}
function tn(x,paren){x=F(x);var a=Math.abs(x.n),s=x.d===1?String(a):"\\tfrac{"+a+"}{"+x.d+"}";if(x.n<0)s="-"+s;return paren&&x.n<0?"\\left("+s+"\\right)":s}
function tvec(arr){return "("+arr.map(function(v){return tn(v)}).join(";\\ ")+")"}
function im(t){return "\\("+t+"\\)"}
function dm(t){return '<div class="tex">\\['+t+'\\]</div>'}
function txt(s){return "\\text{"+s+"}"}
function idx(s){return s.replace(/\D/g,"")}
function plan(t,vars){return vars.map(function(v){var i=t.rows.indexOf(v);return i>=0?t.M[i][t.cols.length]:F(0)})}

/* ---------- формулы: KaTeX из Dojo (в оригинале был вшитый движок формул) ---------- */
function typeset(el){if(el)ctx.typeset(el)}
function setTex(el,tex){el.innerHTML="";ctx.tex(el,tex)}

var SPEED=1;try{SPEED=+localStorage.getItem("lp-speed")||1}catch(e){}
var RM=ctx.reducedMotion;

/* ---------- симплекс-таблица ---------- */
function renderTable(t,o){o=o||{};var n=t.cols.length,m=t.rows.length,tid=o.tid||"t",h="";
  var info=o.info||{};var mark=o.mark||{};
  function cls(i,j,v,isObj){var c=["cell"];if(j===0)c.push("first");if(j===n)c.push("bcol");
    var key=tid+":"+i+","+j;
    if(o.blank&&o.blank(i,j))c.push("empty");
    if(o.pivot&&o.pivot[0]===i&&o.pivot[1]===j)c.push("pv");
    else{if(o.hiCol===j&&j<n&&!isObj)c.push("hc");if(o.hiRow===i&&!isObj)c.push("hr");
      if(isObj&&o.objHi&&j<n)c.push(v.sign()<0?"neg":"ok");
      if(isObj&&o.hiCol===j&&!o.objHi)c.push("hc")}
    if(o.negB&&j===n&&!isObj&&v.sign()<0)c.push("neg");
    if(o.struckCol===j)c.push("struck");
    if(mark[key])c.push("mk");
    if(info[key])c.push("has");
    return c.join(" ")}
  h+='<div class="tw"><table class="st" data-tid="'+tid+'">';
  if(o.cTop){h+='<tr><td></td><td></td>';t.cols.forEach(function(c,j){h+='<td class="ct'+(j===0?" l":"")+(j===n-1?" rr":"")+(o.hiCol===j?" hc":"")+'" data-k="'+tid+':ct'+j+'">'+fmt(cost(o.cTop,c))+'</td>'});h+='<td></td>'+(o.ratios?'<td></td>':'')+'</tr>'}
  h+='<tr class="hd"><th class="cb" style="border:0">'+(o.cB?'c<sub>B</sub>':'')+'</th><th></th>';
  t.cols.forEach(function(c,j){h+='<th class="colh'+(o.hiCol===j?" hc":"")+(o.struckCol===j?" struck":"")+'" data-k="'+tid+':h'+j+'">'+nm(c)+'</th>'});
  h+='<th class="colh bh">b</th>'+(o.ratios?'<th class="colh bh" style="font-weight:400;font-size:.8rem">b / a</th>':'')+'</tr>';
  for(var i=0;i<m;i++){
    h+='<tr class="'+(i===0?"r0":"")+(i===m-1?" rlast":"")+'">';
    h+='<td class="cb" data-k="'+tid+':cb'+i+'">'+(o.cB?fmt(cost(o.cB,t.rows[i])):"")+'</td>';
    h+='<th class="rl'+(o.hiRow===i?" hc":"")+'" data-k="'+tid+':l'+i+'">'+nm(t.rows[i])+'</th>';
    for(var j=0;j<=n;j++){var v=t.M[i][j];h+='<td class="'+cls(i,j,v,false)+'" data-k="'+tid+':'+i+','+j+'">'+fmt(v)+'</td>'}
    if(o.ratios){var rv=o.ratios[i];h+='<td class="ratio'+(rv?"":" skip")+(o.minRow===i?" min":"")+'" data-k="'+tid+':r'+i+'">'+(rv?fmt(rv):"—")+'</td>'}
    h+='</tr>'}
  t.objs.forEach(function(lab,k){var i=m+k;
    h+='<tr class="ob"><td></td><th class="rl">'+lab+'</th>';
    for(var j=0;j<=n;j++){var v=t.O[k][j];h+='<td class="'+cls(i,j,v,true)+'" data-k="'+tid+':'+i+','+j+'">'+fmt(v)+'</td>'}
    if(o.ratios)h+='<td></td>';h+='</tr>'});
  if(o.cratios){h+='<tr class="crow"><td></td><th class="rl" style="font-size:.72rem;font-weight:500">Δ/|a|</th>';for(var j=0;j<=n;j++){var cv=j<n?o.cratios[j]:null;h+='<td class="ratio'+(j<n&&cv?"":" skip")+(o.minCol===j?" min":"")+'" data-k="'+tid+':cr'+j+'">'+(j<n?(cv?fmt(cv):"—"):"")+'</td>'}if(o.ratios)h+='<td></td>';h+='</tr>'}
  h+='</table></div>';
  if(o.label)h='<div><div class="tlabel">'+o.label+'</div>'+h+'</div>';
  return h}

function objInfo(t,k,c,tid,into){var n=t.cols.length,m=t.rows.length;into=into||{};var lab=t.objs[k]==="Δ"?"\\Delta":t.objs[k];
  for(var j=0;j<=n;j++){var parts=t.rows.map(function(r,i){return tn(cost(c,r),true)+"\\cdot "+tn(t.M[i][j],true)}).join("+");
    var src=t.rows.map(function(r,i){return tid+":cb"+i}).concat(t.rows.map(function(r,i){return tid+":"+i+","+j}));
    var f;if(j<n){src.push(tid+":ct"+j);f=lab+"_{"+idx(t.cols[j])+"}=(c_B,A^{"+idx(t.cols[j])+"})-c_{"+idx(t.cols[j])+"}="+parts+"-"+tn(cost(c,t.cols[j]),true)+"="+tn(t.O[k][j])}
    else f=(t.objs[k]==="Δ"?"f":lab)+"=(c_B,b)="+parts+"="+tn(t.O[k][j]);
    into[tid+":"+(m+k)+","+j]={f:f,src:src}}
  return into}
function infoAnim(info){return Object.keys(info).map(function(k){var v=info[k];return{f:v.f,moves:v.src.map(function(s){return[s,k]}),show:[k],src:v.src}})}

function pivotInfo(t,r,s,nt){var info={},m=t.rows.length,n=t.cols.length,p=t.M[r][s],P=tn(p,true);
  var rowsAll=m+t.objs.length;
  for(var i=0;i<rowsAll;i++)for(var j=0;j<=n;j++){var V=tn(cell(nt,i,j)),A=cell(t,i,j),key="n:"+i+","+j,ph,f,src;
    var lab=i<m?tv(nt.rows[i]):(t.objs[i-m]==="Δ"?"\\Delta":t.objs[i-m]);
    var where=txt("строка ")+lab+",\\ "+txt("столбец ")+(j<n?tv(nt.cols[j]):"b")+":\\quad ";
    if(i===r&&j===s){ph=0;f=txt("ведущий: ")+"\\frac{1}{p}=\\frac{1}{"+tn(p)+"}="+V;src=["p:"+r+","+s]}
    else if(i===r){ph=1;f=where+"\\frac{a}{p}=\\frac{"+tn(A)+"}{"+tn(p)+"}="+V;src=["p:"+i+","+j,"p:"+r+","+s]}
    else if(j===s){ph=2;f=where+"-\\frac{a}{p}=-\\frac{"+tn(A)+"}{"+tn(p)+"}="+V;src=["p:"+i+","+j,"p:"+r+","+s]}
    else{ph=3;var B=cell(t,r,j),C=cell(t,i,s);f=where+"\\frac{a\\cdot p-b\\cdot c}{p}=\\frac{"+tn(A,true)+"\\cdot "+P+"-"+tn(B,true)+"\\cdot "+tn(C,true)+"}{"+tn(p)+"}="+V;src=["p:"+i+","+j,"p:"+r+","+s,"p:"+r+","+j,"p:"+i+","+s]}
    info[key]={f:f,src:src,ph:ph}}
  return info}

/* ---------- пошаговый плеер с анимацией ---------- */
var stepperCount=0;
function Stepper(el,steps){var self=this;this.el=el;this.steps=steps;this.i=0;this.tok=0;this.busy=false;var id="sp"+(++stepperCount);
  el.innerHTML='<div class="sp-bar"><button class="btn sp-prev" type="button">← Назад</button><div class="sp-mid"><span class="sp-count"></span><input class="sp-range" id="'+id+'-r" type="range" min="0" max="'+(steps.length-1)+'" value="0" aria-label="Шаг разбора"></div><button class="btn primary sp-next" type="button">Дальше →</button></div>'+
   '<div class="sp-stage"></div>'+
   '<div class="sp-anim" hidden><button class="btn sm sp-replay" type="button">↻ Повторить</button><button class="btn sm sp-skip" type="button">Сразу результат</button><span class="sp-speed" role="group" aria-label="Скорость анимации"><button type="button" data-s="0.5">0.5×</button><button type="button" data-s="1">1×</button><button type="button" data-s="2">2×</button></span><span class="sp-astat"></span></div>'+
   '<div class="sp-text"><h4 class="sp-title"></h4><div class="sp-body"></div><div class="sp-formula"></div></div>';
  el.tabIndex=0;var q=function(s){return el.querySelector(s)};
  this.stage=q(".sp-stage");this.title=q(".sp-title");this.body=q(".sp-body");this.formula=q(".sp-formula");this.count=q(".sp-count");this.range=q(".sp-range");this.prev=q(".sp-prev");this.next=q(".sp-next");
  this.abar=q(".sp-anim");this.astat=q(".sp-astat");
  this.prev.onclick=function(){self.go(self.i-1)};this.next.onclick=function(){self.go(self.i+1)};
  this.range.oninput=function(){self.go(+self.range.value)};
  q(".sp-replay").onclick=function(){self.play()};q(".sp-skip").onclick=function(){self.finish()};
  el.querySelectorAll(".sp-speed button").forEach(function(b){b.onclick=function(){SPEED=+b.getAttribute("data-s");try{localStorage.setItem("lp-speed",SPEED)}catch(e){}root.querySelectorAll(".sp-speed button").forEach(function(x){x.classList.toggle("on",+x.getAttribute("data-s")===SPEED)})};b.classList.toggle("on",+b.getAttribute("data-s")===SPEED)});
  el.addEventListener("keydown",function(e){if(e.target.tagName==="INPUT"&&e.target!==self.range)return;if(e.key==="ArrowRight"){e.preventDefault();self.go(self.i+1)}if(e.key==="ArrowLeft"){e.preventDefault();self.go(self.i-1)}});
  function find(e){var c=e.target.closest&&e.target.closest("[data-k]");return c&&self.stage.contains(c)?c:null}
  this.stage.addEventListener("pointerover",function(e){if(e.pointerType==="touch")return;var c=find(e);if(c)self.hover(c)});
  this.stage.addEventListener("pointerdown",function(e){var c=find(e);if(c)self.hover(c)});
  this.stage.addEventListener("click",function(e){var c=find(e);if(c)self.hover(c)});
  this.go(0)}
Stepper.prototype.q=function(k){return this.stage.querySelector('[data-k="'+k+'"]')};
Stepper.prototype.clearHi=function(){this.stage.querySelectorAll(".src,.hov").forEach(function(x){x.classList.remove("src","hov")})};
Stepper.prototype.go=function(i){if(i<0||i>=this.steps.length)return;this.tok++;this.busy=false;this.i=i;var s=this.steps[i];
  this.stage.innerHTML=typeof s.stage==="function"?s.stage():s.stage;
  this.title.textContent=s.title;this.body.innerHTML=s.text;
  this.count.textContent="Шаг "+(i+1)+" / "+this.steps.length;this.range.value=i;
  this.prev.disabled=i===0;this.next.disabled=i===this.steps.length-1;
  var self=this;
  if(s.info)Object.keys(s.info).forEach(function(k){var c=self.q(k);if(c)c.classList.add("has")});
  this.hint();
  typeset(this.body);typeset(this.stage);
  this.abar.hidden=!s.anim;this.astat.textContent="";
  if(s.after)s.after(this.stage,this);
  if(s.anim)this.play()};
Stepper.prototype.hint=function(){var s=this.steps[this.i];
  if(s.info&&Object.keys(s.info).length){this.formula.className="sp-formula hint";this.formula.textContent=s.hint||"Наведи курсор или нажми на клетку с пунктирной рамкой — здесь появится формула, а исходные клетки подсветятся."}
  else{this.formula.className="sp-formula";this.formula.textContent=""}};
Stepper.prototype.hover=function(c){if(this.busy)return;var s=this.steps[this.i];if(!s.info)return;var inf=s.info[c.getAttribute("data-k")];if(!inf)return;
  this.clearHi();var self=this;inf.src.forEach(function(k){var e=self.q(k);if(e)e.classList.add("src")});
  c.classList.add("hov");this.formula.className="sp-formula";setTex(this.formula,inf.f)};
Stepper.prototype.fly=function(from,to,ms){if(!from||!to)return;var sr=this.stage.getBoundingClientRect(),fr=from.getBoundingClientRect(),tr=to.getBoundingClientRect();
  var c=document.createElement("div");c.className="chip";c.innerHTML=from.innerHTML;
  var w=Math.max(Math.min(fr.width,90),30),h=Math.max(Math.min(fr.height,44),26);
  c.style.left=(fr.left-sr.left+fr.width/2-w/2)+"px";c.style.top=(fr.top-sr.top+fr.height/2-h/2)+"px";c.style.width=w+"px";c.style.height=h+"px";
  this.stage.appendChild(c);
  var dx=(tr.left+tr.width/2)-(fr.left+fr.width/2),dy=(tr.top+tr.height/2)-(fr.top+fr.height/2);
  if(c.animate){var a=c.animate([{transform:"translate(0,0) scale(1)",opacity:0.95},{transform:"translate("+dx*0.5+"px,"+(dy*0.5-22)+"px) scale(1.15)",opacity:1,offset:0.45},{transform:"translate("+dx+"px,"+dy+"px) scale(.7)",opacity:0.15}],{duration:ms,easing:"cubic-bezier(.45,0,.3,1)"});a.onfinish=function(){c.remove()}}
  else setTimeout(function(){c.remove()},ms)};
Stepper.prototype.allShow=function(){var s=this.steps[this.i],out=[];(s.anim||[]).forEach(function(a){a.show.forEach(function(k){out.push(k)})});return out};
Stepper.prototype.finish=function(){this.tok++;this.busy=false;var self=this;this.stage.querySelectorAll(".chip").forEach(function(c){c.remove()});
  this.allShow().forEach(function(k){var e=self.q(k);if(e)e.classList.remove("pending")});this.clearHi();this.astat.textContent="";this.hint()};
Stepper.prototype.play=function(){var s=this.steps[this.i];if(!s.anim)return;var tok=++this.tok,self=this;
  this.stage.querySelectorAll(".chip").forEach(function(c){c.remove()});this.clearHi();
  this.allShow().forEach(function(k){var e=self.q(k);if(e)e.classList.add("pending")});
  if(RM){this.finish();return}
  this.busy=true;var n=0,list=s.anim;
  function step(){if(tok!==self.tok)return;
    if(n>=list.length){self.busy=false;self.clearHi();self.astat.textContent="готово";self.hint();return}
    var a=list[n++],D=1600/SPEED;self.clearHi();
    (a.src||a.moves.map(function(m){return m[0]})).forEach(function(k){var e=self.q(k);if(e)e.classList.add("src")});
    a.show.forEach(function(k){var e=self.q(k);if(e)e.classList.add("hov")});
    self.formula.className="sp-formula";if(a.f)setTex(self.formula,a.f);self.astat.textContent=n+" / "+list.length;
    setTimeout(function(){if(tok!==self.tok)return;
      (a.moves||[]).forEach(function(m){self.fly(self.q(m[0]),self.q(m[1]),D*0.55)});
      setTimeout(function(){if(tok!==self.tok)return;
        a.show.forEach(function(k){var e=self.q(k);if(e){e.classList.remove("pending","fresh");void e.offsetWidth;e.classList.add("fresh")}});
        setTimeout(step,D*0.33)},D*0.55)},D*0.22)}
  step()};

/* ---------- генерация шагов симплекса ---------- */
function iterSteps(t,k,r,s,nt,o){var steps=[],n=t.cols.length,lab=t.objs[k],O=t.O[k];
  var xs=t.cols[s],xr=t.rows[r],p=t.M[r][s],rs=ratios(t,s),fn=lab==="F"?"F":"f",tl=lab==="Δ"?"\\Delta":lab;
  var base={cTop:o.costs,cB:o.costs};
  function stage1(extra){return function(){return '<div class="srow">'+renderTable(t,Object.assign({tid:"p"},base,extra))+(o.mini?o.mini(t):"")+'</div>'}}
  var negs=[];for(var j=0;j<n;j++)if(O[j].sign()<0)negs.push(im(tl+"_{"+idx(t.cols[j])+"}="+tn(O[j])));
  var pl=o.vars?plan(t,o.vars):null;
  steps.push({title:"Выбираем ведущий столбец",stage:stage1({objHi:true,hiCol:s}),
    text:(pl?'<p>Сейчас опорное решение '+im("x="+tvec(pl)+",\\ "+fn+"="+tn(O[n]))+'.</p>':"")+
    '<p>В строке '+lab+' есть отрицательные оценки: '+negs.join(", ")+'. Значит, план можно улучшить: если ввести такую переменную в базис, '+fn+' вырастет.</p>'+
    (chooseCol(t,k)!==s?'<p>Берём столбец <b>'+nm(xs)+'</b> — так сделано в методичке. Самая отрицательная оценка у '+nm(t.cols[chooseCol(t,k)])+', но это не обязательно: подходит <b>любой</b> столбец с Δ &lt; 0, ответ получится тот же.</p>':
    '<p>Берём столбец <b>'+nm(xs)+'</b>'+(negs.length>1?", у него самая отрицательная оценка. Подошёл бы и любой другой с Δ &lt; 0.":".")+'</p>')});
  var rAnim=t.rows.map(function(rw,i){var a=t.M[i][s];
    if(rs[i])return{f:tv(rw)+":\\quad\\frac{b}{a}=\\frac{"+tn(t.M[i][n])+"}{"+tn(a)+"}="+tn(rs[i])+(i===r?"\\quad\\leftarrow\\ "+txt("минимум"):""),moves:[["p:"+i+","+n,"p:r"+i],["p:"+i+","+s,"p:r"+i]],show:["p:r"+i]};
    return{f:tv(rw)+":\\quad a="+tn(a)+(a.sign()===0?"=0":"<0")+"\\ \\Rightarrow\\ "+txt("пропускаем"),moves:[],src:["p:"+i+","+s],show:["p:r"+i]}});
  var lines=t.rows.map(function(rw,i){var a=t.M[i][s];if(rs[i])return "<li>"+im(tv(rw)+":\\ \\frac{"+tn(t.M[i][n])+"}{"+tn(a)+"}="+tn(rs[i]))+(i===r?" ← минимум":"")+"</li>";return "<li>"+nm(rw)+": элемент "+im(tn(a))+(a.sign()===0?" = 0":" &lt; 0")+" — пропускаем</li>"}).join("");
  steps.push({title:"Ищем ведущую строку",stage:stage1({hiCol:s,ratios:rs,minRow:r}),anim:rAnim,
    text:'<p>Делим b на <b>положительные</b> элементы столбца '+nm(xs)+':</p><ul>'+lines+'</ul><p>Отношение показывает, насколько можно увеличить '+nm(xs)+', пока базисная переменная этой строки не станет 0. Берём минимум, иначе какая-то переменная уйдёт в минус. Ведущая строка — <b>'+nm(xr)+'</b>.</p>'});
  steps.push({title:"Ведущий элемент",stage:stage1({hiCol:s,hiRow:r,pivot:[r,s]}),
    text:'<p>На пересечении — ведущий элемент '+im("p="+tn(p))+'.</p><p>'+nm(xs)+' входит в базис, '+nm(xr)+' выходит. В новой таблице они поменяются местами: '+nm(xs)+' станет строкой, '+nm(xr)+' — столбцом. Остальные подписи остаются на своих местах.</p>'});
  return steps.concat(jordanSteps(t,k,r,s,nt,o))}

function jordanSteps(t,k,r,s,nt,o){var steps=[],lab=t.objs[k],xs=t.cols[s],xr=t.rows[r],p=t.M[r][s],base={cTop:o.costs,cB:o.costs};
  var info=pivotInfo(t,r,s,nt);
  function ordered(ph){return Object.keys(info).filter(function(kk){return info[kk].ph===ph}).map(function(kk){return{f:info[kk].f,moves:info[kk].src.map(function(x){return[x,kk]}),show:[kk],src:info[kk].src}})}
  var newCosts={cTop:o.costs,cB:o.costs};
  function stage2(ph){var cur={};Object.keys(info).forEach(function(kk){var v=info[kk];if(v.ph<=ph)cur[kk]=v});
    return {stage:function(){return '<div class="srow">'+renderTable(t,Object.assign({tid:"p",label:"было",hiCol:s,hiRow:r,pivot:[r,s]},base))+'<div class="arrow">⇒</div>'+renderTable(nt,Object.assign({tid:"n",label:"стало",blank:function(i,j){return info["n:"+i+","+j].ph>ph}},newCosts))+'</div>'},info:cur}}
  var sA=stage2(0);
  var swap={f:tv(xs)+"\\ \\leftrightarrow\\ "+tv(xr)+"\\quad "+txt("меняются местами вместе со своими c"),
    moves:[["p:h"+s,"n:l"+r],["p:l"+r,"n:h"+s],["p:ct"+s,"n:cb"+r],["p:cb"+r,"n:ct"+s]],show:["n:l"+r,"n:h"+s,"n:cb"+r,"n:ct"+s],src:["p:h"+s,"p:l"+r]};
  steps.push({title:"Жорданово преобразование: ведущий элемент",stage:sA.stage,info:sA.info,anim:[swap].concat(ordered(0)),
    text:'<p>Подписи меняются местами: '+nm(xs)+' уходит влево, '+nm(xr)+' — наверх. c<sub>B</sub> и c сверху переезжают вместе с переменными.</p><p>На место ведущего элемента пишем '+im("\\frac{1}{p}=\\frac{1}{"+tn(p)+"}="+tn(F(1).div(p)))+'.</p>'});
  var sB=stage2(1);
  steps.push({title:"Ведущая строка: делим на p",stage:sB.stage,info:sB.info,anim:ordered(1),
    text:'<p>Строка '+nm(xs)+' (бывшая '+nm(xr)+'): каждый элемент делим на '+im("p="+tn(p))+'.</p>'+dm("a_{\\text{нов}}=\\frac{a}{p}")+'<p>Это то же, что выразить '+nm(xs)+' из уравнения этой строки.</p>'});
  var sC=stage2(2);
  steps.push({title:"Ведущий столбец: делим на p и меняем знак",stage:sC.stage,info:sC.info,anim:ordered(2),
    text:'<p>Столбец '+nm(xr)+' (бывший '+nm(xs)+'): каждый элемент делим на p и меняем знак. Строка '+lab+' тоже считается.</p>'+dm("a_{\\text{нов}}=-\\frac{a}{p}")});
  var sD=stage2(3);
  steps.push({title:"Остальные клетки: правило прямоугольника",stage:sD.stage,info:sD.info,anim:ordered(3),
    text:'<p>Каждая оставшаяся клетка:</p>'+dm("a_{\\text{нов}}=\\frac{a\\cdot p-b\\cdot c}{p}")+'<p>a — старое значение клетки, b — элемент ведущей строки в том же столбце, c — элемент ведущего столбца в той же строке. Все четыре числа летят в новую клетку. После анимации можно навести на любую клетку и посмотреть ещё раз.</p>'});
  return steps}
function simplexSteps(t,o){var steps=[],k=o.k||0,guard=0;
  while(guard++<12){var s=chooseCol(t,k);if(s>=0&&o.force){var fs=o.force(t);if(fs>=0)s=fs}
    if(s<0){steps.push(o.finish?o.finish(t):optStep(t,k,o));break}
    var r=chooseRow(t,s);
    if(r<0){steps.push(unbStep(t,k,s,o));break}
    var nt=pivot(t,r,s);steps=steps.concat(iterSteps(t,k,r,s,nt,o));
    var leaving=t.rows[r];
    if(o.arts&&o.arts.indexOf(leaving)>=0){var jj=nt.cols.indexOf(leaving);steps.push(dropStep(nt,jj,leaving,o));nt=dropCol(nt,jj)}
    t=nt}
  return{steps:steps,t:t}}
function optStep(t,k,o){var n=t.cols.length,pl=plan(t,o.vars);
  return{title:"Все оценки ≥ 0 — оптимум",stage:function(){return '<div class="srow">'+renderTable(t,{tid:"p",cTop:o.costs,cB:o.costs,objHi:true})+(o.mini?o.mini(t):"")+'</div>'},
    text:'<p>В строке '+t.objs[k]+' нет отрицательных чисел, значит улучшать некуда.</p><p>Читаем ответ: базисные переменные ('+t.rows.map(nm).join(", ")+') равны своим b, небазисные ('+t.cols.map(nm).join(", ")+') равны 0, значение f — в углу.</p><p class="ans">'+im("x^*="+tvec(pl)+",\\quad f_{\\max}="+tn(t.O[k][n]))+'</p>'+(o.optExtra||"")}}
function unbStep(t,k,s,o){return{title:"Нр2: функция неограничена",stage:function(){return renderTable(t,{tid:"p",cTop:o.costs,cB:o.costs,hiCol:s,ratios:ratios(t,s)})},
  text:'<p>Δ у '+nm(t.cols[s])+' отрицательна, но в столбце нет положительных элементов. '+nm(t.cols[s])+' можно увеличивать бесконечно, f → +∞. Задача неразрешима (Нр2).</p>'}}
function dropStep(nt,j,w,o){return{title:"Вычёркиваем столбец w"+"₀₁₂₃₄₅₆₇₈₉"[+idx(w)],stage:function(){return renderTable(nt,{tid:"n",cTop:o.costs,cB:o.costs,struckCol:j})},
  text:'<p>Искусственная '+nm(w)+' вышла из базиса — теперь она <b>свободная, а свободные переменные равны 0</b>. Числа в её столбце — это не её значение, а коэффициенты: насколько изменятся базисные переменные, если '+nm(w)+' начать увеличивать.</p><p>Увеличивать её мы не будем никогда: вся фаза 1 нужна, чтобы искусственные стали нулями. Значит, этот столбец больше ни на что не влияет, и его вычёркивают.</p><p class="muted">В методичке столбец иногда держат до конца фазы 1 и вычёркивают потом (табл. 9). Результат одинаковый.</p>'}}

/* ---------- графики ---------- */
function clipPoly(P,a,b,c){var out=[];for(var i=0;i<P.length;i++){var A=P[i],B=P[(i+1)%P.length],va=a*A[0]+b*A[1]-c,vb=a*B[0]+b*B[1]-c;if(va<=1e-9)out.push(A);if((va<-1e-9&&vb>1e-9)||(va>1e-9&&vb<-1e-9)){var q=va/(va-vb);out.push([A[0]+q*(B[0]-A[0]),A[1]+q*(B[1]-A[1])])}}return out}
function regionOf(cons,R,quad){var P=[[R.x0,R.y0],[R.x1,R.y0],[R.x1,R.y1],[R.x0,R.y1]];if(quad!==false){P=clipPoly(P,-1,0,0);P=clipPoly(P,0,-1,0)}
  cons.forEach(function(k){var a=k.a[0],b=k.a[1];if(k.s==="<="||k.s==="=")P=clipPoly(P,a,b,k.c);if(k.s===">="||k.s==="=")P=clipPoly(P,-a,-b,-k.c)});return P}
function lineSeg(a,b,c,R){var pts=[];if(Math.abs(b)>1e-12){[R.x0,R.x1].forEach(function(x){var y=(c-a*x)/b;if(y>=R.y0-1e-9&&y<=R.y1+1e-9)pts.push([x,y])})}
  if(Math.abs(a)>1e-12){[R.y0,R.y1].forEach(function(y){var x=(c-b*y)/a;if(x>=R.x0-1e-9&&x<=R.x1+1e-9)pts.push([x,y])})}
  if(pts.length<2)return null;var best=[pts[0],pts[1]],bd=-1;for(var i=0;i<pts.length;i++)for(var j=i+1;j<pts.length;j++){var d=Math.hypot(pts[i][0]-pts[j][0],pts[i][1]-pts[j][1]);if(d>bd){bd=d;best=[pts[i],pts[j]]}}return best}
function plot(o){var U=o.U||34,R={x0:o.x0!=null?o.x0:-1,y0:o.y0!=null?o.y0:-1,x1:o.x1,y1:o.y1},pad=o.pad!=null?o.pad:22;
  var W=(R.x1-R.x0)*U+2*pad,H=(R.y1-R.y0)*U+2*pad;function X(x){return(pad+(x-R.x0)*U).toFixed(1)}function Y(y){return(pad+(R.y1-y)*U).toFixed(1)}
  var s='<svg class="gr" viewBox="0 0 '+W.toFixed(0)+' '+H.toFixed(0)+'" width="'+W.toFixed(0)+'" role="img" aria-label="'+(o.aria||"График")+'">';
  for(var x=Math.ceil(R.x0);x<=R.x1;x++)s+='<line class="gl" x1="'+X(x)+'" y1="'+Y(R.y0)+'" x2="'+X(x)+'" y2="'+Y(R.y1)+'"/>';
  for(var y=Math.ceil(R.y0);y<=R.y1;y++)s+='<line class="gl" x1="'+X(R.x0)+'" y1="'+Y(y)+'" x2="'+X(R.x1)+'" y2="'+Y(y)+'"/>';
  function poly(P,c){if(!P||P.length<3)return"";return '<polygon class="'+c+'" points="'+P.map(function(p){return X(p[0])+","+Y(p[1])}).join(" ")+'"/>'}
  (o.regions||[]).forEach(function(rg){s+=poly(regionOf(rg.cons,R,rg.quad),rg.cls||"reg")});
  s+='<line class="ax" x1="'+X(R.x0)+'" y1="'+Y(0)+'" x2="'+X(R.x1)+'" y2="'+Y(0)+'"/><line class="ax" x1="'+X(0)+'" y1="'+Y(R.y0)+'" x2="'+X(0)+'" y2="'+Y(R.y1)+'"/>';
  s+='<text class="axl" x="'+(+X(R.x1)-4)+'" y="'+(+Y(0)-6)+'" text-anchor="end">x₁</text><text class="axl" x="'+(+X(0)+6)+'" y="'+(+Y(R.y1)+12)+'">x₂</text>';
  var tk=o.tick||1;if(!o.noTicks){for(x=tk;x<R.x1;x+=tk)s+='<text class="tk" x="'+X(x)+'" y="'+(+Y(0)+12)+'" text-anchor="middle">'+x+'</text>';for(y=tk;y<R.y1;y+=tk)s+='<text class="tk" x="'+(+X(0)-5)+'" y="'+(+Y(y)+3.5)+'" text-anchor="end">'+y+'</text>';s+='<text class="tk" x="'+(+X(0)-5)+'" y="'+(+Y(0)+12)+'" text-anchor="end">0</text>'}
  (o.lines||[]).forEach(function(L){var sg=lineSeg(L.a[0],L.a[1],L.c,R);if(!sg)return;var isNew=(L.cls||"").indexOf("new")>=0;s+='<line class="cl '+(L.cls||"")+'"'+(isNew?' pathLength="1"':'')+' x1="'+X(sg[0][0])+'" y1="'+Y(sg[0][1])+'" x2="'+X(sg[1][0])+'" y2="'+Y(sg[1][1])+'"/>';
    if(L.label){var at=L.at||[(sg[0][0]+sg[1][0])/2,(sg[0][1]+sg[1][1])/2];s+='<text class="cll '+(L.cls||"")+'" x="'+X(at[0])+'" y="'+Y(at[1])+'">'+L.label+'</text>'}});
  if(o.level!=null&&o.grad){var sg2=lineSeg(o.grad[0],o.grad[1],o.level,R);if(sg2)s+='<line class="lvl" x1="'+X(sg2[0][0])+'" y1="'+Y(sg2[0][1])+'" x2="'+X(sg2[1][0])+'" y2="'+Y(sg2[1][1])+'"/>'}
  (o.segs||[]).forEach(function(g){s+='<line class="seg" x1="'+X(g[0][0])+'" y1="'+Y(g[0][1])+'" x2="'+X(g[1][0])+'" y2="'+Y(g[1][1])+'"/>'});
  if(o.path&&o.path.length>1)s+='<polyline class="path" points="'+o.path.map(function(p){return X(p[0])+","+Y(p[1])}).join(" ")+'"/>';
  if(o.grad&&o.showGrad!==false){var g=o.grad,len=Math.hypot(g[0],g[1]),sc=(o.gradLen||2)/len,ex=g[0]*sc,ey=g[1]*sc,ox=o.gradFrom?o.gradFrom[0]:0,oy=o.gradFrom?o.gradFrom[1]:0;
    var x2=+X(ox+ex),y2=+Y(oy+ey),ang=Math.atan2(-(ey),ex),hx=8;s+='<line class="grad" x1="'+X(ox)+'" y1="'+Y(oy)+'" x2="'+x2+'" y2="'+y2+'"/>';
    s+='<polygon class="gradh" points="'+x2+','+y2+' '+(x2-hx*Math.cos(ang-0.4)).toFixed(1)+','+(y2-hx*Math.sin(ang-0.4)).toFixed(1)+' '+(x2-hx*Math.cos(ang+0.4)).toFixed(1)+','+(y2-hx*Math.sin(ang+0.4)).toFixed(1)+'"/>';
    s+='<text class="ptl hi" x="'+(x2+6)+'" y="'+(y2-4)+'">C</text>'}
  (o.vecs||[]).forEach(function(v){var x2=+X(v.v[0]),y2=+Y(v.v[1]),ang=Math.atan2(-v.v[1],v.v[0]),hx=9;s+='<line class="vec '+(v.cls||"")+'" x1="'+X(0)+'" y1="'+Y(0)+'" x2="'+x2+'" y2="'+y2+'"/><polygon class="vech '+(v.cls||"")+'" points="'+x2+','+y2+' '+(x2-hx*Math.cos(ang-0.4)).toFixed(1)+','+(y2-hx*Math.sin(ang-0.4)).toFixed(1)+' '+(x2-hx*Math.cos(ang+0.4)).toFixed(1)+','+(y2-hx*Math.sin(ang+0.4)).toFixed(1)+'"/>';if(v.label)s+='<text class="ptl" x="'+(x2+(v.dx||6))+'" y="'+(y2+(v.dy||-6))+'">'+v.label+'</text>'});
  (o.tpts||[]).forEach(function(p){s+='<circle class="tp" cx="'+X(p[0])+'" cy="'+Y(p[1])+'" r="3.5"/>'});
  (o.pts||[]).forEach(function(p){s+='<circle class="pt '+(p.cls||"")+'" cx="'+X(p.x)+'" cy="'+Y(p.y)+'" r="'+(p.r||4)+'"/>';if(p.name)s+='<text class="ptl '+(p.cls||"")+'" x="'+(+X(p.x)+(p.dx!=null?p.dx:6))+'" y="'+(+Y(p.y)+(p.dy!=null?p.dy:-6))+'"'+(p.anchor?' text-anchor="'+p.anchor+'"':'')+'>'+p.name+'</text>'});
  return s+'</svg>'}

/* ---------- сквозная задача ---------- */
var Z={cons:[{a:[1,3],c:15,s:"<=",label:"(1)"},{a:[1,1],c:7,s:"<=",label:"(2)"},{a:[2,1],c:12,s:"<=",label:"(3)"}],grad:[2,3]};
var ZV=[{x:0,y:0,name:"O",dx:-12,dy:14},{x:6,y:0,name:"A",dx:2,dy:14},{x:5,y:2,name:"B"},{x:3,y:4,name:"C"},{x:0,y:5,name:"D",dx:-14,dy:-4}];
var ZR={x0:-0.8,y0:-0.8,x1:8.8,y1:8.4};
function zbase(extra){return Object.assign({x0:ZR.x0,y0:ZR.y0,x1:ZR.x1,y1:ZR.y1,U:34,aria:"ОДР сквозной задачи"},extra)}
var LAT=[[6.3,3.25],[6.2,0.95],[4.5,3.4]];
function zline(i,cls){var k=Z.cons[i];return{a:k.a,c:k.c,label:k.label,cls:cls,at:LAT[i]}}
var ZLD=[zline(0,"dim"),zline(1,"dim"),zline(2,"dim")];

var graphSteps=[
 {title:"Оси и условие x ≥ 0",stage:function(){return plot(zbase({regions:[{cons:[],cls:"reg2 fade"}]}))},
  text:"<p>Рисуем оси: x₁ по горизонтали, x₂ по вертикали. Условие "+im("x_1\\ge0,\\ x_2\\ge0")+" оставляет первую четверть — с ней и будем пересекать остальные ограничения.</p>"},
 {title:"Ограничение (1): x₁ + 3x₂ ≤ 15",stage:function(){return plot(zbase({regions:[{cons:[Z.cons[0]],cls:"reg fade"}],lines:[zline(0,"new")],tpts:[[0,5],[6,3],[0,0]]}))},
  text:"<p>Меняем ≤ на = и строим прямую "+im("x_1+3x_2=15")+" по двум точкам: "+im("x_1=0\\Rightarrow x_2=5")+". Вторая точка с осью (15; 0) далеко, поэтому возьмём "+im("x_2=3\\Rightarrow x_1=6")+". Точки (0; 5) и (6; 3).</p><p>Сторона: подставляем O(0; 0): "+im("0+0\\le15")+" — верно, значит нужная полуплоскость содержит начало координат.</p>"},
 {title:"Ограничение (2): x₁ + x₂ ≤ 7",stage:function(){return plot(zbase({regions:[{cons:[Z.cons[0],Z.cons[1]],cls:"reg fade"}],lines:[zline(0,"dim"),zline(1,"new")],tpts:[[0,7],[7,0]]}))},
  text:"<p>Прямая "+im("x_1+x_2=7")+" проходит через (0; 7) и (7; 0). Проверка O: "+im("0\\le7")+" — верно, берём сторону с началом координат.</p><p>Закрашена уже не полуплоскость, а пересечение: точки, которые удовлетворяют и (1), и (2).</p>"},
 {title:"Ограничение (3): 2x₁ + x₂ ≤ 12",stage:function(){return plot(zbase({regions:[{cons:Z.cons,cls:"reg fade"}],lines:[zline(0,"dim"),zline(1,"dim"),zline(2,"new")],tpts:[[6,0],[4,4]]}))},
  text:"<p>Прямая "+im("2x_1+x_2=12")+": "+im("x_2=0\\Rightarrow x_1=6")+"; "+im("x_1=4\\Rightarrow x_2=4")+". Точки (6; 0) и (4; 4). Проверка O: "+im("0\\le12")+" — верно.</p>"},
 {title:"ОДР — многоугольник OABCD",stage:function(){return plot(zbase({regions:[{cons:Z.cons,cls:"regb"}],lines:ZLD,pts:ZV}))},
  text:"<p>Пересечение всех полуплоскостей — выпуклый пятиугольник, это множество X. Его вершины — опорные решения:</p><ul><li>O(0; 0); A(6; 0) — (3) с осью; D(0; 5) — (1) с осью;</li><li>B = (2)∩(3): вычитаем, "+im("x_1=5,\\ x_2=2")+";</li><li>C = (1)∩(2): вычитаем, "+im("2x_2=8\\Rightarrow x_2=4,\\ x_1=3")+".</li></ul><p>Оптимум будет в одной из вершин.</p>"},
 {title:"Вектор C и линия уровня",stage:function(){return plot(zbase({regions:[{cons:Z.cons,cls:"regb"}],lines:ZLD,pts:ZV,grad:Z.grad,level:6,gradLen:2.4}))},
  text:"<p>"+im("C=(2;\\,3)")+" — коэффициенты f. Это направление, в котором f растёт быстрее всего.</p><p>Линия уровня — все точки, где f одинакова: "+im("2x_1+3x_2=\\alpha")+". Она всегда перпендикулярна C. На рисунке "+im("\\alpha=6")+".</p>"},
 {title:"Двигаем линию уровня",stage:function(){return '<div class="gwrap"><div class="gslot"></div><label class="alpha" for="alpha-z">α <input id="alpha-z" type="range" min="0" max="24" step="0.25" value="0"><output>f = 0</output></label></div>'},
  after:function(st,sp){var slot=st.querySelector(".gslot"),inp=st.querySelector("#alpha-z"),out=st.querySelector("output"),tok=sp.tok;
    function draw(){var a=+inp.value;var pts=ZV.map(function(p){var v=2*p.x+3*p.y;return Object.assign({},p,{cls:Math.abs(v-a)<0.13?"hi":""})});
      slot.innerHTML=plot(zbase({regions:[{cons:Z.cons,cls:"regb"}],lines:ZLD,pts:pts,grad:Z.grad,level:a,gradLen:2.4}));
      out.textContent="f = "+(Math.round(a*4)/4)+(a>18.1?" — мимо ОДР":Math.abs(a-18)<0.13?" — касание в C":"")}
    var stop=false;inp.oninput=function(){stop=true;draw()};draw();
    if(RM){inp.value=18;draw();return}
    var t0=null,dur=3400/SPEED;function tick(ts){if(stop||sp.tok!==tok)return;if(t0===null)t0=ts;var q=Math.min(1,(ts-t0)/dur);var e=q<.5?2*q*q:1-Math.pow(-2*q+2,2)/2;inp.value=(18*e).toFixed(2);draw();if(q<1)requestAnimationFrame(tick)}
    requestAnimationFrame(tick)},
  text:"<p>Линия уровня "+im("2x_1+3x_2=\\alpha")+" сама проезжает от 0 до 18, потом можно тянуть ползунок руками. Пока линия пересекает ОДР, такое значение f достижимо.</p><p>При "+im("\\alpha=15")+" она проходит через D, при "+im("\\alpha=16")+" — через B, при "+im("\\alpha=18")+" касается многоугольника только в C. Дальше общих точек нет.</p>"},
 {title:"Максимум в точке C",stage:function(){return plot(zbase({regions:[{cons:Z.cons,cls:"regb"}],lines:[zline(0,""),zline(1,""),zline(2,"dim")],pts:ZV.map(function(p){return p.name==="C"?Object.assign({},p,{cls:"hi",name:"C(3; 4)"}):p}),grad:Z.grad,level:18,gradLen:2.4}))},
  text:"<p>Последняя точка касания — C, она лежит на прямых (1) и (2). Решаем систему:</p>"+dm("\\begin{cases}x_1+3x_2=15\\\\x_1+x_2=7\\end{cases}\\ \\Rightarrow\\ 2x_2=8,\\quad x_2=4,\\quad x_1=3")+"<p class='ans'>"+im("x^*_{\\max}=(3;\\,4),\\quad f_{\\max}=2\\cdot3+3\\cdot4=18")+"</p><p>Проверка по вершинам: f(O) = 0, f(A) = 12, f(B) = 16, f(C) = 18, f(D) = 15. Мастерской выгодно делать 3 стола и 4 полки.</p>"},
 {title:"Минимум: двигаем против C",stage:function(){return plot(zbase({regions:[{cons:Z.cons,cls:"regb"}],lines:ZLD,pts:ZV.map(function(p){return p.name==="O"?Object.assign({},p,{cls:"hi"}):p}),grad:Z.grad,level:0,gradLen:2.4}))},
  text:"<p>Для min линию уровня двигаем в обратную сторону. Последняя точка ОДР — O(0; 0).</p><p class='ans'>"+im("x^*_{\\min}=(0;\\,0),\\quad f_{\\min}=0")+"</p><p>Оба оптимума единственные: линия уровня не параллельна ни одной стороне.</p>"}
];

function miniZ(visited){return function(t){var x1=plan(t,["x1"])[0].val(),x2=plan(t,["x2"])[0].val();
  var vis=visited.filter(function(p){return !(p[0]===x1&&p[1]===x2)}).map(function(p){return{x:p[0],y:p[1],cls:"vis",r:3.5}});
  return '<div class="mini">'+plot({x0:-0.6,y0:-0.6,x1:7.6,y1:6.6,U:20,pad:12,tick:2,regions:[{cons:Z.cons,cls:"regb"}],path:visited,pts:vis.concat([{x:x1,y:x2,cls:"hi",name:"("+x1+"; "+x2+")",r:5,dx:x1>4?-8:6,anchor:x1>4?"end":null}]),aria:"Текущая вершина на ОДР"})+'</div>'}}

function simplexDemo(){var costs={x1:2,x2:3};var t0=addObj(mk(["x1","x2"],["x3","x4","x5"],[[1,3],[1,1],[2,1]],[15,7,12]),"Δ",costs);
  var vars=["x1","x2","x3","x4","x5"];
  var info0=objInfo(t0,0,costs,"p");
  var visited=[[0,0]];var tt=t0,g=0;while(g++<10){var s=chooseCol(tt,0);if(s<0)break;tt=pivot(tt,chooseRow(tt,s),s);visited.push([plan(tt,["x1"])[0].val(),plan(tt,["x2"])[0].val()])}
  function mini(t){var x1=plan(t,["x1"])[0].val(),x2=plan(t,["x2"])[0].val();var i=visited.findIndex(function(p){return p[0]===x1&&p[1]===x2});return miniZ(visited.slice(0,i+1))(t)}
  var steps=[
   {title:"Каноническая форма",stage:dm("\\begin{array}{l}f=2x_1+3x_2+0x_3+0x_4+0x_5\\to\\max\\\\[6pt]\\begin{cases}x_1+3x_2+x_3=15\\\\x_1+x_2+x_4=7\\\\2x_1+x_2+x_5=12\\\\x_j\\ge0,\\ j=\\overline{1,5}\\end{cases}\\end{array}"),
    text:"<p>К каждому ≤ прибавили свою балансовую переменную: x₃ — остаток досок, x₄ — неиспользованные часы, x₅ — остаток лака. В f они входят с нулём: остатки прибыли не приносят.</p><p>Все b ≥ 0, столбцы при x₃, x₄, x₅ единичные — готовый базис "+im("B=\\{A^3,A^4,A^5\\}")+". Можно запускать обычный симплекс.</p>"},
   {title:"Начальная таблица",stage:function(){return '<div class="srow">'+renderTable(t0,{tid:"p",cTop:costs,cB:costs,info:info0})+mini(t0)+'</div>'},info:info0,anim:infoAnim(info0),
    text:"<p>Строки — базисные x₃, x₄, x₅, столбцы — небазисные x₁, x₂. Сверху c небазисных (2 и 3), слева c<sub>B</sub> базисных (все 0).</p><p>Строка Δ считается по формуле — смотри, как числа собираются в каждую клетку:</p>"+dm("\\Delta_j=(c_B,A^j)-c_j,\\qquad f=(c_B,b)")+"<p>Опорное решение "+im("x=(0;\\,0;\\,15;\\,7;\\,12),\\ f=0")+" — это вершина O на графике.</p>"}];
  var res=simplexSteps(t0,{costs:costs,vars:vars,mini:mini,
    optExtra:"<p>В исходных переменных "+im("x^*=(3;\\,4),\\ f_{\\max}=18")+" — та же точка C, что и в графическом методе. Симплекс прошёл путь O → D → C: две итерации, каждая — переход в соседнюю вершину с бóльшим f.</p><p>Остатки: x₃ = 0 и x₄ = 0 — доски и часы израсходованы полностью, x₅ = 2 — две банки лака лишние.</p>"});
  return steps.concat(res.steps)}

function artDemo(){var c1={w1:-1,w2:-1};var costs={x1:2,x2:1};
  var t0=addObj(mk(["x1","x2","x3"],["w1","w2","x4"],[[1,1,-1],[1,-1,0],[0,1,0]],[2,1,3]),"F",c1);
  var info0=objInfo(t0,0,c1,"p");
  var steps=[
   {title:"Каноническая форма — ищем базис",stage:dm("\\begin{array}{l}f=2x_1+x_2\\to\\max\\\\[6pt]\\begin{cases}x_1+x_2-x_3=2&\\text{(было }\\ge\\text{, вычли }x_3)\\\\x_1-x_2=1&\\text{(было =)}\\\\x_2+x_4=3&\\text{(было }\\le\\text{, прибавили }x_4)\\\\x\\ge0\\end{cases}\\end{array}"),
    text:"<p>Ищем единичные столбцы. "+im("A^4=(0;0;1)")+" — единичный, он закрывает третью строку. У x₃ столбец "+im("(-1;0;0)")+": минус единица не подходит. В первых двух строках «своей» переменной с +1 нет.</p><p>Полного базиса нет, обычный симплекс не стартует. Добавляем искусственные w₁ и w₂ в строки 1 и 2.</p>"},
   {title:"Вспомогательная задача",stage:dm("\\begin{array}{l}F=-w_1-w_2\\to\\max\\\\[6pt]\\begin{cases}x_1+x_2-x_3+w_1=2\\\\x_1-x_2+w_2=1\\\\x_2+x_4=3\\\\x\\ge0,\\ w\\ge0\\end{cases}\\end{array}"),
    text:"<p>Теперь базис есть: {w₁, w₂, x₄}, начальная точка x = 0, w₁ = 2, w₂ = 1, x₄ = 3.</p><p>Но исходные уравнения выполняются, только если w₁ = w₂ = 0. Поэтому максимизируем "+im("F=-w_1-w_2")+": F ≤ 0, и F = 0 только при нулевых w. Если дойдём до F = 0, получим допустимую точку исходной задачи.</p>"},
   {title:"Начальная таблица фазы 1",stage:function(){return renderTable(t0,{tid:"p",cTop:c1,cB:c1,info:info0})},info:info0,anim:infoAnim(info0),
    text:"<p>c<sub>B</sub> = −1 у w₁ и w₂ (в F они с минусом), 0 у x₄. Сверху все нули: x в F не входят.</p><p>Строка F считается по той же формуле, что и Δ:</p>"+dm("F_1=(-1)\\cdot1+(-1)\\cdot1+0\\cdot0-0=-2,\\qquad F=(-1)\\cdot2+(-1)\\cdot1+0\\cdot3=-3")+"<p>Угол −3 значит, что сейчас w₁ + w₂ = 3.</p>"}];
  var r1=simplexSteps(t0,{costs:c1,arts:["w1","w2"],vars:["x1","x2","x3","x4"],
    finish:function(t){return{title:"Фаза 1 закончена: max F = 0",stage:function(){return renderTable(t,{tid:"p",cTop:c1,cB:c1,objHi:true})},
      text:"<p>Все оценки F ≥ 0 и угол F = 0. Обе w вне базиса, значит равны 0. Найдена допустимая точка исходной задачи:</p>"+dm("x_1=\\tfrac32,\\ x_2=\\tfrac12,\\ x_3=0,\\ x_4=\\tfrac52")+"<p>Проверка: "+im("\\tfrac32+\\tfrac12=2\\ \\checkmark,\\quad \\tfrac32-\\tfrac12=1\\ \\checkmark,\\quad \\tfrac12+\\tfrac52=3\\ \\checkmark")+".</p>"}}});
  var tP=r1.t;var t1=addObj(dropObj(tP,0),"f",costs);var info1=objInfo(t1,0,costs,"p");
  steps=steps.concat(r1.steps);
  steps.push({title:"Вычёркиваем F, считаем f-строку",stage:function(){return renderTable(t1,{tid:"p",cTop:costs,cB:costs,info:info1})},info:info1,anim:infoAnim(info1),
    text:"<p>F больше не нужна. Ставим настоящие коэффициенты: сверху c₃ = 0, слева c<sub>B</sub> = (1; 2; 0) для x₂, x₁, x₄.</p>"+dm("\\Delta_3=1\\cdot\\left(-\\tfrac12\\right)+2\\cdot\\left(-\\tfrac12\\right)+0\\cdot\\tfrac12-0=-\\tfrac32,\\qquad f=1\\cdot\\tfrac12+2\\cdot\\tfrac32+0\\cdot\\tfrac52=\\tfrac72")+"<p>Это начальная таблица исходной задачи. Дальше — фаза 2, обычный симплекс.</p>"});
  var r2=simplexSteps(t1,{costs:costs,vars:["x1","x2","x3","x4"],optExtra:"<p>В исходных переменных "+im("x^*=(4;\\,3),\\ f_{\\max}=2\\cdot4+3=11")+". Проверка: 4 + 3 ≥ 2 ✓, 4 − 3 = 1 ✓, 3 ≤ 3 ✓.</p>"});
  return steps.concat(r2.steps)}

function dualDemo(){
  var A=[[1,3],[1,1],[2,1]],b=[15,7,12],c=[2,3];
  function mx(hl){hl=hl||{};var h='<div class="tw"><table class="st" style="font-size:.95rem"><tr class="hd"><th></th>'+'<th class="colh'+(hl.col===0?" hc":"")+'">x<sub>1</sub></th><th class="colh'+(hl.col===1?" hc":"")+'">x<sub>2</sub></th><th></th><th class="colh bh">b</th></tr>';
    A.forEach(function(r,i){h+='<tr class="'+(i===0?"r0":"")+'"><th class="rl'+(hl.y?" hc":"")+'" data-k="m:y'+i+'">'+(hl.y?"y<sub>"+(i+1)+"</sub>":"("+(i+1)+")")+'</th>';r.forEach(function(v,j){h+='<td class="cell'+(j===0?" first":"")+(hl.col===j?" hc":"")+'" data-k="m:'+i+','+j+'">'+v+'</td>'});h+='<td class="cell'+(hl.sign?" pv":"")+'" style="min-width:34px" data-k="m:s'+i+'">≤</td><td class="cell bcol'+(hl.b?" hc":"")+'" data-k="m:b'+i+'">'+b[i]+'</td></tr>'});
    h+='<tr class="ob"><th class="rl">c</th>'+c.map(function(v,j){return '<td class="cell'+(j===0?" first":"")+(hl.c===j?" hc":"")+'" data-k="m:c'+j+'">'+v+'</td>'}).join("")+'<td class="cell" style="min-width:34px">→</td><td class="cell bcol">max</td></tr></table></div>';return h}
  var L=["g=15y_1+7y_2+12y_3\\to\\min","y_1+y_2+2y_3\\ge2","3y_1+y_2+y_3\\ge3","y_1\\ge0,\\ y_2\\ge0,\\ y_3\\ge0"];
  function out(n){var h='<div class="tlines">';for(var i=0;i<n;i++)h+='<div class="tl" data-k="o:L'+i+'">'+im(L[i])+'</div>';return h+'</div>'}
  function row(a,b){return '<div class="srow">'+a+b+'</div>'}
  var costs={x1:2,x2:3};var t=addObj(mk(["x1","x2"],["x3","x4","x5"],A,b),"Δ",costs);
  var tt=t,g=0;while(g++<10){var s=chooseCol(tt,0);if(s<0)break;tt=pivot(tt,chooseRow(tt,s),s)}
  var fin=tt,j3=fin.cols.indexOf("x3"),j4=fin.cols.indexOf("x4"),r5=fin.rows.indexOf("x5");var mk1={};mk1["p:3,"+j3]=1;mk1["p:3,"+j4]=1;
  var Y=["y_1=\\Delta_3+c_3="+tn(fin.O[0][j3])+"+0="+tn(fin.O[0][j3]),"y_2=\\Delta_4+c_4="+tn(fin.O[0][j4])+"+0="+tn(fin.O[0][j4]),"y_3=\\Delta_5=0\\quad("+txt("x₅ базисная")+")"];
  function yout(){return '<div class="tlines">'+Y.map(function(y,i){return '<div class="tl" data-k="o:Y'+i+'">'+im(y)+'</div>'}).join("")+'</div>'}
  return[
   {title:"Прямая задача в стандартной форме",stage:mx(),text:"<p>Двойственную удобно строить, когда прямая задача на max, все ограничения ≤ и x ≥ 0. Наша мастерская уже такая. Выпишем коэффициенты как матрицу: строки — ограничения, столбцы — переменные, справа b, снизу c.</p>"},
   {title:"Каждому ограничению — своя y",stage:mx({y:true}),text:"<p>Вводим двойственные переменные по числу ограничений: y₁ — цена м² досок, y₂ — цена часа работы, y₃ — цена банки лака.</p><p>Ограничений 3 — значит в двойственной задаче 3 переменные.</p>"},
   {title:"Целевая функция: из столбца b",stage:row(mx({y:true,b:true}),out(1)),anim:[{f:"g=15y_1+7y_2+12y_3\\to\\min",moves:[["m:b0","o:L0"],["m:b1","o:L0"],["m:b2","o:L0"]],show:["o:L0"]}],
    text:"<p>Коэффициенты g — это правые части b прямой задачи: 15, 7, 12. Смысл: стоимость всех ресурсов по ценам y. max меняется на min — покупатель хочет заплатить поменьше.</p>"},
   {title:"Ограничение по столбцу x₁",stage:row(mx({y:true,col:0,c:0}),out(2)),anim:[{f:"1\\cdot y_1+1\\cdot y_2+2\\cdot y_3\\ge c_1=2",moves:[["m:0,0","o:L1"],["m:1,0","o:L1"],["m:2,0","o:L1"],["m:c0","o:L1"]],show:["o:L1"]}],
    text:"<p>Столбец при x₁ (1; 1; 2) становится строкой коэффициентов первого ограничения, справа — c₁ = 2.</p><p>Смысл: ресурсы на один стол (1 м² досок, 1 час, 2 банки лака) должны стоить не меньше прибыли от стола. Знак ≥, потому что x₁ ≥ 0.</p>"},
   {title:"Ограничение по столбцу x₂",stage:row(mx({y:true,col:1,c:1}),out(3)),anim:[{f:"3\\cdot y_1+1\\cdot y_2+1\\cdot y_3\\ge c_2=3",moves:[["m:0,1","o:L2"],["m:1,1","o:L2"],["m:2,1","o:L2"],["m:c1","o:L2"]],show:["o:L2"]}],
    text:"<p>Столбец при x₂ (3; 1; 1) и справа c₂ = 3. Двух столбцов в A — два ограничения двойственной. Это и есть транспонирование: столбцы A стали строками.</p>"},
   {title:"Знаки переменных",stage:row(mx({y:true,sign:true}),out(4)),anim:[{f:"\\le\\ \\Rightarrow\\ y_i\\ge0",moves:[["m:s0","o:L3"],["m:s1","o:L3"],["m:s2","o:L3"]],show:["o:L3"]}],
    text:"<p>Все ограничения прямой задачи со знаком ≤ → все y ≥ 0. Было бы «=», соответствующая y была бы любого знака; было бы «≥» — y ≤ 0.</p><p>Двойственная построена. Решать её отдельно не нужно: ответ уже лежит в оптимальной симплекс-таблице прямой задачи.</p>"},
   {title:"y* из строки Δ",stage:function(){return row(renderTable(fin,{tid:"p",cTop:costs,cB:costs,mark:mk1}),yout())},
    anim:[{f:Y[0],moves:[["p:3,"+j3,"o:Y0"]],show:["o:Y0"]},{f:Y[1],moves:[["p:3,"+j4,"o:Y1"]],show:["o:Y1"]},{f:Y[2],moves:[["p:l"+r5,"o:Y2"]],show:["o:Y2"]}],
    text:"<p>Оптимальная таблица из симплекс-разбора. В исходной матрице единичными были столбцы балансовых x₃, x₄, x₅, и у них c = 0. Формула:</p>"+dm("y_i=\\Delta_j+c_j\\qquad(A^j=e_i)")+"<p>У базисной переменной Δ = 0, поэтому y₃ = 0.</p><p class='ans'>"+im("y^*=\\left(\\tfrac12;\\ \\tfrac32;\\ 0\\right)")+"</p>"},
   {title:"Проверка: g* = f*",stage:dm("\\begin{array}{l}g(y^*)=15\\cdot\\tfrac12+7\\cdot\\tfrac32+12\\cdot0=7{,}5+10{,}5=18=f^*\\ \\checkmark\\\\[8pt]\\tfrac12+\\tfrac32+0=2\\ge2\\ \\checkmark\\quad(\\text{равенство, }x_1^*=3>0)\\\\[4pt]3\\cdot\\tfrac12+\\tfrac32+0=3\\ge3\\ \\checkmark\\quad(\\text{равенство, }x_2^*=4>0)\\end{array}"),
    text:"<p>По основной теореме двойственности оптимальные значения совпадают, так и вышло.</p><p>Дополняющая нежёсткость тоже сходится: x₁*, x₂* &gt; 0, поэтому оба ограничения двойственной выполняются как равенства. Третье ограничение прямой строгое ("+im("2\\cdot3+4=10<12")+", x₅ = 2), поэтому y₃ = 0.</p>"},
   {title:"Способ 2: y* = c_B · B⁻¹",stage:dm("\\begin{array}{c}B=\\begin{pmatrix}3&1&0\\\\1&1&0\\\\1&2&1\\end{pmatrix}\\qquad B^{-1}=\\begin{pmatrix}\\tfrac12&-\\tfrac12&0\\\\-\\tfrac12&\\tfrac32&0\\\\\\tfrac12&-\\tfrac52&1\\end{pmatrix}\\\\[6pt]\\text{столбцы }B:\\ A^2,\\ A^1,\\ A^5\\qquad c_B=(3;\\ 2;\\ 0)\\\\[10pt]y^*=c_BB^{-1}=\\left(3\\cdot\\tfrac12-2\\cdot\\tfrac12;\\ \\ -3\\cdot\\tfrac12+2\\cdot\\tfrac32;\\ \\ 0\\right)=\\left(\\tfrac12;\\ \\tfrac32;\\ 0\\right)\\ \\checkmark\\end{array}"),
    text:"<p>B — столбцы исходной матрицы при базисных переменных, в порядке строк оптимальной таблицы (x₂, x₁, x₅): "+im("A^2=(3;1;1),\\ A^1=(1;1;2),\\ A^5=(0;0;1)")+".</p><p>B⁻¹ не надо считать заново, её столбцы есть в таблице: 1-й — столбец x₃, 2-й — столбец x₄. x₅ базисная в 3-й строке, поэтому 3-й столбец — (0; 0; 1).</p><p>Умножаем строку c<sub>B</sub> на B⁻¹ (строка на столбец). Результат тот же.</p>"},
   {title:"Что значат числа y*",stage:dm("\\begin{array}{ll}y_1^*=\\tfrac12&\\text{+1 м² досок даст +0,5 тыс. ₽ прибыли}\\\\[4pt]y_2^*=\\tfrac32&\\text{+1 час работы даст +1,5 тыс. ₽}\\\\[4pt]y_3^*=0&\\text{лака и так 2 банки в остатке, ещё одна бесполезна}\\end{array}"),
    text:"<p>y* — теневые цены ресурсов: на сколько вырастет f*, если запас ресурса увеличить на единицу (пока базис не меняется). Дефицитные ресурсы получают положительную цену, избыточные — ноль.</p><p>Для контрольной важнее техника, но этот смысл помогает не путать, какая y к чему относится.</p>"}
  ]}

/* ---------- решения практики ---------- */
function solSimplex(t,k,costs,arts){var h="",guard=0;
  while(guard++<12){var s=chooseCol(t,k);
    if(s<0){h+=renderTable(t,{cTop:costs,cB:costs,objHi:true});break}
    var r=chooseRow(t,s),rs=ratios(t,s);
    if(r<0){h+=renderTable(t,{cTop:costs,cB:costs,hiCol:s,ratios:rs});break}
    h+=renderTable(t,{cTop:costs,cB:costs,hiCol:s,ratios:rs,minRow:r,pivot:[r,s]})+'<div class="arrow">⇒</div>';
    var nt=pivot(t,r,s),lv=t.rows[r];if(arts&&arts.indexOf(lv)>=0)nt=dropCol(nt,nt.cols.indexOf(lv));t=nt}
  return{h:h,t:t}}
var SX={
  S1:{cols:["x1","x2"],rows:["x3","x4","x5"],A:[[1,1],[1,3],[1,0]],b:[4,9,3],c:{x1:3,x2:2}},
  S2:{cols:["x1","x2","x3"],rows:["x4","x5"],A:[[2,1,1],[1,2,4]],b:[8,12],c:{x1:-1,x2:2,x3:3}},
  S3:{cols:["x1","x2"],rows:["x3","x4"],A:[[1,-1],[-2,1]],b:[2,2],c:{x1:1,x2:1}}};
var AX={
  A1:{cols:["x1","x2","x3"],rows:["w1","w2"],A:[[1,1,0],[1,0,-1]],b:[5,1],c:{x1:1,x2:3},arts:["w1","w2"]},
  A2:{cols:["x1","x2","x4"],rows:["x3","w1"],A:[[1,1,0],[1,1,-1]],b:[2,4],c:{x1:1,x2:1},arts:["w1"]}};

function fillPractice(){
  root.querySelectorAll("[data-sx]").forEach(function(el){var d=SX[el.getAttribute("data-sx")];el.innerHTML=solSimplex(addObj(mk(d.cols,d.rows,d.A,d.b),"Δ",d.c),0,d.c).h});
  root.querySelectorAll("[data-final]").forEach(function(el){var d=SX[el.getAttribute("data-final")];var r=solSimplex(addObj(mk(d.cols,d.rows,d.A,d.b),"Δ",d.c),0,d.c);var t=r.t,m={};["x3","x4","x5"].forEach(function(v){var j=t.cols.indexOf(v);if(j>=0)m["t:"+t.rows.length+","+j]=1});el.innerHTML='<span class="pen">оптимальная таблица из С1:</span>'+renderTable(t,{cTop:d.c,cB:d.c,mark:m})});
  root.querySelectorAll("[data-ax]").forEach(function(el){var d=AX[el.getAttribute("data-ax")];var ca={};d.arts.forEach(function(a){ca[a]=-1});
    var r=solSimplex(addObj(mk(d.cols,d.rows,d.A,d.b),"F",ca),0,ca,d.arts);var t=r.t,n=t.cols.length;var h='<span class="pen">фаза 1</span>'+r.h;
    if(t.O[0][n].sign()<0){el.innerHTML=h;return}
    var t2=addObj(dropObj(t,0),"f",d.c);h+='<div class="arrow">⇒</div><span class="pen">F = 0, вычёркиваем, считаем f</span>'+solSimplex(t2,0,d.c).h;el.innerHTML=h});
  var G={
   G1:plot({x0:-0.6,y0:-0.6,x1:8.6,y1:6.6,U:30,regions:[{cons:[{a:[1,2],c:8,s:"<="},{a:[3,1],c:9,s:"<="}],cls:"regb"}],lines:[{a:[1,2],c:8,label:"(1)",at:[5.6,1.6]},{a:[3,1],c:9,label:"(2)",at:[1.3,5.4]}],grad:[1,1],gradLen:1.6,level:5,pts:[{x:0,y:0,name:"O",dx:-12,dy:14},{x:3,y:0,name:"A",dy:14},{x:2,y:3,name:"B",cls:"hi"},{x:0,y:4,name:"C",dx:-14}],aria:"Решение Г1"}),
   G2:plot({x0:-0.6,y0:-0.6,x1:7.6,y1:4.6,U:32,regions:[{cons:[{a:[1,2],c:6,s:"<="},{a:[1,0],c:4,s:"<="}],cls:"regb"}],lines:[{a:[1,2],c:6,label:"(1)",at:[5.2,0.7]},{a:[1,0],c:4,label:"(2)",at:[4.15,3.9]}],grad:[2,4],gradLen:1.6,level:12,segs:[[[4,1],[0,3]]],pts:[{x:0,y:0,name:"O",dx:-12,dy:14},{x:4,y:0,name:"A",dy:14},{x:4,y:1,name:"B",cls:"hi"},{x:0,y:3,name:"C",cls:"hi",dx:-14}],aria:"Решение Г2"}),
   G3:plot({x0:-0.6,y0:-0.6,x1:7.6,y1:5.6,U:30,regions:[{cons:[{a:[1,1],c:2,s:">="},{a:[-1,1],c:1,s:"<="}],cls:"regb"}],lines:[{a:[1,1],c:2,label:"(1)",at:[0.2,1.3]},{a:[-1,1],c:1,label:"(2)",at:[3.3,4.7]}],grad:[1,3],gradLen:1.6,gradFrom:[4,1],pts:[{x:2,y:0,name:"A",cls:"hi",dy:14},{x:0.5,y:1.5,name:"B",dx:-14}],aria:"Решение Г3"})};
  root.querySelectorAll("[data-g]").forEach(function(el){el.innerHTML=G[el.getAttribute("data-g")]});
  var wi={
   "wi-empty":plot({x0:-0.6,y0:-0.6,x1:4.6,y1:4.6,U:26,tick:2,regions:[{cons:[{a:[2,1],c:4,s:">="}],cls:"reg2"},{cons:[{a:[1,3],c:1,s:"<="}],cls:"reg"}],lines:[{a:[2,1],c:4,label:"(1)",at:[2.1,1.2]},{a:[1,3],c:1,label:"(2)",at:[0.3,0.6]}],aria:"Пустая ОДР"}),
   "wi-unb":plot({x0:-0.6,y0:-0.6,x1:6.6,y1:6.6,U:24,tick:2,regions:[{cons:[{a:[-1,1],c:2,s:"<="},{a:[1,-2],c:2,s:"<="}],cls:"regb"}],lines:[{a:[-1,1],c:2},{a:[1,-2],c:2}],grad:[1,1],gradLen:1.5,gradFrom:[3,2],pts:[{x:0,y:0,cls:"hi",name:"min",dx:6,dy:14}],aria:"Неограниченная ОДР"}),
   "wi-alt":plot({x0:-0.6,y0:-0.6,x1:7.6,y1:4.6,U:26,tick:2,regions:[{cons:[{a:[1,2],c:7,s:"<="},{a:[-1,1],c:2,s:"<="},{a:[2,-1],c:4,s:"<="}],cls:"regb"}],lines:[{a:[1,2],c:7,cls:"dim"},{a:[-1,1],c:2,cls:"dim"},{a:[2,-1],c:4,cls:"dim"}],segs:[[[1,3],[3,2]]],pts:[{x:1,y:3,name:"B",cls:"hi",dx:-14},{x:3,y:2,name:"C",cls:"hi"}],aria:"Альтернативный оптимум на отрезке"})};
  Object.keys(wi).forEach(function(id){var el=$id(id);if(el)el.innerHTML=wi[id]})}

/* ---------- анатомия таблицы ---------- */
function anatomy(){var el=$id("anatomy");if(!el)return;var costs={x1:2,x2:3};var t=addObj(mk(["x1","x2"],["x3","x4","x5"],[[1,3],[1,1],[2,1]],[15,7,12]),"Δ",costs);
  var info=objInfo(t,0,costs,"a");el.innerHTML='<div class="srow">'+renderTable(t,{tid:"a",cTop:costs,cB:costs,info:info})+'</div><div class="sp-formula hint" id="anat-f">Наведи курсор или нажми на любую клетку строки Δ — увидишь формулу.</div>';
  var box=$id("anat-f");
  function h(e){var c=e.target.closest&&e.target.closest("[data-k]");if(!c)return;var inf=info[c.getAttribute("data-k")];if(!inf)return;el.querySelectorAll(".src,.hov").forEach(function(x){x.classList.remove("src","hov")});inf.src.forEach(function(k){var q=el.querySelector('[data-k="'+k+'"]');if(q)q.classList.add("src")});c.classList.add("hov");box.className="sp-formula";setTex(box,inf.f)}
  el.addEventListener("pointerover",function(e){if(e.pointerType!=="touch")h(e)});el.addEventListener("pointerdown",h);el.addEventListener("click",h)}

/* ---------- прогресс ---------- */
var KEYS=["base","graph","simplex","art","dual","dsim"];
function load(){try{return JSON.parse(localStorage.getItem("lp-progress")||"{}")}catch(e){return{}}}
function save(s){try{localStorage.setItem("lp-progress",JSON.stringify(s))}catch(e){}}
function syncProgress(){var st=load(),n=0;KEYS.forEach(function(k){var v=!!st[k];if(v)n++;var a=$id("r-"+k),b=$id("d-"+k);if(a)a.checked=v;if(b)b.checked=v;var li=root.querySelector('#route li[data-key="'+k+'"]');if(li)li.classList.toggle("done",v)});
  $id("prog-t").textContent=n+" из "+KEYS.length;$id("prog-b").style.width=(n/KEYS.length*100)+"%"}
KEYS.forEach(function(k){["r-","d-"].forEach(function(p){var e=$id(p+k);if(e)e.addEventListener("change",function(){var st=load();st[k]=e.checked;save(st);syncProgress()})})});

function navSpy(){var links=[].slice.call(root.querySelectorAll("nav.top a"));var secs=links.map(function(a){return root.querySelector(a.getAttribute("href"))});
  function on(){var y=window.scrollY+120,cur=-1;secs.forEach(function(s,i){if(s&&s.offsetTop<=y)cur=i});links.forEach(function(a,i){a.classList.toggle("on",i===cur)})}
  ctx.on(window,"scroll",on,{passive:true});on()}


function dml(x){return dm("\\begin{array}{l}"+x+"\\end{array}")}
/* ---------- теория: СЛАУ, ранг, базисные решения ---------- */
var SR={x0:-1,y0:-1,x1:9,y1:9,U:30};
function sp(extra){return Object.assign({x0:SR.x0,y0:SR.y0,x1:SR.x1,y1:SR.y1,U:SR.U,aria:"Прямые на плоскости"},extra)}
function twoCol(svg,tex){return '<div class="srow">'+svg+dml(tex)+'</div>'}
var L1={a:[1,1],c:7,label:"(1)",at:[6.3,1.2]},L2={a:[1,3],c:15,label:"(2)",at:[7.2,2.9]};
var slauSteps=[
 {title:"Одно уравнение — это прямая",stage:twoCol(plot(sp({lines:[Object.assign({cls:"new"},L1)],pts:[{x:0,y:7,name:"(0; 7)",cls:"vis"},{x:3,y:4,name:"(3; 4)",cls:"vis"},{x:7,y:0,name:"(7; 0)",cls:"vis",dy:14}]})),"x_1+x_2=7"),
  text:"<p>Уравнение с двумя неизвестными "+im("x_1+x_2=7")+" имеет бесконечно много решений: (0; 7), (3; 4), (7; 0), (2,5; 4,5)… Если отметить их все на плоскости, получится прямая.</p><p>Поэтому <b>решение одного уравнения — это любая точка его прямой</b>. Чтобы построить прямую, хватает двух точек: обычно берут x₁ = 0 и x₂ = 0.</p>"},
 {title:"Система — это несколько прямых",stage:twoCol(plot(sp({lines:[L1,Object.assign({cls:"new"},L2)],pts:[{x:3,y:4,name:"(3; 4)",cls:"hi"}]})),"\\begin{cases}x_1+x_2=7&(1)\\\\x_1+3x_2=15&(2)\\end{cases}"),
  text:"<p>Добавим второе уравнение — вторую прямую. Решение системы должно подходить <b>обоим</b> уравнениям сразу, то есть лежать на обеих прямых. Такая точка одна — пересечение.</p><p>По картинке видно, что это (3; 4). Осталось научиться находить её без рисования.</p>"},
 {title:"Метод Гаусса, шаг 1: вычитаем уравнения",stage:twoCol(plot(sp({lines:[L1,Object.assign({},L2,{cls:"dim"}),{a:[0,1],c:4,label:"(2′)",at:[7.4,4.25],cls:"new"}],pts:[{x:3,y:4,name:"(3; 4)",cls:"hi"}]})),"\\begin{cases}x_1+x_2=7&(1)\\\\x_1+3x_2=15&(2)\\end{cases}\\ \\xrightarrow{(2)-(1)}\\ \\begin{cases}x_1+x_2=7&(1)\\\\\\phantom{x_1+{}}2x_2=8&(2')\\end{cases}"),
  text:"<p>Вычтем (1) из (2): "+im("(x_1+3x_2)-(x_1+x_2)=15-7")+", получаем "+im("2x_2=8")+". x₁ исчезла — ради этого и вычитали.</p><p>Посмотри на график: прямая (2) повернулась и стала горизонтальной "+im("x_2=4")+", но <b>прошла через ту же точку</b>. Сложение и вычитание уравнений меняет прямые, но не меняет их общую точку. Это и есть суть метода Гаусса: упрощать уравнения, не теряя решения.</p>"},
 {title:"Шаг 2: подставляем",stage:twoCol(plot(sp({lines:[{a:[1,0],c:3,label:"x₁ = 3",at:[3.15,8.3],cls:"new"},{a:[0,1],c:4,label:"x₂ = 4",at:[7.2,4.25]}],pts:[{x:3,y:4,name:"(3; 4)",cls:"hi"}]})),"2x_2=8\\ \\Rightarrow\\ x_2=4\\\\[4pt]x_1=7-x_2=7-4=3"),
  text:"<p>Из "+im("2x_2=8")+" получаем "+im("x_2=4")+", подставляем в (1): "+im("x_1=3")+". На картинке это вертикальная и горизонтальная прямые, их пересечение читается сразу.</p><p>В графическом методе вершины ищут именно так. Симплекс-таблица делает то же самое, только сразу для всех строк.</p>"},
 {title:"Если прямые параллельны — решений нет",stage:twoCol(plot(sp({lines:[L1,{a:[2,2],c:10,label:"(2)",at:[4.2,1.3],cls:"new"}]})),"\\begin{cases}x_1+x_2=7\\\\2x_1+2x_2=10\\end{cases}\\ \\xrightarrow{(2)-2\\cdot(1)}\\ 0=-4"),
  text:"<p>Второе уравнение — это "+im("x_1+x_2=5")+": прямая параллельна первой и никогда её не пересекает. Гаусс показывает это так: вычли "+im("2\\cdot(1)")+" и получили "+im("0=-4")+", неверное равенство.</p><p>Система противоречива. В ЛП это та самая Нр1: ограничения не совместны.</p>"},
 {title:"Если прямые совпадают — решений бесконечно много",stage:twoCol(plot(sp({lines:[Object.assign({},L1,{cls:"new"})],pts:[{x:0,y:7,cls:"vis"},{x:3,y:4,cls:"vis"},{x:7,y:0,cls:"vis"}]})),"\\begin{cases}x_1+x_2=7\\\\2x_1+2x_2=14\\end{cases}\\ \\xrightarrow{(2)-2\\cdot(1)}\\ 0=0"),
  text:"<p>Второе уравнение — первое, умноженное на 2. Это одна и та же прямая, и любая её точка подходит обоим уравнениям. Гаусс даёт "+im("0=0")+": второе уравнение ничего нового не сообщило.</p><p>Итого у системы три исхода: одна точка, ни одной, бесконечно много. Сколько уравнений «реально работают», и есть ранг — следующий раздел.</p>"}
];

var rankSteps=[
 {title:"Ранг 2: оба уравнения нужны",stage:twoCol(plot(sp({lines:[L1,L2],pts:[{x:3,y:4,cls:"hi"}]})),"\\begin{pmatrix}1&1\\\\1&3\\end{pmatrix}\\xrightarrow{\\text{Гаусс}}\\begin{pmatrix}1&1\\\\0&2\\end{pmatrix}\\quad\\Rightarrow\\quad r=2"),
  text:"<p><b>Ранг</b> — сколько уравнений останется, если выкинуть все лишние. «Лишнее» уравнение — то, что получается из других сложением и умножением на числа. Такие уравнения называют <b>линейно зависимыми</b>, остальные — независимыми.</p><p>Здесь прямые разные и пересекаются. Уберёшь любую — точка перестанет определяться. Значит, обе нужны, ранг 2. После Гаусса обе строки ненулевые.</p>"},
 {title:"Ранг 1: второе уравнение — копия первого",stage:twoCol(plot(sp({lines:[L1]})),"\\begin{pmatrix}1&1\\\\2&2\\end{pmatrix}\\xrightarrow{(2)-2\\cdot(1)}\\begin{pmatrix}1&1\\\\0&0\\end{pmatrix}\\quad\\Rightarrow\\quad r=1"),
  text:"<p>"+im("2x_1+2x_2=14")+" — это "+im("2\\cdot(1)")+". На плоскости одна прямая. Уравнений два, а работает одно — ранг 1.</p><p>В матрице это видно так: после Гаусса появилась <b>строка из одних нулей</b>. Ранг = число ненулевых строк, которые остались.</p>"},
 {title:"Ранг 2 при трёх уравнениях",stage:twoCol(plot(sp({lines:[L1,L2,{a:[2,4],c:22,label:"(3)",at:[0.3,5.1],cls:"new"}],pts:[{x:3,y:4,cls:"hi",name:"(3; 4)"}]})),"\\begin{pmatrix}1&1&|&7\\\\1&3&|&15\\\\2&4&|&22\\end{pmatrix}\\xrightarrow{(3)-(1)-(2)}\\begin{pmatrix}1&1&|&7\\\\1&3&|&15\\\\0&0&|&0\\end{pmatrix}"),
  text:"<p>Третье уравнение "+im("2x_1+4x_2=22")+" — это сумма (1) и (2). Его прямая проходит через ту же точку (3; 4) и ничего не уточняет. Три уравнения, ранг 2.</p><p>На плоскости ранг не может быть больше 2: две независимые прямые уже задают точку. В общем случае <b>ранг ≤ числа уравнений и ≤ числа неизвестных</b>.</p><p>В симплекс-таблице такая строка проявляется строкой из нулей (методичка, пример 5, табл. 16) — её вычёркивают.</p>"},
 {title:"Тот же ранг, но по столбцам",stage:'<div class="srow">'+plot({x0:-1.6,y0:-0.6,x1:3.2,y1:4.7,U:40,tick:1,vecs:[{v:[1,0],label:"(1;0)",dx:4,dy:18},{v:[0,1],label:"(0;1)",dx:-44,dy:4},{v:[1,2],label:"(1;2)",cls:"alt",dx:8,dy:4},{v:[2,4],label:"(2;4)",cls:"alt",dx:8,dy:4}],aria:"Столбцы как стрелки"})+dml("\\text{(1;0) и (0;1): разные направления}\\Rightarrow r=2\\\\[4pt]\\text{(1;2) и (2;4): одна прямая}\\Rightarrow r=1")+'</div>',
  text:"<p>Ранг можно считать и по столбцам — ответ всегда тот же. Столбец из двух чисел — это стрелка на плоскости.</p><ul><li>Синие (1; 0) и (0; 1) смотрят в разные стороны: из них можно собрать любую стрелку плоскости. Они независимы, ранг 2.</li><li>Красные (1; 2) и (2; 4) лежат на одной прямой: вторая — это первая ×2. Ранг 1.</li></ul><p>Именно так проверяют, годится ли набор столбцов в <b>базис</b>: столбцы должны быть независимыми. Единичные столбцы (1; 0; 0), (0; 1; 0), (0; 0; 1) независимы всегда.</p>"}
];

/* выражение переменных через x1, x2: value = c0 + a1*x1 + a2*x2 */
function zVars(L){return{x1:[0,1,0],x2:[0,0,1],x3:[15,-1,-3],x4:[7,-1,-1],x5:[L,-2,-1]}}
var ZLAB={x1:"x₁ = 0",x2:"x₂ = 0",x3:"x₃ = 0",x4:"x₄ = 0",x5:"x₅ = 0"};
function zeroLine(V,v){var e=V[v];return{a:[e[1],e[2]],c:-e[0]}}
function solvePair(V,p,q){var A=zeroLine(V,p),B=zeroLine(V,q);var det=F(A.a[0]).mul(B.a[1]).sub(F(A.a[1]).mul(B.a[0]));if(det.sign()===0)return null;
  var x1=F(A.c).mul(B.a[1]).sub(F(A.a[1]).mul(B.c)).div(det),x2=F(A.a[0]).mul(B.c).sub(F(A.c).mul(B.a[0])).div(det);return[x1,x2]}
function allVals(V,pt){return["x1","x2","x3","x4","x5"].map(function(v){var e=V[v];return F(e[0]).add(F(e[1]).mul(pt[0])).add(F(e[2]).mul(pt[1]))})}
var BR={x0:-1,y0:-1,x1:16,y1:13,U:22};
function bplot(V,extra){var L=V.x5[0];var lab={x1:[0.2,12.3],x2:[13.4,0.35],x3:[11,1.6],x4:[7.4,1.0],x5:[L===12?2.1:1.2,9.0]};
  var lines=["x3","x4","x5"].map(function(v){var z=zeroLine(V,v);return{a:z.a,c:z.c,label:ZLAB[v],at:lab[v],cls:(extra.hl&&extra.hl.indexOf(v)>=0)?"new":"dim"}});
  ["x1","x2"].forEach(function(v){if(extra.hl&&extra.hl.indexOf(v)>=0){var z=zeroLine(V,v);lines.push({a:z.a,c:z.c,label:ZLAB[v],at:lab[v],cls:"new axis"})}});
  var cons=[{a:[1,3],c:15,s:"<="},{a:[1,1],c:7,s:"<="},{a:[2,1],c:L,s:"<="}];
  return plot(Object.assign({x0:BR.x0,y0:BR.y0,x1:BR.x1,y1:BR.y1,U:BR.U,tick:2,regions:[{cons:cons,cls:"regb"}],lines:lines,aria:"Базисные решения"},extra))}
var V12=zVars(12);
function vecTex(vals){return "x="+tvec(vals)}
var basisSteps=[
 {title:"Сколько переменных можно выбрать свободно",stage:dml("\\begin{cases}x_1+3x_2+x_3=15\\\\x_1+x_2+x_4=7\\\\2x_1+x_2+x_5=12\\end{cases}\\qquad\\begin{array}{l}n=5\\ \\text{неизвестных}\\\\r=3\\ \\text{(ранг)}\\\\n-r=2\\ \\text{свободных}\\end{array}"),
  text:"<p>Каноническая форма мастерской: 3 уравнения, 5 неизвестных. Уравнения независимы (в каждом своя x₃, x₄, x₅), ранг 3.</p><p>Каждое независимое уравнение позволяет выразить одну переменную через остальные. Значит, 3 переменные будут вычисляться, а <b>5 − 3 = 2 переменные можно задавать как угодно</b>. Их называют свободными.</p>"},
 {title:"Выражаем через две свободные",stage:dml("\\begin{aligned}x_3&=15-x_1-3x_2\\\\x_4&=7-x_1-x_2\\\\x_5&=12-2x_1-x_2\\end{aligned}"),
  text:"<p>Удобнее всего взять свободными x₁ и x₂: x₃, x₄, x₅ стоят каждая в своём уравнении с коэффициентом 1, их выражаем в одно действие — переносим остальное вправо.</p><p>Теперь любую пару (x₁; x₂) можно подставить и получить остальные три. Смысл: x₃ — сколько досок останется, x₄ — сколько часов, x₅ — сколько лака.</p>"},
 {title:"Подставим x₁ = 1, x₂ = 1",stage:function(){return '<div class="srow">'+bplot(V12,{pts:[{x:1,y:1,cls:"hi",name:"(1; 1)"}]})+dml("\\begin{aligned}x_3&=15-1-3=11\\\\x_4&=7-1-1=5\\\\x_5&=12-2-1=9\\end{aligned}\\\\[4pt]x=(1;\\,1;\\,11;\\,5;\\,9)")+'</div>'},
  text:"<p>Все пять чисел ≥ 0 — это <b>допустимое решение</b>: 1 стол и 1 полка, ресурсов хватает, ещё и остаётся. Точка (1; 1) лежит внутри закрашенной ОДР.</p>"},
 {title:"Подставим x₁ = 5, x₂ = 4",stage:function(){return '<div class="srow">'+bplot(V12,{hl:["x3"],pts:[{x:5,y:4,cls:"hi",name:"(5; 4)"}]})+dml("\\begin{aligned}x_3&=15-5-12=\\mathbf{-2}\\\\x_4&=7-5-4=\\mathbf{-2}\\\\x_5&=12-10-4=-2\\end{aligned}")+'</div>'},
  text:"<p>Система решена — уравнения выполняются. Но остатки отрицательные: досок не хватает на 2 м². Условие x ≥ 0 нарушено, решение <b>недопустимое</b>, точка лежит за пределами ОДР.</p><p>Вывод: уравнения отвечают за «сходится ли баланс», а x ≥ 0 — за «реально ли это».</p>"},
 {title:"Ключ: «x = 0» — это прямая",stage:function(){return bplot(V12,{hl:["x1","x2","x3","x4","x5"]})},
  text:"<p>Когда переменная равна нулю, точка лежит на определённой прямой:</p><ul><li>"+im("x_1=0")+" — вертикальная ось, "+im("x_2=0")+" — горизонтальная;</li><li>"+im("x_3=0")+" — досок осталось ровно 0, значит "+im("x_1+3x_2=15")+": это граница ограничения (1);</li><li>"+im("x_4=0")+" — граница (2), "+im("x_5=0")+" — граница (3).</li></ul><p>Все пять прямых — это стороны ОДР и их продолжения.</p>"},
 {title:"Обнуляем x₁ и x₂ → вершина O",stage:function(){return '<div class="srow">'+bplot(V12,{hl:["x1","x2"],pts:[{x:0,y:0,cls:"hi",name:"O",dx:6,dy:-8}]})+dml("x_1=x_2=0\\ \\Rightarrow\\ \\begin{aligned}x_3&=15\\\\x_4&=7\\\\x_5&=12\\end{aligned}\\\\[4pt]x=(0;\\,0;\\,15;\\,7;\\,12)")+'</div>'},
  text:"<p>Вот зачем обнулять. Две переменные = 0 — это две прямые, точка — их пересечение. Здесь пересекаются обе оси, получается O.</p><p>Решение с нулями на месте свободных переменных называют <b>базисным</b>. Остальные три считаются однозначно и сразу видны в столбце b.</p>"},
 {title:"Обнуляем x₃ и x₄ → вершина C",stage:function(){return '<div class="srow">'+bplot(V12,{hl:["x3","x4"],pts:[{x:3,y:4,cls:"hi",name:"C(3; 4)"}]})+dml("\\begin{cases}x_1+3x_2=15\\\\x_1+x_2=7\\end{cases}\\Rightarrow x_1=3,\\ x_2=4\\\\[4pt]x_5=12-6-4=2\\\\[4pt]x=(3;\\,4;\\,0;\\,0;\\,2)")+'</div>'},
  text:"<p>Свободными можно сделать и другие две переменные. "+im("x_3=0")+" и "+im("x_4=0")+": доски и часы израсходованы полностью. Решаем систему из двух прямых — получаем точку C, ту самую оптимальную вершину. Лак x₅ = 2 остаётся.</p><p>Теперь базисные переменные — x₁, x₂, x₅, свободные — x₃, x₄.</p>"},
 {title:"Обнуляем x₃ и x₅ → точка вне ОДР",stage:function(){return '<div class="srow">'+bplot(V12,{hl:["x3","x5"],pts:[{x:21/5,y:18/5,cls:"hi",name:"(21/5; 18/5)"}]})+dml("\\begin{cases}x_1+3x_2=15\\\\2x_1+x_2=12\\end{cases}\\Rightarrow x_1=\\tfrac{21}{5},\\ x_2=\\tfrac{18}{5}\\\\[4pt]x_4=7-\\tfrac{21}{5}-\\tfrac{18}{5}=\\mathbf{-\\tfrac45}")+'</div>'},
  text:"<p>Прямые (1) и (3) тоже пересекаются, но снаружи многоугольника: часов не хватает, x₄ &lt; 0.</p><p>Это <b>базисное, но не опорное</b> решение. Опорным называют только базисное решение со всеми переменными ≥ 0 — то есть вершину ОДР.</p>"},
 {title:"Итог: 10 пар, 5 вершин",stage:function(){var V=V12,vars=["x1","x2","x3","x4","x5"],pts=[],rows=[];for(var i=0;i<5;i++)for(var j=i+1;j<5;j++){var p=solvePair(V,vars[i],vars[j]);if(!p)continue;var vals=allVals(V,p),ok=vals.every(function(v){return v.sign()>=0});pts.push({x:p[0].val(),y:p[1].val(),cls:ok?"hi":"bad",r:ok?5:3.5});rows.push(ok)}
    return '<div class="srow">'+bplot(V,{pts:pts})+'</div>'},
  text:"<p>Пар «какие две обнулить» всего "+im("C_5^2=10")+". Каждая пара — пересечение двух прямых. 5 точек (красные) оказались вершинами ОДР — опорные решения. 5 точек (серые) лежат снаружи.</p><p>Это главная связь всей темы: <b>базис ↔ пара прямых ↔ вершина</b>. Графический метод смотрит на вершины глазами, симплекс перебирает базисы в таблице. Попробуй сам ниже.</p>"}
];

function picker(){var el=$id("picker");if(!el)return;var sel=["x3","x4"],deg=false;
  el.innerHTML='<div class="pk-bar"><span class="pk-l">Обнулить:</span>'+["x1","x2","x3","x4","x5"].map(function(v){return '<button type="button" class="pk" data-v="'+v+'">'+nm(v)+'</button>'}).join("")+'<label class="pk-deg"><input type="checkbox" id="pk-deg"> вырожденный вариант: лака 10 банок</label></div><div class="pk-out"></div>';
  var out=el.querySelector(".pk-out");
  function draw(){el.querySelectorAll(".pk").forEach(function(b){b.classList.toggle("on",sel.indexOf(b.getAttribute("data-v"))>=0)});
    var V=zVars(deg?10:12);
    if(sel.length<2){out.innerHTML='<div class="srow">'+bplot(V,{hl:sel})+'<p class="pk-msg">Выбери ещё '+(2-sel.length)+' '+(sel.length===1?"переменную":"переменные")+'.</p></div>';return}
    var p=solvePair(V,sel[0],sel[1]);
    if(!p){out.innerHTML='<div class="srow">'+bplot(V,{hl:sel})+'<p class="pk-msg">Прямые параллельны — точки нет, такой набор не базис.</p></div>';return}
    var vals=allVals(V,p),ok=vals.every(function(v){return v.sign()>=0}),zeros=vals.filter(function(v){return v.sign()===0}).length;
    var basic=["x1","x2","x3","x4","x5"].filter(function(v){return sel.indexOf(v)<0});
    var verdict=ok?(zeros>2?'<b class="okc">Опорное, вырожденное:</b> нулей '+zeros+', а не 2. Через эту вершину проходят три прямые, и её дают сразу несколько пар.':'<b class="okc">Опорное решение</b> — вершина ОДР.'):'<b class="badc">Недопустимое:</b> '+["x1","x2","x3","x4","x5"].filter(function(v,i){return vals[i].sign()<0}).map(nm).join(", ")+' &lt; 0 — точка вне ОДР.';
    var tex="\\text{свободные: }"+sel.map(tv).join(",\\ ")+"=0\\qquad\\text{базисные: }"+basic.map(tv).join(",\\ ")+"\\\\[6pt]"+vecTex(vals);
    out.innerHTML='<div class="srow">'+bplot(V,{hl:sel,pts:[{x:p[0].val(),y:p[1].val(),cls:ok?"hi":"bad",name:"("+tn(p[0]).replace(/\\tfrac\{(\d+)\}\{(\d+)\}/,"$1/$2")+"; "+tn(p[1]).replace(/\\tfrac\{(\d+)\}\{(\d+)\}/,"$1/$2")+")"}]})+'<div class="pk-res">'+dml(tex)+'<p>'+verdict+'</p></div></div>';typeset(out)}
  el.querySelectorAll(".pk").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-v"),i=sel.indexOf(v);if(i>=0)sel.splice(i,1);else{if(sel.length===2)sel.shift();sel.push(v)}draw()}});
  el.querySelector("#pk-deg").onchange=function(e){deg=e.target.checked;draw()};
  draw()}

/* ---------- помощники для матриц и строк формул ---------- */
function mtab(id,rl,cl,data,o){o=o||{};var hc=o.hcol||[];
  var h='<div class="tw"><table class="st"><tr class="hd"><th></th>'+cl.map(function(c,j){return '<th class="colh'+(hc.indexOf(j)>=0?" hc":"")+'">'+c+'</th>'}).join("")+'</tr>';
  data.forEach(function(r,i){h+='<tr class="'+(i===0?"r0":"")+'"><th class="rl">'+rl[i]+'</th>'+r.map(function(v,j){var cls="cell"+(j===0?" first":"")+(o.bcol===j?" bcol":"")+(hc.indexOf(j)>=0?" hc":"")+(o.wide?" wide":"");return '<td class="'+cls+'" data-k="'+id+':'+i+','+j+'">'+(typeof v==="string"?v:fmt(v))+'</td>'}).join("")+'</tr>'});
  if(o.foot){h+='<tr class="ob"><th class="rl">'+o.foot.label+'</th>'+o.foot.vals.map(function(v,j){return '<td class="cell'+(j===0?" first":"")+(hc.indexOf(j)>=0?" hc":"")+'" data-k="'+id+':f,'+j+'">'+(typeof v==="string"?v:fmt(v))+'</td>'}).join("")+'</tr>'}
  h+='</table></div>';if(o.label)h='<div><div class="tlabel">'+o.label+'</div>'+h+'</div>';return h}
function tlines(id,arr,label){var h='<div class="tlines">'+arr.map(function(t,i){return '<div class="tl" data-k="'+id+':'+i+'">'+im(t)+'</div>'}).join("")+'</div>';return label?'<div><div class="tlabel">'+label+'</div>'+h+'</div>':h}
function srow(){return '<div class="srow">'+[].slice.call(arguments).join("")+'</div>'}
function op(s){return '<div class="arrow">'+s+'</div>'}
function det3(M){return M[0][0].mul(M[1][1].mul(M[2][2]).sub(M[1][2].mul(M[2][1]))).sub(M[0][1].mul(M[1][0].mul(M[2][2]).sub(M[1][2].mul(M[2][0])))).add(M[0][2].mul(M[1][0].mul(M[2][1]).sub(M[1][1].mul(M[2][0]))))}
function cof3(M){var C=[];for(var i=0;i<3;i++){C.push([]);for(var j=0;j<3;j++){var r=[0,1,2].filter(function(x){return x!==i}),c=[0,1,2].filter(function(x){return x!==j});var m=M[r[0]][c[0]].mul(M[r[1]][c[1]]).sub(M[r[0]][c[1]].mul(M[r[1]][c[0]]));C[i].push((i+j)%2?m.neg():m)}}return C}
function texM(M){return "\\begin{pmatrix}"+M.map(function(r){return r.map(function(v){return tn(v)}).join("&")}).join("\\\\")+"\\end{pmatrix}"}

/* ---------- Пример 6: искусственный базис + y* ---------- */
function p6Demo(){
  var A=[[1,-1,2,-1],[2,1,-3,1],[-1,3,2,1]],b=[2,6,2],cv=[-2,-1,1,1],c={x1:-2,x2:-1,x3:1,x4:1};
  var ca={w1:-1,w2:-1,w3:-1},X=["x1","x2","x3","x4"];
  var t0=addObj(mk(X,["w1","w2","w3"],A,b),"F",ca),info0=objInfo(t0,0,ca,"p");
  var steps=[
   {title:"Условие: прямая и двойственная",stage:srow(dm("\\begin{array}{l}f=-2x_1-x_2+x_3+x_4\\to\\max\\\\[6pt]\\begin{cases}x_1-x_2+2x_3-x_4=2\\\\2x_1+x_2-3x_3+x_4=6\\\\-x_1+3x_2+2x_3+x_4=2\\\\x_j\\ge0,\\ j=\\overline{1,4}\\end{cases}\\end{array}"),op("⇒"),dm("\\begin{array}{l}g=2y_1+6y_2+2y_3\\to\\min\\\\[6pt]\\begin{cases}y_1+2y_2-y_3\\ge-2\\\\-y_1+y_2+3y_3\\ge-1\\\\2y_1-3y_2+2y_3\\ge1\\\\-y_1+y_2+y_3\\ge1\\\\y_1,y_2,y_3\\ \\text{— любого знака}\\end{cases}\\end{array}")),
    text:"<p>Пример 6 из задачника. Двойственная строится по обычным правилам:</p><ul><li>b = (2; 6; 2) → коэффициенты g;</li><li>столбец A<sup>j</sup> прямой → j-е ограничение двойственной, справа c<sub>j</sub>. Знак ≥, потому что все x ≥ 0;</li><li>все ограничения прямой — <b>равенства</b>, поэтому все y <b>любого знака</b>. Это и есть твои красные пометки «y₁ — ∀».</li></ul><p>План: решаем прямую симплексом, потом из оптимальной таблицы получаем y*.</p>"},
   {title:"Базиса нет — вспомогательная задача",stage:dm("\\begin{array}{l}F=-w_1-w_2-w_3\\to\\max\\\\[6pt]\\begin{cases}x_1-x_2+2x_3-x_4+w_1=2\\\\2x_1+x_2-3x_3+x_4+w_2=6\\\\-x_1+3x_2+2x_3+x_4+w_3=2\\\\x\\ge0,\\ w\\ge0\\end{cases}\\end{array}"),
    text:"<p>Задача уже каноническая, все b ≥ 0. Ищем единичные столбцы: A¹ = (1; 2; −1), A² = (−1; 1; 3), A³ = (2; −3; 2), A⁴ = (−1; 1; 1). Ни одного. Значит, искусственная w нужна в <b>каждую</b> строку.</p><p>Начальная точка вспомогательной задачи: x = 0, w = (2; 6; 2). Максимизируем F, пока все w не станут 0.</p>"},
   {title:"Начальная таблица фазы 1",stage:function(){return renderTable(t0,{tid:"p",cTop:ca,cB:ca,info:info0})},info:info0,anim:infoAnim(info0),
    text:"<p>Сверху нули (x в F не входят), слева −1 у каждой w. Поэтому каждая оценка — это сумма столбца с минусом:</p>"+dm("F_1=-(1+2-1)=-2,\\quad F_2=-(-1+1+3)=-3,\\quad F=-(2+6+2)=-10")+"<p>Совпадает с первой таблицей методички.</p>"}];
  var it=0;
  var r1=simplexSteps(t0,{costs:ca,arts:["w1","w2","w3"],vars:X,force:function(t){return it++===0?t.cols.indexOf("x4"):-1},
    finish:function(t){return{title:"Фаза 1 закончена: max F = 0",stage:function(){return renderTable(t,{tid:"p",cTop:ca,cB:ca,objHi:true})},
      text:"<p>Все три w вышли из базиса и вычеркнуты, F = 0. Нашлась допустимая точка исходной задачи:</p>"+dm("x_3=1,\\ x_1=3,\\ x_4=3,\\ x_2=0")+"<p>Проверка в первом уравнении: "+im("3-0+2\\cdot1-3=2\\ \\checkmark")+".</p>"}}});
  steps=steps.concat(r1.steps);
  var t1=addObj(dropObj(r1.t,0),"f",c),info1=objInfo(t1,0,c,"p");
  steps.push({title:"Вычёркиваем F, считаем f-строку",stage:function(){return renderTable(t1,{tid:"p",cTop:c,cB:c,info:info1})},info:info1,anim:infoAnim(info1),
    text:"<p>Ставим настоящие коэффициенты f: сверху c₂ = −1, слева c<sub>B</sub> = (1; −2; 1) для x₃, x₁, x₄.</p>"+dm("\\Delta_2=1\\cdot\\tfrac12+(-2)\\cdot\\tfrac16+1\\cdot\\tfrac{13}6-(-1)=\\tfrac{10}3,\\qquad f=1\\cdot1+(-2)\\cdot3+1\\cdot3=-2")+"<p>Это последняя таблица методички, строка f: 10/3 и −2.</p>"});
  var r2=simplexSteps(t1,{costs:c,vars:X,optExtra:"<p>Единственная оценка 10/3 ≥ 0, поэтому фаза 2 закончилась сразу. Это ответ методички: "+im("x^*=(3;0;1;3),\\ f^*_{\\max}=-2")+".</p>"});
  steps=steps.concat(r2.steps);
  var fin=r2.t;
  /* y* */
  var Ar=A.map(function(r){return r.map(F)}),ord=["x3","x1","x4"],jj=ord.map(function(v){return +idx(v)-1});
  var mOrig=function(hl){return mtab("m6",["(1)","(2)","(3)"],["x<sub>1</sub>","x<sub>2</sub>","x<sub>3</sub>","x<sub>4</sub>"],Ar,{hcol:hl||[],foot:{label:"c",vals:cv.map(F)},label:"исходная матрица A"})};
  var E=["2y_1-3y_2+2y_3=1","y_1+2y_2-y_3=-2","-y_1+y_2+y_3=1"],Elab=["A^3","A^1","A^4"];
  steps.push({title:"Почему y* не читается из строки f",stage:function(){return srow(renderTable(fin,{tid:"p",cTop:c,cB:c}),mOrig())},
    text:"<p>В разборе 1 мы брали "+im("y_i=\\Delta_j+c_j")+" по столбцам, которые в <b>исходной</b> матрице были единичными. Здесь единичными были только w₁, w₂, w₃, а их вычеркнули. Нужных оценок в таблице просто нет.</p><p>Поэтому в методичке y* ищут по-другому. Базисные переменные оптимальной таблицы — x₃, x₁, x₄, и у базисных Δ = 0. Каждое такое условие даёт уравнение на y. Три базисные переменные — три уравнения, три неизвестных.</p>"});
  steps.push({title:"Способ 1: система Δⱼ = 0 для базисных",stage:function(){return srow(mOrig(jj),tlines("e6",E,"уравнения на y"))},
    anim:jj.map(function(j,n){return{f:"\\Delta_"+(j+1)+"=(y,"+Elab[n]+")-c_"+(j+1)+"=0\\ \\Rightarrow\\ "+E[n],moves:[["m6:0,"+j,"e6:"+n],["m6:1,"+j,"e6:"+n],["m6:2,"+j,"e6:"+n],["m6:f,"+j,"e6:"+n]],show:["e6:"+n]}}),
    text:"<p>Для каждой базисной x<sub>j</sub>:</p>"+dm("\\Delta_j=(y,A^j)-c_j=0\\quad\\Longleftrightarrow\\quad y_1a_{1j}+y_2a_{2j}+y_3a_{3j}=c_j")+"<p>Коэффициенты берём из столбца <b>исходной</b> матрицы, справа — c<sub>j</sub> из f. Например, для x₃: столбец (2; −3; 2), c₃ = 1.</p>"});
  steps.push({title:"Решаем систему",stage:dm("\\begin{cases}2y_1-3y_2+2y_3=1&(1)\\\\y_1+2y_2-y_3=-2&(2)\\\\-y_1+y_2+y_3=1&(3)\\end{cases}\\\\[8pt]\\begin{aligned}&(2):\\ y_1=-2-2y_2+y_3\\\\&\\text{в }(3):\\ 2+2y_2-y_3+y_2+y_3=1\\ \\Rightarrow\\ 3y_2=-1\\ \\Rightarrow\\ y_2=-\\tfrac13\\\\&\\text{в }(1):\\ -4-7y_2+4y_3=1\\ \\Rightarrow\\ \\tfrac73+4y_3=5\\ \\Rightarrow\\ y_3=\\tfrac23\\\\&y_1=-2+\\tfrac23+\\tfrac23=-\\tfrac23\\end{aligned}"),
    text:"<p>Обычный метод Гаусса: выразили y₁ из (2), подставили в (3) — y₃ сократилась, сразу нашли y₂. Потом подставили в (1).</p><p class='ans'>"+im("y^*=\\left(-\\tfrac23;\\ -\\tfrac13;\\ \\tfrac23\\right)")+"</p><p>Отрицательные y здесь нормальны: все y любого знака, потому что в прямой равенства.</p>"});
  var B=[0,1,2].map(function(i){return jj.map(function(j){return Ar[i][j]})}),cB=ord.map(function(v){return F(c[v])});
  var d=det3(B),C=cof3(B),adj=[0,1,2].map(function(i){return[0,1,2].map(function(j){return C[j][i]})}),Bi=adj.map(function(r){return r.map(function(v){return v.div(d)})});
  var yv=[0,1,2].map(function(i){var s=F(0);for(var k=0;k<3;k++)s=s.add(cB[k].mul(Bi[k][i]));return s});
  var mB=function(){return mtab("b6",["(1)","(2)","(3)"],["A<sup>3</sup>","A<sup>1</sup>","A<sup>4</sup>"],B,{label:"B"})};
  var mCB=function(){return mtab("cb6",["c<sub>B</sub>"],["x<sub>3</sub>","x<sub>1</sub>","x<sub>4</sub>"],[cB])};
  var bAnim=[];jj.forEach(function(j,n){bAnim.push({f:"A^"+(j+1)+"=("+[0,1,2].map(function(i){return tn(Ar[i][j])}).join(";")+")\\ \\to\\ "+(n+1)+"\\text{-й столбец }B",moves:[0,1,2].map(function(i){return["m6:"+i+","+j,"b6:"+i+","+n]}),show:[0,1,2].map(function(i){return "b6:"+i+","+n})})});
  bAnim.push({f:"c_B=(c_3;\\ c_1;\\ c_4)=(1;\\ -2;\\ 1)",moves:jj.map(function(j,n){return["m6:f,"+j,"cb6:0,"+n]}),show:[0,1,2].map(function(n){return "cb6:0,"+n})});
  steps.push({title:"Способ 2: собираем B и c_B",stage:function(){return srow(mOrig(jj),op("→"),mB(),mCB())},anim:bAnim,
    text:"<p>Тот же ответ даёт формула "+im("y^*=c_B\\cdot B^{-1}")+" — твои красные пометки.</p><ul><li><b>B</b> — столбцы исходной матрицы при базисных переменных, <b>в порядке строк оптимальной таблицы</b>: x₃, x₁, x₄. Поэтому B = {A³, A¹, A⁴}.</li><li><b>c<sub>B</sub></b> — коэффициенты f при тех же переменных, в том же порядке: (1; −2; 1).</li></ul><p>Размеры: c<sub>B</sub> — строка 1×3, B — 3×3, результат y — строка 1×3.</p>"});
  steps.push({title:"Считаем B⁻¹",stage:dm("\\begin{aligned}&\\det B="+tn(d)+"\\\\[4pt]&\\text{алг. дополнения: }\\ "+texM(C)+"\\\\[4pt]&B^{-1}=\\frac{1}{"+tn(d)+"}"+texM(adj)+"="+texM(Bi)+"\\end{aligned}"),
    text:"<p>Обратную матрицу из таблицы тут не прочитать (её столбцы стояли бы на месте вычеркнутых w), поэтому считаем руками:</p><ol><li>Определитель: "+im("\\det B=2(2+1)-1(-3-2)+(-1)(3-4)=12")+".</li><li>Алгебраические дополнения "+im("A_{ij}=(-1)^{i+j}M_{ij}")+": вычёркиваем строку i и столбец j, считаем определитель 2×2, ставим знак по шахматке.</li><li>Транспонируем матрицу дополнений (строки ↔ столбцы) и делим на det.</li></ol><p>Проверка: "+im("B\\cdot B^{-1}=E")+".</p>"});
  var yA=[0,1,2].map(function(i){return{f:"y_"+(i+1)+"=1\\cdot"+tn(Bi[0][i],true)+"+(-2)\\cdot"+tn(Bi[1][i],true)+"+1\\cdot"+tn(Bi[2][i],true)+"="+tn(yv[i]),moves:[0,1,2].map(function(k){return["cb6:0,"+k,"y6:"+i]}).concat([0,1,2].map(function(k){return["bi6:"+k+","+i,"y6:"+i]})),show:["y6:"+i],src:["cb6:0,0","cb6:0,1","cb6:0,2","bi6:0,"+i,"bi6:1,"+i,"bi6:2,"+i]}});
  steps.push({title:"y* = c_B · B⁻¹",stage:function(){return srow(mCB(),op("·"),mtab("bi6",["","",""],["","",""],Bi,{label:"B<sup>−1</sup>"}),op("="),tlines("y6",yv.map(function(v,i){return "y_"+(i+1)+"="+tn(v)}),"y*"))},anim:yA,
    text:"<p>Строку на матрицу умножаем так: i-я компонента y — это c<sub>B</sub>, умноженная на i-й <b>столбец</b> B⁻¹ (поэлементно и сложить).</p><p class='ans'>"+im("y^*=\\left(-\\tfrac23;\\ -\\tfrac13;\\ \\tfrac23\\right)")+"</p><p>Совпало со способом 1 — так и должно быть: оба способа решают одно и то же уравнение "+im("y\\cdot B=c_B")+".</p>"});
  steps.push({title:"Проверка: g* = f* и ограничения",stage:dm("\\begin{array}{l}g(y^*)=2\\cdot\\left(-\\tfrac23\\right)+6\\cdot\\left(-\\tfrac13\\right)+2\\cdot\\tfrac23=-\\tfrac43-2+\\tfrac43=-2=f^*\\ \\checkmark\\\\[8pt]\\begin{array}{lll}1)&-\\tfrac23-\\tfrac23-\\tfrac23=-2\\ge-2&\\text{равенство, }x_1^*=3>0\\\\2)&\\tfrac23-\\tfrac13+2=\\tfrac73\\ge-1&\\text{строго, }x_2^*=0\\\\3)&-\\tfrac43+1+\\tfrac43=1\\ge1&\\text{равенство, }x_3^*=1>0\\\\4)&\\tfrac23-\\tfrac13+\\tfrac23=1\\ge1&\\text{равенство, }x_4^*=3>0\\end{array}\\end{array}"),
    text:"<p>Значения целевых функций совпали, все ограничения двойственной выполнены.</p><p>Заодно видна дополняющая нежёсткость: там, где x<sub>j</sub>* &gt; 0, ограничение двойственной выполняется как равенство. Единственное строгое — второе, и как раз x₂* = 0.</p>"});
  return steps}

/* ---------- Пример 7: проверка плана на оптимальность ---------- */
function p7Demo(){
  var LHS=["x_1-3x_2","-x_1+x_2","-x_1+2x_2"],bb=[3,1,4],A=[[1,-3],[-1,1],[-1,2]],c=[-1,2];
  function calc(x){return A.map(function(r,i){var v=r[0]*x[0]+r[1]*x[1];return{v:v,strict:v<bb[i]}})}
  function chk(id,x,show){var R=calc(x);return srow(mtab(id+"x",["x̄"],["x<sub>1</sub>","x<sub>2</sub>"],[[F(x[0]),F(x[1])]],{label:"план"}),
    mtab(id,["(1)","(2)","(3)"],["левая часть","при x̄","b","итог"],R.map(function(r,i){return[im(LHS[i]),show?im(String(r.v).replace("-","−")):"",String(bb[i]),show?(r.strict?"&lt; строго":"= равно"):""]}),{label:"ограничения прямой",wide:true}))}
  function subAnim(id,x){var R=calc(x);return R.map(function(r,i){return{f:LHS[i].replace("x_1","\\cdot"+x[0]).replace(/^\\cdot/,"")+"",moves:[[id+"x:0,0",id+":"+i+",1"],[id+"x:0,1",id+":"+i+",1"]],show:[id+":"+i+",1",id+":"+i+",3"]}}).map(function(a,i){var r=R[i],ax=A[i][0]+"\\cdot"+x[0]+(A[i][1]<0?"":"+")+A[i][1]+"\\cdot"+x[1];a.f=ax.replace(/^1\\cdot/,"").replace(/^-1\\cdot/,"-")+"="+r.v+(r.strict?"<":"=")+bb[i]+"\\ \\Rightarrow\\ "+(r.strict?"i="+(i+1)+"\\in I":"\\text{равно}");return a})}
  function eqs(x){var R=calc(x),L=[],mv=[];x.forEach(function(v,j){if(v>0){L.push("j="+(j+1)+":\\ "+A.map(function(r,i){return r[j]}).map(function(k,i){return (k<0?"-":(i?"+":""))+(Math.abs(k)===1?"":Math.abs(k))+"y_"+(i+1)}).join("")+"="+c[j]);mv.push(["q"+x.join("")+"x:0,"+j])}});R.forEach(function(r,i){if(r.strict){L.push("i="+(i+1)+":\\ y_"+(i+1)+"=0");mv.push(["q"+x.join("")+":"+i+",3"])}});return{L:L,mv:mv}}
  function eqStep(x,title,text){var id="q"+x.join(""),e=eqs(x);return{title:title,stage:function(){return srow(chk(id,x,true),tlines(id+"e",e.L,"система (7)"))},
    anim:e.L.map(function(t,n){return{f:t,moves:[[e.mv[n][0],id+"e:"+n]],show:[id+"e:"+n],src:[e.mv[n][0]]}}),text:text}}
  var D=["y_1-y_2-y_3\\ge-1","-3y_1+y_2+2y_3\\ge2","y\\ge0"];
  function dualCheck(y,id){var v1=y[0]-y[1]-y[2],v2=-3*y[0]+y[1]+2*y[2];return[
    "y_1-y_2-y_3="+v1+(v1>=-1?"\\ge-1\\ \\checkmark":"<-1\\ \\times"),
    "-3y_1+y_2+2y_3="+v2+(v2>=2?"\\ge2\\ \\checkmark":"<2\\ \\times"),
    "y=("+y.join(";\\ ")+")\\ge0\\ \\checkmark"]}
  function dcStep(y,title,text){var L=dualCheck(y);return{title:title,stage:function(){return srow(tlines("dc"+y.join(""),L,"ограничения двойственной (Q)"))},anim:L.map(function(t,n){return{f:t,moves:[],show:["dc"+y.join("")+":"+n],src:[]}}),text:text}}
  return[
   {title:"Условие",stage:srow(dm("\\begin{array}{l}f=-x_1+2x_2\\to\\max\\\\[6pt]\\begin{cases}x_1-3x_2\\le3\\\\-x_1+x_2\\le1\\\\-x_1+2x_2\\le4\\\\x_1,x_2\\ge0\\end{cases}\\end{array}"),op("⇒"),dm("\\begin{array}{l}g=3y_1+y_2+4y_3\\to\\min\\\\[6pt]Q:\\begin{cases}y_1-y_2-y_3\\ge-1\\\\-3y_1+y_2+2y_3\\ge2\\\\y_i\\ge0,\\ i=\\overline{1,3}\\end{cases}\\end{array}")),
    text:"<p>Пример 7 из задачника: проверить, оптимальны ли планы x¹ = (4; 4) и x² = (0; 1). Симплекс не нужен — хватает двойственной задачи.</p><p>Q — множество допустимых решений двойственной. Все ограничения прямой ≤, поэтому y ≥ 0.</p>"},
   {title:"Идея схемы",stage:dm("\\begin{array}{l}J_{\\bar x}=\\{\\,j\\mid \\bar x_j>0\\,\\}\\qquad I_{\\bar x}=\\{\\,i\\mid (a^i,\\bar x)<b_i\\,\\}\\\\[8pt](7):\\ \\begin{cases}(A^j,y)=c_j,&j\\in J\\\\y_i=0,&i\\in I\\end{cases}\\end{array}"),
    text:"<p>Если x̄ оптимален, то есть y* с двумя свойствами (дополняющая нежёсткость):</p><ul><li>x̄<sub>j</sub> &gt; 0 ⇒ j-е ограничение двойственной выполняется как <b>равенство</b>. Отсюда J и первая часть системы;</li><li>i-е ограничение прямой выполнено <b>строго</b> (ресурс не израсходован) ⇒ y<sub>i</sub> = 0. Отсюда I.</li></ul><p>Порядок: строим J и I → решаем (7) → если решения нет, x̄ не оптимален; если есть, проверяем, что y ∈ Q. Попал в Q — x̄ оптимален.</p>"},
   {title:"x¹ = (4; 4): подставляем в ограничения",stage:function(){return chk("q44",[4,4],true)},anim:subAnim("q44",[4,4]),
    text:"<p>Считаем левую часть каждого ограничения при x̄ и сравниваем с b.</p><ul><li>(1): −8 &lt; 3 — строго → 1 ∈ I;</li><li>(2): 0 &lt; 1 — строго → 2 ∈ I;</li><li>(3): 4 = 4 — равенство.</li></ul><p>Обе координаты x¹ положительные → J = {1, 2}.</p>"},
   eqStep([4,4],"x¹: строим систему (7)","<p>J = {1, 2}: для каждого j пишем j-е ограничение двойственной как равенство. Коэффициенты — j-й столбец A, справа c<sub>j</sub>.</p><p>I = {1, 2}: y₁ = 0 и y₂ = 0.</p><p>Уравнений четыре, неизвестных три — система может оказаться противоречивой. Тогда план сразу не оптимален.</p>"),
   {title:"x¹: решаем систему",stage:dm("y_1=y_2=0\\ \\Rightarrow\\ \\begin{cases}-y_3=-1\\ \\Rightarrow\\ y_3=1\\\\2y_3=2\\ \\Rightarrow\\ y_3=1\\ \\checkmark\\end{cases}\\qquad y^1=(0;\\ 0;\\ 1)"),
    text:"<p>Подставили нули из I в оба уравнения. Оба дают y₃ = 1, противоречия нет.</p>"},
   dcStep([0,0,1],"x¹: проверяем, что y¹ ∈ Q","<p>Подставляем y¹ в ограничения двойственной и в y ≥ 0. Всё выполнено, значит y¹ ∈ Q.</p><p class='ans'>"+im("x^1=(4;4)\\ \\text{оптимален},\\quad f(x^1)=-4+8=4=g(y^1)=4\\cdot1")+"</p>"),
   {title:"x² = (0; 1): подставляем в ограничения",stage:function(){return chk("q01",[0,1],true)},anim:subAnim("q01",[0,1]),
    text:"<ul><li>(1): −3 &lt; 3 — строго → 1 ∈ I;</li><li>(2): 1 = 1 — равенство;</li><li>(3): 2 &lt; 4 — строго → 3 ∈ I.</li></ul><p>x₁ = 0, x₂ = 1 &gt; 0 → J = {2}.</p>"},
   eqStep([0,1],"x²: строим систему (7)","<p>J = {2}: второе ограничение двойственной как равенство. I = {1, 3}: y₁ = 0, y₃ = 0.</p>"),
   {title:"x²: решаем систему",stage:dm("y_1=y_3=0\\ \\Rightarrow\\ y_2=2\\qquad y^2=(0;\\ 2;\\ 0)"),text:"<p>Решение есть. Теперь главное — допустимо ли оно для двойственной.</p>"},
   dcStep([0,2,0],"x²: проверяем, что y² ∈ Q","<p>Первое ограничение двойственной нарушено: −2 &lt; −1. Значит, y² ∉ Q.</p><p class='ans'>"+im("x^2=(0;1)\\ \\text{не оптимален}")+"</p><p>Сверка: f(x²) = 2 &lt; f(x¹) = 4 — лучший план действительно есть. Методичка отмечает, что в этом примере хватило бы и такого сравнения, но всё равно разбирает его по схеме — схему нужно уметь применять.</p>")
  ]}

/* ---------- двойственный симплекс-метод: шаги ---------- */
function iterStepsDual(t,k,r,s,nt,o){var steps=[],n=t.cols.length,xs=t.cols[s],xr=t.rows[r],p=t.M[r][s],cr=dualRatios(t,r,k);
  var base={cTop:o.costs,cB:o.costs};
  function st(extra){return function(){return '<div class="srow">'+renderTable(t,Object.assign({tid:"p",negB:true},base,extra))+(o.mini?o.mini(t):"")+'</div>'}}
  var negs=[];t.rows.forEach(function(rw,i){if(t.M[i][n].sign()<0)negs.push(nm(rw)+" = "+fmt(t.M[i][n]))});
  steps.push({title:"Выбираем ведущую строку",stage:st({hiRow:r}),
    text:'<p>Оценки Δ все ≥ 0 — «оптимальность» уже есть. Но в столбце b есть отрицательные: '+negs.join(", ")+'. Такое решение недопустимое (x ≥ 0 нарушено).</p><p>Двойственный симплекс исправляет именно это: берём строку с <b>самым отрицательным b</b> — '+nm(xr)+'. Эта переменная выйдет из базиса.</p>'});
  var anim=t.cols.map(function(c,j){var a=t.M[r][j];if(a.sign()<0)return{f:tv(c)+":\\quad\\frac{\\Delta_j}{|a|}=\\frac{"+tn(t.O[k][j])+"}{"+tn(a.neg())+"}="+tn(cr[j])+(j===s?"\\quad\\leftarrow\\ "+txt("минимум"):""),moves:[["p:"+(t.rows.length+k)+","+j,"p:cr"+j],["p:"+r+","+j,"p:cr"+j]],show:["p:cr"+j]};
    return{f:tv(c)+":\\quad a="+tn(a)+"\\ge0\\ \\Rightarrow\\ "+txt("пропускаем"),moves:[],src:["p:"+r+","+j],show:["p:cr"+j]}});
  steps.push({title:"Ищем ведущий столбец",stage:st({hiRow:r,cratios:cr,minCol:s}),anim:anim,
    text:'<p>В строке '+nm(xr)+' смотрим только на <b>отрицательные</b> элементы. Для каждого делим оценку Δ на модуль элемента и берём минимум.</p><p>Почему так: отрицательный элемент — единственный способ поднять отрицательное b до нуля. Минимум отношения нужен, чтобы после шага все Δ остались ≥ 0. Это зеркало правила min b/a из обычного симплекса.</p><p>Ведущий столбец — <b>'+nm(xs)+'</b>.</p>'});
  steps.push({title:"Ведущий элемент",stage:st({hiRow:r,hiCol:s,pivot:[r,s]}),
    text:'<p>'+im("p="+tn(p))+' — в двойственном симплексе он всегда <b>отрицательный</b>. '+nm(xs)+' входит в базис, '+nm(xr)+' выходит.</p><p>Дальше — те же жордановы преобразования, что и в обычном симплексе.</p>'});
  return steps.concat(jordanSteps(t,k,r,s,nt,o))}
function dualSimplexSteps(t,o){var steps=[],k=0,g=0;
  while(g++<12){var r=chooseRowDual(t);
    if(r<0){steps.push(o.finish(t));break}
    var s=chooseColDual(t,r,k);
    if(s<0){steps.push({title:"В строке нет отрицательных — Нр1",stage:function(){return renderTable(t,{tid:"p",cTop:o.costs,cB:o.costs,negB:true,hiRow:r})},text:"<p>b &lt; 0, а все элементы строки ≥ 0: эту базисную переменную нельзя сделать неотрицательной. Допустимых решений нет (Нр1).</p>"});break}
    var nt=pivot(t,r,s);steps=steps.concat(iterStepsDual(t,k,r,s,nt,o));t=nt}
  return{steps:steps,t:t}}

var DSR={cons:[{a:[1,1],c:3,s:">="},{a:[1,3],c:5,s:">="},{a:[2,1],c:4,s:">="}]};
function dsMini(visited){return function(t){var x1=plan(t,["x1"])[0],x2=plan(t,["x2"])[0];
  var vis=visited.filter(function(p){return !(p[0]===x1.val()&&p[1]===x2.val())}).map(function(p){return{x:p[0],y:p[1],cls:"bad",r:3.5}});
  var ok=t.M.every(function(r){return r[t.cols.length].sign()>=0});
  return '<div class="mini">'+plot({x0:-0.6,y0:-0.6,x1:5.6,y1:5.6,U:24,pad:12,tick:1,regions:[{cons:DSR.cons,cls:"regb"}],lines:[{a:[1,1],c:3,cls:"dim"},{a:[1,3],c:5,cls:"dim"},{a:[2,1],c:4,cls:"dim"}],path:visited,pts:vis.concat([{x:x1.val(),y:x2.val(),cls:ok?"hi":"bad",r:5,name:"("+tn(x1).replace(/\\tfrac\{(\d+)\}\{(\d+)\}/,"$1/$2")+"; "+tn(x2).replace(/\\tfrac\{(\d+)\}\{(\d+)\}/,"$1/$2")+")",dx:6}]),aria:"Путь двойственного симплекса"})+'</div>'}}
function dsDemo(){var costs={x1:-3,x2:-2};
  var t0=addObj(mk(["x1","x2"],["x3","x4","x5"],[[-1,-1],[-1,-3],[-2,-1]],[-3,-5,-4]),"Δ",costs),info0=objInfo(t0,0,costs,"p");
  var visited=[[0,0]],tt=t0,g=0;while(g++<10){var r=chooseRowDual(tt);if(r<0)break;tt=pivot(tt,r,chooseColDual(tt,r,0));visited.push([plan(tt,["x1"])[0].val(),plan(tt,["x2"])[0].val()])}
  function mini(t){var x1=plan(t,["x1"])[0].val(),x2=plan(t,["x2"])[0].val();var i=visited.findIndex(function(p){return p[0]===x1&&p[1]===x2});return dsMini(visited.slice(0,i+1))(t)}
  var steps=[
   {title:"Задача на min с ограничениями ≥",stage:dm("\\begin{array}{l}f=3x_1+2x_2\\to\\min\\\\[6pt]\\begin{cases}x_1+x_2\\ge3\\\\x_1+3x_2\\ge5\\\\2x_1+x_2\\ge4\\\\x_1,x_2\\ge0\\end{cases}\\end{array}"),
    text:"<p>Типичная задача «о смеси»: купить продукты x₁, x₂ по ценам 3 и 2 так, чтобы хватило трёх питательных веществ, и потратить минимум.</p><p>Обычным симплексом её решают через искусственный базис (три ≥ → три w). Двойственный симплекс решает её быстрее и без w.</p>"},
   {title:"Подготовка: −f → max и ≥ в ≤",stage:dm("\\begin{array}{l}-f=-3x_1-2x_2\\to\\max\\\\[6pt]\\begin{cases}-x_1-x_2+x_3=-3\\\\-x_1-3x_2+x_4=-5\\\\-2x_1-x_2+x_5=-4\\end{cases}\\end{array}"),
    text:"<p>1) min → max: меняем знаки у f.</p><p>2) Каждое ≥ умножаем на −1, получаем ≤ с <b>отрицательными</b> b, и прибавляем балансовую: x₃, x₄, x₅ дают готовый единичный базис.</p><p>Обычный симплекс тут не стартует: b &lt; 0. Зато все c в −f отрицательные, поэтому оценки Δ = −c получатся ≥ 0. Это и есть условие для двойственного симплекса.</p>"},
   {title:"Начальная таблица",stage:function(){return '<div class="srow">'+renderTable(t0,{tid:"p",cTop:costs,cB:costs,info:info0,negB:true})+mini(t0)+'</div>'},info:info0,anim:infoAnim(info0),
    text:"<p>Строка Δ считается как обычно. Все Δ ≥ 0, но все b &lt; 0 (красные).</p><p>Получается зеркальная ситуация. Обычный симплекс держит план <b>допустимым</b> (b ≥ 0) и добивается Δ ≥ 0. Двойственный держит <b>Δ ≥ 0</b> и добивается b ≥ 0. На графике справа точка (0; 0) лежит вне ОДР, и метод будет приближать её к области.</p>"}];
  var res=dualSimplexSteps(t0,{costs:costs,mini:mini,finish:function(t){var n=t.cols.length,pl=plan(t,["x1","x2","x3","x4","x5"]);return{title:"Все b ≥ 0 — оптимум",stage:function(){return '<div class="srow">'+renderTable(t,{tid:"p",cTop:costs,cB:costs,objHi:true})+mini(t)+'</div>'},
    text:"<p>В столбце b не осталось отрицательных, а Δ все ≥ 0 — решение допустимое и оптимальное одновременно.</p><p class='ans'>"+im("x^*="+tvec(pl)+",\\quad (-f)_{\\max}="+tn(t.O[0][n])+"\\ \\Rightarrow\\ f_{\\min}="+tn(t.O[0][n].neg()))+"</p><p>Проверка: "+im("3\\cdot1+2\\cdot2=7")+". Точка прошла путь (0; 0) → (0; 5/3) → (7/5; 6/5) → (1; 2). Первые три лежат вне ОДР: у каждой есть отрицательная базисная переменная. (1; 2) — первая допустимая вершина, и она сразу оптимальна.</p>"}}});
  return steps.concat(res.steps)}

/* ---------- практика: двойственный симплекс, устойчивый иск. базис ---------- */
function solDual(t,costs){var h="",g=0;
  while(g++<12){var r=chooseRowDual(t);
    if(r<0){h+=renderTable(t,{cTop:costs,cB:costs,objHi:true});break}
    var s=chooseColDual(t,r,0),cr=dualRatios(t,r,0);
    if(s<0){h+=renderTable(t,{cTop:costs,cB:costs,negB:true,hiRow:r});break}
    h+=renderTable(t,{cTop:costs,cB:costs,negB:true,hiRow:r,cratios:cr,minCol:s,pivot:[r,s]})+'<div class="arrow">⇒</div>';t=pivot(t,r,s)}
  return{h:h,t:t}}
function dropRow(t,i){t=clone(t);t.rows.splice(i,1);t.M.splice(i,1);return t}
function artSolveHTML(d){var ca={};d.arts.forEach(function(a){ca[a]=-1});
  var r=solSimplex(addObj(mk(d.cols,d.rows,d.A,d.b),"F",ca),0,ca,d.arts),t=r.t,n=t.cols.length,h='<span class="pen">фаза 1</span>'+r.h;
  if(t.O[0][n].sign()<0)return h;
  for(var i=t.rows.length-1;i>=0;i--){if(d.arts.indexOf(t.rows[i])<0)continue;
    var j=-1;for(var q=0;q<t.cols.length;q++)if(t.M[i][q].sign()!==0){j=q;break}
    if(j<0){h+='<div class="arrow">⇒</div><span class="pen">строка '+t.rows[i].replace(/\d/,function(x){return"₀₁₂₃₄₅₆₇₈₉"[x]})+' из одних нулей — ограничение лишнее, вычёркиваем строку</span>';t=dropRow(t,i)}
    else{var w=t.rows[i];h+='<div class="arrow">⇒</div><span class="pen">'+w.replace(/\d/,function(x){return"₀₁₂₃₄₅₆₇₈₉"[x]})+' осталась в базисе с b = 0: выводим её через любой ненулевой элемент строки</span>'+renderTable(t,{cTop:ca,cB:ca,hiRow:i,hiCol:j,pivot:[i,j]});t=pivot(t,i,j);t=dropCol(t,t.cols.indexOf(w))}}
  var t2=addObj(dropObj(t,0),"f",d.c);h+='<div class="arrow">⇒</div><span class="pen">F = 0, вычёркиваем, считаем f</span>'+solSimplex(t2,0,d.c).h;return h}

var SX2={
  S4:{cols:["x1","x3"],rows:["x2","x4","x5"],A:[[2,-3],[1,1],[-3,-2]],b:[10,7,4],c:{x1:2,x2:-1,x3:3,x4:1}},
  S5:{cols:["x1","x2","x3"],rows:["x4","x5","x6"],A:[[1,1,0],[1,1,1],[0,1,1]],b:[0,1,1],c:{x1:1,x2:4,x3:1,x4:1,x5:-2,x6:1}},
  D7:{cols:["x1","x2"],rows:["x3","x4","x5"],A:[[-1,2],[1,2],[1,-1]],b:[2,8,3],c:{x1:1,x2:3}}};
var AX2={
  A3:{cols:["x1","x2","x3","x4","x5"],rows:["w1","x6","x7"],A:[[1,-1,-2,1,-1],[-1,0,1,0,0],[0,2,-3,2,0]],b:[6,2,8],c:{x1:1,x2:1,x3:1,x4:1},arts:["w1"]},
  A4:{cols:["x1","x2","x3"],rows:["w1","w2"],A:[[2,-1,1],[1,-2,-1]],b:[6,2],c:{x1:3,x2:1,x3:1},arts:["w1","w2"]},
  A4b:{cols:["x1","x2","x3"],rows:["w1","w2"],A:[[2,-1,1],[1,-2,-1]],b:[6,4],c:{x1:3,x2:1,x3:1},arts:["w1","w2"]},
  A5:{cols:["x1","x2","x3","x4"],rows:["w1","w2","w3"],A:[[1,3,2,1],[2,0,1,-1],[-3,1,-1,2]],b:[8,1,1],c:{x1:1,x2:1,x3:2,x4:1},arts:["w1","w2","w3"]},
  A6:{cols:["x1","x2","x3","x4"],rows:["w1","w2"],A:[[1,1,1,1],[1,-1,1,-1]],b:[1,1],c:{x1:2,x2:3},arts:["w1","w2"]},
  D8:{cols:["x1","x2","x3"],rows:["w1","x4","x5"],A:[[1,2,-1],[-1,2,0],[1,-1,0]],b:[1,2,2],c:{x1:1,x2:2},arts:["w1"]}};
var DS={
  a:{cols:["x1","x2"],rows:["x3","x4"],A:[[-3,-1],[-4,-3]],b:[-3,-5],c:{x1:-2,x2:-1}},
  b:{cols:["x2","x3"],rows:["x4","x1"],A:[[-3,-1],[1,1]],b:[-4,3],c:{x1:1,x2:-3,x3:-5}},
  v:{cols:["x1","x2"],rows:["x3","x4","x5"],A:[[1,2],[-4,-3],[-3,-1]],b:[3,-6,-3],c:{x1:-3,x2:-1}},
  g:{cols:["x1","x2"],rows:["x3","x4","x5"],A:[[-3,-2],[-1,-3],[1,2]],b:[-6,-3,4],c:{x1:-2,x2:-3,x3:1,x4:-1}},
  d:{cols:["x3","x4","x5"],rows:["x1","x2","x6","x7"],A:[[-1,1,0],[-1,1,-1],[-3,1,-1],[1,2,-1]],b:[4,5,-4,1],c:{x1:5,x2:-1,x3:-4}}};
var JT={
  a:{cols:["x2","x1","x5"],rows:["x4","x3"],A:[[0,2,"-7/4"],[-1,-1,"-1/4"]],b:[2,0]},
  b:{cols:["x1","x3","x6"],rows:["x2","x4","x5"],A:[[-1,2,"1/2"],[3,5,"-1/2"],["1/2","-3/2",2]],b:[6,5,4]}};
function frs(v){if(typeof v==="string"){var p=v.split("/");return new Fr(+p[0],+p[1])}return F(v)}
function fillPractice2(){
  root.querySelectorAll("[data-sx2]").forEach(function(el){var d=SX2[el.getAttribute("data-sx2")];el.innerHTML=solSimplex(addObj(mk(d.cols,d.rows,d.A,d.b),"Δ",d.c),0,d.c).h});
  root.querySelectorAll("[data-ax2]").forEach(function(el){el.innerHTML=artSolveHTML(AX2[el.getAttribute("data-ax2")])});
  root.querySelectorAll("[data-ds]").forEach(function(el){var d=DS[el.getAttribute("data-ds")];el.innerHTML=solDual(addObj(mk(d.cols,d.rows,d.A,d.b),"Δ",d.c),d.c).h});
  root.querySelectorAll("[data-jt]").forEach(function(el){var d=JT[el.getAttribute("data-jt")];var t={cols:d.cols,rows:d.rows,M:d.A.map(function(r,i){return r.map(frs).concat([F(d.b[i])])}),objs:[],O:[]};el.innerHTML=renderTable(t,{})});
  var Gp={
   B2:plot({x0:-0.6,y0:-0.6,x1:3.6,y1:3.6,U:44,regions:[{cons:[{a:[-1,1],c:1,s:"<="},{a:[1,1],c:2,s:"<="}],cls:"regb"}],lines:[{a:[-1,1],c:1,label:"x₃ = 0",at:[1.6,3.2]},{a:[1,1],c:2,label:"x₄ = 0",at:[2.2,0.25]}],pts:[{x:0,y:0,name:"(0; 0)",dx:6,dy:-8,cls:"hi"},{x:2,y:0,name:"(2; 0)",dx:4,dy:-8,cls:"hi"},{x:0.5,y:1.5,name:"(1/2; 3/2)",cls:"hi"},{x:0,y:1,name:"(0; 1)",dx:-44,cls:"hi"}],aria:"Множество X на плоскости x1Ox2"}),
   G4:plot({x0:-0.6,y0:-0.6,x1:9.6,y1:5.6,U:30,regions:[{cons:[{a:[-1,2],c:2,s:"<="},{a:[1,2],c:8,s:"<="},{a:[1,-1],c:3,s:"<="}],cls:"regb"}],lines:[{a:[-1,2],c:2,label:"(1)",at:[6.2,4.4]},{a:[1,2],c:8,label:"(2)",at:[6.6,0.9]},{a:[1,-1],c:3,label:"(3)",at:[6.6,3.3]}],grad:[1,3],gradLen:1.6,level:10.5,pts:[{x:0,y:0,name:"O",dx:-12,dy:14},{x:3,y:0,name:"A",dy:14},{x:14/3,y:5/3,name:"B"},{x:3,y:2.5,name:"C(3; 5/2)",cls:"hi"},{x:0,y:1,name:"D",dx:-14}],aria:"Решение Г4"}),
   G5:plot({x0:-0.6,y0:-0.6,x1:8.6,y1:5.6,U:30,regions:[{cons:[{a:[1,2],c:1,s:">="},{a:[-1,2],c:2,s:"<="},{a:[1,-1],c:2,s:"<="}],cls:"regb"}],lines:[{a:[1,2],c:1,label:"(1)",at:[0.1,0.75]},{a:[-1,2],c:2,label:"(2)",at:[4.3,3.4]},{a:[1,-1],c:2,label:"(3)",at:[6.6,4.9]}],grad:[1,2],gradLen:1.6,level:14,pts:[{x:6,y:4,name:"(6; 4)",cls:"hi"},{x:1,y:0,name:"A",dy:14},{x:2,y:0,name:"B",dy:14},{x:0,y:0.5,name:"",dx:-12},{x:0,y:1,name:"",dx:-14}],aria:"Решение Г5"})};
  root.querySelectorAll("[data-g2]").forEach(function(el){el.innerHTML=Gp[el.getAttribute("data-g2")]})}

anatomy();
new Stepper($id("st-slau"),slauSteps);
new Stepper($id("st-rank"),rankSteps);
new Stepper($id("st-basis"),basisSteps);
picker();
new Stepper($id("demo-graph"),graphSteps);
new Stepper($id("demo-simplex"),simplexDemo());
new Stepper($id("demo-art"),artDemo());
new Stepper($id("demo-dual"),dualDemo());
new Stepper($id("demo-p6"),p6Demo());
new Stepper($id("demo-p7"),p7Demo());
new Stepper($id("demo-dsim"),dsDemo());
fillPractice2();
fillPractice();navSpy();
}
