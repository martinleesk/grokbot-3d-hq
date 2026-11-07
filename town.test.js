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
  { id: '2800', name: '盈富', role: '港股 ETF', status: '監察中', zoneId: 'invest' },
  { id: 'qqq', name: 'QQQ', role: '納指 ETF', status: '監察中', zoneId: 'invest' },
  { id: 'voo', name: 'VOO', role: '標普 ETF', status: '監察中', zoneId: 'invest' },
  { id: 'orcl', name: 'ORCL', role: '個股', status: '更新中', zoneId: 'invest' },
  { id: 'sdiv', name: 'SDIV', role: '高息 ETF', status: '監察中', zoneId: 'invest' },
  { id: 'rsss', name: 'RSSS', role: '持倉', status: '待機', zoneId: 'invest' },
  { id: 'spacex', name: 'SpaceX', role: '另類', status: '研究中', zoneId: 'invest' },
  { id: 'dcf', name: '大成中國基金', role: '基金', status: '監察中', zoneId: 'invest' },
  { id: 'passive', name: '被動收入', role: '股息', status: '規劃中', zoneId: 'invest' },
  { id: 'retire', name: '退休大計', role: '退休', status: '規劃中', zoneId: 'invest' },
  { id: 'home', name: '買樓大計', role: '置業', status: '規劃中', zoneId: 'invest' },
  { id: 'invest-platform', name: '投資平台', role: '監控板', status: 'DEMO 監控中', zoneId: 'invest', center: true },
  { id: 'wealth', name: '財富狀況', role: '財富看板', status: 'Sheet DEMO', zoneId: 'invest', center: true },
  { id: 'analytics', name: '數據分析中心', role: '分析板', status: '分析板已交', zoneId: 'invest', center: true },
  { id: 'life', name: '生活管家', role: '日常', status: '運作中', zoneId: 'life' },
  { id: 'finance', name: '財務管家', role: '收支', status: '運作中', zoneId: 'life' },
  { id: 'health', name: '健康教練', role: '作息', status: '待命', zoneId: 'life' },
  { id: 'mind', name: '心理命理', role: '情緒', status: '待命', zoneId: 'life' },
  { id: 'learn', name: '學習夥伴', role: '學習', status: '學習中', zoneId: 'life' },
  { id: 'sec', name: '工作秘書', role: '日程', status: '運作中', zoneId: 'life' },
  { id: 'meet', name: '會議紀錄', role: '摘要', status: '待機', zoneId: 'life' },
  { id: 'travel', name: '旅遊規劃師', role: '行程', status: '規劃中', zoneId: 'travel' },
  { id: 'news', name: '新聞小編', role: '頭條', status: '掃描中', zoneId: 'content' },
  { id: 'social', name: '社交媒體小編', role: '貼文', status: '創作中', zoneId: 'content' },
  { id: 'sum', name: '摘要專員', role: '濃縮', status: '摘要中', zoneId: 'content' },
  { id: 'tr', name: '翻譯專員', role: '翻譯', status: '待命', zoneId: 'content' },
  { id: 'research', name: '研究專員', role: '蒐集', status: '研究中', zoneId: 'content' },
  { id: 'scout', name: '新資訊探索員', role: '趨勢', status: '探索中', zoneId: 'content' },
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
assert(got('rsss').anim === 'idle', 'rsss stays idle');
assert(got('rsss').place === 'yard' && got('rsss').homeId === 'analytics', 'rsss works the analytics yard');
assert(got('byd').place === 'yard' && got('byd').anim === 'sit' && got('byd').homeId === 'analytics', 'byd sits at the analytics yard');
assert(got('health').place === 'yard' && got('health').homeId === 'life', 'health waits at the life house');
assert(got('social').homeId === 'news' && got('research').homeId === 'lab', 'content specialists sit with news or the lab');
assert(got('meet').homeId === 'sec', 'meeting clerk stands with the secretary');
assert(Town.outdoorLabel(got('boss')).indexOf('今晚') >= 0, 'boss label names the focus: ' + Town.outdoorLabel(got('boss')));
assert(Town.outdoorLabel(got('sec')).indexOf('DOM') >= 0, 'secretary label names DOM');
assert(Town.outdoorLabel(got('health')) === '待命', 'idle label is 待命');
assert(Town.outdoorLabel(got('byd')) === '更新中', 'byd label uses status');
assert(Town.dutyText(got('boss')).indexOf('Tsz Kin') >= 0, 'duty line keeps the focus title');
assert(Town.hudLines(got('byd')).kicker.indexOf('數據分析') >= 0, 'yard hud names the workplace');
assert(am.attendees.length === 0, 'morning is not a meeting, attendees ' + am.attendees.join(','));
assert(!am.list.some(function (a) { return a.anim === 'walk'; }), 'morning does not invent walkers');
assert(got('analytics').place === 'analytics', 'analytics is the center building');
assert(got('analytics').headline.indexOf('分析板已交') >= 0, 'analytics headline uses its status');
assert(got('shared-db').headline.indexOf('Postgres') >= 0, 'database headline uses its status');
assert(got('lab').anim === 'sit', 'lab sits with its topic');
assert(Town.HOUSES.length >= 5 && Town.HOUSES.length <= 8, 'house wave is 5–8');
assert(Town.PUBLIC.length === 6, 'five facilities plus the hall');
var platform = Town.publicById('invest-platform');
var wealthHall = Town.publicById('wealth');
var advisorHouse = Town.houseByStaff('advisor');
assert(platform && platform.kind === 'center' && platform.label === '投資平台', 'platform is a civic center');
assert(platform.w > advisorHouse.w && platform.h > advisorHouse.h, 'platform is larger than the advisor house');
assert(wealthHall && wealthHall.kind === 'center' && wealthHall.label === '財富狀況', 'wealth is a civic center');
assert(wealthHall.w > advisorHouse.w && wealthHall.h > platform.h, 'wealth hall is a large facility');
assert(wealthHall.roof !== platform.roof, 'wealth roof is distinct from the invest platform');
assert(!Town.houseByStaff('wealth'), 'wealth is not an agent house');
assert(String(wealthHall.label).indexOf('屋') < 0, 'wealth label is not a house');
assert(got('wealth').place === 'wealth' && got('wealth').center, 'wealth attendant stands at the facility');
assert(Town.homeTitle('wealth') === '財富狀況', 'wealth keeps the facility name');
(function () {
  var boxes = Town.buildingBoxes().filter(function (b) { return b.id !== 'pond'; });
  for (var i = 0; i < boxes.length; i++) {
    for (var j = i + 1; j < boxes.length; j++) {
      var a = boxes[i];
      var b = boxes[j];
      var hit = a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
      assert(!hit, 'buildings overlap: ' + a.id + ' / ' + b.id);
    }
  }
  [[wealthHall.x - wealthHall.w / 2, wealthHall.z - wealthHall.d / 2],
    [wealthHall.x + wealthHall.w / 2, wealthHall.z - wealthHall.d / 2],
    [wealthHall.x - wealthHall.w / 2, wealthHall.z + wealthHall.d / 2],
    [wealthHall.x + wealthHall.w / 2, wealthHall.z + wealthHall.d / 2]].forEach(function (c) {
    assert(Math.sqrt(c[0] * c[0] + c[1] * c[1]) < 18.2, 'wealth stays on the lawn');
  });
})();
assert(advisorHouse && Town.homeTitle('advisor') === '顧問屋', 'advisor keeps a house, not 投資屋');
assert(Town.homeTitle('analytics') === '數據分析中心', 'analytics keeps the facility name');
assert(Town.homeTitle('shared-db') === '共用資料庫' && Town.homeTitle('lab') === '研創中心', 'other facilities keep their names');
assert(got('invest-platform').place === 'invest-platform' && got('invest-platform').center, 'platform staff stands at the facility');
assert(got('advisor').place === 'house', 'advisor still has a personal house');
Town.PUBLIC.forEach(function (b) {
  if (b.kind === 'center') assert(String(b.label).indexOf('屋') < 0, 'facility label is not a house: ' + b.label);
});

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

