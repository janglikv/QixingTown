import { BitmapText } from 'pixi.js';

const COORD_LABEL_PADDING = 12;

function formatCoord(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function createCoordLabel() {
  const label = new BitmapText({
    text: '',
    style: {
      fill: '#ffffff',
      fontFamily: 'Arial',
      fontSize: 14,
    },
  });

  label.anchor.set(1, 0);
  return label;
}

export function renderCoordLabel(label, viewport, playerPosition) {
  const text = `x ${formatCoord(playerPosition.x)}, y ${formatCoord(playerPosition.y)}`;

  if (label.text !== text) {
    label.text = text;
  }

  label.position.set(viewport.width - COORD_LABEL_PADDING, COORD_LABEL_PADDING);
}
