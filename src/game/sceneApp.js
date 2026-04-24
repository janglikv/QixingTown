import { Clock, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderer } from 'three'
import { CAMERA_HEIGHT, WORLD_TUNING } from '../config.js'
import { createActionWheel } from './actionWheel.js'
import { createEnvironment } from './environment.js'
import { createPlayerController } from './playerController.js'

const createRenderer = (app) => {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, WORLD_TUNING.maxPixelRatio))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.domElement.className = 'game-canvas'
  app.replaceChildren(renderer.domElement)
  return renderer
}

const CONTROL_POINTS_VISIBLE_STORAGE_KEY = 'qixing-town:control-points-visible'
const VIEW_MODE_STORAGE_KEY = 'qixing-town:view-mode'
const VIEW_MODES = {
  fixedView: 'fixed-view',
  fixedForward: 'fixed-forward',
}
const VIEW_MODE_LABELS = {
  [VIEW_MODES.fixedView]: '固定视角',
  [VIEW_MODES.fixedForward]: '跟随朝向',
}

const readControlPointsVisible = () => {
  try {
    const value = window.localStorage.getItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY)

    return value === null ? true : value === 'true'
  } catch {
    return true
  }
}

const readViewMode = () => {
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === VIEW_MODES.fixedView
      ? VIEW_MODES.fixedView
      : VIEW_MODES.fixedForward
  } catch {
    return VIEW_MODES.fixedForward
  }
}

const writeViewMode = (viewMode) => {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode)
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const writeControlPointsVisible = (visible) => {
  try {
    window.localStorage.setItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY, String(visible))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const createTopRightToggle = ({ app, initialChecked, top, labelText, onChange }) => {
  const label = document.createElement('label')
  const checkbox = document.createElement('input')
  const text = document.createElement('span')

  checkbox.type = 'checkbox'
  checkbox.checked = initialChecked
  text.textContent = labelText
  Object.assign(label.style, {
    position: 'absolute',
    right: '14px',
    top,
    zIndex: '10',
    display: 'none',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })
  checkbox.style.margin = '0'
  label.append(checkbox, text)
  app.append(label)

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }
  const handleChange = () => {
    onChange(checkbox.checked)
  }

  label.addEventListener('pointerdown', stopPointerLock)
  label.addEventListener('click', stopPointerLock)
  checkbox.addEventListener('change', handleChange)

  return {
    element: label,
    syncCursorVisible: (visible) => {
      label.style.display = visible ? 'inline-flex' : 'none'
    },
    dispose: () => {
      label.removeEventListener('pointerdown', stopPointerLock)
      label.removeEventListener('click', stopPointerLock)
      checkbox.removeEventListener('change', handleChange)
      label.remove()
    },
  }
}

const createTopRightSelect = ({ app, initialValue, top, labelText, options, onChange }) => {
  const label = document.createElement('label')
  const text = document.createElement('span')
  const select = document.createElement('select')

  text.textContent = labelText
  Object.assign(label.style, {
    position: 'absolute',
    right: '14px',
    top,
    zIndex: '10',
    display: 'none',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })
  Object.assign(select.style, {
    fontSize: '14px',
  })
  options.forEach(({ value, label: optionLabel }) => {
    const option = document.createElement('option')
    option.value = value
    option.textContent = optionLabel
    select.append(option)
  })
  select.value = initialValue
  label.append(text, select)
  app.append(label)

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }
  const handleChange = () => {
    onChange(select.value)
  }

  label.addEventListener('pointerdown', stopPointerLock)
  label.addEventListener('click', stopPointerLock)
  select.addEventListener('change', handleChange)

  return {
    element: label,
    syncCursorVisible: (visible) => {
      label.style.display = visible ? 'inline-flex' : 'none'
    },
    dispose: () => {
      label.removeEventListener('pointerdown', stopPointerLock)
      label.removeEventListener('click', stopPointerLock)
      select.removeEventListener('change', handleChange)
      label.remove()
    },
  }
}

