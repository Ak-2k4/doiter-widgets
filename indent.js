/* Doiter indent form for the Claude chat (v3: vendor list inside the form).
   The chat writes only the data, as JSON in <script type="application/json" id="doiter-indent-data">,
   then one <script src> for this file. The data looks like:
     { vendors: [["V035","Vishwak Packaging"], ...],
       items:   [["61260","Air bubble cover 10x13","NOS"], ...],
       vp:      { V035: ["61260", ...], ... },          // which vendor supplies which products
       depts:   ["Maintenance", ...], vendor: "A058", dept: "Maintenance" }
   It draws into <div id="doiter-indent"> and on "Raise indent" sends one sentence to the chat
   with sendPrompt(). No business data lives in this file. */
(function () {
  // The data comes in <script type="application/json" id="doiter-indent-data">, which exists before
  // any script runs, so it doesn't matter whether this file loads before or after the chat's own script.
  var root = document.getElementById("doiter-indent"), D = window.DOITER_INDENT || {};
  var dataEl = document.getElementById("doiter-indent-data");
  if (dataEl) { try { D = JSON.parse(dataEl.textContent); } catch (e) { D = {}; } }
  if (!root) return;
  var vendors = D.vendors || [], items = D.items || [], vp = D.vp || {}, depts = D.depts || ["Maintenance"];
  var vendor = D.vendor || (vendors[0] || [""])[0], dept = D.dept || depts[0], showAll = false, Q = {};

  var css = ".di-r{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:.5px solid var(--border);font-size:14px}"
    + ".di-r:last-child{border-bottom:0}.di-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px}"
    + ".di-l{font-size:13px;color:var(--text-secondary);margin:0 0 6px}.di-c{font-family:var(--font-mono);font-size:13px}"
    + ".di-m{font-size:12px;color:var(--text-muted)}.di-p{font-size:13px;padding:6px 12px;border-radius:999px;"
    + "border:.5px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-primary)}"
    + ".di-p[aria-pressed=true]{background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)}"
    + ".di-s{position:relative}.di-s i{position:absolute;left:10px;top:9px;font-size:16px;color:var(--text-muted)}"
    + ".di-s input{width:100%;padding-left:34px !important;box-sizing:border-box}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  root.innerHTML =
    '<div style="display:grid;gap:18px;padding:.5rem 0">'
    + '<div><p class="di-l">Vendor (preferred)</p>'
    + '<div class="di-s"><i class="ti ti-search" aria-hidden="true"></i><input id="di-vq" placeholder="Type part of a vendor name or code" aria-label="Search vendors"></div>'
    + '<div id="di-vl" class="di-L"></div></div>'
    + '<div><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap">'
    + '<p class="di-l" id="di-pt"></p><button type="button" id="di-tg"></button></div>'
    + '<div class="di-s"><i class="ti ti-search" aria-hidden="true"></i><input id="di-pq" placeholder="Type part of a product name, like bubb, shoe, hose" aria-label="Search products"></div>'
    + '<div id="di-pl" class="di-L"></div><p id="di-er" style="font-size:13px;color:var(--text-danger);margin:6px 0 0"></p></div>'
    + '<div><p class="di-l">Department</p><div id="di-dl" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end">'
    + '<label style="display:grid;gap:6px"><span class="di-l" style="margin:0">Needed by (optional)</span><input id="di-du" type="date"></label>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input id="di-sd" type="checkbox" checked> Send for approval now</label></div>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button type="button" id="di-go">Raise indent ↗</button>'
    + '<span id="di-sum" style="font-size:13px;color:var(--text-secondary)"></span></div></div>';

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  // a word may be typed in part ("bubb"), with a letter missing ("safty") or as a short form ("cvr")
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };
  var own = function (code) { return vp[code] || []; };
  var vname = function () { var v = vendors.filter(function (x) { return x[0] === vendor; })[0]; return v ? v[1] : ""; };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };

  function drawV() {
    var q = $("di-vq").value;
    var rows = vendors.filter(function (v) { return hit(q, v[0] + " " + v[1]); });
    $("di-vl").innerHTML = rows.map(function (v) {
      var n = own(v[0]).length;
      return '<label class="di-r" style="cursor:pointer"><input type="radio" name="di-v" value="' + esc(v[0]) + '"' + (v[0] === vendor ? " checked" : "") + ">"
        + '<span style="flex:1"><span class="di-c">' + esc(v[0]) + "</span> · " + esc(v[1]) + "</span>"
        + '<span class="di-m">' + (n ? plural(n, "product") : "no products yet") + "</span></label>";
    }).join("") || '<div class="di-r di-m">No vendor matches</div>';
    root.querySelectorAll("[name=di-v]").forEach(function (r) {
      r.onchange = function () {
        vendor = r.value; showAll = false;
        Object.keys(Q).forEach(function (k) { if (own(vendor).indexOf(k) < 0) delete Q[k]; });
        drawP(); sum();
      };
    });
  }
  function drawP() {
    $("di-pt").textContent = showAll ? "All products" : "Products from " + vname();
    $("di-tg").textContent = showAll ? "Only " + vname() + " products" : "Show all products";
    var pool = showAll ? items : items.filter(function (it) { return own(vendor).indexOf(it[0]) >= 0; });
    var q = $("di-pq").value;
    var rows = pool.filter(function (it) { return (it[0] in Q) || hit(q, it[0] + " " + it[1]); });
    $("di-pl").innerHTML = rows.map(function (it) {
      var on = it[0] in Q;
      return '<div class="di-r"><input type="checkbox" data-k="' + esc(it[0]) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(it[1]) + '">'
        + '<span style="flex:1;min-width:0"><span class="di-c">' + esc(it[0]) + "</span> · " + esc(it[1]) + "</span>"
        + (on ? '<input type="number" min="0" step="any" placeholder="Qty" data-q="' + esc(it[0]) + '" value="' + esc(Q[it[0]]) + '" style="width:84px" aria-label="Quantity of ' + esc(it[0]) + '"><span class="di-m" style="width:32px">' + esc(it[2]) + "</span>" : "")
        + "</div>";
    }).join("") || '<div class="di-r di-m">' + (pool.length ? "No product matches. Try fewer letters." : "No products on record for " + esc(vname()) + " yet. Use Show all products.") + "</div>";
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
    $("di-dl").innerHTML = depts.map(function (x) { return '<button type="button" class="di-p" aria-pressed="' + (x === dept) + '">' + esc(x) + "</button>"; }).join("");
    $("di-dl").querySelectorAll("button").forEach(function (b) { b.onclick = function () { dept = b.textContent; drawD(); sum(); }; });
  }
  function sum() { $("di-sum").textContent = plural(Object.keys(Q).length, "product") + " · " + dept + " · " + vendor; }

  $("di-vq").oninput = drawV;
  $("di-pq").oninput = drawP;
  $("di-tg").onclick = function () { showAll = !showAll; drawP(); };
  $("di-go").onclick = function () {
    var K = Object.keys(Q);
    if (!K.length) { $("di-er").textContent = "Tick at least one product."; return; }
    var bad = K.filter(function (k) { return !(Number(Q[k]) > 0); });
    if (bad.length) { $("di-er").textContent = "Enter a quantity for " + bad.join(", ") + "."; return; }
    var u = $("di-du").value;
    sendPrompt("raise an indent for " + K.map(function (k) { return Number(Q[k]) + " " + k; }).join(", ") + " for " + dept
      + (u ? ", needed by " + u.split("-").reverse().join("/") : "")
      + ", preferred vendor " + vendor + " " + vname()
      + ($("di-sd").checked ? ", and send it for approval" : ""));
  };
  drawV(); drawP(); drawD(); sum();
})();
