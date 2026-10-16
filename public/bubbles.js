/* Dialogue lives in the scrolling fishbowl. No panels, synthetic audio, or browser AI. */
(() => {
    'use strict';
    const originalBubble = Entity.prototype.drawBubble;
    const originalBroadcast = ether.broadcast.bind(ether);
    const pageState = new WeakMap();
    ether.broadcast = function withReadingTime(sender, message) {
        if (['Tab', 'Shift', 'Qwerty'].includes(sender.name)) {
            const words = String(message).trim().split(/\s+/).length;
            sender.dialogueTimer = Math.max(sender.dialogueTimer, Math.min(3600, Math.max(300, 180 + words * 19)));
        }
        return originalBroadcast(sender, message);
    };
    function wrap(text, width, font) {
        ctx.font = font;
        const result = [];
        for (const paragraph of text.split(/\n+/)) {
            let line = '';
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
                const next = line ? line + ' ' + word : word;
                if (line && ctx.measureText(next).width > width) {
                    result.push(line); line = word;
                } else line = next;
            }
            if (line) result.push(line);
        }
        return result.length ? result : ['…'];
    }
    function splatter(x, y, w, h) {
        const cx = x + w / 2, cy = y + h / 2;
        ctx.fillStyle = '#080809';
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
            const a = i * Math.PI / 32;
            const spike = Math.sin(i * 19.71) * Math.cos(i * 5.33);
            const jump = i % 11 === 0 ? 1.2 : i % 13 === 0 ? .89 : 1;
            const xx = cx + Math.cos(a) * w * .52 * (1 + spike * .075) * jump;
            const yy = cy + Math.sin(a) * h * .52 * (1 + spike * .15) * jump;
            if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 14; i++) {
            const a = i * 2.399963229728653;
            const r = (i % 4 + 2) * 4;
            ctx.beginPath();
            ctx.ellipse(cx + Math.cos(a) * (w * .5 + r), cy + Math.sin(a) * (h * .49 + r),
                1 + i % 3, 1 + i % 5, a, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    Entity.prototype.drawBubble = function drawIllustratedDialogue() {
        if (!this.dialogue || this.dialogue === '...') return;
        if (!['Tab', 'Shift', 'Qwerty'].includes(this.name)) {
            originalBubble.call(this); return;
        }
        const text = String(this.dialogue), tab = this.name === 'Tab';
        const shift = this.name === 'Shift', qwerty = this.name === 'Qwerty';
        const maxWidth = Math.min(qwerty ? 400 : 310, Math.max(170, W * (qwerty ? .58 : .43)));
        const font = shift ? 'bold 13px "Courier New", monospace'
            : qwerty ? '900 16px Impact, "Arial Black", sans-serif'
            : 'italic 17px "Comic Sans MS", "Segoe Print", cursive';
        const lineHeight = qwerty ? 20 : tab ? 22 : 18;
        const lines = wrap(text, maxWidth - 34, font);
        const perPage = qwerty ? 7 : shift ? 5 : 4;
        const pages = [];
        for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
        let state = pageState.get(this);
        if (!state || state.text !== text) {
            state = { text, elapsed: 0 }; pageState.set(this, state);
        }
        if (!paused) state.elapsed += dt;
        const life = Math.min(3600, Math.max(300, 180 + text.trim().split(/\s+/).length * 19));
        const index = Math.min(pages.length - 1, Math.floor(state.elapsed / (life / pages.length)));
        const visible = pages[index];
        ctx.save();
        ctx.font = font;
        const longest = Math.max(...visible.map(line => ctx.measureText(line).width));
        const w = Math.min(maxWidth, Math.max(qwerty ? 180 : 115, longest + 32));
        const h = visible.length * lineHeight + (shift ? 33 : 22);
        const x = Math.max(12, Math.min(W - w - 12, this.x - w / 2));
        const y = Math.max(18, this.y - this.h - h - 26);
        const tip = Math.max(x + 14, Math.min(x + w - 14, this.x));
        if (qwerty) {
            splatter(x, y, w, h);
            ctx.fillStyle = '#080809';
            ctx.beginPath(); ctx.moveTo(tip - 10, y + h - 4);
            ctx.lineTo(this.x, Math.min(this.y - this.h - 4, y + h + 24));
            ctx.lineTo(tip + 8, y + h - 4); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.strokeStyle = '#101010'; ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round'; ctx.font = font;
            visible.forEach((line, i) => {
                const baseline = y + 21 + i * lineHeight;
                ctx.strokeText(line, x + 15, baseline);
                ctx.fillText(line, x + 15, baseline);
            });
        } else if (shift) {
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(x + 5, y + 5, w, h);
            ctx.fillStyle = '#090b08'; ctx.strokeStyle = '#969696'; ctx.lineWidth = 2;
            ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = '#777'; ctx.fillRect(x + 2, y + 2, w - 4, 16);
            ctx.fillStyle = '#df1b13'; ctx.fillRect(x + w - 15, y + 4, 10, 10);
            ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.beginPath();
            ctx.moveTo(x + w - 13, y + 6); ctx.lineTo(x + w - 7, y + 12);
            ctx.moveTo(x + w - 7, y + 6); ctx.lineTo(x + w - 13, y + 12); ctx.stroke();
            ctx.fillStyle = '#090b08'; ctx.beginPath();
            ctx.moveTo(tip - 9, y + h - 1); ctx.lineTo(tip, y + h + 13);
            ctx.lineTo(tip + 8, y + h - 1); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#999'; ctx.stroke();
            ctx.fillStyle = '#55ff42'; ctx.font = font;
            visible.forEach((line, i) => ctx.fillText(i === 0 && !line.startsWith('>') ? '>' + line : line, x + 12, y + 35 + i * lineHeight));
        } else {
            // Tab's artwork uses handwriting with a pointer, not a balloon.
            ctx.strokeStyle = '#181512'; ctx.lineWidth = 2.5; ctx.beginPath();
            ctx.moveTo(x + w / 2, y + h - 4);
            ctx.lineTo(this.x + 8, Math.min(this.y - this.h - 3, y + h + 20)); ctx.stroke();
            ctx.font = font; ctx.fillStyle = '#17140f'; ctx.strokeStyle = 'rgba(239,226,195,.91)';
            ctx.lineWidth = 4; ctx.lineJoin = 'round';
            visible.forEach((line, i) => {
                const baseline = y + 19 + i * lineHeight;
                ctx.strokeText(line, x + 12, baseline); ctx.fillText(line, x + 12, baseline);
            });
        }
        if (pages.length > 1) {
            ctx.font = '10px monospace';
            ctx.fillStyle = qwerty ? '#ddd' : shift ? '#55ff42' : '#181512';
            ctx.fillText((index + 1) + '/' + pages.length, x + w - 36, y + h - (shift ? 4 : 2));
        }
        ctx.restore();
    };
})();
