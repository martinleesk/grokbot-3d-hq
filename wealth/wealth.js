/* Personal wealth summary.
   Investments stay Sheet DEMO holdings — never invent balances.
   If invest/data/snapshot.json is a market watchlist without weights, the
   page keeps the last published Sheet book in data/sheet-holdings.json.
   Cashflow is a separate real book from wealth/data/cashflow.json
   (財務管家). Empty transactions stay an empty state. Transfers are not
   income or expense. Nothing here is added to Sheet NAV or the paper book. */
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

    var cashBook = null;
    function paintCash(period) {
      var sum = W.summarizeCashflow(cashBook, period);
      var meta = $('cashMeta');
      if (meta) {
        if (sum.missing) meta.textContent = '未讀到 wealth/data/cashflow.json。唔顯示估計金額。';
        else if (sum.blocked) meta.textContent = '只接受 HKD。呢份檔唔係 HKD，所以唔加總。';
        else {
          var bits = ['真實記帳（財務管家）'];
          if (sum.source) bits.push(sum.source);
          if (sum.asOf) bits.push(fmtTs(sum.asOf));
          bits.push(sum.empty ? '未有真實流水' : (sum.viewCount + ' 筆'));
          if (!sum.empty && sum.months && sum.months.length) {
            bits.push(sum.period === 'all'
              ? (sum.months[0] + ' 至 ' + sum.months[sum.months.length - 1])
              : sum.period);
          }
          bits.push('唔計入 Sheet NAV');
          meta.textContent = bits.join(' · ');
        }
      }
      var sel = $('cashPeriod');
      if (sel) {
        var opts = sum.periodOptions || [];
        if (!opts.length) {
          sel.innerHTML = '<option value="">未有期間</option>';
          sel.disabled = true;
        } else {
          sel.disabled = false;
          sel.innerHTML = opts.map(function (o) {
            return '<option value="' + esc(o.value) + '"' + (o.selected ? ' selected' : '') + '>' + esc(o.label) + '</option>';
          }).join('');
        }
      }
      var gapsEl = $('cashGaps');
      if (gapsEl) {
        var gapRows = sum.gaps || [];
        if (gapRows.length) {
          gapsEl.hidden = false;
          gapsEl.innerHTML = gapRows.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('');
        } else {
          gapsEl.hidden = true;
          gapsEl.innerHTML = '';
        }
      }
      var body = $('cashBody');
      if (body) body.innerHTML = W.cashflowMarkup(sum);
    }
    var periodSel = $('cashPeriod');
    if (periodSel) {
      periodSel.addEventListener('change', function () { paintCash(periodSel.value); });
    }

    function render(sheet, picked, stub) {
      var sum = W.summarize(sheet);
      var when = fmtTs(sum.asOf);
      $('when').textContent = when || '時間未列';
      var note = picked.marketOnly
        ? '最新 invest/data/snapshot.json 係市場報價，未列個人 NAV 同權重。圖表用上次已發布 Sheet DEMO 持倉（' +
          (when || sum.asOf) + '），唔用市價砌假餘額。'
        : '圖表讀 ' + picked.source + ' 嘅 Sheet DEMO 持倉。真倉自動 OFF，呢度唔係券商即時餘額。';
      $('sourceNote').textContent = '投資 · Sheet DEMO 持倉 · ' + note;
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
          weight: k.weight,
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
      $('foot').innerHTML = '投資 · Sheet DEMO · ' + esc(sum.label || 'Sheet') + fx +
        ' · 收支 · 真實記帳（財務管家）唔計入 NAV · 紙上 DEMO 另計 · <a href="../invest/">去投資平台</a> · 模擬 ≠ 實盤 · 真倉自動 OFF · 唔構成投資建議';
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

    function loadOr(url) {
      return load(url).catch(function () { return null; });
    }
    Promise.all([
      loadOr('../invest/data/snapshot.json'),
      loadOr('data/sheet-holdings.json'),
      loadOr('../invest/data/stub.json'),
      loadOr('data/cashflow.json')
    ]).then(function (rows) {
      var picked = W.pickSheet(rows[0], rows[1]);
      try {
        if (!rows[0] && !rows[1]) {
          $('sourceNote').textContent = '投資 · 快照載入失敗。唔顯示估計餘額。';
        } else if (!picked.book) {
          $('sourceNote').textContent = '投資 · 已發布快照未列個人 NAV 同權重，所以唔畫假圖。';
        } else {
          render(picked.book, picked, rows[2]);
        }
      } catch (err) {
        $('sourceNote').textContent = '投資 · 快照載入失敗。唔顯示估計餘額。';
      }
      cashBook = rows[3];
      paintCash('all');
    }).catch(function () {
      $('sourceNote').textContent = '投資 · 快照載入失敗。唔顯示估計餘額。';
      cashBook = null;
      paintCash();
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

  var CASH_KIND = { bank: '銀行', card: '卡', wallet: '錢包', other: '其他' };

  function xml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function hkd(n) {
    if (n == null || !isFinite(Number(n))) return '未有';
    var v = Number(n);
    var neg = v < 0;
    var cents = Math.round(Math.abs(v) * 100) % 100;
    var d = cents === 0 ? 0 : 2;
    var parts = Math.abs(v).toFixed(d).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '−' : '') + 'HK$' + parts.join('.');
  }
  function monthLabel(ym) {
    var p = String(ym || '').split('-');
    if (p.length < 2 || !/^\d{4}$/.test(p[0]) || !/^\d{2}$/.test(p[1])) return String(ym || '');
    return p[0] + '年' + String(Number(p[1])) + '月';
  }
  function blankCash(extra) {
    var base = {
      missing: false,
      blocked: false,
      empty: true,
      periodEmpty: false,
      asOf: '',
      currency: 'HKD',
      source: '',
      sheetId: '',
      gaps: [],
      period: '',
      periodOptions: [],
      months: [],
      skipped: 0,
      income: null,
      expense: null,
      transfer: null,
      net: null,
      accounts: [],
      categories: [],
      recent: [],
      totalRows: 0,
      viewCount: 0
    };
    if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }
  function barWidth(value, max) {
    if (!(value > 0) || !(max > 0)) return 0;
    return Math.max(2, value / max * 100);
  }
  function vsRow(label, width, meta, color) {
    return '<div class="vs-row"><span>' + xml(label) + '</span><div class="track" role="presentation"><div class="fill" style="width:' +
      Number(width).toFixed(1) + '%;background:' + color + '"></div></div><b>' + xml(meta) + '</b></div>';
  }
  function skippedNote(n) {
    if (!n) return '';
    return '<p class="note">略過 ' + n + ' 筆（要有 YYYY-MM-DD、正數 amountHkd，同 income／expense／transfer）。</p>';
  }
  function flowBody(s) {
    if (s.missing) return '<p class="empty-stamp">未讀到記帳檔。唔顯示估計金額。</p>';
    if (s.blocked) return '<p class="empty-stamp">只接受 HKD。未加總。</p>';
    if (s.income == null) {
      var emptyLabel = s.empty ? '未有真實流水' : '呢段期間未有真實流水';
      return '<p class="empty-stamp">' + emptyLabel + '</p><div class="vs" role="img" aria-label="' + emptyLabel + '">' +
        vsRow('收入', 0, '未有', '#2EAA96') +
        vsRow('支出', 0, '未有', '#C46A4A') +
        vsRow('轉帳（另計）', 0, '未有', '#3E92D0') +
        '</div>' + skippedNote(s.skipped);
    }
    var max = Math.max(s.income, s.expense, s.transfer, 0);
    var label = '收入 ' + hkd(s.income) + '，支出 ' + hkd(s.expense) + '，淨額 ' + hkd(s.net) + '，轉帳 ' + hkd(s.transfer) + ' 唔計入淨額';
    return '<div class="vs" role="img" aria-label="' + xml(label) + '">' +
      vsRow('收入', barWidth(s.income, max), hkd(s.income), '#2EAA96') +
      vsRow('支出', barWidth(s.expense, max), hkd(s.expense), '#C46A4A') +
      vsRow('轉帳（另計）', barWidth(s.transfer, max), hkd(s.transfer), '#3E92D0') +
      '</div><p class="net-line">淨額 ' + xml(hkd(s.net)) + ' · 收入減支出 · 轉帳唔計入淨額</p>' +
      skippedNote(s.skipped);
  }
  function accountBody(s) {
    if (s.income == null || !s.accounts.length) return '<p class="empty-stamp">未有真實流水</p>';
    var max = 0;
    s.accounts.forEach(function (a) { max = Math.max(max, a.income, a.expense); });
    return '<div class="acct-list">' + s.accounts.map(function (a) {
      var kind = CASH_KIND[a.kind] || '';
      return '<div class="acct"><div class="bar-meta"><span>' + xml(a.label) +
        (kind ? '<small> ' + xml(kind) + '</small>' : '') + '</span><b>淨 ' + xml(hkd(a.net)) +
        '</b></div><div class="track" role="presentation"><div class="fill" style="width:' +
        barWidth(a.income, max).toFixed(1) + '%;background:#2EAA96"></div></div><div class="track track-second" role="presentation"><div class="fill" style="width:' +
        barWidth(a.expense, max).toFixed(1) + '%;background:#C46A4A"></div></div><p class="note">收入 ' +
        xml(hkd(a.income)) + ' · 支出 ' + xml(hkd(a.expense)) + ' · 轉帳 ' + xml(hkd(a.transfer)) + '</p></div>';
    }).join('') + '</div>';
  }
  function catBody(s) {
    if (s.income == null) return '<p class="empty-stamp">未有真實流水</p>';
    if (!s.categories.length) return '<p class="empty-stamp">未有收入或支出類別</p><p class="note">轉帳唔入類別淨額。</p>';
    var max = 0;
    s.categories.forEach(function (c) { if (c.amount > max) max = c.amount; });
    return '<div class="bars">' + s.categories.map(function (c) {
      var color = c.type === 'income' ? '#2EAA96' : '#C46A4A';
      var tag = c.type === 'income' ? '收入' : '支出';
      return '<div class="bar-row"><div class="bar-meta"><span>' + xml(tag + ' · ' + c.label) + '</span><b>' +
        xml(hkd(c.amount)) + '</b></div><div class="track" role="presentation"><div class="fill" style="width:' +
        barWidth(c.amount, max).toFixed(1) + '%;background:' + color + '"></div></div></div>';
    }).join('') + '</div><p class="note">轉帳唔入類別淨額。</p>';
  }
  function txBody(s) {
    var head = '<table><thead><tr><th>日期</th><th>方向</th><th>類別</th><th>說明</th><th>戶口</th><th class="num">金額</th></tr></thead>';
    if (s.missing) return head + '<tbody><tr><td class="empty-cell" colspan="6">未讀到記帳檔。唔顯示估計金額。</td></tr></tbody></table>';
    if (s.income == null || !s.recent.length) {
      return head + '<tbody><tr><td class="empty-cell" colspan="6">' + (s.empty ? '未有真實流水' : '呢段期間未有真實流水') + '</td></tr></tbody></table>';
    }
    var typeLabel = { income: '收入', expense: '支出', transfer: '轉帳' };
    var typeClass = { income: 'tag-in', expense: 'tag-out', transfer: 'tag-move' };
    return '<div class="tx-scroll"><table><caption>真實記帳。金額係正數，方向睇類型。轉帳唔計入淨額。</caption><thead><tr><th>日期</th><th>方向</th><th>類別</th><th>說明</th><th>戶口</th><th class="num">金額</th></tr></thead><tbody>' +
      s.recent.map(function (r) {
        var note = r.note ? '<small>' + xml(r.note) + '</small>' : '';
        return '<tr><td>' + xml(r.date) + '</td><td><span class="tag ' + typeClass[r.type] + '">' + typeLabel[r.type] +
          '</span></td><td>' + xml(r.category) + '</td><td>' + xml(r.description) + note + '</td><td>' + xml(r.account) +
          '</td><td class="num">' + xml(hkd(r.amount)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function cashKpis(s) {
    var items;
    if (s.income == null) {
      items = [
        { k: '收入', v: '未有', s: '未有真實流水', cls: '' },
        { k: '支出', v: '未有', s: '未有真實流水', cls: '' },
        { k: '淨額', v: '未有', s: '收入 − 支出', cls: '' },
        { k: '轉帳', v: '未有', s: '唔計入淨額', cls: 'kpi-transfer' }
      ];
    } else {
      items = [
        { k: '收入', v: hkd(s.income), s: '真實記帳', cls: '' },
        { k: '支出', v: hkd(s.expense), s: '真實記帳', cls: '' },
        { k: '淨額', v: hkd(s.net), s: '未計轉帳', cls: s.net < 0 ? 'down' : (s.net > 0 ? 'ok' : '') },
        { k: '轉帳', v: hkd(s.transfer), s: '唔計入淨額', cls: 'kpi-transfer' }
      ];
    }
    return items.map(function (c) {
      var valueCls = c.cls === 'kpi-transfer' ? '' : c.cls;
      var artCls = c.cls === 'kpi-transfer' ? ' kpi-transfer' : '';
      return '<article class="kpi' + artCls + '"><h3>' + xml(c.k) + '</h3><p class="kpi-value ' + valueCls + '">' +
        xml(c.v) + '</p><p class="kpi-sub">' + xml(c.s) + '</p></article>';
    }).join('');
  }
  function cashCard(id, aria, title, note, body) {
    return '<section class="card" id="' + id + '" aria-label="' + xml(aria) + '"><h2>' + xml(title) +
      '</h2><p class="note">' + xml(note) + '</p>' + body + '</section>';
  }
  function cashflowMarkup(s) {
    s = s || blankCash({ missing: true });
    return '<div class="cash-kpis" aria-label="收支指標">' + cashKpis(s) + '</div><div class="cash-grid">' +
      cashCard('cardFlow', '收入對支出', '收入對支出', '淨額 = 收入 − 支出。轉帳另計。', flowBody(s)) +
      cashCard('cardAccounts', '戶口', '戶口', '綠條係收入，橙條係支出。轉帳寫喺下面。', accountBody(s)) +
      cashCard('cardCats', '類別', '類別', '只計收入同支出。', catBody(s)) +
      cashCard('cardTx', '最近流水', '最近流水', '財務管家匯出之後先有行。', txBody(s)) +
      '</div>';
  }
  function summarizeCashflow(book, period) {
    if (!book || typeof book !== 'object' || Array.isArray(book)) return blankCash({ missing: true });
    var gaps = Array.isArray(book.gaps) ? book.gaps.filter(function (g) {
      return g != null && String(g).trim();
    }).map(function (g) { return String(g); }) : [];
    var meta = {
      asOf: book.asOf || '',
      currency: book.currency || '',
      source: book.source || '',
      sheetId: book.sheetId || ''
    };
    if (book.currency && book.currency !== 'HKD') {
      return blankCash({
        blocked: true,
        asOf: meta.asOf,
        currency: meta.currency,
        source: meta.source,
        sheetId: meta.sheetId,
        gaps: gaps.concat(['currency 唔係 HKD，已拒絕加總。'])
      });
    }
    if (!Array.isArray(book.transactions)) gaps = gaps.concat(['transactions 唔係陣列，當未有流水。']);
    var accountById = {};
    (Array.isArray(book.accounts) ? book.accounts : []).forEach(function (a) {
      if (a && a.id != null) accountById[String(a.id)] = a;
    });
    var raw = Array.isArray(book.transactions) ? book.transactions : [];
    var skipped = 0;
    var rows = [];
    raw.forEach(function (t, i) {
      if (!t || typeof t !== 'object') { skipped++; return; }
      var type = t.type;
      if (type !== 'income' && type !== 'expense' && type !== 'transfer') { skipped++; return; }
      if (typeof t.amountHkd !== 'number' || !isFinite(t.amountHkd) || t.amountHkd < 0) { skipped++; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ''))) { skipped++; return; }
      var id = t.accountId != null ? String(t.accountId) : '';
      var acc = accountById[id];
      var named = t.account != null && String(t.account).trim();
      rows.push({
        id: t.id != null && String(t.id) ? String(t.id) : ('row-' + i),
        date: String(t.date),
        month: String(t.date).slice(0, 7),
        type: type,
        category: t.category != null && String(t.category).trim() ? String(t.category) : '未分類',
        description: t.description != null ? String(t.description) : '',
        accountId: id,
        account: named ? String(t.account) : ((acc && acc.label) || id || '未列戶口'),
        kind: (acc && acc.kind) || '',
        amount: t.amountHkd,
        note: t.note != null ? String(t.note) : ''
      });
    });
    var seen = {};
    var months = [];
    rows.forEach(function (r) {
      if (!seen[r.month]) { seen[r.month] = true; months.push(r.month); }
    });
    months.sort();
    var chosen = (period == null || period === '') ? (months.length ? months[months.length - 1] : '') : String(period);
    if (chosen !== 'all' && chosen && !seen[chosen]) chosen = months.length ? months[months.length - 1] : '';
    var view = rows.filter(function (r) { return !chosen || chosen === 'all' || r.month === chosen; });
    var income = 0;
    var expense = 0;
    var transfer = 0;
    var byAcc = {};
    var accOrder = [];
    view.forEach(function (r) {
      if (r.type === 'income') income += r.amount;
      else if (r.type === 'expense') expense += r.amount;
      else transfer += r.amount;
      var key = r.accountId || ('name:' + r.account);
      if (!byAcc[key]) {
        byAcc[key] = { id: key, label: r.account, kind: r.kind, income: 0, expense: 0, transfer: 0, net: 0 };
        accOrder.push(key);
      }
      byAcc[key][r.type] += r.amount;
    });
    var accountRows = accOrder.map(function (k) {
      var a = byAcc[k];
      a.net = a.income - a.expense;
      return a;
    });
    accountRows.sort(function (a, b) {
      return (b.income + b.expense + b.transfer) - (a.income + a.expense + a.transfer);
    });
    var byCat = {};
    var catOrder = [];
    view.forEach(function (r) {
      if (r.type === 'transfer') return;
      var ck = r.type + '\u0000' + r.category;
      if (!byCat[ck]) {
        byCat[ck] = { type: r.type, label: r.category, amount: 0 };
        catOrder.push(ck);
      }
      byCat[ck].amount += r.amount;
    });
    var catRows = catOrder.map(function (k) { return byCat[k]; });
    catRows.sort(function (a, b) { return b.amount - a.amount; });
    var recent = view.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if (a.id !== b.id) return a.id < b.id ? 1 : -1;
      return 0;
    });
    var show = view.length > 0;
    var periodOptions = months.slice().reverse().map(function (m) {
      return { value: m, label: monthLabel(m), selected: m === chosen };
    });
    if (months.length) periodOptions.push({ value: 'all', label: '全部已記', selected: chosen === 'all' });
    return {
      missing: false,
      blocked: false,
      empty: rows.length === 0,
      periodEmpty: rows.length > 0 && view.length === 0,
      asOf: meta.asOf,
      currency: book.currency || 'HKD',
      source: meta.source,
      sheetId: meta.sheetId,
      gaps: gaps,
      period: chosen,
      periodOptions: periodOptions,
      months: months,
      skipped: skipped,
      income: show ? income : null,
      expense: show ? expense : null,
      transfer: show ? transfer : null,
      net: show ? (income - expense) : null,
      accounts: show ? accountRows : [],
      categories: show ? catRows : [],
      recent: show ? recent : [],
      totalRows: rows.length,
      viewCount: view.length
    };
  }

  return {
    UNLISTED: UNLISTED,
    hasBook: hasBook,
    pickSheet: pickSheet,
    summarize: summarize,
    brokerName: brokerName,
    symbolName: symbolName,
    summarizeCashflow: summarizeCashflow,
    cashflowMarkup: cashflowMarkup
  };
});
