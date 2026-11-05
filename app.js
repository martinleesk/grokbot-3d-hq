(function () {
  'use strict';

  var ZONES = window.HQ_DATA.zones;
  var FLOOR_PITCH = 1.48;
  var FEEDS = window.HQ_DATA.feedTemplates;
  var FOLLOWUPS = window.HQ_DATA.followUps || {};
  var selectedZone = 'cmd';
  var selectedStaffId = null;
  var botMeshes = [];
  var zoneRoots = {};
  var screenMats = [];
  var particles = null;
  var mode = '3d';
  var directory = null;
  var reportsData = null;
  var reportsActiveId = null;
  var liveData = null;
  var lifeLayout = null;
  var liveUpdatedStamp = null;
  var livePollTimer = null;
  var liveRelativeTimer = null;
  var feedFakeTimer = null;
  var feedUsingLive = false;
  var changelogData = null;
  var doneFollow = loadDoneFollow();

  /* 3D runtime handles for dispose */
  var runtime3d = null;

  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (isTouch) {
    var lt = document.getElementById('liveText');
    if (lt) lt.textContent = 'LIVE';
  }

  function $(id) { return document.getElementById(id); }

  function floorInfo(zone) {
    var level = zone && zone.level ? zone.level : 1;
    return { level: level, short: (zone && zone.short) || (zone && zone.name) || '', code: 'L' + level };
  }

  function findZone(id) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return ZONES[0];
  }

  function findStaff(zone, staffId) {
    for (var i = 0; i < zone.staff.length; i++) if (zone.staff[i].id === staffId) return zone.staff[i];
    return zone.staff[0];
  }

  function centerStaff(zone) {
    if (!zone || !zone.staff) return null;
    for (var i = 0; i < zone.staff.length; i++) {
      if (zone.staff[i] && zone.staff[i].center) return zone.staff[i];
    }
    return null;
  }

  function centerStatus(staff) {
    if (!staff) return '';
    var status = staff.status || '';
    var focus = liveData && liveData.focus;
    if (focus) {
      for (var i = 0; i < focus.length; i++) {
        var f = focus[i];
        if (f && f.staffId === staff.id && f.detail) return String(f.detail);
      }
    }
    return status;
  }

  var CENTER_ZONE_ORDER = { sys: 0, invest: 1, content: 2 };

  function centerRows() {
    var rows = [];
    ZONES.forEach(function (z) {
      var staff = centerStaff(z);
      if (!staff) return;
      rows.push({ zone: z, staff: staff, status: centerStatus(staff) });
    });
    rows.sort(function (a, b) {
      var oa = CENTER_ZONE_ORDER[a.zone.id];
      var ob = CENTER_ZONE_ORDER[b.zone.id];
      if (oa == null) oa = 9;
      if (ob == null) ob = 9;
      return oa - ob;
    });
    return rows;
  }

  function renderCenterStrip() {
    var el = $('centerStrip');
    if (!el) return;
    var rows = centerRows();
    el.innerHTML = '';
    var kicker = document.createElement('div');
    kicker.className = 'center-kicker';
    kicker.textContent = '共用基建';
    el.appendChild(kicker);
    rows.forEach(function (row) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'center-line';
      var name = document.createElement('span');
      name.className = 'cn';
      name.textContent = row.staff.name;
      var st = document.createElement('span');
      st.className = 'cs';
      st.textContent = row.status;
      btn.appendChild(name);
      btn.appendChild(st);
      btn.addEventListener('click', function () {
        selectZone(row.zone.id, row.staff.id, { toast: true, openDrawer: true });
      });
      el.appendChild(btn);
    });
  }

  function paintFloorRailCenters() {
    document.querySelectorAll('.floor-btn').forEach(function (btn) {
      var zone = findZone(btn.dataset.id);
      var center = centerStaff(zone);
      var old = btn.querySelector('.floor-center');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      if (!center) {
        if (btn.title && btn.title.indexOf(' · ') >= 0) btn.removeAttribute('title');
        return;
      }
      var span = document.createElement('span');
      span.className = 'floor-center';
      span.textContent = center.mark || center.name;
      btn.appendChild(span);
      btn.title = center.name + ' · ' + centerStatus(center);
    });
  }

  function findStaffAnywhere(staffId) {
    for (var i = 0; i < ZONES.length; i++) {
      for (var j = 0; j < ZONES[i].staff.length; j++) {
        if (ZONES[i].staff[j].id === staffId) return { zone: ZONES[i], staff: ZONES[i].staff[j] };
      }
    }
    return null;
  }

  function pageUrl(p) {
    if (p.url) return p.url;
    var base = (directory && directory.baseUrl) || 'https://cursor.com/canvas/store-cfbe74cb-3f1b-4f2f-b2de-5dd12c81d557/';
    return base + p.canvas_id;
  }

  function loadDoneFollow() {
    try {
      var raw = localStorage.getItem('hq3d_follow_done');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveDoneFollow() {
    try { localStorage.setItem('hq3d_follow_done', JSON.stringify(doneFollow)); } catch (e) {}
  }
  function isFollowDone(id) { return !!doneFollow[id]; }
  function setFollowDone(id, val) {
    if (val) doneFollow[id] = true; else delete doneFollow[id];
    saveDoneFollow();
  }

  /* Phase A drawers use a new key so old hq3d_panel_* = open does not pop the glass boxes back. */
  function loadPanelState(key, fallback) {
    try {
      var v = localStorage.getItem('hq3d_drawer_' + key);
      if (v === null || v === undefined) return fallback;
      return v === '1';
    } catch (e) { return fallback; }
  }
  function savePanelState(key, open) {
    try { localStorage.setItem('hq3d_drawer_' + key, open ? '1' : '0'); } catch (e) {}
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var stack = $('toastStack');
    if (!stack) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3500);
  }

  /* ---------- UI ---------- */
  function buildNav() {
    var nav = $('zoneNav');
    nav.innerHTML = '';
    ZONES.forEach(function (z) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-btn' + (z.id === selectedZone ? ' active' : '');
      btn.dataset.id = z.id;
      var center = centerStaff(z);
      btn.innerHTML = '<span class="swatch" style="background:' + z.color + ';color:' + z.color + '"></span>' +
        '<span><div class="name">' + z.name + '</div><div class="meta">' + z.staff.length + ' 代理人 · ' + z.en +
        (center ? ' · ' + center.name : '') + '</div></span>';
      btn.addEventListener('click', function () { selectZone(z.id, null, { toast: true, openDrawer: true }); });
      nav.appendChild(btn);
    });
  }

  function followItemsFor(staffId) {
    return FOLLOWUPS[staffId] || [];
  }

  function relatedPages(staffId, zoneId) {
    if (!directory || !directory.pages) return [];
    return directory.pages.filter(function (p) {
      var staffHit = staffId && p.staffIds && p.staffIds.indexOf(staffId) >= 0;
      var zoneHit = zoneId && p.zoneIds && p.zoneIds.indexOf(zoneId) >= 0;
      return staffHit || (staffHit === false && zoneHit && !staffId);
    }).concat(directory.pages.filter(function (p) {
      // also zone-only related if staff match empty
      return false;
    })).filter(function (p, i, arr) {
      return arr.indexOf(p) === i;
    });
  }

  function relatedPagesSmart(staffId, zoneId) {
    if (!directory || !directory.pages) return [];
    var out = [];
    var seen = {};
    directory.pages.forEach(function (p) {
      var hit = (staffId && p.staffIds && p.staffIds.indexOf(staffId) >= 0) ||
        (!staffId && zoneId && p.zoneIds && p.zoneIds.indexOf(zoneId) >= 0);
      if (hit && !seen[p.canvas_id]) { seen[p.canvas_id] = true; out.push(p); }
    });
    if (!out.length && zoneId) {
      directory.pages.forEach(function (p) {
        if (p.zoneIds && p.zoneIds.indexOf(zoneId) >= 0 && !seen[p.canvas_id]) {
          seen[p.canvas_id] = true; out.push(p);
        }
      });
    }
    return out;
  }

  function renderChecklist(container, staffId, withToast) {
    if (!container) return;
    var items = followItemsFor(staffId);
    if (!items.length) {
      container.innerHTML = '<li class="empty">暫無跟進事項</li>';
      return;
    }
    container.innerHTML = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var done = isFollowDone(it.id);
      if (done) li.classList.add('done');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = done;
      cb.addEventListener('change', function () {
        setFollowDone(it.id, cb.checked);
        li.classList.toggle('done', cb.checked);
        if (cb.checked && withToast) toast('已完成跟進：' + it.text);
        // sync other checklists
        syncFollowUI(staffId);
      });
      var span = document.createElement('span');
      span.textContent = it.text;
      li.appendChild(cb);
      li.appendChild(span);
      container.appendChild(li);
    });
  }

  function syncFollowUI(staffId) {
    var detail = $('detailFollow');
    if (detail && selectedStaffId === staffId) {
      var list = detail.querySelector('.checklist');
      if (list) renderChecklist(list, staffId, true);
    }
    var modalList = $('modalFollow');
    if (modalList && $('modalBackdrop') && !$('modalBackdrop').hidden) {
      renderChecklist(modalList, staffId, true);
    }
  }

  function renderDetailFollow(staffId) {
    var wrap = $('detailFollow');
    if (!wrap) return;
    var items = followItemsFor(staffId);
    if (!items.length) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = '<h4>跟進事項</h4><ul class="checklist"></ul>';
    renderChecklist(wrap.querySelector('.checklist'), staffId, true);
  }

  function renderDetail(zoneId, staffId) {
    var zone = findZone(zoneId);
    var staff = findStaff(zone, staffId || (zone.staff[0] && zone.staff[0].id));
    selectedZone = zone.id;
    selectedStaffId = staff.id;

    document.querySelectorAll('.zone-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.id === zone.id);
    });

    var panel = $('detailPanel');
    panel.classList.add('open');
    if (panel.classList.contains('collapsed')) {
      // keep collapsed state but still update data
    }
    $('detailZone').textContent = floorInfo(zone).code + ' · ' + zone.name + ' · ' + zone.en;
    $('detailName').textContent = staff.name;
    $('detailDesc').textContent = staff.role + ' — ' + zone.desc;
    $('detailBadge').textContent = staff.status;
    $('detailBadge').className = 'badge ' + (staff.status.indexOf('待機') >= 0 || staff.status.indexOf('待命') >= 0 ? 'warn' : 'ok');

    var av = $('detailAvatar');
    av.textContent = staff.name.slice(0, 1);

    var metrics = $('detailMetrics');
    var focusForStaff = 0;
    if (liveData && liveData.focus) {
      liveData.focus.forEach(function (f) {
        if (f && (f.staffId === staff.id || f.zone === zone.id)) focusForStaff++;
      });
    }
    var waitN = (liveData && liveData.counts && liveData.counts.wait != null) ? liveData.counts.wait : '—';
    var doneN = (liveData && liveData.counts && liveData.counts.done != null) ? liveData.counts.done : '—';
    metrics.innerHTML =
      '<div class="metric"><div class="k">全域等待</div><div class="v">' + waitN + '</div></div>' +
      '<div class="metric"><div class="k">全域完成</div><div class="v">' + doneN + '</div></div>' +
      '<div class="metric"><div class="k">相關焦點</div><div class="v">' + focusForStaff + '</div></div>' +
      '<div class="metric"><div class="k">團隊人數</div><div class="v">' + zone.staff.length + '</div></div>';

    renderDetailFollow(staff.id);

    var roster = $('roster');
    roster.innerHTML = '';
    zone.staff.forEach(function (s) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'roster-item' + (s.id === staff.id ? ' active' : '');
      row.innerHTML = '<span class="mini-bot">' + s.name.slice(0, 1) + '</span>' +
        '<span><div class="rn">' + s.name + '</div><div class="rr">' + s.role + '</div></span>';
      row.addEventListener('click', function () { selectZone(zone.id, s.id, { openModal: true, toast: true }); });
      roster.appendChild(row);
    });

    highlight3D(zone.id, staff.id);
    highlight2D(zone.id);
    renderInvestSlot();
  }

  function selectZone(zoneId, staffId, opts) {
    opts = opts || {};
    var prevZone = selectedZone;
    var prevStaff = selectedStaffId;
    renderDetail(zoneId, staffId);
    if (opts.openDrawer) {
      closeDrawers('detailPanel');
      applyCollapse('detailPanel', true);
    }
    if (opts.openModal && staffId) openModal(zoneId, staffId);
    if (opts.toast) {
      if (staffId && staffId !== prevStaff) {
        var hit = findStaffAnywhere(staffId);
        toast('已選取 ' + ((hit && hit.staff.name) || staffId));
      } else if (zoneId !== prevZone) {
        toast('切換至 ' + findZone(zoneId).name);
      }
    }
  }

  function openModal(zoneId, staffId) {
    var zone = findZone(zoneId || selectedZone);
    var staff = findStaff(zone, staffId || selectedStaffId);
    selectedZone = zone.id;
    selectedStaffId = staff.id;
    $('modalZone').textContent = zone.name + ' · ' + zone.en;
    $('modalName').textContent = staff.name;
    $('modalRole').textContent = staff.role + ' — ' + zone.desc;
    $('modalBadge').textContent = staff.status;
    $('modalBadge').className = 'badge ' + (staff.status.indexOf('待機') >= 0 || staff.status.indexOf('待命') >= 0 ? 'warn' : 'ok');
    var av = $('modalAvatar');
    av.textContent = staff.name.slice(0, 1);
    renderChecklist($('modalFollow'), staff.id, true);
    var pages = relatedPagesSmart(staff.id, zone.id);
    var list = $('modalPages');
    list.innerHTML = '';
    if (!pages.length) {
      list.innerHTML = '<li class="empty">暫無相關 Pages</li>';
    } else {
      pages.forEach(function (p) {
        var li = document.createElement('li');
        li.innerHTML = '<a href="' + pageUrl(p) + '" target="_blank" rel="noopener">' + p.title +
          '<span class="meta">' + p.category + ' · ' + (p.updated || '') + '</span></a>';
        list.appendChild(li);
      });
    }
    $('modalBackdrop').hidden = false;
  }

  function closeModal() {
    $('modalBackdrop').hidden = true;
  }

  function pushFeed(item, opts) {
    var feed = $('feed');
    if (!feed) return;
    var li = document.createElement('li');
    li.className = 'zone-' + (item.zone || 'sys');
    var t = item.at;
    if (!t) {
      var now = new Date();
      var hh = String(now.getHours()).padStart(2, '0');
      var mm = String(now.getMinutes()).padStart(2, '0');
      var ss = String(now.getSeconds()).padStart(2, '0');
      t = hh + ':' + mm + ':' + ss;
    }
    li.innerHTML = '<span class="t">' + t + '</span>' + (item.text || '');
    if (opts && opts.append) feed.appendChild(li);
    else feed.insertBefore(li, feed.firstChild);
    while (feed.children.length > 8) feed.removeChild(feed.lastChild);
    var feedPanel = $('feedPanel');
    var badge = $('feedBadge');
    if (badge && feedPanel && feedPanel.classList.contains('collapsed')) badge.hidden = false;
  }

  function clearFeed() {
    var feed = $('feed');
    if (feed) feed.innerHTML = '';
  }

  function stopFakeFeed() {
    if (feedFakeTimer) {
      clearInterval(feedFakeTimer);
      feedFakeTimer = null;
    }
  }

  function startFeed() {
    if (feedUsingLive) return;
    stopFakeFeed();
    clearFeed();
    FEEDS.forEach(function (f, i) {
      setTimeout(function () {
        if (feedUsingLive) return;
        pushFeed(f);
      }, 200 + i * 180);
    });
    feedFakeTimer = setInterval(function () {
      if (feedUsingLive) return;
      var f = FEEDS[Math.floor(Math.random() * FEEDS.length)];
      pushFeed(f);
      // counts stay from live.json when available; do not invent KPI
    }, 2800);
  }

  function renderLiveEvents(events) {
    clearFeed();
    var list = (events || []).slice();
    // newest first: assume array may already be newest-first; sort by at desc when comparable
    list.sort(function (a, b) {
      var ta = (a && a.at) || '';
      var tb = (b && b.at) || '';
      if (ta === tb) return 0;
      return ta < tb ? 1 : -1;
    });
    list.slice(0, 8).forEach(function (ev) {
      pushFeed(ev, { append: true });
    });
  }

  /* ---------- Phase 3: time / sev / trust / focus / deadlines ---------- */
  function parseHktDateTime(str) {
    if (!str) return null;
    var m = String(str).match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
    if (!m) return null;
    var hh = m[4] != null ? +m[4] : 12;
    var mm = m[5] != null ? +m[5] : 0;
    // Interpret as Asia/Hong_Kong (UTC+8)
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], hh - 8, mm, 0));
  }

  function nowHktParts() {
    try {
      var fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      var parts = fmt.formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      return {
        y: +map.year, mo: +map.month, d: +map.day,
        h: +(map.hour === '24' ? '0' : map.hour), mi: +map.minute
      };
    } catch (e) {
      var n = new Date();
      // fallback: box already HKT
      return { y: n.getFullYear(), mo: n.getMonth() + 1, d: n.getDate(), h: n.getHours(), mi: n.getMinutes() };
    }
  }

  function hktTodayStartMs() {
    var p = nowHktParts();
    return Date.UTC(p.y, p.mo - 1, p.d, 0, 0, 0); // as "HKT calendar day" key via UTC numbers
  }

  function dueDayMs(dueStr) {
    var m = String(dueStr || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], 0, 0, 0);
  }

  function daysUntilDue(dueStr) {
    var due = dueDayMs(dueStr);
    if (due == null) return null;
    var today = hktTodayStartMs();
    return Math.round((due - today) / 86400000);
  }

  function dueCountdownLabel(dueStr) {
    var n = daysUntilDue(dueStr);
    if (n == null) return '—';
    if (n < 0) return '過期 ' + Math.abs(n) + ' 日';
    if (n === 0) return '今日';
    if (n === 1) return '明日';
    return '剩 ' + n + ' 日';
  }

  function inferSev(dueStr, explicit) {
    if (explicit === 'red' || explicit === 'yellow' || explicit === 'green') return explicit;
    var n = daysUntilDue(dueStr);
    if (n == null) return 'green';
    if (n <= 1) return 'red';
    if (n <= 7) return 'yellow';
    return 'green';
  }

  function formatRelativeHkt(updatedStr) {
    var t = parseHktDateTime(updatedStr);
    if (!t) return updatedStr ? ('更新於 ' + updatedStr) : '更新於 —';
    var ageMs = Date.now() - t.getTime();
    if (ageMs < 0) ageMs = 0;
    var mins = Math.floor(ageMs / 60000);
    var rel;
    if (mins < 1) rel = '剛剛';
    else if (mins < 60) rel = mins + ' 分鐘前';
    else {
      var hrs = Math.floor(mins / 60);
      if (hrs < 48) rel = hrs + ' 小時前';
      else rel = Math.floor(hrs / 24) + ' 日前';
    }
    return '更新於 ' + updatedStr.replace(/\s*HKT\s*$/, '') + '（' + rel + '）';
  }

  function ageClassForUpdated(updatedStr) {
    var t = parseHktDateTime(updatedStr);
    if (!t) return '';
    var ageMs = Date.now() - t.getTime();
    if (ageMs > 6 * 3600000) return 'age-stale';
    if (ageMs > 2 * 3600000) return 'age-warn';
    return '';
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function asFiniteNum(v) {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string' && String(v).trim() !== '' && isFinite(+v)) return +v;
    return null;
  }

  function formatPct(n) {
    var x = Math.round(n * 10) / 10;
    if (Math.abs(x - Math.round(x)) < 1e-6) return String(Math.round(x));
    return x.toFixed(1);
  }

  function usageSev(pct) {
    if (pct == null) return '';
    if (pct >= 90) return 'sev-alert';
    if (pct >= 70) return 'sev-warn';
    return 'sev-ok';
  }

  function usageShiftsColumns() {
    return !(window.matchMedia && window.matchMedia('(max-width: 820px)').matches);
  }

  function syncUsageOffset() {
    /* Phase A: usage and risk live in drawers, so they no longer push the ribbon or focus. */
    document.documentElement.style.setProperty('--usage-h', '0px');
  }

  var usageLayoutBound = false;
  function bindUsageLayout() {
    if (usageLayoutBound) return;
    usageLayoutBound = true;
    window.addEventListener('resize', function () {
      syncUsageOffset();
      updateTrustStrip();
    });
    if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(function () {
        if (document.body.classList.contains('has-usage')) syncUsageOffset();
      });
    }
  }

  function hideUsageStrip() {
    var strip = $('usageStrip');
    if (strip) strip.hidden = true;
    document.body.classList.remove('has-usage');
    var chip = $('btnUsage');
    if (chip) chip.hidden = true;
    applyCollapse('usageDrawer', false);
    syncUsageOffset();
  }

  function renderUsage(usage) {
    var strip = $('usageStrip');
    if (!strip) return;
    bindUsageLayout();
    try {
      var ok = !!(usage && typeof usage === 'object' && !Array.isArray(usage));
      var pct = ok ? asFiniteNum(usage.pctUsed) : null;
      var grok = ok ? asFiniteNum(usage.grokBotPctOfLimit) : null;
      var plan = ok && usage.plan ? String(usage.plan) : '';
      var reset = '';
      if (ok && usage.resetLabel) reset = String(usage.resetLabel);
      else if (ok && usage.resetAt) reset = String(usage.resetAt);
      var note = ok && usage.note ? String(usage.note) : '';
      var shared = ok && usage.sharedWithOtherApps === true;
      var updated = ok && usage.updated ? String(usage.updated) : '';
      var tops = [];
      if (ok && Array.isArray(usage.top)) {
        usage.top.forEach(function (t) {
          if (!t || !t.name) return;
          tops.push({ name: String(t.name), share: asFiniteNum(t.share) });
        });
      }
      tops = tops.slice(0, 4);
      var hasAny = pct != null || grok != null || !!plan || !!reset || !!note || shared || tops.length > 0;
      if (!hasAny) {
        hideUsageStrip();
        return;
      }
      strip.className = 'usage-strip' + (usageSev(pct) ? (' ' + usageSev(pct)) : '');
      var pctEl = $('usagePct');
      if (pctEl) {
        pctEl.textContent = pct != null ? (formatPct(pct) + '%') : '';
        pctEl.hidden = pct == null;
      }
      var planEl = $('usagePlan');
      if (planEl) {
        planEl.textContent = plan;
        planEl.hidden = !plan;
      }
      var bar = $('usageBar');
      var fill = $('usageFill');
      if (bar) {
        if (pct != null) {
          var clamped = Math.max(0, Math.min(100, pct));
          bar.hidden = false;
          bar.setAttribute('aria-valuenow', String(Math.round(clamped)));
          bar.setAttribute('aria-valuetext', formatPct(pct) + '%');
          if (fill) fill.style.width = clamped + '%';
        } else {
          bar.hidden = true;
        }
      }
      var grokEl = $('usageGrok');
      if (grokEl) {
        grokEl.textContent = grok != null ? ('Grok Bot 佔限額 ' + formatPct(grok) + '%') : '';
        grokEl.hidden = grok == null;
      }
      var resetEl = $('usageReset');
      if (resetEl) {
        resetEl.textContent = reset ? ('重置 ' + reset) : '';
        resetEl.hidden = !reset;
      }
      var sharedEl = $('usageShared');
      if (sharedEl) sharedEl.hidden = !shared;
      var noteEl = $('usageNote');
      if (noteEl) {
        noteEl.textContent = note;
        noteEl.hidden = !note;
        noteEl.title = note;
      }
      var updatedEl = $('usageUpdated');
      if (updatedEl) {
        updatedEl.textContent = updated;
        updatedEl.hidden = !updated;
      }
      var sharesEl = $('usageShares');
      if (sharesEl) {
        if (!tops.length) {
          sharesEl.innerHTML = '';
          sharesEl.hidden = true;
        } else {
          sharesEl.hidden = false;
          sharesEl.innerHTML = '<span class="usage-shares-k">使用情況</span>' + tops.map(function (t) {
            var share = t.share != null ? (' ' + formatPct(t.share) + '%') : '';
            return '<span class="usage-chip">' + escHtml(t.name) + escHtml(share) + '</span>';
          }).join('');
        }
      }
      var titleBits = [];
      if (pct != null) titleBits.push('週用量 ' + formatPct(pct) + '%');
      if (grok != null) titleBits.push('Grok Bot 佔限額 ' + formatPct(grok) + '%');
      if (plan) titleBits.push(plan);
      if (reset) titleBits.push('重置 ' + reset);
      if (shared) titleBits.push('週限額與計劃上其他 App 共用');
      if (note) titleBits.push(note);
      if (updated) titleBits.push(updated);
      strip.title = titleBits.join(' · ');
      strip.hidden = false;
      document.body.classList.add('has-usage');
      var compact = $('usagePctCompact');
      if (compact) compact.textContent = pct != null ? (formatPct(pct) + '%') : '—';
      var chip = $('btnUsage');
      if (chip) {
        var chipOpen = chip.classList.contains('active');
        chip.className = 'ribbon-chip' + (usageSev(pct) ? (' ' + usageSev(pct)) : '') + (chipOpen ? ' active' : '');
        chip.hidden = false;
        chip.title = strip.title || '週用量';
      }
      syncUsageOffset();
    } catch (err) {
      console.warn('usage panel failed', err);
      hideUsageStrip();
    }
  }

  /* ---------- Signal House A: fixed disclaimer + risk lights ---------- */
  function disclaimerString(value) {
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  function readSafeBottom() {
    var probe = $('safeProbe');
    if (!probe) {
      probe = document.createElement('div');
      probe.id = 'safeProbe';
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;';
      document.body.appendChild(probe);
    }
    return probe.getBoundingClientRect().height || 0;
  }

  function hideDisclaimer() {
    var el = $('disclaimerTicker');
    if (el) el.hidden = true;
    document.body.classList.remove('has-disclaimer');
    document.documentElement.style.setProperty('--disclaimer-h', '0px');
  }

  function syncDisclaimerOffset() {
    var el = $('disclaimerTicker');
    if (!el || el.hidden) {
      document.documentElement.style.setProperty('--disclaimer-h', '0px');
      return;
    }
    var full = el.getBoundingClientRect().height || 0;
    var lift = Math.max(0, Math.round(full - readSafeBottom()));
    document.documentElement.style.setProperty('--disclaimer-h', lift + 'px');
  }

  var disclaimerLayoutBound = false;
  function bindDisclaimerLayout() {
    if (disclaimerLayoutBound) return;
    disclaimerLayoutBound = true;
    window.addEventListener('resize', syncDisclaimerOffset);
  }

  function renderDisclaimer(raw) {
    var el = $('disclaimerTicker');
    var label = $('disclaimerText');
    if (!el || !label) return;
    try {
      bindDisclaimerLayout();
      var value = disclaimerString(raw);
      if (!value) {
        hideDisclaimer();
        return;
      }
      if (label.textContent !== value) label.textContent = value;
      el.hidden = false;
      document.body.classList.add('has-disclaimer');
      syncDisclaimerOffset();
    } catch (err) {
      console.warn('disclaimer ticker failed', err);
      hideDisclaimer();
    }
  }

  function normalizeSev(sev) {
    var s = String(sev == null ? '' : sev).trim().toLowerCase();
    if (s === 'red' || s === 'yellow' || s === 'green') return s;
    return '';
  }

  function sevWord(sev) {
    if (sev === 'red') return '紅燈';
    if (sev === 'yellow') return '黃燈';
    if (sev === 'green') return '綠燈';
    return '';
  }

  /* L5 detail drawer. Reads live.invest from the existing poll. No trading engine. */
  function hideInvestSlot() {
    var slot = $('investSlot');
    if (!slot) return;
    slot.hidden = true;
    slot.className = 'invest-slot';
    slot.innerHTML = '';
  }

  function investModeToken(raw) {
    var m = String(raw == null ? '' : raw).trim().toUpperCase();
    if (m === 'PLAN' || m === 'PAPER' || m === 'HALT') return m;
    return '';
  }

  function investShortText(value) {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && isFinite(value)) return String(value);
    if (!Array.isArray(value)) return '';
    for (var i = 0; i < value.length; i++) {
      var item = value[i];
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (typeof item === 'number' && isFinite(item)) return String(item);
    }
    return '';
  }

  function investMorningLine(morning) {
    if (!morning || typeof morning !== 'object' || Array.isArray(morning)) return '';
    var handover = investShortText(morning.handover);
    if (handover) return handover;
    var opp = investShortText(morning.opportunities);
    var alertText = investShortText(morning.alerts);
    if (opp && alertText) return opp + ' · ' + alertText;
    return opp || alertText || '';
  }

  function investCurrency(raw) {
    var c = String(raw == null ? '' : raw).trim().toUpperCase();
    if (/^[A-Z]{3,4}$/.test(c)) return c;
    return '';
  }

  function formatInvestPnl(n, currency) {
    var neg = n < 0;
    var abs = Math.abs(n);
    var text = (Math.round(abs * 100) / 100).toFixed(2);
    var signed = neg ? ('-' + text) : (n > 0 ? ('+' + text) : text);
    return currency ? (signed + ' ' + currency) : signed;
  }

  function investOwnedLights() {
    var board = liveData && liveData.riskBoard;
    var lights = (board && typeof board === 'object' && !Array.isArray(board) && Array.isArray(board.lights))
      ? board.lights : [];
    var rows = [];
    lights.forEach(function (light) {
      if (!light || typeof light !== 'object' || Array.isArray(light)) return;
      var owner = light.owner == null ? '' : String(light.owner).trim().toLowerCase();
      if (owner !== 'invest') return;
      var label = light.label == null ? '' : String(light.label).trim();
      var id = light.id == null ? '' : String(light.id).trim();
      if (!label && !id) return;
      rows.push(light);
    });
    return rows;
  }

  function renderInvestSlot() {
    var slot = $('investSlot');
    if (!slot) return;
    try {
      var invest = liveData && liveData.invest;
      var show = selectedZone === 'invest' && invest && typeof invest === 'object' && !Array.isArray(invest);
      if (!show) {
        hideInvestSlot();
        return;
      }
      var mode = investModeToken(invest.mode);
      if (!mode && (invest.mode == null || String(invest.mode).trim() === '')) mode = 'PLAN';
      var halted = invest.halt === true || mode === 'HALT';
      var reason = halted && typeof invest.haltReason === 'string' ? invest.haltReason.trim() : '';
      var paper = (invest.paper && typeof invest.paper === 'object' && !Array.isArray(invest.paper)) ? invest.paper : null;
      var morning = investMorningLine(invest.morning);
      var lights = investOwnedLights();
      var modeClass = mode === 'HALT' ? 'mode-halt' : (mode === 'PAPER' ? 'mode-paper' : (mode === 'PLAN' ? 'mode-plan' : 'mode-unknown'));
      var modeTitle = mode === 'PLAN' ? '規劃' : (mode === 'PAPER' ? '模擬' : (mode === 'HALT' ? '暫停' : ''));
      var html = '<div class="invest-slot-head"><span class="invest-kicker">L5</span>' +
        '<span class="invest-mode ' + modeClass + '"' +
        (modeTitle ? ' title="' + escHtml(modeTitle) + '"' : '') + '>' +
        escHtml(mode || '—') + '</span></div>';
      if (reason) html += '<p class="invest-halt">' + escHtml(reason) + '</p>';
      if (paper) {
        var pnlNum = asFiniteNum(paper.pnl);
        var pnlText = pnlNum == null ? '—' : formatInvestPnl(pnlNum, investCurrency(paper.currency));
        html += '<p class="invest-paper"><span class="invest-sim">SIMULATED</span>' +
          '<span class="invest-pnl">盈虧 ' + escHtml(pnlText) + '</span></p>';
      }
      if (morning) html += '<p class="invest-morning">' + escHtml(morning) + '</p>';
      if (lights.length) {
        html += '<ul class="invest-lights">';
        lights.forEach(function (light) {
          var sev = normalizeSev(light.sev);
          var label = (light.label != null && String(light.label).trim()) ? String(light.label) : String(light.id);
          var note = light.note == null ? '' : String(light.note).trim();
          html += '<li class="invest-light' + (sev ? ' sev-' + sev : '') + '"' +
            (note ? ' title="' + escHtml(note) + '"' : '') + '>' +
            '<span class="risk-dot" aria-hidden="true"></span><span>' + escHtml(label) + '</span></li>';
        });
        html += '</ul>';
      }
      slot.className = 'invest-slot' + (halted ? ' is-halt' : '');
      slot.innerHTML = html;
      slot.hidden = false;
    } catch (err) {
      console.warn('invest slot failed', err);
      hideInvestSlot();
    }
  }

  function hideRiskBoard() {
    var panel = $('riskBoard');
    if (panel) panel.hidden = true;
    var lightsEl = $('riskLights');
    if (lightsEl) lightsEl.innerHTML = '';
    var dotsEl = $('riskDots');
    if (dotsEl) dotsEl.innerHTML = '';
    var chip = $('btnRisk');
    if (chip) chip.hidden = true;
    document.body.classList.remove('has-risk-board');
    applyCollapse('riskDrawer', false);
    syncUsageOffset();
  }

  function renderRiskBoard(board) {
    var panel = $('riskBoard');
    var lightsEl = $('riskLights');
    if (!panel || !lightsEl) return;
    try {
      var lights = (board && typeof board === 'object' && !Array.isArray(board) && Array.isArray(board.lights))
        ? board.lights : null;
      var rows = [];
      if (lights) {
        lights.forEach(function (light) {
          if (!light || typeof light !== 'object' || Array.isArray(light)) return;
          var label = light.label == null ? '' : String(light.label).trim();
          var id = light.id == null ? '' : String(light.id).trim();
          if (!label && !id) return;
          rows.push(light);
        });
      }
      if (!rows.length) {
        hideRiskBoard();
        return;
      }
      var updatedEl = $('riskUpdated');
      if (updatedEl) {
        var stamp = (typeof board.updated === 'string') ? board.updated.trim() : '';
        updatedEl.textContent = stamp;
      }
      var reds = 0;
      var yellows = 0;
      var greens = 0;
      lightsEl.innerHTML = rows.map(function (light) {
        var sev = normalizeSev(light.sev);
        if (sev === 'red') reds++;
        else if (sev === 'yellow') yellows++;
        else if (sev === 'green') greens++;
        var label = (light.label != null && String(light.label).trim()) ? String(light.label) : String(light.id);
        var note = light.note == null ? '' : String(light.note);
        var owner = light.owner == null ? '' : String(light.owner).trim();
        var described = [sevWord(sev), label, note, owner].filter(function (part) { return !!part; }).join('。');
        return '<article class="risk-light' + (sev ? ' sev-' + sev : '') + '"' +
          ' data-sev="' + escHtml(sev) + '"' +
          (light.id != null ? ' data-id="' + escHtml(light.id) + '"' : '') +
          ' aria-label="' + escHtml(described) + '">' +
          '<span class="risk-dot" aria-hidden="true"></span>' +
          '<div class="risk-copy">' +
            '<div class="risk-label-row"><span class="risk-label">' + escHtml(label) + '</span>' +
            (owner ? '<span class="risk-owner">' + escHtml(owner) + '</span>' : '') +
            '</div>' +
            (note ? '<div class="risk-note">' + escHtml(note) + '</div>' : '') +
          '</div></article>';
      }).join('');
      /* L1 stays dots only — full labels stay in the drawer. No investment hints on the ribbon. */
      var dotsEl = $('riskDots');
      var riskChip = $('btnRisk');
      if (dotsEl) {
        dotsEl.innerHTML = rows.map(function (light) {
          var sev = normalizeSev(light.sev);
          return '<i class="sev-dot' + (sev ? ' sev-' + sev : '') + '" aria-hidden="true"></i>';
        }).join('');
      }
      if (riskChip) {
        riskChip.hidden = false;
        riskChip.setAttribute('aria-label', '風控 ' + reds + ' 紅 ' + yellows + ' 黃 ' + greens + ' 綠');
      }
      panel.hidden = false;
      document.body.classList.add('has-risk-board');
      syncUsageOffset();
      requestAnimationFrame(syncUsageOffset);
    } catch (err) {
      console.warn('risk board failed', err);
      hideRiskBoard();
    }
  }

  function updateTrustStrip() {
    var strip = $('trustStrip');
    var updatedEl = $('trustUpdated');
    var pill = $('auditorPill');
    var stamp = (liveData && liveData.updated) || liveUpdatedStamp || '';
    if (updatedEl) updatedEl.textContent = formatRelativeHkt(stamp);
    if (strip) {
      strip.classList.remove('age-warn', 'age-stale');
      var cls = ageClassForUpdated(stamp);
      if (cls) strip.classList.add(cls);
    }
    if (pill) {
      var aud = liveData && liveData.auditor;
      var ok = !aud || aud.ok !== false;
      var narrow = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
      pill.className = 'auditor-pill ' + (ok ? 'ok' : 'fail');
      pill.textContent = narrow ? (ok ? '健康' : '異常') : (ok ? 'Auditor · 健康' : 'Auditor · 異常');
      pill.title = (aud && aud.note) ? ('System Auditor：' + aud.note) : 'System Auditor';
    }
    if ($('liveUpdated') && stamp) {
      $('liveUpdated').textContent = stamp.replace(/\s*HKT\s*$/, '');
    }
  }

  function renderCalendarStrip(items) {
    var el = $('calendarStrip');
    if (!el) return;
    var list = (items || []).slice(0, 3);
    if (!list.length) { el.innerHTML = ''; return; }
    el.innerHTML = list.map(function (c) {
      return '<div class="cal-chip"><span class="when">' + (c.when || '') + '</span>' +
        '<span class="title">' + (c.title || '') + '</span>' +
        '<span class="where">' + (c.where || '') + '</span></div>';
    }).join('');
  }

  function renderFocusBoard(items) {
    var board = $('focusBoard');
    if (!board) return;
    var list = (items || []).slice();
    list.sort(function (a, b) {
      var sa = inferSev(a.due, a.sev);
      var sb = inferSev(b.due, b.sev);
      var rank = { red: 0, yellow: 1, green: 2 };
      var ra = rank[sa] != null ? rank[sa] : 3;
      var rb = rank[sb] != null ? rank[sb] : 3;
      if (ra !== rb) return ra - rb;
      return String(a.due || '').localeCompare(String(b.due || ''));
    });
    if (!list.length) {
      board.innerHTML = '<div class="focus-empty">暫無今日焦點</div>';
      return;
    }
    board.innerHTML = '';
    list.forEach(function (f) {
      var sev = inferSev(f.due, f.sev);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'focus-card sev-' + sev;
      btn.innerHTML =
        '<div class="fc-title">' + (f.title || '') + '</div>' +
        (f.detail ? '<div class="fc-detail">' + f.detail + '</div>' : '') +
        '<div class="fc-meta"><span class="fc-due">' + dueCountdownLabel(f.due) +
        (f.due ? ' · ' + f.due : '') + '</span></div>';
      btn.addEventListener('click', function () {
        if (f.staffId || f.zone) {
          selectZone(f.zone || selectedZone, f.staffId || null, { toast: true, openDrawer: true });
        }
      });
      board.appendChild(btn);
    });
  }

  function deadlinesFromReports() {
    if (reportsData && reportsData.deadlines && reportsData.deadlines.length) {
      return reportsData.deadlines.slice();
    }
    var out = [];
    var tables = (reportsData && reportsData.tables) || [];
    var fu = null;
    for (var i = 0; i < tables.length; i++) {
      if (tables[i].id === 'followups') { fu = tables[i]; break; }
    }
    if (!fu) return out;
    var cols = fu.columns || [];
    var dueIdx = cols.indexOf('死線');
    var ownerIdx = cols.indexOf('負責');
    var textIdx = cols.indexOf('項目');
    if (textIdx < 0) textIdx = 0;
    (fu.rows || []).forEach(function (row, idx) {
      var due = dueIdx >= 0 ? row[dueIdx] : '';
      var owner = ownerIdx >= 0 ? row[ownerIdx] : '';
      var text = row[textIdx] || '';
      out.push({
        id: 'fu-' + idx,
        text: text,
        owner: owner,
        due: due,
        sev: inferSev(due),
        staffId: null
      });
    });
    return out;
  }

  function renderDeadlineList() {
    var el = $('deadlineList');
    if (!el) return;
    var list = deadlinesFromReports();
    // prefer live.focus as supplement if reports empty
    if (!list.length && liveData && liveData.focus) {
      list = liveData.focus.map(function (f) {
        return {
          id: f.id, text: f.title, owner: f.staffId || '', due: f.due,
          sev: f.sev, staffId: f.staffId, zone: f.zone
        };
      });
    }
    list.sort(function (a, b) {
      var da = dueDayMs(a.due); var db = dueDayMs(b.due);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
    if (!list.length) {
      el.innerHTML = '<div class="focus-empty">暫無死線</div>';
      return;
    }
    el.innerHTML = '';
    list.forEach(function (d) {
      var sev = inferSev(d.due, d.sev);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'deadline-row sev-' + sev;
      btn.innerHTML =
        '<span class="dl-sev" aria-hidden="true"></span>' +
        '<span class="dl-text">' + (d.text || '') + '</span>' +
        '<span class="dl-count">' + dueCountdownLabel(d.due) + '</span>';
      btn.title = (d.owner ? d.owner + ' · ' : '') + (d.due || '');
      btn.addEventListener('click', function () {
        if (d.staffId || d.zone) {
          selectZone(d.zone || selectedZone, d.staffId || null, { toast: true, openDrawer: true });
        } else if (d.staffId) {
          var hit = findStaffAnywhere(d.staffId);
          if (hit) selectZone(hit.zone.id, d.staffId, { toast: true, openDrawer: true });
        }
      });
      el.appendChild(btn);
    });
  }

  function refreshDetailMetrics() {
    var metrics = $('detailMetrics');
    if (!metrics || !selectedZone) return;
    var zone = findZone(selectedZone);
    var staff = findStaff(zone, selectedStaffId || (zone.staff[0] && zone.staff[0].id));
    var focusForStaff = 0;
    if (liveData && liveData.focus) {
      liveData.focus.forEach(function (f) {
        if (f && (f.staffId === staff.id || f.zone === zone.id)) focusForStaff++;
      });
    }
    var waitN = (liveData && liveData.counts && liveData.counts.wait != null) ? liveData.counts.wait : '—';
    var doneN = (liveData && liveData.counts && liveData.counts.done != null) ? liveData.counts.done : '—';
    metrics.innerHTML =
      '<div class="metric"><div class="k">全域等待</div><div class="v">' + waitN + '</div></div>' +
      '<div class="metric"><div class="k">全域完成</div><div class="v">' + doneN + '</div></div>' +
      '<div class="metric"><div class="k">相關焦點</div><div class="v">' + focusForStaff + '</div></div>' +
      '<div class="metric"><div class="k">團隊人數</div><div class="v">' + zone.staff.length + '</div></div>';
  }

  function applyLivePayload(data, opts) {
    if (!data) return false;
    liveData = data;
    centerRows().forEach(function (row) {
      if (row.status) row.staff.status = row.status;
    });
    var events = data.events || [];
    var hasEvents = events.length > 0;
    if (data.status && $('liveText')) {
      var label = data.status;
      if (isTouch && label === '實時運作中') label = 'LIVE';
      $('liveText').textContent = label;
      if (data.updated) {
        $('liveText').title = '更新於 ' + data.updated;
      }
    }
    if (data.counts) {
      if (data.counts.wait != null && $('cntWait')) $('cntWait').textContent = String(data.counts.wait);
      if (data.counts.done != null && $('cntDone')) $('cntDone').textContent = String(data.counts.done);
      if (data.counts.routine != null && $('cntRoutine')) $('cntRoutine').textContent = String(data.counts.routine);
    }
    updateTrustStrip();
    renderUsage(data.usage);
    renderDisclaimer(data.disclaimer);
    renderRiskBoard(data.riskBoard);
    renderInvestSlot();
    syncLifeFromLive();
    renderCenterStrip();
    paintFloorRailCenters();
    renderFocusBoard(data.focus || []);
    renderCalendarStrip(data.calendar || []);
    renderDeadlineList();
    refreshDetailMetrics();
    if (hasEvents) {
      feedUsingLive = true;
      stopFakeFeed();
      renderLiveEvents(events);
      return true;
    }
    return false;
  }

  function loadLive(opts) {
    opts = opts || {};
    return fetch('live.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('live ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var prev = liveUpdatedStamp;
        var next = data && data.updated ? String(data.updated) : null;
        var used = applyLivePayload(data, opts);
        if (!used) {
          // empty events → keep / start fake fallback
          if (!feedUsingLive && !feedFakeTimer) startFeed();
        } else if (opts.notify && prev && next && prev !== next) {
          toast('LIVE 已更新');
        }
        if (next) liveUpdatedStamp = next;
        updateTrustStrip();
        return used;
      })
      .catch(function (err) {
        console.warn('live.json load failed', err);
        // 404 / missing → fake templates fallback
        feedUsingLive = false;
        if (!feedFakeTimer) startFeed();
        updateTrustStrip();
        return false;
      });
  }

  function startLivePolling() {
    loadLive({ notify: false }).then(function (used) {
      if (!used && !feedFakeTimer) startFeed();
    });
    if (livePollTimer) clearInterval(livePollTimer);
    livePollTimer = setInterval(function () {
      loadLive({ notify: true });
    }, 45000);
    if (liveRelativeTimer) clearInterval(liveRelativeTimer);
    liveRelativeTimer = setInterval(function () {
      updateTrustStrip();
      // refresh countdown labels occasionally
      if (liveData) {
        renderFocusBoard(liveData.focus || []);
        renderDeadlineList();
      }
    }, 60000);
  }

  /* ---------- Changelog ---------- */
  function loadChangelog() {
    return fetch('changelog.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('changelog ' + r.status); return r.json(); })
      .then(function (data) { changelogData = data; return data; })
      .catch(function (err) {
        console.warn('changelog.json load failed', err);
        changelogData = { items: [] };
        return changelogData;
      });
  }

  function openChangelog() {
    var list = $('changelogList');
    var items = (changelogData && changelogData.items) || [];
    if (list) {
      if (!items.length) {
        list.innerHTML = '<li><span class="cl-text">暫無變更紀錄</span></li>';
      } else {
        list.innerHTML = items.map(function (it) {
          return '<li><span class="cl-at">' + (it.at || '') + ' HKT</span>' +
            '<span class="cl-text">' + (it.text || '') + '</span></li>';
        }).join('');
      }
    }
    if ($('changelogBackdrop')) $('changelogBackdrop').hidden = false;
    toast('已開啟變更紀錄');
  }
  function closeChangelog() {
    if ($('changelogBackdrop')) $('changelogBackdrop').hidden = true;
  }

  /* ---------- Phase A drawers (default closed; 今日焦點 stays open) ---------- */
  var DRAWER_IDS = ['leftPanel', 'detailPanel', 'feedPanel', 'usageDrawer', 'riskDrawer'];
  function applyCollapse(panelId, open) {
    var panel = $(panelId);
    if (!panel) return;
    panel.classList.toggle('collapsed', !open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    savePanelState(panelId, open);
    document.querySelectorAll('.dock-btn[data-drawer="' + panelId + '"], .ribbon-chip[data-drawer="' + panelId + '"]').forEach(function (btn) {
      btn.classList.toggle('active', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (panelId === 'feedPanel' && open) {
      var badge = $('feedBadge');
      if (badge) badge.hidden = true;
    }
  }
  function closeDrawers(exceptId) {
    DRAWER_IDS.forEach(function (id) {
      if (id !== exceptId) applyCollapse(id, false);
    });
  }
  function closeTopDrawer() {
    for (var i = 0; i < DRAWER_IDS.length; i++) {
      var panel = $(DRAWER_IDS[i]);
      if (panel && !panel.classList.contains('collapsed')) {
        applyCollapse(DRAWER_IDS[i], false);
        return true;
      }
    }
    return false;
  }
  function initCollapse() {
    DRAWER_IDS.forEach(function (id) {
      applyCollapse(id, loadPanelState(id, false));
    });
    document.querySelectorAll('[data-drawer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-drawer');
        var panel = $(id);
        if (!panel) return;
        var willOpen = panel.classList.contains('collapsed');
        if (willOpen) closeDrawers(id);
        applyCollapse(id, willOpen);
      });
    });
  }

  /* ---------- Directory ---------- */
  function openDirectory() {
    renderDirectoryTable();
    $('dirBackdrop').hidden = false;
    toast('已開啟總目錄');
    var search = $('dirSearch');
    if (search) setTimeout(function () { search.focus(); }, 50);
  }
  function closeDirectory() {
    $('dirBackdrop').hidden = true;
  }

  function renderDirectoryTable() {
    var body = $('dirBody');
    var catSel = $('dirCat');
    if (!body) return;
    var pages = (directory && directory.pages) || [];
    var q = (($('dirSearch') && $('dirSearch').value) || '').trim().toLowerCase();
    var cat = (catSel && catSel.value) || '';

    // populate categories once
    if (catSel && !catSel.dataset.ready) {
      var cats = [];
      pages.forEach(function (p) { if (cats.indexOf(p.category) < 0) cats.push(p.category); });
      cats.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        catSel.appendChild(opt);
      });
      catSel.dataset.ready = '1';
    }

    body.innerHTML = '';
    pages.forEach(function (p) {
      if (cat && p.category !== cat) return;
      var hay = (p.category + ' ' + p.title + ' ' + (p.staffIds || []).join(' ') + ' ' + (p.updated || '')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><span class="cat">' + p.category + '</span></td>' +
        '<td><a href="' + pageUrl(p) + '" target="_blank" rel="noopener">' + p.title + '</a></td>' +
        '<td>' + (p.updated || '—') + '</td>';
      body.appendChild(tr);
    });
    if (!body.children.length) {
      body.innerHTML = '<tr><td colspan="3" style="color:var(--muted);padding:16px">沒有符合的項目</td></tr>';
    }

    var rout = $('dirRoutines');
    if (rout) {
      var routines = (directory && directory.routines) || [];
      if (!routines.length) { rout.innerHTML = ''; }
      else {
        rout.innerHTML = '<h3>例行工作（摘要）</h3><ul>' + routines.map(function (r) {
          return '<li>' + r.title + ' · ' + r.when + '</li>';
        }).join('') + '</ul>';
      }
    }
  }

  function loadLifeLayout() {
    return fetch('floors/life.layout.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('life layout ' + r.status); return r.json(); })
      .then(function (data) { lifeLayout = data; return data; })
      .catch(function (err) {
        console.warn('life layout load failed', err);
        lifeLayout = null;
        return null;
      });
  }

  function loadDirectory() {
    return fetch('directory.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('directory ' + r.status); return r.json(); })
      .then(function (data) { directory = data; })
      .catch(function (err) {
        console.warn('directory.json load failed', err);
        directory = { baseUrl: 'https://cursor.com/canvas/store-cfbe74cb-3f1b-4f2f-b2de-5dd12c81d557/', pages: [], routines: [] };
      });
  }

  /* ---------- Reports worksheets ---------- */
  function openReports() {
    if (!reportsData) {
      loadReports().then(function () {
        showReportsPanel();
      });
    } else {
      showReportsPanel();
    }
  }
  function showReportsPanel() {
    renderReportsUI();
    if ($('reportsBackdrop')) $('reportsBackdrop').hidden = false;
    toast('已開啟報告表');
    var search = $('reportsSearch');
    if (search) setTimeout(function () { search.focus(); }, 50);
  }
  function closeReports() {
    if ($('reportsBackdrop')) $('reportsBackdrop').hidden = true;
  }

  function loadReports() {
    return fetch('reports.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('reports ' + r.status); return r.json(); })
      .then(function (data) {
        reportsData = data;
        if (!reportsActiveId && data.tables && data.tables.length) {
          reportsActiveId = data.tables[0].id;
        }
        renderDeadlineList();
        return data;
      })
      .catch(function (err) {
        console.warn('reports.json load failed', err);
        reportsData = { updated: '', tables: [] };
        toast('報告表載入失敗');
        return reportsData;
      });
  }

  function findReportTable(id) {
    var tables = (reportsData && reportsData.tables) || [];
    for (var i = 0; i < tables.length; i++) if (tables[i].id === id) return tables[i];
    return tables[0] || null;
  }

  function renderReportsUI() {
    var tabs = $('reportsTabs');
    var thead = $('reportsThead');
    var body = $('reportsBody');
    var updated = $('reportsUpdated');
    if (!tabs || !thead || !body) return;
    var tables = (reportsData && reportsData.tables) || [];
    if (updated) {
      updated.textContent = (reportsData && reportsData.updated)
        ? ('更新於 ' + reportsData.updated + ' HKT')
        : '';
    }
    if (!tables.length) {
      tabs.innerHTML = '';
      thead.innerHTML = '';
      body.innerHTML = '<tr><td style="color:var(--muted);padding:16px">暫無報告資料</td></tr>';
      return;
    }
    if (!reportsActiveId || !findReportTable(reportsActiveId)) {
      reportsActiveId = tables[0].id;
    }
    tabs.innerHTML = '';
    tables.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reports-tab' + (t.id === reportsActiveId ? ' active' : '');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', t.id === reportsActiveId ? 'true' : 'false');
      btn.dataset.id = t.id;
      btn.textContent = t.title || t.id;
      btn.addEventListener('click', function () {
        reportsActiveId = t.id;
        renderReportsUI();
      });
      tabs.appendChild(btn);
    });
    renderReportsTable();
  }

  function renderReportsTable() {
    var thead = $('reportsThead');
    var body = $('reportsBody');
    if (!thead || !body) return;
    var table = findReportTable(reportsActiveId);
    if (!table) {
      thead.innerHTML = '';
      body.innerHTML = '<tr><td style="color:var(--muted);padding:16px">暫無報告資料</td></tr>';
      return;
    }
    var cols = table.columns || [];
    var q = (($('reportsSearch') && $('reportsSearch').value) || '').trim().toLowerCase();
    thead.innerHTML = '<tr>' + cols.map(function (c) {
      return '<th>' + c + '</th>';
    }).join('') + '</tr>';
    body.innerHTML = '';
    var rows = table.rows || [];
    var shown = 0;
    rows.forEach(function (row) {
      var cells = row || [];
      var hay = cells.join(' ').toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      var tr = document.createElement('tr');
      tr.innerHTML = cells.map(function (cell, idx) {
        var cls = idx === 0 ? ' class="reports-key"' : '';
        return '<td' + cls + '>' + (cell == null || cell === '' ? '—' : cell) + '</td>';
      }).join('');
      // pad if short
      for (var i = cells.length; i < cols.length; i++) {
        tr.innerHTML += '<td>—</td>';
      }
      body.appendChild(tr);
      shown++;
    });
    if (!shown) {
      body.innerHTML = '<tr><td colspan="' + Math.max(cols.length, 1) + '" style="color:var(--muted);padding:16px">沒有符合的項目</td></tr>';
    }
  }

  /* ---------- 2D floor stack (WebGL fallback; same six floors) ---------- */
  function build2D() {
    var root = $('fbOffice');
    if (!root) return;
    var ph = $('fbGridPlaceholder');
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    var oldStack = root.querySelector('.fb-stack');
    if (oldStack) oldStack.parentNode.removeChild(oldStack);
    var grid = document.createElement('div');
    grid.className = 'fb-stack';
    ZONES.forEach(function (z) {
      var info = floorInfo(z);
      var cell = document.createElement('div');
      cell.className = 'fb-floor fb-zone' + (z.id === selectedZone ? ' active' : '');
      cell.dataset.id = z.id;
      var head = document.createElement('div');
      head.className = 'fb-zone-head';
      head.innerHTML = '<span class="tag">' + info.code + '</span><h3>' + info.short + '</h3>';
      var centerLine = centerStaff(z);
      if (centerLine) {
        var centerEl = document.createElement('div');
        centerEl.className = 'fb-center';
        centerEl.textContent = centerLine.name + ' · ' + centerStatus(centerLine);
        head.appendChild(centerEl);
      }
      cell.appendChild(head);
      var desks = document.createElement('div');
      desks.className = 'fb-desks';
      var n = Math.min(z.staff.length, 4);
      for (var i = 0; i < n; i++) {
        var b = document.createElement('div');
        b.className = 'fb-bot';
        b.title = z.staff[i].name;
        b.textContent = z.staff[i].name.slice(0, 1);
        b.addEventListener('click', (function (zoneId, staffId) {
          return function (ev) { ev.stopPropagation(); selectZone(zoneId, staffId, { openDrawer: true, toast: true }); };
        })(z.id, z.staff[i].id));
        desks.appendChild(b);
      }
      cell.appendChild(desks);
      cell.addEventListener('click', function () { selectZone(z.id, null, { toast: true, openDrawer: true }); });
      grid.appendChild(cell);
    });
    root.appendChild(grid);
  }

  function highlight2D(zoneId) {
    document.querySelectorAll('.fb-zone, .floor-btn').forEach(function (el) {
      var on = el.dataset.id === zoneId;
      el.classList.toggle('active', on);
      if (el.classList.contains('floor-btn')) el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function buildFloorRail() {
    var rail = $('floorRail');
    if (!rail) return;
    rail.querySelectorAll('.floor-btn').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        selectZone(btn.dataset.id, null, { toast: true, openDrawer: true });
      });
    });
    highlight2D(selectedZone);
    paintFloorRailCenters();
  }

  function dispose3D() {
    if (!runtime3d) return;
    try {
      if (runtime3d.kill) runtime3d.kill();
      if (runtime3d.raf) cancelAnimationFrame(runtime3d.raf);
      if (runtime3d.onResize) window.removeEventListener('resize', runtime3d.onResize);
      if (runtime3d.onOrient) window.removeEventListener('orientationchange', runtime3d.onOrient);
      if (runtime3d.renderer) {
        runtime3d.renderer.dispose();
        if (runtime3d.renderer.forceContextLoss) runtime3d.renderer.forceContextLoss();
        var el = runtime3d.renderer.domElement;
        if (el && el.parentNode) el.parentNode.removeChild(el);
      }
      if (runtime3d.scene) {
        runtime3d.scene.traverse(function (obj) {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(function (m) {
              if (!m) return;
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
      }
      if (runtime3d.shared) {
        Object.keys(runtime3d.shared.geos || {}).forEach(function (k) {
          try { runtime3d.shared.geos[k].dispose(); } catch (e) {}
        });
      }
    } catch (e) { console.warn('dispose3D', e); }
    runtime3d = null;
    botMeshes = [];
    zoneRoots = {};
    screenMats = [];
    particles = null;
    var wrap = $('canvas-wrap');
    if (wrap) while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
  }

  function enable2D(reason) {
    dispose3D();
    mode = '2d';
    document.body.classList.remove('mode-3d');
    document.body.classList.add('mode-2d');
    var fb = $('fallback');
    if (fb) fb.hidden = false;
    var cw = $('canvas-wrap');
    if (cw) cw.setAttribute('aria-hidden', 'true');
    $('bootError').hidden = true;
    var btn = $('btnTry3d');
    if (btn) {
      btn.classList.remove('hidden');
      btn.textContent = '試 3D（進階）';
    }
    var hint = $('hint');
    if (hint) hint.textContent = '點樓層聚焦並開詳情 · 底欄開啟職能／動態';
    if (reason) pushFeed({ zone: 'sys', text: '平面模式：' + reason });
    build2D();
    renderDetail(selectedZone, selectedStaffId);
  }

  function showBootError(msg) {
    $('bootMsg').textContent = msg;
    $('bootError').hidden = false;
  }

  if ($('btn2d')) {
    $('btn2d').addEventListener('click', function () {
      enable2D('手動返回平面');
    });
  }

  /* ---------- Shared materials / geos ---------- */
  function createSharedPool() {
    var geos = {
      deskTop: new THREE.BoxGeometry(1.55, 0.07, 0.72),
      deskLeg: new THREE.CylinderGeometry(0.03, 0.035, 0.55, 8),
      strip: new THREE.BoxGeometry(1.4, 0.02, 0.08),
      monStand: new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8),
      monBezel: new THREE.BoxGeometry(0.46, 0.32, 0.03),
      monScreen: new THREE.PlaneGeometry(0.4, 0.26),
      kb: new THREE.BoxGeometry(0.38, 0.02, 0.14),
      mouse: new THREE.BoxGeometry(0.06, 0.025, 0.1),
      mug: new THREE.CylinderGeometry(0.04, 0.035, 0.08, 10),
      coffee: new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10),
      seat: new THREE.CylinderGeometry(0.18, 0.2, 0.06, 14),
      back: new THREE.BoxGeometry(0.34, 0.42, 0.05),
      pole: new THREE.CylinderGeometry(0.035, 0.04, 0.32, 8),
      base: new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12),
      cord: new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6),
      shade: new THREE.ConeGeometry(0.18, 0.16, 12, 1, true),
      bulb: new THREE.SphereGeometry(0.05, 10, 10),
      pot: new THREE.CylinderGeometry(0.13, 0.11, 0.18, 12),
      soil: new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12),
      leaf: new THREE.SphereGeometry(0.1, 8, 8),
      plantTop: new THREE.SphereGeometry(0.12, 8, 8)
    };
    var mats = {
      wood: new THREE.MeshStandardMaterial({ color: 0xE7D4BE, metalness: 0.06, roughness: 0.72 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xD9CBB8, metalness: 0.32, roughness: 0.42 }),
      mug: new THREE.MeshStandardMaterial({ color: 0xEDE6DA, roughness: 0.72 }),
      coffee: new THREE.MeshStandardMaterial({ color: 0x3A2A1C, roughness: 0.9 }),
      seat: new THREE.MeshStandardMaterial({ color: 0xF3EBE1, metalness: 0.04, roughness: 0.72 }),
      chairBack: new THREE.MeshStandardMaterial({ color: 0xE7DDD2, metalness: 0.04, roughness: 0.7 }),
      shade: new THREE.MeshStandardMaterial({ color: 0xEDE6DA, emissive: 0xB79F80, emissiveIntensity: 0.08, side: THREE.DoubleSide, roughness: 0.8 }),
      bulb: new THREE.MeshStandardMaterial({ color: 0xEDE6DA, emissive: 0xB79F80, emissiveIntensity: 0.16 }),
      pot: new THREE.MeshStandardMaterial({ color: 0xC4A090, roughness: 0.72, metalness: 0.06 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x2A2118, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3E9A40, roughness: 0.68, metalness: 0.02, emissive: 0x4AAA48, emissiveIntensity: 0.12 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1C1916, metalness: 0.16, roughness: 0.72 }),
      foot: new THREE.MeshStandardMaterial({ color: 0x2E2924, metalness: 0.12, roughness: 0.72 }),
      eye: new THREE.MeshBasicMaterial({ color: 0xEDE6DA }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x1C1916 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x24201C, metalness: 0.06, roughness: 0.92 }),
      glassWin: new THREE.MeshStandardMaterial({
        color: 0x2E2924, transparent: true, opacity: 0.16,
        metalness: 0.18, roughness: 0.46,
        emissive: 0x1C1916, emissiveIntensity: 0.02,
        side: THREE.DoubleSide
      }),
      mullion: new THREE.MeshStandardMaterial({ color: 0xC47E1E, metalness: 0.28, roughness: 0.4, emissive: 0xC47E1E, emissiveIntensity: 0.16 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x1C1916, metalness: 0.04, roughness: 0.92 }),
      recess: new THREE.MeshStandardMaterial({ color: 0xEDE6DA, emissive: 0xB79F80, emissiveIntensity: 0.1 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x3F3830, metalness: 0.28, roughness: 0.62 })
    };
    var zoneStrip = {};
    var zoneScreen = {};
    function stripMat(color) {
      var key = String(color);
      if (!zoneStrip[key]) {
        zoneStrip[key] = new THREE.MeshStandardMaterial({
          color: 0x3F3830, emissive: 0xB79F80, emissiveIntensity: 0.06, metalness: 0.55, roughness: 0.46
        });
      }
      return zoneStrip[key];
    }
    function screenMat(glowCol) {
      var key = String(glowCol);
      if (!zoneScreen[key]) {
        var m = new THREE.MeshStandardMaterial({
          color: 0x1C1916, emissive: new THREE.Color(0xB79F80), emissiveIntensity: 0.06,
          metalness: 0.2, roughness: 0.62
        });
        m.userData.baseEmissive = 0.06;
        zoneScreen[key] = m;
        screenMats.push(m);
      }
      return zoneScreen[key];
    }
    return { geos: geos, mats: mats, stripMat: stripMat, screenMat: screenMat, zoneStrip: zoneStrip, zoneScreen: zoneScreen };
  }

  /* ---------- 3D builders ---------- */
  function highlight3D(zoneId, staffId) {
    botMeshes.forEach(function (b) {
      var activeZone = b.userData.zoneId === zoneId;
      var activeStaff = b.userData.staffId === staffId;
      var base = b.userData.baseScale || 1;
      var s = (activeStaff ? 1.28 : (activeZone ? 1.1 : 1)) * base;
      b.scale.setScalar(s);
      if (b.userData.glow) {
        b.userData.glow.visible = !!(activeStaff || activeZone);
        b.userData.glow.material.opacity = activeStaff ? 0.18 : 0.07;
      }
    });
    var mid = window.HQLook ? window.HQLook.floorBaseY(6) * 0.46 : (FLOOR_PITCH * 5) / 2;
    Object.keys(zoneRoots).forEach(function (id) {
      var g = zoneRoots[id];
      if (!g || !g.userData.matFloor) return;
      var on = id === zoneId;
      if (window.HQLook) {
        g.userData.matFloor.color.set(on ? 0xE8C060 : 0xE4B45C);
        g.userData.matFloor.emissive.set(0xE8B050);
        g.userData.matFloor.emissiveIntensity = on ? 0.22 : 0.16;
      } else {
        g.userData.matFloor.color.set(on ? 0x2E2924 : 0x24201C);
        g.userData.matFloor.emissive.set(on ? 0x3A332C : 0x1C1916);
        g.userData.matFloor.emissiveIntensity = on ? 0.1 : 0.02;
      }
      if (window.HQLook) {
        g.userData.goalZ = 0;
        g.userData.goalScale = 1;
      } else {
        g.userData.goalZ = on ? (g.userData.lifeOffice ? 4.15 : 0.72) : 0;
        g.userData.goalScale = on ? (g.userData.lifeOffice ? 1 : 1.035) : (g.userData.lifeOffice ? 0.7 : 0.985);
      }
      if (g.userData.fasciaMat) {
        if (window.HQLook) {
          g.userData.fasciaMat.color.set(0xD4922A);
          g.userData.fasciaMat.emissive.set(0xC47E1E);
          g.userData.fasciaMat.emissiveIntensity = on ? 0.5 : 0.4;
        } else {
          g.userData.fasciaMat.color.set(on ? 0xB79F80 : 0x3F3830);
          g.userData.fasciaMat.emissive.set(on ? 0xB79F80 : 0x000000);
          g.userData.fasciaMat.emissiveIntensity = on ? 0.55 : 0;
        }
      }
      if (g.userData.coveMat) {
        g.userData.coveMat.emissiveIntensity = on ? 0.45 : 0.05;
      }
      if (g.userData.screenMat) g.userData.screenMat.emissiveIntensity = on ? 0.14 : 0.03;
      if (g.userData.labelMat) g.userData.labelMat.opacity = on ? 1 : 0.46;
      if (g.userData.glassMats) {
        g.userData.glassMats.forEach(function (m) {
          m.opacity = on ? 0.2 : 0.1;
          m.emissiveIntensity = on ? 0.06 : 0.02;
        });
      }
    });
    if (runtime3d && runtime3d.controls && zoneRoots[zoneId]) {
      var y = zoneRoots[zoneId].position.y + 0.35;
      runtime3d.focusY = mid + (y - mid) * 0.34;
      runtime3d.suspendFrame = false;
      runtime3d.frameLife = false;
      runtime3d.focusY = null;
    }
  }

  function makeCuteBot(color, shape, shared) {
    if (!window.HQLook) {
      var g = new THREE.Group();
      g.userData.baseY = 0;
      g.userData.baseScale = 1;
      return g;
    }
    return window.HQLook.makeAgent(THREE, color, shape, shared);
  }

  function applyLifePose(bot, agent, t) {
    if (window.HQLook && bot.userData.fashion) {
      window.HQLook.applyPose(bot, agent, t);
      return;
    }
    var baseY = bot.userData.baseY || 0;
    bot.position.x = agent.x;
    bot.position.z = agent.z;
    bot.position.y = baseY;
    bot.rotation.y = agent.yaw;
  }

  function towerView(topY) {
    var top = topY || (window.HQLook ? window.HQLook.floorBaseY(6) + window.HQLook.pitch : 12);
    return {
      target: new THREE.Vector3(8.2, 6.2, 0.15),
      pos: new THREE.Vector3(34, Math.max(14, top * 0.95), 50)
    };
  }

  function frameTower() {
    if (!runtime3d || !runtime3d.controls) return;
    var view = towerView();
    runtime3d.frameLife = false;
    runtime3d.wasLife = false;
    runtime3d.focusY = null;
    runtime3d.suspendFrame = false;
    runtime3d.userSteer = false;
    runtime3d.glide = { pos: view.pos.clone(), target: view.target.clone() };
    runtime3d.controls.autoRotate = false;
  }

  function setTowerWash(mode) {
    if (!runtime3d || !runtime3d.applyWash) return;
    runtime3d.wash = runtime3d.applyWash(mode, runtime3d.look);
    var btn = $('btnWash');
    if (btn) {
      var day = runtime3d.wash === 'day';
      btn.textContent = day ? '晝' : '金';
      btn.title = day ? '日間幕牆，再按轉黃金時刻' : '黃金時刻，再按轉日間';
      btn.setAttribute('aria-pressed', day ? 'true' : 'false');
    }
  }

  function syncLifeFromLive() {
    if (!runtime3d || !runtime3d.lifeSim || !window.HQLifeSim || !lifeLayout) return;
    try {
      var zone = findZone('life');
      var inferred = window.HQLifeSim.inferLifeRoster(liveData || {}, zone.staff, lifeLayout, Date.now());
      runtime3d.lifeSim.setIntents(inferred.intents);
      var title = inferred.meetingTitle || '';
      if (title !== runtime3d.meetingTitle) {
        runtime3d.meetingTitle = title;
        if (runtime3d.paintMeet) runtime3d.paintMeet(title);
      }
    } catch (err) {
      console.warn('life floor sync failed', err);
    }
  }

  function makeDesk(zoneColor, shared) {
    var g = new THREE.Group();
    var geos = shared.geos, mats = shared.mats;
    var top = new THREE.Mesh(geos.deskTop, mats.wood);
    top.position.y = 0.58;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    var strip = new THREE.Mesh(geos.strip, shared.stripMat(zoneColor));
    strip.position.set(0, 0.52, 0.3);
    g.add(strip);
    [[-0.68, -0.28], [0.68, -0.28], [-0.68, 0.28], [0.68, 0.28]].forEach(function (p) {
      var leg = new THREE.Mesh(geos.deskLeg, mats.metal);
      leg.position.set(p[0], 0.275, p[1]);
      g.add(leg);
    });
    function addMonitor(ox, glowCol) {
      var stand = new THREE.Mesh(geos.monStand, mats.metal);
      stand.position.set(ox, 0.68, -0.12);
      g.add(stand);
      var bezel = new THREE.Mesh(geos.monBezel, mats.metal);
      bezel.position.set(ox, 0.9, -0.14);
      bezel.rotation.x = -0.12;
      g.add(bezel);
      var screen = new THREE.Mesh(geos.monScreen, shared.screenMat(glowCol));
      screen.position.set(ox, 0.9, -0.125);
      screen.rotation.x = -0.12;
      g.add(screen);
    }
    addMonitor(-0.28, zoneColor);
    addMonitor(0.28, 0x4ea1ff);
    var kb = new THREE.Mesh(geos.kb, mats.metal);
    kb.position.set(-0.15, 0.63, 0.12);
    g.add(kb);
    var mouse = new THREE.Mesh(geos.mouse, mats.metal);
    mouse.position.set(0.28, 0.635, 0.14);
    g.add(mouse);
    var mug = new THREE.Mesh(geos.mug, mats.mug);
    mug.position.set(0.55, 0.66, 0.1);
    g.add(mug);
    var coffee = new THREE.Mesh(geos.coffee, mats.coffee);
    coffee.position.set(0.55, 0.69, 0.1);
    g.add(coffee);
    var seat = new THREE.Mesh(geos.seat, mats.seat);
    seat.position.set(0, 0.38, 0.72);
    seat.castShadow = true;
    g.add(seat);
    var back = new THREE.Mesh(geos.back, mats.chairBack);
    back.position.set(0, 0.62, 0.88);
    g.add(back);
    var pole = new THREE.Mesh(geos.pole, mats.metal);
    pole.position.set(0, 0.2, 0.72);
    g.add(pole);
    var base = new THREE.Mesh(geos.base, mats.metal);
    base.position.set(0, 0.04, 0.72);
    g.add(base);
    var cord = new THREE.Mesh(geos.cord, mats.metal);
    cord.position.set(0, 2.0, 0);
    g.add(cord);
    var shade = new THREE.Mesh(geos.shade, mats.shade);
    shade.position.set(0, 1.72, 0);
    g.add(shade);
    var bulb = new THREE.Mesh(geos.bulb, mats.bulb);
    bulb.position.set(0, 1.68, 0);
    g.add(bulb);
    return g;
  }

  function makePlant(shared) {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(shared.geos.pot, shared.mats.pot);
    pot.position.y = 0.09;
    pot.castShadow = true;
    g.add(pot);
    var soil = new THREE.Mesh(shared.geos.soil, shared.mats.soil);
    soil.position.y = 0.18;
    g.add(soil);
    for (var i = 0; i < 5; i++) {
      var leaf = new THREE.Mesh(shared.geos.leaf, shared.mats.leaf);
      var a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.09, 0.3 + (i % 3) * 0.07, Math.sin(a) * 0.09);
      leaf.scale.set(1, 0.75 + (i % 2) * 0.2, 1);
      g.add(leaf);
    }
    var top = new THREE.Mesh(shared.geos.plantTop, shared.mats.leaf);
    top.position.y = 0.48;
    g.add(top);
    return g;
  }

  function makeShelf(zoneColor, shared) {
    var g = new THREE.Group();
    var frame = shared.mats.frame;
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.08), frame);
    back.position.set(0, 0.6, -0.1);
    g.add(back);
    for (var y = 0; y < 3; y++) {
      var board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.28), frame);
      board.position.set(0, 0.25 + y * 0.35, 0);
      g.add(board);
      for (var b = 0; b < 3; b++) {
        var book = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.22, 0.18),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL((b * 0.17 + y * 0.1) % 1, 0.55, 0.55),
            roughness: 0.7
          })
        );
        book.position.set(-0.3 + b * 0.28, 0.38 + y * 0.35, 0.02);
        g.add(book);
      }
    }
    var accent = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.04, 0.09),
      new THREE.MeshStandardMaterial({ color: zoneColor, emissive: zoneColor, emissiveIntensity: 0.45 })
    );
    accent.position.set(0, 1.18, -0.1);
    g.add(accent);
    return g;
  }

  function makeCoffeeStation(shared) {
    var g = new THREE.Group();
    var counter = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1c2433, metalness: 0.3, roughness: 0.45 })
    );
    counter.position.y = 0.35;
    counter.castShadow = true;
    g.add(counter);
    var top = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.05, 0.62),
      new THREE.MeshStandardMaterial({ color: 0xe8eef6, metalness: 0.15, roughness: 0.35 })
    );
    top.position.y = 0.72;
    g.add(top);
    var machine = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.5, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.6, roughness: 0.3 })
    );
    machine.position.set(-0.3, 0.98, 0);
    g.add(machine);
    var led = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x3dffa8, emissive: 0x3dffa8, emissiveIntensity: 0.9 })
    );
    led.position.set(-0.3, 1.15, 0.18);
    g.add(led);
    var cooler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0xb8d4ff, transparent: true, opacity: 0.55, metalness: 0.2, roughness: 0.2 })
    );
    cooler.position.set(0.4, 1.0, 0);
    g.add(cooler);
    return g;
  }

  function makeGlassWall(w, h, color) {
    var g = new THREE.Group();
    var glassMat = new THREE.MeshStandardMaterial({
      color: 0x8EC8EA, transparent: true, opacity: 0.32,
      metalness: 0.04, roughness: 0.1,
      emissive: 0xB7DFF6, emissiveIntensity: 0.08,
      side: THREE.DoubleSide, depthWrite: false
    });
    var pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    pane.position.y = h / 2;
    g.add(pane);
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xC47E1E, metalness: 0.28, roughness: 0.4, emissive: 0xC47E1E, emissiveIntensity: 0.22 });
    var topF = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, 0.06), frameMat);
    topF.position.y = h;
    g.add(topF);
    var botF = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, 0.06), frameMat);
    botF.position.y = 0.03;
    g.add(botF);
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.08, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: 0xE0B46A, emissive: 0xC47E1E, emissiveIntensity: 0.24 })
    );
    stripe.position.y = h * 0.55;
    g.add(stripe);
    g.userData.glassMat = glassMat;
    return g;
  }

  function boot3D() {
    if (typeof THREE === 'undefined') throw new Error('Three.js 未載入');
    if (!THREE.OrbitControls) throw new Error('OrbitControls 未載入');

    dispose3D();
    botMeshes = [];
    zoneRoots = {};
    screenMats = [];

    var shared = createSharedPool();
    var lifePaint = null;
    var lifeBots = {};
    var lifeSim = null;
    var lifeTitle = '';
    var lifeTgtTmp = new THREE.Vector3();
    var lifeCamTmp = new THREE.Vector3();
    var wrap = $('canvas-wrap');
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(window.HQLook ? 0x4C8ED0 : 0x1C1916);
    scene.fog = new THREE.FogExp2(window.HQLook ? 0xC5D4E4 : 0x1C1916, window.HQLook ? 0.0022 : 0.012);

    var camera = new THREE.PerspectiveCamera(window.HQLook ? 44 : 30, 1, 0.1, 280);
    var towerTopY = window.HQLook ? window.HQLook.floorBaseY(6) + window.HQLook.pitch : FLOOR_PITCH * 5;
    var towerMid = window.HQLook ? towerTopY * 0.46 : (FLOOR_PITCH * 5) / 2;
    var overview = towerView(towerTopY);
    camera.position.copy(overview.pos);

    var renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
    renderer.setClearColor(window.HQLook ? 0x4C8ED0 : 0x1C1916, 1);
    renderer.shadowMap.enabled = !isTouch;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = window.HQLook ? 0.78 : 0.94;
    }
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    wrap.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = window.HQLook ? 1.8 : 2.5;
    controls.maxDistance = window.HQLook ? 260 : 80;
    controls.zoomSpeed = window.HQLook ? 1.35 : 1;
    controls.maxPolarAngle = window.HQLook ? Math.PI * 0.92 : Math.PI * 0.5;
    controls.minPolarAngle = window.HQLook ? 0.02 : Math.PI * 0.12;
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.target.copy(overview.target);
    controls.enablePan = !isTouch;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    if (THREE.TOUCH) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
    controls.addEventListener('start', function () {
      controls.autoRotate = false;
      if (runtime3d) {
        runtime3d.userSteer = true;
        runtime3d.suspendFrame = true;
        runtime3d.glide = null;
      }
    });

    var wash = null;
    if (window.HQLook) {
      wash = window.HQLook.createWash(THREE, scene, renderer);
      wash.moon.castShadow = !isTouch;
      if (!isTouch) {
        wash.moon.shadow.mapSize.set(1024, 1024);
        wash.moon.shadow.camera.near = 1;
        wash.moon.shadow.camera.far = 80;
        wash.moon.shadow.camera.left = -24;
        wash.moon.shadow.camera.right = 24;
        wash.moon.shadow.camera.top = 24;
        wash.moon.shadow.camera.bottom = -24;
        wash.moon.shadow.bias = -0.00025;
      }
    } else {
      scene.add(new THREE.HemisphereLight(0xEDE6DA, 0x1C1916, 0.14));
      scene.add(new THREE.AmbientLight(0x3A332C, 0.18));
      var key = new THREE.DirectionalLight(0xF3E6D2, 0.5);
      key.position.set(8, 16, 10);
      key.castShadow = !isTouch;
      if (!isTouch) {
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.near = 1;
        key.shadow.camera.far = 50;
        key.shadow.camera.left = -20;
        key.shadow.camera.right = 20;
        key.shadow.camera.top = 20;
        key.shadow.camera.bottom = -20;
        key.shadow.bias = -0.0002;
      }
      scene.add(key);
      var fill = new THREE.DirectionalLight(0xB79F80, 0.05);
      fill.position.set(-12, 8, -6);
      scene.add(fill);
      var rim = new THREE.DirectionalLight(0xEDE6DA, 0.07);
      rim.position.set(0, 6, -14);
      scene.add(rim);
    }

    // ---- stacked floors: L1 系統 through L6 指揮, all visible at once ----
    var towerTop = towerTopY;
    var podiumR = window.HQLook ? 5.55 : 3.7;
    var podium = new THREE.Mesh(
      new THREE.CylinderGeometry(podiumR, podiumR + 0.45, 0.28, 40),
      new THREE.MeshStandardMaterial({
        color: window.HQLook ? 0xE4B45C : 0x24201C, metalness: window.HQLook ? 0.12 : 0.12, roughness: window.HQLook ? 0.46 : 0.78,
        emissive: window.HQLook ? 0xE8B050 : 0x1C1916, emissiveIntensity: window.HQLook ? 0.16 : 0.06
      })
    );
    podium.position.y = -0.2;
    podium.receiveShadow = true;
    scene.add(podium);

    if (!window.HQLook) {
      var cityGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 14),
        new THREE.MeshBasicMaterial({ color: 0x1C1916, transparent: true, opacity: 0.2, depthWrite: false })
      );
      cityGlow.position.set(0, towerMid, -7.2);
      scene.add(cityGlow);
    }

    var emblem = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.07, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xC47E1E, emissive: 0xC47E1E, emissiveIntensity: 0.36, metalness: 0.28, roughness: 0.4 })
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, towerTop + 1.05, 0);
    scene.add(emblem);
    var emblemCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xF0D090, emissive: 0xC47E1E, emissiveIntensity: 0.2, metalness: 0.28, roughness: 0.42 })
    );
    emblemCore.position.copy(emblem.position);
    scene.add(emblemCore);

    (function makeParticles() {
      var count = isTouch ? 28 : 60;
      var geo = new THREE.BufferGeometry();
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 12;
        positions[i * 3 + 1] = Math.random() * (towerTop + 1.2);
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      particles = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xB79F80, size: 0.025, transparent: true, opacity: 0.1,
        depthWrite: false, sizeAttenuation: true
      }));
      scene.add(particles);
    })();

    function makeCompactDesk(screenMaterial) {
      var g = new THREE.Group();
      var top = new THREE.Mesh(shared.geos.deskTop, shared.mats.wood);
      top.scale.set(0.72, 1, 0.72);
      top.position.y = 0.58;
      g.add(top);
      var leg = new THREE.Mesh(shared.geos.deskLeg, shared.mats.metal);
      leg.position.set(0, 0.28, 0);
      g.add(leg);
      var bezel = new THREE.Mesh(shared.geos.monBezel, shared.mats.metal);
      bezel.scale.set(0.8, 0.8, 1);
      bezel.position.set(0, 0.92, -0.08);
      g.add(bezel);
      var screen = new THREE.Mesh(shared.geos.monScreen, screenMaterial);
      screen.scale.set(0.8, 0.8, 1);
      screen.position.set(0, 0.92, -0.06);
      g.add(screen);
      return g;
    }

    var office = new THREE.Group();
    scene.add(office);
    var floorLayouts = {};

    ZONES.forEach(function (zone) {
      var info = floorInfo(zone);
      var root = new THREE.Group();
      root.position.set(0, window.HQLook ? window.HQLook.floorBaseY(info.level) : (info.level - 1) * FLOOR_PITCH, 0);
      root.userData.zoneId = zone.id;
      root.userData.glassMats = [];
      root.userData.goalZ = 0;
      root.userData.goalScale = 1;

      var lifeHere = zone.id === 'life' && lifeLayout && window.HQLifeScene;
      var slabW = lifeHere ? (lifeLayout.floor && lifeLayout.floor.width) || 9.2 : (window.HQLook ? 9.35 : 6.6);
      var slabD = lifeHere ? (lifeLayout.floor && lifeLayout.floor.depth) || 5.2 : (window.HQLook ? 5.45 : 3.5);
      var halfD = slabD / 2;
      var rugMat = new THREE.MeshStandardMaterial({
        color: window.HQLook ? 0xE4B45C : 0x24201C,
        emissive: window.HQLook ? 0xE8B050 : 0x1C1916,
        emissiveIntensity: window.HQLook ? 0.16 : 0.04,
        roughness: window.HQLook ? 0.55 : 0.93, metalness: window.HQLook ? 0.16 : 0.04
      });
      var slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.18, slabD), rugMat);
      slab.position.y = 0.1;
      slab.receiveShadow = true;
      slab.userData.isZone = true;
      slab.userData.zoneId = zone.id;
      root.add(slab);
      root.userData.matFloor = rugMat;

      var fasciaMat = new THREE.MeshStandardMaterial({
        color: window.HQLook ? 0xD4922A : 0x3F3830,
        emissive: window.HQLook ? 0xC47E1E : 0x000000,
        emissiveIntensity: window.HQLook ? 0.4 : 0,
        metalness: window.HQLook ? 0.28 : 0.62, roughness: 0.4
      });
      var fascia = new THREE.Mesh(new THREE.BoxGeometry(slabW + 0.02, 0.06, 0.045), fasciaMat);
      fascia.position.set(0, 0.19, halfD - 0.005);
      fascia.userData.isZone = true;
      fascia.userData.zoneId = zone.id;
      root.add(fascia);
      var inlay = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, slabW - 0.4), 0.014, 0.09), fasciaMat);
      inlay.position.set(0, 0.198, halfD - 0.13);
      root.add(inlay);
      root.userData.fasciaMat = fasciaMat;

      var coveMat = new THREE.MeshStandardMaterial({
        color: window.HQLook ? 0xF0D090 : 0x3F3830,
        emissive: 0xC47E1E, emissiveIntensity: window.HQLook ? 0.26 : 0.04,
        metalness: 0.3, roughness: 0.5
      });
      var cove = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.2, slabW - 0.25), 0.01, 0.025), coveMat);
      cove.position.set(0, 0.198, halfD - 0.05);
      root.add(cove);
      root.userData.coveMat = coveMat;

      var screenMat = new THREE.MeshStandardMaterial({
        color: 0x1C1916, emissive: 0xB79F80, emissiveIntensity: 0.03,
        metalness: 0.18, roughness: 0.64
      });
      root.userData.screenMat = screenMat;

      if (!window.HQLook) {
        var spine = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, FLOOR_PITCH, 0.08),
          shared.mats.metal
        );
        spine.position.set(0, FLOOR_PITCH * 0.5, lifeHere ? (-halfD + 0.18) : -1.45);
        root.add(spine);
      }

      var centerMark = centerStaff(zone);
      var label = makeLabel(info.code + '  ' + info.short + (centerMark && centerMark.mark ? ' · ' + centerMark.mark : ''));
      label.position.set(0, lifeHere ? 0.42 : 0.72, halfD + (lifeHere ? 0.02 : 0.3));
      label.scale.set(lifeHere ? 1.55 : 2.35, lifeHere ? 0.36 : 0.52, 1);
      root.add(label);
      root.userData.labelMat = label.material;

      if (window.HQLook) {
        if (!shared.look) shared.look = window.HQLook.mats(THREE);
        var storyH = info.level === 1 ? window.HQLook.lobbyH : window.HQLook.pitch;
        window.HQLook.addCurtain(THREE, root, shared.look, {
          storyH: storyH,
          lobby: info.level === 1,
          parapet: info.level === 6
        });
      }

      if (lifeHere) {
        try {
          var builtLife = window.HQLifeScene.build({
            THREE: THREE,
            root: root,
            zone: zone,
            layout: lifeLayout,
            shared: shared,
            surfaceY: 0.19,
            screenMat: screenMat,
            makeCuteBot: makeCuteBot,
            makePlant: makePlant,
            makeGlassWall: makeGlassWall,
            botMeshes: botMeshes
          });
          root.userData.lifeOffice = true;
          lifePaint = builtLife && builtLife.paint;
          floorLayouts.life = lifeLayout;
          if (window.HQOffice) {
            window.HQOffice.dress({
              THREE: THREE,
              root: root,
              zone: zone,
              shared: shared,
              surfaceY: 0.19,
              makePlant: makePlant,
              layout: {
                lamps: [{ x: -1.6, z: 0.05 }, { x: 0.35, z: -0.2 }, { x: 1.05, z: 0.85 }],
                art: { x: -0.15, z: 2.32, yaw: Math.PI },
                greenWall: { x: 0.35, z: -2.32, yaw: 0 }
              },
              extraPlants: [{ x: 3.9, z: 1.45 }]
            });
          }
        } catch (errLife) {
          console.warn('life office build failed', errLife);
          root.userData.lifeOffice = false;
        }
      }
      if (!root.userData.lifeOffice && window.HQOffice && window.HQCampus) {
        try {
          var madeLayout = window.HQCampus.layoutFor(zone.id, zone.staff.map(function (s) { return s.id; }));
          floorLayouts[zone.id] = madeLayout;
          window.HQOffice.build({
            THREE: THREE,
            root: root,
            zone: zone,
            layout: madeLayout,
            shared: shared,
            surfaceY: 0.19,
            makeCuteBot: makeCuteBot,
            makePlant: makePlant,
            makeGlassWall: makeGlassWall,
            botMeshes: botMeshes
          });
          root.userData.lifeOffice = true;
        } catch (errOffice) {
          console.warn('office build failed', zone.id, errOffice);
          floorLayouts[zone.id] = null;
        }
      }
      if (!root.userData.lifeOffice) {
        var shown = Math.min(zone.staff.length, 3);
        for (var idx = 0; idx < shown; idx++) {
          var staff = zone.staff[idx];
          var desk = makeCompactDesk(screenMat);
          var x = (idx - (shown - 1) / 2) * 1.85;
          desk.position.set(x, 0, 0.15);
          root.add(desk);
          var bot = makeCuteBot(zone.color, zone.shape, shared);
          bot.userData.baseScale = window.HQLook ? 0.82 : 0.78;
          bot.scale.setScalar(bot.userData.baseScale);
          bot.position.set(x, window.HQLook ? 0.19 : 0, 0.95);
          bot.userData.zoneId = zone.id;
          bot.userData.staffId = staff.id;
          bot.userData.isBot = true;
          bot.userData.phase = Math.random() * Math.PI * 2;
          bot.userData.baseY = window.HQLook ? 0.19 : 0;
          root.add(bot);
          botMeshes.push(bot);
        }
      }

      office.add(root);
      zoneRoots[zone.id] = root;
    });

    var staffBots = {};
    botMeshes.forEach(function (b) {
      if (b.userData.lifeAgent) {
        lifeBots[b.userData.staffId] = b;
        b.userData.campusAgent = true;
      }
      if (b.userData.staffId) staffBots[b.userData.staffId] = b;
    });
    if (lifePaint && window.HQLifeSim && lifeLayout && zoneRoots.life && zoneRoots.life.userData.lifeOffice) {
      try {
        var inferredLife = window.HQLifeSim.inferLifeRoster(liveData || {}, findZone('life').staff, lifeLayout, Date.now());
        lifeSim = window.HQLifeSim.createSim(lifeLayout, inferredLife.intents);
        lifeTitle = inferredLife.meetingTitle || '';
        lifePaint(lifeTitle);
        lifeSim.agents.forEach(function (a) {
          var bot = lifeBots[a.staffId];
          if (bot) applyLifePose(bot, a, 0);
        });
      } catch (errSim) {
        console.warn('life sim failed', errSim);
        lifeSim = null;
      }
    }

    var campusView = null;
    var director = null;
    if (window.HQCampus && window.HQLifeSim && window.HQLook) {
      try {
        var levelY = {};
        ZONES.forEach(function (z) {
          if (zoneRoots[z.id]) levelY[z.id] = zoneRoots[z.id].position.y + 0.19;
        });
        var bridgeY = levelY.travel || (window.HQLook.floorBaseY(3) + 0.19);
        if (window.HQCampusScene && shared.look) {
          campusView = window.HQCampusScene.build({
            THREE: THREE,
            scene: scene,
            look: shared.look,
            mats: shared.mats,
            shared: shared,
            bridgeY: bridgeY,
            topY: towerTopY,
            makePlant: makePlant,
            makeBot: makeCuteBot
          });
          (campusView.wingBots || []).forEach(function (b) { botMeshes.push(b); });
        }
        var directorFloors = [];
        ZONES.forEach(function (z) {
          var layout = floorLayouts[z.id];
          if (!layout) return;
          directorFloors.push({
            id: z.id,
            layout: layout,
            staff: z.staff,
            sim: z.id === 'life' ? lifeSim : null
          });
        });
        if (directorFloors.length) {
          director = window.HQCampus.createDirector({
            Life: window.HQLifeSim,
            floors: directorFloors,
            levelY: levelY,
            bridgeY: bridgeY,
            getLive: function () { return liveData || {}; }
          });
        }
      } catch (errCampus) {
        console.warn('campus build failed', errCampus);
        director = null;
      }
    }

    function makeLabel(text) {
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(28,25,22,0.92)';
      roundRect(ctx, 48, 30, 416, 68, 2); ctx.fill();
      ctx.strokeStyle = '#B79F80'; ctx.lineWidth = 2;
      roundRect(ctx, 48, 30, 416, 68, 2); ctx.stroke();
      ctx.fillStyle = '#EDE6DA';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var size = 38;
      ctx.font = '500 ' + size + 'px "Noto Serif TC","Songti TC",serif';
      while (size > 22 && ctx.measureText(text).width > 400) {
        size -= 2;
        ctx.font = '500 ' + size + 'px "Noto Serif TC","Songti TC",serif';
      }
      ctx.fillText(text, 256, 66);
      var tex = new THREE.CanvasTexture(canvas);
      var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      var spr = new THREE.Sprite(mat);
      spr.scale.set(3.05, 0.76, 1);
      return spr;
    }

    function makeMiniCard(text, color) {
      var canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 96;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(28,25,22,0.92)';
      roundRect(ctx, 8, 16, 240, 64, 2); ctx.fill();
      ctx.strokeStyle = '#3F3830'; ctx.lineWidth = 1.5;
      roundRect(ctx, 8, 16, 240, 64, 2); ctx.stroke();
      ctx.fillStyle = '#EDE6DA';
      ctx.font = '500 22px "Noto Serif TC","Songti TC",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text.slice(0, 10), 128, 50);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0.94
      }));
      spr.scale.set(1.7, 0.64, 1);
      spr.userData.float = true;
      spr.userData.phase = Math.random() * 6;
      return spr;
    }

    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var downX = 0, downY = 0, moved = false;

    function setPointer(e) {
      var rect = renderer.domElement.getBoundingClientRect();
      var x = e.clientX, y = e.clientY;
      if (x == null && e.changedTouches && e.changedTouches[0]) {
        x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY;
      }
      pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    }

    function pick() {
      raycaster.setFromCamera(pointer, camera);
      var objs = [];
      botMeshes.forEach(function (b) {
        b.traverse(function (o) { if (o.isMesh) objs.push(o); });
      });
      Object.keys(zoneRoots).forEach(function (id) {
        zoneRoots[id].traverse(function (o) {
          if (o.isMesh && o.userData.isZone) objs.push(o);
        });
      });
      var hits = raycaster.intersectObjects(objs, true);
      if (!hits.length) return null;
      var obj = hits[0].object;
      while (obj) {
        if (obj.userData && obj.userData.isBot) return { zoneId: obj.userData.zoneId, staffId: obj.userData.staffId };
        if (obj.userData && obj.userData.isZone) return { zoneId: obj.userData.zoneId, staffId: null };
        obj = obj.parent;
      }
      return null;
    }

    function onPointerDown(e) { downX = e.clientX; downY = e.clientY; moved = false; }
    function onPointerMove(e) {
      if (Math.abs(e.clientX - downX) > 10 || Math.abs(e.clientY - downY) > 10) moved = true;
    }
    function onPointerUp(e) {
      if (moved) return;
      setPointer(e);
      var hit = pick();
      if (hit) {
        if (hit.staffId) selectZone(hit.zoneId, hit.staffId, { openDrawer: true, toast: true });
        else selectZone(hit.zoneId, null, { toast: true, openDrawer: true });
      }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    function resize() {
      var w = wrap.clientWidth || window.innerWidth;
      var h = wrap.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    function onOrient() { setTimeout(resize, 250); }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', onOrient);
    resize();
    requestAnimationFrame(resize);

    var clock = new THREE.Clock();
    var floating = [];
    office.traverse(function (o) { if (o.userData && o.userData.float) floating.push(o); });

    var alive = true;
    var shadowBaked = false;
    function animate() {
      if (!alive) return;
      runtime3d.raf = requestAnimationFrame(animate);
      var dt = clock.getDelta();
      if (dt > 0.05) dt = 0.05;
      var t = clock.elapsedTime;
      Object.keys(zoneRoots).forEach(function (id) {
        var g = zoneRoots[id];
        if (!g || g.userData.goalZ == null) return;
        g.position.z += (g.userData.goalZ - g.position.z) * 0.14;
        var gs = g.userData.goalScale == null ? 1 : g.userData.goalScale;
        g.scale.setScalar(g.scale.x + (gs - g.scale.x) * 0.14);
        if (g.userData.screenMat && g.userData.zoneId === selectedZone) {
          g.userData.screenMat.emissiveIntensity = 0.12 + 0.015 * Math.sin(t * 0.7);
        }
      });
      if (runtime3d.focusY != null && !runtime3d.frameLife && !runtime3d.wasLife) {
        controls.target.y += (runtime3d.focusY - controls.target.y) * 0.1;
      }
      if (runtime3d.frameLife && !runtime3d.suspendFrame && zoneRoots.life) {
        lifeTgtTmp.set(0.35, 0.85, 0.05);
        zoneRoots.life.localToWorld(lifeTgtTmp);
        lifeCamTmp.set(2.6, 2.15, 8.8);
        zoneRoots.life.localToWorld(lifeCamTmp);
        controls.target.lerp(lifeTgtTmp, 0.16);
        camera.position.lerp(lifeCamTmp, 0.16);
        runtime3d.wasLife = true;
      } else if (runtime3d.wasLife && !runtime3d.suspendFrame && !runtime3d.frameLife && runtime3d.towerTarget) {
        controls.target.lerp(runtime3d.towerTarget, 0.08);
        camera.position.lerp(runtime3d.towerPos, 0.08);
        if (controls.target.distanceTo(runtime3d.towerTarget) < 0.15) {
          runtime3d.wasLife = false;
          if (!runtime3d.userSteer) controls.autoRotate = true;
        }
      }
      if (runtime3d.glide && !runtime3d.suspendFrame) {
        controls.target.lerp(runtime3d.glide.target, 0.12);
        camera.position.lerp(runtime3d.glide.pos, 0.12);
        if (camera.position.distanceTo(runtime3d.glide.pos) < 0.4) {
          runtime3d.glide = null;
          if (!runtime3d.userSteer) controls.autoRotate = true;
        }
      }
      controls.update();
      if (director) {
        director.step(dt);
        director.poses().forEach(function (p) {
          var bot = staffBots[p.staffId];
          if (!bot) return;
          var parent = p.riding ? scene : zoneRoots[p.floorId];
          if (parent && bot.parent !== parent) parent.attach(bot);
          applyLifePose(bot, { x: p.x, z: p.z, yaw: p.yaw || 0, anim: p.anim || 'idle' }, t);
          if (p.riding) bot.position.set(p.x, p.y, p.z);
        });
        if (campusView && campusView.car) campusView.car.position.y = director.carY() - 0.1;
        var openDoors = director.openFloors();
        Object.keys(zoneRoots).forEach(function (id) {
          var doors = zoneRoots[id].userData.liftDoors;
          if (!doors || !doors.left) return;
          var spread = openDoors[id] ? 0.38 : 0.14;
          doors.left.position.z += ((-spread) - doors.left.position.z) * 0.2;
          doors.right.position.z += (spread - doors.right.position.z) * 0.2;
        });
      } else if (lifeSim) {
        lifeSim.step(dt);
        lifeSim.agents.forEach(function (a) {
          var bot = lifeBots[a.staffId];
          if (bot) applyLifePose(bot, a, t);
        });
      }
      botMeshes.forEach(function (b) {
        if (b.userData.campusAgent || b.userData.lifeAgent) return;
        if (b.userData.fashion && window.HQLook) {
          window.HQLook.applyPose(b, null, t);
          return;
        }
        b.position.y = (b.userData.baseY || 0) + Math.sin(t * 0.6 + b.userData.phase) * 0.008;
        b.rotation.y = Math.sin(t * 0.2 + b.userData.phase) * 0.025;
      });
      if (campusView && campusView.water) {
        campusView.water.position.y = -0.3 + Math.sin(t * 1.1) * 0.015;
      }
      floating.forEach(function (s) {
        s.position.y = 1.55 + Math.sin(t * 0.5 + s.userData.phase) * 0.015;
      });
      for (var i = 0; i < screenMats.length; i++) {
        var base = screenMats[i].userData.baseEmissive == null ? 0.06 : screenMats[i].userData.baseEmissive;
        screenMats[i].emissiveIntensity = base;
      }
      if (particles) particles.rotation.y = t * 0.006;
      renderer.render(scene, camera);
      if (!isTouch && !shadowBaked && t > 0.6) {
        shadowBaked = true;
        renderer.shadowMap.needsUpdate = true;
        renderer.shadowMap.autoUpdate = false;
      }
    }

    runtime3d = {
      scene: scene,
      renderer: renderer,
      controls: controls,
      shared: shared,
      raf: 0,
      onResize: resize,
      onOrient: onOrient,
      kill: function () { alive = false; },
      lifeSim: lifeSim,
      lifeBots: lifeBots,
      paintMeet: lifePaint,
      meetingTitle: lifeTitle,
      frameLife: false,
      suspendFrame: false,
      wasLife: false,
      userSteer: false,
      towerPos: camera.position.clone(),
      towerTarget: controls.target.clone(),
      director: director,
      glide: null,
      wash: 'day',
      look: shared.look || null,
      applyWash: wash ? wash.apply : null
    };
    if (wash && shared.look) setTowerWash('day');
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (runtime3d && runtime3d.paintMeet) runtime3d.paintMeet(runtime3d.meetingTitle || '');
      });
    }
    animate();

    selectZone(selectedZone || 'cmd');
    return true;
  }

  function enable3D() {
    try {
      if (typeof THREE === 'undefined' || !THREE.OrbitControls) {
        showBootError('找不到本地 3D 引擎。已保留平面總部。');
        enable2D('缺少 Three.js');
        return false;
      }
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) {
        showBootError('此裝置／瀏覽器無法建立 WebGL。已保留平面總部。');
        enable2D('無 WebGL');
        return false;
      }
      boot3D();
      document.body.classList.remove('mode-2d');
      document.body.classList.add('mode-3d');
      var wrap = $('canvas-wrap');
      if (wrap) wrap.setAttribute('aria-hidden', 'false');
      $('bootError').hidden = true;
      var btn = $('btnTry3d');
      if (btn) btn.textContent = '返回平面';
      var hint = $('hint');
      if (hint) hint.textContent = '六層都在舞台 · 點樓層聚焦並開詳情';
      mode = '3d';
      setTimeout(function () {
        if (mode !== '3d') return;
        var canvas = wrap && wrap.querySelector('canvas');
        if (!canvas || canvas.width < 2 || canvas.height < 2) {
          enable2D('3D 畫面異常，已退回平面');
        }
      }, 800);
      return true;
    } catch (err) {
      console.error(err);
      showBootError('3D 初始化失敗：' + (err && err.message ? err.message : String(err)));
      enable2D('3D 失敗');
      return false;
    }
  }

  /* ---------- boot ---------- */
  buildNav();
  renderCenterStrip();
  startLivePolling();
  initCollapse();
  loadReports();
  loadChangelog();

  if ($('btnOpenModal')) {
    $('btnOpenModal').addEventListener('click', function () {
      openModal(selectedZone, selectedStaffId);
    });
  }
  if ($('modalClose')) $('modalClose').addEventListener('click', closeModal);
  if ($('modalBackdrop')) {
    $('modalBackdrop').addEventListener('click', function (e) {
      if (e.target === $('modalBackdrop')) closeModal();
    });
  }
  if ($('btnDirectory')) $('btnDirectory').addEventListener('click', openDirectory);
  if ($('dirClose')) $('dirClose').addEventListener('click', closeDirectory);
  if ($('dirBackdrop')) {
    $('dirBackdrop').addEventListener('click', function (e) {
      if (e.target === $('dirBackdrop')) closeDirectory();
    });
  }
  if ($('dirSearch')) $('dirSearch').addEventListener('input', renderDirectoryTable);
  if ($('dirCat')) $('dirCat').addEventListener('change', renderDirectoryTable);

  if ($('btnReports')) $('btnReports').addEventListener('click', openReports);
  if ($('reportsClose')) $('reportsClose').addEventListener('click', closeReports);
  if ($('reportsBackdrop')) {
    $('reportsBackdrop').addEventListener('click', function (e) {
      if (e.target === $('reportsBackdrop')) closeReports();
    });
  }
  if ($('reportsSearch')) $('reportsSearch').addEventListener('input', renderReportsTable);

  if ($('btnChangelog')) $('btnChangelog').addEventListener('click', function () {
    if (!changelogData) {
      loadChangelog().then(openChangelog);
    } else openChangelog();
  });
  if ($('changelogClose')) $('changelogClose').addEventListener('click', closeChangelog);
  if ($('changelogBackdrop')) {
    $('changelogBackdrop').addEventListener('click', function (e) {
      if (e.target === $('changelogBackdrop')) closeChangelog();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if ($('modalBackdrop') && !$('modalBackdrop').hidden) closeModal();
      else if ($('changelogBackdrop') && !$('changelogBackdrop').hidden) closeChangelog();
      else if ($('reportsBackdrop') && !$('reportsBackdrop').hidden) closeReports();
      else if ($('dirBackdrop') && !$('dirBackdrop').hidden) closeDirectory();
      else closeTopDrawer();
    }
  });

  if ($('btnFrame')) {
    $('btnFrame').addEventListener('click', function () { frameTower(); });
  }

  if ($('btnWash')) {
    $('btnWash').addEventListener('click', function () {
      var next = runtime3d && runtime3d.wash === 'day' ? 'gold' : 'day';
      setTowerWash(next);
    });
  }

  var tryBtn = $('btnTry3d');
  if (tryBtn) {
    tryBtn.addEventListener('click', function () {
      if (mode === '3d') enable2D('手動返回平面');
      else enable3D();
    });
  }

  buildFloorRail();

  Promise.all([loadDirectory(), loadLifeLayout()]).then(function () {
    var hosted = location.protocol === 'https:' || location.protocol === 'http:';
    /* Tower fits the framed stage, including the short mobile stage. 返回平面 stays in the dock. */
    if (hosted) {
      if (!enable3D()) enable2D('平面後備');
    } else {
      enable2D('本機檔案預設平面（可試 3D）');
    }
  });
})();
