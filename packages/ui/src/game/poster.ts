export type ResultPosterData = {
  level: number;
  shapeName: string;
  targetCount: number;
  time: string;
  errors: number;
  pace: string;
  best: string;
  stars: number;
  starLabel: string;
  isNewBest: boolean;
};

const WIDTH = 1080;
const HEIGHT = 1440;
const FONT = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  context.lineTo(x + safeRadius, y + height);
  context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  context.lineTo(x, y + safeRadius);
  context.arcTo(x, y, x + safeRadius, y, safeRadius);
  context.closePath();
}

function centeredText(
  context: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: string,
  color: string
) {
  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, WIDTH / 2, y);
  context.restore();
}

function drawAppMark(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  roundedRect(context, x, y, size, size, size * 0.22);
  context.fillStyle = "#ffffff";
  context.fill();

  const gap = size * 0.07;
  const inset = size * 0.18;
  const cell = (size - inset * 2 - gap * 2) / 3;
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      roundedRect(
        context,
        x + inset + column * (cell + gap),
        y + inset + row * (cell + gap),
        cell,
        cell,
        cell * 0.22
      );
      context.fillStyle = "#08a579";
      context.fill();
    }
  }
}

function drawStar(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  filled: boolean
) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (Math.PI * point) / 5;
    const pointRadius = point % 2 === 0 ? radius : radius * 0.46;
    const x = centerX + Math.cos(angle) * pointRadius;
    const y = centerY + Math.sin(angle) * pointRadius;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fillStyle = filled ? "#f2b744" : "#e3e9e1";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = filled ? "#344c3e" : "#c8d4cb";
  context.stroke();
}

function drawStat(
  context: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: string
) {
  roundedRect(context, x, 785, 282, 162, 20);
  context.fillStyle = "#f5f9f5";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#dce7de";
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#738178";
  context.font = `500 30px ${FONT}`;
  context.fillText(label, x + 141, 830);
  context.fillStyle = "#263a2e";
  context.font = `700 42px ${FONT}`;
  context.fillText(value, x + 141, 891);
}

function drawMiniBoard(context: CanvasRenderingContext2D) {
  const values = [4, 1, 8, 7, 5, 3, 2, 9, 6];
  const startX = 396;
  const startY = 1028;
  const size = 88;
  const gap = 12;
  const colors = ["#e8f6ee", "#fff1e7", "#eef1fa", "#f7f3dd"];

  for (let index = 0; index < values.length; index += 1) {
    const row = Math.floor(index / 3);
    const column = index % 3;
    const x = startX + column * (size + gap);
    const y = startY + row * (size + gap);
    roundedRect(context, x, y, size, size, 16);
    context.fillStyle = colors[index % colors.length];
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = "#d5e1d7";
    context.stroke();
    context.fillStyle = "#274b39";
    context.font = `700 36px ${FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(values[index]), x + size / 2, y + size / 2 + 2);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to generate poster"));
    }, "image/png");
  });
}

export async function createResultPoster(data: ResultPosterData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  context.fillStyle = "#f1f7f2";
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.fillStyle = "#069f74";
  context.fillRect(0, 0, WIDTH, 250);
  drawAppMark(context, 72, 65, 116);
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.font = `700 56px ${FONT}`;
  context.fillText("舒尔特训练", 220, 105);
  context.fillStyle = "rgba(255, 255, 255, 0.82)";
  context.font = `400 30px ${FONT}`;
  context.fillText("家庭专注力挑战", 220, 164);

  roundedRect(context, 58, 286, 964, 1100, 28);
  context.fillStyle = "#ffffff";
  context.fill();
  context.shadowColor = "rgba(33, 74, 49, 0.12)";
  context.shadowBlur = 28;
  context.shadowOffsetY = 12;
  context.strokeStyle = "rgba(220, 231, 222, 0.8)";
  context.lineWidth = 2;
  context.stroke();
  context.shadowColor = "transparent";

  centeredText(
    context,
    data.isNewBest ? "新纪录" : "闯关成功",
    365,
    `700 32px ${FONT}`,
    "#e67845"
  );
  centeredText(
    context,
    `第 ${data.level} 关 · ${data.shapeName}`,
    438,
    `700 54px ${FONT}`,
    "#263a2e"
  );
  centeredText(
    context,
    `${data.targetCount} 个数字专注挑战`,
    495,
    `400 27px ${FONT}`,
    "#748178"
  );

  for (let star = 1; star <= 3; star += 1) {
    drawStar(context, WIDTH / 2 + (star - 2) * 122, 587, star === 2 ? 54 : 46, star <= data.stars);
  }
  centeredText(context, data.starLabel, 662, `600 28px ${FONT}`, "#718076");
  centeredText(context, data.time, 730, `800 84px ${FONT}`, "#07865f");

  drawStat(context, 92, "失误", `${data.errors} 次`);
  drawStat(context, 399, "速度", data.pace);
  drawStat(context, 706, "历史最佳", data.best);

  centeredText(context, "从 1 开始，依次找到每一个数字", 995, `500 29px ${FONT}`, "#52645a");
  drawMiniBoard(context);
  centeredText(context, "打开飞牛 App · 舒尔特训练", 1352, `600 32px ${FONT}`, "#65766c");

  return canvasToBlob(canvas);
}
