import { Container, Graphics, Rectangle, Text } from 'pixi.js';

const INVENTORY_PADDING = 24;
const INVENTORY_SLOT_COUNT = 20;
const INVENTORY_COLUMNS = 10;
const GRASS_BLOCK_ITEM = 'grass-block';

export function createInventoryPanel() {
  const panel = new Container();
  const inventory = {
    panel,
    background: new Graphics(),
    slots: new Graphics(),
    grassSlot: new Graphics(),
    grassIcon: new Graphics(),
    grassLabel: new Text({
      text: '草方块',
      style: {
        fill: '#ffffff',
        fontFamily: 'Arial',
        fontSize: 12,
      },
    }),
    title: new Text({
      text: '背包',
      style: {
        fill: '#ffffff',
        fontFamily: 'Arial',
        fontSize: 20,
      },
    }),
    hint: new Text({
      text: 'Tab 关闭',
      style: {
        fill: '#cfcfcf',
        fontFamily: 'Arial',
        fontSize: 12,
      },
    }),
  };

  inventory.title.anchor.set(0.5, 0);
  inventory.hint.anchor.set(0.5, 0);
  inventory.grassLabel.anchor.set(0.5, 0);
  inventory.grassSlot.eventMode = 'static';
  inventory.grassSlot.cursor = 'pointer';
  inventory.panel.visible = false;
  inventory.panel.addChild(inventory.background);
  inventory.panel.addChild(inventory.title);
  inventory.panel.addChild(inventory.hint);
  inventory.panel.addChild(inventory.slots);
  inventory.panel.addChild(inventory.grassSlot);
  inventory.panel.addChild(inventory.grassIcon);
  inventory.panel.addChild(inventory.grassLabel);

  return inventory;
}

export function renderInventoryPanel(inventory, viewport, selectedItem) {
  const panelWidth = viewport.width;
  const panelHeight = viewport.height;
  const contentWidth = Math.min(760, panelWidth - INVENTORY_PADDING * 2);
  const slotGap = 10;
  const slotSize = Math.min(
    64,
    (contentWidth - slotGap * (INVENTORY_COLUMNS - 1)) / INVENTORY_COLUMNS,
  );
  const startX = Math.round((panelWidth - (slotSize * INVENTORY_COLUMNS + slotGap * (INVENTORY_COLUMNS - 1))) / 2);
  const startY = Math.round(panelHeight * 0.24);

  inventory.panel.position.set(0, 0);

  inventory.background.clear();
  inventory.background
    .rect(0, 0, panelWidth, panelHeight)
    .fill({ color: 0x171717, alpha: 0.96 });

  inventory.title.position.set(panelWidth / 2, Math.max(32, panelHeight * 0.12));
  inventory.hint.position.set(panelWidth / 2, panelHeight - 44);

  inventory.slots.clear();
  inventory.grassSlot.clear();
  inventory.grassIcon.clear();

  for (let i = 0; i < INVENTORY_SLOT_COUNT; i += 1) {
    const column = i % INVENTORY_COLUMNS;
    const row = Math.floor(i / INVENTORY_COLUMNS);
    const x = startX + column * (slotSize + slotGap);
    const y = startY + row * (slotSize + slotGap);

    inventory.slots
      .roundRect(x, y, slotSize, slotSize, 6)
      .fill({ color: 0x2a2a2a, alpha: 1 })
      .stroke({ color: 0x777777, width: 1, alpha: 0.75 });
  }

  const grassSlotX = startX;
  const grassSlotY = startY;
  const grassIconSize = Math.round(slotSize * 0.42);
  const grassIconX = Math.round(grassSlotX + (slotSize - grassIconSize) / 2);
  const grassIconY = Math.round(grassSlotY + slotSize * 0.16);
  const isGrassSelected = selectedItem === GRASS_BLOCK_ITEM;

  inventory.grassSlot
    .roundRect(grassSlotX, grassSlotY, slotSize, slotSize, 6)
    .stroke({ color: isGrassSelected ? 0x8cff8c : 0xffffff, width: isGrassSelected ? 3 : 1, alpha: isGrassSelected ? 1 : 0.4 });
  inventory.grassSlot.hitArea = new Rectangle(grassSlotX, grassSlotY, slotSize, slotSize);

  inventory.grassIcon
    .rect(grassIconX, grassIconY, grassIconSize, grassIconSize)
    .fill(0x4fbf4a);

  inventory.grassLabel.position.set(grassSlotX + slotSize / 2, grassSlotY + slotSize * 0.66);
}

export function toggleInventoryPanel(inventory) {
  inventory.panel.visible = !inventory.panel.visible;
}

export { GRASS_BLOCK_ITEM };
