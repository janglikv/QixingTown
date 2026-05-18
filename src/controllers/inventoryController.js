import { GRASS_BLOCK_ITEM, toggleInventoryPanel } from '../render/inventoryPanel.js';

export class InventoryController {
  constructor(app, scene, viewport) {
    this.app = app;
    this.scene = scene;
    this.viewport = viewport;
    this.inventoryPanel = scene.inventoryPanel;
    this.isMouseDown = false;
  }

  start(target = window) {
    this.inventoryPanel.grassSlot.on('pointertap', () => {
      this.scene.selectedItem = GRASS_BLOCK_ITEM;
      this.inventoryPanel.panel.visible = false;
      this.scene.update();
    });

    this.app.canvas.addEventListener('mousedown', () => {
      this.isMouseDown = true;
      this.placeSelectedItem();
    });
    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });
    this.app.ticker.add(() => this.placeWhileMouseDown());

    target.addEventListener('keydown', (event) => {
      if (event.code !== 'Tab') {
        return;
      }

      event.preventDefault();
      toggleInventoryPanel(this.inventoryPanel);
    });
  }

  placeWhileMouseDown() {
    if (!this.isMouseDown) {
      return;
    }

    this.placeSelectedItem();
  }

  placeSelectedItem() {
    if (this.scene.selectedItem !== GRASS_BLOCK_ITEM || this.inventoryPanel.panel.visible) {
      return;
    }

    // 放置行为固定作用在玩家脚下，避免鼠标位置影响地图编辑。
    const tileX = Math.floor(this.scene.playerPosition.x);
    const tileY = Math.floor(this.scene.playerPosition.y);
    const key = `${tileX},${tileY}`;

    this.scene.placedBlocks.set(key, {
      type: GRASS_BLOCK_ITEM,
      x: tileX,
      y: tileY,
    });
    this.scene.update();
  }
}
