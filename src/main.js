import { Application } from 'pixi.js';
import { LOGICAL_WIDTH } from './config.js';
import { InventoryController } from './controllers/inventoryController.js';
import { PlayerController } from './controllers/playerController.js';
import { ViewportController } from './controllers/viewportController.js';
import { Scene } from './scene/scene.js';
import { createLogicalViewport } from './viewport.js';
import './style.css';

const app = new Application();

await app.init({
  background: '#222222',
  resizeTo: window,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

document.body.appendChild(app.canvas);

const viewport = createLogicalViewport(LOGICAL_WIDTH);
const scene = new Scene(app, viewport);
const viewportController = new ViewportController(app, scene, viewport);
const playerController = new PlayerController(app, scene);
const inventoryController = new InventoryController(app, scene, viewport);

scene.start();
viewportController.start();
playerController.start();
inventoryController.start();
