import { mountLearning } from "./learning.js";
export function mount(root, ctx) {
var FIG;

"use strict";
/* ================= регулярные выражения ================= */
var E_EPS = { t: "eps" }, E_EMPTY = { t: "empty" };
function sym(v) { return { t: "sym", v: v } }
function cat() { return { t: "cat", a: Array.prototype.slice.call(arguments) } }
function alt() { return { t: "alt", a: Array.prototype.slice.call(arguments) } }
function star(e) { return { t: "star", e: e } }
function plus(e) { return { t: "plus", e: e } }

function ReErr(msg) { this.message = msg }
function parseRe(src) {
  var s = Array.from(String(src).replace(/eps/gi, "ε").replace(/\^\+/g, "⁺").replace(/\^\*/g, "*").replace(/,/g, "+").replace(/\s+/g, ""));
  if (!s.length) throw new ReErr("Пустое выражение");
  var i = 0;
  function isSym(c) { return c !== undefined && /[0-9A-Za-zА-Яа-яЁё]/.test(c) }
  function sum() { var t = [prod()]; while (s[i] === "+") { i++; t.push(prod()) } return t.length > 1 ? { t: "alt", a: t } : t[0] }
  function prod() {
    var f = [];
    while (i < s.length && s[i] !== "+" && s[i] !== ")") f.push(un());
    if (!f.length) throw new ReErr(i < s.length ? "Перед «" + s[i] + "» (позиция " + (i + 1) + ") не хватает операнда" : "Выражение обрывается на «+»");
    return f.length > 1 ? { t: "cat", a: f } : f[0];
  }
  function un() { var e = atom(); while (s[i] === "*" || s[i] === "⁺") { e = s[i] === "*" ? { t: "star", e: e } : { t: "plus", e: e }; i++ } return e }
  function atom() {
    var c = s[i];
    if (c === "(") { i++; var e = sum(); if (s[i] !== ")") throw new ReErr("Не хватает закрывающей скобки"); i++; return e }
    if (c === "ε") { i++; return E_EPS }
    if (c === "∅") { i++; return E_EMPTY }
    if (isSym(c)) { i++; return sym(c) }
    if (c === "*" || c === "⁺") throw new ReErr("«" + c + "» на позиции " + (i + 1) + " не к чему применить");
    throw new ReErr("Непонятный символ «" + c + "» на позиции " + (i + 1));
  }
  var r = sum();
  if (i < s.length) throw new ReErr("Лишняя «)» на позиции " + (i + 1));
  return r;
}

/* печать: ctx 0 — где угодно, 1 — внутри склейки, 2 — под звёздочкой */
function pr(e, ctx, h) {
  ctx = ctx || 0;
  switch (e.t) {
    case "sym": return e.v;
    case "eps": return "ε";
    case "empty": return "∅";
    case "alt": { var x = e.a.map(function (y) { return pr(y, 0, h) }).join("+"); return ctx > 0 ? "(" + x + ")" : x }
    case "cat": { var z = e.a.map(function (y) { return pr(y, 1, h) }).join(""); return ctx > 1 ? "(" + z + ")" : z }
    case "star": return pr(e.e, 2, h) + (h ? "<sup>*</sup>" : "*");
    case "plus": return pr(e.e, 2, h) + (h ? "<sup>+</sup>" : "⁺");
  }
}
function P(e) { return pr(e, 0, false) }
function PH(e) { return pr(e, 0, true) }
function isAtom(e) { return e.t === "sym" || e.t === "eps" }

function S(e) {
  switch (e.t) {
    case "cat": {
      var a = [];
      var parts = e.a.map(S);
      for (var i = 0; i < parts.length; i++) {
        var x = parts[i];
        if (x.t === "empty") return E_EMPTY;
        if (x.t === "eps") continue;
        if (x.t === "cat") a.push.apply(a, x.a); else a.push(x);
      }
      return a.length === 0 ? E_EPS : a.length === 1 ? a[0] : { t: "cat", a: a };
    }
    case "alt": {
      var b = [], seen = {};
      e.a.map(S).forEach(function (x) {
        (x.t === "alt" ? x.a : [x]).forEach(function (y) {
          if (y.t === "empty") return;
          var k = P(y);
          if (!seen[k]) { seen[k] = 1; b.push(y) }
        });
      });
      return b.length === 0 ? E_EMPTY : b.length === 1 ? b[0] : { t: "alt", a: b };
    }
    case "star": {
      var y = S(e.e);
      if (y.t === "eps" || y.t === "empty") return E_EPS;
      if (y.t === "star" || y.t === "plus") y = y.e;
      if (y.t === "alt") {
        var c = y.a.filter(function (z) { return z.t !== "eps" });
        if (!c.length) return E_EPS;
        y = c.length === 1 ? c[0] : { t: "alt", a: c };
        if (y.t === "star" || y.t === "plus") y = y.e;
      }
      return { t: "star", e: y };
    }
    case "plus": {
      var w = S(e.e);
      if (w.t === "eps") return E_EPS;
      if (w.t === "empty") return E_EMPTY;
      if (w.t === "star" || w.t === "plus") return w;
      return { t: "plus", e: w };
    }
    default: return e;
  }
}
function leaves(e) {
  switch (e.t) {
    case "sym": case "eps": case "empty": return 1;
    case "alt": case "cat": return e.a.reduce(function (s, x) { return s + leaves(x) }, 0);
    default: return leaves(e.e) + 1;
  }
}
function letters(e, out) {
  out = out || {};
  if (e.t === "sym") out[e.v] = 1;
  else if (e.a) e.a.forEach(function (x) { letters(x, out) });
  else if (e.e) letters(e.e, out);
  return out;
}

/* ================= граф ================= */
var RAD = 19;
function N(g, id) { for (var i = 0; i < g.nodes.length; i++) if (g.nodes[i].id === id) return g.nodes[i]; return null }
function addNode(g, o) { g.nodes.push(o); return o }
function addEdge(g, from, to, re, at) {
  var e = { id: "e" + (++g.eid), from: from, to: to, re: re };
  if (at == null) g.edges.push(e); else g.edges.splice(at, 0, e);
  return e;
}
function cloneG(g) {
  return {
    nodes: g.nodes.map(function (n) { return Object.assign({}, n) }),
    edges: g.edges.map(function (e) { return Object.assign({}, e) }),
    eid: g.eid, nc: g.nc, pre: g.pre
  };
}
function unit(x, y) { var l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l } }
function quad(a, b, bend) {
  var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, px = dy / L, py = -dx / L;
  return { c: { x: mx + px * bend * 2, y: my + py * bend * 2 }, px: px, py: py };
}
function qpt(a, c, b, t) { var u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y } }
function segDist(m, a, b) {
  var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  var t = ((m.x - a.x) * dx + (m.y - a.y) * dy) / L2;
  if (t < 0.08 || t > 0.92) return 1e9;
  return Math.hypot(a.x + t * dx - m.x, a.y + t * dy - m.y);
}
function angDiff(a, b) { var d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d }

function layoutEdges(g) {
  var geo = {}, groups = {}, order = [];
  g.edges.forEach(function (e) {
    if (e.from === e.to) return;
    var k = e.from < e.to ? e.from + "|" + e.to : e.to + "|" + e.from;
    if (!groups[k]) { groups[k] = []; order.push(k) }
    groups[k].push(e);
  });
  order.forEach(function (k) {
    var arr = groups[k], n = arr.length;
    arr.forEach(function (e, i) {
      var b = 0;
      if (n > 1) { var A0 = N(g, e.from), C0 = N(g, e.to), len = Math.hypot(C0.x - A0.x, C0.y - A0.y); var off = (i - (n - 1) / 2) * Math.max(46, Math.min(130, len * 0.15)); b = e.from < e.to ? off : -off }
      else {
        var a = N(g, e.from), c = N(g, e.to);
        for (var j = 0; j < g.nodes.length; j++) {
          var m = g.nodes[j];
          if (m.id === e.from || m.id === e.to) continue;
          if (segDist(m, a, c) < 28) { b = e.from < e.to ? 52 : -52; break }
        }
      }
      geo[e.id] = { bend: b };
    });
  });
  var loops = {};
  g.edges.forEach(function (e) { if (e.from === e.to) (loops[e.from] = loops[e.from] || []).push(e) });
  Object.keys(loops).forEach(function (id) {
    var nd = N(g, id), dirs = [];
    g.edges.forEach(function (e) {
      if (e.from === e.to) return;
      var o = null;
      if (e.from === id) o = N(g, e.to); else if (e.to === id) o = N(g, e.from);
      if (o) {
        var base = Math.atan2(o.y - nd.y, o.x - nd.x);
        var bd = geo[e.id] ? geo[e.id].bend : 0;
        if (bd) { var sgn = e.from === id ? -1 : 1; base += sgn * (bd > 0 ? 1 : -1) * 0.5 }
        dirs.push(base);
      }
    });
    if (nd.start) dirs.push(Math.PI);
    var cands = [-90, -45, -135, 90, 45, 135, 0, 180].map(function (d) { return d * Math.PI / 180 });
    var used = [];
    loops[id].forEach(function (e) {
      var best = cands[0], bs = -1;
      cands.forEach(function (c) {
        if (used.some(function (u) { return angDiff(u, c) < 0.1 })) return;
        var sc = Math.PI;
        dirs.concat(used).forEach(function (d) { sc = Math.min(sc, angDiff(c, d)) });
        if (sc > bs + 0.15) { bs = sc; best = c }
      });
      used.push(best);
      geo[e.id] = { ang: best };
    });
  });
  return geo;
}

/* ---------- сцена: координаты всего, что рисуем ---------- */
function scene(g, o) {
  o = o || {};
  var geo = layoutEdges(g);
  var bx = [1e9, 1e9, -1e9, -1e9];
  function grow(x, y) { bx[0] = Math.min(bx[0], x); bx[1] = Math.min(bx[1], y); bx[2] = Math.max(bx[2], x); bx[3] = Math.max(bx[3], y) }
  var edges = g.edges.map(function (e) {
    var a = N(g, e.from), b = N(g, e.to), txt = P(e.re), w = Array.from(txt).length * 7.9 + 10, d, lx, ly;
    if (e.from === e.to) {
      var an = geo[e.id].ang, ux = Math.cos(an), uy = Math.sin(an);
      var rot = function (t) { return { x: Math.cos(an + t), y: Math.sin(an + t) } };
      var s1 = rot(-0.42), s2 = rot(0.42), c1 = rot(-0.62), c2 = rot(0.62), D = RAD + 50;
      d = "M" + f1(a.x + s1.x * RAD) + "," + f1(a.y + s1.y * RAD) + " C" + f1(a.x + c1.x * D) + "," + f1(a.y + c1.y * D) + " " + f1(a.x + c2.x * D) + "," + f1(a.y + c2.y * D) + " " + f1(a.x + s2.x * (RAD + 2)) + "," + f1(a.y + s2.y * (RAD + 2));
      var dist = 58 + Math.abs(ux) * (w / 2 - 8);
      lx = a.x + ux * dist; ly = a.y + uy * dist;
      grow(a.x + c1.x * 52, a.y + c1.y * 52); grow(a.x + c2.x * 52, a.y + c2.y * 52);
    } else {
      var bend = geo[e.id].bend, q = quad(a, b, bend), c = q.c;
      var u1 = unit(c.x - a.x, c.y - a.y), u2 = unit(c.x - b.x, c.y - b.y);
      d = "M" + f1(a.x + u1.x * RAD) + "," + f1(a.y + u1.y * RAD) + " Q" + f1(c.x) + "," + f1(c.y) + " " + f1(b.x + u2.x * (RAD + 1.5)) + "," + f1(b.y + u2.y * (RAD + 1.5));
      var m = qpt(a, c, b, 0.5), sg = bend === 0 ? 1 : (bend > 0 ? 1 : -1);
      var off = Math.abs(q.px) * w / 2 + Math.abs(q.py) * 9 + 4;
      lx = m.x + q.px * sg * off; ly = m.y + q.py * sg * off;
      grow(m.x, m.y);
    }
    grow(lx - w / 2, ly - 10); grow(lx + w / 2, ly + 10);
    return { id: e.id, d: d, lx: lx, ly: ly, w: w, txt: txt, cls: (o.ecls && o.ecls[e.id]) || "" };
  });
  var nodes = g.nodes.map(function (n) {
    grow(n.x - RAD - 4, n.y - RAD - 4); grow(n.x + RAD + 4, n.y + RAD + 4);
    if (n.start) grow(n.x - RAD - 40, n.y);
    return { id: n.id, name: n.name, x: n.x, y: n.y, start: n.start, final: n.final, cls: (o.ncls && o.ncls[n.id]) || "" };
  });
  return { edges: edges, nodes: nodes, box: bx };
}
function f1(x) { return Math.round(x * 10) / 10 }
function unionBox(boxes) {
  var b = [1e9, 1e9, -1e9, -1e9];
  boxes.forEach(function (x) { b[0] = Math.min(b[0], x[0]); b[1] = Math.min(b[1], x[1]); b[2] = Math.max(b[2], x[2]); b[3] = Math.max(b[3], x[3]) });
  return b;
}
function nameSvg(name) {
  var b = /^\[(.*)\]$/.exec(name);
  if (b) { var mb = /^([A-Za-zА-Яа-я]+?)(\d+|f)$/.exec(b[1]); if (mb) return "[" + esc(mb[1]) + '<tspan class="sb" dy="4">' + esc(mb[2]) + '</tspan><tspan dy="-4">]</tspan>'; return esc(name) }
  var m = /^([A-Za-zА-Яа-я]+?)(\d+|f)$/.exec(name);
  if (m && m[1].length <= 2) return esc(m[1]) + '<tspan class="sb" dy="4">' + esc(m[2]) + "</tspan>";
  return esc(name);
}
function nameHtml(name) {
  var m = /^([A-Za-zА-Яа-я]+?)(\d+|f)$/.exec(name);
  if (m && m[1].length <= 2) return esc(m[1]) + "<sub>" + esc(m[2]) + "</sub>";
  return esc(name);
}
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }

function drawScene(sc, box, extraCls) {
  var pad = 16, x = box[0] - pad, y = box[1] - pad, W = box[2] - box[0] + 2 * pad, H = box[3] - box[1] + 2 * pad;
  var h = '<svg class="gr ' + (extraCls || "") + '" viewBox="' + f1(x) + " " + f1(y) + " " + f1(W) + " " + f1(H) + '" width="' + Math.round(W) + '" style="max-width:' + Math.round(W) + "px;min-width:" + Math.round(Math.min(W, 360)) + 'px" role="img" aria-label="Граф автомата">';
  sc.edges.forEach(function (e) {
    var color = e.cls.split(" ")[0];
    var mk = color === "in" ? "ain" : color === "out" ? "aout" : color === "lp" ? "alp" : color === "nw" ? "anw" : color === "gh" ? "agh" : "aink";
    h += '<path class="ed ' + e.cls + '" pathLength="1" d="' + e.d + '" marker-end="url(#' + mk + ')"/>';
  });
  sc.nodes.forEach(function (n) {
    if (n.start) h += '<path class="sta" d="M' + f1(n.x - RAD - 34) + "," + f1(n.y) + " L" + f1(n.x - RAD - 2) + "," + f1(n.y) + '" marker-end="url(#aink)"/>';
  });
  sc.nodes.forEach(function (n) {
    h += '<g class="nd ' + n.cls + '" style="transform-origin:' + f1(n.x) + "px " + f1(n.y) + 'px"><circle cx="' + f1(n.x) + '" cy="' + f1(n.y) + '" r="' + RAD + '"/>' + (n.final ? '<circle class="in2" cx="' + f1(n.x) + '" cy="' + f1(n.y) + '" r="' + (RAD - 4) + '"/>' : "") + '<text x="' + f1(n.x) + '" y="' + f1(n.y) + '">' + nameSvg(n.name) + "</text></g>";
  });
  sc.edges.forEach(function (e) {
    h += '<g class="lb ' + e.cls + '"><rect x="' + f1(e.lx - e.w / 2) + '" y="' + f1(e.ly - 10) + '" width="' + f1(e.w) + '" height="20" rx="4"/><text x="' + f1(e.lx) + '" y="' + f1(e.ly) + '">' + esc(e.txt) + "</text></g>";
  });
  return h + "</svg>";
}
function svgGraph(g, o, box, extraCls) { var sc = scene(g, o); return drawScene(sc, box || sc.box, extraCls) }

