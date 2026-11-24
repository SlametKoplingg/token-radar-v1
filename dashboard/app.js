/* Token Radar v2 — renders the board from window.RADAR (data.js) with
   window.RadarModel (model.js). Every implied value is recomputed live in
   the browser from the row's raw fields and checked against the server's
   value before the trace is shown — the page never trusts a pre-baked number. */
(function () {
  'use strict';
  var RADAR = window.RADAR, M = window.RadarModel;
  var meta = document.getElementById('meta');
  if (!RADAR || !M) { meta.textContent = 'Snapshot failed to load.'; return; }
  var rows = RADAR.rows, live = RADAR.live;
  function $(id) { return document.getElementById(id); }
  function money(n) { return M.money(n); }
  function pct(c) { return c === null || c === undefined ? '—' : (c >= 0 ? '+' : '') + c.toFixed(1) + '%'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---- stats (count up over 400ms) ---- */
  var watchN = rows.filter(function (r) { return r.on_watchlist; }).length;
  var top = rows[0];
  var sum = rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  meta.textContent = 'Snapshot ' + RADAR.as_of + ' · ' + rows.length + ' ranked · floor $50M · model ' + M.MODEL_VERSION;
  function countUp(el, target, fmt) {
    var t0 = null;
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 400);
      el.textContent = fmt(Math.round(target * k));
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  countUp($('st-ranked'), rows.length, function (n) { return String(n); });
  countUp($('st-watch'), watchN, function (n) { return n + '/40'; });
  $('st-top').textContent = money(top.implied_value_usd);
  $('st-topname').textContent = top.name + ' · rank 1';
  countUp($('st-sum'), sum, function (n) { return money(n); });
  $('st-live').textContent = String(live.length);

  /* ---- controls ---- */
  var cats = {}, chains = {};
  rows.forEach(function (r) {
    if (r.category !== null) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) { $('cat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('chain').appendChild(new Option(c, c)); });

  var state = { q: '', cat: '', chain: '', watch: false, pretoken: true, sort: 'rank', dir: 1, sel: null };
  function readHash() {
    var h = {};
    location.hash.slice(1).split('&').forEach(function (p) {
      var kv = p.split('=');
      if (kv[0]) h[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    if (h.q) { state.q = h.q; $('q').value = h.q; }
    if (h.cat) { state.cat = h.cat; $('cat').value = h.cat; }
    if (h.chain) { state.chain = h.chain; $('chain').value = h.chain; }
    if (h.watch === '1') { state.watch = true; $('watch').checked = true; }
    if (h.detail) state.sel = h.detail;
  }
  function writeHash() {
    var p = [];
    if (state.q) p.push('q=' + encodeURIComponent(state.q));
    if (state.cat) p.push('cat=' + encodeURIComponent(state.cat));
    if (state.chain) p.push('chain=' + encodeURIComponent(state.chain));
    if (state.watch) p.push('watch=1');
    if (state.sel) p.push('detail=' + encodeURIComponent(state.sel));
    history.replaceState(null, '', p.length ? '#' + p.join('&') : location.pathname + location.search);
  }

  /* ---- recompute: implied from the row's own numbers, live ---- */
  function recompute(r) {
    var prod = r.tvl_usd * r.comp_ratio * r.growth_mult * r.maturity_mult * r.breadth_mult;
    return { prod: prod, err: Math.abs(prod - r.implied_value_usd) / r.implied_value_usd };
  }

  /* ---- table ---- */
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : 1; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    chg: function (a, b) { return (b.change_7d === null ? -999 : b.change_7d) - (a.change_7d === null ? -999 : a.change_7d); },
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    cat: function (a, b) { return (a.category || '') < (b.category || '') ? -1 : 1; }
  };
  function filtered() {
    var q = state.q.toLowerCase();
    return rows.filter(function (r) {
      if (state.watch && !r.on_watchlist) return false;
      if (state.pretoken && !r.pre_token) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return SORTS[state.sort](a, b) * state.dir; });
  }
  function renderTable() {
    var list = filtered();
    var tb = $('rows');
    tb.innerHTML = '';
    list.forEach(function (r, i) {
      var tr = document.createElement('tr');
      if (r.slug === state.sel) tr.className = 'sel';
      if (i < 16) tr.style.animationDelay = (i * 25) + 'ms';
      var chg = r.change_7d === null ? '<td class="num">—</td>' : '<td class="num ' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + pct(r.change_7d) + '</td>';
      tr.innerHTML = '<td class="num">' + r.rank + '</td>'
        + '<td class="name"><b>' + esc(r.name) + '</b>' + (r.on_watchlist ? '<span class="pill">WATCHLIST</span>' : '') + ' <span class="slug">' + esc(r.slug) + '</span></td>'
        + '<td class="num">' + money(r.tvl_usd) + '</td>' + chg
        + '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>'
        + '<td class="cat">' + esc(r.category || '—') + '</td>';
      tr.addEventListener('click', function () { select(r.slug); });
      tb.appendChild(tr);
    });
    $('shown').textContent = list.length + ' of ' + rows.length + ' shown';
    document.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.getAttribute('data-sort') === state.sort);
    });
  }

  /* ---- detail ---- */
  function select(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) r = top;
    state.sel = r.slug;
    var rc = recompute(r);
    var ok = rc.err <= 0.01;
    var ageShort = r.age_days === null ? 'age unrecorded' : r.age_days + 'd listed';
    var steps = r.farm_steps.map(function (s, i) {
      var cut = s.lastIndexOf(' Cost: ');
      var main = cut > 0 ? s.slice(0, cut) : s;
      var ct = cut > 0 ? s.slice(cut + 1) : '';
      return '<div class="step"><span class="n">' + (i + 1) + '</span>' + esc(main)
        + '<span class="ct">' + esc(ct).replace('Cost: ', '<b>Cost:</b> ').replace(' Time: ', ' · <b>Time:</b> ') + '</span></div>';
    }).join('');
    var chainsShown = r.chains.slice(0, 3).map(esc).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) + ' more' : '');
    $('detail').innerHTML = '<h2>' + esc(r.name) + '</h2>'
      + '<p class="dmeta">Rank ' + r.rank + ' · ' + esc(r.category || 'uncategorised') + ' · ' + chainsShown + '</p>'
      + '<p class="trace">' + esc(M.formatTrace(r)).replace(/ = /, ' = <b>') + '</b></p>'
      + '<p class="status">' + (ok ? 'Recomputed live — matches the board.' : 'Recompute differs — check the model.')
      + ' Pre-token · ' + (r.on_watchlist ? 'Watchlist · ' : '') + ageShort + '.</p>'
      + '<div class="farm">' + steps + '</div>';
    renderTable();
    writeHash();
  }

  /* ---- live tokens ---- */
  $('live').innerHTML = live.map(function (p) {
    return '<li><span class="ln">' + esc(p.name) + (p.symbol ? ' (' + esc(p.symbol) + ')' : '') + '</span>'
      + '<span class="lm">' + money(p.mcap_usd) + '</span> <span class="lc">' + esc(p.category || '—') + '</span></li>';
  }).join('');

  /* ---- events ---- */
  document.querySelectorAll('th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = 1; }
      renderTable();
    });
  });
  $('q').addEventListener('input', function () { state.q = $('q').value; renderTable(); writeHash(); });
  $('cat').addEventListener('change', function () { state.cat = $('cat').value; renderTable(); writeHash(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; renderTable(); writeHash(); });
  $('watch').addEventListener('change', function () { state.watch = $('watch').checked; renderTable(); writeHash(); });
  $('pretoken').addEventListener('change', function () { state.pretoken = $('pretoken').checked; renderTable(); writeHash(); });
  $('reset').addEventListener('click', function () {
    state = { q: '', cat: '', chain: '', watch: false, pretoken: true, sort: 'rank', dir: 1, sel: top.slug };
    $('q').value = ''; $('cat').value = ''; $('chain').value = '';
    $('watch').checked = false; $('pretoken').checked = true;
    select(top.slug);
  });

  readHash();
  select(state.sel || top.slug);
})();
