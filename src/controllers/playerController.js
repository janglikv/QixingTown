import { PLAYER_SPEED_TILES_PER_SECOND } from '../config.js';

const MOVEMENT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

export class PlayerController {
  constructor(app, scene) {
    this.app = app;
    this.scene = scene;
    this.pressedKeys = [];
  }

  start() {
    this.bindMovementKeys();
    this.app.ticker.add((ticker) => this.update(ticker));
  }

  update(ticker) {
    const { x: dx, y: dy } = this.getMovementDirection();

    if (dx === 0 && dy === 0) {
      return;
    }

    const length = Math.hypot(dx, dy);
    const distance = PLAYER_SPEED_TILES_PER_SECOND * (ticker.deltaMS / 1000);

    // 斜向移动归一化，避免同时按两个方向时速度变快。
    this.move((dx / length) * distance, (dy / length) * distance);
  }

  move(dx, dy) {
    this.scene.playerPosition.x += dx;
    this.scene.playerPosition.y += dy;
    this.scene.update();
  }

  bindMovementKeys(target = window) {
    target.addEventListener('keydown', (event) => {
      if (!MOVEMENT_KEYS.includes(event.code)) {
        return;
      }

      event.preventDefault();

      if (!this.pressedKeys.includes(event.code)) {
        this.pressedKeys.push(event.code);
      }
    });

    target.addEventListener('keyup', (event) => {
      const index = this.pressedKeys.indexOf(event.code);

      if (index !== -1) {
        this.pressedKeys.splice(index, 1);
      }
    });
  }

  getMovementDirection() {
    return {
      x: this.getLastPressedDirection('KeyA', 'KeyD'),
      y: this.getLastPressedDirection('KeyS', 'KeyW'),
    };
  }

  getLastPressedDirection(negativeKey, positiveKey) {
    for (let i = this.pressedKeys.length - 1; i >= 0; i -= 1) {
      if (this.pressedKeys[i] === negativeKey) return -1;
      if (this.pressedKeys[i] === positiveKey) return 1;
    }

    return 0;
  }
}