/* ================= регулярка → автомат: разбиение дуг ================= */
function layeredLayout(g, startId, endId) {
  var ids = g.nodes.map(function (n) { return n.id }), out = {}, all = {};
  ids.forEach(function (id) { out[id] = []; all[id] = [] });
  g.edges.forEach(function (e) { if (e.from !== e.to) { out[e.from].push(e.to); all[e.from].push(e.to); all[e.to].push(e.from) } });
  var state = {}, order = [], back = {};
  (function dfs(v) { state[v] = 1; out[v].forEach(function (w) { if (state[w] === 1) back[v + ">" + w] = 1; else if (!state[w]) dfs(w) }); state[v] = 2; order.push(v) })(startId);
  ids.forEach(function (id) { if (!state[id]) { (function dfs(v) { state[v] = 1; out[v].forEach(function (w) { if (state[w] === 1) back[v + ">" + w] = 1; else if (!state[w]) dfs(w) }); state[v] = 2; order.push(v) })(id) } });
  order.reverse();
  var L = {}; ids.forEach(function (id) { L[id] = 0 });
  order.forEach(function (v) { out[v].forEach(function (w) { if (!back[v + ">" + w]) L[w] = Math.max(L[w], L[v] + 1) }) });
  var maxL = 0; ids.forEach(function (id) { if (id !== endId) maxL = Math.max(maxL, L[id]) });
  if (endId) L[endId] = maxL + 1;
  var layers = {}; ids.forEach(function (id) { (layers[L[id]] = layers[L[id]] || []).push(id) });
  var pos = {}; Object.keys(layers).forEach(function (k) { layers[k].forEach(function (id, i) { pos[id] = i - (layers[k].length - 1) / 2 }) });
  for (var it = 0; it < 6; it++) {
    Object.keys(layers).forEach(function (k) {
      var arr = layers[k];
      var bc = {}; arr.forEach(function (id) { var nb = all[id]; bc[id] = nb.length ? nb.reduce(function (s, w) { return s + pos[w] }, 0) / nb.length : pos[id] });
      arr.sort(function (a, b) { return bc[a] - bc[b] });
      arr.forEach(function (id, i) { pos[id] = i - (arr.length - 1) / 2 });
    });
  }
  var P = {}; ids.forEach(function (id) { P[id] = { x: L[id] * 125, y: pos[id] * 105 + ((L[id] % 2) && layers[L[id]].length % 2 === 0 ? 0 : 0) } });
  return P;
}

function relax(g, ids) {
  if (!ids.length) return;
  var MIN = 96;
  for (var it = 0; it < 90; it++) {
    var moved = false;
    ids.forEach(function (id) {
      var n = N(g, id);
      g.nodes.forEach(function (m) {
        if (m === n) return;
        var dx = n.x - m.x, dy = n.y - m.y, d = Math.hypot(dx, dy);
        if (d < 0.01) { dx = 0.3; dy = 1; d = 1.04 }
        if (d < MIN) {
          var k = ids.indexOf(m.id) >= 0 ? 0.25 : 0.5;
          n.x += dx / d * (MIN - d) * k; n.y += dy / d * (MIN - d) * k; moved = true;
        }
      });
    });
    if (!moved) break;
  }
}

function splitEdge(g, idx, geo) {
  var e = g.edges[idx], r = e.re;
  g.edges.splice(idx, 1);
  var a = N(g, e.from), b = N(g, e.to), loop = e.from === e.to, newN = [], newE = [], at = idx;
  var gi = geo[e.id] || {};
  function place(k, count) {
    if (!loop) { var q = quad(a, b, gi.bend || 0); return qpt(a, q.c, b, (k + 1) / (count + 1)) }
    var ang = gi.ang == null ? -Math.PI / 2 : gi.ang;
    var t = count > 1 ? k / (count - 1) - 0.5 : 0, an = ang + t * 1.5, dd = count > 1 ? 105 : 100;
    return { x: a.x + Math.cos(an) * dd, y: a.y + Math.sin(an) * dd };
  }
  function mk(pt) { var id = (g.pre || "q") + (++g.nc); addNode(g, { id: id, name: id, x: pt.x, y: pt.y }); newN.push(id); return id }
  function add(f, t, re) { var ne = addEdge(g, f, t, re, at++); newE.push(ne.id) }
  switch (r.t) {
    case "empty": break;
    case "alt": r.a.forEach(function (x) { add(e.from, e.to, x) }); break;
    case "cat": {
      var k = r.a.length, ids = [e.from];
      for (var i = 0; i < k - 1; i++) ids.push(mk(place(i, k - 1)));
      ids.push(e.to);
      r.a.forEach(function (x, i) { add(ids[i], ids[i + 1], x) });
      break;
    }
    case "star": { var n = mk(place(0, 1)); add(e.from, n, E_EPS); add(n, n, r.e); add(n, e.to, E_EPS); break }
    case "plus": { var n2 = mk(place(0, 1)); add(e.from, n2, r.e); add(n2, n2, r.e); add(n2, e.to, E_EPS); break }
  }
  relax(g, newN);
  return { rule: r.t, old: e, newN: newN, newE: newE, loop: loop };
}

function ruleText(res, names) {
  var e = res.old, r = e.re, p = nameHtml(names(e.from)), q = nameHtml(names(e.to)), lab = '<span class="re c-del">' + PH(r) + "</span>";
  var where = res.loop ? "петлю на " + p + " с меткой " + lab + ". Петля — это дуга " + p + " → " + p + ", правило то же самое, только начало и конец совпадают" : "дугу " + p + " → " + q + " с меткой " + lab;
  var nn = res.newN.map(function (id) { return nameHtml(names(id)) }).join(", ");
  switch (r.t) {
    case "alt": return "<p>Берём " + where + ".</p><p>Главная операция — <b>сумма</b> из " + r.a.length + " слагаемых. Правило <span class=\"re\">R<sub>1</sub>+R<sub>2</sub></span> ⇒ параллельные дуги между теми же вершинами: " + r.a.map(function (x) { return '<span class="re c-new">' + PH(x) + "</span>" }).join(", ") + ".</p>";
    case "cat": return "<p>Берём " + where + ".</p><p>Главная операция — <b>склейка</b> из " + r.a.length + " частей. Правило <span class=\"re\">R<sub>1</sub>R<sub>2</sub></span> ⇒ цепочка через новые вершины (" + nn + "): " + r.a.map(function (x) { return '<span class="re c-new">' + pr(x, 1, true) + "</span>" }).join(" → ") + ".</p>";
    case "star": return "<p>Берём " + where + ".</p><p>Главная операция — <b>итерация</b>. Правило <span class=\"re\">R<sup>*</sup></span> ⇒ новая вершина " + nn + ": вход по ε, на ней петля <span class=\"re c-new\">" + PH(r.e) + "</span>, выход по ε.</p>";
    case "plus": return "<p>Берём " + where + ".</p><p>Главная операция — <b>R<sup>+</sup></b>, то есть «хотя бы один раз»: R<sup>+</sup> = RR<sup>*</sup>. Правило ⇒ новая вершина " + nn + ": вход по <span class=\"re c-new\">" + PH(r.e) + "</span> (первый обязательный раз), петля <span class=\"re c-new\">" + PH(r.e) + "</span> (повторы), выход по ε.</p>";
    case "empty": return "<p>Метка ∅ — по этой дуге пройти нельзя. Стираем её.</p>";
  }
  return "";
}

function regexSteps(src, opts) {
  opts = opts || {};
  var re = parseRe(src);
  var g = { nodes: [], edges: [], eid: 0, nc: 0, pre: "q" };
  var L = Math.max(260, Math.min(1000, 80 * leaves(re)));
  addNode(g, { id: "q0", name: "q0", x: 0, y: 0, start: true });
  addNode(g, { id: "qf", name: "qf", x: L, y: 0, final: true });
  var e0 = addEdge(g, "q0", "qf", re);
  var names = function (id) { var n = N(g, id); return n ? n.name : id };
  var steps = [{
    title: "Старт: одна дуга с целым выражением",
    g: cloneG(g), o: { ecls: (function () { var x = {}; x[e0.id] = "lp"; return x })() },
    text: "<p>Рисуем начальное состояние q<sub>0</sub>, финальное q<sub>f</sub> и одну дугу между ними. На ней пишем всё выражение <span class=\"re\">" + PH(re) + "</span>.</p><p>Это законный «обобщённый» автомат: из q<sub>0</sub> в q<sub>f</sub> можно пройти ровно по словам из R. Дальше разбиваем толстые дуги, пока на всех не останутся буквы и ε.</p>"
  }];
  var guard = 0;
  while (guard++ < 200) {
    var idx = -1;
    for (var i = 0; i < g.edges.length; i++) if (!isAtom(g.edges[i].re)) { idx = i; break }
    if (idx < 0) break;
    var geo = layoutEdges(g);
    var oldE = g.edges[idx];
    var before = cloneG(g);
    var res = splitEdge(g, idx, geo);
    var ecls = {}, ncls = {};
    res.newE.forEach(function (id) { ecls[id] = "nw fresh" });
    res.newN.forEach(function (id) { ncls[id] = "nw fresh" });
    var bcls = {}; bcls[oldE.id] = "lp";
    steps.push({
      title: "Шаг " + steps.length + ": разбиваем «" + P(oldE.re) + "»",
      before: { g: before, o: { ecls: bcls } },
      g: cloneG(g), o: { ecls: ecls, ncls: ncls },
      info: { rule: res.rule, old: oldE, newN: res.newN.slice(), loop: res.loop },
      text: ruleText(res, names)
    });
  }
  var alpha = Object.keys(letters(re)).sort();
  steps.push({
    title: "Готово: на всех дугах буквы и ε",
    g: cloneG(g), o: {},
    text: "<p>Толстых дуг не осталось. Это и есть ответ: конечный автомат (недетерминированный, с ε-дугами), который допускает тот же язык, что и <span class=\"re\">" + PH(re) + "</span>.</p><p>Состояний: " + g.nodes.length + ", начальное q<sub>0</sub>, финальное q<sub>f</sub>. Если просят ещё и таблицу переходов, вот она:</p>" + deltaTable(g, alpha)
  });
  return steps;
}

function deltaTable(g, alpha) {
  var cols = alpha.concat(["ε"]);
  var order = g.nodes.slice().sort(function (a, b) {
    var ka = a.id === "q0" ? -1 : a.id === "qf" ? 1e9 : +a.id.replace(/\D/g, ""), kb = b.id === "q0" ? -1 : b.id === "qf" ? 1e9 : +b.id.replace(/\D/g, "");
    return ka - kb;
  });
  var h = '<div class="tscroll"><table class="dt"><tr><th>δ</th>' + cols.map(function (c) { return "<th>" + c + "</th>" }).join("") + "</tr>";
  order.forEach(function (n) {
    h += "<tr><th>" + (n.start ? "→" : "") + nameHtml(n.name) + (n.final ? "*" : "") + "</th>";
    cols.forEach(function (c) {
      var to = g.edges.filter(function (e) { return e.from === n.id && (c === "ε" ? e.re.t === "eps" : e.re.t === "sym" && e.re.v === c) }).map(function (e) { return nameHtml(N(g, e.to).name) });
      h += "<td>" + (to.length ? to.join(", ") : '<span class="muted">—</span>') + "</td>";
    });
    h += "</tr>";
  });
  return h + '</table></div><p class="muted" style="font-size:.88rem">→ начальное, * финальное, — перехода нет.</p>';
}

/* ================= автомат → регулярка: удаление вершин ================= */
function mergeAll(g) {
  var groups = {}, order = [], out = [];
  g.edges.forEach(function (e) { var k = e.from + "→" + e.to; if (!groups[k]) { groups[k] = []; order.push(k) } groups[k].push(e) });
  order.forEach(function (k) {
    var arr = groups[k];
    if (arr.length < 2) return;
    var parts = arr.map(function (e) { return e.re });
    var res = S({ t: "alt", a: parts });
    var first = arr[0];
    g.edges = g.edges.filter(function (e) { return arr.indexOf(e) < 0 || e === first });
    first.re = res;
    out.push({ from: first.from, to: first.to, parts: parts, res: res, id: first.id });
  });
  return out;
}

function eliminate(g, r) {
  var loops = g.edges.filter(function (e) { return e.from === r && e.to === r });
  var L = loops.length ? S(loops.length > 1 ? { t: "alt", a: loops.map(function (e) { return e.re }) } : loops[0].re) : null;
  var ins = g.edges.filter(function (e) { return e.to === r && e.from !== r });
  var outs = g.edges.filter(function (e) { return e.from === r && e.to !== r });
  g.edges = g.edges.filter(function (e) { return e.from !== r && e.to !== r });
  g.nodes = g.nodes.filter(function (n) { return n.id !== r });
  var pairs = [];
  ins.forEach(function (i) {
    outs.forEach(function (o) {
      var raw = L ? cat(i.re, star(L), o.re) : cat(i.re, o.re), res = S(raw);
      var ex = null;
      for (var k = 0; k < g.edges.length; k++) if (g.edges[k].from === i.from && g.edges[k].to === o.to) { ex = g.edges[k]; break }
      var merged = null, eid;
      if (res.t === "empty") { pairs.push({ p: i.from, q: o.to, R1: i.re, L: L, R3: o.re, res: res, merged: null, eid: null }); return }
      if (ex) { merged = { old: ex.re }; ex.re = S({ t: "alt", a: [ex.re, res] }); merged.res = ex.re; eid = ex.id }
      else eid = addEdge(g, i.from, o.to, res).id;
      pairs.push({ p: i.from, q: o.to, R1: i.re, L: L, R3: o.re, res: res, merged: merged, eid: eid });
    });
  });
  return { r: r, L: L, ins: ins, outs: outs, loops: loops, pairs: pairs };
}

function pickVertex(g, keep, origOrder) {
  var best = null, bs = null;
  g.nodes.forEach(function (n) {
    if (keep.indexOf(n.id) >= 0) return;
    var ins = g.edges.filter(function (e) { return e.to === n.id && e.from !== n.id }).length;
    var outs = g.edges.filter(function (e) { return e.from === n.id && e.to !== n.id }).length;
    var len = g.edges.filter(function (e) { return e.from === n.id || e.to === n.id }).reduce(function (s, e) { return s + P(e.re).length }, 0);
    var sc = [ins * outs, len, origOrder.indexOf(n.id)];
    if (!bs || sc[0] < bs[0] || (sc[0] === bs[0] && (sc[1] < bs[1] || (sc[1] === bs[1] && sc[2] < bs[2])))) { bs = sc; best = n.id }
  });
  return best;
}

