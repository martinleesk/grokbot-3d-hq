(function () {
  'use strict';

  var ZONES = window.HQ_DATA.zones;
  var FEEDS = window.HQ_DATA.feedTemplates;
  var selectedZone = 'cmd';
  var selectedStaffId = null;
  var botMeshes = [];
  var zoneRoots = {};
  var screenMats = [];
  var particles = null;
  var mode = '3d';
  var ceilingLights = [];

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

  function hexToInt(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
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
      btn.addEventListener('click', function () { selectZone(z.id); });
      nav.appendChild(btn);
    });
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
    $('detailZone').textContent = zone.name + ' · ' + zone.en;
    $('detailName').textContent = staff.name;
    $('detailDesc').textContent = staff.role + ' — ' + zone.desc;
    $('detailBadge').textContent = staff.status;
    $('detailBadge').className = 'badge ' + (staff.status.indexOf('待機') >= 0 || staff.status.indexOf('待命') >= 0 ? 'warn' : 'ok');

    var av = $('detailAvatar');
    av.style.background = 'linear-gradient(160deg,' + zone.color + ',#fff8)';
    av.textContent = staff.name.slice(0, 1);

    var metrics = $('detailMetrics');
    var load = 28 + Math.floor(Math.random() * 60);
    metrics.innerHTML =
      '<div class="metric"><div class="k">負載</div><div class="v">' + load + '%</div></div>' +
      '<div class="metric"><div class="k">今日任務</div><div class="v">' + (2 + Math.floor(Math.random() * 9)) + '</div></div>' +
      '<div class="metric"><div class="k">團隊人數</div><div class="v">' + zone.staff.length + '</div></div>' +
      '<div class="metric"><div class="k">延遲</div><div class="v">' + (40 + Math.floor(Math.random() * 180)) + 'ms</div></div>';

    var roster = $('roster');
    roster.innerHTML = '';
    zone.staff.forEach(function (s) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'roster-item' + (s.id === staff.id ? ' active' : '');
      row.innerHTML = '<span class="mini-bot" style="background:' + zone.color + '">' + s.name.slice(0, 1) + '</span>' +
        '<span><div class="rn">' + s.name + '</div><div class="rr">' + s.role + '</div></span>';
      row.addEventListener('click', function () { selectZone(zone.id, s.id); });
      roster.appendChild(row);
    });

    highlight3D(zone.id, staff.id);
    highlight2D(zone.id);
  }

  function selectZone(zoneId, staffId) {
    renderDetail(zoneId, staffId);
  }

  function pushFeed(item) {
    var feed = $('feed');
    var li = document.createElement('li');
    li.className = 'zone-' + item.zone;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var ss = String(now.getSeconds()).padStart(2, '0');
    li.innerHTML = '<span class="t">' + hh + ':' + mm + ':' + ss + '</span>' + item.text;
    feed.insertBefore(li, feed.firstChild);
    while (feed.children.length > 8) feed.removeChild(feed.lastChild);
  }

  function startFeed() {
    FEEDS.forEach(function (f, i) {
      setTimeout(function () { pushFeed(f); }, 200 + i * 180);
    });
    setInterval(function () {
      var f = FEEDS[Math.floor(Math.random() * FEEDS.length)];
      pushFeed(f);
      $('cntWait').textContent = String(1 + Math.floor(Math.random() * 5));
      $('cntDone').textContent = String(12 + Math.floor(Math.random() * 20));
      $('cntRoutine').textContent = String(4 + Math.floor(Math.random() * 8));
    }, 2800);
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
          return function (ev) { ev.stopPropagation(); selectZone(zoneId, staffId); };
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
      cell.addEventListener('click', function () { selectZone(z.id); });
      grid.appendChild(cell);
    });
    root.appendChild(grid);
  }

  function highlight2D(zoneId) {
    document.querySelectorAll('.fb-zone').forEach(function (el) {
      el.classList.toggle('active', el.dataset.id === zoneId);
    });
  }

  function enable2D(reason) {
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
      if (b.userData.accentLight) {
        b.userData.accentLight.intensity = activeStaff ? 0.55 : (activeZone ? 0.28 : 0.12);
      }
    });
    Object.keys(zoneRoots).forEach(function (id) {
      var g = zoneRoots[id];
      if (!g || !g.userData.matFloor) return;
      g.userData.matFloor.emissiveIntensity = id === zoneId ? 0.22 : 0.06;
      if (g.userData.zoneLight) g.userData.zoneLight.intensity = id === zoneId ? 0.55 : 0.22;
      if (g.userData.glassMats) {
        g.userData.glassMats.forEach(function (m) {
          m.opacity = id === zoneId ? 0.28 : 0.18;
          m.emissiveIntensity = id === zoneId ? 0.18 : 0.08;
        });
      }
    });
  }

  function makeCuteBot(color, shape) {
    var group = new THREE.Group();
    var c = new THREE.Color(color);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: c.clone().lerp(new THREE.Color(0xffffff), 0.12),
      metalness: 0.22, roughness: 0.38,
      emissive: c, emissiveIntensity: 0.1
    });
    var accentMat = new THREE.MeshStandardMaterial({
      color: c, metalness: 0.35, roughness: 0.32,
      emissive: c, emissiveIntensity: 0.35
    });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, metalness: 0.4, roughness: 0.45 });

    // body: capsule / stylized by zone shape accents
    var body;
    if (THREE.CapsuleGeometry) {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.28, 6, 12), bodyMat);
    } else {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.55, 14), bodyMat);
    }
    body.position.y = 0.38;
    body.castShadow = true;
    group.add(body);

    // head
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), bodyMat);
    head.position.y = 0.82;
    head.castShadow = true;
    group.add(head);

    // antenna
    var ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), darkMat);
    ant.position.y = 1.08;
    group.add(ant);
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), accentMat);
    tip.position.y = 1.18;
    group.add(tip);

    // zone-shape badge / accent on chest
    var badge;
    if (shape === 'cylinder') badge = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12), accentMat);
    else if (shape === 'cone') badge = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.1, 10), accentMat);
    else if (shape === 'pyramid') badge = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09), accentMat);
    else if (shape === 'cross') {
      badge = new THREE.Group();
      badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.04), accentMat));
      badge.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), accentMat));
    } else if (shape === 'rounded') badge = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), accentMat);
    else badge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.04), accentMat);
    if (badge.isMesh) badge.position.set(0, 0.42, 0.2);
    else badge.position.set(0, 0.42, 0.2);
    group.add(badge);

    // scarf / collar ring
    var collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.035, 8, 20),
      accentMat
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.62;
    group.add(collar);

    // eyes
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var pupilMat = new THREE.MeshBasicMaterial({ color: 0x101820 });
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), eyeMat);
    var eyeR = eyeL.clone();
    eyeL.position.set(-0.08, 0.84, 0.18);
    eyeR.position.set(0.08, 0.84, 0.18);
    group.add(eyeL); group.add(eyeR);
    var pL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), pupilMat);
    var pR = pL.clone();
    pL.position.set(-0.08, 0.84, 0.215);
    pR.position.set(0.08, 0.84, 0.215);
    group.add(pL); group.add(pR);

    // feet
    var footMat = new THREE.MeshStandardMaterial({ color: 0x121820, metalness: 0.3, roughness: 0.5 });
    var fL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), footMat);
    var fR = fL.clone();
    fL.scale.set(1.2, 0.55, 1.3); fR.scale.copy(fL.scale);
    fL.position.set(-0.1, 0.05, 0.02); fR.position.set(0.1, 0.05, 0.02);
    group.add(fL); group.add(fR);

    // selection glow ring
    var glow = new THREE.Mesh(
      new THREE.RingGeometry(0.32, 0.46, 32),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.03;
    glow.visible = false;
    group.add(glow);
    group.userData.glow = glow;

    // tiny accent point light (performance: only create for some; store stub otherwise)
    group.userData.accentLight = null;
    group.position.y = 0;
    group.userData.baseY = 0;
    return group;
  }

  function makeDesk(zoneColor) {
    var g = new THREE.Group();
    var wood = new THREE.MeshStandardMaterial({ color: 0xc9b59a, metalness: 0.08, roughness: 0.55 });
    var metal = new THREE.MeshStandardMaterial({ color: 0x2a3344, metalness: 0.65, roughness: 0.35 });
    var top = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.07, 0.72), wood);
    top.position.y = 0.58;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    // underglow strip
    var strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.02, 0.08),
      new THREE.MeshStandardMaterial({
        color: zoneColor, emissive: zoneColor, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4
      })
    );
    strip.position.set(0, 0.52, 0.3);
    g.add(strip);

    [[-0.68, -0.28], [0.68, -0.28], [-0.68, 0.28], [0.68, 0.28]].forEach(function (p) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.55, 8), metal);
      leg.position.set(p[0], 0.275, p[1]);
      g.add(leg);
    });

    // dual monitors
    function addMonitor(ox, glowCol) {
      var stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8), metal);
      stand.position.set(ox, 0.68, -0.12);
      g.add(stand);
      var bezel = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.03), metal);
      bezel.position.set(ox, 0.9, -0.14);
      bezel.rotation.x = -0.12;
      g.add(bezel);
      var screenMat = new THREE.MeshStandardMaterial({
        color: 0x0a1220, emissive: new THREE.Color(glowCol), emissiveIntensity: 0.55,
        metalness: 0.2, roughness: 0.25
      });
      screenMats.push(screenMat);
      var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), screenMat);
      screen.position.set(ox, 0.9, -0.125);
      screen.rotation.x = -0.12;
      g.add(screen);
    }
    addMonitor(-0.28, zoneColor);
    addMonitor(0.28, 0x4ea1ff);

    // keyboard + mouse
    var kb = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.14), metal);
    kb.position.set(-0.15, 0.63, 0.12);
    g.add(kb);
    var mouse = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.1), metal);
    mouse.position.set(0.28, 0.635, 0.14);
    g.add(mouse);

    // coffee mug
    var mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.08, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0f4fa, roughness: 0.4 })
    );
    mug.position.set(0.55, 0.66, 0.1);
    g.add(mug);
    var coffee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10),
      new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.8 })
    );
    coffee.position.set(0.55, 0.69, 0.1);
    g.add(coffee);

    // office chair
    var seat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.06, 14),
      new THREE.MeshStandardMaterial({ color: 0x1e2838, metalness: 0.2, roughness: 0.55 })
    );
    seat.position.set(0, 0.38, 0.72);
    seat.castShadow = true;
    g.add(seat);
    var back = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x243044, metalness: 0.15, roughness: 0.5 })
    );
    back.position.set(0, 0.62, 0.88);
    g.add(back);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.32, 8), metal);
    pole.position.set(0, 0.2, 0.72);
    g.add(pole);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), metal);
    base.position.set(0, 0.04, 0.72);
    g.add(base);

    // pendant lamp over desk
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), metal);
    cord.position.set(0, 2.0, 0);
    g.add(cord);
    var shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.16, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2e6c9, emissive: 0xffe0a0, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.6 })
    );
    shade.position.set(0, 1.72, 0);
    g.add(shade);
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffd080, emissiveIntensity: 0.9 })
    );
    bulb.position.set(0, 1.68, 0);
    g.add(bulb);

    return g;
  }

  function makePlant() {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.11, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8c3a5, roughness: 0.55, metalness: 0.05 })
    );
    pot.position.y = 0.09;
    pot.castShadow = true;
    g.add(pot);
    var soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 })
    );
    soil.position.y = 0.18;
    g.add(soil);
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x3dcf74, roughness: 0.55, metalness: 0.05 });
    for (var i = 0; i < 6; i++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), leafMat);
      var a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.09, 0.3 + (i % 3) * 0.07, Math.sin(a) * 0.09);
      leaf.scale.set(1, 0.75 + (i % 2) * 0.2, 1);
      g.add(leaf);
    }
    var top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), leafMat);
    top.position.y = 0.48;
    g.add(top);
    return g;
  }

  function makeShelf(zoneColor) {
    var g = new THREE.Group();
    var frame = new THREE.MeshStandardMaterial({ color: 0x2a3348, metalness: 0.25, roughness: 0.5 });
    var back = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 0.08), frame);
    back.position.set(0, 0.6, -0.1);
    g.add(back);
    for (var y = 0; y < 3; y++) {
      var board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.28), frame);
      board.position.set(0, 0.25 + y * 0.35, 0);
      g.add(board);
      for (var b = 0; b < 4; b++) {
        var book = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.22, 0.18),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL((b * 0.17 + y * 0.1) % 1, 0.55, 0.55),
            roughness: 0.7
          })
        );
        book.position.set(-0.4 + b * 0.22, 0.38 + y * 0.35, 0.02);
        g.add(book);
      }
    }
    var accent = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.04, 0.09),
      new THREE.MeshStandardMaterial({ color: zoneColor, emissive: zoneColor, emissiveIntensity: 0.4 })
    );
    accent.position.set(0, 1.18, -0.1);
    g.add(accent);
    return g;
  }

  function makeCoffeeStation() {
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
      new THREE.MeshStandardMaterial({ color: 0x3dffa8, emissive: 0x3dffa8, emissiveIntensity: 0.8 })
    );
    led.position.set(-0.3, 1.15, 0.18);
    g.add(led);
    var cooler = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.55, 14),
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
      emissive: new THREE.Color(color), emissiveIntensity: 0.08,
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
      new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.45 })
    );
    stripe.position.y = h * 0.55;
    g.add(stripe);
    g.userData.glassMat = glassMat;
    return g;
  }

  function makeFloorTileTexture() {
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#151c2a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(120,160,220,0.12)';
    ctx.lineWidth = 2;
    for (var i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(256, i * 32); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(180,210,255,0.03)';
    for (var x = 0; x < 8; x++) for (var y = 0; y < 8; y++) {
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

    botMeshes = [];
    zoneRoots = {};
    screenMats = [];
    ceilingLights = [];

    var wrap = $('canvas-wrap');
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b14);
    scene.fog = new THREE.FogExp2(0x070b14, 0.018);

    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 140);
    camera.position.set(17.5, 15.5, 17.5);

    var renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
    renderer.setClearColor(0x070b14, 1);
    renderer.shadowMap.enabled = !isTouch;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    // stop auto-rotate on user interaction
    controls.addEventListener('start', function () { controls.autoRotate = false; });

    // ---- cinematic lighting ----
    scene.add(new THREE.HemisphereLight(0x6a8cff, 0x1a1018, 0.45));
    var ambient = new THREE.AmbientLight(0x304060, 0.35);
    scene.add(ambient);

    var key = new THREE.DirectionalLight(0xffe2c4, 0.75);
    key.position.set(8, 16, 10);
    key.castShadow = !isTouch;
    if (!isTouch) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 50;
      key.shadow.camera.left = -20;
      key.shadow.camera.right = 20;
      key.shadow.camera.top = 20;
      key.shadow.camera.bottom = -20;
      key.shadow.bias = -0.0002;
    }
    scene.add(key);

    var fill = new THREE.DirectionalLight(0x6a9fff, 0.4);
    fill.position.set(-12, 8, -6);
    scene.add(fill);

    var rim = new THREE.DirectionalLight(0xff6b8a, 0.22);
    rim.position.set(0, 6, -14);
    scene.add(rim);

    // ---- HQ platform / plaza ----
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

    // reflective edge ring (Marvel plaza glow)
    var plazaRing = new THREE.Mesh(
      new THREE.RingGeometry(15.2, 15.8, 64),
      new THREE.MeshStandardMaterial({
        color: 0x4ea1ff, emissive: 0x4ea1ff, emissiveIntensity: 0.55,
        metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide
      })
    );
    plazaRing.rotation.x = -Math.PI / 2;
    plazaRing.position.y = 0.02;
    scene.add(plazaRing);

    // night city glow planes outside windows
    var cityGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 12),
      new THREE.MeshBasicMaterial({
        color: 0x1a2a48, transparent: true, opacity: 0.55, depthWrite: false
      })
    );
    cityGlow.position.set(0, 5, -14);
    scene.add(cityGlow);

    // window wall (glass HQ)
    var wallMat = new THREE.MeshStandardMaterial({ color: 0x121a2a, metalness: 0.45, roughness: 0.4 });
    var backWall = new THREE.Mesh(new THREE.BoxGeometry(30, 7, 0.3), wallMat);
    backWall.position.set(0, 3.4, -10.2);
    scene.add(backWall);
    var sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 22), wallMat);
    sideWall.position.set(-14.5, 3.4, 0);
    scene.add(sideWall);

    var glassMat = new THREE.MeshStandardMaterial({
      color: 0x8eb6ff, transparent: true, opacity: 0.22,
      metalness: 0.7, roughness: 0.1,
      emissive: 0x3a6aaa, emissiveIntensity: 0.2,
      side: THREE.DoubleSide
    });
    for (var w = 0; w < 6; w++) {
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.2), glassMat);
      pane.position.set(-11.5 + w * 4.5, 3.2, -10.0);
      scene.add(pane);
      // window mullion
      var mullion = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 4.4, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xd0d8e8, metalness: 0.5, roughness: 0.3 })
      );
      mullion.position.set(-9.25 + w * 4.5, 3.2, -10.0);
      scene.add(mullion);
      // warm interior bounce on glass
      var winLight = new THREE.PointLight(0xffd8a8, 0.15, 8);
      winLight.position.set(-11.5 + w * 4.5, 3.0, -8.5);
      scene.add(winLight);
    }

    // ceiling slab with recessed lights
    var ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(29, 0.15, 21),
      new THREE.MeshStandardMaterial({ color: 0x0e1522, metalness: 0.2, roughness: 0.8 })
    );
    ceiling.position.y = 5.6;
    scene.add(ceiling);

    for (var cx = -10; cx <= 10; cx += 5) {
      for (var cz = -6; cz <= 6; cz += 6) {
        var recess = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 0.06, 0.4),
          new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffe0a8, emissiveIntensity: 0.7 })
        );
        recess.position.set(cx, 5.48, cz);
        scene.add(recess);
        var pl = new THREE.PointLight(0xffe8c8, 0.28, 9);
        pl.position.set(cx, 5.2, cz);
        scene.add(pl);
        ceilingLights.push(pl);
      }
    }

    // HQ emblem floating above center
    var emblem = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.08, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0x6eb6ff, emissive: 0x4ea1ff, emissiveIntensity: 0.65, metalness: 0.7, roughness: 0.25 })
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 4.8, 0);
    scene.add(emblem);
    var emblemCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8ec5ff, emissiveIntensity: 0.8 })
    );
    emblemCore.position.copy(emblem.position);
    scene.add(emblemCore);

    // central coffee / lounge
    var lounge = makeCoffeeStation();
    lounge.position.set(0, 0, 0);
    scene.add(lounge);

    // soft dust particles
    (function makeParticles() {
      var count = isTouch ? 80 : 180;
      var geo = new THREE.BufferGeometry();
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 28;
        positions[i * 3 + 1] = Math.random() * 5.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.PointsMaterial({
        color: 0xb8d4ff, size: 0.035, transparent: true, opacity: 0.45,
        depthWrite: false, sizeAttenuation: true
      });
      particles = new THREE.Points(geo, mat);
      scene.add(particles);
    })();

    // zone layout
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

      // colored zone rug with soft emissive
      var rugMat = new THREE.MeshStandardMaterial({
        color: 0x1a2233,
        emissive: new THREE.Color(zone.color),
        emissiveIntensity: 0.06,
        roughness: 0.85, metalness: 0.05
      });
      var rug = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.05, 6.4), rugMat);
      rug.position.y = 0.03;
      rug.receiveShadow = true;
      rug.userData.isZone = true;
      rug.userData.zoneId = zone.id;
      root.add(rug);
      root.userData.matFloor = rugMat;

      // thin colored border
      var border = new THREE.Mesh(
        new THREE.BoxGeometry(7.5, 0.03, 6.5),
        new THREE.MeshStandardMaterial({
          color: zone.color, emissive: zone.color, emissiveIntensity: 0.25,
          metalness: 0.4, roughness: 0.4
        })
      );
      border.position.y = 0.01;
      root.add(border);
      // punch hole look: slightly smaller inner already via rug

      // zone light
      var zLight = new THREE.PointLight(zone.color, 0.22, 8);
      zLight.position.set(0, 3.2, 0);
      root.add(zLight);
      root.userData.zoneLight = zLight;

      // glass partitions (3 sides open toward center aisle feel)
      var gw1 = makeGlassWall(6.8, 1.6, zone.color);
      gw1.position.set(0, 0, 3.15);
      root.add(gw1);
      root.userData.glassMats.push(gw1.userData.glassMat);

      var gw2 = makeGlassWall(6.0, 1.6, zone.color);
      gw2.rotation.y = Math.PI / 2;
      gw2.position.set(3.55, 0, 0);
      root.add(gw2);
      root.userData.glassMats.push(gw2.userData.glassMat);

      // label
      var label = makeLabel(zone.name, zone.color);
      label.position.set(0, 2.85, -2.7);
      root.add(label);

      // shelf
      var shelf = makeShelf(zone.color);
      shelf.position.set(-2.8, 0, -2.5);
      root.add(shelf);

      // desks + bots
      var cols = 3;
      zone.staff.forEach(function (staff, idx) {
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        if (row > 2) return;
        var desk = makeDesk(zone.color);
        desk.position.set(-2.1 + col * 2.15, 0, -1.35 + row * 1.75);
        root.add(desk);

        var bot = makeCuteBot(zone.color, zone.shape);
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

      // plants
      [[-3.2, -2.7], [3.2, -2.7], [3.2, 2.6], [-3.2, 2.6]].forEach(function (p, i) {
        if (i > zone.staff.length) return;
        var plant = makePlant();
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
      // glassmorphism-ish
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

    // picking
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

    renderer.domElement.addEventListener('pointerdown', function (e) {
      downX = e.clientX; downY = e.clientY; moved = false;
    });
    renderer.domElement.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - downX) > 10 || Math.abs(e.clientY - downY) > 10) moved = true;
    });
    renderer.domElement.addEventListener('pointerup', function (e) {
      if (moved) return;
      setPointer(e);
      var hit = pick();
      if (hit) selectZone(hit.zoneId, hit.staffId);
    });

    function resize() {
      var w = wrap.clientWidth || window.innerWidth;
      var h = wrap.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });
    resize();

    var clock = new THREE.Clock();
    var floating = [];
    office.traverse(function (o) { if (o.userData && o.userData.float) floating.push(o); });

    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
      controls.update();
      botMeshes.forEach(function (b) {
        b.position.y = (b.userData.baseY || 0) + Math.sin(t * 2.1 + b.userData.phase) * 0.045;
        b.rotation.y = Math.sin(t * 0.55 + b.userData.phase) * 0.18;
      });
      floating.forEach(function (s) {
        s.position.y = 1.55 + Math.sin(t * 1.4 + s.userData.phase) * 0.09;
      });
      // screen flicker
      for (var i = 0; i < screenMats.length; i++) {
        screenMats[i].emissiveIntensity = 0.4 + 0.25 * Math.sin(t * 3.2 + i * 0.7) + 0.08 * Math.sin(t * 11 + i);
      }
      if (particles) {
        particles.rotation.y = t * 0.02;
        var pos = particles.geometry.attributes.position.array;
        for (var p = 1; p < pos.length; p += 3) {
          pos[p] += 0.002;
          if (pos[p] > 5.4) pos[p] = 0.2;
        }
        particles.geometry.attributes.position.needsUpdate = true;
      }
      emblem.rotation.z = t * 0.4;
      emblemCore.position.y = 4.8 + Math.sin(t * 1.5) * 0.06;
      renderer.render(scene, camera);
    }
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
      var wrap = $('canvas-wrap');
      while (wrap && wrap.firstChild) wrap.removeChild(wrap.firstChild);
      boot3D();
      document.body.classList.remove('mode-2d');
      document.body.classList.add('mode-3d');
      if (wrap) wrap.setAttribute('aria-hidden', 'false');
      $('bootError').hidden = true;
      var btn = $('btnTry3d');
      if (btn) {
        btn.textContent = '返回平面';
      }
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
  startFeed();

  var tryBtn = $('btnTry3d');
  if (tryBtn) {
    tryBtn.addEventListener('click', function () {
      if (mode === '3d') enable2D('手動返回平面');
      else enable3D();
    });
  }

  var hosted = location.protocol === 'https:' || location.protocol === 'http:';
  if (hosted) {
    if (!enable3D()) {
      enable2D(preferMobile2D() ? '手機／觸控平面後備' : '平面後備');
    }
  } else {
    enable2D(preferMobile2D() ? '本機檔案預設平面（上載後自動 3D）' : '本機檔案預設平面（可試 3D）');
  }
})();
