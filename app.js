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
    var list = centersOf(zone);
    return list.length ? list[0] : null;
  }

  function centersOf(zone) {
    var out = [];
    if (!zone || !zone.staff) return out;
    zone.staff.forEach(function (s) {
      if (s && s.center) out.push(s);
    });
    return out;
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
    var pref = { 'shared-db': 0, 'invest-platform': 1, wealth: 2, analytics: 3, lab: 4 };
    ZONES.forEach(function (z) {
      centersOf(z).forEach(function (staff) {
        rows.push({ zone: z, staff: staff, status: centerStatus(staff) });
      });
    });
    rows.sort(function (a, b) {
      var oa = pref[a.staff.id];
      var ob = pref[b.staff.id];
      if (oa == null) oa = 9;
      if (ob == null) ob = 9;
      if (oa !== ob) return oa - ob;
      var za = CENTER_ZONE_ORDER[a.zone.id];
      var zb = CENTER_ZONE_ORDER[b.zone.id];
      if (za == null) za = 9;
      if (zb == null) zb = 9;
      return za - zb;
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
    kicker.textContent = '社區設施';
    el.appendChild(kicker);
    rows.forEach(function (row) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'center-line';
      btn.dataset.staff = row.staff.id;
      var name = document.createElement('span');
      name.className = 'cn';
      name.textContent = row.staff.name;
      var st = document.createElement('span');
      st.className = 'cs';
      st.textContent = row.status;
      btn.appendChild(name);
      btn.appendChild(st);
      btn.addEventListener('click', function () {
        if (row.staff.id === 'wealth') {
          openWealthBoard();
          return;
        }
        selectZone(row.zone.id, row.staff.id, { toast: true, openDrawer: true });
      });
      el.appendChild(btn);
    });
  }

  function paintFloorRailCenters() {
    var rail = $('floorRail');
    if (rail && rail.querySelector('[data-place]')) return;
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
  function setHint(text) {
    var hint = $('hint');
    if (!hint) return;
    hint.textContent = text;
    hint.title = text;
  }
  function cameraHint(threeD) {
    if (!threeD) return '而家做緊同今日焦點可以收合 · 可轉立體小鎮';
    if (isTouch) return '單指旋轉 · 雙指拖曳平移同縮放 · 點人入內';
    return '左拖旋轉 · Shift+左拖或右拖平移 · 滾輪縮放 · 點人入內';
  }

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
      var facilities = centersOf(z).map(function (s) { return s.name; });
      btn.innerHTML = '<span class="swatch" style="background:' + z.color + ';color:' + z.color + '"></span>' +
        '<span><div class="name">' + z.name + '</div><div class="meta">' + z.staff.length + ' 代理人 · ' + z.en +
        (facilities.length ? ' · ' + facilities.join('／') : '') + '</div></span>';
      btn.addEventListener('click', function () {
        if (runtime3d && runtime3d.town && window.HQTownView) {
          runtime3d.skipEnter = true;
          window.HQTownView.frameZone(z.id);
        }
        selectZone(z.id, null, { toast: true, openDrawer: true });
      });
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
    $('detailZone').textContent = zone.name + ' · ' + zone.en;
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
    renderWealthDetailLink(staff.id);
  }

  function renderWealthDetailLink(staffId) {
    var link = $('wealthDetailLink');
    if (!link || !window.HQTown || !window.HQTown.fillInvestBoardLink) return;
    var board = staffId === 'wealth' && window.HQTown.wealthBoard
      ? window.HQTown.wealthBoard(liveData || {})
      : null;
    window.HQTown.fillInvestBoardLink(link, board);
  }

  function openWealthBoard() {
    var board = window.HQTown && window.HQTown.wealthBoard
      ? window.HQTown.wealthBoard(liveData || {})
      : { url: 'wealth/', title: '個人財富狀況', label: '進入財富看板' };
    if (board && board.url) window.open(board.url, '_blank', 'noopener');
    if (runtime3d) runtime3d.skipEnter = true;
    selectZone('invest', 'wealth', { toast: true, openDrawer: true });
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
      if (mode === '2d') {
        if (staffId) showTownCard(staffId);
        else closeTownCard();
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
        var simLabel = (window.HQTown && window.HQTown.investPaperLabel)
          ? window.HQTown.investPaperLabel(paper) : 'SIMULATED';
        var paperNote = (typeof paper.note === 'string') ? paper.note.trim() : '';
        html += '<p class="invest-paper"><span class="invest-sim"' +
          (paperNote ? ' title="' + escHtml(paperNote) + '"' : '') + '>' +
          escHtml(simLabel) + '</span>' +
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
      if (window.HQTown && window.HQTown.investBoard && window.HQTown.fillInvestBoardLink) {
        var boardLink = document.createElement('a');
        boardLink.className = 'invest-board-link';
        window.HQTown.fillInvestBoardLink(boardLink, window.HQTown.investBoard(liveData));
        if (!boardLink.hidden) slot.appendChild(boardLink);
      }
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

  /* ---------- Drawers + HUD collapse (same .collapsed / localStorage) ---------- */
  var DRAWER_IDS = ['leftPanel', 'detailPanel', 'feedPanel', 'usageDrawer', 'riskDrawer'];
  var HUD_IDS = ['focusPanel', 'townDuty', 'townIndoor', 'townCaption'];
  function hudDefaultOpen(panelId) {
    if (panelId === 'townDuty') return false;
    if (panelId === 'focusPanel') {
      try { return window.matchMedia('(min-width: 821px)').matches; }
      catch (e) { return true; }
    }
    return true;
  }
  function applyCollapse(panelId, open, persist) {
    var panel = $(panelId);
    if (!panel) return;
    var hud = HUD_IDS.indexOf(panelId) >= 0;
    panel.classList.toggle('collapsed', !open);
    if (hud) panel.removeAttribute('aria-hidden');
    else panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (persist !== false) savePanelState(panelId, open);
    document.querySelectorAll('.dock-btn[data-drawer="' + panelId + '"], .ribbon-chip[data-drawer="' + panelId + '"]').forEach(function (btn) {
      btn.classList.toggle('active', !!open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('[data-collapse="' + panelId + '"]').forEach(function (btn) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.title = open ? '收合' : '展開';
    });
    if (panelId === 'focusPanel') {
      document.documentElement.classList.toggle('focus-collapsed', !open);
      if (runtime3d && runtime3d.onResize) {
        requestAnimationFrame(function () {
          if (runtime3d && runtime3d.onResize) runtime3d.onResize();
        });
      }
    }
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
      applyCollapse(id, loadPanelState(id, false), false);
    });
    HUD_IDS.forEach(function (id) {
      if ($(id)) applyCollapse(id, loadPanelState(id, hudDefaultOpen(id)), false);
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
    document.addEventListener('click', function (e) {
      var node = e.target;
      var btn = null;
      while (node && node !== document) {
        if (node.getAttribute && node.hasAttribute('data-collapse')) { btn = node; break; }
        node = node.parentNode;
      }
      if (!btn) return;
      var id = btn.getAttribute('data-collapse');
      var panel = $(id);
      if (!panel) return;
      applyCollapse(id, panel.classList.contains('collapsed'));
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

  /* ---------- 2D town map (WebGL fallback; same houses and halls) ---------- */
  var townCardId = null;

  function facilityBoard(staffId) {
    if (!window.HQTown) return null;
    if (window.HQTown.showsWealthBoard && window.HQTown.showsWealthBoard(staffId) && window.HQTown.wealthBoard) {
      return window.HQTown.wealthBoard(liveData || {});
    }
    if (window.HQTown.showsInvestBoard && window.HQTown.showsInvestBoard(staffId) && window.HQTown.investBoard) {
      return window.HQTown.investBoard(liveData || {});
    }
    return null;
  }

  function appendInvestBoardChip(cell, staffId) {
    if (!cell || !window.HQTown) return;
    var board = facilityBoard(staffId);
    if (!board) return;
    var a = document.createElement('a');
    a.className = 'town-board-chip';
    a.href = board.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = board.title;
    a.setAttribute('aria-label', board.title);
    a.textContent = board.label;
    cell.appendChild(a);
  }

  function activityNow() {
    if (!window.HQTown) return null;
    return window.HQTown.infer(liveData || {}, window.HQTown.rosterFromZones(ZONES), Date.now());
  }

  function closeTownCard() {
    townCardId = null;
    var panel = $('townIndoor');
    if (panel) panel.hidden = true;
  }

  function showTownCard(id) {
    var panel = $('townIndoor');
    var copy = $('townIndoorCopy');
    if (!panel || !copy || !window.HQTown) return;
    var inferred = activityNow();
    var act = id === 'hall'
      ? window.HQTown.hallBoard(liveData || {}, inferred)
      : (inferred && inferred.byId[id]);
    if (!act) return;
    townCardId = id;
    var lines = id === 'hall' ? {
      kicker: '會議廳',
      who: act.name,
      anim: act.animLabel,
      doing: act.headline,
      detail: act.detail,
      status: act.status || '',
      source: window.HQTown.sourceLabel(act.source)
    } : window.HQTown.hudLines(act);
    var title = $('townIndoorTitle');
    if (title) title.textContent = lines.who || lines.kicker || '室內';
    copy.innerHTML =
      '<div class="kicker">' + escHtml(lines.kicker) + '</div>' +
      '<p class="anim">' + escHtml(lines.anim) + '</p>' +
      '<p class="doing">' + escHtml(lines.doing) + '</p>' +
      '<p class="detail">' + escHtml(lines.detail) + '</p>' +
      '<p class="status">' + escHtml(lines.status) + '</p>' +
      '<p class="source">' + escHtml(lines.source) + '</p>' +
      '<div class="town-avatar pose-' + escHtml(act.anim || 'idle') + (act.away ? ' away' : '') + '" aria-hidden="true"></div>';
    var indoorBoard = facilityBoard(id);
    if (indoorBoard && window.HQTown.fillInvestBoardLink) {
      var indoorLink = document.createElement('a');
      indoorLink.className = 'town-board-link';
      window.HQTown.fillInvestBoardLink(indoorLink, indoorBoard);
      if (!indoorLink.hidden) copy.appendChild(indoorLink);
    }
    panel.hidden = false;
    document.querySelectorAll('.town-plot').forEach(function (el) {
      var on = (id === 'hall' && el.dataset.place === 'hall') || el.dataset.staff === id;
      el.classList.toggle('active', on);
    });
  }

  function townPlot(staffId, label, kind, inferred) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'town-plot kind-' + kind +
      (staffId === 'boss' ? ' is-boss' : '') +
      (kind === 'center' || kind === 'hall' ? ' is-facility' : '') +
      (staffId === 'invest-platform' ? ' is-platform' : '') +
      (staffId === 'wealth' ? ' is-wealth' : '');
    btn.dataset.staff = kind === 'hall' ? '' : staffId;
    btn.dataset.place = kind === 'hall' ? 'hall' : kind;
    var act = null;
    if (kind === 'hall' && inferred) act = window.HQTown.hallBoard(liveData || {}, inferred);
    else if (inferred) act = inferred.byId[staffId];
    var doing = act ? (window.HQTown.outdoorLabel(act) || act.animLabel) : '';
    btn.innerHTML = '<span class="roof"></span><span class="wall"><b>' + escHtml(label) + '</b><small>' +
      escHtml(doing) + '</small></span>';
    btn.addEventListener('click', function () {
      if (staffId === 'wealth') {
        openWealthBoard();
        return;
      }
      if (kind === 'hall') {
        showTownCard('hall');
        toast('會議廳');
        return;
      }
      var hit = findStaffAnywhere(staffId);
      if (hit) selectZone(hit.zone.id, hit.staff.id, { toast: true, openDrawer: true });
    });
    return btn;
  }

  function townChip(staffId, inferred) {
    var person = findStaffAnywhere(staffId);
    var name = person ? person.staff.name : staffId;
    var act = inferred && inferred.byId[staffId];
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'town-pin';
    chip.dataset.staff = staffId;
    chip.textContent = name.slice(0, 1);
    chip.title = name + (act ? ' · ' + (window.HQTown.outdoorLabel(act) || act.animLabel) : '');
    chip.addEventListener('click', function () {
      var hit = findStaffAnywhere(staffId);
      if (hit) selectZone(hit.zone.id, hit.staff.id, { toast: true, openDrawer: true });
    });
    return chip;
  }

  function townCell(plot, crew) {
    var cell = document.createElement('div');
    cell.className = 'town-cell';
    cell.appendChild(plot);
    if (crew && crew.length) {
      var list = document.createElement('div');
      list.className = 'town-crew';
      crew.forEach(function (chip) { list.appendChild(chip); });
      cell.appendChild(list);
    }
    return cell;
  }

  function renderTownDuty() {
    var el = $('townDuty');
    var body = $('townDutyBody');
    if (!el || !body || !window.HQTown) return;
    var inferred = activityNow();
    if (!inferred) return;
    var board = window.HQTown.dutyBoard(inferred);
    var html = '';
    board.forEach(function (group) {
      html += '<section class="town-duty-group"><h3>' + escHtml(group.title) + '</h3>';
      group.people.forEach(function (person) {
        var cls = person.away ? 'away' : (person.anim === 'idle' ? 'is-idle' : '');
        html += '<button type="button" class="' + cls + '" data-staff="' + escHtml(person.staffId) + '">' +
          '<b>' + escHtml(person.name) + '</b><span>' + escHtml(person.text) + '</span></button>';
      });
      html += '</section>';
    });
    body.innerHTML = html;
    body.querySelectorAll('button[data-staff]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var hit = findStaffAnywhere(btn.getAttribute('data-staff'));
        if (hit) selectZone(hit.zone.id, hit.staff.id, { toast: true, openDrawer: true });
      });
    });
    var indoor = window.HQTownView && window.HQTownView.indoors && window.HQTownView.indoors();
    el.hidden = !!indoor;
  }

  function renderTown2D() {
    var root = $('fbOffice');
    if (!root || !window.HQTown) return;
    root.classList.add('is-town');
    var keep = townCardId;
    var old = root.querySelector('.town-map');
    if (old) old.parentNode.removeChild(old);
    var ph = $('fbGridPlaceholder');
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    var stack = root.querySelector('.fb-stack');
    if (stack) stack.parentNode.removeChild(stack);
    var inferred = activityNow();
    var roster = window.HQTown.rosterFromZones(ZONES);
    var crews = {};
    window.HQTown.postsFor(roster).forEach(function (post) {
      if (post.kind !== 'yard') return;
      if (!crews[post.homeId]) crews[post.homeId] = [];
      crews[post.homeId].push(townChip(post.staffId, inferred));
    });
    var map = document.createElement('div');
    map.className = 'town-map';
    var grass = document.createElement('div');
    grass.className = 'town-grass';
    var civic = document.createElement('div');
    civic.className = 'town-row';
    window.HQTown.PUBLIC.forEach(function (spec) {
      var id = spec.kind === 'hall' ? 'hall' : spec.staffId;
      var kind = spec.kind === 'hall' ? 'hall' : 'center';
      var cell = townCell(
        townPlot(id, spec.label, kind, inferred),
        kind === 'center' ? crews[spec.staffId] : null
      );
      if (kind === 'center') appendInvestBoardChip(cell, spec.staffId);
      civic.appendChild(cell);
    });
    grass.appendChild(civic);
    var homes = document.createElement('div');
    homes.className = 'town-row';
    window.HQTown.HOUSES.forEach(function (spec) {
      var person = findStaffAnywhere(spec.staffId);
      var cell = townCell(
        townPlot(spec.staffId, person ? person.staff.name : spec.staffId, 'house', inferred),
        crews[spec.staffId]
      );
      appendInvestBoardChip(cell, spec.staffId);
      homes.appendChild(cell);
    });
    grass.appendChild(homes);
    var overflow = window.HQTown.pinsFor(roster);
    if (overflow.length) {
      var pins = document.createElement('div');
      pins.className = 'town-pins';
      overflow.forEach(function (spec) { pins.appendChild(townChip(spec.staffId, inferred)); });
      grass.appendChild(pins);
    }
    map.appendChild(grass);
    var indoor = document.createElement('section');
    indoor.className = 'town-indoor';
    indoor.id = 'townIndoor';
    indoor.hidden = true;
    indoor.innerHTML =
      '<div class="panel-toolbar">' +
        '<button type="button" class="town-back-2d" id="townBack2d">返回小鎮</button>' +
        '<button type="button" class="panel-toggle" data-collapse="townIndoor" aria-expanded="true" aria-controls="townIndoorCopy">' +
          '<span class="town-indoor-title" id="townIndoorTitle">室內</span>' +
          '<span class="collapse-chevron" aria-hidden="true">›</span>' +
        '</button>' +
      '</div>' +
      '<div class="panel-body town-indoor-copy" id="townIndoorCopy"></div>';
    map.appendChild(indoor);
    root.appendChild(map);
    var back = $('townBack2d');
    if (back) back.addEventListener('click', closeTownCard);
    applyCollapse('townIndoor', loadPanelState('townIndoor', true), false);
    if (keep) showTownCard(keep);
  }

  function build2D() { renderTown2D(); }

  function highlight2D(zoneId) {
    document.querySelectorAll('.floor-btn').forEach(function (el) {
      var on = el.dataset.place === selectedStaffId;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('.town-plot').forEach(function (el) {
      el.classList.toggle('active', el.dataset.staff === selectedStaffId || (el.dataset.place === 'hall' && false));
    });
    }

  function buildFloorRail() {
    var rail = $('floorRail');
    if (!rail) return;
    rail.querySelectorAll('.floor-btn').forEach(function (btn) {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        var place = btn.dataset.place || btn.dataset.id;
        if (place === 'hall') {
          if (runtime3d && runtime3d.town && window.HQTownView) window.HQTownView.openHall();
          else showTownCard('hall');
          toast('會議廳');
          return;
        }
        if (place === 'wealth') {
          openWealthBoard();
          return;
        }
        var house = window.HQTown && window.HQTown.houseByStaff(place);
        var pub = window.HQTown && window.HQTown.publicById(place);
        selectZone((house && house.zoneId) || (pub && pub.zoneId) || btn.dataset.id, place, { toast: true, openDrawer: true });
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
      btn.textContent = '立體小鎮';
    }
    setHint(cameraHint(false));
    if (reason) pushFeed({ zone: 'sys', text: '平面小鎮：' + reason });
    build2D();
    renderTownDuty();
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

  /* Town stage. Tower mesh boot was removed; HQTownView is the only 3D view. */

  function highlight3D(zoneId, staffId) {
    if (!runtime3d || !runtime3d.town || !window.HQTownView) return;
    if (runtime3d.skipEnter) {
      runtime3d.skipEnter = false;
      return;
    }
    if (staffId && window.HQTownView.showStaff) window.HQTownView.showStaff(staffId);
  }

  function frameTower() {
    if (runtime3d && runtime3d.town && window.HQTownView) window.HQTownView.frame();
  }

  function setTowerWash(mode) {
    if (!runtime3d || !runtime3d.town || !window.HQTownView) return;
    runtime3d.wash = window.HQTownView.setWash(mode);
    var btn = $('btnWash');
    if (btn) {
      var day = runtime3d.wash !== 'gold';
      btn.textContent = day ? '晝' : '金';
      btn.title = day ? '日間小鎮，再按轉黃金時刻' : '黃金時刻，再按轉日間';
      btn.setAttribute('aria-pressed', day ? 'true' : 'false');
    }
  }

  function syncLifeFromLive() {
    if (runtime3d && runtime3d.town && window.HQTownView) window.HQTownView.sync(liveData || {});
    if (mode === '2d') renderTown2D();
    renderTownDuty();
  }

  function enable3D() {
    try {
      if (typeof THREE === 'undefined' || !THREE.OrbitControls || !window.HQTownView) {
        showBootError('找不到本地 3D 引擎。已保留平面小鎮。');
        enable2D('缺少 Three.js');
        return false;
      }
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) {
        showBootError('此裝置／瀏覽器無法建立 WebGL。已保留平面小鎮。');
        enable2D('無 WebGL');
        return false;
      }
      dispose3D();
      runtime3d = window.HQTownView.boot({
        THREE: THREE,
        wrap: $('canvas-wrap'),
        zones: ZONES,
        isTouch: isTouch,
        getLive: function () { return liveData; },
        onPick: function (hit) {
          if (!hit || !runtime3d) return;
          if (hit.kind === 'hall') {
            toast('會議廳');
            return;
          }
          if (hit.staffId === 'wealth' || hit.place === 'wealth') {
            openWealthBoard();
            return;
          }
          if (!hit.staffId) return;
          var found = findStaffAnywhere(hit.staffId);
          if (!found) return;
          runtime3d.skipEnter = true;
          selectZone(found.zone.id, found.staff.id, { toast: true, openDrawer: true });
        }
      });
      document.body.classList.remove('mode-2d');
      document.body.classList.add('mode-3d');
      var wrap = $('canvas-wrap');
      if (wrap) wrap.setAttribute('aria-hidden', 'false');
      $('bootError').hidden = true;
      var btn = $('btnTry3d');
      if (btn) btn.textContent = '平面地圖';
      setHint(cameraHint(true));
      mode = '3d';
      if (runtime3d && window.HQTownView) window.HQTownView.sync(liveData || {});
      if (runtime3d) runtime3d.skipEnter = true;
      renderDetail(selectedZone || 'cmd', selectedStaffId);
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
      else if (window.HQTownView && window.HQTownView.indoors && window.HQTownView.indoors()) window.HQTownView.frame();
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
      if (mode === '3d') enable2D('手動返回平面地圖');
      else enable3D();
    });
  }

  buildFloorRail();
  renderTownDuty();

  Promise.all([loadDirectory(), loadLifeLayout()]).then(function () {
    var hosted = location.protocol === 'https:' || location.protocol === 'http:';
    /* Cartoon town is the primary stage. Flat town map is the WebGL fallback. */
    if (hosted) {
      if (!enable3D()) enable2D('平面後備');
    } else {
      enable2D('本機檔案預設平面小鎮（可轉立體）');
    }
  });
})();
