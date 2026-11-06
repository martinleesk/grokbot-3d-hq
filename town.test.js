/* node town.test.js */
var fs = require('fs');
var path = require('path');
var Town = require('./town.js');

var fails = 0;
function assert(cond, msg) {
  if (!cond) {
    fails++;
    console.error('FAIL', msg);
  }
}

var roster = [
  { id: 'boss', name: 'Boss Bot', role: '總管', status: '指揮中', zoneId: 'cmd' },
  { id: 'advisor', name: '投資顧問', role: '組合', status: '監察中', zoneId: 'invest' },
  { id: 'byd', name: '比亞迪', role: '個股', status: '更新中', zoneId: 'invest' },
  { id: 'rsss', name: 'RSSS', role: '持倉', status: '待機', zoneId: 'invest' },
  { id: 'analytics', name: '數據分析中心', role: '分析板', status: '分析板已交', zoneId: 'invest', center: true },
  { id: 'life', name: '生活管家', role: '日常', status: '運作中', zoneId: 'life' },
  { id: 'finance', name: '財務管家', role: '收支', status: '運作中', zoneId: 'life' },
  { id: 'health', name: '健康教練', role: '作息', status: '待命', zoneId: 'life' },
  { id: 'mind', name: '心理命理', role: '情緒', status: '待命', zoneId: 'life' },
  { id: 'sec', name: '工作秘書', role: '日程', status: '運作中', zoneId: 'life' },
  { id: 'meet', name: '會議紀錄', role: '摘要', status: '待機', zoneId: 'life' },
  { id: 'travel', name: '旅遊規劃師', role: '行程', status: '規劃中', zoneId: 'travel' },
  { id: 'news', name: '新聞小編', role: '頭條', status: '掃描中', zoneId: 'content' },
  { id: 'lab', name: '研創中心', role: '原型', status: '研創待原型題目', zoneId: 'content', center: true },
  { id: 'auditor', name: 'System Auditor', role: '稽核', status: '稽核中', zoneId: 'sys' },
  { id: 'shared-db', name: '共用資料庫', role: 'Postgres', status: 'Postgres 就緒', zoneId: 'sys', center: true }
];

var live = JSON.parse(fs.readFileSync(path.join(__dirname, 'live.json'), 'utf8'));
assert(!live.town, 'shipped live.json stays free of a required town block');
assert(!live.agents, 'shipped live.json stays free of a required agents block');

var morning = Date.parse('2026-11-06T00:10:00Z');
var am = Town.infer(live, roster, morning);
function got(id) { return am.byId[id]; }

assert(got('boss').anim === 'sit', 'morning boss sits, got ' + got('boss').anim);
assert(got('boss').headline.indexOf('今晚 Tsz Kin') >= 0, 'boss desk shows Tsz Kin: ' + got('boss').headline);
assert(got('boss').place === 'house', 'boss has a house');
assert(got('sec').anim === 'sit', 'morning secretary sits, got ' + got('sec').anim);
assert(got('sec').headline.indexOf('DOM') >= 0, 'secretary desk shows DOM: ' + got('sec').headline);
assert(got('finance').headline.indexOf('HSBC') >= 0, 'finance shows statement: ' + got('finance').headline);
assert(got('travel').headline.indexOf('成都') >= 0, 'travel shows Chengdu: ' + got('travel').headline);
assert(got('advisor').headline.indexOf('投資台') >= 0, 'advisor inherits invest focus: ' + got('advisor').headline);
assert(got('health').anim === 'idle' && !got('health').away, 'health stays idle, got ' + got('health').anim);
assert(got('mind').anim === 'idle', 'mind stays idle');
assert(got('meet').anim === 'idle', 'meet clerk stays idle');
assert(got('rsss').anim === 'idle', 'rsss pin stays idle');
assert(got('rsss').place === 'pin', 'rsss is a pin');
assert(got('byd').place === 'pin' && got('byd').anim === 'sit', 'byd pin sits on its own status');
assert(am.attendees.length === 0, 'morning is not a meeting, attendees ' + am.attendees.join(','));
assert(!am.list.some(function (a) { return a.anim === 'walk'; }), 'morning does not invent walkers');
assert(got('analytics').place === 'analytics', 'analytics is the center building');
assert(got('analytics').headline.indexOf('分析板已交') >= 0, 'analytics headline uses its status');
assert(got('shared-db').headline.indexOf('Postgres') >= 0, 'database headline uses its status');
assert(got('lab').anim === 'sit', 'lab sits with its topic');
assert(Town.HOUSES.length >= 5 && Town.HOUSES.length <= 8, 'house wave is 5–8');
assert(Town.PUBLIC.length === 4, 'three centers plus the hall');

