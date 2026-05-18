import { Graphics } from 'pixi.js';
import { TILE_COUNT_X } from '../config.js';

const GRASS_BLOCK_COLOR = 0x4fbf4a;
const GRASS_BLOCK_RADIUS_RATIO = 0.18;
const GRASS_BLOCK_JAG_COUNT = 4;
const GRASS_BLOCK_JAG_DEPTH_RATIO = 0.08;
const GRASS_BLOCK_STROKE_COLOR = 0x000000;
const GRASS_BLOCK_STROKE_ALPHA = 0.22;
const GRASS_BLOCK_STROKE_WIDTH_RATIO = 0.035;
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
    drawGrassBlock(blocks, x, y, tileSize, block.x, block.y, {
      topLeft: !hasTop && !hasLeft,
      topRight: !hasTop && !hasRight,
      bottomRight: !hasBottom && !hasRight,
      bottomLeft: !hasBottom && !hasLeft,
      top: !hasTop,
      right: !hasRight,
      bottom: !hasBottom,
      left: !hasLeft,
    });
  }
}

function getBlockKey(x, y) {
  return `${x},${y}`;
}

function drawGrassBlock(blocks, x, y, size, blockX, blockY, corners) {
  const radius = size * GRASS_BLOCK_RADIUS_RATIO;
  const topLeftRadius = corners.topLeft ? radius : 0;
  const topRightRadius = corners.topRight ? radius : 0;
  const bottomRightRadius = corners.bottomRight ? radius : 0;
  const bottomLeftRadius = corners.bottomLeft ? radius : 0;
  const right = x + size;
  const bottom = y + size;
  const stroke = {
    color: GRASS_BLOCK_STROKE_COLOR,
    width: size * GRASS_BLOCK_STROKE_WIDTH_RATIO,
    alpha: GRASS_BLOCK_STROKE_ALPHA,
  };

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
    .fill(GRASS_BLOCK_COLOR)
    .stroke(stroke);

  drawGrassBlockJags(blocks, x, y, size, blockX, blockY, stroke, {
    top: corners.top,
    right: corners.right,
    bottom: corners.bottom,
    left: corners.left,
  });
}

function drawGrassBlockJags(blocks, x, y, size, blockX, blockY, stroke, edges) {
  const depth = size * GRASS_BLOCK_JAG_DEPTH_RATIO;
  const inset = size * GRASS_BLOCK_RADIUS_RATIO * 0.5;
  const right = x + size;
  const bottom = y + size;

  // 只扰动整体外轮廓，避免相邻草方块接缝处出现锯齿重叠。
  if (edges.top) {
    drawHorizontalJags(blocks, x + inset, right - inset, y, -depth, blockX, blockY, 1, stroke);
  }

  if (edges.right) {
    drawVerticalJags(blocks, right, y + inset, bottom - inset, depth, blockX, blockY, 2, stroke);
  }

  if (edges.bottom) {
    drawHorizontalJags(blocks, x + inset, right - inset, bottom, depth, blockX, blockY, 3, stroke);
  }

  if (edges.left) {
    drawVerticalJags(blocks, x, y + inset, bottom - inset, -depth, blockX, blockY, 4, stroke);
  }
}

function drawHorizontalJags(blocks, startX, endX, y, depth, blockX, blockY, edgeSeed, stroke) {
  const segmentWidth = (endX - startX) / GRASS_BLOCK_JAG_COUNT;

  for (let i = 0; i < GRASS_BLOCK_JAG_COUNT; i++) {
    const widthOffset = randomJagValue(blockX, blockY, edgeSeed, i, 1) * 0.08;
    const peakOffset = randomJagValue(blockX, blockY, edgeSeed, i, 2) * 0.08;
    const depthRatio = 0.75 + randomJagValue(blockX, blockY, edgeSeed, i, 3) * 0.3;
    const left = startX + segmentWidth * (i + 0.18 + widthOffset);
    const peak = startX + segmentWidth * (i + 0.5 + peakOffset);
    const right = startX + segmentWidth * (i + 0.82 - widthOffset);

    blocks
      .moveTo(left, y)
      .lineTo(peak, y + depth * depthRatio)
      .lineTo(right, y)
      .closePath()
      .fill(GRASS_BLOCK_COLOR)
      .stroke(stroke);
  }
}

function drawVerticalJags(blocks, x, startY, endY, depth, blockX, blockY, edgeSeed, stroke) {
  const segmentHeight = (endY - startY) / GRASS_BLOCK_JAG_COUNT;

  for (let i = 0; i < GRASS_BLOCK_JAG_COUNT; i++) {
    const heightOffset = randomJagValue(blockX, blockY, edgeSeed, i, 1) * 0.08;
    const peakOffset = randomJagValue(blockX, blockY, edgeSeed, i, 2) * 0.08;
    const depthRatio = 0.75 + randomJagValue(blockX, blockY, edgeSeed, i, 3) * 0.3;
    const top = startY + segmentHeight * (i + 0.18 + heightOffset);
    const peak = startY + segmentHeight * (i + 0.5 + peakOffset);
    const bottom = startY + segmentHeight * (i + 0.82 - heightOffset);

    blocks
      .moveTo(x, top)
      .lineTo(x + depth * depthRatio, peak)
      .lineTo(x, bottom)
      .closePath()
      .fill(GRASS_BLOCK_COLOR)
      .stroke(stroke);
  }
}

function randomJagValue(blockX, blockY, edgeSeed, index, salt) {
  const value = Math.sin(blockX * 127.1 + blockY * 311.7 + edgeSeed * 43.3 + index * 19.9 + salt * 7.7);

  return value - Math.trunc(value);
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