const createVirtualPointer = ({ app, isVisible }) => {
  const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
  const bodyGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
  const bevelGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
  const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const bevel = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const inner = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  const position = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  pointer.setAttribute('viewBox', '0 0 22 26')
  bodyGradient.id = 'virtual-pointer-body'
  bodyGradient.setAttribute('x1', '5')
  bodyGradient.setAttribute('y1', '3')
  bodyGradient.setAttribute('x2', '16')
  bodyGradient.setAttribute('y2', '18')
  ;[
    ['0%', '#f3eddd'],
    ['48%', '#cfc1a7'],
    ['100%', '#82715a'],
  ].forEach(([offset, color]) => {
    const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    bodyGradient.append(stop)
  })
  bevelGradient.id = 'virtual-pointer-bevel'
  bevelGradient.setAttribute('x1', '10')
  bevelGradient.setAttribute('y1', '13')
  bevelGradient.setAttribute('x2', '16')
  bevelGradient.setAttribute('y2', '21')
  ;[
    ['0%', '#d4c29f'],
    ['100%', '#6d5538'],
  ].forEach(([offset, color]) => {
    const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop.setAttribute('offset', offset)
    stop.setAttribute('stop-color', color)
    bevelGradient.append(stop)
  })
  defs.append(bodyGradient, bevelGradient)

  shadow.setAttribute('d', 'M5.2 4.1 18.4 16.5 11.4 23.4 5.2 19.1Z')
  shadow.setAttribute('fill', 'rgba(0, 0, 0, 0.68)')
  shadow.setAttribute('transform', 'translate(-1.2 1.2)')
  body.setAttribute('d', 'M5.3 3.2 18 15.4 10.8 22.4 5.3 18.5Z')
  body.setAttribute('fill', 'url(#virtual-pointer-body)')
  body.setAttribute('stroke', '#1f211d')
  body.setAttribute('stroke-width', '1.1')
  body.setAttribute('stroke-linejoin', 'round')
  bevel.setAttribute('d', 'M13.1 14.1 18 15.4 10.8 22.4 9.3 17.8Z')
  bevel.setAttribute('fill', 'url(#virtual-pointer-bevel)')
  bevel.setAttribute('stroke', '#443a2f')
  bevel.setAttribute('stroke-width', '0.45')
  bevel.setAttribute('stroke-linejoin', 'round')
  inner.setAttribute('d', 'M8.4 10.2 13.1 14.1 9.3 17.8Z')
  inner.setAttribute('fill', '#242622')
  inner.setAttribute('stroke', '#94866e')
  inner.setAttribute('stroke-width', '0.9')
  inner.setAttribute('stroke-linejoin', 'round')
  pointer.append(defs, shadow, body, bevel, inner)

  Object.assign(pointer.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    zIndex: '9',
    width: '22px',
    height: '26px',
    pointerEvents: 'none',
    display: 'none',
  })
  app.append(pointer)

  const syncPosition = () => {
    pointer.style.transform = `translate(${position.x - 2}px, ${position.y - 2}px)`
  }

  const handleMouseMove = (event) => {
    if (!isVisible()) return

    position.x = Math.min(window.innerWidth, Math.max(0, position.x + event.movementX))
    position.y = Math.min(window.innerHeight, Math.max(0, position.y + event.movementY))
    syncPosition()
  }

  const handleResize = () => {
    position.x = Math.min(window.innerWidth, Math.max(0, position.x))
    position.y = Math.min(window.innerHeight, Math.max(0, position.y))
    syncPosition()
  }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('resize', handleResize)
  syncPosition()

  return {
    getScreenOffset: () => ({
      x: (position.x / window.innerWidth - 0.5) * 2,
      y: (position.y / window.innerHeight - 0.5) * 2,
    }),
    syncVisible: () => {
      pointer.style.display = isVisible() ? 'block' : 'none'
    },
    dispose: () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      pointer.remove()
    },
  }
}

const createCamera = () => {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(0, CAMERA_HEIGHT, 6)

  return camera
}