var posts = Town.postsFor(roster);
var postBy = {};
posts.forEach(function (p) { postBy[p.staffId] = p; });
function inLaneParking(p) {
  if (p.x >= 8.3 && p.z >= 1.6 && p.z <= 3.6) return true;
  if (p.x <= -9.5 && p.z >= 1.9 && p.z <= 6.5) return true;
  return false;
}
function insideBox(p, box, pad) {
  return p.x > box.minX - pad && p.x < box.maxX + pad && p.z > box.minZ - pad && p.z < box.maxZ + pad;
}
var boxes = Town.buildingBoxes().filter(function (b) { return b.id !== 'pond'; });
posts.forEach(function (p) {
  assert(!inLaneParking(p), p.staffId + ' is not parked in a lane');
  boxes.forEach(function (box) {
    assert(!insideBox(p, box, 0.12), p.staffId + ' stands clear of ' + box.id);
  });
});
for (var pi = 0; pi < posts.length; pi++) {
  for (var pj = pi + 1; pj < posts.length; pj++) {
    var dx = posts[pi].x - posts[pj].x;
    var dz = posts[pi].z - posts[pj].z;
    assert(Math.sqrt(dx * dx + dz * dz) >= 0.7, posts[pi].staffId + ' and ' + posts[pj].staffId + ' are not stacked');
  }
}
assert(postBy.byd.kind === 'yard' && postBy.byd.homeId === 'analytics', 'byd post is an analytics desk');
assert(postBy.health.x > Town.houseByStaff('life').x && postBy.health.x < 7, 'health stands in the life side yard, not 投資街');
assert(postBy.learn.x < 7.2 && postBy.social.x > -2, 'lane mouths are not the default desks');
assert(postBy.boss.kind === 'porch', 'boss keeps the porch');
assert(postBy.analytics.kind === 'center', 'analytics stands at the center');
assert(postBy['invest-platform'].kind === 'center', 'platform attendant stands at the facility');
assert(Math.abs(postBy.byd.x - Town.publicById('analytics').x) < 8, 'analytics desks stay near the center');
var overflow = Town.pinsFor(roster.concat([{ id: 'newbie', name: '新同事', zoneId: 'life', status: '待命' }]));
assert(overflow.length === 1 && overflow[0].staffId === 'newbie', 'only someone without a workplace becomes a pin');
assert(overflow[0].reason.indexOf('街口') >= 0, 'overflow pin says why it is in the lane');
assert(Town.pinsFor(roster).length === 0, 'the shipped roster has a workplace for everyone');