function elimSteps(g0, order) {
  var g = cloneG(g0), steps = [], allNames = {};
  g.nodes.forEach(function (n) { allNames[n.id] = n.name });
  var nm = function (id) { return nameHtml(allNames[id] || id) };
  var origOrder = g0.nodes.map(function (n) { return n.id });
  var starts = g.nodes.filter(function (n) { return n.start }), finals = g.nodes.filter(function (n) { return n.final });
  var alpha = {};
  g.edges.forEach(function (e) { letters(e.re, alpha) });
  alpha = Object.keys(alpha).sort();
  steps.push({
    title: "Исходный автомат",
    g: cloneG(g), o: {},
    text: "<p>Начальное: " + starts.map(function (n) { return nm(n.id) }).join(", ") + ". Финальные: " + (finals.length ? finals.map(function (n) { return nm(n.id) }).join(", ") : "нет") + ". Алфавит: {" + alpha.join(", ") + "}.</p><p>Цель — свернуть граф до одной дуги из начала в конец. Метка на этой дуге и будет регулярным выражением.</p>"
  });
  if (!finals.length) {
    steps.push({ title: "Финальных состояний нет", g: cloneG(g), o: {}, text: "<p>Ни одно слово не допускается: L = ∅.</p>", answer: E_EMPTY });
    return steps;
  }
  var Sn = starts[0];
  var hasIn = g.edges.some(function (e) { return e.to === Sn.id });
  var F1 = finals[0];
  var needF = finals.length > 1 || g.edges.some(function (e) { return e.from === F1.id }) || F1.id === Sn.id;
  var ncls = {}, ecls = {}, txt = [];
  var sId = Sn.id, fId = F1.id;
  var maxX = Math.max.apply(null, g.nodes.map(function (n) { return n.x }));
  if (hasIn) {
    sId = uniq(g, "s"); allNames[sId] = sId;
    addNode(g, { id: sId, name: sId, x: Sn.x - 115, y: Sn.y, start: true });
    Sn.start = false;
    ecls[addEdge(g, sId, Sn.id, E_EPS).id] = "nw fresh"; ncls[sId] = "nw fresh";
    txt.push("<p>В начальную " + nm(Sn.id) + " входят дуги, значит добавляем новое начало <b>" + sId + "</b> и дугу " + sId + " —ε→ " + nm(Sn.id) + ".</p>");
  }
  if (needF) {
    fId = uniq(g, "f"); allNames[fId] = fId;
    var fy = finals.reduce(function (s, n) { return s + n.y }, 0) / finals.length;
    addNode(g, { id: fId, name: fId, x: maxX + 120, y: fy, final: true });
    finals.forEach(function (n) { n.final = false; ecls[addEdge(g, n.id, fId, E_EPS).id] = "nw fresh" });
    ncls[fId] = "nw fresh";
    var why = finals.length > 1 ? "финальных несколько (" + finals.map(function (n) { return nm(n.id) }).join(", ") + ")" : F1.id === Sn.id ? "финальная совпадает с начальной" : "из финальной " + nm(F1.id) + " выходят дуги";
    txt.push("<p>" + why[0].toUpperCase() + why.slice(1) + ", значит добавляем новый конец <b>" + fId + "</b> и ε-дуги в него из " + finals.map(function (n) { return nm(n.id) }).join(", ") + ". Старые финальные становятся обычными.</p>");
  }
  var normInfo = { s: hasIn ? sId : null, f: needF ? fId : null, start: Sn.id, finals: finals.map(function (n) { return n.id }), sId: sId, fId: fId, finalHasOut: !!(needF && finals.length === 1) };
  if (txt.length) steps.push({ title: "Шаг 0. Нормализация", norm: normInfo, g: cloneG(g), o: { ecls: ecls, ncls: ncls }, text: txt.join("") + "<p>Теперь в начало ничего не входит, из конца ничего не выходит.</p>" });
  else steps.push({ title: "Шаг 0. Нормализация не нужна", norm: normInfo, g: cloneG(g), o: {}, text: "<p>В начальную " + nm(sId) + " ничего не входит, финальная " + nm(fId) + " одна и из неё ничего не выходит. Граф уже в нормализованной форме, ничего не добавляем.</p>" });

  var m = mergeAll(g);
  if (m.length) {
    var ec = {};
    m.forEach(function (x) { ec[x.id] = "nw fresh" });
    steps.push({
      title: "Шаг 1. Склеиваем параллельные дуги", merge: m,
      g: cloneG(g), o: { ecls: ec },
      text: "<p>Несколько дуг из одной вершины в одну и ту же — это «или». Заменяем одной дугой с суммой:</p><ul>" + m.map(function (x) { return "<li>" + nm(x.from) + " → " + nm(x.to) + (x.from === x.to ? " (петля)" : "") + ": " + x.parts.map(function (p) { return '<span class="re">' + PH(p) + "</span>" }).join(", ") + ' ⇒ <span class="re c-new">' + PH(x.res) + "</span></li>" }).join("") + "</ul>"
    });
  }

  var keep = [sId, fId], k = 0, ord = (order || []).slice();
  while (g.nodes.length > 2 && k++ < 60) {
    var r = null;
    while (ord.length && !r) { var c = ord.shift(); if (N(g, c) && keep.indexOf(c) < 0) r = c }
    if (!r) r = pickVertex(g, keep, origOrder);
    var before = cloneG(g);
    var res = eliminate(g, r);
    var bcls = {}, bn = {};
    bn[r] = "del";
    res.ins.forEach(function (e) { bcls[e.id] = "in" });
    res.outs.forEach(function (e) { bcls[e.id] = "out" });
    res.loops.forEach(function (e) { bcls[e.id] = "lp" });
    var ni = res.ins.length, no = res.outs.length;
    var head = "<p>Удаляем " + nm(r) + ". ";
    head += "Входят: " + (ni ? res.ins.map(function (e) { return '<span class="c-in">' + nm(e.from) + " (" + PH(e.re) + ")</span>" }).join(", ") : "ничего") + ". ";
    head += "Петля: " + (res.L ? '<span class="c-lp re">' + PH(res.L) + "</span>" + (res.loops.length > 1 ? " (склеили " + res.loops.length + " петли)" : "") : "нет") + ". ";
    head += "Выходят: " + (no ? res.outs.map(function (e) { return '<span class="c-out">' + nm(e.to) + " (" + PH(e.re) + ")</span>" }).join(", ") : "ничего") + ".</p>";
    var bodyA;
    if (!ni || !no) bodyA = head + "<p>" + (!ni ? "В вершину не попасть из начала" : "Из вершины не дойти до конца") + ", значит через неё не проходит ни одно допускаемое слово. Стираем её вместе с дугами, новых дуг нет.</p>";
    else bodyA = head + "<p>Пар «вход × выход»: " + ni + " × " + no + " = " + (ni * no) + ". Для каждой пары ставим дугу по формуле <span class=\"re\"><span class=\"c-in\">R<sub>1</sub></span><span class=\"c-lp\">R<sub>2</sub><sup>*</sup></span><span class=\"c-out\">R<sub>3</sub></span></span>" + (res.L ? "" : " (петли нет, значит просто R<sub>1</sub>R<sub>3</sub>)") + ":</p>" + pairList(res, nm, false);
    steps.push({ title: "Удаление " + plainName(allNames[r] || r) + ": что входит и выходит", elim: res, g: before, o: { ecls: bcls, ncls: bn }, text: bodyA });
    var acls = {};
    res.pairs.forEach(function (p) { if (p.eid) acls[p.eid] = "nw fresh" });
    steps.push({
      title: "Удаление " + plainName(allNames[r] || r) + ": результат", after: r,
      g: cloneG(g), o: { ecls: acls },
      text: (res.pairs.length ? "<p>Вершины " + nm(r) + " больше нет, на её месте новые дуги:</p>" + pairList(res, nm, true) : "<p>Вершина " + nm(r) + " стёрта.</p>") + (g.nodes.length > 2 ? "<p class=\"muted\">Осталось удалить: " + g.nodes.filter(function (n) { return keep.indexOf(n.id) < 0 }).map(function (n) { return nm(n.id) }).join(", ") + ".</p>" : "")
    });
  }
  var fin = g.edges.filter(function (e) { return e.from === sId && e.to === fId });
  var ans = fin.length ? S(fin.length > 1 ? { t: "alt", a: fin.map(function (e) { return e.re }) } : fin[0].re) : E_EMPTY;
  var nfa = nfaFromGraph(g0), sample = sampleWords(nfa, alpha);
  steps.push({
    title: "Ответ",
    g: cloneG(g), o: {}, answer: ans,
    text: "<p>Остались только " + nm(sId) + " и " + nm(fId) + ". Метка на дуге между ними — регулярное выражение языка автомата:</p><p class=\"ansbox re\">R = " + PH(ans) + "</p>" + sampleHtml(sample)
  });
  return steps;
}
function plainName(n) { return n.replace(/^q(\d+)$/, "q$1") }
function uniq(g, base) { var id = base, i = 1; while (N(g, id)) id = base + "'".repeat(i++); return id }
function pairList(res, nm, after) {
  return "<ul class=\"pairs\">" + res.pairs.map(function (p) {
    var raw = '<span class="c-in">' + pr(p.R1, 1, true) + "</span>" + (p.L ? '<span class="c-lp">' + pr(p.L, 2, true) + "<sup>*</sup></span>" : "") + '<span class="c-out">' + pr(p.R3, 1, true) + "</span>";
    var simp = PH(p.res);
    var line = "<li><b>" + nm(p.p) + " → " + nm(p.q) + "</b>" + (p.p === p.q ? " (петля)" : "") + ": <span class=\"re\">" + raw + "</span>";
    if (simp !== raw.replace(/<span[^>]*>|<\/span>/g, "")) line += ' = <span class="re">' + simp + "</span>";
    if (p.merged) line += "; там уже была дуга <span class=\"re\">" + PH(p.merged.old) + "</span>, склеиваем: <span class=\"re c-new\">" + PH(p.merged.res) + "</span>";
    else if (after) line += ' <span class="c-new">— новая дуга</span>';
    return line + "</li>";
  }).join("") + "</ul>" + (res.pairs.some(function (p) { return /ε/.test(P(p.R1) + P(p.R3)) }) && !after ? '<p class="muted" style="font-size:.9rem">ε в склейке просто пропадает: εR = R.</p>' : "");
}


/* ================= детерминизация (метод с листка преподавателя) ================= */
function expandAtomic(g) {
  var out = [];
  g.edges.forEach(function (e) {
    (function put(re) {
      if (re.t === "sym") String(re.v).split(",").forEach(function (v) { v = v.trim(); if (v) out.push({ from: e.from, to: e.to, s: v === "ε" ? null : v }) });
      else if (re.t === "eps") out.push({ from: e.from, to: e.to, s: null });
      else if (re.t === "alt") re.a.forEach(put);
      else if (re.t === "empty") { }
      else throw new ReErr("Для детерминизации на дугах должны быть только буквы и ε (можно через запятую). Дуга " + e.from + " → " + e.to + ": «" + P(e.re) + "»");
    })(e.re);
  });
  return out;
}
function setStr(arr, pre) { return "{" + arr.map(function (i) { return pre + "<sub>" + i + "</sub>" }).join(", ") + "}" }
// Основной учебный вариант: сначала таблица q без ε, затем подмножества P из q.
function clearDetSteps(g0, word) {
  var g=cloneG(g0), tr=expandAtomic(g), ids=g.nodes.map(function(n){return n.id}), alpha=Array.from(new Set(tr.filter(function(t){return t.s!==null}).map(function(t){return t.s}))).sort();
  var starts=g.nodes.filter(function(n){return n.start}).map(function(n){return n.id});
  if(starts.length!==1)throw new ReErr("Для этого разбора нужно ровно одно начальное состояние.");
  var nm=function(id){return nameHtml(N(g,id).name)}, list=function(a){return a.length?"{"+a.map(nm).join(", ")+"}":"∅"};
  function close(a){var seen=new Set(a),queue=a.slice();for(var i=0;i<queue.length;i++)tr.forEach(function(t){if(t.from===queue[i]&&t.s===null&&!seen.has(t.to)){seen.add(t.to);queue.push(t.to)}});return ids.filter(function(id){return seen.has(id)})}
  function move(a,c){return Array.from(new Set(tr.filter(function(t){return a.indexOf(t.from)>=0&&t.s===c}).map(function(t){return t.to})))}
  var CL=ids.map(function(id){return close([id])}), F=CL.map(function(a){return a.some(function(id){return N(g,id).final})}), T=ids.map(function(id,i){var row={};alpha.forEach(function(a){row[a]=close(move(CL[i],a))});return row});
  function qTable(upto){return '<div class="tscroll"><table class="dt"><tr><th>После удаления ε</th>'+alpha.map(function(a){return '<th>'+esc(a)+'</th>'}).join('')+'</tr>'+ids.map(function(id,i){return '<tr><th>'+(id===starts[0]?'→':'')+(F[i]?'*':'')+nm(id)+'</th>'+alpha.map(function(a){return '<td>'+(i<=upto?list(T[i][a]):'…')+'</td>'}).join('')+'</tr>'}).join('')+'</table></div>'}
  var steps=[{title:'1. Исходный автомат',g:cloneG(g),text:'<p>Сначала удаляем ε. Сохраняем имена q и начальное '+nm(starts[0])+'. Для одной клетки: бесплатно до буквы → одна буква → бесплатно после.</p>'},{title:'2. Бесплатно доступные вершины',g:cloneG(g),text:'<p>В замыкание входит сама вершина и всё достижимое по цепочкам ε.</p><ul>'+ids.map(function(id,i){return '<li>Ξ('+nm(id)+')='+list(CL[i])+'</li>'}).join('')+'</ul>'}];
  ids.forEach(function(id,i){steps.push({title:'3. Строка '+N(g,id).name+' без ε',html:qTable(i),text:'<p>До буквы доступны '+list(CL[i])+'.</p><ul>'+alpha.map(function(a){var ends=move(CL[i],a);return '<li>Читаем <b>'+esc(a)+'</b>: получаем '+list(ends)+'. После бесплатных продолжений: '+list(T[i][a])+'. Это и записываем в клетку.</li>'}).join('')+'</ul><p>'+nm(id)+(F[i]?' финальное: его замыкание содержит старый финал.':' не финальное: в его замыкании нет старого финала.')+'</p>'})});
  var clean=cloneG(g);clean.edges=[];clean.eid=0;clean.nodes.forEach(function(n,i){n.final=F[i]});ids.forEach(function(id,i){alpha.forEach(function(a){T[i][a].forEach(function(to){addEdge(clean,id,to,sym(a))})})});
  steps.push({title:'4. Автомат без ε готов',g:clean,text:'<p>Старт '+nm(starts[0])+', финальные '+list(ids.filter(function(id,i){return F[i]}))+'. Дальше используем только новую таблицу. Начальный набор P₀={'+nm(starts[0])+'}.</p>'+qTable(ids.length)});
  var PL=[[ids.indexOf(starts[0])]],PT=[],PF=[],explanations=[];
  var key=function(a){return a.join(',')};
  for(var q=0;q<PL.length;q++){
    if(PL.length>128)throw new ReErr('Больше 128 подмножеств: сократи пример для пошагового разбора.');
    var row={},lines=[];
    alpha.forEach(function(a){var targets=new Set();PL[q].forEach(function(i){T[i][a].forEach(function(id){targets.add(ids.indexOf(id))})});var arr=Array.from(targets).sort(function(a,b){return a-b});
      var to=-1,fresh=false;if(arr.length){to=PL.findIndex(function(p){return key(p)===key(arr)});if(to<0){to=PL.length;PL.push(arr);fresh=true}}
      row[a]=to;lines.push('<li>По '+esc(a)+': '+PL[q].map(function(i){return nm(ids[i])+': '+list(T[i][a])}).join(' ∪ ')+' ⇒ '+list(arr.map(function(i){return ids[i]}))+(to<0?' — перехода нет.':fresh?' — новый набор P<sub>'+to+'</sub>.':' — уже известный P<sub>'+to+'</sub>.')+'</li>');
    });PT.push(row);explanations.push(lines.join(''));
  }
  PF=PL.map(function(a){return a.some(function(i){return F[i]})});
  function pTable(upto){return '<div class="tscroll"><table class="dt"><tr><th>Набор = одна вершина</th>'+alpha.map(function(a){return '<th>'+esc(a)+'</th>'}).join('')+'</tr>'+PL.map(function(a,i){return '<tr><th>'+(i===0?'→':'')+(PF[i]?'*':'')+'P<sub>'+i+'</sub>='+list(a.map(function(j){return ids[j]}))+'</th>'+alpha.map(function(a){return '<td>'+(i>upto?'…':PT[i][a]<0?'∅':'P<sub>'+PT[i][a]+'</sub>')+'</td>'}).join('')+'</tr>'}).join('')+'</table></div>'}
  PL.forEach(function(a,i){steps.push({title:'5. Обрабатываем P'+i,html:pTable(i),text:'<p>P<sub>'+i+'</sub> хранит '+list(a.map(function(j){return ids[j]}))+'. Объединяем клетки таблицы без ε. Строки с многоточием ещё предстоит заполнить.</p><ul>'+explanations[i]+'</ul>'})});
  var gp={nodes:PL.map(function(a,i){return {id:'P'+i,name:'P'+i,x:(i%4)*160,y:Math.floor(i/4)*150,start:i===0,final:PF[i]}}),edges:[],eid:0};
  PL.forEach(function(a,i){var by={};alpha.forEach(function(a){var t=PT[i][a];if(t>=0)(by[t]=by[t]||[]).push(a)});Object.keys(by).forEach(function(t){addEdge(gp,'P'+i,'P'+t,sym(by[t].join(',')))})});
  var dfa={PL:PL,PT:PT,PF:PF,alpha:alpha};
  steps.push({title:'6. ДКА готов: все строки заполнены',g:gp,text:'<p>Новых наборов не осталось. Финальные '+PL.map(function(a,i){return PF[i]?'P<sub>'+i+'</sub>':null}).filter(Boolean).join(', ')+'. В каждом из них есть хотя бы одно финальное q из таблицы без ε. ∅ означает отказ при чтении этой буквы.</p>'+pTable(PL.length)+(word==null?'':dfaTraceHtml(dfa,word))});
  steps.dfa=dfa;return steps;
}

