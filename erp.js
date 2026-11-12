/* Doiter ERP screens for the Claude chat: one engine draws every screen that has no form of its own
   (approvals, indents, quotes, job orders, QC checks, delivery challans, issues, returns, stock, vendors, items, dashboard).
   The chat writes only the data, as JSON in <script type="application/json" id="doiter-erp-data">, then one
   <script src> for this file. Buttons send one sentence back to the chat with sendPrompt(). No business data lives here.

   Data: { sections: [ section, ... ] }
     { t:"tiles", items:[[label, value, note]] }
     { t:"nav", items:[[label, sentence]] }
     { t:"list", title, cols:[[key, label, fmt]] (fmt: "m" money, "n" number, "r" right, "b" badge),
       rows:[{ key: value, ..., _s: status, _d: { f:[[label, value]], lc:[labels], lr:[[cells]] }, _a:[[label, sentence, askLabel]] }],
       filter:{ def, opts:[[status, label]] }, search: placeholder, top:[[label, sentence]], empty }
     { t:"form", title, head: sentence start, send: button label,
       fields:[{ k, l, type: text|number|date|area|select|pick|chips|check, o:[[value, label]] or { byValue: [[value,label]] },
                 by: other field key (o is a map), def, req, ph, show:[key, value] }],
       lines:{ l, items:{ code:[name, uom, hint] }, by: field key, map:{ value:[[code, qty, rate]] }, all: true,
               cols:[{ k, l, type: number|text|select, o, req, def: index into map row }], free: true (typed rows) }, hid: true (drawn only when opened) }
   A list's top button [label, sentence, formIndex] or a row action [label, sentence, null, formIndex, {field: value, _head, _title}]
   opens that hidden form in place (values prefill it), with a Back button; without a formIndex the sentence goes to the chat.   */
