/* Standalone DEMO monitor. No broker, no live orders, no canvas host. */
(function () {
  var STUB_EQUITY = 100000;
  var LIMITS = { single: 1, day: -3, dd: -10 };
  var KIND_OVERRIDE = { '01211.HK': 'Stock' };
  var KIND_LABEL = { ETF: 'ETF', Stock: '股票', Fund: '基金' };
  var KIND_COLOR = { ETF: '#3E92D0', '股票': '#E2A31A', '基金': '#9A6AD0', '未列': '#C4B39A' };
  var BROKER_COLOR = ['#3E86C4', '#E08A28', '#2EAA96', '#6A9A48', '#9A6AD0', '#E15D5D'];
  var DESKS = [
    { name: '投資顧問', seat: '組合', note: '監察中 · 配置建議 · 唔落真單' },
    { name: '數據分析中心', seat: '分析板', note: '只報狀態 · 分析板已交' },
    { name: '被動收入', seat: '股息', note: '現金流規劃中' },
    { name: '退休大計', seat: '退休', note: '長期目標規劃中' },
    { name: '買樓大計', seat: '置業', note: '資金與時程規劃中' },
    { name: '研究專員', seat: '另類', note: 'SpaceX／趨勢研究 · 非持倉承諾' }
  ];

  var snapshot, ledger, stub, symbols, side, tab;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kindOf(sym) {
    return KIND_OVERRIDE[sym.symbol] || sym.kind || 'Stock';
  }
  function kindLabel(k) { return KIND_LABEL[k] || k || '其他'; }
  function money(n, digits) {
    var d = digits == null ? 0 : digits;
    var neg = n < 0;
    var parts = Math.abs(n).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + 'HK$' + parts.join('.');
  }
  function pct(n, digits) {
    var d = digits == null ? 2 : digits;
    var sign = n > 0 ? '+' : (n < 0 ? '−' : '');
    return sign + Math.abs(Number(n) || 0).toFixed(d) + '%';
  }
  function magPct(n, digits) {
    return Math.abs(Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%';
  }
  function sheetDay() {
    var n = snapshot.day_pnl_pct_portfolio;
    if (n == null) n = snapshot.day_pnl_pct;
    return Number(n);
  }
  function fmtTs(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    var hkt = new Date(d.getTime() + 8 * 3600 * 1000);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return hkt.getUTCFullYear() + '-' + p(hkt.getUTCMonth() + 1) + '-' + p(hkt.getUTCDate()) +
      ' ' + p(hkt.getUTCHours()) + ':' + p(hkt.getUTCMinutes());
  }
  function hktClock(iso) {
    var full = fmtTs(iso);
    return full.slice(11, 16);
  }
  function loadLocal() {
    try {
      var raw = localStorage.getItem('hqInvestPaperFills');
      var data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      return data.filter(function (o) { return o && o.is_demo === true && o.live_auto === 'OFF'; });
    } catch (e) { return []; }
  }
  function saveLocal(rows) {
    localStorage.setItem('hqInvestPaperFills', JSON.stringify(rows));
  }
  function allFills() {
    return loadLocal().concat((ledger.orders || []).filter(function (o) { return o && o.is_demo; }));
  }
  function latestBatch(orders) {
    var max = '';
    orders.forEach(function (o) { if (o.ts && o.ts > max) max = o.ts; });
    return { ts: max, rows: orders.filter(function (o) { return o.ts === max; }) };
  }
  function weightValue(sym) {
    return snapshot.nav_hkd * (Number(sym.weight_pct) || 0) / 100;
  }
  function usedWeight() {
    return symbols.reduce(function (s, sym) { return s + (Number(sym.weight_pct) || 0); }, 0);
  }
  function riskOf(notional) {
    return (Number(notional) / STUB_EQUITY) * 100;
  }
  function stubOk() {
    return stub.order_risk_pct <= LIMITS.single &&
      stub.day_pnl_pct > LIMITS.day &&
      stub.drawdown_pct > LIMITS.dd &&
      !stub.leverage_on &&
      String(ledger.live_auto).toUpperCase() === 'OFF';
  }
  function selectedSymbol() {
    var el = $('symbol');
    var id = el ? el.value : '';
    for (var i = 0; i < symbols.length; i++) if (symbols[i].symbol === id) return symbols[i];
    return symbols[0];
  }
  function quotePreview() {
    var sym = selectedSymbol();
    var qty = Number($('qty').value);
    var price = Number($('price').value);
    var badQty = !(qty > 0) || !(price > 0);
    var notional = badQty ? 0 : qty * price;
    var risk = riskOf(notional);
    var over = risk > LIMITS.single + 1e-9;
    var blocked = badQty || over || !stubOk();
    var reason = '';
    if (badQty) reason = '數量同價格要大過 0';
    else if (over) reason = '超單筆 1% · 唔落單';
    else if (!stubOk()) reason = '紙上閘門未過 · 唔落單';
    else reason = '可以落紙上單';
    return { sym: sym, qty: qty, price: price, notional: notional, risk: risk, blocked: blocked, reason: reason };
  }

  function bars(rows, colorOf) {
    var max = 1;
    rows.forEach(function (r) { if (r.weight > max) max = r.weight; });
    return rows.map(function (r, i) {
      var w = Math.max(r.weight > 0 ? 3 : 0, r.weight / max * 100);
      return '<div class="bar-row"><div class="bar-meta"><span>' + esc(r.label) + '</span><b>' +
        esc(r.meta) + '</b></div><div class="track" aria-hidden="true"><div class="fill" style="width:' +
        w.toFixed(1) + '%;background:' + colorOf(r, i) + '"></div></div></div>';
    }).join('');
  }
  function spark() {
    var series = stub.demo_pnl_series || [];
    if (series.length < 2) return '';
    var w = 320, h = 78, pad = 8;
    var vals = series.map(function (p) { return Number(p.value) || 0; });
    var min = Math.min.apply(null, vals.concat([0]));
    var max = Math.max.apply(null, vals.concat([0]));
    var span = (max - min) || 1;
    var pts = series.map(function (p, i) {
      var x = pad + (i / (series.length - 1)) * (w - pad * 2);
      var y = pad + (1 - ((Number(p.value) || 0) - min) / span) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var zeroY = pad + (1 - (0 - min) / span) * (h - pad * 2);
    var last = vals[vals.length - 1];
    var stroke = last < 0 ? '#A56B62' : '#5F7D45';
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="紙上 DEMO 盈虧">' +
      '<line x1="' + pad + '" y1="' + zeroY.toFixed(1) + '" x2="' + (w - pad) + '" y2="' + zeroY.toFixed(1) +
      '" stroke="#E4D3BC" stroke-width="1" />' +
      '<polyline fill="none" stroke="' + stroke + '" stroke-width="2.5" points="' + pts + '" />' +
      '</svg><div class="spark-labels"><span>' + esc(series[0].label) + '</span><span>' +
      esc(series[series.length - 1].label) + ' · ' + esc(pct(last, 1)) + '</span></div>';
  }
  function fillRows(orders, limit) {
    var rows = orders.slice().sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return '<tr><td colspan="7">未有紙上成交</td></tr>';
    return rows.map(function (o) {
      var buy = String(o.side).toLowerCase() === 'buy';
      return '<tr><td>' + esc(fmtTs(o.ts)) + '</td><td class="' + (buy ? 'side-buy' : 'side-sell') + '">' +
        (buy ? '買入' : '賣出') + '</td><td>' + esc(o.symbol) + '</td><td class="num">' + esc(o.qty) +
        '</td><td class="num">' + esc(Number(o.price).toFixed(2)) + ' ' + esc(o.currency || '') +
        '</td><td class="num">' + esc(magPct(o.order_risk_pct, 2)) + '</td><td>' + esc(o.status || 'FILLED_DEMO') +
        '</td></tr>';
    }).join('');
  }

  function renderHeader() {
    var day = sheetDay();
    var batch = latestBatch(ledger.orders || []);
    var accounts = {};
    symbols.forEach(function (s) { accounts[s.account] = 1; });
    $('subline').textContent = '數據分析板 · Sheet DEMO NAV ' + money(snapshot.nav_hkd, 2) +
      ' · ' + fmtTs(batch.ts || ledger.updated_at) + ' HKT';
    var ok = stubOk();
    $('warn').textContent = '真倉自動 OFF · DEMO／PAPER 唔構成投資建議 · 當日 ' + pct(day, 2) +
      '（' + money(snapshot.day_pnl_hkd, 2) + '）· Risk ' + (ok ? 'OK' : 'HALT') +
      ' · 1% / −3% / −10% · 槓桿 OFF';
    var residual = Math.max(0, 100 - usedWeight());
    var cards = [
      { k: 'NAV · DEMO', v: money(snapshot.nav_hkd, 2), s: symbols.length + ' 隻 · ' + Object.keys(accounts).length + ' 戶 · FX ' + snapshot.fx_usd_hkd, cls: '' },
      { k: '當日', v: pct(day, 2), s: money(snapshot.day_pnl_hkd, 2), cls: day < 0 ? 'down' : 'ok' },
      { k: 'Risk', v: ok ? 'OK' : 'HALT', s: '單 ' + magPct(stub.order_risk_pct, 1) + ' · 日 ' + pct(stub.day_pnl_pct, 1), cls: ok ? 'ok' : 'down' },
      { k: '現金', v: '快照未列', s: '餘額約 ' + money(snapshot.nav_hkd * residual / 100, 0) + ' · 唔當持倉', cls: '' },
      { k: '紙上 Auto', v: String(batch.rows.length), s: hktClock(batch.ts) + ' 一批 · 帳本 ' + (ledger.orders || []).length + ' 筆', cls: '' }
    ];
    $('kpis').innerHTML = cards.map(function (c) {
      return '<article class="kpi"><h3>' + esc(c.k) + '</h3><p class="kpi-value ' + c.cls + '">' +
        esc(c.v) + '</p><p class="kpi-sub">' + esc(c.s) + '</p></article>';
    }).join('');
  }

  function renderOverview() {
    var byKind = {};
    symbols.forEach(function (sym) {
      var label = kindLabel(kindOf(sym));
      if (!byKind[label]) byKind[label] = { label: label, weight: 0, value: 0 };
      byKind[label].weight += Number(sym.weight_pct) || 0;
      byKind[label].value += weightValue(sym);
    });
    var residualW = Math.max(0, 100 - usedWeight());
    var kindRows = Object.keys(byKind).map(function (k) {
      var row = byKind[k];
      row.meta = money(row.value, 0) + ' · ' + row.weight.toFixed(1) + '%';
      return row;
    });
    kindRows.push({ label: '未列', weight: residualW, meta: money(snapshot.nav_hkd * residualW / 100, 0) + ' · ' + residualW.toFixed(1) + '%' });
    var byAcct = {};
    var acctOrder = [];
    symbols.forEach(function (sym) {
      var k = sym.account || '其他';
      if (!byAcct[k]) { byAcct[k] = { label: k, weight: 0, value: 0 }; acctOrder.push(k); }
      byAcct[k].weight += Number(sym.weight_pct) || 0;
      byAcct[k].value += weightValue(sym);
    });
    var acctRows = acctOrder.map(function (k) {
      var row = byAcct[k];
      row.meta = row.weight.toFixed(1) + '% · ' + money(row.value, 0);
      return row;
    });
    var ranked = symbols.slice().sort(function (a, b) { return (b.weight_pct || 0) - (a.weight_pct || 0); });
    function sumTop(n) {
      return ranked.slice(0, n).reduce(function (s, sym) { return s + (Number(sym.weight_pct) || 0); }, 0);
    }
    var conc = [
      { label: 'Top1 ' + (ranked[0] ? ranked[0].symbol : ''), weight: sumTop(1), meta: sumTop(1).toFixed(1) + '%' },
      { label: 'Top3', weight: sumTop(3), meta: sumTop(3).toFixed(1) + '% · ' + ranked.slice(0, 3).map(function (s) { return s.symbol; }).join(' ') },
      { label: 'Top5', weight: sumTop(5), meta: sumTop(5).toFixed(1) + '%' }
    ];
    var movers = symbols.slice().sort(function (a, b) { return (a.day_pct || 0) - (b.day_pct || 0); });
    var moverRows = movers.map(function (sym) {
      var contrib = (Number(sym.weight_pct) || 0) / 100 * (Number(sym.day_pct) || 0);
      var cls = sym.day_pct < 0 ? 'side-sell' : 'side-buy';
      return '<tr><td>' + esc(sym.symbol) + '</td><td>' + esc(kindLabel(kindOf(sym))) + '</td><td class="num ' +
        cls + '">' + esc(pct(sym.day_pct, 2)) + '</td><td class="num">' + esc(pct(contrib, 2)) + '</td></tr>';
    }).join('');
    var topRows = ranked.slice(0, 5).map(function (sym) {
      return '<div class="bar-row"><div class="bar-meta"><span>' + esc(sym.symbol) + ' · ' + esc(sym.account) +
        '</span><b>' + esc(sym.weight_pct.toFixed(1)) + '% · ' + esc(money(weightValue(sym), 0)) +
        '</b></div><div class="track"><div class="fill" style="width:' + Math.max(3, sym.weight_pct) +
        '%;background:#3E92D0"></div></div></div>';
    }).join('');
    $('panel-overview').innerHTML =
      '<div class="grid-3">' +
        '<article class="card"><h2>資產配置</h2><p class="note">市值由 NAV × 權重反推。01211.HK 比亞迪按股票計。</p>' +
          bars(kindRows, function (r) { return KIND_COLOR[r.label] || '#B79F80'; }) + '</article>' +
        '<article class="card"><h2>券商權重</h2><p class="note">佔 Sheet NAV。未列餘額唔入任何戶口。</p>' +
          bars(acctRows, function (r, i) { return BROKER_COLOR[i % BROKER_COLOR.length]; }) + '</article>' +
        '<article class="card"><h2>集中度</h2><p class="note">權重排序，唔係股數。</p>' +
          bars(conc, function () { return '#E08A28'; }) + '</article>' +
      '</div>' +
      '<div class="grid-2" style="margin-top:12px">' +
        '<article class="card"><h2>當日貢獻</h2><p class="note">約數 = 權重 × 當日%。唔係券商實數。</p>' +
          '<div class="table-scroll"><table><thead><tr><th>代號</th><th>種類</th><th class="num">當日</th><th class="num">貢獻約</th></tr></thead><tbody>' +
          moverRows + '</tbody></table></div></article>' +
        '<article class="card"><h2>紙上盈虧</h2><p class="note">paper stub DEMO，唔係 Sheet NAV。</p>' + spark() +
          '<h2 style="margin-top:14px">Top 持倉</h2>' + topRows + '</article>' +
      '</div>';
  }

  function renderFills() {
    $('fills').innerHTML = fillRows(allFills(), 12);
  }
  function renderAuto() {
    var batch = latestBatch(ledger.orders || []);
    $('panel-auto').innerHTML =
      '<article class="card"><h2>紙上全自動</h2>' +
      '<div class="lock"><span class="pill">真倉自動 OFF</span><span>已鎖 · 呢頁無券商 API · 撳唔開真倉</span></div>' +
      '<p class="hint">上次紙上運行 ' + esc(fmtTs(batch.ts)) + ' HKT · ' + batch.rows.length +
      ' 筆 DEMO 訊號 · 槓桿 OFF · 帳本 live_auto ' + esc(ledger.live_auto) + '</p>' +
      '<div class="table-scroll"><table><thead><tr><th>時間</th><th>方向</th><th>代號</th><th class="num">數量</th><th class="num">價格</th><th class="num">風險</th><th>狀態</th></tr></thead><tbody>' +
      fillRows(batch.rows) + '</tbody></table></div></article>';
  }
  function renderHolds() {
    var rows = symbols.slice().sort(function (a, b) { return (b.weight_pct || 0) - (a.weight_pct || 0); }).map(function (sym) {
      var cls = sym.day_pct < 0 ? 'side-sell' : 'side-buy';
      return '<tr><td>' + esc(sym.symbol) + '</td><td>' + esc(kindLabel(kindOf(sym))) + '</td><td>' +
        esc(sym.account) + '</td><td>' + esc(sym.currency) + '</td><td class="num">' + esc(Number(sym.price).toFixed(2)) +
        '</td><td class="num ' + cls + '">' + esc(pct(sym.day_pct, 2)) + '</td><td class="num">' +
        esc(sym.weight_pct.toFixed(1)) + '%</td><td class="num">' + esc(money(weightValue(sym), 0)) + '</td></tr>';
    }).join('');
    var residual = Math.max(0, 100 - usedWeight());
    $('panel-holds').innerHTML =
      '<article class="card"><h2>持倉</h2><p class="note">只顯示快照代號。市值 = NAV × 權重。現金快照未列，餘額約 ' +
      esc(money(snapshot.nav_hkd * residual / 100, 0)) + '（' + residual.toFixed(1) + '%）唔當持倉。</p>' +
      '<div class="table-scroll"><table><thead><tr><th>代號</th><th>種類</th><th>帳戶</th><th>貨幣</th><th class="num">價格</th><th class="num">當日</th><th class="num">權重</th><th class="num">市值估</th></tr></thead><tbody>' +
      rows + '</tbody></table></div></article>';
  }
  function renderResearch() {
    var desks = DESKS.map(function (d) {
      return '<div class="desk"><b>' + esc(d.name) + '</b><span>' + esc(d.seat) + ' · ' + esc(d.note) + '</span></div>';
    }).join('');
    var props = [
      ['單筆上限', '1%'],
      ['當日止蝕', '−3%'],
      ['回撤停', '−10%'],
      ['槓桿', 'OFF'],
      ['紙上單筆', magPct(stub.order_risk_pct, 1)],
      ['紙上當日', pct(stub.day_pnl_pct, 1)],
      ['紙上回撤', pct(stub.drawdown_pct, 1)],
      ['Sheet 當日', pct(sheetDay(), 2) + '（顯示用）']
    ].map(function (p) {
      return '<div><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>';
    }).join('');
    var watch = symbols.slice().sort(function (a, b) { return (a.day_pct || 0) - (b.day_pct || 0); }).map(function (sym) {
      var cls = sym.day_pct < 0 ? 'side-sell' : 'side-buy';
      return '<tr><td>' + esc(sym.symbol) + '</td><td>' + esc(sym.account) + '</td><td class="num ' + cls + '">' +
        esc(pct(sym.day_pct, 2)) + '</td><td class="num">' + esc(sym.weight_pct.toFixed(1)) +
        '%</td><td>價格可能延遲 · 只供監察</td></tr>';
    }).join('');
    $('panel-risk').innerHTML =
      '<article class="card"><h2>六個研究位</h2><div class="desks">' + desks + '</div></article>' +
      '<article class="card"><h2>風控</h2><p class="note">紙上閘門睇 stub。Sheet 當日跌幅另外顯示，唔會因此落真單。</p><div class="props">' +
      props + '</div></article>' +
      '<article class="card"><h2>觀察</h2><div class="table-scroll"><table><thead><tr><th>代號</th><th>帳戶</th><th class="num">當日</th><th class="num">權重</th><th>註</th></tr></thead><tbody>' +
      watch + '</tbody></table></div></article>';
  }

  function renderPreview() {
    var q = quotePreview();
    var el = $('preview');
    var btn = $('submit');
    el.className = 'preview ' + (q.blocked ? 'bad' : 'good');
    el.textContent = (q.sym ? q.sym.symbol + ' ' + (q.sym.currency || '') + ' · ' : '') +
      '名義 ' + (q.notional ? q.notional.toFixed(2) : '—') +
      ' · 風險 ' + (q.notional ? q.risk.toFixed(2) : '—') + '% · ' + q.reason +
      ' · 算法跟紙上帳本（名義 ÷ US$' + STUB_EQUITY.toLocaleString('en-US') + '，未換匯）';
    btn.disabled = q.blocked;
  }
  function fillPrice() {
    var sym = selectedSymbol();
    if (sym) $('price').value = sym.price;
    renderPreview();
  }
  function applyPreset(name) {
    var sym = selectedSymbol();
    if (!sym || !(sym.price > 0)) return;
    var notional = sym.price;
    if (name === 'mid') notional = STUB_EQUITY * 0.004;
    if (name === 'cap') notional = STUB_EQUITY * 0.0099;
    var qty = name === 'one' ? 1 : notional / sym.price;
    $('qty').value = (Math.round(qty * 10000) / 10000).toString();
    $('price').value = sym.price;
    renderPreview();
  }
  function setSide(next) {
    side = next === 'sell' ? 'sell' : 'buy';
    document.querySelectorAll('[data-side]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-side') === side ? 'true' : 'false');
    });
  }
  function showTab(next) {
    var names = ['overview', 'trade', 'auto', 'holds', 'risk'];
    if (names.indexOf(next) < 0) next = 'overview';
    tab = next;
    names.forEach(function (name) {
      var on = name === tab;
      $('panel-' + name).hidden = !on;
      var btn = $('tab-' + name);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (history.replaceState) history.replaceState(null, '', '#' + tab);
  }
  function onSubmit(ev) {
    ev.preventDefault();
    var q = quotePreview();
    var note = $('formNote');
    if (q.blocked || !q.sym) {
      note.textContent = q.reason || '未落單';
      renderPreview();
      return;
    }
    var order = {
      order_id: 'local-' + Date.now().toString(36),
      ts: new Date().toISOString(),
      side: side,
      symbol: q.sym.symbol,
      qty: q.qty,
      order_type: 'market',
      price: q.price,
      notional: Math.round(q.notional * 100) / 100,
      currency: q.sym.currency,
      account: 'PAPER',
      is_demo: true,
      live_auto: 'OFF',
      order_risk_pct: Math.round(q.risk * 100000) / 100000,
      risk_status: 'OK',
      status: 'FILLED_DEMO',
      fill_kind: 'DEMO_PAPER',
      note: '本機 DEMO paper fill · 模擬 ≠ 實盤 · 無 broker API · 真倉自動 OFF'
    };
    var rows = loadLocal();
    rows.unshift(order);
    saveLocal(rows.slice(0, 40));
    note.textContent = '已寫入本機 DEMO 成交 · 無 broker · 真倉自動仍然 OFF';
    renderFills();
    renderHeader();
  }
  function bind() {
    document.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
    });
    $('symbol').innerHTML = symbols.map(function (sym) {
      return '<option value="' + esc(sym.symbol) + '">' + esc(sym.symbol) + ' · ' + esc(sym.account) + '</option>';
    }).join('');
    $('symbol').addEventListener('change', fillPrice);
    $('qty').addEventListener('input', renderPreview);
    $('price').addEventListener('input', renderPreview);
    document.querySelectorAll('[data-side]').forEach(function (btn) {
      btn.addEventListener('click', function () { setSide(btn.getAttribute('data-side')); });
    });
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyPreset(btn.getAttribute('data-preset')); });
    });
    $('ticket').addEventListener('submit', onSubmit);
    fillPrice();
    var hash = (location.hash || '').replace('#', '');
    showTab(hash || 'overview');
  }

  function boot() {
    Promise.all([
      fetch('data/snapshot.json').then(function (r) { if (!r.ok) throw new Error('snapshot'); return r.json(); }),
      fetch('data/ledger.json').then(function (r) { if (!r.ok) throw new Error('ledger'); return r.json(); }),
      fetch('data/stub.json').then(function (r) { if (!r.ok) throw new Error('stub'); return r.json(); })
    ]).then(function (all) {
      snapshot = all[0];
      ledger = all[1];
      stub = all[2];
      if (!snapshot.is_demo || !ledger.is_demo || !stub.is_demo) throw new Error('not demo');
      if (String(ledger.live_auto).toUpperCase() !== 'OFF' || stub.leverage_on) throw new Error('live locked');
      symbols = (snapshot.symbols || []).filter(function (s) { return s && s.symbol; });
      side = 'buy';
      bind();
      renderHeader();
      renderOverview();
      renderFills();
      renderAuto();
      renderHolds();
      renderResearch();
    }).catch(function () {
      $('warn').textContent = 'DEMO 數據載入失敗 · 真倉自動 OFF · 無 broker API · 唔構成投資建議';
    });
  }
  boot();
})();
