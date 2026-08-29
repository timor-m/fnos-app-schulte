/**
 * 点按特效引擎：在棋盘上方的独立 canvas 上绘制一次性粒子动画。
 * canvas 本身 pointer-events: none，不参与任何交互；
 * rAF 仅在粒子存活期间运行，全部特效一次性、播完即停，
 * 与项目对低端 WebView 的性能约束保持一致。
 */

type ParticleKind = "ring" | "spark" | "dot" | "square" | "text";

type Particle = {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vr: number;
  size: number;
  growth: number;
  color: string;
  age: number;
  life: number;
  gravity: number;
  text: string;
};

const GOLD = "#eeb54a";
const GOLD_DEEP = "#c08a1e";
const BRAND = "#2f9e6e";
const DANGER = "#d15b4a";
const DANGER_WARM = "#e8834f";
const WHITE = "#ffffff";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export class TapEffects {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private raf: number | null = null;
  private lastTime = 0;
  private observer: ResizeObserver | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private reducedMotion = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    try {
      this.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    } catch {
      this.reducedMotion = false;
    }
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(canvas);
    }
    this.resize();
  }

  destroy(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.particles = [];
    this.observer?.disconnect();
    this.observer = null;
  }

  /** 点对：扩散环 + 火花迸溅 + 上升的小数字 */
  burst(clientX: number, clientY: number, color: string, label: string): void {
    if (this.reducedMotion || !this.ctx) return;
    const { x, y } = this.toLocal(clientX, clientY);
    this.particles.push({
      kind: "ring", x, y, vx: 0, vy: 0, rotation: 0, vr: 0,
      size: 10, growth: 42, color, age: 0, life: 380, gravity: 0, text: ""
    });
    for (let i = 0; i < 10; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(150, 340);
      this.particles.push({
        kind: "spark", x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        rotation: 0, vr: 0, size: rand(2, 3.4), growth: 0,
        color: pick([color, color, WHITE, GOLD]),
        age: 0, life: rand(360, 520), gravity: 520, text: ""
      });
    }
    for (let i = 0; i < 4; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(60, 160);
      this.particles.push({
        kind: "dot", x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        rotation: 0, vr: 0, size: rand(2.5, 4.5), growth: 0,
        color: pick([color, GOLD]),
        age: 0, life: rand(420, 560), gravity: 420, text: ""
      });
    }
    if (label) {
      this.particles.push({
        kind: "text", x, y: y - 8, vx: 0, vy: -64, rotation: 0, vr: 0,
        size: 19, growth: 0, color: BRAND, age: 0, life: 560, gravity: 0, text: label
      });
    }
    this.start();
  }

  /** 点错：红色扩散环 + 碎片 + 小叉 */
  wrong(clientX: number, clientY: number): void {
    if (this.reducedMotion || !this.ctx) return;
    const { x, y } = this.toLocal(clientX, clientY);
    this.particles.push({
      kind: "ring", x, y, vx: 0, vy: 0, rotation: 0, vr: 0,
      size: 8, growth: 30, color: DANGER, age: 0, life: 320, gravity: 0, text: ""
    });
    for (let i = 0; i < 6; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(120, 240);
      this.particles.push({
        kind: "square", x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 50,
        rotation: rand(0, Math.PI), vr: rand(-9, 9),
        size: rand(4, 7), growth: 0,
        color: pick([DANGER, DANGER_WARM]),
        age: 0, life: rand(380, 500), gravity: 640, text: ""
      });
    }
    this.particles.push({
      kind: "text", x, y: y - 4, vx: 0, vy: -30, rotation: 0, vr: 0,
      size: 22, growth: 0, color: DANGER, age: 0, life: 480, gravity: 0, text: "✕"
    });
    this.start();
  }

  /** 连击：点按处浮出金色"连击 xN" */
  combo(clientX: number, clientY: number, text: string): void {
    if (this.reducedMotion || !this.ctx) return;
    const { x, y } = this.toLocal(clientX, clientY);
    this.particles.push({
      kind: "text", x, y: y - 12, vx: 0, vy: -48, rotation: 0, vr: 0,
      size: 22, growth: 0, color: GOLD_DEEP, age: 0, life: 850, gravity: 0, text
    });
    this.particles.push({
      kind: "ring", x, y, vx: 0, vy: 0, rotation: 0, vr: 0,
      size: 12, growth: 34, color: GOLD, age: 0, life: 420, gravity: 0, text: ""
    });
    this.start();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = rect.width;
    this.cssHeight = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * this.dpr));
    const height = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private start(): void {
    if (this.raf !== null) return;
    this.lastTime = performance.now();
    const step = (now: number) => {
      this.raf = null;
      const dt = Math.min(50, now - this.lastTime);
      this.lastTime = now;
      this.update(dt);
      this.draw();
      if (this.particles.length > 0) {
        this.raf = requestAnimationFrame(step);
      } else {
        this.clear();
      }
    };
    this.raf = requestAnimationFrame(step);
  }

  private update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (const p of this.particles) {
      p.age += dtMs;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vr * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  private clear(): void {
    if (!this.ctx) return;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    for (const p of this.particles) {
      const t = Math.min(1, p.age / p.life);
      ctx.globalAlpha = Math.pow(1 - t, 1.35);
      if (p.kind === "ring") {
        const ease = 1 - Math.pow(1 - t, 2);
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3.5 * (1 - t));
        ctx.arc(p.x, p.y, p.size + p.growth * ease, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "spark") {
        ctx.beginPath();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = "round";
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.kind === "dot") {
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, Math.max(0.6, p.size * (1 - t * 0.5)), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "square") {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        const side = p.size * (1 - t * 0.35);
        ctx.fillRect(-side / 2, -side / 2, side, side);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.font = `700 ${p.size}px "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.text, p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
  }
}
