/* East wing, glass skybridge, elevator shaft, plaza trees and water.
   Bright shell — gold lines, clear glass, warm stone. No dark void. */
(function (root) {
  var LEAF = [0x2E8A3E, 0x4AAA48, 0x1E7A40, 0x6EBE5C];

  function tree(THREE, mats, x, z, scale) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var s = scale || 1;
    var trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.85 * s, 6),
      mats.pot
    );
    trunk.position.y = 0.42 * s;
    g.add(trunk);
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.55 * s, 10, 8),
      new THREE.MeshStandardMaterial({
        color: LEAF[(x * 3 + z) & 3],
        roughness: 0.74,
        emissive: 0x3E9A44,
        emissiveIntensity: 0.26
      })
    );
    canopy.position.y = 0.95 * s;
    canopy.scale.y = 0.8;
    g.add(canopy);
    var puff = canopy.clone();
    puff.position.set(0.22 * s, 0.78 * s, 0.1 * s);
    puff.scale.setScalar(0.72);
    g.add(puff);
    return g;
  }

  function wingStory(THREE, look, w, d, h, y) {
    var g = new THREE.Group();
    var slab = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.2, 0.16, d - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0xE4B45C, roughness: 0.46, metalness: 0.08,
        emissive: 0xE8B050, emissiveIntensity: 0.16
      })
    );
    slab.position.y = y + 0.08;
    slab.receiveShadow = true;
    g.add(slab);
    var glassH = Math.max(0.8, h - 0.28);
    var yMid = y + 0.2 + glassH / 2;
    function facade(len, px, pz, rot) {
      var pane = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.2, glassH), look.glass);
      pane.position.set(px, yMid, pz);
      pane.rotation.y = rot;
      g.add(pane);
      var bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.028, 0.04), look.brass);
      bar.position.set(px, y + h - 0.04, pz);
      bar.rotation.y = rot;
      g.add(bar);
    }
    facade(w, 0, d / 2, 0);
    facade(w, 0, -d / 2, Math.PI);
    facade(d, w / 2, 0, Math.PI / 2);
    facade(d, -w / 2, 0, -Math.PI / 2);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, h - 0.04, 10),
        look.brass
      );
      post.position.set(s[0] * (w / 2 - 0.02), y + h / 2, s[1] * (d / 2 - 0.02));
      g.add(post);
    });
    var glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.7, glassH * 0.65),
      look.glow
    );
    glow.position.set(0, yMid, 0);
    g.add(glow);
    return g;
  }

  function build(opts) {
    var THREE = opts.THREE;
    var scene = opts.scene;
    var look = opts.look;
    var mats = opts.mats;
    var bridgeY = opts.bridgeY;
    var topY = opts.topY;
    var makePlant = opts.makePlant;
    var shared = opts.shared;
    var makeBot = opts.makeBot;

    var trees = [
      [8.2, 3.6, 1.15], [11.4, 4.4, 1.35], [13.6, 3.1, 0.95],
      [7.4, -4.6, 1.25], [10.2, -6.2, 1.45], [13.2, -4.2, 1.05],
      [15.6, 5.2, 1.1], [6.2, 5.4, 0.9], [16.8, -5.4, 1.2],
      [-6.4, 3.8, 1.15], [-7.2, -3.4, 1.3], [20.5, 2.2, 1.05]
    ];
    trees.forEach(function (t) { scene.add(tree(THREE, mats, t[0], t[1], t[2])); });

    if (makePlant) {
      [[5.6, 2.2], [12.4, -2.6], [15.2, 2.8], [-5.8, -1.6]].forEach(function (p) {
        var plant = makePlant(shared);
        plant.scale.setScalar(1.7);
        plant.position.set(p[0], 0, p[1]);
        scene.add(plant);
      });
    }

    var pathMat = new THREE.MeshStandardMaterial({
      color: 0xDCC4A8, roughness: 0.58, metalness: 0.08,
      emissive: 0xE8D0B4, emissiveIntensity: 0.05
    });
    var path = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.04, 1.35), pathMat);
    path.position.set(9.7, -0.32, 1.15);
    path.receiveShadow = true;
    scene.add(path);
    var path2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 4.2), pathMat);
    path2.position.set(10.6, -0.32, -3.4);
    scene.add(path2);

    [[8.4, 2.4, 2.2, 0.28], [12.8, -3.6, 1.6, 0.32], [6.8, -5.2, 2.4, 0.26]].forEach(function (h) {
      var hedge = new THREE.Mesh(
        new THREE.BoxGeometry(h[2], h[3], 0.42),
        new THREE.MeshStandardMaterial({ color: 0x248A38, roughness: 0.66, emissive: 0x3E9A44, emissiveIntensity: 0.24 })
      );
      hedge.position.set(h[0], -0.16, h[1]);
      scene.add(hedge);
    });

    var water = new THREE.Mesh(
      new THREE.CircleGeometry(2.15, 28),
      new THREE.MeshStandardMaterial({
        color: 0x5EB8D4, transparent: true, opacity: 0.82,
        roughness: 0.14, metalness: 0.08,
        emissive: 0x7ED0E8, emissiveIntensity: 0.16
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(10.6, -0.3, -5.6);
    scene.add(water);
    var rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.045, 8, 28),
      look.brass
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(10.6, -0.28, -5.6);
    scene.add(rim);

    var deckY = bridgeY - 0.04;
    var deck = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.08, 1.45),
      new THREE.MeshStandardMaterial({
        color: 0xE4B050, roughness: 0.42, metalness: 0.08,
        emissive: 0xE8B040, emissiveIntensity: 0.18
      })
    );
    deck.position.set(9.65, deckY, 0.05);
    deck.receiveShadow = true;
    scene.add(deck);
    [-0.68, 0.72].forEach(function (z) {
      var side = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 0.85), look.glass);
      side.position.set(9.65, deckY + 0.5, z);
      scene.add(side);
      var rail = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.03, 0.04), look.brass);
      rail.position.set(9.65, deckY + 0.92, z);
      scene.add(rail);
    });

    var wing = new THREE.Group();
    wing.position.set(17.55, 0, 0);
    var w = 6.4;
    var d = 4.4;
    wing.add(wingStory(THREE, look, w, d, 3.15, 0));
    wing.add(wingStory(THREE, look, w, d, 3.35, 3.15));
    var bridgeBase = bridgeY - 0.19;
    wing.add(wingStory(THREE, look, w, d, 2.45, bridgeBase));
    var cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.08, d + 0.16), look.band);
    cap.position.y = bridgeBase + 2.42;
    wing.add(cap);
    if (mats) {
      var desk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 0.5), mats.wood);
      desk.position.set(-0.4, bridgeY + 0.32, 0.7);
      wing.add(desk);
      var desk2 = desk.clone();
      desk2.position.set(0.9, bridgeY + 0.32, -0.6);
      wing.add(desk2);
    }
    if (makePlant) {
      var plant = makePlant(shared);
      plant.position.set(1.6, bridgeY - 0.19, 1.2);
      wing.add(plant);
    }
    var wingBots = [];
    if (makeBot) {
      [{ x: -0.4, z: 1.25, yaw: Math.PI }, { x: 0.9, z: -1.15, yaw: 0 }].forEach(function (p, i) {
        var bot = makeBot(i ? '#C4A15A' : '#7E9A72', 'rounded', shared);
        bot.userData.baseScale = 0.84;
        bot.userData.baseY = bridgeY;
        bot.userData.phase = i;
        bot.scale.setScalar(0.84);
        bot.position.set(p.x, bridgeY, p.z);
        bot.rotation.y = p.yaw;
        wing.add(bot);
        wingBots.push(bot);
      });
    }
    scene.add(wing);

    var shaft = new THREE.Group();
    shaft.position.set(-4.12, 0, 0.02);
    var shaftH = Math.max(6, topY);
    [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].forEach(function (p) {
      var post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, shaftH, 8),
        look.brass
      );
      post.position.set(p[0], shaftH / 2, p[1]);
      shaft.add(post);
    });
    var shaftGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, shaftH * 0.92),
      new THREE.MeshStandardMaterial({
        color: 0xB5DCF4, transparent: true, opacity: 0.26,
        roughness: 0.08, metalness: 0.02,
        emissive: 0xD4EEFC, emissiveIntensity: 0.04,
        side: THREE.DoubleSide, depthWrite: false
      })
    );
    shaftGlass.position.set(0.34, shaftH * 0.48, 0);
    shaftGlass.rotation.y = Math.PI / 2;
    shaft.add(shaftGlass);
    var shaftFront = shaftGlass.clone();
    shaftFront.rotation.y = 0;
    shaftFront.position.set(0, shaftH * 0.48, 0.34);
    shaft.add(shaftFront);
    var car = new THREE.Group();
    var pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.06, 0.62),
      new THREE.MeshStandardMaterial({
        color: 0xE8C070, metalness: 0.16, roughness: 0.4,
        emissive: 0xE8B050, emissiveIntensity: 0.24
      })
    );
    car.add(pad);
    var glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.04, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xFFE1B0 })
    );
    glow.position.y = 0.08;
    car.add(glow);
    shaft.add(car);
    scene.add(shaft);

    return { water: water, car: car, wingBots: wingBots };
  }

  root.HQCampusScene = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
