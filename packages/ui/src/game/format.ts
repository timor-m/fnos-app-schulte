export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }
  return `${seconds}.${tenths}s`;
}

/** 倒计时专用：整秒向上取整（剩余 0.x 秒仍显示 1s），避免十分位闪烁 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

export function formatPace(ms: number, count: number): string {
  if (count <= 0) return "-";
  return `${(ms / count / 1000).toFixed(2)}s/格`;
}
