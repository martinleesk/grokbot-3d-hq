/* Standalone cream invest platform. Paper DEMO only. No broker, no live orders. */
(function () {
  var LIMITS = { single: 1, day: -3, dd: -10 };
  var KIND_LABEL = { ETF: 'ETF', Stock: '股票', Fund: '基金' };
  var DESKS = [
    { name: '投資顧問', seat: '組合', note: '監察中 · 配置建議 · 唔落真單' },
    { name: '數據分析中心', seat: '分析板', note: '只報狀態 · 快照價可以對照' },
    { name: '被動收入', seat: '股息', note: '現金流規劃中' },
    { name: '退休大計', seat: '退休', note: '長期目標規劃中' },
    { name: '買樓大計', seat: '置業', note: '資金與時程規劃中' },
    { name: '研究專員', seat: '另類', note: 'SpaceX／趨勢研究 · 非持倉承諾' }
  ];

  var snapshot, ledger, stub, symbols, side, tab, equityPainted;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function kindLabel(k) { return KIND_LABEL[k] || k || '其他'; }
  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  function usd(n, digits) {
    var d = digits == null ? 2 : digits;
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var neg = v < 0;
    var parts = Math.abs(v).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + 'US$' + parts.join('.');
  }
  function money(n, digits) {
    var d = digits == null ? 0 : digits;
    var v = Number(n);
    if (!isFinite(v)) v = 0;
    var neg = v < 0;
    var parts = Math.abs(v).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + 'HK$' + parts.join('.');
  }
  function pct(n, digits) {
    var d = digits == null ? 2 : digits;
    var v = Number(n) || 0;
    var sign = v > 0 ? '+' : (v < 0 ? '−' : '');
    return sign + Math.abs(v).toFixed(d) + '%';
  }
  function magPct(n, digits) {
    return Math.abs(Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%';
  }
  function priceText(n) {
    if (n == null || !isFinite(Number(n))) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  function qtyText(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    return String(Math.round(v * 10000) / 10000);
  }
  function tone(n) {
    var v = Number(n) || 0;
    if (v > 0.05) return 'up';
    if (v < -0.05) return 'dn';
    return 'flat';
  }
  function capital() {
    var n = Number(stub && stub.starting_capital);
    if (!(n > 0)) n = Number(stub && stub.equity);
    return n > 0 ? n : 0;
  }
  function usdDigits(n) {
    var v = Number(n);
    if (!isFinite(v)) return 2;
    return Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2;
  }
  function warnDayPct() {
    if (snapshot && snapshot.day_pnl_pct_portfolio != null && isFinite(Number(snapshot.day_pnl_pct_portfolio))) {
      return Number(snapshot.day_pnl_pct_portfolio);
    }
    if (snapshot && snapshot.day_pnl_pct != null && isFinite(Number(snapshot.day_pnl_pct))) {
      return Number(snapshot.day_pnl_pct);
    }
    return Number(stub && stub.day_pnl_pct) || 0;
  }
  function positionNote() {
    var pos = stub && stub.open_positions;
    if (!pos || typeof pos !== 'object') return '';
    return Object.keys(pos).map(function (k) { return k + ' ' + qtyText(pos[k]); }).join(' · ');
  }
  function equity() {
    var n = Number(stub && stub.equity);
    return isFinite(n) ? n : 0;
  }
  function cashAmount() {
    var n = Number(stub && stub.cash);
    return isFinite(n) ? n : null;
  }
  function investedAmount() {
    var n = Number(stub && stub.invested_notional);
    return isFinite(n) ? n : null;
  }
  function fmtTs(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || '');
    var hkt = new Date(d.getTime() + 8 * 3600 * 1000);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return hkt.getUTCFullYear() + '-' + p(hkt.getUTCMonth() + 1) + '-' + p(hkt.getUTCDate()) +
      ' ' + p(hkt.getUTCHours()) + ':' + p(hkt.getUTCMinutes());
  }
  function stampText() {
    if (snapshot && snapshot.stamp_hkt) {
      var s = String(snapshot.stamp_hkt);
      var cut = s.indexOf('（');
      if (cut > 0) s = s.slice(0, cut).trim();
      return s;
    }
    return fmtTs((ledger && ledger.updated_at) || (snapshot && snapshot.as_of)) + ' HKT';
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
  function quoteOf(id) {
    for (var i = 0; i < symbols.length; i++) if (symbols[i].symbol === id) return symbols[i];
    return null;
  }
  function costBasis(symbol) {
    var notional = 0;
    var seen = false;
    (ledger.orders || []).forEach(function (o) {
      if (!o || o.symbol !== symbol || !o.is_demo) return;
      var n = Number(o.notional);
      if (!(n > 0)) n = (Number(o.qty) || 0) * (Number(o.price) || 0);
      if (!(n > 0)) return;
      seen = true;
      if (String(o.side).toLowerCase() === 'sell') notional -= n;
      else notional += n;
    });
    return seen ? notional : null;
  }
  function openPositions() {
    var map = (stub && stub.open_positions) || {};
    return Object.keys(map).map(function (id) {
      var quote = quoteOf(id);
      return {
        symbol: id,
        qty: Number(map[id]) || 0,
        cost: costBasis(id),
        price: quote ? quote.price : null,
        day: quote ? quote.day_pct : null,
        currency: quote ? quote.currency : ''
      };
    });
  }
  function maxOrderRisk() {
    var max = 0;
    (ledger.orders || []).forEach(function (o) {
      var r = Number(o && o.order_risk_pct) || 0;
      if (r > max) max = r;
    });
    return max;
  }
  function riskOf(notional) {
    var base = capital();
    if (!(base > 0)) return Infinity;
    return (Number(notional) / base) * 100;
  }
  function stubOk() {
    return Number(stub.order_risk_pct) <= LIMITS.single &&
      Number(stub.day_pnl_pct) > LIMITS.day &&
      Number(stub.drawdown_pct) > LIMITS.dd &&
      !stub.leverage_on &&
      String(ledger.live_auto).toUpperCase() === 'OFF';
  }
  function selectedSymbol() {
    var el = $('symbol');
    var id = el ? el.value : '';
    return quoteOf(id) || symbols[0];
  }
  function quotePreview() {
    var sym = selectedSymbol();
    var qty = Number($('qty').value);
    var price = Number($('price').value);
    var badQty = !(qty > 0) || !(price > 0);
    var notional = badQty ? 0 : qty * price;
    var risk = riskOf(notional);
    var over = risk > LIMITS.single + 1e-9;
    var noBase = !(capital() > 0);
    var blocked = badQty || over || noBase || !stubOk();
    var reason = '';
    if (noBase) reason = '未有紙上本金 · 唔落單';
    else if (badQty) reason = '數量同價格要大過 0';
    else if (over) reason = '超單筆 1% · 唔落單';
    else if (!stubOk()) reason = '紙上閘門未過 · 唔落單';
    else reason = '可以落紙上單';
    return { sym: sym, qty: qty, price: price, notional: notional, risk: risk, blocked: blocked, reason: reason };
  }

  function paintEquity(n) {
    var el = $('heroValue');
    if (!el) return;
    var digits = usdDigits(n);
    el.className = 'hero-value' + (reduceMotion() ? '' : ' is-live');
    if (reduceMotion() || equityPainted || !(n > 0)) {
      el.textContent = usd(n, digits);
      equityPainted = true;
      return;
    }
    equityPainted = true;
    var t0 = null;
    var dur = 700;
    function frame(now) {
      if (t0 == null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      var shown = digits === 0 ? Math.round(n * eased) : n * eased;
      el.textContent = usd(shown, digits);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = usd(n, digits);
    }
    requestAnimationFrame(frame);
  }

  function renderHeader() {
    var ok = stubOk();
    var sheetMoney = snapshot.day_pnl_hkd == null || !isFinite(Number(snapshot.day_pnl_hkd)) ? '' : '（' + money(snapshot.day_pnl_hkd, 2) + '）';
    $('subline').textContent = '紙上 DEMO · 市場 ' + symbols.length + ' 隻 · ' + stampText();
    $('warn').textContent = '真倉自動 OFF · DEMO／PAPER 唔構成投資建議 · 當日\u00A0' + pct(warnDayPct(), 2) + sheetMoney +
      ' · Risk ' + (ok ? 'OK' : 'HALT') + ' · 1% / −3% / −10% · 槓桿 OFF';
    var sheetEl = $('sheetRef');
    if (sheetEl) {
      var hasNav = snapshot.nav_hkd != null && isFinite(Number(snapshot.nav_hkd));
      sheetEl.hidden = !hasNav;
      sheetEl.textContent = hasNav
        ? 'Sheet 參考 · DEMO NAV ' + money(snapshot.nav_hkd, 2) + ' · ' + fmtTs(snapshot.as_of || ledger.updated_at) + ' HKT'
        : 'Sheet 參考 · 呢個快照未列 DEMO NAV';
    }
    var gates = $('gates');
    if (gates) gates.textContent = '閘門 1% / −3% / −10% · 槓桿 OFF · 紙上本金 ' + usd(capital(), usdDigits(capital()));
  }

  function renderHero() {
    var start = capital();
    var eq = equity();
    var hasStart = stub.starting_capital != null && Number(stub.starting_capital) > 0;
    var heading = hasStart && isFinite(eq) ? '本金／equity' : (hasStart ? '本金' : 'equity');
    var note = '紙上交易資本 · 試行起跑';
    var figure = start;
    if (hasStart && isFinite(eq) && Math.abs(eq - Number(stub.starting_capital)) > 0.005) {
      heading = '本金';
      note = 'equity ' + usd(eq, usdDigits(eq));
      figure = Number(stub.starting_capital);
    }
    var kicker = $('heroKicker');
    if (kicker) kicker.textContent = heading;
    var noteEl = $('heroNote');
    if (noteEl) noteEl.textContent = note;
    paintEquity(figure);
    var cash = cashAmount();
    var inv = investedAmount();
    var side = '';
    if (cash != null) {
      var cashShare = eq > 0 ? '佔淨值 ' + (cash / eq * 100).toFixed(1) + '%' : '';
      side += '<article class="paper-stat"><h3>現金</h3><p class="paper-figure">' + esc(usd(cash, usdDigits(cash))) +
        '</p><p class="paper-sub">' + esc(cashShare) + '</p></article>';
    }
    if (inv != null) {
      var pos = positionNote();
      side += '<article class="paper-stat"><h3>已投資</h3><p class="paper-figure">' + esc(usd(inv, usdDigits(inv))) +
        '</p>' + (pos ? '<p class="paper-sub">' + esc(pos) + '</p>' : '') + '</article>';
    }
    $('heroSide').innerHTML = side;
    var mix = $('heroMix');
    if (cash != null && inv != null && eq > 0) {
      var cashW = Math.max(0, Math.min(100, cash / eq * 100));
      var invW = Math.max(0, Math.min(100, inv / eq * 100));
      mix.innerHTML =
        '<div class="track mix" role="img" aria-label="現金佔淨值 ' + cashW.toFixed(1) + '%，已投資 ' + invW.toFixed(1) + '%">' +
          '<div class="fill cash" style="width:' + cashW.toFixed(1) + '%"></div>' +
          '<div class="fill inv" style="width:' + invW.toFixed(1) + '%"></div></div>';
    } else {
      mix.innerHTML = '';
    }
  }

  function positionCards(list) {
    var inv = investedAmount();
    if (!list.length) return '<p class="empty">未有未平倉。數量跟 stub.open_positions。</p>';
    return '<div class="positions">' + list.map(function (p, i) {
      var share = inv > 0 && p.cost != null ? Math.max(0, Math.min(100, p.cost / inv * 100)) : 0;
      var move = p.day == null ? '' : '<span class="delta ' + tone(p.day) + '" title="快照升跌，唔係組合當日">升跌 ' + esc(pct(p.day, 2)) + '</span>';
      var cost = p.cost == null ? '成本未列' : '成本 ' + usd(p.cost, 2);
      var px = p.price == null ? '快照未列' : '快照價 ' + priceText(p.price) + (p.currency ? ' ' + p.currency : '');
      var bar = p.cost == null ? '' : '<div class="track" aria-hidden="true"><div class="fill book" style="width:' +
        share.toFixed(1) + '%;animation-delay:' + (i * 40) + 'ms"></div></div><p class="pos-meta">佔投入 ' + share.toFixed(1) + '%</p>';
      return '<article class="pos tone-' + (p.day == null ? 'flat' : tone(p.day)) + '"><div class="pos-head"><b>' + esc(p.symbol) + '</b>' + move + '</div>' +
        '<p class="pos-qty"><span>數量 </span>' + esc(qtyText(p.qty)) + '</p>' +
        '<p class="pos-meta">' + esc(cost) + ' · ' + esc(px) + '</p>' + bar +
        '<button type="button" class="arm" data-arm="' + esc(p.symbol) + '">去落單</button></article>';
    }).join('') + '</div>';
  }

  function renderOverview() {
    var list = openPositions();
    var up = 0, down = 0, flat = 0;
    symbols.forEach(function (s) {
      var d = Number(s.day_pct) || 0;
      if (d > 0) up += 1;
      else if (d < 0) down += 1;
      else flat += 1;
    });
    var total = symbols.length || 1;
    var ranked = symbols.slice().sort(function (a, b) { return (Number(b.day_pct) || 0) - (Number(a.day_pct) || 0); });
    function moverList(rows, title) {
      var body = rows.map(function (s) {
        return '<div class="mover"><button type="button" data-arm="' + esc(s.symbol) + '">' + esc(s.symbol) +
          '</button><b class="' + tone(s.day_pct) + '">' + esc(pct(s.day_pct, 2)) + '</b></div>';
      }).join('');
      return '<div><h3 class="note">' + title + '</h3>' + body + '</div>';
    }
    var peak = stub.peak_equity == null ? '' : '峰值 ' + usd(stub.peak_equity, 0);
    var lamps = [
      { k: '單筆', v: magPct(stub.order_risk_pct, 2), s: '上限 1% · 帳本最高 ' + magPct(maxOrderRisk(), 2), bad: Number(stub.order_risk_pct) > LIMITS.single },
      { k: '日內閘', v: Number(stub.day_pnl_pct) > LIMITS.day ? '通過' : 'HALT', s: '線 −3%', bad: !(Number(stub.day_pnl_pct) > LIMITS.day) },
      { k: '回撤閘', v: Number(stub.drawdown_pct) > LIMITS.dd ? '通過' : 'HALT', s: '線 −10% · ' + peak, bad: !(Number(stub.drawdown_pct) > LIMITS.dd) },
      { k: '槓桿', v: stub.leverage_on ? 'ON' : 'OFF', s: 'live_auto ' + String(ledger.live_auto), bad: !!stub.leverage_on || String(ledger.live_auto).toUpperCase() !== 'OFF' }
    ];
    var batch = latestBatch(ledger.orders || []);
    var tape = ranked.map(function (s) {
      return '<button type="button" class="tick-chip ' + tone(s.day_pct) + '" data-arm="' + esc(s.symbol) + '">' +
        esc(s.symbol) + ' ' + esc(pct(s.day_pct, 2)) + '</button>';
    }).join('');
    var failed = snapshot.failed_tickers || [];
    var src = snapshot.source ? String(snapshot.source) : 'DEMO 快照';
    $('panel-overview').innerHTML =
      '<div class="room">' +
        '<article class="card"><h2>未平倉</h2><p class="note">數量跟 stub。成本跟帳本。快照價只對照，唔改紙上淨值。</p>' +
          positionCards(list) + '</article>' +
        '<div class="stack"><article class="card"><h2>風控閘</h2><p class="note">紙上試行至 2026-11-20。真倉鎖住。</p>' +
          '<div class="lamps">' + lamps.map(function (l) {
            return '<div class="lamp' + (l.bad ? ' bad' : '') + '"><span class="bulb" aria-hidden="true"></span><span><b>' +
              esc(l.k) + ' ' + esc(l.v) + '</b><small>' + esc(l.s) + '</small></span></div>';
          }).join('') + '</div>' +
          '<p class="note">帳本 ' + (ledger.orders || []).length + ' 筆 · 最新 ' + esc(fmtTs(batch.ts || ledger.updated_at)) + ' HKT</p></article></div>' +
        '<article class="card"><h2>市場溫度</h2><p class="note">' + esc(src) +
          (failed.length ? ' · 失敗 ' + esc(failed.join(' ')) : '') +
          ' · ' + (snapshot.universe_ok != null ? snapshot.universe_ok : symbols.length) + '/' +
          (snapshot.universe_requested != null ? snapshot.universe_requested : symbols.length) + '</p>' +
          '<div class="breadth" role="img" aria-label="升 ' + up + ' 平 ' + flat + ' 跌 ' + down + '">' +
            '<i class="up" style="width:' + (up / total * 100).toFixed(1) + '%"></i>' +
            '<i class="flat" style="width:' + (flat / total * 100).toFixed(1) + '%"></i>' +
            '<i class="dn" style="width:' + (down / total * 100).toFixed(1) + '%"></i></div>' +
          '<p class="note">升 ' + up + ' · 平 ' + flat + ' · 跌 ' + down + ' · 共 ' + symbols.length + '</p>' +
          '<div class="movers">' + moverList(ranked.slice(0, 5), '升幅') +
            moverList(ranked.slice(-5).reverse(), '跌幅') + '</div></article>' +
        '<article class="card span-all"><h2>市場快照</h2><p class="note">撳代號去落紙上單。升跌係個股快照，唔係組合當日。</p>' +
          '<div class="tape" role="group" aria-label="市場快照">' + tape + '</div></article>' +
      '</div>';
  }

  function fillRows(orders, limit) {
    var rows = orders.slice().sort(function (a, b) { return Date.parse(b.ts) - Date.parse(a.ts); });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return '<tr><td colspan="7">未有紙上成交</td></tr>';
    return rows.map(function (o, i) {
      var buy = String(o.side).toLowerCase() === 'buy';
      var local = String(o.order_id || '').indexOf('local-') === 0;
      var status = (o.status || 'FILLED_DEMO') + (local ? ' · 本機' : '');
      return '<tr' + (i === 0 && local ? ' class="just-in"' : '') + '><td>' + esc(fmtTs(o.ts)) + '</td><td class="' +
        (buy ? 'side-buy' : 'side-sell') + '">' + (buy ? '買入' : '賣出') + '</td><td>' + esc(o.symbol) +
        '</td><td class="num">' + esc(o.qty) + '</td><td class="num">' + esc(priceText(o.price)) + ' ' +
        esc(o.currency || '') + '</td><td class="num">' + esc(magPct(o.order_risk_pct, 2)) + '</td><td>' +
        esc(status) + '</td></tr>';
    }).join('');
  }

  function renderFills() {
    var body = $('fills');
    body.innerHTML = fillRows(allFills(), 12);
  }
  function renderAuto() {
    var batch = latestBatch(ledger.orders || []);
    $('panel-auto').innerHTML =
      '<article class="card"><h2>紙上全自動</h2>' +
      '<div class="lock"><span class="pill">真倉自動 OFF</span><span>已鎖 · 呢頁無券商 API · 撳唔開真倉 · 試行至 2026-11-20</span></div>' +
      '<p class="hint">上次紙上運行 ' + esc(fmtTs(batch.ts || ledger.updated_at)) + ' HKT · ' + batch.rows.length +
      ' 筆同一時刻 · 槓桿 OFF · 帳本 live_auto ' + esc(ledger.live_auto) + ' · 本金 ' + esc(usd(capital(), 0)) + '</p>' +
      '<div class="table-scroll"><table><thead><tr><th>時間</th><th>方向</th><th>代號</th><th class="num">數量</th><th class="num">價格</th><th class="num">風險</th><th>狀態</th></tr></thead><tbody>' +
      fillRows(batch.rows) + '</tbody></table></div></article>';
  }
  function renderHolds() {
    var list = openPositions();
    var rows = list.map(function (p) {
      var cls = p.day == null ? '' : tone(p.day);
      return '<tr><td>' + esc(p.symbol) + '</td><td class="num">' + esc(qtyText(p.qty)) + '</td><td class="num">' +
        esc(p.cost == null ? '—' : usd(p.cost, 2)) + '</td><td class="num">' + esc(p.price == null ? '—' : priceText(p.price)) +
        '</td><td>' + esc(p.currency || '—') + '</td><td class="num ' + (cls === 'dn' ? 'side-sell' : (cls === 'up' ? 'side-buy' : '')) +
        '">' + esc(p.day == null ? '—' : pct(p.day, 2)) + '</td><td><button type="button" class="arm" data-arm="' +
        esc(p.symbol) + '">去落單</button></td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="7">未有未平倉</td></tr>';
    $('panel-holds').innerHTML =
      '<article class="card"><h2>持倉</h2><p class="note">未平倉跟 stub.open_positions。市值唔會寫返紙上淨值；淨值仍然係 ' +
      esc(usd(equity(), 2)) + '。</p>' +
      '<div class="table-scroll"><table><thead><tr><th>代號</th><th class="num">數量</th><th class="num">成本</th><th class="num">快照價</th><th>貨幣</th><th class="num">升跌</th><th></th></tr></thead><tbody>' +
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
      ['槓桿', stub.leverage_on ? 'ON' : 'OFF'],
      ['紙上本金', usd(capital(), 0)],
      ['紙上淨值', usd(equity(), 2)],
      ['紙上單筆', magPct(stub.order_risk_pct, 2)],
      ['紙上當日', pct(Number(stub.day_pnl_pct) || 0, 2)],
      ['紙上回撤', pct(Number(stub.drawdown_pct) || 0, 2)],
      ['live_auto', String(ledger.live_auto)]
    ].map(function (p) {
      return '<div class="prop"><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>';
    }).join('');
    var watch = symbols.slice().sort(function (a, b) { return (Number(a.day_pct) || 0) - (Number(b.day_pct) || 0); }).map(function (sym) {
      var cls = tone(sym.day_pct) === 'dn' ? 'side-sell' : (tone(sym.day_pct) === 'up' ? 'side-buy' : '');
      return '<tr><td>' + esc(sym.symbol) + '</td><td>' + esc(kindLabel(sym.kind)) + '</td><td>' + esc(sym.currency || '') +
        '</td><td class="num">' + esc(priceText(sym.price)) + '</td><td class="num ' + cls + '">' + esc(pct(sym.day_pct, 2)) +
        '</td><td class="wrap">價格可能延遲 · 只供監察</td></tr>';
    }).join('');
    $('panel-risk').innerHTML =
      '<div class="research">' +
        '<article class="card"><h2>六個研究位</h2><div class="desks">' + desks + '</div></article>' +
        '<article class="card"><h2>風控</h2><p class="note">閘門睇 stub。呢頁落唔到真單。</p><div class="props">' + props + '</div></article>' +
        '<article class="card span-all"><h2>觀察</h2><p class="note">' + esc(snapshot.notes || '') + '</p>' +
          '<div class="table-scroll"><table><thead><tr><th>代號</th><th>種類</th><th>貨幣</th><th class="num">價格</th><th class="num">升跌</th><th>註</th></tr></thead><tbody>' +
          watch + '</tbody></table></div></article></div>';
  }

  function renderPreview() {
    var q = quotePreview();
    var el = $('preview');
    var btn = $('submit');
    el.className = 'preview ' + (q.blocked ? 'bad' : 'good');
    el.textContent = (q.sym ? q.sym.symbol + ' ' + (q.sym.currency || '') + ' · ' : '') +
      '名義 ' + (q.notional ? q.notional.toFixed(2) : '—') +
      ' · 風險 ' + (q.notional && isFinite(q.risk) ? q.risk.toFixed(2) : '—') + '% · ' + q.reason +
      ' · 名義 ÷ 紙上本金 ' + usd(capital(), 0) + '（未換匯）';
    btn.disabled = q.blocked;
  }
  function fillPrice() {
    var sym = selectedSymbol();
    if (sym) $('price').value = sym.price;
    renderPreview();
  }
  function applyPreset(name) {
    var sym = selectedSymbol();
    var base = capital();
    if (!sym || !(sym.price > 0) || !(base > 0)) return;
    var notional = sym.price;
    if (name === 'mid') notional = base * 0.004;
    if (name === 'cap') notional = base * 0.0099;
    var qty = name === 'one' ? 1 : notional / sym.price;
    $('qty').value = (Math.round(qty * 10000) / 10000).toString();
    $('price').value = sym.price;
    renderPreview();
  }
  function setSide(next) {
    side = next === 'sell' ? 'sell' : 'buy';
    var buttons = document.querySelectorAll('[data-side]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-side') === side ? 'true' : 'false');
    }
  }
  function showTab(next) {
    var names = ['overview', 'trade', 'auto', 'holds', 'risk'];
    if (names.indexOf(next) < 0) next = 'overview';
    tab = next;
    names.forEach(function (name) {
      var on = name === tab;
      $('panel-' + name).hidden = !on;
      $('tab-' + name).setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (history.replaceState) history.replaceState(null, '', '#' + tab);
  }
  function armSymbol(id) {
    var sel = $('symbol');
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === id) { sel.selectedIndex = i; break; }
    }
    showTab('trade');
    fillPrice();
    var form = $('ticket');
    form.className = 'card ticket';
    if (!reduceMotion()) {
      window.setTimeout(function () { form.className = 'card ticket armed'; }, 20);
    }
    $('qty').focus();
  }
  function onArmClick(ev) {
    var node = ev.target;
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute('data-arm')) {
        armSymbol(node.getAttribute('data-arm'));
        ev.preventDefault();
        return;
      }
      node = node.parentNode;
    }
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
      order_risk_pct: Math.round(q.risk * 1e5) / 1e5,
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
    var tabs = document.querySelectorAll('[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () { showTab(this.getAttribute('data-tab')); });
    }
    $('symbol').innerHTML = symbols.map(function (sym) {
      return '<option value="' + esc(sym.symbol) + '">' + esc(sym.symbol) + ' · ' + esc(sym.currency || '') + '</option>';
    }).join('');
    $('symbol').addEventListener('change', fillPrice);
    $('qty').addEventListener('input', renderPreview);
    $('price').addEventListener('input', renderPreview);
    var sides = document.querySelectorAll('[data-side]');
    for (var s = 0; s < sides.length; s++) {
      sides[s].addEventListener('click', function () { setSide(this.getAttribute('data-side')); });
    }
    var presets = document.querySelectorAll('[data-preset]');
    for (var p = 0; p < presets.length; p++) {
      presets[p].addEventListener('click', function () { applyPreset(this.getAttribute('data-preset')); });
    }
    $('ticket').addEventListener('submit', onSubmit);
    document.body.addEventListener('click', onArmClick);
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
      renderHero();
      renderOverview();
      renderFills();
      renderAuto();
      renderHolds();
      renderResearch();
      document.body.setAttribute('data-ready', '1');
    }).catch(function () {
      $('warn').textContent = 'DEMO 數據載入失敗 · 真倉自動 OFF · 無 broker API · 唔構成投資建議';
      var ov = $('panel-overview');
      if (ov) ov.innerHTML = '<article class="card"><h2>載入失敗</h2><p class="note">讀唔到 invest/data。真倉自動 OFF。</p></article>';
    });
  }
  boot();
})();
