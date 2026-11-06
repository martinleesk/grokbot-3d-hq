/* Not loaded by the town page. Kept for campus.test.js (old elevator / skybridge sim).
   Campus motion: per-floor idle/walk, elevator rides, cross-floor meetings, skybridge.
   No THREE dependency. L4 keeps HQLifeSim intents; this layer only holds an agent while they travel. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.HQCampus = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var LIFT_DOOR = { x: -3.48, z: 0.02 };
  var LIFT_CAB = { x: -4.12, z: 0.02 };
  var BRIDGE_DOOR = { x: 4.02, z: 0.02 };
  var BRIDGE_START = { x: 5.15, z: 0 };
  var BRIDGE_END = { x: 14.35, z: 0.15 };

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function hktStamp(year, month, day, hour, minute) {
    return Date.UTC(year, month - 1, day, (hour || 0) - 8, minute || 0, 0);
  }

  function parseWhen(when, year) {
    var m = String(when || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s+(\d{1,2})\s*:\s*(\d{2}))?/);
    if (!m) return null;
    return hktStamp(year, +m[1], +m[2], m[3] != null ? +m[3] : 9, m[4] != null ? +m[4] : 0);
  }

  function yearOf(live, nowMs) {
    var s = live && live.updated != null ? String(live.updated) : '';
    var m = s.match(/(\d{4})/);
    if (m) return +m[1];
    return new Date(nowMs).getUTCFullYear();
  }

  function activeMeetings(live, nowMs) {
    var block = live && live.campus && live.campus.meetings;
    if (!Array.isArray(block)) return [];
    var year = yearOf(live, nowMs || Date.now());
    var now = nowMs || Date.now();
    var out = [];
    block.forEach(function (m) {
      if (!m || !m.targetFloor || !Array.isArray(m.staffIds) || !m.staffIds.length) return;
      if (m.when) {
        var stamp = parseWhen(m.when, year);
        if (stamp != null && (stamp < now - 2 * 3600 * 1000 || stamp > now + 36 * 3600 * 1000)) return;
      }
      out.push({
        id: m.id || m.targetFloor,
        title: m.title || '',
        targetFloor: m.targetFloor,
        staffIds: m.staffIds.slice()
      });
    });
    return out;
  }

  function layoutFor(zoneId, staffIds) {
    var ids = (staffIds || []).slice();
    var slots = [];
    [-3.05, -1.85, -0.65, 0.55].forEach(function (x) {
      slots.push({ x: x, z: -1.55, yaw: 0, desk: true });
    });
    [-3.05, -1.85].forEach(function (x) {
      slots.push({ x: x, z: 1.55, yaw: Math.PI, desk: true });
    });
    var extra = 0;
    while (slots.length < Math.max(ids.length, 6)) {
      slots.push({
        x: -3.05 + (extra % 5) * 0.72,
        z: extra < 5 ? 0.9 : -0.85,
        yaw: extra < 5 ? Math.PI : 0,
        desk: false
      });
      extra++;
    }
    var desks = [];
    var waypoints = {};
    var obstacles = [];
    ids.forEach(function (id, i) {
      var spot = slots[i];
      var face = spot.z < 0 ? Math.PI : 0;
      var seatZ = spot.z < 0 ? spot.z + 0.58 : spot.z - 0.58;
      waypoints[zoneId + '.desk.' + id] = { x: spot.x, z: seatZ, yaw: face };
      if (spot.desk) {
        desks.push({ staffId: id, x: spot.x, z: spot.z, yaw: spot.yaw });
        obstacles.push({
          id: 'desk.' + id,
          minX: spot.x - 0.55, maxX: spot.x + 0.55,
          minZ: spot.z - 0.28, maxZ: spot.z + 0.28
        });
      }
    });
    var patrol = [];
    for (var p = 0; p < 4; p++) {
      var pid = zoneId + '.patrol.' + (p + 1);
      patrol.push(pid);
      waypoints[pid] = { x: -2.6 + p * 1.05, z: 0.28 };
    }
    var seats = [];
    [
      { id: 1, x: 2.85, z: -1.05, yaw: 0 },
      { id: 2, x: 2.85, z: 1.05, yaw: Math.PI },
      { id: 3, x: 2.15, z: -0.28, yaw: Math.PI / 2 },
      { id: 4, x: 3.55, z: 0.28, yaw: -Math.PI / 2 }
    ].forEach(function (s) {
      var sid = zoneId + '.meet.seat.' + s.id;
      seats.push(sid);
      waypoints[sid] = { x: s.x, z: s.z, yaw: s.yaw };
    });
    waypoints[zoneId + '.door.meet'] = { x: 1.52, z: 0, yaw: Math.PI / 2 };
    waypoints[zoneId + '.lift'] = { x: LIFT_DOOR.x, z: LIFT_DOOR.z, yaw: -Math.PI / 2 };
    var plants = [
      { x: -4.05, z: -2.05 },
      { x: -4.05, z: 2.05 },
      { x: 0.9, z: -2.05 },
      { x: 0.9, z: 2.0 }
    ];
    var lamps = [
      { x: -2.4, z: 0.0 },
      { x: -0.4, z: 0.0 },
      { x: 1.15, z: -1.15 }
    ];
    obstacles.push(
      { id: 'wall.west.n', minX: 1.46, maxX: 1.6, minZ: -1.95, maxZ: -0.45 },
      { id: 'wall.west.s', minX: 1.46, maxX: 1.6, minZ: 0.45, maxZ: 1.95 },
      { id: 'wall.north', minX: 1.46, maxX: 4.2, minZ: -1.95, maxZ: -1.8 },
      { id: 'wall.south', minX: 1.46, maxX: 4.2, minZ: 1.8, maxZ: 1.95 },
      { id: 'wall.east', minX: 4.05, maxX: 4.2, minZ: -1.95, maxZ: 1.95 },
      { id: 'table', minX: 2.45, maxX: 3.25, minZ: -0.65, maxZ: 0.65 }
    );
    return {
      zone: zoneId,
      floor: { width: 9.2, depth: 5.2, inset: 0.28 },
      motion: { speed: 1.35, separation: 0.34, radius: 0.16, arrive: 0.2 },
      desks: desks,
      patrol: patrol,
      plants: plants,
      lamps: lamps,
      art: { x: 0.15, z: 2.28, yaw: Math.PI },
      greenWall: { x: -0.35, z: -2.28, yaw: 0 },
      meeting: {
        id: 'A',
        door: zoneId + '.door.meet',
        seats: seats,
        bounds: { minX: 1.55, maxX: 4.15, minZ: -1.85, maxZ: 1.85 },
        table: { x: 2.85, z: 0, w: 0.72, d: 1.25 },
        walls: [
          { x: 1.52, z: -1.2, w: 1.35, rot: Math.PI / 2, h: 1.05 },
          { x: 1.52, z: 1.2, w: 1.35, rot: Math.PI / 2, h: 1.05 },
          { x: 2.85, z: -1.88, w: 2.55, rot: 0, h: 1.05 },
          { x: 2.85, z: 1.88, w: 2.55, rot: 0, h: 1.05 },
          { x: 4.12, z: 0, w: 3.7, rot: Math.PI / 2, h: 1.05 }
        ],
        doorFrame: { x: 1.52, z: 0, gap: 0.9, h: 1.05 }
      },
      waypoints: waypoints,
      obstacles: obstacles,
      lift: { door: LIFT_DOOR, cab: LIFT_CAB }
    };
  }

  function simpleIntents(staff, layout) {
    var list = staff || [];
    return list.map(function (s, i) {
      var id = typeof s === 'string' ? s : s.id;
      if (i === 0) {
        return { staffId: id, anim: 'walk', target: (layout.patrol && layout.patrol[0]) || '' };
      }
      if (i % 3 === 1) return { staffId: id, anim: 'sit', target: layout.zone + '.desk.' + id };
      return { staffId: id, anim: 'idle', target: layout.zone + '.desk.' + id };
    });
  }

  function dist(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function approach(trip, tx, tz, dt, speed) {
    var dx = tx - trip.x;
    var dz = tz - trip.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.14) {
      trip.x = tx;
      trip.z = tz;
      return true;
    }
    var step = Math.min((speed || 1.65) * dt, d);
    trip.x += dx / d * step;
    trip.z += dz / d * step;
    trip.yaw = Math.atan2(dx, dz);
    trip.anim = 'walk';
    return false;
  }

  function approachWorld(trip, tx, ty, tz, dt, speed) {
    var dx = tx - trip.wx;
    var dy = ty - trip.wy;
    var dz = tz - trip.wz;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.16) {
      trip.wx = tx;
      trip.wy = ty;
      trip.wz = tz;
      return true;
    }
    var step = Math.min((speed || 1.55) * dt, d);
    trip.wx += dx / d * step;
    trip.wy += dy / d * step;
    trip.wz += dz / d * step;
    trip.yaw = Math.atan2(dx, dz);
    trip.anim = 'walk';
    return false;
  }

  function createDirector(opts) {
    var Life = opts.Life;
    var floors = opts.floors || [];
    var levelY = opts.levelY || {};
    var bridgeY = opts.bridgeY;
    var getLive = opts.getLive || function () { return {}; };
    var sims = {};
    var who = {};
    var homes = {};
    var trips = {};
    var clock = 0;
    var cooldown = opts.firstDelay != null ? opts.firstDelay : 1.1;
    var cursor = 0;
    var order = floors.map(function (f) { return f.id; });

    floors.forEach(function (f) {
      var sim = f.sim;
      if (!sim) sim = Life.createSim(f.layout, simpleIntents(f.staff, f.layout));
      sims[f.id] = sim;
      sim.agents.forEach(function (a) {
        var deskId = f.layout.zone + '.desk.' + a.staffId;
        var desk = f.layout.waypoints[deskId] || { x: a.x, z: a.z, yaw: a.yaw };
        who[a.staffId] = { floorId: f.id, agent: a, sim: sim };
        homes[a.staffId] = { floorId: f.id, x: desk.x, z: desk.z, yaw: desk.yaw || 0 };
      });
    });

    function seatsOf(floorId) {
      var f = null;
      for (var i = 0; i < floors.length; i++) if (floors[i].id === floorId) f = floors[i];
      if (!f || !f.layout.meeting) return [{ x: 0.2, z: 0.2, yaw: 0 }];
      return f.layout.meeting.seats.map(function (id) { return f.layout.waypoints[id]; }).filter(Boolean);
    }

    function otherFloor(fromId) {
      var i = order.indexOf(fromId);
      if (i < 0) return order[0];
      return order[(i + 1 + (cursor % Math.max(1, order.length - 1))) % order.length] === fromId
        ? order[(i + 1) % order.length]
        : order[(i + 1) % order.length];
    }

    function begin(staffId, queue) {
      var w = who[staffId];
      if (!w || trips[staffId]) return false;
      w.agent.hold = true;
      trips[staffId] = {
        staffId: staffId,
        queue: queue,
        floorId: w.floorId,
        x: w.agent.x,
        z: w.agent.z,
        yaw: w.agent.yaw,
        anim: 'walk',
        world: false,
        wx: 0, wy: levelY[w.floorId] || 0, wz: 0
      };
      return true;
    }

    function liftOut(fromId, x) {
      return [
        { type: 'local', floorId: fromId, x: clamp(x, -3.1, 3.2), z: 0.02 },
        { type: 'local', floorId: fromId, x: LIFT_DOOR.x, z: LIFT_DOOR.z },
        { type: 'local', floorId: fromId, x: LIFT_CAB.x, z: LIFT_CAB.z }
      ];
    }

    function liftIn(toId, spot, anim, stay) {
      return [
        { type: 'local', floorId: toId, x: LIFT_DOOR.x, z: LIFT_DOOR.z },
        { type: 'local', floorId: toId, x: spot.x, z: spot.z, yaw: spot.yaw, anim: anim, stay: stay }
      ];
    }

    function ride(fromId, toId) {
      if (fromId === toId) return [];
      return [{ type: 'ride', toId: toId }];
    }

    function goHome(staffId, fromId) {
      var home = homes[staffId];
      var q = liftOut(fromId, LIFT_DOOR.x).concat(ride(fromId, home.floorId)).concat([
        { type: 'local', floorId: home.floorId, x: LIFT_DOOR.x, z: LIFT_DOOR.z },
        { type: 'local', floorId: home.floorId, x: home.x, z: home.z, yaw: home.yaw, anim: 'idle' }
      ]);
      return q;
    }

    function routeVisit(staffId, toId, spot, anim, stay) {
      var fromId = who[staffId].floorId;
      var q = liftOut(fromId, who[staffId].agent.x);
      q = q.concat(ride(fromId, toId));
      q = q.concat(liftIn(toId, spot, anim, stay));
      if (toId !== homes[staffId].floorId) q = q.concat(goHome(staffId, toId));
      else q.push({ type: 'local', floorId: toId, x: homes[staffId].x, z: homes[staffId].z, anim: 'idle' });
      return q;
    }

    function routeBridge(staffId) {
      var home = homes[staffId];
      var fromId = who[staffId].floorId;
      var q = [];
      if (fromId !== 'travel') {
        q = q.concat(liftOut(fromId, who[staffId].agent.x));
        q = q.concat(ride(fromId, 'travel'));
        q = q.concat([{ type: 'local', floorId: 'travel', x: LIFT_DOOR.x, z: LIFT_DOOR.z }]);
      } else {
        q = q.concat(liftOut(fromId, who[staffId].agent.x).slice(0, 1));
      }
      q.push({ type: 'local', floorId: 'travel', x: BRIDGE_DOOR.x, z: BRIDGE_DOOR.z });
      q.push({ type: 'bridge', dir: 1 });
      q.push({ type: 'bridge', dir: -1, arriveFloor: 'travel', x: BRIDGE_DOOR.x, z: BRIDGE_DOOR.z });
      if (home.floorId !== 'travel') q = q.concat(goHome(staffId, 'travel'));
      else q.push({ type: 'local', floorId: 'travel', x: home.x, z: home.z, anim: 'idle' });
      return q;
    }

    function finish(staffId) {
      var w = who[staffId];
      var home = homes[staffId];
      if (w && home) {
        w.agent.x = home.x;
        w.agent.z = home.z;
        w.agent.yaw = home.yaw || 0;
        w.agent.hold = false;
        if (w.sim && w.sim.repath) w.sim.repath(staffId);
      }
      delete trips[staffId];
    }

    function advance(trip, dt) {
      var step = trip.queue[0];
      if (!step) { finish(trip.staffId); return; }
      if (step.type === 'local') {
        trip.world = false;
        trip.floorId = step.floorId;
        if (approach(trip, step.x, step.z, dt, 1.7)) {
          if (typeof step.yaw === 'number') trip.yaw = step.yaw;
          if (step.anim) trip.anim = step.anim;
          if (step.stay) {
            step.left = step.left == null ? step.stay : step.left;
            step.left -= dt;
            trip.anim = step.anim || 'idle';
            if (step.left > 0) return;
          }
          trip.queue.shift();
        }
        return;
      }
      if (step.type === 'ride') {
        if (!trip.ride) {
          var fromY = levelY[trip.floorId] || 0;
          var toY = levelY[step.toId] || 0;
          var floorsApart = 1;
          var ia = order.indexOf(trip.floorId);
          var ib = order.indexOf(step.toId);
          if (ia >= 0 && ib >= 0) floorsApart = Math.max(1, Math.abs(ib - ia));
          trip.ride = { t: 0, dur: 0.55 + floorsApart * 0.38, y0: fromY, y1: toY, toId: step.toId };
          trip.wx = LIFT_CAB.x;
          trip.wz = LIFT_CAB.z;
          trip.wy = fromY;
        }
        trip.world = true;
        trip.ride.t += dt;
        var u = Math.min(1, trip.ride.t / trip.ride.dur);
        var e = u * u * (3 - 2 * u);
        trip.wy = trip.ride.y0 + (trip.ride.y1 - trip.ride.y0) * e;
        trip.wx = LIFT_CAB.x;
        trip.wz = LIFT_CAB.z;
        trip.anim = 'idle';
        if (u >= 1) {
          trip.world = false;
          trip.floorId = step.toId;
          trip.x = LIFT_DOOR.x;
          trip.z = LIFT_DOOR.z;
          trip.ride = null;
          trip.queue.shift();
        }
        return;
      }
      if (step.type === 'bridge') {
        if (!trip.bridgeOn) {
          trip.world = true;
          trip.wx = step.dir > 0 ? BRIDGE_START.x : BRIDGE_END.x;
          trip.wy = bridgeY;
          trip.wz = step.dir > 0 ? BRIDGE_START.z : BRIDGE_END.z;
          trip.bridgeOn = true;
        }
        var goal = step.dir > 0 ? BRIDGE_END : BRIDGE_START;
        if (approachWorld(trip, goal.x, bridgeY, goal.z, dt, 1.45)) {
          trip.bridgeOn = false;
          trip.queue.shift();
          if (step.dir < 0) {
            trip.world = false;
            trip.floorId = step.arriveFloor || 'travel';
            trip.x = step.x != null ? step.x : BRIDGE_DOOR.x;
            trip.z = step.z != null ? step.z : BRIDGE_DOOR.z;
          }
        }
      }
    }

    function launch() {
      var meetings = activeMeetings(getLive(), Date.now());
      var sent = false;
      meetings.forEach(function (m) {
        if (!sims[m.targetFloor]) return;
        var seats = seatsOf(m.targetFloor);
        m.staffIds.forEach(function (sid, i) {
          if (!who[sid] || trips[sid]) return;
          if (who[sid].floorId === m.targetFloor && who[sid].agent.anim === 'meeting') return;
          var seat = seats[i % seats.length] || { x: 2.2, z: 0, yaw: Math.PI / 2 };
          begin(sid, routeVisit(sid, m.targetFloor, seat, 'meeting', 9));
          sent = true;
        });
      });
      var ids = Object.keys(who);
      if (!ids.length) return;
      for (var n = 0; n < ids.length; n++) {
        var sid = ids[(cursor + n) % ids.length];
        if (trips[sid]) continue;
        cursor = (cursor + n + 1) % ids.length;
        var home = who[sid].floorId;
        if ((home === 'travel' || home === 'content' || home === 'life') && (cursor % 3 === 0)) {
          begin(sid, routeBridge(sid));
        } else {
          var dest = otherFloor(home);
          if (dest === home) return;
          begin(sid, routeVisit(sid, dest, { x: -1.4, z: 0.28, yaw: 0 }, 'idle', 3.5));
        }
        return;
      }
      if (!sent) return;
    }

    function step(dt) {
      if (!dt || dt <= 0) return;
      if (dt > 0.05) dt = 0.05;
      clock += dt;
      Object.keys(sims).forEach(function (id) { sims[id].step(dt); });
      Object.keys(trips).forEach(function (id) {
        if (trips[id]) advance(trips[id], dt);
      });
      cooldown -= dt;
      if (cooldown <= 0) {
        launch();
        cooldown = 6.5;
      }
    }

    function poses() {
      var out = [];
      Object.keys(who).forEach(function (id) {
        var w = who[id];
        var trip = trips[id];
        if (!trip) {
          out.push({
            staffId: id, floorId: w.floorId, x: w.agent.x, z: w.agent.z,
            yaw: w.agent.yaw, anim: w.agent.anim, riding: false
          });
          return;
        }
        if (trip.world) {
          out.push({
            staffId: id, floorId: trip.floorId, x: trip.wx, y: trip.wy, z: trip.wz,
            yaw: trip.yaw, anim: trip.anim || 'walk', riding: true
          });
          return;
        }
        out.push({
          staffId: id, floorId: trip.floorId, x: trip.x, z: trip.z,
          yaw: trip.yaw, anim: trip.anim || 'walk', riding: false
        });
      });
      return out;
    }

    function carY() {
      var ridingY = null;
      Object.keys(trips).forEach(function (id) {
        var trip = trips[id];
        var stepNow = trip && trip.queue[0];
        if (stepNow && stepNow.type === 'ride') ridingY = trip.wy;
      });
      if (ridingY != null) return ridingY;
      if (!order.length) return 0;
      var u = (Math.sin(clock * 0.45) + 1) / 2;
      var i = Math.min(order.length - 1, Math.floor(u * order.length));
      return levelY[order[i]] || 0;
    }

    function openFloors() {
      var open = {};
      Object.keys(trips).forEach(function (id) {
        var trip = trips[id];
        var stepNow = trip.queue[0];
        if (!stepNow) return;
        if (stepNow.type === 'ride') {
          open[trip.floorId] = 1;
          open[stepNow.toId] = 1;
        } else if (stepNow.type === 'local' && dist(trip.x, trip.z, LIFT_CAB.x, LIFT_CAB.z) < 1.15) {
          open[trip.floorId] = 1;
        }
      });
      return open;
    }

    return {
      step: step,
      poses: poses,
      carY: carY,
      openFloors: openFloors,
      sims: sims,
      trips: trips
    };
  }

  return {
    layoutFor: layoutFor,
    simpleIntents: simpleIntents,
    activeMeetings: activeMeetings,
    createDirector: createDirector,
    liftDoor: LIFT_DOOR,
    liftCab: LIFT_CAB,
    bridgeDoor: BRIDGE_DOOR,
    bridgeStart: BRIDGE_START,
    bridgeEnd: BRIDGE_END
  };
});
