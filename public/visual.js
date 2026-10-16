/* Artwork-driven renderer for haha pew pew.
 * Loaded after the original inline game script: it replaces rendering only.
 * Character AI, encounters, controls, dialogue, pause and timing stay in index.html.
 * Source images: user-supplied haha pew pew archive; no Gemini character substitutions.
 */
(() => {
  'use strict';

  const sources = {
    Tab: '/assets/art/tab.webp',
    Shift: '/assets/art/shift.webp',
    Qwerty: '/assets/art/qwerty.webp',
    skyline: '/assets/art/wasteland.webp',
    street: '/assets/art/street.webp'
  };
  const art = {};
  for (const [name, url] of Object.entries(sources)) {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    art[name] = img;
  }
  const originalDraw = new Map([
    ['Tab', Tab.prototype.draw],
    ['Shift', Shift.prototype.draw],
    ['Qwerty', Qwerty.prototype.draw],
    ['Bear', Bear.prototype.draw]
  ]);

  const sceneDust = Array.from({ length: 56 }, (_, i) => ({
    x: (i * 0.61803398875 + 0.29) % 1,
    y: (i * 0.41421356237 + 0.17) % 1,
    speed: 0.18 + (i % 7) * 0.065,
    radius: 0.5 + (i % 3) * 0.3
  }));
  let stride = 0;
  let parallax = 0;

  function isReady(image) { return image && image.complete && image.naturalWidth > 0; }

  function cover(image, dx, dy, dw, dh, shift = 0) {
    // Fill the scene without stretching the painting or showing its empty margins.
    const scale = Math.max(dw / image.width, dh / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    const availableShift = Math.max(0, iw - dw);
    const x = dx - availableShift * (0.5 + 0.5 * Math.sin(shift * 0.002));
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, dw, dh);
    ctx.clip();
    ctx.drawImage(image, x, dy - (ih - dh) * 0.5, iw, ih);
    ctx.restore();
  }

  // Called through the original drawGroundDecor() site in the game loop, after
  // clearRect and before entities. Also covers the old placeholder ground line.
  drawGroundDecor = function drawPaintedWasteland() {
    stride += dt;
    if (world.state === 'traveling') parallax += world.scrollSpeed * dt;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#d8c693');
    sky.addColorStop(0.38, '#918469');
    sky.addColorStop(0.69, '#302f2b');
    sky.addColorStop(1, '#100f0e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (isReady(art.skyline)) {
      ctx.save();
      ctx.globalAlpha = 0.91;
      cover(art.skyline, 0, -10, W, Math.max(groundY - 45, H * .60), parallax);
      ctx.restore();
    }

    const smog = ctx.createLinearGradient(0, H * .27, 0, H);
    smog.addColorStop(0, 'rgba(223,184,132,0.01)');
    smog.addColorStop(.44, 'rgba(75,65,54,0.13)');
    smog.addColorStop(.74, 'rgba(32,29,26,0.34)');
    smog.addColorStop(1, 'rgba(11,11,12,0.91)');
    ctx.fillStyle = smog;
    ctx.fillRect(0, 0, W, H);

    // Textured street; seeded rubble makes the world stable between frames.
    if (isReady(art.street)) {
      ctx.save();
      ctx.globalAlpha = .78;
      cover(art.street, 0, groundY - 85, W, H - groundY + 85, parallax * 1.6);
      ctx.restore();
    }
    const road = ctx.createLinearGradient(0, groundY - 85, 0, H);
    road.addColorStop(0, 'rgba(34,33,29,.17)');
    road.addColorStop(1, 'rgba(11,11,13,.88)');
    ctx.fillStyle = road;
    ctx.fillRect(0, groundY - 85, W, H - groundY + 85);
    ctx.strokeStyle = 'rgba(186,174,144,.19)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const x = ((i * 257.53 - parallax * (1 + (i % 3) * .3)) % (W + 130) + W + 130) % (W + 130) - 65;
      const y = groundY + 10 + ((i * 47) % 102);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5 + i % 17, y + (i % 2 ? 2 : -1));
      ctx.lineTo(x + 12 + i % 25, y + 5);
      ctx.stroke();
    }

    // Thin airborne ash glides at a different speed from the buildings.
    ctx.save();
    for (const mote of sceneDust) {
      const x = ((mote.x * W - stride * mote.speed) % W + W) % W;
      const y = H * (.1 + mote.y * .8) + Math.sin(stride * .012 + mote.x * 22) * 8;
      ctx.fillStyle = `rgba(240,222,189,${0.10 + mote.radius * .075})`;
      ctx.beginPath();
      ctx.arc(x, y, mote.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const vignette = ctx.createRadialGradient(W * .5, H * .5, H * .12, W * .5, H * .5, Math.max(W, H) * .76);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,.72)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  };

  const spriteSizes = {
    Tab: { proportion: 1, amplitude: 1.5 },
    Shift: { proportion: .39, amplitude: 1.9 },
    Qwerty: { proportion: .41, amplitude: 2.1 }
  };

  function drawActor(actor) {
    const image = art[actor.name];
    if (!isReady(image)) {
      originalDraw.get(actor.name).call(actor);
      return;
    }
    const spec = spriteSizes[actor.name];
    const height = Math.min(330, H * .48, W * .54) * spec.proportion;
    const width = height * image.width / image.height;
    actor.h = height;
    actor.w = width;
    const movement = actor.state === 'wandering' || world.state === 'traveling';
    const bounce = movement ? Math.abs(Math.sin(stride * .15 + actor.x * .015)) * spec.amplitude : Math.sin(stride * .022 + actor.x) * .5;

    ctx.save();
    ctx.translate(actor.x, actor.y - bounce);
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.beginPath();
    ctx.ellipse(0, 2 + bounce, width * .35, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(Math.sin(stride * .014 + actor.x * .014) * .012);
    drawPaintedPuppet(actor, image, width, height, movement);
    if (actor.name !== 'Tab' && world.killingNow) {
      // The original drawings also turn the robots' eyes red when firing.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(255,32,15,.12)';
      ctx.fillRect(-width * .5, -height, width, height);
    }
    ctx.restore();

    if (actor.name === 'Shift' && actor.firing > 0 && actor.target) {
      const dx = actor.target.x - actor.x;
      const dy = (actor.target.y - actor.target.h * .55) - (actor.y - height * .65);
      const angle = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(actor.x + 13, actor.y - height * .61);
      ctx.rotate(angle);
      ctx.strokeStyle = '#211b19';
      ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(57, 0); ctx.stroke();
      ctx.strokeStyle = '#777270';
      ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(55, 0); ctx.stroke();
      ctx.fillStyle = '#ffdf83';
      if (Math.floor(stride) % 5 < 2) {
        ctx.beginPath(); ctx.moveTo(58, 0); ctx.lineTo(83, -12); ctx.lineTo(76, 0); ctx.lineTo(83, 12); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
    if (actor.dialogue) actor.drawBubble();
  }

  Tab.prototype.draw = function () { drawActor(this); };
  Shift.prototype.draw = function () { drawActor(this); };
  Qwerty.prototype.draw = function () { drawActor(this); };
  // Bear is already drawn in the supplied Tab illustration. Preserve its speech.
  Bear.prototype.draw = function () {
    if (!isReady(art.Tab)) return originalDraw.get('Bear').call(this);
    if (this.dialogue) {
      this.x = tab.x + 24;
      this.y = tab.y - 59;
      this.drawBubble();
    }
  };

  // Bubble conventions are copied from the owner's comic, not invented UI:
  // Qwerty = splattered black ink / white shouted letters; Shift = green
  // DOS text in a grey-chromed black terminal; Tab = unboxed handwriting.
  const bubbleProgress = new WeakMap();

  function wrapDialogue(text, maxWidth, font) {
    ctx.font = font;
    const lines = [];
    for (const paragraph of text.split(/\n+/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
    }
    return lines.length ? lines : ['…'];
  }

  function inkBlot(x, y, width, height) {
    // Fixed silhouette per bubble: ink should not vibrate with each frame.
    ctx.save();
    ctx.fillStyle = '#070708';
    ctx.beginPath();
    const cx = x + width / 2;
    const cy = y + height / 2;
    for (let i = 0; i <= 64; i++) {
      const angle = i * Math.PI * 2 / 64;
      const spike = Math.sin(i * 19.71) * Math.cos(i * 5.33);
      const jump = i % 11 === 0 ? 1.20 : i % 13 === 0 ? .89 : 1;
      const rx = width * .52 * (1 + spike * .075) * jump;
      const ry = height * .52 * (1 + spike * .15) * jump;
      const px = cx + Math.cos(angle) * rx;
      const py = cy + Math.sin(angle) * ry;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Draw a handful of splashes; Qwerty's dialogue is an ink accident.
    for (let i = 0; i < 14; i++) {
      const angle = i * 2.399963229728653;
      const radius = (i % 4 + 2) * 4;
      const px = cx + Math.cos(angle) * (width * .5 + radius);
      const py = cy + Math.sin(angle) * (height * .49 + radius);
      ctx.beginPath();
      ctx.ellipse(px, py, 1 + i % 3, 1 + i % 5, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  Entity.prototype.drawBubble = function drawSourceDialogue() {
    if (!this.dialogue || this.dialogue === '...') return;
    const text = String(this.dialogue);
    const name = this.name;
    const tabStyle = name === 'Tab' || name === 'Bear';
    const terminalStyle = name === 'Shift';
    const rantStyle = name === 'Qwerty';
    const maxWidth = Math.min(rantStyle ? 400 : 310, Math.max(170, W * (rantStyle ? .58 : .43)));
    const font = terminalStyle ? 'bold 13px "Courier New", monospace'
      : rantStyle ? '900 16px Impact, "Arial Black", sans-serif'
        : 'italic 17px "Comic Sans MS", "Segoe Print", cursive';
    const lineHeight = rantStyle ? 20 : tabStyle ? 22 : 18;
    const lines = wrapDialogue(text, maxWidth - 34, font);
    const maximum = rantStyle ? 7 : terminalStyle ? 5 : 4;
    const pages = [];
    for (let i = 0; i < lines.length; i += maximum) pages.push(lines.slice(i, i + maximum));
    let state = bubbleProgress.get(this);
    if (!state || state.text !== text) {
      state = { text, elapsed: 0 };
      bubbleProgress.set(this, state);
    }
    if (!paused) state.elapsed += dt;
    const words = text.trim().split(/\s+/).length;
    const lifespan = Math.max(200, 180 + words * 19);
    const page = Math.min(pages.length - 1, Math.floor(state.elapsed / (lifespan / pages.length)));
    const visible = pages[page];
    const longest = Math.max(...visible.map(line => { ctx.font = font; return ctx.measureText(line).width; }));
    const width = Math.min(maxWidth, Math.max(rantStyle ? 180 : 115, longest + 32));
    const height = visible.length * lineHeight + (terminalStyle ? 33 : 22);
    const x = Math.max(12, Math.min(W - width - 12, this.x - width * .5));
    const y = Math.max(18, this.y - this.h - height - 26);
    const tail = Math.max(x + 14, Math.min(x + width - 14, this.x));
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    if (rantStyle) {
      inkBlot(x, y, width, height);
      ctx.fillStyle = '#070708';
      ctx.beginPath();
      ctx.moveTo(tail - 10, y + height - 4);
      ctx.lineTo(this.x, Math.min(this.y - this.h - 4, y + height + 24));
      ctx.lineTo(tail + 8, y + height - 4);
      ctx.closePath(); ctx.fill();
      ctx.font = font;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#101010';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      for (let i = 0; i < visible.length; i++) {
        const baseline = y + 21 + i * lineHeight;
        ctx.strokeText(visible[i], x + 15, baseline);
        ctx.fillText(visible[i], x + 15, baseline);
      }
    } else if (terminalStyle) {
      ctx.fillStyle = 'rgba(0,0,0,.40)';
      ctx.fillRect(x + 5, y + 5, width, height);
      ctx.fillStyle = '#090b08';
      ctx.strokeStyle = '#969696';
      ctx.lineWidth = 2;
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = '#777';
      ctx.fillRect(x + 2, y + 2, width - 4, 16);
      ctx.fillStyle = '#df1b13';
      ctx.fillRect(x + width - 15, y + 4, 10, 10);
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + width - 13, y + 6); ctx.lineTo(x + width - 7, y + 12);
      ctx.moveTo(x + width - 7, y + 6); ctx.lineTo(x + width - 13, y + 12);
      ctx.stroke();
      ctx.fillStyle = '#090b08';
      ctx.beginPath();
      ctx.moveTo(tail - 9, y + height - 1);
      ctx.lineTo(tail, y + height + 13);
      ctx.lineTo(tail + 8, y + height - 1);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#999'; ctx.stroke();
      ctx.fillStyle = '#55ff42';
      ctx.font = font;
      for (let i = 0; i < visible.length; i++) {
        const line = i === 0 && !visible[i].startsWith('>') ? `>${visible[i]}` : visible[i];
        ctx.fillText(line, x + 12, y + 35 + i * lineHeight);
      }
    } else {
      // Tab in the supplied "Pit Stop" strip speaks without a balloon.
      ctx.strokeStyle = '#181512';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + width * .5, y + height - 4);
      ctx.lineTo(this.x + 8, Math.min(this.y - this.h - 3, y + height + 20));
      ctx.stroke();
      ctx.font = font;
      ctx.fillStyle = '#17140f';
      ctx.strokeStyle = 'rgba(239,226,195,.91)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      for (let i = 0; i < visible.length; i++) {
        const baseline = y + 19 + i * lineHeight;
        ctx.strokeText(visible[i], x + 12, baseline);
        ctx.fillText(visible[i], x + 12, baseline);
      }
    }
    if (pages.length > 1) {
      ctx.font = '10px monospace';
      ctx.fillStyle = rantStyle ? '#ddd' : terminalStyle ? '#55ff42' : '#181512';
      ctx.fillText(`${page + 1}/${pages.length}`, x + width - 36, y + height - (terminalStyle ? 4 : 2));
    }
    ctx.restore();
  };

  // Fishbowl pass: the cast keeps walking, and places have things to see.
  // This is an addition to the existing world, never a new scene or panel.
  const sceneLocations = [
    'THE BOTTOMLESS CRATER', 'THE SINGING FISH', 'THE HUGGING STATUE',
    'THE UNBROKEN MIRROR', 'WAR MACHINE GRAVEYARD', 'FAMILY BILLBOARD'
  ];
  sceneLocations.forEach(name => {
    if (!locations.includes(name)) locations.push(name);
  });

  const originalUpdate = Entity.prototype.update;
  const travelOffsets = Object.freeze({ Shift: -108, Tab: 0, Qwerty: 114 });
  Entity.prototype.update = function updateWithCompanions() {
    originalUpdate.call(this);
    if (!Object.prototype.hasOwnProperty.call(travelOffsets, this.name)) return;
    if (world.state !== 'traveling') return;
    // Three individuals, one direction. The girl stays between the machines.
    const center = W * .5 + Math.sin(world.locationsVisited * 1.37) * Math.min(20, W * .04);
    const narrow = Math.min(1, W / 660);
    const destination = center + travelOffsets[this.name] * narrow;
    const step = Math.min(1, dt * .022);
    this.x += (destination - this.x) * step;
    this.vx *= Math.pow(.8, dt);
  };

  const originalAskTheVoid = askTheVoid;
  askTheVoid = function askInThePresent(name, prompt) {
    const nearby = world.location ? `Location: ${world.location}. ` : '';
    // Preserve request limits and the original AI budget/backoff policy.
    return originalAskTheVoid(name, (nearby + prompt).slice(0, 500));
  };

  const propColor = '#312f2b';
  const propEdge = '#978a72';
  const propLight = '#c8ba9d';
  let propFrame = 0;

  function landmarkKind(name) {
    if (/CRATER|MINE|TRAMPOLINE/i.test(name)) return 'crater';
    if (/MIRROR/i.test(name)) return 'mirror';
    if (/STATUE|FUNERAL/i.test(name)) return 'statue';
    if (/FISH|LIBRARY/i.test(name)) return 'fish';
    if (/WAR MACHINE|INTERSTATE|OVERPASS|RV/i.test(name)) return 'machine';
    if (/BILLBOARD|SCHOOL|MALL|KMART/i.test(name)) return 'billboard';
    if (/GAS STATION|DAIQUIRI|WAFFLE|ARBY|WHAT|DOLLAR|BIG LOTS|CVS/i.test(name)) return 'station';
    return 'sign';
  }

  function drawLandmark() {
    const type = landmarkKind(world.location || '');
    const isTravel = world.state === 'traveling';
    const s = Math.max(.58, Math.min(1.25, W / 1000));
    const anchorX = W * .74 + (isTravel ? -((parallax * .45) % (W + 400)) : 0);
    const anchorY = groundY + 5;
    ctx.save();
    ctx.globalAlpha = isTravel ? .28 : .88;
    ctx.translate(anchorX, anchorY);
    ctx.scale(s, s);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = propEdge;
    ctx.fillStyle = propColor;
    ctx.lineWidth = 3;

    if (type === 'crater') {
      ctx.fillStyle = '#100f10';
      ctx.beginPath(); ctx.ellipse(5, 0, 137, 27, -.06, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#a99b80'; ctx.beginPath(); ctx.ellipse(5, 0, 150, 35, -.06, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#4a4741'; ctx.beginPath(); ctx.ellipse(8, 5, 89, 12, -.06, 0, Math.PI * 2); ctx.stroke();
    } else if (type === 'mirror') {
      ctx.strokeStyle = '#1b1c1c'; ctx.lineWidth = 8;
      ctx.strokeRect(-34, -158, 68, 143);
      ctx.fillStyle = '#74716b'; ctx.fillRect(-30, -154, 60, 135);
      ctx.fillStyle = '#99998c'; ctx.fillRect(-25, -149, 21, 123);
      ctx.strokeStyle = '#3b3936'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-18, -142); ctx.lineTo(10, -96); ctx.lineTo(-2, -62); ctx.lineTo(20, -30); ctx.stroke();
      ctx.strokeStyle = '#463e35'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-28, -14); ctx.lineTo(-47, 0); ctx.moveTo(29, -14); ctx.lineTo(50, 0); ctx.stroke();
    } else if (type === 'statue') {
      ctx.fillStyle = '#47443c'; ctx.fillRect(-67, -14, 140, 15);
      ctx.fillStyle = '#777267'; ctx.fillRect(-49, -23, 100, 10);
      ctx.lineWidth = 22; ctx.strokeStyle = '#706c62';
      ctx.beginPath(); ctx.moveTo(-21, -24); ctx.lineTo(-30, -99); ctx.lineTo(-8, -126);
      ctx.moveTo(21, -24); ctx.lineTo(30, -100); ctx.lineTo(9, -128); ctx.stroke();
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(-27, -102); ctx.quadraticCurveTo(0, -67, 24, -101);
      ctx.moveTo(26, -107); ctx.quadraticCurveTo(0, -73, -28, -104); ctx.stroke();
      ctx.fillStyle = '#8b8578';
      ctx.beginPath(); ctx.arc(-10, -146, 17, 0, Math.PI * 2); ctx.arc(13, -148, 17, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'fish') {
      ctx.fillStyle = '#443c32'; ctx.fillRect(-90, -124, 180, 90);
      ctx.strokeStyle = propEdge; ctx.lineWidth = 4; ctx.strokeRect(-90, -124, 180, 90);
      ctx.fillStyle = '#7a7c66';
      ctx.beginPath(); ctx.ellipse(-3, -79, 48, 19, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(36, -79); ctx.lineTo(74, -103); ctx.lineTo(74, -55); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#171715'; ctx.beginPath(); ctx.arc(-33, -82, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#bfb9a9'; ctx.beginPath(); ctx.arc(73, -46, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = propColor; ctx.fillRect(-65, -34, 8, 35); ctx.fillRect(57, -34, 8, 35);
    } else if (type === 'machine') {
      ctx.fillStyle = '#343434'; ctx.fillRect(-105, -69, 198, 67);
      ctx.fillStyle = '#59574e'; ctx.fillRect(-50, -131, 110, 65);
      ctx.strokeStyle = '#282828'; ctx.lineWidth = 17;
      ctx.beginPath(); ctx.moveTo(30, -125); ctx.lineTo(137, -151); ctx.stroke();
      ctx.fillStyle = '#1a1919';
      [-69, 60].forEach(x => { ctx.beginPath(); ctx.arc(x, -4, 24, 0, Math.PI * 2); ctx.fill(); });
      ctx.strokeStyle = propEdge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-102, -65); ctx.lineTo(-23, -25); ctx.lineTo(82, -61); ctx.stroke();
    } else if (type === 'billboard') {
      ctx.fillStyle = '#3f3931'; ctx.fillRect(-108, -177, 208, 102);
      ctx.strokeStyle = '#958b7b'; ctx.lineWidth = 4; ctx.strokeRect(-108, -177, 208, 102);
      ctx.fillStyle = '#787365';
      [-43, 0, 43].forEach((x, i) => {
        ctx.beginPath(); ctx.arc(x, -140 + (i % 2) * 8, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 14, -123 + (i % 2) * 8, 28, 35);
      });
      ctx.fillStyle = propColor; ctx.fillRect(-65, -75, 10, 75); ctx.fillRect(50, -75, 10, 75);
    } else if (type === 'station') {
      ctx.fillStyle = '#4d473c'; ctx.fillRect(-125, -140, 250, 12);
      ctx.fillRect(-98, -128, 10, 128); ctx.fillRect(82, -128, 10, 128);
      ctx.fillStyle = '#766c5c'; ctx.fillRect(-47, -79, 40, 75); ctx.fillRect(23, -79, 40, 75);
      ctx.strokeStyle = '#24201e'; ctx.lineWidth = 3; ctx.strokeRect(-47, -79, 40, 75);
      ctx.beginPath(); ctx.moveTo(-7, -65); ctx.bezierCurveTo(17, -70, 7, -19, 23, -14); ctx.stroke();
    } else {
      ctx.fillStyle = '#4d4941'; ctx.fillRect(-55, -105, 108, 55);
      ctx.fillStyle = '#292725'; ctx.fillRect(-4, -50, 7, 51);
      ctx.strokeStyle = propEdge; ctx.lineWidth = 3; ctx.strokeRect(-55, -105, 108, 55);
    }
    ctx.restore();
  }

  const originalPaintedGround = drawGroundDecor;
  drawGroundDecor = function drawLivingWasteland() {
    originalPaintedGround();
    drawLandmark();
  };

  // Puppet-lite: independently pivot the original painted head and torso.
  // The source pixels stay intact; no replacement character artwork is made.
  const headSplits = Object.freeze({ Tab: .29, Shift: .56, Qwerty: .635 });
  function drawPaintedPuppet(actor, image, width, height, walking) {
    const headFraction = headSplits[actor.name];
    const seam = Math.round(image.height * headFraction);
    const bodyScreenY = -height + height * headFraction;
    const headMotion = actor.name === 'Qwerty' && actor.dialogue
      ? Math.sin(stride * .22) * .034
      : Math.sin(stride * .018 + actor.x * .009) * .014;
    const gait = walking ? Math.sin(stride * .13 + actor.x * .01) * .02 : 0;
    ctx.save();
    ctx.rotate(gait);
    // Draw the body first, preserving the full character silhouette.
    ctx.drawImage(image, 0, seam - 2, image.width, image.height - seam + 2,
      -width / 2, bodyScreenY - height * 2 / image.height, width,
      height * (image.height - seam + 2) / image.height);
    ctx.save();
    ctx.translate(0, bodyScreenY);
    ctx.rotate(headMotion);
    ctx.drawImage(image, 0, 0, image.width, seam + 2, -width / 2,
      -height * headFraction, width, height * (seam + 2) / image.height);
    ctx.restore();
    ctx.restore();
  }

  // Preserve the original illustrated sprites, expressions, and firing effect.
  // drawActor calls this hook only after its image is ready.


  // Never introduce a comic-panel insert: the world remains one continuous fishbowl.
})();