(function () {
  var root = document.getElementById("doiter-erp"), D = {};
  var dataEl = document.getElementById("doiter-erp-data");
  if (dataEl) { try { D = JSON.parse(dataEl.textContent); } catch (e) { D = {}; } }
  if (!root) return;

  var css = ".de-w{display:grid;gap:20px;padding:.5rem 0;font-size:14px}"
    + ".de-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px;max-height:340px;overflow-y:auto}"
    + ".de-r{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:.5px solid var(--border)}.de-r:last-child{border-bottom:0}"
    + ".de-l{font-size:13px;color:var(--text-secondary);margin:0 0 6px}.de-h{font-size:16px;font-weight:500;margin:0 0 8px}"
    + ".de-c{font-family:var(--font-mono);font-size:13px}.de-m{font-size:12px;color:var(--text-muted)}"
    + ".de-p{font-size:13px;padding:5px 11px;border-radius:999px;border:.5px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-primary)}"
    + ".de-p[aria-pressed=true]{background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)}"
    + ".de-s{position:relative}.de-s i{position:absolute;left:10px;top:9px;font-size:16px;color:var(--text-muted)}"
    + ".de-s input{width:100%;padding-left:34px !important;box-sizing:border-box}"
    + ".de-b{font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap;background:var(--surface-1);color:var(--text-secondary)}"
    + ".de-b.ok{background:var(--bg-success);color:var(--text-success)}.de-b.wait{background:var(--bg-warning);color:var(--text-warning)}"
    + ".de-b.no{background:var(--bg-danger);color:var(--text-danger)}.de-b.info{background:var(--bg-accent);color:var(--text-accent)}"
    + ".de-t{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}"
    + ".de-tile{border:.5px solid var(--border);border-radius:12px;padding:12px}.de-tile b{display:block;font-size:20px;font-weight:500}"
    + ".de-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}"
    + ".de-g label{display:grid;gap:4px}.de-g input,.de-g select,.de-g textarea{width:100%;box-sizing:border-box}"
    + ".de-d{padding:8px 12px 12px 34px;background:var(--surface-1);border-bottom:.5px solid var(--border);font-size:13px}"
    + ".de-d table{width:100%;border-collapse:collapse;margin-top:6px}.de-d td,.de-d th{padding:4px 6px;text-align:left;border-bottom:.5px solid var(--border);font-weight:400}"
    + ".de-d th{color:var(--text-muted);font-size:12px}.de-e{font-size:13px;color:var(--text-danger);margin:6px 0 0}"
    + ".de-k{cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };
  var money = function (n) { n = Number(n || 0); return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var num = function (n) { return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 }); };
  var dmy = function (s) { s = String(s || ""); return /^\d{4}-\d\d-\d\d$/.test(s) ? s.split("-").reverse().join("/") : s; };
  var label = function (s) { s = String(s || "").replace(/_/g, " ").toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
  var tone = function (s) {
    s = String(s || "").toUpperCase();
    if (/PENDING|WAIT|DRAFT|PART/.test(s)) return /DRAFT/.test(s) ? "" : "wait";
    if (/REJECT|CANCEL|FAIL|BLOCK|SCRAP|DAMAGED|OVERDUE/.test(s)) return "no";
    if (/APPROV|CONFIRM|POSTED|ISSUED|CLOSED|PASS|ACTIVE|DESPATCH|CONVERT|ORDERED|GOOD|RETURNED/.test(s)) return "ok";
    return "info";
  };
  var badge = function (s) { return '<span class="de-b ' + tone(s) + '">' + esc(label(s)) + "</span>"; };
  var send = function (s) { if (typeof sendPrompt === "function") sendPrompt(s); };
  var el = function (h) { var d = document.createElement("div"); d.innerHTML = h; return d; };

  var wrap = el('<div class="de-w"></div>').firstChild;
  root.appendChild(wrap);
  var SEC = D.sections || [], BOX = [];
  var draw1 = function (box, s, i, vals) {
    try { ({ tiles: tiles, nav: nav, list: list, form: form }[s.t] || function () {})(box, s, i, vals); }
    catch (e) { box.innerHTML = '<p class="de-e">This part could not be drawn: ' + esc(e.message) + "</p>"; }
  };
  SEC.forEach(function (s, i) {
    var box = document.createElement("div"); wrap.appendChild(box); BOX.push(box);
    if (s.hid) box.style.display = "none"; else draw1(box, s, i);
  });
  // A "+ New" button or a row's Edit opens a form shipped with the list, in place: no chat message.
  function go(i, vals) {
    BOX.forEach(function (b, j) { b.style.display = j === i ? "" : "none"; });
    draw1(BOX[i], SEC[i], i, vals || null);
    try { BOX[i].scrollIntoView({ block: "start" }); } catch (e) {}
  }
  function back() { BOX.forEach(function (b, j) { b.style.display = SEC[j].hid ? "none" : ""; }); }

  function tiles(box, s) {
    box.innerHTML = (s.title ? '<p class="de-h">' + esc(s.title) + "</p>" : "") + '<div class="de-t">' + (s.items || []).map(function (t) {
      return '<div class="de-tile"><span class="de-m">' + esc(t[0]) + "</span><b>" + esc(t[1]) + "</b>" + (t[2] ? '<span class="de-m">' + esc(t[2]) + "</span>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function nav(box, s) {
    box.innerHTML = (s.title ? '<p class="de-l">' + esc(s.title) + "</p>" : "") + '<div style="display:flex;flex-wrap:wrap;gap:8px">'
      + (s.items || []).map(function (b, i) { return '<button type="button" class="de-p" data-n="' + i + '">' + esc(b[0]) + "</button>"; }).join("") + "</div>";
    box.querySelectorAll("[data-n]").forEach(function (b) { b.onclick = function () { send(s.items[+b.getAttribute("data-n")][1]); }; });
  }

  function list(box, s, si) {
    var rows = s.rows || [], cols = s.cols || [], f = s.filter, cur = f ? f.def || "ALL" : "ALL", open = {}, ask = {};
    var counts = {}; rows.forEach(function (r) { counts[r._s] = (counts[r._s] || 0) + 1; });
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
      + (s.title ? '<p class="de-h">' + esc(s.title) + "</p>" : "<span></span>")
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (s.top || []).map(function (b, i) { return '<button type="button" data-top="' + i + '">' + esc(b[0]) + "</button>"; }).join("") + "</div></div>"
      + (f ? '<div class="fl" style="display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px"></div>' : "")
      + (s.search !== false ? '<div class="de-s"><i class="ti ti-search" aria-hidden="true"></i><input class="q" placeholder="' + esc(s.search || "Search") + '" aria-label="Search"></div>' : "")
      + '<div class="de-L body"></div>';
    var q = box.querySelector(".q"), body = box.querySelector(".body"), fl = box.querySelector(".fl");
    box.querySelectorAll("[data-top]").forEach(function (b) { b.onclick = function () { var t = s.top[+b.getAttribute("data-top")]; if (typeof t[2] === "number") go(t[2]); else send(t[1]); }; });
    function drawF() {
      if (!fl) return;
      var opts = f.opts.concat([["ALL", "All"]]);
      fl.innerHTML = opts.map(function (o) {
        var n = o[0] === "ALL" ? rows.length : o[0].split("|").reduce(function (a, k) { return a + (counts[k] || 0); }, 0);
        return '<button type="button" class="de-p" data-f="' + esc(o[0]) + '" aria-pressed="' + (o[0] === cur) + '">' + esc(o[1]) + " · " + n + "</button>";
      }).join("");
      fl.querySelectorAll("[data-f]").forEach(function (b) { b.onclick = function () { cur = b.getAttribute("data-f"); drawF(); draw(); }; });
    }
    function cell(r, c) {
      var v = r[c[0]];
      if (c[2] === "m") return '<span style="white-space:nowrap">' + money(v) + "</span>";
      if (c[2] === "n") return num(v);
      if (c[2] === "b") return badge(v);
      return esc(dmy(v));
    }
    function draw() {
      var qs = q ? q.value : "", keys = cur === "ALL" ? null : cur.split("|");
      var vis = rows.filter(function (r) { return (!keys || keys.indexOf(r._s) >= 0) && hit(qs, cols.map(function (c) { return r[c[0]]; }).join(" ")); });
      body.innerHTML = vis.map(function (r) {
        var id = rows.indexOf(r), d = r._d, a = r._a || [];
        var h = '<div class="de-r" style="flex-wrap:wrap">'
          + cols.map(function (c, ci) {
            var inner = cell(r, c);
            if (ci === 0 && d) inner = '<span class="de-k de-c" data-o="' + id + '">' + inner + "</span>";
            else if (ci === 0) inner = '<span class="de-c">' + inner + "</span>";
            return '<span style="' + (ci === 1 ? "flex:1;min-width:120px" : "") + (c[2] === "m" || c[2] === "n" || c[2] === "r" ? ";text-align:right" : "") + '">' + inner + "</span>";
          }).join("")
          + a.map(function (b, bi) { return '<button type="button" style="font-size:13px;padding:4px 10px" data-a="' + id + ":" + bi + '">' + esc(b[0]) + "</button>"; }).join("")
          + "</div>";
        if (ask[id]) {
          var b = a[ask[id]];
          h += '<div class="de-d" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="ask" data-i="' + id + '" placeholder="' + esc(b[2]) + '" style="flex:1;min-width:180px">'
            + '<button type="button" data-ok="' + id + '">' + esc(b[0]) + ' ↗</button><button type="button" data-no="' + id + '">Cancel</button><span class="de-e" data-er="' + id + '"></span></div>';
        }
        if (open[id] && d) {
          h += '<div class="de-d">' + (d.f || []).filter(function (x) { return x[1] !== "" && x[1] != null; }).map(function (x) { return '<span class="de-m">' + esc(x[0]) + ":</span> " + esc(dmy(x[1])); }).join(" · ")
            + (d.lc ? "<table><tr>" + d.lc.map(function (x) { return "<th>" + esc(x) + "</th>"; }).join("") + "</tr>"
              + (d.lr || []).map(function (lr) { return "<tr>" + lr.map(function (x) { return "<td>" + esc(typeof x === "number" ? num(x) : dmy(x)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>" : "")
            + "</div>";
        }
        return h;
      }).join("") || '<div class="de-r de-m">' + esc(s.empty || "Nothing here") + "</div>";
      body.querySelectorAll("[data-o]").forEach(function (x) { x.onclick = function () { var i = x.getAttribute("data-o"); open[i] = !open[i]; draw(); }; });
      body.querySelectorAll("[data-a]").forEach(function (x) {
        x.onclick = function () {
          var p = x.getAttribute("data-a").split(":"), b = rows[+p[0]]._a[+p[1]];
          if (typeof b[3] === "number") go(b[3], b[4]);
          else if (b[2]) { ask[p[0]] = +p[1]; draw(); var inp = body.querySelector('.ask[data-i="' + p[0] + '"]'); if (inp) inp.focus(); }
          else send(b[1]);
        };
      });
      body.querySelectorAll("[data-no]").forEach(function (x) { x.onclick = function () { delete ask[x.getAttribute("data-no")]; draw(); }; });
      body.querySelectorAll("[data-ok]").forEach(function (x) {
        x.onclick = function () {
          var i = x.getAttribute("data-ok"), b = rows[+i]._a[ask[i]], v = body.querySelector('.ask[data-i="' + i + '"]').value.trim();
          if (!v) { body.querySelector('[data-er="' + i + '"]').textContent = "Enter " + b[2].toLowerCase() + " first."; return; }
          send(b[1].replace("{}", v));
        };
      });
    }
    if (q) q.oninput = draw;
    drawF(); draw();
  }

  function form(box, s, si, vals) {
    if (vals) s = Object.assign({}, s, { head: vals._head || s.head, title: vals._title || s.title,
      fields: (s.fields || []).map(function (f) { return f.k in vals ? Object.assign({}, f, { def: vals[f.k] }) : f; }) });
    var F = s.fields || [], LN = s.lines, V = {}, Q = {}, R = [], P = "f" + si + "-";
    F.forEach(function (f) { V[f.k] = f.def != null ? f.def : f.type === "check" ? false : ""; });
    var opts = function (f) { return Array.isArray(f.o) ? f.o : (f.o && f.o[V[f.by]]) || []; };
    box.innerHTML = (s.title ? '<p class="de-h">' + esc(s.title) + "</p>" : "") + '<div class="flds" style="display:grid;gap:14px"></div>'
      + (LN ? '<div style="margin-top:14px"><p class="de-l">' + esc(LN.l || "Items") + "</p>"
        + (LN.free ? "" : '<div class="de-s"><i class="ti ti-search" aria-hidden="true"></i><input class="lq" placeholder="Type part of a product name or code" aria-label="Search products"></div>')
        + '<div class="de-L lines"></div>' + (LN.free ? '<button type="button" class="addr" style="margin-top:8px">+ Add line</button>' : "") + "</div>" : "")
      + '<p class="de-e err"></p><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px"><button type="button" class="go">' + esc(s.send || "Save") + ' ↗</button>'
      + (s.hid ? '<button type="button" class="bk">← Back to the list</button>' : "") + '<span class="de-m sum"></span></div>';
    if (s.hid) box.querySelector(".bk").onclick = back;
    var fl = box.querySelector(".flds"), lq = box.querySelector(".lq"), lines = box.querySelector(".lines"), err = box.querySelector(".err");
    function visible(f) { return !f.show || String(V[f.show[0]]) === String(f.show[1]); }
    function drawFields() {
      var simple = [], h = "";
      F.forEach(function (f) {
        if (!visible(f)) return;
        var id = P + f.k, lab = esc(f.l) + (f.req ? "" : ' <span class="de-m">(optional)</span>');
        if (f.type === "pick") {
          h += '<div><p class="de-l">' + lab + '</p><div class="de-s"><i class="ti ti-search" aria-hidden="true"></i><input data-pq="' + f.k + '" placeholder="Type part of a name or code" aria-label="Search ' + esc(f.l) + '"></div><div class="de-L" data-pl="' + f.k + '" style="max-height:200px"></div></div>';
        } else if (f.type === "chips") {
          h += '<div><p class="de-l">' + lab + '</p><div style="display:flex;flex-wrap:wrap;gap:8px">' + opts(f).map(function (o) {
            return '<button type="button" class="de-p" data-ch="' + f.k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (String(V[f.k]) === String(o[0])) + '">' + esc(o[1]) + "</button>";
          }).join("") + "</div></div>";
        } else simple.push(f);
      });
      h += '<div class="de-g">' + simple.map(function (f) {
        var id = P + f.k, lab = '<span class="de-l" style="margin:0">' + esc(f.l) + (f.req || f.type === "check" ? "" : " (optional)") + "</span>";
        if (f.type === "check") return '<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="' + f.k + '"' + (V[f.k] ? " checked" : "") + "> " + esc(f.l) + "</label>";
        if (f.type === "select") return "<label>" + lab + '<select data-k="' + f.k + '"><option value="">Choose…</option>' + opts(f).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(V[f.k]) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></label>";
        if (f.type === "area") return '<label style="grid-column:1/-1">' + lab + '<textarea data-k="' + f.k + '" rows="2" placeholder="' + esc(f.ph || "") + '">' + esc(V[f.k]) + "</textarea></label>";
        return "<label>" + lab + '<input data-k="' + f.k + '" type="' + (f.type === "number" ? "number" : f.type === "date" ? "date" : "text") + '"' + (f.type === "number" ? ' step="any" min="0"' : "") + ' value="' + esc(V[f.k]) + '" placeholder="' + esc(f.ph || "") + '"></label>';
      }).join("") + "</div>";
      fl.innerHTML = h;
      F.forEach(function (f) { if (f.type === "pick" && visible(f)) drawPick(f); });
      fl.querySelectorAll("[data-k]").forEach(function (x) {
        var f = F.filter(function (g) { return g.k === x.getAttribute("data-k"); })[0];
        x.oninput = x.onchange = function () {
          var old = V[f.k]; V[f.k] = x.type === "checkbox" ? x.checked : x.value; err.textContent = "";
          if (x.type === "checkbox" || x.tagName === "SELECT") { if (old !== V[f.k]) changed(f.k); } else sum();
        };
      });
      fl.querySelectorAll("[data-ch]").forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-ch"); V[k] = b.getAttribute("data-v"); changed(k); }; });
      fl.querySelectorAll("[data-pq]").forEach(function (x) { x.oninput = function () { drawPick(F.filter(function (g) { return g.k === x.getAttribute("data-pq"); })[0]); }; });
    }
    function drawPick(f) {
      var q = fl.querySelector('[data-pq="' + f.k + '"]').value, pl = fl.querySelector('[data-pl="' + f.k + '"]');
      var rows = opts(f).filter(function (o) { return String(o[0]) === String(V[f.k]) || hit(q, o[0] + " " + o[1]); });
      pl.innerHTML = rows.slice(0, 300).map(function (o) {
        return '<label class="de-r" style="cursor:pointer"><input type="radio" name="' + P + f.k + '" value="' + esc(o[0]) + '"' + (String(o[0]) === String(V[f.k]) ? " checked" : "") + '><span style="flex:1"><span class="de-c">' + esc(o[0]) + "</span> · " + esc(o[1]) + "</span>" + (o[2] ? '<span class="de-m">' + esc(o[2]) + "</span>" : "") + "</label>";
      }).join("") || '<div class="de-r de-m">No match</div>';
      pl.querySelectorAll("input").forEach(function (r) { r.onchange = function () { V[f.k] = r.value; err.textContent = ""; changed(f.k); }; });
    }
    function changed(k) {
      F.forEach(function (f) { if (f.by === k && opts(f).every(function (o) { return String(o[0]) !== String(V[f.k]); })) V[f.k] = ""; });
      if (LN && LN.by && (LN.by === k || F.some(function (f) { return f.by === k && f.k === LN.by; }))) { Q = {}; preset(); }
      drawFields(); drawLines(); sum();
    }
    function pool() {
      if (!LN || LN.free) return [];
      var it = function (c) { var x = LN.items[c] || []; return [c, x[0] || "", x[1] || "", x[2] || ""]; };
      if (LN.by && !LN.all) { var m = (LN.map || {})[V[LN.by]] || []; return m.map(function (r) { return it(r[0]).concat([r]); }); }
      return Object.keys(LN.items).map(function (c) { return it(c).concat([[c]]); });
    }
    function preset() {
      if (!LN || !LN.by || !LN.tick) return;
      pool().forEach(function (p) { Q[p[0]] = rowVals(p); });
    }
    function rowVals(p) { var v = {}; (LN.cols || []).forEach(function (c) { v[c.k] = c.def != null && p[4] && p[4][c.def] != null ? p[4][c.def] : c.dv != null ? c.dv : ""; }); return v; }
    function inputFor(c, val, attr) {
      if (c.type === "select") return '<select ' + attr + ' aria-label="' + esc(c.l) + '"><option value="">' + esc(c.l) + "</option>" + (c.o || []).map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(val) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
      return '<input ' + attr + ' type="' + (c.type === "text" ? "text" : "number") + '"' + (c.type === "text" ? "" : ' min="0" step="any"') + ' placeholder="' + esc(c.l) + '" value="' + esc(val) + '" style="width:' + (c.type === "text" ? "100%" : "86px") + '" aria-label="' + esc(c.l) + '">';
    }
    function drawLines() {
      if (!LN) return;
      if (LN.free) {
        lines.innerHTML = R.map(function (r, i) {
          return '<div class="de-r" style="flex-wrap:wrap">' + LN.cols.map(function (c) { return '<span style="' + (c.type === "text" ? "flex:1;min-width:160px" : "") + '">' + inputFor(c, r[c.k], 'data-fr="' + i + ":" + c.k + '"') + "</span>"; }).join("")
            + '<button type="button" data-del="' + i + '" aria-label="Remove line" style="padding:4px 8px"><i class="ti ti-x" aria-hidden="true"></i></button></div>';
        }).join("") || '<div class="de-r de-m">No lines yet. Use + Add line.</div>';
        lines.querySelectorAll("[data-fr]").forEach(function (x) { x.oninput = x.onchange = function () { var p = x.getAttribute("data-fr").split(":"); R[+p[0]][p[1]] = x.value; err.textContent = ""; }; });
        lines.querySelectorAll("[data-del]").forEach(function (x) { x.onclick = function () { R.splice(+x.getAttribute("data-del"), 1); drawLines(); sum(); }; });
        return;
      }
      var q = lq ? lq.value : "", P0 = pool();
      if (LN.by && !V[LN.by]) { lines.innerHTML = '<div class="de-r de-m">Choose ' + esc((F.filter(function (f) { return f.k === LN.by; })[0] || {}).l || "above").toLowerCase() + " first.</div>"; return; }
      var rows = P0.filter(function (p) { return (p[0] in Q) || hit(q, p[0] + " " + p[1]); });
      lines.innerHTML = rows.slice(0, 300).map(function (p) {
        var on = p[0] in Q;
        return '<div class="de-r" style="flex-wrap:wrap"><input type="checkbox" data-t="' + esc(p[0]) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(p[1]) + '">'
          + '<span style="flex:1;min-width:160px"><span class="de-c">' + esc(p[0]) + "</span> · " + esc(p[1]) + (p[3] ? ' <span class="de-m">' + esc(p[3]) + "</span>" : "") + "</span>"
          + (on ? LN.cols.map(function (c) { return inputFor(c, Q[p[0]][c.k], 'data-lv="' + esc(p[0]) + ":" + c.k + '"'); }).join("") + '<span class="de-m" style="min-width:28px">' + esc(p[2]) + "</span>" : "")
          + "</div>";
      }).join("") || '<div class="de-r de-m">' + (P0.length ? "No product matches. Try fewer letters." : "Nothing to pick here.") + "</div>";
      lines.querySelectorAll("[data-t]").forEach(function (c) {
        c.onchange = function () {
          var k = c.getAttribute("data-t"), p = P0.filter(function (x) { return x[0] === k; })[0];
          if (c.checked) Q[k] = rowVals(p); else delete Q[k];
          err.textContent = ""; drawLines(); sum();
          var x = lines.querySelector('[data-lv^="' + k + ':"]'); if (x) x.focus();
        };
      });
      lines.querySelectorAll("[data-lv]").forEach(function (x) { x.oninput = x.onchange = function () { var p = x.getAttribute("data-lv").split(":"); Q[p[0]][p[1]] = x.value; err.textContent = ""; }; });
    }
    function sum() {
      var n = LN ? (LN.free ? R.length : Object.keys(Q).length) : 0;
      box.querySelector(".sum").textContent = LN ? n + " line" + (n === 1 ? "" : "s") : "";
    }
    if (lq) lq.oninput = drawLines;
    var addr = box.querySelector(".addr");
    if (addr) addr.onclick = function () { var r = {}; LN.cols.forEach(function (c) { r[c.k] = c.dv != null ? c.dv : ""; }); R.push(r); drawLines(); sum(); };
    box.querySelector(".go").onclick = function () {
      var miss = F.filter(function (f) { return visible(f) && f.req && (V[f.k] === "" || V[f.k] == null); });
      if (miss.length) { err.textContent = "Fill in " + miss.map(function (f) { return f.l.toLowerCase(); }).join(", ") + "."; return; }
      var L = [];
      if (LN) {
        var src = LN.free ? R.map(function (r) { return [null, r]; }) : Object.keys(Q).map(function (k) { return [k, Q[k]]; });
        if (!src.length && LN.req !== false) { err.textContent = LN.free ? "Add at least one line." : "Tick at least one product."; return; }
        for (var i = 0; i < src.length; i++) {
          var bad = LN.cols.filter(function (c) { return c.req && !(c.type === "text" || c.type === "select" ? String(src[i][1][c.k] || "").trim() : Number(src[i][1][c.k]) > 0); });
          if (bad.length) { err.textContent = "Enter " + bad.map(function (c) { return c.l.toLowerCase(); }).join(" and ") + (src[i][0] ? " for " + src[i][0] : " on line " + (i + 1)) + "."; return; }
          L.push((src[i][0] ? src[i][0] + " " : "") + LN.cols.filter(function (c) { return String(src[i][1][c.k] || "").trim() !== ""; }).map(function (c) { return c.l.toLowerCase() + " " + String(src[i][1][c.k]).trim(); }).join(", "));
        }
      }
      var keep = function (f) {
        if (!visible(f)) return false;
        if (s.changed) return String(V[f.k] == null ? "" : V[f.k]) !== String(f.def == null ? "" : f.def);
        return V[f.k] !== "" && V[f.k] != null && V[f.k] !== false;
      };
      if (s.changed && !F.some(keep)) { err.textContent = "Nothing has been changed yet."; return; }
      var parts = F.filter(keep).map(function (f) {
        if (s.changed && (V[f.k] === "" || V[f.k] === false)) return f.l.toLowerCase() + ": " + (f.type === "check" ? "no" : "clear it");
        if (f.type === "check") return f.l.toLowerCase();
        var o = (f.type === "select" || f.type === "chips" || f.type === "pick") && opts(f).filter(function (x) { return String(x[0]) === String(V[f.k]); })[0];
        var v = f.type === "date" ? dmy(V[f.k]) : o && String(o[1]) !== String(o[0]) && f.type === "pick" ? o[0] + " " + o[1] : o ? o[0] : V[f.k];
        return f.l.toLowerCase() + ": " + v;
      });
      send(s.head + (parts.length ? " — " + parts.join("; ") : "") + (L.length ? "; lines: " + L.join(" | ") : ""));
    };
    preset(); drawFields(); drawLines(); sum();
  }
})();
