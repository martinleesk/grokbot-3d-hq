/* L4 life-floor motion. No THREE dependency.
   Infers idle | walk | sit | meeting from live.json.
   Does not read invest.halt — that flag is only for the invest floor. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HQLifeSim = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var ANIMS = { idle: 1, walk: 1, sit: 1, meeting: 1 };
  var MEET_PAST_MS = 2 * 3600 * 1000;
  var MEET_AHEAD_MS = 36 * 3600 * 1000;

  function hktParts(ms) {
    var fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    var map = {};
    fmt.formatToParts(new Date(ms)).forEach(function (p) { map[p.type] = p.value; });
    return {
      year: +map.year, month: +map.month, day: +map.day,
      hour: +map.hour, minute: +map.minute
    };
  }

  function updatedYear(live, nowMs) {
    var s = live && live.updated != null ? String(live.updated) : '';
    var m = s.match(/(\d{4})/);
    if (m) return +m[1];
    return hktParts(nowMs).year;
  }

  function hktStamp(year, month, day, hour, minute) {
    return Date.UTC(year, month - 1, day, (hour || 0) - 8, minute || 0, 0);
  }

  function parseWhen(when, year) {
    var m = String(when || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s+(\d{1,2})\s*:\s*(\d{2}))?/);
    if (!m) return null;
    return hktStamp(+year, +m[1], +m[2], m[3] != null ? +m[3] : 9, m[4] != null ? +m[4] : 0);
  }

  function parseDue(due, yearHint) {
    var m = String(due || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return hktStamp(+m[1] || yearHint, +m[2], +m[3], 12, 0);
  }

  function inWindow(stamp, nowMs) {
    if (stamp == null || !isFinite(stamp)) return false;
    return stamp >= nowMs - MEET_PAST_MS && stamp <= nowMs + MEET_AHEAD_MS;
  }

  function norm(s) {
    return String(s || '').toLowerCase().replace(/[\s·•,，。.、]/g, '');
  }

  function looseMatch(a, b) {
    var x = norm(a), y = norm(b);
    if (!x || !y) return false;
    return x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0;
  }

  function isGathering(title, where) {
    var t = String(title || '').trim();
    if (/meet|會議|開會/i.test(t)) return true;
    if (String(where || '').indexOf('工作') >= 0) return true;
    var parts = t.split(/\s+/).filter(Boolean);
    if (parts.length >= 3 && parts.every(function (p) {
      return p.length >= 2 && !/^[\d:/-]+$/.test(p);
    })) return true;
    return false;
  }

  function dist(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function lerpAngle(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function wp(layout, id) {
    if (!id || !layout || !layout.waypoints) return null;
    return layout.waypoints[id] || null;
  }

  function deskId(layout, staffId) {
    return (layout.zone || 'life') + '.desk.' + staffId;
  }

  function patrolPts(layout) {
    var ids = layout.patrol || [];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      var w = wp(layout, ids[i]);
      if (!w) continue;
      out.push({ id: ids[i], x: w.x, z: w.z, yaw: w.yaw });
    }
    return out;
  }

  function nearestPatrolIndex(pts, x, z) {
    var best = 0, bestD = Infinity;
    for (var i = 0; i < pts.length; i++) {
      var d = dist(x, z, pts[i].x, pts[i].z);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function nearestPatrolId(layout, x, z) {
    var pts = patrolPts(layout);
    if (!pts.length) return '';
    return pts[nearestPatrolIndex(pts, x, z)].id;
  }

  function patrolSlice(pts, i0, i1) {
    var out = [];
    var i;
    if (i0 <= i1) {
      for (i = i0; i <= i1; i++) out.push(pts[i]);
    } else {
      for (i = i0; i >= i1; i--) out.push(pts[i]);
    }
    return out;
  }

  function insideRoom(layout, x, z) {
    var b = layout.meeting && layout.meeting.bounds;
    if (!b) return false;
    return x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
  }

  function copyPt(p, zOff) {
    return { x: p.x, z: p.z + (zOff || 0), yaw: p.yaw };
  }

  function queueNextPatrol(agent, pts) {
    if (!pts.length) return;
    var i = agent.patrolIndex || 0;
    var dir = agent.patrolDir || 1;
    if (agent.patrolPrimed) {
      var n = i + dir;
      if (n >= pts.length) { dir = -1; n = pts.length - 2; }
      if (n < 0) { dir = 1; n = 1; }
      if (n < 0) n = 0;
      if (n >= pts.length) n = pts.length - 1;
      i = n;
    }
    agent.patrolPrimed = true;
    agent.patrolIndex = i;
    agent.patrolDir = dir;
    agent.path.push(copyPt(pts[i], agent.lane || 0));
  }

  function dropClose(path, x, z, lim) {
    while (path.length && dist(x, z, path[0].x, path[0].z) < lim) path.shift();
    return path;
  }

  function buildPath(agent, layout) {
    var desired = agent.desiredAnim;
    var pts = patrolPts(layout);
    var doorId = layout.meeting && layout.meeting.door;
    var door = wp(layout, doorId);
    var target = wp(layout, agent.desiredTarget);

    if (desired === 'walk') {
      var idx = -1;
      if (agent.desiredTarget) {
        for (var pi = 0; pi < pts.length; pi++) {
          if (pts[pi].id === agent.desiredTarget) idx = pi;
        }
      }
      if (idx < 0) idx = pts.length ? nearestPatrolIndex(pts, agent.x, agent.z) : 0;
      agent.path = [];
      agent.patrolIndex = idx;
      agent.patrolDir = 1;
      agent.patrolPrimed = false;
      // Side lane so the patrol does not stand on the meeting queue (separation is 0.35).
      agent.lane = 0.36;
      if (pts.length && dist(agent.x, agent.z, pts[idx].x, pts[idx].z + agent.lane) > 0.1) {
        agent.path.push(copyPt(pts[idx], agent.lane));
        agent.patrolPrimed = true;
        agent.patrolIndex = idx;
      }
      if (pts.length) queueNextPatrol(agent, pts);
      return agent.path;
    }

    if (!target) return [];
    var path = [];
    var fromIn = insideRoom(layout, agent.x, agent.z);
    var toIn = insideRoom(layout, target.x, target.z);

    if (!fromIn && toIn && door && pts.length) {
      var a = nearestPatrolIndex(pts, agent.x, agent.z);
      var b = nearestPatrolIndex(pts, door.x, door.z);
      patrolSlice(pts, a, b).forEach(function (p) { path.push(copyPt(p)); });
      path.push(copyPt(door));
      (target.via || []).forEach(function (v) { path.push({ x: v.x, z: v.z }); });
      path.push(copyPt(target));
    } else if (fromIn && !toIn && door && pts.length) {
      path.push(copyPt(door));
      var c = nearestPatrolIndex(pts, door.x, door.z);
      var d = nearestPatrolIndex(pts, target.x, target.z);
      patrolSlice(pts, c, d).forEach(function (p) { path.push(copyPt(p)); });
      path.push(copyPt(target));
    } else if (!fromIn && !toIn && pts.length) {
      var e = nearestPatrolIndex(pts, agent.x, agent.z);
      var f = nearestPatrolIndex(pts, target.x, target.z);
      if (dist(agent.x, agent.z, target.x, target.z) > 1.4) {
        patrolSlice(pts, e, f).forEach(function (p) { path.push(copyPt(p)); });
      }
      path.push(copyPt(target));
    } else {
      (target.via || []).forEach(function (v) { path.push({ x: v.x, z: v.z }); });
      path.push(copyPt(target));
    }
    return dropClose(path, agent.x, agent.z, 0.08);
  }

  function resolveAABB(x, z, obstacles, radius) {
    var obs = obstacles || [];
    var r = radius || 0;
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < obs.length; i++) {
        var o = obs[i];
        if (!o) continue;
        var minX = o.minX - r, maxX = o.maxX + r;
        var minZ = o.minZ - r, maxZ = o.maxZ + r;
        if (x > minX && x < maxX && z > minZ && z < maxZ) {
          var left = x - minX, right = maxX - x, down = z - minZ, up = maxZ - z;
          var m = Math.min(left, right, down, up);
          if (m === left) x = minX;
          else if (m === right) x = maxX;
          else if (m === down) z = minZ;
          else z = maxZ;
        }
      }
    }
    return { x: x, z: z };
  }

  function overrideBlock(live) {
    var block = live && live.agents;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
    return block;
  }

  function inferLifeRoster(live, staff, layout, nowMs) {
    live = live || {};
    staff = staff || [];
    layout = layout || { waypoints: {} };
    if (nowMs == null) nowMs = Date.now();
    var year = updatedYear(live, nowMs);
    var focus = Array.isArray(live.focus) ? live.focus : [];
    var calendar = Array.isArray(live.calendar) ? live.calendar : [];
    var onFloor = {};
    staff.forEach(function (s) { if (s && s.id) onFloor[s.id] = true; });

    var events = [];
    calendar.forEach(function (c) {
      if (!c) return;
      var stamp = parseWhen(c.when, year);
      if (!isGathering(c.title, c.where)) return;
      if (stamp != null && !inWindow(stamp, nowMs)) return;
      events.push({
        title: c.title || '',
        where: c.where || '',
        stamp: stamp,
        id: c.title || ''
      });
    });
    focus.forEach(function (f) {
      if (!f || !isGathering(f.title, '')) return;
      var stamp = parseDue(f.due, year);
      if (stamp != null && !inWindow(stamp, nowMs)) return;
      var already = events.some(function (ev) { return looseMatch(ev.title, f.title); });
      if (already) return;
      events.push({ title: f.title || '', where: '', stamp: stamp, id: f.id || f.title || '' });
    });

    var attending = {};
    events.forEach(function (ev) {
      var hits = focus.filter(function (f) { return f && looseMatch(f.title, ev.title); });
      if (!hits.length) {
        focus.forEach(function (f) {
          if (f && f.zone === (layout.zone || 'life') && looseMatch(f.title, ev.title)) hits.push(f);
        });
      }
      hits.forEach(function (f) {
        var mark = f.id || ev.id || ev.title;
        if (f.staffId && onFloor[f.staffId]) attending[f.staffId] = mark;
        else if ((f.zone === (layout.zone || 'life')) || !f.staffId) {
          if (onFloor.life) attending.life = attending.life || mark;
          if (onFloor.meet) attending.meet = attending.meet || mark;
        }
      });
      if (/meet|會議|開會/i.test(ev.title) || String(ev.where || '').indexOf('工作') >= 0) {
        var mark2 = ev.id || ev.title;
        if (onFloor.sec) attending.sec = attending.sec || mark2;
        if (onFloor.meet) attending.meet = attending.meet || mark2;
      }
      if (!hits.length && isGathering(ev.title, ev.where)) {
        if (onFloor.life && !attending.life) attending.life = ev.id || ev.title;
        if (onFloor.meet && !attending.meet) attending.meet = ev.id || ev.title;
      }
    });

    var intents = [];
    staff.forEach(function (s) {
      if (!s || !s.id) return;
      var did = deskId(layout, s.id);
      if (!wp(layout, did)) return;
      if (attending[s.id]) {
        intents.push({
          staffId: s.id,
          anim: 'meeting',
          target: '',
          meetingId: String(attending[s.id])
        });
        return;
      }
      var idle = /待機|待命/.test(String(s.status || ''));
      intents.push({
        staffId: s.id,
        anim: idle ? 'idle' : 'sit',
        target: did,
        meetingId: ''
      });
    });

    var block = overrideBlock(live);
    var locked = {};
    if (block) {
      intents.forEach(function (it) {
        var o = block[it.staffId];
        if (!o || typeof o !== 'object' || Array.isArray(o)) return;
        var anim = typeof o.anim === 'string' ? o.anim : '';
        if (ANIMS[anim]) {
          it.anim = anim;
          locked[it.staffId] = true;
        }
        if (typeof o.target === 'string' && wp(layout, o.target)) it.target = o.target;
        if (typeof o.meetingId === 'string' || typeof o.meetingId === 'number') {
          it.meetingId = String(o.meetingId);
        }
      });
    }

    var seats = (layout.meeting && layout.meeting.seats) || [];
    var used = {};
    intents.forEach(function (it) {
      if (it.anim !== 'meeting') return;
      if (it.target && seats.indexOf(it.target) >= 0 && !used[it.target]) used[it.target] = it.staffId;
    });
    var si = 0;
    intents.forEach(function (it) {
      if (it.anim !== 'meeting') return;
      if (it.target && wp(layout, it.target) && seats.indexOf(it.target) >= 0) return;
      while (si < seats.length && used[seats[si]]) si++;
      var seat = seats[si] || seats[seats.length - 1] || '';
      it.target = seat;
      if (seat) used[seat] = it.staffId;
      si++;
    });

    intents.forEach(function (it) {
      var did = deskId(layout, it.staffId);
      if (it.anim === 'sit' || it.anim === 'idle') {
        if (!wp(layout, it.target)) it.target = did;
      } else if (it.anim === 'walk') {
        if (!wp(layout, it.target)) {
          var desk = wp(layout, did);
          it.target = desk ? nearestPatrolId(layout, desk.x, desk.z) : (layout.patrol && layout.patrol[0]) || '';
        }
      }
    });

    var anyWalk = intents.some(function (it) { return it.anim === 'walk'; });
    if (!anyWalk) {
      for (var i = 0; i < intents.length; i++) {
        var it = intents[i];
        if (it.anim === 'idle' && !locked[it.staffId]) {
          var deskW = wp(layout, deskId(layout, it.staffId));
          it.anim = 'walk';
          it.target = deskW ? nearestPatrolId(layout, deskW.x, deskW.z) : (layout.patrol && layout.patrol[0]) || it.target;
          break;
        }
      }
    }

    var title = '';
    var bestScore = Infinity;
    events.forEach(function (ev) {
      if (!ev.title) return;
      var score = ev.stamp == null ? 48 * 3600 * 1000 : (ev.stamp >= nowMs ? (ev.stamp - nowMs) : (nowMs - ev.stamp + 12 * 3600 * 1000));
      if (score < bestScore) { bestScore = score; title = ev.title; }
    });

    return { intents: intents, meetingTitle: title };
  }

  function createSim(layout, intents) {
    var agents = [];
    (intents || []).forEach(function (it) {
      var desk = wp(layout, deskId(layout, it.staffId));
      if (!desk) return;
      var a = {
        staffId: it.staffId,
        desiredAnim: it.anim,
        desiredTarget: it.target,
        meetingId: it.meetingId || '',
        x: desk.x,
        z: desk.z,
        yaw: typeof desk.yaw === 'number' ? desk.yaw : 0,
        anim: it.anim,
        path: [],
        stuck: 0,
        patrolIndex: 0,
        patrolDir: 1,
        patrolPrimed: false
      };
      a.path = buildPath(a, layout);
      a.anim = a.path.length ? 'walk' : a.desiredAnim;
      agents.push(a);
    });

    function setIntents(next) {
      var by = {};
      (next || []).forEach(function (it) { by[it.staffId] = it; });
      agents.forEach(function (a) {
        var n = by[a.staffId];
        if (!n) return;
        var changed = n.anim !== a.desiredAnim || n.target !== a.desiredTarget;
        a.desiredAnim = n.anim;
        a.desiredTarget = n.target;
        a.meetingId = n.meetingId || '';
        if (!changed) return;
        a.path = buildPath(a, layout);
        a.stuck = 0;
        a.anim = a.path.length ? 'walk' : a.desiredAnim;
        if (!a.path.length) {
          var tw = wp(layout, a.desiredTarget);
          if (tw && dist(a.x, a.z, tw.x, tw.z) < 0.25 && typeof tw.yaw === 'number') a.yaw = tw.yaw;
        }
      });
    }

    function step(dt) {
      if (!dt || dt <= 0) return;
      if (dt > 0.05) dt = 0.05;
      var motion = layout.motion || {};
      var speed = motion.speed || 1.35;
      var arrive = motion.arrive || 0.08;
      var radius = motion.radius == null ? 0.16 : motion.radius;
      var sep = motion.separation == null ? 0.35 : motion.separation;
      var pts = patrolPts(layout);
      var proposed = [];

      for (var i = 0; i < agents.length; i++) {
        var a = agents[i];
        var rec = { x: a.x, z: a.z, yaw: a.yaw, moving: false, consumed: false };
        if (a.desiredAnim === 'walk' && (!a.path || !a.path.length)) queueNextPatrol(a, pts);
        if (a.path && a.path.length) {
          var p = a.path[0];
          var dx = p.x - a.x;
          var dz = p.z - a.z;
          var d = Math.sqrt(dx * dx + dz * dz);
          if (!a.chase || a.chase.x !== p.x || a.chase.z !== p.z) a.chase = { x: p.x, z: p.z, best: d, time: 0 };
          if (d < a.chase.best - 0.015) { a.chase.best = d; a.chase.time = 0; }
          else a.chase.time += dt;
          var giveUp = a.chase.time > 0.55 && d < 0.7;
          if (d <= arrive || giveUp) {
            rec.x = p.x;
            rec.z = p.z;
            rec.consumed = true;
            a.path.shift();
            if (a.desiredAnim === 'walk' && !a.path.length) queueNextPatrol(a, pts);
            if (a.path.length) {
              var n = a.path[0];
              rec.yaw = Math.atan2(n.x - rec.x, n.z - rec.z);
              rec.moving = true;
            }
          } else {
            var stepLen = Math.min(speed * dt, d);
            rec.x = a.x + dx / d * stepLen;
            rec.z = a.z + dz / d * stepLen;
            rec.yaw = Math.atan2(dx, dz);
            rec.moving = true;
          }
        }
        proposed.push(rec);
      }

      function pushApart(a, b, both) {
        var dx = a.x - b.x;
        var dz = a.z - b.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 1e-4) { dx = 0.02; dz = 0; d = 0.02; }
        if (d >= sep) return;
        var push = (sep - d) / (both ? 2 : 1);
        var ux = dx / d, uz = dz / d;
        a.x += ux * push;
        a.z += uz * push;
        if (both) {
          b.x -= ux * push;
          b.z -= uz * push;
        }
      }

      for (var i2 = 0; i2 < agents.length; i2++) {
        if (!proposed[i2].moving) continue;
        for (var j = i2 + 1; j < agents.length; j++) {
          if (!proposed[j].moving) continue;
          pushApart(proposed[i2], proposed[j], true);
        }
        for (var k = 0; k < agents.length; k++) {
          if (k === i2 || proposed[k].moving) continue;
          pushApart(proposed[i2], { x: agents[k].x, z: agents[k].z }, false);
        }
      }

      var halfW = ((layout.floor && layout.floor.width) || 9) / 2 - ((layout.floor && layout.floor.inset) || 0.25);
      var halfD = ((layout.floor && layout.floor.depth) || 5) / 2 - ((layout.floor && layout.floor.inset) || 0.25);
      for (var n = 0; n < agents.length; n++) {
        var ag = agents[n];
        var pr = proposed[n];
        if (pr.moving || pr.consumed) {
          if (pr.moving) {
            var resolved = resolveAABB(pr.x, pr.z, layout.obstacles, radius);
            pr.x = clamp(resolved.x, -halfW, halfW);
            pr.z = clamp(resolved.z, -halfD, halfD);
          }
          var moved = dist(ag.x, ag.z, pr.x, pr.z);
          if (pr.consumed) ag.stuck = 0;
          else if (moved < 0.004) ag.stuck = (ag.stuck || 0) + dt;
          else ag.stuck = 0;
          if (!pr.consumed && ag.stuck > 0.65 && ag.path && ag.path.length) {
            ag.path.shift();
            ag.stuck = 0;
            if (ag.desiredAnim === 'walk' && !ag.path.length) queueNextPatrol(ag, pts);
          }
          ag.x = pr.x;
          ag.z = pr.z;
          ag.yaw = pr.yaw;
          ag.anim = (ag.path && ag.path.length) ? 'walk' : ag.desiredAnim;
        } else {
          ag.stuck = 0;
          ag.anim = ag.desiredAnim;
        }
        if (ag.anim !== 'walk') {
          var tw = wp(layout, ag.desiredTarget);
          if (tw) {
            if (typeof tw.yaw === 'number') ag.yaw = lerpAngle(ag.yaw, tw.yaw, 0.22);
            var dd = dist(ag.x, ag.z, tw.x, tw.z);
            if (dd < 0.45 && dd > 0.001) {
              ag.x += (tw.x - ag.x) * 0.25;
              ag.z += (tw.z - ag.z) * 0.25;
            }
          }
        }
      }
    }

    return { agents: agents, step: step, setIntents: setIntents };
  }

  return {
    inferLifeRoster: inferLifeRoster,
    createSim: createSim,
    resolveAABB: resolveAABB,
    isGathering: isGathering
  };
});
