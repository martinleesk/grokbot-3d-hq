/* Shell A curtain wall + cute mascot figures.
   Thin gold frames, full-height bright glass, daylight or golden hour.
   Figures are original rounded meshes, not a third-party avatar service. */
(function (root) {
  var BRASS = 0xB79F80;
  var DAY_SKY = 0x6EB4EA;
  var DAY_HAZE = 0xD5E6F4;
  var GOLD_SKY = 0xF0B48A;
  var GOLD_HAZE = 0xF8D7B8;

  var LOBBY_H = 4.35;
  var PITCH = 2.28;
  var SHELL_W = 9.7;
  var SHELL_D = 5.9;

  function floorBaseY(level) {
    var lv = level || 1;
    if (lv <= 1) return 0;
    return LOBBY_H + (lv - 2) * PITCH;
  }

  function mats(THREE) {
    return {
      brass: new THREE.MeshStandardMaterial({
        color: 0xC4A36A, metalness: 0.55, roughness: 0.32,
        emissive: 0xC4A36A, emissiveIntensity: 0.1
      }),
      band: new THREE.MeshStandardMaterial({
        color: 0xE7D3B8, metalness: 0.16, roughness: 0.55,
        emissive: 0xF0DCC4, emissiveIntensity: 0.05
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xE4F2FB, transparent: true, opacity: 0.16,
        metalness: 0.06, roughness: 0.08,
        transmission: 0.0,
        emissive: 0xFFF6EA, emissiveIntensity: 0.03,
        side: THREE.DoubleSide, depthWrite: false
      }),
      glow: new THREE.MeshBasicMaterial({
        color: 0xFFE7CC, transparent: true, opacity: 0.1,
        depthWrite: false, side: THREE.DoubleSide
      }),
      interior: new THREE.MeshStandardMaterial({
        color: 0xF4E6D6, roughness: 0.82, metalness: 0.02,
        emissive: 0xFFE8D0, emissiveIntensity: 0.1
      }),
      skin: new THREE.MeshStandardMaterial({ color: 0xF6D0C0, roughness: 0.58, metalness: 0.02 }),
      belly: new THREE.MeshStandardMaterial({ color: 0xFFF7F1, roughness: 0.62, metalness: 0.02 }),
      shoe: new THREE.MeshStandardMaterial({ color: 0xC4A484, roughness: 0.48, metalness: 0.12 }),
      eyeWhite: new THREE.MeshBasicMaterial({ color: 0xFFFBFA }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x3A2C28 }),
      catchLt: new THREE.MeshBasicMaterial({ color: 0xFFFFFF }),
      blush: new THREE.MeshBasicMaterial({ color: 0xE8A090, transparent: true, opacity: 0.55 }),
      mouth: new THREE.MeshBasicMaterial({ color: 0xC47B78 })
    };
  }

  function box(THREE, w, h, d, material) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    return m;
  }

  function addFacade(THREE, parent, look, length, glassH, yMid, x, z, rotY) {
    /* One center mullion on the long face only. No end bars — corners are round posts. */
    var splits = length > 7.5 ? 1 : 0;
    var mullion = splits ? 0.04 : 0.028;
    var bays = splits + 1;
    var inner = length - (splits ? mullion : 0);
    var bay = inner / bays;
    var g = new THREE.Group();
    g.position.set(x, yMid, z);
    g.rotation.y = rotY || 0;
    for (var i = 0; i < bays; i++) {
      var paneW = bay - (splits ? mullion * 0.15 : 0);
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(paneW, glassH), look.glass);
      pane.position.x = -inner / 2 + bay * i + bay / 2;
      pane.position.z = 0.012;
      pane.renderOrder = 2;
      g.add(pane);
    }
    if (splits) {
      var bar = box(THREE, mullion, glassH, 0.028, look.brass);
      bar.position.z = 0.02;
      g.add(bar);
    }
    var head = box(THREE, length, 0.03, 0.04, look.brass);
    head.position.y = glassH / 2;
    head.position.z = 0.02;
    g.add(head);
    var sill = box(THREE, length, 0.026, 0.04, look.brass);
    sill.position.y = -glassH / 2;
    sill.position.z = 0.02;
    g.add(sill);
    parent.add(g);
  }

  function addCurtain(THREE, root, look, opts) {
    var storyH = opts.storyH;
    var w = SHELL_W;
    var d = SHELL_D;
    var bandH = 0.05;
    var glassBottom = 0.16 + bandH;
    var glassTop = storyH - 0.04;
    var glassH = Math.max(0.8, glassTop - glassBottom);
    var yMid = glassBottom + glassH / 2;
    var inset = 0.18;
    var band = box(THREE, w - 0.06, bandH, d - 0.06, look.band);
    band.position.y = 0.16 + bandH / 2;
    root.add(band);
    var lip = box(THREE, w - 0.02, 0.012, d - 0.02, look.brass);
    lip.position.y = 0.16 + bandH + 0.004;
    root.add(lip);
    addFacade(THREE, root, look, w - inset, glassH, yMid, 0, d / 2, 0);
    addFacade(THREE, root, look, w - inset, glassH, yMid, 0, -d / 2, Math.PI);
    addFacade(THREE, root, look, d - inset, glassH, yMid, w / 2, 0, Math.PI / 2);
    addFacade(THREE, root, look, d - inset, glassH, yMid, -w / 2, 0, -Math.PI / 2);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, storyH - 0.06, 16),
        look.brass
      );
      post.position.set(s[0] * (w / 2 - 0.02), (storyH - 0.06) / 2 + 0.04, s[1] * (d / 2 - 0.02));
      root.add(post);
    });
    if (opts.parapet) {
      var cap = box(THREE, w + 0.14, 0.08, d + 0.14, look.band);
      cap.position.y = storyH - 0.02;
      root.add(cap);
      var crown = box(THREE, w + 0.22, 0.015, d + 0.22, look.brass);
      crown.position.y = storyH + 0.05;
      root.add(crown);
    }
    var glowA = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, glassH * 0.72), look.glow);
    glowA.position.set(0, yMid, 0);
    glowA.renderOrder = 1;
    root.add(glowA);
    var glowB = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.72, glassH * 0.72), look.glow);
    glowB.position.set(0, yMid, 0);
    glowB.rotation.y = Math.PI / 2;
    glowB.renderOrder = 1;
    root.add(glowB);
    var ceiling = box(THREE, w - 0.7, 0.03, d - 0.7, look.interior);
    ceiling.position.y = glassTop - 0.05;
    root.add(ceiling);
  }

  function badgeMat(THREE, color) {
    var c = new THREE.Color(color);
    return new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: 0.35,
      metalness: 0.45, roughness: 0.4
    });
  }

  /* Polished fashion-HQ mascots. Pastel cloth, not crayon primaries. */
  var MASCOT_LOOKS = [
    { cloth: 0xD4897A, trim: 0xA85A52, hair: 0x4A2C28 },
    { cloth: 0xC4A15A, trim: 0x8C7040, hair: 0x3A2A1C },
    { cloth: 0x6E9A84, trim: 0x3E6A56, hair: 0x2C2824 },
    { cloth: 0xA888C0, trim: 0x6E5088, hair: 0x2A2030 },
    { cloth: 0xD4A24A, trim: 0x8C6828, hair: 0x5A3418 },
    { cloth: 0x6E98B4, trim: 0x3E6880, hair: 0x1E2834 },
    { cloth: 0xD47884, trim: 0xA04858, hair: 0x5A3028 },
    { cloth: 0xB7A08A, trim: 0x7A6858, hair: 0x3A2C24 }
  ];

  function clothMat(THREE, hex) {
    var c = new THREE.Color(hex);
    return new THREE.MeshStandardMaterial({
      color: c, roughness: 0.58, metalness: 0.04,
      emissive: c, emissiveIntensity: 0.02
    });
  }

  function bodyScaleFor(shape) {
    if (shape === 'cube') return { x: 1.14, y: 0.8, z: 1.02 };
    if (shape === 'cylinder') return { x: 0.9, y: 0.94, z: 0.9 };
    if (shape === 'cone') return { x: 1.0, y: 0.74, z: 0.92 };
    if (shape === 'pyramid') return { x: 1.02, y: 0.7, z: 0.96 };
    if (shape === 'cross') return { x: 1.1, y: 0.76, z: 0.88 };
    return { x: 1.04, y: 0.78, z: 0.94 };
  }

  function addChibiLeg(THREE, cloth, shoeMat, side) {
    var pivot = new THREE.Group();
    pivot.position.set(side * 0.11, 0.4, 0);
    var thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.08, 4, 8), cloth);
    thigh.position.y = -0.1;
    thigh.castShadow = true;
    var knee = new THREE.Group();
    knee.position.y = -0.18;
    var shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.06, 4, 8), cloth);
    shin.position.y = -0.08;
    shin.castShadow = true;
    var shoe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), shoeMat);
    shoe.scale.set(1.05, 0.72, 1.35);
    shoe.position.set(0, -0.16, 0.03);
    shoe.castShadow = true;
    knee.add(shin);
    knee.add(shoe);
    pivot.add(thigh);
    pivot.add(knee);
    return { pivot: pivot, knee: knee };
  }

  function addChibiArm(THREE, cloth, skin, side) {
    var pivot = new THREE.Group();
    pivot.position.set(side * 0.26, 0.64, 0);
    var arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.08, 4, 8), cloth);
    arm.position.y = -0.1;
    arm.castShadow = true;
    var hand = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skin);
    hand.position.y = -0.2;
    hand.castShadow = true;
    pivot.add(arm);
    pivot.add(hand);
    return { pivot: pivot };
  }

  function addMascotFace(THREE, bust, look, headY) {
    function addEye(x) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), look.eyeWhite);
      eye.scale.set(1, 1, 0.45);
      eye.position.set(x, headY + 0.02, 0.25);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), look.pupil);
      pupil.position.set(x, headY + 0.012, 0.272);
      var glint = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), look.catchLt);
      glint.position.set(x + 0.012, headY + 0.028, 0.286);
      bust.add(eye);
      bust.add(pupil);
      bust.add(glint);
    }
    addEye(-0.09);
    addEye(0.09);
    var blushL = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), look.blush);
    blushL.scale.set(1.3, 0.7, 0.35);
    blushL.position.set(-0.13, headY - 0.06, 0.24);
    var blushR = blushL.clone();
    blushR.position.x = 0.13;
    bust.add(blushL);
    bust.add(blushR);
    var smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 14, Math.PI), look.mouth);
    smile.rotation.z = Math.PI;
    smile.position.set(0, headY - 0.1, 0.27);
    bust.add(smile);
  }

  function addMascotTrim(THREE, bust, hairMat, accent, shape, n, headY) {
    var kind = n % 6;
    if (kind === 0 || shape === 'pyramid') {
      var beret = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), accent);
      beret.scale.set(1.15, 0.38, 1.05);
      beret.position.set(0.02, headY + 0.24, 0.02);
      beret.rotation.z = -0.25;
      bust.add(beret);
    } else if (kind === 1) {
      var bow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), accent);
      bow.scale.set(1.6, 0.7, 0.5);
      bow.position.set(0.16, headY + 0.16, 0.08);
      var knot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), accent);
      knot.position.set(0.16, headY + 0.16, 0.1);
      bust.add(bow);
      bust.add(knot);
    } else if (kind === 2) {
      var glassMat = new THREE.MeshStandardMaterial({
        color: 0xCDB89A, metalness: 0.45, roughness: 0.35
      });
      [-0.09, 0.09].forEach(function (x) {
        var rim = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 12), glassMat);
        rim.position.set(x, headY + 0.02, 0.27);
        bust.add(rim);
      });
      var bridge = box(THREE, 0.04, 0.008, 0.008, glassMat);
      bridge.position.set(0, headY + 0.02, 0.275);
      bust.add(bridge);
    } else if (kind === 3 || shape === 'cross') {
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16), accent);
      band.rotation.x = Math.PI / 2;
      band.position.y = headY + 0.2;
      bust.add(band);
    } else if (kind === 4) {
      var bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), hairMat);
      bun.position.set(0.02, headY + 0.26, -0.04);
      bust.add(bun);
    } else {
      var scarf = box(THREE, 0.1, 0.16, 0.03, accent);
      scarf.position.set(0.14, 0.78, 0.12);
      scarf.rotation.z = -0.5;
      bust.add(scarf);
    }
    if (shape === 'cone') {
      var extra = box(THREE, 0.09, 0.14, 0.025, accent);
      extra.position.set(-0.12, 0.76, 0.14);
      extra.rotation.z = 0.4;
      bust.add(extra);
    }
  }

  function makeAgent(THREE, color, shape, shared) {
    var look = shared.look || mats(THREE);
    shared.look = look;
    shared.agentN = (shared.agentN || 0) + 1;
    var style = MASCOT_LOOKS[(shared.agentN - 1) % MASCOT_LOOKS.length];
    var cloth = clothMat(THREE, style.cloth);
    var hairMat = clothMat(THREE, style.hair);
    hairMat.roughness = 0.62;
    hairMat.emissiveIntensity = 0.03;
    var accent = badgeMat(THREE, style.trim);
    var zonePin = badgeMat(THREE, color);
    var bs = bodyScaleFor(shape);
    var headY = 0.98;

    var group = new THREE.Group();
    var legL = addChibiLeg(THREE, cloth, look.shoe, -1);
    var legR = addChibiLeg(THREE, cloth, look.shoe, 1);
    group.add(legL.pivot);
    group.add(legR.pivot);

    var bust = new THREE.Group();
    var jacket = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), cloth);
    body.scale.set(bs.x, bs.y, bs.z);
    body.position.y = 0.6;
    body.castShadow = true;
    jacket.add(body);
    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), look.belly);
    belly.scale.set(1.05, 0.85, 0.55);
    belly.position.set(0, 0.56, 0.16 * bs.z);
    jacket.add(belly);
    bust.add(jacket);

    var armL = addChibiArm(THREE, cloth, look.skin, -1);
    var armR = addChibiArm(THREE, cloth, look.skin, 1);
    bust.add(armL.pivot);
    bust.add(armR.pivot);

    var collar = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), look.belly);
    collar.scale.set(1.1, 0.45, 1.0);
    collar.position.y = 0.78;
    bust.add(collar);

    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), look.skin);
    head.scale.set(1.02, 0.98, 0.96);
    head.position.y = headY;
    head.castShadow = true;
    bust.add(head);
    var hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), hairMat);
    hairCap.scale.set(1.05, 0.72, 1.02);
    hairCap.position.y = headY + 0.08;
    bust.add(hairCap);
    var tuft = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hairMat);
    tuft.scale.set(0.8, 1.2, 0.7);
    tuft.position.set(-0.08, headY + 0.28, 0.04);
    tuft.rotation.z = 0.4;
    bust.add(tuft);
    addMascotFace(THREE, bust, look, headY);
    addMascotTrim(THREE, bust, hairMat, accent, shape, shared.agentN, headY);

    var badge = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), zonePin);
    badge.scale.set(1.2, 1.2, 0.45);
    badge.position.set(0.12, 0.66, 0.2);
    bust.add(badge);
    group.add(bust);

    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 18),
      new THREE.MeshBasicMaterial({ color: 0xCDB8A4, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    group.add(shadow);

    var glow = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 24),
      new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    glow.visible = false;
    group.add(glow);

    group.userData.glow = glow;
    group.userData.fashion = true;
    group.userData.mascot = true;
    group.userData.parts = {
      bust: bust,
      jacket: jacket,
      head: head,
      badge: badge,
      collar: collar,
      legL: legL,
      legR: legR,
      armL: armL,
      armR: armR
    };
    group.userData.poseHome = { bustY: 0 };
    group.userData.baseY = 0;
    return group;
  }

  function setLegs(parts, lx, lk, rx, rk) {
    parts.legL.pivot.rotation.x = lx;
    parts.legL.knee.rotation.x = lk;
    parts.legR.pivot.rotation.x = rx;
    parts.legR.knee.rotation.x = rk;
  }

  function setArms(parts, lx, rx) {
    if (!parts.armL || !parts.armR) return;
    parts.armL.pivot.rotation.x = lx;
    parts.armR.pivot.rotation.x = rx;
  }

  function applyPose(bot, agent, t) {
    var parts = bot.userData.parts;
    if (!parts || !parts.legL) return;
    var phase = bot.userData.phase || 0;
    var sit = agent && (agent.anim === 'sit' || agent.anim === 'meeting');
    var walk = agent && agent.anim === 'walk';
    var baseY = bot.userData.baseY || 0;
    if (agent) {
      bot.position.x = agent.x;
      bot.position.z = agent.z;
      bot.rotation.y = agent.yaw;
    }
    if (walk) {
      var s = Math.sin(t * 7.4 + phase);
      setLegs(parts, -s * 0.7, Math.max(0, s) * 0.6, s * 0.7, Math.max(0, -s) * 0.6);
      setArms(parts, s * 0.55, -s * 0.55);
      parts.bust.position.y = Math.abs(s) * 0.035;
      parts.bust.rotation.x = 0.05;
      parts.bust.rotation.y = 0;
      parts.bust.rotation.z = s * 0.06;
      bot.position.y = baseY + Math.abs(s) * 0.02;
    } else if (sit) {
      setLegs(parts, -1.15, 1.45, -1.15, 1.45);
      setArms(parts, -0.55, -0.55);
      parts.bust.position.y = -0.12;
      parts.bust.rotation.x = 0.16;
      parts.bust.rotation.y = 0;
      parts.bust.rotation.z = 0;
      bot.position.y = baseY;
      bot.rotation.y = agent.yaw;
    } else {
      var idle = Math.sin(t * 1.5 + phase);
      setLegs(parts, idle * 0.05, 0, -idle * 0.05, 0);
      setArms(parts, idle * 0.08, -idle * 0.08);
      parts.bust.position.y = Math.abs(idle) * 0.02;
      parts.bust.rotation.x = 0;
      parts.bust.rotation.y = idle * 0.08;
      parts.bust.rotation.z = idle * 0.035;
      bot.position.y = baseY;
      if (!agent) bot.rotation.y = idle * 0.08;
    }
  }

  function paintSky(THREE, mesh, topHex, horHex, botHex) {
    var geo = mesh.geometry;
    var pos = geo.attributes.position;
    var col = geo.attributes.color;
    var top = new THREE.Color(topHex);
    var hor = new THREE.Color(horHex);
    var bot = new THREE.Color(botHex);
    var tmp = new THREE.Color();
    var radius = geo.parameters.radius || 140;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / radius;
      /* Blue (or peach) starts just above the horizon so a horizontal camera still sees sky. */
      if (y > 0) tmp.copy(hor).lerp(top, Math.min(1, y / 0.16));
      else tmp.copy(bot).lerp(hor, Math.min(1, (y + 0.2) / 0.2));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
  }

  function makeSky(THREE) {
    var geo = new THREE.SphereGeometry(140, 28, 18);
    var n = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    var mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
    }));
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    return mesh;
  }

  function setEnv(THREE, renderer, scene, topHex, horizonHex) {
    if (!renderer || !THREE.PMREMGenerator) return;
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(12, 24, 16),
      new THREE.MeshBasicMaterial({ color: topHex, side: THREE.BackSide })
    ));
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: horizonHex, side: THREE.BackSide })
    ));
    var tex = pmrem.fromScene(envScene, 0.04).texture;
    if (scene.userData.envMap) scene.userData.envMap.dispose();
    scene.environment = tex;
    scene.userData.envMap = tex;
    pmrem.dispose();
  }

  function createWash(THREE, scene, renderer) {
    var sky = makeSky(THREE);
    scene.add(sky);
    scene.userData.sky = sky;

    var plazaMat = new THREE.MeshStandardMaterial({
      color: 0xE4CDB6, metalness: 0.24, roughness: 0.42,
      emissive: 0xF0D8C0, emissiveIntensity: 0.04
    });
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(96, 72), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = -0.36;
    plaza.receiveShadow = true;
    scene.add(plaza);
    var innerMat = new THREE.MeshStandardMaterial({
      color: 0xF0DCC8, metalness: 0.34, roughness: 0.32,
      emissive: 0xF6E6D4, emissiveIntensity: 0.05
    });
    var inner = new THREE.Mesh(new THREE.CircleGeometry(9.2, 48), innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = -0.348;
    inner.receiveShadow = true;
    scene.add(inner);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(7.4, 0.03, 8, 64),
      new THREE.MeshStandardMaterial({
        color: BRASS, metalness: 0.42, roughness: 0.36,
        emissive: BRASS, emissiveIntensity: 0.18
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.342;
    scene.add(ring);
    scene.userData.plazaMat = plazaMat;
    scene.userData.plazaInner = innerMat;

    var hemi = new THREE.HemisphereLight(0xD7EBFA, 0xE4C8A8, 0.42);
    var amb = new THREE.AmbientLight(0xFFF1E2, 0.16);
    var moon = new THREE.DirectionalLight(0xFFF4E4, 0.72);
    moon.position.set(12, 26, 14);
    var upwash = new THREE.DirectionalLight(0xFFF1E4, 0.22);
    upwash.position.set(4, 8, 18);
    var rim = new THREE.DirectionalLight(0xE7F0FA, 0.2);
    rim.position.set(-16, 14, -10);
    scene.add(hemi);
    scene.add(amb);
    scene.add(moon);
    scene.add(upwash);
    scene.add(rim);
    function apply(mode, look) {
      var gold = mode !== 'day';
      var clear = gold ? GOLD_SKY : DAY_SKY;
      var haze = gold ? GOLD_HAZE : DAY_HAZE;
      scene.background.set(clear);
      if (scene.fog) {
        scene.fog.color.set(haze);
        scene.fog.density = gold ? 0.0035 : 0.0028;
      }
      if (renderer) renderer.setClearColor(clear, 1);
      if (renderer && renderer.toneMappingExposure != null) {
        renderer.toneMappingExposure = gold ? 0.86 : 0.84;
      }
      paintSky(THREE, sky, gold ? 0xE8895C : 0x6EB4EA, gold ? 0xF8DCC4 : 0xF6E0C4, gold ? 0xE4C4A4 : 0xE7D0B6);
      hemi.color.set(gold ? 0xFFC89A : 0xD7EBFA);
      hemi.groundColor.set(gold ? 0xE2B48C : 0xE4C8A8);
      hemi.intensity = gold ? 0.4 : 0.42;
      amb.color.set(gold ? 0xFFD8B4 : 0xFFF1E2);
      amb.intensity = gold ? 0.16 : 0.16;
      moon.color.set(gold ? 0xFFB070 : 0xFFF4E4);
      moon.intensity = gold ? 0.7 : 0.72;
      moon.position.set(gold ? 18 : 12, gold ? 11 : 24, gold ? 10 : 14);
      upwash.color.set(gold ? 0xFFD0A4 : 0xFFF1E0);
      upwash.intensity = gold ? 0.28 : 0.16;
      rim.color.set(gold ? 0xFFC89A : 0xD5E6F6);
      rim.intensity = gold ? 0.22 : 0.14;
      plazaMat.color.set(gold ? 0xE8C4A0 : 0xE4CDB6);
      plazaMat.emissive.set(gold ? 0xF0C8A4 : 0xF0D8C0);
      innerMat.color.set(gold ? 0xF0D0B0 : 0xF0DCC8);
      if (look) {
        look.glass.color.set(gold ? 0xFFE8D0 : 0xE4F2FB);
        look.glass.opacity = gold ? 0.16 : 0.16;
        look.glass.emissive.set(gold ? 0xFFD8B0 : 0xFFF6EA);
        look.glass.emissiveIntensity = 0.03;
        look.glass.roughness = 0.08;
        look.glass.metalness = 0.06;
        look.brass.color.set(gold ? 0xD4A85A : 0xC4A36A);
        look.brass.emissive.set(gold ? 0xD4A85A : 0xC4A36A);
        look.brass.emissiveIntensity = gold ? 0.16 : 0.1;
        look.band.color.set(gold ? 0xF0D2B0 : 0xE7D3B8);
        look.band.emissive.set(gold ? 0xF0C8A0 : 0xF0DCC4);
        look.band.emissiveIntensity = 0.05;
        look.glow.color.set(gold ? 0xFFD0A0 : 0xFFE7CC);
        look.glow.opacity = gold ? 0.14 : 0.1;
        look.interior.color.set(gold ? 0xF6D8C0 : 0xF4E6D6);
        look.interior.emissive.set(gold ? 0xFFD0A8 : 0xFFE8D0);
        look.interior.emissiveIntensity = gold ? 0.14 : 0.1;
      }
      setEnv(THREE, renderer, scene, gold ? 0xE8895C : 0x6EB4EA, gold ? 0xF8DCC4 : 0xF6E0C4);
      return gold ? 'gold' : 'day';
    }
    return { hemi: hemi, moon: moon, apply: apply };
  }

  root.HQLook = {
    lobbyH: LOBBY_H,
    pitch: PITCH,
    shellW: SHELL_W,
    shellD: SHELL_D,
    floorBaseY: floorBaseY,
    mats: mats,
    addCurtain: addCurtain,
    makeAgent: makeAgent,
    applyPose: applyPose,
    createWash: createWash
  };
})(typeof window !== 'undefined' ? window : globalThis);
