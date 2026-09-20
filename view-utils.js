export const RENDER_HEIGHT_SCALE = 0.4;

export function renderHeight(gameplayHeight) {
  return Math.round(Number(gameplayHeight) * RENDER_HEIGHT_SCALE * 1000) / 1000;
}

export function heightLabelText(height) {
  return String(height);
}

export function panTargetDelta({ dx, dy, yaw, pitch, top, bottom, zoom, viewportHeight }) {
  const unitsPerPixel = (top - bottom) / zoom / Math.max(viewportHeight, 1);
  const angle = yaw * Math.PI / 180;
  const rightX = Math.cos(angle), rightZ = -Math.sin(angle);
  const upX = -Math.sin(angle), upZ = -Math.cos(angle);
  const vertical = dy * unitsPerPixel / Math.max(Math.sin(pitch * Math.PI / 180), .2);
  return {
    x: -rightX * dx * unitsPerPixel + upX * vertical,
    z: -rightZ * dx * unitsPerPixel + upZ * vertical
  };
}
