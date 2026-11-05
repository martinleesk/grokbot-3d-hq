/* node life-sim.test.js */
var fs = require('fs');
var path = require('path');
var simApi = require('./life-sim.js');
var layout = JSON.parse(fs.readFileSync(path.join(__dirname, 'floors/life.layout.json'), 'utf8'));
var live = JSON.parse(fs.readFileSync(path.join(__dirname, 'live.json'), 'utf8'));
var staff = [
  { id: 'life', name: '生活管家', status: '運作中' },
  { id: 'finance', name: '財務管家', status: '運作中' },
  { id: 'health', name: '健康教練', status: '待命' },
  { id: 'mind', name: '心理命理', status: '待命' },
  { id: 'learn', name: '學習夥伴', status: '學習中' },
  { id: 'sec', name: '工作秘書', status: '運作中' },
  { id: 'meet', name: '會議紀錄', status: '待機' }
];

var fails = 0;
function assert(cond, msg) {
  if (!cond) {
    fails++;
    console.error('FAIL', msg);
  }
}

var now = Date.parse('2026-11-05T00:01:00Z');
var a = simApi.inferLifeRoster(live, staff, layout, now);
var by = {};
a.intents.forEach(function (it) { by[it.staffId] = it; });

assert(by.life.anim === 'meeting', 'life should be in meeting, got ' + by.life.anim);
assert(by.sec.anim === 'meeting', 'sec should be in meeting, got ' + by.sec.anim);
assert(by.meet.anim === 'meeting', 'meet should be in meeting, got ' + by.meet.anim);
assert(by.finance.anim === 'sit', 'finance should sit, got ' + by.finance.anim);
assert(by.learn.anim === 'sit', 'learn should sit, got ' + by.learn.anim);
assert(by.health.anim === 'walk', 'health should walk, got ' + by.health.anim);
assert(by.mind.anim === 'idle', 'mind should idle, got ' + by.mind.anim);
assert(by.life.target === 'life.meet.A.seat.1', 'life seat ' + by.life.target);
assert(by.sec.target === 'life.meet.A.seat.2', 'sec seat ' + by.sec.target);
assert(by.meet.target === 'life.meet.A.seat.3', 'meet seat ' + by.meet.target);
assert(a.meetingTitle === 'Brian Janice Annika', 'title ' + a.meetingTitle);
assert(by.health.target.indexOf('life.patrol.') === 0, 'walker target ' + by.health.target);

var halted = JSON.parse(JSON.stringify(live));
halted.invest.halt = true;
halted.invest.haltReason = 'L5 only';
halted.invest.mode = 'HALT';
var b = simApi.inferLifeRoster(halted, staff, layout, now);
assert(JSON.stringify(a.intents) === JSON.stringify(b.intents), 'halt must not change L4 intents');
assert(a.meetingTitle === b.meetingTitle, 'halt must not change L4 title');

var over = JSON.parse(JSON.stringify(live));
over.agents = { health: { anim: 'sit' } };
var c = simApi.inferLifeRoster(over, staff, layout, now);
var bc = {};
c.intents.forEach(function (it) { bc[it.staffId] = it; });
assert(bc.health.anim === 'sit', 'override health sit');
assert(bc.health.target === 'life.desk.health', 'override sit uses desk ' + bc.health.target);
assert(bc.mind.anim === 'walk', 'next idle becomes walker, got ' + bc.mind.anim);
assert(bc.life.anim === 'meeting', 'override does not clear other meetings');

var later = Date.parse('2026-11-08T00:01:00Z');
var d = simApi.inferLifeRoster(live, staff, layout, later);
var bd = {};
d.intents.forEach(function (it) { bd[it.staffId] = it; });
assert(bd.life.anim !== 'meeting', 'stale calendar should not keep life in meeting');
assert(bd.sec.anim !== 'meeting', 'stale calendar should not keep sec in meeting');
assert(bd.health.anim === 'walk', 'walker remains when no meeting');

