/* node campus.test.js */
var fs = require('fs');
var path = require('path');
var Life = require('./life-sim.js');
var Campus = require('./campus.js');
var lifeLayout = JSON.parse(fs.readFileSync(path.join(__dirname, 'floors/life.layout.json'), 'utf8'));

var fails = 0;
function assert(cond, msg) {
  if (!cond) {
    fails++;
    console.error('FAIL', msg);
  }
}

var cmd = Campus.layoutFor('cmd', ['boss']);
var invest = Campus.layoutFor('invest', ['advisor', 'byd', '2800']);
assert(cmd.desks.length === 1, 'boss has a desk');
assert(cmd.meeting && cmd.meeting.seats.length >= 4, 'meeting room seats');
assert(cmd.waypoints['cmd.desk.boss'], 'desk waypoint');
assert(cmd.waypoints['cmd.lift'], 'lift waypoint');
assert(invest.desks.length === 3, 'three invest desks');
var intents = Campus.simpleIntents([{ id: 'boss' }, { id: 'advisor' }], cmd);
assert(intents[0].anim === 'walk', 'first agent walks');
assert(intents[1].anim === 'sit' || intents[1].anim === 'idle', 'second agent stays put');

var meetings = Campus.activeMeetings({
  updated: '2026-11-05',
  campus: { meetings: [
    { id: 'a', targetFloor: 'cmd', staffIds: ['life', 'boss'], when: '11/5 09:00' },
    { id: 'old', targetFloor: 'life', staffIds: ['x'], when: '1/1 09:00' },
    { targetFloor: 'travel', staffIds: [] }
  ] }
}, Date.parse('2026-11-05T01:00:00Z'));
assert(meetings.length === 1 && meetings[0].id === 'a', 'only the in-window meeting, got ' + meetings.length);
assert(Campus.activeMeetings({ campus: { meetings: [{ targetFloor: 'cmd', staffIds: ['boss'] }] } }).length === 1, 'standing meeting');

var lifeStaff = [
  { id: 'life' }, { id: 'finance' }, { id: 'health' }, { id: 'mind' },
  { id: 'learn' }, { id: 'sec' }, { id: 'meet' }
];
var live = JSON.parse(fs.readFileSync(path.join(__dirname, 'live.json'), 'utf8'));
var inferred = Life.inferLifeRoster(live, lifeStaff.map(function (s) {
  return { id: s.id, name: s.id, status: '運作中' };
}), lifeLayout, Date.parse('2026-11-05T00:01:00Z'));
var lifeSim = Life.createSim(lifeLayout, inferred.intents);
var held = lifeSim.agents[0];
var hx = held.x, hz = held.z;
held.hold = true;
for (var h = 0; h < 30; h++) lifeSim.step(0.05);
assert(held.x === hx && held.z === hz, 'hold freezes an agent');
held.hold = false;
lifeSim.repath(held.staffId);

var floors = [
  { id: 'cmd', layout: cmd, staff: [{ id: 'boss' }] },
  { id: 'invest', layout: invest, staff: [{ id: 'advisor' }, { id: 'byd' }, { id: '2800' }] },
  { id: 'life', layout: lifeLayout, staff: lifeStaff, sim: lifeSim },
  { id: 'travel', layout: Campus.layoutFor('travel', ['travel']), staff: [{ id: 'travel' }] }
];
var levelY = { cmd: 12, invest: 9, life: 6, travel: 3 };
var director = Campus.createDirector({
  Life: Life,
  floors: floors,
  levelY: levelY,
  bridgeY: 3,
  firstDelay: 0.2,
  getLive: function () {
    return { campus: { meetings: [{ id: 'cross', targetFloor: 'cmd', staffIds: ['life', 'advisor'] }] } };
  }
});
var sawOther = false;
var sawRide = false;
for (var s = 0; s < 280; s++) {
  director.step(0.05);
  director.poses().forEach(function (p) {
    if (p.staffId === 'life' && p.floorId === 'cmd') sawOther = true;
    if (p.riding && (p.staffId === 'life' || p.staffId === 'advisor')) sawRide = true;
  });
}
assert(sawRide, 'elevator ride happened');
assert(sawOther, 'life agent reached command floor');
var onBridge = false;
for (var s2 = 0; s2 < 700; s2++) {
  director.step(0.05);
  director.poses().forEach(function (p) {
    if (p.riding && p.x > 8) onBridge = true;
  });
}
assert(onBridge, 'an agent walked the skybridge');

if (fails) {
  console.error(fails + ' failed');
  process.exit(1);
}
console.log('campus tests passed');
