import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";

function isEmbeddedWebView(): boolean {
  const ua = navigator.userAgent;
  const androidWebView = /(?:; wv\)|\bwv\b|Version\/[\d.]+ Chrome\/[\d.]+ Mobile Safari\/[\d.]+)/i.test(ua);
  const iosWebView = /(?:iPhone|iPad|iPod)/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari/i.test(ua);
  const appShell = /(?:Electron|WebView|fnOS|Trim)/i.test(ua);

  try {
    // iframe 也可能只是浏览器预览容器，不能据此关闭游戏动效；fnOS 使用专属 UA/壳标识判断。
    return androidWebView || iosWebView || appShell;
  } catch {
    return true;
  }
}

if (isEmbeddedWebView()) {
  document.documentElement.classList.add("embedded-webview");
}

// 触屏禁止缩放：iOS 的 gesture 事件与多指触摸兜底（单指点按不受影响）
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (e) => e.preventDefault());
}
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false }
);

createApp(App).mount("#app");
