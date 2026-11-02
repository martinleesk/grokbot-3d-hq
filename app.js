(function () {
  'use strict';

  var ZONES = window.HQ_DATA.zones;
  var FEEDS = window.HQ_DATA.feedTemplates;
  var selectedZone = 'cmd';
  var selectedStaffId = null;
  var botMeshes = [];
  var zoneRoots = {};
  var mode = '3d';

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

  /* ---------- UI ---------- */
  function buildNav() {
    var nav = $('zoneNav');
    nav.innerHTML = '';
    ZONES.forEach(function (z) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zone-btn' + (z.id === selectedZone ? ' active' : '');
      btn.dataset.id = z.id;
      btn.innerHTML = '<span class="swatch" style="background:' + z.color + '"></span>' +
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
    av.style.background = 'linear-gradient(160deg,' + zone.color + ',#fff6)';
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

  /* ---------- 3D office ---------- */
  function highlight3D(zoneId, staffId) {
    botMeshes.forEach(function (b) {
      var activeZone = b.userData.zoneId === zoneId;
      var activeStaff = b.userData.staffId === staffId;
      var s = activeStaff ? 1.25 : (activeZone ? 1.08 : 1);
      b.scale.setScalar(s);
      if (b.userData.glow) b.userData.glow.visible = activeStaff || activeZone;
      if (b.userData.glow) b.userData.glow.material.opacity = activeStaff ? 0.55 : 0.25;
    });
    Object.keys(zoneRoots).forEach(function (id) {
      var g = zoneRoots[id];
      if (!g || !g.userData.matFloor) return;
      g.userData.matFloor.emissiveIntensity = id === zoneId ? 0.18 : 0.04;
    });
  }

  function makeBot(color, shape) {
    var group = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color), metalness: 0.15, roughness: 0.45,
      emissive: new THREE.Color(color), emissiveIntensity: 0.12
    });
    var body;
    if (shape === 'cylinder') body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.55, 18), mat);
    else if (shape === 'cone') body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.6, 16), mat);
    else if (shape === 'pyramid') body = new THREE.Mesh(new THREE.TetrahedronGeometry(0.38), mat);
    else if (shape === 'cross') {
      body = new THREE.Group();
      var a = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.18), mat);
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), mat);
      body.add(a); body.add(b);
    } else if (shape === 'rounded') {
      body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), mat);
    } else {
      body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), mat);
    }
    if (body.isMesh) body.castShadow = true;
    group.add(body);

    // eyes
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), eyeMat);
    var eyeR = eyeL.clone();
    eyeL.position.set(-0.1, 0.1, 0.26);
    eyeR.position.set(0.1, 0.1, 0.26);
    group.add(eyeL); group.add(eyeR);

    var glow = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.5, 24),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    glow.visible = false;
    group.add(glow);
    group.userData.glow = glow;
    group.position.y = 0.35;
    return group;
  }

  function makeDesk() {
    var g = new THREE.Group();
    var top = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xf4f7fb, metalness: 0.05, roughness: 0.55 })
    );
    top.position.y = 0.55;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    var legMat = new THREE.MeshStandardMaterial({ color: 0xd7dde8, metalness: 0.2, roughness: 0.4 });
    [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]].forEach(function (p) {
      var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), legMat);
      leg.position.set(p[0], 0.275, p[1]);
      g.add(leg);
    });
    // laptop
    var base = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.6, roughness: 0.3 })
    );
    base.position.set(0, 0.61, 0.05);
    g.add(base);
    var screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.28, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x11141a, emissive: 0x3a7bd5, emissiveIntensity: 0.35, metalness: 0.4, roughness: 0.35
      })
    );
    screen.position.set(0, 0.76, -0.08);
    screen.rotation.x = -0.2;
    g.add(screen);
    // stool
    var stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
    );
    stool.position.set(0, 0.3, 0.65);
    g.add(stool);
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xc9d0dc })
    );
    pole.position.set(0, 0.14, 0.65);
    g.add(pole);
    return g;
  }

  function makePlant() {
    var g = new THREE.Group();
    var pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.1, 0.16, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8edf5 })
    );
    pot.position.y = 0.08;
    g.add(pot);
    var leafMat = new THREE.MeshStandardMaterial({ color: 0x4fcf74, roughness: 0.6 });
    for (var i = 0; i < 5; i++) {
      var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), leafMat);
      var a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.1, 0.28 + (i % 2) * 0.06, Math.sin(a) * 0.1);
      leaf.scale.set(1, 0.7, 1);
      g.add(leaf);
    }
    return g;
  }

  function boot3D() {
    if (typeof THREE === 'undefined') throw new Error('Three.js 未載入');
    if (!THREE.OrbitControls) throw new Error('OrbitControls 未載入');

    var wrap = $('canvas-wrap');
    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8dee8);
    scene.fog = new THREE.Fog(0xd8dee8, 28, 55);

    // isometric-ish perspective
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 120);
    camera.position.set(16, 14, 16);

    var renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.75 : 2));
    renderer.setClearColor(0xd8dee8, 1);
    renderer.shadowMap.enabled = !isTouch;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    wrap.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 10;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * 0.42;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.target.set(0, 0.5, 0);
    controls.enablePan = true;
    if (THREE.TOUCH) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(10, 18, 8);
    sun.castShadow = !isTouch;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);
    var fill = new THREE.DirectionalLight(0xb7c7ff, 0.35);
    fill.position.set(-8, 6, -6);
    scene.add(fill);

    // room
    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe9eef5, roughness: 0.85, metalness: 0.05 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // window wall
    var wallMat = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.9 });
    var backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 6, 0.25), wallMat);
    backWall.position.set(0, 3, -10);
    scene.add(backWall);
    var sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6, 20), wallMat);
    sideWall.position.set(-14, 3, 0);
    scene.add(sideWall);

    // window panes
    var glassMat = new THREE.MeshStandardMaterial({
      color: 0xdfe7f5, transparent: true, opacity: 0.55, metalness: 0.3, roughness: 0.15,
      emissive: 0xffffff, emissiveIntensity: 0.08
    });
    for (var w = 0; w < 5; w++) {
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.6), glassMat);
      pane.position.set(-10 + w * 5, 2.8, -9.85);
      scene.add(pane);
      var frame = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, 3.8, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff })
      );
      frame.position.copy(pane.position);
      frame.position.z += 0.02;
      scene.add(frame);
    }

    // zone layout (2x3 open office wings)
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

      var rugMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color(zone.color),
        emissiveIntensity: 0.04,
        roughness: 0.9
      });
      var rug = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.04, 6.2), rugMat);
      rug.position.y = 0.02;
      rug.receiveShadow = true;
      rug.userData.isZone = true;
      rug.userData.zoneId = zone.id;
      root.add(rug);
      root.userData.matFloor = rugMat;

      // zone label sprite
      var label = makeLabel(zone.name, zone.color);
      label.position.set(0, 2.6, -2.6);
      root.add(label);

      // desks + bots
      var cols = 3;
      zone.staff.forEach(function (staff, idx) {
        var col = idx % cols;
        var row = Math.floor(idx / cols);
        if (row > 2) return; // visual cap; rest still in UI roster
        var desk = makeDesk();
        desk.position.set(-2.2 + col * 2.2, 0, -1.5 + row * 1.7);
        root.add(desk);

        var bot = makeBot(zone.color, zone.shape);
        bot.position.set(desk.position.x, 0.35, desk.position.z + 0.55);
        bot.userData.zoneId = zone.id;
        bot.userData.staffId = staff.id;
        bot.userData.isBot = true;
        // bob phase
        bot.userData.phase = Math.random() * Math.PI * 2;
        root.add(bot);
        botMeshes.push(bot);

        // floating task card above some bots
        if (idx % 3 === 0) {
          var card = makeMiniCard(staff.name);
          card.position.set(bot.position.x, 1.35, bot.position.z);
          root.add(card);
        }
      });

      // plants
      [[-3.1, -2.6], [3.1, -2.6], [3.1, 2.5], [-3.1, 2.5]].forEach(function (p, i) {
        if (i > zone.staff.length) return;
        var plant = makePlant();
        plant.position.set(p[0], 0, p[1]);
        root.add(plant);
      });

      // low partition
      var part = new THREE.Mesh(
        new THREE.BoxGeometry(7.0, 0.55, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 })
      );
      part.position.set(0, 0.3, 3.05);
      root.add(part);
      var stripe = new THREE.Mesh(
        new THREE.BoxGeometry(7.0, 0.08, 0.09),
        new THREE.MeshStandardMaterial({ color: zone.color, emissive: zone.color, emissiveIntensity: 0.35 })
      );
      stripe.position.set(0, 0.55, 3.05);
      root.add(stripe);

      office.add(root);
      zoneRoots[zone.id] = root;
    });

    // aisle lights
    for (var i = 0; i < 4; i++) {
      var pl = new THREE.PointLight(0xffffff, 0.25, 10);
      pl.position.set(-9 + i * 6, 4.5, 0);
      scene.add(pl);
    }

    function makeLabel(text, color) {
      var canvas = document.createElement('canvas');
      canvas.width = 512; canvas.height = 128;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = 'rgba(16,24,38,0.78)';
      roundRect(ctx, 20, 28, 472, 72, 20); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 4;
      roundRect(ctx, 20, 28, 472, 72, 20); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px "Noto Sans TC","PingFang TC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 66);
      var tex = new THREE.CanvasTexture(canvas);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      spr.scale.set(3.2, 0.8, 1);
      return spr;
    }

    function makeMiniCard(text) {
      var canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 96;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(16,24,38,0.82)';
      roundRect(ctx, 8, 16, 240, 64, 14); ctx.fill();
      ctx.fillStyle = '#d7e6ff';
      ctx.font = '24px "Noto Sans TC",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text.slice(0, 10), 128, 50);
      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0.92
      }));
      spr.scale.set(1.6, 0.6, 1);
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
      office.traverse(function (o) {
        if (o.isMesh && (o.userData.isZone || (o.parent && o.parent.userData && o.parent.userData.isBot))) objs.push(o);
        if (o.isMesh && o.parent && o.parent.userData && o.parent.userData.isBot) objs.push(o);
      });
      // also pick bots by checking bot group children
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
        b.position.y = 0.35 + Math.sin(t * 2 + b.userData.phase) * 0.04;
        b.rotation.y = Math.sin(t * 0.6 + b.userData.phase) * 0.15;
      });
      floating.forEach(function (s) {
        s.position.y = 1.35 + Math.sin(t * 1.5 + s.userData.phase) * 0.08;
      });
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
      // wipe previous canvas if any
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
      // If iOS paints white, bounce back quickly
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

  // HTTPS/HTTP (hosted): auto-start 3D so phones get real 3D. file:// keeps 2D-first.
  var hosted = location.protocol === 'https:' || location.protocol === 'http:';
  if (hosted) {
    if (!enable3D()) {
      enable2D(preferMobile2D() ? '手機／觸控平面後備' : '平面後備');
    }
  } else {
    enable2D(preferMobile2D() ? '本機檔案預設平面（上載後自動 3D）' : '本機檔案預設平面（可試 3D）');
  }
})();
