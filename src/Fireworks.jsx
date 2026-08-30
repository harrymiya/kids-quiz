import { useEffect, useRef } from 'react';

const palettes = [
  ['#ff5c5c', '#ffd54f', '#fff'], ['#5cc7ff', '#b28bff', '#7ef0c8'], ['#ff8fb2', '#ffd54f', '#fff'],
];

export default function Fireworks({ active }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    const canvas = canvasRef.current; const context = canvas.getContext('2d'); const particles = [];
    let frame; let lastBurst = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    const burst = () => {
      const x = canvas.width * (0.15 + Math.random() * 0.7); const y = canvas.height * (0.12 + Math.random() * 0.45);
      const colors = palettes[Math.floor(Math.random() * palettes.length)];
      for (let i = 0; i < 42; i += 1) {
        const angle = Math.PI * 2 * i / 42; const speed = 2 + Math.random() * 2;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: colors[i % colors.length] });
      }
    };
    const draw = (time) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (time - lastBurst > 800) { burst(); lastBurst = time; }
      particles.forEach((particle) => {
        particle.x += particle.vx; particle.y += particle.vy; particle.vy += 0.04; particle.life -= 0.015;
        context.globalAlpha = Math.max(0, particle.life); context.fillStyle = particle.color;
        context.beginPath(); context.arc(particle.x, particle.y, 2, 0, Math.PI * 2); context.fill();
      });
      context.globalAlpha = 1;
      for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life <= 0) particles.splice(i, 1);
      frame = requestAnimationFrame(draw);
    };
    resize(); burst(); window.addEventListener('resize', resize); frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [active]);
  return <canvas ref={canvasRef} className={`fireworks ${active ? 'show' : ''}`} aria-hidden="true" />;
}
