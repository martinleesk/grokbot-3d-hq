/* L4 open-office meshes. Warm stone, brass line, one glass room. */
(function (root) {
  function makeLifeDesk(THREE, mats, screenMat) {
    var g = new THREE.Group();
    var top = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.045, 0.5), mats.wood);
    top.position.y = 0.5;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    var lip = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.01, 0.018), mats.mullion);
    lip.position.set(0, 0.528, 0.24);
    g.add(lip);
    var xs = [-0.46, 0.46];
    var zs = [-0.18, 0.18];
    for (var i = 0; i < xs.length; i++) {
      for (var j = 0; j < zs.length; j++) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.5, 6), mats.metal);
        leg.position.set(xs[i], 0.25, zs[j]);
        g.add(leg);
      }
    }
    var bezel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.025), mats.metal);
    bezel.position.set(0, 0.74, -0.2);
    g.add(bezel);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.2), screenMat);
    screen.position.set(0, 0.74, -0.184);
    g.add(screen);
    var kb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.014, 0.1), mats.metal);
    kb.position.set(0, 0.532, 0.05);
    g.add(kb);
    return g;
  }

  function makeChair(THREE, mats) {
    var g = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.36), mats.seat);
    seat.position.y = 0.36;
    seat.castShadow = true;
    g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.04), mats.chairBack);
    back.position.set(0, 0.54, -0.16);
    g.add(back);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.32, 6), mats.metal);
    pole.position.y = 0.16;
    g.add(pole);
    return g;
  }

  function wrapLines(ctx, text, maxW) {
    var parts = String(text || '').split(/\s+/).filter(Boolean);
    var lines = [];
    var cur = '';
    parts.forEach(function (word) {
      var trial = cur ? cur + ' ' + word : word;
      if (ctx.measureText(trial).width <= maxW) cur = trial;
      else {
        if (cur) lines.push(cur);
        cur = word;
      }
    });
    if (cur) lines.push(cur);
    var out = [];
    lines.forEach(function (line) {
      if (ctx.measureText(line).width <= maxW) { out.push(line); return; }
      var buf = '';
      for (var i = 0; i < line.length; i++) {
        var next = buf + line.charAt(i);
        if (buf && ctx.measureText(next).width > maxW) { out.push(buf); buf = line.charAt(i); }
        else buf = next;
      }
      if (buf) out.push(buf);
    });
    return out.slice(0, 3);
  }

  function build(opts) {
    var THREE = opts.THREE;
    var root = opts.root;
    var zone = opts.zone;
    var layout = opts.layout;
    var shared = opts.shared;
    var mats = shared.mats;
    var surfaceY = opts.surfaceY || 0;
    var screenMat = opts.screenMat;
    var makeCuteBot = opts.makeCuteBot;
    var makePlant = opts.makePlant;
    var makeGlassWall = opts.makeGlassWall;
    var botMeshes = opts.botMeshes;

    (layout.desks || []).forEach(function (d) {
      var desk = makeLifeDesk(THREE, mats, screenMat);
      desk.position.set(d.x, surfaceY, d.z);
      desk.rotation.y = d.yaw || 0;
      root.add(desk);
      var seatId = (layout.zone || 'life') + '.desk.' + d.staffId;
      var seat = layout.waypoints && layout.waypoints[seatId];
      if (seat) {
        var chair = makeChair(THREE, mats);
        chair.position.set(seat.x, surfaceY, seat.z);
        chair.rotation.y = seat.yaw || 0;
        root.add(chair);
      }
      var staff = null;
      for (var i = 0; i < zone.staff.length; i++) {
        if (zone.staff[i].id === d.staffId) staff = zone.staff[i];
      }
      if (!staff || !seat || !makeCuteBot) return;
      var bot = makeCuteBot(zone.color, zone.shape, shared);
      bot.userData.baseScale = 0.96;
      bot.userData.baseY = surfaceY;
      bot.userData.zoneId = zone.id;
      bot.userData.staffId = staff.id;
      bot.userData.isBot = true;
      bot.userData.lifeAgent = true;
      bot.userData.phase = Math.random() * Math.PI * 2;
      bot.scale.setScalar(0.96);
      bot.position.set(seat.x, surfaceY, seat.z);
      bot.rotation.y = seat.yaw || 0;
      root.add(bot);
      botMeshes.push(bot);
    });

    var meet = layout.meeting || {};
    (meet.walls || []).forEach(function (w) {
      var wall = makeGlassWall(w.w, w.h || 1.08);
      if (wall.userData.glassMat) {
        wall.userData.glassMat.color.setHex(0xD9CBB8);
        wall.userData.glassMat.opacity = 0.22;
        wall.userData.glassMat.emissive.setHex(0xB79F80);
        wall.userData.glassMat.emissiveIntensity = 0.05;
        wall.userData.glassMat.depthWrite = false;
        wall.userData.glassMat.roughness = 0.18;
      }
      wall.position.set(w.x, surfaceY, w.z);
      wall.rotation.y = w.rot || 0;
      root.add(wall);
    });

    var frame = meet.doorFrame;
    if (frame) {
      var postH = frame.h || 1.08;
      [-1, 1].forEach(function (side) {
        var post = new THREE.Mesh(new THREE.BoxGeometry(0.07, postH, 0.07), mats.mullion);
        post.position.set(frame.x, surfaceY + postH / 2, frame.z + side * (frame.gap || 1) / 2);
        root.add(post);
      });
      var header = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.055, (frame.gap || 1) + 0.07),
        mats.mullion
      );
      header.position.set(frame.x, surfaceY + postH - 0.03, frame.z);
      root.add(header);
      var threshold = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.014, frame.gap || 1),
        mats.mullion
      );
      threshold.position.set(frame.x, surfaceY + 0.01, frame.z);
      root.add(threshold);
    }

    if (meet.table) {
      var t = meet.table;
      var top = new THREE.Mesh(new THREE.BoxGeometry(t.w, 0.045, t.d), mats.wood);
      top.position.set(t.x, surfaceY + 0.5, t.z);
      top.castShadow = true;
      top.receiveShadow = true;
      root.add(top);
      var edge = new THREE.Mesh(new THREE.BoxGeometry(t.w + 0.02, 0.012, t.d + 0.02), mats.mullion);
      edge.position.set(t.x, surfaceY + 0.472, t.z);
      root.add(edge);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.48, 6), mats.metal);
        leg.position.set(t.x + s[0] * (t.w * 0.38), surfaceY + 0.24, t.z + s[1] * (t.d * 0.4));
        root.add(leg);
      });
    }

    (meet.seats || []).forEach(function (id) {
      var seat = layout.waypoints && layout.waypoints[id];
      if (!seat) return;
      var chair = makeChair(THREE, mats);
      chair.position.set(seat.x, surfaceY, seat.z);
      chair.rotation.y = seat.yaw || 0;
      root.add(chair);
    });

    var paint = function () {};
    var screen = meet.screen;
    if (screen) {
      var canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      var ctx = canvas.getContext('2d');
      var tex = new THREE.CanvasTexture(canvas);
      if (tex.colorSpace !== undefined && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      var mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      var grp = new THREE.Group();
      grp.position.set(screen.x, surfaceY + (screen.y || 0.78), screen.z);
      grp.rotation.y = screen.yaw || 0;
      var bezel = new THREE.Mesh(new THREE.BoxGeometry(screen.w + 0.08, screen.h + 0.08, 0.03), mats.metal);
      grp.add(bezel);
      var plane = new THREE.Mesh(new THREE.PlaneGeometry(screen.w, screen.h), mat);
      plane.position.z = 0.02;
      grp.add(plane);
      var brass = new THREE.Mesh(new THREE.BoxGeometry(screen.w + 0.02, 0.015, 0.04), mats.mullion);
      brass.position.set(0, -(screen.h / 2) - 0.02, 0.01);
      grp.add(brass);
      root.add(grp);
      paint = function (title) {
        ctx.clearRect(0, 0, 512, 256);
        ctx.fillStyle = '#1C1916';
        ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#B79F80';
        ctx.lineWidth = 6;
        ctx.strokeRect(18, 18, 476, 220);
        var text = title ? String(title) : '';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (!text) {
          ctx.fillStyle = 'rgba(183,159,128,0.45)';
          ctx.font = '500 28px "Noto Serif TC","Songti TC",serif';
          ctx.fillText('生活', 256, 128);
        } else {
          ctx.fillStyle = '#EDE6DA';
          ctx.font = '500 40px "Noto Serif TC","Songti TC",serif';
          var lines = wrapLines(ctx, text, 420);
          if (!lines.length) lines = [text.slice(0, 18)];
          var start = 128 - (lines.length - 1) * 26;
          for (var li = 0; li < lines.length; li++) ctx.fillText(lines[li], 256, start + li * 52);
        }
        tex.needsUpdate = true;
      };
      paint('');
    }

    if (layout.corridor) {
      var c = layout.corridor;
      var strip = new THREE.Mesh(new THREE.BoxGeometry(c.length || 4, 0.012, 0.018), mats.mullion);
      strip.position.set(c.x || 0, surfaceY + 0.008, c.z || 0);
      root.add(strip);
    }

    (layout.plants || []).forEach(function (p) {
      if (!makePlant) return;
      var plant = makePlant(shared);
      plant.position.set(p.x, surfaceY, p.z);
      root.add(plant);
    });

    return { paint: paint };
  }

  root.HQLifeScene = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
