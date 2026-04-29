"use client";

import { useEffect, useRef } from "react";

/**
 * InkCursor — 滑鼠尾跡(墨點筆觸)
 *
 * 全頁面常駐,滑鼠移動留下淡墨筆觸,300ms 消散
 * 不影響 click / hover / pointer-events
 */
export default function InkCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<{ x: number; y: number; t: number; size: number }[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    let lastX = 0, lastY = 0, lastTime = 0;

    function onMove(e: MouseEvent) {
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = now - lastTime;
      const speed = dt > 0 ? dist / dt : 0;
      const size = Math.max(2, Math.min(8, speed * 4));
      // 太密的點略過
      if (dist < 4) return;
      pointsRef.current.push({ x: e.clientX, y: e.clientY, t: now, size });
      // 太多點截掉
      if (pointsRef.current.length > 100) pointsRef.current.shift();
      lastX = e.clientX; lastY = e.clientY; lastTime = now;
    }

    window.addEventListener("mousemove", onMove);

    let raf = 0;
    function render() {
      if (!ctx) return;
      const now = performance.now();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pointsRef.current = pointsRef.current.filter(p => now - p.t < 400);
      pointsRef.current.forEach(p => {
        const age = (now - p.t) / 400; // 0 → 1
        const alpha = (1 - age) * 0.35;
        const radius = p.size * (1 - age * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26, 26, 26, ${alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(render);
    }
    render();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