var noon = Date.parse('2026-11-06T04:00:00Z');
var mid = Town.infer(live, roster, noon);
assert(mid.byId.sec.anim === 'meeting', 'noon secretary is in the DOM block, got ' + mid.byId.sec.anim);
assert(mid.byId.sec.place === 'hall', 'noon secretary is at the hall');
assert(mid.byId.sec.headline.indexOf('DOM') >= 0, 'hall caption names DOM: ' + mid.byId.sec.headline);
assert(mid.byId.sec.source === 'schedule', 'meeting comes from the calendar');
assert(mid.byId.boss.anim === 'sit', 'noon boss is not pulled into DOM');
assert(mid.byId.health.anim === 'idle', 'noon health is still idle');
assert(mid.byId.life.anim !== 'meeting', 'life house is not auto-sent to every work block');

var night = Date.parse('2026-11-06T12:00:00Z');
var pm = Town.infer(live, roster, night);
assert(pm.byId.boss.anim === 'idle' && pm.byId.boss.away, 'evening boss is out for Tsz Kin');
assert(pm.byId.boss.headline.indexOf('外出') >= 0, 'evening caption says out: ' + pm.byId.boss.headline);
assert(pm.byId.boss.anim !== 'meeting', 'private plans are not an office meeting');
assert(pm.byId.sec.anim !== 'meeting', 'evening secretary is not stuck in the morning meeting');

var over = JSON.parse(JSON.stringify(live));
over.agents = { health: { anim: 'walk', note: '沿屋前小路短走：取水' } };
var walked = Town.infer(over, roster, morning);
assert(walked.byId.health.anim === 'walk', 'live.agents can ask for a short walk');
assert(walked.byId.health.headline.indexOf('取水') >= 0, 'note replaces the caption');
assert(walked.byId.mind.anim === 'idle', 'override does not push the next idle agent to walk');

over.agents = { boss: { anim: 'sit' } };
over.campus = { meetings: [{ id: 'stand', title: '晨會', targetFloor: 'cmd', staffIds: ['boss', 'sec'] }] };
var stood = Town.infer(over, roster, morning);
assert(stood.byId.sec.anim === 'meeting' && stood.byId.sec.meetingTitle === '晨會', 'standing campus meeting seats sec');
assert(stood.byId.boss.anim === 'sit', 'live.agents sit overrides the standing meeting');

var stale = JSON.parse(JSON.stringify(live));
stale.campus = { meetings: [{ title: '舊會', targetFloor: 'life', staffIds: ['finance'], when: '1/1 09:00' }] };
var old = Town.infer(stale, roster, morning);
assert(old.byId.finance.anim !== 'meeting', 'a January meeting does not survive into November');

var townMeet = JSON.parse(JSON.stringify(live));
townMeet.town = { meetings: [{ id: 'pm', title: '公所例會', staffIds: ['auditor', 'advisor'], when: '11/6 08:00' }] };
var civic = Town.infer(townMeet, roster, morning);
assert(civic.byId.auditor.anim === 'meeting', 'town.meetings within the window seats auditor');
assert(civic.byId.advisor.place === 'hall', 'advisor goes to the hall');
assert(civic.byId.auditor.source === 'live.town', 'source records the town extension');

var board = Town.hallBoard(live, am);
assert(board.headline.indexOf('沒有進行中') >= 0, 'empty hall tells the truth');
var lines = Town.hudLines(got('boss'));
assert(lines.doing === got('boss').headline && lines.status.indexOf('指揮中') >= 0, 'hud repeats the pose and the status');
assert(Town.porchOf(Town.houseByStaff('boss')).z > Town.houseByStaff('boss').z, 'north porch faces the street');
assert(Town.pinsFor(roster).length >= 4, 'unhoused agents become pins');

if (fails) {
  console.error(fails + ' failed');
  process.exit(1);
}
console.log('town tests passed');
