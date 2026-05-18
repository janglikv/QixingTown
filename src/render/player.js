import { Graphics } from 'pixi.js';
import { TILE_COUNT_X } from '../config.js';

export function createPlayer() {
  return new Graphics();
}

export function renderPlayer(player, viewport) {
  const tileSize = viewport.width / TILE_COUNT_X;
  const playerRadius = Math.max(4, tileSize * 0.16);

  if (player.radius !== playerRadius) {
    player.clear();
    player.circle(0, 0, playerRadius).fill(0x3fdc75);
    player.radius = playerRadius;
  }

  player.position.set(Math.round(viewport.width / 2), Math.round(viewport.height / 2));
}
