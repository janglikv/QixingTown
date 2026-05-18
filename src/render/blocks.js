import { Graphics } from 'pixi.js';
import { TILE_COUNT_X } from '../config.js';

const GRASS_BLOCK_COLOR = 0x4fbf4a;
const GRASS_BLOCK_RADIUS_RATIO = 0.18;
const PLAYER_TILE_HIGHLIGHT_COLOR = 0xffffff;

export function createBlocks() {
  return new Graphics();
}

export function createPlayerTileHighlight() {
  return new Graphics();
}

export function renderBlocks(blocks, viewport, playerPosition, placedBlocks) {
  const tileSize = viewport.width / TILE_COUNT_X;
  const grassBlockKeys = new Set();

  blocks.clear();

  for (const block of placedBlocks.values()) {
    if (block.type === 'grass-block') {
      grassBlockKeys.add(getBlockKey(block.x, block.y));
    }
  }

  for (const block of placedBlocks.values()) {
    if (block.type !== 'grass-block') {
      continue;
    }

    const x = viewport.width / 2 + (block.x - playerPosition.x) * tileSize;
    const y = viewport.height / 2 - (block.y + 1 - playerPosition.y) * tileSize;
    const hasLeft = grassBlockKeys.has(getBlockKey(block.x - 1, block.y));
    const hasRight = grassBlockKeys.has(getBlockKey(block.x + 1, block.y));
    const hasTop = grassBlockKeys.has(getBlockKey(block.x, block.y + 1));
    const hasBottom = grassBlockKeys.has(getBlockKey(block.x, block.y - 1));

    // 只在整体外轮廓的凸角保留圆角，连接边保持直角以避免缝隙。
    drawGrassBlock(blocks, x, y, tileSize, {
      topLeft: !hasTop && !hasLeft,
      topRight: !hasTop && !hasRight,
      bottomRight: !hasBottom && !hasRight,
      bottomLeft: !hasBottom && !hasLeft,
    });
  }
}

function getBlockKey(x, y) {
  return `${x},${y}`;
}

function drawGrassBlock(blocks, x, y, size, corners) {
  const radius = size * GRASS_BLOCK_RADIUS_RATIO;
  const topLeftRadius = corners.topLeft ? radius : 0;
  const topRightRadius = corners.topRight ? radius : 0;
  const bottomRightRadius = corners.bottomRight ? radius : 0;
  const bottomLeftRadius = corners.bottomLeft ? radius : 0;
  const right = x + size;
  const bottom = y + size;

  blocks
    .moveTo(x + topLeftRadius, y)
    .lineTo(right - topRightRadius, y);

  if (topRightRadius > 0) {
    blocks.quadraticCurveTo(right, y, right, y + topRightRadius);
  }

  blocks.lineTo(right, bottom - bottomRightRadius);

  if (bottomRightRadius > 0) {
    blocks.quadraticCurveTo(right, bottom, right - bottomRightRadius, bottom);
  }

  blocks.lineTo(x + bottomLeftRadius, bottom);

  if (bottomLeftRadius > 0) {
    blocks.quadraticCurveTo(x, bottom, x, bottom - bottomLeftRadius);
  }

  blocks.lineTo(x, y + topLeftRadius);

  if (topLeftRadius > 0) {
    blocks.quadraticCurveTo(x, y, x + topLeftRadius, y);
  }

  blocks
    .closePath()
    .fill(GRASS_BLOCK_COLOR);
}

export function renderPlayerTileHighlight(highlight, viewport, playerPosition) {
  const tileSize = viewport.width / TILE_COUNT_X;
  const tileX = Math.floor(playerPosition.x);
  const tileY = Math.floor(playerPosition.y);
  const x = viewport.width / 2 + (tileX - playerPosition.x) * tileSize;
  const y = viewport.height / 2 - (tileY + 1 - playerPosition.y) * tileSize;

  highlight.clear();
  highlight
    .rect(x, y, tileSize, tileSize)
    .fill({ color: PLAYER_TILE_HIGHLIGHT_COLOR, alpha: 0.14 })
    .rect(x, y, tileSize, tileSize)
    .stroke({ color: PLAYER_TILE_HIGHLIGHT_COLOR, width: 2 / viewport.scale, alpha: 0.85 });
}
