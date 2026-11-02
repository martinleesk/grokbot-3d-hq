(function () {
  'use strict';

  var ZONES = window.HQ_DATA.zones;
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

  function findZone(id) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].id === id) return ZONES[i];
    return ZONES[0];
  }

  function findStaff(zone, staffId) {
    for (var i = 0; i < zone.staff.length; i++) if (zone.staff[i].id === staffId) return zone.staff[i];
    return zone.staff[0];
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

  function loadPanelState(key, fallback) {
    try {
      var v = localStorage.getItem('hq3d_panel_' + key);
      if (v === null || v === undefined) return fallback;
      return v === '1';
    } catch (e) { return fallback; }
  }
  function savePanelState(key, open) {
    try { localStorage.setItem('hq3d_panel_' + key, open ? '1' : '0'); } catch (e) {}
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
      btn.innerHTML = '<span class="swatch" style="background:' + z.color + ';color:' + z.color + '"></span>' +
        '<span><div class="name">' + z.name + '</div><div class="meta">' + z.staff.length + ' 代理人 · ' + z.en + '</div></span>';
      btn.addEventListener('click', function () { selectZone(z.id, null, { toast: true }); });
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
    av.style.background = 'linear-gradient(160deg,' + zone.color + ',#fff8)';
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
      row.innerHTML = '<span class="mini-bot" style="background:' + zone.color + '">' + s.name.slice(0, 1) + '</span>' +
        '<span><div class="rn">' + s.name + '</div><div class="rr">' + s.role + '</div></span>';
      row.addEventListener('click', function () { selectZone(zone.id, s.id, { openModal: true, toast: true }); });
      roster.appendChild(row);
    });

    highlight3D(zone.id, staff.id);
    highlight2D(zone.id);
  }

  function selectZone(zoneId, staffId, opts) {
    opts = opts || {};
    var prevZone = selectedZone;
    var prevStaff = selectedStaffId;
    renderDetail(zoneId, staffId);
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
    av.style.background = 'linear-gradient(160deg,' + zone.color + ',#fff8)';
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
      pill.className = 'auditor-pill ' + (ok ? 'ok' : 'fail');
      pill.textContent = ok ? 'Auditor · 健康' : 'Auditor · 異常';
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
          selectZone(f.zone || selectedZone, f.staffId || null, { toast: true, openModal: !!f.staffId });
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
          selectZone(d.zone || selectedZone, d.staffId || null, { toast: true });
        } else if (d.staffId) {
          var hit = findStaffAnywhere(d.staffId);
          if (hit) selectZone(hit.zone.id, d.staffId, { toast: true });
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

  /* ---------- Collapse panels ---------- */
  function applyCollapse(panelId, open) {
    var panel = $(panelId);
    if (!panel) return;
    panel.classList.toggle('collapsed', !open);
    savePanelState(panelId, open);
  }
  function initCollapse() {
    ['leftPanel', 'detailPanel', 'feedPanel', 'focusPanel'].forEach(function (id) {
      var open = loadPanelState(id, true);
      applyCollapse(id, open);
    });
    document.querySelectorAll('.collapse-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-panel');
        var panel = $(id);
        if (!panel) return;
        applyCollapse(id, panel.classList.contains('collapsed'));
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

  /* ---------- 2D office map ---------- */
  function build2D() {
    var root = $('fbOffice');
    if (!root) return;
    var ph = $('fbGridPlaceholder');
    if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
    var oldGrid = root.querySelector('.fb-grid');
    if (oldGrid) oldGrid.parentNode.removeChild(oldGrid);
    if (!root.querySelector('.fb-windows')) {
      var win = document.createElement('div');
      win.className = 'fb-windows';
      win.setAttribute('aria-hidden', 'true');
      win.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
      root.insertBefore(win, root.firstChild);
    }
    if (!root.querySelector('.fb-aisle')) {
      var aisle = document.createElement('div');
      aisle.className = 'fb-aisle';
      aisle.setAttribute('aria-hidden', 'true');
      root.appendChild(aisle);
    }
    var grid = document.createElement('div');
    grid.className = 'fb-grid';
    var levelMap = { cmd: 'L6', invest: 'L5', life: 'L4', travel: 'L3', content: 'L2', sys: 'L1' };
    ZONES.forEach(function (z, zi) {
      var cell = document.createElement('div');
      cell.className = 'fb-zone' + (z.id === selectedZone ? ' active' : '');
      cell.dataset.id = z.id;
      cell.style.borderColor = z.color;
      var head = document.createElement('div');
      head.className = 'fb-zone-head';
      head.innerHTML = '<h3 style="color:' + z.color + '">' + z.name + '</h3><span class="tag">' + (levelMap[z.id] || z.en) + '</span>';
      cell.appendChild(head);
      var desks = document.createElement('div');
      desks.className = 'fb-desks';
      var n = Math.min(z.staff.length, 9);
      for (var i = 0; i < n; i++) {
        var d = document.createElement('div');
        d.className = 'fb-desk';
        d.title = z.staff[i].name;
        var b = document.createElement('div');
        b.className = 'fb-bot';
        b.style.background = z.color;
        b.style.animationDelay = (i * 0.12 + zi * 0.05) + 's';
        b.textContent = z.staff[i].name.slice(0, 1);
        b.addEventListener('click', (function (zoneId, staffId) {
          return function (ev) { ev.stopPropagation(); selectZone(zoneId, staffId, { openModal: true, toast: true }); };
        })(z.id, z.staff[i].id));
        d.appendChild(b);
        desks.appendChild(d);
      }
      cell.appendChild(desks);
      var plant = document.createElement('div');
      plant.className = 'fb-plant';
      plant.style.right = '10px';
      plant.style.top = '42px';
      cell.appendChild(plant);
      cell.addEventListener('click', function () { selectZone(z.id, null, { toast: true }); });
      grid.appendChild(cell);
    });
    root.appendChild(grid);
  }

  function highlight2D(zoneId) {
    document.querySelectorAll('.fb-zone').forEach(function (el) {
      el.classList.toggle('active', el.dataset.id === zoneId);
    });
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
    if (hint) hint.textContent = '點區域／機器人查看團隊';
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
      wood: new THREE.MeshStandardMaterial({ color: 0xc9b59a, metalness: 0.08, roughness: 0.55 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x2a3344, metalness: 0.65, roughness: 0.35 }),
      mug: new THREE.MeshStandardMaterial({ color: 0xf0f4fa, roughness: 0.4 }),
      coffee: new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.8 }),
      seat: new THREE.MeshStandardMaterial({ color: 0x1e2838, metalness: 0.2, roughness: 0.55 }),
      chairBack: new THREE.MeshStandardMaterial({ color: 0x243044, metalness: 0.15, roughness: 0.5 }),
      shade: new THREE.MeshStandardMaterial({ color: 0xf2e6c9, emissive: 0xffe0a0, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.6 }),
      bulb: new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffd080, emissiveIntensity: 0.9 }),
      pot: new THREE.MeshStandardMaterial({ color: 0xd8c3a5, roughness: 0.55, metalness: 0.05 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3dcf74, roughness: 0.55, metalness: 0.05 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.4, roughness: 0.45 }),
      foot: new THREE.MeshStandardMaterial({ color: 0x121820, metalness: 0.3, roughness: 0.5 }),
      eye: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x101820 }),
      wall: new THREE.MeshStandardMaterial({ color: 0x121a2a, metalness: 0.45, roughness: 0.4 }),
      glassWin: new THREE.MeshStandardMaterial({
        color: 0x8eb6ff, transparent: true, opacity: 0.22,
        metalness: 0.7, roughness: 0.1,
        emissive: 0x3a6aaa, emissiveIntensity: 0.25,
        side: THREE.DoubleSide
      }),
      mullion: new THREE.MeshStandardMaterial({ color: 0xd0d8e8, metalness: 0.5, roughness: 0.3 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0x0e1522, metalness: 0.2, roughness: 0.8 }),
      recess: new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffe0a8, emissiveIntensity: 0.85 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x2a3348, metalness: 0.25, roughness: 0.5 })
    };
    var zoneStrip = {};
    var zoneScreen = {};
    function stripMat(color) {
      var key = String(color);
      if (!zoneStrip[key]) {
        zoneStrip[key] = new THREE.MeshStandardMaterial({
          color: color, emissive: color, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4
        });
      }
      return zoneStrip[key];
    }
    function screenMat(glowCol) {
      var key = String(glowCol);
      if (!zoneScreen[key]) {
        var m = new THREE.MeshStandardMaterial({
          color: 0x0a1220, emissive: new THREE.Color(glowCol), emissiveIntensity: 0.55,
          metalness: 0.2, roughness: 0.25
        });
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
      var s = activeStaff ? 1.28 : (activeZone ? 1.1 : 1);
      b.scale.setScalar(s);
      if (b.userData.glow) {
        b.userData.glow.visible = activeStaff || activeZone;
        b.userData.glow.material.opacity = activeStaff ? 0.7 : 0.32;
      }
    });
    Object.keys(zoneRoots).forEach(function (id) {
      var g = zoneRoots[id];
      if (!g || !g.userData.matFloor) return;
      g.userData.matFloor.emissiveIntensity = id === zoneId ? 0.28 : 0.08;
      if (g.userData.glassMats) {
        g.userData.glassMats.forEach(function (m) {
          m.opacity = id === zoneId ? 0.28 : 0.18;
          m.emissiveIntensity = id === zoneId ? 0.22 : 0.08;
        });
      }
    });
  }

  function makeCuteBot(color, shape, shared) {
    var group = new THREE.Group();
    var c = new THREE.Color(color);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: c.clone().lerp(new THREE.Color(0xffffff), 0.12),
      metalness: 0.22, roughness: 0.38,
      emissive: c, emissiveIntensity: 0.12
    });
    var accentMat = new THREE.MeshStandardMaterial({
      color: c, metalness: 0.35, roughness: 0.32,
      emissive: c, emissiveIntensity: 0.4
    });
    var darkMat = shared.mats.dark;
    var body;
    if (THREE.CapsuleGeometry) {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 4, 10), bodyMat);
    } else {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 12), bodyMat);
    }
    body.position.y = 0.38;
    body.castShadow = true;
    group.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), bodyMat);
    head.position.y = 0.82;
    head.castShadow = true;
    group.add(head);
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), darkMat);
    ant.position.y = 1.08;
    group.add(ant);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), accentMat);
    tip.position.y = 1.18;
    group.add(tip);
    var badge;
    if (shape === 'cylinder') badge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10), accentMat);
    else if (shape === 'cone') badge = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 8), accentMat);
    else if (shape === 'pyramid') badge = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09), accentMat);
    else if (shape === 'cross') {
      badge = new THREE.Group();
      badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), accentMat));
      badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), accentMat));
    } else if (shape === 'rounded') badge = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), accentMat);
    else badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), accentMat);
    badge.position.set(0, 0.42, 0.2);
    group.add(badge);
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 16), accentMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.62;
    group.add(collar);
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), shared.mats.eye);
    var eyeR = eyeL.clone();
    eyeL.position.set(-0.08, 0.84, 0.18);
    eyeR.position.set(0.08, 0.84, 0.18);
    group.add(eyeL); group.add(eyeR);
    var pL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), shared.mats.pupil);
    var pR = pL.clone();
    pL.position.set(-0.08, 0.84, 0.215);
    pR.position.set(0.08, 0.84, 0.215);
    group.add(pL); group.add(pR);
    var fL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), shared.mats.foot);
    var fR = fL.clone();
    fL.scale.set(1.2, 0.55, 1.3); fR.scale.copy(fL.scale);
    fL.position.set(-0.1, 0.05, 0.02); fR.position.set(0.1, 0.05, 0.02);
    group.add(fL); group.add(fR);
    var glow = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 24),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    glow.visible = false;
    group.add(glow);
    group.userData.glow = glow;
    group.userData.accentLight = null;
    group.position.y = 0;
    group.userData.baseY = 0;
    return group;
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
      color: 0xa8c4e8, transparent: true, opacity: 0.18,
      metalness: 0.55, roughness: 0.12,
      emissive: new THREE.Color(color), emissiveIntensity: 0.1,
      side: THREE.DoubleSide
    });
    var pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    pane.position.y = h / 2;
    g.add(pane);
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xe8eef8, metalness: 0.4, roughness: 0.35 });
    var topF = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, 0.06), frameMat);
    topF.position.y = h;
    g.add(topF);
    var botF = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, 0.06, 0.06), frameMat);
    botF.position.y = 0.03;
    g.add(botF);
    var stripe = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.08, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 })
    );
    stripe.position.y = h * 0.55;
    g.add(stripe);
    g.userData.glassMat = glassMat;
    return g;
  }

  function makeFloorTileTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#151c2a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(120,160,220,0.12)';
    ctx.lineWidth = 2;
    for (var i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(128, i * 32); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(180,210,255,0.03)';
    for (var x = 0; x < 4; x++) for (var y = 0; y < 4; y++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * 32, y * 32, 32, 32);
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(14, 10);
    return tex;
  }

  function boot3D() {
    if (typeof THREE === 'undefined') throw new Error('Three.js 未載入');
    if (!THREE.OrbitControls) throw new Error('OrbitControls 未載入');

    dispose3D();
    botMeshes = [];
    zoneRoots = {};
    screenMats = [];

    var shared = createSharedPool();
    var wrap = $('canvas-wrap');
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.018);

    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 140);
    camera.position.set(17.5, 15.5, 17.5);

    var renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
    renderer.setClearColor(0x070b14, 1);
    renderer.shadowMap.enabled = !isTouch;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    if (renderer.toneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
    }
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    wrap.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 11;
    controls.maxDistance = 36;
    controls.maxPolarAngle = Math.PI * 0.44;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.target.set(0, 1.2, 0);
    controls.enablePan = !isTouch;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    if (THREE.TOUCH) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
    controls.addEventListener('start', function () { controls.autoRotate = false; });

    // ---- lighting: ≤3 dynamic (key + fill + rim); no PointLights ----
    scene.add(new THREE.HemisphereLight(0x6a8cff, 0x1a1018, 0.55));
    scene.add(new THREE.AmbientLight(0x304060, 0.42));

    var key = new THREE.DirectionalLight(0xffe2c4, 0.85);
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

    var fill = new THREE.DirectionalLight(0x6a9fff, 0.38);
    fill.position.set(-12, 8, -6);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xff6b8a, 0.2);
    rim.position.set(0, 6, -14);
    scene.add(rim);

    // ---- HQ platform ----
    var floorTex = makeFloorTileTexture();
    var floorMat = new THREE.MeshStandardMaterial({
      map: floorTex, color: 0xffffff,
      metalness: 0.35, roughness: 0.42,
      emissive: 0x0a1428, emissiveIntensity: 0.15
    });
    var floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 22), floorMat);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    scene.add(floor);

    var plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(15.2, 15.8, 48),
      new THREE.MeshStandardMaterial({
        color: 0x4ea1ff, emissive: 0x4ea1ff, emissiveIntensity: 0.55,
        metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide
      })
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.02;
    scene.add(plazaRing);

    var cityGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 12),
      new THREE.MeshBasicMaterial({ color: 0x1a2a48, transparent: true, opacity: 0.55, depthWrite: false })
    );
    cityGlow.position.set(0, 5, -14);
    scene.add(cityGlow);

    var backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 0.3), shared.mats.wall);
    backWall.position.set(0, 3.4, -10.2);
    scene.add(backWall);
    var sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 22), shared.mats.wall);
    sideWall.position.set(-14.5, 3.4, 0);
    scene.add(sideWall);

    for (var w = 0; w < 6; w++) {
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.2), shared.mats.glassWin);
      pane.position.set(-11.5 + w * 4.5, 3.2, -10.0);
      scene.add(pane);
      var mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 4.4, 0.1), shared.mats.mullion);
      mullion.position.set(-9.25 + w * 4.5, 3.2, -10.0);
      scene.add(mullion);
      // emissive window sill instead of PointLight
      var sill = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.08, 0.2),
        new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffd090, emissiveIntensity: 0.55 })
      );
      sill.position.set(-11.5 + w * 4.5, 1.05, -9.7);
      scene.add(sill);
    }

    var ceiling = new THREE.Mesh(new THREE.BoxGeometry(29, 0.15, 21), shared.mats.ceiling);
    ceiling.position.y = 5.6;
    scene.add(ceiling);

    // fewer ceiling recesses, emissive only (no PointLights)
    for (var cx = -8; cx <= 8; cx += 8) {
      for (var cz = -5; cz <= 5; cz += 5) {
        var recess = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.45), shared.mats.recess);
        recess.position.set(cx, 5.48, cz);
        scene.add(recess);
      }
    }

    var emblem = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.08, 10, 32),
      new THREE.MeshStandardMaterial({ color: 0x6eb6ff, emissive: 0x4ea1ff, emissiveIntensity: 0.65, metalness: 0.7, roughness: 0.25 })
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 4.8, 0);
    scene.add(emblem);
    var emblemCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8ec5ff, emissiveIntensity: 0.8 })
    );
    emblemCore.position.copy(emblem.position);
    scene.add(emblemCore);

    var lounge = makeCoffeeStation(shared);
    lounge.position.set(0, 0, 0);
    scene.add(lounge);

    // soft dust particles — rotate only, no buffer rewrite
    (function makeParticles() {
      var count = isTouch ? 40 : 90;
      var geo = new THREE.BufferGeometry();
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 28;
        positions[i * 3 + 1] = Math.random() * 5.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.PointsMaterial({
        color: 0xb8d4ff, size: 0.035, transparent: true, opacity: 0.4,
        depthWrite: false, sizeAttenuation: true
      });
      particles = new THREE.Points(geo, mat);
      scene.add(particles);
    })();

    var layout = [
      { id: 'cmd', x: -8, z: -4 },
      { id: 'invest', x: 0, z: -4 },
      { id: 'life', x: 8, z: -4 },
      { id: 'travel', x: -8, z: 4 },
      { id: 'content', x: 0, z: 4 },
      { id: 'sys', x: 8, z: 4 }
    ];

    var office = new THREE.Group();
    scene.add(office);

    layout.forEach(function (pos) {
      var zone = findZone(pos.id);
      var root = new THREE.Group();
      root.position.set(pos.x, 0, pos.z);
      root.userData.zoneId = zone.id;
      root.userData.glassMats = [];

      var rugMat = new THREE.MeshStandardMaterial({
        color: 0x1a2233,
        emissive: new THREE.Color(zone.color),
        emissiveIntensity: 0.08,
        roughness: 0.85, metalness: 0.05
      });
      var rug = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.05, 6.4), rugMat);
      rug.position.y = 0.03;
      rug.receiveShadow = true;
      rug.userData.isZone = true;
      rug.userData.zoneId = zone.id;
      root.add(rug);
      root.userData.matFloor = rugMat;

      var border = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.03, 6.5),
        new THREE.MeshStandardMaterial({
          color: zone.color, emissive: zone.color, emissiveIntensity: 0.3,
          metalness: 0.4, roughness: 0.4
        })
      );
      border.position.y = 0.01;
      root.add(border);

      // zone accent emissive orb instead of PointLight
      var orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshStandardMaterial({
          color: zone.color, emissive: zone.color, emissiveIntensity: 0.9, transparent: true, opacity: 0.85
        })
      );
      orb.position.set(0, 3.0, 0);
      root.add(orb);

      var gw1 = makeGlassWall(6.8, 1.6, zone.color);
      gw1.position.set(0, 0, 3.15);
      root.add(gw1);
      root.userData.glassMats.push(gw1.userData.glassMat);

      var gw2 = makeGlassWall(6.0, 1.6, zone.color);
      gw2.rotation.y = Math.PI / 2;
      gw2.position.set(3.55, 0, 0);
      root.add(gw2);
      root.userData.glassMats.push(gw2.userData.glassMat);

      var label = makeLabel(zone.name, zone.color);
      label.position.set(0, 2.85, -2.7);
      root.add(label);

      var shelf = makeShelf(zone.color, shared);
      shelf.position.set(-2.8, 0, -2.5);
      root.add(shelf);

      var cols = 3;
      zone.staff.forEach(function (staff, idx) {
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        if (row > 2) return;
        var desk = makeDesk(zone.color, shared);
        desk.position.set(-2.1 + col * 2.15, 0, -1.35 + row * 1.75);
        root.add(desk);

        var bot = makeCuteBot(zone.color, zone.shape, shared);
        bot.position.set(desk.position.x, 0, desk.position.z + 0.55);
        bot.userData.zoneId = zone.id;
        bot.userData.staffId = staff.id;
        bot.userData.isBot = true;
        bot.userData.phase = Math.random() * Math.PI * 2;
        bot.userData.baseY = 0;
        root.add(bot);
        botMeshes.push(bot);

        if (idx % 3 === 0) {
          var card = makeMiniCard(staff.name, zone.color);
          card.position.set(bot.position.x, 1.55, bot.position.z);
          root.add(card);
        }
      });

      [[-3.2, -2.7], [3.2, -2.7], [3.2, 2.6], [-3.2, 2.6]].forEach(function (p, i) {
        if (i > zone.staff.length) return;
        var plant = makePlant(shared);
        plant.position.set(p[0], 0, p[1]);
        root.add(plant);
      });

      office.add(root);
      zoneRoots[zone.id] = root;
    });

    function makeLabel(text, color) {
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(8,14,28,0.82)';
      roundRect(ctx, 16, 24, 480, 80, 22); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      roundRect(ctx, 16, 24, 480, 80, 22); ctx.stroke();
      ctx.shadowColor = color; ctx.shadowBlur = 16;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 42px "Noto Sans TC","PingFang TC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 66);
      var tex = new THREE.CanvasTexture(canvas);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(3.4, 0.85, 1);
      return spr;
    }

    function makeMiniCard(text, color) {
      var canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 96;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(8,14,28,0.88)';
      roundRect(ctx, 8, 16, 240, 64, 14); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      roundRect(ctx, 8, 16, 240, 64, 14); ctx.stroke();
      ctx.fillStyle = '#e8f0ff';
      ctx.font = '24px "Noto Sans TC",sans-serif';
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
        if (hit.staffId) selectZone(hit.zoneId, hit.staffId, { openModal: true, toast: true });
        else selectZone(hit.zoneId, null, { toast: true });
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

    var clock = new THREE.Clock();
    var floating = [];
    office.traverse(function (o) { if (o.userData && o.userData.float) floating.push(o); });

    var alive = true;
    var shadowBaked = false;
    function animate() {
      if (!alive) return;
      runtime3d.raf = requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
      controls.update();
      botMeshes.forEach(function (b) {
        b.position.y = (b.userData.baseY || 0) + Math.sin(t * 2.1 + b.userData.phase) * 0.045;
        b.rotation.y = Math.sin(t * 0.55 + b.userData.phase) * 0.18;
      });
      floating.forEach(function (s) {
        s.position.y = 1.55 + Math.sin(t * 1.4 + s.userData.phase) * 0.09;
      });
      for (var i = 0; i < screenMats.length; i++) {
        screenMats[i].emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 3.2 + i * 0.7) + 0.08 * Math.sin(t * 11 + i);
      }
      if (particles) particles.rotation.y = t * 0.02;
      emblem.rotation.z = t * 0.4;
      emblemCore.position.y = 4.8 + Math.sin(t * 1.5) * 0.06;
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
      kill: function () { alive = false; }
    };
    animate();

    selectZone(selectedZone || 'cmd');
    return true;
  }

  function preferMobile2D() {
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    var narrow = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return touch || narrow || ios;
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
      if (hint) hint.textContent = '單指旋轉 · 雙指縮放 · 點區域／機器人';
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
    }
  });

  var tryBtn = $('btnTry3d');
  if (tryBtn) {
    tryBtn.addEventListener('click', function () {
      if (mode === '3d') enable2D('手動返回平面');
      else enable3D();
    });
  }

  loadDirectory().then(function () {
    var hosted = location.protocol === 'https:' || location.protocol === 'http:';
    if (hosted) {
      if (!enable3D()) {
        enable2D(preferMobile2D() ? '手機／觸控平面後備' : '平面後備');
      }
    } else {
      enable2D(preferMobile2D() ? '本機檔案預設平面（上載後自動 3D）' : '本機檔案預設平面（可試 3D）');
    }
  });
})();
