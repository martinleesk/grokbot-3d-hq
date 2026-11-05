/* Shared office fit-out: desks, glass room, lamps, plants, art, lift door.
   Geometries are created once per page. */
(function (root) {
  var LIFT = { x: -4.12, z: 0.02 };

  function pack(THREE) {
    return {
      desk: new THREE.BoxGeometry(1.02, 0.045, 0.48),
      lip: new THREE.BoxGeometry(1.02, 0.012, 0.02),
      leg: new THREE.CylinderGeometry(0.022, 0.026, 0.48, 5),
      seat: new THREE.BoxGeometry(0.34, 0.04, 0.34),
      back: new THREE.BoxGeometry(0.34, 0.3, 0.04),
      pole: new THREE.CylinderGeometry(0.025, 0.028, 0.34, 6),
      table: new THREE.BoxGeometry(1, 1, 1),
      lampPole: new THREE.CylinderGeometry(0.03, 0.035, 1.15, 6),
      lampHead: new THREE.SphereGeometry(0.09, 10, 8),
      frame: new THREE.BoxGeometry(1, 1, 1),
      leaf: new THREE.BoxGeometry(1.7, 1.15, 0.06)
    };
  }

  function kit(shared, THREE) {
    if (shared.officeKit) return shared.officeKit;
    var g = pack(THREE);
    var green = new THREE.MeshStandardMaterial({
      color: 0x3E9A48, roughness: 0.66, metalness: 0.02,
      emissive: 0x4AAA50, emissiveIntensity: 0.18
    });
    var glass = new THREE.MeshStandardMaterial({
      color: 0xE4F2FA, transparent: true, opacity: 0.22,
      roughness: 0.12, metalness: 0.06,
      emissive: 0xE8F6FF, emissiveIntensity: 0.05,
      side: THREE.DoubleSide, depthWrite: false
    });
    var door = new THREE.MeshStandardMaterial({
      color: 0xF0D4B0, transparent: true, opacity: 0.46,
      roughness: 0.18, metalness: 0.1,
      emissive: 0xF0C888, emissiveIntensity: 0.1,
      side: THREE.DoubleSide
    });
    shared.officeKit = { g: g, green: green, glass: glass, door: door, arts: {} };
    return shared.officeKit;
  }

  function addDesk(THREE, kit, mats, staffId, x, z, yaw, surface) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.rotation.y = yaw || 0;
    var top = new THREE.Mesh(kit.g.desk, mats.wood);
    top.position.y = 0.5;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    var lip = new THREE.Mesh(kit.g.lip, mats.mullion);
    lip.position.set(0, 0.528, 0.23);
    g.add(lip);
    [[-0.42, -0.16], [0.42, -0.16], [-0.42, 0.16], [0.42, 0.16]].forEach(function (p) {
      var leg = new THREE.Mesh(kit.g.leg, mats.metal);
      leg.position.set(p[0], 0.24, p[1]);
      g.add(leg);
    });
    g.userData.staffId = staffId;
    return g;
  }

  function addChair(THREE, kit, mats, x, z, yaw, surface) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    g.rotation.y = yaw || 0;
    var seat = new THREE.Mesh(kit.g.seat, mats.seat);
    seat.position.y = 0.36;
    g.add(seat);
    var back = new THREE.Mesh(kit.g.back, mats.chairBack);
    back.position.set(0, 0.54, -0.15);
    g.add(back);
    var pole = new THREE.Mesh(kit.g.pole, mats.metal);
    pole.position.y = 0.16;
    g.add(pole);
    return g;
  }

  function addLamp(THREE, kit, mats, x, z, surface) {
    var g = new THREE.Group();
    g.position.set(x, surface, z);
    var pole = new THREE.Mesh(kit.g.lampPole, mats.mullion);
    pole.position.y = 0.58;
    g.add(pole);
    var head = new THREE.Mesh(kit.g.lampHead, mats.bulb);
    head.position.y = 1.2;
    g.add(head);
    return g;
  }

  function artTexture(THREE, kit, zone) {
    var key = zone.id;
    if (kit.arts[key]) return kit.arts[key];
    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#F6EFE4';
    ctx.fillRect(0, 0, 256, 160);
    ctx.fillStyle = zone.color || '#C4A36A';
    ctx.fillRect(0, 0, 256, 10);
    ctx.fillRect(0, 150, 256, 10);
    ctx.fillStyle = '#5A9A68';
    ctx.fillRect(28, 36, 70, 88);
    ctx.fillStyle = '#E8B888';
    ctx.fillRect(112, 48, 110, 64);
    ctx.fillStyle = '#3A322C';
    ctx.font = '500 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(zone.short || zone.id, 128, 132);
    var tex = new THREE.CanvasTexture(canvas);
    if (tex.colorSpace !== undefined && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    kit.arts[key] = tex;
    return tex;
  }

  function addArt(THREE, kit, mats, zone, spec, surface) {
    var g = new THREE.Group();
    g.position.set(spec.x, surface + 0.95, spec.z);
    g.rotation.y = spec.yaw || 0;
    var frame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.78, 0.04), mats.mullion);
    g.add(frame);
    var plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 0.64),
      new THREE.MeshBasicMaterial({ map: artTexture(THREE, kit, zone) })
    );
    plane.position.z = 0.03;
    g.add(plane);
    return g;
  }

  function addGreen(THREE, kit, spec, surface) {
    var mesh = new THREE.Mesh(kit.g.leaf, kit.green);
    mesh.position.set(spec.x, surface + 0.85, spec.z);
    mesh.rotation.y = spec.yaw || 0;
    return mesh;
  }

  function addLiftDoor(THREE, kit, mats, surface) {
    var g = new THREE.Group();
    g.position.set(LIFT.x, surface + 0.62, LIFT.z);
    var postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), mats.mullion);
    postL.position.set(0.32, 0, -0.38);
    var postR = postL.clone();
    postR.position.z = 0.38;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.82), mats.mullion);
    head.position.set(0.32, 0.58, 0);
    g.add(postL);
    g.add(postR);
    g.add(head);
    var left = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.05, 0.28), kit.door);
    left.position.set(0.34, 0, -0.14);
    var right = left.clone();
    right.position.z = 0.14;
    g.add(left);
    g.add(right);
    g.userData.left = left;
    g.userData.right = right;
    return g;
  }

  function addMeeting(THREE, kit, mats, layout, surface, makeGlass) {
    var meet = layout.meeting;
    if (!meet) return;
    (meet.walls || []).forEach(function (w) {
      var wall;
      if (makeGlass) wall = makeGlass(w.w, w.h || 1.05);
      else {
        wall = new THREE.Group();
        var pane = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h || 1.05), kit.glass);
        pane.position.y = (w.h || 1.05) / 2;
        wall.add(pane);
        var top = new THREE.Mesh(new THREE.BoxGeometry(w.w, 0.04, 0.04), mats.mullion);
        top.position.y = w.h || 1.05;
        wall.add(top);
      }
      wall.position.set(w.x, surface, w.z);
      wall.rotation.y = w.rot || 0;
      layout._root.add(wall);
    });
    var frame = meet.doorFrame;
    if (frame) {
      var h = frame.h || 1.05;
      [-1, 1].forEach(function (side) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.06), mats.mullion);
        post.position.set(frame.x, surface + h / 2, frame.z + side * (frame.gap || 0.9) / 2);
        layout._root.add(post);
      });
      var header = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, (frame.gap || 0.9) + 0.08), mats.mullion);
      header.position.set(frame.x, surface + h - 0.03, frame.z);
      layout._root.add(header);
    }
    if (meet.table) {
      var t = meet.table;
      var top = new THREE.Mesh(new THREE.BoxGeometry(t.w, 0.045, t.d), mats.wood);
      top.position.set(t.x, surface + 0.5, t.z);
      top.castShadow = true;
      top.receiveShadow = true;
      layout._root.add(top);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        var leg = new THREE.Mesh(kit.g.leg, mats.metal);
        leg.position.set(t.x + s[0] * t.w * 0.35, surface + 0.24, t.z + s[1] * t.d * 0.35);
        layout._root.add(leg);
      });
    }
    (meet.seats || []).forEach(function (id) {
      var seat = layout.waypoints[id];
      if (!seat) return;
      layout._root.add(addChair(THREE, kit, mats, seat.x, seat.z, seat.yaw, surface));
    });
  }

  function dress(opts) {
    var THREE = opts.THREE;
    var root = opts.root;
    var shared = opts.shared;
    var k = kit(shared, THREE);
    var mats = shared.mats;
    var surface = opts.surfaceY || 0.19;
    var layout = opts.layout || {};
    (layout.lamps || [{ x: -1.6, z: 0 }, { x: 0.4, z: 0 }]).forEach(function (l) {
      root.add(addLamp(THREE, k, mats, l.x, l.z, surface));
    });
    if (layout.greenWall) root.add(addGreen(THREE, k, layout.greenWall, surface));
    if (layout.art && opts.zone) root.add(addArt(THREE, k, mats, opts.zone, layout.art, surface));
    var door = addLiftDoor(THREE, k, mats, surface);
    root.add(door);
    root.userData.liftDoors = door.userData;
    (opts.extraPlants || []).forEach(function (p) {
      if (!opts.makePlant) return;
      var plant = opts.makePlant(shared);
      plant.position.set(p.x, surface, p.z);
      root.add(plant);
    });
  }

  function build(opts) {
    var THREE = opts.THREE;
    var root = opts.root;
    var zone = opts.zone;
    var layout = opts.layout;
    var shared = opts.shared;
    var mats = shared.mats;
    var surface = opts.surfaceY || 0.19;
    var k = kit(shared, THREE);
    layout._root = root;
    (layout.desks || []).forEach(function (d) {
      root.add(addDesk(THREE, k, mats, d.staffId, d.x, d.z, d.yaw, surface));
      var seatId = layout.zone + '.desk.' + d.staffId;
      var seat = layout.waypoints[seatId];
      if (seat) root.add(addChair(THREE, k, mats, seat.x, seat.z, seat.yaw, surface));
    });
    (zone.staff || []).forEach(function (s) {
      var placed = (layout.desks || []).some(function (d) { return d.staffId === s.id; });
      if (placed) return;
      var seat = layout.waypoints[layout.zone + '.desk.' + s.id];
      if (!seat) return;
      var stool = new THREE.Mesh(k.g.seat, mats.seat);
      stool.position.set(seat.x, surface + 0.22, seat.z);
      root.add(stool);
    });
    addMeeting(THREE, k, mats, layout, surface, opts.makeGlassWall);
    (layout.plants || []).forEach(function (p) {
      if (!opts.makePlant) return;
      var plant = opts.makePlant(shared);
      plant.position.set(p.x, surface, p.z);
      root.add(plant);
    });
    dress(opts);
    var bots = [];
    (zone.staff || []).forEach(function (s) {
      if (!opts.makeCuteBot) return;
      var seat = layout.waypoints[layout.zone + '.desk.' + s.id];
      if (!seat) return;
      var bot = opts.makeCuteBot(zone.color, zone.shape, shared);
      bot.userData.baseScale = 0.86;
      bot.userData.baseY = surface;
      bot.userData.zoneId = zone.id;
      bot.userData.staffId = s.id;
      bot.userData.isBot = true;
      bot.userData.campusAgent = true;
      bot.userData.phase = Math.random() * Math.PI * 2;
      bot.scale.setScalar(0.86);
      bot.position.set(seat.x, surface, seat.z);
      bot.rotation.y = seat.yaw || 0;
      root.add(bot);
      if (opts.botMeshes) opts.botMeshes.push(bot);
      bots.push(bot);
    });
    return { bots: bots };
  }

  root.HQOffice = { build: build, dress: dress, lift: LIFT };
})(typeof window !== 'undefined' ? window : globalThis);