var still = Town.frameAt(roster, am, 0);
Object.keys(still.people).forEach(function (id) {
  var spot = still.people[id];
  var post = postBy[id];
  assert(Math.abs(spot.x - post.x) < 0.05 && Math.abs(spot.z - post.z) < 0.05, id + ' starts at the workplace');
  assert(!spot.bubble, id + ' is quiet at the start of a beat');
});
var talk = Town.frameAt(roster, am, 6);
var talking = Object.keys(talk.people).filter(function (id) { return talk.people[id].bubble; });
assert(talking.length === 2, 'one pair talks at a time, got ' + talking.join(','));
talking.forEach(function (id) {
  var act = am.byId[id];
  var bubble = talk.people[id].bubble;
  var grounded = [act.status, act.focusTitle, '待命', '開會', '外出', '短走'].some(function (bit) {
    return bit && bubble.indexOf(bit) >= 0;
  });
  assert(grounded, id + ' bubble quotes real work: ' + bubble);
});
var ax = talk.people[talking[0]];
var bx = talk.people[talking[1]];
var apart = Math.sqrt(Math.pow(ax.x - bx.x, 2) + Math.pow(ax.z - bx.z, 2));
assert(apart < 1.2 && apart > 0.4, 'the pair stands close enough to talk, apart ' + apart);
var walkers = Object.keys(talk.people).filter(function (id) { return talk.people[id].pose === 'walk'; });
assert(walkers.length === 0, 'they stand still while the bubbles are up');

var midWalk = Town.frameAt(roster, am, 2);
var moving = Object.keys(midWalk.people).filter(function (id) { return midWalk.people[id].pose === 'walk'; });
assert(moving.length === 2, 'the same pair walks to the meeting, got ' + moving.length);

var patrol = Town.frameAt(roster, am, 21);
var patrolBubbles = Object.keys(patrol.people).filter(function (id) { return patrol.people[id].bubble; });
assert(patrolBubbles.length === 1, 'one porch patrol speaks');
assert(patrol.people[patrolBubbles[0]].bubble.indexOf('投資台') >= 0, 'patrol quotes the advisor focus: ' + patrol.people[patrolBubbles[0]].bubble);

var errand = Town.frameAt(roster, am, 34);
var errandBubbles = Object.keys(errand.people).filter(function (id) { return errand.people[id].bubble; });
assert(errandBubbles.length === 1 && errand.people[errandBubbles[0]].bubble.indexOf('更新中') >= 0, 'desk errand quotes status');

var lane = Town.frameAt(roster, am, 74);
assert(lane.people.qqq && lane.people.qqq.x > 8, 'qqq visits 投資街 instead of living there');
assert(lane.people.qqq.bubble.indexOf('監察') >= 0, 'lane visit still names the work');
assert(lane.people.byd.x < 0, 'everyone else stays at work during the visit');

function buried(spot) {
  return boxes.some(function (box) { return insideBox(spot, box, 0.05); });
}
for (var sample = 0; sample <= 200; sample += 2) {
  var frame = Town.frameAt(roster, am, sample);
  var walkingNow = 0;
  Object.keys(frame.people).forEach(function (id) {
    var spot = frame.people[id];
    if (spot.pose === 'walk') walkingNow++;
    assert(!buried(spot), id + ' walks through a building at t=' + sample);
  });
  assert(walkingNow <= 2, 'at most a pair is walking at t=' + sample + ' (' + walkingNow + ')');
}

var noonLabel = Town.outdoorLabel(mid.byId.sec);
assert(noonLabel === '開會', 'noon label says 開會, got ' + noonLabel);
var gathered = Town.frameAt(roster, mid, 6);
assert(gathered.people.sec.pose === 'meeting', 'secretary gathers instead of chatting');
var hall = Town.publicById('hall');
assert(Math.abs(gathered.people.sec.z - (hall.z + hall.d / 2)) < 1.4, 'meeting stands in front of the hall');
assert(!gathered.people.sec.bubble, 'a live meeting is not also a sidewalk chat');

