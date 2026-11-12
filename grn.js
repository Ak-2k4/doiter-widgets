/* Doiter goods receipts (GRN) for the Claude chat: the GRN list, and a form to receive goods.
   The chat writes only the data, as JSON in <script type="application/json" id="doiter-grn-data">,
   then one <script src> for this file. The data looks like:
     { grns:    [["GRN/26-27/04276","V035","Vishwak Packaging","2026-11-11","INV-221","CONFIRMED",154.11,1], ...],
       vendors: [["V035","Vishwak Packaging"], ...],
       lines:   [["PO/26-27/01216","V035","61260","Air bubble cover 10x13","NOS",100,60,40,6.53], ...],
                // open PO lines: PO, vendor, item, name, uom, ordered, received, balance, rate
       today: "2026-11-12", mode: "list" | "receive" }
   Buttons send one sentence back to the chat with sendPrompt(). No business data lives here. */
(function () {
  var root = document.getElementById("doiter-grn"), D = {};
  var dataEl = document.getElementById("doiter-grn-data");
  if (dataEl) { try { D = JSON.parse(dataEl.textContent); } catch (e) { D = {}; } }
  if (!root) return;
  var grns = D.grns || [], vendors = D.vendors || [], lines = D.lines || [];
  // v9 packed data (smaller, so the chat writes less):
  //   { c:1, v:{V035:"Vishwak Packaging"}, gp:"GRN/26-27/", g:[["04276","V035","261111","TEST-1111","C",154.11,1]],
  //     pp:"PO/26-27/", l:[["01216","V035","61260",100,70,30,6.53]], i:{"61260":["Air bubble cover","NOS"]} }
  if (D.c) {
    var VN = D.v || {}, IT = D.i || {}, ST = { C: "CONFIRMED", D: "DRAFT", X: "CANCELLED" };
    var ymd = function (s) { s = String(s || ""); return s.length === 6 ? "20" + s.slice(0, 2) + "-" + s.slice(2, 4) + "-" + s.slice(4, 6) : s; };
    vendors = Object.keys(VN).map(function (k) { return [k, VN[k]]; });
    grns = (D.g || []).map(function (r) { return [r[0] ? (D.gp || "") + r[0] : "", r[1], VN[r[1]] || "", ymd(r[2]), r[3], ST[r[4]] || r[4], r[5], r[6]]; });
    lines = (D.l || []).map(function (r) { var it = IT[r[2]] || ["", ""]; return [(D.pp || "") + r[0], r[1], r[2], it[0], it[1], r[3], r[4], r[5], r[6]]; });
  }
  var filter = "CONFIRMED", vendor = "", R = {};   // R: key "PO|item" -> received qty typed

  var css = ".dg-r{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:.5px solid var(--border);font-size:14px}"
    + ".dg-r:last-child{border-bottom:0}.dg-L{border:.5px solid var(--border);border-radius:var(--radius);margin-top:6px}"
    + ".dg-l{font-size:13px;color:var(--text-secondary);margin:0 0 6px}.dg-c{font-family:var(--font-mono);font-size:13px}"
    + ".dg-m{font-size:12px;color:var(--text-muted)}.dg-n{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}"
    + ".dg-p{font-size:13px;padding:6px 12px;border-radius:999px;border:.5px solid var(--border-strong);background:transparent;cursor:pointer;color:var(--text-primary)}"
    + ".dg-p[aria-pressed=true]{background:var(--bg-accent);color:var(--text-accent);border-color:var(--border-accent)}"
    + ".dg-b{font-size:12px;padding:2px 8px;border-radius:999px;white-space:nowrap}"
    + ".dg-s{position:relative}.dg-s i{position:absolute;left:10px;top:9px;font-size:16px;color:var(--text-muted)}"
    + ".dg-s input{width:100%;padding-left:34px !important;box-sizing:border-box}"
    + ".dg-k{background:none;border:0;padding:0;color:var(--text-accent);cursor:pointer;font-size:13px}"
    + ".dg-h{font-size:12px;color:var(--text-secondary);padding:8px 10px 2px;background:var(--surface-1)}"
    + "#doiter-grn [hidden]{display:none !important}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  var $ = function (i) { return document.getElementById(i); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var norm = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  var inOrder = function (t, w) { var k = 0; for (var i = 0; i < w.length; i++) if (w[i] === t[k]) k++; return k === t.length; };
  var hit = function (q, s) {
    q = norm(q); if (!q) return true; s = norm(s); var W = s.split(" ");
    return q.split(" ").every(function (t) { return s.indexOf(t) >= 0 || W.some(function (w) { return w[0] === t[0] && inOrder(t, w); }); });
  };
  var inr = function (v) { return "₹" + Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var num = function (v) { return Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 }); };
  var dmy = function (s) { var p = String(s || "").slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; };
  var plural = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
  var vname = function (c) { var v = vendors.filter(function (x) { return x[0] === c; })[0]; return v ? v[1] : ""; };
  var openOf = function (c) { return lines.filter(function (l) { return l[1] === c; }); };
  var poShort = function (p) { return String(p).split("/").pop().replace(/^0+/, ""); };

  var GROUPS = [["CONFIRMED", "Confirmed", ["CONFIRMED"]], ["DRAFT", "Drafts", ["DRAFT"]], ["CANCELLED", "Cancelled", ["CANCELLED"]], ["ALL", "All", null]];
  var BADGE = { CONFIRMED: ["Confirmed", "--bg-success", "--text-success"], DRAFT: ["Draft", "--surface-1", "--text-secondary"],
    CANCELLED: ["Cancelled", "--surface-1", "--text-muted"] };

  root.innerHTML =
    '<div style="display:grid;gap:16px;padding:.5rem 0">'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div id="dg-f" style="display:flex;gap:8px;flex-wrap:wrap;flex:1"></div>'
    + '<button type="button" id="dg-new">+ Receive goods</button></div>'
    + '<div id="dg-list"><div class="dg-s"><i class="ti ti-search" aria-hidden="true"></i><input id="dg-q" placeholder="Search GRN, invoice or vendor" aria-label="Search GRNs"></div>'
    + '<div id="dg-gl" class="dg-L" style="max-height:440px;overflow-y:auto"></div><p class="dg-m" id="dg-cnt" style="margin:6px 0 0"></p></div>'
    + '<div id="dg-form" hidden style="display:grid;gap:18px">'
    + '<div><p class="dg-l">Vendor (only vendors with goods still to come)</p><div class="dg-s"><i class="ti ti-search" aria-hidden="true"></i><input id="dg-vq" placeholder="Type part of a vendor name or code" aria-label="Search vendors"></div><div id="dg-vl" class="dg-L"></div></div>'
    + '<div><p class="dg-l" id="dg-lt">Pick a vendor to see what is still to come</p>'
    + '<div id="dg-ll" class="dg-L" style="max-height:420px;overflow-y:auto"></div><p id="dg-er" style="font-size:13px;color:var(--text-danger);margin:6px 0 0"></p></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;align-items:end">'
    + '<label style="display:grid;gap:6px"><span class="dg-l" style="margin:0">Invoice / DC number</span><input id="dg-in" placeholder="INV-221"></label>'
    + '<label style="display:grid;gap:6px"><span class="dg-l" style="margin:0">Invoice date</span><input id="dg-id" type="date"></label>'
    + '<label style="display:grid;gap:6px"><span class="dg-l" style="margin:0">Invoice amount ₹ (optional)</span><input id="dg-ia" type="number" min="0" step="any" placeholder="0"></label></div>'
    + '<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input id="dg-cf" type="checkbox" checked> Confirm now (adds the stock and gives the GRN number)</label>'
    + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button type="button" id="dg-go">Receive ↗</button>'
    + '<button type="button" class="dg-k" id="dg-back">Back to the list</button><span id="dg-sum" style="font-size:13px;color:var(--text-secondary)"></span></div>'
    + '</div></div>';

  // ---------- the list ----------
  function drawF() {
    $("dg-f").innerHTML = GROUPS.map(function (g) {
      var n = g[2] ? grns.filter(function (x) { return g[2].indexOf(x[5]) >= 0; }).length : grns.length;
      return '<button type="button" class="dg-p" data-g="' + g[0] + '" aria-pressed="' + (g[0] === filter) + '">' + g[1] + " · " + n + "</button>";
    }).join("");
    $("dg-f").querySelectorAll("button").forEach(function (b) { b.onclick = function () { filter = b.getAttribute("data-g"); showList(); }; });
  }
  function drawList() {
    var g = GROUPS.filter(function (x) { return x[0] === filter; })[0], q = $("dg-q").value;
    var rows = grns.filter(function (x) { return (!g[2] || g[2].indexOf(x[5]) >= 0) && hit(q, x[0] + " " + x[1] + " " + x[2] + " " + x[4]); });
    $("dg-gl").innerHTML = rows.map(function (x) {
      var b = BADGE[x[5]] || [x[5], "--surface-1", "--text-secondary"];
      var act = x[5] === "DRAFT" ? ["Confirm", "confirm " + (x[0] || "the draft GRN for invoice " + x[4])] : null;
      return '<div class="dg-r"><span style="flex:1;min-width:0"><button type="button" class="dg-k dg-c" data-say="show ' + esc(x[0] || "the draft GRN for invoice " + x[4]) + '">' + esc(x[0] || "Draft") + "</button>"
        + '<br><span class="dg-m">' + esc(x[1]) + " · " + esc(x[2]) + " · " + dmy(x[3]) + (x[4] ? " · invoice " + esc(x[4]) : "") + (x[7] ? " · " + plural(x[7], "item") : "") + "</span></span>"
        + '<span class="dg-b" style="background:var(' + b[1] + ');color:var(' + b[2] + ')">' + b[0] + "</span>"
        + '<span class="dg-n" style="min-width:92px">' + inr(x[6]) + "</span>"
        + (act ? '<button type="button" data-say="' + esc(act[1]) + '">' + act[0] + " ↗</button>" : '<span style="width:84px"></span>') + "</div>";
    }).join("") || '<div class="dg-r dg-m">No GRNs here.</div>';
    $("dg-cnt").textContent = "Showing " + plural(rows.length, "GRN") + " of " + grns.length + ", newest first.";
    $("dg-gl").querySelectorAll("[data-say]").forEach(function (b) { b.onclick = function () { sendPrompt(b.getAttribute("data-say")); }; });
  }
  function showList() { $("dg-list").hidden = false; $("dg-form").hidden = true; $("dg-f").hidden = false; $("dg-new").hidden = false; drawF(); drawList(); }

  // ---------- receive goods ----------
  function drawV() {
    var q = $("dg-vq").value;
    var withOpen = vendors.filter(function (v) { return openOf(v[0]).length; });
    $("dg-vl").innerHTML = withOpen.filter(function (v) { return hit(q, v[0] + " " + v[1]); }).map(function (v) {
      var n = openOf(v[0]), pos = {}; n.forEach(function (l) { pos[l[0]] = 1; });
      return '<label class="dg-r" style="cursor:pointer"><input type="radio" name="dg-v" value="' + esc(v[0]) + '"' + (v[0] === vendor ? " checked" : "") + ">"
        + '<span style="flex:1"><span class="dg-c">' + esc(v[0]) + "</span> · " + esc(v[1]) + "</span>"
        + '<span class="dg-m">' + plural(Object.keys(pos).length, "open PO") + "</span></label>";
    }).join("") || '<div class="dg-r dg-m">' + (withOpen.length ? "No vendor matches" : "Nothing is waiting to be received.") + "</div>";
    root.querySelectorAll("[name=dg-v]").forEach(function (r) { r.onchange = function () { vendor = r.value; R = {}; drawL(); sum(); }; });
  }
  function drawL() {
    if (!vendor) { $("dg-lt").textContent = "Pick a vendor to see what is still to come"; $("dg-ll").innerHTML = ""; return; }
    $("dg-lt").textContent = "Still to come from " + vname(vendor) + " — tick what arrived";
    var by = {}; openOf(vendor).forEach(function (l) { (by[l[0]] = by[l[0]] || []).push(l); });
    $("dg-ll").innerHTML = Object.keys(by).map(function (po) {
      return '<div class="dg-h"><span class="dg-c">' + esc(po) + '</span> <button type="button" class="dg-k" data-all="' + esc(po) + '">tick all, full balance</button></div>'
        + by[po].map(function (l) {
          var k = l[0] + "|" + l[2], on = k in R;
          return '<div class="dg-r" style="flex-wrap:wrap"><input type="checkbox" data-k="' + esc(k) + '"' + (on ? " checked" : "") + ' aria-label="Received ' + esc(l[3]) + '">'
            + '<span style="flex:1;min-width:170px"><span class="dg-c">' + esc(l[2]) + "</span> · " + esc(l[3])
            + '<br><span class="dg-m">ordered ' + num(l[5]) + " · received " + num(l[6]) + " · <b>due " + num(l[7]) + " " + esc(l[4]) + "</b> · " + inr(l[8]) + "</span></span>"
            + (on ? '<label class="dg-m" style="display:flex;align-items:center;gap:4px">Received <input type="number" min="0" step="any" data-q="' + esc(k) + '" value="' + esc(R[k]) + '" style="width:84px" aria-label="Quantity received of ' + esc(l[2]) + '"> ' + esc(l[4]) + "</label>" : "")
            + "</div>";
        }).join("");
    }).join("") || '<div class="dg-r dg-m">Nothing open for this vendor.</div>';
    var lineOf = function (k) { return lines.filter(function (l) { return l[0] + "|" + l[2] === k; })[0]; };
    root.querySelectorAll("[data-k]").forEach(function (c) {
      c.onchange = function () {
        var k = c.getAttribute("data-k");
        if (c.checked) R[k] = String(lineOf(k)[7]); else delete R[k];
        $("dg-er").textContent = ""; drawL(); sum();
      };
    });
    root.querySelectorAll("[data-all]").forEach(function (b) {
      b.onclick = function () { by[b.getAttribute("data-all")].forEach(function (l) { R[l[0] + "|" + l[2]] = String(l[7]); }); drawL(); sum(); };
    });
    root.querySelectorAll("[data-q]").forEach(function (x) { x.oninput = function () { R[x.getAttribute("data-q")] = x.value; $("dg-er").textContent = ""; sum(); }; });
  }
  function sum() {
    var K = Object.keys(R), t = K.reduce(function (s, k) { var l = lines.filter(function (x) { return x[0] + "|" + x[2] === k; })[0]; return s + (Number(R[k]) || 0) * (l ? l[8] : 0); }, 0);
    $("dg-sum").textContent = plural(K.length, "line") + (t ? " · " + inr(t) + " before GST" : "");
  }
  function showForm() {
    $("dg-list").hidden = true; $("dg-form").hidden = false; $("dg-f").hidden = true; $("dg-new").hidden = true;
    if (!$("dg-id").value) $("dg-id").value = D.today || "";
    drawV(); drawL(); sum();
  }

  $("dg-q").oninput = drawList;
  // packed list data carries no PO lines: ask the chat for the receive form, which carries only those
  $("dg-new").onclick = function () { if (D.c && !D.l) sendPrompt("receive goods"); else showForm(); };
  $("dg-back").onclick = showList;
  $("dg-vq").oninput = drawV;
  $("dg-go").onclick = function () {
    var er = $("dg-er"), K = Object.keys(R);
    if (!vendor) { er.textContent = "Pick a vendor."; return; }
    if (!K.length) { er.textContent = "Tick at least one line that arrived."; return; }
    var bad = K.filter(function (k) { return !(Number(R[k]) > 0); });
    if (bad.length) { er.textContent = "Enter the received quantity for " + bad.map(function (k) { return k.split("|")[1]; }).join(", ") + "."; return; }
    var inv = $("dg-in").value.trim(), dt = $("dg-id").value, amt = Number($("dg-ia").value);
    if (!inv) { er.textContent = "Enter the invoice or DC number."; $("dg-in").focus(); return; }
    if (!dt) { er.textContent = "Enter the invoice date."; return; }
    var by = {}; K.forEach(function (k) { var p = k.split("|"); (by[p[0]] = by[p[0]] || []).push(Number(R[k]) + " " + p[1]); });
    sendPrompt("received from " + vendor + " " + vname(vendor) + " against "
      + Object.keys(by).map(function (po) { return "PO " + poShort(po) + ": " + by[po].join(", "); }).join("; ")
      + " — invoice " + inv + " dated " + dmy(dt) + (amt > 0 ? ", invoice amount " + amt : "")
      + ($("dg-cf").checked ? "" : ", keep it as a draft"));
  };
  if (D.mode === "receive") showForm(); else showList();
})();
