/* Personal wealth summary. Sheet DEMO holdings only — never invent balances.
   If invest/data/snapshot.json is a market watchlist without weights, the
   page keeps the last published Sheet book in data/sheet-holdings.json. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HQWealth = api;
  if (typeof document !== 'undefined' && document.getElementById('wealthApp')) boot(api);

  function boot(W) {
    var reduce = false;
    try {
      reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { reduce = false; }
    if (reduce) document.documentElement.classList.add('reduce-motion');

    function $(id) { return document.getElementById(id); }
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function money(n, digits) {
      if (n == null || !isFinite(n)) return '—';
      var d = digits == null ? 0 : digits;
      var neg = n < 0;
      var parts = Math.abs(n).toFixed(d).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (neg ? '−' : '') + 'HK$' + parts.join('.');
    }
    function usd(n, digits) {
      if (n == null || !isFinite(Number(n))) return '—';
      var d = digits == null ? 2 : digits;
      var v = Number(n);
      var neg = v < 0;
      var parts = Math.abs(v).toFixed(d).split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return (neg ? '−' : '') + 'US$' + parts.join('.');
    }
    function pct(n, digits) {
      if (n == null || !isFinite(Number(n))) return '—';
      var d = digits == null ? 2 : digits;
      var v = Number(n);
      var sign = v > 0 ? '+' : (v < 0 ? '−' : '');
      return sign + Math.abs(v).toFixed(d) + '%';
    }
    function cls(n) {
      return n < 0 ? 'down' : (n > 0 ? 'ok' : '');
    }
    function fmtTs(iso) {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso || '');
      var hkt = new Date(d.getTime() + 8 * 3600 * 1000);
      function p(n) { return (n < 10 ? '0' : '') + n; }
      return hkt.getUTCFullYear() + '-' + p(hkt.getUTCMonth() + 1) + '-' + p(hkt.getUTCDate()) +
        ' ' + p(hkt.getUTCHours()) + ':' + p(hkt.getUTCMinutes()) + ' HKT';
    }
    function load(url) {
      return fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(url);
        return r.json();
      });
    }
    function legend(rows) {
      return '<ul class="legend">' + rows.map(function (r) {
        return '<li><i style="background:' + esc(r.color) + '" aria-hidden="true"></i>' +
          '<span>' + esc(r.label) + (r.note ? '<small>' + esc(r.note) + '</small>' : '') + '</span>' +
          '<b>' + esc(r.meta) + '</b></li>';
      }).join('') + '</ul>';
    }
    function donut(slices, opts) {
      var r = 68;
      var c = 2 * Math.PI * r;
      var total = 0;
      slices.forEach(function (s) { total += s.value; });
      if (!(total > 0)) total = 1;
      var acc = 0;
      var rings = slices.map(function (s) {
        var raw = (s.value / total) * c;
        var gapPx = raw > 6 ? 1.8 : 0;
        var dash = Math.max(raw > 0 ? 0.6 : 0, raw - gapPx);
        var gap = c - dash;
        var node = '<circle class="slice" cx="100" cy="100" r="' + r + '" fill="none" stroke="' + esc(s.color) +
          '" stroke-width="28" stroke-linecap="butt" stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) +
          '" stroke-dashoffset="' + (-acc).toFixed(2) + '" transform="rotate(-90 100 100)">' +
          '<title>' + esc(s.label) + ' ' + esc(s.meta) + '</title></circle>';
        acc += raw;
        return node;
      }).join('');
      return '<svg class="donut" viewBox="0 0 200 200" role="img" aria-labelledby="' + opts.titleId + ' ' + opts.descId + '">' +
        '<title id="' + opts.titleId + '">' + esc(opts.title) + '</title>' +
        '<desc id="' + opts.descId + '">' + esc(opts.desc) + '</desc>' +
        rings +
        '<circle cx="100" cy="100" r="48" fill="#FFFBF6"/>' +
        '<text class="donut-k" x="100" y="94" text-anchor="middle">' + esc(opts.centerK) + '</text>' +
        '<text class="donut-v" x="100" y="116" text-anchor="middle">' + esc(opts.centerV) + '</text>' +
        '</svg>';
    }
    function bars(rows) {
      var max = 1;
      rows.forEach(function (r) { if (r.weight > max) max = r.weight; });
      return '<div class="bars">' + rows.map(function (r) {
        var w = Math.max(r.weight > 0 ? 2 : 0, r.weight / max * 100);
        return '<div class="bar-row"><div class="bar-meta"><span>' + esc(r.label) + '</span><b class="' + cls(r.day) + '">' +
          esc(r.meta) + '</b></div><div class="track" role="presentation"><div class="fill" style="width:' +
          w.toFixed(1) + '%;background:' + esc(r.color) + '"></div></div></div>';
      }).join('') + '</div>';
    }

    function render(sheet, picked, stub) {
      var sum = W.summarize(sheet);
      var when = fmtTs(sum.asOf);
      $('when').textContent = when || '時間未列';
      var note = picked.marketOnly
        ? '最新 invest/data/snapshot.json 係市場報價，未列個人 NAV 同權重。圖表用上次已發布 Sheet DEMO 持倉（' +
          (when || sum.asOf) + '），唔用市價砌假餘額。'
        : '圖表讀 ' + picked.source + ' 嘅 Sheet DEMO 持倉。真倉自動 OFF，呢度唔係券商即時餘額。';
      $('sourceNote').textContent = note;
      var cashText = sum.cashListed ? money(sum.cashHkd, 0) : '快照未列';
      var cashSub = sum.cashListed ? '快照有現金欄' : '未列權重 ' + sum.residualWeight.toFixed(1) + '% 唔當現金';
      var cards = [
        { k: '總資產 NAV', v: money(sum.nav, 2), s: 'Sheet DEMO · ' + sum.positions.length + ' 隻', cls: '' },
        { k: '當日', v: pct(sum.dayPct, 2), s: sum.dayHkd == null ? '快照未列金額' : money(sum.dayHkd, 2), cls: cls(sum.dayPct) },
        { k: '已投資', v: money(sum.invested, 0), s: '權重 ' + sum.usedWeight.toFixed(1) + '%', cls: '' },
        { k: '現金', v: cashText, s: cashSub, cls: '' },
        { k: '券商', v: String(sum.brokers.length) + ' 戶', s: sum.brokers.map(function (b) { return b.label; }).join(' · '), cls: '' }
      ];
      $('kpis').innerHTML = cards.map(function (c) {
        return '<article class="kpi"><h3>' + esc(c.k) + '</h3><p class="kpi-value ' + c.cls + '">' +
          esc(c.v) + '</p><p class="kpi-sub">' + esc(c.s) + '</p></article>';
      }).join('');

      var brokerSlices = sum.brokers.map(function (b) {
        return {
          label: b.label,
          note: b.note,
          color: b.color,
          value: b.value,
          meta: b.weight.toFixed(1) + '% · ' + money(b.value, 0)
        };
      });
      if (sum.residualWeight > 0.05) {
        brokerSlices.push({
          label: '未列權重',
          note: '唔入任何券商',
          color: '#C4B39A',
          value: sum.nav * sum.residualWeight / 100,
          meta: sum.residualWeight.toFixed(1) + '% · ' + money(sum.nav * sum.residualWeight / 100, 0)
        });
      }
      var brokerDesc = brokerSlices.map(function (s) { return s.label + ' ' + s.meta; }).join('，');
      $('cardBrokers').innerHTML =
        '<h2>券商配置</h2><p class="note">佔 Sheet NAV。未列權重唔入任何戶口。</p>' +
        '<div class="chart-split">' +
          donut(brokerSlices, {
            titleId: 'brokerTitle',
            descId: 'brokerDesc',
            title: '券商配置',
            desc: brokerDesc,
            centerK: '券商',
            centerV: sum.brokers.length + ' 戶'
          }) +
          legend(brokerSlices) +
        '</div>';

      var holdRows = sum.positions.map(function (p) {
        return {
          label: p.name + ' · ' + p.symbol,
          meta: p.weight.toFixed(1) + '% · ' + money(p.value, 0) + ' · ' + pct(p.dayPct, 2),
          weight: p.weight,
          day: p.dayPct,
          color: (sum.brokers.filter(function (b) { return b.account === p.account; })[0] || {}).color || '#3E92D0'
        };
      });
      var table = '<table><caption>Sheet DEMO 持倉。市值估 = NAV × 權重。01211.HK 比亞迪按股票計。</caption><thead><tr>' +
        '<th>代號</th><th>名稱</th><th>券商</th><th>種類</th><th class="num">權重</th><th class="num">市值估</th><th class="num">當日</th><th class="num">貢獻約</th>' +
        '</tr></thead><tbody>' + sum.positions.map(function (p) {
          return '<tr><td>' + esc(p.symbol) + '</td><td>' + esc(p.name) + '</td><td>' + esc(p.broker) +
            '</td><td>' + esc(p.kindLabel) + '</td><td class="num">' + esc(p.weight.toFixed(1)) +
            '%</td><td class="num">' + esc(money(p.value, 0)) + '</td><td class="num ' + cls(p.dayPct) + '">' +
            esc(pct(p.dayPct, 2)) + '</td><td class="num ' + cls(p.contrib) + '">' + esc(pct(p.contrib, 2)) + '</td></tr>';
        }).join('') + '</tbody></table>';
      $('cardHolds').innerHTML =
        '<h2>持倉組成</h2><p class="note">由重到輕。當日%係快照價，唔係重新報價。</p>' +
        '<div class="hold-scroll">' + bars(holdRows) + table + '</div>';

      var kindSlices = sum.kinds.map(function (k) {
        return {
          label: k.label,
          note: k.unlisted ? '唔當持倉、唔當現金' : '',
          color: k.color,
          value: k.value,
          meta: k.weight.toFixed(1) + '% · ' + money(k.value, 0)
        };
      });
      var kindDesc = kindSlices.map(function (s) { return s.label + ' ' + s.meta; }).join('，');
      var sleeves = W.UNLISTED.map(function (s) {
        return '<li><b>' + esc(s.name) + '</b><span>' + esc(s.note) + ' · 冇金額</span></li>';
      }).join('');
      var paper = paperBlock(stub);
      var trend = '<div class="snap"><p class="snap-k">最新快照</p><p class="snap-v ' + cls(sum.dayPct) + '">' +
        esc(pct(sum.dayPct, 2)) + '</p><p class="snap-s">' + esc(sum.dayHkd == null ? '' : money(sum.dayHkd, 2)) +
        ' · ' + esc(when) + '</p><p class="note">未有多日 NAV 序列，所以唔畫走勢，只顯示呢個快照同當日變化。</p></div>';
      $('cardSide').innerHTML =
        '<h2>資產類別</h2><p class="note">市值由 NAV × 權重反推。</p>' +
        '<div class="chart-split chart-split-side">' +
          donut(kindSlices, {
            titleId: 'kindTitle',
            descId: 'kindDesc',
            title: '資產類別',
            desc: kindDesc,
            centerK: kindSlices[0] ? kindSlices[0].label : '類別',
            centerV: kindSlices[0] ? kindSlices[0].weight.toFixed(0) + '%' : ''
          }) +
          legend(kindSlices) +
        '</div>' + trend +
        '<h2 class="next">快照未列</h2><ul class="sleeves">' + sleeves + '</ul>' +
        paper;

      var fx = sum.fx ? (' · FX ' + sum.fx) : '';
      $('foot').innerHTML = '實倉／Sheet DEMO · ' + esc(sum.label || 'Sheet') + fx +
        ' · 紙上 DEMO 唔計入 NAV · <a href="../invest/">去投資平台</a> · 模擬 ≠ 實盤 · 真倉自動 OFF · 唔構成投資建議';
    }

    function paperBlock(stub) {
      if (!stub) return '';
      var names = stub.open_positions ? Object.keys(stub.open_positions) : [];
      var capital = stub.starting_capital != null ? stub.starting_capital : stub.equity;
      return '<aside class="paper"><p class="paper-k">紙上 DEMO US$' + esc(Number(capital || 0).toLocaleString('en-US')) +
        '</p><p class="note">呢格先至係紙上帳，唔係上面嘅 Sheet NAV。交易去投資平台。</p><dl>' +
        '<div><dt>權益</dt><dd>' + esc(usd(stub.equity, 2)) + '</dd></div>' +
        '<div><dt>現金</dt><dd>' + esc(usd(stub.cash, 2)) + '</dd></div>' +
        '<div><dt>已投入</dt><dd>' + esc(usd(stub.invested_notional, 2)) + '</dd></div>' +
        '<div><dt>當日</dt><dd>' + esc(pct(stub.day_pnl_pct, 2)) + '</dd></div>' +
        '</dl><p class="paper-pos">持倉 ' + esc(names.length ? names.join('、') : '未列') +
        '</p><a class="go" href="../invest/">去投資平台做紙上交易</a></aside>';
    }

    Promise.all([
      load('../invest/data/snapshot.json'),
      load('data/sheet-holdings.json'),
      load('../invest/data/stub.json').catch(function () { return null; })
    ]).then(function (rows) {
      var picked = W.pickSheet(rows[0], rows[1]);
      if (!picked.book) {
        $('sourceNote').textContent = '已發布快照未列個人 NAV 同權重，所以唔畫假圖。';
        return;
      }
      render(picked.book, picked, rows[2]);
    }).catch(function () {
      $('sourceNote').textContent = '快照載入失敗。唔顯示估計餘額。';
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var KIND_OVERRIDE = { '01211.HK': 'Stock' };
  var KIND_LABEL = { ETF: 'ETF', Stock: '股票', Fund: '基金' };
  var KIND_COLOR = { ETF: '#3E92D0', '股票': '#E2A31A', '基金': '#9A6AD0', '未列權重': '#C4B39A' };
  var BROKER_NAME = {
    HSBC: 'HSBC Invest',
    Tiger: 'Tiger',
    'Futu 1061': '富途 1061',
    'Futu 8035': '富途 8035',
    SoFi: 'SoFi'
  };
  var BROKER_NOTE = {
    HSBC: '01211／02800 待轉富途',
    Tiger: 'ORCL／QQQ／VOO／SPCX',
    'Futu 1061': '現金戶',
    'Futu 8035': '孖展',
    SoFi: 'RSSS'
  };
  var BROKER_COLOR = {
    HSBC: '#3E86C4',
    Tiger: '#E08A28',
    'Futu 1061': '#2EAA96',
    'Futu 8035': '#6A9A48',
    SoFi: '#9A6AD0'
  };
  var SYMBOL_NAME = {
    '02800.HK': '盈富',
    '01211.HK': '比亞迪',
    '00005.HK': '匯豐',
    '00939.HK': '建行',
    QQQ: '納指 100',
    VOO: '標普 500',
    ORCL: '甲骨文',
    SPCX: 'SPCX',
    SDIV: '全球高息',
    RSSS: 'RSSS'
  };
  var UNLISTED = [
    { name: 'ZA Invest', note: '大成基金 · 快照未列' },
    { name: '保誠', note: 'Prudential · 快照未列' },
    { name: '強積金', note: 'MPF · 快照未列' },
    { name: 'Mox', note: '已關閉' }
  ];
  var COLOR_FALLBACK = ['#3E86C4', '#E08A28', '#2EAA96', '#6A9A48', '#9A6AD0', '#E15D5D'];

  function kindOf(sym) {
    return KIND_OVERRIDE[sym.symbol] || sym.kind || 'Stock';
  }
  function kindLabel(k) {
    return KIND_LABEL[k] || k || '其他';
  }
  function brokerName(account) {
    return BROKER_NAME[account] || account || '其他';
  }
  function symbolName(symbol) {
    return SYMBOL_NAME[symbol] || symbol;
  }
  function hasBook(snap) {
    if (!snap || typeof snap.nav_hkd !== 'number' || !(snap.nav_hkd > 0)) return false;
    if (!Array.isArray(snap.symbols) || !snap.symbols.length) return false;
    return snap.symbols.some(function (s) {
      return s && typeof s.weight_pct === 'number' && s.weight_pct > 0 && s.account && s.account !== 'MARKET';
    });
  }
  function pickSheet(snapshot, archived) {
    if (hasBook(snapshot)) {
      return { book: snapshot, marketOnly: false, source: 'invest/data/snapshot.json' };
    }
    if (hasBook(archived)) {
      return { book: archived, marketOnly: true, source: 'wealth/data/sheet-holdings.json' };
    }
    return { book: null, marketOnly: true, source: '' };
  }
  function summarize(sheet) {
    var symbols = (sheet && sheet.symbols) || [];
    var nav = Number(sheet && sheet.nav_hkd) || 0;
    var used = 0;
    var positions = symbols.filter(function (s) { return s && s.symbol; }).map(function (s) {
      var weight = Number(s.weight_pct) || 0;
      used += weight;
      var kind = kindOf(s);
      return {
        symbol: s.symbol,
        name: symbolName(s.symbol),
        account: s.account || '其他',
        broker: brokerName(s.account),
        brokerNote: BROKER_NOTE[s.account] || '',
        currency: s.currency || '',
        price: Number(s.price) || 0,
        dayPct: Number(s.day_pct) || 0,
        weight: weight,
        value: nav * weight / 100,
        kind: kind,
        kindLabel: kindLabel(kind),
        contrib: weight / 100 * (Number(s.day_pct) || 0)
      };
    });
    positions.sort(function (a, b) { return b.weight - a.weight; });
    var residual = Math.max(0, 100 - used);
    var brokers = {};
    var brokerOrder = [];
    var kinds = {};
    var kindOrder = [];
    positions.forEach(function (p) {
      if (!brokers[p.account]) {
        brokers[p.account] = {
          account: p.account,
          label: p.broker,
          note: p.brokerNote,
          weight: 0,
          value: 0,
          color: BROKER_COLOR[p.account] || COLOR_FALLBACK[brokerOrder.length % COLOR_FALLBACK.length]
        };
        brokerOrder.push(p.account);
      }
      brokers[p.account].weight += p.weight;
      brokers[p.account].value += p.value;
      var kl = p.kindLabel;
      if (!kinds[kl]) {
        kinds[kl] = { label: kl, weight: 0, value: 0, color: KIND_COLOR[kl] || '#B79F80' };
        kindOrder.push(kl);
      }
      kinds[kl].weight += p.weight;
      kinds[kl].value += p.value;
    });
    var brokerRows = brokerOrder.map(function (k) { return brokers[k]; });
    brokerRows.sort(function (a, b) { return b.value - a.value; });
    var kindRows = kindOrder.map(function (k) { return kinds[k]; });
    if (residual > 0.05) {
      kindRows.push({
        label: '未列權重',
        weight: residual,
        value: nav * residual / 100,
        color: KIND_COLOR['未列權重'],
        unlisted: true
      });
    }
    var dayPct = sheet && sheet.day_pnl_pct_portfolio != null
      ? Number(sheet.day_pnl_pct_portfolio)
      : Number(sheet && sheet.day_pnl_pct);
    var cashField = null;
    if (sheet && typeof sheet.cash_hkd === 'number') cashField = sheet.cash_hkd;
    return {
      nav: nav,
      dayPct: dayPct,
      dayHkd: sheet && typeof sheet.day_pnl_hkd === 'number' ? sheet.day_pnl_hkd : null,
      fx: sheet && sheet.fx_usd_hkd,
      asOf: (sheet && (sheet.stamp_hkt || sheet.as_of)) || '',
      sourceText: (sheet && sheet.source) || '',
      notes: (sheet && sheet.notes) || '',
      label: (sheet && sheet.label) || '',
      usedWeight: used,
      residualWeight: residual,
      invested: nav * used / 100,
      cashListed: cashField != null,
      cashHkd: cashField,
      positions: positions,
      brokers: brokerRows,
      kinds: kindRows
    };
  }

  return {
    UNLISTED: UNLISTED,
    hasBook: hasBook,
    pickSheet: pickSheet,
    summarize: summarize,
    brokerName: brokerName,
    symbolName: symbolName
  };
});
