/* Doiter indent form for the Claude chat.
   The chat writes only the data, as window.DOITER_INDENT, plus one <script src> for this file:
     { vendor: ["V035", "Vishwak Packaging"],
       items:  [["61260", "Air bubble cover 10x13", "NOS"], ...],   // that vendor's products
       depts:  ["Maintenance", "Production", ...], dept: "Maintenance" }
   It draws the form into <div id="doiter-indent"> and, on "Raise indent",
   sends one sentence back to the chat with sendPrompt(). No business data lives here. */
(function () {
  var D = window.DOITER_INDENT || {}, root = document.getElementById("doiter-indent");
  if (!root) return;
  var vendor = D.vendor || ["", ""], items = D.items || [], depts = D.depts || ["Maintenance"];
  var dept = D.dept || depts[0], Q = {};

  var css = ".di-r{display:flex;align-items:center;gap:10px;padding:7px 10px;border-bottom:.5px solid var(--border);font-size:14px}"
    + ".di-r:last-child{border-bottom:0}.di-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px}"
    + ".di-l{font-size:13px;color:var(--text-secondary);margin:0 0 6px}.di-c{font-family:var(--font-mono);font-size:13px}"
    + ".di-m{font-size:12px;color:var(--text-muted)}.di-p{font-size:13px;padding:5px 12px;border-radius:99px;"
    + "border:.5px solid var(--border-strong);background:none;cursor:pointer;color:var(--text-primary)}"
    + ".di-p[aria-pressed=true]{background:var(--bg-accent);color:var(--text-accent)}"
    + ".di-a{background:none;border:0;padding:0;color:var(--text-accent);cursor:pointer;font-size:13px}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  root.innerHTML =
    '<div style="display:grid;gap:16px;padding:.5rem 0">'
    + '<div class="di-r" style="border:.5px solid var(--border);border-radius:var(--radius)"><span class="di-l" style="margin:0">Vendor</span>'
    + '<span style="flex:1"><span class="di-c" id="di-vc"></span> · <span id="di-vn"></span></span>'
    + '<button type="button" class="di-a" id="di-chg">Change vendor</button></div>'
    + '<div><p class="di-l" id="di-pt"></p><input id="di-pq" placeholder="Search product: bubb, shoe, cvr" style="width:100%" aria-label="Search products">'
    + '<div id="di-pl" class="di-L"></div><p id="di-er" style="font-size:13px;color:var(--text-danger);margin:6px 0 0"></p></div>'
    + '<div><p class="di-l">Department</p><div id="di-dl" style="display:flex;flex-wrap:wrap;gap:6px"></div></div>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">'
    + '<label class="di-l" style="margin:0;display:flex;gap:6px;align-items:center">Needed by <input id="di-du" type="date"></label>'
    + '<label style="font-size:14px"><input id="di-sd" type="checkbox" checked> Send for approval</label>'
    + '<button type="button" id="di-go">Raise indent ↗</button></div></div>';

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  // a word may be typed in part ("bubb"), with a letter missing ("safty") or as a short form ("cvr")
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };

  $("di-vc").textContent = vendor[0]; $("di-vn").textContent = vendor[1];
  $("di-chg").onclick = function () { sendPrompt("indent"); };

  function drawP() {
    $("di-pt").textContent = "Products from " + vendor[1] + " (" + items.length + ")";
    var q = $("di-pq").value;
    var rows = items.filter(function (it) { return (it[0] in Q) || hit(q, it[0] + " " + it[1]); });
    $("di-pl").innerHTML = rows.map(function (it) {
      var on = it[0] in Q;
      return '<div class="di-r"><input type="checkbox" data-k="' + esc(it[0]) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(it[1]) + '">'
        + '<span style="flex:1;min-width:0"><span class="di-c">' + esc(it[0]) + "</span> · " + esc(it[1]) + "</span>"
        + (on ? '<input type="number" min="0" step="any" placeholder="Qty" data-q="' + esc(it[0]) + '" value="' + esc(Q[it[0]]) + '" style="width:80px" aria-label="Quantity of ' + esc(it[0]) + '"><span class="di-m">' + esc(it[2]) + "</span>" : "")
        + "</div>";
    }).join("") || '<div class="di-r di-m">' + (items.length ? "No match. Try fewer letters." : "No products on record for this vendor.") + "</div>";
    root.querySelectorAll("[data-k]").forEach(function (c) {
      c.onchange = function () {
        var k = c.getAttribute("data-k");
        if (c.checked) Q[k] = ""; else delete Q[k];
        $("di-er").textContent = ""; drawP();
        var x = root.querySelector('[data-q="' + k + '"]'); if (x) x.focus();
      };
    });
    root.querySelectorAll("[data-q]").forEach(function (x) { x.oninput = function () { Q[x.getAttribute("data-q")] = x.value; $("di-er").textContent = ""; }; });
  }
  function drawD() {
    $("di-dl").innerHTML = depts.map(function (x) { return '<button type="button" class="di-p" aria-pressed="' + (x === dept) + '">' + esc(x) + "</button>"; }).join("");
    $("di-dl").querySelectorAll("button").forEach(function (b) { b.onclick = function () { dept = b.textContent; drawD(); }; });
  }
  $("di-pq").oninput = drawP;
  $("di-go").onclick = function () {
    var K = Object.keys(Q);
    if (!K.length) { $("di-er").textContent = "Tick at least one product."; return; }
    var bad = K.filter(function (k) { return !(Number(Q[k]) > 0); });
    if (bad.length) { $("di-er").textContent = "Enter a quantity for " + bad.join(", ") + "."; return; }
    var u = $("di-du").value;
    sendPrompt("raise an indent for " + K.map(function (k) { return Number(Q[k]) + " " + k; }).join(", ") + " for " + dept
      + (u ? ", needed by " + u.split("-").reverse().join("/") : "")
      + ", preferred vendor " + vendor[0] + " " + vendor[1]
      + ($("di-sd").checked ? ", and send it for approval" : ""));
  };
  drawP(); drawD();
})();
