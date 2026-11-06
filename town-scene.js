/* Isometric cartoon town. Replaces the tower as the only 3D stage.
   Indoor poses come from HQTown.infer (live.json): idle | walk | sit | meeting.
   Outdoor posts, short chats, patrols, and lane visits come from HQTown.frameAt.
   Clicking a person still opens the simple indoor room. */
(function (root) {
  var OVERVIEW_POS = { x: 16.8, y: 14.6, z: 18.6 };
  var OVERVIEW_TGT = { x: 0.4, y: 0.5, z: 0.15 };
  var CLOTH = {
    boss: 0xE7B23C, sec: 0xF28B82, finance: 0xE09A4A, life: 0xE88AA8,
    advisor: 0x6AA6D8, travel: 0x6FBFB3, news: 0xB89AD8, auditor: 0x8FB36A,
    health: 0xF2C14B, mind: 0xC9A4E0, learn: 0x8EC8E3, meet: 0xE7A08C,
    'shared-db': 0x7EB0E0, analytics: 0x67C4B2, lab: 0xE89A6A,
    byd: 0xE25B4A, '2800': 0x3E7D4F, qqq: 0x4C6EF5, voo: 0x3D5A80,
    newsroom: 0xC9B3E8
  };
  var active = null;

  function hashId(id) {
    var n = 0;
    var s = String(id || '');
    for (var i = 0; i < s.length; i++) n = (n * 33 + s.charCodeAt(i)) >>> 0;
    return n;
  }

  function clothFor(id) {
    if (CLOTH[id] != null) return CLOTH[id];
    var palette = [0xF2B56B, 0x8FB8E0, 0xE7A0B4, 0xA8C48A, 0xC9B3E8, 0xF2C14B, 0xE7A08C];
    return palette[hashId(id) % palette.length];
  }

  function std(THREE, color, extra) {
    var opts = { color: color, roughness: 0.72, metalness: 0.03 };
    if (extra) {
      Object.keys(extra).forEach(function (k) { opts[k] = extra[k]; });
    }
    return new THREE.MeshStandardMaterial(opts);
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function makeLabel(THREE, text, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.width = opts.cw || 512;
    canvas.height = opts.ch || 160;
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.LinearFilter) {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }
    var material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    var sprite = new THREE.Sprite(material);
    sprite.scale.set(opts.sw || 2.15, opts.sh || 0.68, 1);
    sprite.raycast = function () {};
    sprite.userData.canvas = canvas;
    sprite.userData.tex = tex;
    sprite.userData.style = opts;
    sprite.userData.paint = function (next, style) {
      sprite.userData.lastText = next == null ? '' : String(next);
      paintLabel(canvas, tex, next, style || sprite.userData.style || {});
    };
    sprite.userData.paint(text, opts);
    return sprite;
  }

  function paintLabel(canvas, tex, text, opts) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 10, 10, w - 20, h - 20, 32);
    ctx.fillStyle = opts.bg || 'rgba(255,251,246,0.95)';
    ctx.fill();
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.fillStyle = opts.color || '#3A322C';
    ctx.font = (opts.weight || '700') + ' ' + (opts.px || 54) + 'px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var raw = String(text || '');
    if (raw.length > 18 && !opts.single) {
      ctx.font = (opts.weight || '700') + ' ' + Math.round((opts.px || 54) * 0.72) + 'px "Noto Sans TC", sans-serif';
    }
    ctx.fillText(raw, w / 2, h / 2 + 2);
    tex.needsUpdate = true;
  }

  function paintBoard(mesh, lines) {
    var canvas = mesh.userData.canvas;
    var tex = mesh.userData.tex;
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 16, 16, w - 32, h - 32, 36);
    ctx.fillStyle = '#FFFBF6';
    ctx.fill();
    ctx.strokeStyle = '#E4C99A';
    ctx.lineWidth = 10;
    ctx.stroke();
    var y = 78;
    (lines || []).forEach(function (line) {
      ctx.fillStyle = line.color || '#3A322C';
      ctx.font = (line.weight || '700') + ' ' + (line.px || 42) + 'px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(line.text || ''), w / 2, y);
      y += line.gap || 58;
    });
    tex.needsUpdate = true;
  }

  function makeBoard(THREE, w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.LinearFilter) {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.userData.canvas = canvas;
    mesh.userData.tex = tex;
    mesh.raycast = function () {};
    return mesh;
  }

  function tag(group, pick) {
    group.userData.pick = pick;
    group.traverse(function (obj) {
      if (obj.isMesh) obj.userData.pick = pick;
    });
  }

  function makeMascot(THREE, id) {
    var g = new THREE.Group();
    var cloth = std(THREE, clothFor(id), { roughness: 0.55 });
    var skin = std(THREE, 0xF6C7B0, { roughness: 0.48 });
    var shoe = std(THREE, 0x8C5640, { roughness: 0.62 });
    var white = new THREE.MeshBasicMaterial({ color: 0xFFFBFA });
    var pupil = new THREE.MeshBasicMaterial({ color: 0x3A2C28 });
    var blushMat = new THREE.MeshBasicMaterial({ color: 0xF3A0A0, transparent: true, opacity: 0.75 });

    function leg(side) {
      var pivot = new THREE.Group();
      pivot.position.set(side * 0.1, 0.36, 0);
      var thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.24, 8), cloth);
      thigh.position.y = -0.08;
      thigh.castShadow = true;
      pivot.add(thigh);
      var foot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), shoe);
      foot.scale.set(1.15, 0.65, 1.45);
      foot.position.set(0, -0.2, 0.04);
      pivot.add(foot);
      return pivot;
    }
    var legL = leg(-1);
    var legR = leg(1);
    g.add(legL);
    g.add(legR);

    var bust = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), cloth);
    body.scale.set(1.08, 1.12, 0.96);
    body.position.y = 0.62;
    body.castShadow = true;
    bust.add(body);
    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), std(THREE, 0xFFF7F1));
    belly.scale.set(1.05, 0.78, 0.45);
    belly.position.set(0, 0.56, 0.14);
    bust.add(belly);

    function arm(side) {
      var pivot = new THREE.Group();
      pivot.position.set(side * 0.24, 0.72, 0);
      var limb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8), cloth);
      limb.position.y = -0.1;
      pivot.add(limb);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
      hand.position.y = -0.22;
      pivot.add(hand);
      return pivot;
    }
    var armL = arm(-1);
    var armR = arm(1);
    bust.add(armL);
    bust.add(armR);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin);
    head.position.y = 1.02;
    head.castShadow = true;
    bust.add(head);
    var hairs = [0x3A2C28, 0x6B3A2A, 0x2C241C, 0xC47A3A, 0x4A3728, 0x1F1A17];
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.228, 14, 10), std(THREE, hairs[hashId(id) % hairs.length], { roughness: 0.6 }));
    hair.scale.set(1.04, 0.58, 1.02);
    hair.position.y = 1.12;
    bust.add(hair);
    var tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hair.material);
    tuft.position.set(-0.06, 1.28, 0.02);
    tuft.scale.set(0.8, 1.3, 0.7);
    bust.add(tuft);
    [-1, 1].forEach(function (side) {
      var eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), white);
      eyeW.position.set(side * 0.075, 1.04, 0.175);
      bust.add(eyeW);
      var eyeP = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), pupil);
      eyeP.position.set(side * 0.082, 1.03, 0.21);
      bust.add(eyeP);
      var blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), blushMat);
      blush.scale.set(1.25, 0.7, 0.35);
      blush.position.set(side * 0.13, 0.96, 0.16);
      bust.add(blush);
    });
    var smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xC46A6A })
    );
    smile.position.set(0, 0.94, 0.19);
    smile.rotation.z = Math.PI;
    smile.rotation.x = 0.15;
    bust.add(smile);
    g.add(bust);
    g.userData.parts = { bust: bust, legL: legL, legR: legR, armL: armL, armR: armR };
    g.userData.staffId = id;
    g.userData.phase = (hashId(id) % 628) / 100;
    return g;
  }

  function applyPose(bot, anim, t) {
    var parts = bot.userData.parts;
    if (!parts) return;
    var phase = bot.userData.phase || 0;
    var sit = anim === 'sit' || anim === 'meeting';
    if (anim === 'walk') {
      var step = Math.sin(t * 7.2 + phase);
      parts.legL.rotation.x = -step * 0.75;
      parts.legR.rotation.x = step * 0.75;
      parts.armL.rotation.x = step * 0.65;
      parts.armR.rotation.x = -step * 0.65;
      parts.bust.position.y = Math.abs(step) * 0.04;
      parts.bust.rotation.z = step * 0.05;
      parts.bust.rotation.x = 0.06;
    } else if (sit) {
      var typing = Math.sin(t * 3.1 + phase);
      parts.legL.rotation.x = -1.15;
      parts.legR.rotation.x = -1.15;
      parts.armL.rotation.x = -0.35 + (typing > 0 ? typing * 0.85 : 0);
      parts.armR.rotation.x = -0.85 + (typing < 0 ? typing * 0.55 : 0);
      parts.bust.position.y = -0.24 + Math.abs(typing) * 0.02;
      parts.bust.rotation.x = 0.08;
      parts.bust.rotation.z = typing * 0.03;
    } else {
      var idle = Math.sin(t * 1.7 + phase);
      parts.legL.rotation.x = 0;
      parts.legR.rotation.x = 0;
      parts.armL.rotation.x = idle * 0.1;
      parts.armR.rotation.x = -idle * 0.08;
      parts.bust.position.y = Math.abs(idle) * 0.025;
      parts.bust.rotation.z = idle * 0.04;
      parts.bust.rotation.x = 0;
    }
  }

  function addWindow(THREE, parent, x, y, z, rotY) {
    var frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.4, 0.06),
      std(THREE, 0xFFFDF8, { roughness: 0.4 })
    );
    frame.position.set(x, y, z);
    frame.rotation.y = rotY || 0;
    parent.add(frame);
    var glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.28, 0.04),
      std(THREE, 0xFFE7B8, { emissive: 0xFFD27A, emissiveIntensity: 0.55, roughness: 0.25 })
    );
    glass.position.set(x, y, z + (rotY ? 0 : 0.02));
    glass.rotation.y = rotY || 0;
    parent.add(glass);
  }

  function makeHouse(THREE, spec, name) {
    var g = new THREE.Group();
    g.position.set(spec.x, 0, spec.z);
    var wall = std(THREE, spec.wall, { roughness: 0.78 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, spec.d), wall);
    body.position.y = spec.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    var roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(spec.w, spec.d) * 0.78, spec.h * 0.72, 4),
      std(THREE, spec.roof, { roughness: 0.62 })
    );
    roof.position.y = spec.h + spec.h * 0.28;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    var south = spec.z > 2;
    var face = south ? -1 : 1;
    var doorZ = face * (spec.d / 2 + 0.02);
    var door = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.08), std(THREE, 0xC4845A, { roughness: 0.7 }));
    door.position.set(0, 0.4, doorZ);
    door.castShadow = true;
    g.add(door);
    var knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), std(THREE, 0xE7C36A, { metalness: 0.4, roughness: 0.35 }));
    knob.position.set(0.12, 0.4, doorZ + face * 0.05);
    g.add(knob);
    addWindow(THREE, g, -spec.w * 0.28, spec.h * 0.62, doorZ, 0);
    addWindow(THREE, g, spec.w * 0.28, spec.h * 0.62, doorZ, 0);
    if (spec.staffId === 'boss') {
      var chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.46, 0.22), std(THREE, 0xE7D3C4));
      chimney.position.set(spec.w * 0.28, spec.h + 0.42, -0.15);
      g.add(chimney);
    }
    var step = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.36), std(THREE, 0xE7D3C4));
    step.position.set(0, 0.04, doorZ + face * 0.22);
    g.add(step);
    var bench = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.28), std(THREE, spec.roof, { roughness: 0.6 }));
    bench.position.set(0.42, 0.16, doorZ + face * 0.48);
    bench.castShadow = true;
    g.add(bench);
    var nameTag = makeLabel(THREE, name || spec.staffId, {
      sw: Math.min(2.4, 0.42 * String(name || '').length + 0.8),
      sh: 0.48,
      px: 64,
      bg: 'rgba(255,251,246,0.96)',
      border: '#F0D7A8'
    });
    nameTag.position.set(0, spec.h + spec.h * 0.78, 0);
    g.add(nameTag);
    var flag = makeLabel(THREE, '…', {
      sw: 1.35, sh: 0.42, px: 48, cw: 384, ch: 140,
      bg: '#FFF4D8', color: '#8A5A2A', border: '#E7C48A'
    });
    flag.position.set(0, spec.h + 0.28, doorZ);
    g.add(flag);
    g.userData.nameTag = nameTag;
    g.userData.flag = flag;
    g.userData.spec = spec;
    tag(g, { kind: 'house', staffId: spec.staffId, zoneId: spec.zoneId });
    nameTag.raycast = function () {};
    flag.raycast = function () {};
    return g;
  }

  function makePublic(THREE, spec) {
    var g = new THREE.Group();
    g.position.set(spec.x, 0, spec.z);
    var body = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w, spec.h, spec.d),
      std(THREE, spec.wall, { roughness: 0.74 })
    );
    body.position.y = spec.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    var roof = new THREE.Mesh(
      new THREE.BoxGeometry(spec.w + 0.35, 0.28, spec.d + 0.35),
      std(THREE, spec.roof, { roughness: 0.58 })
    );
    roof.position.y = spec.h + 0.1;
    roof.castShadow = true;
    g.add(roof);
    var cap = new THREE.Mesh(
      new THREE.ConeGeometry(Math.min(spec.w, spec.d) * 0.28, 0.55, 4),
      std(THREE, spec.roof, { roughness: 0.5 })
    );
    cap.position.y = spec.h + 0.48;
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    var door = new THREE.Mesh(
      new THREE.BoxGeometry(spec.kind === 'hall' ? 0.9 : 0.7, 1.05, 0.08),
      std(THREE, 0xC4845A)
    );
    door.position.set(0, 0.55, spec.d / 2 + 0.03);
    g.add(door);
    addWindow(THREE, g, -spec.w * 0.28, spec.h * 0.62, spec.d / 2 + 0.02, 0);
    addWindow(THREE, g, spec.w * 0.28, spec.h * 0.62, spec.d / 2 + 0.02, 0);
    if (spec.kind === 'hall') {
      [-1, 1].forEach(function (side) {
        var col = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, spec.h, 10), std(THREE, 0xFFF8EE));
        col.position.set(side * (spec.w * 0.38), spec.h / 2, spec.d / 2 + 0.28);
        col.castShadow = true;
        g.add(col);
      });
      var clock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 20), std(THREE, 0xFFFDF8));
      clock.rotation.x = Math.PI / 2;
      clock.position.set(0, spec.h * 0.78, spec.d / 2 + 0.08);
      g.add(clock);
      var hand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.02), std(THREE, 0x3A322C));
      hand.position.set(0, spec.h * 0.8, spec.d / 2 + 0.14);
      g.add(hand);
    }
    if (spec.id === 'analytics') {
      [0.35, 0.55, 0.8].forEach(function (ht, i) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, ht, 0.16), std(THREE, 0xFFF8EE, { emissive: 0xE7F6F2, emissiveIntensity: 0.2 }));
        bar.position.set(-0.28 + i * 0.28, spec.h + 0.2 + ht / 2, 0.2);
        g.add(bar);
      });
    }
    if (spec.id === 'shared-db') {
      for (var b = 0; b < 3; b++) {
        var book = new THREE.Mesh(
          new THREE.BoxGeometry(0.34, 0.1, 0.26),
          std(THREE, [0x6AA6D8, 0xE7B23C, 0xE36B5C][b])
        );
        book.position.set(-0.05, spec.h + 0.28 + b * 0.11, 0);
        g.add(book);
      }
    }
    if (spec.id === 'lab') {
      var flask = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), std(THREE, 0xB7E4C7, { emissive: 0xD8F3DC, emissiveIntensity: 0.35, transparent: true, opacity: 0.95 }));
      flask.position.set(0.15, spec.h + 0.48, 0);
      g.add(flask);
    }
    var label = makeLabel(THREE, spec.label, {
      sw: spec.kind === 'hall' ? 2.4 : 2.15,
      sh: 0.55,
      px: 56,
      bg: 'rgba(255,251,246,0.96)',
      border: '#F0C9A0'
    });
    label.position.set(0, spec.h + 0.95, spec.d / 2);
    g.add(label);
    g.userData.spec = spec;
    tag(g, {
      kind: spec.kind === 'hall' ? 'hall' : 'center',
      staffId: spec.staffId,
      zoneId: spec.zoneId,
      place: spec.id
    });
    return g;
  }

  function makePin(THREE, spec, name, flagText) {
    var g = new THREE.Group();
    g.position.set(spec.x, 0, spec.z);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 8), std(THREE, 0xC4845A));
    post.position.y = 0.36;
    post.castShadow = true;
    g.add(post);
    var board = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.06), std(THREE, 0xFFF8EE));
    board.position.y = 0.72;
    g.add(board);
    var mark = makeLabel(THREE, (name || spec.staffId).slice(0, 4), {
      sw: 0.85, sh: 0.32, px: 48, cw: 256, ch: 128,
      bg: '#FFF8EE', border: '#E7C9A0'
    });
    mark.position.set(0, 1.05, 0);
    g.add(mark);
    g.userData.flag = mark;
    g.userData.spec = spec;
    tag(g, { kind: 'pin', staffId: spec.staffId, zoneId: spec.zoneId });
    if (flagText) mark.userData.paint(flagText);
    return g;
  }

  function makeTree(THREE, x, z, scale) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var s = scale || 1;
    var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 0.55 * s, 6), std(THREE, 0xC4845A));
    trunk.position.y = 0.28 * s;
    trunk.castShadow = true;
    g.add(trunk);
    var leafMat = std(THREE, 0x7BC96A, { roughness: 0.8, emissive: 0xC8F0B4, emissiveIntensity: 0.08 });
    var puff = new THREE.Mesh(new THREE.SphereGeometry(0.48 * s, 12, 10), leafMat);
    puff.position.y = 0.78 * s;
    puff.castShadow = true;
    g.add(puff);
    var puff2 = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 10, 8), std(THREE, 0x8FD47C, { roughness: 0.78 }));
    puff2.position.set(0.22 * s, 0.62 * s, 0.08 * s);
    g.add(puff2);
    return g;
  }

  function makeDesk(THREE, post) {
    var g = new THREE.Group();
    g.position.set(post.x, 0, post.z);
    g.rotation.y = post.yaw || 0;
    var top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.3), std(THREE, 0xE7C4A0, { roughness: 0.7 }));
    top.position.set(0, 0.24, 0.34);
    top.castShadow = true;
    g.add(top);
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), std(THREE, 0xC4845A));
    leg.position.set(0, 0.1, 0.34);
    g.add(leg);
    return g;
  }

  function addBillboard(THREE, parent, text, opts, y) {
    var sprite = makeLabel(THREE, text, opts);
    sprite.position.set(0, y, 0);
    sprite.center.set(0.5, 0);
    parent.add(sprite);
    return sprite;
  }

  function boot(opts) {
    var THREE = opts.THREE;
    var Town = root.HQTown;
    if (!THREE || !Town) throw new Error('小鎮場景未載入');
    var wrap = opts.wrap;
    var roster = Town.rosterFromZones(opts.zones || []);
    var byName = {};
    roster.forEach(function (p) { byName[p.id] = p.name; });
    var pins = Town.pinsFor(roster);
    var isTouch = !!opts.isTouch;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9FD4F5);
    scene.fog = new THREE.Fog(0xC5E4F8, 42, 78);
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 160);
    camera.position.set(OVERVIEW_POS.x, OVERVIEW_POS.y, OVERVIEW_POS.z);
    var renderer = new THREE.WebGLRenderer({ antialias: !isTouch, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.75));
    renderer.setClearColor(0x9FD4F5, 1);
    renderer.shadowMap.enabled = !isTouch;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (renderer.toneMapping !== undefined && THREE.ACESFilmicToneMapping !== undefined) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.94;
    }
    if (renderer.outputEncoding !== undefined && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    wrap.appendChild(renderer.domElement);

    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(OVERVIEW_TGT.x, OVERVIEW_TGT.y, OVERVIEW_TGT.z);
    controls.minDistance = 5;
    controls.maxDistance = 46;
    controls.minPolarAngle = 0.42;
    controls.maxPolarAngle = Math.PI * 0.49;
    /* Left-drag / one finger rotates. Pan stays on for mouse and touch:
       Shift+left-drag, right-drag, and two-finger drag. Wheel / pinch still zoom. */
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.18;
    controls.zoomSpeed = 0.9;
    if (THREE.MOUSE) {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      };
    }
    if (THREE.TOUCH) {
      controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
    controls.addEventListener('start', function () {
      controls.autoRotate = false;
      api.userSteer = true;
      glide = null;
    });

    var hemi = new THREE.HemisphereLight(0xD7EEFF, 0xB7D98A, 0.55);
    scene.add(hemi);
    scene.add(new THREE.AmbientLight(0xFFF4E4, 0.28));
    var sun = new THREE.DirectionalLight(0xFFF6E8, 0.92);
    sun.position.set(14, 20, 10);
    sun.castShadow = !isTouch;
    if (!isTouch) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 2;
      sun.shadow.camera.far = 60;
      sun.shadow.camera.left = -22;
      sun.shadow.camera.right = 22;
      sun.shadow.camera.top = 22;
      sun.shadow.camera.bottom = -22;
      sun.shadow.bias = -0.0004;
    }
    scene.add(sun);

    var outdoor = new THREE.Group();
    scene.add(outdoor);

    var sea = new THREE.Mesh(new THREE.CircleGeometry(36, 56), std(THREE, 0x8ECAE6, { roughness: 0.35, metalness: 0.04 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.14;
    outdoor.add(sea);
    var sand = new THREE.Mesh(new THREE.CircleGeometry(23.5, 56), std(THREE, 0xF6D7B0, { roughness: 0.9 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -0.06;
    sand.receiveShadow = true;
    outdoor.add(sand);
    var grass = new THREE.Mesh(new THREE.CircleGeometry(18.2, 64), std(THREE, 0x6FBF58, { roughness: 0.9 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    outdoor.add(grass);
    var lawn = new THREE.Mesh(new THREE.CircleGeometry(10.5, 48), std(THREE, 0x86CC68, { roughness: 0.88 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.y = 0.012;
    outdoor.add(lawn);

    var pathMat = std(THREE, 0xE8C09A, { roughness: 0.84 });
    function path(w, d, x, z) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), pathMat);
      m.position.set(x, 0.03, z);
      m.receiveShadow = true;
      outdoor.add(m);
    }
    path(20.5, 1.25, 0.2, 1.55);
    path(1.2, 6.4, 0.35, -2.55);
    path(13.5, 2.15, 0.6, -5.15);
    path(1.05, 3.2, -7.4, 0.2);
    path(1.05, 2.6, 5.3, 2.7);

    var pond = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24), std(THREE, 0x7EC8E3, { roughness: 0.22, metalness: 0.08, emissive: 0xD4F1FA, emissiveIntensity: 0.15 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(6.7, 0.04, -2.35);
    outdoor.add(pond);

    [
      [-13.2, -3.2, 1.25], [-14.1, 3.4, 1.05], [-12.4, 7.2, 1.15],
      [13.4, -4.2, 1.2], [14.2, 2.4, 1], [12.2, 7.4, 1.15],
      [-2.2, 7.6, 1.05], [3.4, -11.2, 0.9], [-8.8, -11.4, 1.1],
      [0.2, 8.4, 1.2], [7.8, 7.6, 0.95]
    ].forEach(function (t) { outdoor.add(makeTree(THREE, t[0], t[1], t[2])); });

    var flowerMat = [0xF4A7B9, 0xFFE08A, 0xFFFFFF, 0xE7B0F0];
    for (var f = 0; f < 16; f++) {
      var flower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), std(THREE, flowerMat[f % 4]));
      var ang = f / 16 * Math.PI * 2;
      flower.position.set(Math.cos(ang) * (6 + (f % 3)), 0.1, Math.sin(ang) * (5.2 + (f % 4) * 0.4));
      outdoor.add(flower);
    }

    [[-4.2, 1.55], [2.4, 1.55], [8.2, 1.55], [-8.5, 1.55]].forEach(function (p) {
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.15, 8), std(THREE, 0x6B5344));
      pole.position.set(p[0], 0.58, p[1] - 0.85);
      outdoor.add(pole);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), std(THREE, 0xFFF4D0, { emissive: 0xFFE1A0, emissiveIntensity: 0.7 }));
      bulb.position.set(p[0], 1.2, p[1] - 0.85);
      outdoor.add(bulb);
    });

    var houses = {};
    Town.HOUSES.forEach(function (spec) {
      var mesh = makeHouse(THREE, spec, byName[spec.staffId] || spec.staffId);
      outdoor.add(mesh);
      houses[spec.staffId] = mesh;
    });
    var publics = {};
    Town.PUBLIC.forEach(function (spec) {
      var mesh = makePublic(THREE, spec);
      outdoor.add(mesh);
      publics[spec.id] = mesh;
    });
    var pinMeshes = {};
    pins.forEach(function (spec) {
      var mesh = makePin(THREE, spec, byName[spec.staffId] || spec.staffId);
      outdoor.add(mesh);
      pinMeshes[spec.staffId] = mesh;
    });
    Town.SIGNS.forEach(function (sign) {
      var sprite = makeLabel(THREE, sign.text, {
        sw: 1.7, sh: 0.46, px: 52, bg: 'rgba(255,248,236,0.94)', color: '#6A4A2A', border: '#E7C9A0'
      });
      sprite.position.set(sign.x, 1.35, sign.z);
      outdoor.add(sprite);
    });
    (Town.COURT_MARKS || []).forEach(function (mark) {
      var sprite = makeLabel(THREE, mark.text, {
        sw: 1.45, sh: 0.4, px: 48, bg: 'rgba(255,248,236,0.94)', color: '#6A4A2A', border: '#E7C9A0'
      });
      sprite.position.set(mark.x, 1.15, mark.z);
      outdoor.add(sprite);
    });
    Town.postsFor(roster).forEach(function (post) {
      if (post.kind !== 'yard') return;
      var desk = makeDesk(THREE, post);
      var owner = null;
      for (var ri = 0; ri < roster.length; ri++) if (roster[ri].id === post.staffId) owner = roster[ri];
      tag(desk, { kind: 'person', staffId: post.staffId, zoneId: owner ? owner.zoneId : '' });
      outdoor.add(desk);
    });

    var clouds = new THREE.Group();
    outdoor.add(clouds);
    [[-6, 8.5, -8], [8, 9.2, 4], [2, 8.2, 12], [-12, 9, 6]].forEach(function (c) {
      var cloud = new THREE.Group();
      cloud.position.set(c[0], c[1], c[2]);
      for (var i = 0; i < 3; i++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.08, 10, 8), std(THREE, 0xFFFFFF, { roughness: 0.9, emissive: 0xFFFFFF, emissiveIntensity: 0.12 }));
        puff.position.set(i * 0.55, (i % 2) * 0.12, 0);
        cloud.add(puff);
      }
      clouds.add(cloud);
    });

    var cast = new THREE.Group();
    scene.add(cast);
    var people = {};
    roster.forEach(function (person) {
      var bot = makeMascot(THREE, person.id);
      bot.userData.pick = { kind: 'person', staffId: person.id, zoneId: person.zoneId };
      bot.traverse(function (obj) {
        if (obj.isMesh) obj.userData.pick = bot.userData.pick;
      });
      bot.userData.pill = addBillboard(THREE, bot, '', {
        sw: 2.05, sh: 0.62, px: 46, cw: 384, ch: 128,
        bg: 'rgba(255,251,246,0.96)', color: '#3A322C', border: '#E7C48A', single: true
      }, 1.42);
      bot.userData.bubble = addBillboard(THREE, bot, '', {
        sw: 2.55, sh: 0.72, px: 42, cw: 512, ch: 140,
        bg: '#FFFFFF', color: '#3A322C', border: '#E7A23A', single: true
      }, 2.15);
      bot.userData.bubble.visible = false;
      cast.add(bot);
      people[person.id] = bot;
    });

    var room = buildHouseRoom(THREE);
    var hallRoom = buildHallRoom(THREE);
    var centerRoom = buildCenterRoom(THREE);
    scene.add(room);
    scene.add(hallRoom);
    scene.add(centerRoom);
    room.visible = false;
    hallRoom.visible = false;
    centerRoom.visible = false;

    var state = Town.infer(opts.getLive ? opts.getLive() : {}, roster, Date.now());
    var view = { mode: 'outdoor', focusId: null };
    var glide = null;
    var alive = true;
    var labels = [];
    outdoor.traverse(function (obj) { if (obj.userData && obj.userData.paint) labels.push(obj); });
    Object.keys(people).forEach(function (id) {
      if (people[id].userData.pill) labels.push(people[id].userData.pill);
      if (people[id].userData.bubble) labels.push(people[id].userData.bubble);
    });

    function limitsOutdoor() {
      controls.minDistance = 5;
      controls.maxDistance = 46;
      controls.minPolarAngle = 0.42;
      controls.maxPolarAngle = Math.PI * 0.49;
    }
    function limitsIndoor() {
      controls.autoRotate = false;
      controls.minDistance = 2.3;
      controls.maxDistance = 8;
      controls.maxPolarAngle = Math.PI * 0.62;
      controls.minPolarAngle = 0.2;
    }
    function glideTo(pos, target) {
      glide = { pos: pos.clone(), target: target.clone() };
    }
    function setDuty(show) {
      var duty = document.getElementById('townDuty');
      if (duty) duty.hidden = !show;
    }
    function paintBoardLink(act) {
      var link = document.getElementById('townBoardLink');
      if (!link || !Town.fillInvestBoardLink) return;
      var board = act && Town.showsInvestBoard(act.staffId)
        ? Town.investBoard(opts.getLive ? opts.getLive() : null)
        : null;
      Town.fillInvestBoardLink(link, board);
    }
    function hideHud() {
      var hud = document.getElementById('townHud');
      if (hud) hud.hidden = true;
      paintBoardLink(null);
    }
    function showHud(act) {
      var hud = document.getElementById('townHud');
      if (!hud) return;
      var lines = act && act.staffId === 'hall' ? {
        kicker: '會議廳',
        who: act.name,
        anim: act.animLabel,
        doing: act.headline,
        detail: act.detail,
        status: act.status || '',
        source: Town.sourceLabel(act.source)
      } : Town.hudLines(act);
      setText('townKicker', lines.kicker);
      setText('townWho', lines.who);
      setText('townAnim', lines.anim);
      setText('townDoing', lines.doing);
      setText('townDetail', lines.detail);
      setText('townStatus', lines.status);
      setText('townSource', lines.source);
      paintBoardLink(act);
      hud.hidden = false;
    }
    function setText(id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value || '';
    }
    function showOutdoor() {
      view.mode = 'outdoor';
      view.focusId = null;
      outdoor.visible = true;
      room.visible = false;
      hallRoom.visible = false;
      centerRoom.visible = false;
      Object.keys(people).forEach(function (id) { people[id].visible = true; });
      hideHud();
      setDuty(true);
      limitsOutdoor();
    }
    function paintScreen(group, act) {
      var screenOn = act.anim === 'sit' || act.anim === 'walk';
      var mat = group.userData.screen.material;
      mat.emissiveIntensity = screenOn ? 0.18 : 0.02;
      paintLabel(group.userData.screenCanvas, group.userData.screenTex, screenOn ? (act.monitor || act.animLabel) : (act.animLabel || '待命'), {
        bg: screenOn ? '#3A322C' : '#E7E0D6',
        color: screenOn ? '#FFE7B0' : '#6A5A4E',
        px: 58,
        weight: '700',
        single: true
      });
    }
    function boardLines(act) {
      var lines = [
        { text: act.animLabel || '', px: 36, color: '#A56B42', weight: '700', gap: 50 },
        { text: act.headline || '', px: 38, color: '#3A322C', weight: '700', gap: 54 }
      ];
      String(act.detail || '').split('　').forEach(function (part) {
        var bit = part.trim();
        if (!bit) return;
        lines.push({ text: bit.slice(0, 34), px: 26, color: '#6A5A4E', weight: '500', gap: 38 });
      });
      if (act.status) lines.push({ text: '狀態：' + act.status, px: 26, color: '#8A6A3A', weight: '600', gap: 40 });
      lines.push({ text: Town.sourceLabel(act.source), px: 22, color: '#8A7A6A', weight: '500', gap: 36 });
      return lines;
    }
    function placeBot(bot, x, y, z, yaw, anim, scale) {
      bot.visible = true;
      bot.position.set(x, y || 0, z);
      bot.rotation.y = yaw || 0;
      bot.scale.setScalar(scale || 0.64);
      bot.userData.anim = anim || 'idle';
    }
    function hideBillboards() {
      Object.keys(people).forEach(function (id) {
        var bot = people[id];
        if (bot.userData.pill) bot.userData.pill.visible = false;
        if (bot.userData.bubble) bot.userData.bubble.visible = false;
      });
    }
    function refreshFlags() {
      Object.keys(houses).forEach(function (id) {
        var act = state.byId[id];
        var flag = houses[id].userData.flag;
        if (act && flag) flag.userData.paint(act.anim === 'meeting' ? '開會' : Town.outdoorLabel(act));
      });
      Object.keys(pinMeshes).forEach(function (id) {
        var act = state.byId[id];
        var flag = pinMeshes[id].userData.flag;
        if (act && flag) {
          var name = byName[id] || id;
          flag.userData.paint(name.slice(0, 3) + ' ' + Town.outdoorLabel(act));
        }
      });
    }
    function paintBillboard(sprite, text, show) {
      if (!sprite) return;
      var next = text || '';
      sprite.visible = !!show && !!next;
      if (!next || sprite.userData.lastText === next) return;
      sprite.userData.paint(next);
    }
    function layoutOutdoor(t) {
      if (view.mode !== 'outdoor') return;
      var frame = Town.frameAt(roster, state, t);
      var dist = camera.position.distanceTo(controls.target);
      var close = dist < 22;
      Object.keys(people).forEach(function (id) {
        var bot = people[id];
        var spot = frame.people[id];
        if (!spot) { bot.visible = false; return; }
        placeBot(bot, spot.x, spot.y || 0, spot.z, spot.yaw, spot.pose, spot.scale || 0.64);
        var s = bot.scale.x || 0.64;
        if (bot.userData.pill) bot.userData.pill.scale.set(1.2 / s, 0.4 / s, 1);
        if (bot.userData.bubble) bot.userData.bubble.scale.set(1.85 / s, 0.5 / s, 1);
        var showPill = close || spot.pose === 'walk' || !!spot.bubble;
        paintBillboard(bot.userData.pill, spot.label, showPill);
        paintBillboard(bot.userData.bubble, spot.bubble, true);
      });
    }
    function openHouse(act, keepCamera) {
      view.mode = 'house';
      view.focusId = act.staffId;
      outdoor.visible = false;
      hallRoom.visible = false;
      centerRoom.visible = false;
      room.visible = true;
      room.userData.stall.visible = act.place === 'pin';
      paintBoard(room.userData.board, boardLines(act));
      paintScreen(room, act);
      hideBillboards();
      Object.keys(people).forEach(function (id) { people[id].visible = id === act.staffId; });
      var bot = people[act.staffId];
      if (bot) {
        if (act.anim === 'sit') placeBot(bot, 0.32, 0.4, -0.28, 0.65, 'sit', 1);
        else if (act.anim === 'walk') placeBot(bot, -0.2, 0, 0.45, 0, 'walk', 1);
        else placeBot(bot, -0.7, 0, 0.05, 0.35, 'idle', 1);
      }
      limitsIndoor();
      setDuty(false);
      if (!keepCamera) {
        glideTo(new THREE.Vector3(0.35, 1.95, 3.15), new THREE.Vector3(0.1, 1.02, -0.45));
      }
      showHud(act);
    }
    function openCenter(act, keepCamera) {
      view.mode = 'center';
      view.focusId = act.staffId;
      outdoor.visible = false;
      room.visible = false;
      hallRoom.visible = false;
      centerRoom.visible = true;
      ['shared-db', 'analytics', 'lab'].forEach(function (id) {
        centerRoom.userData.props[id].visible = id === act.staffId;
      });
      paintBoard(centerRoom.userData.board, boardLines(act));
      paintScreen(centerRoom, act);
      hideBillboards();
      Object.keys(people).forEach(function (id) { people[id].visible = id === act.staffId; });
      var bot = people[act.staffId];
      if (bot) placeBot(bot, -0.15, 0.34, -0.15, 0.4, act.anim === 'idle' ? 'idle' : 'sit', 1);
      limitsIndoor();
      setDuty(false);
      if (!keepCamera) glideTo(new THREE.Vector3(0.35, 1.95, 3.15), new THREE.Vector3(0.1, 1.02, -0.45));
      showHud(act);
    }
    function openHall(focusId, keepCamera) {
      var board = Town.hallBoard(opts.getLive ? opts.getLive() : {}, state);
      if (focusId && state.byId[focusId] && state.byId[focusId].anim === 'meeting') {
        board = state.byId[focusId];
        board = {
          staffId: 'hall',
          name: state.byId[focusId].name,
          anim: 'meeting',
          animLabel: '開會',
          headline: state.byId[focusId].headline,
          detail: state.byId[focusId].detail,
          status: state.byId[focusId].status,
          source: state.byId[focusId].source,
          meetingTitle: state.byId[focusId].meetingTitle
        };
      }
      view.mode = 'hall';
      view.focusId = focusId || 'hall';
      outdoor.visible = false;
      room.visible = false;
      centerRoom.visible = false;
      hallRoom.visible = true;
      paintBoard(hallRoom.userData.board, boardLines(board));
      var attendees = state.list.filter(function (a) { return a.anim === 'meeting'; });
      var seats = hallRoom.userData.seats;
      hideBillboards();
      Object.keys(people).forEach(function (id) {
        people[id].visible = false;
      });
      attendees.forEach(function (act, i) {
        var seat = seats[Math.min(i, seats.length - 1)];
        var bot = people[act.staffId];
        if (!bot) return;
        placeBot(bot, seat.x, 0.34, seat.z, seat.yaw, 'meeting', 1);
      });
      limitsIndoor();
      setDuty(false);
      if (!keepCamera) glideTo(new THREE.Vector3(0.4, 2.25, 3.55), new THREE.Vector3(0, 0.85, -0.35));
      showHud(board);
    }
    function showStaff(staffId, keepCamera) {
      var act = state.byId[staffId];
      if (!act) return;
      if (act.anim === 'meeting') openHall(staffId, keepCamera);
      else if (act.center) openCenter(act, keepCamera);
      else openHouse(act, keepCamera);
    }
    function frame() {
      showOutdoor();
      api.userSteer = false;
      controls.autoRotate = true;
      glideTo(
        new THREE.Vector3(OVERVIEW_POS.x, OVERVIEW_POS.y, OVERVIEW_POS.z),
        new THREE.Vector3(OVERVIEW_TGT.x, OVERVIEW_TGT.y, OVERVIEW_TGT.z)
      );
    }
    function frameZone(zoneId) {
      showOutdoor();
      var p = Town.focusPoint(zoneId);
      controls.autoRotate = false;
      glideTo(new THREE.Vector3(p.x + 7.5, 8.2, p.z + 8.4), new THREE.Vector3(p.x, 0.7, p.z));
    }
    function sync(live) {
      state = Town.infer(live || {}, roster, Date.now());
      refreshFlags();
      if (view.mode === 'hall') openHall(view.focusId === 'hall' ? null : view.focusId, true);
      else if (view.mode === 'house' || view.mode === 'center') {
        if (state.byId[view.focusId]) showStaff(view.focusId, true);
      }
    }
    function setWash(mode) {
      var gold = mode === 'gold';
      api.wash = gold ? 'gold' : 'day';
      if (gold) {
        scene.background.set(0xF6C49A);
        scene.fog.color.set(0xF8D2AE);
        hemi.color.set(0xFFE0C2);
        hemi.groundColor.set(0xE7C48A);
        sun.color.set(0xFFB06A);
        sun.intensity = 1.22;
        sun.position.set(-16, 9, 8);
        renderer.setClearColor(0xF6C49A, 1);
      } else {
        scene.background.set(0x9FD4F5);
        scene.fog.color.set(0xC5E4F8);
        hemi.color.set(0xE7F4FF);
        hemi.groundColor.set(0xC6E6A4);
        sun.color.set(0xFFF8EE);
        sun.intensity = 1.12;
        sun.position.set(14, 20, 10);
        renderer.setClearColor(0x9FD4F5, 1);
      }
      return api.wash;
    }

    refreshFlags();
    var back = document.getElementById('townBack');
    if (back && !back.dataset.bound) {
      back.dataset.bound = '1';
      back.addEventListener('click', function () { frame(); });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        labels.forEach(function (sprite) {
          if (sprite.userData.paint && sprite.userData.style) {
            var current = sprite.userData.lastText;
            if (current) sprite.userData.paint(current);
          }
        });
        refreshFlags();
      });
    }

    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var downX = 0;
    var downY = 0;
    var moved = false;
    function setPointer(e) {
      var rect = renderer.domElement.getBoundingClientRect();
      var x = e.clientX;
      var y = e.clientY;
      if (x == null && e.changedTouches && e.changedTouches[0]) {
        x = e.changedTouches[0].clientX;
        y = e.changedTouches[0].clientY;
      }
      pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    }
    function pick(e) {
      setPointer(e);
      raycaster.setFromCamera(pointer, camera);
      var hits = raycaster.intersectObjects(scene.children, true);
      for (var i = 0; i < hits.length; i++) {
        var obj = hits[i].object;
        while (obj) {
          if (obj.userData && obj.userData.pick) return obj.userData.pick;
          obj = obj.parent;
        }
      }
      return null;
    }
    function onDown(e) { downX = e.clientX || 0; downY = e.clientY || 0; moved = false; }
    function onMove(e) {
      if (Math.abs((e.clientX || 0) - downX) > 8 || Math.abs((e.clientY || 0) - downY) > 8) moved = true;
    }
    function onUp(e) {
      if (moved) return;
      var hit = pick(e);
      if (!hit) return;
      if (hit.kind === 'hall') openHall(null);
      else if (hit.staffId) showStaff(hit.staffId);
      if (opts.onPick) opts.onPick(hit);
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);

    function resize() {
      var w = wrap.clientWidth || window.innerWidth;
      var h = wrap.clientHeight || window.innerHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    function onOrient() { setTimeout(resize, 250); }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', onOrient);
    resize();

    var clock = new THREE.Clock();
    function clampPan() {
      var outdoor = view.mode === 'outdoor';
      var box = outdoor
        ? { minX: -20, maxX: 20, minY: 0, maxY: 4, minZ: -20, maxZ: 20 }
        : { minX: -1.8, maxX: 1.8, minY: 0.2, maxY: 2.4, minZ: -1.8, maxZ: 1.8 };
      var t = controls.target;
      var nx = Math.max(box.minX, Math.min(box.maxX, t.x));
      var ny = Math.max(box.minY, Math.min(box.maxY, t.y));
      var nz = Math.max(box.minZ, Math.min(box.maxZ, t.z));
      var dx = nx - t.x;
      var dy = ny - t.y;
      var dz = nz - t.z;
      if (!dx && !dy && !dz) return;
      t.set(nx, ny, nz);
      camera.position.x += dx;
      camera.position.y += dy;
      camera.position.z += dz;
    }
    function animate() {
      if (!alive) return;
      api.raf = requestAnimationFrame(animate);
      var dt = clock.getDelta();
      var t = clock.elapsedTime;
      if (view.mode === 'outdoor') layoutOutdoor(t);
      else if (view.mode === 'house' && view.focusId && people[view.focusId]) {
        var bot = people[view.focusId];
        var act = state.byId[view.focusId];
        if (act && act.anim === 'walk') {
          var u = (Math.sin(t * 0.9) + 1) / 2;
          bot.position.x = -0.85 + u * 1.5;
          bot.position.z = 0.55;
          bot.rotation.y = Math.cos(t * 0.9) >= 0 ? Math.PI / 2 : -Math.PI / 2;
          bot.userData.anim = 'walk';
        }
      }
      Object.keys(people).forEach(function (id) {
        var bot = people[id];
        if (bot.visible) applyPose(bot, bot.userData.anim || 'idle', t);
      });
      clouds.children.forEach(function (cloud, i) {
        cloud.position.x += Math.sin(t * 0.15 + i) * 0.002;
      });
      if (glide) {
        camera.position.lerp(glide.pos, 0.1);
        controls.target.lerp(glide.target, 0.12);
        if (camera.position.distanceTo(glide.pos) < 0.12) glide = null;
      }
      controls.update();
      clampPan();
      renderer.render(scene, camera);
      if (dt > 1) clock.getDelta();
    }
    var api = {
      town: true,
      scene: scene,
      renderer: renderer,
      controls: controls,
      raf: 0,
      wash: 'day',
      onResize: resize,
      onOrient: onOrient,
      kill: function () {
        alive = false;
        hideHud();
        if (active === api) active = null;
      },
      sync: sync,
      showStaff: showStaff,
      openHall: function () { openHall(null); },
      frame: frame,
      frameZone: frameZone,
      setWash: setWash,
      isIndoor: function () { return view.mode !== 'outdoor'; },
      userSteer: false
    };
    active = api;
    setWash('day');
    animate();
    return api;
  }

  function buildHouseRoom(THREE) {
    var g = new THREE.Group();
    var floor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 3.6), std(THREE, 0xE7C4A0, { roughness: 0.78 }));
    floor.position.y = 0.06;
    floor.receiveShadow = true;
    g.add(floor);
    var rug = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 1.5), std(THREE, 0xF2C9C0, { roughness: 0.9 }));
    rug.position.set(0, 0.13, 0.15);
    g.add(rug);
    function wall(w, h, x, y, z, rot) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), std(THREE, 0xFFF6EA, { roughness: 0.86 }));
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.y = rot;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    wall(4.6, 2.5, 0, 1.25, -1.8, 0);
    wall(3.6, 2.5, -2.3, 1.25, 0, Math.PI / 2);
    wall(3.6, 2.5, 2.3, 1.25, 0, Math.PI / 2);
    addWindow(THREE, g, -1.15, 1.55, -1.72, 0);
    var desk = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.62), std(THREE, 0xE7C4A0));
    desk.position.set(0.85, 0.72, -1.15);
    desk.castShadow = true;
    g.add(desk);
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.08), std(THREE, 0xC4845A));
    leg.position.set(0.85, 0.38, -1.28);
    g.add(leg);
    var chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.48), std(THREE, 0xE36B6B));
    chair.position.set(0.32, 0.4, -0.42);
    g.add(chair);
    var back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.48, 0.08), std(THREE, 0xE36B6B));
    back.position.set(0.32, 0.68, -0.64);
    g.add(back);
    var screenCanvas = document.createElement('canvas');
    screenCanvas.width = 512;
    screenCanvas.height = 288;
    var screenTex = new THREE.CanvasTexture(screenCanvas);
    var screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.4),
      new THREE.MeshStandardMaterial({ map: screenTex, color: 0xffffff, emissive: 0xFFE1A8, emissiveIntensity: 0.2, roughness: 0.45 })
    );
    screen.position.set(0.85, 1.05, -1.28);
    screen.userData.canvas = screenCanvas;
    g.add(screen);
    var bezel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.48, 0.05), std(THREE, 0xFFFDF8));
    bezel.position.set(0.85, 1.05, -1.32);
    g.add(bezel);
    var plant = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), std(THREE, 0x7BC96A));
    plant.position.set(-1.7, 0.55, -1.35);
    g.add(plant);
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 8), std(THREE, 0xE7A090));
    pot.position.set(-1.7, 0.28, -1.35);
    g.add(pot);
    var board = makeBoard(THREE, 2.5, 1.25);
    board.position.set(0.15, 1.7, -1.72);
    g.add(board);
    var stall = makeLabel(THREE, '街口暫放 · 未有崗位', {
      sw: 2.4, sh: 0.4, px: 40, bg: '#FFF4D8', color: '#8A5A2A', border: '#E7C48A'
    });
    stall.position.set(0, 2.35, -1.6);
    stall.visible = false;
    g.add(stall);
    var ceiling = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.08, 3.7), std(THREE, 0xFFF8F0, { roughness: 0.9 }));
    ceiling.position.y = 2.52;
    g.add(ceiling);
    var lamp = new THREE.PointLight(0xFFF1D6, 0.7, 9);
    lamp.position.set(0, 2.2, 0.2);
    g.add(lamp);
    g.userData.board = board;
    g.userData.screen = screen;
    g.userData.screenCanvas = screenCanvas;
    g.userData.screenTex = screenTex;
    g.userData.stall = stall;
    return g;
  }

  function buildHallRoom(THREE) {
    var g = new THREE.Group();
    var floor = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 4.2), std(THREE, 0xE7C4A0, { roughness: 0.8 }));
    floor.position.y = 0.06;
    floor.receiveShadow = true;
    g.add(floor);
    function wall(w, h, x, y, z, rot) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), std(THREE, 0xFFF4EA, { roughness: 0.86 }));
      mesh.position.set(x, y, z);
      if (rot) mesh.rotation.y = rot;
      g.add(mesh);
    }
    wall(6.4, 2.6, 0, 1.3, -2.1, 0);
    wall(4.2, 2.6, -3.2, 1.3, 0, Math.PI / 2);
    wall(4.2, 2.6, 3.2, 1.3, 0, Math.PI / 2);
    var hallCeiling = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.08, 4.3), std(THREE, 0xFFF6EE, { roughness: 0.9 }));
    hallCeiling.position.y = 2.6;
    g.add(hallCeiling);
    var table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.15), std(THREE, 0xD9895C));
    table.position.set(0, 0.7, 0.15);
    table.castShadow = true;
    g.add(table);
    var seats = [
      { x: -0.9, z: -0.55, yaw: 0 },
      { x: 0, z: -0.55, yaw: 0.05 },
      { x: 0.9, z: -0.55, yaw: -0.05 },
      { x: -0.9, z: 0.9, yaw: Math.PI },
      { x: 0, z: 0.9, yaw: Math.PI },
      { x: 0.9, z: 0.9, yaw: Math.PI }
    ];
    seats.forEach(function (s) {
      var chair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), std(THREE, 0xE36B5C));
      chair.position.set(s.x, 0.4, s.z);
      g.add(chair);
    });
    var board = makeBoard(THREE, 3.1, 1.35);
    board.position.set(0, 1.7, -2.02);
    g.add(board);
    var lamp = new THREE.PointLight(0xFFF1D6, 1, 14);
    lamp.position.set(0, 2.2, 0.4);
    g.add(lamp);
    g.userData.board = board;
    g.userData.seats = seats;
    return g;
  }

  function buildCenterRoom(THREE) {
    var g = buildHouseRoom(THREE);
    g.userData.stall.visible = false;
    var props = {};
    function propGroup() {
      var p = new THREE.Group();
      g.add(p);
      return p;
    }
    var db = propGroup();
    for (var i = 0; i < 4; i++) {
      var book = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.08), std(THREE, [0x6AA6D8, 0xE7B23C, 0xE36B5C, 0x8FCB6E][i]));
      book.position.set(1.55, 0.7, -0.9 + i * 0.22);
      db.add(book);
    }
    var analytics = propGroup();
    [0.35, 0.55, 0.8, 0.48].forEach(function (ht, idx) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, ht, 0.16), std(THREE, 0x67C4B2, { emissive: 0xD8F3DC, emissiveIntensity: 0.2 }));
      bar.position.set(1.35 + idx * 0.22, 0.4 + ht / 2, -0.4);
      analytics.add(bar);
    });
    var lab = propGroup();
    var flask = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std(THREE, 0xB7E4C7, { emissive: 0xD8F3DC, emissiveIntensity: 0.4 }));
    flask.position.set(1.6, 0.85, -0.5);
    lab.add(flask);
    props['shared-db'] = db;
    props.analytics = analytics;
    props.lab = lab;
    g.userData.props = props;
    return g;
  }

  root.HQTownView = {
    boot: boot,
    sync: function (live) { if (active) active.sync(live); },
    showStaff: function (staffId) { if (active) active.showStaff(staffId); },
    openHall: function () { if (active) active.openHall(); },
    frame: function () { if (active) active.frame(); },
    frameZone: function (zoneId) { if (active) active.frameZone(zoneId); },
    setWash: function (mode) { return active ? active.setWash(mode) : 'day'; },
    indoors: function () { return !!(active && active.isIndoor()); },
    controls: function () { return active ? active.controls : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