var sceneSrc = fs.readFileSync(path.join(__dirname, 'town-scene.js'), 'utf8');
assert(sceneSrc.indexOf('frameAt') >= 0, 'scene places the town from frameAt');
assert(sceneSrc.indexOf('outdoorLabel') >= 0, 'scene paints activity labels');
assert(sceneSrc.indexOf('bubble') >= 0, 'scene shows speech bubbles');
assert(sceneSrc.indexOf("place === 'pin'") >= 0, 'indoor stall still only marks a real overflow pin');
assert(sceneSrc.indexOf('enablePan = true') >= 0, 'pan stays enabled');
assert(sceneSrc.indexOf('enablePan = !isTouch') < 0, 'pan is not switched off on touch');
assert(sceneSrc.indexOf('THREE.TOUCH.DOLLY_PAN') >= 0, 'two-finger gesture pans and zooms');
assert(sceneSrc.indexOf('THREE.MOUSE.PAN') >= 0, 'right-drag pans');
assert(sceneSrc.indexOf('THREE.MOUSE.ROTATE') >= 0, 'left-drag still rotates');
assert(sceneSrc.indexOf('enableZoom = true') >= 0, 'zoom stays on');
var appSrc = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
var htmlSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var cssSrc = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
assert(htmlSrc.indexOf('data-collapse="townDuty"') >= 0, 'duty header collapses');
assert(htmlSrc.indexOf('data-collapse="focusPanel"') >= 0, 'focus header collapses');
assert(htmlSrc.indexOf('data-collapse="townCaption"') >= 0, 'indoor hud collapses');
assert(htmlSrc.indexOf('id="townDutyBody"') >= 0, 'duty body is separate from the header');
assert(appSrc.indexOf("data-collapse=\"townIndoor\"") >= 0, 'flat indoor card collapses');
assert(appSrc.indexOf('aria-expanded') >= 0, 'collapse buttons expose aria-expanded');
assert(appSrc.indexOf('hudDefaultOpen') >= 0, 'hud panels use the shared collapse helper');
assert(htmlSrc.indexOf('id="townBoardLink"') >= 0, 'invest monitor link stays on the indoor hud');
var menu = Town.placeMenu();
var houseLabels = menu.houses.map(function (h) { return h.label; });
['總管屋', '秘書屋', '財務屋', '生活屋', '顧問屋', '旅遊屋', '新聞屋', '稽核屋'].forEach(function (label) {
  assert(houseLabels.indexOf(label) >= 0, 'place menu house ' + label);
});
assert(menu.houses.length === Town.HOUSES.length, 'place menu lists every house');
menu.houses.forEach(function (h) {
  assert(h.kind === 'house' && /屋$/.test(h.label), 'house option is a house: ' + h.label);
});
assert(menu.facilities[0].id === 'invest-platform' && menu.facilities[0].label === '投資平台' && menu.facilities[0].kind !== 'house', 'platform stays a facility');
assert(menu.facilities[1].id === 'wealth' && menu.facilities[1].label === '財富狀況' && menu.facilities[1].label.indexOf('屋') < 0, 'wealth stays a facility');
['shared-db', 'analytics', 'lab', 'hall'].forEach(function (id) {
  assert(menu.facilities.some(function (f) { return f.id === id; }), 'facility option ' + id);
});
menu.facilities.forEach(function (f) {
  assert(f.kind !== 'house' && f.label.indexOf('屋') < 0, 'facility option is not a house: ' + f.label);
});
assert(htmlSrc.indexOf('id="placeSelect"') >= 0, 'place dropdown is on the town');
assert(htmlSrc.indexOf('class="floor-btn"') < 0 && htmlSrc.indexOf('floor-rail') < 0, 'location boxes are gone');
assert(cssSrc.indexOf('.place-pick') >= 0 && cssSrc.indexOf('.floor-rail') < 0, 'picker replaces the rail');
assert(cssSrc.split('.place-pick')[1].split('}')[0].indexOf('100vw') < 0, 'picker avoids viewport-width glow');
assert(appSrc.indexOf('placeMenu') >= 0 && appSrc.indexOf('hq3d_place') >= 0, 'dropdown reads the menu and remembers the last place');
var visit = appSrc.split('function visitPlace')[1].split('function buildPlaceSelect')[0];
assert(visit.indexOf('openHall') >= 0, 'hall option opens the hall');
assert(visit.indexOf('frameZone') >= 0 && visit.indexOf('openWealthBoard') >= 0, 'wealth option frames the hall and opens the board');
assert(visit.indexOf('openBoard === false') >= 0, 'a remembered wealth place does not auto-open a tab');
assert(visit.indexOf('selectZone') >= 0, 'other places reuse selectZone');
assert(appSrc.indexOf("onFrame") >= 0, 'overview clears the remembered place');

