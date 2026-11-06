/* Cartoon-town activities. No THREE dependency.
   Indoor poses come from live.json: status, focus, calendar, and optional
   live.agents / live.campus.meetings / live.town.meetings.
   idle | walk | sit | meeting are the only poses. A private appointment
   that is happening now is idle + away (out, not pretending to type).
   Outdoor posts prefer a house porch or a workplace yard. frameAt() then
   plays a short chat, a porch patrol, and an occasional lane visit.
   Those walks do not change infer(). */
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

  /* Civic facilities are centers, not agent houses. 投資平台 and 財富狀況 match that footprint. */
  var PUBLIC = [
    { id: 'invest-platform', staffId: 'invest-platform', zoneId: 'invest', kind: 'center', x: -10.75, z: -7.55, w: 3.35, d: 2.25, h: 1.86, roof: 0x3E92D0, wall: 0xF4F8FC, label: '投資平台' },
    { id: 'shared-db', staffId: 'shared-db', zoneId: 'sys', kind: 'center', x: -6.3, z: -7.55, w: 2.9, d: 2.15, h: 1.72, roof: 0x3E86C4, wall: 0xF4F8FC, label: '共用資料庫' },
    { id: 'analytics', staffId: 'analytics', zoneId: 'invest', kind: 'center', x: -1.55, z: -7.65, w: 3.05, d: 2.15, h: 1.76, roof: 0x2EAA96, wall: 0xF3FBFA, label: '數據分析中心' },
    { id: 'lab', staffId: 'lab', zoneId: 'content', kind: 'center', x: 3.05, z: -7.5, w: 2.75, d: 2.1, h: 1.7, roof: 0xE07A3A, wall: 0xFFF6F0, label: '研創中心' },
    { id: 'hall', staffId: null, zoneId: 'cmd', kind: 'hall', x: 8.15, z: -6.55, w: 4.5, d: 2.7, h: 2.05, roof: 0xD45348, wall: 0xFFF6EE, label: '會議廳' },
    { id: 'wealth', staffId: 'wealth', zoneId: 'invest', kind: 'center', x: 3.75, z: -4.5, w: 3.0, d: 1.9, h: 2.02, roof: 0xE2A31A, wall: 0xFFF8EE, label: '財富狀況' }
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

  var INVEST_BOARD_TITLE = '個人投資台 · 投資平台';
  var INVEST_BOARD_LABEL = '進入投資平台';
  var INVEST_BOARD_URL = 'https://martinleesk.github.io/grokbot-3d-hq/invest/';
  var INVEST_BOARD_HOMES = { advisor: 1, analytics: 1, 'invest-platform': 1 };
  var WEALTH_BOARD_TITLE = '個人財富狀況';
  var WEALTH_BOARD_LABEL = '進入財富看板';
  var WEALTH_BOARD_URL = 'https://martinleesk.github.io/grokbot-3d-hq/wealth/';
  var WEALTH_BOARD_HOMES = { wealth: 1 };

  /* Specialists work at a related house or civic center. Lanes are visits, not parking. */
  var WORK_HOME = {
    byd: 'analytics', '2800': 'analytics', qqq: 'analytics', voo: 'analytics',
    orcl: 'analytics', sdiv: 'analytics', rsss: 'analytics', spacex: 'analytics', dcf: 'analytics',
    passive: 'advisor', retire: 'advisor', home: 'advisor',
    health: 'life', mind: 'life', learn: 'life',
    meet: 'sec',
    social: 'news', sum: 'news', tr: 'news',
    research: 'lab', scout: 'lab'
  };

  var YARD_ORDER = {
    analytics: ['byd', '2800', 'qqq', 'voo', 'orcl', 'sdiv', 'rsss', 'spacex', 'dcf'],
    advisor: ['passive', 'retire', 'home'],
    life: ['health', 'mind', 'learn'],
    sec: ['meet'],
    news: ['social', 'sum', 'tr'],
    lab: ['research', 'scout']
  };

  var YARD_SLOTS = {
    analytics: [
      { x: -8.2, z: -3.6 }, { x: -6.35, z: -3.6 }, { x: -4.5, z: -3.6 }, { x: -2.65, z: -3.6 }, { x: -0.8, z: -3.6 },
      { x: -7.3, z: -2.55 }, { x: -5.45, z: -2.55 }, { x: -3.6, z: -2.55 }, { x: -1.75, z: -2.55 }
    ],
    advisor: [
      { x: -7.5, z: 6.05 }, { x: -6.15, z: 6.05 }, { x: -4.8, z: 6.05 }
    ],
    life: [
      { x: 4.9, z: -0.9 }, { x: 4.9, z: 0.3 }, { x: 6.05, z: -0.3 }
    ],
    sec: [
      { x: -4.35, z: 0.55 }
    ],
    news: [
      { x: 0.55, z: 6.0 }, { x: 2.05, z: 6.0 }, { x: 3.55, z: 6.0 }
    ],
    lab: [
      { x: 3.15, z: -3.35 }, { x: 4.7, z: -3.35 }
    ]
  };

  var HOME_LABEL = {
    boss: '總管屋', sec: '秘書屋', finance: '財務屋', life: '生活屋',
    advisor: '顧問屋', travel: '旅遊屋', news: '新聞屋', auditor: '稽核屋'
  };

  var COURT_MARKS = [
    { id: 'analytics-yard', text: '分析台', x: -9.35, z: -3.6 },
    { id: 'advisor-yard', text: '投資後院', x: -8.7, z: 6.05 },
    { id: 'life-yard', text: '生活屋前', x: 6.55, z: -1.15 },
    { id: 'news-yard', text: '新聞後院', x: -0.75, z: 6.0 },
    { id: 'lab-yard', text: '研創前地', x: 2.15, z: -3.35 }
  ];

  var CHAT_HOMES = ['analytics', 'advisor', 'life', 'news', 'lab'];
  var PATROL_HOMES = ['advisor', 'life', 'news', 'analytics'];
  var ERRANDS = ['byd', 'health', 'social', 'passive', 'research', 'meet'];
  var LANES = [
    { id: 'qqq', sign: 'invest-lane' },
    { id: 'learn', sign: 'life-lane' },
    { id: 'sum', sign: 'content-lane' }
  ];

  var BEAT = {
    cycle: 40,
    chatGoEnd: 4,
    chatTalkEnd: 10,
    chatEnd: 14,
    patrolGoEnd: 20,
    patrolHoldEnd: 22,
    patrolEnd: 28,
    errandGoEnd: 33,
    errandHoldEnd: 35,
    visitEnd: 40,
    laneGoEnd: 34,
    laneHoldEnd: 36
  };

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
    var out = [];
    var extra = 0;
    (roster || []).forEach(function (p) {
      if (!p || !p.id) return;
      if (p.center || houseByStaff(p.id) || WORK_HOME[p.id]) return;
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
      out.push({
        staffId: p.id,
        zoneId: p.zoneId,
        homeId: 'pin',
        x: x,
        z: z,
        reason: '未有崗位，暫放街口'
      });
    });
    return out;
  }

  function homeTitle(id) {
    if (!id || id === 'pin') return '街口暫放';
    if (id === 'hall') return '會議廳';
    var pub = publicById(id);
    if (pub && pub.label) return pub.label;
    return HOME_LABEL[id] || id;
  }

  function yardYaw(homeId) {
    if (homeId === 'life') return -Math.PI / 2;
    return Math.PI;
  }

  function postsFor(roster) {
    var out = [];
    (roster || []).forEach(function (p) {
      if (!p || !p.id) return;
      if (p.center) {
        var pub = publicById(p.id);
        if (pub) {
          out.push({
            staffId: p.id,
            homeId: p.id,
            kind: 'center',
            x: pub.x,
            z: pub.z + pub.d / 2 + 0.62,
            yaw: Math.PI,
            reason: '公所當值'
          });
          return;
        }
      }
      var house = houseByStaff(p.id);
      if (house) {
        var porch = porchOf(house);
        out.push({
          staffId: p.id,
          homeId: p.id,
          kind: 'porch',
          x: porch.x + 0.42,
          z: porch.z,
          yaw: porch.yaw,
          reason: '屋主崗位'
        });
        return;
      }
      var home = WORK_HOME[p.id];
      var slots = home && YARD_SLOTS[home];
      if (slots && slots.length) {
        var order = YARD_ORDER[home] || [];
        var idx = order.indexOf(p.id);
        if (idx < 0) idx = 0;
        var slot = slots[Math.min(idx, slots.length - 1)];
        out.push({
          staffId: p.id,
          homeId: home,
          kind: 'yard',
          x: slot.x,
          z: slot.z,
          yaw: yardYaw(home),
          reason: publicById(home) ? '公所崗位' : '屋前崗位'
        });
        return;
      }
    });
    pinsFor(roster).forEach(function (pin) {
      out.push({
        staffId: pin.staffId,
        homeId: 'pin',
        kind: 'pin',
        x: pin.x + 0.28,
        z: pin.z + 0.05,
        yaw: 0,
        reason: pin.reason
      });
    });
    return out;
  }

  function clipText(s, maxUnits) {
    var str = String(s || '').replace(/\s+/g, ' ').trim();
    var out = '';
    var w = 0;
    var max = maxUnits || 8;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      var cw = ch === ' ' ? 0.35 : (ch.charCodeAt(0) > 255 ? 1 : 0.55);
      if (out && w + cw > max) break;
      out += ch;
      w += cw;
    }
    return out;
  }

  function outdoorLabel(act) {
    if (!act) return '';
    if (act.anim === 'meeting') return '開會';
    if (act.away) return '外出';
    if (act.anim === 'walk') return '短走';
    if (act.anim === 'idle') return '待命';
    if (act.focusTitle) return clipText(act.focusTitle, 8);
    if (act.status) return clipText(act.status, 6);
    return '辦公';
  }

  function dutyText(act) {
    if (!act) return '';
    if (act.anim === 'meeting' || act.away || act.anim === 'walk' || act.anim === 'idle') {
      return act.headline || outdoorLabel(act);
    }
    if (act.focusTitle) return act.focusTitle;
    if (act.status) return act.status;
    return act.animLabel || '辦公';
  }

  function workPhrase(act) {
    if (!act) return '辦公';
    if (act.anim === 'meeting') return '開會';
    if (act.away) return '外出';
    if (act.anim === 'walk') return '短走';
    if (act.anim === 'idle') return '待命';
    if (act.focusTitle) return act.focusTitle;
    if (act.status) return act.status;
    return act.animLabel || '辦公';
  }

  function speak(act, kind) {
    var work = workPhrase(act);
    var line = work;
    if (kind === 'open') line = '而家' + work;
    else if (kind === 'reply') line = '收到，我' + work;
    else if (kind === 'patrol') line = '巡過：' + work;
    else if (kind === 'errand') line = '交低：' + work;
    else if (kind === 'lane') line = '過嚟對：' + work;
    return clipText(line, 16);
  }

  function dutyBoard(inferred) {
    inferred = inferred || { list: [] };
    var groups = {};
    var order = [];
    PUBLIC.forEach(function (p) {
      if (p.kind === 'hall') order.push(p.id);
    });
    PUBLIC.forEach(function (p) {
      if (p.kind === 'center' && p.staffId) order.push(p.staffId);
    });
    HOUSES.forEach(function (h) { order.push(h.staffId); });
    order.push('pin');
    function group(key) {
      if (!groups[key]) {
        groups[key] = { id: key, title: homeTitle(key), people: [] };
      }
      return groups[key];
    }
    order.forEach(group);
    var roster = (inferred.list || []).map(function (a) {
      return { id: a.staffId, center: a.center, zoneId: a.zoneId, name: a.name, status: a.status };
    });
    var postBy = {};
    postsFor(roster).forEach(function (p) { postBy[p.staffId] = p; });
    (inferred.list || []).forEach(function (act) {
      var key = act.anim === 'meeting'
        ? 'hall'
        : ((postBy[act.staffId] && postBy[act.staffId].homeId) || act.homeId || 'pin');
      group(key).people.push({
        staffId: act.staffId,
        name: act.name || act.staffId,
        label: outdoorLabel(act),
        text: dutyText(act),
        anim: act.anim,
        away: !!act.away
      });
    });
    return order.map(function (key) { return groups[key]; }).filter(function (g) { return g && g.people.length; });
  }

  function buildingBoxes() {
    var boxes = [];
    HOUSES.concat(PUBLIC).forEach(function (b) {
      boxes.push({
        id: b.staffId || b.id,
        minX: b.x - b.w / 2,
        maxX: b.x + b.w / 2,
        minZ: b.z - b.d / 2,
        maxZ: b.z + b.d / 2
      });
    });
    boxes.push({ id: 'pond', minX: 5.45, maxX: 7.95, minZ: -3.6, maxZ: -1.1 });
    return boxes;
  }

  function segmentHitsBox(a, b, box, pad) {
    var minX = box.minX - pad;
    var maxX = box.maxX + pad;
    var minZ = box.minZ - pad;
    var maxZ = box.maxZ + pad;
    var dx = b.x - a.x;
    var dz = b.z - a.z;
    var t0 = 0;
    var t1 = 1;
    function clip(p, q) {
      if (Math.abs(p) < 1e-9) return q >= 0;
      var r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    }
    if (!clip(-dx, a.x - minX)) return false;
    if (!clip(dx, maxX - a.x)) return false;
    if (!clip(-dz, a.z - minZ)) return false;
    if (!clip(dz, maxZ - a.z)) return false;
    return t0 <= t1;
  }

  function pathHits(pts, boxes, pad) {
    for (var i = 1; i < pts.length; i++) {
      for (var j = 0; j < boxes.length; j++) {
        if (segmentHitsBox(pts[i - 1], pts[i], boxes[j], pad)) return true;
      }
    }
    return false;
  }

  function dedupePath(pts) {
    var out = [];
    (pts || []).forEach(function (p) {
      if (!p) return;
      var last = out[out.length - 1];
      if (last && Math.abs(last.x - p.x) < 0.04 && Math.abs(last.z - p.z) < 0.04) return;
      out.push({ x: p.x, z: p.z });
    });
    return out;
  }

  function route(a, b, boxes) {
    var pad = 0.42;
    if (!pathHits([a, b], boxes, pad)) return [a, b];
    function clearX(x, z0, z1) {
      function free(xx) {
        return !pathHits([{ x: xx, z: z0 }, { x: xx, z: z1 }], boxes, pad);
      }
      if (free(x)) return x;
      for (var d = 0.45; d <= 5; d += 0.45) {
        if (free(x - d)) return x - d;
        if (free(x + d)) return x + d;
      }
      return x;
    }
    var streetZ = 1.55;
    var x1 = clearX(a.x, a.z, streetZ);
    var x2 = clearX(b.x, b.z, streetZ);
    var via = dedupePath([
      a,
      { x: x1, z: a.z },
      { x: x1, z: streetZ },
      { x: x2, z: streetZ },
      { x: x2, z: b.z },
      b
    ]);
    if (!pathHits(via, boxes, pad)) return via;
    var offsets = [-3.4, 3.4, -5, 5];
    for (var i = 0; i < offsets.length; i++) {
      var mx = (a.x + b.x) / 2 + offsets[i];
      var mz = (a.z + b.z) / 2;
      var side = dedupePath([a, { x: a.x, z: mz }, { x: mx, z: mz }, { x: b.x, z: mz }, b]);
      if (!pathHits(side, boxes, pad)) return side;
    }
    return via;
  }

  function pathDist(a, b) {
    var dx = a.x - b.x;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function pointAlong(pts, u) {
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    if (!pts || !pts.length) return { x: 0, z: 0, yaw: 0 };
    if (pts.length === 1) return { x: pts[0].x, z: pts[0].z, yaw: 0 };
    var lengths = [];
    var total = 0;
    for (var i = 1; i < pts.length; i++) {
      var len = pathDist(pts[i - 1], pts[i]);
      lengths.push(len);
      total += len;
    }
    if (total < 1e-4) return { x: pts[0].x, z: pts[0].z, yaw: 0 };
    var target = total * u;
    var acc = 0;
    for (var s = 0; s < lengths.length; s++) {
      var seg = lengths[s];
      if (acc + seg >= target - 1e-6 || s === lengths.length - 1) {
        var k = seg < 1e-6 ? 0 : (target - acc) / seg;
        if (k < 0) k = 0;
        if (k > 1) k = 1;
        var p0 = pts[s];
        var p1 = pts[s + 1];
        return {
          x: p0.x + (p1.x - p0.x) * k,
          z: p0.z + (p1.z - p0.z) * k,
          yaw: Math.atan2(p1.x - p0.x, p1.z - p0.z)
        };
      }
      acc += seg;
    }
    var last = pts[pts.length - 1];
    return { x: last.x, z: last.z, yaw: 0 };
  }

  function hashPhase(id) {
    var n = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    return (n % 628) / 100;
  }

  function isFree(act) {
    return !!(act && act.anim !== 'meeting' && act.anim !== 'walk' && !act.away);
  }

  function doorSpot(homeId) {
    var house = houseByStaff(homeId);
    if (house) {
      var porch = porchOf(house);
      return { x: porch.x - 0.9, z: porch.z };
    }
    var pub = publicById(homeId);
    if (pub) return { x: pub.x + pub.w / 2 + 0.75, z: pub.z + pub.d / 2 + 0.28 };
    return { x: 0, z: 1.55 };
  }

  function signSpot(signId) {
    for (var i = 0; i < SIGNS.length; i++) {
      if (SIGNS[i].id === signId) return { x: SIGNS[i].x, z: SIGNS[i].z + 0.9 };
    }
    return { x: 9.7, z: 2.05 };
  }

  function hallSeats(n) {
    var hall = publicById('hall');
    var gap = 0.5;
    var width = Math.max(n - 1, 0) * gap;
    var x0 = hall.x - width / 2;
    var z = hall.z + hall.d / 2 + 0.78;
    var seats = [];
    for (var i = 0; i < n; i++) seats.push({ x: x0 + i * gap, z: z, yaw: Math.PI });
    return seats;
  }

  function chatPair(turn, byId) {
    var homes = CHAT_HOMES.filter(function (home) {
      var members = (YARD_ORDER[home] || []).filter(function (id) { return isFree(byId[id]); });
      return members.length >= 2;
    });
    if (!homes.length) return null;
    var home = homes[turn % homes.length];
    var members = (YARD_ORDER[home] || []).filter(function (id) { return isFree(byId[id]); });
    var idx = Math.floor(turn / homes.length) % (members.length - 1);
    return { a: members[idx], b: members[idx + 1], home: home };
  }

  function patrolPlan(turn, byId, posts) {
    var homes = PATROL_HOMES.filter(function (home) {
      if (isFree(byId[home]) && posts[home]) return true;
      var yards = YARD_ORDER[home] || [];
      for (var i = 0; i < yards.length; i++) {
        if (isFree(byId[yards[i]]) && posts[yards[i]]) return true;
      }
      return false;
    });
    if (!homes.length) return null;
    var home = homes[turn % homes.length];
    var walker = (isFree(byId[home]) && posts[home]) ? home : '';
    if (!walker) {
      var yards = YARD_ORDER[home] || [];
      for (var i = 0; i < yards.length; i++) {
        if (isFree(byId[yards[i]]) && posts[yards[i]]) { walker = yards[i]; break; }
      }
    }
    var slots = YARD_SLOTS[home] || [];
    if (!walker || !slots.length || !posts[walker]) return null;
    var far = slots[slots.length - 1];
    return {
      id: walker,
      to: { x: far.x + 0.15, z: far.z + 0.72 }
    };
  }

  function visitPlan(turn, byId, posts) {
    if (turn % 2 === 0) {
      for (var i = 0; i < ERRANDS.length; i++) {
        var id = ERRANDS[(Math.floor(turn / 2) + i) % ERRANDS.length];
        if (isFree(byId[id]) && posts[id] && WORK_HOME[id]) {
          return { id: id, to: doorSpot(WORK_HOME[id]), kind: 'errand' };
        }
      }
      return null;
    }
    var start = Math.floor(turn / 2) % LANES.length;
    for (var j = 0; j < LANES.length; j++) {
      var lane = LANES[(start + j) % LANES.length];
      if (isFree(byId[lane.id]) && posts[lane.id]) {
        return { id: lane.id, to: signSpot(lane.sign), kind: 'lane' };
      }
    }
    return null;
  }

  function ride(from, to, u, boxes) {
    return pointAlong(route(from, to, boxes), u);
  }

  function frameAt(roster, inferred, tSec) {
    var byId = (inferred && inferred.byId) || {};
    var t = isFinite(+tSec) ? +tSec : 0;
    if (t < 0) t = 0;
    var posts = {};
    postsFor(roster).forEach(function (p) { posts[p.staffId] = p; });
    var boxes = buildingBoxes();
    var people = {};
    var meeting = [];
    (roster || []).forEach(function (person) {
      if (!person || !person.id) return;
      var act = byId[person.id];
      var post = posts[person.id];
      if (!act || !post) return;
      if (act.anim === 'meeting') {
        meeting.push(person.id);
        return;
      }
      var spot = { x: post.x, z: post.z, yaw: post.yaw, pose: act.away || act.anim === 'idle' ? 'idle' : 'sit', bubble: '' };
      if (act.anim === 'walk') {
        var house = houseByStaff(person.id);
        var a;
        var b;
        if (house) {
          var porch = porchOf(house);
          a = { x: porch.x, z: porch.z };
          b = porch.walkTo;
        } else {
          a = { x: post.x, z: post.z };
          b = { x: post.x + 0.15, z: post.z > 1.55 ? post.z - 1.25 : post.z + 1.25 };
        }
        var u = (Math.sin(t * 0.7 + hashPhase(person.id)) + 1) / 2;
        var dir = Math.cos(t * 0.7 + hashPhase(person.id)) >= 0 ? 1 : -1;
        spot.x = a.x + (b.x - a.x) * u;
        spot.z = a.z + (b.z - a.z) * u;
        spot.yaw = Math.atan2((b.x - a.x) * dir, (b.z - a.z) * dir);
        spot.pose = 'walk';
      }
      people[person.id] = { spot: spot, act: act, post: post };
    });
    var seats = hallSeats(meeting.length);
    meeting.forEach(function (id, i) {
      var seat = seats[i];
      people[id] = {
        spot: { x: seat.x, z: seat.z, yaw: seat.yaw, pose: 'meeting', bubble: '' },
        act: byId[id],
        post: posts[id]
      };
    });

    var turn = Math.floor(t / BEAT.cycle);
    var local = t - turn * BEAT.cycle;
    var pair = chatPair(turn, byId);
    if (pair && posts[pair.a] && posts[pair.b] && local < BEAT.chatEnd) {
      var pa = posts[pair.a];
      var pb = posts[pair.b];
      var mid = { x: (pa.x + pb.x) / 2, z: (pa.z + pb.z) / 2 };
      var destA = { x: mid.x - 0.4, z: mid.z };
      var destB = { x: mid.x + 0.4, z: mid.z };
      var sa = people[pair.a].spot;
      var sb = people[pair.b].spot;
      if (local < BEAT.chatGoEnd) {
        var ga = ride(pa, destA, local / BEAT.chatGoEnd, boxes);
        var gb = ride(pb, destB, local / BEAT.chatGoEnd, boxes);
        sa.x = ga.x; sa.z = ga.z; sa.yaw = ga.yaw; sa.pose = 'walk';
        sb.x = gb.x; sb.z = gb.z; sb.yaw = gb.yaw; sb.pose = 'walk';
      } else if (local < BEAT.chatTalkEnd) {
        sa.x = destA.x; sa.z = destA.z; sa.yaw = Math.atan2(destB.x - destA.x, destB.z - destA.z); sa.pose = 'idle';
        sb.x = destB.x; sb.z = destB.z; sb.yaw = Math.atan2(destA.x - destB.x, destA.z - destB.z); sb.pose = 'idle';
        sa.bubble = speak(byId[pair.a], 'open');
        sb.bubble = speak(byId[pair.b], 'reply');
      } else {
        var backU = (local - BEAT.chatTalkEnd) / (BEAT.chatEnd - BEAT.chatTalkEnd);
        var ra = ride(destA, pa, backU, boxes);
        var rb = ride(destB, pb, backU, boxes);
        sa.x = ra.x; sa.z = ra.z; sa.yaw = ra.yaw; sa.pose = 'walk';
        sb.x = rb.x; sb.z = rb.z; sb.yaw = rb.yaw; sb.pose = 'walk';
      }
    }

    var patrol = patrolPlan(turn, byId, posts);
    if (patrol && people[patrol.id] && local >= BEAT.chatEnd && local < BEAT.patrolEnd) {
      var walker = people[patrol.id];
      var from = { x: posts[patrol.id].x, z: posts[patrol.id].z };
      var goSpan = BEAT.patrolGoEnd - BEAT.chatEnd;
      var backSpan = BEAT.patrolEnd - BEAT.patrolHoldEnd;
      if (local < BEAT.patrolGoEnd) {
        var gp = ride(from, patrol.to, (local - BEAT.chatEnd) / goSpan, boxes);
        walker.spot.x = gp.x; walker.spot.z = gp.z; walker.spot.yaw = gp.yaw; walker.spot.pose = 'walk';
      } else if (local < BEAT.patrolHoldEnd) {
        var held = ride(from, patrol.to, 1, boxes);
        walker.spot.x = held.x; walker.spot.z = held.z;
        walker.spot.yaw = Math.atan2(from.x - patrol.to.x, from.z - patrol.to.z);
        walker.spot.pose = 'idle';
        walker.spot.bubble = speak(byId[patrol.id], 'patrol');
      } else {
        var bp = ride(patrol.to, from, (local - BEAT.patrolHoldEnd) / backSpan, boxes);
        walker.spot.x = bp.x; walker.spot.z = bp.z; walker.spot.yaw = bp.yaw; walker.spot.pose = 'walk';
      }
    }

    var visit = visitPlan(turn, byId, posts);
    if (visit && people[visit.id] && local >= BEAT.patrolEnd && local < BEAT.visitEnd) {
      var guest = people[visit.id];
      var origin = { x: posts[visit.id].x, z: posts[visit.id].z };
      var goEnd = visit.kind === 'lane' ? BEAT.laneGoEnd : BEAT.errandGoEnd;
      var holdEnd = visit.kind === 'lane' ? BEAT.laneHoldEnd : BEAT.errandHoldEnd;
      var goLen = goEnd - BEAT.patrolEnd;
      var backLen = BEAT.visitEnd - holdEnd;
      if (local < goEnd) {
        var gv = ride(origin, visit.to, (local - BEAT.patrolEnd) / goLen, boxes);
        guest.spot.x = gv.x; guest.spot.z = gv.z; guest.spot.yaw = gv.yaw; guest.spot.pose = 'walk';
      } else if (local < holdEnd) {
        var hv = ride(origin, visit.to, 1, boxes);
        guest.spot.x = hv.x; guest.spot.z = hv.z;
        guest.spot.yaw = Math.atan2(origin.x - visit.to.x, origin.z - visit.to.z);
        guest.spot.pose = 'idle';
        guest.spot.bubble = speak(byId[visit.id], visit.kind === 'lane' ? 'lane' : 'errand');
      } else {
        var bv = ride(visit.to, origin, (local - holdEnd) / backLen, boxes);
        guest.spot.x = bv.x; guest.spot.z = bv.z; guest.spot.yaw = bv.yaw; guest.spot.pose = 'walk';
      }
    }

    var out = {};
    Object.keys(people).forEach(function (id) {
      var row = people[id];
      var pose = row.spot.pose;
      out[id] = {
        staffId: id,
        x: row.spot.x,
        z: row.spot.z,
        y: (pose === 'sit' || pose === 'meeting') ? 0.16 : 0,
        yaw: row.spot.yaw,
        pose: pose,
        bubble: row.spot.bubble || '',
        label: outdoorLabel(row.act),
        homeId: row.post ? row.post.homeId : '',
        kind: row.post ? row.post.kind : '',
        scale: 0.64
      };
    });
    return { people: out, t: t, turn: turn, local: local };
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

  function homeFor(person, anim) {
    if (anim === 'meeting') return 'hall';
    if (person.center) return person.id;
    if (houseByStaff(person.id)) return person.id;
    if (WORK_HOME[person.id]) return WORK_HOME[person.id];
    return 'pin';
  }

  function placeFor(person, anim) {
    if (anim === 'meeting') return 'hall';
    if (person.center) return person.id;
    if (houseByStaff(person.id)) return 'house';
    if (WORK_HOME[person.id]) return 'yard';
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
      act.focusTitle = primary && primary.title ? String(primary.title) : '';
      applyCopy(act, person, primary);
      if (act.lockedNote) act.headline = act.lockedNote;
      if (act.anim === 'meeting' && !act.meetingTitle) act.meetingTitle = primary && primary.title || '會議';
      act.place = placeFor(person, act.anim);
      act.homeId = homeFor(person, act.anim);
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

  function isCanvasBoardUrl(url) {
    return /cursor\.com\/canvas/i.test(String(url || ''));
  }

  function acceptBoardUrl(url) {
    var s = String(url || '').trim();
    if (!s || isCanvasBoardUrl(s) || /[\s<>"']/.test(s)) return '';
    if (/^https:\/\/\S+$/i.test(s)) return s;
    if (/^(\.\/)?invest\/(index\.html)?$/.test(s)) return s;
    if (/^\/grokbot-3d-hq\/invest\/(index\.html)?$/.test(s)) return s;
    return '';
  }

  function acceptWealthUrl(url) {
    var s = String(url || '').trim();
    if (!s || isCanvasBoardUrl(s) || /[\s<>"']/.test(s)) return '';
    if (/^https:\/\/\S+$/i.test(s)) return s;
    if (/^(\.\/)?wealth\/(index\.html)?$/.test(s)) return s;
    if (/^\/grokbot-3d-hq\/wealth\/(index\.html)?$/.test(s)) return s;
    return '';
  }

  function investBoard(live) {
    var invest = live && live.invest;
    if (!invest || typeof invest !== 'object' || Array.isArray(invest)) return null;
    var raw = '';
    if (typeof invest.dashboardUrl === 'string') raw = invest.dashboardUrl.trim();
    else if (invest.dashboard && typeof invest.dashboard === 'object' && !Array.isArray(invest.dashboard) &&
      typeof invest.dashboard.url === 'string') {
      raw = invest.dashboard.url.trim();
    }
    var url = acceptBoardUrl(raw);
    if (!url && isCanvasBoardUrl(raw)) url = INVEST_BOARD_URL;
    if (!url) return null;
    var title = '';
    if (typeof invest.dashboardTitle === 'string') title = invest.dashboardTitle.trim();
    else if (invest.dashboard && typeof invest.dashboard === 'object' && !Array.isArray(invest.dashboard) &&
      typeof invest.dashboard.title === 'string') {
      title = invest.dashboard.title.trim();
    }
    if (!title) title = INVEST_BOARD_TITLE;
    return { url: url, title: title, label: INVEST_BOARD_LABEL };
  }

  function showsInvestBoard(staffId) {
    return !!INVEST_BOARD_HOMES[staffId];
  }

  function wealthBoard(live) {
    var block = live && live.wealth;
    var raw = '';
    var title = '';
    if (block && typeof block === 'object' && !Array.isArray(block)) {
      if (typeof block.dashboardUrl === 'string') raw = block.dashboardUrl.trim();
      else if (block.dashboard && typeof block.dashboard === 'object' && !Array.isArray(block.dashboard) &&
        typeof block.dashboard.url === 'string') {
        raw = block.dashboard.url.trim();
      }
      if (typeof block.dashboardTitle === 'string') title = block.dashboardTitle.trim();
      else if (block.dashboard && typeof block.dashboard === 'object' && !Array.isArray(block.dashboard) &&
        typeof block.dashboard.title === 'string') {
        title = block.dashboard.title.trim();
      }
    }
    var url = acceptWealthUrl(raw);
    if (!url) url = WEALTH_BOARD_URL;
    if (!title) title = WEALTH_BOARD_TITLE;
    return { url: url, title: title, label: WEALTH_BOARD_LABEL };
  }

  function showsWealthBoard(staffId) {
    return !!WEALTH_BOARD_HOMES[staffId];
  }

  function investPaperLabel(paper) {
    if (!paper || typeof paper !== 'object' || Array.isArray(paper)) return '';
    var label = typeof paper.label === 'string' ? paper.label.trim() : '';
    return label || 'SIMULATED';
  }

  function fillInvestBoardLink(el, board) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!board || !board.url) {
      el.hidden = true;
      el.removeAttribute('href');
      return;
    }
    el.hidden = false;
    el.setAttribute('href', board.url);
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
    var title = board.title || INVEST_BOARD_TITLE;
    el.title = title;
    el.setAttribute('aria-label', title);
    var name = el.ownerDocument.createElement('span');
    name.textContent = title;
    var go = el.ownerDocument.createElement('b');
    go.textContent = board.label || INVEST_BOARD_LABEL;
    el.appendChild(name);
    el.appendChild(go);
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
    else if (act.place === 'yard') kicker = '崗位 · ' + homeTitle(act.homeId);
    else if (act.place === 'pin') kicker = '街口暫放';
    else if (act.center) kicker = '社區設施';
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
    COURT_MARKS: COURT_MARKS,
    WORK_HOME: WORK_HOME,
    BEAT: BEAT,
    rosterFromZones: rosterFromZones,
    houseByStaff: houseByStaff,
    publicById: publicById,
    pinsFor: pinsFor,
    postsFor: postsFor,
    porchOf: porchOf,
    infer: infer,
    hudLines: hudLines,
    hallBoard: hallBoard,
    sourceLabel: sourceLabel,
    focusPoint: focusPoint,
    clockRanges: clockRanges,
    tokens: tokens,
    outdoorLabel: outdoorLabel,
    dutyText: dutyText,
    dutyBoard: dutyBoard,
    frameAt: frameAt,
    buildingBoxes: buildingBoxes,
    homeTitle: homeTitle,
    clipText: clipText,
    speak: speak,
    investBoard: investBoard,
    showsInvestBoard: showsInvestBoard,
    wealthBoard: wealthBoard,
    showsWealthBoard: showsWealthBoard,
    investPaperLabel: investPaperLabel,
    fillInvestBoardLink: fillInvestBoardLink
  };
});
