import { Application } from 'pixi.js';
import './style.css';

const app = new Application();

await app.init({
  background: '#222222',
  resizeTo: window,
});

document.body.appendChild(app.canvas);

app.stage.addChild(block);
