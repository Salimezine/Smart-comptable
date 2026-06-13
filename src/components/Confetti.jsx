import React, { useEffect, useRef } from 'react';

// Confetti particle
function randomBetween(a, b) { return a + Math.random() * (b - a); }

const COLORS = [
  '#6366f1', '#818cf8', '#a5b4fc', // indigo
  '#10b981', '#34d399', '#6ee7b7', // emerald
  '#f59e0b', '#fbbf24', '#fcd34d', // amber
  '#ef4444', '#f87171',            // red
  '#8b5cf6', '#a78bfa',            // violet
  '#ffffff', '#e2e8f0',            // white
];

export function fireConfetti(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width = window.innerWidth;
  const H = canvas.height = window.innerHeight;
  const particles = [];
  const COUNT = 120;

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: W * randomBetween(0.2, 0.8),
      y: H * randomBetween(-0.2, 0.3),
      vx: randomBetween(-4, 4),
      vy: randomBetween(-12, -4),
      r: randomBetween(4, 9),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: randomBetween(0, Math.PI * 2),
      rotSpeed: randomBetween(-0.2, 0.2),
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      life: 1,
      decay: randomBetween(0.008, 0.015),
    });
  }

  let frame;
  const gravity = 0.35;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    let alive = false;

    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.shape === 'rect') {
        ctx.fillRect(-p.r / 2, -p.r * 1.5, p.r, p.r * 2.5);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive) frame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, W, H);
  }

  frame = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, W, H); };
}

// ── Component ─────────────────────────────────────────────────
export default function Confetti({ active, onDone }) {
  const canvasRef = useRef(null);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    if (cleanupRef.current) cleanupRef.current();
    cleanupRef.current = fireConfetti(canvasRef.current);
    const timer = setTimeout(() => {
      if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
      if (onDone) onDone();
    }, 3500);
    return () => { clearTimeout(timer); if (cleanupRef.current) cleanupRef.current(); };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ opacity: active ? 1 : 0 }}
    />
  );
}