export const createSceneApp = (app) => {
  if (!app) {
    throw new Error('Missing #app root element.')
  }

  const scene = new Scene()
  const camera = createCamera()
  const renderer = createRenderer(app)
  const environment = createEnvironment(scene)
  let viewMode = readViewMode()
  const player = createPlayerController({
    camera,
    domElement: renderer.domElement,
    getViewMode: () => viewMode,
    onCharacterMove: environment.moveNpc6,
    onCharacterTurn: environment.turnNpc6ByPointer,
  })
  const controlPointsVisible = readControlPointsVisible()
  environment.setNpc6ControlPointsVisible(controlPointsVisible)
  const controlPointToggle = createTopRightToggle({
    app,
    initialChecked: controlPointsVisible,
    top: '14px',
    labelText: '控制点',
    onChange: (visible) => {
      environment.setNpc6ControlPointsVisible(visible)
      writeControlPointsVisible(visible)
    },
  })
  const viewModeSelect = createTopRightSelect({
    app,
    initialValue: viewMode,
    top: '58px',
    labelText: '视角',
    options: [
      { value: VIEW_MODES.fixedView, label: VIEW_MODE_LABELS[VIEW_MODES.fixedView] },
      { value: VIEW_MODES.fixedForward, label: VIEW_MODE_LABELS[VIEW_MODES.fixedForward] },
    ],
    onChange: (nextViewMode) => {
      viewMode = nextViewMode
      writeViewMode(viewMode)
    },
  })
  const actionWheel = createActionWheel({
    scene,
    camera,
    domElement: renderer.domElement,
    actions: [
      {
        label: '蹲下',
        isActive: () => environment.npc6State.squatPose,
        toggle: () => environment.setNpc6SquatPose(!environment.npc6State.squatPose),
      },
      {
        label: '[动]下蹲',
        isActive: () => environment.npc6State.squatAction,
        toggle: () => environment.setNpc6SquatAction(!environment.npc6State.squatAction),
      },
      {
        label: '[动]扭腰',
        isActive: () => environment.npc6State.buttTwistAction,
        toggle: () => environment.setNpc6ButtTwistAction(!environment.npc6State.buttTwistAction),
      },
      {
        label: '抱头',
        isActive: () => environment.npc6State.upperPose === 'holdHead',
        toggle: () => environment.setNpc6HoldHead(environment.npc6State.upperPose !== 'holdHead'),
      },
      {
        label: '举手',
        isActive: () => ['left', 'right', 'both'].includes(environment.npc6State.upperPose),
        children: [
          {
            label: '左手',
            isActive: () => environment.npc6State.upperPose === 'left',
            toggle: () => environment.setNpc6HandRaise('left'),
          },
          {
            label: '右手',
            isActive: () => environment.npc6State.upperPose === 'right',
            toggle: () => environment.setNpc6HandRaise('right'),
          },
          {
            label: '双手',
            isActive: () => environment.npc6State.upperPose === 'both',
            toggle: () => environment.setNpc6HandRaise('both'),
          },
        ],
      },
      {
        label: '挥手',
        isActive: () => environment.npc6State.waveAction !== null,
        children: [
          {
            label: '挥左',
            isActive: () => environment.npc6State.waveAction === 'left',
            toggle: () => environment.setNpc6WaveAction('left'),
          },
          {
            label: '挥右',
            isActive: () => environment.npc6State.waveAction === 'right',
            toggle: () => environment.setNpc6WaveAction('right'),
          },
          {
            label: '双挥对称',
            isActive: () => environment.npc6State.waveAction === 'bothSame',
            toggle: () => environment.setNpc6WaveAction('bothSame'),
          },
          {
            label: '双挥同',
            isActive: () => environment.npc6State.waveAction === 'bothMirror',
            toggle: () => environment.setNpc6WaveAction('bothMirror'),
          },
        ],
      },
    ],
    onOpenChange: (open) => {
      player.controls.enabled = !open
    },
  })
  const virtualPointer = createVirtualPointer({
    app,
    isVisible: () => (
      viewMode === VIEW_MODES.fixedView
      && player.controls.enabled
      && player.controls.isLocked
    ),
  })
  const clock = new Clock()

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const onKeyDown = (event) => {
    if (event.repeat) return

    if (event.code === 'KeyG') {
      event.preventDefault()
      actionWheel.open()
    }
    if (event.code === 'Escape') {
      actionWheel.close()
    }
  }

  const onKeyUp = (event) => {
    if (event.code !== 'KeyG') return

    event.preventDefault()
    actionWheel.close({ applySelection: true })
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  let animationFrameId = 0

  const syncCameraToViewMode = () => {
    if (viewMode === VIEW_MODES.fixedForward) {
      environment.syncCameraToNpc6Front(camera)
    } else {
      // 固定视角用虚拟指针的屏幕位置决定镜头偏移和朝向。
      environment.syncCameraToNpc6FixedView(camera, virtualPointer.getScreenOffset())
    }
  }

  const renderFrame = () => {
    const delta = clock.getDelta()

    syncCameraToViewMode()
    player.update(delta)
    controlPointToggle.syncCursorVisible(!player.controls.isLocked)
    viewModeSelect.syncCursorVisible(!player.controls.isLocked)
    virtualPointer.syncVisible()
    environment.update(delta)
    syncCameraToViewMode()
    actionWheel.update()
    environment.updateGroundPosition(camera.position)
    renderer.render(scene, camera)

    animationFrameId = window.requestAnimationFrame(renderFrame)
  }

  syncCameraToViewMode()
  environment.updateGroundPosition(camera.position)
  renderFrame()

  const dispose = () => {
    window.cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    controlPointToggle.dispose()
    viewModeSelect.dispose()
    virtualPointer.dispose()
    actionWheel.dispose()
    player.dispose()
    environment.dispose()
    renderer.dispose()
  }

  return {
    scene,
    camera,
    renderer,
    dispose,
  }
}
