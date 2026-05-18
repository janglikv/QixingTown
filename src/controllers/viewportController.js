import { updateLogicalViewport } from '../viewport.js';

export class ViewportController {
  constructor(app, scene, viewport) {
    this.app = app;
    this.scene = scene;
    this.viewport = viewport;
  }

  start() {
    this.update();
    this.app.renderer.on('resize', () => this.update());
  }

  update() {
    updateLogicalViewport(this.app, this.scene.root, this.viewport);
    this.scene.update();
  }
}
