/* Shell A curtain wall + stylized fashion figures.
   Proportions only — a night glass tower with a gold mullion module.
   Figures are original low-poly meshes, not a third-party avatar service. */
(function (root) {
  var BRASS = 0xB79F80;
  var BAND = 0xCDBBA4;
  var CLOTH = 0x2A2623;
  var SHIRT = 0xE7DDD0;
  var SKIN = 0xC4A484;
  var HAIR = 0x1A1614;
  var SHOE = 0x14110F;

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
        color: BRASS, metalness: 0.38, roughness: 0.34,
        emissive: BRASS, emissiveIntensity: 0.34
      }),
      band: new THREE.MeshStandardMaterial({
        color: BAND, metalness: 0.22, roughness: 0.48,
        emissive: 0xE8D7C0, emissiveIntensity: 0.08
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xF4FBFF, transparent: true, opacity: 0.06,
        metalness: 0.02, roughness: 0.04,
        transmission: 0.0,
        emissive: 0xFFF4E4, emissiveIntensity: 0.04,
        side: THREE.DoubleSide, depthWrite: false
      }),
      glow: new THREE.MeshBasicMaterial({
        color: 0xFFF6EA, transparent: true, opacity: 0.16,
        depthWrite: false, side: THREE.DoubleSide
      }),
      interior: new THREE.MeshStandardMaterial({
        color: 0xF7F1E8, roughness: 0.86, metalness: 0.02,
        emissive: 0xFFF3E4, emissiveIntensity: 0.18
      }),
      cloth: new THREE.MeshStandardMaterial({ color: CLOTH, roughness: 0.78, metalness: 0.04 }),
      shirt: new THREE.MeshStandardMaterial({ color: SHIRT, roughness: 0.7, metalness: 0.02 }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62, metalness: 0.02 }),
      hair: new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.7, metalness: 0.08 }),
      shoe: new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.55, metalness: 0.2 }),
      trouser: new THREE.MeshStandardMaterial({ color: 0x1E1B19, roughness: 0.8, metalness: 0.05 })
    };
  }

  function box(THREE, w, h, d, material) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    return m;
  }

  function addFacade(THREE, parent, look, length, glassH, yMid, x, z, rotY) {
    /* One center mullion on the long face only. No end bars — corners are round posts. */
    var mullion = 0.02;
    var splits = length > 7.5 ? 1 : 0;
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
    var head = box(THREE, length, 0.016, 0.03, look.brass);
    head.position.y = glassH / 2;
    head.position.z = 0.02;
    g.add(head);
    var sill = box(THREE, length, 0.014, 0.03, look.brass);
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
        new THREE.CylinderGeometry(0.055, 0.055, storyH - 0.06, 16),
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
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, glassH * 0.62), look.glow);
    glow.position.set(0, yMid, -0.2);
    glow.renderOrder = 1;
    root.add(glow);
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

  function cutFor(shape) {
    if (shape === 'cube') return { shoulder: 0.5, coat: 0.62, waist: 0.34, collar: 0.1 };
    if (shape === 'cylinder') return { shoulder: 0.36, coat: 0.56, waist: 0.28, collar: 0.08 };
    if (shape === 'cone') return { shoulder: 0.4, coat: 0.46, waist: 0.3, collar: 0.07, scarf: true };
    if (shape === 'pyramid') return { shoulder: 0.42, coat: 0.34, waist: 0.3, collar: 0.06 };
    if (shape === 'cross') return { shoulder: 0.4, coat: 0.5, waist: 0.3, collar: 0.16 };
    return { shoulder: 0.42, coat: 0.44, waist: 0.31, collar: 0.08 };
  }

  function addLeg(THREE, look, side) {
    var pivot = new THREE.Group();
    pivot.position.set(side * 0.1, 0.7, 0);
    var thigh = box(THREE, 0.09, 0.36, 0.09, look.trouser);
    thigh.position.y = -0.18;
    var knee = new THREE.Group();
    knee.position.y = -0.36;
    var shin = box(THREE, 0.08, 0.32, 0.08, look.trouser);
    shin.position.y = -0.16;
    var shoe = box(THREE, 0.1, 0.045, 0.18, look.shoe);
    shoe.position.set(0, -0.34, 0.03);
    knee.add(shin);
    knee.add(shoe);
    pivot.add(thigh);
    pivot.add(knee);
    return { pivot: pivot, knee: knee };
  }

  var HAIR_COLORS = [0x1A120E, 0x3A2418, 0x5C3A28, 0x2A2A32, 0x6A4030];

  function makeAgent(THREE, color, shape, shared) {
    var look = shared.look || mats(THREE);
    shared.look = look;
    shared.agentN = (shared.agentN || 0) + 1;
    var female = shared.agentN % 2 === 0;
    var cut = cutFor(shape);
    if (female) {
      cut = { shoulder: cut.shoulder * 0.9, coat: Math.min(cut.coat, 0.46), waist: cut.waist * 0.88, collar: 0.06 };
    }
    var group = new THREE.Group();
    var accent = badgeMat(THREE, color);
    var legL = addLeg(THREE, look, -1);
    var legR = addLeg(THREE, look, 1);
    group.add(legL.pivot);
    group.add(legR.pivot);

    var bust = new THREE.Group();
    var jacket = new THREE.Group();
    var yoke = box(THREE, cut.shoulder, 0.12, 0.2, look.cloth);
    yoke.position.y = 1.08;
    var torso = box(THREE, cut.waist, cut.coat, 0.16, look.cloth);
    torso.position.y = 1.02 - cut.coat / 2;
    jacket.add(yoke);
    jacket.add(torso);
    var shirt = box(THREE, cut.waist * 0.28, cut.coat * 0.55, 0.02, look.shirt);
    shirt.position.set(0, 1.0 - cut.coat * 0.28, 0.09);
    jacket.add(shirt);
    var lapelL = box(THREE, 0.035, cut.coat * 0.42, 0.02, accent);
    lapelL.position.set(-cut.waist * 0.22, 1.02 - cut.coat * 0.22, 0.09);
    lapelL.rotation.z = 0.18;
    var lapelR = lapelL.clone();
    lapelR.position.x *= -1;
    lapelR.rotation.z = -0.18;
    jacket.add(lapelL);
    jacket.add(lapelR);
    jacket.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    bust.add(jacket);

    var collar = box(THREE, cut.waist * 0.55, cut.collar, 0.12, shape === 'cross' ? accent : look.cloth);
    collar.position.y = 1.12;
    bust.add(collar);
    if (cut.scarf) {
      var scarf = box(THREE, 0.16, 0.28, 0.04, accent);
      scarf.position.set(0.12, 0.98, 0.08);
      scarf.rotation.z = -0.4;
      bust.add(scarf);
    }

    var skin = new THREE.MeshStandardMaterial({ color: 0xF6D3C4, roughness: 0.55, metalness: 0.02 });
    var hairMat = new THREE.MeshStandardMaterial({
      color: HAIR_COLORS[shared.agentN % HAIR_COLORS.length],
      roughness: 0.45, metalness: 0.08
    });
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), skin);
    head.scale.set(0.96, 1.05, 0.92);
    head.position.y = 1.22;
    head.castShadow = true;
    bust.add(head);
    var hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.132, 14, 12), hairMat);
    hairCap.scale.set(1.02, female ? 0.78 : 0.62, 1.05);
    hairCap.position.y = female ? 1.3 : 1.28;
    bust.add(hairCap);
    var bang = box(THREE, 0.2, 0.06, 0.04, hairMat);
    bang.position.set(0, 1.3, 0.1);
    bust.add(bang);
    if (female) {
      var lockL = box(THREE, 0.05, 0.42, 0.04, hairMat);
      lockL.position.set(-0.12, 1.08, 0.02);
      lockL.rotation.z = 0.08;
      var lockR = lockL.clone();
      lockR.position.x = 0.12;
      lockR.rotation.z = -0.08;
      bust.add(lockL);
      bust.add(lockR);
    } else {
      var sweep = box(THREE, 0.16, 0.04, 0.08, hairMat);
      sweep.position.set(0.04, 1.32, 0.06);
      sweep.rotation.z = -0.35;
      bust.add(sweep);
    }
    var iris = new THREE.MeshBasicMaterial({ color: 0x2A211C });
    var white = new THREE.MeshBasicMaterial({ color: 0xFFFBFA });
    var catchLt = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    function addEye(x) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), white);
      eye.scale.set(1.15, 1.35, 0.45);
      eye.position.set(x, 1.23, 0.1);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), iris);
      pupil.position.set(x, 1.225, 0.118);
      var glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), catchLt);
      glint.position.set(x + 0.008, 1.236, 0.126);
      bust.add(eye);
      bust.add(pupil);
      bust.add(glint);
    }
    addEye(-0.045);
    addEye(0.045);
    var blushMat = new THREE.MeshBasicMaterial({ color: 0xE8A0A0, transparent: true, opacity: 0.45 });
    var blushL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), blushMat);
    blushL.scale.set(1.4, 0.7, 0.3);
    blushL.position.set(-0.07, 1.19, 0.1);
    var blushR = blushL.clone();
    blushR.position.x = 0.07;
    bust.add(blushL);
    bust.add(blushR);
    var mouth = box(THREE, 0.02, 0.004, 0.004, new THREE.MeshBasicMaterial({ color: 0xC47A78 }));
    mouth.position.set(0, 1.16, 0.112);
    bust.add(mouth);

    var badge = box(THREE, 0.06, 0.035, 0.015, accent);
    badge.position.set(cut.waist * 0.28, 1.0, 0.09);
    bust.add(badge);
    group.add(bust);

    var glow = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.28, 24),
      new THREE.MeshBasicMaterial({ color: BRASS, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    glow.visible = false;
    group.add(glow);

    group.userData.glow = glow;
    group.userData.fashion = true;
    group.userData.parts = {
      bust: bust,
      jacket: jacket,
      head: head,
      badge: badge,
      collar: collar,
      legL: legL,
      legR: legR
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
      var s = Math.sin(t * 8.2 + phase);
      setLegs(parts, s * 0.7, Math.max(0, -s) * 1.05, -s * 0.7, Math.max(0, s) * 1.05);
      parts.bust.position.y = Math.abs(s) * 0.03;
      parts.bust.rotation.x = 0.06;
      bot.position.y = baseY + Math.abs(s) * 0.02;
    } else if (sit) {
      setLegs(parts, 1.15, -1.25, 1.15, -1.25);
      parts.bust.position.y = -0.16;
      parts.bust.rotation.x = 0.08;
      bot.position.y = baseY;
      bot.rotation.y = agent.yaw;
    } else {
      var idle = Math.sin(t * 1.3 + phase);
      setLegs(parts, idle * 0.04, 0, -idle * 0.04, 0);
      parts.bust.position.y = idle * 0.012;
      parts.bust.rotation.x = 0;
      parts.bust.rotation.y = idle * 0.06;
      bot.position.y = baseY;
      if (!agent) bot.rotation.y = idle * 0.05;
    }
  }

  function setEnv(THREE, renderer, scene, night) {
    if (!renderer || !THREE.PMREMGenerator) return;
    var pmrem = new THREE.PMREMGenerator(renderer);
    var envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(12, 24, 16),
      new THREE.MeshBasicMaterial({ color: night ? 0x8EACC8 : 0xFFF6EA, side: THREE.BackSide })
    ));
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: night ? 0xE8C49A : 0xF4E2CC, side: THREE.BackSide })
    ));
    var tex = pmrem.fromScene(envScene, 0.04).texture;
    if (scene.userData.envMap) scene.userData.envMap.dispose();
    scene.environment = tex;
    scene.userData.envMap = tex;
    pmrem.dispose();
  }

  function createWash(THREE, scene, renderer) {
    var hemi = new THREE.HemisphereLight(0x243044, 0x140E0C, 0.34);
    var amb = new THREE.AmbientLight(0x14110F, 0.16);
    var moon = new THREE.DirectionalLight(0xD5DEEA, 0.46);
    moon.position.set(14, 22, 10);
    var upwash = new THREE.DirectionalLight(0xE4C49A, 0.34);
    upwash.position.set(2, -4, 16);
    var rim = new THREE.DirectionalLight(0xB79F80, 0.16);
    rim.position.set(-12, 10, -14);
    scene.add(hemi);
    scene.add(amb);
    scene.add(moon);
    scene.add(upwash);
    scene.add(rim);
    function apply(mode, look) {
      var night = mode !== 'day';
      scene.background.set(night ? 0x07080C : 0xD7D0C4);
      if (scene.fog) {
        scene.fog.color.set(night ? 0x07080C : 0xD7D0C4);
        scene.fog.density = night ? 0.008 : 0.004;
      }
      hemi.color.set(night ? 0x243044 : 0xF3EEE6);
      hemi.groundColor.set(night ? 0x140E0C : 0x8C7B68);
      hemi.intensity = night ? 0.55 : 0.85;
      amb.color.set(night ? 0xE7D7C4 : 0xF6F0E6);
      amb.intensity = night ? 0.38 : 0.42;
      moon.color.set(night ? 0xF2E6D4 : 0xFFF8EE);
      moon.intensity = night ? 0.72 : 1.15;
      moon.position.set(night ? 14 : 10, night ? 22 : 28, night ? 10 : 12);
      upwash.color.set(night ? 0xE4C49A : 0xF4E6D2);
      upwash.intensity = night ? 0.34 : 0.08;
      rim.intensity = night ? 0.16 : 0.05;
      if (look) {
        look.glass.color.set(night ? 0xFFF1DE : 0xF7FCFF);
        look.glass.opacity = night ? 0.07 : 0.035;
        look.glass.emissive.set(night ? 0xFFE4C2 : 0xFFFFFF);
        look.glass.emissiveIntensity = night ? 0.05 : 0.02;
        look.glass.roughness = 0.03;
        look.glass.metalness = 0.02;
        look.brass.emissiveIntensity = night ? 0.55 : 0.22;
        look.band.color.set(night ? 0xE4D3BC : 0xF3E7D6);
        look.band.emissive.set(night ? 0xE8D0B0 : 0xF7EDE0);
        look.band.emissiveIntensity = night ? 0.16 : 0.08;
        look.glow.color.set(night ? 0xFFE3BF : 0xFFF9F1);
        look.glow.opacity = night ? 0.22 : 0.14;
        look.interior.emissiveIntensity = night ? 0.28 : 0.12;
      }
      setEnv(THREE, renderer, scene, night);
      return night ? 'night' : 'day';
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