function detSteps(g0, word) {
  var g = cloneG(g0);
  var tr = expandAtomic(g);
  var st = g.nodes.filter(function (n) { return n.start })[0] || g.nodes[0];
  var ids = [st.id].concat(g.nodes.filter(function (n) { return n.id !== st.id }).map(function (n) { return n.id }));
  var idx = {}; ids.forEach(function (id, i) { idx[id] = i });
  var nm = function (id) { return nameHtml(N(g, id).name) };
  var alpha = {}; tr.forEach(function (t) { if (t.s !== null) alpha[t.s] = 1 }); alpha = Object.keys(alpha).sort();
  function clos(set) {
    var seen = {}, stck = set.slice(); set.forEach(function (x) { seen[x] = 1 });
    while (stck.length) { var x = stck.pop(); tr.forEach(function (t) { if (t.from === x && t.s === null && !seen[t.to]) { seen[t.to] = 1; stck.push(t.to) } }) }
    return Object.keys(seen).sort(function (a, b) { return idx[a] - idx[b] });
  }
  var CL = ids.map(function (id) { return clos([id]) });
  var START = CL[0].map(function (x) { return idx[x] }).sort(function (a, b) { return a - b });
  var isF = function (id) { return !!N(g, id).final };
  var SF = CL.map(function (c) { return c.some(isF) });
  var listS = function (arr) { return "{" + arr.map(nm).join(", ") + "}" };
  var steps = [];
  var epsCls = {};
  g.edges.forEach(function (e) { if (P(e.re).indexOf("ε") >= 0) epsCls[e.id] = "lp" });
  steps.push({ title: "Исходный автомат", g: cloneG(g), o: {}, text: "<p>Недетерминированный автомат с ε-дугами. Алфавит {" + alpha.join(", ") + "}, начальное " + nm(st.id) + ", финальные " + listS(ids.filter(isF)) + ".</p><p>План как на листке преподавателя: ε-замыкания → автомат без ε (состояния S) → детерминизация (состояния P) → граф.</p>" });
  steps.push({
    title: "1. ε-замыкания", g: cloneG(g), o: { ecls: epsCls },
    text: "<p>Ξ(q) — все состояния, куда из q можно попасть по одним ε-дугам, не читая букв. Само q входит всегда. ε-дуги выделены красным.</p><ul>" + ids.map(function (id, i) { return "<li>S<sub>" + i + "</sub> = Ξ(" + nm(id) + ") = " + listS(CL[i]) + "</li>" }).join("") + "</ul><p><b>Начальные</b> состояния нового автомата — все S<sub>i</sub>, у которых q<sub>i</sub> ∈ Ξ(" + nm(st.id) + ") = " + listS(CL[0]) + ": " + START.map(function (k) { return "S<sub>" + k + "</sub>" }).join(", ") + ". Так в лекции: «S<sub>0</sub> = ∪Ξ(q), где q ∈ Ξ(q<sub>0</sub>)».</p>"
  });
  // таблица S
  var ST = [];
  ids.forEach(function (id, i) {
    var row = {}, why = {};
    alpha.forEach(function (a) {
      var moves = [], tgt = {};
      CL[i].forEach(function (x) { tr.forEach(function (t) { if (t.from === x && t.s === a) { moves.push(t); tgt[t.to] = 1 } }) });
      var reach = clos(Object.keys(tgt));
      row[a] = reach.map(function (x) { return idx[x] }).sort(function (a, b) { return a - b });
      why[a] = { moves: moves, reach: reach };
    });
    ST.push({ row: row, why: why });
  });
  function sTable(upto, cur) {
    var h = '<div class="tscroll"><table class="dt"><tr><th></th>' + alpha.map(function (a) { return "<th>" + a + "</th>" }).join("") + "</tr>";
    ids.forEach(function (id, i) {
      h += '<tr' + (i === cur ? ' class="cur"' : "") + '><th style="text-align:left">S<sub>' + i + "</sub> = Ξ(" + nm(id) + ") = " + listS(CL[i]) + (upto >= ids.length && SF[i] ? " *" : "") + "</th>";
      alpha.forEach(function (a) { var v = ST[i].row[a]; h += "<td" + (i === cur ? ' class="fr"' : "") + ">" + (i <= upto ? (v.length ? v.map(function (k) { return "S<sub>" + k + "</sub>" }).join(", ") : "∅") : "") + "</td>" });
      h += "</tr>";
    });
    return h + "</table></div>";
  }
  ids.forEach(function (id, i) {
    var lines = alpha.map(function (a) {
      var w = ST[i].why[a];
      if (!w.moves.length) return "<li>по <b>" + a + "</b>: ни из одного состояния " + listS(CL[i]) + " дуги по " + a + " нет ⇒ ∅</li>";
      return "<li>по <b>" + a + "</b>: " + w.moves.map(function (t) { return nm(t.from) + " —" + a + "→ " + nm(t.to) }).join(", ") + "; добавляем ε-замыкание ⇒ " + listS(w.reach) + " ⇒ " + (w.reach.map(function (x) { return "S<sub>" + idx[x] + "</sub>" }).join(", ")) + "</li>";
    });
    steps.push({
      title: "2. Строка S" + i, html: sTable(i, i),
      text: "<p>Берём все состояния из S<sub>" + i + "</sub> = " + listS(CL[i]) + " и смотрим, куда они уходят по каждой букве. К тому, куда пришли, добавляем ε-замыкание. Каждое полученное состояние q записываем как его S (у " + nm(ids[0]) + " это S<sub>0</sub>, у " + nm(ids[1] || ids[0]) + " — S<sub>1</sub> и так далее).</p><ul>" + lines.join("") + "</ul>"
    });
  });
  // граф S
  var gS = { nodes: g.nodes.map(function (n) { return { id: "S" + idx[n.id], name: "S" + idx[n.id], x: n.x, y: n.y, start: START.indexOf(idx[n.id]) >= 0, final: SF[idx[n.id]] } }), edges: [], eid: 0 };
  ids.forEach(function (id, i) {
    var byT = {};
    alpha.forEach(function (a) { ST[i].row[a].forEach(function (k) { (byT[k] = byT[k] || []).push(a) }) });
    Object.keys(byT).forEach(function (k) { addEdge(gS, "S" + i, "S" + k, sym(byT[k].join(","))) });
  });
  steps.push({
    title: "Автомат без ε-дуг", g: gS, o: {},
    text: "<p>По таблице рисуем граф: стрелка S<sub>i</sub> → S<sub>j</sub> с буквой a, если в клетке (S<sub>i</sub>, a) есть S<sub>j</sub>. «a,c» на дуге = две дуги.</p><p><b>Начальные</b>: " + START.map(function (k) { return "S<sub>" + k + "</sub>" }).join(", ") + " (стрелки входа). <b>Финальные</b> — те S, в которых есть исходное финальное состояние: " + (ids.map(function (id, i) { return SF[i] ? "S<sub>" + i + "</sub>" : null }).filter(Boolean).join(", ") || "нет") + ". Автомат уже без ε, но ещё недетерминированный: из одной вершины по одной букве бывает несколько стрелок.</p>"
  });
  // подмножества
  var PL = [START], PT = [], q = 0, keyOf = function (a) { return a.join(",") };
  var expl = [];
  while (q < PL.length) {
    if (PL.length > 128) throw new ReErr("Получилось больше 128 подмножеств. Сократи пример для пошагового разбора.");
    var set = PL[q], row = {}, ex = [];
    alpha.forEach(function (a) {
      var u = {};
      set.forEach(function (k) { ST[k].row[a].forEach(function (j) { u[j] = 1 }) });
      var arr = Object.keys(u).map(Number).sort(function (a, b) { return a - b });
      if (!arr.length) { row[a] = -1; ex.push({ a: a, arr: arr, to: -1, isNew: false }); return }
      var k2 = keyOf(arr), f = -1;
      for (var t = 0; t < PL.length; t++) if (keyOf(PL[t]) === k2) { f = t; break }
      var isNew = f < 0;
      if (isNew) { PL.push(arr); f = PL.length - 1 }
      row[a] = f; ex.push({ a: a, arr: arr, to: f, isNew: isNew });
    });
    PT.push(row); expl.push(ex); q++;
  }
  var PF = PL.map(function (s) { return s.some(function (k) { return SF[k] }) });
  function pTable(upto, cur) {
    var h = '<div class="tscroll"><table class="dt"><tr><th></th>' + alpha.map(function (a) { return "<th>" + a + "</th>" }).join("") + "</tr>";
    var last = Math.min(countNew(upto), PL.length - 1);
    for (var i = 0; i <= last; i++) {
      h += '<tr' + (i === cur ? ' class="cur"' : "") + '><th style="text-align:left">P<sub>' + i + "</sub> = " + setStr(PL[i], "S") + (upto >= PL.length - 1 && PF[i] ? " *" : "") + "</th>";
      alpha.forEach(function (a) { var v = i <= upto ? PT[i][a] : null; h += "<td" + (i === cur ? ' class="fr"' : "") + ">" + (v === null ? "" : v < 0 ? "∅" : "P<sub>" + v + "</sub>") + "</td>" });
      h += "</tr>";
    }
    return h + "</table></div>";
  }
  function countNew(upto) { var c = 0; for (var i = 0; i <= upto; i++) expl[i].forEach(function (x) { if (x.isNew) c++ }); return c }
  for (var i = 0; i < PL.length; i++) {
    var lines = expl[i].map(function (x) {
      var parts = PL[i].map(function (k) { var v = ST[k].row[x.a]; return "S<sub>" + k + "</sub>→" + (v.length ? setStr(v, "S") : "∅") }).join(" ∪ ");
      return "<li>по <b>" + x.a + "</b>: " + parts + " = " + (x.arr.length ? setStr(x.arr, "S") : "∅") + (x.to < 0 ? " — дуги нет" : x.isNew ? " — такого ещё не было, называем <b>P<sub>" + x.to + "</sub></b>" : " = P<sub>" + x.to + "</sub>, уже было") + "</li>";
    });
    steps.push({
      title: "3. Строка P" + i, html: pTable(i, i),
      text: (i === 0 ? "<p>Начинаем с P<sub>0</sub> = " + setStr(PL[0], "S") + " — множества всех начальных S. " : "<p>") + "Для P<sub>" + i + "</sub> = " + setStr(PL[i], "S") + " по каждой букве объединяем строки таблицы S всех его элементов:</p><ul>" + lines.join("") + "</ul>"
    });
  }
  // граф P: слои BFS
  var layer = [0], seenL = { 0: 0 }, order = [0];
  for (var oi = 0; oi < order.length; oi++) { var pi = order[oi]; alpha.forEach(function (a) { var t = PT[pi][a]; if (t >= 0 && seenL[t] == null) { seenL[t] = seenL[pi] + 1; order.push(t) } }) }
  var byL = {}; order.forEach(function (k) { (byL[seenL[k]] = byL[seenL[k]] || []).push(k) });
  var gP = { nodes: [], edges: [], eid: 0 };
  order.forEach(function (k) { var L = seenL[k], arr = byL[L], j = arr.indexOf(k); gP.nodes.push({ id: "P" + k, name: "P" + k, x: L * 170, y: (j - (arr.length - 1) / 2) * 120 + (L % 2 ? 24 : 0), start: k === 0, final: PF[k] }) });
  PL.forEach(function (s, k) {
    var byT = {};
    alpha.forEach(function (a) { var t = PT[k][a]; if (t >= 0) (byT[t] = byT[t] || []).push(a) });
    Object.keys(byT).forEach(function (t) { addEdge(gP, "P" + k, "P" + t, sym(byT[t].join(","))) });
  });
  var dfa = { PL: PL, PT: PT, PF: PF, alpha: alpha };
  if (word == null) {
    var best = null;
    wordsUpTo(alpha, 6, function (w) { if (w.length >= 4 && dfaRun(dfa, w).ok) { best = w; return false } });
    word = best;
  }
  var traceHtml = word != null ? "<p><b>Проверка цепочки</b> w = " + (word || "ε") + ":</p>" + dfaTraceHtml(dfa, word) : "";
  steps.push({
    title: "4. Детерминированный автомат", g: gP, o: {}, final: true,
    text: "<p>Граф по таблице P. Теперь из каждой вершины по каждой букве выходит не больше одной стрелки — автомат детерминированный. ∅ в таблице значит, что стрелки нет.</p><p><b>Финальные</b> — P, в которых есть хотя бы одно финальное S: " + (PL.map(function (s, k) { return PF[k] ? "P<sub>" + k + "</sub>" : null }).filter(Boolean).join(", ") || "нет") + ".</p>" + pTable(PL.length - 1, -1) + traceHtml
  });
  steps.dfa = dfa;
  return steps;
}

function dfaRun(d, w) {
  var cur = 0, path = [0];
  for (var i = 0; i < w.length; i++) {
    var t = d.PT[cur] ? d.PT[cur][w[i]] : undefined;
    if (t == null || t < 0) return { ok: false, path: path, stuck: i };
    cur = t; path.push(t);
  }
  return { ok: !!d.PF[cur], path: path, stuck: -1 };
}
function dfaTraceHtml(d, w) {
  var r = dfaRun(d, w), parts = [];
  r.path.forEach(function (p, i) { parts.push("(P<sub>" + p + "</sub>, " + (w.slice(i) || "ε") + ")") });
  var h = '<div class="trace">' + parts.join(" ⊢ ") + (r.stuck >= 0 ? " ⊢ ∅" : "") + "</div>";
  var last = r.path[r.path.length - 1];
  if (r.stuck >= 0) h += '<p class="err">Из P<sub>' + last + "</sub> по «" + w[r.stuck] + "» перехода нет — цепочка не допускается.</p>";
  else h += '<p class="' + (r.ok ? "okm" : "err") + '">Остановились в P<sub>' + last + "</sub>, оно " + (r.ok ? "финальное — автомат цепочку допускает." : "не финальное — цепочка не допускается.") + "</p>";
  return h;
}


