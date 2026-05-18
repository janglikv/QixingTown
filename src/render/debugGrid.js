import { Graphics } from 'pixi.js';
import { GRID_BUFFER_TILES, TILE_COUNT_X } from '../config.js';

const GRID_LINE_COLOR = 0x333333;
const GRID_LINE_ALPHA = 0.8;
const GRID_LINE_PHYSICAL_WIDTH = 1;

function getVisibleBounds(tileSize, viewport, baseTile) {
  const halfTilesX = TILE_COUNT_X / 2;
  const halfTilesY = viewport.height / tileSize / 2;

  return {
    minX: Math.floor(baseTile.x - halfTilesX) - GRID_BUFFER_TILES,
    maxX: Math.ceil(baseTile.x + halfTilesX) + GRID_BUFFER_TILES,
    minY: Math.floor(baseTile.y - halfTilesY) - GRID_BUFFER_TILES,
    maxY: Math.ceil(baseTile.y + halfTilesY) + GRID_BUFFER_TILES,
  };
}

function alignToPhysicalPixel(value, scale) {
  return Math.round(value * scale) / scale;
}

export function createDebugGrid() {
  return new Graphics();
}

function getGridSignature(viewport, baseTile, lineWidth) {
  return [
    viewport.width,
    viewport.height,
    viewport.scale,
    baseTile.x,
    baseTile.y,
    lineWidth,
  ].join('|');
}

function updateGridPosition(graphics, viewport, playerPosition, baseTile, tileSize) {
  const offsetX = -(playerPosition.x - baseTile.x) * tileSize;
  const offsetY = (playerPosition.y - baseTile.y) * tileSize;

  graphics.position.set(
    alignToPhysicalPixel(offsetX, viewport.scale),
    alignToPhysicalPixel(offsetY, viewport.scale),
  );
}

function rebuildGrid(graphics, viewport, baseTile, tileSize, lineWidth) {
  const { minX, maxX, minY, maxY } = getVisibleBounds(tileSize, viewport, baseTile);
  const lineOffset = lineWidth / 2;

  graphics.clear();

  for (let x = minX; x <= maxX; x += 1) {
    const lineX = viewport.width / 2 + (x - baseTile.x) * tileSize;
    const alignedX = alignToPhysicalPixel(lineX, viewport.scale);

    graphics
      .rect(alignedX - lineOffset, -tileSize, lineWidth, viewport.height + tileSize * 2)
      .fill({ color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA });
  }

  for (let y = minY; y <= maxY; y += 1) {
    const lineY = viewport.height / 2 - (y - baseTile.y) * tileSize;
    const alignedY = alignToPhysicalPixel(lineY, viewport.scale);

    graphics
      .rect(-tileSize, alignedY - lineOffset, viewport.width + tileSize * 2, lineWidth)
      .fill({ color: GRID_LINE_COLOR, alpha: GRID_LINE_ALPHA });
  }
}

export function renderDebugGrid(graphics, viewport, playerPosition) {
  const tileSize = viewport.width / TILE_COUNT_X;
  const lineWidth = GRID_LINE_PHYSICAL_WIDTH / viewport.scale;
  const baseTile = {
    x: Math.floor(playerPosition.x),
    y: Math.floor(playerPosition.y),
  };
  const signature = getGridSignature(viewport, baseTile, lineWidth);

  if (graphics.gridSignature !== signature) {
    rebuildGrid(graphics, viewport, baseTile, tileSize, lineWidth);
    graphics.gridSignature = signature;
  }

  updateGridPosition(graphics, viewport, playerPosition, baseTile, tileSize);
}
