/* Cartoon-town activities. No THREE dependency.
   Indoor poses come from live.json: status, focus, calendar, and optional
   live.agents / live.campus.meetings / live.town.meetings.
   idle | walk | sit | meeting are the only poses. A private appointment
   that is happening now is idle + away (out, not pretending to type). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HQTown = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var ANIMS = { idle: 1, walk: 1, sit: 1, meeting: 1 };
  var EXPLICIT_BEFORE_MS = 10 * 60 * 1000;
  var EXPLICIT_AFTER_MS = 90 * 60 * 1000;
  var ALIAS = { invest: 'advisor' };

  var HOUSES = [
    { staffId: 'boss', zoneId: 'cmd', x: -7.4, z: -1.05, w: 2.55, d: 2.15, h: 1.62, roof: 0xE2A31A, wall: 0xFFF6E8 },
    { staffId: 'sec', zoneId: 'life', x: -3.55, z: -1.2, w: 1.9, d: 1.72, h: 1.36, roof: 0xE15D5D, wall: 0xFFF4F0 },
    { staffId: 'finance', zoneId: 'life', x: -0.15, z: -1.28, w: 1.9, d: 1.72, h: 1.38, roof: 0xE08A28, wall: 0xFFF6EA },
    { staffId: 'life', zoneId: 'life', x: 3.25, z: -1.15, w: 1.95, d: 1.76, h: 1.4, roof: 0xE07090, wall: 0xFFF3F6 },
    { staffId: 'advisor', zoneId: 'invest', x: -6.55, z: 4.2, w: 2.05, d: 1.82, h: 1.42, roof: 0x3E92D0, wall: 0xF3F7FC },
    { staffId: 'travel', zoneId: 'travel', x: -2.45, z: 4.35, w: 1.92, d: 1.76, h: 1.36, roof: 0x2EAEA0, wall: 0xF2FBFA },
    { staffId: 'news', zoneId: 'content', x: 1.55, z: 4.25, w: 1.9, d: 1.72, h: 1.36, roof: 0x9A6AD0, wall: 0xF7F3FC },
    { staffId: 'auditor', zoneId: 'sys', x: 5.35, z: 4.15, w: 1.88, d: 1.72, h: 1.4, roof: 0x6A9A48, wall: 0xF6FBF2 }
  ];

  var PUBLIC = [
    { id: 'shared-db', staffId: 'shared-db', zoneId: 'sys', kind: 'center', x: -6.3, z: -7.55, w: 2.9, d: 2.15, h: 1.72, roof: 0x3E86C4, wall: 0xF4F8FC, label: '共用資料庫' },
    { id: 'analytics', staffId: 'analytics', zoneId: 'invest', kind: 'center', x: -1.55, z: -7.65, w: 3.05, d: 2.15, h: 1.76, roof: 0x2EAA96, wall: 0xF3FBFA, label: '數據分析' },
    { id: 'lab', staffId: 'lab', zoneId: 'content', kind: 'center', x: 3.05, z: -7.5, w: 2.75, d: 2.1, h: 1.7, roof: 0xE07A3A, wall: 0xFFF6F0, label: '研創中心' },
    { id: 'hall', staffId: null, zoneId: 'cmd', kind: 'hall', x: 8.15, z: -6.55, w: 4.5, d: 2.7, h: 2.05, roof: 0xD45348, wall: 0xFFF6EE, label: '會議廳' }
  ];

  var PIN_SLOTS = {
    byd: { x: 8.55, z: 1.85 }, '2800': { x: 9.35, z: 1.85 }, qqq: { x: 10.15, z: 1.85 }, voo: { x: 10.95, z: 1.85 },
    orcl: { x: 8.55, z: 2.6 }, sdiv: { x: 9.35, z: 2.6 }, rsss: { x: 10.15, z: 2.6 }, spacex: { x: 10.95, z: 2.6 },
    dcf: { x: 8.55, z: 3.35 }, passive: { x: 9.35, z: 3.35 }, retire: { x: 10.15, z: 3.35 }, home: { x: 10.95, z: 3.35 },
    health: { x: -11.4, z: 2.15 }, mind: { x: -10.55, z: 2.15 },
    learn: { x: -11.4, z: 2.95 }, meet: { x: -10.55, z: 2.95 },
    social: { x: -11.6, z: 5.15 }, sum: { x: -10.75, z: 5.15 }, tr: { x: -9.9, z: 5.15 },
    research: { x: -11.2, z: 5.95 }, scout: { x: -10.35, z: 5.95 }
  };

  var SIGNS = [
    { id: 'invest-lane', text: '投資街', x: 9.7, z: 1.15 },
    { id: 'life-lane', text: '生活巷', x: -11.0, z: 1.4 },
    { id: 'content-lane', text: '內容巷', x: -10.8, z: 4.45 }
  ];

  function yearOf(live, nowMs) {
    var s = live && live.updated != null ? String(live.updated) : '';
    var m = s.match(/(\d{4})/);
    if (m) return +m[1];
    return new Date(nowMs).getUTCFullYear();
  }

  function hktStamp(year, month, day, hour, minute) {
    return Date.UTC(year, month - 1, day, (hour || 0) - 8, minute || 0, 0);
  }

  function hktFromStamp(ms) {
    var d = new Date(ms + 8 * 3600 * 1000);
    return {
      y: d.getUTCFullYear(),
      mo: d.getUTCMonth() + 1,
      d: d.getUTCDate(),
      h: d.getUTCHours(),
      mi: d.getUTCMinutes()
    };
  }

  function parseWhen(when, year) {
    var m = String(when || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s+(\d{1,2})\s*:\s*(\d{2}))?/);
    if (!m) return null;
    return hktStamp(year, +m[1], +m[2], m[3] != null ? +m[3] : 9, m[4] != null ? +m[4] : 0);
  }

  function parseDue(due) {
    var m = String(due || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return { y: +m[1], mo: +m[2], d: +m[3] };
  }

  function tokens(s) {
    var found = String(s || '').toLowerCase().match(/[a-z][a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g);
    return found || [];
  }

  function hasTokenOverlap(a, b) {
    var ta = tokens(a);
    var tb = tokens(b);
    for (var i = 0; i < ta.length; i++) {
      for (var j = 0; j < tb.length; j++) {
        if (ta[i] === tb[j] || ta[i].indexOf(tb[j]) >= 0 || tb[j].indexOf(ta[i]) >= 0) return true;
      }
    }
    return false;
  }

function clockRanges(detail) {
  var re = /(\d{1,2})\s*:\s*(\d{2})\s*[–\-~到至]+\s*(\d{1,2})\s*:\s*(\d{2})/g;
  var out = [];
  var s = String(detail || '');
  var m;
  while ((m = re.exec(s))) {
    out.push({
      sh: +m[1], sm: +m[2], eh: +m[3], em: +m[4],
      label: m[0], index: m.index, end: m.index + m[0].length
    });
  }
  out.forEach(function (r, i) {
    var to = i + 1 < out.length ? out[i + 1].index : s.length;
    r.context = s.slice(r.end, to);
  });
  return out;
}

function pickCalendar(cals, context, title) {
  function hits(text) {
    var found = [];
    (cals || []).forEach(function (c) {
      if (c && hasTokenOverlap(text, c.title || '')) found.push(c);
    });
    return found;
  }
  var byContext = hits(context || '');
  if (byContext.length === 1) return byContext[0];
  var byTitle = hits(title || '');
  if (byTitle.length === 1) return byTitle[0];
  return null;
}

  function windowOnDay(y, mo, d, sh, sm, eh, em) {
    var start = hktStamp(y, mo, d, sh, sm);
    var end = hktStamp(y, mo, d, eh, em);
    if (end <= start) end += 24 * 3600 * 1000;
    return { start: start, end: end };
  }

  function inExplicitWindow(stamp, nowMs) {
    if (stamp == null || !isFinite(stamp)) return false;
    return nowMs >= stamp - EXPLICIT_BEFORE_MS && nowMs <= stamp + EXPLICIT_AFTER_MS;
  }

  function isIdleStatus(status) {
    return /待機|待命/.test(String(status || ''));
  }

  function isWalkStatus(status) {
    return /巡邏|短走|行路|外出中/.test(String(status || ''));
  }

  function rosterFromZones(zones) {
    var out = [];
    (zones || []).forEach(function (z) {
      (z.staff || []).forEach(function (s) {
        if (!s || !s.id) return;
        out.push({
          id: s.id,
          name: s.name || s.id,
          role: s.role || '',
          status: s.status || '',
          zoneId: z.id,
          center: !!s.center
        });
      });
    });
    return out;
  }

  function indexRoster(roster) {
    var byId = {};
    (roster || []).forEach(function (p) { if (p && p.id) byId[p.id] = p; });
    return byId;
  }

  function resolveId(id, byId) {
    if (!id) return '';
    if (byId[id]) return id;
    var alias = ALIAS[id];
    if (alias && byId[alias]) return alias;
    return '';
  }

  function houseByStaff(staffId) {
    for (var i = 0; i < HOUSES.length; i++) {
      if (HOUSES[i].staffId === staffId) return HOUSES[i];
    }
    return null;
  }

  function publicById(id) {
    for (var i = 0; i < PUBLIC.length; i++) {
      if (PUBLIC[i].id === id || PUBLIC[i].staffId === id) return PUBLIC[i];
    }
    return null;
  }

  function pinsFor(roster) {
    var housed = {};
    var centers = {};
    HOUSES.forEach(function (h) { housed[h.staffId] = true; });
    PUBLIC.forEach(function (p) { if (p.staffId) centers[p.staffId] = true; });
    var out = [];
    var extra = 0;
    (roster || []).forEach(function (p) {
      if (!p || housed[p.id] || centers[p.id]) return;
      var slot = PIN_SLOTS[p.id];
      var x;
      var z;
      if (slot) {
        x = slot.x;
        z = slot.z;
      } else {
        x = -8 + (extra % 8) * 0.75;
        z = 7.2 + Math.floor(extra / 8) * 0.65;
        extra++;
      }
      out.push({ staffId: p.id, zoneId: p.zoneId, x: x, z: z });
    });
    return out;
  }

  function porchOf(house) {
    var south = house.z > 2;
    var sign = south ? -1 : 1;
    var z = house.z + sign * (house.d / 2 + 0.46);
    return {
      x: house.x,
      z: z,
      yaw: south ? Math.PI : 0,
      walkTo: { x: house.x + 0.35, z: house.z + sign * (house.d / 2 + 1.45) }
    };
  }

  function focusLists(live, byId) {
    var map = {};
    (live && live.focus || []).forEach(function (f) {
      if (!f) return;
      var id = resolveId(f.staffId, byId);
      if (!id) return;
      if (!map[id]) map[id] = [];
      map[id].push(f);
    });
    return map;
  }

  function pickFocus(list) {
    var best = null;
    var bestKey = Infinity;
    (list || []).forEach(function (f) {
      var due = parseDue(f.due);
      var key = due ? Date.UTC(due.y, due.mo - 1, due.d) : 9e15;
      if (!best || key < bestKey) {
        best = f;
        bestKey = key;
      }
    });
    return best;
  }

  function focusBlurb(primary, all) {
    if (!primary) return '';
    var extra = [];
    (all || []).forEach(function (f) {
      if (f !== primary && f.title) extra.push(f.title);
    });
    var line = primary.detail || '';
    if (extra.length) line = (line ? line + '　' : '') + '另有：' + extra.join('、');
    return line;
  }

  function calendarsOnDay(live, y, mo, d, year) {
    var out = [];
    (live && live.calendar || []).forEach(function (c) {
      if (!c) return;
      var stamp = parseWhen(c.when, year);
      if (stamp == null) return;
      var parts = hktFromStamp(stamp);
      if (parts.y === y && parts.mo === mo && parts.d === d) out.push(c);
    });
    return out;
  }

  function scheduleFor(person, focuses, live, nowMs, year) {
    var hit = null;
    (focuses || []).forEach(function (f) {
      var day = parseDue(f.due);
      if (!day) return;
      clockRanges(f.detail).forEach(function (r) {
        var w = windowOnDay(day.y, day.mo, day.d, r.sh, r.sm, r.eh, r.em);
        if (nowMs < w.start || nowMs >= w.end) return;
        var matched = pickCalendar(
          calendarsOnDay(live, day.y, day.mo, day.d, year),
          r.context || '',
          f.title || ''
        );
        var where = matched ? String(matched.where || '') : '';
        var title = (matched && matched.title) || f.title || r.label;
        var kind = 'note';
        if (where.indexOf('私人') >= 0) kind = 'away';
        else if (where.indexOf('工作') >= 0 || /會議|開會|meeting/i.test(title) || /會議|開會|meeting/i.test(f.title || '')) kind = 'meeting';
        hit = { kind: kind, title: title, detail: f.detail || '', focus: f };
      });
    });
    return hit;
  }

  function explicitMeetings(live, nowMs, year) {
    var map = {};
    function take(list, source) {
      (list || []).forEach(function (m) {
        if (!m || !Array.isArray(m.staffIds) || !m.staffIds.length) return;
        if (m.when) {
          var stamp = parseWhen(m.when, year);
          if (stamp == null || !inExplicitWindow(stamp, nowMs)) return;
        }
        m.staffIds.forEach(function (id) {
          if (!id) return;
          map[id] = { title: m.title || '會議', source: source };
        });
      });
    }
    var campus = live && live.campus && live.campus.meetings;
    var town = live && live.town && live.town.meetings;
    take(campus, 'live.campus');
    take(town, 'live.town');
    return map;
  }

  function placeFor(person, anim) {
    if (anim === 'meeting') return 'hall';
    if (person.center) return person.id;
    if (houseByStaff(person.id)) return 'house';
    return 'pin';
  }

  function applyCopy(act, person, primary) {
    var title = primary && primary.title;
    if (act.anim === 'meeting') {
      act.animLabel = '開會';
      act.headline = '正在會議廳：' + (act.meetingTitle || title || '會議');
    } else if (act.anim === 'walk') {
      act.animLabel = '短走';
      act.headline = '沿屋前小路短走';
    } else if (act.away) {
      act.animLabel = '外出';
      act.headline = '外出：' + (act.meetingTitle || title || '私人行程');
    } else if (act.anim === 'idle') {
      act.animLabel = '待命';
      act.headline = title ? ('待命 · 未開始：' + title) : '待命，沒有進行中的工作';
    } else if (person.center) {
      act.animLabel = '坐著辦公';
      act.headline = (person.name || '') + '：' + (person.status || '運作中');
    } else {
      act.animLabel = '坐著辦公';
      act.headline = title ? ('坐在書桌處理：' + title) : ('坐在書桌：' + (person.status || person.role || '運作中'));
    }
    act.detail = focusBlurb(primary, act.focuses) || person.role || '';
    act.monitor = title || person.status || act.animLabel;
  }

  function infer(live, roster, nowMs) {
    live = live || {};
    if (nowMs == null) nowMs = Date.now();
    var year = yearOf(live, nowMs);
    var byId = indexRoster(roster);
    var focuses = focusLists(live, byId);
    var meetings = explicitMeetings(live, nowMs, year);
    var activities = {};
    var list = [];

    (roster || []).forEach(function (person) {
      if (!person || !person.id) return;
      var mine = focuses[person.id] || [];
      var primary = pickFocus(mine);
      var idle = isIdleStatus(person.status);
      var act = {
        staffId: person.id,
        name: person.name || person.id,
        role: person.role || '',
        zoneId: person.zoneId || '',
        center: !!person.center,
        status: person.status || '',
        anim: idle ? 'idle' : (isWalkStatus(person.status) ? 'walk' : 'sit'),
        away: false,
        meetingTitle: '',
        headline: '',
        detail: '',
        animLabel: '',
        monitor: '',
        source: 'status',
        focuses: mine,
        place: 'pin'
      };
      if (!person.center) {
        var slot = scheduleFor(person, mine, live, nowMs, year);
        if (slot && slot.kind === 'meeting') {
          act.anim = 'meeting';
          act.away = false;
          act.meetingTitle = slot.title;
          act.source = 'schedule';
          if (slot.focus) primary = slot.focus;
        } else if (slot && slot.kind === 'away') {
          act.anim = 'idle';
          act.away = true;
          act.meetingTitle = slot.title;
          act.source = 'schedule';
          if (slot.focus) primary = slot.focus;
        } else if (slot && slot.kind === 'note') {
          act.source = 'schedule';
          act.meetingTitle = slot.title;
          if (slot.focus) primary = slot.focus;
        }
        var listed = meetings[person.id];
        if (listed) {
          act.anim = 'meeting';
          act.away = false;
          act.meetingTitle = listed.title;
          act.source = listed.source;
        }
      }
      var over = live.agents && live.agents[person.id];
      if (over && typeof over === 'object' && !Array.isArray(over)) {
        var anim = typeof over.anim === 'string' ? over.anim : '';
        if (ANIMS[anim]) {
          act.anim = anim;
          act.away = false;
          act.source = 'live.agents';
        }
        if (typeof over.note === 'string' && over.note.trim()) {
          act.lockedNote = over.note.trim();
          act.source = 'live.agents';
        }
      }
      applyCopy(act, person, primary);
      if (act.lockedNote) act.headline = act.lockedNote;
      if (act.anim === 'meeting' && !act.meetingTitle) act.meetingTitle = primary && primary.title || '會議';
      act.place = placeFor(person, act.anim);
      activities[person.id] = act;
      list.push(act);
    });

    var attendees = list.filter(function (a) { return a.anim === 'meeting'; }).map(function (a) { return a.staffId; });
    var meetingTitle = '';
    list.forEach(function (a) {
      if (a.anim === 'meeting' && a.meetingTitle && !meetingTitle) meetingTitle = a.meetingTitle;
    });
    return {
      byId: activities,
      list: list,
      meetingTitle: meetingTitle,
      attendees: attendees,
      nowMs: nowMs
    };
  }

  function sourceLabel(source) {
    if (source === 'schedule') return '依據 live.json 今日行程';
    if (source === 'live.agents') return '依據 live.json agents';
    if (source === 'live.campus') return '依據 live.json campus.meetings';
    if (source === 'live.town') return '依據 live.json town.meetings';
    return '依據 live.json 狀態';
  }

  function hudLines(act) {
    if (!act) {
      return { kicker: '小鎮', who: '', anim: '', doing: '', detail: '', status: '', source: '' };
    }
    var kicker = '室內';
    if (act.place === 'hall' || act.anim === 'meeting') kicker = '會議廳';
    else if (act.place === 'pin') kicker = '街口小檔';
    else if (act.center) kicker = '共用公所';
    else if (act.away) kicker = '門口';
    return {
      kicker: kicker,
      who: act.name || '',
      anim: act.animLabel || '',
      doing: act.headline || '',
      detail: act.detail || '',
      status: act.status ? ('狀態：' + act.status) : '',
      source: sourceLabel(act.source)
    };
  }

  function hallBoard(live, inferred) {
    var rows = [];
    (live && live.calendar || []).forEach(function (c) {
      if (!c) return;
      rows.push((c.when || '') + '  ' + (c.title || '') + (c.where ? '（' + c.where + '）' : ''));
    });
    var attendees = (inferred && inferred.attendees) || [];
    if (!attendees.length) {
      return {
        staffId: 'hall',
        name: '會議廳',
        anim: 'idle',
        animLabel: '空堂',
        headline: '目前沒有進行中的會議',
        detail: rows.length ? rows.slice(0, 3).join('　') : '日曆未有行程',
        status: '',
        source: 'schedule',
        place: 'hall',
        center: false,
        away: false,
        meetingTitle: ''
      };
    }
    var names = attendees.map(function (id) {
      var a = inferred.byId[id];
      return a ? a.name : id;
    });
    return {
      staffId: 'hall',
      name: '會議廳',
      anim: 'meeting',
      animLabel: '開會',
      headline: '進行中：' + (inferred.meetingTitle || '會議'),
      detail: '在席：' + names.join('、'),
      status: names.length + ' 人',
      source: 'schedule',
      place: 'hall',
      center: false,
      away: false,
      meetingTitle: inferred.meetingTitle || ''
    };
  }

  function focusPoint(placeId) {
    var house = houseByStaff(placeId);
    if (house) return { x: house.x, z: house.z };
    var pub = publicById(placeId);
    if (pub) return { x: pub.x, z: pub.z };
    var pts = [];
    HOUSES.forEach(function (h) { if (h.zoneId === placeId) pts.push(h); });
    PUBLIC.forEach(function (p) { if (p.zoneId === placeId) pts.push(p); });
    if (!pts.length) return { x: 0, z: 0.2 };
    var sx = 0;
    var sz = 0;
    pts.forEach(function (p) { sx += p.x; sz += p.z; });
    return { x: sx / pts.length, z: sz / pts.length };
  }

  return {
    ANIMS: ANIMS,
    HOUSES: HOUSES,
    PUBLIC: PUBLIC,
    SIGNS: SIGNS,
    rosterFromZones: rosterFromZones,
    houseByStaff: houseByStaff,
    publicById: publicById,
    pinsFor: pinsFor,
    porchOf: porchOf,
    infer: infer,
    hudLines: hudLines,
    hallBoard: hallBoard,
    sourceLabel: sourceLabel,
    focusPoint: focusPoint,
    clockRanges: clockRanges,
    tokens: tokens
  };
});