/* ================= минимизация (метод из разбора КР, задание 4а) ================= */
function minSteps(g0, opts) {
  opts = opts || {};
  var steps = [], g = cloneG(g0), tr;
  try { tr = expandAtomic(g) } catch (err) { throw err }
  var isNd = tr.some(function (t) { return t.s === null }) || tr.some(function (t, i) { return tr.some(function (u, j) { return j !== i && u.from === t.from && u.s === t.s && u.to !== t.to }) }) || g.nodes.filter(function (n) { return n.start }).length !== 1;
  if (isNd) {
    var ds = detSteps(g);
    var gp = ds[ds.length - 1].g;
    steps.push({ title: "0. Сначала детерминизация", g: cloneG(g), o: {}, text: "<p>Автомат недетерминированный (есть ε-дуги или несколько дуг по одной букве). Минимизируют только детерминированный, поэтому сначала строим ДКА методом из части 8. Получился автомат на следующем шаге, дальше работаем с ним.</p>" });
    g = cloneG(gp); tr = expandAtomic(g);
  }
  var ids = g.nodes.map(function (n) { return n.id });
  var nm = function (id) { return nameHtml(N(g, id).name) };
  var alpha = {}; tr.forEach(function (t) { alpha[t.s] = 1 }); alpha = Object.keys(alpha).sort();
  var T = {}; ids.forEach(function (id) { T[id] = {} });
  tr.forEach(function (t) { T[t.from][t.s] = t.to });
  var st = g.nodes.filter(function (n) { return n.start })[0].id;
  var deltaHtml = function (list, map, label) {
    var h = '<div class="tscroll"><table class="dt"><tr><th>δ</th>' + alpha.map(function (a) { return "<th>" + a + "</th>" }).join("") + "</tr>";
    list.forEach(function (id) { var n = N(g, id); h += "<tr><th>" + (n.start ? "→" : "") + label(id) + (n.final ? "*" : "") + "</th>" + alpha.map(function (a) { var t = T[id][a]; return "<td>" + (t ? map(t) : '<span class="muted">—</span>') + "</td>" }).join("") + "</tr>" });
    return h + "</table></div>";
  };
  steps.push({ title: "1. Исходный детерминированный автомат", g: cloneG(g), o: {}, text: "<p>Из каждой вершины по каждой букве не больше одной стрелки — можно минимизировать. Таблица переходов:</p>" + deltaHtml(ids, nm, nm) });
  // недостижимые
  var seen = {}; seen[st] = 1; var q = [st];
  while (q.length) { var x = q.shift(); alpha.forEach(function (a) { var t = T[x][a]; if (t && !seen[t]) { seen[t] = 1; q.push(t) } }) }
  var unr = ids.filter(function (id) { return !seen[id] });
  if (unr.length) {
    var nc = {}; unr.forEach(function (id) { nc[id] = "del" });
    var ec = {}; g.edges.forEach(function (e) { if (unr.indexOf(e.from) >= 0) ec[e.id] = "lp" });
    steps.push({ title: "2. Удаляем недостижимые", g: cloneG(g), o: { ncls: nc, ecls: ec }, text: "<p>В " + unr.map(nm).join(", ") + " нельзя попасть из начального " + nm(st) + " (никакая стрелка не ведёт туда из достижимых вершин). Удаляем вместе с исходящими из них дугами.</p>" });
    g.nodes = g.nodes.filter(function (n) { return seen[n.id] });
    g.edges = g.edges.filter(function (e) { return seen[e.from] && seen[e.to] });
    ids = ids.filter(function (id) { return seen[id] });
    steps.push({ title: "2. Без недостижимых", g: cloneG(g), o: {}, text: "<p>Осталось " + ids.length + " состояний. Дальше работаем с этим графом.</p>" });
  } else steps.push({ title: "2. Недостижимых нет", g: cloneG(g), o: {}, text: "<p>Из " + nm(st) + " можно дойти до каждой вершины, удалять нечего.</p>" });
  if(ids.some(function(id){return alpha.some(function(a){return !T[id][a]})})) {
    var sink="dead";while(T[sink])sink+="_";
    g.nodes.push({id:sink,name:"⊥",x:Math.max.apply(null,g.nodes.map(function(n){return n.x}))+160,y:100,final:false,start:false});
    T[sink]={};ids.push(sink);
    ids.forEach(function(id){alpha.forEach(function(a){if(!T[id][a]){T[id][a]=sink;addEdge(g,id,sink,sym(a))}})});
    steps.push({title:"2. Дополняем неполный ДКА",g:cloneG(g),o:{},text:"<p>Пустые клетки направляем в нефинальное поглощающее состояние ⊥. Из него по каждой букве переход в себя. Теперь обычный алгоритм разбиений корректен: ⊥ может объединиться с уже существующими состояниями, из которых финал недостижим.</p>"});
  }
  var fin = ids.filter(function (id) { return N(g, id).final }), non = ids.filter(function (id) { return !N(g, id).final });
  var part = [fin, non].filter(function (c) { return c.length });
  var setH = function (c) { return "{" + c.map(nm).join(", ") + "}" };
  var partH = function (p) { return "{ " + p.map(function (c, i) { return '<span class="kc k' + (i % 6) + '">' + setH(c) + "</span>" }).join(", ") + " }" };
  var colorOf = function (p) { var o = {}; p.forEach(function (c, i) { c.forEach(function (id) { o[id] = "k" + (i % 6) }) }); return o };
  var legend = function (p) { return '<div class="klegend">' + p.map(function (c, i) { return '<span class="kc k' + (i % 6) + '">C<sub>' + (i + 1) + "</sub> = " + setH(c) + "</span>" }).join("") + "</div>" };
  var gsvg = function (p) { return '<div class="gscroll">' + svgGraph(g, { ncls: colorOf(p) }) + "</div>" };
  steps.push({
    title: "3. 0-эквивалентность ≡⁰", html: gsvg(part) + legend(part),
    text: "<p>Делим состояния на два класса: финальные и все остальные. Ни одной буквы ещё не прочитали, поэтому различить можно только «финальное или нет».</p><p>≡⁰ = " + partH(part) + "</p>"
  });
  var k = 1, guard = 0;
  while (guard++ <= ids.length) {
    var cls = {}; part.forEach(function (c, i) { c.forEach(function (id) { cls[id] = i }) });
    var sig = function (id) { return alpha.map(function (a) { var t = T[id][a]; return t ? cls[t] : -1 }).join("|") };
    var np = [], blocks = [];
    part.forEach(function (c) {
      var groups = [], keys = [];
      c.forEach(function (id) { var s = sig(id), i = keys.indexOf(s); if (i < 0) { keys.push(s); groups.push([id]) } else groups[i].push(id) });
      blocks.push({ c: c, groups: groups, firstSig: keys[0], sig: sig });
      groups.forEach(function (gg) { np.push(gg) });
    });
    var tbl = '<div class="mink">' + blocks.map(function (b) {
      var h = '<div class="mblk"><div class="mh">Для ' + setH(b.c) + "</div><table class=\"mt\">";
      alpha.forEach(function (a, ai) {
        b.c.forEach(function (id, j) {
          var t = T[id][a], odd = b.sig(id) !== b.firstSig;
          h += '<tr class="' + (j === 0 && ai > 0 ? "sep " : "") + (odd ? "odd" : "") + '"><td>(' + nm(id) + ", " + a + ")</td><td>→</td><td>" + (t ? nm(t) : "∅") + '</td><td class="cc">' + (t ? '<span class="kc k' + (cls[t] % 6) + '">C<sub>' + (cls[t] + 1) + "</sub></span>" : "—") + "</td></tr>";
        });
      });
      return h + "</table><p class=\"mv\">" + (b.groups.length === 1 ? "по каждой букве класс один и тот же ⇒ не делится" : "классы отличаются ⇒ делим на " + b.groups.map(setH).join(" и ")) + "</p></div>";
    }).join("") + "</div>";
    var same = np.length === part.length;
    steps.push({
      title: k + "-эквивалентность ≡" + supNum(k), html: tbl + gsvg(np) + legend(np),
      text: "<p>Берём классы ≡" + supNum(k - 1) + " = " + partH(part) + ". Для каждого класса выписываем переходы по каждой букве и смотрим, <b>в какой класс</b> ≡" + supNum(k - 1) + " ведёт каждый переход. Состояния, у которых по каждой букве классы совпадают, остаются вместе; остальные выносим в отдельный класс. Сравнивать надо в рамках одной и той же буквы. Записываем именно сами состояния, а не то, куда они ведут.</p><p>≡" + supNum(k) + " = " + partH(np) + "</p>" + (same ? "<p><b>≡" + supNum(k) + " = ≡" + supNum(k - 1) + "</b>: классы больше не дробятся ⇒ автомат минимизирован, переходим к построению.</p>" : "<p>≡" + supNum(k) + " ≠ ≡" + supNum(k - 1) + " ⇒ продолжаем для k = " + (k + 1) + ".</p>")
    });
    part = np;
    if (same) break;
    k++;
  }
  // минимальный автомат
  var rep = part.map(function (c) { return c[0] });
  var clsOf = {}; part.forEach(function (c, i) { c.forEach(function (id) { clsOf[id] = i }) });
  var rn = function (i) { return "[" + N(g, rep[i]).name + "]" };
  var rnH = function (i) { return "[" + nm(rep[i]) + "]" };
  var gm = { nodes: [], edges: [], eid: 0 };
  part.forEach(function (c, i) { var r = N(g, rep[i]); gm.nodes.push({ id: "C" + i, name: rn(i), x: r.x, y: r.y, start: c.indexOf(st) >= 0, final: c.some(function (id) { return N(g, id).final }) }) });
  part.forEach(function (c, i) {
    var byT = {}, order = [];
    alpha.forEach(function (a) { var t = T[rep[i]][a]; if (t) { var j = clsOf[t]; if (!byT[j]) { byT[j] = []; order.push(j) } byT[j].push(a) } });
    order.forEach(function (j) { addEdge(gm, "C" + i, "C" + j, sym(byT[j].join(","))) });
  });
  var mt = '<div class="tscroll"><table class="dt"><tr><th>δ</th>' + alpha.map(function (a) { return "<th>" + a + "</th>" }).join("") + "</tr>" + part.map(function (c, i) { return "<tr><th>" + (c.indexOf(st) >= 0 ? "→" : "") + rnH(i) + (gm.nodes[i].final ? "*" : "") + "</th>" + alpha.map(function (a) { var t = T[rep[i]][a]; return "<td>" + (t ? rnH(clsOf[t]) : '<span class="muted">—</span>') + "</td>" }).join("") + "</tr>" }).join("") + "</table></div>";
  steps.push({
    title: "Минимизированный автомат", g: gm, o: {},
    text: "<p>Из каждого класса последней эквивалентности берём по одному представителю — это новые состояния: " + part.map(function (c, i) { return setH(c) + " → " + rnH(i) }).join(", ") + ".</p><p><b>Начальное</b> — класс, где лежит исходное начальное " + nm(st) + ". <b>Финальные</b> — классы, где есть хотя бы одно финальное. Дуги переносим из исходного графа, заменяя каждое состояние его классом (петли тоже).</p>" + mt + "<p class=\"muted\" style=\"font-size:.9rem\">Было состояний: " + g0.nodes.length + ", стало: " + part.length + ".</p>"
  });
  steps.mini = gm;
  return steps;
}
function supNum(k) { return String(k).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d] }).join("") }

/* ================= НКА: моделирование и проверка ================= */
function nfaFromGraph(g) {
  var k = 0, tr = {};
  g.nodes.forEach(function (n) { tr[n.id] = [] });
  function fresh() { var id = "#" + (k++); tr[id] = []; return id }
  function put(a, b, re) {
    switch (re.t) {
      case "empty": return;
      case "eps": tr[a].push([null, b]); return;
      case "sym": re.v.split(",").forEach(function(letter){tr[a].push([letter,b])}); return;
      case "alt": re.a.forEach(function (x) { put(a, b, x) }); return;
      case "cat": { var cur = a; re.a.forEach(function (x, i) { var nx = i === re.a.length - 1 ? b : fresh(); put(cur, nx, x); cur = nx }); return }
      case "star": { var n = fresh(); tr[a].push([null, n]); put(n, n, re.e); tr[n].push([null, b]); return }
      case "plus": { var m = fresh(); put(a, m, re.e); put(m, m, re.e); tr[m].push([null, b]); return }
    }
  }
  g.edges.forEach(function (e) { put(e.from, e.to, e.re) });
  var fin = {};
  g.nodes.forEach(function (n) { if (n.final) fin[n.id] = 1 });
  return { tr: tr, start: g.nodes.filter(function (n) { return n.start }).map(function (n) { return n.id }), fin: fin };
}
function nfaFromRe(re) {
  var g = { nodes: [{ id: "A", start: true }, { id: "B", final: true }], edges: [{ from: "A", to: "B", re: re }] };
  return nfaFromGraph(g);
}
function closure(nfa, set) {
  var st = set.slice(), seen = {};
  set.forEach(function (x) { seen[x] = 1 });
  while (st.length) { var x = st.pop(); (nfa.tr[x] || []).forEach(function (t) { if (t[0] === null && !seen[t[1]]) { seen[t[1]] = 1; st.push(t[1]) } }) }
  return Object.keys(seen);
}
function accepts(nfa, w) {
  var cur = closure(nfa, nfa.start);
  for (var i = 0; i < w.length; i++) {
    var nx = {};
    cur.forEach(function (x) { (nfa.tr[x] || []).forEach(function (t) { if (t[0] === w[i]) nx[t[1]] = 1 }) });
    cur = closure(nfa, Object.keys(nx));
    if (!cur.length) return false;
  }
  return cur.some(function (x) { return nfa.fin[x] });
}
function wordsUpTo(alpha, maxLen, cb) {
  var cur = [""];
  if (cb("") === false) return;
  for (var l = 1; l <= maxLen; l++) {
    var nx = [];
    for (var i = 0; i < cur.length; i++) for (var j = 0; j < alpha.length; j++) { var w = cur[i] + alpha[j]; if (cb(w) === false) return; nx.push(w) }
    cur = nx;
  }
}
function lenFor(alpha, budget) { var n = Math.max(1, alpha.length), L = 0, tot = 1, p = 1; while (L < 12) { p *= n; if (tot + p > budget) break; tot += p; L++ } return Math.max(L, 1) }
function sampleWords(nfa, alpha) {
  var acc = [], rej = [], L = Math.min(7, lenFor(alpha, 4000));
  wordsUpTo(alpha, L, function (w) {
    if (accepts(nfa, w)) { if (acc.length < 8) acc.push(w) } else if (rej.length < 5) rej.push(w);
    if (acc.length >= 8 && rej.length >= 5) return false;
  });
  return { acc: acc, rej: rej };
}
function sampleHtml(s) {
  var f = function (w) { return '<code class="w">' + (w === "" ? "ε" : w) + "</code>" };
  return '<p class="muted" style="font-size:.92rem">Для самопроверки на листке. Самые короткие слова, которые автомат допускает: ' + (s.acc.length ? s.acc.map(f).join(" ") : "нет") + ". Не допускает: " + (s.rej.length ? s.rej.map(f).join(" ") : "таких нет") + ". Подставь пару из каждой группы в свой ответ.</p>";
}
function compareNfa(a, b, alpha) {
  var L = lenFor(alpha, 6000), bad = null, cnt = 0;
  wordsUpTo(alpha, L, function (w) { cnt++; var x = accepts(a, w), y = accepts(b, w); if (x !== y) { bad = { w: w, a: x, b: y }; return false } });
  return { bad: bad, L: L, cnt: cnt };
}

