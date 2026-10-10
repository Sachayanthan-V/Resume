/* Drive My Portfolio — game logic (Three.js r160, no build step). */
setTimeout(() => { // a beat later, so the loader can paint before the world is built
  'use strict';
  const D = window.PORTFOLIO;
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  // ---------- Text / DOM setup ----------
  $('#hud-name').textContent = D.name;
  $('#hud-role').textContent = D.role;
  $('#intro-name').textContent = D.name;
  $('#intro-role').textContent = D.role;
  $('#intro-tag').textContent = D.tagline;
  $('#classic-name').textContent = D.name;
  $('#classic-role').textContent = D.role + ' — ' + D.tagline;
  $('#classic-sections').innerHTML = D.sections.map(s =>
    `<section style="border-top:5px solid ${s.color}"><h2>${s.title}</h2><div class="content">${s.body}</div></section>`
  ).join('');

  // ---------- Renderer / scene ----------
  const canvas = $('#scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    $('#intro .keys').innerHTML = '<b>WebGL is not available in this browser — use “View the website”.</b>';
    $('#btn-start').classList.add('hidden');
    wireOverlays();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const SKY = 0xbfe3ff;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 140, 420);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);

  // ---------- Sky: day/night dome + celestial objects (all follow the camera) ----------
  const skyGroup = new THREE.Group(); scene.add(skyGroup);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      dTop: { value: new THREE.Color(0x4f9fe8) }, dBot: { value: new THREE.Color(0xd6ecff) },
      nTop: { value: new THREE.Color(0x02030b) }, nBot: { value: new THREE.Color(0x101632) },
      sunCol: { value: new THREE.Color(0xff8a4c) }, uNight: { value: 0 }, uOvercast: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform vec3 dTop, dBot, nTop, nBot, sunCol, uSunDir; uniform float uNight, uOvercast; varying vec3 vP;
      float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 p = normalize(vP); float h = clamp(p.y*1.6 + 0.08, 0.0, 1.0);
        vec3 col = mix(mix(dBot, dTop, pow(h, 0.8)), mix(nBot, nTop, pow(h, 0.55)), uNight);
        vec3 sd3 = normalize(uSunDir);
        float twilight = smoothstep(-0.3, 0.0, sd3.y) * (1.0 - smoothstep(0.02, 0.4, sd3.y));
        float toward = pow(max(dot(normalize(vec3(p.x, 0.0, p.z)), normalize(vec3(sd3.x, 0.0, sd3.z))), 0.0), 2.5);
        col = mix(col, sunCol, twilight * (0.35 + 0.65*toward) * pow(1.0 - h, 1.6) * 0.95);
        float sd = max(dot(p, sd3), 0.0);
        col = mix(col, mix(vec3(0.6, 0.64, 0.69), vec3(0.05, 0.06, 0.08), uNight), uOvercast * 0.8);   // clouds
        col += (vec3(1.0, 0.92, 0.75)*pow(sd, 1200.0)*3.0 + vec3(1.0, 0.75, 0.45)*pow(sd, 14.0)*0.3) * (1.0 - uNight) * step(-0.05, sd3.y) * (1.0 - uOvercast);
        vec3 axis = normalize(vec3(0.32, 0.5, 0.8));
        float band = exp(-pow(dot(p, axis)/0.17, 2.0));
        float n = noise(p*5.0)*0.55 + noise(p*13.0)*0.3 + noise(p*31.0)*0.15;
        float dust = smoothstep(0.45, 0.75, noise(p*9.0 + 3.0));
        vec3 mw = mix(vec3(0.32, 0.27, 0.62), vec3(0.95, 0.85, 1.0), n) * band * n * (1.0 - dust*0.7) * 0.6;
        col += mw * uNight * smoothstep(-0.02, 0.2, p.y) * (1.0 - uOvercast);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), skyMat); skyDome.renderOrder = -2; skyGroup.add(skyDome);
  scene.userData.sky = skyGroup;

  const nightMats = []; // { m, max } materials that fade in at night
  const glowTex = (inner, outer) => textTexture((g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, 256, 256);
  function skyBasic(o) {
    const max = o.max ?? 1; const opts = { ...o }; delete opts.max;
    const m = new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0, depthWrite: false, ...opts });
    nightMats.push({ m, max }); return m;
  }
  const placeSky = (obj, dir, dist) => { obj.position.copy(new THREE.Vector3(...dir).normalize().multiplyScalar(dist)); skyGroup.add(obj); return obj; };

  {
    const N = 2600, pos = new Float32Array(N * 3), seed = new Float32Array(N), size = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const y = Math.random() * 0.98 + 0.02, r = Math.sqrt(1 - y * y), th = Math.random() * Math.PI * 2;
      pos.set([Math.cos(th) * r * 700, y * 700, Math.sin(th) * r * 700], k * 3);
      seed[k] = Math.random() * 100; size[k] = Math.random() < 0.06 ? rand(2.6, 3.6) : rand(1.0, 2.0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) } },
      vertexShader: 'attribute float aSeed; attribute float aSize; uniform float uTime, uPR; varying float vTw; varying float vS; void main(){ vTw = 0.55 + 0.45*sin(uTime*(1.5+fract(aSeed)*2.5) + aSeed); vS = fract(aSeed*7.13); gl_PointSize = aSize*uPR; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vTw; varying float vS; void main(){ vec2 c = gl_PointCoord-0.5; float d = length(c); if(d>0.5) discard; vec3 col = mix(vec3(0.75,0.85,1.0), vec3(1.0,0.9,0.75), vS); gl_FragColor = vec4(col, (1.0-d*2.0)*vTw*uOpacity); }',
    });
    const pts = new THREE.Points(g, m); pts.renderOrder = -1; skyGroup.add(pts);
    scene.userData.starsMat = m;
  }
  const moonTex = textTexture((g, w, h) => {
    g.fillStyle = '#e9e6dc'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(120,115,105,${rand(0.08, 0.3)})`; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(4, 34), 0, Math.PI * 2); g.fill(); }
  }, 512, 256);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), skyBasic({ map: moonTex })); skyGroup.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(220,230,255,0.55)', 'rgba(140,160,255,0.12)'), fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonGlow.scale.set(130, 130, 1); skyGroup.add(moonGlow); nightMats.push({ m: moonGlow.material, max: 0.9 });
  const bands = (cols) => textTexture((g, w, h) => { const bh = h / cols.length; cols.forEach((c, k) => { g.fillStyle = c; g.fillRect(0, k * bh, w, bh + 1); }); g.globalAlpha = 0.25; for (let k = 0; k < 40; k++) { g.fillStyle = cols[k % cols.length]; g.fillRect(0, rand(0, h), w, rand(1, 6)); } }, 256, 128);
  placeSky(new THREE.Mesh(new THREE.SphereGeometry(5, 24, 12), skyBasic({ color: 0xd9653b })), [-0.62, 0.12, 0.7], 640).scale.setScalar(1.3);
  placeSky(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyBasic({ map: bands(['#d8b48a', '#b07a4e', '#efd9b4', '#9c6b45', '#e6c9a0', '#c48b5a']) })), [0.72, 0.1, -0.42], 640).scale.setScalar(1.5);
  {
    const sat = new THREE.Group();
    sat.add(new THREE.Mesh(new THREE.SphereGeometry(7.5, 32, 16), skyBasic({ map: bands(['#e8d7a6', '#cdb27a', '#f2e6c2', '#bfa06a']) })));
    const ringTex = textTexture((g, w, h) => { for (let x = 0; x < w; x++) { const a = (0.25 + 0.6 * Math.abs(Math.sin(x * 0.09))) * (x > w * 0.55 && x < w * 0.6 ? 0.1 : 1); g.fillStyle = `rgba(230,215,175,${a})`; g.fillRect(x, 0, 1, h); } }, 512, 8);
    const ringGeo = new THREE.RingGeometry(10, 18, 96);
    const uv = ringGeo.attributes.uv, pp = ringGeo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (Math.hypot(pp.getX(k), pp.getY(k)) - 10) / 8, 0.5);
    const ring = new THREE.Mesh(ringGeo, skyBasic({ map: ringTex, side: THREE.DoubleSide })); ring.rotation.x = 1.25; ring.rotation.y = 0.3; sat.add(ring);
    placeSky(sat, [-0.3, 0.1, -0.72], 640).scale.setScalar(1.4);
  }
  const blackHole = new THREE.Group();
  {
    blackHole.add(new THREE.Mesh(new THREE.SphereGeometry(13, 32, 16), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false, transparent: true, opacity: 0 })));
    nightMats.push({ m: blackHole.children[0].material, max: 1 });
    const diskTex = textTexture((g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.18, 'rgba(255,214,140,0.95)'); gr.addColorStop(0.45, 'rgba(255,120,50,0.7)');
      gr.addColorStop(0.75, 'rgba(160,40,120,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 60; k++) { g.strokeStyle = `rgba(0,0,0,${rand(0.05, 0.25)})`; g.lineWidth = rand(1, 4); g.beginPath(); g.arc(w / 2, h / 2, rand(w * 0.2, w * 0.48), rand(0, 6), rand(0, 6)); g.stroke(); }
    }, 512, 512);
    const disk = new THREE.Mesh(new THREE.RingGeometry(14, 52, 128), skyBasic({ map: diskTex, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    disk.rotation.x = 1.35; blackHole.add(disk); blackHole.userData.disk = disk;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,190,120,0.0)', 'rgba(255,160,90,0.35)'), fog: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(70, 70, 1); blackHole.add(halo); nightMats.push({ m: halo.material, max: 0.9 });
    const photon = new THREE.Mesh(new THREE.RingGeometry(13.2, 15.2, 96), skyBasic({ color: 0xffd8a0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, max: 0.9 }));
    blackHole.add(photon); blackHole.userData.photon = photon;
  }
  placeSky(blackHole, [0.6, 0.12, 0.74], 620);

  const hemi = new THREE.HemisphereLight(0xdcefff, 0x4a6b34, 0.85); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  function add(geo, m, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.castShadow = shadow; me.receiveShadow = true;
    parent.add(me);
    return me;
  }
  function textTexture(draw, w = 1024, h = 512) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  // ---------- World ----------
  const HALF = 260, RING = 70, ROAD = 12, ZONE_R = 92, PAD = 9, OUTER = 190;
  const colliders = []; // static circles {x,z,r}

  const grassTex = textTexture((g, w, h) => {
    g.fillStyle = '#6fae4c'; g.fillRect(0, 0, w, h);
    const cols = ['#5f9e40', '#7cbb55', '#88c45f', '#5a9038', '#6aa548', '#93c96a'];
    for (let k = 0; k < 1400; k++) { // soft patches
      g.fillStyle = cols[k % cols.length]; g.globalAlpha = 0.08 + Math.random() * 0.12;
      g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 40, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.5;
    for (let k = 0; k < 9000; k++) { // blades
      g.fillStyle = k % 3 ? '#4f8a33' : '#9ad06f';
      g.fillRect(Math.random() * w, Math.random() * h, 1.2, 3 + Math.random() * 4);
    }
    g.globalAlpha = 1;
  }, 1024, 1024);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(19, 19);
  const groundUni = { uSnow: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) } };
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  groundMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, groundUni);
    sh.fragmentShader = 'uniform float uSnow; uniform vec3 uTint;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n  diffuseColor.rgb *= uTint; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.99), uSnow);');
  };
  // the island: an amoeba-like shoreline (round core + bulging lobes), a beach, then open sea
  const ISLAND_R = 288, D2R = Math.PI / 180;
  const LOBES = [[-45, 52, 22], [42, 40, 17], [-138, 42, 18], [150, 26, 11], [-162, -14, 7], [137, -12, 6], [5, -10, 6], [-95, 16, 10], [95, 14, 9]];   // [angle°, bulge (−bay) m, width°]
  function shoreR(a) {
    let r = ISLAND_R + 1.5 + 1.5 * Math.sin(a * 7 + 1);
    for (const [d, h, w] of LOBES) { const da = Math.atan2(Math.sin(a - d * D2R), Math.cos(a - d * D2R)) / (w * D2R); r += h * Math.exp(-da * da); }
    return r;
  }
  const shoreAt = (x, z) => shoreR(Math.atan2(z, x));
  const shorePts = (off, n = 360) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, r = shoreR(a) + off; return new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r); });
  const circlePts = (r, n = 96) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return new THREE.Vector2(Math.cos(a) * r, -Math.sin(a) * r); });
  function ringShape(outer, holePts) { const sh = new THREE.Shape(outer); sh.holes.push(new THREE.Path(holePts.slice().reverse())); return new THREE.ShapeGeometry(sh, 1); }
  const groundGeo = new THREE.ShapeGeometry(new THREE.Shape(shorePts(0)), 1);
  { const p = groundGeo.attributes.position, uv = groundGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + ISLAND_R) / (ISLAND_R * 2), (p.getY(i) + ISLAND_R) / (ISLAND_R * 2)); }
  const ground = add(groundGeo, groundMat, 0, 0, 0, scene, false);
  ground.rotation.x = -Math.PI / 2;

  const roadMat = mat(0x3d4250, { roughness: 0.95 });
  const ring = add(new THREE.RingGeometry(RING - ROAD / 2, RING + ROAD / 2, 128), roadMat, 0, 0.02, 0, scene, false);
  ring.rotation.x = -Math.PI / 2;
  const dashMat = mat(0xffffff, { roughness: 0.6 });
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const d = add(new THREE.BoxGeometry(0.35, 0.02, 2.6), dashMat, Math.cos(a) * RING, 0.04, Math.sin(a) * RING, scene, false);
    d.rotation.y = -a;
  }

  // ---------- Big map: outer lap ring, connectors, river + bridge, ramps, boost pads, lap gates ----------
  const DEG = Math.PI / 180;
  const outerRoad = add(new THREE.RingGeometry(OUTER - ROAD / 2, OUTER + ROAD / 2, 220), roadMat, 0, 0.02, 0, scene, false);
  outerRoad.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 170; i++) {
    const a = (i / 170) * Math.PI * 2;
    if (Math.cos(a) > 0.9 && Math.abs(Math.sin(a) * OUTER) < 32) continue; // no lane dashes on the bridge stretch
    const d = add(new THREE.BoxGeometry(0.35, 0.02, 2.6), dashMat, Math.cos(a) * OUTER, 0.04, Math.sin(a) * OUTER, scene, false);
    d.rotation.y = -a;
  }
  // red/white kerbs on both edges of the lap ring
  const kerbA = mat(0xe03131), kerbB = mat(0xf8f9fa);
  for (let i = 0; i < 260; i++) {
    const a = (i / 260) * Math.PI * 2;
    if (Math.cos(a) > 0.9 && Math.abs(Math.sin(a) * OUTER) < 32) continue;
    for (const r of [OUTER - ROAD / 2 - 0.6, OUTER + ROAD / 2 + 0.6]) {
      const k = add(new THREE.BoxGeometry(1.2, 0.12, 4.6), i % 2 ? kerbA : kerbB, Math.cos(a) * r, 0.06, Math.sin(a) * r, scene, false);
      k.rotation.y = -a;
    }
  }
  function roadStrip(dir, r0, r1, width, y = 0.016) {
    const len = r1 - r0;
    const m = add(new THREE.PlaneGeometry(width, len), roadMat, dir.x * (r0 + len / 2), y, dir.z * (r0 + len / 2), scene, false);
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, Math.atan2(dir.x, dir.z), 0);
  }
  const connectors = [-64.3, 38.6, 141.4, 244.3].map((deg) => {
    const a = deg * DEG, dir = { x: Math.cos(a), z: Math.sin(a) };
    roadStrip(dir, RING + ROAD / 2 - 1, OUTER - ROAD / 2 + 1, 10);
    return { a, dir };
  });

  // river (east) crossed by the lap ring on a bridge
  const RIVER = { x0: 120, x1: ISLAND_R + 8, w: 18 };
  const inRiver = (x, z) => x > RIVER.x0 - 9 && x < RIVER.x1 && Math.abs(z) < RIVER.w / 2 && (x > RIVER.x0 || Math.hypot(x - RIVER.x0, z) < RIVER.w / 2);
  const waterMats = [];
  // mode 0: river (foam along |z - cz| = halfW), mode 1: round pool (foam at radius)
  function makeWater(o = {}) {
    const m = new THREE.ShaderMaterial({
      transparent: true, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uLight: { value: 1 }, uGlow: { value: o.glow || 0 },
        uDeep: { value: new THREE.Color(o.deep ?? 0x0b3d5c) }, uShallow: { value: new THREE.Color(o.shallow ?? 0x2fa3b8) },
        uSky: { value: new THREE.Color(0xbfe0ff) }, uSunDir: { value: new THREE.Vector3(0.45, 0.8, 0.3).normalize() },
        uMode: { value: o.mode || 0 }, uCenter: { value: new THREE.Vector2(o.cx || 0, o.cz || 0) },
        uIce: { value: 0 }, uIsle: { value: ISLAND_R }, uLobes: { value: (o.lobes ? LOBES : []).concat(Array(9).fill([0, 0, 1])).slice(0, 9).map(([d, h, w]) => new THREE.Vector3(d * D2R, h, w * D2R)) },
        uHalfW: { value: o.halfW || 9 }, uRadius: { value: o.radius || 6 }, uScale: { value: o.scale || 0.55 },
      }]),
      vertexShader: `
        uniform float uTime, uIce; varying vec3 vW; varying vec2 vXZ;
        #include <fog_pars_vertex>
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          wp.y += (sin(wp.x*0.35 + uTime*1.6)*0.06 + sin(wp.z*0.6 - uTime*1.1)*0.05) * (1.0 - uIce);
          vW = wp.xyz; vXZ = wp.xz;
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uTime, uLight, uGlow, uMode, uHalfW, uRadius, uScale, uIce, uIsle; uniform vec3 uLobes[9];
        float shoreR(float a) { float r = uIsle + 1.5 + 1.5 * sin(a * 7.0 + 1.0); for (int i = 0; i < 9; i++) { float da = atan(sin(a - uLobes[i].x), cos(a - uLobes[i].x)) / uLobes[i].z; r += uLobes[i].y * exp(-da * da); } return r; }
        uniform vec3 uDeep, uShallow, uSky, uSunDir; uniform vec2 uCenter;
        varying vec3 vW; varying vec2 vXZ;
        #include <fog_pars_fragment>
        vec3 waveNormal(vec2 p){
          float t = uTime; vec2 d = vec2(0.0);
          vec2 q1 = p*0.9 + vec2(t*0.9, t*0.35);  d += vec2(cos(q1.x)*cos(q1.y), -sin(q1.x)*sin(q1.y))*0.9;
          vec2 q2 = p*1.7 + vec2(-t*0.6, t*1.1);  d += vec2(cos(q2.x)*cos(q2.y), -sin(q2.x)*sin(q2.y))*1.7*0.45;
          vec2 q3 = p*3.9 + vec2(t*1.8, -t*0.8);  d += vec2(cos(q3.x)*cos(q3.y), -sin(q3.x)*sin(q3.y))*3.9*0.12;
          vec2 q4 = p*8.3 + vec2(-t*2.4, t*1.9);  d += vec2(cos(q4.x)*cos(q4.y), -sin(q4.x)*sin(q4.y))*8.3*0.035;
          return normalize(vec3(-d.x*0.08, 1.0, -d.y*0.08));
        }
        void main(){
          vec3 n = waveNormal(vXZ*uScale);
          vec3 v = normalize(cameraPosition - vW);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
          float edge = uMode < 0.5 ? abs(vXZ.y - uCenter.y)/uHalfW : uMode < 1.5 ? length(vXZ - uCenter)/uRadius
            : 1.0 - clamp((length(vXZ) - shoreR(atan(vXZ.y, vXZ.x)) - uRadius) / uHalfW, 0.0, 1.0);   // mode 2: open sea, foam at the shore
          edge = clamp(edge, 0.0, 1.0);
          vec3 base = mix(uDeep, uShallow, smoothstep(0.35, 1.0, edge));
          vec3 col = mix(base, uSky, 0.15 + fres*0.75) * mix(0.22, 1.0, uLight);
          col += base * uGlow * (0.6 + 0.4*sin(uTime*1.3 + vXZ.x*0.3));            // bioluminescence
          vec3 r = reflect(-uSunDir, n);
          col += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, v), 0.0), 160.0) * 2.2 * max(uLight, 0.35);
          float foam = smoothstep(0.82, 1.0, edge) * (0.55 + 0.45*sin(vXZ.x*1.3 + vXZ.y*0.7 + uTime*2.0 + n.x*20.0));
          col = mix(col, vec3(0.95,0.98,1.0) * mix(0.35, 1.0, uLight), foam*0.75);
          // frozen in winter: pale, glossy ice
          vec3 ice = mix(vec3(0.76, 0.86, 0.93), vec3(0.93, 0.97, 1.0), fres + 0.3 * sin(vXZ.x * 0.7 + vXZ.y * 1.3)) * mix(0.3, 1.0, uLight);
          ice += vec3(1.0) * pow(max(dot(r, v), 0.0), 40.0) * 0.5 * uLight;
          col = mix(col, ice, uIce * 0.92);
          gl_FragColor = vec4(col, mix(mix(0.86, 0.97, fres), 1.0, uIce));
          #include <fog_fragment>
        }`,
    });
    waterMats.push(m); return m;
  }
  const waterMat = makeWater({ mode: 0, halfW: RIVER.w / 2 });
  const water = add(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0, RIVER.w, 140, 24), waterMat, (RIVER.x0 + RIVER.x1) / 2, 0.24, 0, scene, false);
  water.rotation.x = -Math.PI / 2;
  const pond = add(new THREE.CircleGeometry(RIVER.w / 2, 48), waterMat, RIVER.x0, 0.24, 0, scene, false); pond.rotation.x = -Math.PI / 2;
  // beach all round the island, and the open sea beyond it
  const sandMat = mat(0xead9a6, { roughness: 1 });
  add(ringShape(circlePts(460), shorePts(-3)), sandMat, 0, 0.012, 0, scene, false).rotation.x = -Math.PI / 2;
  const seaMat = makeWater({ mode: 2, radius: 7, halfW: 80, lobes: true, deep: 0x0a3a5a, shallow: 0x3cb6c6, scale: 0.32 });
  seaMat.userData.noIce = true;
  add(ringShape(circlePts(2600, 128), shorePts(5)), seaMat, 0, 0.2, 0, scene, false).rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    const bank = add(new THREE.PlaneGeometry(RIVER.x1 - RIVER.x0, 2.6), mat(0xe6d3a3), (RIVER.x0 + RIVER.x1) / 2, 0.05, side * (RIVER.w / 2 + 1.3), scene, false);
    bank.rotation.x = -Math.PI / 2;
  }

  // ramps / bridge: wedge-shaped surfaces the car can drive up, over and off
  const surfaces = [];
  function wedgeGeo(pts, width) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: false });
    g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // shape x -> world z (forward)
    return g;
  }
  function addSurface(o) {
    const forward = { x: Math.sin(o.rot), z: Math.cos(o.rot) };
    const m = add(wedgeGeo(o.pts, o.W), o.mat, o.cx - forward.x * o.L / 2, 0, o.cz - forward.z * o.L / 2);
    m.rotation.y = o.rot;
    surfaces.push({ ...o, forward });
    return m;
  }
  const CAR_H = 1.7;
  function surfaceAt(x, z, y = 0) {
    let h = 0;
    for (const s of surfaces) {
      const dx = x - s.cx, dz = z - s.cz;
      const along = dx * s.forward.x + dz * s.forward.z, across = dx * s.forward.z - dz * s.forward.x;
      if (Math.abs(across) > s.W / 2 || Math.abs(along) > s.L / 2) continue;
      const t = (along + s.L / 2) / s.L;
      if (s.under && y + CAR_H < s.under(t)) continue; // we're underneath it (e.g. driving under the bridge)
      h = Math.max(h, s.profile(t));
    }
    return h;
  }
  // underside height of any surface directly above (x, z, y) — used to keep the camera under the bridge
  function ceilingAt(x, z, y) {
    let c = Infinity;
    for (const s of surfaces) {
      if (!s.under) continue;
      const dx = x - s.cx, dz = z - s.cz;
      const along = dx * s.forward.x + dz * s.forward.z, across = dx * s.forward.z - dz * s.forward.x;
      if (Math.abs(across) > s.W / 2 || Math.abs(along) > s.L / 2) continue;
      const u = s.under((along + s.L / 2) / s.L);
      if (y + CAR_H < u) c = Math.min(c, u);
    }
    return c;
  }
  const rampMat = mat(0xf59f00, { roughness: 0.6 }), rampStripe = mat(0x15131f);
  function addRamp(cx, cz, rot, L, W, H) {
    const m = addSurface({ cx, cz, rot, L, W, mat: rampMat, pts: [[0, 0], [L, H], [L, 0]], profile: (t) => H * t });
    // chevron stripes on the ramp face
    for (let k = 1; k < 4; k++) { // local frame: ramp rises along +z from 0 to L
      const f = k / 4, st = add(new THREE.BoxGeometry(W * 0.9, 0.06, 0.5), rampStripe, 0, H * f + 0.04, L * f, m, false);
      st.rotation.x = -Math.atan2(H, L);
    }
    return m;
  }
  // bridge over the river: up-ramp, flat deck, down-ramp, with railings and piers
  const BR = { cx: OUTER, cz: 0, L: 64, W: 13, H: 4.6 };
  const deckMat = mat(0x868e96, { roughness: 0.7 });
  addSurface({
    cx: BR.cx, cz: BR.cz, rot: 0, L: BR.L, W: BR.W, mat: deckMat,
    pts: [[0, 0], [BR.L * 0.25, BR.H], [BR.L * 0.75, BR.H], [BR.L, 0], [BR.L * 0.75, BR.H - 0.9], [BR.L * 0.25, BR.H - 0.9]],
    profile: (t) => (t < 0.25 ? BR.H * t / 0.25 : t > 0.75 ? BR.H * (1 - t) / 0.25 : BR.H),
    under: (t) => (BR.H - 0.9) * (t < 0.25 ? t / 0.25 : t > 0.75 ? (1 - t) / 0.25 : 1),
  });
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.4, 1.1, BR.L * 0.5), mat(0xf8f9fa), BR.cx + side * (BR.W / 2 - 0.2), BR.H + 0.55, BR.cz);
    for (const zz of [-BR.L * 0.25, BR.L * 0.25]) {
      add(new THREE.BoxGeometry(1.4, BR.H, 1.4), deckMat, BR.cx + side * (BR.W / 2 - 1), BR.H / 2 - 0.45, BR.cz + zz);
      colliders.push({ x: BR.cx + side * (BR.W / 2 - 1), z: BR.cz + zz, r: 1, maxY: BR.H - 1.5 }); // piers only block you down below
    }
  }
  add(new THREE.BoxGeometry(0.35, 0.03, BR.L * 0.48), dashMat, BR.cx, BR.H + 0.02, BR.cz, scene, false);

  // jumps: one on each connector (launching outwards) and two kickers on the lap ring
  const ramps = [];
  for (const c of connectors) {
    const r = 150, rot = Math.atan2(c.dir.x, c.dir.z);
    addRamp(c.dir.x * r, c.dir.z * r, rot, 12, 9, 2.8); ramps.push({ x: c.dir.x * r, z: c.dir.z * r, out: c.dir });
  }
  for (const deg of [180, 300]) {
    const a = deg * DEG, tx = -Math.sin(a), tz = Math.cos(a); // lap direction (increasing angle)
    addRamp(Math.cos(a) * OUTER, Math.sin(a) * OUTER, Math.atan2(tx, tz), 10, 11, 2.2);
    ramps.push({ x: Math.cos(a) * OUTER, z: Math.sin(a) * OUTER, out: { x: tx, z: tz } });
  }

  // boost pads (glowing chevrons)
  const boostTex = textTexture((g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(1, '#a855f7');
    g.fillStyle = '#0b0a1acc'; g.fillRect(0, 0, w, h);
    g.fillStyle = gr; g.lineJoin = 'round';
    for (let k = 0; k < 3; k++) { const y = 70 + k * 150; g.beginPath(); g.moveTo(w * 0.15, y + 120); g.lineTo(w / 2, y); g.lineTo(w * 0.85, y + 120); g.lineTo(w * 0.85, y + 170); g.lineTo(w / 2, y + 50); g.lineTo(w * 0.15, y + 170); g.closePath(); g.fill(); }
  }, 256, 512);
  const boostMat = new THREE.MeshStandardMaterial({ map: boostTex, emissive: 0x7c3aed, emissiveIntensity: 0.5, transparent: true });
  const boosts = [];
  function addBoost(x, z, rot) {
    const m = add(new THREE.PlaneGeometry(5, 8), boostMat, x, 0.07, z, scene, false);
    m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, rot + Math.PI, 0);
    boosts.push({ x, z, m });
  }
  for (const deg of [60, 120, 240]) { const a = deg * DEG; addBoost(Math.cos(a) * OUTER, Math.sin(a) * OUTER, Math.atan2(-Math.sin(a), Math.cos(a))); }
  for (const c of connectors) addBoost(c.dir.x * 118, c.dir.z * 118, Math.atan2(c.dir.x, c.dir.z));

  // lap gates on the outer ring (drive them in order: start -> 5 checkpoints -> finish)
  const gates = [];
  [90, 150, 210, 270, 330, 30].forEach((deg, gi) => {
    const a = deg * DEG, x = Math.cos(a) * OUTER, z = Math.sin(a) * OUTER;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -a; scene.add(g);
    const glow = mat(0xffffff, { emissive: 0xa855f7, emissiveIntensity: 0.3 });
    for (const off of [-(ROAD / 2 + 1.5), ROAD / 2 + 1.5]) {
      add(new THREE.BoxGeometry(1, 7, 1), glow, off, 3.5, 0, g);
      colliders.push({ x: x + Math.cos(a) * off, z: z + Math.sin(a) * off, r: 0.9 });
    }
    const tex = textTexture((c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#6d28d9'); gr.addColorStop(1, '#ec4899');
      c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = '900 92px system-ui, sans-serif'; c.fillText(gi === 0 ? 'START / FINISH' : `CHECKPOINT ${gi}`, w / 2, h * 0.62);
    }, 1024, 160);
    add(new THREE.BoxGeometry(ROAD + 4, 1.6, 0.3), [glow, glow, glow, glow, new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: tex }), new THREE.MeshStandardMaterial({ map: tex })], 0, 7.4, 0, g);
    gates.push({ x, z, glow });
  });

  // center plaza with a fountain and the name painted on the ground
  const plaza = add(new THREE.CircleGeometry(24, 72), mat(0xd8d2c4), 0, 0.03, 0, scene, false);
  plaza.rotation.x = -Math.PI / 2;
  const nightGlow = []; // emissive materials that light up after dark: { m, day, night }
  const FOUNTAIN = (() => {
    const stone = mat(0xe8e2d4, { roughness: 0.7 }), stoneDark = mat(0xb9b1a0, { roughness: 0.8 });
    const g = new THREE.Group(); scene.add(g);
    const lathe = (pts, m, y = 0) => { const me = add(new THREE.LatheGeometry(pts.map(([x, yy]) => new THREE.Vector2(x, yy)), 64), m, 0, y, 0, g); return me; };
    lathe([[5.5, 0], [6.4, 0], [6.5, 0.15], [6.4, 0.95], [6.15, 1.05], [5.75, 1.05], [5.55, 0.95], [5.5, 0.3]], stone);   // outer basin rim
    add(new THREE.CircleGeometry(5.6, 48), stoneDark, 0, 0.12, 0, g, false).rotation.x = -Math.PI / 2;
    add(new THREE.CylinderGeometry(0.9, 1.3, 2.0, 24), stone, 0, 1.0, 0, g);                                               // pedestal
    lathe([[0.6, 0], [2.7, 0.35], [2.85, 0.6], [2.6, 0.62], [0.9, 0.3]], stone, 2.0);                                        // middle bowl
    add(new THREE.CylinderGeometry(0.4, 0.6, 1.1, 16), stone, 0, 3.1, 0, g);
    lathe([[0.3, 0], [1.3, 0.25], [1.4, 0.45], [1.25, 0.47], [0.4, 0.2]], stone, 3.6);                                       // top bowl
    add(new THREE.SphereGeometry(0.32, 16, 12), stone, 0, 4.35, 0, g);
    const pool = makeWater({ mode: 1, radius: 5.6, shallow: 0x5cc8d8, deep: 0x1b6f8f, scale: 1.2 });
    add(new THREE.CircleGeometry(5.6, 48), pool, 0, 0.78, 0, g, false).rotation.x = -Math.PI / 2;
    const pool2 = makeWater({ mode: 1, radius: 2.6, shallow: 0x7fd8e6, deep: 0x2a8fae, scale: 1.6 });
    add(new THREE.CircleGeometry(2.6, 40), pool2, 0, 2.52, 0, g, false).rotation.x = -Math.PI / 2;
    // underwater lights: a ring that glows at night
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, fog: false });
    add(new THREE.TorusGeometry(4.6, 0.12, 8, 64), ringMat, 0, 0.55, 0, g, false).rotation.x = Math.PI / 2;
    nightGlow.push({ basic: ringMat, max: 0.95 });
    // water jets: GPU particles on ballistic arcs (central plume + 8 arcs from the rim)
    const N = 1400, seed = new Float32Array(N), kind = new Float32Array(N), pos = new Float32Array(N * 3);
    for (let k = 0; k < N; k++) { seed[k] = Math.random(); kind[k] = k < 600 ? -1 : Math.floor(Math.random() * 8); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    const jetMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) }, uNight: { value: 0 } },
      vertexShader: `
        attribute float aSeed; attribute float aKind; uniform float uTime, uPR; varying float vA;
        void main(){
          float T = aKind < 0.0 ? 1.25 : 0.9;
          float t = fract(uTime / T + aSeed) * T;
          float jitter = fract(aSeed * 91.7) - 0.5, j2 = fract(aSeed * 53.3) - 0.5;
          vec3 p;
          if (aKind < 0.0) { // central plume from the top bowl
            float a = aSeed * 6.2831 * 13.0, sp = 0.9 + jitter * 0.6;
            p = vec3(cos(a) * sp * t, 4.5 + (6.4 + j2) * t - 4.9 * t * t, sin(a) * sp * t);
          } else {          // arcs from the rim towards the pedestal
            float a = aKind * 0.7854 + jitter * 0.05; vec2 d = vec2(cos(a), sin(a));
            vec2 xz = d * (5.6 - (5.0 + j2 * 0.4) * t / T);
            p = vec3(xz.x, 1.0 + 6.0 * t - 7.2 * t * t, xz.y);
          }
          vA = smoothstep(0.0, 0.08, t / T) * (1.0 - smoothstep(0.75, 1.0, t / T));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uPR * (aKind < 0.0 ? 7.0 : 5.0) * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        vec3 c = mix(vec3(0.85, 0.95, 1.0), vec3(0.45, 0.9, 1.0), uNight); gl_FragColor = vec4(c, (1.0 - d * 2.0) * vA * 0.8); }`,
    });
    const jets = new THREE.Points(geo, jetMat); jets.frustumCulled = false; g.add(jets);
    colliders.push({ x: 0, z: 0, r: 6.6 });
    return { jetMat, jets };
  })();
  const titleTex = textTexture((g, w, h) => {
    g.fillStyle = '#15131f'; g.textAlign = 'center';
    g.font = '900 150px system-ui, sans-serif';
    let size = 150;
    while (g.measureText(D.shortName).width > w - 60 && size > 40) { size -= 6; g.font = `900 ${size}px system-ui, sans-serif`; }
    g.fillText(D.shortName, w / 2, h * 0.48);
    g.font = '600 44px system-ui, sans-serif'; g.fillStyle = '#5b6475';
    g.fillText(D.role, w / 2, h * 0.68);
    g.font = '600 34px system-ui, sans-serif'; g.fillStyle = '#c026d3';
    g.fillText('drive to a glowing pad to explore ↑', w / 2, h * 0.85);
  });
  const title = add(new THREE.PlaneGeometry(30, 15), new THREE.MeshStandardMaterial({ map: titleTex, transparent: true, roughness: 1 }), 0, 0.05, 14.5, scene, false);
  title.rotation.x = -Math.PI / 2;

  // ---------- Zones (portfolio sections) ----------
  const zones = D.sections.map((s, i) => {
    const a = -Math.PI / 2 + (i / D.sections.length) * Math.PI * 2;
    const dir = { x: Math.cos(a), z: Math.sin(a) };
    const color = new THREE.Color(s.color);
    const z = { ...s, i, a, dir, x: dir.x * ZONE_R, z: dir.z * ZONE_R, visited: false, dismissed: false };

    // spoke road from plaza to pad
    const len = ZONE_R - 14;
    const spoke = add(new THREE.PlaneGeometry(9, len), roadMat, dir.x * (14 + len / 2), 0.015, dir.z * (14 + len / 2), scene, false);
    spoke.rotation.order = 'YXZ'; spoke.rotation.set(-Math.PI / 2, Math.atan2(dir.x, dir.z), 0);

    // glowing pad + pulsing ring
    z.pad = add(new THREE.CylinderGeometry(PAD, PAD, 0.3, 48), mat(color, { emissive: color, emissiveIntensity: 0.25 }), z.x, 0.15, z.z, scene, false);
    z.ring = add(new THREE.TorusGeometry(PAD + 0.4, 0.3, 8, 64), mat(0xffffff, { emissive: color, emissiveIntensity: 1 }), z.x, 0.35, z.z, scene, false);
    z.ring.rotation.x = Math.PI / 2;

    // sign facing the plaza
    const face = Math.atan2(-dir.x, -dir.z);
    const signTex = textTexture((g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = s.color; g.fillRect(0, 0, w, 36); g.fillRect(0, h - 36, w, 36);
      g.fillStyle = '#15131f'; g.textAlign = 'center';
      let fs = 120; g.font = `900 ${fs}px system-ui, sans-serif`;
      while (g.measureText(s.title.toUpperCase()).width > w - 60 && fs > 50) { fs -= 6; g.font = `900 ${fs}px system-ui, sans-serif`; }
      g.fillText(s.title.toUpperCase(), w / 2, h * 0.58);
      g.font = '600 40px system-ui, sans-serif'; g.fillStyle = '#5b6475';
      g.fillText('park on the pad to open', w / 2, h * 0.82);
    });
    const sign = new THREE.Group();
    sign.position.set(dir.x * (ZONE_R + PAD + 4), 0, dir.z * (ZONE_R + PAD + 4));
    sign.rotation.y = face;
    scene.add(sign);
    const plain = mat(0xf1f3f5);
    add(new THREE.BoxGeometry(14, 7, 0.5), [plain, plain, plain, plain, new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }), plain], 0, 6.5, 0, sign);
    for (const px of [-6, 6]) add(new THREE.BoxGeometry(0.6, 3, 0.6), mat(0x868e96), px, 1.5, 0, sign);
    const right = { x: Math.cos(face), z: -Math.sin(face) };
    for (const px of [-6, 6]) colliders.push({ x: sign.position.x + right.x * px, z: sign.position.z + right.z * px, r: 0.8 });

    // a little landmark building behind the sign
    const b = new THREE.Group();
    const bx = dir.x * (ZONE_R + PAD + 16), bz = dir.z * (ZONE_R + PAD + 16);
    b.position.set(bx, 0, bz); b.rotation.y = face; scene.add(b);
    buildLandmark(i % 5, b, color);
    colliders.push({ x: bx, z: bz, r: 7 });
    return z;
  });

  function buildLandmark(kind, g, color) {
    const wall = mat(0xf8f9fa), accent = mat(color);
    if (kind === 0) { // house
      add(new THREE.BoxGeometry(10, 6, 9), wall, 0, 3, 0, g);
      const roof = add(new THREE.ConeGeometry(8, 4.5, 4), accent, 0, 8.2, 0, g); roof.rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(2, 3.4, 0.2), mat(0x495057), 0, 1.7, 4.55, g);
    } else if (kind === 1) { // stacked blocks
      [[0, 0, 0], [3.2, 0, 0], [-3.2, 0, 0], [1.6, 3.2, 0], [-1.6, 3.2, 0], [0, 6.4, 0]].forEach(([x, y], j) =>
        add(new THREE.BoxGeometry(3, 3, 3), j % 2 ? wall : accent, x, y + 1.5, 0, g));
    } else if (kind === 2) { // tower with screens
      add(new THREE.BoxGeometry(6, 16, 6), wall, 0, 8, 0, g);
      for (let y = 3; y < 16; y += 4) add(new THREE.BoxGeometry(4.6, 2.2, 0.2), mat(0x1d2433, { emissive: color, emissiveIntensity: 0.6 }), 0, y, 3.05, g);
    } else if (kind === 3) { // staircase / growth
      for (let s = 0; s < 5; s++) add(new THREE.BoxGeometry(2, 2 + s * 2, 6), s % 2 ? wall : accent, -4 + s * 2, 1 + s, 0, g);
    } else { // antenna / signal tower
      add(new THREE.CylinderGeometry(2.5, 3.5, 4, 16), wall, 0, 2, 0, g);
      add(new THREE.CylinderGeometry(0.4, 0.6, 12, 8), mat(0xadb5bd), 0, 10, 0, g);
      g.userData.beacon = add(new THREE.SphereGeometry(1, 16, 16), mat(color, { emissive: color, emissiveIntensity: 1.5 }), 0, 16.5, 0, g);
      for (let r = 0; r < 3; r++) {
        const t = add(new THREE.TorusGeometry(2 + r * 1.2, 0.15, 6, 32), accent, 0, 13 - r * 1.5, 0, g); t.rotation.x = Math.PI / 2;
      }
    }
  }

  // ---------- Scenery: trees ----------
  function nearRoad(x, z) {
    const d = Math.hypot(x, z);
    if (d > shoreAt(x, z) - 10 || inDistrict(x, z)) return true;
    if (d < 36 || Math.abs(d - RING) < ROAD / 2 + 4 || Math.abs(d - OUTER) < ROAD / 2 + 6) return true;
    if (inRiver(x, z) || (x > RIVER.x0 - 14 && Math.abs(z) < RIVER.w / 2 + 6)) return true;
    { // the cave outcrop + a narrow, bush-hidden path from its mouth to the lap road
      const dx = x - CAVE.cx, dz = z - CAVE.cz, al = dx * CAVE.u.x + dz * CAVE.u.z, b = dx * CAVE.v.x + dz * CAVE.v.z;
      if (Math.hypot(dx, dz) < 22 || (al > 0 && al < 40 && Math.abs(b) < 5)) return true;
    }
    for (const c of connectors) { const t = x * c.dir.x + z * c.dir.z; if (t > RING && t < OUTER && Math.abs(x * c.dir.z - z * c.dir.x) < 9) return true; }
    for (const r of ramps) if (Math.hypot(x - r.x - r.out.x * 22, z - r.z - r.out.z * 22) < 30) return true;
    for (const zn of zones) {
      if (Math.hypot(x - zn.x, z - zn.z) < 32) return true;
      const t = x * zn.dir.x + z * zn.dir.z; // projection on spoke
      if (t > 0 && t < ZONE_R && Math.abs(x * zn.dir.z - z * zn.dir.x) < 8) return true;
    }
    return false;
  }
  // ---------- Forest: instanced, mixed species, clustered ----------
  const flat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...o });
  function jitter(geo, amt) { // irregular low-poly crowns
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) + rand(-amt, amt), p.getY(k) + rand(-amt, amt), p.getZ(k) + rand(-amt, amt));
    geo.computeVertexNormals(); return geo;
  }
  const merge = (parts) => { // tiny geometry merger (non-indexed)
    const pos = [], nor = [];
    for (const [g, m] of parts) {
      const gg = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m);
      gg.computeVertexNormals();
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  };
  const M4 = (x, y, z, sx = 1, sy = sx, sz = sx, ry = 0) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

  // species: [trunk geometry, crown geometry, trunk colour, crown colours, collider radius]
  const species = {
    pine: {
      trunk: new THREE.CylinderGeometry(0.28, 0.42, 3, 6).translate(0, 1.5, 0),
      crown: merge([
        [jitter(new THREE.ConeGeometry(2.6, 3.4, 8), 0.15), M4(0, 3.2, 0)],
        [jitter(new THREE.ConeGeometry(2.1, 3.0, 8), 0.15), M4(0, 5.0, 0, 1, 1, 1, 0.4)],
        [jitter(new THREE.ConeGeometry(1.5, 2.6, 8), 0.12), M4(0, 6.6, 0, 1, 1, 1, 0.8)],
        [new THREE.ConeGeometry(0.8, 1.8, 7), M4(0, 8.0, 0)],
      ]),
      trunkCol: 0x6b4423, crowns: [0x1f6f3a, 0x2b7a3f, 0x24603a, 0x317f45], r: 1.0, count: 210,
    },
    oak: {
      trunk: merge([[new THREE.CylinderGeometry(0.4, 0.6, 3.2, 7), M4(0, 1.6, 0)], [new THREE.CylinderGeometry(0.16, 0.24, 1.8, 5), M4(0.7, 3.0, 0, 1, 1, 1)]]),
      crown: merge([
        [jitter(new THREE.IcosahedronGeometry(2.4, 1), 0.3), M4(0, 4.8, 0)],
        [jitter(new THREE.IcosahedronGeometry(1.8, 1), 0.25), M4(1.6, 4.2, 0.6)],
        [jitter(new THREE.IcosahedronGeometry(1.7, 1), 0.25), M4(-1.4, 4.4, -0.7)],
        [jitter(new THREE.IcosahedronGeometry(1.5, 1), 0.2), M4(0.2, 6.1, 0.3)],
      ]),
      trunkCol: 0x5c3d24, crowns: [0x3f8f3a, 0x4c9a3c, 0x5aa646, 0x3a7f34], r: 1.3, count: 150,
    },
    birch: {
      trunk: new THREE.CylinderGeometry(0.2, 0.28, 5.2, 6).translate(0, 2.6, 0),
      crown: merge([
        [jitter(new THREE.IcosahedronGeometry(1.5, 1), 0.2), M4(0, 5.6, 0, 1, 1.35, 1)],
        [jitter(new THREE.IcosahedronGeometry(1.1, 1), 0.18), M4(0.5, 4.6, 0.3, 1, 1.2, 1)],
      ]),
      trunkCol: 0xeceae2, crowns: [0x9cc94d, 0xb6d35a, 0x8dbf47], r: 0.7, count: 110,
    },
    maple: {
      trunk: new THREE.CylinderGeometry(0.32, 0.48, 3, 6).translate(0, 1.5, 0),
      crown: merge([
        [jitter(new THREE.DodecahedronGeometry(2.3, 0), 0.25), M4(0, 4.4, 0, 1.15, 0.95, 1.15)],
        [jitter(new THREE.DodecahedronGeometry(1.6, 0), 0.2), M4(0.9, 5.4, -0.4)],
      ]),
      trunkCol: 0x5a3a22, crowns: [0xe8590c, 0xf08c00, 0xd9480f, 0xf59f00, 0xc92a2a], r: 1.1, count: 70,
    },
  };
  const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  const flatRock = (c) => flat(c, { roughness: 1 });
  const BUSH = jitter(new THREE.IcosahedronGeometry(1, 1), 0.15);
  const ROCK = jitter(new THREE.DodecahedronGeometry(1, 0), 0.18);

  // ---------- Street lamps (light pools fade in after dark) ----------
  {
    const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const near = (a, list, tol) => list.some(b => angDiff(a, b) < tol);
    const spokeA = zones.map(zn => zn.a), connA = connectors.map(c => c.a);
    const ringBusy = [90, 150, 210, 270, 330, 30, 180, 300, 60, 120, 240].map(d => d * DEG).concat(connA);
    const spots = []; // { x, z, dx, dz } with (dx,dz) pointing from the pole towards the road
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.09;
      if (near(a, spokeA.concat(connA), 7 * DEG)) continue;
      const r = RING + ROAD / 2 + 1.8; spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, dx: -Math.cos(a), dz: -Math.sin(a) });
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + 0.04;
      if ((Math.cos(a) > 0.85 && Math.abs(Math.sin(a) * OUTER) < 40) || near(a, ringBusy, 4.5 * DEG)) continue;
      const r = OUTER - ROAD / 2 - 2.6; spots.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, dx: Math.cos(a), dz: Math.sin(a) });
    }
    const n = spots.length;
    const poleGeo = merge([[new THREE.CylinderGeometry(0.11, 0.17, 6.2, 8), M4(0, 3.1, 0)], [new THREE.BoxGeometry(2.4, 0.12, 0.12), M4(1.1, 6.1, 0)], [new THREE.CylinderGeometry(0.3, 0.36, 0.3, 8), M4(0, 0.15, 0)]]);
    const poles = new THREE.InstancedMesh(poleGeo, mat(0x2b2f3a, { metalness: 0.6, roughness: 0.4 }), n);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff5dc, emissive: 0xffc46b, emissiveIntensity: 0.15 });
    const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.16, 0.5).translate(2.2, 5.98, 0), headMat, n);
    const poolTex = textTexture((g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.45, 'rgba(255,190,110,0.35)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, 128, 128);
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2).translate(2.4, 0.09, 0), poolMat, n);
    spots.forEach((p, k) => {
      dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, Math.atan2(-p.dz, p.dx), 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      poles.setMatrixAt(k, dummy.matrix); heads.setMatrixAt(k, dummy.matrix); pools.setMatrixAt(k, dummy.matrix);
      colliders.push({ x: p.x, z: p.z, r: 0.35 });
    });
    poles.castShadow = true; heads.castShadow = false; pools.renderOrder = 1;
    scene.add(poles, heads, pools);
    nightGlow.push({ std: headMat, day: 0.15, night: 3.2 }, { basic: poolMat, max: 0.6 });
  }

  // ---------- The hidden cave (west woods): a rock outcrop with one dark opening ----------
  const CAVE = (() => {
    const a = 195 * DEG, u = { x: Math.cos(a), z: Math.sin(a) }, v = { x: -u.z, z: u.x }; // u: out of the mouth, v: sideways
    const cx = u.x * 150, cz = u.z * 150;
    const P = (al, b) => ({ x: cx + u.x * al + v.x * b, z: cz + u.z * al + v.z * b });
    const rockMat = flatRock(0x7d8088), mossMat = flatRock(0x55704a);
    const g = new THREE.Group(); scene.add(g);
    const rock = (al, b, y, r, sy = 1, solid = y - r * sy < 0.6, m = rockMat) => {
      const p = P(al, b);
      const me = add(jitter(new THREE.DodecahedronGeometry(r, 1), r * 0.12), m, p.x, y, p.z, g);
      me.scale.set(rand(0.9, 1.15), sy, rand(0.9, 1.15)); me.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      if (solid) colliders.push({ x: p.x, z: p.z, r: r * 0.92 });
      return me;
    };
    // tunnel walls either side of the opening, a roof over it, and a heavy mass behind
    for (const s of [-1, 1]) {
      for (const al of [1.2, 3.8, 6.4]) rock(al, s * 5.7, 1.4, 2.4, 0.95);
      for (const al of [2, 5.5]) rock(al, s * 4.8, 4.1, 2.1, 0.9, false, mossMat);
      rock(-1, s * 8.5, 1.8, 3.4, 0.8); rock(3, s * 9.5, 1.2, 2.6, 0.7, true, mossMat);
    }
    for (const al of [1.5, 4.6]) for (const b of [-2.3, 2.3]) rock(al, b, 5.5, 2.5, 0.75, false);
    rock(7.2, 0, 5.3, 2.4, 0.7, false, mossMat);
    for (const b of [-4.5, 0, 4.5]) rock(-3, b, 2.4, 3.8, 0.9);
    rock(-7, 0, 3, 4.6, 0.9, true, mossMat); rock(-2, 0, 6.6, 4.2, 0.7, false);
    // the darkness inside
    const mouth = P(3.8, 0);
    const voidBox = add(new THREE.BoxGeometry(6.4, 4.4, 7), new THREE.MeshBasicMaterial({ color: 0x030206, side: THREE.BackSide }), mouth.x, 2.2, mouth.z, g, false);
    voidBox.rotation.y = Math.atan2(u.x, u.z);
    const deep = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(190,120,255,0.9)', 'rgba(120,60,220,0.25)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const dp = P(1.2, 0); deep.position.set(dp.x, 1.6, dp.z); deep.scale.set(4, 3, 1); g.add(deep);
    nightGlow.push({ basic: deep.material, max: 0.55, dayMin: 0.12 });
    // runes carved on the stones around the opening: they only glow at night
    const glyphs = ['ᚠ', 'ᚱ', 'ᛟ', 'ᚨ', 'ᛉ', 'ᛞ'];
    const runeMat = (ch) => new THREE.MeshBasicMaterial({
      map: textTexture((c, w, h) => { c.fillStyle = '#fff'; c.font = '700 96px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = '#c084fc'; c.shadowBlur = 18; c.fillText(ch, w / 2, h / 2); }, 128, 128),
      color: 0xc084fc, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    [[8.4, -3.9, 1.3], [8.4, 3.9, 1.6], [8.7, -3.2, 3.3], [8.7, 3.4, 3.0], [9.4, 0, 5.2], [8.0, -5.6, 2.4]].forEach(([al, b, y], k) => {
      const m = runeMat(glyphs[k]); const p = P(al, b);
      const me = add(new THREE.PlaneGeometry(1.1, 1.1), m, p.x, y, p.z, g, false); me.rotation.y = Math.atan2(u.x, u.z);
      nightGlow.push({ basic: m, max: 0.95, pulse: k });
    });
    // a few bushes half-hiding the entrance
    for (const [al, b] of [[10.5, -5], [11.5, 5.5], [13, -7.5], [9.5, 7.2], [14, 3]]) {
      const p = P(al, b); const s = rand(1.2, 1.8);
      const me = add(BUSH, flatRock(0x2f7d32), p.x, s * 0.5, p.z, g); me.scale.set(s * 1.2, s * 0.8, s * 1.2);
    }
    return { cx, cz, u, v, P, exit: P(11, 0), h: Math.atan2(u.x, u.z) };
  })();

  // ---------- The island's neighbourhoods (outside the lap ring) ----------
  //  north: market street · south: village (homes | huts) · east & west: tent camps + sunrise / sunset points · north-west: park
  const SPORT = { FB: { x: 168, z: -178, L: 38, W: 24 }, BB: { x: 214, z: -118, L: 26, W: 15 }, GY: { x: 126, z: -224 }, CR: { x: 160, z: 170, R: 26 } };
  { const a = 120 * DEG; SPORT.BD = { x: Math.cos(a) * 282, z: Math.sin(a) * 282, ux: -Math.sin(a), uz: Math.cos(a), vx: Math.cos(a), vz: Math.sin(a) }; }
  const DISTRICTS = [
    { x0: 145, x1: 191, z0: -194, z1: -162 }, { x0: 202, x1: 226, z0: -135, z1: -101 }, { x0: 110, x1: 142, z0: -238, z1: -210 }, // football · basketball · gym
    { cx: 160, cz: 170, r: 32 }, { cx: SPORT.BD.x, cz: SPORT.BD.z, r: 15 },                                                         // cricket · beach badminton
    { x0: -106, x1: 106, z0: -262, z1: -214 }, { x0: 8, x1: 20, z0: -234, z1: -194 },   // market street + its road
    { x0: -106, x1: 106, z0: 214, z1: 266 }, { x0: 8, x1: 20, z0: 194, z1: 234 },       // village + its road
    { cx: -165, cz: -170, r: 33 },                                                        // park
    { cx: 238, cz: 108, r: 25 }, { cx: -238, cz: 104, r: 25 },                            // camps
    { cx: 287, cz: -66, r: 17 }, { cx: -288, cz: 44, r: 17 },                             // viewpoints
  ];
  const inDistrict = (x, z) => DISTRICTS.some(d => d.r ? Math.hypot(x - d.cx, z - d.cz) < d.r : x > d.x0 && x < d.x1 && z > d.z0 && z < d.z1);
  const foliage = [], winterHide = []; // seasonal recolour / hide-in-winter lists (filled here and by the forest)
  const snowables = []; // flat surfaces that whiten in winter: { m, base }
  const snowy = (m) => { snowables.push({ m, base: m.color.clone() }); return m; };
  const shopsList = []; // shop / stall / ATM fronts you can walk up to: { name, x, z, line, atm }
  const benches = [], stallSpots = [], campSeats = [], walkAreas = {}, campfires = [], viewpoints = [];
  const woodMat = mat(0x9c6b3f, { roughness: 0.8 }), ironMat = mat(0x2b2f3a, { metalness: 0.5, roughness: 0.5 });
  const BG = { seat: new THREE.BoxGeometry(1.8, 0.08, 0.5), back: new THREE.BoxGeometry(1.8, 0.4, 0.06), leg: new THREE.BoxGeometry(0.08, 0.47, 0.46) };
  function bench(x, z, face, tag) { // face: the way a sitter looks (car-style heading)
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
    add(BG.seat, woodMat, 0, 0.5, 0, g); add(BG.back, woodMat, 0, 0.8, -0.25, g);
    for (const sx of [-0.8, 0.8]) add(BG.leg, ironMat, sx, 0.24, 0, g, false);
    colliders.push({ x, z, r: 1.0 }); benches.push({ x, z, face, tag, used: false });
  }
  const strip = (x, z, w, len, m, rotY = 0, y = 0.017) => { const s = add(new THREE.PlaneGeometry(w, len), m, x, y, z, scene, false); s.rotation.order = 'YXZ'; s.rotation.set(-Math.PI / 2, rotY, 0); return s; };
  const label = (text, fg, bg, w = 512, h = 128, font = 800) => textTexture((c, W, H) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, W, H); }
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    let fs = Math.floor(H * 0.62); c.font = `${font} ${fs}px system-ui, sans-serif`;
    while (c.measureText(text).width > W - 24 && fs > 12) { fs -= 2; c.font = `${font} ${fs}px system-ui, sans-serif`; }
    c.fillText(text, W / 2, H / 2 + 2);
  }, w, h);
  const signMat = (tex) => { const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.7 }); nightGlow.push({ std: m, day: 0, night: 0.85 }); return m; };
  const glowStd = (c, day = 0.1, night = 2.4) => { const m = new THREE.MeshStandardMaterial({ color: 0xfff4d6, emissive: c, emissiveIntensity: day }); nightGlow.push({ std: m, day, night }); return m; };
  const lampSpots = []; // park / street lamps in the neighbourhoods (instanced at the end, each with a pool of light)
  const lampPost = (x, z) => { lampSpots.push([x, z]); colliders.push({ x, z, r: 0.3 }); };
  const lampHeadMat = glowStd(0xffd08a, 0.15, 3);

  // ----- Market street (north): food stalls both sides, shops at the ends, lights strung across -----
  {
    const Z = -238, paved = mat(0x8a8577, { roughness: 0.9 });
    strip(0, Z, 210, 11, paved, 0, 0.018);
    strip(14, -215, 10, 40, roadMat);                                                     // road from the lap ring
    const arch = textTexture((c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#ea580c'); g.addColorStop(1, '#db2777'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 64px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('MARKET STREET', w / 2, h * 0.66); }, 768, 110);
    for (const sx of [7.5, 20.5]) { add(new THREE.BoxGeometry(0.8, 6.5, 0.8), woodMat, sx, 3.25, -218); colliders.push({ x: sx, z: -218, r: 0.6 }); }
    add(new THREE.BoxGeometry(14.5, 1.5, 0.4), [woodMat, woodMat, woodMat, woodMat, signMat(arch), signMat(arch)], 14, 6.6, -218);
    const STALLS = [
      ['MASALA DOSA', '🥞 Masala dosa — hot and crispy!', '#f59f00'], ['CHAI', '☕ Cutting chai, freshly brewed!', '#c2410c'], ['FRESH FRUITS', '🍎 Fresh fruit, straight from the farm!', '#2f9e44'],
      ['SPICES', '🌶️ Smell those spices!', '#e03131'], ['ICE CREAM', '🍦 Kulfi and ice cream!', '#f783ac'], ['JUICE', '🥤 Sugarcane juice, ice cold!', '#74b816'],
      ['BIRYANI', '🍛 Biryani — the queue is worth it.', '#f08c00'], ['BOOKS', '📚 Second-hand books, great finds!', '#1971c2'], ['TOYS', '🪁 Kites and toys!', '#7048e8'],
      ['FLOWERS', '🌼 Jasmine garlands!', '#f06595'], ['PANI PURI', '🥙 Pani puri — spicy and tangy!', '#0ca678'], ['FILTER COFFEE', '☕ Filter coffee, strong and sweet.', '#795548'],
      ['BAKERY', '🥐 Fresh puffs and buns!', '#e8590c'], ['CRAFTS', '🏺 Handmade crafts and pottery.', '#9c36b5'], ['CLOTHES', '👕 Shirts, sarees and scarves!', '#3b5bdb'],
    ];
    const goodsGeo = new THREE.IcosahedronGeometry(0.16, 0), goodsCols = [0xe03131, 0xfab005, 0x82c91e, 0xf76707, 0xffffff, 0xae3ec9];
    let si = 0;
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
      const x = -77 + i * 14, z = Z + side * 9.5, face = side < 0 ? 0 : Math.PI, [name, line, col] = STALLS[si++ % STALLS.length];
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
      const counterM = mat(0xa47148, { emissive: 0xffb36b, emissiveIntensity: 0 }); nightGlow.push({ std: counterM, day: 0, night: 0.45 });
      add(new THREE.BoxGeometry(3.8, 1.0, 1.1), counterM, 0, 0.5, 0.9, g);                                  // counter
      add(new THREE.BoxGeometry(3.8, 0.08, 1.2), mat(col), 0, 1.04, 0.9, g, false);
      for (const [px, pz] of [[-1.85, 1.4], [1.85, 1.4], [-1.85, -1.2], [1.85, -1.2]]) add(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 6), woodMat, px, 1.35, pz, g, false);
      const stripes = textTexture((c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#ffffff' : col; c.fillRect(k * w / 8, 0, w / 8, h); } }, 128, 16);
      const canopyM = new THREE.MeshStandardMaterial({ map: stripes, emissiveMap: stripes, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.8 }); nightGlow.push({ std: canopyM, day: 0, night: 0.55 });
      const canopy = add(new THREE.BoxGeometry(4.3, 0.08, 3.2), canopyM, 0, 2.85, 0.15, g); canopy.rotation.x = 0.22;
      const sign = add(new THREE.PlaneGeometry(3.4, 0.62), signMat(label(name, '#fff', col)), 0, 3.35, 1.62, g, false); sign.rotation.x = -0.08;
      for (let k = 0; k < 9; k++) add(goodsGeo, mat(goodsCols[(k + i) % goodsCols.length], { roughness: 0.6 }), -1.4 + (k % 5) * 0.7 + rand(-0.1, 0.1), 1.2, 0.7 + Math.floor(k / 5) * 0.4, g, false);
      add(new THREE.BoxGeometry(3.6, 0.9, 0.5), mat(0x6b4f35), 0, 0.45, -1.0, g, false);                           // back shelf
      colliders.push({ x: x - 1.2 * Math.cos(face), z, r: 1.9, shop: name }, { x: x + 1.2 * Math.cos(face), z, r: 1.9, shop: name });
      stallSpots.push({ x: x + Math.sin(face) * -0.1, z: z + Math.cos(face) * -0.1, face, line, name });
      shopsList.push({ name, line, x: x + Math.sin(face) * 2.6, z: z + Math.cos(face) * 2.6, fx: -Math.sin(face), fz: -Math.cos(face), sx: x, sz: z, sface: face });
    }
    const SHOPS = [['GROCERY', '#2f9e44'], ['CAFÉ', '#c2410c'], ['PHARMACY', '#1c7ed6'], ['TEA HOUSE', '#9c36b5']];
    [[-97, Z - 11, 0], [97, Z - 11, 0], [-97, Z + 11, Math.PI], [97, Z + 11, Math.PI]].forEach(([x, z, face], k) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
      const wall = mat([0xfff3bf, 0xffe8cc, 0xe7f5ff, 0xf3d9fa][k], { emissive: 0xffd8a8, emissiveIntensity: 0 }); nightGlow.push({ std: wall, day: 0, night: 0.32 });
      add(new THREE.BoxGeometry(9, 7, 8), wall, 0, 3.5, -1, g);
      add(new THREE.BoxGeometry(9.4, 0.4, 8.4), mat(0x868e96), 0, 7.2, -1, g);
      add(new THREE.PlaneGeometry(6.5, 1.1), signMat(label(SHOPS[k][0], '#fff', SHOPS[k][1])), 0, 4.6, 3.02, g, false);
      add(new THREE.PlaneGeometry(5.6, 2.4), glowStd(0xffe8a3, 0.25, 2.2), 0, 1.6, 3.02, g, false);                 // shop window
      for (const wx of [-2.6, 2.6]) add(new THREE.PlaneGeometry(1.4, 1.2), glowStd(0xffd08a, 0.05, 2), wx, 5.9, 3.02, g, false);
      const aw = add(new THREE.BoxGeometry(7, 0.08, 1.6), mat(SHOPS[k][1]), 0, 3.3, 3.6, g, false); aw.rotation.x = 0.3;
      colliders.push({ x, z: z - Math.cos(face) * 1, r: 4.8, shop: SHOPS[k][0] });
      shopsList.push({ name: SHOPS[k][0], x: x + Math.sin(face) * 5.2, z: z + Math.cos(face) * 5.2, fx: -Math.sin(face), fz: -Math.cos(face), sx: x + Math.sin(face) * 3.3, sz: z + Math.cos(face) * 3.3, sface: face,
        line: ['🛒 Welcome to the grocery!', '☕ Welcome in — fresh brews today.', '', '🍵 Sit back, the tea is fresh.'][k] });
    });
    { // Island Bank ATM by the market arch
      const g = new THREE.Group(); g.position.set(24, 0, -214); scene.add(g);
      add(new THREE.BoxGeometry(1.1, 2.0, 0.8), mat(0x1c7ed6, { roughness: 0.5 }), 0, 1.0, 0, g);
      add(new THREE.PlaneGeometry(0.62, 0.42), glowStd(0x74c0fc, 0.8, 2.4), 0, 1.35, 0.41, g, false);
      add(new THREE.BoxGeometry(0.5, 0.06, 0.2), mat(0xadb5bd), 0, 0.95, 0.45, g, false);
      add(new THREE.PlaneGeometry(1.0, 0.32), signMat(label('ISLAND BANK · ATM', '#fff', '#1864ab')), 0, 1.86, 0.41, g, false);
      colliders.push({ x: 24, z: -214, r: 0.8 });
      shopsList.push({ name: 'ISLAND BANK ATM', atm: true, x: 24, z: -212.2, fx: 0, fz: -1 });
    }
    // fairy lights strung across the street (glow after dark)
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 8, 6), glowStd(0xffd43b, 0.3, 3.5), 13 * 9);
    let bi = 0;
    for (let i = 0; i < 13; i++) for (let k = 0; k < 9; k++) {
      const x = -84 + i * 14, t = k / 8, z = Z - 8 + t * 16, y = 3.6 - Math.sin(t * Math.PI) * 0.7;
      dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); bulbs.setMatrixAt(bi++, dummy.matrix);
    }
    scene.add(bulbs);
    walkAreas.market = { type: 'rect', x0: -92, x1: 92, z0: Z - 3.5, z1: Z + 3.5 };
  }

  // ----- Village (south): homes on one side of the lane, huts on the other -----
  {
    const Z = 238, dirt = snowy(mat(0xc8b48a, { roughness: 1 }));
    strip(0, Z, 210, 8, dirt, 0, 0.018);
    strip(14, 215, 10, 40, roadMat);
    const walls = [0xfff4e6, 0xe3fafc, 0xfff0f6, 0xf4fce3, 0xfff9db, 0xe5dbff], roofs = [0xc92a2a, 0x1864ab, 0x5f3dc4, 0x2b8a3e, 0xd9480f, 0x495057];
    const winMat = glowStd(0xffc078, 0.05, 2.6);
    [-90, -66, -42, -18, 34, 58, 82, 100].forEach((x, k) => {           // homes (north side, facing the lane)
      const g = new THREE.Group(); g.position.set(x, 0, Z - 13); scene.add(g);
      add(new THREE.BoxGeometry(8, 4.6, 7), mat(walls[k % walls.length]), 0, 2.3, 0, g);
      const roof = add(new THREE.ConeGeometry(6.4, 3.4, 4), mat(roofs[k % roofs.length]), 0, 6.3, 0, g); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.85;
      add(new THREE.BoxGeometry(1.3, 2.3, 0.1), mat(0x5c3d2e), 0, 1.15, 3.52, g, false);
      for (const wx of [-2.5, 2.5]) add(new THREE.PlaneGeometry(1.3, 1.1), winMat, wx, 2.6, 3.53, g, false);
      add(new THREE.BoxGeometry(0.7, 1.6, 0.7), mat(0x868e96), 2.2, 7.0, -1, g);                                    // chimney
      for (let f = -3.6; f <= 3.6; f += 0.9) if (Math.abs(f) > 1) add(new THREE.BoxGeometry(0.1, 0.7, 0.1), mat(0xf8f9fa), f, 0.35, 5.4, g, false); // picket fence
      colliders.push({ x, z: Z - 13, r: 4.9 });
    });
    const mud = mat(0xb08055, { roughness: 1 }), thatch = mat(0xd4a24c, { roughness: 1, flatShading: true });
    [-84, -60, -36, -12, 12, 36, 60, 84].forEach((x) => {               // huts (south side)
      const g = new THREE.Group(); g.position.set(x, 0, Z + 13); g.rotation.y = Math.PI; scene.add(g);
      add(new THREE.CylinderGeometry(3, 3.1, 2.6, 18), mud, 0, 1.3, 0, g);
      add(jitter(new THREE.ConeGeometry(4, 3, 14, 2), 0.12), thatch, 0, 4.0, 0, g);
      add(new THREE.BoxGeometry(1.1, 1.9, 0.2), mat(0x3b2a1a), 0, 0.95, 2.95, g, false);
      add(new THREE.PlaneGeometry(0.7, 0.6), winMat, 1.8, 1.6, 2.45, g, false).rotation.y = 0.6;
      colliders.push({ x, z: Z + 13, r: 3.5 });
    });
    walkAreas.village = { type: 'rect', x0: -95, x1: 95, z0: Z - 2.5, z1: Z + 2.5 };
  }

  // ----- Park (north-west): lawn, paths, gazebo, benches, flower beds, lamps -----
  {
    const P = { x: -165, z: -170 };
    add(new THREE.CircleGeometry(30, 64), snowy(mat(0x84cc5c, { roughness: 1 })), P.x, 0.02, P.z, scene, false).rotation.x = -Math.PI / 2;
    const path = snowy(mat(0xe6d3a3, { roughness: 1 }));
    add(new THREE.RingGeometry(16, 19, 64), path, P.x, 0.03, P.z, scene, false).rotation.x = -Math.PI / 2;
    for (const r of [0, Math.PI / 2]) strip(P.x, P.z, 3, 58, path, r, 0.028);
    add(new THREE.CylinderGeometry(4.2, 4.4, 0.25, 8), mat(0xdee2e6), P.x, 0.12, P.z);              // gazebo
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; add(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), mat(0xf8f9fa), P.x + Math.cos(a) * 3.6, 1.7, P.z + Math.sin(a) * 3.6); }
    add(new THREE.ConeGeometry(5, 2.2, 8), mat(0x2b8a3e), P.x, 4.3, P.z).rotation.y = Math.PI / 8;
    colliders.push({ x: P.x, z: P.z, r: 4.3 });
    for (let k = 0; k < 8; k++) {                                           // benches facing the lawn centre
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = P.x + Math.cos(a) * 20.6, z = P.z + Math.sin(a) * 20.6;
      bench(x, z, Math.atan2(P.x - x, P.z - z), 'park');
    }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; lampPost(P.x + Math.cos(a) * 15, P.z + Math.sin(a) * 15); }
    const bedFlowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.2, 0), flat(0xffffff), 4 * 40);
    let fi = 0;
    for (let b = 0; b < 4; b++) {
      const a = (b / 4) * Math.PI * 2 + Math.PI / 4, bx = P.x + Math.cos(a) * 10, bz = P.z + Math.sin(a) * 10;
      add(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 20), mat(0x6b4f35), bx, 0.15, bz, scene, false);
      for (let k = 0; k < 40; k++) {
        const r = Math.sqrt(Math.random()) * 2, t = rand(0, 6.28);
        dummy.position.set(bx + Math.cos(t) * r, 0.42, bz + Math.sin(t) * r); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(rand(0.8, 1.3)); dummy.updateMatrix();
        bedFlowers.setMatrixAt(fi, dummy.matrix); bedFlowers.setColorAt(fi++, tmpC.set([0xf03e3e, 0xfcc419, 0xf783ac, 0xffffff, 0xcc5de8][b]));
      }
      colliders.push({ x: bx, z: bz, r: 2.3 });
    }
    scene.add(bedFlowers); winterHide.push(bedFlowers);
    const parkTrees = { trunks: new THREE.InstancedMesh(species.oak.trunk, flat(species.oak.trunkCol), 10), crowns: new THREE.InstancedMesh(species.oak.crown, flat(0xffffff), 10) };
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2, x = P.x + Math.cos(a) * 27, z = P.z + Math.sin(a) * 27;
      dummy.position.set(x, 0, z); dummy.rotation.set(0, rand(0, 6), 0); dummy.scale.setScalar(rand(0.9, 1.15)); dummy.updateMatrix();
      parkTrees.trunks.setMatrixAt(k, dummy.matrix); parkTrees.crowns.setMatrixAt(k, dummy.matrix); parkTrees.crowns.setColorAt(k, tmpC.set(species.oak.crowns[k % 4]));
      colliders.push({ x, z, r: 1.2 });
    }
    parkTrees.crowns.castShadow = true; scene.add(parkTrees.trunks, parkTrees.crowns);
    foliage.push({ im: parkTrees.crowns, kind: 'oak' });
    const ps = add(new THREE.PlaneGeometry(4, 1), signMat(label('ISLAND PARK', '#fff', '#2b8a3e')), P.x + 21, 2.2, P.z + 21, scene, false);
    ps.rotation.y = Math.atan2(1, 1);
    add(new THREE.BoxGeometry(0.15, 1.8, 0.15), woodMat, P.x + 21, 0.9, P.z + 21);
    walkAreas.park = { type: 'ring', cx: P.x, cz: P.z, r0: 16.8, r1: 18.2 };
  }

  // ----- Tent camps (east & west), each round a campfire -----
  for (const C of [{ x: 238, z: 108 }, { x: -238, z: 104 }]) {
    add(new THREE.CircleGeometry(1.6, 16), mat(0x495057, { roughness: 1 }), C.x, 0.03, C.z, scene, false).rotation.x = -Math.PI / 2;
    for (const r of [0.5, -0.6]) { const l = add(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 7), mat(0x5c3d2e), C.x, 0.18, C.z); l.rotation.set(Math.PI / 2, 0, r); }
    const flame = new THREE.Group(); flame.position.set(C.x, 0.25, C.z); scene.add(flame);
    add(new THREE.ConeGeometry(0.55, 1.4, 8), new THREE.MeshBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0.9 }), 0, 0.7, 0, flame, false);
    add(new THREE.ConeGeometry(0.3, 0.9, 8), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95 }), 0, 0.5, 0, flame, false);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,170,60,0.9)', 'rgba(255,120,40,0.3)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.3 }));
    glow.position.set(C.x, 1.2, C.z); glow.scale.set(7, 7, 1); scene.add(glow);
    nightGlow.push({ basic: glow.material, max: 0.9, dayMin: 0.15 });
    campfires.push(flame);
    colliders.push({ x: C.x, z: C.z, r: 1.3 });
    for (let k = 0; k < 3; k++) {                                        // log seats round the fire
      const a = (k / 3) * Math.PI * 2 + 0.4, x = C.x + Math.cos(a) * 3.4, z = C.z + Math.sin(a) * 3.4;
      const lg = add(new THREE.CylinderGeometry(0.28, 0.28, 2, 9), mat(0x7a5230), x, 0.28, z); lg.rotation.set(0, Math.PI / 2 - a, Math.PI / 2);
      campSeats.push({ x: x - Math.cos(a) * 0.05, z: z - Math.sin(a) * 0.05, face: Math.atan2(C.x - x, C.z - z) });
    }
    const TC = [0xf76707, 0x12b886, 0xfab005, 0xe03131, 0x4263eb];
    for (let k = 0; k < 5; k++) {                                        // tents facing the fire
      const a = (k / 5) * Math.PI * 2 + 1.0, x = C.x + Math.cos(a) * 10, z = C.z + Math.sin(a) * 10;
      const sh = new THREE.Shape(); sh.moveTo(-1.6, 0); sh.lineTo(0, 2.2); sh.lineTo(1.6, 0); sh.closePath();
      const tg = new THREE.ExtrudeGeometry(sh, { depth: 3.4, bevelEnabled: false }); tg.translate(0, 0, -1.7);
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.atan2(C.x - x, C.z - z); scene.add(g);
      add(tg, mat(TC[k], { roughness: 0.7 }), 0, 0, 0, g);
      const ds = new THREE.Shape(); ds.moveTo(-0.55, 0); ds.lineTo(0, 1.2); ds.lineTo(0.55, 0); ds.closePath();
      add(new THREE.ShapeGeometry(ds), mat(0x212529), 0, 0.01, 1.72, g, false);
      colliders.push({ x, z, r: 2.1 });
    }
  }

  // ----- Sunrise point (east) and sunset point (west): decks on the beach -----
  for (const V of [{ x: 287, z: -66, face: Math.PI / 2, name: '☀  SUNRISE POINT', msg: '☀ Sunrise Point — come back at dawn (press N to skip ahead).' },
                   { x: -288, z: 44, face: -Math.PI / 2, name: '🌅  SUNSET POINT', msg: '🌅 Sunset Point — best just before nightfall.' }]) {
    const g = new THREE.Group(); g.position.set(V.x, 0, V.z); g.rotation.y = V.face; scene.add(g);
    add(new THREE.BoxGeometry(12, 0.18, 9), mat(0xb08055, { roughness: 0.85 }), 0, 0.09, 0, g);
    for (let k = -5; k <= 5; k += 2.5) add(new THREE.BoxGeometry(0.15, 1.0, 0.15), woodMat, k, 0.6, 4.4, g, false);
    add(new THREE.BoxGeometry(12, 0.1, 0.12), woodMat, 0, 1.05, 4.4, g, false);
    const sign = add(new THREE.PlaneGeometry(4.2, 1), signMat(label(V.name, '#fff', '#d9480f')), 0, 2.6, -4.3, g, false); sign.rotation.y = Math.PI;
    for (const sx of [-1.6, 1.6]) add(new THREE.BoxGeometry(0.12, 2.3, 0.12), woodMat, sx, 1.15, -4.3, g, false);
    add(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8), ironMat, 4.4, 0.7, 3.4, g, false);           // coin telescope
    const scope = add(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 10), ironMat, 4.4, 1.4, 3.6, g, false); scope.rotation.x = Math.PI / 2 - 0.2;
    const fx = Math.sin(V.face), fz = Math.cos(V.face), rx = Math.cos(V.face), rz = -Math.sin(V.face);
    for (const s of [-3.2, 0, 3.2]) bench(V.x + rx * s + fx * 1.2, V.z + rz * s + fz * 1.2, V.face, 'view');
    for (let k = -5; k <= 5; k += 2.5) colliders.push({ x: V.x + rx * k + fx * 4.4, z: V.z + rz * k + fz * 4.4, r: 0.5 });
    viewpoints.push({ x: V.x, z: V.z, msg: V.msg, seen: false });
  }
  // benches round the plaza, between the spokes
  for (const deg of [-64.3, -12.9, 38.6, 141.4, 192.9, 244.3]) { const a = deg * DEG; bench(Math.cos(a) * 29.5, Math.sin(a) * 29.5, Math.atan2(-Math.cos(a), -Math.sin(a)), 'plaza'); }
  walkAreas.plaza = { type: 'ring', cx: 0, cz: 0, r0: 9, r1: 20 };

  // ----- lamps for every hangout spot: market street, village lane, park, plaza, camps, viewpoints, side roads -----
  for (let i = 0; i <= 12; i++) for (const side of [-1, 1]) lampPost(-84 + i * 14, -238 + side * 6);          // market: posts that carry the fairy lights
  for (let x = -90; x <= 100; x += 19) if (x < 6 || x > 22) for (const side of [-1, 1]) lampPost(x, 238 + side * 5.2); // village lane
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; lampPost(-165 + Math.cos(a) * 22, -170 + Math.sin(a) * 22); } // park outer path
  for (const deg of [-64.3, -12.9, 38.6, 141.4, 192.9, 244.3]) { const a = deg * DEG + 0.07; lampPost(Math.cos(a) * 26, Math.sin(a) * 26); } // plaza: a lamp by each bench
  for (const side of [-1, 1]) for (let z = 200; z <= 232; z += 12) { lampPost(21, side * z); }                   // roads to market & village
  for (const C of [[238, 108], [-238, 104]]) for (const a of [0.2, 2.3, 4.4]) lampPost(C[0] + Math.cos(a) * 15.5, C[1] + Math.sin(a) * 15.5); // camps
  for (const V of viewpoints) for (const s2 of [-1, 1]) lampPost(V.x + (V.x > 0 ? -5.5 : 5.5), V.z + s2 * 6.2);    // sunrise / sunset decks
  {
    const n = lampSpots.length;
    const poles = new THREE.InstancedMesh(merge([[new THREE.CylinderGeometry(0.08, 0.12, 3.6, 8), M4(0, 1.8, 0)], [new THREE.CylinderGeometry(0.22, 0.26, 0.2, 8), M4(0, 0.1, 0)], [new THREE.CylinderGeometry(0.16, 0.08, 0.22, 8), M4(0, 3.52, 0)]]), ironMat, n);
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 14, 10).translate(0, 3.78, 0), lampHeadMat, n);
    const poolTex2 = textTexture((g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,214,150,0.95)'); gr.addColorStop(0.4, 'rgba(255,190,110,0.4)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, 128, 128);
    const poolMat2 = new THREE.MeshBasicMaterial({ map: poolTex2, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, 0.1, 0), poolMat2, n);
    const haloMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,220,160,0.9)', 'rgba(255,190,110,0.25)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    lampSpots.forEach(([x, z], k) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      poles.setMatrixAt(k, dummy.matrix); heads.setMatrixAt(k, dummy.matrix); pools.setMatrixAt(k, dummy.matrix);
      const halo = new THREE.Sprite(haloMat); halo.position.set(x, 3.78, z); halo.scale.set(2.6, 2.6, 1); scene.add(halo);
    });
    poles.castShadow = true; pools.renderOrder = 1;
    scene.add(poles, heads, pools);
    nightGlow.push({ basic: poolMat2, max: 0.7 }, { basic: haloMat, max: 0.85 });
  }

  // forest density: noise-ish "clumps" so trees group into woods with clearings
  const clumps = Array.from({ length: 34 }, () => ({ x: rand(-HALF + 20, HALF - 20), z: rand(-HALF + 20, HALF - 20), r: rand(18, 46) }));
  const density = (x, z) => clumps.reduce((m, c) => Math.max(m, 1 - Math.hypot(x - c.x, z - c.z) / c.r), 0);
  const blocked = (x, z, r) => nearRoad(x, z) || colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + r);

  function plant(sp, n) {
    const trunks = new THREE.InstancedMesh(sp.trunk, flat(sp.trunkCol), n);
    const crowns = new THREE.InstancedMesh(sp.crown, flat(0xffffff), n);
    crowns.castShadow = true; trunks.castShadow = false; trunks.receiveShadow = crowns.receiveShadow = true;
    let k = 0, guard2 = 0;
    while (k < n && guard2++ < n * 60) {
      const x = rand(-HALF + 6, HALF - 6), z = rand(-HALF + 6, HALF - 6);
      const d = density(x, z);
      if (Math.random() > 0.08 + d * 0.92) continue;          // mostly inside clumps
      const s = rand(0.75, 1.45) * (0.85 + d * 0.3);
      if (blocked(x, z, sp.r * s + 1.6)) continue;
      dummy.position.set(x, 0, z);
      dummy.rotation.set(rand(-0.05, 0.05), rand(0, Math.PI * 2), rand(-0.05, 0.05));
      dummy.scale.set(s * rand(0.9, 1.1), s * rand(0.9, 1.15), s * rand(0.9, 1.1));
      dummy.updateMatrix();
      trunks.setMatrixAt(k, dummy.matrix); crowns.setMatrixAt(k, dummy.matrix);
      tmpC.set(sp.crowns[Math.floor(Math.random() * sp.crowns.length)]).offsetHSL(rand(-0.015, 0.015), rand(-0.05, 0.05), rand(-0.05, 0.05));
      crowns.setColorAt(k, tmpC);
      colliders.push({ x, z, r: sp.r * s });
      k++;
    }
    trunks.count = crowns.count = k;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    scene.add(trunks, crowns);
    if (crowns.instanceColor) foliage.push({ im: crowns, kind: sp.kind });
  }
  for (const key in species) plant(Object.assign(species[key], { kind: key }), species[key].count);

  function scatter(geo, n, cols, sMin, sMax, yK, solidR) { // bushes, rocks, flowers (no shadow casting: cheap)
    const im = new THREE.InstancedMesh(geo, flat(0xffffff), n); im.castShadow = false; im.receiveShadow = true;
    let k = 0, g2 = 0;
    while (k < n && g2++ < n * 30) {
      const x = rand(-HALF + 4, HALF - 4), z = rand(-HALF + 4, HALF - 4);
      if (blocked(x, z, 0.8)) continue;
      if (Math.random() > 0.25 + density(x, z) * 0.75) continue;
      const s = rand(sMin, sMax);
      dummy.position.set(x, s * yK, z); dummy.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      dummy.scale.set(s * rand(0.8, 1.3), s * rand(0.6, 1), s * rand(0.8, 1.3)); dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      im.setColorAt(k, tmpC.set(cols[Math.floor(Math.random() * cols.length)]).offsetHSL(0, 0, rand(-0.05, 0.05)));
      if (solidR) colliders.push({ x, z, r: s * solidR });
      k++;
    }
    im.count = k; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
    return im;
  }
  const bushes = scatter(BUSH, 420, [0x2f7d32, 0x3b8f3e, 0x4f9d48, 0x2c6e30], 0.7, 1.6, 0.55, 0);
  foliage.push({ im: bushes, kind: 'bush' });
  scatter(ROCK, 160, [0x8a8f98, 0x9aa0a8, 0x7a7f88, 0x6f7a6a], 0.5, 1.8, 0.35, 0.9);
  const flowers = scatter(new THREE.IcosahedronGeometry(0.22, 0), 600, [0xf06595, 0xffd43b, 0xffffff, 0xcc5de8, 0x74c0fc], 0.7, 1.3, 0.2, 0); // wildflowers

  // ---------- Glowing particles: fireflies in the woods at night, spores in the cave ----------
  function glowPoints(list, colA, colB, size) {
    const N = list.length, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    list.forEach((p, k) => { pos.set(p, k * 3); seed[k] = Math.random() * 100; });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uPR: { value: Math.min(devicePixelRatio, 2) }, uA: { value: new THREE.Color(colA) }, uB: { value: new THREE.Color(colB) } },
      vertexShader: `attribute float aSeed; uniform float uTime, uPR; varying float vB; varying float vM;
        void main(){
          vec3 p = position + vec3(sin(uTime*0.5 + aSeed)*1.6, sin(uTime*0.9 + aSeed*1.7)*0.6, cos(uTime*0.4 + aSeed*2.3)*1.6);
          vB = pow(max(sin(uTime*1.7 + aSeed*3.0), 0.0), 2.0); vM = fract(aSeed*0.37);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vB *= 1.0 - smoothstep(60.0, 140.0, -mv.z);
          gl_PointSize = clamp(uPR * ${size.toFixed(1)} * (24.0 / -mv.z), 1.0, 26.0);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uOpacity; uniform vec3 uA, uB; varying float vB; varying float vM;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
          gl_FragColor = vec4(mix(uA, uB, vM), pow(1.0 - d*2.0, 1.5) * (0.25 + vB) * uOpacity); }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false;
    return { pts, m };
  }
  const fireflies = (() => {
    const list = [];
    for (let guard = 0; list.length < 420 && guard < 20000; guard++) {
      const c = clumps[Math.floor(Math.random() * clumps.length)], a = rand(0, 6.28), r = Math.sqrt(Math.random()) * c.r;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (Math.hypot(x, z) < shoreAt(x, z) - 12) list.push([x, rand(0.6, 3.6), z]);
    }
    const f = glowPoints(list, 0xd9f99d, 0xfde68a, 5); scene.add(f.pts); return f;
  })();

  // ---------- THE CORE: a secret cavern far below (its own space, reached only through the cave) ----------
  const UG = { x: 0, z: 3000 };                                   // where the underground lives (out of sight of the world)
  const TP = [[0, -4], [0, 40], [14, 70], [6, 100], [0, 124]];    // tunnel centre line (local)
  const CC = { x: 0, z: 165 }, CR = 44, DOME = 52, TUN_R = 5.5, TUN_HW = 3.4;
  const cave = new THREE.Group(); cave.position.set(UG.x, 0, UG.z); cave.visible = false; scene.add(cave);
  const exhibits = [];
  let coreCrystal = null;
  const CORE_AT = { x: 0, z: 207 };
  (() => {
    const rockIn = new THREE.MeshStandardMaterial({ color: 0x3b3550, roughness: 1, flatShading: true, side: THREE.BackSide });
    const lumpy = (geo, amt) => { // deterministic bumps so shared vertices stay welded
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const n = Math.sin(x * 0.61 + z * 0.23) * Math.cos(y * 0.73 - x * 0.31) + 0.5 * Math.sin(z * 1.37 + y * 0.9);
        const f = 1 + n * amt; p.setXYZ(k, x * f, y * (y > 0.3 ? f : 1), z * f);
      }
      geo.computeVertexNormals(); return geo;
    };
    const veinTex = textTexture((g, w, h) => {
      g.fillStyle = '#1b1726'; g.fillRect(0, 0, w, h);
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rand(40, 70)},${rand(35, 55)},${rand(60, 90)},0.5)`; g.fillRect(rand(0, w), rand(0, h), rand(2, 14), rand(2, 14)); }
      g.lineWidth = 2.5; g.shadowBlur = 8;
      for (let k = 0; k < 26; k++) {
        const c = k % 3 ? '#a855f7' : '#22d3ee'; g.strokeStyle = c; g.shadowColor = c; g.globalAlpha = rand(0.35, 0.8);
        let x = rand(0, w), y = rand(0, h); g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 8; s++) { x += rand(-60, 60); y += rand(-60, 60); g.lineTo(x, y); }
        g.stroke();
      }
      g.globalAlpha = 1;
    }, 512, 512);
    veinTex.wrapS = veinTex.wrapT = THREE.RepeatWrapping;
    const floorMat = (rx, ry) => { const t = veinTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.95 }); };

    // tunnel: half-cylinder arches along the centre line, with rounded chambers at the bends
    for (let i = 0; i < TP.length - 1; i++) {
      const [x0, z0] = TP[i], [x1, z1] = TP[i + 1], len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
      const arch = add(lumpy(new THREE.CylinderGeometry(TUN_R, TUN_R, len + 2, 22, Math.ceil(len / 3), true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), 0.06), rockIn, (x0 + x1) / 2, 0, (z0 + z1) / 2, cave, false);
      arch.rotation.y = ry;
      const fl = add(new THREE.PlaneGeometry(TUN_R * 2, len + 2), floorMat(1.2, len / 9), (x0 + x1) / 2, 0.01, (z0 + z1) / 2, cave, false);
      fl.rotation.order = 'YXZ'; fl.rotation.set(-Math.PI / 2, ry, 0);
    }
    for (let i = 1; i < TP.length - 1; i++) {
      add(lumpy(new THREE.SphereGeometry(TUN_R + 0.6, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0.07), rockIn, TP[i][0], 0, TP[i][1], cave, false);
      add(new THREE.CircleGeometry(TUN_R + 0.6, 24), floorMat(1, 1), TP[i][0], 0.012, TP[i][1], cave, false).rotation.x = -Math.PI / 2;
    }
    // the way out: a soft wash of daylight at the tunnel's start
    const exitGlow = add(new THREE.CircleGeometry(TUN_R, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ map: glowTex('rgba(255,250,235,1)', 'rgba(255,236,200,0.75)'), fog: false, transparent: true }), 0, 0, -4.2, cave, false);
    exitGlow.scale.set(1, 1.05, 1);
    const exitSign = textTexture((c, w, h) => { c.fillStyle = '#fff'; c.font = '800 54px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('↑  WAY OUT  ↑', w / 2, h * 0.62); }, 512, 96);
    const es = add(new THREE.PlaneGeometry(5, 0.95), new THREE.MeshBasicMaterial({ map: exitSign, transparent: true, fog: false }), 0, 0.03, 1.5, cave, false);
    es.rotation.x = -Math.PI / 2;

    // the cavern: a lumpy dome with a glowing-vein floor
    add(lumpy(new THREE.SphereGeometry(DOME, 56, 22, 0, Math.PI * 2, 0, Math.PI / 2), 0.05), rockIn, CC.x, 0, CC.z, cave, false).scale.y = 0.62;
    add(new THREE.CircleGeometry(DOME, 72), floorMat(7, 7), CC.x, 0, CC.z, cave, false).rotation.x = -Math.PI / 2;

    // crystals (instanced, unlit so they glow), mushrooms along the tunnel, stalactites/stalagmites
    const crystalSpots = [];
    const cluster = (x, z, n, s) => { for (let k = 0; k < n; k++) crystalSpots.push([x + rand(-1.6, 1.6), z + rand(-1.6, 1.6), s * rand(0.6, 1.3)]); };
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 + rand(-0.1, 0.1); if (Math.abs(a - Math.PI * 1.5) < 0.25) continue; cluster(CC.x + Math.cos(a) * 48, CC.z + Math.sin(a) * 48, 5, 2.2); }
    for (let i = 0; i < TP.length - 1; i++) for (let t = 0.2; t < 1; t += 0.33) {
      const [x0, z0] = TP[i], [x1, z1] = TP[i + 1], x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, l = Math.hypot(x1 - x0, z1 - z0);
      const s = (Math.random() < 0.5 ? -1 : 1) * 5; cluster(x + (z1 - z0) / l * s, z - (x1 - x0) / l * s, 3, 0.8);
    }
    const crystalGeo = new THREE.OctahedronGeometry(0.5, 0).scale(1, 2.6, 1).translate(0, 0.9, 0);
    const crystals = new THREE.InstancedMesh(crystalGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), crystalSpots.length);
    const ccols = [0xa855f7, 0x22d3ee, 0xec4899, 0x818cf8];
    crystalSpots.forEach(([x, z, s], k) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(rand(-0.5, 0.5), rand(0, 6), rand(-0.5, 0.5)); dummy.scale.set(s, s, s); dummy.updateMatrix();
      crystals.setMatrixAt(k, dummy.matrix); crystals.setColorAt(k, tmpC.set(ccols[k % ccols.length]));
    });
    cave.add(crystals);
    const shroomSpots = [];
    for (let i = 0; i < TP.length - 1; i++) {
      const [x0, z0] = TP[i], [x1, z1] = TP[i + 1], l = Math.hypot(x1 - x0, z1 - z0);
      for (let d = 2; d < l; d += 2.6) { const s = d % 5.2 < 2.6 ? -1 : 1, off = s * rand(4.4, 4.9); shroomSpots.push([x0 + (x1 - x0) * d / l + (z1 - z0) / l * off, z0 + (z1 - z0) * d / l - (x1 - x0) / l * off, rand(0.45, 1.1)]); }
    }
    for (let k = 0; k < 40; k++) { const a = rand(0, Math.PI * 2), r = rand(46, 50); shroomSpots.push([CC.x + Math.cos(a) * r, CC.z + Math.sin(a) * r, rand(0.8, 1.8)]); }
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.13, 0.7, 6).translate(0, 0.35, 0), mat(0xe7e0f5), shroomSpots.length);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.66, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), shroomSpots.length);
    const scol = [0x22d3ee, 0xe879f9, 0x67e8f9, 0xa3e635];
    shroomSpots.forEach(([x, z, s], k) => {
      dummy.position.set(x, 0, z); dummy.rotation.set(rand(-0.2, 0.2), rand(0, 6), rand(-0.2, 0.2)); dummy.scale.set(s, s, s); dummy.updateMatrix();
      stems.setMatrixAt(k, dummy.matrix); caps.setMatrixAt(k, dummy.matrix); caps.setColorAt(k, tmpC.set(scol[k % scol.length]));
    });
    cave.add(stems, caps);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4260, roughness: 1, flatShading: true });
    const tites = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, -0.5, 0).rotateX(Math.PI), stoneMat, 70);
    for (let k = 0; k < 70; k++) {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * 44, ceil = Math.sqrt(DOME * DOME - r * r) * 0.62;
      dummy.position.set(CC.x + Math.cos(a) * r, ceil + 0.5, CC.z + Math.sin(a) * r); dummy.rotation.set(0, rand(0, 6), 0);
      const h = rand(2, 8) * (0.4 + 0.6 * (1 - r / 44)); dummy.scale.set(rand(0.4, 1.1), -h, rand(0.4, 1.1)); dummy.updateMatrix();
      tites.setMatrixAt(k, dummy.matrix);
    }
    const mites = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), stoneMat, 40);
    for (let k = 0; k < 40; k++) {
      const a = rand(0, Math.PI * 2); if (Math.abs(a - Math.PI * 1.5) < 0.22) { k--; continue; }
      const r = rand(47.5, 51); dummy.position.set(CC.x + Math.cos(a) * r, 0, CC.z + Math.sin(a) * r); dummy.rotation.set(0, rand(0, 6), 0);
      const s = rand(0.8, 2); dummy.scale.set(s, rand(2, 7), s); dummy.updateMatrix(); mites.setMatrixAt(k, dummy.matrix);
    }
    cave.add(tites, mites);

    // bioluminescent lake on the far side
    const LK = { x: CC.x, z: CC.z + 30, r: 9 };
    const lake = makeWater({ mode: 1, cx: UG.x + LK.x, cz: UG.z + LK.z, radius: LK.r, glow: 0.9, shallow: 0x22d3ee, deep: 0x0b1d3a, scale: 0.9 });
    lake.userData.cave = true;
    add(new THREE.CircleGeometry(LK.r, 48), lake, LK.x, 0.12, LK.z, cave, false).rotation.x = -Math.PI / 2;
    add(new THREE.TorusGeometry(LK.r + 0.3, 0.45, 6, 48), stoneMat, LK.x, 0.1, LK.z, cave).rotation.x = Math.PI / 2;
    colliders.push({ x: UG.x + LK.x, z: UG.z + LK.z, r: LK.r + 0.4 });

    // central dais + the AI brain hologram
    const dais = add(new THREE.CircleGeometry(8, 64), new THREE.MeshBasicMaterial({
      map: textTexture((c, w, h) => {
        c.fillStyle = '#0d0b18'; c.fillRect(0, 0, w, h); c.translate(w / 2, h / 2);
        c.strokeStyle = '#67e8f9'; c.shadowColor = '#22d3ee'; c.shadowBlur = 12;
        for (const r of [0.47, 0.36, 0.2]) { c.lineWidth = r === 0.47 ? 8 : 3; c.beginPath(); c.arc(0, 0, w * r, 0, Math.PI * 2); c.stroke(); }
        c.lineWidth = 3;
        for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * w * 0.2, Math.sin(a) * w * 0.2); c.lineTo(Math.cos(a) * w * 0.36, Math.sin(a) * w * 0.36); c.stroke(); c.beginPath(); c.arc(Math.cos(a) * w * 0.36, Math.sin(a) * w * 0.36, 6, 0, Math.PI * 2); c.fillStyle = '#e879f9'; c.fill(); }
      }, 512, 512), transparent: true }), CC.x, 0.04, CC.z, cave, false);
    dais.rotation.x = -Math.PI / 2;
    const beam = add(new THREE.CylinderGeometry(1.4, 3.2, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), CC.x, 4.5, CC.z, cave, false);
    const brain = new THREE.Group(); brain.position.set(CC.x, 12, CC.z); cave.add(brain);
    {
      const pts = [], N = 900;
      for (let k = 0; k < N; k++) { // two lobes with folds
        const side = k % 2 ? 1 : -1, th = Math.acos(rand(-1, 1)), ph = rand(0, Math.PI * 2);
        let x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
        const fold = 1 + 0.08 * Math.sin(th * 9 + ph * 5) + 0.05 * Math.sin(ph * 11);
        pts.push(new THREE.Vector3((x * 2.2 * fold + side * 2.25) * (x * side < -0.6 ? 0.9 : 1), y * 2.6 * fold, z * 3.4 * fold));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const cols = new Float32Array(N * 3); pts.forEach((p, k) => tmpC.set(p.z > 0 ? 0x67e8f9 : 0xe879f9).lerp(new THREE.Color(0xffffff), Math.random() * 0.3).toArray(cols, k * 3));
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      brain.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })));
      const seg = [];
      for (let k = 0; k < N; k += 3) { const a = pts[k]; for (let j = k + 1; j < Math.min(N, k + 60); j++) if (a.distanceTo(pts[j]) < 0.9) { seg.push(a, pts[j]); break; } }
      brain.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0xa5b4fc, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })));
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture((c, w, h) => { c.textAlign = 'center'; c.fillStyle = '#e0f2fe'; c.shadowColor = '#22d3ee'; c.shadowBlur = 20; c.font = '900 92px system-ui, sans-serif'; c.fillText('THE CORE', w / 2, 110); c.font = '600 34px system-ui, sans-serif'; c.fillStyle = '#c4b5fd'; c.fillText('where it all started', w / 2, 170); }, 512, 200), transparent: true, depthWrite: false }));
      label.position.set(0, 5.2, 0); label.scale.set(10, 3.9, 1); brain.add(label);
    }
    cave.userData = { brain, beam };

    // exhibits: real milestones, each on a lit pedestal with a hologram caption
    const gold = new THREE.MeshStandardMaterial({ color: 0xf5c542, metalness: 1, roughness: 0.22, emissive: 0x4a3200, emissiveIntensity: 0.4 });
    const shell = mat(0xf1f3f5, { roughness: 0.4 }), dark = mat(0x1e1b2e, { roughness: 0.5 });
    const models = {
      trophy(g) {
        add(new THREE.BoxGeometry(1.6, 0.4, 1.6), dark, 0, 0.2, 0, g);
        add(new THREE.CylinderGeometry(0.18, 0.3, 0.9, 16), gold, 0, 0.85, 0, g);
        add(new THREE.LatheGeometry([[0.15, 0], [0.7, 0.2], [0.95, 0.8], [1.0, 1.5], [0.9, 1.52]].map(([x, y]) => new THREE.Vector2(x, y)), 32), gold, 0, 1.3, 0, g);
        for (const s of [-1, 1]) { const h = add(new THREE.TorusGeometry(0.4, 0.07, 8, 20, Math.PI), gold, s * 0.98, 2.15, 0, g); h.rotation.z = s * -Math.PI / 2; }
        add(new THREE.OctahedronGeometry(0.3), gold, 0, 3.2, 0, g);
      },
      bp(g) {
        add(new THREE.BoxGeometry(2.0, 1.3, 0.5), shell, 0, 1.3, 0, g);
        const scr = textTexture((c, w, h) => {
          c.fillStyle = '#05131a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#34d399'; c.lineWidth = 6; c.shadowColor = '#34d399'; c.shadowBlur = 10; c.beginPath();
          for (let x = 0; x <= w; x += 4) { const t = (x % 128) / 128; const y = h * 0.55 - (t > 0.3 && t < 0.36 ? (t - 0.3) * 1800 : t > 0.36 && t < 0.42 ? (0.42 - t) * 1800 - 20 : Math.sin(t * 6.28) * 6); x ? c.lineTo(x, y) : c.moveTo(x, y); }
          c.stroke();
        }, 256, 128);
        g.userData.screen = scr;
        add(new THREE.PlaneGeometry(1.7, 0.95), new THREE.MeshBasicMaterial({ map: scr }), 0, 1.35, 0.26, g, false);
        const cuff = add(new THREE.TorusGeometry(0.55, 0.22, 10, 28), mat(0x4c6ef5, { roughness: 0.6 }), 1.6, 0.6, 0.4, g); cuff.rotation.y = 0.6; cuff.scale.set(1, 1, 1.6);
        const wire = new THREE.CatmullRomCurve3([new THREE.Vector3(0.9, 1.0, 0), new THREE.Vector3(1.3, 0.4, 0.3), new THREE.Vector3(1.5, 0.75, 0.4)]);
        add(new THREE.TubeGeometry(wire, 16, 0.04, 6), dark, 0, 0, 0, g, false);
        add(new THREE.SphereGeometry(0.12, 12, 8), mat(0xff4d6d, { emissive: 0xff2d55, emissiveIntensity: 1.5 }), -0.75, 1.75, 0.26, g, false);
      },
      maze(g) {
        add(new THREE.BoxGeometry(4.2, 0.2, 4.2), dark, 0, 0.1, 0, g);
        const wallM = mat(0x818cf8, { emissive: 0x4338ca, emissiveIntensity: 0.4 });
        const walls = [[-2, -2, 4.2, 0], [-2, 2, 4.2, 0], [-2, -2, 0, 4.2], [2, -2, 0, 4.2], [-1, -2, 0, 2.6], [0, -0.6, 0, 2.6], [1, -2, 0, 2.6], [-2, 1, 1.4, 0], [0.4, 1, 1.6, 0]];
        for (const [x, z, w, d] of walls) add(new THREE.BoxGeometry(Math.max(w, 0.15), 0.5, Math.max(d, 0.15)), wallM, x + w / 2, 0.45, z + d / 2, g, false);
        const bot = new THREE.Group(); g.add(bot);
        add(new THREE.BoxGeometry(0.5, 0.25, 0.6), mat(0xf59f00), 0, 0.42, 0, bot, false);
        add(new THREE.SphereGeometry(0.09, 8, 6), mat(0x22d3ee, { emissive: 0x22d3ee, emissiveIntensity: 2 }), 0, 0.6, 0.2, bot, false);
        g.userData.bot = bot;
        g.userData.path = [[-1.5, -1.5], [-1.5, 0.6], [-0.5, 0.6], [-0.5, -1.5], [0.5, -1.5], [0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [-1.5, 1.5]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      },
      robo(g) {
        add(new THREE.BoxGeometry(3.4, 0.12, 2.4), mat(0x0f7b4a, { roughness: 0.6 }), 0, 0.3, 0, g);
        for (let k = 0; k < 7; k++) add(new THREE.BoxGeometry(rand(0.3, 0.7), 0.14, rand(0.3, 0.6)), dark, rand(-1.4, 0.3), 0.42, rand(-0.9, 0.9), g, false);
        for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(0.9, 0.02, 0.03), mat(0xfcc419, { metalness: 0.8, roughness: 0.3 }), rand(-1.2, 0.2), 0.37, rand(-1, 1), g, false);
        const base = new THREE.Group(); base.position.set(1.05, 0.36, 0); g.add(base);
        add(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 16), mat(0xff922b), 0, 0.15, 0, base);
        const sh = new THREE.Group(); sh.position.y = 0.3; base.add(sh);
        add(new THREE.BoxGeometry(0.22, 1.3, 0.22), mat(0xf1f3f5), 0, 0.65, 0, sh);
        const el = new THREE.Group(); el.position.y = 1.3; sh.add(el);
        add(new THREE.SphereGeometry(0.17, 12, 8), mat(0xff922b), 0, 0, 0, el);
        add(new THREE.BoxGeometry(0.18, 1.0, 0.18), mat(0xf1f3f5), 0, 0.5, 0, el);
        for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.28, 0.08), dark, s * 0.08, 1.1, 0, el);
        g.userData.arm = { base, sh, el };
      },
    };
    const items = [
      { kind: 'trophy', deg: -20, color: '#f59f00', title: 'Smart India Hackathon — 1st Prize', caption: '1st PRIZE · SMART INDIA HACKATHON',
        body: `<p><b>National-level recognition.</b> 1st Prize at the Smart India Hackathon — engineering under a deadline, as a team, against a real problem statement.</p>` },
      { kind: 'bp', deg: 40, color: '#10b981', title: 'Non-invasive BP device', caption: 'NON-INVASIVE BP DEVICE',
        body: `<p><b>Hardware meets software.</b> A non-invasive blood-pressure device — sensors, electronics and code working as one system.</p><p class="note">Part of my AI, computer-vision and hardware–software integration work.</p>` },
      { kind: 'maze', deg: 140, color: '#6366f1', title: 'AGV Maze Solver', caption: 'AGV MAZE SOLVER · 2022',
        body: `<p><b>Robotics, in the browser.</b> A maze solver for an automated-guided-vehicle concept — it explores 40,344 solving approaches.</p><p class="note">April 2022 · one of my pre-AI-tools builds.</p>` },
      { kind: 'robo', deg: 200, color: '#ea580c', title: 'Electronics & Robotics roots', caption: 'WHERE IT STARTED · ROBOTICS',
        body: `<p><b>Circuits and robots came first.</b> Diploma in Electronics &amp; Robotics Engineering (S.A.P.T.C, Thellar, 2016–2018), then B.E. Mechatronics Engineering (Rajalakshmi Engineering College, 2018–2021).</p><p class="note">That's why I still think in whole systems — not just code.</p>` },
    ];
    for (const it of items) {
      const a = it.deg * DEG, x = CC.x + Math.cos(a) * 27, z = CC.z + Math.sin(a) * 27, col = new THREE.Color(it.color);
      add(new THREE.CylinderGeometry(2.7, 3.1, 1, 10), mat(0x2b2540, { roughness: 0.6 }), x, 0.5, z, cave);
      add(new THREE.TorusGeometry(3.2, 0.09, 6, 48), new THREE.MeshBasicMaterial({ color: col }), x, 0.06, z, cave, false).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35 }), x, 1.02, z, cave, false);
      add(new THREE.CylinderGeometry(0.6, 3.0, 14, 24, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), x, 8, z, cave, false);
      const g = new THREE.Group(); g.position.set(x, 1.05, z); g.scale.setScalar(1.1); cave.add(g);
      models[it.kind](g);
      const cap = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture((c, w, h) => {
        c.fillStyle = 'rgba(10,8,24,0.55)'; c.fillRect(0, 0, w, h); c.strokeStyle = it.color; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
        c.fillStyle = '#fff'; c.textAlign = 'center'; let fs = 46; c.font = `800 ${fs}px system-ui, sans-serif`;
        while (c.measureText(it.caption).width > w - 40 && fs > 22) { fs -= 2; c.font = `800 ${fs}px system-ui, sans-serif`; }
        c.fillText(it.caption, w / 2, h * 0.56);
      }, 768, 110), transparent: true, depthWrite: false }));
      cap.position.set(x, 6.4, z); cap.scale.set(8.4, 1.2, 1); cave.add(cap);
      colliders.push({ x: UG.x + x, z: UG.z + z, r: 3.1 });
      exhibits.push({ ...it, x: UG.x + x, z: UG.z + z, g, visited: false, dismissed: false, i: exhibits.length });
    }

    // the secret: the Core Crystal, tucked behind the lake
    const cg = new THREE.Group(); cg.position.set(CORE_AT.x, 1.8, CORE_AT.z); cave.add(cg);
    add(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshBasicMaterial({ color: 0xf5d0fe }), 0, 0, 0, cg, false).scale.set(1, 1.7, 1);
    add(new THREE.OctahedronGeometry(1.25, 0), new THREE.MeshBasicMaterial({ color: 0xc084fc, wireframe: true, transparent: true, opacity: 0.6 }), 0, 0, 0, cg, false).scale.set(1, 1.7, 1);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(240,200,255,0.9)', 'rgba(168,85,247,0.3)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(6, 6, 1); cg.add(halo);
    coreCrystal = { g: cg, taken: false };

    // lights (only counted while the cave is visible)
    const pl = (c, i, d, x, y, z) => { const l = new THREE.PointLight(c, i, d, 1); l.position.set(x, y, z); cave.add(l); return l; };
    cave.userData.brainLight = pl(0x67e8f9, 40, 70, CC.x, 11, CC.z);
    pl(0x22d3ee, 22, 30, LK.x, 3, LK.z);
    pl(0xc084fc, 30, 60, CC.x - 30, 9, CC.z - 8);
    pl(0xf472b6, 26, 60, CC.x + 30, 9, CC.z - 8);
    pl(0xa855f7, 14, 34, TP[1][0], 3.6, TP[1][1]);
    pl(0x22d3ee, 14, 34, TP[3][0], 3.6, TP[3][1]);
    pl(0xfff1d6, 10, 18, 0, 3, -1);
    const spores = [];
    for (let k = 0; k < 360; k++) {
      if (k < 260) { const a = rand(0, 6.28), r = Math.sqrt(Math.random()) * 46; spores.push([CC.x + Math.cos(a) * r, rand(0.5, 14), CC.z + Math.sin(a) * r]); }
      else { const i = Math.floor(rand(0, TP.length - 1)), t = Math.random(); spores.push([TP[i][0] + (TP[i + 1][0] - TP[i][0]) * t + rand(-3, 3), rand(0.5, 4), TP[i][1] + (TP[i + 1][1] - TP[i][1]) * t]); }
    }
    const sp = glowPoints(spores, 0xc4b5fd, 0x67e8f9, 4); sp.m.uniforms.uOpacity.value = 1; cave.add(sp.pts); cave.userData.spores = sp.m;
  })();
  // keep the car inside the tunnel + cavern (returns nothing; nudges S and bounces)
  function caveConstrain() {
    const lx = S.x - UG.x, lz = S.z - UG.z;
    const dx = lx - CC.x, dz = lz - CC.z, dc = Math.hypot(dx, dz);
    if (dc <= CR) return;
    let best = { d: dc - CR, px: CC.x + dx / dc * CR, pz: CC.z + dz / dc * CR, nx: -dx / dc, nz: -dz / dc };
    for (let i = 0; i < TP.length - 1; i++) {
      const [x0, z0] = TP[i], [x1, z1] = TP[i + 1], ex = x1 - x0, ez = z1 - z0;
      const t = clamp(((lx - x0) * ex + (lz - z0) * ez) / (ex * ex + ez * ez), 0, 1);
      const qx = x0 + ex * t, qz = z0 + ez * t, d = Math.hypot(lx - qx, lz - qz);
      if (d <= TUN_HW) return;
      if (d - TUN_HW < best.d) best = { d: d - TUN_HW, px: qx + (lx - qx) / d * TUN_HW, pz: qz + (lz - qz) / d * TUN_HW, nx: (qx - lx) / d, nz: (qz - lz) / d };
    }
    S.x = UG.x + best.px; S.z = UG.z + best.pz; bounce(best.nx, best.nz, 0.3);
  }
  const inCavern = () => Math.hypot(S.x - UG.x - CC.x, S.z - UG.z - CC.z) < DOME - 4;

  // ---------- Knock-over props ----------
  const props = [];
  const coneGeo = new THREE.ConeGeometry(0.55, 1.4, 12), crateGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const coneMat = mat(0xff922b), crateMat = mat(0xc08552);
  function addProp(kind, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    if (kind === 'cone') { add(coneGeo, coneMat, 0, 0.7, 0, g); add(new THREE.BoxGeometry(1.2, 0.12, 1.2), coneMat, 0, 0.06, 0, g); }
    else add(crateGeo, crateMat, 0, 0.7, 0, g);
    props.push({ g, x, z, y: 0, vx: 0, vz: 0, vy: 0, spin: 0, tumble: 0, r: kind === 'cone' ? 0.7 : 1 });
  }
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; addProp('cone', Math.cos(a) * 27, Math.sin(a) * 27); }
  for (const zn of zones) {
    const a = zn.a + 0.12;
    for (let k = 0; k < 3; k++) addProp('crate', Math.cos(a) * (RING + 2 + k * 1.6), Math.sin(a) * (RING + 2 + k * 1.6));
  }

  // ---------- Collectible stars ----------
  const stars = [];
  const starGeo = new THREE.OctahedronGeometry(0.9);
  const starMat = mat(0xffd43b, { emissive: 0xffb700, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.4 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const r = i % 3 === 0 ? RING * 0.45 : RING + (i % 2 ? 2.5 : -2.5);
    const m = add(starGeo, starMat, Math.cos(a) * r, 1.6, Math.sin(a) * r);
    stars.push({ m, taken: false, phase: Math.random() * 6, base: 1.6 });
  }
  for (const c of connectors) { // sky stars: only reachable by jumping off the ramp
    const m = add(starGeo, starMat, c.dir.x * 168, 5.2, c.dir.z * 168);
    m.scale.setScalar(1.4);
    stars.push({ m, taken: false, phase: Math.random() * 6, base: 5.2 });
  }
  const N_STARS = stars.length;
  let starsTaken = 0;

  // ---------- People: one low-poly body used by the player (on foot / bike rider) and the islanders ----------
  const HG = {
    torso: new THREE.BoxGeometry(0.42, 0.58, 0.24), head: new THREE.SphereGeometry(0.14, 14, 10),
    hair: new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), neck: new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8),
    leg: new THREE.BoxGeometry(0.15, 0.86, 0.17).translate(0, -0.43, 0), shoe: new THREE.BoxGeometry(0.16, 0.08, 0.27),
    arm: new THREE.BoxGeometry(0.1, 0.58, 0.11).translate(0, -0.29, 0), hand: new THREE.SphereGeometry(0.06, 8, 6),
    dress: new THREE.CylinderGeometry(0.22, 0.38, 0.62, 12), hat: new THREE.CylinderGeometry(0.17, 0.19, 0.13, 14),
    brim: new THREE.CylinderGeometry(0.29, 0.29, 0.02, 16), helmet: new THREE.SphereGeometry(0.2, 16, 12),
  };
  for (const g of Object.values(HG)) g.userData.shared = true;   // shared by every person: never dispose
  const matCache = new Map();
  const cm = (c) => { if (c && c.isMaterial) return c; if (!matCache.has(c)) matCache.set(c, mat(c, { roughness: 0.75 })); return matCache.get(c); };
  function makeHuman(o, shadow = true) { // faces +z, feet at y = 0
    const g = new THREE.Group();
    const legs = [-0.1, 0.1].map((x) => { const p = new THREE.Group(); p.position.set(x, 0.92, 0); g.add(p); add(HG.leg, cm(o.pants), 0, 0, 0, p, shadow); add(HG.shoe, cm(0x22222a), 0, -0.88, 0.04, p, false); return p; });
    if (o.dress) add(HG.dress, cm(o.shirt), 0, 0.68, 0, g, shadow);
    const upper = new THREE.Group(); upper.position.y = 0.92; g.add(upper);
    add(HG.torso, cm(o.shirt), 0, 0.3, 0, upper, shadow);
    add(HG.neck, cm(o.skin), 0, 0.64, 0, upper, false);
    add(HG.head, cm(o.skin), 0, 0.78, 0, upper, shadow);
    if (o.helmet) add(HG.helmet, cm(o.helmet), 0, 0.8, 0, upper, shadow); else add(HG.hair, cm(o.hair), 0, 0.8, -0.012, upper, false);
    if (o.hat) { add(HG.hat, cm(o.hat), 0, 0.95, 0, upper, false); add(HG.brim, cm(o.hat), 0, 0.89, 0, upper, false); }
    const arms = [-0.27, 0.27].map((x) => { const p = new THREE.Group(); p.position.set(x, 0.56, 0); upper.add(p); add(HG.arm, cm(o.shirt), 0, 0, 0, p, false); add(HG.hand, cm(o.skin), 0, -0.62, 0, p, false); return p; });
    return { g, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], upper };
  }
  function poseHuman(h, phase, amp) { // walk / run cycle (amp 0 = standing)
    const s = Math.sin(phase) * amp;
    h.legL.rotation.x = s; h.legR.rotation.x = -s; h.armL.rotation.x = -s * 0.9; h.armR.rotation.x = s * 0.9;
    h.armL.rotation.z = h.armR.rotation.z = 0; h.upper.rotation.x = amp * 0.12;
  }
  function sitHuman(h) { h.legL.rotation.x = h.legR.rotation.x = -1.45; h.armL.rotation.x = h.armR.rotation.x = -0.35; h.armL.rotation.z = h.armR.rotation.z = 0; h.upper.rotation.x = -0.05; }

  // ---------- Garage: four car models sharing one paint (no brand marks on any of them) ----------
  const car = new THREE.Group(); car.rotation.order = 'YXZ'; scene.add(car);
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x5b5cf6, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x2a1a8a, emissiveIntensity: 0.18 });
  const black = mat(0x14141b, { roughness: 0.55 }), carbon = mat(0x24242e, { roughness: 0.3, metalness: 0.5 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0e1220, metalness: 0.3, roughness: 0.05, clearcoat: 1 });
  const chrome = mat(0xeef1f5, { metalness: 1, roughness: 0.12 }), cream = mat(0xf3ead2, { roughness: 0.45 });
  const lightMat = mat(0xffffff, { emissive: 0xeaf4ff, emissiveIntensity: 1.4 }), drlMat = mat(0xffffff, { emissive: 0x7dd3fc, emissiveIntensity: 2 });
  const tailMat = mat(0xff1f3d, { emissive: 0xff1030, emissiveIntensity: 1.1 });
  nightGlow.push({ std: lightMat, day: 1.4, night: 3.5 }, { std: tailMat, day: 1.1, night: 2.6 });
  const tyreMat = mat(0x111114, { roughness: 0.9 }), rimMat = mat(0x2a2c35, { metalness: 0.85, roughness: 0.25 });
  const spokeMat = mat(0xc9ced8, { metalness: 0.95, roughness: 0.18 }), caliperMat = mat(0xec4899, { roughness: 0.4 });
  let model = null, body = null, wheels = [], wheelR = 0.5;
  function bodyPart(pts, width, material, bevel) {
    const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) sh.lineTo(pts[k][0], pts[k][1]);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: width, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 });
    g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // side profile x -> car forward (+z)
    return add(g, material, 0, 0, 0, body);
  }
  function tube(a, b, r, m) { // a cylinder between two points (roll cages, arms)
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const me = add(new THREE.CylinderGeometry(r, r, d.length(), 8), m, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, body, false);
    me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return me;
  }
  function addWheels(list, o) { // list: [x, z, front]; o: { r, w, style(wheelMesh, side), caliper }
    wheelR = o.r;
    const tyre = new THREE.CylinderGeometry(o.r, o.r, o.w, 26).rotateZ(Math.PI / 2);
    for (const [x, z, front] of list) {
      const pivot = new THREE.Group(); pivot.position.set(x, o.r, z); model.add(pivot);
      if (o.caliper) add(new THREE.BoxGeometry(0.12, 0.24, 0.3), o.caliper, x < 0 ? 0.1 : -0.1, 0.14, 0, pivot, false);
      const w = add(tyre, tyreMat, 0, 0, 0, pivot);
      o.style(w, x < 0 ? -1 : 1, o);
      wheels.push({ pivot, w, front });
    }
  }
  const spokes = (n, rim, spoke, len = 0.66) => (w, s, o) => {
    add(new THREE.CylinderGeometry(o.r * 0.74, o.r * 0.74, o.w + 0.02, 22).rotateZ(Math.PI / 2), rim, 0, 0, 0, w, false);
    for (let k = 0; k < n; k++) { const sp = add(new THREE.BoxGeometry(o.w + 0.03, 0.06, len), spoke, 0, 0, 0, w, false); sp.rotation.x = (k * Math.PI) / n; }
  };

  const MODELS = {
    coupe: {
      name: 'Sports coupe', blurb: 'Balanced and grippy — the all-rounder.',
      spec: { acc: 20, boostAcc: 34, max: 28, boostMax: 44, turn: 2.3, air: 0.25 },
      build() { // M4-inspired: long bonnet, low roof, short tail
        bodyPart([[-2.25, 0.32], [-2.32, 0.62], [-2.28, 0.98], [-1.95, 1.07], [-1.15, 1.09], [1.05, 1.05], [2.05, 0.9], [2.36, 0.72], [2.39, 0.5], [2.28, 0.3]], 1.94, paint, 0.09);
        bodyPart([[-1.2, 1.07], [-0.44, 1.54], [0.3, 1.57], [1.04, 1.07]], 1.6, glass, 0.05);
        bodyPart([[-0.52, 1.52], [-0.4, 1.61], [0.28, 1.63], [0.4, 1.55]], 1.46, carbon, 0.04);
        add(new THREE.BoxGeometry(0.9, 0.24, 0.1), black, 0, 0.6, 2.4, body, false);
        for (const sx of [-1, 1]) {
          add(new THREE.BoxGeometry(0.42, 0.3, 0.1), black, sx * 0.74, 0.5, 2.36, body, false);
          add(new THREE.BoxGeometry(0.56, 0.11, 0.12), lightMat, sx * 0.66, 0.84, 2.25, body, false).rotation.y = sx * 0.25;
          add(new THREE.BoxGeometry(0.42, 0.035, 0.1), drlMat, sx * 0.66, 0.76, 2.28, body, false);
          add(new THREE.BoxGeometry(0.08, 0.13, 2.7), carbon, sx * 1.03, 0.38, 0, body);
          add(new THREE.BoxGeometry(0.04, 0.2, 0.42), black, sx * 1.04, 0.74, 0.98, body, false);
          add(new THREE.BoxGeometry(0.22, 0.12, 0.3), paint, sx * 1.02, 1.17, 0.78, body);
          add(new THREE.BoxGeometry(0.62, 0.12, 0.08), tailMat, sx * 0.62, 0.9, -2.44, body, false);
          for (const ex of [0.44, 0.62]) add(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12), chrome, sx * ex, 0.4, -2.36, body, false).rotation.x = Math.PI / 2;
        }
        add(new THREE.BoxGeometry(2.05, 0.05, 0.3), carbon, 0, 0.3, 2.3, body);
        add(new THREE.BoxGeometry(1.5, 0.2, 0.32), carbon, 0, 0.38, -2.24, body);
        add(new THREE.BoxGeometry(1.75, 0.05, 0.28), carbon, 0, 1.14, -2.02, body);
        addWheels([[-1.06, 1.42, 1], [1.06, 1.42, 1], [-1.06, -1.38, 0], [1.06, -1.38, 0]], { r: 0.5, w: 0.42, caliper: caliperMat, style: spokes(5, rimMat, spokeMat, 0.66) });
      },
    },
    super: {
      name: 'Hypercar', blurb: 'Fastest by far — light, wide and twitchy.',
      spec: { acc: 27, boostAcc: 40, max: 34, boostMax: 54, turn: 2.5, air: 0.25 },
      build() { // low wedge, cab-forward canopy, big wing
        bodyPart([[-2.35, 0.3], [-2.42, 0.72], [-2.15, 0.9], [-1.25, 0.94], [0.95, 0.84], [2.2, 0.52], [2.46, 0.38], [2.4, 0.26]], 2.04, paint, 0.08);
        bodyPart([[-0.95, 0.9], [-0.25, 1.3], [0.4, 1.31], [1.3, 0.84]], 1.4, glass, 0.06);
        bodyPart([[-2.05, 0.9], [-0.95, 0.9], [-0.3, 1.24], [-1.5, 1.06]], 1.05, carbon, 0.04);
        for (const sx of [-1, 1]) {
          add(new THREE.BoxGeometry(0.62, 0.05, 0.12), lightMat, sx * 0.72, 0.56, 2.33, body, false).rotation.y = sx * 0.35;
          add(new THREE.BoxGeometry(0.06, 0.36, 1.1), black, sx * 1.04, 0.62, -0.55, body, false);      // side intake
          add(new THREE.BoxGeometry(0.08, 0.1, 3.4), carbon, sx * 1.04, 0.32, 0, body);
          add(new THREE.BoxGeometry(0.06, 0.45, 0.06), carbon, sx * 0.62, 1.15, -2.0, body);           // wing posts
          add(new THREE.BoxGeometry(0.06, 0.32, 0.5), carbon, sx * 1.08, 1.4, -2.0, body);             // end plates
        }
        add(new THREE.BoxGeometry(2.16, 0.07, 0.5), carbon, 0, 1.4, -2.0, body);                      // rear wing
        add(new THREE.BoxGeometry(1.95, 0.05, 0.06), tailMat, 0, 0.78, -2.43, body, false);            // light bar
        add(new THREE.BoxGeometry(1.7, 0.24, 0.3), carbon, 0, 0.36, -2.3, body);
        add(new THREE.BoxGeometry(2.1, 0.05, 0.4), carbon, 0, 0.27, 2.35, body);
        add(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 14), chrome, 0, 0.46, -2.4, body, false).rotation.x = Math.PI / 2;
        addWheels([[-1.1, 1.5, 1], [1.1, 1.5, 1], [-1.1, -1.45, 0], [1.1, -1.45, 0]], { r: 0.52, w: 0.46, caliper: mat(0xfacc15, { roughness: 0.4 }), style: spokes(10, mat(0x111216, { metalness: 0.9, roughness: 0.3 }), mat(0x3a3d46, { metalness: 0.9, roughness: 0.2 }), 0.7) });
      },
    },
    classic: {
      name: 'Classic cruiser', blurb: 'Old-school chrome. Slow, heavy, gorgeous.',
      spec: { acc: 14, boostAcc: 24, max: 22, boostMax: 32, turn: 2.0, air: 0.2 },
      build() { // rounded 50s sedan: separate fenders, chrome, round lamps, two-tone roof
        bodyPart([[-2.2, 0.42], [-2.32, 0.82], [-1.95, 0.96], [1.6, 0.98], [2.2, 0.86], [2.26, 0.42]], 1.68, paint, 0.14);
        bodyPart([[-1.45, 0.96], [-1.05, 1.5], [0.55, 1.5], [0.95, 0.96]], 1.58, glass, 0.08);
        bodyPart([[-1.15, 1.47], [-1.05, 1.62], [0.55, 1.62], [0.66, 1.47]], 1.5, cream, 0.06);
        for (const sx of [-1, 1]) {
          for (const fz of [1.35, -1.3]) { const f = add(new THREE.SphereGeometry(1, 20, 12), paint, sx * 0.9, 0.72, fz, body); f.scale.set(0.3, 0.42, 0.92); }
          const hl = add(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 18), lightMat, sx * 0.62, 0.82, 2.26, body, false); hl.rotation.x = Math.PI / 2;
          add(new THREE.TorusGeometry(0.17, 0.035, 6, 18), chrome, sx * 0.62, 0.82, 2.3, body, false);
          const tl = add(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), tailMat, sx * 0.66, 0.78, -2.28, body, false); tl.rotation.x = Math.PI / 2;
          add(new THREE.BoxGeometry(0.03, 0.05, 2.9), chrome, sx * 0.86, 0.62, 0, body, false);            // chrome side strip
        }
        for (const z of [2.36, -2.34]) add(new THREE.BoxGeometry(1.86, 0.15, 0.18), chrome, 0, 0.42, z, body);  // bumpers
        add(new THREE.BoxGeometry(0.9, 0.26, 0.05), chrome, 0, 0.64, 2.3, body, false);                         // grille
        for (let k = -3; k <= 3; k++) add(new THREE.BoxGeometry(0.03, 0.24, 0.06), black, k * 0.12, 0.64, 2.31, body, false);
        add(new THREE.BoxGeometry(0.06, 0.08, 0.3), chrome, 0, 1.0, 1.9, body, false);                         // bonnet ornament
        const white = mat(0xf8f9fa, { roughness: 0.6 });
        addWheels([[-0.92, 1.35, 1], [0.92, 1.35, 1], [-0.92, -1.3, 0], [0.92, -1.3, 0]], { r: 0.42, w: 0.3, style: (w, s, o) => {
          add(new THREE.CylinderGeometry(o.r * 0.78, o.r * 0.78, o.w + 0.01, 22).rotateZ(Math.PI / 2), white, 0, 0, 0, w, false);
          add(new THREE.CylinderGeometry(o.r * 0.5, o.r * 0.5, o.w + 0.03, 20).rotateZ(Math.PI / 2), chrome, 0, 0, 0, w, false);
          add(new THREE.BoxGeometry(o.w + 0.05, 0.05, o.r * 0.8), black, 0, 0, 0, w, false);
        } });
      },
    },
    buggy: {
      name: 'Dune buggy', blurb: 'Floats on jumps, steers in the air, shrugs off the river.',
      spec: { acc: 22, boostAcc: 32, max: 26, boostMax: 40, turn: 2.6, air: 0.6, wet: 16 },
      build() { // open tub, roll cage, exposed engine, huge tyres
        bodyPart([[-1.55, 0.62], [-1.7, 1.0], [-1.25, 1.06], [1.1, 0.96], [1.85, 0.78], [1.8, 0.6]], 1.36, paint, 0.1);
        const cage = mat(0x1f2129, { metalness: 0.6, roughness: 0.4 });
        const P = [[-0.62, 1.0, 0.75], [0.62, 1.0, 0.75], [-0.62, 1.0, -1.2], [0.62, 1.0, -1.2]];
        const T = [[-0.5, 2.05, 0.15], [0.5, 2.05, 0.15], [-0.5, 2.05, -1.0], [0.5, 2.05, -1.0]];
        for (let k = 0; k < 4; k++) tube(P[k], T[k], 0.055, cage);
        tube(T[0], T[1], 0.055, cage); tube(T[2], T[3], 0.055, cage); tube(T[0], T[2], 0.055, cage); tube(T[1], T[3], 0.055, cage);
        tube(T[0], P[3], 0.045, cage); tube([-0.62, 1.0, 0.75], [-0.95, 0.75, 1.75], 0.05, cage); tube([0.62, 1.0, 0.75], [0.95, 0.75, 1.75], 0.05, cage);
        tube([-0.95, 0.75, 1.75], [0.95, 0.75, 1.75], 0.05, cage);                                         // front bumper bar
        for (const sx of [-0.3, 0.3]) { add(new THREE.BoxGeometry(0.46, 0.12, 0.5), black, sx, 1.0, -0.35, body); add(new THREE.BoxGeometry(0.46, 0.6, 0.12), black, sx, 1.28, -0.62, body); }
        add(new THREE.BoxGeometry(0.9, 0.5, 0.7), mat(0x6c757d, { metalness: 0.7, roughness: 0.35 }), 0, 1.15, -1.45, body); // engine
        for (const sx of [-0.22, 0.22]) tube([sx, 1.2, -1.75], [sx, 1.6, -2.05], 0.06, chrome);
        add(new THREE.BoxGeometry(1.0, 0.12, 0.14), cage, 0, 2.12, 0.15, body, false);                          // light bar
        for (let k = -1.5; k <= 1.5; k++) add(new THREE.BoxGeometry(0.16, 0.09, 0.05), lightMat, k * 0.22, 2.12, 0.23, body, false);
        for (const sx of [-1, 1]) {
          add(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), lightMat, sx * 0.48, 0.92, 1.82, body, false).rotation.x = Math.PI / 2;
          add(new THREE.BoxGeometry(0.16, 0.1, 0.05), tailMat, sx * 0.5, 0.95, -1.75, body, false);
          for (const z of [1.3, -1.2]) tube([sx * 0.55, 0.7, z], [sx * 1.0, 0.62, z], 0.04, cage);            // suspension arms
        }
        const spare = add(new THREE.TorusGeometry(0.42, 0.17, 8, 18), tyreMat, 0, 1.55, -1.95, body); spare.rotation.x = 0.25;
        addWheels([[-1.14, 1.3, 1], [1.14, 1.3, 1], [-1.14, -1.2, 0], [1.14, -1.2, 0]], { r: 0.62, w: 0.55, style: (w, s, o) => {
          add(new THREE.CylinderGeometry(o.r * 0.55, o.r * 0.55, o.w + 0.02, 16).rotateZ(Math.PI / 2), mat(0xadb5bd, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0, w, false);
          add(new THREE.BoxGeometry(o.w + 0.04, 0.08, o.r * 0.9), black, 0, 0, 0, w, false);
          for (let k = 0; k < 14; k++) { const th = (k / 14) * Math.PI * 2; const b = add(new THREE.BoxGeometry(o.w * 1.02, 0.1, 0.18), tyreMat, 0, Math.cos(th) * o.r, Math.sin(th) * o.r, w, false); b.rotation.x = th; }
        } });
      },
    },
    bike: {
      name: 'Motorbike', blurb: 'Light and quick — leans into every corner.',
      spec: { acc: 26, boostAcc: 38, max: 29, boostMax: 46, turn: 2.8, air: 0.4, r: 1.0, engine: 1.7, eye: [0, 1.62, 0.05], cam: { back: 8, up: 3.8, look: 1.3 }, lights: [[0, 1.0, 1.0]], lightK: 0.8 },
      build() { // sport bike with a rider in a helmet that matches the paint
        const frame = mat(0x2b2f3a, { metalness: 0.6, roughness: 0.35 });
        bodyPart([[-0.1, 0.72], [0.05, 0.98], [0.55, 1.0], [0.72, 0.82], [0.42, 0.68]], 0.34, paint, 0.04);          // tank
        bodyPart([[-0.78, 0.84], [-0.72, 0.95], [-0.08, 0.95], [-0.02, 0.84]], 0.28, black, 0.03);                    // seat
        bodyPart([[-1.08, 0.8], [-1.02, 0.97], [-0.72, 0.92], [-0.72, 0.8]], 0.24, paint, 0.03);                       // tail
        bodyPart([[0.58, 0.72], [0.76, 1.18], [0.92, 1.14], [0.98, 0.72]], 0.38, paint, 0.04);                         // front fairing
        bodyPart([[0.78, 1.16], [0.86, 1.38], [0.92, 1.36], [0.9, 1.14]], 0.3, glass, 0.02);                           // windscreen
        add(new THREE.BoxGeometry(0.3, 0.36, 0.5), mat(0x6c757d, { metalness: 0.7, roughness: 0.35 }), 0, 0.52, 0.08, body);  // engine
        tube([0, 0.38, 0.92], [0, 1.1, 0.66], 0.035, chrome); tube([0, 0.45, 0], [0, 0.36, -0.82], 0.04, frame);       // fork, swing-arm
        tube([0.14, 0.42, -0.05], [0.17, 0.62, -0.95], 0.05, chrome);                                                    // exhaust
        tube([-0.34, 1.12, 0.62], [0.34, 1.12, 0.62], 0.025, black);                                                     // handlebars
        add(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 14), lightMat, 0, 1.0, 0.99, body, false).rotation.x = Math.PI / 2;
        add(new THREE.BoxGeometry(0.16, 0.06, 0.04), tailMat, 0, 0.92, -1.1, body, false);
        const r = makeHuman({ shirt: 0x1f2937, pants: 0x111827, skin: 0xc68642, helmet: paint });
        r.g.position.set(0, 0.04, -0.36); body.add(r.g);
        r.upper.rotation.x = 0.55; r.legL.rotation.x = r.legR.rotation.x = -1.15; r.legL.rotation.z = -0.28; r.legR.rotation.z = 0.28;
        r.armL.rotation.x = r.armR.rotation.x = -1.2; r.armL.rotation.z = -0.15; r.armR.rotation.z = 0.15;
        addWheels([[0, 0.94, 1], [0, -0.84, 0]], { r: 0.36, w: 0.14, style: spokes(6, rimMat, spokeMat, 0.5) });
      },
    },
    human: {
      name: 'On foot', blurb: 'Walk, run (Shift) and jump (Space). Meet the islanders.',
      spec: { acc: 14, boostAcc: 18, max: 2.8, boostMax: 6, turn: 3.2, air: 0.8, r: 0.5, human: true, eye: [0, 1.62, 0.14], wet: 1.6, engine: 0, cam: { back: 5.2, up: 2.3, look: 1.5 }, lights: [[0.18, 1.35, 0.3]], lightK: 0.35 },
      build() { // you — shirt in the garage paint colour
        const h = makeHuman({ shirt: paint, pants: 0x2b3a55, skin: 0xc68642, hair: 0x1b1b1b });
        body.add(h.g); model.userData.h = h; wheelR = 0.5;
      },
    },
  };
  // headlights: real spot lights + a soft beam on the road, faded in at dusk / underground
  const headLights = [];
  for (const sx of [-0.65, 0.65]) {
    const sp = new THREE.SpotLight(0xfff1dc, 0, 75, 0.5, 0.6, 1.3);
    sp.position.set(sx, 0.9, 2.2); sp.target.position.set(sx * 1.8, 0, 18); car.add(sp, sp.target); headLights.push(sp);
  }
  let beam = add(new THREE.PlaneGeometry(8, 17), new THREE.MeshBasicMaterial({
    map: textTexture((g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,240,210,0.95)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w * 0.36, 0); g.lineTo(w * 0.64, 0); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.filter = 'blur(6px)'; g.fill();
    }, 128, 256), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0.1, 11, car, false);
  beam.rotation.x = -Math.PI / 2;
  function applyLights() { // headlights / torch move with the chosen model
    const L = spec.lights;
    headLights.forEach((sp, i) => { const p = L[Math.min(i, L.length - 1)], x = L.length > 1 ? p[0] : p[0] + (i ? 0.05 : -0.05); sp.position.set(x, p[1], p[2]); sp.target.position.set(x * 1.8, 0, p[2] + 16); });
    const sc = spec.human ? 0.45 : spec.r < 1.2 ? 0.7 : 1; beam.scale.set(sc, sc, 1); beam.position.z = L[0][2] + 8.8 * sc;
  }
  let carKind = 'human', carColor = '#5b5cf6', spec = MODELS.human.spec;   // the game starts on foot
  try { const saved = JSON.parse(localStorage.getItem('drive-car-v2') || 'null'); if (saved && MODELS[saved.kind]) { carKind = saved.kind; carColor = saved.color || carColor; } } catch { /* storage blocked */ }
  function setCar(kind, color) {
    carKind = kind; carColor = color;
    spec = { r: 1.7, engine: 1, cam: { back: 10, up: 5, look: 1.2 }, eye: [0, 1.15, 0.2], lights: [[-0.65, 0.9, 2.2], [0.65, 0.9, 2.2]], lightK: 1, ...MODELS[kind].spec };
    paint.color.set(color); paint.emissive.set(color).multiplyScalar(0.35);
    if (model) { car.remove(model); model.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
    model = new THREE.Group(); body = new THREE.Group(); model.add(body); wheels = []; car.add(model);
    MODELS[kind].build(); applyLights();
    if (!MODELS[kind].spec.human) { try { if (race) abortRace(); } catch { /* race system not built yet */ } }
    try { localStorage.setItem('drive-car-v2', JSON.stringify({ kind, color })); } catch { /* not saved */ }
  }
  setCar(carKind, carColor);

  // ---------- Voices: every seller and islander speaks with their own voice (browser speech, offline) ----------
  const TTS = window.speechSynthesis || null;
  let voicePool = [];
  function loadVoices() {
    if (!TTS) return;
    const all = TTS.getVoices().filter((v) => /^en/i.test(v.lang));
    const rank = (v) => (/en[-_]IN/i.test(v.lang) ? 0 : /en[-_](GB|AU|IE|ZA)/i.test(v.lang) ? 1 : 2) + (v.localService ? 0 : 0.5);
    voicePool = all.sort((a, b) => rank(a) - rank(b)).slice(0, 10);
  }
  if (TTS) { loadVoices(); TTS.addEventListener?.('voiceschanged', loadVoices); }
  const hashStr = (str) => { let h = 7; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const voiceFor = (seed, high) => ({ seed, pitch: high ? 1.2 + (seed % 25) / 100 : 0.8 + (seed % 30) / 100, rate: 0.92 + (seed % 17) / 100 });
  const clean = (t) => t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();
  let talker = null;
  function say(text, prof, vol = 1, who = null) {
    if (!TTS || muted || !text) return;
    try { speakNow(text, prof, vol, who); } catch { /* speech is a bonus: never let it break the game */ }
  }
  function speakNow(text, prof, vol, who) {
    const u = new SpeechSynthesisUtterance(clean(text));
    if (voicePool.length) { const v = voicePool[prof.seed % voicePool.length]; u.voice = v; u.lang = v.lang; } else u.lang = 'en-IN';
    u.pitch = prof.pitch; u.rate = prof.rate; u.volume = clamp(vol, 0.05, 1);
    if (talker) talker.talking = false;
    talker = who; if (who) { u.onstart = () => { who.talking = true; }; u.onend = u.onerror = () => { who.talking = false; }; }
    TTS.cancel(); TTS.speak(u);
  }
  // recorded voice clips (ElevenLabs, see tools/generate-voices.mjs); the browser voice is only a fallback
  const VO = window.VOICES || { lines: {}, shopSpeaker: {}, islander: null };
  const lineText = (key, fallback) => (VO.lines[key] ? VO.lines[key].text : fallback);
  let curClip = null;
  function stopClip() { if (curClip) { curClip.pause(); curClip = null; } }
  function playLine(key, fallbackText, prof, vol = 1, who = null) {
    const L = VO.lines[key];
    if (narr) { if (/^(isl|cust)\./.test(key)) return; stopNarr(); }      // casual chatter never talks over the narrator
    if (!L) { say(fallbackText, prof, vol, who); return; }
    if (muted) return;
    try {
      stopClip(); if (TTS) TTS.cancel();
      if (talker) talker.talking = false;
      const a = new Audio(L.src); a.volume = clamp(vol, 0.05, 1); curClip = a; talker = who;
      if (who) { a.onplaying = () => { who.talking = true; }; a.onended = a.onpause = () => { who.talking = false; }; }
      a.onerror = () => { if (who) who.talking = false; say(fallbackText || L.text, prof, vol, who); };
      a.play().catch(() => {});
    } catch { say(fallbackText || L.text, prof, vol, who); }
  }
  // narrator: a welcome tour when the game starts, and a one-off line when you find the cave (with captions)
  let narr = null;
  function narrate(key) {
    const L = VO.lines[key]; if (!L || muted) return;
    stopNarr(); stopClip(); if (TTS) TTS.cancel();
    const a = new Audio(L.src); narr = a;
    const sentences = L.text.match(/[^.!?]+[.!?]+(\s|$)/g) || [L.text];
    const cap = $('#caption'), txt = $('#caption-text');
    const show = () => { let n = 0, at = a.duration ? a.currentTime / a.duration * L.text.length : 0; for (const s2 of sentences) { n += s2.length; if (n >= at) { txt.textContent = s2.trim(); break; } } };
    txt.textContent = sentences[0].trim(); cap.classList.remove('hidden');
    a.ontimeupdate = show; a.onended = () => { if (narr === a) stopNarr(); };
    a.play().catch(() => {      // blocked until the first key press / tap (arrived via Play mode)
      const go = () => { removeEventListener('keydown', go); removeEventListener('pointerdown', go); if (narr === a) a.play().catch(() => {}); };
      addEventListener('keydown', go); addEventListener('pointerdown', go);
    });
  }
  function stopNarr() { if (narr) { narr.pause(); narr = null; } $('#caption').classList.add('hidden'); }
  $('#caption-skip').onclick = stopNarr;
  const shopVoice = (name) => { const seller = bots.find((b) => b.shop === name); return seller ? seller.voice : voiceFor(hashStr(name), hashStr(name) % 2 === 0); };
  const sellerOf = (name) => bots.find((b) => b.shop === name) || null;
  const THANKS = ['Here you go!', 'Thank you so much!', 'Enjoy!', 'Payment received, thank you!', 'Good choice!'];
  const FAREWELL = {
    'MASALA DOSA': 'Come again tomorrow — the dosa will be even crispier!', 'CHAI': 'Come back for another chai, anytime, friend!',
    'FRESH FRUITS': 'Eat healthy and visit again — fresh stock every morning!', 'SPICES': 'Your kitchen will smell wonderful. Do come again!',
    'ICE CREAM': 'Stay cool! New flavours next time — please visit again!', 'JUICE': 'Stay refreshed! Come back when the sun is hot!',
    'BIRYANI': 'Hope you loved it — come back hungry next time!', 'BOOKS': 'Happy reading! Come back and tell me how it ends.',
    'TOYS': 'Have fun! Come back and show me your kite flying!', 'FLOWERS': 'May your day smell as sweet. Please visit again!',
    'PANI PURI': 'Spicy enough? Come back for round two!', 'FILTER COFFEE': 'Strong coffee, strong day. See you tomorrow morning!',
    'BAKERY': 'Fresh puffs come out at four — do visit again!', 'CRAFTS': 'Every piece is handmade. Thank you — please come again!',
    'CLOTHES': 'You will look great in that! Visit again for the new collection.', 'GROCERY': 'Thank you for shopping with us. See you soon!',
    'CAFÉ': 'Thanks for stopping by — your table will be waiting!', 'TEA HOUSE': 'Peace and tea — come back whenever you need both.',
    'PHARMACY': 'Take care of yourself — and hopefully I will not see you too soon!', 'ISLAND BANK ATM': 'Thank you for banking with Island Bank.',
  };

  // ---------- Islanders: people who are out and about while you explore on foot ----------
  const botsGroup = new THREE.Group(); scene.add(botsGroup);
  const bots = [];
  const SHIRTS = [0xe03131, 0x1971c2, 0x2f9e44, 0xf59f00, 0x9c36b5, 0x0ca678, 0xf06595, 0xf8f9fa, 0x495057, 0xfab005, 0x3b5bdb, 0xd9480f];
  const PANTS = [0x1f2937, 0x364fc7, 0x5c3d2e, 0x495057, 0x212529, 0x8d6e63, 0xdee2e6];
  const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa86b3c];
  const HAIRS = [0x1b1b1b, 0x3b2a1a, 0x6b4423, 0x2c2c2c, 0xd9b26f, 0x9ca3af];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * Math.min(1, t);
  function pickTarget(b) {
    const A = b.area;
    if (A.type === 'rect') { b.tx = rand(A.x0, A.x1); b.tz = rand(A.z0, A.z1); return; }
    const a = Math.atan2(b.z - A.cz, b.x - A.cx) + rand(0.25, 0.9) * (b.dir || 1), r = rand(A.r0, A.r1);
    b.tx = A.cx + Math.cos(a) * r; b.tz = A.cz + Math.sin(a) * r;
  }
  function addBot(o) {
    const look = { shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS), dress: Math.random() < 0.3, hat: Math.random() < 0.15 ? pick([0xf1e3c6, 0x343a40, 0xc92a2a]) : 0 };
    const h = makeHuman(look, false); h.g.scale.setScalar(rand(0.9, 1.06)); botsGroup.add(h.g);
    const b = { h, mode: o.mode, area: o.area, x: o.x, z: o.z, y: o.y || 0, face: o.face ?? rand(0, 6.28), tx: o.x, tz: o.z, wait: rand(0, 3), speed: rand(1.1, 1.7), phase: rand(0, 6), wave: 0, line: o.line, shop: o.shop, dir: Math.random() < 0.5 ? 1 : -1 };
    b.voice = voiceFor(Math.floor(Math.random() * 1e6), look.dress); b.hat = !!look.hat;
    b.vslot = (look.dress ? 'f' : 'm') + (Math.random() < 0.5 ? 1 : 2);     // which recorded islander voice this person uses
    if (b.mode === 'sit') sitHuman(h); else poseHuman(h, 0, 0);
    if (b.mode === 'walk') pickTarget(b);
    bots.push(b); return b;
  }
  const spawnIn = (area, n) => { for (let i = 0; i < n; i++) { const b = { area, x: 0, z: 0 }; if (area.type === 'rect') { b.x = rand(area.x0, area.x1); b.z = rand(area.z0, area.z1); } else { const a = rand(0, 6.28), r = rand(area.r0, area.r1); b.x = area.cx + Math.cos(a) * r; b.z = area.cz + Math.sin(a) * r; } addBot({ mode: 'walk', ...b }); } };
  for (const s of stallSpots) addBot({ mode: 'stand', x: s.x, z: s.z, face: s.face, line: s.line, shop: s.name });           // sellers
  spawnIn(walkAreas.market, 16); spawnIn(walkAreas.park, 7); spawnIn(walkAreas.village, 6); spawnIn(walkAreas.plaza, 5);
  const sitOn = (list, n, y) => { for (const s of list.filter(q => !q.used).sort(() => Math.random() - 0.5).slice(0, n)) { s.used = true; addBot({ mode: 'sit', x: s.x, z: s.z, face: s.face, y }); } };
  sitOn(benches.filter(b => b.tag === 'park'), 5, -0.4); sitOn(benches.filter(b => b.tag === 'view'), 4, -0.4); sitOn(benches.filter(b => b.tag === 'plaza'), 2, -0.4);
  sitOn(campSeats, 6, -0.55);
  const GREET = {
    base: ['Hi there! 👋', 'Hello, traveller!', 'Welcome to the island!', 'Have you tried the dosa stall?', 'The sunset point is lovely in the evening.', 'Lost? The map shows every stop.', 'Nice shirt!'],
    rain: ['Better find some shelter!', 'Lovely rain, isn\'t it?'], snow: ['Brr — it\'s freezing!', 'Snowball fight later?'], night: ['Good evening!', 'Look at all those stars!'],
  };
  let greetT = 0;
  function greetLine(b) { // -> { key, text } (sellers call out their shop; islanders pick a line that suits the weather / time)
    if (b.shop) { const key = `shop.${b.shop}.greet`; return { key, text: `${(b.line || '🙂').split(' ')[0]} ${lineText(key, b.line)}` }; }
    const src = VO.islander || GREET;
    const pools = ['base', ...(W.show === 'rain' ? ['rain'] : []), ...(W.show === 'snow' || SP.snow > 0.5 ? ['snow'] : []), ...(DN.night > 0.5 ? ['night'] : [])];
    const choices = pools.flatMap((p) => src[p].map((t, i) => [p, i, t]));
    const [p, i, t] = pick(choices);
    return { key: `isl.${b.vslot}.${p}.${i}`, text: '🙂 ' + t };
  }

  function updateIsland(dt, now) {
    const t = now / 1000;
    for (const f of campfires) { f.scale.set(1 + Math.sin(t * 13 + f.position.x) * 0.06, 1 + Math.sin(t * 9.7) * 0.15 + Math.sin(t * 23) * 0.05, 1); f.rotation.y = t * 0.8; }
    for (const m of winterHide) m.visible = SP.snow < 0.4;
    if (!underground) for (const v of viewpoints) {
      const d = Math.hypot(S.x - v.x, S.z - v.z);
      if (d < 14 && !v.seen) { v.seen = true; toast(v.msg); } else if (d > 40) v.seen = false;
    }
    const on = spec.human && !underground; botsGroup.visible = on;
    if (!on) return;
    let nearest = null, nd = 3.2;
    for (const b of bots) {
      const dxp = S.x - b.x, dzp = S.z - b.z, dp = Math.hypot(dxp, dzp), vis = dp < 150;
      b.h.g.visible = vis; if (!vis) continue;
      if (b.mode === 'walk' && b.shopTo) updateShopper(b, dt);
      else if (b.mode === 'walk') {
        if (dp < 1.9 && !b.shopTo) { b.face = lerpAngle(b.face, Math.atan2(dxp, dzp), dt * 6); poseHuman(b.h, b.phase, 0); }        // stop and look at you
        else if (b.wait > 0) { b.wait -= dt; poseHuman(b.h, b.phase, 0); }
        else {
          const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
          if (d < 0.4) { b.wait = rand(1, 5); if (!maybeShop(b)) pickTarget(b); }
          else { b.x += dx / d * b.speed * dt; b.z += dz / d * b.speed * dt; b.face = lerpAngle(b.face, Math.atan2(dx, dz), dt * 5); b.phase += dt * b.speed * 3.4; poseHuman(b.h, b.phase, 0.55); }
        }
      } else if (b.mode === 'stand') { b.phase += dt; b.h.armL.rotation.x = -0.5 + Math.sin(b.phase * 1.3) * 0.2; b.h.armR.rotation.x = -0.5 - Math.sin(b.phase * 1.1) * 0.2; b.h.armR.rotation.z = 0; }
      else { b.h.armR.rotation.x = -0.35; b.h.armR.rotation.z = 0; }
      if (b.wave > 0) { b.wave -= dt; b.h.armR.rotation.x = -2.7; b.h.armR.rotation.z = -0.3 + Math.sin(b.wave * 14) * 0.35; }
      if (b.talking) { b.h.upper.rotation.x = 0.05 + Math.sin(t * 9) * 0.05; b.h.upper.rotation.y = Math.sin(t * 3.1) * 0.12; b.h.armL.rotation.x = -0.4 + Math.sin(t * 5) * 0.25; } else b.h.upper.rotation.y = 0;
      b.h.g.position.set(b.x, b.y, b.z); b.h.g.rotation.y = b.face;
      if (dp < nd && !b.kid && !b.home && !b.shopTo) { nd = dp; nearest = b; }
      const min = spec.r + 0.32;                                       // people are solid
      if (dp < min && dp > 1e-3 && !S.pose && !JOB) { S.x = b.x + dxp / dp * min; S.z = b.z + dzp / dp * min; }
    }
    greetT -= dt;
    if (nearest && greetT <= 0 && Math.abs(S.speed) < 1.5 && !panelOpen && !garageOpen && !sheetOpen && !S.act && !JOB) { greetT = 7; nearest.wave = 1.6; const g = greetLine(nearest); toast(g.text); playLine(g.key, g.text, nearest.voice, 1 - nd / 4, nearest); }
  }
  // ---------- Island life: bank card, shopping, health, eating & drinking, sitting & lying down (on foot) ----------
  const ITEMS = {
    dosa: { n: 'Masala dosa', e: '🥞', t: 'food', hold: 'roll', c: 0xe0a74a }, plaindosa: { n: 'Plain dosa', e: '🥞', t: 'food', hold: 'roll', c: 0xeac27a },
    chai: { n: 'Cutting chai', e: '☕', t: 'drink', hold: 'glass', c: 0xb07a3c }, masalachai: { n: 'Masala chai', e: '☕', t: 'drink', hold: 'glass', c: 0x9c6230 },
    bun: { n: 'Bun', e: '🍞', t: 'food', hold: 'bun', c: 0xd9a066 },
    banana: { n: 'Banana', e: '🍌', t: 'food', hold: 'roll', c: 0xffd43b }, apple: { n: 'Apple', e: '🍎', t: 'food', hold: 'fruit', c: 0xe03131 }, mango: { n: 'Mango', e: '🥭', t: 'food', hold: 'fruit', c: 0xf59f00 },
    masala: { n: 'Garam masala', e: '🌶️', t: 'keep' }, pepper: { n: 'Black pepper', e: '🧂', t: 'keep' },
    kulfi: { n: 'Kulfi', e: '🍡', t: 'food', hold: 'cone', c: 0xf8f0e3 }, icecream: { n: 'Ice cream cone', e: '🍦', t: 'food', hold: 'cone', c: 0xfcc2d7 },
    cane: { n: 'Sugarcane juice', e: '🥤', t: 'drink', hold: 'glass', c: 0xc0eb75 }, limesoda: { n: 'Lime soda', e: '🍋', t: 'drink', hold: 'glass', c: 0xe9fac8 },
    biryani: { n: 'Chicken biryani', e: '🍛', t: 'food', hold: 'box', c: 0xf08c00 }, vegbiryani: { n: 'Veg biryani', e: '🍛', t: 'food', hold: 'box', c: 0xfab005 },
    novel: { n: 'Novel', e: '📕', t: 'keep' }, comic: { n: 'Comic book', e: '📗', t: 'keep' }, kite: { n: 'Kite', e: '🪁', t: 'toy' }, top: { n: 'Spinning top', e: '🪀', t: 'toy' }, ball: { n: 'Rubber ball', e: '🎾', t: 'throw' }, frisbee: { n: 'Frisbee', e: '🥏', t: 'throw' },
    jasmine: { n: 'Jasmine garland', e: '🌼', t: 'keep' }, roses: { n: 'Rose bunch', e: '🌹', t: 'keep' },
    panipuri: { n: 'Pani puri', e: '🥙', t: 'food', hold: 'box', c: 0xe8b85a }, bhel: { n: 'Bhel puri', e: '🥗', t: 'food', hold: 'box', c: 0xd9a066 },
    coffee: { n: 'Filter coffee', e: '☕', t: 'drink', hold: 'glass', c: 0x7a4a24 }, badam: { n: 'Badam milk', e: '🥛', t: 'drink', hold: 'glass', c: 0xfff3bf },
    puff: { n: 'Veg puff', e: '🥐', t: 'food', hold: 'bun', c: 0xe8a33d }, creambun: { n: 'Cream bun', e: '🧁', t: 'food', hold: 'bun', c: 0xfff0f6 }, cake: { n: 'Cake slice', e: '🍰', t: 'food', hold: 'box', c: 0xf783ac },
    pot: { n: 'Clay pot', e: '🏺', t: 'keep' }, mask: { n: 'Wooden mask', e: '🎭', t: 'keep' },
    tshirtPink: { n: 'Island T-shirt (pink)', e: '👕', t: 'shirt', c: '#ec4899' }, tshirtTeal: { n: 'Island T-shirt (teal)', e: '👕', t: 'shirt', c: '#0ca678' }, tshirtYellow: { n: 'Island T-shirt (yellow)', e: '👕', t: 'shirt', c: '#f59f00' },
    water: { n: 'Water bottle', e: '💧', t: 'drink', hold: 'bottle', c: 0x74c0fc }, chips: { n: 'Chips', e: '🥔', t: 'food', hold: 'box', c: 0xffd43b }, choco: { n: 'Chocolate', e: '🍫', t: 'food', hold: 'box', c: 0x5c3d2e },
    cappuccino: { n: 'Cappuccino', e: '☕', t: 'drink', hold: 'glass', c: 0xd9b48a }, sandwich: { n: 'Sandwich', e: '🥪', t: 'food', hold: 'box', c: 0xf1e3c6 },
    greentea: { n: 'Green tea', e: '🍵', t: 'drink', hold: 'glass', c: 0xa9e34b }, samosa: { n: 'Samosa', e: '🥟', t: 'food', hold: 'bun', c: 0xd9a24c },
    medicine: { n: 'Medicine', e: '💊', t: 'med', heal: 100, d: 'Restores full health' }, bandage: { n: 'Bandage', e: '🩹', t: 'med', heal: 30, d: '+30 health' },
  };
  const MENUS = {
    'MASALA DOSA': [['dosa', 80], ['plaindosa', 60]], 'CHAI': [['chai', 15], ['masalachai', 25], ['bun', 20]], 'FRESH FRUITS': [['banana', 10], ['apple', 30], ['mango', 50]],
    'SPICES': [['masala', 120], ['pepper', 90]], 'ICE CREAM': [['kulfi', 40], ['icecream', 50]], 'JUICE': [['cane', 30], ['limesoda', 35]],
    'BIRYANI': [['biryani', 180], ['vegbiryani', 140]], 'BOOKS': [['novel', 150], ['comic', 80]], 'TOYS': [['kite', 60], ['top', 40], ['ball', 40], ['frisbee', 80]],
    'FLOWERS': [['jasmine', 30], ['roses', 120]], 'PANI PURI': [['panipuri', 40], ['bhel', 50]], 'FILTER COFFEE': [['coffee', 30], ['badam', 40]],
    'BAKERY': [['puff', 25], ['creambun', 20], ['cake', 60]], 'CRAFTS': [['pot', 200], ['mask', 450]], 'CLOTHES': [['tshirtPink', 350], ['tshirtTeal', 350], ['tshirtYellow', 350]],
    'GROCERY': [['water', 20], ['chips', 20], ['choco', 40]], 'CAFÉ': [['cappuccino', 120], ['sandwich', 150], ['cake', 90]], 'TEA HOUSE': [['greentea', 60], ['masalachai', 30], ['samosa', 20]],
    'PHARMACY': [['medicine', 150], ['bandage', 50]],
  };
  const TYPE_LABEL = { food: 'Food · eat it', drink: 'Drink · drink it', med: 'Medicine · apply it', shirt: 'Clothing · wear it', keep: 'Souvenir · keep it', throw: 'Hold T to throw — play fetch with your dog', toy: 'Toy · play with it (it stays in your bag)' };
  const START_BALANCE = 1000;
  const LIFE = { bal: START_BALANCE, bag: {}, hp: 100, tx: [] };
  try { Object.assign(LIFE, JSON.parse(localStorage.getItem('drive-life-v2') || '{}')); } catch { /* fresh account */ }
  const saveLife = () => { try { localStorage.setItem('drive-life-v2', JSON.stringify(LIFE)); } catch { /* not saved */ } };
  const rupees = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  let sheetOpen = false, nearShop = null, lastBump = 0, hurtFlash = 0;

  function updateLifeHud() {
    const hp = Math.round(LIFE.hp), el = $('#hp');
    el.querySelector('em').style.width = hp + '%';
    el.querySelector('b').textContent = hp < 100 ? `${hp} · Need healing` : `${hp}`;
    el.classList.toggle('low', hp < 100); el.classList.toggle('crit', hp < 35);
    $('#money').textContent = '💳 ' + rupees(LIFE.bal);
  }
  updateLifeHud();

  // ----- the sheet (shops, bag, ATM) -----
  const cardHtml = () => `<div class="bankcard"><div class="bc-top"><b>ISLAND BANK</b><span>DEBIT</span></div><div class="bc-chip"></div>
    <div class="bc-num">•••• •••• •••• 2026</div><div class="bc-bot"><span>GUEST EXPLORER</span><span>Balance <b>${rupees(LIFE.bal)}</b></span></div></div>`;
  function openSheet(title, sub, html, wire) {
    sheetOpen = true; for (const k in keys) keys[k] = false;
    $('#sheet-title').textContent = title; $('#sheet-sub').textContent = sub; $('#sheet-body').innerHTML = html;
    $('#sheet').classList.remove('hidden'); document.body.classList.add('garage');
    if (wire) wire($('#sheet-body'));
  }
  let shopVisit = null; // { shop, bought }
  function closeSheet() {
    if (shopVisit && shopVisit.bought) {
      const bKey = `shop.${shopVisit.shop.name}.bye`, line = lineText(bKey, FAREWELL[shopVisit.shop.name] || 'Thank you — please visit again!');
      toast('🙏 ' + line); playLine(bKey, line, shopVoice(shopVisit.shop.name), 1, sellerOf(shopVisit.shop.name));
      const sb = sellerOf(shopVisit.shop.name); if (sb) sb.wave = 2;
    }
    shopVisit = null;
    sheetOpen = false; $('#sheet').classList.add('hidden'); document.body.classList.remove('garage'); }
  $('#sheet-close').onclick = closeSheet;

  function openShop(shop) {
    const menu = MENUS[shop.name] || [], pharmacy = shop.name === 'PHARMACY', healthy = LIFE.hp >= 100;
    const gKey = pharmacy && healthy ? 'shop.PHARMACY.healthy' : `shop.${shop.name}.greet`;
    const gText = lineText(gKey, pharmacy && healthy ? 'You look perfectly healthy! I can\'t sell you medicine — come back if you get hurt.' : pharmacy ? 'Oh, you\'re hurt. Don\'t worry, let\'s get you fixed up.' : (shop.line || 'Welcome! What would you like?'));
    const note = pharmacy ? `<p class="owner">🧑‍⚕️ “${gText}”</p>` : `<p class="owner">${(shop.line || '🙂').split(' ')[0]} ${gText}</p>`;
    const rows = menu.map(([id, price]) => { const it = ITEMS[id]; const off = pharmacy && healthy;
      return `<div class="row"><span class="ie">${it.e}</span><div><b>${it.n}</b><small>${it.d || TYPE_LABEL[it.t]}</small></div><button class="buy" data-id="${id}" data-p="${price}" ${off ? 'disabled' : ''}>${rupees(price)}</button></div>`; }).join('');
    shopVisit = { shop, bought: 0 };
    playLine(gKey, gText, shopVoice(shop.name), 1, sellerOf(shop.name));
    openSheet(shop.name, 'Pay by card — items go into your bag.', note + jobHtml(shop) + rows + `<div class="pay" id="pay">💳 Island Bank •••• 2026 · Balance <b>${rupees(LIFE.bal)}</b></div>`, (root) => {
      root.querySelectorAll('.buy').forEach((b) => { b.onclick = () => buy(b.dataset.id, +b.dataset.p, shop, b); });
      wireJob(root, shop);
    });
  }
  function buy(id, price, shop, btn) {
    const it = ITEMS[id], pay = $('#pay');
    if (shop.name === 'PHARMACY' && LIFE.hp >= 100) { pay.innerHTML = '🧑‍⚕️ Not needed — you\'re at full health.'; return; }
    if (LIFE.bal < price) { pay.innerHTML = `❌ Card declined — balance ${rupees(LIFE.bal)} is not enough.`; blip(120); return; }
    btn.disabled = true; pay.innerHTML = '💳 Tapping card… processing payment'; blip(880);
    setTimeout(() => {
      LIFE.bal -= price; LIFE.bag[id] = (LIFE.bag[id] || 0) + 1;
      LIFE.tx.unshift({ d: `${it.n} · ${shop.name}`, a: -price }); LIFE.tx = LIFE.tx.slice(0, 12); saveLife(); updateLifeHud();
      pay.innerHTML = `✅ Payment approved — ${rupees(price)} paid · balance <b>${rupees(LIFE.bal)}</b>`; blip(1320);
      toast(`${it.e} Bought ${it.n} for ${rupees(price)} — it's in your bag (I).`);
      if (shopVisit) { shopVisit.bought++; const sp = VO.shopSpeaker[shop.name]; playLine(`thanks.${sp}.${Math.floor(Math.random() * 3)}`, pick(THANKS), shopVoice(shop.name), 1, sellerOf(shop.name)); }
      btn.disabled = shop.name === 'PHARMACY' && LIFE.hp >= 100;
    }, 650);
  }
  function openBag() {
    const ids = Object.keys(LIFE.bag).filter((id) => LIFE.bag[id] > 0 && ITEMS[id]);
    const verb = { food: 'Eat', drink: 'Drink', med: 'Apply', shirt: 'Wear', toy: '' };
    const verbFor = (id, it) => (it.t === 'throw' ? 'Use' : it.t === 'toy' ? (id === 'kite' ? (kite.on ? 'Reel in' : 'Fly') : 'Spin') : verb[it.t]);
    const rows = ids.length ? ids.map((id) => { const it = ITEMS[id];
      return `<div class="row"><span class="ie">${it.e}</span><div><b>${it.n} <i>×${LIFE.bag[id]}</i></b><small>${it.d || TYPE_LABEL[it.t]}</small></div>${verbFor(id, it) ? `<button class="buy use" data-id="${id}">${verbFor(id, it)}</button>` : '<span class="keep">Souvenir</span>'}</div>`; }).join('')
      : '<p class="owner">Your bag is empty — visit Market Street to shop.</p>';
    const tx = LIFE.tx.length ? `<h3>Recent payments</h3>${LIFE.tx.slice(0, 5).map((t) => `<div class="tx"><span>${t.d}</span><b>${t.a < 0 ? '−' : '+'}${rupees(Math.abs(t.a))}</b></div>`).join('')}` : '';
    openSheet('Bag', 'Your card and everything you\'ve bought.', cardHtml() + `<div class="hpline">❤ Health ${Math.round(LIFE.hp)} / 100${LIFE.hp < 100 ? ' — the pharmacy on Market Street can help' : ''}</div>` + rows + tx, (root) => {
      root.querySelectorAll('.use').forEach((b) => { b.onclick = () => useItem(b.dataset.id); });
    });
  }
  function openATM() {
    if (!sheetOpen) playLine('atm.welcome', 'Welcome to Island Bank. Your account summary is on the screen.', voiceFor(hashStr('ATM'), true));
    const tx = LIFE.tx.length ? LIFE.tx.slice(0, 6).map((t) => `<div class="tx"><span>${t.d}</span><b>${t.a < 0 ? '−' : '+'}${rupees(Math.abs(t.a))}</b></div>`).join('') : '<p class="owner">No transactions yet.</p>';
    openSheet('Island Bank ATM', 'Account summary', cardHtml() + '<h3>Mini statement</h3>' + tx +
      '<p class="owner">💼 Need more money? Open any shop and choose <b>Work for this shop</b> — you earn 30% commission plus tips on every sale.</p>');
  }
  $('#btn-bag').onclick = () => (sheetOpen ? closeSheet() : openBag());

  // ----- using things: eat, drink, apply medicine, wear -----
  const HOLD = {
    glass: (c) => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.05, 0.04, 0.13, 12), new THREE.MeshStandardMaterial({ color: 0xe7f5ff, transparent: true, opacity: 0.45 }), 0, 0, 0, g, false); add(new THREE.CylinderGeometry(0.044, 0.036, 0.09, 12), mat(c), 0, -0.015, 0, g, false); return g; },
    bottle: (c) => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 10), new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: 0.7 }), 0, 0, 0, g, false); add(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), mat(0x1c7ed6), 0, 0.12, 0, g, false); return g; },
    roll: (c) => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 10), mat(c), 0, 0, 0, g, false).rotation.z = 0.3; return g; },
    fruit: (c) => { const g = new THREE.Group(); add(new THREE.SphereGeometry(0.065, 12, 10), mat(c, { roughness: 0.45 }), 0, 0, 0, g, false); return g; },
    cone: (c) => { const g = new THREE.Group(); add(new THREE.ConeGeometry(0.04, 0.13, 10).rotateX(Math.PI), mat(0xd9a066), 0, -0.03, 0, g, false); add(new THREE.SphereGeometry(0.05, 10, 8), mat(c), 0, 0.05, 0, g, false); return g; },
    box: (c) => { const g = new THREE.Group(); add(new THREE.BoxGeometry(0.16, 0.05, 0.12), mat(0xf8f9fa), 0, 0, 0, g, false); add(new THREE.BoxGeometry(0.13, 0.04, 0.09), mat(c), 0, 0.035, 0, g, false); return g; },
    bun: (c) => { const g = new THREE.Group(); add(new THREE.SphereGeometry(0.07, 12, 8), mat(c), 0, 0, 0, g, false).scale.set(1, 0.6, 1); return g; },
  };
  function useItem(id) {
    const it = ITEMS[id]; if (!it || !(LIFE.bag[id] > 0)) return;
    if (it.t === 'throw') { closeSheet(); selectThrowable(id); return; }
    if (it.t === 'toy') { closeSheet(); if (id === 'kite') toggleKite(); else spinTop(); return; }
    if (it.t === 'shirt') { closeSheet(); setCar(carKind, it.c); toast(`${it.e} You're wearing the ${it.n}.`); return; }
    if (!spec.human) { toast('Switch to On foot in the Garage to eat, drink or treat yourself.'); return; }
    if (it.t === 'med' && LIFE.hp >= 100) { toast('You\'re already at full health — save it for later.'); return; }
    closeSheet(); stand();
    LIFE.bag[id]--; if (!LIFE.bag[id]) delete LIFE.bag[id]; saveLife();
    const h = model.userData.h, held = it.hold ? HOLD[it.hold](it.c) : null;
    if (held) { held.position.set(0, -0.68, 0.06); h.armR.add(held); }
    S.act = { it, held, t: 0, dur: it.t === 'food' ? 3.4 : it.t === 'drink' ? 2.8 : 2.2, beat: 0 };
  }
  function finishAct() {
    const a = S.act; S.act = null;
    if (a.held) a.held.parent.remove(a.held);
    if (a.it.t === 'med') { LIFE.hp = Math.min(100, LIFE.hp + a.it.heal); toast(LIFE.hp >= 100 ? `${a.it.e} You feel completely better — back to full health!` : `${a.it.e} Feeling better — health ${Math.round(LIFE.hp)}.`); blip(1046); }
    else { LIFE.hp = Math.min(100, LIFE.hp + (a.it.t === 'food' ? 5 : 3)); toast(a.it.t === 'food' ? `😋 That ${a.it.n.toLowerCase()} was delicious!` : `😌 That ${a.it.n.toLowerCase()} was refreshing!`); }
    saveLife(); updateLifeHud();
  }

  // ----- getting hurt (on foot only) -----
  function hurt(n, why) {
    if (!spec.human || S.rescue) return;
    n = Math.max(1, Math.round(n)); LIFE.hp = Math.max(0, LIFE.hp - n); hurtFlash = 1; blip(90); S.shake = Math.max(S.shake, 0.25);
    saveLife(); updateLifeHud(); stand(); if (S.act) { if (S.act.held) S.act.held.parent.remove(S.act.held); S.act = null; }
    if (LIFE.hp <= 0 && petKind === 'dog') { LIFE.hp = 1; saveLife(); updateLifeHud(); startRescue(); return; }
    if (petKind === 'cat') setTimeout(meow, 300);
    if (LIFE.hp <= 0) {
      toast(petKind === 'cat' ? 'You fainted… your cat meowed for help and an islander carried you to the plaza.' : 'You fainted… an islander helped you back to the plaza.');
      fadeThrough(() => { resetCar(); LIFE.hp = 35; saveLife(); updateLifeHud(); setTimeout(() => toast('❤ Health 35 · Need healing — the PHARMACY is on Market Street.'), 900); });
    } else toast(`💥 Ouch! −${n} health${why === 'fall' ? ' (that was a long drop)' : ''} · ${Math.round(LIFE.hp)} left${LIFE.hp < 100 ? ' — need healing' : ''}`);
  }

  // ----- sitting and lying down -----
  function stand() {
    if (!S.pose) return;
    const h = model.userData.h; if (h) { h.g.position.set(0, 0, 0); h.g.rotation.set(0, 0, 0); }
    if (S.pose.bench) S.pose.bench.player = false;
    S.pose = null;
  }
  function nearestFreeBench() {
    let best = null, bd = 2.2;
    for (const b of benches) { const d = Math.hypot(S.x - b.x, S.z - b.z); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  function setPose(type) {
    if (!started || panelOpen || garageOpen || sheetOpen || !S.onGround) return;
    if (!spec.human) { toast('Switch to On foot in the Garage to sit or lie down.'); return; }
    if (S.pose && S.pose.type === type) { stand(); return; }
    stand(); if (S.act) return;
    const b = nearestFreeBench();
    if (b && b.used) toast('That bench is taken — you sit on the ground instead.');
    const bench = b && !b.used ? b : null;
    S.speed = 0; S.vx = S.vz = 0;
    if (bench) {
      bench.player = true;
      if (type === 'sit') { S.x = bench.x; S.z = bench.z; S.h = bench.face; }
      else { S.h = bench.face + Math.PI / 2; S.x = bench.x + Math.sin(S.h) * 0.88; S.z = bench.z + Math.cos(S.h) * 0.88; }
    }
    S.pose = { type, bench };
    toast(type === 'sit' ? (bench ? '🪑 You sit on the bench. Move to stand up.' : '🪑 You sit down. Move to stand up.') : (bench ? '🛌 You stretch out on the bench.' : '🛌 You lie down for a rest. Move to get up.'));
  }
  $('#btn-sit').onclick = () => setPose('sit'); $('#btn-lie').onclick = () => setPose('lie');

  // per-frame: poses, eating/drinking animation, health effects, shop prompts
  function animPlayer(h, dt) {
    if (S.pose) {
      const onBench = !!S.pose.bench;
      if (S.pose.type === 'sit') { sitHuman(h); h.g.rotation.set(0, 0, 0); h.g.position.set(0, onBench ? -0.4 : -0.8, 0); if (!onBench) { h.armL.rotation.x = h.armR.rotation.x = 0.5; } }
      else { poseHuman(h, 0, 0); h.armL.rotation.z = 0.12; h.armR.rotation.z = -0.12; if (S.rescue) h.g.rotation.set(Math.PI / 2, Math.PI, 0); else h.g.rotation.set(-Math.PI / 2, 0, 0); h.g.position.set(0, onBench ? 0.66 : 0.13, 0); }
    }
    if (kite.on && !S.act && h === model.userData.h) { h.armR.rotation.x = -2.3; h.armR.rotation.z = -0.2; }
    const a = S.act; if (!a) return;
    a.t += dt;
    const k = a.t / a.dur;
    if (a.it.t === 'med') { h.armL.rotation.x = h.armR.rotation.x = -1.1 + Math.sin(a.t * 8) * 0.12; h.armL.rotation.z = 0.55; h.armR.rotation.z = -0.55; }
    else {
      // bring the hand up to the mouth (arm swings forward-up and across), bite by bite / sip by sip
      const bite = a.it.t === 'food' ? Math.max(0, Math.sin(a.t * 4.6)) : 0.6 + 0.4 * Math.min(1, a.t * 2);
      const lift = -1.2 - 1.25 * bite, across = -0.85 * Math.min(1, a.t * 3);
      h.armR.rotation.x += (lift - h.armR.rotation.x) * Math.min(1, dt * 12); h.armR.rotation.z += (across - h.armR.rotation.z) * Math.min(1, dt * 12);
      h.upper.rotation.x = -0.06;
      if (a.held) {
        if (a.it.t === 'food') a.held.scale.setScalar(Math.max(0.15, 1 - k * 0.9));
        else a.held.rotation.x = -0.4 - k * 1.1;                                                      // tip the glass up as you drink
      }
      if ((a.beat -= dt) <= 0) { a.beat = a.it.t === 'food' ? 0.68 : 0.6; blip(a.it.t === 'food' ? rand(170, 230) : rand(280, 340)); }
    }
    if (a.t >= a.dur) finishAct();
  }
  function updateLife(dt) {
    const onFoot = !!(spec.human && started);
    document.body.classList.toggle('onfoot', onFoot);
    if (!spec.human) { if (S.pose) S.pose = null; }
    // red edge when hurt / low on health
    hurtFlash = Math.max(0, hurtFlash - dt * 1.6);
    const low = onFoot ? clamp((70 - LIFE.hp) / 70, 0, 1) * (0.55 + 0.25 * Math.sin(performance.now() / 300)) : 0;
    $('#hurt').style.opacity = Math.max(hurtFlash, low).toFixed(3);
    // shops / ATM within reach (on foot)
    nearShop = null;
    if (onFoot && !underground && !S.pose && !S.act) {
      let bd = 2.4;
      for (const s of shopsList) { if (JOB && s === JOB.shop) continue; const d = Math.hypot(S.x - s.x, S.z - s.z); if (d < bd) { bd = d; nearShop = s; } }
    }
    if (nearShop && !nearZone && !panelOpen && !sheetOpen && !garageOpen) {
      const pr = $('#prompt'); pr.classList.remove('hidden');
      pr.textContent = nearShop.atm ? (isTouch ? 'Tap here to use the ATM' : 'Press Enter to use the ATM') : (isTouch ? `Tap here to shop at ${nearShop.name}` : `Press Enter to shop at ${nearShop.name}`);
    }
  }
  const openNearShop = () => { if (nearShop && !sheetOpen) (nearShop.atm ? openATM() : openShop(nearShop)); };
  $('#prompt').addEventListener('click', () => { if (nearShop) openNearShop(); else if (nearZone && !panelOpen) openPanel(nearZone); });

  // ---------- Lights: auto / on / off (car headlights, bike lamp, on-foot torch) ----------
  const LIGHT_MODES = ['auto', 'on', 'off'];
  let lightMode = 'auto';
  function cycleLights() {
    lightMode = LIGHT_MODES[(LIGHT_MODES.indexOf(lightMode) + 1) % 3];
    const label = { auto: '💡 Lights: Auto', on: '💡 Lights: On', off: '💡 Lights: Off' }[lightMode];
    $('#btn-lights').textContent = label; toast(label + (lightMode === 'auto' ? ' (on after dark)' : '')); blip(lightMode === 'off' ? 300 : 700);
  }
  $('#btn-lights').onclick = cycleLights;

  // ---------- Pets: an optional dog or cat that follows you on foot ----------
  const PETS = ['none', 'dog', 'cat'];
  let petKind = 'none';
  try { petKind = PETS.includes(localStorage.getItem('drive-pet')) ? localStorage.getItem('drive-pet') : 'none'; } catch { /* default */ }
  const pet = { g: null, kind: 'none', x: 0, z: 0, h: 0, phase: 0, legs: [], tail: null, head: null, body: null, meowT: 20, barkT: 0, sit: false };
  function buildPet(kind) {
    if (pet.g) { scene.remove(pet.g); pet.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); pet.g = null; }
    pet.kind = kind; pet.legs = [];
    if (kind === 'none') return;
    const dog = kind === 'dog', fur = mat(dog ? 0xb7793f : 0xf08c00, { roughness: 0.9 }), light = mat(dog ? 0xf1e3c6 : 0xfff4e6, { roughness: 0.9 }), dark = mat(0x22201f);
    const g = new THREE.Group(); scene.add(g); pet.g = g;
    const s = dog ? 1 : 0.62, L = 0.72 * s, H = 0.42 * s;
    const body = new THREE.Group(); body.position.y = H + 0.06; g.add(body); pet.body = body;
    add(new THREE.BoxGeometry(0.34 * s, 0.3 * s, L), fur, 0, 0, 0, body);
    add(new THREE.BoxGeometry(0.26 * s, 0.1 * s, L * 0.7), light, 0, -0.14 * s, 0, body, false);
    const head = new THREE.Group(); head.position.set(0, 0.2 * s, L / 2 + 0.06 * s); body.add(head); pet.head = head;
    add(new THREE.BoxGeometry(0.28 * s, 0.26 * s, 0.26 * s), fur, 0, 0, 0.06 * s, head);
    if (dog) {
      add(new THREE.BoxGeometry(0.16, 0.13, 0.18), light, 0, -0.05, 0.26, head, false);
      add(new THREE.BoxGeometry(0.07, 0.06, 0.05), dark, 0, -0.01, 0.36, head, false);                 // nose
      for (const sx of [-1, 1]) { const ear = add(new THREE.BoxGeometry(0.06, 0.16, 0.1), mat(0x7a4a24), sx * 0.15, 0.03, 0.02, head, false); ear.rotation.z = sx * 0.25; }
      add(new THREE.TorusGeometry(0.16, 0.025, 6, 16), mat(0xe03131), 0, -0.13, -0.02, head, false).rotation.x = Math.PI / 2;   // collar
    } else {
      for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.05, 0.11, 4), fur, sx * 0.08, 0.16, 0.04, head, false);
      add(new THREE.BoxGeometry(0.03, 0.03, 0.02), mat(0xf783ac), 0, -0.02, 0.21, head, false);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.035, 0.035, 0.01), mat(0x82c91e, { emissive: 0x2b8a3e, emissiveIntensity: 0.6 }), sx * 0.06, 0.03, 0.2, head, false);
    }
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const p = new THREE.Group(); p.position.set(x * 0.11 * s, -0.08 * s, z * (L / 2 - 0.08 * s)); body.add(p);
      add(new THREE.BoxGeometry(0.09 * s, H, 0.09 * s).translate(0, -H / 2, 0), fur, 0, 0, 0, p, false); pet.legs.push(p);
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.08 * s, -L / 2); body.add(tail); pet.tail = tail;
    add(new THREE.BoxGeometry(0.05 * s, 0.05 * s, (dog ? 0.32 : 0.5) * s).translate(0, 0, -(dog ? 0.16 : 0.25) * s), fur, 0, 0, 0, tail, false);
    tail.rotation.x = dog ? -0.7 : -1.1;
    pet.x = S.x - Math.sin(S.h) * 2; pet.z = S.z - Math.cos(S.h) * 2; pet.h = S.h;
  }
  function setPet(kind, quiet) {
    petKind = kind; buildPet(kind); try { localStorage.setItem('drive-pet', kind); } catch { /* not saved */ }
    if (!quiet) { toast(kind === 'dog' ? '🐶 A loyal dog joins you!' : kind === 'cat' ? '🐱 A curious cat joins you!' : 'No pet for now.'); if (kind === 'dog') bark('dog-bark-happy'); if (kind === 'cat') meow(); }
  }
  const cyclePet = () => setPet(PETS[(PETS.indexOf(petKind) + 1) % 3]);
  function barkSynth() {
    if (!audio || muted) return;
    const { ctx } = audio;
    for (const [d, f] of [[0, 1], [0.24, 0.92]]) {
      const t0 = ctx.currentTime + d, o = ctx.createOscillator(), o2 = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4;
      o.frequency.setValueAtTime(560 * f, t0); o.frequency.exponentialRampToValueAtTime(190 * f, t0 + 0.13);
      o2.frequency.setValueAtTime(280 * f, t0); o2.frequency.exponentialRampToValueAtTime(110 * f, t0 + 0.13);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(ctx.destination); o.start(t0); o2.start(t0); o.stop(t0 + 0.18); o2.stop(t0 + 0.18);
    }
    if (pet.head) pet.barkAnim = 0.5;
  }
  function meowSynth() {
    if (!audio || muted) return;
    const { ctx } = audio, t0 = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(520, t0); o.frequency.linearRampToValueAtTime(880, t0 + 0.22); o.frequency.linearRampToValueAtTime(470, t0 + 0.7);
    lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.08); g.gain.setValueAtTime(0.22, t0 + 0.5); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.75);
    o.connect(bp); bp.connect(g); g.connect(ctx.destination); o.start(t0); lfo.start(t0); o.stop(t0 + 0.8); lfo.stop(t0 + 0.8);
    if (pet.head) pet.barkAnim = 0.7;
  }

  // the dog's rescue: when you collapse, it drags you safely to the pharmacy
  const PHARMACY = shopsList.find((q) => q.name === 'PHARMACY');
  function startRescue() {
    reelKite(true);
    if (underground) leaveCave(true);
    abortRace(true);
    S.rescue = { barkT: 0.6 }; S.speed = 0; S.vx = S.vz = 0;
    S.pose = { type: 'lie', bench: null };
    toast('🐶 Your dog grabs your collar and drags you to the pharmacy!');
  }
  function updateRescue(dt) {
    const r = S.rescue; if (!r) return;
    const dx = PHARMACY.x - S.x, dz = PHARMACY.z - S.z, d = Math.hypot(dx, dz);
    if (d < 1.2) {
      S.rescue = null; stand(); LIFE.hp = Math.max(LIFE.hp, 10); saveLife(); updateLifeHud();
      S.h = Math.atan2(PHARMACY.x - S.x, (PHARMACY.z - 3) - S.z);
      toast('🐶 Your dog brought you to the PHARMACY. Buy medicine and use it to heal!');
      playLine('shop.PHARMACY.rescue', 'Oh no! Your loyal dog brought you here. Let me help you.', shopVoice('PHARMACY'));
      setTimeout(() => { if (spec.human) openShop(PHARMACY); }, 1600);
      return;
    }
    const v = Math.max(5, d / 7) * dt, ux = dx / d, uz = dz / d;
    S.x += ux * Math.min(v, d); S.z += uz * Math.min(v, d); S.y = 0;
    S.h = Math.atan2(ux, uz);                                         // lying face-up, head towards the dog
    pet.x = S.x + ux * 2.5; pet.z = S.z + uz * 2.5; pet.h = Math.atan2(ux, uz);
    if ((r.barkT -= dt) <= 0) { r.barkT = rand(1.6, 2.6); bark(Math.random() < 0.3 ? 'dog-whine' : undefined); }
  }

  function updatePets(dt) {
    const show = pet.g && spec.human && started;
    if (pet.g) pet.g.visible = !!show;
    if (!show) { if (pet.g && !spec.human) { pet.x = S.x; pet.z = S.z; } return; }
    const t = performance.now() / 1000;
    let spd = 0;
    if (pet.fetch) spd = fetchStep(dt);
    else if (!S.rescue) {
      const side = pet.kind === 'cat' ? -0.9 : 0.9;
      const tx = S.x - Math.sin(S.h) * 1.7 + Math.cos(S.h) * side, tz = S.z - Math.cos(S.h) * 1.7 - Math.sin(S.h) * side;
      const dx = tx - pet.x, dz = tz - pet.z, d = Math.hypot(dx, dz);
      if (d > 25) { pet.x = tx; pet.z = tz; }                           // caught up after a teleport
      else if (d > 0.35) {
        spd = Math.min(d * 2.2, 8.5); pet.x += dx / d * spd * dt; pet.z += dz / d * spd * dt;
        pet.h = lerpAngle(pet.h, Math.atan2(dx, dz), dt * 8);
      } else pet.h = lerpAngle(pet.h, S.h, dt * 3);
    } else spd = 5;
    pet.sit = !!S.pose && !S.rescue && spd < 0.5;
    pet.phase += dt * (3 + spd * 2.4);
    const sw = Math.sin(pet.phase) * Math.min(1, spd / 2) * 0.7;
    pet.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? sw : -sw); });
    pet.body.rotation.x += ((pet.sit ? -0.45 : 0) - pet.body.rotation.x) * Math.min(1, dt * 6);
    if (pet.sit) { pet.legs[2].rotation.x = pet.legs[3].rotation.x = 1.2; }
    pet.tail.rotation.y = Math.sin(t * (pet.kind === 'dog' ? 14 : 3)) * (pet.kind === 'dog' ? 0.6 : 0.25);
    if (pet.barkAnim > 0) { pet.barkAnim -= dt; pet.head.rotation.x = -0.25 + Math.sin(pet.barkAnim * 40) * 0.12; } else pet.head.rotation.x = 0;
    pet.g.position.set(pet.x, pet.y || 0, pet.z); pet.g.rotation.y = pet.h;
    // the dog barks at people wearing hats; the cat meows now and then
    if (pet.kind === 'dog' && !S.rescue && botsGroup.visible && (pet.barkT -= dt) <= 0) {
      for (const b of bots) {
        if (!b.hat || !b.h.g.visible) continue;
        if (Math.hypot(b.x - pet.x, b.z - pet.z) < 8 && (!b.barkedAt || t - b.barkedAt > 25)) {
          b.barkedAt = t; pet.barkT = 5; pet.h = Math.atan2(b.x - pet.x, b.z - pet.z); bark('dog-bark-alert');
          b.face = Math.atan2(pet.x - b.x, pet.z - b.z); b.wave = 1.4;
          toast('🐶 Woof! Your dog barks at the person in the hat.');
          break;
        }
      }
      if (pet.barkT <= 0) pet.barkT = 0.5;
    }
    if (pet.kind === 'cat' && (pet.meowT -= dt) <= 0) { pet.meowT = rand(25, 50); meow(); }
  }

  // ---------- Recorded sound effects (ElevenLabs, see tools/generate-sfx.mjs); synth sounds are only a fallback ----------
  function sfx(name, vol = 1, loop = false, fallback = null) {
    if (muted) return null;
    try {
      const a = new Audio(`audio/sfx/${name}.mp3`); a.volume = clamp(vol, 0, 1); a.loop = loop;
      a.onerror = () => { if (fallback) fallback(); };
      a.play().catch(() => {});
      return a;
    } catch { if (fallback) fallback(); return null; }
  }
  function bark(kind) {
    const name = kind || pick(['dog-bark-1', 'dog-bark-2']);
    sfx(name, 0.85, false, barkSynth);
    if (pet.head) pet.barkAnim = name === 'dog-bark-alert' ? 1.4 : 0.6;
  }
  function meow() {
    sfx(pick(['cat-meow-1', 'cat-meow-2', 'cat-meow-3']), 0.75, false, meowSynth);
    if (pet.head) pet.barkAnim = 0.8;
  }
  let purr = null;
  function updatePurr() { // the cat purrs while you sit or lie next to it
    const want = pet.kind === 'cat' && pet.g && pet.g.visible && pet.sit && !muted;
    if (want && !purr) purr = sfx('cat-purr', 0.4, true);
    if (!want && purr) { purr.pause(); purr = null; }
  }

  // ---------- Toys: fly the kite, spin the top ----------
  const WIND = new THREE.Vector3(0.82, 0, 0.57).normalize();
  const kiteDir = new THREE.Vector3(0, 0, 1);  // where the kite flies: in front of you, swinging round slowly as you turn
  const kite = { on: false, g: null, k: 0, reel: false, peak: false, wind: null, tail: null, string: null };
  function buildKite() {
    const g = new THREE.Group(); scene.add(g);
    const sh = new THREE.Shape(); sh.moveTo(0, 0.95); sh.lineTo(0.62, 0.05); sh.lineTo(0, -0.75); sh.lineTo(-0.62, 0.05); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 0.62) / 1.24, (p.getY(i) + 0.75) / 1.7);
    const tex = textTexture((c, w, h) => {
      c.fillStyle = '#e03131'; c.fillRect(0, 0, w / 2, h * 0.47); c.fillStyle = '#fab005'; c.fillRect(w / 2, 0, w / 2, h * 0.47);
      c.fillStyle = '#1c7ed6'; c.fillRect(0, h * 0.47, w / 2, h); c.fillStyle = '#7048e8'; c.fillRect(w / 2, h * 0.47, w / 2, h);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h * 0.47, w * 0.09, 0, Math.PI * 2); c.fill();
    }, 128, 128);
    add(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }), 0, 0, 0, g, false);
    add(new THREE.BoxGeometry(0.03, 1.7, 0.03), woodMat, 0, 0.1, 0.01, g, false);
    add(new THREE.BoxGeometry(1.24, 0.03, 0.03), woodMat, 0, 0.05, 0.01, g, false);
    const tailPts = Array.from({ length: 14 }, () => new THREE.Vector3());
    kite.tail = new THREE.Line(new THREE.BufferGeometry().setFromPoints(tailPts), new THREE.LineBasicMaterial({ color: 0xf06595 }));
    kite.bows = Array.from({ length: 4 }, (_, i) => { const b = add(new THREE.PlaneGeometry(0.22, 0.12), new THREE.MeshBasicMaterial({ color: [0xffd43b, 0x82c91e, 0x22d3ee, 0xf783ac][i], side: THREE.DoubleSide }), 0, 0, 0, scene, false); return b; });
    kite.string = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xf8f9fa, transparent: true, opacity: 0.8 }));
    kite.string.frustumCulled = kite.tail.frustumCulled = false;
    scene.add(kite.tail, kite.string);
    kite.g = g;
  }
  function toggleKite() {
    if (kite.on) { reelKite(); return; }
    if (!(LIFE.bag.kite > 0)) { toast('🪁 Buy a kite at a TOYS stall on Market Street first.'); return; }
    if (!spec.human) { toast('Switch to On foot in the Garage to fly your kite.'); return; }
    if (underground) { toast('No wind down here — fly it outside!'); return; }
    if (!kite.g) buildKite();
    kite.on = true; kite.reel = false; kite.k = 0; kite.peak = false; kiteDir.set(Math.sin(S.h), 0, Math.cos(S.h));
    for (const o of [kite.g, kite.tail, kite.string, ...kite.bows]) o.visible = true;
    const h = handPos(); kite.g.position.copy(h).add(new THREE.Vector3(0, 1.5, 0));
    kite.wind = sfx('kite-wind', 0.3, true);
    toast('🪁 Up it goes! Walk around — the kite follows the wind. Press K to reel it in.'); blip(660);
  }
  function reelKite(now) {
    if (!kite.on) return;
    kite.reel = true; if (kite.wind) { kite.wind.pause(); kite.wind = null; }
    if (now) { kite.on = false; for (const o of [kite.g, kite.tail, kite.string, ...kite.bows]) if (o) o.visible = false; }
    else toast('🪁 Reeling the kite in.');
  }
  const _hand = new THREE.Vector3();
  function handPos() {
    const h = model && model.userData.h;
    if (!h) return _hand.set(S.x, S.y + 2, S.z);
    h.armR.updateWorldMatrix(true, false);
    return h.armR.localToWorld(_hand.set(0, -0.62, 0));
  }
  const _kt = new THREE.Vector3(), _mid = new THREE.Vector3(), _tmp = new THREE.Vector3();
  function updateKite(dt) {
    if (!kite.on) return;
    if (!spec.human || underground || S.rescue || (race && !race.done)) { reelKite(true); return; }
    const t = performance.now() / 1000, gust = 1 + (W.show === 'rain' ? 0.6 : 0) + Math.sin(t * 0.37) * 0.25;
    kite.k = kite.reel ? Math.max(0, kite.k - dt * 0.45) : Math.min(1, kite.k + dt * 0.3);
    const hand = handPos().clone();
    _tmp.set(Math.sin(S.h), 0, Math.cos(S.h)); kiteDir.lerp(_tmp, Math.min(1, dt * 1.6)).normalize();
    WIND.copy(kiteDir);
    const side = new THREE.Vector3(-WIND.z, 0, WIND.x);
    _kt.copy(hand).addScaledVector(WIND, 4 + 22 * kite.k).addScaledVector(side, Math.sin(t * 0.7) * 2.6 * gust * kite.k);
    _kt.y = hand.y + 1.5 + 14 * kite.k + Math.sin(t * 1.3) * 1.1 * kite.k;
    kite.g.position.lerp(_kt, Math.min(1, dt * 2.2));
    kite.g.lookAt(hand); kite.g.rotateZ(Math.sin(t * 1.9) * 0.35 * gust); kite.g.rotateX(-0.35);
    // string: a gently sagging curve from your hand to the kite
    const pts = kite.string.geometry.attributes.position, kp = kite.g.position;
    _mid.copy(hand).lerp(kp, 0.5); _mid.y -= 2.2 + kite.k * 1.5;
    for (let i = 0; i < pts.count; i++) {
      const u = i / (pts.count - 1), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
      pts.setXYZ(i, a * hand.x + b * _mid.x + c * kp.x, a * hand.y + b * _mid.y + c * kp.y, a * hand.z + b * _mid.z + c * kp.z);
    }
    pts.needsUpdate = true;
    // tail: a wavy ribbon streaming downwind, with bows
    const tp = kite.tail.geometry.attributes.position;
    _tmp.set(0, -0.75, 0); kite.g.localToWorld(_tmp);
    for (let i = 0; i < tp.count; i++) {
      const u = i * 0.32;
      tp.setXYZ(i, _tmp.x + WIND.x * u + side.x * Math.sin(t * 4 + i * 0.7) * 0.25, _tmp.y - u * 0.55, _tmp.z + WIND.z * u + side.z * Math.sin(t * 4 + i * 0.7) * 0.25);
    }
    tp.needsUpdate = true;
    kite.bows.forEach((b, i) => { const j = 3 + i * 3; b.position.set(tp.getX(j), tp.getY(j), tp.getZ(j)); b.lookAt(camera.position); });
    if (!kite.peak && kite.k > 0.98) { kite.peak = true; toast('🪁 Your kite is soaring high above the island!'); }
    if (kite.wind) kite.wind.volume = 0.15 + 0.25 * kite.k;
    if (kite.reel && kite.k <= 0) reelKite(true);
  }

  const tops = [];
  function spinTop() {
    if (!(LIFE.bag.top > 0)) return;
    if (!spec.human) { toast('Switch to On foot in the Garage to play with the top.'); return; }
    const g = new THREE.Group();
    add(new THREE.ConeGeometry(0.16, 0.22, 16).rotateX(Math.PI), mat(0xe03131, { roughness: 0.5 }), 0, 0.13, 0, g, false);
    add(new THREE.CylinderGeometry(0.17, 0.16, 0.06, 16), mat(0xfab005), 0, 0.25, 0, g, false);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8), woodMat, 0, 0.33, 0, g, false);
    g.scale.setScalar(1.7); g.position.set(S.x + Math.sin(S.h) * 1.8 + Math.cos(S.h) * 0.9, S.y, S.z + Math.cos(S.h) * 1.8 - Math.sin(S.h) * 0.9); scene.add(g);
    tops.push({ g, t: 0, sound: sfx('top-spin', 0.45, true) });
    toast('🪀 Whirrr! The top is spinning.'); blip(880);
  }
  function updateTops(dt) {
    for (let i = tops.length - 1; i >= 0; i--) {
      const q = tops[i]; q.t += dt;
      const spin = Math.max(0, 1 - q.t / 7);
      q.g.rotation.y += dt * 40 * spin;
      const wob = (1 - spin) * 0.35 + 0.04;
      q.g.rotation.x = Math.sin(q.t * 6) * wob; q.g.rotation.z = Math.cos(q.t * 6) * wob;
      if (q.sound) q.sound.volume = 0.45 * spin;
      if (q.t > 7) { q.g.rotation.z = 1.3; if (q.sound) { q.sound.pause(); q.sound = null; } }
      if (q.t > 10) { scene.remove(q.g); tops.splice(i, 1); }
    }
  }
  function updateToys(dt) { updateKite(dt); updateTops(dt); updatePurr(); }

  // ---------- Foot race: line up at START, race 4 runners ----------
  const RACE_NAMES = [['Arjun', 0xe03131], ['Meera', 0x1c7ed6], ['Kabir', 0xf59f00], ['Priya', 0x0ca678]];
  const RACE_START_A = 90 * DEG, LANES = [-4.8, -2.4, 2.4, 4.8];
  let race = null, raceAsked = false, bestRace = {};
  try { bestRace = JSON.parse(localStorage.getItem('drive-foot-race') || '{}'); } catch { /* none */ }
  const runnersGroup = new THREE.Group(); runnersGroup.visible = false; scene.add(runnersGroup);
  const runners = RACE_NAMES.map(([name, shirt], i) => {
    const h = makeHuman({ shirt, pants: 0x212529, skin: SKINS[(i * 2 + 1) % SKINS.length], hair: HAIRS[i % HAIRS.length], dress: i % 2 === 1 }, false);
    runnersGroup.add(h.g);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(`${i + 1} · ${name}`, '#fff', '#' + shirt.toString(16).padStart(6, '0'), 256, 64), transparent: true, depthWrite: false }));
    tag.position.y = 2.25; tag.scale.set(1.5, 0.38, 1); h.g.add(tag);
    return { name, h, voice: voiceFor(hashStr(name), i % 2 === 1) };
  });
  const angProg = (x, z) => { let a = Math.atan2(z, x) - RACE_START_A; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return a * OUTER; };
  const gateDist = (gi) => { let a = [90, 150, 210, 270, 330, 30][gi] * DEG - RACE_START_A; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return (a || Math.PI * 2) * OUTER; };
  function askRace() {
    raceAsked = true;
    const b = (k) => bestRace[k] ? ` · your best ${fmtTime(bestRace[k])}` : '';
    openSheet('Wanna race? 🏁', 'Race 4 runners round the lap track — on foot.', `<p class="owner">🧑‍🦱 Arjun: “${lineText('race.invite', 'Hey! We\'re about to race. Join us?')}”</p>
      <div class="row"><span class="ie">🏃</span><div><b>Sprint</b><small>Start → Checkpoint 2 · about 400 m${b('sprint')}</small></div><button class="buy" data-r="sprint">Race!</button></div>
      <div class="row"><span class="ie">🏃‍♀️</span><div><b>Full lap</b><small>All 6 gates · about 1.2 km${b('lap')}</small></div><button class="buy" data-r="lap">Race!</button></div>
      <p class="pay">Hold <kbd>Shift</kbd> to run · pass every gate in order · cutting corners doesn't count.</p>`, (root) => {
      root.querySelectorAll('[data-r]').forEach((btn) => { btn.onclick = () => { closeSheet(); startRace(btn.dataset.r); }; });
    });
    playLine('race.invite', 'Hey! We are about to race. Join us?', runners[0].voice);
  }
  function startRace(kind) {
    reelKite(true);
    stand();
    const gatesSeq = kind === 'sprint' ? [1, 2] : [1, 2, 3, 4, 5, 0];
    race = { kind, gatesSeq, gi: 0, t: -3.2, done: false, finishers: [], target: gateDist(gatesSeq[gatesSeq.length - 1]),
      rs: runners.map((r, i) => ({ r, dist: 0, lane: LANES[i], base: rand(5.25, 5.95) + (i === 0 ? 0.25 : 0), surge: rand(0, 6), fin: null, phase: rand(0, 6) })), count: 4 };
    runnersGroup.visible = true;
    const t0 = { x: -Math.sin(RACE_START_A), z: Math.cos(RACE_START_A) };      // lap direction at the start line
    Object.assign(S, { x: Math.cos(RACE_START_A) * OUTER - t0.x * 0.5, z: Math.sin(RACE_START_A) * OUTER - t0.z * 0.5, h: Math.atan2(t0.x, t0.z), speed: 0, vx: 0, vz: 0, y: 0, vy: 0, onGround: true });
    snapCamera();
    toast('🏁 On your marks…'); playLine('race.marks', 'On your marks!', voiceFor(hashStr('announcer'), false));
  }
  function abortRace(quiet) {
    if (!race) { if (quiet !== 'keep') { holo.t = Math.min(holo.t, 0.01); } return; }
    race = null; runnersGroup.visible = false;
    $('#lap').textContent = bestLap ? `Best lap ${fmtTime(bestLap)}` : 'Lap: drive through START';
    if (!quiet) toast('Race cancelled.');
  }
  function placeRunner(q) {
    const a = RACE_START_A + q.dist / OUTER, r = OUTER + q.lane;
    q.r.h.g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); q.r.h.g.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
  }
  function updateRace(dt) {
    updateHolo(dt);
    document.body.classList.toggle('lapping', !!(race || holo.t > 0 || lapStart !== null));
    if (!race) {
      // offer a race when you walk up to the start line on foot
      const g0 = gates[0], d0 = Math.hypot(S.x - g0.x, S.z - g0.z);
      if (spec.human && started && !underground && !sheetOpen && !S.rescue && !raceAsked && d0 < 8) askRace();
      if (d0 > 22) raceAsked = false;
      return;
    }
    if (!spec.human || underground) { abortRace(); return; }
    const prevT = race.t; race.t += dt;
    const ann = voiceFor(hashStr('announcer'), false);
    if (prevT < -2.1 && race.t >= -2.1) { toast('🏁 Get set…'); playLine('race.set', 'Get set!', ann); blip(440); }
    if (prevT < -1.0 && race.t >= -1.0) { blip(440); }
    if (prevT < 0 && race.t >= 0) { toast('🏁 GO! GO! GO!'); playLine('race.go', 'Go!', ann); blip(880); }
    // runners
    for (const q of race.rs) {
      if (race.t > 0 && q.fin === null) {
        const lead = q.dist - race.pDist;
        let v = q.base + Math.sin(race.t * 0.6 + q.surge) * 0.35;
        if (lead > 25) v *= 0.95; else if (lead < -30) v *= 1.06;              // keep it close and exciting
        q.dist += v * dt; q.phase += dt * v * 2.6;
        if (q.dist >= race.target) { q.dist = race.target; q.fin = race.t; race.finishers.push({ name: q.r.name, t: race.t }); }
      }
      poseHuman(q.r.h, q.phase, race.t > 0 && q.fin === null ? 0.95 : 0);
      placeRunner(q);
    }
    // you: pass the gates in order; progress is capped at the next gate (no shortcuts)
    const nextG = gates[race.gatesSeq[race.gi]];
    if (race.t > 0 && Math.hypot(S.x - nextG.x, S.z - nextG.z) < 9) {
      race.gi++; blip(760 + race.gi * 60);
      if (race.gi >= race.gatesSeq.length) {
        race.finishers.push({ name: 'You', t: race.t, you: true });
        finishRace(); return;
      } else toast(`✅ Checkpoint! ${race.gatesSeq.length - race.gi} to go`);
    }
    const cap = race.gi < race.gatesSeq.length ? gateDist(race.gatesSeq[race.gi]) : race.target;
    let p = angProg(S.x, S.z); if (p > cap + 5 || (race.gi === 0 && p > OUTER * 5)) p = 0;
    race.pDist = Math.min(p, cap);
    const pos = 1 + race.rs.filter((q) => q.dist > race.pDist).length;
    $('#lap').textContent = race.t < 0 ? `🏁 ${Math.ceil(-race.t)}…` : `🏃 P${pos}/5 · ${fmtTime(race.t)} · next: ${race.gatesSeq[race.gi] === 0 ? 'FINISH' : 'CHECKPOINT ' + race.gatesSeq[race.gi]}`;
  }
  // results as a floating hologram beside you — never a popup, never blocks movement
  const holo = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 400;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
    sp.scale.set(3.4, 2.65, 1); sp.renderOrder = 10; sp.visible = false; scene.add(sp);
    return { c, g: c.getContext('2d'), tex, sp, t: 0, rows: [], title: '', sub: '' };
  })();
  function drawHolo(time) {
    const { g, c } = holo, W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'rgba(10,40,70,0.62)'); bg.addColorStop(1, 'rgba(40,10,70,0.55)');
    g.fillStyle = bg; g.fillRect(8, 8, W - 16, H - 16);
    g.strokeStyle = 'rgba(103,232,249,0.9)'; g.lineWidth = 3; g.shadowColor = '#22d3ee'; g.shadowBlur = 14; g.strokeRect(8, 8, W - 16, H - 16); g.shadowBlur = 0;
    for (let y = 12 + ((time * 40) % 6); y < H - 10; y += 6) { g.fillStyle = 'rgba(103,232,249,0.06)'; g.fillRect(10, y, W - 20, 2); }   // scanlines
    g.textAlign = 'left'; g.fillStyle = '#e0f7ff'; g.shadowColor = '#22d3ee'; g.shadowBlur = 12;
    g.font = '900 38px system-ui, sans-serif'; g.fillText(holo.title, 28, 58);
    g.font = '600 20px system-ui, sans-serif'; g.fillStyle = '#a5f3fc'; g.fillText(holo.sub, 28, 88);
    holo.rows.forEach((r, i) => {
      const y = 132 + i * 46;
      g.fillStyle = r.you ? 'rgba(236,72,153,0.35)' : 'rgba(103,232,249,0.08)'; g.shadowBlur = 0; g.fillRect(22, y - 30, W - 44, 40);
      g.shadowBlur = 10; g.fillStyle = r.you ? '#fff' : '#d0f4ff';
      g.font = '900 26px system-ui, sans-serif'; g.fillText(['1st', '2nd', '3rd', '4th', '5th'][i], 34, y);
      g.font = `${r.you ? 900 : 700} 26px system-ui, sans-serif`; g.fillText(r.you ? 'YOU' : r.name, 112, y);
      g.textAlign = 'right'; g.font = '700 24px system-ui, sans-serif'; g.fillText(fmtTime(r.t), W - 36, y); g.textAlign = 'left';
    });
    g.shadowBlur = 0; g.font = '600 17px system-ui, sans-serif'; g.fillStyle = 'rgba(165,243,252,0.85)';
    g.fillText('Walk back to START to race again', 28, H - 24);
    holo.tex.needsUpdate = true;
  }
  function updateHolo(dt) {
    if (holo.t <= 0) return;
    holo.t -= dt;
    const time = performance.now() / 1000, fx = Math.sin(S.h), fz = Math.cos(S.h);
    // float ahead and to the side of you (follows as you move), with a gentle bob and a flicker
    const tx = S.x + fx * 5.5 + Math.cos(S.h) * 2.2, tz = S.z + fz * 5.5 - Math.sin(S.h) * 2.2;
    holo.sp.position.x += (tx - holo.sp.position.x) * Math.min(1, dt * 4);
    holo.sp.position.z += (tz - holo.sp.position.z) * Math.min(1, dt * 4);
    holo.sp.position.y = S.y + 2.4 + Math.sin(time * 1.6) * 0.08;
    const fade = Math.min(1, (14 - holo.t) * 3, holo.t / 1.2);
    holo.sp.material.opacity = Math.max(0, fade) * (0.88 + 0.12 * Math.sin(time * 23) * Math.sin(time * 7));
    drawHolo(time);
    if (holo.t <= 0) { holo.sp.visible = false; runnersGroup.visible = false; if (!race) $('#lap').textContent = bestLap ? `Best lap ${fmtTime(bestLap)}` : 'Lap: drive through START'; }
  }

  // ======================================================================================
  //  Island life 2: shoppers, stall lights, kids & kites, shop jobs, sports & gym (on foot)
  // ======================================================================================
  const { FB, BB, GY, BD } = SPORT, CK = SPORT.CR;
  const UPV = new THREE.Vector3(0, 1, 0);
  const actPill = $('#act');
  const setActPill = (t) => { if (t) { if (actPill.textContent !== t) actPill.textContent = t; actPill.classList.remove('hidden'); } else actPill.classList.add('hidden'); };
  function kaching() { blip(1568); setTimeout(() => blip(2093), 90); setTimeout(() => blip(2637), 180); }
  const radialTex = (inner, mid) => textTexture((g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(0.45, mid); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, 128, 128);
  const warmPoolTex = radialTex('rgba(255,210,140,0.95)', 'rgba(255,180,100,0.35)');

  // ---------- lanterns on every stall and shop (they glow after dark) ----------
  {
    const spots = []; // [x, z, y, poolX, poolZ]
    for (const s of stallSpots) {
      const fx = Math.sin(s.face), fz = Math.cos(s.face);
      spots.push([s.x + fx * 1.25, s.z + fz * 1.25, 2.45, s.x + fx * 2.4, s.z + fz * 2.4]);
    }
    for (const [x, z, face] of [[-97, -249, 0], [97, -249, 0], [-97, -227, Math.PI], [97, -227, Math.PI]]) {
      const fx = Math.sin(face), fz = Math.cos(face), rx = Math.cos(face), rz = -Math.sin(face);
      for (const s2 of [-3.4, 3.4]) spots.push([x + rx * s2 + fx * 3.5, z + rz * s2 + fz * 3.5, 3.0, x + rx * s2 + fx * 5, z + rz * s2 + fz * 5]);
    }
    const n = spots.length;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 12, 8), glowStd(0xffb84d, 0.2, 4.2), n);
    const cords = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 4).translate(0, 0.2, 0), mat(0x222222), n);
    const poolM = new THREE.MeshBasicMaterial({ map: warmPoolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), poolM, n);
    const haloM = new THREE.SpriteMaterial({ map: glowTex('rgba(255,210,140,0.95)', 'rgba(255,170,80,0.3)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    spots.forEach(([x, z, y, px, pz], k) => {
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(x, y, z); dummy.updateMatrix(); bulbs.setMatrixAt(k, dummy.matrix); cords.setMatrixAt(k, dummy.matrix);
      dummy.position.set(px, 0.11, pz); dummy.updateMatrix(); pools.setMatrixAt(k, dummy.matrix);
      const halo = new THREE.Sprite(haloM); halo.position.set(x, y, z); halo.scale.set(1.6, 1.6, 1); scene.add(halo);
    });
    pools.renderOrder = 1; scene.add(bulbs, cords, pools);
    nightGlow.push({ basic: poolM, max: 1 }, { basic: haloM, max: 1 });
  }

  // ---------- islanders go shopping (and pay you when you work there) ----------
  const sellable = shopsList.filter((s) => !s.atm && MENUS[s.name]);
  let JOB = null;
  const bagGeo = new THREE.BoxGeometry(0.2, 0.24, 0.12).translate(0, -0.12, 0), bagMats = [0xf8f0e3, 0xd9a066, 0xffffff, 0xf783ac].map((c) => mat(c, { roughness: 0.9 }));
  // ---------- shop queues: customers line up, order at the counter, and get served (by the owner, or by you) ----------
  for (const s of sellable) s.queue = [];
  const QMAX = 4, orderTexCache = {};
  function sendShopping(b, shop) {
    if (!shop || !shop.queue || shop.queue.length >= QMAX || b.home || b.shopTo) return false;
    shop.queue.push(b); b.shopTo = shop; b.ordered = false; b.wait = 0; b.speed = Math.max(b.speed, 1.4);
    return true;
  }
  function maybeShop(b) {
    if (b.kid || b.home || b.area !== walkAreas.market || Math.random() > 0.4) return false;
    return sendShopping(b, JOB && Math.random() < 0.55 ? JOB.shop : pick(sellable));
  }
  function orderBubble(id) {
    const it = ITEMS[id];
    if (!orderTexCache[id]) orderTexCache[id] = label(`${it.e} ${it.n}`, '#15131f', '#ffffff', 512, 110);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: orderTexCache[id], depthWrite: false }));
    sp.scale.set(1.9, 0.42, 1); sp.position.y = 2.4; return sp;
  }
  function leaveQueue(b) {
    const q = b.shopTo && b.shopTo.queue; if (q) { const i = q.indexOf(b); if (i >= 0) q.splice(i, 1); }
    if (b.bubble) { b.h.g.remove(b.bubble); b.bubble = null; }
    b.shopTo = null; b.ordered = false; pickTarget(b); b.wait = 0.4;
  }
  function updateShopper(b, dt) {
    const sh = b.shopTo, q = sh.queue, i = q.indexOf(b);
    if (i < 0) { leaveQueue(b); return; }
    const ox = -sh.fx, oz = -sh.fz, side = i > 0 ? (i % 2 ? 0.22 : -0.22) : 0;          // line up out from the counter
    const tx = sh.x + ox * i * 1.15 + oz * side, tz = sh.z + oz * i * 1.15 - ox * side;
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d > 0.25) { const v = Math.min(b.speed, d * 3); b.x += dx / d * v * dt; b.z += dz / d * v * dt; b.face = lerpAngle(b.face, Math.atan2(dx, dz), dt * 6); b.phase += dt * v * 3.4; poseHuman(b.h, b.phase, 0.55); return; }
    b.face = lerpAngle(b.face, Math.atan2(sh.fx, sh.fz), dt * 6); poseHuman(b.h, 0, 0);
    if (i !== 0) return;
    const working = JOB && JOB.shop === sh;
    if (!b.ordered) {                                    // at the counter: place the order
      b.ordered = true; b.waitT = 0; b.serveT = rand(2.2, 3.2);
      const [id, price] = pick(MENUS[sh.name]); b.order = { id, price };
      b.bubble = orderBubble(id); b.h.g.add(b.bubble);
      if (working) playLine(`cust.${b.vslot}.${Math.random() < 0.5 ? 0 : 1}`, 'One of those, please.', b.voice, 1, b);
      else { const seller = sellerOf(sh.name); if (seller && !seller.home) seller.wave = 1.6; }
      return;
    }
    b.waitT += dt; b.h.armR.rotation.x = -0.9;
    if (working) { if (b.waitT > 30) { toast('😕 A customer got tired of waiting and left.'); leaveQueue(b); } }
    else if ((b.serveT -= dt) <= 0) completeSale(b, false);
  }
  function completeSale(b, byYou) {
    const sh = b.shopTo, { id, price } = b.order, it = ITEMS[id];
    if (b.carry) b.h.armL.remove(b.carry);
    b.carry = new THREE.Mesh(bagGeo, pick(bagMats)); b.carry.position.y = -0.62; b.h.armL.add(b.carry); b.carryT = 40;
    if (byYou) {     // you only earn when you actually complete the sale
      const commission = Math.round(price * 0.3), rate = b.waitT < 5 ? 0.25 : b.waitT < 10 ? 0.15 : b.waitT < 18 ? 0.08 : 0;
      const tip = Math.round(price * rate), total = commission + tip;
      LIFE.bal += total; JOB.earned += total; JOB.sales++; JOB.handT = 1.0;
      LIFE.tx.unshift({ d: `Sale: ${it.n} · ${sh.name}`, a: total }); LIFE.tx = LIFE.tx.slice(0, 12);
      saveLife(); updateLifeHud(); sfx('coin-register', 0.6, false, kaching);
      toast(`💰 Sale complete! ${it.e} ${it.n} (${rupees(price)}) → ${rupees(commission)} commission${tip ? ` + ${rupees(tip)} tip for quick service` : ''}`);
      const who = b; setTimeout(() => playLine(`cust.${who.vslot}.2`, 'Thank you so much!', who.voice, 1, who), 350);
      b.wave = 1.4;
    } else if (Math.hypot(S.x - b.x, S.z - b.z) < 12) blip(1320);
    leaveQueue(b);
  }
  function serveCustomer() {
    const head = JOB && JOB.shop.queue[0];
    if (head && head.ordered) { completeSale(head, true); return true; }
    return false;
  }
  function jobHtml(shop) {
    if (shop.atm || !MENUS[shop.name]) return '';
    if (JOB && JOB.shop === shop) return `<div class="job on"><div><b>💼 You're working here</b><small>${JOB.sales} sales · earned ${rupees(JOB.earned)} · stay behind the counter</small></div><button class="jobbtn" data-job="stop">Stop</button></div>`;
    return `<div class="job"><div><b>💼 Work for this shop</b><small>Take over the counter and serve the queue: 30% commission on every sale you complete, plus tips for quick service.</small></div><button class="jobbtn" data-job="start">Start shift</button></div>`;
  }
  function wireJob(root, shop) {
    root.querySelectorAll('.jobbtn').forEach((btn) => { btn.onclick = () => { if (btn.dataset.job === 'start') startJob(shop); else { endJob(); closeSheet(); } }; });
  }
  function startJob(shop) {
    if (JOB) endJob(true);
    closeSheet();
    // the owner steps out for a break and you take their place behind the counter
    const owner = sellerOf(shop.name);
    if (owner) { owner.home = { x: owner.x, z: owner.z, face: owner.face }; owner.mode = 'walk'; owner.area = walkAreas.market; owner.speed = 1.3; pickTarget(owner); owner.wave = 1.5; }
    JOB = { shop, owner, earned: 0, sales: 0, next: 3, handT: 0 };
    Object.assign(S, { x: shop.sx, z: shop.sz, h: shop.sface, speed: 0, vx: 0, vz: 0 });
    blip(880);
    toast(`💼 You're behind the counter at ${shop.name}! The owner is on a break. Customers queue up — press Enter to serve each order (30% commission + tip for quick service). Step away to end your shift.`);
  }
  function endJob(quiet) {
    if (!JOB) return;
    const j = JOB; JOB = null;
    if (j.owner && j.owner.home) { Object.assign(j.owner, { x: j.owner.home.x, z: j.owner.home.z, face: j.owner.home.face, mode: 'stand', shopTo: null, buying: false, wait: 0 }); j.owner.home = null; poseHuman(j.owner.h, 0, 0); }
    if (!quiet) toast(`💼 Shift over at ${j.shop.name}: ${j.sales} sale${j.sales === 1 ? '' : 's'}, earned ${rupees(j.earned)}. The owner is back.`);
  }
  function updateJob(dt) {
    if (!JOB) return;
    if (!spec.human || underground || Math.hypot(S.x - JOB.shop.sx, S.z - JOB.shop.sz) > 2.4) { endJob(); return; }
    const hh = model.userData.h;
    if (hh && JOB.handT > 0) { JOB.handT -= dt; hh.armR.rotation.x = -1.4; hh.armL.rotation.x = -1.1; }   // handing the order over
    if ((JOB.next -= dt) <= 0) {          // send the nearest free shopper our way
      JOB.next = rand(6, 10);
      let best = null, bd = Infinity;
      for (const b of bots) if (b.mode === 'walk' && !b.kid && !b.shopTo && !b.home && b.area === walkAreas.market) { const d = Math.hypot(b.x - JOB.shop.x, b.z - JOB.shop.z); if (d < bd) { bd = d; best = b; } }
      if (best) sendShopping(best, JOB.shop);
    }
    const head = JOB.shop.queue[0];
    if (head && head.ordered && !sheetOpen && !panelOpen) {
      const it = ITEMS[head.order.id], pr = $('#prompt'); pr.classList.remove('hidden');
      pr.textContent = `${isTouch ? 'Tap here' : 'Press Enter'} to serve ${it.e} ${it.n} (${rupees(head.order.price)}) · ${JOB.shop.queue.length} in queue`;
    }
    setActPill(`💼 ${JOB.shop.name} · ${JOB.sales} sales · ${rupees(JOB.earned)}`);
  }

  // ---------- kids, and people flying kites ----------
  walkAreas.beach = { type: 'ring', cx: BD.x, cz: BD.z, r0: 9.5, r1: 13 };
  walkAreas.cricket = { type: 'ring', cx: CK.x, cz: CK.z, r0: 27.5, r1: 30.5 };
  function addKids(area, n) {
    for (let i = 0; i < n; i++) { spawnIn(area, 1); const b = bots[bots.length - 1]; b.kid = true; b.hat = false; b.h.g.scale.setScalar(rand(0.55, 0.66)); b.speed = rand(2.0, 3.0); }
  }
  addKids(walkAreas.park, 5); addKids(walkAreas.plaza, 4); addKids(walkAreas.village, 4); addKids(walkAreas.beach, 3); addKids(walkAreas.cricket, 2);
  spawnIn(walkAreas.beach, 2); spawnIn(walkAreas.cricket, 3);

  function makeKiteRig(c1, c2) {
    const g = new THREE.Group();
    const dia = new THREE.Shape(); dia.moveTo(0, 0.85); dia.lineTo(0.55, 0.05); dia.lineTo(0, -0.7); dia.lineTo(-0.55, 0.05); dia.closePath();
    const top = new THREE.Shape(); top.moveTo(0, 0.85); top.lineTo(0.55, 0.05); top.lineTo(-0.55, 0.05); top.closePath();
    add(new THREE.ShapeGeometry(dia), new THREE.MeshStandardMaterial({ color: c1, side: THREE.DoubleSide, roughness: 0.7 }), 0, 0, 0, g, false);
    add(new THREE.ShapeGeometry(top), new THREE.MeshStandardMaterial({ color: c2, side: THREE.DoubleSide, roughness: 0.7 }), 0, 0, 0.01, g, false);
    const line = (n, c, o) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o })); l.frustumCulled = false; return l; };
    const string = line(16, 0xf1f3f5, 0.75), tail = line(8, c2, 1);
    botsGroup.add(g, string, tail);
    return { g, string, tail };
  }
  const _hp = new THREE.Vector3(), _kp = new THREE.Vector3(), _mp = new THREE.Vector3();
  function flyRig(rig, hand, dir, t, seed) {
    const sx = -dir.z, sz = dir.x, sway = Math.sin(t * 0.6 + seed) * 3;
    _kp.set(hand.x + dir.x * 20 + sx * sway, hand.y + 12 + Math.sin(t * 1.2 + seed) * 1.2, hand.z + dir.z * 20 + sz * sway);
    rig.g.position.copy(_kp); rig.g.lookAt(hand); rig.g.rotateZ(Math.sin(t * 1.7 + seed) * 0.35); rig.g.rotateX(-0.35);
    _mp.copy(hand).lerp(_kp, 0.5); _mp.y -= 2.4;
    const p = rig.string.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = i / (p.count - 1), a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; p.setXYZ(i, a * hand.x + b * _mp.x + c * _kp.x, a * hand.y + b * _mp.y + c * _kp.y, a * hand.z + b * _mp.z + c * _kp.z); }
    p.needsUpdate = true;
    const tp = rig.tail.geometry.attributes.position;
    for (let i = 0; i < tp.count; i++) { const u = i * 0.35; tp.setXYZ(i, _kp.x + dir.x * u + sx * Math.sin(t * 4 + i) * 0.22, _kp.y - 0.7 - u * 0.5, _kp.z + dir.z * u + sz * Math.sin(t * 4 + i) * 0.22); }
    tp.needsUpdate = true;
  }
  const flyers = [
    [-153, -170, 0.9, -0.44, true], [-165, -182, 0.3, -0.95, false],
    [BD.x + BD.ux * 16, BD.z + BD.uz * 16, -BD.vx, -BD.vz, true], [BD.x - BD.ux * 16, BD.z - BD.uz * 16, -BD.vx, -BD.vz, true],
  ].map(([x, z, dx, dz, kid], i) => {
    const h = makeHuman({ shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS), dress: i % 2 === 1 }, false);
    if (kid) h.g.scale.setScalar(0.6);
    botsGroup.add(h.g);
    const dir = new THREE.Vector3(dx, 0, dz).normalize();
    return { h, x, z, dir, rig: makeKiteRig([0xe03131, 0x1c7ed6, 0x7048e8, 0x0ca678][i], [0xffd43b, 0xf783ac, 0x82c91e, 0xfab005][i]), seed: i * 1.7, ox: x, oz: z };
  });
  function updateFlyers(t) {
    for (const f of flyers) {
      f.x = f.ox + Math.sin(t * 0.13 + f.seed) * 2.5; f.z = f.oz + Math.cos(t * 0.11 + f.seed) * 2.5;
      f.h.g.position.set(f.x, 0, f.z); f.h.g.rotation.y = Math.atan2(f.dir.x, f.dir.z);
      poseHuman(f.h, 0, 0); f.h.armR.rotation.x = -2.3 + Math.sin(t * 2 + f.seed) * 0.1; f.h.armL.rotation.x = -0.6;
      f.h.armR.updateWorldMatrix(true, false);
      flyRig(f.rig, f.h.armR.localToWorld(_hp.set(0, -0.62, 0)), f.dir, t, f.seed);
    }
  }

  // ---------- sports & gym: shared helpers ----------
  const field = (w, l, draw, res = 512) => { const tex = textTexture((g, W, H) => draw(g, W, H), res, Math.round(res * l / w)); return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }); };
  const ball = (r, tex) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  function floodlights(list) {                       // tall lights round each court, lit after dark
    const pm = new THREE.MeshBasicMaterial({ map: warmPoolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const head = glowStd(0xfff3d6, 0.1, 4);
    for (const [x, z, tx, tz] of list) {
      add(new THREE.CylinderGeometry(0.14, 0.2, 9, 8), ironMat, x, 4.5, z);
      add(new THREE.BoxGeometry(1.2, 0.5, 0.3), head, x, 9.1, z, scene, false).rotation.y = Math.atan2(tx - x, tz - z);
      const p = add(new THREE.PlaneGeometry(22, 22), pm, x + (tx - x) * 0.55, 0.06, z + (tz - z) * 0.55, scene, false); p.rotation.x = -Math.PI / 2; p.renderOrder = 1;
      colliders.push({ x, z, r: 0.35 });
    }
    nightGlow.push({ basic: pm, max: 0.55 });
  }
  const sportsman = (shirt, kid) => { const h = makeHuman({ shirt, pants: 0x212529, skin: pick(SKINS), hair: pick(HAIRS) }, false); if (kid) h.g.scale.setScalar(0.66); botsGroup.add(h.g); return h; };
  const handProp = (mesh) => { const h = model.userData.h; if (!h) return null; mesh.position.set(0, -0.66, 0.08); h.armR.add(mesh); return mesh; };
  const dropProp = (m) => { if (m && m.parent) m.parent.remove(m); };
  let ACT = null;                                    // the activity you're playing: { type, ... }
  let nearAct = null, swingHeld = false;
  function pinPlayer() { car.position.set(S.x, S.y, S.z); car.rotation.y = S.h; }
  function actLock() { return !!(ACT && ACT.lock); }
  function actNoJump() { return !!(ACT && ACT.noJump); }

  // ---------- ⚽ Football pitch ----------
  const ballTex = textTexture((g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((i % 4) * w / 4 + (Math.floor(i / 4) % 2) * w / 8 + 16, Math.floor(i / 4) * h / 3 + h / 6, 12, 0, 6.3); g.fill(); } }, 128, 64);
  add(new THREE.PlaneGeometry(FB.L + 4, FB.W + 4), field(FB.L + 4, FB.W + 4, (g, W, H) => {
    for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#3f9a3a' : '#48a843'; g.fillRect(i * W / 10, 0, W / 10, H); }
    const sx = W / (FB.L + 4), m = 2 * sx; g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m); g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, H - m); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 4.5 * sx, 0, 6.3); g.stroke();
    for (const s of [0, 1]) g.strokeRect(s ? W - m - 5 * sx : m, H / 2 - 6 * sx, 5 * sx, 12 * sx);
  }), FB.x, 0.025, FB.z, scene, false).rotation.x = -Math.PI / 2;
  const netMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 });
  for (const s of [-1, 1]) {
    const gx = FB.x + s * FB.L / 2, post = mat(0xffffff);
    for (const zz of [-3, 3]) { add(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), post, gx, 1.2, FB.z + zz); colliders.push({ x: gx, z: FB.z + zz, r: 0.15 }); }
    add(new THREE.CylinderGeometry(0.07, 0.07, 6, 8).rotateX(Math.PI / 2), post, gx, 2.4, FB.z);
    add(new THREE.BoxGeometry(1.5, 2.4, 6, 3, 4, 8), netMat, gx + s * 0.75, 1.2, FB.z, scene, false);
  }
  floodlights([[FB.x - 22, FB.z - 15, FB.x, FB.z], [FB.x + 22, FB.z - 15, FB.x, FB.z], [FB.x - 22, FB.z + 15, FB.x, FB.z], [FB.x + 22, FB.z + 15, FB.x, FB.z]]);
  const fb = { b: { x: FB.x, z: FB.z, y: 0.22, vx: 0, vz: 0, vy: 0 }, mesh: ball(0.22, ballTex), score: [0, 0], reset: 0, pcd: 0, inside: false };
  scene.add(fb.mesh);
  fb.players = [[0x1c7ed6, 0, false, -6, -4], [0xe03131, 1, true, 6, 3], [0xe03131, 1, false, 9, -5]].map(([c, team, kid, hx, hz]) => ({ h: sportsman(c, kid), team, x: FB.x + hx, z: FB.z + hz, hx: FB.x + hx, hz: FB.z + hz, cd: 0, phase: 0, spd: kid ? 3.6 : 4.0, face: 0 }));
  const inPitch = (x, z, m = 0) => Math.abs(x - FB.x) < FB.L / 2 + m && Math.abs(z - FB.z) < FB.W / 2 + m;
  function kick(B, dx, dz, power, lift) { const d = Math.hypot(dx, dz) || 1; B.vx = dx / d * power; B.vz = dz / d * power; B.vy = lift; blip(150); }
  function updateFootball(dt, t) {
    const B = fb.b;
    // ball physics
    B.vy -= 9.8 * dt; B.x += B.vx * dt; B.z += B.vz * dt; B.y += B.vy * dt;
    if (B.y < 0.22) { B.y = 0.22; B.vy = Math.abs(B.vy) > 1.2 ? -B.vy * 0.45 : 0; }
    const fr = B.y <= 0.23 ? 1.1 : 0.15; B.vx -= B.vx * fr * dt; B.vz -= B.vz * fr * dt;
    if (Math.abs(B.x - FB.x) > FB.L / 2) {
      if (Math.abs(B.z - FB.z) < 3 && B.y < 2.4 && fb.reset <= 0) {
        const team = B.x > FB.x ? 0 : 1; fb.score[team]++; fb.reset = 2.5;
        if (fb.inside) { toast(team === 0 ? `⚽ GOAL! Your team scores! ${fb.score[0]} – ${fb.score[1]}` : `⚽ Island FC scores… ${fb.score[0]} – ${fb.score[1]}`); blip(team === 0 ? 1320 : 330); }
      }
      if (Math.abs(B.x - FB.x) > FB.L / 2 + 1.4) { B.x = FB.x + Math.sign(B.x - FB.x) * (FB.L / 2 + 1.4); B.vx *= -0.3; }
    }
    if (Math.abs(B.z - FB.z) > FB.W / 2) { B.z = FB.z + Math.sign(B.z - FB.z) * FB.W / 2; B.vz *= -0.6; }
    if (fb.reset > 0 && (fb.reset -= dt) <= 0) Object.assign(B, { x: FB.x, z: FB.z, y: 0.22, vx: 0, vz: 0, vy: 0 });
    // you
    fb.inside = spec.human && inPitch(S.x, S.z);
    fb.pcd -= dt;
    if (fb.inside && fb.pcd <= 0 && B.y < 0.9 && Math.hypot(S.x - B.x, S.z - B.z) < spec.r + 0.45) {
      fb.pcd = 0.35; kick(B, Math.sin(S.h) + S.vx * 0.05, Math.cos(S.h) + S.vz * 0.05, 3 + Math.abs(S.speed) * 1.7, Math.abs(S.speed) > 4 ? 2.5 : 0.6);
    }
    // bots: chase the ball from behind and shoot at their goal
    const youNear = fb.inside ? Math.hypot(S.x - B.x, S.z - B.z) : 99;
    for (const p of fb.players) {
      const gx = FB.x + (p.team === 0 ? FB.L / 2 : -FB.L / 2), gdx = gx - B.x, gdz = FB.z - B.z, gd = Math.hypot(gdx, gdz) || 1;
      let tx = B.x - gdx / gd * 0.7, tz = B.z - gdz / gd * 0.7;
      if (fb.reset > 0) { tx = p.hx; tz = p.hz; }
      else if (p.team === 0 && youNear < Math.hypot(p.x - B.x, p.z - B.z)) { tx = B.x + 7; tz = FB.z + (p.hz - FB.z); }   // support you up front
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const v = d > 0.3 ? Math.min(p.spd, d * 3) : 0;
      if (v > 0) { p.x += dx / d * v * dt; p.z += dz / d * v * dt; p.face = lerpAngle(p.face, Math.atan2(dx, dz), dt * 8); }
      p.phase += dt * v * 2.8; poseHuman(p.h, p.phase, Math.min(1, v / 3) * 0.9);
      p.cd -= dt;
      if (fb.reset <= 0 && p.cd <= 0 && B.y < 0.7 && Math.hypot(p.x - B.x, p.z - B.z) < 0.8) {
        p.cd = 0.9; const a = Math.atan2(gdz, gdx) + rand(-0.3, 0.3); kick(B, Math.cos(a), Math.sin(a), rand(7, 12), rand(0, 2.5));
      }
      p.h.g.position.set(p.x, 0, p.z); p.h.g.rotation.y = p.face;
    }
    fb.mesh.position.set(B.x, B.y, B.z); fb.mesh.rotation.x += B.vz * dt / 0.22; fb.mesh.rotation.z -= B.vx * dt / 0.22;
    if (fb.inside) setActPill(`⚽ You & Ravi ${fb.score[0]} – ${fb.score[1]} Island FC · run into the ball to kick`);
  }

  // ---------- 🏀 Basketball court ----------
  add(new THREE.PlaneGeometry(BB.W + 3, BB.L + 3), field(BB.W + 3, BB.L + 3, (g, W, H) => {
    g.fillStyle = '#2b5f9e'; g.fillRect(0, 0, W, H); const s = W / (BB.W + 3), m = 1.5 * s;
    g.fillStyle = '#d9822b'; g.fillRect(m, m, W - 2 * m, H - 2 * m);
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.beginPath(); g.moveTo(m, H / 2); g.lineTo(W - m, H / 2); g.stroke(); g.beginPath(); g.arc(W / 2, H / 2, 1.8 * s, 0, 6.3); g.stroke();
    for (const e of [0, 1]) { const y0 = e ? H - m : m, d = e ? -1 : 1; g.strokeRect(W / 2 - 2.45 * s, e ? H - m - 5.8 * s : m, 4.9 * s, 5.8 * s); g.beginPath(); g.arc(W / 2, y0 + d * 1.6 * s, 6.75 * s, e ? Math.PI : 0, e ? 2 * Math.PI : Math.PI); g.stroke(); }
  }, 256), BB.x, 0.025, BB.z, scene, false).rotation.x = -Math.PI / 2;
  const hoops = [-1, 1].map((s) => {
    const z0 = BB.z + s * (BB.L / 2 + 1.0), zb = BB.z + s * (BB.L / 2 - 0.1), zr = zb - s * 0.4;
    add(new THREE.CylinderGeometry(0.1, 0.12, 3.9, 8), mat(0x495057), BB.x, 1.95, z0); colliders.push({ x: BB.x, z: z0, r: 0.25 });
    add(new THREE.BoxGeometry(0.1, 0.1, Math.abs(zb - z0)), mat(0x495057), BB.x, 3.85, (z0 + zb) / 2, scene, false);
    add(new THREE.BoxGeometry(1.8, 1.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), BB.x, 3.45, zb);
    add(new THREE.TorusGeometry(0.23, 0.02, 6, 20).rotateX(Math.PI / 2), mat(0xf76707), BB.x, 3.05, zr, scene, false);
    add(new THREE.CylinderGeometry(0.23, 0.15, 0.4, 12, 1, true), netMat, BB.x, 2.84, zr, scene, false);
    return new THREE.Vector3(BB.x, 3.05, zr);
  });
  floodlights([[BB.x - 10, BB.z - 9, BB.x, BB.z], [BB.x + 10, BB.z + 9, BB.x, BB.z]]);
  const bbTex = textTexture((g, w, h) => { g.fillStyle = '#e8590c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); }, 64, 32);
  const mkBall = (x, z) => ({ x, z, y: 0.12, vx: 0, vy: 0, vz: 0, state: 'free', mesh: ball(0.12, bbTex) });
  const bb = { ...mkBall(BB.x, BB.z), pts: 0, made: 0, shots: 0, inside: false };
  scene.add(bb.mesh);
  const inCourt = (x, z) => Math.abs(x - BB.x) < BB.W / 2 + 1 && Math.abs(z - BB.z) < BB.L / 2 + 1;
  function launch(o, from, hoop, success) {
    const target = hoop.clone();
    if (!success) { const a = rand(0, 6.28), r = rand(0.3, 0.5); target.x += Math.cos(a) * r; target.z += Math.sin(a) * r; target.y += 0.05; }
    const dist = Math.hypot(target.x - from.x, target.z - from.z), T = 0.75 + dist * 0.045;
    Object.assign(o, { x: from.x, y: from.y, z: from.z, vx: (target.x - from.x) / T, vz: (target.z - from.z) / T, vy: (target.y - from.y + 4.9 * T * T) / T, state: 'shot', st: 0, T, success, hoop });
  }
  function ballPhysics(o, dt, bounds) {
    if (o.state === 'shot') {
      o.st += dt; o.vy -= 9.8 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.st >= o.T) {
        if (o.success) { o.x = o.hoop.x; o.z = o.hoop.z; o.vx = o.vz = 0; o.vy = -2.5; }
        else { const a = rand(0, 6.28); o.vx = Math.cos(a) * rand(1.5, 3); o.vz = Math.sin(a) * rand(1.5, 3); o.vy = rand(1.5, 3.5); }
        o.state = 'free'; return o.success ? 'made' : 'miss';
      }
      return null;
    }
    if (o.state !== 'free') return null;
    o.vy -= 9.8 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    if (o.y < 0.12) { o.y = 0.12; o.vy = Math.abs(o.vy) > 1 ? -o.vy * 0.7 : 0; o.vx *= 0.97; o.vz *= 0.97; }
    if (bounds) { if (Math.abs(o.x - BB.x) > BB.W / 2 + 1.2) { o.x = BB.x + Math.sign(o.x - BB.x) * (BB.W / 2 + 1.2); o.vx *= -0.5; } if (Math.abs(o.z - BB.z) > BB.L / 2 + 1.2) { o.z = BB.z + Math.sign(o.z - BB.z) * (BB.L / 2 + 1.2); o.vz *= -0.5; } }
    return null;
  }
  const shooters = [0x2f9e44, 0xf59f00].map((c, i) => ({ h: sportsman(c, i === 1), x: BB.x + (i ? 3 : -3), z: BB.z + 7, ball: mkBall(BB.x + (i ? 3 : -3), BB.z + 7.5), st: 'walk', tx: BB.x, tz: BB.z + 7, wait: rand(0, 2), phase: 0, face: 0 }));
  for (const s of shooters) scene.add(s.ball.mesh);
  function bbShoot() {
    const hoop = hoops.reduce((a, h) => (Math.hypot(h.x - S.x, h.z - S.z) < Math.hypot(a.x - S.x, a.z - S.z) ? h : a));
    const dist = Math.hypot(hoop.x - S.x, hoop.z - S.z);
    bb.three = dist > 6.75; bb.shots++;
    launch(bb, new THREE.Vector3(S.x + Math.sin(S.h) * 0.3, S.y + 2.1, S.z + Math.cos(S.h) * 0.3), hoop, Math.random() < clamp(0.92 - dist * 0.065, 0.12, 0.9));
    S.h = Math.atan2(hoop.x - S.x, hoop.z - S.z); blip(500);
  }
  function updateBasketball(dt, t) {
    bb.inside = spec.human && inCourt(S.x, S.z);
    if (bb.state === 'held') {
      if (!bb.inside) { bb.state = 'free'; bb.vx = bb.vz = 0; }
      else { const bounce = Math.abs(Math.sin(t * 7)); bb.x = S.x + Math.sin(S.h) * 0.55 + Math.cos(S.h) * 0.25; bb.z = S.z + Math.cos(S.h) * 0.55 - Math.sin(S.h) * 0.25; bb.y = 0.15 + bounce * 0.8; if (bounce < 0.08 && !bb.dTick) { bb.dTick = true; blip(95); } if (bounce > 0.3) bb.dTick = false; }
    }
    const r = ballPhysics(bb, dt, true);
    if (r === 'made') { const p = bb.three ? 3 : 2; bb.pts += p; bb.made++; toast(`🏀 ${bb.three ? 'THREE!' : 'Swish!'} +${p} · ${bb.pts} pts (${bb.made}/${bb.shots})`); blip(1046); }
    if (r === 'miss') toast(`🏀 Off the rim! ${bb.made}/${bb.shots} — grab the rebound.`);
    if (bb.state === 'free' && bb.inside && bb.y < 1.3 && Math.hypot(bb.x - S.x, bb.z - S.z) < 0.95) { bb.state = 'held'; blip(300); }
    bb.mesh.position.set(bb.x, bb.y, bb.z);
    if (bb.inside) setActPill(`🏀 ${bb.pts} pts · ${bb.made}/${bb.shots} · ${bb.state === 'held' ? 'ENTER to shoot' : 'grab the ball'}`);
    // the two islanders shooting around at the other basket
    for (const s of shooters) {
      const B = s.ball; ballPhysics(B, dt, true);
      if (s.st === 'walk') {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { s.x += dx / d * 2.4 * dt; s.z += dz / d * 2.4 * dt; s.face = Math.atan2(dx, dz); s.phase += dt * 6; poseHuman(s.h, s.phase, 0.6); }
        else if (B.state === 'free' && Math.hypot(B.x - s.x, B.z - s.z) < 1) { B.state = 'held'; s.st = 'aim'; s.wait = rand(0.8, 1.6); const a = rand(Math.PI * 0.15, Math.PI * 0.85), r2 = rand(2.5, 7); s.tx = hoops[1].x + Math.cos(a) * r2; s.tz = hoops[1].z - Math.sin(a) * r2; }
        else { s.tx = B.x; s.tz = B.z; }
      } else if (s.st === 'aim') {
        const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { s.x += dx / d * 2.4 * dt; s.z += dz / d * 2.4 * dt; s.face = Math.atan2(dx, dz); s.phase += dt * 6; poseHuman(s.h, s.phase, 0.6); B.x = s.x + Math.sin(s.face) * 0.5; B.z = s.z + Math.cos(s.face) * 0.5; B.y = 0.15 + Math.abs(Math.sin(t * 7)) * 0.7; }
        else {
          s.face = Math.atan2(hoops[1].x - s.x, hoops[1].z - s.z); poseHuman(s.h, 0, 0); s.h.armR.rotation.x = s.h.armL.rotation.x = -2.6;
          B.x = s.x; B.z = s.z; B.y = 2.2;
          if ((s.wait -= dt) <= 0) { launch(B, new THREE.Vector3(s.x, 2.2, s.z), hoops[1], Math.random() < 0.55); s.st = 'walk'; s.tx = hoops[1].x + rand(-2, 2); s.tz = hoops[1].z - rand(1, 3); }
        }
      }
      s.h.g.position.set(s.x, 0, s.z); s.h.g.rotation.y = s.face; B.mesh.position.set(B.x, B.y, B.z);
    }
  }

  // ---------- 🏏 Cricket ground ----------
  add(new THREE.CircleGeometry(CK.R, 64), mat(0x6cbf4f, { roughness: 1 }), CK.x, 0.022, CK.z, scene, false).rotation.x = -Math.PI / 2;
  add(new THREE.TorusGeometry(CK.R - 0.4, 0.07, 6, 96).rotateX(Math.PI / 2), mat(0xffffff), CK.x, 0.08, CK.z, scene, false);
  add(new THREE.PlaneGeometry(22, 3), field(22, 3, (g, W, H) => { g.fillStyle = '#d8c48f'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; for (const x of [0.09, 0.91]) g.fillRect(W * x, 0, 3, H); }, 512), CK.x, 0.03, CK.z, scene, false).rotation.x = -Math.PI / 2;
  const stumpSets = [-1, 1].map((s) => { const g = new THREE.Group(); g.position.set(CK.x + s * 10.6, 0, CK.z); scene.add(g); for (const zz of [-0.11, 0, 0.11]) add(new THREE.CylinderGeometry(0.02, 0.02, 0.71, 6), mat(0xf1e3c6), 0, 0.355, zz, g, false); add(new THREE.BoxGeometry(0.02, 0.02, 0.24), mat(0xf1e3c6), 0, 0.72, 0, g, false); return g; });
  floodlights([[CK.x - 27, CK.z, CK.x, CK.z], [CK.x + 27, CK.z, CK.x, CK.z], [CK.x, CK.z - 27, CK.x, CK.z], [CK.x, CK.z + 27, CK.x, CK.z]]);
  const crBallTex = textTexture((g, w, h) => { g.fillStyle = '#b3121b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f8f0e3'; g.fillRect(0, h / 2 - 2, w, 4); }, 32, 16);
  const cr = { mesh: ball(0.07, crBallTex), bowler: { h: sportsman(0x868e96, false), x: CK.x - 15, z: CK.z - 0.3, phase: 0 }, best: 0 };
  try { cr.best = +localStorage.getItem('drive-cricket') || 0; } catch { /* none */ }
  scene.add(cr.mesh); cr.mesh.position.set(CK.x - 10, 0.07, CK.z);
  cr.fielders = [[-4, 12], [6, -13], [-14, -9], [14, 8], [2, 18], [-8, -18]].map(([dx, dz], i) => ({ h: sportsman(i % 2 ? 0xf8f9fa : 0xe7f5ff, i === 4), x: CK.x + dx, z: CK.z + dz, hx: CK.x + dx, hz: CK.z + dz, phase: 0 }));
  const batGeo = new THREE.BoxGeometry(0.1, 0.85, 0.04).translate(0, -0.42, 0); batGeo.userData.shared = true;
  function startCricket() {
    ACT = { type: 'cricket', lock: true, noJump: true, balls: 0, runs: 0, wkts: 0, phase: 'wait', t: 0.8, swung: false, bat: handProp(new THREE.Mesh(batGeo, mat(0xd9b48a))) };
    Object.assign(S, { x: CK.x + 9.3, z: CK.z + 0.35, h: -Math.PI / 2, speed: 0, vx: 0, vz: 0 });
    stumpSets[1].rotation.set(0, 0, 0);
    toast('🏏 One over, six balls. Press SPACE (or ENTER) to swing as the ball reaches you!'); blip(660);
  }
  function crSwing() { const A = ACT; if (A.phase !== 'ball' || A.swung) return; A.swung = true; A.swingT = A.t; A.swingAnim = 0.35; blip(220); }
  function crBall(dt, t) {
    const A = ACT, B = cr.bowler;
    Object.assign(S, { x: CK.x + 9.3, z: CK.z + 0.35, h: -Math.PI / 2 }); pinPlayer();
    const h = model.userData.h;
    if (h) { // batting stance / swing
      if (A.swingAnim > 0) { A.swingAnim -= dt; const k = 1 - A.swingAnim / 0.35; h.armR.rotation.x = -2.4 + k * 3.2; h.armR.rotation.z = -0.5; h.upper.rotation.y = -0.6 + k * 1.2; }
      else { h.armR.rotation.x = -0.9; h.armR.rotation.z = -0.4; h.armL.rotation.x = -0.8; h.upper.rotation.y = -0.3; }
    }
    A.t -= dt;
    if (A.phase === 'wait') { B.x = CK.x - 15; poseHuman(B.h, 0, 0); if (A.t <= 0) { A.phase = 'runup'; A.t = 1.3; } }
    else if (A.phase === 'runup') {
      B.x += 3.6 * dt; B.phase += dt * 10; poseHuman(B.h, B.phase, 0.9);
      if (A.t <= 0) { A.phase = 'ball'; A.speed = rand(17, 23); A.dur = 20 / A.speed; A.t = A.dur * 1.3; A.arrive = A.dur * 0.3; A.line = Math.random() < 0.55 ? 0 : (Math.random() < 0.5 ? -0.5 : 0.5); A.swung = false; B.h.armR.rotation.x = -3; }
    } else if (A.phase === 'ball') {
      const el = A.dur * 1.3 - A.t, u = el / A.dur;                       // u: 0 at release, 1 at the batsman
      const x = CK.x - 10.2 + u * 19.5, bounceU = 0.72;
      const y = u < bounceU ? 2.1 * (1 - Math.pow(u / bounceU, 1.4)) + 0.07 : 0.07 + 0.75 * Math.sin(Math.min(1, (u - bounceU) / (1 - bounceU)) * Math.PI / 2);
      cr.mesh.position.set(x, y, CK.z + A.line * u);
      if (A.swung && A.swingT !== undefined) {
        const err = Math.abs((A.dur * 1.3 - A.swingT) - A.dur);              // how far from the moment the ball reached you
        A.swingT = undefined;
        if (err < 0.26) { crHit(err); return; }
      }
      if (u >= 1.05) {
        if (A.line === 0) { crOut('🏏 BOWLED! The stumps go flying.'); stumpSets[1].rotation.set(0.6, 0, 0.4); }
        else crDone(0, A.swung ? '🏏 Swing and a miss — dot ball.' : '🏏 Left alone — dot ball.');
      }
    } else if (A.phase === 'hit') {
      const o = A.hitBall; o.vy -= 9.8 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.y < 0.07) { o.y = 0.07; o.vy = Math.abs(o.vy) > 2 ? -o.vy * 0.4 : 0; o.vx *= 0.985; o.vz *= 0.985; }
      cr.mesh.position.set(o.x, o.y, o.z);
      const f = cr.fielders.reduce((a, q) => (Math.hypot(q.x - o.x, q.z - o.z) < Math.hypot(a.x - o.x, a.z - o.z) ? q : a));
      const dx = o.x - f.x, dz = o.z - f.z, d = Math.hypot(dx, dz); if (d > 0.5) { f.x += dx / d * 4.5 * dt; f.z += dz / d * 4.5 * dt; f.phase += dt * 10; poseHuman(f.h, f.phase, 0.9); f.h.g.rotation.y = Math.atan2(dx, dz); }
      if (A.t <= 0) crDone(A.hitRuns, A.hitMsg);
    } else if (A.phase === 'after' && A.t <= 0) { A.phase = 'wait'; A.t = 0.6; cr.mesh.position.set(CK.x - 10, 0.07, CK.z); stumpSets[1].rotation.set(0, 0, 0); for (const f of cr.fielders) { f.x = f.hx; f.z = f.hz; } }
    for (const f of cr.fielders) { f.h.g.position.set(f.x, 0, f.z); if (A.phase !== 'hit') { poseHuman(f.h, 0, 0); f.h.g.rotation.y = Math.atan2(CK.x + 9 - f.x, CK.z - f.z); } }
    B.h.g.position.set(B.x, 0, B.z); B.h.g.rotation.y = Math.PI / 2;
    setActPill(`🏏 ${A.runs}/${A.wkts} · ball ${Math.min(6, A.balls + 1)} of 6 · SPACE to swing`);
  }
  function crHit(err) {
    const A = ACT, o = { x: CK.x + 9, y: 0.6, z: CK.z };
    let runs, msg, sp, vy;
    if (err < 0.06) { runs = 6; msg = '🏏 SIX! Out of the ground!'; sp = 28; vy = 15; }
    else if (err < 0.11) { runs = 4; msg = '🏏 FOUR! Racing to the boundary!'; sp = 26; vy = 1.5; }
    else if (err < 0.19) { runs = Math.random() < 0.5 ? 1 : 2; msg = `🏏 Nicely placed — ${runs} run${runs > 1 ? 's' : ''}.`; sp = rand(10, 14); vy = 2; }
    else if (Math.random() < 0.35) { crOut('🏏 Edged and CAUGHT! Out.'); return; }
    else { runs = 1; msg = '🏏 Off the edge — a quick single.'; sp = 8; vy = 3; }
    const a = Math.PI + rand(-1.1, 1.1);
    Object.assign(o, { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy });
    A.phase = 'hit'; A.t = 2.4; A.hitBall = o; A.hitRuns = runs; A.hitMsg = msg; blip(runs >= 4 ? 1320 : 440); toast(msg);
  }
  function crOut(msg) { ACT.wkts++; crDone(0, msg, true); blip(200); }
  function crDone(runs, msg, out) {
    const A = ACT; A.runs += runs; A.balls++;
    if (A.phase !== 'hit' || out) toast(msg);
    A.phase = 'after'; A.t = 1.6;
    if (A.balls >= 6 || A.wkts >= 2) {
      const best = A.runs > cr.best; if (best) { cr.best = A.runs; try { localStorage.setItem('drive-cricket', String(A.runs)); } catch { /* not saved */ } }
      setTimeout(() => toast(`🏏 Over complete: ${A.runs} runs, ${A.wkts} wicket${A.wkts === 1 ? '' : 's'}${best ? ' — your best!' : ''}`), 1200);
      quitAct(true);
    }
  }

  // ---------- 🏸 Beach badminton ----------
  {
    const sand = mat(0xead9a6, { roughness: 1 });
    add(new THREE.CircleGeometry(13, 40), sand, BD.x, 0.03, BD.z, scene, false).rotation.x = -Math.PI / 2;
    const court = add(new THREE.PlaneGeometry(6.1, 13.4), field(6.1, 13.4, (g, W, H) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, H); g.strokeStyle = '#1c7ed6'; g.lineWidth = 5; g.strokeRect(3, 3, W - 6, H - 6); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 3); g.lineTo(W / 2, H - 3); g.stroke(); }, 128), BD.x, 0.04, BD.z, scene, false);
    court.material.transparent = true; court.rotation.order = 'YXZ'; court.rotation.set(-Math.PI / 2, Math.atan2(BD.ux, BD.uz), 0);
    for (const s of [-1, 1]) { const px = BD.x + BD.vx * 3.35 * s, pz = BD.z + BD.vz * 3.35 * s; add(new THREE.CylinderGeometry(0.04, 0.04, 1.55, 6), mat(0xffffff), px, 0.78, pz); colliders.push({ x: px, z: pz, r: 0.12 }); }
    const net = add(new THREE.PlaneGeometry(6.7, 0.76, 20, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.6 }), BD.x, 1.17, BD.z, scene, false);
    net.rotation.y = Math.atan2(BD.vx, BD.vz) + Math.PI / 2;
  }
  const shuttleMesh = (() => { const g = new THREE.Group(); add(new THREE.SphereGeometry(0.04, 8, 6), mat(0xf8f9fa), 0, 0, 0, g, false); add(new THREE.ConeGeometry(0.06, 0.12, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 0, 0.07, 0, g, false); scene.add(g); return g; })();
  shuttleMesh.position.set(BD.x, 0.05, BD.z);
  const bdOpp = { h: sportsman(0xf76707, false), a: 4.5, b: 0, phase: 0 };
  const BDloc = (x, z) => ({ a: (x - BD.x) * BD.ux + (z - BD.z) * BD.uz, b: (x - BD.x) * BD.vx + (z - BD.z) * BD.vz });
  const BDw = (a, b) => ({ x: BD.x + BD.ux * a + BD.vx * b, z: BD.z + BD.uz * a + BD.vz * b });
  const racketGeo = new THREE.TorusGeometry(0.13, 0.012, 6, 16), racketMat = mat(0x212529); racketGeo.userData.shared = true;
  function makeRacket() { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), racketMat, 0, -0.22, 0, g, false); add(racketGeo, racketMat, 0, -0.55, 0, g, false); return g; }
  const bdOppRacket = makeRacket(); bdOppRacket.position.set(0, -0.62, 0); bdOpp.h.armR.add(bdOppRacket);
  function startBadminton() {
    S.h = Math.atan2(BD.ux, BD.uz);
    ACT = { type: 'badminton', noJump: true, me: 0, opp: 0, rally: 0, sh: null, serveT: 1.2, server: 'opp', racket: handProp(makeRacket()) };
    toast('🏸 First to 7! Move under the shuttle and press SPACE to hit it back.'); blip(660);
  }
  function bdLaunch(fromA, fromB, toSide) {
    const A = ACT, ta = toSide === 'me' ? rand(-6.2, -1.2) : rand(1.5, 6.2), tb = rand(-2.6, 2.6);
    A.sh = { a0: fromA, b0: fromB, a1: ta, b1: tb, s: 0, T: Math.max(0.85, 1.35 - A.rally * 0.03), to: toSide };
  }
  function bdPoint(winner) {
    const A = ACT; if (winner === 'me') A.me++; else A.opp++;
    toast(winner === 'me' ? `🏸 Your point! ${A.me} – ${A.opp}` : `🏸 Ravi's point. ${A.me} – ${A.opp}`); blip(winner === 'me' ? 1046 : 330);
    A.sh = null; A.rally = 0; A.server = winner; A.serveT = 1.4;
    if (A.me >= 7 || A.opp >= 7) { setTimeout(() => toast(A.me >= 7 ? `🏸 You win the game ${A.me} – ${A.opp}! 🎉` : `🏸 Ravi wins ${A.opp} – ${A.me}. Rematch?`), 900); quitAct(true); }
  }
  function updateBadminton(dt) {
    const A = ACT, me = BDloc(S.x, S.z);
    if (me.a > -0.4 || me.a < -8.5 || Math.abs(me.b) > 4.5) {                       // stay on your half
      const p = BDw(clamp(me.a, -8.5, -0.4), clamp(me.b, -4.5, 4.5)); S.x = p.x; S.z = p.z;
    }
    const swing = keys.brake && !swingHeld; swingHeld = keys.brake;
    if (swing) { A.swingAnim = 0.3; blip(260); }
    const h = model.userData.h;
    if (h && A.swingAnim > 0) { A.swingAnim -= dt; h.armR.rotation.x = -2.8 + (1 - A.swingAnim / 0.3) * 1.6; }
    else if (h) h.armR.rotation.x = -1.2;
    if (!A.sh) {
      if ((A.serveT -= dt) <= 0) { if (A.server === 'opp') bdLaunch(4.5, bdOpp.b, 'me'); else if (swing) bdLaunch(me.a, me.b, 'opp'); }
      if (A.server === 'me') shuttleMesh.position.set(S.x + Math.sin(S.h) * 0.4, 1.3, S.z + Math.cos(S.h) * 0.4);
    } else {
      const sh = A.sh; sh.s += dt / sh.T;
      const a = sh.a0 + (sh.a1 - sh.a0) * sh.s, b = sh.b0 + (sh.b1 - sh.b0) * sh.s, y = 2.2 * (1 - sh.s) + 4.2 * 4 * sh.s * (1 - sh.s) * 0.5 + 0.05;
      const w = BDw(a, b); shuttleMesh.position.set(w.x, y, w.z); shuttleMesh.lookAt(BDw(sh.a1, sh.b1).x, 0, BDw(sh.a1, sh.b1).z);
      if (sh.to === 'me') {
        if (swing && sh.s > 0.5 && y < 3.2 && Math.hypot(a - me.a, b - me.b) < 1.8) { A.rally++; blip(880); bdLaunch(me.a, me.b, 'opp'); }
        else if (sh.s >= 1) bdPoint('opp');
      } else {
        // Ravi runs to where it's landing and usually gets it back
        if (!sh.decided) { sh.decided = true; sh.miss = Math.random() < 0.05 + A.rally * 0.03; }
        const da = sh.a1 - bdOpp.a, db = sh.b1 - bdOpp.b, d = Math.hypot(da, db);
        if (d > 0.4 && !sh.miss) { bdOpp.a += da / d * 4.5 * dt; bdOpp.b += db / d * 4.5 * dt; bdOpp.phase += dt * 10; }
        if (sh.s >= 0.85 && !sh.miss) { A.rally++; blip(760); bdOppRacket.rotation.x = -1; bdLaunch(sh.a1, sh.b1, 'me'); }
        else if (sh.s >= 1) bdPoint('me');
      }
    }
    setActPill(`🏸 You ${A.me} – ${A.opp} Ravi · rally ${A.rally} · SPACE to hit`);
  }
  function updateBdOpp(dt) {
    if (!ACT || ACT.type !== 'badminton') { bdOpp.a += (4.5 - bdOpp.a) * dt; bdOpp.b += (Math.sin(performance.now() / 2000) * 1.5 - bdOpp.b) * dt; }
    const p = BDw(bdOpp.a, bdOpp.b); bdOpp.h.g.position.set(p.x, 0, p.z); bdOpp.h.g.rotation.y = Math.atan2(-BD.ux, -BD.uz);
    poseHuman(bdOpp.h, bdOpp.phase, ACT && ACT.type === 'badminton' ? 0.5 : 0); bdOpp.h.armR.rotation.x = -1.4;
    bdOppRacket.rotation.x += (0 - bdOppRacket.rotation.x) * Math.min(1, dt * 5);
  }

  // ---------- 💪 Outdoor gym ----------
  add(new THREE.PlaneGeometry(26, 18), mat(0x343a40, { roughness: 1 }), GY.x, 0.03, GY.z, scene, false).rotation.x = -Math.PI / 2;
  const gymM = mat(0x495057, { metalness: 0.6, roughness: 0.4 }), padM = mat(0x1c7ed6, { roughness: 0.7 }), plateM = mat(0x111111, { roughness: 0.5 });
  const station = (name, ox, oz, face, build, anim) => { const g = new THREE.Group(); g.position.set(GY.x + ox, 0, GY.z + oz); g.rotation.y = face; scene.add(g); build(g); return { name, x: GY.x + ox, z: GY.z + oz, face, g, anim }; };
  const stations = [
    station('Treadmill', -8, -4, 0, (g) => { add(new THREE.BoxGeometry(0.9, 0.18, 2.1), gymM, 0, 0.09, 0, g); add(new THREE.BoxGeometry(0.75, 0.02, 1.9), plateM, 0, 0.19, 0, g, false); for (const s of [-0.4, 0.4]) add(new THREE.BoxGeometry(0.05, 1.2, 0.05), gymM, s, 0.75, 0.95, g, false); add(new THREE.BoxGeometry(0.85, 0.3, 0.12), padM, 0, 1.35, 0.95, g, false); }, 'run'),
    station('Bench press', -2, -4, 0, (g) => { add(new THREE.BoxGeometry(0.4, 0.45, 1.5), padM, 0, 0.32, 0, g); for (const s of [-0.6, 0.6]) add(new THREE.BoxGeometry(0.06, 1.2, 0.06), gymM, s, 0.6, -0.55, g, false); const bar = new THREE.Group(); bar.position.set(0, 1.15, -0.55); g.add(bar); add(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 8).rotateZ(Math.PI / 2), gymM, 0, 0, 0, bar, false); for (const s of [-0.75, 0.75]) add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16).rotateZ(Math.PI / 2), plateM, s, 0, 0, bar, false); g.userData.bar = bar; }, 'bench'),
    station('Pull-up bar', 4, -4, 0, (g) => { for (const s of [-0.7, 0.7]) add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), gymM, s, 1.3, 0, g); add(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8).rotateZ(Math.PI / 2), gymM, 0, 2.55, 0, g, false); }, 'pullup'),
    station('Dumbbells', -4, 4, Math.PI, (g) => { add(new THREE.BoxGeometry(1.6, 0.7, 0.4), gymM, 0, 0.35, -0.6, g); for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10).rotateZ(Math.PI / 2), plateM, -0.6 + i * 0.3, 0.75, -0.6, g, false); }, 'curl'),
  ];
  for (const s of stations) colliders.push({ x: s.x, z: s.z, r: 0.5 });
  const treadmill2 = station('Treadmill', -8, 4, Math.PI, (g) => { add(new THREE.BoxGeometry(0.9, 0.18, 2.1), gymM, 0, 0.09, 0, g); add(new THREE.BoxGeometry(0.75, 0.02, 1.9), plateM, 0, 0.19, 0, g, false); add(new THREE.BoxGeometry(0.85, 0.3, 0.12), padM, 0, 1.35, 0.95, g, false); }, 'run');
  const gymBots = [
    { h: sportsman(0xe64980, false), st: treadmill2 },
    { h: sportsman(0x2b8a3e, false), st: { x: GY.x + 1, z: GY.z + 4.6, face: Math.PI, anim: 'curl' }, db: true },
    { h: sportsman(0x364fc7, false), st: { x: GY.x + 7.5, z: GY.z - 4, face: 0, anim: 'pushup' } },
  ];
  for (const b of gymBots) { b.holder = new THREE.Group(); botsGroup.add(b.holder); b.holder.add(b.h.g); b.holder.position.set(b.st.x, 0, b.st.z); b.holder.rotation.y = b.st.face; b.seed = Math.random() * 10; }
  const dbGeo = new THREE.Group(); add(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6).rotateZ(Math.PI / 2), gymM, 0, 0, 0, dbGeo, false); for (const s of [-0.1, 0.1]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2), plateM, s, 0, 0, dbGeo, false);
  dbGeo.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; });
  for (const b of gymBots) if (b.db) for (const arm of [b.h.armL, b.h.armR]) { const d = dbGeo.clone(); d.position.y = -0.64; arm.add(d); }
  colliders.push({ x: gymBots[0].st.x, z: gymBots[0].st.z, r: 0.5 });
  function poseExercise(h, kind, t, g) {
    h.g.position.set(0, 0, 0); h.g.rotation.set(0, 0, 0); h.upper.rotation.set(0, 0, 0);
    if (kind === 'run') { h.g.position.y = 0.2; poseHuman(h, t * 11, 0.95); }
    else if (kind === 'curl') { poseHuman(h, 0, 0); h.armL.rotation.x = -0.4 - Math.max(0, Math.sin(t * 3)) * 1.9; h.armR.rotation.x = -0.4 - Math.max(0, -Math.sin(t * 3)) * 1.9; }
    else if (kind === 'pullup') { poseHuman(h, 0, 0); const k = Math.max(0, Math.sin(t * 2.4)); h.armL.rotation.x = h.armR.rotation.x = -3.0 + k * 0.6; h.g.position.y = 0.25 + k * 0.5; h.legL.rotation.x = h.legR.rotation.x = -0.2; }
    else if (kind === 'bench') { poseHuman(h, 0, 0); h.g.rotation.set(-Math.PI / 2, 0, 0); h.g.position.set(0, 0.6, -0.55); const k = 0.5 + 0.5 * Math.sin(t * 2.6); h.armL.rotation.x = h.armR.rotation.x = -1.5 - k * 0.15; h.legL.rotation.x = h.legR.rotation.x = 1.3; if (g && g.userData.bar) g.userData.bar.position.y = 0.95 + k * 0.35; }
    else if (kind === 'pushup') { poseHuman(h, 0, 0); const k = 0.5 + 0.5 * Math.sin(t * 3); h.g.rotation.set(Math.PI / 2 - 0.15, 0, 0); h.g.position.y = 0.25 + k * 0.25; h.armL.rotation.x = h.armR.rotation.x = -Math.PI / 2 - 0.2; }
  }
  function startGym(st) {
    ACT = { type: 'gym', lock: true, st, t: 0, reps: 0, props: [] };
    if (st.anim === 'curl') for (const arm of ['armL', 'armR']) { const d = dbGeo.clone(); d.position.y = -0.64; model.userData.h[arm].add(d); ACT.props.push(d); }
    toast(`💪 ${st.name}… keep going!`); blip(660);
  }
  function updateGym(dt) {
    const A = ACT, st = A.st, h = model.userData.h;
    const off = st.anim === 'run' ? 0 : st.anim === 'bench' ? 0 : st.anim === 'pullup' ? 0 : 0.9;
    Object.assign(S, { x: st.x + Math.sin(st.face) * off, z: st.z + Math.cos(st.face) * off, h: st.face + (st.anim === 'curl' ? Math.PI : 0) });
    A.t += dt;
    pinPlayer(); if (h) poseExercise(h, st.anim, A.t, st.g);
    const reps = Math.floor(A.t * (st.anim === 'run' ? 2 : 0.45));
    if (reps > A.reps) { A.reps = reps; blip(500 + reps * 20); }
    setActPill(`💪 ${st.name} · ${st.anim === 'run' ? Math.round(A.t * 3) + ' m' : A.reps + ' reps'}`);
    if (A.t > 7) {
      const gain = LIFE.hp < 100 ? Math.min(8, 100 - LIFE.hp) : 0; LIFE.hp += gain; saveLife(); updateLifeHud();
      toast(`💪 ${st.name} done — ${st.anim === 'run' ? Math.round(A.t * 3) + ' m run' : A.reps + ' reps'}! ${gain ? `+${gain} health` : 'Feeling strong!'}`);
      quitAct(true);
    }
  }
  function updateGymBots(t) { for (const b of gymBots) poseExercise(b.h, b.st.anim, t + b.seed); }

  // ---------- joining, leaving and keys ----------
  const JOINS = [
    { type: 'cricket', x: CK.x + 9.3, z: CK.z, r: 3, label: 'bat for one over 🏏', go: startCricket },
    { type: 'badminton', test: () => { const p = BDloc(S.x, S.z); return p.a < -0.5 && p.a > -7 && Math.abs(p.b) < 3.4; }, label: 'play beach badminton 🏸', go: startBadminton },
    ...stations.map((st) => ({ type: 'gym', x: st.x + Math.sin(st.face) * (st.anim === 'curl' ? 0.9 : 0), z: st.z + Math.cos(st.face) * (st.anim === 'curl' ? 0.9 : 0), r: 1.6, label: `use the ${st.name.toLowerCase()} 💪`, go: () => startGym(st) })),
  ];
  function quitAct(quiet) {
    if (!ACT) return;
    const A = ACT; ACT = null;
    for (const p of [A.bat, A.racket, ...(A.props || [])]) dropProp(p);
    const h = model && model.userData.h; if (h) { h.g.position.set(0, 0, 0); h.g.rotation.set(0, 0, 0); h.upper.rotation.set(0, 0, 0); }
    if (A.type === 'cricket') { cr.mesh.position.set(CK.x - 10, 0.07, CK.z); cr.bowler.x = CK.x - 15; }
    if (A.type === 'badminton') shuttleMesh.position.set(BD.x, 0.05, BD.z);
    setActPill(null);
    if (!quiet) toast('Stopped playing.');
  }
  function actKey(code) {
    if (!started || panelOpen || garageOpen || sheetOpen) return false;
    if (code === 'Enter' && JOB && serveCustomer()) return true;
    if (code === 'Escape' && ACT) { quitAct(); return true; }
    if (code === 'Enter') {
      if (ACT && ACT.type === 'cricket') { crSwing(); return true; }
      if (ACT) return true;
      if (bb.state === 'held') { bbShoot(); return true; }
      if (nearAct && !nearShop && !nearZone) { nearAct.go(); return true; }
    }
    return false;
  }
  $('#prompt').addEventListener('click', () => { if (JOB && serveCustomer()) return; if (!nearShop && !nearZone) { if (bb.state === 'held') bbShoot(); else if (nearAct && !ACT) nearAct.go(); } });

  // ---------- ball & frisbee: hold T (or THROW) to charge, release to throw — your dog fetches ----------
  const TOYM = {
    frisbee: (() => { const g = new THREE.Group(); add(new THREE.CylinderGeometry(0.16, 0.14, 0.035, 20), mat(0xe64980, { roughness: 0.4 }), 0, 0, 0, g, false); add(new THREE.TorusGeometry(0.155, 0.015, 6, 20).rotateX(Math.PI / 2), mat(0xfcc2d7), 0, 0, 0, g, false); g.visible = false; scene.add(g); return g; })(),
    ball: (() => { const m = add(new THREE.SphereGeometry(0.09, 14, 10), mat(0xc0eb75, { roughness: 0.6 }), 0, 0, 0, scene, false); m.visible = false; return m; })(),
  };
  let thrown = null, throwSel = null, charging = false, charge = 0, throwWarnT = 0;
  const throwKind = () => (throwSel && LIFE.bag[throwSel] > 0 ? throwSel : LIFE.bag.frisbee > 0 ? 'frisbee' : LIFE.bag.ball > 0 ? 'ball' : null);
  function selectThrowable(id) { throwSel = id; toast(`${ITEMS[id].e} ${ITEMS[id].n} ready — hold T (or THROW) to charge, release to throw.`); }
  function doThrow(kind, power) {
    const fx = Math.sin(S.h), fz = Math.cos(S.h), m = TOYM[kind];
    const v = kind === 'frisbee' ? 8 + power * 8 : 6 + power * 8.5;
    thrown = { kind, m, x: S.x + fx * 0.6, y: S.y + 1.6, z: S.z + fz * 0.6, vx: fx * v, vz: fz * v, vy: kind === 'frisbee' ? 1.4 + power * 0.6 : 3.5 + power * 2.5, state: 'air', t: 0 };
    m.visible = true;
    const h = model.userData.h; if (h) { h.armR.rotation.x = -2.2; }
    sfx(kind === 'frisbee' ? 'frisbee-throw' : 'ball-bounce', 0.6);
    if (pet.g && pet.kind === 'dog') { pet.fetch = { phase: 'chase' }; bark('dog-bark-happy'); }
    else if (pet.kind === 'cat') toast('🐱 Cats don’t fetch… go and grab it yourself.');
  }
  function updateThrow(dt) {
    const can = spec.human && started && !sheetOpen && !panelOpen && !garageOpen && !ACT && !JOB && !S.pose && !race && !underground;
    const pressing = !!keys.throw && can;
    const bar = $('#charge');
    if (pressing && !charging) {
      const kind = throwKind();
      if (!kind) { if ((throwWarnT -= dt) <= 0) { toast('🥏 Buy a ball or a frisbee at the TOYS stall to play fetch.'); throwWarnT = 3; } }
      else if (thrown) { if ((throwWarnT -= dt) <= 0) { toast(`${ITEMS[thrown.kind].e} It’s still out there — ${pet.kind === 'dog' ? 'your dog is on it!' : 'go and pick it up.'}`); throwWarnT = 3; } }
      else { charging = true; charge = 0; }
    }
    if (charging) {
      charge = Math.min(2, charge + dt);
      bar.classList.remove('hidden'); bar.querySelector('em').style.width = (charge / 2 * 100) + '%';
      const h = model.userData.h; if (h) h.armR.rotation.x = 0.6 + charge * 0.3;         // wind up
      if (!keys.throw || !can) { charging = false; bar.classList.add('hidden'); if (can) doThrow(throwKind(), charge / 2); }
    } else bar.classList.add('hidden');
    if (!thrown) return;
    const o = thrown; o.t += dt;
    if (o.state === 'air' || o.state === 'ground') {
      if (o.kind === 'frisbee') {
        if (o.state === 'air') {
          const c = Math.cos(0.18 * dt), s2 = Math.sin(0.18 * dt), vx = o.vx * c - o.vz * s2; o.vz = o.vx * s2 + o.vz * c; o.vx = vx;  // gentle curve
          o.vy -= 2.3 * dt; o.vx *= 1 - 0.08 * dt; o.vz *= 1 - 0.08 * dt;
        } else { o.vx *= 1 - 3 * dt; o.vz *= 1 - 3 * dt; }
        o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
        if (o.y <= 0.04) { o.y = 0.04; o.vy = 0; o.state = 'ground'; }
        o.m.rotation.y += dt * 18; o.m.rotation.x = o.state === 'air' ? 0.08 : 0;
      } else {
        o.vy -= 9.8 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
        if (o.y <= 0.09) { o.y = 0.09; if (Math.abs(o.vy) > 1.5) { o.vy = -o.vy * 0.55; o.vx *= 0.7; o.vz *= 0.7; sfx('ball-bounce', 0.35); } else { o.vy = 0; o.state = 'ground'; o.vx *= 1 - 2.5 * dt; o.vz *= 1 - 2.5 * dt; } }
        o.m.rotation.x += o.vz * dt / 0.09; o.m.rotation.z -= o.vx * dt / 0.09;
      }
      const r = Math.hypot(o.x, o.z); if (r > shoreAt(o.x, o.z) + 12) { o.vx *= -0.3; o.vz *= -0.3; }
      // no dog fetching? walk over to it and you pick it up
      if (o.state === 'ground' && !(pet.fetch && pet.g && pet.g.visible) && Math.hypot(S.x - o.x, S.z - o.z) < 1.3) { o.m.visible = false; thrown = null; blip(660); return; }
    } else if (o.state === 'dog') {
      const s3 = 1; o.x = pet.x + Math.sin(pet.h) * 0.48 * s3; o.z = pet.z + Math.cos(pet.h) * 0.48 * s3; o.y = 0.62 + (pet.y || 0);
    }
    o.m.position.set(o.x, o.y, o.z);
  }
  function fetchStep(dt) {   // returns the dog's running speed this frame
    const o = thrown, F = pet.fetch;
    if (!o || !pet.g || !pet.g.visible) { pet.fetch = null; return 0; }
    pet.y = Math.max(0, (pet.y || 0) - dt * 3);
    if (F.phase === 'chase') {
      const dx = o.x - pet.x, dz = o.z - pet.z, d = Math.hypot(dx, dz);
      if (d > 0.4) { const v = Math.min(9.5, d * 4); pet.x += dx / d * v * dt; pet.z += dz / d * v * dt; pet.h = lerpAngle(pet.h, Math.atan2(dx, dz), dt * 10); }
      if (o.state === 'air' && d < 1.1 && o.y < 1.8) { o.state = 'dog'; F.phase = 'return'; pet.y = 0.6; bark('dog-bark-happy'); toast('🐶 What a catch!'); }
      else if (o.state === 'ground' && d < 0.7) { o.state = 'dog'; F.phase = 'return'; bark('dog-bark-1'); }
      return d > 0.4 ? 9.5 : 0;
    }
    // bring it back and drop it at your feet
    const tx = S.x + Math.sin(S.h) * 1.1, tz = S.z + Math.cos(S.h) * 1.1, dx = tx - pet.x, dz = tz - pet.z, d = Math.hypot(dx, dz);
    if (d > 0.5) { const v = Math.min(8, d * 3); pet.x += dx / d * v * dt; pet.z += dz / d * v * dt; pet.h = lerpAngle(pet.h, Math.atan2(dx, dz), dt * 10); return v; }
    o.m.visible = false; thrown = null; pet.fetch = null;
    toast(`🐶 Your dog brings the ${ITEMS[o.kind].n.toLowerCase()} back — good boy! Throw again with T.`); bark('dog-bark-2');
    return 0;
  }

  function updateFun(dt, now) {
    const t = now / 1000, on = spec.human && !underground && started;
    // carried shopping bags disappear after a while
    for (const b of bots) if (b.carry && (b.carryT -= dt) <= 0) { b.h.armL.remove(b.carry); b.carry = null; }
    if (!on) { if (ACT) quitAct(true); if (JOB) endJob(); if (bb.state === 'held') bb.state = 'free'; setActPill(null); return; }
    fb.inside = bb.inside = false;
    updateThrow(dt);
    const near = (x, z, r = 140) => Math.hypot(S.x - x, S.z - z) < r;
    updateFlyers(t);
    if (near(FB.x, FB.z)) updateFootball(dt, t);
    if (near(BB.x, BB.z)) updateBasketball(dt, t);
    if (near(GY.x, GY.z)) updateGymBots(t);
    if (near(BD.x, BD.z)) updateBdOpp(dt);
    if (ACT) {
      if (race) quitAct(true);
      else if (ACT.type === 'cricket') { if ((keys.brake && !swingHeld)) crSwing(); swingHeld = keys.brake; crBall(dt, t); }
      else if (ACT.type === 'badminton') { const p = BDloc(S.x, S.z); if (p.a < -12 || Math.abs(p.b) > 8) quitAct(); else updateBadminton(dt); }
      else if (ACT.type === 'gym') updateGym(dt);
    } else if (!fb.inside && !bb.inside && !JOB) setActPill(null);
    updateJob(dt);
    // offer to join whatever you're standing next to
    nearAct = null;
    if (!ACT && !race && !S.pose) for (const j of JOINS) if (j.test ? j.test() : Math.hypot(S.x - j.x, S.z - j.z) < j.r) { nearAct = j; break; }
    const pr = $('#prompt');
    if (!nearShop && !nearZone && !panelOpen && !sheetOpen) {
      if (nearAct) { pr.textContent = isTouch ? `Tap here to ${nearAct.label}` : `Press Enter to ${nearAct.label}`; pr.classList.remove('hidden'); }
      else if (bb.state === 'held') { pr.textContent = isTouch ? 'Tap here to shoot 🏀' : 'Press Enter to shoot 🏀'; pr.classList.remove('hidden'); }
    }
  }
  function drawSportsMap(P, sc) {
    mg.fillStyle = '#2f9e44'; mg.fillRect(...P(FB.x - FB.L / 2, FB.z - FB.W / 2), FB.L * sc, FB.W * sc);
    mg.fillStyle = '#e8590c'; mg.fillRect(...P(BB.x - BB.W / 2, BB.z - BB.L / 2), BB.W * sc, BB.L * sc);
    mg.fillStyle = '#495057'; mg.fillRect(...P(GY.x - 13, GY.z - 9), 26 * sc, 18 * sc);
    mg.fillStyle = '#69db7c'; mg.beginPath(); mg.arc(...P(CK.x, CK.z), CK.R * sc, 0, 6.3); mg.fill();
    mg.fillStyle = '#ffd8a8'; mg.beginPath(); mg.arc(...P(BD.x, BD.z), 9 * sc, 0, 6.3); mg.fill();
  }


  function finishRace() {
    const r = race; r.done = true;
    // runners who haven't finished yet get an estimated time
    for (const q of r.rs) if (q.fin === null) r.finishers.push({ name: q.r.name, t: r.t + (r.target - q.dist) / q.base });
    r.finishers.sort((a, b) => a.t - b.t);
    const place = r.finishers.findIndex((f) => f.you) + 1, you = r.finishers[place - 1];
    const isBest = !bestRace[r.kind] || you.t < bestRace[r.kind];
    if (isBest) { bestRace[r.kind] = you.t; try { localStorage.setItem('drive-foot-race', JSON.stringify(bestRace)); } catch { /* not saved */ } }
    blip(place === 1 ? 1320 : 880);
    playLine(`race.place${place}`, place === 1 ? 'Amazing! You won the race!' : place <= 3 ? `Well run! You finished number ${place}.` : `You finished number ${place}. Better luck next time!`, voiceFor(hashStr('announcer'), false));
    holo.title = place === 1 ? '🏆 YOU WON!' : `🏁 YOU FINISHED ${['1ST', '2ND', '3RD', '4TH', '5TH'][place - 1]}`;
    holo.sub = `${r.kind === 'sprint' ? 'Sprint' : 'Full lap'} · ${fmtTime(you.t)}${isBest ? ' · new personal best!' : ''}`;
    holo.rows = r.finishers.slice(0, 5); holo.t = 14; holo.sp.visible = true;
    holo.sp.position.set(S.x + Math.sin(S.h) * 5.5, S.y + 2.4, S.z + Math.cos(S.h) * 5.5);
    $('#lap').textContent = `🏁 ${holo.title.replace(/^\S+ /, '')} · ${fmtTime(you.t)}`;
    raceAsked = true;                               // finishing at START won't pop the question again until you walk away
    race = null;                                    // the race is over: you're free to move straight away
    for (const q of r.rs) poseHuman(q.r.h, 0, 0);  // runners stop where they are and catch their breath
  }







  const START = { x: 0, z: 31, h: Math.PI };
  const S = { x: START.x, z: START.z, h: START.h, speed: 0, vx: 0, vz: 0, steer: 0, spin: 0, shake: 0, y: 0, vy: 0, onGround: true, air: 0, boostT: 0 };
  function resetCar() { try { quitAct(true); endJob(true); } catch { /* not built yet */ } if (typeof abortRace === 'function') abortRace(true); S.rescue = null; if (underground) leaveCave(true); Object.assign(S, { x: START.x, z: START.z, h: START.h, speed: 0, vx: 0, vz: 0, steer: 0, y: 0, vy: 0, onGround: true, air: 0, boostT: 0 }); }

  // ---------- Dust particles ----------
  const dust = [];
  const dustGeo = new THREE.SphereGeometry(0.35, 6, 6);
  for (let i = 0; i < 50; i++) {
    const m = new THREE.Mesh(dustGeo, new THREE.MeshBasicMaterial({ color: 0xe9e3d5, transparent: true, opacity: 0 }));
    m.visible = false; scene.add(m); dust.push({ m, life: 0 });
  }
  let dustIdx = 0, dustTimer = 0;
  function puff(x, z) {
    const p = dust[dustIdx++ % dust.length];
    p.life = 0.8; p.m.visible = true; p.m.position.set(x + rand(-0.3, 0.3), 0.3, z + rand(-0.3, 0.3)); p.m.scale.setScalar(1);
  }

  // ---------- Input ----------
  const keys = {};
  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right', KeyT: 'throw', ShiftLeft: 'boost', ShiftRight: 'boost', Space: 'brake' };
  let started = false, camMode = 0, garageOpen = false, fading = false, underground = false, caveT = 0;
  addEventListener('keydown', (e) => {
    if (!started) return;
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'KeyG') { garageOpen ? closeGarage() : openGarage(); return; }
    if (garageOpen) { if (e.code === 'Escape' || e.code === 'Enter') closeGarage(); return; }
    if (sheetOpen) { if (e.code === 'Escape' || e.code === 'KeyI') closeSheet(); return; }
    if (actKey(e.code)) return;
    if (e.code === 'KeyI') openBag();
    if (e.code === 'KeyL') cycleLights();
    if (e.code === 'KeyP') cyclePet();
    if (e.code === 'KeyK') toggleKite();
    if (e.code === 'KeyX') setPose('sit');
    if (e.code === 'KeyZ') setPose('lie');
    if (e.code === 'KeyN') skipTime();
    if (e.code === 'KeyE') nextSeason();
    if (e.code === 'KeyQ') cycleWeather();
    if (e.code === 'KeyR') resetCar();
    if (e.code === 'KeyC') cycleCam();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'Enter' && nearZone && !panelOpen) openPanel(nearZone);
    else if (e.code === 'Enter' && nearShop && !panelOpen) openNearShop();
    if (e.code === 'Escape') { if (panelOpen) closePanel(); else if (!$('#classic').classList.contains('hidden')) hideClassic(); }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  // mouse look: press and drag to look around — up/down (sky/ground) and left/right — the camera stays put
  const LOOK = { pitch: 0, target: 0, yaw: 0, yawTarget: 0, drag: false, x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (!started || e.button !== 0) return;
    LOOK.drag = true; LOOK.x = e.clientX; LOOK.y = e.clientY; canvas.setPointerCapture(e.pointerId); canvas.classList.add('looking');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!LOOK.drag) return;
    LOOK.target = clamp(LOOK.target - (e.clientY - LOOK.y) * 0.005, -1.1, 1.25); LOOK.y = e.clientY;
    LOOK.yawTarget = clamp(LOOK.yawTarget - (e.clientX - LOOK.x) * 0.005, -Math.PI, Math.PI); LOOK.x = e.clientX;
  });
  const endLook = () => { LOOK.drag = false; LOOK.target = 0; LOOK.yawTarget = 0; canvas.classList.remove('looking'); };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);

  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) {
    document.querySelectorAll('#touch button').forEach(b => {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); keys[k] = true; b.classList.add('on'); };
      const off = (e) => { e.preventDefault(); keys[k] = false; b.classList.remove('on'); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
      b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    $('#boostlbl').textContent = 'tap BOOST';
  }

  // ---------- Engine sound (Web Audio, no files) ----------
  let audio = null, muted = false;
  function startAudio() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); osc.type = 'sawtooth';
      const osc2 = ctx.createOscillator(); osc2.type = 'square';
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 500;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(filter); osc2.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc2.start();
      audio = { ctx, osc, osc2, gain, filter };
      if (ctx.state === 'suspended') { // started without a click on this page (came straight from the website): unlock on first input
        const resume = () => { ctx.resume(); removeEventListener('pointerdown', resume); removeEventListener('keydown', resume); };
        addEventListener('pointerdown', resume); addEventListener('keydown', resume);
      }
    } catch (e) { audio = null; }
  }
  function blip(freq) {
    if (!audio || muted) return;
    const { ctx } = audio, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; o.type = 'triangle'; g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.26);
  }
  function toggleMute() {
    muted = !muted; if (muted && window.speechSynthesis) speechSynthesis.cancel(); if (muted && typeof stopClip === 'function') stopClip(); if (muted && typeof stopNarr === 'function') stopNarr(); $('#btn-mute').textContent = 'Sound: ' + (muted ? 'off' : 'on');
  }

  // ---------- UI: panel, toast, overlays ----------
  let panelOpen = false, nearZone = null, toastTimer = 0;
  let stuntScore = 0, nextGate = 0, lapStart = null, bestLap = 0;
  try { bestLap = +localStorage.getItem('drive-best-lap') || 0; } catch { /* storage blocked */ }
  const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  function openPanel(z) {
    panelOpen = true; z.dismissed = true;
    $('#panel-title').textContent = z.title;
    $('#panel-bar').style.background = z.color;
    $('#panel').style.setProperty('--c', z.color);
    $('#panel-body').innerHTML = z.body;
    $('#panel').classList.add('open');
    $('#prompt').classList.add('hidden');
    if (!z.visited) { z.visited = true; updateCounters(); blip(660); }
    if (zones.every(q => q.visited) && !openPanel.allDone) {
      openPanel.allDone = true; toast('You explored every section — thanks for visiting!');
      setTimeout(() => toast('Psst… something hums beneath the west woods. Look for glowing runes after dark.'), 4500);
    }
  }
  function closePanel() { panelOpen = false; $('#panel').classList.remove('open'); }
  $('#panel-close').onclick = closePanel;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); toastTimer = 3; }
  function updateCounters() {
    $('#explored').textContent = `Explored ${zones.filter(z => z.visited).length}/${zones.length}`;
    $('#stars').textContent = `Stars ${starsTaken}/${N_STARS}` + (coreCrystal && coreCrystal.taken ? ' · ✦' : '');
    $('#stunts').textContent = `Stunts ${stuntScore}`;
  }
  updateCounters();
  $('#lap').textContent = bestLap ? `Best lap ${fmtTime(bestLap)}` : 'Lap: drive through START';
  gates[0].glow.emissiveIntensity = 1.6;

  function showClassic() { $('#classic').classList.remove('hidden'); }
  function hideClassic() { $('#classic').classList.add('hidden'); if (!started) $('#intro').classList.remove('hidden'); }
  function wireOverlays() {
    // both 'website' buttons are plain links to ../Portfolio now
    $('#btn-back').onclick = hideClassic;
  }
  wireOverlays();
  $('#btn-start').onclick = () => {
    started = true; $('#intro').classList.add('hidden');
    if (isTouch) $('#touch').classList.remove('hidden');
    startAudio();
    setTimeout(() => narrate('narrator.intro'), 900);
  };
  const CAM_NAMES = ['Chase', 'Isometric', 'Top-down', 'First person'];
  function cycleCam() { camMode = (camMode + 1) % 4; toast(`Camera: ${CAM_NAMES[camMode]}`); $('#btn-cam').textContent = `Camera: ${CAM_NAMES[camMode]}`; }
  $('#btn-cam').onclick = cycleCam;
  $('#btn-mute').onclick = toggleMute;

  // ---------- Seasons + weather (automatic; Season / Weather buttons override) ----------
  const SEASONS = [
    { key: 'spring', label: '🌸 Spring', msg: 'Spring — the blossoms are out.', grass: 0xeaffd9, snow: 0, ice: 0, dTop: 0x58a6ec, dBot: 0xdcefff, fog: 0xc9e8ff, fire: 0.5, petals: 1, leaves: 0, rain: 0.35 },
    { key: 'summer', label: '☀ Summer', msg: 'Summer — long, bright days.', grass: 0xffffff, snow: 0, ice: 0, dTop: 0x3b8de0, dBot: 0xcfeaff, fog: 0xbfe3ff, fire: 1, petals: 0, leaves: 0, rain: 0.15 },
    { key: 'autumn', label: '🍂 Autumn', msg: 'Autumn — the leaves are turning.', grass: 0xe2cf96, snow: 0, ice: 0, dTop: 0x6b9fd2, dBot: 0xf0e3d0, fog: 0xe2dccf, fire: 0.3, petals: 0, leaves: 1, rain: 0.45 },
    { key: 'winter', label: '❄ Winter', msg: 'Winter — snow, and the river has frozen.', grass: 0xffffff, snow: 0.88, ice: 1, dTop: 0x8fb0cf, dBot: 0xe8eef5, fog: 0xdde5ee, fire: 0, petals: 0, leaves: 0, rain: 0 },
  ];
  const SEASON_LEN = 240;                                         // one season per day/night cycle -> a 16-minute year
  let seasonIdx = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][new Date().getMonth()], seasonFrom = seasonIdx, seasonT = 1, seasonClock = 0;
  const SP = { grass: new THREE.Color(), dTop: new THREE.Color(), dBot: new THREE.Color(), fog: new THREE.Color(), snow: 0, ice: 0, fire: 1, petals: 0, leaves: 0 };
  const sCol = new THREE.Color(), sCol2 = new THREE.Color();

  // foliage colours per season (computed once; blended while a season changes)
  const SNOW = new THREE.Color(0xf1f5f9), TMPC = new THREE.Color();
  const hash1 = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  function seasonTint(kind, key, out, r) {
    if (key === 'summer') return kind === 'maple' ? out.set(r < 0.5 ? 0x4c9a3c : 0x5aa646) : out;
    if (key === 'spring') {
      if (kind === 'maple' || (kind === 'oak' && r < 0.22) || (kind === 'bush' && r < 0.1)) return out.set([0xf783ac, 0xfcc2d7, 0xfaa2c1, 0xffdeeb][Math.floor(r * 40) % 4]);
      return kind === 'pine' ? out.offsetHSL(0, 0, 0.04) : out.lerp(TMPC.set(0x9be36b), 0.35);
    }
    if (key === 'autumn') {
      if (kind === 'pine') return out.offsetHSL(0, -0.05, -0.02);
      if (kind === 'maple') return out;
      if (kind === 'birch') return out.set(r < 0.5 ? 0xfcc419 : 0xffd43b);
      if (kind === 'oak') return out.set([0xe8590c, 0xf59f00, 0xd9480f, 0xfab005, 0xb5651d][Math.floor(r * 50) % 5]);
      return out.lerp(TMPC.set(0xb5651d), 0.45);
    }
    return kind === 'pine' ? out.lerp(SNOW, 0.45) : out.lerp(TMPC.set(0x8d7b6a), 0.4).lerp(SNOW, 0.7);
  }
  for (const f of foliage) {
    const base = f.im.instanceColor.array.slice();
    f.targets = SEASONS.map((s) => {
      const out = new Float32Array(base.length);
      for (let i = 0; i < base.length / 3; i++) { TMPC.fromArray(base, i * 3); sCol.copy(TMPC); seasonTint(f.kind, s.key, sCol, hash1(i + f.kind.length * 1000)).toArray(out, i * 3); }
      return out;
    });
  }
  function paintFoliage(a, b, t) {
    for (const f of foliage) {
      const A = f.targets[a], B = f.targets[b], arr = f.im.instanceColor.array;
      for (let i = 0; i < arr.length; i++) arr[i] = A[i] + (B[i] - A[i]) * t;
      f.im.instanceColor.needsUpdate = true;
    }
  }
  paintFoliage(seasonIdx, seasonIdx, 1);
  function setSeason(i, quiet) {
    seasonFrom = seasonIdx; seasonIdx = (i + 4) % 4; seasonT = 0; seasonClock = 0;
    if (!quiet) toast(SEASONS[seasonIdx].msg);
    if (W.mode === 'auto') rollWeather(true);
  }
  const nextSeason = () => setSeason(seasonIdx + 1);

  // weather: rain (with thunder) or snow; it fades between states
  const W = { mode: 'auto', kind: 'clear', show: 'clear', amt: 0, target: 0, timer: 20, wet: 0, flash: 0, thunderT: 9 };
  function rollWeather(soon) {
    const s = SEASONS[seasonIdx], r = Math.random();
    W.kind = s.key === 'winter' ? (r < 0.7 ? 'snow' : 'clear') : (r < s.rain ? 'rain' : 'clear');
    W.target = W.kind === 'clear' ? 0 : rand(0.55, 1); W.timer = soon ? rand(30, 50) : rand(45, 80);
  }
  const WEATHER_MODES = ['auto', 'clear', 'rain', 'snow'];
  function cycleWeather() {
    W.mode = WEATHER_MODES[(WEATHER_MODES.indexOf(W.mode) + 1) % WEATHER_MODES.length];
    if (W.mode === 'auto') rollWeather(true); else { W.kind = W.mode; W.target = W.mode === 'clear' ? 0 : 1; }
    toast(W.mode === 'auto' ? 'Weather: automatic' : `Weather: ${W.mode}`);
  }
  const precip = (() => { // rain streaks / snowflakes in a box that wraps around the camera
    const N = 6000, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let k = 0; k < N; k++) { pos.set([rand(-60, 60), rand(0, 50), rand(-60, 60)], k * 3); seed[k] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uMode: { value: 0 }, uAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPR: { value: Math.min(devicePixelRatio, 2) }, uLight: { value: 1 } },
      vertexShader: `attribute float aSeed; uniform float uTime, uMode, uAmt, uPR; uniform vec3 uCam; varying float vA;
        void main(){
          vec3 p = position;
          float spd = uMode < 0.5 ? 34.0 + 10.0 * aSeed : 2.6 + 1.6 * aSeed;
          p.y = mod(p.y - uTime * spd, 50.0);
          if (uMode > 0.5) { p.x += sin(uTime * 0.9 + aSeed * 40.0) * 1.3; p.z += cos(uTime * 0.7 + aSeed * 30.0) * 1.3; }
          vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 60.0, 120.0) - 60.0, uCam.y - 18.0 + p.y, uCam.z + mod(p.z - uCam.z + 60.0, 120.0) - 60.0);
          vA = step(fract(aSeed * 13.7), uAmt);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_PointSize = clamp(uPR * (uMode < 0.5 ? 30.0 : 7.0) * (10.0 / max(-mv.z, 0.5)), 1.5, uMode < 0.5 ? 42.0 : 18.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uMode, uLight; varying float vA;
        void main(){
          if (vA < 0.5) discard;
          vec2 c = gl_PointCoord - 0.5; float a; vec3 col;
          if (uMode < 0.5) { if (abs(c.x) > 0.06) discard; a = (1.0 - abs(c.y) * 2.0) * 0.7; col = vec3(0.8, 0.86, 0.95); }
          else { float d = length(c); if (d > 0.5) discard; a = 1.0 - d * 2.0; col = vec3(1.0); }
          gl_FragColor = vec4(col * mix(0.35, 1.0, uLight), a);
        }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    return { pts, m };
  })();
  const drift = (() => { // spring petals / autumn leaves tumbling down
    const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let k = 0; k < N; k++) { pos.set([rand(-45, 45), rand(0, 26), rand(-45, 45)], k * 3); seed[k] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uPR: { value: Math.min(devicePixelRatio, 2) }, uLeaf: { value: 0 }, uLight: { value: 1 } },
      vertexShader: `attribute float aSeed; uniform float uTime, uAmt, uPR; uniform vec3 uCam; varying float vA; varying float vRot; varying float vS;
        void main(){
          vec3 p = position;
          p.y = mod(p.y - uTime * (1.1 + aSeed), 26.0);
          p.x += sin(uTime * 0.8 + aSeed * 50.0) * 2.0; p.z += cos(uTime * 0.6 + aSeed * 37.0) * 2.0;
          vec3 w = vec3(uCam.x + mod(p.x - uCam.x + 45.0, 90.0) - 45.0, p.y, uCam.z + mod(p.z - uCam.z + 45.0, 90.0) - 45.0);
          vA = step(fract(aSeed * 7.31), uAmt); vRot = uTime * (1.5 + aSeed * 3.0) + aSeed * 20.0; vS = fract(aSeed * 91.3);
          vec4 mv = viewMatrix * vec4(w, 1.0);
          gl_PointSize = clamp(uPR * 9.0 * (10.0 / max(-mv.z, 0.5)), 1.5, 22.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform float uLeaf, uLight; varying float vA; varying float vRot; varying float vS;
        void main(){
          if (vA < 0.5) discard;
          vec2 c = gl_PointCoord - 0.5; float s = sin(vRot), co = cos(vRot);
          c = mat2(co, -s, s, co) * c; c.x *= 2.2 * (0.6 + 0.4 * abs(sin(vRot * 0.7)));
          if (length(c) > 0.5) discard;
          vec3 petal = mix(vec3(1.0, 0.75, 0.86), vec3(1.0, 0.92, 0.95), vS);
          vec3 leaf = mix(vec3(0.91, 0.35, 0.05), vec3(0.98, 0.69, 0.13), vS);
          gl_FragColor = vec4(mix(petal, leaf, uLeaf) * mix(0.3, 1.0, uLight), 0.95);
        }`,
    });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts);
    return { pts, m };
  })();
  // rain hiss + thunder (Web Audio noise, created on first use)
  let noiseBuf = null;
  function getNoise() {
    if (!noiseBuf && audio) {
      noiseBuf = audio.ctx.createBuffer(1, audio.ctx.sampleRate * 2, audio.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function thunder() {
    if (!audio || muted || underground || !getNoise()) return;
    const { ctx } = audio, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 140; g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.08); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.8);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(); src.stop(ctx.currentTime + 2.9);
  }
  const baseRoad = new THREE.Color(0x3d4250), wetRoad = new THREE.Color(0x2a2e38), snowRoad = new THREE.Color(0x5b616e);
  const OVER_RAIN = new THREE.Color(0x9aa3ad), OVER_SNOW = new THREE.Color(0xd6dce3);
  function updateSeasons(dt, now) {
    const t = now / 1000;
    // the calendar
    if (warpTo === null) { seasonClock += dt; if (seasonClock > SEASON_LEN) nextSeason(); }
    if (seasonT < 1) { seasonT = Math.min(1, seasonT + dt / 5); paintFoliage(seasonFrom, seasonIdx, smooth(0, 1, seasonT)); }
    const k = smooth(0, 1, seasonT), A = SEASONS[seasonFrom], B = SEASONS[seasonIdx];
    const mixN = (key) => A[key] + (B[key] - A[key]) * k, mixC = (out, key) => out.set(A[key]).lerp(sCol2.set(B[key]), k);
    mixC(SP.grass, 'grass'); mixC(SP.dTop, 'dTop'); mixC(SP.dBot, 'dBot'); mixC(SP.fog, 'fog');
    for (const key of ['snow', 'ice', 'fire', 'petals', 'leaves']) SP[key] = mixN(key);
    groundUni.uSnow.value = SP.snow; groundUni.uTint.value.copy(SP.grass);
    for (const q of snowables) q.m.color.copy(q.base).lerp(SNOW, SP.snow * 0.85);
    sandMat.color.set(0xead9a6).lerp(SNOW, SP.snow * 0.8);
    flowers.visible = SP.snow < 0.4;
    FOUNTAIN.jets.visible = SP.ice < 0.5;

    // weather state machine
    if (W.mode === 'auto' && (W.timer -= dt) <= 0) rollWeather();
    if (W.show !== W.kind && W.amt > 0.02) W.amt = Math.max(0, W.amt - dt / 3);
    else { W.show = W.kind; W.amt += clamp(W.target - W.amt, -dt / 2.5, dt / 2.5); }
    W.wet += ((W.show === 'rain' ? W.amt : 0) - W.wet) * Math.min(1, dt / (W.show === 'rain' ? 3 : 12));
    const out = !underground;
    precip.pts.visible = out && W.show !== 'clear' && W.amt > 0.01;
    precip.m.uniforms.uMode.value = W.show === 'snow' ? 1 : 0; precip.m.uniforms.uAmt.value = W.amt;
    precip.m.uniforms.uTime.value = t; precip.m.uniforms.uCam.value.copy(camera.position);
    precip.m.uniforms.uLight.value = 1 - 0.65 * DN.night;
    const dAmt = Math.max(SP.petals, SP.leaves) * (W.show === 'rain' ? 1 - W.amt * 0.7 : 1);
    drift.pts.visible = out && dAmt > 0.01;
    drift.m.uniforms.uAmt.value = dAmt * 0.8; drift.m.uniforms.uLeaf.value = SP.leaves > SP.petals ? 1 : 0;
    drift.m.uniforms.uTime.value = t; drift.m.uniforms.uCam.value.copy(camera.position); drift.m.uniforms.uLight.value = 1 - 0.7 * DN.night;
    // wet / snowy roads
    roadMat.color.copy(baseRoad).lerp(snowRoad, SP.snow * 0.5).lerp(wetRoad, W.wet * 0.8);
    roadMat.roughness = 0.95 - W.wet * 0.6; roadMat.metalness = W.wet * 0.25;
    // thunder in heavy rain
    if (out && W.show === 'rain' && W.amt > 0.6 && (W.thunderT -= dt) <= 0) {
      W.thunderT = rand(7, 18); W.flash = 1; setTimeout(thunder, rand(250, 1200));
    }
    W.flash = Math.max(0, W.flash - dt * 2.5);
    if (audio) {
      if (!audio.rain && getNoise()) {
        const src = audio.ctx.createBufferSource(), f = audio.ctx.createBiquadFilter(), g = audio.ctx.createGain();
        src.buffer = noiseBuf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.4; g.gain.value = 0;
        src.connect(f); f.connect(g); g.connect(audio.ctx.destination); src.start(); audio.rain = g;
      }
      if (audio.rain) audio.rain.gain.setTargetAtTime(muted || !started || !out ? 0 : (W.show === 'rain' ? W.amt * 0.07 : 0), audio.ctx.currentTime, 0.4);
    }
    const sb = $('#btn-season'), wb = $('#btn-weather');
    if (sb.textContent !== B.label) sb.textContent = B.label;
    const wl = W.mode === 'auto' ? `Weather: auto${W.show !== 'clear' && W.amt > 0.1 ? ' · ' + W.show : ''}` : `Weather: ${W.mode}`;
    if (wb.textContent !== wl) wb.textContent = wl;
  }
  const overcast = () => (W.show === 'clear' ? 0 : W.amt * (W.show === 'rain' ? 0.85 : 0.6));

  // ---------- Going underground (fade, teleport, swap the environment) ----------
  function fadeThrough(fn) {
    fading = true; $('#fade').classList.add('on');
    setTimeout(() => { fn(); snapCamera(); setTimeout(() => { $('#fade').classList.remove('on'); fading = false; }, 120); }, 520);
  }
  function setUnderground(on) {
    underground = on; cave.visible = on; skyGroup.visible = !on; fireflies.pts.visible = !on; caveT = 0;
    closePanel();
  }
  function enterCave() {
    blip(90);
    fadeThrough(() => {
      setUnderground(true);
      Object.assign(S, { x: UG.x, z: UG.z + 5, h: 0, speed: Math.min(Math.abs(S.speed), 10), vx: 0, vz: 0, y: 0, vy: 0, onGround: true, air: 0, boostT: 0 });
      let first = true; try { first = !localStorage.getItem('drive-core-found'); localStorage.setItem('drive-core-found', '1'); } catch { /* fine */ }
      toast(first ? 'You found THE CORE — a secret lab of where it all started.' : 'Back in THE CORE. The light behind you is the way out.');
      if (first) setTimeout(() => narrate('narrator.caveFound'), 900);
    });
  }
  function leaveCave(instant) {
    const out = () => {
      setUnderground(false);
      Object.assign(S, { x: CAVE.exit.x, z: CAVE.exit.z, h: CAVE.h, speed: instant ? 0 : 8, vx: 0, vz: 0, y: 0, vy: 0, onGround: true, air: 0, boostT: 0 });
      if (!instant) toast('Back in the daylight… or moonlight.');
    };
    if (instant) out(); else fadeThrough(out);
  }
  function camCeiling() { return underground ? (inCavern() ? 26 : TUN_R - 0.3) : Infinity; }

  // ---------- Garage UI ----------
  const SWATCHES = ['#5b5cf6', '#7c3aed', '#ec4899', '#e03131', '#f59f00', '#82c91e', '#0ca678', '#1e1b4b', '#f1f3f5'];
  const STAT = (k) => { const v = { speed: (s) => s.boostMax / 54, accel: (s) => s.acc / 27, handling: (s) => (s.turn - 1.6) / 1.0, air: (s) => s.air / 0.6 }; return v[k]; };
  function renderGarage() {
    $('#g-cars').innerHTML = Object.entries(MODELS).map(([k, m]) =>
      `<button class="g-car${k === carKind ? ' on' : ''}" data-kind="${k}"><b>${m.name}</b><span>${m.blurb}</span></button>`).join('');
    const sp = MODELS[carKind].spec;
    $('#g-stats').innerHTML = [['Top speed', 'speed'], ['Acceleration', 'accel'], ['Handling', 'handling'], ['Air control', 'air']].map(([l, k]) =>
      `<div><span>${l}</span><i><em style="width:${Math.round(clamp(STAT(k)(sp), 0.1, 1) * 100)}%"></em></i></div>`).join('');
    $('#g-pets').innerHTML = [['none', '🚫', 'No pet'], ['dog', '🐶', 'Dog'], ['cat', '🐱', 'Cat']].map(([k, e, n]) => `<button class="g-pet${k === petKind ? ' on' : ''}" data-pet="${k}">${e} ${n}</button>`).join('');
    $('#g-pets').querySelectorAll('button').forEach(b => { b.onclick = () => { setPet(b.dataset.pet); renderGarage(); }; });
    $('#g-colors').innerHTML = SWATCHES.map(c => `<button class="sw${c === carColor ? ' on' : ''}" data-c="${c}" style="background:${c}" aria-label="Paint ${c}"></button>`).join('') +
      `<label class="sw pick" title="Custom colour"><input type="color" id="g-pick" value="${carColor}"></label>`;
    $('#g-cars').querySelectorAll('button').forEach(b => { b.onclick = () => { setCar(b.dataset.kind, carColor); renderGarage(); blip(520); }; });
    $('#g-colors').querySelectorAll('button').forEach(b => { b.onclick = () => { setCar(carKind, b.dataset.c); renderGarage(); }; });
    $('#g-pick').oninput = (e) => { paint.color.set(e.target.value); paint.emissive.set(e.target.value).multiplyScalar(0.35); carColor = e.target.value; };
    $('#g-pick').onchange = (e) => { setCar(carKind, e.target.value); renderGarage(); };
  }
  function openGarage() { if (!started) return; garageOpen = true; closePanel(); renderGarage(); $('#garage').classList.remove('hidden'); document.body.classList.add('garage'); for (const k in keys) keys[k] = false; }
  function closeGarage() { garageOpen = false; $('#garage').classList.add('hidden'); document.body.classList.remove('garage'); }
  $('#btn-garage').onclick = openGarage;
  $('#g-done').onclick = closeGarage;

  // ---------- Day / night cycle (automatic; ☀/🌙 button fast-forwards) ----------
  const CYCLE = 240, DAY_PART = 0.6;          // 4-minute day: 60% daylight, 40% night
  let dayClock = CYCLE * 0.08, warpTo = null;
  const DN = { night: 0, light: new THREE.Vector3(0.45, 0.8, 0.3) };
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const C = (h) => new THREE.Color(h);
  const COL = { daySky: C(SKY), dusk: C(0xf3a77c), nightFog: C(0x0b1024), caveFog: C(0x07050e), sunHi: C(0xfff1d6), sunLo: C(0xffa266), moon: C(0x9fb4ff),
    hemiDay: C(0xdcefff), hemiNight: C(0x46598f), gndDay: C(0x4a6b34), gndNight: C(0x0e1424), hemiCave: C(0x8a74c8), gndCave: C(0x1a1426),
    wSkyDay: C(0xbfe0ff), wSkyNight: C(0x1c2550) };
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), tmpCol = new THREE.Color();
  function skipTime() {
    const p = dayClock / CYCLE;
    warpTo = DN.night > 0.5 ? 0.015 : DAY_PART + 0.06; if (warpTo < p) warpTo += 1;
    warpTo *= CYCLE;
  }
  function updateDayNight(dt, now) {
    if (warpTo !== null) {
      const stepT = Math.min(dt * CYCLE / 2.6, warpTo - dayClock);
      dayClock += stepT; if (dayClock >= warpTo - 1e-3) { warpTo = null; }
      if (dayClock >= CYCLE) { dayClock -= CYCLE; if (warpTo !== null) warpTo -= CYCLE; }
    } else dayClock = (dayClock + dt) % CYCLE;
    const p = dayClock / CYCLE;
    const ang = p < DAY_PART ? (p / DAY_PART) * Math.PI : Math.PI + ((p - DAY_PART) / (1 - DAY_PART)) * Math.PI;
    sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize(); moonDir.copy(sunDir).negate();
    const night = 1 - smooth(-0.1, 0.1, sunDir.y), twilight = (1 - smooth(0.0, 0.35, Math.abs(sunDir.y))) * (1 - night * 0.6);
    DN.night = night;

    // key light: the sun by day, the moon by night
    const oc = overcast();
    const dayI = 2.1 * smooth(-0.02, 0.25, sunDir.y) * (1 - 0.6 * oc), moonI = 0.5 * night * (1 - 0.6 * oc);
    const useSun = dayI >= moonI, dir = useSun ? sunDir : moonDir;
    DN.light.set(dir.x, Math.max(dir.y, 0.25), dir.z).normalize();
    sun.intensity = underground ? 0 : Math.max(dayI, moonI);
    if (useSun) sun.color.copy(COL.sunLo).lerp(COL.sunHi, smooth(0.02, 0.4, sunDir.y)); else sun.color.copy(COL.moon);

    // sky, fog, ambient
    skyMat.uniforms.uNight.value = night; skyMat.uniforms.uSunDir.value.copy(sunDir); skyMat.uniforms.uOvercast.value = oc;
    skyMat.uniforms.dTop.value.copy(SP.dTop); skyMat.uniforms.dBot.value.copy(SP.dBot);
    if (underground) {
      scene.fog.color.copy(COL.caveFog); scene.fog.near = 6; scene.fog.far = camMode ? 190 : 95;
      hemi.color.copy(COL.hemiCave); hemi.groundColor.copy(COL.gndCave); hemi.intensity = 0.6;
    } else {
      tmpCol.copy(SP.fog).lerp(W.show === 'snow' ? OVER_SNOW : OVER_RAIN, oc).lerp(COL.dusk, twilight * 0.55 * (1 - oc)).lerp(COL.nightFog, night);
      scene.fog.color.copy(tmpCol); scene.fog.near = (140 - night * 50) * (1 - 0.6 * oc); scene.fog.far = (420 - night * 120) * (1 - 0.45 * oc);
      hemi.color.copy(COL.hemiDay).lerp(COL.hemiNight, night); hemi.groundColor.copy(COL.gndDay).lerp(COL.gndNight, night);
      hemi.intensity = 0.85 - night * 0.55 + W.flash * (0.5 + 0.5 * Math.sin(now * 0.08)) * 1.8; // lightning
    }
    scene.background.copy(scene.fog.color);
    for (const wm of waterMats) {
      wm.uniforms.uTime.value = now / 1000;
      if (wm.userData.cave) { wm.uniforms.uSky.value.set(0x1a1036); wm.uniforms.uLight.value = 0.35; continue; }
      wm.uniforms.uSky.value.copy(COL.wSkyDay).lerp(COL.wSkyNight, night); wm.uniforms.uSunDir.value.copy(DN.light);
      wm.uniforms.uLight.value = 1 - 0.7 * night; wm.uniforms.uIce.value = wm.userData.noIce ? 0 : SP.ice;
    }

    // night sky: stars, moon, planets, the Milky Way (in the dome shader) and a black hole
    for (const n of nightMats) n.m.opacity = n.max * night * (1 - 0.85 * oc);
    scene.userData.starsMat.uniforms.uOpacity.value = night * (1 - 0.9 * oc); scene.userData.starsMat.uniforms.uTime.value = now / 1000;
    moon.position.copy(moonDir).multiplyScalar(600); moonGlow.position.copy(moon.position);
    blackHole.userData.disk.rotation.z += dt * 0.35; blackHole.lookAt(camera.position);

    // things that light up after dark
    const t = now / 1000;
    for (const g of nightGlow) {
      if (g.basic) g.basic.opacity = Math.max(g.max * night * (g.pulse !== undefined ? 0.65 + 0.35 * Math.sin(t * 2 + g.pulse) : 1), g.dayMin || 0);
      else g.std.emissiveIntensity = g.day + (g.night - g.day) * night;
    }
    const hl = lightMode === 'on' ? 1 : lightMode === 'off' ? 0 : underground ? 1 : smooth(0.2, 0.75, night);
    for (const l of headLights) l.intensity = hl * 200 * spec.lightK;
    beam.material.opacity = hl * 0.24;
    if (lightMode !== 'auto') lightMat.emissiveIntensity = lightMode === 'on' ? 3.5 : 0.15;
    if (garageOpen) hemi.intensity = Math.max(hemi.intensity, 1.1);           // showroom lighting
    document.body.classList.toggle('dark', night > 0.5 || underground);
    fireflies.m.uniforms.uOpacity.value = night * SP.fire * (1 - oc); fireflies.m.uniforms.uTime.value = t;
    FOUNTAIN.jetMat.uniforms.uTime.value = t; FOUNTAIN.jetMat.uniforms.uNight.value = night;
    for (const z of zones) z.pad.material.emissiveIntensity = 0.25 + night * 0.9;
    const btn = $('#btn-time'); const label = night > 0.5 ? '🌙 Night' : '☀ Day';
    if (btn.textContent !== label) btn.textContent = label;

    // cave life
    if (underground) {
      const u = cave.userData; u.brain.rotation.y += dt * 0.35; u.brain.position.y = 12 + Math.sin(t * 0.8) * 0.4;
      u.beam.material.opacity = 0.09 + 0.05 * Math.sin(t * 2.2); u.brainLight.intensity = 34 + 10 * Math.sin(t * 2.2);
      u.spores.uniforms.uTime.value = t;
      for (const ex of exhibits) {
        const g = ex.g;
        if (ex.kind === 'trophy') g.rotation.y += dt * 0.6;
        if (ex.kind === 'bp') { g.rotation.y = Math.sin(t * 0.5) * 0.5; g.userData.screen.offset.x = (t * 0.4) % 1; g.userData.screen.wrapS = THREE.RepeatWrapping; }
        if (ex.kind === 'maze') {
          const path = g.userData.path, segs = path.length - 1, f = (t * 0.35) % segs, i = Math.floor(f), k = f - i;
          const a = path[i], b = path[i + 1]; g.userData.bot.position.lerpVectors(a, b, k); g.userData.bot.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        }
        if (ex.kind === 'robo') { const a = g.userData.arm; a.base.rotation.y = Math.sin(t * 0.7) * 1.2; a.sh.rotation.z = Math.sin(t * 0.9) * 0.5; a.el.rotation.z = 0.8 + Math.sin(t * 1.3) * 0.5; }
      }
    }
  }

  // ---------- Minimap ----------
  const mm = $('#minimap'), mg = mm.getContext('2d');
  function drawMinimap() {
    const W = mm.width, sc = W / 730, cx = W / 2;
    const P = (x, z) => [cx + x * sc, cx + z * sc];
    mg.clearRect(0, 0, W, W);
    if (underground) { drawCaveMap(W); return; }
    mg.fillStyle = '#4dabf788'; mg.beginPath(); mg.roundRect ? mg.roundRect(6, 6, W - 12, W - 12, 18) : mg.rect(6, 6, W - 12, W - 12); mg.fill();
    const coast = (off, col) => { mg.fillStyle = col; mg.beginPath(); for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2, r = shoreR(a) + off; mg[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r * sc, cx + Math.sin(a) * r * sc); } mg.fill(); };
    coast(7, '#f1e3b0'); coast(0, '#8fcf6a');
    const blob = (x, z, w, h, c) => { mg.fillStyle = c; mg.fillRect(...P(x - w / 2, z - h / 2), w * sc, h * sc); };
    blob(0, -238, 210, 30, '#f59f00cc'); blob(0, 238, 210, 34, '#a0522dbb');                    // market · village
    mg.fillStyle = '#b2f2bb'; mg.beginPath(); mg.arc(...P(-165, -170), 30 * sc, 0, Math.PI * 2); mg.fill();
    for (const [x, z] of [[238, 108], [-238, 104]]) { mg.fillStyle = '#e8590c'; mg.beginPath(); mg.arc(...P(x, z), 11 * sc, 0, Math.PI * 2); mg.fill(); }
    drawSportsMap(P, sc);
    for (const v of viewpoints) { mg.fillStyle = '#ffd43b'; mg.beginPath(); mg.arc(...P(v.x, v.z), 5, 0, Math.PI * 2); mg.fill(); }
    mg.strokeStyle = '#3d4250'; mg.lineWidth = ROAD * sc;
    mg.beginPath(); mg.arc(cx, cx, RING * sc, 0, Math.PI * 2); mg.stroke();
    mg.lineWidth = 8 * sc;
    for (const z of zones) { mg.beginPath(); mg.moveTo(...P(z.dir.x * 14, z.dir.z * 14)); mg.lineTo(...P(z.x, z.z)); mg.stroke(); }
    mg.fillStyle = '#4dabf7'; mg.fillRect(...P(RIVER.x0, -RIVER.w / 2), (RIVER.x1 - RIVER.x0) * sc, RIVER.w * sc);
    mg.lineWidth = ROAD * sc; mg.beginPath(); mg.arc(cx, cx, OUTER * sc, 0, Math.PI * 2); mg.stroke();
    mg.lineWidth = 10 * sc;
    for (const c of connectors) { mg.beginPath(); mg.moveTo(...P(c.dir.x * RING, c.dir.z * RING)); mg.lineTo(...P(c.dir.x * OUTER, c.dir.z * OUTER)); mg.stroke(); }
    mg.fillStyle = '#adb5bd'; mg.fillRect(...P(BR.cx - BR.W / 2, -BR.L / 2), BR.W * sc, BR.L * sc);
    mg.fillStyle = '#f59f00'; for (const r of ramps) { mg.beginPath(); mg.arc(...P(r.x, r.z), 4, 0, Math.PI * 2); mg.fill(); }
    mg.fillStyle = '#22d3ee'; for (const b of boosts) { mg.beginPath(); mg.arc(...P(b.x, b.z), 3, 0, Math.PI * 2); mg.fill(); }
    gates.forEach((q, qi) => { mg.fillStyle = qi === nextGate ? '#ec4899' : '#ffffff'; mg.beginPath(); mg.arc(...P(q.x, q.z), qi === nextGate ? 6 : 3.5, 0, Math.PI * 2); mg.fill(); });
    for (const z of zones) {
      mg.fillStyle = z.color; mg.beginPath(); mg.arc(...P(z.x, z.z), PAD * sc * 1.3, 0, Math.PI * 2); mg.fill();
      if (z.visited) { mg.strokeStyle = '#1d2433'; mg.lineWidth = 3; mg.stroke(); }
    }
    mg.fillStyle = '#ffb700';
    for (const s of stars) if (!s.taken) { mg.beginPath(); mg.arc(...P(s.m.position.x, s.m.position.z), 4, 0, Math.PI * 2); mg.fill(); }
    const [px, py] = P(S.x, S.z);
    mg.save(); mg.translate(px, py); mg.rotate(Math.atan2(Math.cos(S.h), Math.sin(S.h)));
    mg.fillStyle = '#4f46e5'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
    mg.beginPath(); mg.moveTo(12, 0); mg.lineTo(-8, -8); mg.lineTo(-4, 0); mg.lineTo(-8, 8); mg.closePath(); mg.fill(); mg.stroke();
    mg.restore();
  }

  function drawCaveMap(W) {
    const sc = W / 250, ox = W / 2, oz = W * 0.06;
    const P = (x, z) => [ox + x * sc, oz + (220 - z) * sc * 0.98];
    mg.fillStyle = '#0d0b18e6'; mg.beginPath(); mg.roundRect ? mg.roundRect(6, 6, W - 12, W - 12, 18) : mg.rect(6, 6, W - 12, W - 12); mg.fill();
    mg.strokeStyle = '#3b3552'; mg.lineCap = 'round'; mg.lineJoin = 'round'; mg.lineWidth = TUN_R * 2 * sc;
    mg.beginPath(); TP.forEach(([x, z], i) => (i ? mg.lineTo : mg.moveTo).call(mg, ...P(x, z))); mg.stroke();
    mg.fillStyle = '#3b3552'; mg.beginPath(); mg.arc(...P(CC.x, CC.z), DOME * sc, 0, Math.PI * 2); mg.fill();
    mg.fillStyle = '#22d3ee88'; mg.beginPath(); mg.arc(...P(CC.x, CC.z + 30), 9 * sc, 0, Math.PI * 2); mg.fill();
    mg.fillStyle = '#67e8f9'; mg.beginPath(); mg.arc(...P(CC.x, CC.z), 5, 0, Math.PI * 2); mg.fill();
    for (const e of exhibits) { mg.fillStyle = e.color; mg.beginPath(); mg.arc(...P(e.x - UG.x, e.z - UG.z), 6, 0, Math.PI * 2); mg.fill(); if (e.visited) { mg.strokeStyle = '#fff'; mg.lineWidth = 2; mg.stroke(); } }
    mg.fillStyle = '#fff6d6'; mg.beginPath(); mg.arc(...P(0, -3), 5, 0, Math.PI * 2); mg.fill();
    mg.fillStyle = '#e9d5ff'; mg.font = '700 20px system-ui, sans-serif'; mg.textAlign = 'center'; mg.fillText('THE CORE', W / 2, W - 18);
    const [px, py] = P(S.x - UG.x, S.z - UG.z);
    mg.save(); mg.translate(px, py); mg.rotate(Math.atan2(-Math.cos(S.h), Math.sin(S.h)));
    mg.fillStyle = '#c084fc'; mg.strokeStyle = '#fff'; mg.lineWidth = 2;
    mg.beginPath(); mg.moveTo(12, 0); mg.lineTo(-8, -8); mg.lineTo(-4, 0); mg.lineTo(-8, 8); mg.closePath(); mg.fill(); mg.stroke();
    mg.restore();
  }

  // ---------- Simulation ----------
  function bounce(nx, nz, strength) {
    const vn = S.vx * nx + S.vz * nz;
    if (vn < 0) {
      S.vx -= (1 + strength) * vn * nx; S.vz -= (1 + strength) * vn * nz;
      const fx = Math.sin(S.h), fz = Math.cos(S.h);
      S.speed = (S.vx * fx + S.vz * fz) * 0.5;
      if (-vn > 6) { S.shake = Math.min(0.6, -vn / 40); blip(110); }
      if (spec.human && -vn > 4.2 && performance.now() - lastBump > 1000) { lastBump = performance.now(); hurt((-vn - 3.4) * 5, 'bump'); } // ran into something
    }
  }

  function step(dt) {
    if (S.pose && !S.rescue && started && !panelOpen && !garageOpen && !sheetOpen && (keys.up || keys.down || keys.left || keys.right || keys.brake)) { stand(); step.jumpHeld = true; }
    const input = started && !panelOpen && !garageOpen && !fading && !sheetOpen && !S.pose && !S.act && !S.rescue && !actLock() && !(race && race.t < 0);
    const up = input && keys.up, down = input && keys.down, left = input && keys.left, right = input && keys.right;
    const boost = input && keys.boost && up, hb = input && keys.brake;
    if (S.boostT > 0) S.boostT -= dt;
    const maxF = S.boostT > 0 ? spec.boostMax * 1.3 : boost ? spec.boostMax : spec.max;

    if (spec.human) { // on foot: direct control, turn on the spot, Space jumps
      if (S.onGround) {
        const want = (up ? (boost ? spec.boostMax : spec.max) : down ? -spec.max * 0.6 : 0) * (LIFE.hp < 35 ? 0.55 : 1); // limping when badly hurt
        S.speed += clamp(want - S.speed, -24 * dt, (boost ? spec.boostAcc : spec.acc) * dt);
        if (hb && !step.jumpHeld && !actNoJump()) { S.vy = 7.2; S.onGround = false; S.air = 0; blip(330); }
      }
      step.jumpHeld = hb;
    } else if (S.onGround) {
      if (up) S.speed += (boost ? spec.boostAcc : spec.acc) * dt;
      if (down) S.speed -= (S.speed > 0.5 ? 42 : 14) * dt;
      if (!up && !down && S.boostT <= 0) S.speed -= S.speed * 1.4 * dt;
      if (panelOpen || garageOpen || fading || sheetOpen) S.speed -= S.speed * 4 * dt;
      if (hb) S.speed -= S.speed * 1.2 * dt;
      if (S.speed > maxF) S.speed -= (S.speed - maxF) * 2 * dt;
    }
    S.speed = clamp(S.speed, -11, 62);

    const target = (left ? 1 : 0) - (right ? 1 : 0);
    S.steer += (target - S.steer) * Math.min(1, 9 * dt);
    const turnScale = clamp(S.speed / 8, -1, 1) * (1 - Math.min(Math.abs(S.speed), 44) / 110);
    if (spec.human) S.h += S.steer * spec.turn * dt;
    else S.h += S.steer * (hb ? spec.turn + 0.7 : spec.turn) * (S.onGround ? turnScale : Math.max(Math.abs(turnScale), 0.5) * Math.sign(S.speed || 1)) * (S.onGround ? 1 : spec.air) * dt;

    const fx = Math.sin(S.h), fz = Math.cos(S.h);
    const onIce = !underground && SP.ice > 0.5 && S.y < 0.5 && inRiver(S.x, S.z);
    const grip = underground ? 8 : onIce ? 1.4 : 8 - SP.snow * 2 - W.wet * 1.5;     // snow and rain make it slippery
    const k = S.onGround ? Math.min(1, (spec.human ? 14 : hb ? 2.2 : grip) * dt) : 0; // no grip in the air
    S.vx += (fx * S.speed - S.vx) * k;
    S.vz += (fz * S.speed - S.vz) * k;
    const ox = S.x, oz = S.z;
    S.x += S.vx * dt; S.z += S.vz * dt;

    // height: drive up ramps / the bridge, launch off edges, fly, land
    const g = surfaceAt(S.x, S.z, S.y);
    if (S.onGround) {
      if (g > S.y + 0.8) { // hit a raised side (ramp/bridge edge): it acts like a wall
        S.x = ox; S.z = oz; S.vx *= -0.3; S.vz *= -0.3; S.speed *= -0.3; S.shake = 0.3; blip(110);
      } else if (g < S.y - 0.35) { // the surface dropped away under us: airborne
        S.onGround = false; S.air = 0; S.vy = Math.max(S.vy, 0);
      } else {
        S.vy = (g - S.y) / Math.max(dt, 1e-3); S.y = g;
      }
    }
    if (!S.onGround) {
      S.air += dt; S.vy -= 26 * dt; S.y += S.vy * dt;
      const g2 = surfaceAt(S.x, S.z, S.y);
      if (S.y <= g2) {
        if (S.vy < -12) { S.shake = Math.min(0.7, -S.vy / 35); blip(140); }
        if (spec.human && S.vy < -9) hurt((-S.vy - 8) * 5, 'fall');                                  // a hard landing on foot
        if (S.air > 0.55 && !spec.human) {
          const pts = Math.round(S.air * 100);
          stuntScore += pts; updateCounters(); blip(990);
          toast(`Air time ${S.air.toFixed(1)}s · +${pts}`);
        }
        S.y = g2; S.vy = 0; S.onGround = true; S.air = 0;
      }
    }

    // water: drive through the river and it bogs you down — take the bridge!
    if (onIce && (!step.iceToast || performance.now() - step.iceToast > 8000)) { step.iceToast = performance.now(); toast('The river is frozen — drive across, carefully!'); }
    if (S.onGround && S.y < 0.5 && inRiver(S.x, S.z) && !onIce) {
      const wet = spec.wet || 9;
      S.speed -= S.speed * (spec.wet ? 1.2 : 3.5) * dt; S.speed = clamp(S.speed, -6, wet); S.boostT = 0;
      if (Math.random() < 0.5) puff(S.x + rand(-1, 1), S.z + rand(-1, 1));
      if (!step.wetToast || performance.now() - step.wetToast > 6000) { step.wetToast = performance.now(); toast(spec.wet ? 'Splash! The buggy doesn\'t mind.' : 'Splash! The bridge is faster.'); }
    }

    // boost pads
    if (S.onGround) for (const b of boosts) {
      if (Math.hypot(S.x - b.x, S.z - b.z) < 3.6 && S.boostT < 1.2) {
        S.boostT = 1.6; S.speed = Math.max(S.speed, spec.boostMax * 1.15); blip(1200); S.shake = 0.15;
      }
    }

    // lap: pass the gates in order
    const gt = gates[nextGate];
    if (!race && Math.hypot(S.x - gt.x, S.z - gt.z) < 9) {
      const now = performance.now();
      if (nextGate === 0) {
        if (lapStart !== null) {
          const time = (now - lapStart) / 1000;
          const isBest = !bestLap || time < bestLap;
          if (isBest) { bestLap = time; try { localStorage.setItem('drive-best-lap', String(time)); } catch { /* not saved */ } }
          toast(`Lap ${fmtTime(time)}${isBest ? ' — new best!' : ''}`); blip(1320);
        } else toast('Lap started — follow the glowing gates!');
        lapStart = now;
      } else blip(760 + nextGate * 60);
      nextGate = (nextGate + 1) % gates.length;
      gates.forEach((q, qi) => { q.glow.emissiveIntensity = qi === nextGate ? 1.6 : 0.3; });
    }
    if (lapStart !== null && !race) $('#lap').textContent = `Lap ${fmtTime((performance.now() - lapStart) / 1000)}` + (bestLap ? ` · Best ${fmtTime(bestLap)}` : '');

    // static collisions
    if (!S.pose && !actLock()) for (const c of colliders) {
      if (S.y > 5) break; // airborne over trees / props
      if (c.maxY !== undefined && S.y > c.maxY) continue;
      if (c.shop && JOB && c.shop === JOB.shop.name) continue;          // you're behind this counter
      const dx = S.x - c.x, dz = S.z - c.z, d = Math.hypot(dx, dz), min = c.r + spec.r;
      if (d < min && d > 0.0001) {
        const nx = dx / d, nz = dz / d;
        S.x = c.x + nx * min; S.z = c.z + nz * min;
        bounce(nx, nz, 0.4);
      }
    }
    if (underground) { caveT += dt; caveConstrain(); if (S.z - UG.z < -0.5 && caveT > 1.2 && !fading) leaveCave(); }
    else {
      // the shore: wade into the shallows, but the open sea stops you
      const rr = Math.hypot(S.x, S.z);
      const shore = shoreAt(S.x, S.z), seaLim = shore + 16;
      if (rr > seaLim) { const nx = S.x / rr, nz = S.z / rr; S.x = nx * seaLim; S.z = nz * seaLim; bounce(-nx, -nz, 0.2); }
      if (rr > shore + 9 && S.onGround) {
        S.speed -= S.speed * 2.5 * dt; S.speed = clamp(S.speed, -5, spec.human ? 1.6 : 8); S.boostT = 0;
        if (!step.seaToast || performance.now() - step.seaToast > 7000) { step.seaToast = performance.now(); toast('That\'s the open sea — you\'re on an island!'); }
      }
      // the hidden cave: drive into the dark opening
      const cdx = S.x - CAVE.cx, cdz = S.z - CAVE.cz, cal = cdx * CAVE.u.x + cdz * CAVE.u.z, cb = cdx * CAVE.v.x + cdz * CAVE.v.z;
      if (!fading && S.y < 1 && cal > 1 && cal < 6.6 && Math.abs(cb) < 3.3) enterCave();
      if (!step.hum && Math.hypot(cdx, cdz) < 30) { step.hum = true; toast('You hear a strange hum from the rocks…'); blip(70); }
    }

    // props
    const carSpeed = Math.hypot(S.vx, S.vz);
    for (const p of props) {
      const dx = p.x - S.x, dz = p.z - S.z, d = Math.hypot(dx, dz), min = p.r + spec.r;
      if (d < min && p.y < 1.5 && S.y < 1.5) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.x = S.x + nx * min; p.z = S.z + nz * min;
        p.vx = S.vx * 0.9 + nx * (2 + carSpeed * 0.3);
        p.vz = S.vz * 0.9 + nz * (2 + carSpeed * 0.3);
        p.vy = 2 + carSpeed * 0.25; p.spin = rand(-8, 8); p.tumble = rand(4, 10) * Math.sign(rand(-1, 1));
        S.speed *= 0.96;
      }
      if (p.vx || p.vz || p.vy || p.y > 0) {
        p.vy -= 28 * dt; p.y += p.vy * dt;
        if (p.y <= 0) { p.y = 0; p.vy = Math.abs(p.vy) > 3 ? -p.vy * 0.35 : 0; p.vx *= 0.85; p.vz *= 0.85; }
        const fr = p.y === 0 ? 3 : 0.3;
        p.vx -= p.vx * fr * dt; p.vz -= p.vz * fr * dt;
        p.x = clamp(p.x + p.vx * dt, -HALF, HALF); p.z = clamp(p.z + p.vz * dt, -HALF, HALF);
        p.g.rotation.y += p.spin * dt; p.spin *= 1 - 2 * dt;
        if (p.y > 0) p.g.rotation.x += p.tumble * dt;
        else p.g.rotation.x += ((Math.round(p.g.rotation.x / (Math.PI / 2)) * Math.PI / 2) - p.g.rotation.x) * Math.min(1, 6 * dt);
        if (Math.abs(p.vx) + Math.abs(p.vz) < 0.05 && p.y === 0) { p.vx = p.vz = 0; }
        p.g.position.set(p.x, p.y, p.z);
      }
    }

    // stars
    for (const s of stars) {
      if (s.taken) continue;
      s.phase += dt;
      s.m.rotation.y += 2 * dt; s.m.position.y = s.base + Math.sin(s.phase * 2.5) * 0.35;
      if (Math.hypot(s.m.position.x - S.x, s.m.position.z - S.z) < 3 && Math.abs(s.m.position.y - (S.y + 1)) < 2.6) {
        s.taken = true; s.m.visible = false; starsTaken++; updateCounters(); blip(880 + starsTaken * 40);
        if (starsTaken === N_STARS) toast('All stars collected!');
      }
    }

    // zones
    nearZone = null;
    for (const z of (underground ? exhibits : zones)) {
      const d = Math.hypot(S.x - z.x, S.z - z.z);
      if (d < PAD + 0.5) nearZone = z;
      else if (d > PAD + 3) z.dismissed = false;
    }
    const pr = $('#prompt');
    if (nearZone && !panelOpen) {
      if (!nearZone.dismissed && Math.abs(S.speed) < 9) openPanel(nearZone);
      else { pr.textContent = isTouch ? `Stop on the pad to open ${nearZone.title}` : `Press Enter to open ${nearZone.title}`; pr.classList.remove('hidden'); }
    } else pr.classList.add('hidden');
    if (panelOpen && !nearZone && Math.abs(S.speed) > 3) closePanel();

    // the secret Core Crystal
    if (underground && coreCrystal && !coreCrystal.taken) {
      const cgp = coreCrystal.g; cgp.rotation.y += dt * 1.4; cgp.position.y = 1.8 + Math.sin(performance.now() / 500) * 0.3;
      if (Math.hypot(S.x - UG.x - CORE_AT.x, S.z - UG.z - CORE_AT.z) < 3.2) {
        coreCrystal.taken = true; cgp.visible = false; blip(523); setTimeout(() => blip(784), 120); setTimeout(() => blip(1047), 240);
        try { localStorage.setItem('drive-core-crystal', '1'); } catch { /* not saved */ }
        updateCounters(); toast('✦ You found the Core Crystal — the map\'s best-kept secret.'); S.shake = 0.25;
      }
    }

    // dust
    const lateral = Math.abs(S.vx * fz - S.vz * fx);
    dustTimer -= dt;
    if (!spec.human && dustTimer <= 0 && (lateral > 3.5 || (boost && S.speed > 20))) {
      dustTimer = 0.03;
      for (const sx of [-1.1, 1.1]) puff(S.x - fx * 1.4 + fz * sx, S.z - fz * 1.4 - fx * sx);
    }
    for (const p of dust) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.position.y += dt * 0.8; p.m.scale.multiplyScalar(1 + dt * 1.8);
      p.m.material.opacity = Math.max(0, p.life) * 0.7;
      if (p.life <= 0) p.m.visible = false;
    }

    // visuals
    car.position.set(S.x, S.y, S.z);
    car.rotation.y = S.h;
    const hs = Math.max(4, Math.hypot(S.vx, S.vz));
    car.rotation.x += (clamp(-Math.atan2(S.vy, hs), -0.45, 0.45) - car.rotation.x) * Math.min(1, (S.onGround ? 10 : 3) * dt);
    S.spin += S.speed * dt / wheelR;
    for (const b of boosts) b.m.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(performance.now() / 150);
    for (const w of wheels) { w.w.rotation.x = S.spin; if (w.front) w.pivot.rotation.y = S.steer * 0.5; }
    const roll = spec.human ? 0 : carKind === 'bike' ? 0 : -S.steer * clamp(S.speed, -20, 40) * 0.006;
    body.rotation.z += (roll - body.rotation.z) * Math.min(1, 8 * dt);
    body.rotation.x += ((spec.human ? 0 : up ? -0.03 : down ? 0.04 : 0) - body.rotation.x) * Math.min(1, 6 * dt);
    model.rotation.z += ((carKind === 'bike' ? -S.steer * clamp(S.speed / 22, -1, 1) * 0.5 : 0) - model.rotation.z) * Math.min(1, 6 * dt); // bike leans
    if (model.userData.h) { // walking / running / jumping
      const h = model.userData.h;
      if (!S.onGround) { h.legL.rotation.x = 0.5; h.legR.rotation.x = -0.3; h.armL.rotation.x = h.armR.rotation.x = -2.4; }
      else { S.walk = (S.walk || 0) + Math.abs(S.speed) * dt * 2.6; poseHuman(h, S.walk, clamp(Math.abs(S.speed) / 4, 0, 1) * (Math.abs(S.speed) > 3.5 ? 0.95 : 0.6)); }
      animPlayer(h, dt);                                                                                 // sitting, lying, eating, drinking, healing
    }

    const t = performance.now() / 1000;
    for (const z of zones) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + z.i);
      z.ring.material.emissiveIntensity = nearZone === z ? 2 : 0.6 + pulse;
      z.ring.position.y = 0.35 + pulse * 0.25;
    }

    if (audio) {
      const now = audio.ctx.currentTime, sp = Math.abs(S.speed);
      audio.osc.frequency.setTargetAtTime((38 + sp * 3.2 + (boost ? 18 : 0)) * (spec.engine || 1), now, 0.08);
      audio.osc2.frequency.setTargetAtTime(19 + sp * 1.6, now, 0.08);
      audio.filter.frequency.setTargetAtTime(350 + sp * 25, now, 0.1);
      audio.gain.gain.setTargetAtTime(muted || !started || !spec.engine ? 0 : 0.025 + Math.min(sp, 40) * 0.0012, now, 0.1);
    }

    $('#kmh').textContent = Math.round(Math.abs(S.speed) * 3.6);
    if (toastTimer > 0 && (toastTimer -= dt) <= 0) $('#toast').classList.add('hidden');
  }

  // ---------- Camera ----------
  const camPos = new THREE.Vector3(0, 30, 40), look = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function snapCamera() { // jump straight behind the car (after a teleport)
    const fx = Math.sin(S.h), fz = Math.cos(S.h);
    camPos.set(S.x - fx * 8, S.y + 3.6, S.z - fz * 8); look.set(S.x + fx * 4, S.y + 1.2, S.z + fz * 4);
  }
  function updateCamera(dt) {
    const fx = Math.sin(S.h), fz = Math.cos(S.h);
    const desired = new THREE.Vector3(), target = new THREE.Vector3(S.x, 1, S.z);
    if (!started) { // slow orbit on the intro screen
      const a = performance.now() / 9000;
      desired.set(Math.cos(a) * 60, 38, Math.sin(a) * 60); target.set(0, 0, 0);
    } else if (garageOpen) { // showroom orbit
      const a = performance.now() / 4000;
      const rad = spec.human ? 3.6 : spec.r < 1.2 ? 4.8 : 7.5;
      desired.set(S.x + Math.cos(a) * rad, S.y + (spec.human ? 1.7 : 2.4), S.z + Math.sin(a) * rad); target.set(S.x, S.y + (spec.human ? 1.1 : 0.8), S.z);
    } else if (camMode === 0) {
      const tight = underground && !inCavern();
      const back = (tight ? Math.min(7.5, spec.cam.back) : spec.cam.back) + Math.abs(S.speed) * 0.08;
      desired.set(S.x - fx * back, S.y + (tight ? Math.min(3.4, spec.cam.up) : spec.cam.up) + Math.abs(S.speed) * 0.03, S.z - fz * back);
      target.set(S.x + fx * 4, S.y + spec.cam.look, S.z + fz * 4);
      if (kite.on) { target.y += 4 * kite.k; desired.y += 0.5 * kite.k; }   // tilt up so you can watch your kite
      const ceil = Math.min(ceilingAt(S.x, S.z, S.y), ceilingAt(desired.x, desired.z, S.y), camCeiling());
      if (ceil < Infinity) { desired.y = Math.min(desired.y, ceil - 0.7); target.y = Math.min(target.y, ceil - 1.2); }
    } else if (camMode === 3) { // first person: eyes at the driver's / rider's / your own head
      car.updateMatrixWorld();
      desired.set(...spec.eye);
      if (spec.human && S.onGround) desired.y += Math.sin((S.walk || 0) * 2) * 0.035 * clamp(Math.abs(S.speed) / 3, 0, 1); // head bob
      car.localToWorld(desired);
      target.set(0, 0, 1).applyQuaternion(car.quaternion).multiplyScalar(10).add(desired);
    } else if (camMode === 1) {
      desired.set(S.x + 20, 26, S.z + 20);
      target.set(S.x + S.vx * 0.2, 0, S.z + S.vz * 0.2);
    } else {
      desired.set(S.x, 70, S.z + 0.1); target.set(S.x, 0, S.z);
    }
    const fp = started && !garageOpen && camMode === 3;
    model.visible = !fp;                                   // don't render your own car/body from the inside
    const k = fp ? 1 : 1 - Math.exp(-(started ? 5 : 1.5) * dt);
    camPos.lerp(desired, k); look.lerp(target, k);
    const fov = (innerWidth < innerHeight ? 70 : 55) + (fp ? 14 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    camera.position.copy(camPos);
    if (S.shake > 0) {
      camera.position.x += rand(-S.shake, S.shake); camera.position.y += rand(-S.shake, S.shake);
      S.shake = Math.max(0, S.shake - dt * 1.5);
    }
    camera.lookAt(look);
    const ease = 1 - Math.exp(-(LOOK.drag ? 18 : 4) * dt); // eases back when released
    LOOK.pitch += (LOOK.target - LOOK.pitch) * ease; LOOK.yaw += (LOOK.yawTarget - LOOK.yaw) * ease;
    if (Math.abs(LOOK.yaw) > 1e-4) camera.rotateOnWorldAxis(UP, LOOK.yaw);   // turn left/right around the vertical
    if (Math.abs(LOOK.pitch) > 1e-4) camera.rotateX(LOOK.pitch);             // then tilt up/down
    sun.position.set(S.x + DN.light.x * 80, DN.light.y * 80, S.z + DN.light.z * 80); sun.target.position.set(S.x, 0, S.z);
  }

  // ---------- Loop ----------
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w < h ? 70 : 55; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  let last = performance.now();
  // adaptive quality: if frames are slow for ~2s, step down (resolution, then shadows)
  const Q = { t: 0, n: 0, level: 0 };
  function adaptQuality(rawDt) {
    Q.t += rawDt; Q.n++;
    if (Q.t < 2 || Q.level >= 2) return;
    const fps = Q.n / Q.t; Q.t = 0; Q.n = 0;
    if (fps >= 40) return;
    Q.level++;
    if (Q.level === 1) { renderer.setPixelRatio(Math.min(1, window.devicePixelRatio)); resize(); }
    else { renderer.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); }); }
  }
  const SYSTEMS = [step, updateRescue, updateIsland, updateLife, updatePets, updateToys, updateRace, updateFun, updateSeasons, updateDayNight, updateCamera, drawMinimap];
  function frame(now) {
    requestAnimationFrame(frame);                    // schedule first, so nothing below can stop the loop
    const raw = (now - last) / 1000;
    const dt = Math.min(0.05, raw); last = now;
    if (started) adaptQuality(raw);
    // each system runs guarded: one failing feature must never freeze the whole game
    for (const fn of SYSTEMS) { try { fn(dt, now); } catch (err) { if (!frame.errs) frame.errs = new Set(); const key = fn.name + err.message; if (!frame.errs.has(key)) { frame.errs.add(key); console.error('[game]', fn.name, err); } } }
    scene.userData.sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  look.set(0, 0, 0);
  requestAnimationFrame(frame);
  $('#btn-time').onclick = skipTime;
  // collapsible HUD panels (remembered per visitor)
  const UI = { stats: false, tools: false, help: false };
  try { Object.assign(UI, JSON.parse(localStorage.getItem('drive-ui') || '{}')); } catch { /* defaults */ }
  function applyUI() {
    document.body.classList.toggle('show-stats', !!UI.stats); document.body.classList.toggle('show-tools', !!UI.tools); document.body.classList.toggle('show-help', !!UI.help);
    $('#btn-stats').classList.toggle('on', !!UI.stats); $('#btn-settings').classList.toggle('on', !!UI.tools); $('#btn-help').classList.toggle('on', !!UI.help);
    try { localStorage.setItem('drive-ui', JSON.stringify(UI)); } catch { /* not saved */ }
  }
  const flipUI = (k) => { UI[k] = !UI[k]; applyUI(); };
  $('#btn-stats').onclick = () => flipUI('stats'); $('#btn-settings').onclick = () => flipUI('tools'); $('#btn-help').onclick = () => flipUI('help');
  $('#help-close').onclick = () => { UI.help = false; applyUI(); };
  addEventListener('keydown', (e) => { if (started && e.code === 'KeyH' && !e.repeat) flipUI('help'); });
  applyUI();
  $('#btn-season').onclick = nextSeason; $('#btn-weather').onclick = cycleWeather;
  // arriving from the website's "Play mode" link (?play): skip the choice screen and go straight into the game
  if (/[?&]play\b/.test(location.search)) {
    $('#intro').classList.add('hidden');
    (window.siteReady || Promise.resolve()).then(() => $('#btn-start').click());
  }
  try { buildPet(petKind); } catch { petKind = 'none'; } // the saved pet joins once the player exists
  window.__game = { SPORT, get ACT() { return ACT; }, get JOB() { return JOB; }, startJob, fb, bb, get nearAct() { return nearAct; }, toggleKite, spinTop, get kite() { return kite; }, setPet, startRace, cycleLights, get race() { return race; }, get pet() { return pet; }, runners, get lightMode() { return lightMode; }, get voices() { return voicePool.map(v => v.name + ' ' + v.lang); }, bots, benches, LIFE, hurt, openBag, openNearShop, setPose, get nearShop() { return nearShop; }, S, keys, zones, exhibits, setSeason, cycleWeather, W, get season() { return SEASONS[seasonIdx].key; }, start: () => $('#btn-start').click(), enterCave, leaveCave, skipTime, setCar, CAVE, DN, get underground() { return underground; } }; // handy for debugging
}, 30);
