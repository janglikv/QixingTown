export function createLogicalViewport(width) {
  return { width, height: width, scale: 1 };
}

export function updateLogicalViewport(app, root, viewport) {
  const scale = app.screen.width / viewport.width;

  // 后续渲染只使用逻辑 viewport，真实窗口尺寸只在这里转换成根容器缩放。
  root.scale.set(scale);
  viewport.scale = scale;
  viewport.height = app.screen.height / scale;
}