/* ================= текстовый формат автомата ================= */
function parseAutomaton(text) {
  var g = { nodes: [], edges: [], eid: 0 }, start = null, finals = [], order = null, seen = {}, list = [];
  function node(id) { if (!seen[id]) { seen[id] = 1; list.push(id) } }
  text.split(/\n/).forEach(function (raw, ln) {
    var line = raw.replace(/#.*$/, "").trim();
    if (!line) return;
    var m;
    if ((m = /^(начало|старт|start|s)\s*[:=]\s*(.+)$/i.exec(line))) { start = m[2].trim().split(/[\s,]+/)[0]; node(start); return }
    if ((m = /^(финал(ы|ьные)?|конец|final|f)\s*[:=]\s*(.+)$/i.exec(line))) { m[3].trim().split(/[\s,;]+/).filter(Boolean).forEach(function (x) { finals.push(x); node(x) }); return }
    if ((m = /^(порядок|order)\s*[:=]\s*(.+)$/i.exec(line))) { order = m[2].trim().split(/[\s,;]+/).filter(Boolean); return }
    var a, lab, b;
    if ((m = /^(\S+)\s*-+\s*(.+?)\s*-+>\s*(\S+)$/.exec(line))) { a = m[1]; lab = m[2]; b = m[3] }
    else { var t = line.split(/\s+/); if (t.length !== 3) throw new ReErr("Строка " + (ln + 1) + ": ожидаю «откуда метка куда», например «q0 a q1»"); a = t[0]; lab = t[1]; b = t[2] }
    [a, b].forEach(function (x) { if (!/^[\wА-Яа-яЁё']+$/.test(x)) throw new ReErr("Строка " + (ln + 1) + ": странное имя состояния «" + x + "»") });
    var re;
    try { re = parseRe(lab) } catch (err) { throw new ReErr("Строка " + (ln + 1) + ", метка «" + lab + "»: " + err.message) }
    node(a); node(b);
    g.edges.push({ id: "e" + (++g.eid), from: a, to: b, re: re });
  });
  if (!list.length) throw new ReErr("Нет ни одной дуги");
  if (!start) start = list[0];
  // раскладка по слоям BFS
  var layer = {}; layer[start] = 0;
  var q = [start];
  while (q.length) { var x = q.shift(); g.edges.forEach(function (e) { if (e.from === x && layer[e.to] == null) { layer[e.to] = layer[x] + 1; q.push(e.to) } }) }
  var maxL = 0; list.forEach(function (id) { if (layer[id] != null) maxL = Math.max(maxL, layer[id]) });
  list.forEach(function (id) { if (layer[id] == null) layer[id] = ++maxL });
  var byL = {};
  list.forEach(function (id) { (byL[layer[id]] = byL[layer[id]] || []).push(id) });
  list.forEach(function (id) {
    var L = layer[id], arr = byL[L], i = arr.indexOf(id);
    g.nodes.push({ id: id, name: id, x: L * 160, y: (i - (arr.length - 1) / 2) * 120 + (L % 2 ? 22 : 0), start: id === start, final: finals.indexOf(id) >= 0 });
  });
  return { g: g, order: order };
}

/* ================= примеры ================= */
function mkG(nodes, edges) {
  var g = { nodes: [], edges: [], eid: 0 };
  nodes.forEach(function (n) { g.nodes.push({ id: n[0], name: n[0], x: n[1], y: n[2], start: /s/.test(n[3] || ""), final: /f/.test(n[3] || "") }) });
  edges.forEach(function (e) { g.edges.push({ id: "e" + (++g.eid), from: e[0], to: e[2], re: parseRe(e[1]) }) });
  return g;
}

if (typeof module !== "undefined") module.exports = { parseRe: parseRe, P: P, S: S, regexSteps: regexSteps, elimSteps: elimSteps, mkG: mkG, nfaFromRe: nfaFromRe, nfaFromGraph: nfaFromGraph, accepts: accepts, compareNfa: compareNfa, parseAutomaton: parseAutomaton, detSteps: detSteps, minSteps: minSteps, svgGraph: svgGraph, scene: scene };


var RM=ctx.reducedMotion;
function $(id){return root.querySelector("#" + CSS.escape(id))}

/* ---------- примеры ---------- */
var EX={
  PQR:function(){return mkG([["p",0,0,"s"],["q",170,0],["r",340,0,"f"]],[["p","0","q"],["q","1","p"],["p","1","p"],["q","0","r"],["r","0","r"],["r","1","r"]])},
  TWO:function(){return mkG([["q0",0,0,"s"],["q1",170,-80],["q2",340,0,"f"],["q3",170,90,"f"]],[["q0","a","q1"],["q1","b","q1"],["q1","a","q2"],["q2","b","q0"],["q0","b","q3"],["q3","a","q3"]])},
  B1:function(){return mkG([["q0",0,0,"s"],["q1",170,0],["q2",340,0,"f"]],[["q0","1","q0"],["q0","0","q1"],["q1","0","q1"],["q1","1","q2"],["q2","0","q1"],["q2","1","q0"]])},
  B2:function(){return mkG([["q1",0,0,"s"],["q2",150,-90],["q3",320,-90],["q4",160,70],["q5",330,70,"f"],["q6",480,-10,"f"]],[["q1","0","q2"],["q1","1","q4"],["q2","1","q3"],["q2","0","q4"],["q3","0","q4"],["q3","0","q5"],["q3","1","q6"],["q4","1","q4"],["q4","1","q5"],["q6","0","q5"]])},
  DET:function(){return mkG([["p",0,0,"s"],["q",170,-80],["r",340,0,"f"]],[["p","ε","q"],["p","b","q"],["q","a","p"],["q","c","p"],["q","c","q"],["q","b","r"],["p","ε","r"],["p","c","r"]])},
  D1:function(){return mkG([["q0",0,0,"s"],["q1",120,-80],["q2",120,100],["q3",340,0,"f"]],[["q0","ε","q1"],["q1","a","q3"],["q1","a","q2"],["q0","b","q2"],["q2","b","q3"],["q3","ε","q2"],["q3","a","q3"],["q3","a","q0"],["q2","b","q2"]])},
  KR2:function(){return mkG([["q0",0,40,"s"],["q1",150,-60],["q2",150,140],["q3",330,-60,"f"],["q4",330,140,"f"],["q5",500,40,"f"]],[["q0","a","q1"],["q0","b","q2"],["q2","a","q2"],["q2","b","q4"],["q1","a","q4"],["q4","b","q4"],["q4","b","q3"],["q3","b","q1"],["q3","a","q5"],["q4","a","q5"]])},
  KR3:function(){return mkG([["q0",0,40,"s"],["q1",160,-40],["q2",330,-40,"f"],["q3",160,120]],[["q0","a","q1"],["q1","ε","q2"],["q1","a","q3"],["q0","ε","q3"],["q3","b","q3"],["q3","a","q2"]])},
  D3:function(){return mkG([["q0",0,0,"s"],["q1",170,0],["q2",340,0,"f"]],[["q0","0","q0"],["q0","1","q0"],["q0","0","q1"],["q1","1","q2"]])},
  M1:function(){return mkG([["q0",0,0,"s"],["q1",150,0],["q2",300,0],["q3",470,-10,"f"],["q4",40,140,"f"],["q5",220,140],["q6",400,140,"f"]],[["q0","a","q1"],["q0","b","q5"],["q1","a","q2"],["q1","b","q5"],["q2","a","q2"],["q2","b","q5"],["q5","a","q3"],["q5","b","q6"],["q3","a","q3"],["q3","b","q6"],["q6","a","q3"],["q6","b","q6"],["q4","a","q0"],["q4","b","q5"]])},
  M2:function(){var P=[[0,0],[150,-70],[300,-70],[420,40],[270,140],[120,140]];return mkG([0,1,2,3,4,5].map(function(i){return["q"+i,P[i][0],P[i][1],(i===0?"s":"")+(i%3===0?"f":"")]}),[0,1,2,3,4,5].reduce(function(a,i){return a.concat([["q"+i,"a","q"+((i+1)%6)],["q"+i,"b","q"+i]])},[]))},
  PH:function(){return mkG([["q0",0,60,"s"],["q1",150,-20],["q2",150,140],["q3",320,-20],["q4",320,140,"f"],["q5",490,-20,"f"],["q6",490,140,"f"]],[["q0","0","q1"],["q0","1","q2"],["q1","0","q2"],["q2","1","q2"],["q2","0","q4"],["q2","1","q3"],["q3","0","q4"],["q3","1","q5"],["q5","0","q4"],["q4","1","q6"],["q5","0","q6"]])},
  D4:function(){return mkG([["q0",0,0,"s"],["q1",170,100],["q2",340,0,"f"]],[["q0","ε","q1"],["q0","b","q2"],["q1","a","q0"],["q1","b","q1"],["q1","a","q2"],["q2","ε","q1"]])},
  FR:function(){return mkG([["q0",0,40,"s"],["q1",150,-40],["q2",150,140],["q3",320,-40],["q4",320,140,"f"],["q5",480,40,"f"]],[["q0","0","q1"],["q1","1","q3"],["q1","1","q2"],["q1","1","q4"],["q3","0","q4"],["q3","1","q5"],["q5","0","q4"],["q4","0","q2"],["q2","0","q2"]])},
  B3:function(){return mkG([["q0",0,0,"sf"],["q1",170,0],["q2",340,0,"f"]],[["q0","a","q1"],["q1","b","q0"],["q1","c","q2"],["q2","c","q2"]])}
};
var ORDER={B1:["q2","q1","q0"],B2:["q2","q4","q3","q6","q5"],KR2:["q2","q1","q5","q3","q4"]};

/* ---------- плеер ---------- */
var cnt=0;
function Stepper(el,steps,legend){
  var self=this;ctx.onCleanup(function(){self.stop()});this.el=el;this.steps=steps;this.i=0;this.timer=null;var id="sp"+(++cnt);
  var gs=steps.filter(function(s){return s.g});this.box=gs.length?unionBox(gs.map(function(s){return scene(s.g,s.o).box})):null;
  el.classList.add("stepper");
  el.innerHTML='<div class="sp-bar"><button class="btn sp-prev" type="button">← Назад</button><div class="sp-mid"><span class="sp-count"></span><input class="sp-range" id="'+id+'-r" type="range" min="0" max="'+(steps.length-1)+'" value="0" aria-label="Шаг разбора"></div><button class="btn sp-play" type="button">▶ Авто</button><button class="btn primary sp-next" type="button">Дальше →</button></div>'+
   (legend?'<div class="legend">'+legend+'</div>':'')+
   '<div class="sp-stage gscroll" aria-live="polite"></div><div class="sp-text"><h4 class="sp-title"></h4><div class="sp-body"></div></div>';
  el.tabIndex=0;var q=function(s){return el.querySelector(s)};
  this.stage=q(".sp-stage");this.title=q(".sp-title");this.body=q(".sp-body");this.count=q(".sp-count");this.range=q(".sp-range");this.prev=q(".sp-prev");this.next=q(".sp-next");this.play=q(".sp-play");
  this.prev.onclick=function(){self.stop();self.go(self.i-1)};this.next.onclick=function(){self.stop();self.go(self.i+1)};
  this.range.oninput=function(){self.stop();self.go(+self.range.value)};
  this.play.onclick=function(){if(self.timer)self.stop();else{if(self.i>=self.steps.length-1)self.go(0);self.play.textContent="❚❚ Пауза";self.timer=setInterval(function(){if(!self.el.isConnected||self.i>=self.steps.length-1)self.stop();else self.go(self.i+1)},2800)}};
  el.addEventListener("keydown",function(e){if(e.target.tagName==="INPUT"&&e.target!==self.range)return;if(e.key==="ArrowRight"){e.preventDefault();self.stop();self.go(self.i+1)}if(e.key==="ArrowLeft"){e.preventDefault();self.stop();self.go(self.i-1)}});
  this.go(0)}
Stepper.prototype.stop=function(){if(this.timer){clearInterval(this.timer);this.timer=null}this.play.textContent="▶ Авто"};
Stepper.prototype.go=function(i){if(i<0||i>=this.steps.length)return;this.i=i;var s=this.steps[i];
  this.stage.innerHTML=s.html?'<div class="sp-html">'+s.html+'</div>':drawScene(scene(s.g,s.o),this.box);
  // Те же fresh/fr, что в исходных разборах: авторская подсветка имеет приоритет.
  if(!this.stage.querySelector(".ed.fresh")){
    var edges=this.stage.querySelectorAll(".ed.in,.ed.out,.ed.lp,.ed.nw");
    if(!edges.length)edges=this.stage.querySelectorAll(".ed");
    edges.forEach(function(e){e.classList.add("fresh")});
  }
  if(!this.stage.querySelector(".nd.fresh"))this.stage.querySelectorAll(".nd").forEach(function(e){e.classList.add("fresh")});
  if(!this.stage.querySelector("td.fr"))this.stage.querySelectorAll("table td").forEach(function(e){e.classList.add("fr")});
  this.title.textContent=s.title;this.body.innerHTML=s.text;
  this.count.textContent="Шаг "+(i+1)+" / "+this.steps.length;this.range.value=i;
  this.prev.disabled=i===0;this.next.disabled=i===this.steps.length-1};

var LEG_A='<span><i style="background:var(--blue)"></i>что появилось на этом шаге</span>';
var LEG_B='<span><i style="background:var(--amber)"></i>входят (R₁)</span><span><i style="background:var(--red)"></i>петля (R₂)</span><span><i style="background:var(--green)"></i>выходят (R₃)</span><span><i style="background:var(--blue)"></i>новое</span>';

/* ---------- правила-картинки ---------- */
function g2(a,b,re,pre){var g={nodes:[{id:"p",name:"p",x:0,y:0},{id:"q",name:"q",x:190,y:0}],edges:[],eid:0,nc:0,pre:pre||"n"};if(re)addEdge(g,a,b,re);return g}
function ruleCard(title,before,after,text){
  return '<div class="rule"><h4>'+title+'</h4><div class="ba"><div>'+svgGraph(before)+'</div><span class="arr">⇓</span><div>'+svgGraph(after.g,after.o)+'</div></div><p>'+text+'</p></div>'}
function splitDemo(re,loop){var g=loop?{nodes:[{id:"p",name:"p",x:0,y:0}],edges:[],eid:0,nc:0,pre:"n"}:g2("p","q",null);addEdge(g,"p",loop?"p":"q",re);var before=cloneG(g);var res=splitEdge(g,0,layoutEdges(g));var ec={},nc={};res.newE.forEach(function(x){ec[x]="nw"});res.newN.forEach(function(x){nc[x]="nw"});return{before:before,after:{g:g,o:{ecls:ec,ncls:nc}}}}
(function(){
  var R1=sym("R₁"),R2=sym("R₂"),R=sym("R"),h="";
  var d=splitDemo(alt(R1,R2));h+=ruleCard("R₁ + R₂",d.before,d.after,"Сумма: две параллельные дуги между теми же вершинами.");
  d=splitDemo(cat(R1,R2));h+=ruleCard("R₁R₂",d.before,d.after,"Склейка: новая вершина посередине. Из трёх частей — две новые вершины.");
  d=splitDemo(star(R));h+=ruleCard("R*",d.before,d.after,"Итерация: новая вершина, ε-вход, петля R, ε-выход.");
  d=splitDemo(plus(R));h+=ruleCard("R⁺",d.before,d.after,"Хотя бы раз: вход по R, петля R, ε-выход.");
  d=splitDemo(cat(R1,R2),true);h+=ruleCard("петля R₁R₂",d.before,d.after,"Петля со склейкой: цепочка из p обратно в p через новую вершину.");
  d=splitDemo(alt(R1,R2),true);h+=ruleCard("петля R₁ + R₂",d.before,d.after,"Петля с суммой: две петли.");
  $("rules-a").innerHTML=h;
  // удаление вершины
  var g={nodes:[{id:"p",name:"p",x:0,y:0},{id:"r",name:"r",x:150,y:0},{id:"q",name:"q",x:300,y:0}],edges:[],eid:0};
  var a=addEdge(g,"p","r",R1),b=addEdge(g,"r","r",R2),c=addEdge(g,"r","q",sym("R₃"));
  var bc={};bc[a.id]="in";bc[b.id]="lp";bc[c.id]="out";var bn={r:"del"};
  var before=svgGraph(g,{ecls:bc,ncls:bn});var g1=cloneG(g);var res=eliminate(g1,"r");var ac={};res.pairs.forEach(function(p){ac[p.eid]="nw"});
  var hb='<div class="rule"><h4>одна пара</h4><div class="ba"><div>'+before+'</div><span class="arr">⇓</span><div>'+svgGraph(g1,{ecls:ac})+'</div></div><p>Вершина r исчезает, путь p → r → q заменяется одной дугой. Петля превращается в итерацию.</p></div>';
  var G={nodes:[{id:"p1",name:"p1",x:0,y:-55},{id:"p2",name:"p2",x:0,y:55},{id:"r",name:"r",x:150,y:0},{id:"q1",name:"q1",x:300,y:-55},{id:"q2",name:"q2",x:300,y:55}],edges:[],eid:0};
  var e1=addEdge(G,"p1","r",sym("a")),e2=addEdge(G,"p2","r",sym("b")),e3=addEdge(G,"r","q1",sym("c")),e4=addEdge(G,"r","q2",sym("d"));
  var c2={};c2[e1.id]="in";c2[e2.id]="in";c2[e3.id]="out";c2[e4.id]="out";
  var bG=svgGraph(G,{ecls:c2,ncls:{r:"del"}});var G1=cloneG(G);var r2=eliminate(G1,"r");var a2={};r2.pairs.forEach(function(p){a2[p.eid]="nw"});
  hb+='<div class="rule"><h4>2 входа × 2 выхода</h4><div class="ba"><div>'+bG+'</div><span class="arr">⇓</span><div>'+svgGraph(G1,{ecls:a2})+'</div></div><p>Петли нет, поэтому просто склейки: ac, ad, bc, bd. Четыре пары — четыре новые дуги.</p></div>';
  $("rules-b").innerHTML=hb;
  // ловушка
  var wrong=mkG([["q0",0,0,"s"],["qf",190,0,"f"]],[["q0","a","q0"],["q0","b","qf"],["q0","c","qf"]]);
  var st=regexSteps("a*b+c"),right=st[st.length-1].g;
  $("pitfall").innerHTML='<div><p class="pen">так нельзя</p><div class="gscroll">'+svgGraph(wrong)+'</div><p class="hint">допускает ac — лишнее слово</p></div><div><p class="pen" style="color:var(--green)">так правильно</p><div class="gscroll">'+svgGraph(right)+'</div><p class="hint">петля a на своей вершине, c туда не попадает</p></div>';
})();


/* ---------- картинки к повторению ---------- */
(function(){
  function G(nodes,edges){var g={nodes:[],edges:[],eid:0},o={ecls:{},ncls:{}};
    nodes.forEach(function(n){g.nodes.push({id:n[0],name:n[0],x:n[1],y:n[2],start:/s/.test(n[3]||""),final:/f/.test(n[3]||"")});if(n[4])o.ncls[n[0]]=n[4]});
    edges.forEach(function(e){var lab=e[1],re=lab.charAt(0)==="!"?sym(lab.slice(1)):parseRe(lab);var ed=addEdge(g,e[0],e[2],re);if(e[3])o.ecls[ed.id]=e[3]});
    return svgGraph(g,o)}
  function card(title,text,svg,cap){return '<div class="rule"><h4>'+title+'</h4>'+(text?'<p style="margin:0 0 .3em">'+text+'</p>':'')+'<div class="ba"><div class="gscroll">'+svg+'</div></div>'+(cap?'<p>'+cap+'</p>':'')+'</div>'}
  function pair(title,a,b,cap){return '<div class="rule"><h4>'+title+'</h4><div class="ba"><div class="gscroll">'+a+'</div><span class="arr">⇔</span><div class="gscroll">'+b+'</div></div><p>'+cap+'</p></div>'}
  var w=function(s){return '<code class="w">'+s+'</code>'};
  FIG={G:G,card:card,pair:pair};
  // основы графа
  $("basics").innerHTML=
    card("ε-дуга","переход без чтения буквы",G([["q0",0,0,"s"],["q1",115,0],["q2",230,0],["q3",345,0,"f"]],[["q0","a","q1"],["q1","ε","q2","lp"],["q2","b","q3"]]),"Слово "+w("ab")+": читаем a, по ε переходим бесплатно, читаем b. Букв в слове две, дуг три.")+
    card("Несколько дуг по одной букве","недетерминированный автомат",G([["q0",0,0,"s"],["q1",130,-55],["q2",130,55],["q3",260,0,"f"]],[["q0","a","q1","lp"],["q0","a","q2","lp"],["q1","b","q3"],["q2","c","q3"]]),"Из q<sub>0</sub> по a две стрелки — автомат «угадывает» путь. Слово допускается, если <b>хоть один</b> путь привёл в финал: "+w("ab")+" и "+w("ac")+" допускаются.")+
    pair("«a,c» на дуге",G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","!a,c","q1"]]),G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q0","c","q1"]]),"Одна дуга с подписью «a,c» — это две параллельные дуги, по a и по c. В регулярке это <span class=\"re\">a+c</span>, при склейке параллельных дуг так и пишешь.");
  // операции
  $("ops").innerHTML=
    card('<span class="re">R<sub>1</sub>+R<sub>2</sub></span>','сумма, «или»: слово из R₁ <b>или</b> из R₂',G([["q0",0,0,"s"],["q1",120,60],["qf",240,0,"f"]],[["q0","a","qf"],["q0","b","q1"],["q1","c","qf"]]),'<span class="re">a+bc</span> = {a, bc}: два разных пути из начала в финал.')+
    card('<span class="re">R<sub>1</sub>R<sub>2</sub></span>','склейка: слово из R₁, сразу за ним слово из R₂',G([["q0",0,0,"s"],["q1",140,0],["qf",280,0,"f"]],[["q0","a","q1"],["q0","b","q1"],["q1","c","qf"]]),'<span class="re">(a+b)c</span> = {ac, bc}: сначала a или b, потом обязательно c.')+
    card('<span class="re">R<sup>*</sup></span>','итерация: R ноль или больше раз подряд',G([["q0",0,0,"sf"],["q1",150,0]],[["q0","a","q1"],["q1","b","q0"]]),'<span class="re">(ab)<sup>*</sup></span> = {ε, ab, abab, …}: начальное одновременно финальное — поэтому ε тоже допускается.')+
    card('<span class="re">R<sup>+</sup></span>','хотя бы один раз: R<sup>+</sup> = RR<sup>*</sup>',G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q1","a","q1"]]),'<span class="re">a<sup>+</sup></span> = {a, aa, …}: первую a читаем обязательно, дальше петля. Пустого слова нет.');
  $("prio").innerHTML=
    card('<span class="re">ab<sup>*</sup></span>','звёздочка только над b',G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q1","b","q1"]]),"Допускает "+w("a")+", "+w("ab")+", "+w("abb")+"… Петля одна, по b.")+
    card('<span class="re">(ab)<sup>*</sup></span>','звёздочка над всей скобкой',G([["q0",0,0,"sf"],["q1",150,0]],[["q0","a","q1"],["q1","b","q0"]]),"Допускает "+w("ε")+", "+w("ab")+", "+w("abab")+"… Повторяется пара целиком, а "+w("abb")+" — нет.");
  // тождества
  $("ids").innerHTML=
    pair('<span class="re">εR = R</span>',G([["p",0,0,"s"],["n",115,0],["q",230,0,"f"]],[["p","ε","n","lp"],["n","R","q"]]),G([["p",0,0,"s"],["q",140,0,"f"]],[["p","R","q"]]),"ε-дуга ничего не читает, её можно «сжать». Так же Rε = R.")+
    pair('<span class="re">R + ∅ = R</span>',G([["p",0,0,"s"],["q",160,0,"f"]],[["p","R","q"],["p","∅","q","gh"]]),G([["p",0,0,"s"],["q",160,0,"f"]],[["p","R","q"]]),"Дуги с ∅ нет, остаётся только R.")+
    pair('<span class="re">∅R = ∅</span>',G([["p",0,0,"s"],["n",115,0],["q",230,0,"f"]],[["p","∅","n","gh"],["n","R","q"]]),G([["p",0,0,"s"],["q",140,0,"f"]],[["p","∅","q","gh"]]),"До n не дойти, значит и до q не дойти: путь оборван. Язык пустой.")+
    pair('<span class="re">ε<sup>*</sup> = ε</span>',G([["p",0,0,"s"],["n",115,0],["q",230,0,"f"]],[["p","ε","n"],["n","ε","n","lp"],["n","ε","q"]]),G([["p",0,0,"s"],["q",140,0,"f"]],[["p","ε","q"]]),"Крутиться по ε-петле можно сколько угодно, но букв это не добавляет.")+
    pair('<span class="re">∅<sup>*</sup> = ε</span>',G([["p",0,0,"s"],["n",115,0],["q",230,0,"f"]],[["p","ε","n"],["n","∅","n","gh"],["n","ε","q"]]),G([["p",0,0,"s"],["q",140,0,"f"]],[["p","ε","q"]]),"Петли нет вообще, но пройти «ноль раз» можно: ε → ε. Поэтому ∅<sup>*</sup> не пустой, а ε.")+
    pair('<span class="re">(R<sup>*</sup>)<sup>*</sup> = R<sup>*</sup></span>',G([["n",0,0,"sf"]],[["n","R*","n","lp"]]),G([["n",0,0,"sf"]],[["n","R","n"]]),"Петля, на которой написано «R сколько угодно раз», и так крутится сколько угодно раз. Вторая звёздочка лишняя.")+
    pair('<span class="re">(ε+R)<sup>*</sup> = R<sup>*</sup></span>',G([["n",0,0,"sf"]],[["n","ε","n","lp"],["n","R","n"]]),G([["n",0,0,"sf"]],[["n","R","n"]]),"Петля ε ничего не даёт — выкидываем. Остаётся петля R.")+
    pair('<span class="re">R + R = R</span>',G([["p",0,0,"s"],["q",160,0,"f"]],[["p","R","q"],["p","R","q","lp"]]),G([["p",0,0,"s"],["q",160,0,"f"]],[["p","R","q"]]),"Две одинаковые параллельные дуги — то же, что одна.")+
    pair('<span class="re">RR<sup>*</sup> = R<sup>+</sup></span>',G([["p",0,0,"s"],["n",115,0],["q",230,0,"f"]],[["p","R","n"],["n","R","n"],["n","ε","q"]]),G([["p",0,0,"s"],["q",140,0,"f"]],[["p","R⁺","q"]]),"Сокращение из разбора КР: вход по R, петля R, выход по ε — это «хотя бы один раз R».");
})();


/* ---------- картинки к части 4 ---------- */
(function(){
  var G=FIG.G,pair=FIG.pair,card=FIG.card;
  $("norm").innerHTML=
    pair("Недостижимая вершина",G([["q0",0,0,"s"],["q1",150,0,"f"],["q2",75,90,"","del"]],[["q0","a","q1"],["q2","b","q1","lp"],["q0","c","q0"]]),G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q0","c","q0"]]),"В q<sub>2</sub> не ведёт ни одна стрелка, из начала до неё не дойти. Стираем вместе с её дугой b.")+
    pair("В начальную входит дуга",G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q1","b","q0","lp"]]),G([["s",-110,0,"s","nw"],["q0",0,0],["q1",150,0,"f"]],[["s","ε","q0","nw"],["q0","a","q1"],["q1","b","q0"]]),"Стрелка b возвращается в q<sub>0</sub> — значит, нужна новая начальная s с ε-дугой в q<sub>0</sub>. q<sub>0</sub> перестаёт быть начальной.")+
    pair("Петля на начальной",G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q0","lp"],["q0","b","q1"]]),G([["s",-110,0,"s","nw"],["q0",0,0],["q1",150,0,"f"]],[["s","ε","q0","nw"],["q0","a","q0"],["q0","b","q1"]]),"Петля — тоже входящая дуга. Тот же случай: добавляем s.")+
    pair("Несколько финальных",G([["q0",0,0,"s"],["q1",140,-55,"f"],["q2",140,55,"f"]],[["q0","a","q1"],["q0","b","q2"]]),G([["q0",0,0,"s"],["q1",140,-55],["q2",140,55],["f",260,0,"f","nw"]],[["q0","a","q1"],["q0","b","q2"],["q1","ε","f","nw"],["q2","ε","f","nw"]]),"Финальной должна быть одна. Добавляем f и ε-дуги в неё из всех старых финальных, а сами они становятся обычными.")+
    pair("Из финальной выходит дуга",G([["q0",0,0,"s"],["q1",150,0,"f"]],[["q0","a","q1"],["q1","b","q1","lp"]]),G([["q0",0,0,"s"],["q1",150,0],["f",280,0,"f","nw"]],[["q0","a","q1"],["q1","b","q1"],["q1","ε","f","nw"]]),"Петля b выходит из финальной q<sub>1</sub>. Добавляем f: теперь из конца ничего не выходит.")+
    card("Уже нормализован","ничего не добавляем",G([["q0",0,0,"s"],["q1",130,0],["q2",260,0,"f"]],[["q0","a","q1"],["q1","b","q1"],["q1","c","q2"]]),"В q<sub>0</sub> ничего не входит, финальная одна, из q<sub>2</sub> ничего не выходит. Петля на q<sub>1</sub> не мешает — q<sub>1</sub> не начало и не конец.");
  $("merge").innerHTML=
    pair("Параллельные дуги",G([["p",0,0],["q",160,0]],[["p","a","q"],["p","b","q"]]),G([["p",0,0],["q",160,0]],[["p","a+b","q","nw"]]),"Из p в q можно пройти по a или по b — это сумма.")+
    pair("Две петли",G([["p",0,0]],[["p","a","p"],["p","b","p"]]),G([["p",0,0]],[["p","a+b","p","nw"]]),"Петли на одной вершине склеиваются так же. При удалении вершины это даст (a+b)<sup>*</sup>, а не a<sup>*</sup>b<sup>*</sup>.")+
    card("Не путай: разные направления","это не параллельные дуги",G([["p",0,0],["q",160,0]],[["p","a","q"],["q","b","p"]]),"p → q и q → p идут в разные стороны, склеивать их нельзя. Они исчезнут сами, когда удалишь p или q.");
  $("elimc").innerHTML=
    pair("Петли нет",G([["p",0,0],["r",120,0,"","del"],["q",240,0]],[["p","a","r","in"],["r","b","q","out"]]),G([["p",0,0],["q",170,0]],[["p","ab","q","nw"]]),"R₂ нет, звёздочку не пишем: просто R₁R₃ = ab.")+
    pair("Вход и выход в одну вершину",G([["p",0,0],["r",150,0,"","del"]],[["p","a","r","in"],["r","b","p","out"]]),G([["p",0,0]],[["p","ab","p","nw"]]),"Пара «из p в r» и «из r в p» даёт дугу p → p, то есть петлю ab на p.")+
    pair("Дуга уже была",G([["p",0,0],["r",120,-60,"","del"],["q",240,0]],[["p","a","r","in"],["r","b","q","out"],["p","c","q"]]),G([["p",0,0],["q",170,0]],[["p","c+ab","q","nw"]]),"Новая ab ложится параллельно старой c — сразу склеиваем через +.")+
    pair("Тупиковая вершина",G([["p",0,0],["r",120,-60,"","del"],["q",240,0]],[["p","a","r","in"],["p","b","q"]]),G([["p",0,0],["q",170,0]],[["p","b","q"]]),"Из r ничего не выходит: выходов 0, пар 0. Через r не дойти до конца, просто стираем.");
})();

/* ---------- квиз ---------- */
(function(){
  var items=[
    ["ab*","abbb","a, потом b сколько угодно раз."],
    ["(ab)*","abb","Повторяется пара ab целиком, лишняя b не влезает."],
    ["a+bc","ac","Либо a, либо bc. Склейки a с c нет."],
    ["(a+b)c","bc","Сначала a или b, потом c."],
    ["a^+b","b","a⁺ — хотя бы одна a."],
    ["(a+b)*abb","babb","Начало b из (a+b)*, дальше abb."],
    ["ε+a","","Пустое слово — первое слагаемое."]
  ];
  var h="";items.forEach(function(it,i){var re=parseRe(it[0]);var ok=accepts(nfaFromRe(re),it[1]);
    h+='<div class="qi" data-a="'+(ok?1:0)+'"><div class="q">'+(i+1)+'. <span class="re">'+PH(re)+'</span> и слово <code class="w">'+(it[1]===""?"ε":it[1])+'</code></div><div class="bt"><button class="btn sm" type="button" data-v="1">входит</button><button class="btn sm" type="button" data-v="0">не входит</button></div><div class="fb"><b></b> '+it[2]+'</div></div>'});
  var q=$("quiz");q.innerHTML=h;
  q.addEventListener("click",function(e){var b=e.target.closest("button[data-v]");if(!b)return;var it=b.closest(".qi"),right=it.getAttribute("data-a")===b.getAttribute("data-v");it.classList.remove("ok","no");it.classList.add(right?"ok":"no");it.querySelector(".fb b").textContent=right?"Верно.":"Нет, "+(it.getAttribute("data-a")==="1"?"входит.":"не входит.")});
})();

/* ---------- прогон слова ---------- */
(function(){
  var g=EX.PQR();$("pqr-svg").innerHTML=svgGraph(g);
  var nfa=nfaFromGraph(g);
  function fmt(set){return set.length===1?set[0]:"{"+set.join(", ")+"}"}
  function run(){var w=$("pqr-w").value.trim(),out=$("pqr-out");
    if(/[^01]/.test(w)){out.innerHTML='<p class="err">Алфавит этого автомата {0, 1}. Убери другие символы.</p>';return}
    var cur=["p"],parts=["("+fmt(cur)+", "+(w||"ε")+")"],ok=true;
    for(var i=0;i<w.length;i++){var nx={};cur.forEach(function(x){(nfa.tr[x]||[]).forEach(function(t){if(t[0]===w[i])nx[t[1]]=1})});cur=Object.keys(nx);
      if(!cur.length){parts.push("∅");ok=false;break}parts.push("("+fmt(cur)+", "+(w.slice(i+1)||"ε")+")")}
    var acc=ok&&cur.indexOf("r")>=0;
    out.innerHTML='<div class="trace">'+parts.join(" ⊢ ")+'</div><p class="'+(acc?"okm":"err")+'">'+(acc?"Остановились в r, r ∈ F — слово допускается.":"Остановились не в r — слово не допускается.")+"</p>"}
  $("pqr-go").onclick=run;$("pqr-w").addEventListener("keydown",function(e){if(e.key==="Enter")run()});run();
})();

/* ---------- разборы ---------- */
new Stepper($("demo-r2a"),regexSteps("(ab+b^+)*a+(ab)*"),LEG_A);
new Stepper($("demo-a2r-1"),elimSteps(EX.PQR(),["q","r","p"]),LEG_B);
new Stepper($("demo-a2r-2"),elimSteps(EX.TWO()),LEG_B);
new Stepper($("demo-det"),detSteps(EX.DET(),"bcab"));
new Stepper($("demo-min"),minSteps(EX.M1()));
root.querySelectorAll("[data-show]").forEach(function(el){el.innerHTML=svgGraph(EX[el.getAttribute("data-show")]())});
root.querySelectorAll("details[data-solve]").forEach(function(d){
  d.addEventListener("toggle",function(){if(!d.open||d._built)return;d._built=true;var div=root.ownerDocument.createElement("div");d.appendChild(div);
    if(d.getAttribute("data-solve")==="re")new Stepper(div,regexSteps(d.getAttribute("data-src")),LEG_A);
    else if(d.getAttribute("data-solve")==="min")new Stepper(div,minSteps(EX[d.getAttribute("data-g")]()));
    else if(d.getAttribute("data-solve")==="det")new Stepper(div,clearDetSteps(EX[d.getAttribute("data-g")](),d.getAttribute("data-w")));
    else{var k=d.getAttribute("data-g");new Stepper(div,elimSteps(EX[k](),ORDER[k]),LEG_B)}})});


/* ---------- образцы листка ---------- */
(function(){
  var A=regexSteps("a(b+c)*"),B=elimSteps(EX.PQR(),["q","r","p"]);
  function sh(svg){return svg.replace(/url\(#a(ink|nw|in|out|lp)\)/g,"url(#asheet)")}
  root.querySelectorAll("[data-sheet]").forEach(function(el){var k=el.getAttribute("data-sheet").split(":"),st=(k[0]==="A"?A:B)[+k[1]];el.innerHTML=sh(svgGraph(st.g,{}))});
  var Dd=detSteps(EX.D1(),"abbba");
  root.querySelectorAll("[data-sheet-det]").forEach(function(el){var k=el.getAttribute("data-sheet-det").split(":"),s=Dd[+k[1]];el.innerHTML=k[0]==="g"?sh(svgGraph(s.g,{})):s.html});
  var t=root.querySelector('[data-sheet-table="A"]');if(t)t.innerHTML=deltaTable(A[A.length-1].g,["a","b","c"]).replace(/<p class="muted"[\s\S]*$/,"");
})();


/* ---------- листки, собранные из шагов ---------- */
function shSvg(g,o){return '<div class="gscroll">'+svgGraph(g,o||{}).replace(/url\(#a(ink|nw|in|out|lp|gh)\)/g,"url(#asheet)")+'</div>'}
function shRe(e,ctx){return pr(e,ctx||0,true)}
function shName(id){return nameHtml(id)}
function findPath(g,w,acc){/* путь в автомате с буквенными дугами */
  var tr=[];g.edges.forEach(function(e){(function put(re){if(re.t==="sym")tr.push([e.from,re.v,e.to]);else if(re.t==="eps")tr.push([e.from,null,e.to]);else if(re.t==="alt")re.a.forEach(put)})(e.re)});
  var st=g.nodes.filter(function(n){return n.start})[0].id,fin={};g.nodes.forEach(function(n){if(n.final)fin[n.id]=1});
  var q=[[st,0,[st]]],seen={};
  while(q.length){var c=q.shift(),k=c[0]+"|"+c[1];if(seen[k])continue;seen[k]=1;if(c[1]===w.length&&fin[c[0]])return c[2];
    tr.forEach(function(t){if(t[0]!==c[0])return;if(t[1]===null)q.push([t[2],c[1],c[2].concat(["ε",t[2]])]);else if(w[c[1]]===t[1])q.push([t[2],c[1]+1,c[2].concat([t[1],t[2]])])})}
  return null}
function pathHtml(p){var h=shName(p[0]);for(var i=1;i<p.length;i+=2)h+=" —"+p[i]+"→ "+shName(p[i+1]);return h}
function sheetB(g0,order){
  var st=elimSteps(g0,order),g=st[0].g,al={};g.edges.forEach(function(e){letters(e.re,al)});al=Object.keys(al).sort();
  var start=g.nodes.filter(function(n){return n.start})[0],fins=g.nodes.filter(function(n){return n.final});
  var h='<p class="hdr">Лабораторная работа №3</p><p class="sub">Построение регулярного выражения по конечному автомату</p>';
  h+='<p class="lbl">Дано:</p><p class="ind">M = ({'+al.join(", ")+'}, {'+g.nodes.map(function(n){return shName(n.id)}).join(", ")+'}, δ, '+shName(start.id)+', {'+fins.map(function(n){return shName(n.id)}).join(", ")+'})</p>'+shSvg(g);
  h+='<p class="lbl">Решение:</p>';var k=1;
  st.forEach(function(s,i){
    if(s.norm){var n=s.norm,lines=[];
      if(n.s)lines.push("В "+shName(n.start)+" входят дуги ⇒ добавляем начальное "+n.s+" и дугу "+n.s+" —ε→ "+shName(n.start)+".");
      else lines.push("В "+shName(n.start)+" ничего не входит ⇒ начальное оставляем.");
      if(n.f)lines.push((n.finals.length>1?"Финальных несколько ("+n.finals.map(shName).join(", ")+")":"Из финальной "+shName(n.finals[0])+" выходят дуги")+" ⇒ добавляем финальное "+n.f+" и ε-дуги в него из "+n.finals.map(shName).join(", ")+".");
      else lines.push("Финальная одна, из неё ничего не выходит.");
      h+='<p class="st">'+(k++)+'. Нормализация.</p>'+lines.map(function(l){return '<p class="ind">'+l+'</p>'}).join("");
      if(!(st[i+1]&&st[i+1].merge))h+=shSvg(s.g)}
    if(s.merge){h+='<p class="st">'+(k++)+'. Склеиваем параллельные дуги: '+s.merge.map(function(m){return shName(m.from)+" → "+shName(m.to)+": "+m.parts.map(function(x){return shRe(x)}).join(", ")+" ⇒ "+shRe(m.res)}).join("; ")+'.</p>'+shSvg(s.g)}
    if(s.elim){var r=s.elim,ins=r.ins.map(function(e){return shName(e.from)+" —"+shRe(e.re)+"→ "+shName(r.r)}),outs=r.outs.map(function(e){return shName(r.r)+" —"+shRe(e.re)+"→ "+shName(e.to)});
      h+='<p class="st">'+(k++)+'. Удаляем '+shName(r.r)+'.</p><p class="ind">Входы: '+(ins.join(", ")||"нет")+'.&nbsp; Петля: '+(r.L?shRe(r.L):"нет")+'.&nbsp; Выходы: '+(outs.join(", ")||"нет")+'.</p>';
      if(r.pairs.length){h+='<div class="ind tscroll"><table class="pt"><tr><th>пара</th><th>R₁R₂*R₃</th><th>итог</th></tr>';
        r.pairs.forEach(function(p){var raw=shRe(p.R1,1)+(p.L?shRe(p.L,2)+"<sup>*</sup>":"")+shRe(p.R3,1),res=shRe(p.res);
          h+='<tr><td>'+shName(p.p)+" → "+shName(p.q)+'</td><td>'+raw+(res!==raw.replace(/<\/?sup>/g,function(x){return x})&&res!==raw?" = "+res:"")+'</td><td>'+(p.merged?(p.p===p.q?"петля: ":"")+shRe(p.merged.res):(p.p===p.q?"петля: ":"")+res)+'</td></tr>'});
        h+='</table></div>'}else h+='<p class="ind">Пар нет — просто стираем.</p>';
      h+=shSvg(st[i+1].g)}
  });
  var ans=st[st.length-1].answer;h+='<p class="lbl">Ответ:</p><p class="ind"><span class="frame">R = '+shRe(ans)+'</span></p>';
  var nfa=nfaFromGraph(g0),sm=sampleWords(nfa,al),yes=sm.acc.filter(function(w){return w.length>=2})[0]||sm.acc[0],no=sm.rej.filter(function(w){return w.length>=2})[0]||sm.rej[0];
  h+='<p class="lbl">Проверка:</p>';
  if(yes){var pth=findPath(g0,yes);h+='<p class="ind">'+yes+': '+(pth?pathHtml(pth)+" ∈ F":"")+' — допускается, в R тоже есть ✓</p>'}
  if(no)h+='<p class="ind">'+(no||"ε")+': до финального не дойти — не допускается, в R его нет ✓</p>';
  return h}
function sheetA(src){
  var st=regexSteps(src),re=parseRe(src),al=Object.keys(letters(re)).sort();
  var h='<p class="hdr">Лабораторная работа №3</p><p class="sub">Построение конечного автомата по регулярному выражению</p>';
  h+='<p class="lbl">Дано:</p><p class="ind">R = '+shRe(re)+',&nbsp; Σ = {'+al.join(", ")+'}</p><p class="lbl">Решение:</p>';
  h+='<p class="st">1. Строим исходную дугу из начального q₀ в финальное q<sub>f</sub> с меткой R.</p>'+shSvg(st[0].g);
  st.forEach(function(s,i){if(!s.info)return;var f=s.info,o=f.old,p=shName(o.from),q=shName(o.to),nn=f.newN.map(shName).join(", "),r=o.re,line;
    var where=f.loop?" (петля на "+p+")":"";
    switch(f.rule){
      case "alt":line=shRe(r)+where+" — сумма ⇒ параллельные "+(f.loop?"петли":"дуги "+p+" → "+q)+": "+r.a.map(function(x){return shRe(x)}).join(", ")+".";break;
      case "cat":var ids=[p].concat(f.newN.map(shName)).concat([q]);line=shRe(r)+where+" — произведение ⇒ вводим "+nn+": "+r.a.map(function(x,j){return ids[j]+" —"+shRe(x,1)+"→ "}).join("")+ids[ids.length-1]+".";break;
      case "star":line=shRe(r)+where+" — итерация ⇒ вводим "+nn+": "+p+" —ε→ "+nn+", петля "+shRe(r.e)+" на "+nn+", "+nn+" —ε→ "+q+".";break;
      case "plus":line=shRe(r)+where+" — хотя бы раз (R⁺ = RR*) ⇒ вводим "+nn+": "+p+" —"+shRe(r.e,1)+"→ "+nn+", петля "+shRe(r.e)+", "+nn+" —ε→ "+q+".";break;
      default:line="∅ — дугу стираем."}
    h+='<p class="st">'+(i+1)+'. '+line+'</p>'+shSvg(s.g)});
  var last=st[st.length-1].g;
  h+='<p class="lbl">Ответ:</p><p class="ind">M = (Σ, Q, δ, q₀, F),&nbsp; Σ = {'+al.join(", ")+'},&nbsp; Q = {'+last.nodes.map(function(n){return shName(n.id)}).join(", ")+'},&nbsp; F = {q<sub>f</sub>}</p><div class="ind">'+deltaTable(last,al).replace(/<p class="muted"[\s\S]*$/,"")+'</div>';
  var nfa=nfaFromRe(re),sm=sampleWords(nfa,al),yes=sm.acc.filter(function(w){return w.length>=2})[0],no=sm.rej.filter(function(w){return w.length>=2})[0];
  h+='<p class="lbl">Проверка:</p>';
  if(yes){var pth=findPath(last,yes);h+='<p class="ind">'+yes+': '+(pth?pathHtml(pth):"")+' ✓ допускается</p>'}
  if(no)h+='<p class="ind">'+no+': пути в q<sub>f</sub> нет ✗ не допускается</p>';
  return h}

function sheetDet(g0,word){
  var st=detSteps(g0,word),g=st[0].g,n=g.nodes.length,al={};g.edges.forEach(function(e){letters(e.re,al)});al=Object.keys(al).sort();
  var start=g.nodes.filter(function(x){return x.start})[0],fins=g.nodes.filter(function(x){return x.final});
  var cl=st[1].text.match(/<li>[\s\S]*?<\/li>/g).map(function(s){return s.replace(/<\/?li>/g,"")});
  var startLine=(st[1].text.match(/<b>Начальные<\/b>[^:]*:([^.]*)\./)||[])[1]||"";
  var sG=st[2+n].g,pRows=st.length-2-(3+n),lastP=st[st.length-2],fin=st[st.length-1];
  var fS=sG.nodes.filter(function(x){return x.final}).map(function(x){return nameHtml(x.name)}).join(", ");
  var fP=fin.g.nodes.filter(function(x){return x.final}).map(function(x){return nameHtml(x.name)}).join(", ");
  var h='<p class="hdr">Лабораторная работа №4</p><p class="sub">Удаление ε-переходов и детерминизация конечного автомата</p>';
  h+='<p class="lbl">Дано:</p><p class="ind">M<sub>ε</sub> = ({'+al.join(", ")+'}, {'+g.nodes.map(function(x){return nameHtml(x.id)}).join(", ")+'}, δ<sub>ε</sub>, '+nameHtml(start.id)+', {'+fins.map(function(x){return nameHtml(x.id)}).join(", ")+'})</p>'+shSvg(g);
  h+='<p class="lbl">Решение:</p><p class="st">1. Строим ε-замыкания:</p><p class="ind">'+cl.join(",&nbsp; ")+'</p>';
  h+='<p class="ind">Начальные:'+startLine+'.&nbsp; Финальные: '+fS+' (содержат финальное исходного).</p>';
  h+='<p class="st"><span class="side">из Sᵢ по букве, потом Ξ</span>2. Удаляем ε-переходы — таблица автомата без ε:</p><div class="ind">'+st[1+n].html+'</div>'+shSvg(sG);
  h+='<p class="st">3. Детерминизация. '+(lastP.html.match(/P<sub>0<\/sub> = \{[^}]*\}/)||[""])[0]+':</p><div class="ind">'+lastP.html+'</div><p class="pen">новое множество — новое P, пустое — ∅</p>';
  h+='<p class="st">4. Граф детерминированного автомата. Финальные: '+fP+'.</p>'+shSvg(fin.g);
  var tr=(fin.text.match(/<div class="trace">([\s\S]*?)<\/div>/)||[])[1]||"";
  h+='<p class="lbl">Проверка:</p><p class="ind">w = '+word+': '+tr+' ⇒ '+(/допускает/.test(fin.text)&&!/не допускается/.test(fin.text)?"цепочка допускается ✓":"не допускается")+'</p>';
  return h}
$("sheet-fr-b").innerHTML=sheetB(EX.FR(),["q2","q3","q5","q4","q1"]);
$("sheet-fr-a").innerHTML=sheetA("(a+b*)(b+c)^+ + (a^+b)*");
$("sheet-d4").innerHTML=sheetDet(EX.D4(),"bab");

$("sheet-ph-b").innerHTML=sheetB(EX.PH());
$("sheet-ph-a").innerHTML=sheetA("(a^++b)*b+b^++(bc)*+a");

/* ---------- тренажёр ---------- */
root.querySelectorAll("[data-ins]").forEach(function(b){b.onclick=function(){var inp=$(b.getAttribute("data-ins")),v=b.getAttribute("data-v"),s=inp.selectionStart==null?inp.value.length:inp.selectionStart,e=inp.selectionEnd==null?s:inp.selectionEnd;inp.value=inp.value.slice(0,s)+v+inp.value.slice(e);inp.focus();inp.setSelectionRange(s+v.length,s+v.length)}});
function t1(){var msg=$("t1-msg"),st=$("t1-st");try{var steps=regexSteps($("t1-in").value);msg.innerHTML="";st.innerHTML="";var d=root.ownerDocument.createElement("div");st.appendChild(d);new Stepper(d,steps,LEG_A)}catch(e){msg.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>";st.innerHTML=""}}
$("t1-go").onclick=t1;$("t1-in").addEventListener("keydown",function(e){if(e.key==="Enter")t1()});
var curAut=null;
function t2(){var msg=$("t2-msg"),st=$("t2-st");try{var pa=parseAutomaton($("t2-in").value);curAut=pa.g;var steps=elimSteps(pa.g,pa.order);msg.innerHTML="";st.innerHTML="";var d=root.ownerDocument.createElement("div");st.appendChild(d);new Stepper(d,steps,LEG_B)}catch(e){curAut=null;msg.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>";st.innerHTML=""}}
$("t2-go").onclick=t2;
function alphaOf(list){var o={};list.forEach(function(r){letters(r,o)});return Object.keys(o).sort()}
function cmpMsg(r,nameA,nameB){
  if(!r.bad)return'<p class="okm">Совпадают на всех '+r.cnt+' словах длины до '+r.L+'. Это ограниченная проверка: совпадение коротких слов ещё не доказывает эквивалентность.</p>';
  var w=r.bad.w===""?"ε":r.bad.w;return'<p class="err">Расходятся на слове <code class="w">'+w+'</code>: '+nameA+" его "+(r.bad.a?"допускает":"не допускает")+", а "+nameB+" — "+(r.bad.b?"допускает":"нет")+".</p>"}
$("t2-cmp").onclick=function(){var out=$("t2-cmpout");try{var pa=parseAutomaton($("t2-in").value);curAut=pa.g;var my=parseRe($("t2-my").value);
  var al=alphaOf(curAut.edges.map(function(e){return e.re}).concat([my]));out.innerHTML=cmpMsg(compareNfa(nfaFromGraph(curAut),nfaFromRe(my),al),"автомат","твоё выражение")}catch(e){out.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>"}};
function t3(){var out=$("t3-out");try{var a=parseRe($("t3-a").value),b=parseRe($("t3-b").value);out.innerHTML=cmpMsg(compareNfa(nfaFromRe(a),nfaFromRe(b),alphaOf([a,b])),"R₁","R₂")}catch(e){out.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>"}}
$("t3-go").onclick=t3;
var curDfa=null;
$("t4-wgo").onclick=function(){var out=$("t4-wout");if(!curDfa){out.innerHTML='<p class="err">Сначала нажми «Детерминизировать».</p>';return}var w=$("t4-w").value.trim().replace(/^ε$/,"");var bad=Array.from(w).filter(function(c){return curDfa.alpha.indexOf(c)<0});if(bad.length){out.innerHTML='<p class="err">Символа «'+esc(bad[0])+'» нет в алфавите {'+curDfa.alpha.join(", ")+'}.</p>';return}out.innerHTML=dfaTraceHtml(curDfa,w)};
function t4(){curDfa=null;var msg=$("t4-msg"),st=$("t4-st");try{var pa=parseAutomaton($("t4-in").value);var steps=clearDetSteps(pa.g);curDfa=steps.dfa;$("t4-wout").innerHTML="";msg.innerHTML="";st.innerHTML="";var d=root.ownerDocument.createElement("div");st.appendChild(d);new Stepper(d,steps)}catch(e){msg.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>";st.innerHTML=""}}
$("t4-go").onclick=t4;
function t5(){var msg=$("t5-msg"),st=$("t5-st");try{var pa=parseAutomaton($("t5-in").value);var steps=minSteps(pa.g);msg.innerHTML="";st.innerHTML="";var d=root.ownerDocument.createElement("div");st.appendChild(d);new Stepper(d,steps)}catch(e){msg.innerHTML='<p class="err">'+esc(e.message||String(e))+"</p>";st.innerHTML=""}}
$("t5-go").onclick=t5;
t1();t2();t3();t4();t5();



mountLearning(root,ctx,Stepper,mkG);
// Подсветка текущего раздела — как в статье по ЛП.
(function(){
  var links=Array.from(root.querySelectorAll("nav.top a"));
  var sections=links.map(function(a){return root.querySelector(a.getAttribute("href"))});
  function onScroll(){
    var cur=-1;
    sections.forEach(function(s,i){if(s&&s.getBoundingClientRect().top<=120)cur=i});
    links.forEach(function(a,i){a.classList.toggle("on",i===cur)});
  }
  ctx.on(window,"scroll",onScroll,{passive:true});onScroll();
})();
}
