/* Art-specific speech bubbles in the continuous fishbowl (no comic panels).
 * Loaded after the original inline game. Never replaces the story engine.
 */
(() => {
  'use strict';
  const originalBubble = Entity.prototype.drawBubble;
  const originalBroadcast = ether.broadcast.bind(ether);
  // Respect reading time for Qwerty's long arguments, while preserving the
  // original bus, listeners, accessibility log, and pause behavior.
  ether.broadcast = function broadcastWithReadingTime(sender, message) {
    if (['Tab', 'Shift', 'Qwerty'].includes(sender.name)) {
      const words = String(message).trim().split(/\s+/).length;
      sender.dialogueTimer = Math.max(sender.dialogueTimer,
        Math.min(3600, Math.max(300, 180 + words * 19)));
    }
    return originalBroadcast(sender, message);
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
    if (!['Tab', 'Shift', 'Qwerty'].includes(name)) {
      originalBubble.call(this);
      return;
    }
    const tabStyle = name === 'Tab' || name === 'Bear';
    const terminalStyle = name === 'Shift';
    const rantStyle = name === 'Qwerty';
    const maxWidth = rantStyle ? Math.min(400, Math.max(160, W - this.x - 18))
      : Math.min(310, Math.max(170, W * .43));
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
    const lifespan = Math.min(3600, Math.max(300, 180 + words * 19));
    const page = Math.min(pages.length - 1, Math.floor(state.elapsed / (lifespan / pages.length)));
    const visible = pages[page];
    const longest = Math.max(...visible.map(line => { ctx.font = font; return ctx.measureText(line).width; }));
    const width = Math.min(maxWidth, Math.max(rantStyle ? 180 : 115, longest + 32));
    const height = visible.length * lineHeight + (terminalStyle ? 33 : 22);
    const preferredX = rantStyle ? this.x + 18 : this.x - width * .5;
    const x = Math.max(12, Math.min(W - width - 12, preferredX));
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
})();
