/* Doiter purchase orders for the Claude chat: the PO list, and a form to create one.
   The chat writes only the data, as JSON in <script type="application/json" id="doiter-po-data">,
   then one <script src> for this file. The data looks like:
     { pos:     [["PO/26-27/01225","V035","Vishwak Packaging","2026-11-11","2026-11-18","OPEN",154.1,2], ...],   // last: item count
       vendors: [["V035","Vishwak Packaging"], ...],
       items:   [["61260","Air bubble cover 10x13","NOS",6.53], ...],   // last price may be 0
       vp:      { V035: ["61260", ...] }, vendor: "V035" }
   Buttons send one sentence back to the chat with sendPrompt(). No business data lives here. */
(function () {
  var root = document.getElementById("doiter-po"), D = {};
  var dataEl = document.getElementById("doiter-po-data");
  if (dataEl) { try { D = JSON.parse(dataEl.textContent); } catch (e) { D = {}; } }
  if (!root) return;
  var pos = D.pos || [], vendors = D.vendors || [], items = D.items || [], vp = D.vp || {};
  var vendor = D.vendor || (vendors[0] || [""])[0], filter = "OPEN", showAll = false, L = {};

  var css = ".dp-r{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:.5px solid var(--border);font-size:14px}"
    + ".dp-r:last-child{border-bottom:0}.dp-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px}"
    + ".dp-l{font-size:13px;color:var(--text-secondary);margin:0 0 6px}.dp-c{font-family:var(--font-mono);font-size:13px}"
    + ".dp-m{font-size:12px;color:var(--text-muted)}.dp-n{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}"
    + ".dp-p{font-size:13px;padding:6px 12px;border-radius:999px;border:.5px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-primary)}"
    + ".dp-p[aria-pressed=true]{background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)}"
    + ".dp-b{font-size:12px;padding:2px 8px;border-radius:999px;white-space:nowrap}"
    + ".dp-s{position:relative}.dp-s i{position:absolute;left:10px;top:9px;font-size:16px;color:var(--text-muted)}"
    + ".dp-s input{width:100%;padding-left:34px !important;box-sizing:border-box}"
    + ".dp-k{background:none;border:0;padding:0;color:var(--text-accent);cursor:pointer;font-size:13px}"
    + "#doiter-po [hidden]{display:none !important}";   // an inline display style must not show a hidden section
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  // a word may be typed in part ("bubb"), with a letter missing ("safty") or as a short form ("cvr")
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };
  var inr = function (v) { return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dmy = function (s) { var p = String(s || "").slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
  var own = function (code) { return vp[code] || []; };
  var vname = function () { var v = vendors.filter(function (x) { return x[0] === vendor; })[0]; return v ? v[1] : ""; };
  var itemOf = function (c) { return items.filter(function (x) { return x[0] === c; })[0] || [c, c, "", 0]; };

  var GROUPS = [["OPEN", "Open", ["OPEN", "PART_RECEIVED"]], ["PENDING_APPROVAL", "Waiting approval", ["PENDING_APPROVAL"]],
    ["DRAFT", "Drafts", ["DRAFT"]], ["CLOSED", "Closed", ["CLOSED"]], ["CANCELLED", "Cancelled", ["CANCELLED"]], ["ALL", "All", null]];
  var BADGE = { OPEN: ["Open", "--bg-accent", "--text-accent"], PART_RECEIVED: ["Part received", "--bg-warning", "--text-warning"],
    PENDING_APPROVAL: ["Waiting approval", "--bg-warning", "--text-warning"], DRAFT: ["Draft", "--surface-1", "--text-secondary"],
    CLOSED: ["Closed", "--bg-success", "--text-success"], CANCELLED: ["Cancelled", "--surface-1", "--text-muted"] };

  root.innerHTML =
    '<div style="display:grid;gap:16px;padding:.5rem 0">'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div id="dp-f" style="display:flex;gap:8px;flex-wrap:wrap;flex:1"></div>'
    + '<button type="button" id="dp-new">+ Create PO</button></div>'
    + '<div id="dp-list"><div class="dp-s"><i class="ti ti-search" aria-hidden="true"></i><input id="dp-q" placeholder="Search PO number or vendor" aria-label="Search purchase orders"></div>'
    + '<div id="dp-pl" class="dp-L" style="max-height:440px;overflow-y:auto"></div><p class="dp-m" id="dp-cnt" style="margin:6px 0 0"></p></div>'
    + '<div id="dp-form" hidden style="display:grid;gap:18px">'
    + '<div><p class="dp-l">Vendor</p><div class="dp-s"><i class="ti ti-search" aria-hidden="true"></i><input id="dp-vq" placeholder="Type part of a vendor name or code" aria-label="Search vendors"></div><div id="dp-vl" class="dp-L"></div></div>'
    + '<div><div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><p class="dp-l" id="dp-pt"></p><button type="button" id="dp-tg"></button></div>'
    + '<div class="dp-s"><i class="ti ti-search" aria-hidden="true"></i><input id="dp-iq" placeholder="Type part of a product name, like bubb, shoe, hose" aria-label="Search products"></div>'
    + '<div id="dp-il" class="dp-L"></div><p id="dp-er" style="font-size:13px;color:var(--text-danger);margin:6px 0 0"></p></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;align-items:end">'
    + '<label style="display:grid;gap:6px"><span class="dp-l" style="margin:0">Needed by (optional)</span><input id="dp-du" type="date"></label>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input id="dp-sd" type="checkbox" checked> Send for approval now</label></div>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button type="button" id="dp-go">Raise PO ↗</button>'
    + '<button type="button" class="dp-k" id="dp-back">Back to the list</button><span id="dp-sum" style="font-size:13px;color:var(--text-secondary)"></span></div>'
    + '</div></div>';

  // ---------- the list ----------
  function drawF() {
    $("dp-f").innerHTML = GROUPS.map(function (g) {
      var n = g[2] ? pos.filter(function (p) { return g[2].indexOf(p[5]) >= 0; }).length : pos.length;
      return '<button type="button" class="dp-p" data-g="' + g[0] + '" aria-pressed="' + (g[0] === filter) + '">' + g[1] + " · " + n + "</button>";
    }).join("");
    $("dp-f").querySelectorAll("button").forEach(function (b) { b.onclick = function () { filter = b.getAttribute("data-g"); showList(); }; });
  }
  function drawList() {
    var g = GROUPS.filter(function (x) { return x[0] === filter; })[0], q = $("dp-q").value;
    var rows = pos.filter(function (p) { return (!g[2] || g[2].indexOf(p[5]) >= 0) && hit(q, p[0] + " " + p[1] + " " + p[2]); });
    $("dp-pl").innerHTML = rows.map(function (p) {
      var b = BADGE[p[5]] || [p[5], "--surface-1", "--text-secondary"];
      var act = p[5] === "PENDING_APPROVAL" ? ["Approve", "approve " + p[0]]
        : (p[5] === "OPEN" || p[5] === "PART_RECEIVED") ? ["Receive", "receive goods against " + p[0]]
        : p[5] === "DRAFT" ? ["Submit", "submit " + (p[0] || "the draft PO for " + p[2])] : null;
      return '<div class="dp-r"><span style="flex:1;min-width:0"><button type="button" class="dp-k dp-c" data-say="show ' + esc(p[0] || "the draft PO for " + p[2]) + '">' + esc(p[0] || "Draft") + "</button>"
        + '<br><span class="dp-m">' + esc(p[1]) + " · " + esc(p[2]) + " · " + dmy(p[3]) + (p[4] ? " · needed " + dmy(p[4]) : "") + (p[7] ? " · " + plural(p[7], "item") : "") + "</span></span>"
        + '<span class="dp-b" style="background:var(' + b[1] + ');color:var(' + b[2] + ')">' + b[0] + "</span>"
        + '<span class="dp-n" style="min-width:92px">' + inr(p[6]) + "</span>"
        + (act ? '<button type="button" data-say="' + esc(act[1]) + '">' + act[0] + " ↗</button>" : '<span style="width:84px"></span>') + "</div>";
    }).join("") || '<div class="dp-r dp-m">No purchase orders here.</div>';
    $("dp-cnt").textContent = "Showing " + plural(rows.length, "purchase order") + " of " + pos.length + ", newest first.";
    $("dp-pl").querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { sendPrompt(b.getAttribute("data-say")); }; });
  }
  function showList() { $("dp-list").hidden = false; $("dp-form").hidden = true; $("dp-f").hidden = false; $("dp-new").hidden = false; drawF(); drawList(); }

  // ---------- the create form ----------
  function drawV() {
    var q = $("dp-vq").value;
    $("dp-vl").innerHTML = vendors.filter(function (v) { return hit(q, v[0] + " " + v[1]); }).map(function (v) {
      var n = own(v[0]).length;
      return '<label class="dp-r" style="cursor:pointer"><input type="radio" name="dp-v" value="' + esc(v[0]) + '"' + (v[0] === vendor ? " checked" : "") + ">"
        + '<span style="flex:1"><span class="dp-c">' + esc(v[0]) + "</span> · " + esc(v[1]) + "</span>"
        + '<span class="dp-m">' + (n ? plural(n, "product") : "no products yet") + "</span></label>";
    }).join("") || '<div class="dp-r dp-m">No vendor matches</div>';
    root.querySelectorAll("[name=dp-v]").forEach(function (r) {
      r.onchange = function () { vendor = r.value; showAll = false; Object.keys(L).forEach(function (k) { if (own(vendor).indexOf(k) < 0) delete L[k]; }); drawI(); sum(); };
    });
  }
  function drawI() {
    $("dp-pt").textContent = showAll ? "All products" : "Products from " + vname();
    $("dp-tg").textContent = showAll ? "Only " + vname() + " products" : "Show all products";
    var pool = showAll ? items : items.filter(function (it) { return own(vendor).indexOf(it[0]) >= 0; });
    var q = $("dp-iq").value;
    $("dp-il").innerHTML = pool.filter(function (it) { return (it[0] in L) || hit(q, it[0] + " " + it[1]); }).map(function (it) {
      var on = it[0] in L, l = L[it[0]] || {};
      return '<div class="dp-r" style="flex-wrap:wrap"><input type="checkbox" data-k="' + esc(it[0]) + '"' + (on ? " checked" : "") + ' aria-label="Select ' + esc(it[1]) + '">'
        + '<span style="flex:1;min-width:160px"><span class="dp-c">' + esc(it[0]) + "</span> · " + esc(it[1])
        + (it[3] ? '<span class="dp-m"> · last ' + inr(it[3]) + "</span>" : "") + "</span>"
        + (on ? '<input type="number" min="0" step="any" placeholder="Qty" data-q="' + esc(it[0]) + '" value="' + esc(l.q) + '" style="width:80px" aria-label="Quantity of ' + esc(it[0]) + '">'
          + '<span class="dp-m" style="width:30px">' + esc(it[2]) + "</span>"
          + '<input type="number" min="0" step="any" placeholder="Rate ₹" data-p="' + esc(it[0]) + '" value="' + esc(l.p) + '" style="width:90px" aria-label="Rate of ' + esc(it[0]) + '">' : "")
        + "</div>";
    }).join("") || '<div class="dp-r dp-m">' + (pool.length ? "No product matches. Try fewer letters." : "No products on record for " + esc(vname()) + " yet. Use Show all products.") + "</div>";
    root.querySelectorAll("[data-k]").forEach(function (c) {
      c.onchange = function () {
        var k = c.getAttribute("data-k");
        if (c.checked) L[k] = { q: "", p: itemOf(k)[3] ? String(itemOf(k)[3]) : "" }; else delete L[k];
        $("dp-er").textContent = ""; drawI(); sum();
        var x = root.querySelector('[data-q="' + k + '"]'); if (x) x.focus();
      };
    });
    root.querySelectorAll("[data-q]").forEach(function (x) { x.oninput = function () { L[x.getAttribute("data-q")].q = x.value; $("dp-er").textContent = ""; sum(); }; });
    root.querySelectorAll("[data-p]").forEach(function (x) { x.oninput = function () { L[x.getAttribute("data-p")].p = x.value; sum(); }; });
  }
  function sum() {
    var K = Object.keys(L), t = K.reduce(function (s, k) { return s + (Number(L[k].q) || 0) * (Number(L[k].p) || 0); }, 0);
    $("dp-sum").textContent = plural(K.length, "product") + " · " + vendor + (t ? " · " + inr(t) + " before GST" : "");
  }
  function showForm() { $("dp-list").hidden = true; $("dp-form").hidden = false; $("dp-f").hidden = true; $("dp-new").hidden = true; drawV(); drawI(); sum(); }

  $("dp-q").oninput = drawList;
  $("dp-new").onclick = showForm;
  $("dp-back").onclick = showList;
  $("dp-vq").oninput = drawV;
  $("dp-iq").oninput = drawI;
  $("dp-tg").onclick = function () { showAll = !showAll; drawI(); };
  $("dp-go").onclick = function () {
    var K = Object.keys(L);
    if (!K.length) { $("dp-er").textContent = "Tick at least one product."; return; }
    var bad = K.filter(function (k) { return !(Number(L[k].q) > 0); });
    if (bad.length) { $("dp-er").textContent = "Enter a quantity for " + bad.join(", ") + "."; return; }
    var u = $("dp-du").value;
    sendPrompt("raise a PO to " + vendor + " " + vname() + " for "
      + K.map(function (k) { return Number(L[k].q) + " " + k + (Number(L[k].p) > 0 ? " at " + Number(L[k].p) : ""); }).join(", ")
      + (u ? ", needed by " + u.split("-").reverse().join("/") : "")
      + ($("dp-sd").checked ? " and send it for approval" : ""));
  };
  if (D.mode === "create") showForm(); else showList();
})();
