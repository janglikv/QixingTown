import { Application, Graphics } from 'pixi.js';
import './style.css';

const app = new Application();

await app.init({
  background: '#9fd8ff',
  resizeTo: window,
});

document.body.appendChild(app.canvas);

const block = new Graphics()
  .rect(0, 0, 64, 64)
  .fill('#1f2937');

block.x = 80;
block.y = 80;

app.stage.addChild(block);