var empty = simApi.inferLifeRoster({}, staff, layout, now);
var be = {};
empty.intents.forEach(function (it) { be[it.staffId] = it; });
assert(be.life.anim === 'sit' && be.finance.anim === 'sit' && be.health.anim === 'walk', 'status-only inference');
assert(!empty.meetingTitle, 'no title without a gathering');

var pushed = simApi.resolveAABB(0.95, 0, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }], 0.2);
assert(Math.abs(pushed.x) >= 1.2 - 1e-6, 'aabb should slide off the box, x=' + pushed.x);

var sim = simApi.createSim(layout, a.intents);
var door = layout.waypoints['life.door.meet.A'];
['life', 'sec', 'meet'].forEach(function (id) {
  var ag = sim.agents.filter(function (p) { return p.staffId === id; })[0];
  var doorAt = -1, seatAt = -1;
  ag.path.forEach(function (p, i) {
    if (doorAt < 0 && Math.abs(p.x - door.x) < 0.05 && Math.abs(p.z - door.z) < 0.05) doorAt = i;
    if (Math.abs(p.x - layout.waypoints[by[id].target].x) < 0.05) seatAt = i;
  });
  assert(doorAt >= 0 && seatAt > doorAt, id + ' path should be desk → door → seat');
  assert(Math.abs(ag.path[0].x - layout.waypoints['life.desk.' + id].x) < 0.05, id + ' leaves via the aisle in front of the desk');
  assert(ag.x === layout.waypoints['life.desk.' + id].x, id + ' spawns at desk');
});

var crossed = { life: false, sec: false, meet: false };
var financeDrift = 0;
var walked = 0;
var finance = sim.agents.filter(function (p) { return p.staffId === 'finance'; })[0];
var health = sim.agents.filter(function (p) { return p.staffId === 'health'; })[0];
var fx0 = finance.x, fz0 = finance.z;
for (var step = 0; step < 400; step++) {
  var px = health.x, pz = health.z;
  sim.step(0.05);
  walked += Math.abs(health.x - px) + Math.abs(health.z - pz);
  sim.agents.forEach(function (ag) {
    if (crossed[ag.staffId] != null && ag.x > 1.4 && ag.x < 1.75 && Math.abs(ag.z) < 0.42) crossed[ag.staffId] = true;
  });
}
var travel = walked;
financeDrift = Math.abs(finance.x - fx0) + Math.abs(finance.z - fz0);
assert(crossed.life && crossed.sec && crossed.meet, 'meeting agents entered through the door ' + JSON.stringify(crossed));
assert(finance.anim === 'sit' && financeDrift < 0.3, 'finance stayed seated, drift ' + financeDrift + ' anim ' + finance.anim);
assert(health.anim === 'walk' && travel > 2, 'health kept walking, travel ' + travel);
['life', 'sec', 'meet'].forEach(function (id) {
  var ag = sim.agents.filter(function (p) { return p.staffId === id; })[0];
  var inside = ag.x > layout.meeting.bounds.minX && Math.abs(ag.z) < 1.6;
  assert(ag.anim === 'meeting' && inside, id + ' seated in the room anim=' + ag.anim + ' x=' + ag.x.toFixed(2) + ' z=' + ag.z.toFixed(2));
});

var back = a.intents.map(function (it) {
  return { staffId: it.staffId, anim: 'sit', target: 'life.desk.' + it.staffId, meetingId: '' };
});
sim.setIntents(back);
for (var s2 = 0; s2 < 500; s2++) sim.step(0.05);
['life', 'sec', 'meet'].forEach(function (id) {
  var ag = sim.agents.filter(function (p) { return p.staffId === id; })[0];
  var desk = layout.waypoints['life.desk.' + id];
  var dd = Math.abs(ag.x - desk.x) + Math.abs(ag.z - desk.z);
  assert(ag.anim === 'sit' && dd < 0.35, id + ' returned to desk d=' + dd.toFixed(2) + ' anim=' + ag.anim);
});

if (fails) {
  console.error(fails + ' failed');
  process.exit(1);
}
console.log('life-sim tests passed');
