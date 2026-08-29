export function formatElapsed(ms: number): string {
  const safeMs = Math.max(0, ms);
  const totalTenths = Math.floor(safeMs / 100);
  return `${(totalTenths / 10).toFixed(1)}s`;
}

/** 倒计时专用：固定使用 mm:ss，剩余 0.x 秒仍显示 00:01。 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatPace(ms: number, count: number): string {
  if (count <= 0) return "-";
  return `${(ms / count / 1000).toFixed(2)}s/格`;
}

/** 星级评定：按平均每格用时，1.0s/格以内三星，1.8s/格以内两星 */
export function starsFor(timeMs: number, targetCount: number): number {
  if (targetCount <= 0) return 1;
  const pace = timeMs / targetCount / 1000;
  if (pace <= 1.0) return 3;
  if (pace <= 1.8) return 2;
  return 1;
}
