import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { soundEngine } from '../lib/sound';
import { Folio, PageHeading, RunningHeader } from './PaperBits';

interface StarJarProps {
  totalStarsEarned: number;
  reducedMotion: boolean;
}

interface StarBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vrot: number;
  kind: 'star' | 'heart';
  fill: string;
  stroke: string;
  shade: string;
}

const JAR_WIDTH = 240;
const JAR_HEIGHT = 256;
const INNER_LEFT = 51;
const INNER_RIGHT = 189;
const INNER_TOP = 70;
const INNER_BOTTOM = 230;
const MAX_VISIBLE_TOKENS = 200;

export const StarJar: React.FC<StarJarProps> = ({
  totalStarsEarned,
  reducedMotion,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const jarRef = useRef<HTMLDivElement | null>(null);
  const bodiesRef = useRef<StarBody[]>([]);
  const [jarScale, setJarScale] = useState(1);

  useLayoutEffect(() => {
    const el = jarRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      if (width > 0) setJarScale(width / JAR_WIDTH);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const targetTokens = Math.min(MAX_VISIBLE_TOKENS, Math.max(0, totalStarsEarned));

  const spawnBody = (index: number, fromTop: boolean): StarBody => {
    const isHeart = index % 4 === 3;
    const palette = isHeart
      ? { fill: '#F4A0B8', stroke: '#462E35', shade: '#C14E72' }
      : index % 2 === 0
        ? { fill: '#F6CE6E', stroke: '#462E35', shade: '#C08A2D' }
        : { fill: '#FBE29D', stroke: '#462E35', shade: '#D9A845' };

    const cols = 12;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const usableW = INNER_RIGHT - INNER_LEFT - 14;
    const cellW = usableW / cols;
    const rowOffset = (row % 2) * (cellW * 0.45);
    const rawX =
      INNER_LEFT +
      7 +
      col * cellW +
      rowOffset +
      (Math.random() - 0.5) * (cellW * 0.75);
    const r = isHeart ? 5.0 : 5.6;
    const seededX = Math.max(INNER_LEFT + r, Math.min(INNER_RIGHT - r, rawX));
    const seededY = Math.max(INNER_TOP + 6, INNER_BOTTOM - 8 - row * 8.2 - Math.random() * 4.5);

    return {
      x: fromTop
        ? INNER_LEFT + 30 + Math.random() * (INNER_RIGHT - INNER_LEFT - 60)
        : seededX,
      y: fromTop ? INNER_TOP - 6 - Math.random() * 18 : seededY,
      vx: (Math.random() - 0.5) * (fromTop ? 1.2 : 1.1),
      vy: fromTop ? 0.8 + Math.random() * 1.1 : 0.4,
      r,
      rot: (Math.random() - 0.5) * 1.1,
      vrot: (Math.random() - 0.5) * 0.05,
      kind: isHeart ? 'heart' : 'star',
      ...palette,
    };
  };

  useEffect(() => {
    const current = bodiesRef.current;
    if (targetTokens > current.length) {
      const adding = targetTokens - current.length;
      const fromTop = current.length > 0;
      for (let i = 0; i < adding; i += 1) {
        current.push(spawnBody(current.length, fromTop));
      }
    } else if (targetTokens < current.length) {
      current.length = targetTokens;
    }
  }, [targetTokens]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(JAR_WIDTH * dpr * jarScale);
    canvas.height = Math.round(JAR_HEIGHT * dpr * jarScale);
    ctx.setTransform(dpr * jarScale, 0, 0, dpr * jarScale, 0, 0);

    const drawPlumpStar = (r: number, shade: string) => {
      const pts = 5;
      const innerR = r * 0.56;
      const glow = ctx.createRadialGradient(-r * 0.25, -r * 0.28, r * 0.1, 0, 0, r * 1.25);
      glow.addColorStop(0, '#FFFBE8');
      glow.addColorStop(0.55, '#FBE29D');
      glow.addColorStop(1, '#EAB95C');
      ctx.beginPath();
      for (let i = 0; i < pts; i += 1) {
        const prevInnerAngle = ((i - 0.5) * 2 * Math.PI) / pts - Math.PI / 2;
        const outerAngle = (i * 2 * Math.PI) / pts - Math.PI / 2;
        const nextInnerAngle = ((i + 0.5) * 2 * Math.PI) / pts - Math.PI / 2;

        const ix1 = Math.cos(prevInnerAngle) * innerR;
        const iy1 = Math.sin(prevInnerAngle) * innerR;
        const ox = Math.cos(outerAngle) * r * 1.08;
        const oy = Math.sin(outerAngle) * r * 1.08;
        const ix2 = Math.cos(nextInnerAngle) * innerR;
        const iy2 = Math.sin(nextInnerAngle) * innerR;

        if (i === 0) {
          ctx.moveTo(ix1, iy1);
        }
        ctx.quadraticCurveTo(ox, oy, ix2, iy2);
      }
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i < pts; i += 1) {
        const a = ((i + 0.5) * 2 * Math.PI) / pts - Math.PI / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * innerR * 0.92, Math.sin(a) * innerR * 0.92);
      }
      ctx.strokeStyle = shade;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const drawHeart = (r: number, shade: string) => {
      const glow = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.4);
      glow.addColorStop(0, '#FBD3DE');
      glow.addColorStop(0.55, '#F4A0B8');
      glow.addColorStop(1, '#D14E77');
      ctx.beginPath();
      ctx.moveTo(0, r * 0.24);
      ctx.bezierCurveTo(r * 0.65, -r * 0.55, r * 1.15, r * 0.2, 0, r * 0.94);
      ctx.bezierCurveTo(-r * 1.15, r * 0.2, -r * 0.65, -r * 0.55, 0, r * 0.24);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(r * 0.32, r * 0.42);
      ctx.quadraticCurveTo(r * 0.5, r * 0.1, r * 0.28, -r * 0.22);
      ctx.strokeStyle = shade;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    let rafId = 0;

    const stepPhysics = () => {
      const bodies = bodiesRef.current;
      const n = bodies.length;
      const gravity = reducedMotion ? 0.16 : 0.28;

      for (let i = 0; i < n; i += 1) {
        const b = bodies[i];
        b.vy += gravity;
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vrot;
        b.vx *= 0.96;
        b.vy *= 0.98;
        b.vrot *= 0.92;
      }

      for (let pass = 0; pass < 3; pass += 1) {
        for (let i = 0; i < n; i += 1) {
          const a = bodies[i];
          for (let j = i + 1; j < n; j += 1) {
            const b = bodies[j];
            const minDist = (a.r + b.r) * 0.94;
            const dx = b.x - a.x;
            if (dx >= minDist || dx <= -minDist) continue;
            const dy = b.y - a.y;
            if (dy >= minDist || dy <= -minDist) continue;

            const distSq = dx * dx + dy * dy;
            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.001;
              const overlap = (minDist - dist) * 0.5;
              const nx = dx / dist;
              const ny = dy / dist;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;

              const relVx = b.vx - a.vx;
              const relVy = b.vy - a.vy;
              const sepVel = relVx * nx + relVy * ny;
              if (sepVel < 0) {
                const impulse = sepVel * 0.34;
                a.vx += impulse * nx;
                a.vy += impulse * ny;
                b.vx -= impulse * nx;
                b.vy -= impulse * ny;
              }
            }
          }
        }

        for (let i = 0; i < n; i += 1) {
          const b = bodies[i];
          if (b.x - b.r < INNER_LEFT) {
            b.x = INNER_LEFT + b.r;
            b.vx = Math.abs(b.vx) * 0.4;
          } else if (b.x + b.r > INNER_RIGHT) {
            b.x = INNER_RIGHT - b.r;
            b.vx = -Math.abs(b.vx) * 0.4;
          }

          if (b.y + b.r > INNER_BOTTOM) {
            b.y = INNER_BOTTOM - b.r;
            b.vy = -Math.abs(b.vy) * 0.25;
            if (Math.abs(b.vy) < 0.3) b.vy = 0;
            b.vx *= 0.82;
          }
          if (b.y - b.r < INNER_TOP - 16) {
            b.y = INNER_TOP - 16 + b.r;
            b.vy = Math.abs(b.vy) * 0.25;
          }
        }
      }

      for (let i = 0; i < n; i += 1) {
        const b = bodies[i];
        if (b.vx * b.vx + b.vy * b.vy < 0.012) {
          b.vx = 0;
          b.vy = 0;
          b.vrot = 0;
        }
      }
    };

    const render = () => {
      stepPhysics();
      ctx.clearRect(0, 0, JAR_WIDTH, JAR_HEIGHT);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(
        INNER_LEFT - 4,
        INNER_TOP,
        INNER_RIGHT - INNER_LEFT + 8,
        INNER_BOTTOM - INNER_TOP + 6,
        30
      );
      ctx.clip();

      for (const b of bodiesRef.current) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.strokeStyle = b.stroke;
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        if (b.kind === 'heart') {
          drawHeart(b.r, b.shade);
        } else {
          drawPlumpStar(b.r, b.shade);
        }
        ctx.restore();
      }
      ctx.restore();

      rafId = window.requestAnimationFrame(render);
    };

    rafId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(rafId);
  }, [reducedMotion, jarScale]);

  const shakeJar = () => {
    soundEngine.playStarChime();
    for (const b of bodiesRef.current) {
      b.vy = -(4.5 + Math.random() * 4.5);
      b.vx = (Math.random() - 0.5) * 4.5;
      b.vrot = (Math.random() - 0.5) * 0.18;
    }
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div className="page-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        <RunningHeader
          left="Star jar"
          right={
            <span className="text-[13px] font-bold text-strawberry-600">
              {totalStarsEarned} {totalStarsEarned === 1 ? 'star' : 'stars'}
            </span>
          }
        />

        <PageHeading centered title="Star jar" />

        <div className="relative mx-auto mt-2 flex flex-col items-center">
          <button
            type="button"
            onClick={shakeJar}
            className="group relative w-full max-w-[440px] cursor-pointer rounded-2xl p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-strawberry-500"
            aria-label="Shake stars in the jar"
          >
            <div ref={jarRef} className="relative aspect-[240/256] w-full">
              <div
                className="pointer-events-none absolute inset-x-[18%] bottom-[8%] top-[16%] rounded-[38px] border-2 border-cocoa bg-gradient-to-b from-strawberry-50/50 via-paper/75 to-strawberry-100/70 shadow-inner"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-x-[32%] top-[9%] h-[8%] rounded-t-xl border-2 border-cocoa bg-strawberry-200"
                aria-hidden="true"
              />
              <canvas ref={canvasRef} className="relative z-10 block h-full w-full" />
            </div>
          </button>
        </div>
      </div>

      <Folio page={7} />
    </div>
  );
};
