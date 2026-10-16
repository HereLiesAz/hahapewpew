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
    ctx.drawImage(image, -width * .5, -height, width, height);
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
  // Never introduce a comic-panel insert: the world remains one continuous fishbowl.
})();
