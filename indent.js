/* Doiter indent form for the Claude chat (v15: no vendor; every product listed, scrolling; Doiter colours).
   The chat writes only the data, as JSON in <script type="application/json" id="doiter-indent-data">,
   then one <script src> for this file. The data looks like:
     { items:   [["61260","Air bubble cover 10x13","NOS"], ...],
       depts:   ["Maintenance", ...], dept: "Maintenance" }
   It draws into <div id="doiter-indent"> and on "Raise indent" sends one sentence to the chat
   with sendPrompt(). No business data lives in this file. */
(function () {
  // The data comes in <script type="application/json" id="doiter-indent-data">, which exists before
  // any script runs, so it doesn't matter whether this file loads before or after the chat's own script.
  var root = document.getElementById("doiter-indent"), D = window.DOITER_INDENT || {};
  var dataEl = document.getElementById("doiter-indent-data");
  if (dataEl) { try { D = JSON.parse(dataEl.textContent); } catch (e) { D = {}; } }
  if (!root) return;
  var items = D.items || [], depts = D.depts || ["Maintenance"];
  var dept = D.dept || depts[0], Q = {};

  // Colour (v15): Doiter red for the header, step numbers and the Raise button; one hue per department; a green tint
  // on ticked products. Mid-tone hues on see-through tints, so they read on the chat's light and dark backgrounds.
  var css = ".di-w{--di-red:#e0453e;--di-redbg:rgba(224,69,62,.12);--di-ok:#2f9e5b;--di-okbg:rgba(47,158,91,.12)}"
    + ".di-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:12px;background:var(--di-redbg)}"
    + ".di-hd b{font-size:16px;font-weight:500;color:var(--di-red)}.di-hd span{font-size:12px;color:var(--text-secondary)}"
    + ".di-r{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:.5px solid var(--border);font-size:14px}"
    + ".di-r:last-child{border-bottom:0}.di-r.on{background:var(--di-okbg)}.di-r input[type=checkbox]{accent-color:var(--di-ok)}"
    + ".di-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px;max-height:300px;overflow-y:auto}"
    + ".di-l{font-size:13px;font-weight:500;color:var(--text-primary);margin:0 0 6px;display:flex;align-items:center;gap:8px}"
    + ".di-n{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--di-red);color:#fff;font-size:11px;font-weight:500}"
    + ".di-c{font-family:var(--font-mono);font-size:13px;color:var(--di-red)}"
    + ".di-m{font-size:12px;color:var(--text-muted)}.di-p{font-size:13px;padding:6px 12px;border-radius:999px;"
    + "border:1px solid var(--hue);background:transparent;cursor:pointer;color:var(--text-primary)}"
    + ".di-p[aria-pressed=true]{background:var(--hue);color:#fff;border-color:var(--hue)}"
    + ".di-go{background:var(--di-red);color:#fff;border:1px solid var(--di-red);border-radius:var(--radius);padding:8px 16px;font-weight:500;cursor:pointer}"
    + ".di-go:hover{filter:brightness(1.08)}.di-sum{font-size:12px;padding:3px 10px;border-radius:999px;background:var(--di-okbg);color:var(--di-ok)}"
    + ".di-s{position:relative}.di-s i{position:absolute;left:10px;top:9px;font-size:16px;color:var(--text-muted)}"
    + ".di-s input{width:100%;padding-left:34px !important;box-sizing:border-box}";
  var HUE = { maintenance: "#e07b2e", production: "#3b7dd8", stores: "#1f9a8f", purchase: "#8a5cd6", accounts: "#2f9e5b", admin: "#7a7f8c", quality: "#d4498a" };
  var hue = function (d) { return HUE[String(d).toLowerCase()] || "#3b7dd8"; };
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  root.innerHTML =
    '<div class="di-w" style="display:grid;gap:18px;padding:.5rem 0">'
    + '<div class="di-hd"><b>Raise an indent</b><span>' + items.length + ' products · ' + depts.length + ' departments</span></div>'
    + '<div><p class="di-l"><span class="di-n">1</span>Products</p>'
    + '<div class="di-s"><i class="ti ti-search" aria-hidden="true"></i><input id="di-pq" placeholder="Type part of a product name, like bubb, shoe, hose" aria-label="Search products"></div>'
    + '<div id="di-pl" class="di-L"></div><p id="di-er" style="font-size:13px;color:var(--text-danger);margin:6px 0 0"></p></div>'
    + '<div><p class="di-l"><span class="di-n">2</span>Department</p><div id="di-dl" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>'
    + '<div><p class="di-l"><span class="di-n">3</span>When</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end">'
    + '<label style="display:grid;gap:6px"><span style="font-size:13px;color:var(--text-secondary)">Needed by (optional)</span><input id="di-du" type="date"></label>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input id="di-sd" type="checkbox" checked style="accent-color:var(--di-ok)"> Send for approval now</label></div></div>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button type="button" id="di-go" class="di-go">Raise indent ↗</button>'
    + '<span id="di-sum" class="di-sum"></span></div></div>';

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  // a word may be typed in part ("bubb"), with a letter missing ("safty") or as a short form ("cvr")
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };

  function drawP() {
    var pool = items;
    var q = $("di-pq").value;
    var rows = pool.filter(function (it) { return (it[0] in Q) || hit(q, it[0] + " " + it[1]); });
    $("di-pl").innerHTML = rows.map(function (it) {
      var on = it[0] in Q;
      return '<div class="di-r' + (on ? " on" : "") + '"><input type="checkbox" data-k="' + esc(it[0]) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(it[1]) + '">'
        + '<span style="flex:1;min-width:0"><span class="di-c">' + esc(it[0]) + "</span> · " + esc(it[1]) + "</span>"
        + (on ? '<input type="number" min="0" step="any" placeholder="Qty" data-q="' + esc(it[0]) + '" value="' + esc(Q[it[0]]) + '" style="width:84px" aria-label="Quantity of ' + esc(it[0]) + '"><span class="di-m" style="width:32px">' + esc(it[2]) + "</span>" : "")
        + "</div>";
    }).join("") || '<div class="di-r di-m">' + "No product matches. Try fewer letters." + "</div>";
    root.querySelectorAll("[data-k]").forEach(function (c) {
      c.onchange = function () {
        var k = c.getAttribute("data-k");
        if (c.checked) Q[k] = ""; else delete Q[k];
        $("di-er").textContent = ""; drawP(); sum();
        var x = root.querySelector('[data-q="' + k + '"]'); if (x) x.focus();
      };
    });
    root.querySelectorAll("[data-q]").forEach(function (x) { x.oninput = function () { Q[x.getAttribute("data-q")] = x.value; $("di-er").textContent = ""; }; });
  }
  function drawD() {
    $("di-dl").innerHTML = depts.map(function (x) { return '<button type="button" class="di-p" style="--hue:' + hue(x) + '" aria-pressed="' + (x === dept) + '">' + esc(x) + "</button>"; }).join("");
    $("di-dl").querySelectorAll("button").forEach(function (b) { b.onclick = function () { dept = b.textContent; drawD(); sum(); }; });
  }
  function sum() { $("di-sum").textContent = plural(Object.keys(Q).length, "product") + " · " + dept; }

  $("di-pq").oninput = drawP;
  $("di-go").onclick = function () {
    var K = Object.keys(Q);
    if (!K.length) { $("di-er").textContent = "Tick at least one product."; return; }
    var bad = K.filter(function (k) { return !(Number(Q[k]) > 0); });
    if (bad.length) { $("di-er").textContent = "Enter a quantity for " + bad.join(", ") + "."; return; }
    var u = $("di-du").value;
    sendPrompt("raise an indent for " + K.map(function (k) { return Number(Q[k]) + " " + k; }).join(", ") + " for " + dept
      + (u ? ", needed by " + u.split("-").reverse().join("/") : "")
      + ($("di-sd").checked ? ", and send it for approval" : ""));
  };
  drawP(); drawD(); sum();
})();