var board = Town.investBoard(live);
assert(board && board.url === 'https://martinleesk.github.io/grokbot-3d-hq/invest/', 'live invest board url');
assert(board.url.indexOf('cursor.com') < 0, 'live board is not Canvas');
assert(board.title === '個人投資台 · 投資平台', 'board title');
assert(board.label === '進入投資平台', 'board label');
assert(live.invest.mode === 'PAPER' && live.invest.halt === false, 'paper mode, not halted');
assert(live.invest.paper.label === 'SIMULATED', 'paper label says SIMULATED');
assert(Town.investPaperLabel(live.invest.paper) === 'SIMULATED', 'renderer label is SIMULATED');
assert(live.invest.morning.handover && live.invest.morning.handover.length < 40, 'morning handover stays short');
assert(Town.showsInvestBoard('advisor') && Town.showsInvestBoard('analytics') && Town.showsInvestBoard('invest-platform'), 'advisor, analytics, and the platform show the board');
assert(!Town.showsInvestBoard('boss') && !Town.showsInvestBoard('byd'), 'other rooms do not get the indoor board link');
assert(Town.investBoard({}) === null, 'missing invest hides the board');
assert(Town.investBoard({ invest: { dashboardUrl: 'http://example.com/x' } }) === null, 'http is not enough');
assert(Town.investBoard({ invest: { dashboardUrl: 'javascript:alert(1)' } }) === null, 'javascript urls are dropped');
assert(Town.investBoard({ invest: { dashboardUrl: 'invest/' } }).url === 'invest/', 'relative invest path is accepted');
var wealthBoard = Town.wealthBoard(live);
assert(wealthBoard && wealthBoard.url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'live wealth board url');
assert(wealthBoard.title === '個人財富狀況', 'wealth title');
assert(wealthBoard.label === '進入財富看板', 'wealth label');
assert(Town.showsWealthBoard('wealth') && !Town.showsWealthBoard('advisor') && !Town.showsWealthBoard('invest-platform'), 'only the wealth hall shows the wealth board');
assert(Town.wealthBoard({}).url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'wealth board defaults to the pages absolute url');
assert(Town.wealthBoard({ wealth: { dashboardUrl: 'javascript:alert(1)' } }).url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'bad wealth urls fall back');
assert(Town.wealthBoard({ wealth: { dashboardUrl: 'https://cursor.com/canvas/x' } }).url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'canvas wealth urls fall back to the pages board');
assert(Town.wealthBoard({ wealth: { dashboardUrl: 'https://martinleesk.github.io/grokbot-3d-hq/wealth/' } }).url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'https wealth path is accepted');
assert(Town.wealthBoard({ wealth: { dashboardUrl: 'wealth/' } }).url === 'wealth/', 'relative wealth path is accepted');
var canvasBoard = Town.investBoard({ invest: { dashboard: { url: 'https://cursor.com/canvas/x', title: '板' } } });
assert(canvasBoard.title === '板' && canvasBoard.url === 'https://martinleesk.github.io/grokbot-3d-hq/invest/', 'canvas urls fall back to the pages board');
var investHtml = fs.readFileSync(path.join(__dirname, 'invest/index.html'), 'utf8');
var investCss = fs.readFileSync(path.join(__dirname, 'invest/invest.css'), 'utf8');
var investJs = fs.readFileSync(path.join(__dirname, 'invest/invest.js'), 'utf8');
assert(/color-scheme:\s*only light/.test(investHtml) && /color-scheme:\s*only light/.test(investCss), 'invest page locks light');
assert(investHtml.indexOf('href="../"') >= 0 && investHtml.indexOf('返回小鎮') >= 0, 'invest page links back to the town');
assert(investHtml.indexOf('總覽') >= 0 && investHtml.indexOf('交易') >= 0 && investHtml.indexOf('全自動') >= 0 && investHtml.indexOf('持倉') >= 0 && investHtml.indexOf('研究風控') >= 0, 'invest tabs');
assert(investHtml.indexOf('真倉自動 OFF') >= 0 && investHtml.indexOf('唔構成投資建議') >= 0, 'demo disclaimer stays on the page');
assert(investHtml.indexOf('個人投資台 · 投資平台') >= 0 && investHtml.indexOf('監控板') < 0, 'invest chrome is 投資平台, not 監控板');
assert(investHtml.indexOf('id="heroValue"') >= 0 && investHtml.indexOf('id="heroSide"') >= 0, 'paper capital sits beside cash and invested');
assert(investHtml.indexOf('id="sheetRef"') >= 0, 'sheet NAV has a secondary line');
assert(investHtml.indexOf('100,000') < 0 && investJs.indexOf('US$100,000') < 0, 'page does not advertise the stale 100k book');
var subAssign = investJs.split("$('subline').textContent")[1].split(';')[0];
var warnAssign = investJs.split("$('warn').textContent")[1].split(';')[0];
var sheetAssign = investJs.split('sheetEl.textContent')[1].split(';')[0];
var heroFn = investJs.split('function renderHero')[1].split('function positionCards')[0];
assert(subAssign.indexOf('當日') < 0 && subAssign.indexOf('pct(') < 0 && subAssign.indexOf('nav_hkd') < 0, 'gray header drops day percent and sheet NAV');
assert(warnAssign.indexOf('真倉自動 OFF') >= 0 && warnAssign.indexOf('當日') >= 0 && warnAssign.indexOf('pct(') >= 0, 'pink strip keeps day percent once');
assert(investJs.indexOf('day_pnl_hkd') >= 0, 'sheet dollar delta is used when the snapshot has it');
assert(sheetAssign.indexOf('Sheet 參考') >= 0 && sheetAssign.indexOf('NAV') >= 0 && sheetAssign.indexOf('nav_hkd') >= 0 && sheetAssign.indexOf('當日') < 0 && sheetAssign.indexOf('pct(') < 0, 'sheet NAV stays a reference without day percent');
assert(heroFn.indexOf('現金') >= 0 && heroFn.indexOf('已投資') >= 0 && heroFn.indexOf('當日') < 0, 'cash and invested sit with capital; day percent stays off the hero');
assert(investJs.indexOf('starting_capital') >= 0 && investJs.indexOf('stub.equity') >= 0 && investJs.indexOf('invested_notional') >= 0 && investJs.indexOf('open_positions') >= 0, 'paper figures are read from stub.json');
assert(investJs.indexOf('STUB_EQUITY') < 0, 'risk base is not the stale 100k constant');
assert(investJs.indexOf('hqInvestPaperFills') >= 0 && investJs.indexOf("live_auto: 'OFF'") >= 0, 'local tickets stay paper');
assert(investCss.indexOf('100vw') < 0 && investCss.indexOf('100vmax') < 0, 'no viewport-width glow hack');
assert(/width:\s*100%/.test(investCss) && investCss.indexOf('prefers-reduced-motion') >= 0, 'full-width shell can calm motion');
assert(!/cursor\.com\/canvas|grok\/canvas/.test(investHtml + investCss + investJs), 'invest page does not load canvas');
assert(appSrc.indexOf('openWealthBoard') >= 0, 'town click opens the wealth board');
assert(sceneSrc.indexOf("opensWealth") >= 0, '3d wealth click does not enter the house');
assert(cssSrc.indexOf('clip-path: none') >= 0, 'facility roofs on the flat map are not house gables');
var snap = JSON.parse(fs.readFileSync(path.join(__dirname, 'invest/data/snapshot.json'), 'utf8'));
var book = JSON.parse(fs.readFileSync(path.join(__dirname, 'invest/data/ledger.json'), 'utf8'));
var stub = JSON.parse(fs.readFileSync(path.join(__dirname, 'invest/data/stub.json'), 'utf8'));
assert(snap.is_demo && book.is_demo && stub.is_demo, 'invest seed is demo');
assert(book.live_auto === 'OFF' && stub.leverage_on === false, 'seed keeps live auto and leverage off');
assert(snap.kind === 'MARKET_WATCHLIST_SNAPSHOT' && snap.symbols.length === 44 && snap.nav_hkd == null, 'snapshot is the market watchlist, not a sheet NAV');
assert(stub.starting_capital === 10000 && stub.equity === 10000 && stub.currency === 'USD', 'paper trial capital is US$10,000');
assert(stub.open_positions && Object.keys(stub.open_positions).length === 4, 'open paper positions');
assert(book.starting_capital === 10000 && book.orders.length === 4, 'ledger is the 10k paper book');
var sheet = JSON.parse(fs.readFileSync(path.join(__dirname, 'wealth/data/sheet-holdings.json'), 'utf8'));
assert(sheet.kind === 'SHEET_WATCHLIST_SNAPSHOT' && sheet.is_demo && sheet.symbols.length === 10 && sheet.nav_hkd === 16760.07, 'wealth page keeps the published sheet holdings');
var Wealth = require('./wealth/wealth.js');
var picked = Wealth.pickSheet(snap, sheet);
assert(picked.marketOnly && picked.book === sheet, 'market watchlist does not replace the sheet book');
var summed = Wealth.summarize(sheet);
assert(Math.abs(summed.invested - 16156.70748) < 0.02, 'invested value is nav times listed weight');
assert(summed.cashListed === false, 'sheet snapshot does not invent cash');
assert(summed.brokers.length === 5, 'five brokers in the sheet book');
assert(summed.positions[0].symbol === '02800.HK', 'largest holding stays 02800');
var bydHold = summed.positions.filter(function (p) { return p.symbol === '01211.HK'; })[0];
assert(bydHold && bydHold.kindLabel === '股票', '01211 is counted as a stock');
Wealth.UNLISTED.forEach(function (sleeve) {
  assert(sleeve.value == null && sleeve.amount == null, 'unlisted sleeve has no invented amount: ' + sleeve.name);
});
assert(Wealth.pickSheet(sheet, sheet).marketOnly === false, 'a real sheet snapshot is used directly');
var wealthHtml = fs.readFileSync(path.join(__dirname, 'wealth/index.html'), 'utf8');
var wealthCss = fs.readFileSync(path.join(__dirname, 'wealth/wealth.css'), 'utf8');
var wealthJs = fs.readFileSync(path.join(__dirname, 'wealth/wealth.js'), 'utf8');
assert(/color-scheme:\s*only light/.test(wealthHtml) && /color-scheme:\s*only light/.test(wealthCss), 'wealth page locks light');
assert(wealthHtml.indexOf('href="../"') >= 0 && wealthHtml.indexOf('返回小鎮') >= 0, 'wealth page links back to the town');
assert(wealthHtml.indexOf('個人財富狀況') >= 0 && wealthHtml.indexOf('投資平台') >= 0, 'wealth title and invest link');
assert(wealthHtml.indexOf('100vw') < 0 && wealthCss.indexOf('100vw') < 0 && wealthCss.indexOf('100vmax') < 0, 'wealth layout avoids viewport hacks');
assert(/prefers-reduced-motion/.test(wealthCss), 'wealth page respects reduced motion');
assert(wealthJs.indexOf('快照未列') >= 0 && wealthJs.indexOf('紙上 DEMO') >= 0, 'wealth copy separates sheet and paper');
assert(wealthHtml.indexOf('真實記帳（財務管家）') >= 0, 'cashflow is labeled as the steward book');
assert(wealthHtml.indexOf('https://martinleesk.github.io/grokbot-3d-hq/wealth/') >= 0, 'wealth page names the absolute board url');
assert(wealthHtml.indexOf('href="../invest/"') >= 0, 'wealth page still links to the invest platform');
assert(wealthJs.indexOf('未有真實流水') >= 0 && wealthJs.indexOf('data/cashflow.json') >= 0, 'cashflow empty state reads the steward file');
assert(wealthHtml.indexOf('id="cashGaps"') >= 0 && wealthJs.indexOf('cashGaps') >= 0, 'known gaps stay on the cashflow band');
assert(wealthJs.indexOf('轉帳唔計入淨額') >= 0, 'transfers stay out of net cashflow');
var flow = JSON.parse(fs.readFileSync(path.join(__dirname, 'wealth/data/cashflow.json'), 'utf8'));
assert(Object.keys(flow).sort().join(',') === ['accounts', 'asOf', 'currency', 'gaps', 'sheetId', 'source', 'transactions'].sort().join(','), 'cashflow keys match the steward schema');
assert(flow.currency === 'HKD' && flow.source === '個人收入與支出統計分析儀表板', 'cashflow source is the steward dashboard');
assert(flow.sheetId === '1zmO2KrjESXCkyVW2cNHiyMtIQHZe4-KVVlKO8ugT9xY', 'cashflow keeps the steward sheet id');
assert(flow.asOf === '2026-11-07T09:57:02+08:00', 'cashflow asOf is the steward export');
assert(Array.isArray(flow.accounts) && flow.accounts.length === 10, 'steward export lists 10 accounts');
assert(Array.isArray(flow.transactions) && flow.transactions.length === 330, 'steward export lists 330 transactions');
assert(flow.transactions.every(function (t) {
  return t && (t.type === 'income' || t.type === 'expense' || t.type === 'transfer') &&
    typeof t.amountHkd === 'number' && t.amountHkd > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date);
}), 'every shipped row is a positive dated income, expense, or transfer');
var dates = flow.transactions.map(function (t) { return t.date; }).sort();
assert(dates[0] === '2026-08-01' && dates[dates.length - 1] === '2026-11-01', 'shipped rows span the export dates');
assert(Array.isArray(flow.gaps) && flow.gaps.length > 0 && flow.gaps.every(function (g) { return typeof g === 'string' && g.length > 0; }), 'gaps stay on the export');
var shipped = Wealth.summarizeCashflow(flow, 'all');
assert(shipped.viewCount === 330 && shipped.skipped === 0 && shipped.accounts.length === 10, 'all shipped rows are counted');
assert(Math.abs((shipped.income - shipped.expense) - shipped.net) < 0.001, 'shipped net is income minus expense');
var cin = 0, cout = 0, cx = 0;
flow.transactions.forEach(function (t) {
  var c = Math.round(t.amountHkd * 100);
  if (t.type === 'income') cin += c;
  else if (t.type === 'expense') cout += c;
  else cx += c;
});
assert(Math.round(shipped.income * 100) === cin && Math.round(shipped.expense * 100) === cout && Math.round(shipped.transfer * 100) === cx, 'shipped totals match the export to the cent');
assert(shipped.transfer > 0 && shipped.categories.every(function (c) { return c.type !== 'transfer'; }), 'shipped transfers stay out of category net');
assert(shipped.months.join(',') === '2026-08,2026-09,2026-10,2026-11', 'shipped months');
var shippedHtml = Wealth.cashflowMarkup(shipped);
assert(shippedHtml.indexOf('未有真實流水') < 0 && shippedHtml.indexOf('HK$') >= 0 && shippedHtml.indexOf('NAV') < 0, 'shipped cashflow renders amounts and not NAV');
var emptyBook = { currency: 'HKD', accounts: [], transactions: [], gaps: [] };
var emptyFlow = Wealth.summarizeCashflow(emptyBook);
assert(emptyFlow.empty && emptyFlow.income == null && emptyFlow.net == null && emptyFlow.transfer == null, 'empty book does not become zero dollars');
var emptyHtml = Wealth.cashflowMarkup(emptyFlow);
assert(emptyHtml.indexOf('未有真實流水') >= 0 && emptyHtml.indexOf('HK$') < 0, 'empty cashflow markup has no dollar figures');
assert(emptyHtml.indexOf('NAV') < 0, 'cashflow markup is not a NAV');
var probe = {
  currency: 'HKD',
  source: '測試',
  accounts: [{ id: 'hsbc-test', label: '測試戶口', kind: 'bank' }],
  transactions: [
    { id: 'in', date: '2026-11-01', type: 'income', category: '薪金', description: '測試收入', accountId: 'hsbc-test', account: '測試戶口', amountHkd: 100, note: '只係測試' },
    { id: 'out', date: '2026-11-02', type: 'expense', category: '飲食', description: '測試支出', accountId: 'hsbc-test', account: '測試戶口', amountHkd: 40 },
    { id: 'move', date: '2026-11-03', type: 'transfer', category: '內部', description: '測試轉帳', accountId: 'hsbc-test', account: '測試戶口', amountHkd: 25 },
    { id: 'old', date: '2026-10-15', type: 'expense', category: '交通', description: '測試上月', accountId: 'hsbc-test', account: '測試戶口', amountHkd: 10 },
    { id: 'neg', date: '2026-11-04', type: 'expense', category: '壞', description: '負數', accountId: 'hsbc-test', account: '測試戶口', amountHkd: -5 },
    { id: 'fee', date: '2026-11-04', type: 'fee', category: '壞', description: '錯類型', accountId: 'hsbc-test', account: '測試戶口', amountHkd: 9 }
  ],
  gaps: ['缺結單']
};
var monthFlow = Wealth.summarizeCashflow(probe);
assert(monthFlow.period === '2026-11' && monthFlow.income === 100 && monthFlow.expense === 40 && monthFlow.transfer === 25 && monthFlow.net === 60, 'month net ignores transfers');
assert(monthFlow.skipped === 2, 'negative amounts and unknown types are dropped');
assert(monthFlow.categories.length === 2 && monthFlow.categories.every(function (c) { return c.type !== 'transfer'; }), 'categories skip transfers');
assert(monthFlow.accounts.length === 1 && monthFlow.accounts[0].net === 60 && monthFlow.accounts[0].transfer === 25, 'account net ignores transfers');
assert(monthFlow.recent[0].description === '測試轉帳', 'recent rows are newest first');
var allFlow = Wealth.summarizeCashflow(probe, 'all');
assert(allFlow.income === 100 && allFlow.expense === 50 && allFlow.net === 50 && allFlow.transfer === 25, 'all-period net still ignores transfers');
var probeHtml = Wealth.cashflowMarkup(monthFlow);
assert(probeHtml.indexOf('測試收入') >= 0 && probeHtml.indexOf('測試支出') >= 0 && probeHtml.indexOf('測試轉帳') >= 0, 'real rows render');
assert(probeHtml.indexOf('淨額 HK$60') >= 0 && probeHtml.indexOf('HK$25') >= 0, 'net and transfer are both visible');
assert(probeHtml.indexOf('HK$165') < 0 && probeHtml.indexOf('HK$125') < 0 && probeHtml.indexOf('HK$65') < 0, 'transfer is not folded into income, expense, or net');
assert(probeHtml.indexOf('只係測試') >= 0 && probeHtml.indexOf('銀行') >= 0, 'note and account kind render');
var nasty = Wealth.summarizeCashflow({
  currency: 'HKD',
  transactions: [{ id: 'n', date: '2026-11-01', type: 'income', category: '<b>', description: '<script>', accountId: 'a', account: 'A&B', amountHkd: 1 }]
});
var nastyHtml = Wealth.cashflowMarkup(nasty);
assert(nastyHtml.indexOf('<script>') < 0 && nastyHtml.indexOf('&lt;script&gt;') >= 0 && nastyHtml.indexOf('A&amp;B') >= 0, 'cashflow text is escaped');
var fxFlow = Wealth.summarizeCashflow({
  currency: 'USD',
  transactions: [{ id: 'z', date: '2026-11-01', type: 'income', category: 'x', description: 'hidden-usd', accountId: 'a', account: 'A', amountHkd: 5 }]
});
var fxHtml = Wealth.cashflowMarkup(fxFlow);
assert(fxFlow.blocked && fxFlow.income == null && fxHtml.indexOf('HK$') < 0 && fxHtml.indexOf('hidden-usd') < 0, 'non-HKD books are not summed');
var moveOnly = Wealth.summarizeCashflow({
  currency: 'HKD',
  transactions: [{ id: 't', date: '2026-11-01', type: 'transfer', category: '內部', description: '自己轉帳', accountId: 'a', account: '甲', amountHkd: 80 }]
});
assert(moveOnly.income === 0 && moveOnly.expense === 0 && moveOnly.net === 0 && moveOnly.transfer === 80 && moveOnly.categories.length === 0, 'transfer-only book has a zero net');
var directory = JSON.parse(fs.readFileSync(path.join(__dirname, 'directory.json'), 'utf8'));
var wealthPage = directory.pages.filter(function (p) { return p.canvas_id === 'wealth-board'; })[0];
assert(wealthPage && wealthPage.url === 'https://martinleesk.github.io/grokbot-3d-hq/wealth/', 'directory uses the absolute wealth board url');

require('./town-scene.js');
assert(typeof global.HQTownView.boot === 'function', 'town scene still boots');

if (fails) {
  console.error(fails + ' failed');
  process.exit(1);
}
console.log('town tests passed');
