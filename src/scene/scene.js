import { Container } from 'pixi.js';
import {
  createBlocks,
  createPlayerTileHighlight,
  renderBlocks,
  renderPlayerTileHighlight,
} from '../render/blocks.js';
import { createCoordLabel, renderCoordLabel } from '../render/coordLabel.js';
import { GRASS_BLOCK_ITEM, createInventoryPanel, renderInventoryPanel } from '../render/inventoryPanel.js';
import { createPlayer, renderPlayer } from '../render/player.js';

export class Scene {
  constructor(app, viewport) {
    this.app = app;
    this.viewport = viewport;
    this.root = new Container();
    this.gridLayer = new Container();
    this.blockLayer = new Container();
    this.playerLayer = new Container();
    this.uiLayer = new Container();
    this.playerPosition = { x: 0, y: 0 };
    this.placedBlocks = new Map();
    this.blocks = createBlocks();
    this.playerTileHighlight = createPlayerTileHighlight();
    this.player = createPlayer();
    this.coordLabel = createCoordLabel();
    this.inventoryPanel = createInventoryPanel();
    this.selectedItem = GRASS_BLOCK_ITEM;
  }

  start() {
    this.app.stage.addChild(this.root);
    this.root.addChild(this.gridLayer);
    this.root.addChild(this.blockLayer);
    this.root.addChild(this.playerLayer);
    this.root.addChild(this.uiLayer);
    this.blockLayer.addChild(this.blocks);
    this.blockLayer.addChild(this.playerTileHighlight);
    this.playerLayer.addChild(this.player);
    this.uiLayer.addChild(this.coordLabel);
    this.uiLayer.addChild(this.inventoryPanel.panel);
    this.update();
  }

  update() {
    renderBlocks(this.blocks, this.viewport, this.playerPosition, this.placedBlocks);
    renderPlayerTileHighlight(this.playerTileHighlight, this.viewport, this.playerPosition);
    renderCoordLabel(this.coordLabel, this.viewport, this.playerPosition);
    renderInventoryPanel(this.inventoryPanel, this.viewport, this.selectedItem);
    renderPlayer(this.player, this.viewport);
  }
}
