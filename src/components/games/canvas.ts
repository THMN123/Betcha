import { useEffect, useRef } from 'react';

// ctx.roundRect is missing on older phones (Safari < 16, Chrome < 99). Simple fallback.
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  (CanvasRenderingContext2D.prototype as any).roundRect = function (x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.max(0, Math.min(Number(r) || 0, w / 2, h / 2));
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
}

/**
 * Keeps a canvas's backing store at the device's pixel density (crisp on phones) and calls `draw`
 * every animation frame with a context scaled to the game's logical size.
 */
export function useCanvasLoop(logicalWidth: number, logicalHeight: number, draw: (ctx: CanvasRenderingContext2D, now: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    let scale = 1;

    const resize = () => {
      // 2x is visually sharp on phones; higher densities cost a lot of fill-rate for little gain.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cssWidth = canvas.clientWidth || logicalWidth;
      scale = (cssWidth * dpr) / logicalWidth;
      canvas.width = Math.round(logicalWidth * scale);
      canvas.height = Math.round(logicalHeight * scale);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawRef.current(ctx, now);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [logicalWidth, logicalHeight]);

  return canvasRef;
}

/** Cheap "neon" glow: a few translucent circles instead of canvas shadowBlur (which is slow on phones). */
export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.globalAlpha = 0.12 * alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.25 * alpha;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
