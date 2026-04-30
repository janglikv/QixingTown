import { PerspectiveCamera, Scene, SRGBColorSpace, Timer, WebGLRenderer } from 'three'
import { CAMERA_HEIGHT, WORLD_TUNING } from '../config.js'
import { createActionSettingsPanel, readUserActions } from './actionSettingsPanel.js'
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

const CAMERA_STATE_STORAGE_KEY = 'qixing-town:camera-state'
const CAMERA_STATE_SAVE_INTERVAL = 250
const CONTROL_POINTS_VISIBLE_STORAGE_KEY = 'qixing-town:control-points-visible'
const CENTER_OF_MASS_VISIBLE_STORAGE_KEY = 'qixing-town:center-of-mass-visible'
const CONTROL_TARGET_STORAGE_KEY = 'qixing-town:control-target'

const isFiniteNumberArray = (value, length) => (
  Array.isArray(value)
  && value.length === length
  && value.every(Number.isFinite)
)

const readCameraState = () => {
  try {
    const state = JSON.parse(window.localStorage.getItem(CAMERA_STATE_STORAGE_KEY))

    if (
      !isFiniteNumberArray(state?.position, 3)
      || !isFiniteNumberArray(state?.quaternion, 4)
    ) {
      return null
    }

    return state
  } catch {
    return null
  }
}

const writeCameraState = (camera) => {
  try {
    window.localStorage.setItem(
      CAMERA_STATE_STORAGE_KEY,
      JSON.stringify({
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      }),
    )
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readControlPointsVisible = () => {
  try {
    const value = window.localStorage.getItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY)

    return value === null ? true : value === 'true'
  } catch {
    return true
  }
}

const readCenterOfMassVisible = () => {
  try {
    const value = window.localStorage.getItem(CENTER_OF_MASS_VISIBLE_STORAGE_KEY)

    return value === 'true'
  } catch {
    return false
  }
}

const writeControlPointsVisible = (visible) => {
  try {
    window.localStorage.setItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY, String(visible))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const writeCenterOfMassVisible = (visible) => {
  try {
    window.localStorage.setItem(CENTER_OF_MASS_VISIBLE_STORAGE_KEY, String(visible))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readControlTarget = () => {
  try {
    const value = window.localStorage.getItem(CONTROL_TARGET_STORAGE_KEY)

    return value === 'player' ? 'player' : 'camera'
  } catch {
    return 'camera'
  }
}

const writeControlTarget = (target) => {
  try {
    window.localStorage.setItem(CONTROL_TARGET_STORAGE_KEY, target)
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const createOverlayToolbar = (app) => {
  const toolbar = document.createElement('div')

  Object.assign(toolbar.style, {
    position: 'absolute',
    right: '6px',
    top: '14px',
    zIndex: '10',
    display: 'grid',
    gap: '8px',
    justifyItems: 'end',
    paddingRight: '4px',
  })
  app.append(toolbar)

  return {
    element: toolbar,
    dispose: () => {
      toolbar.remove()
    },
  }
}

const createVisibilityToggle = ({
  container,
  initialVisible,
  label: labelText,
  onChange,
}) => {
  const label = document.createElement('label')
  const checkbox = document.createElement('input')
  const text = document.createElement('span')

  checkbox.type = 'checkbox'
  checkbox.checked = initialVisible
  text.textContent = labelText
  Object.assign(label.style, {
    display: 'none',
    alignItems: 'center',
    gap: '8px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
  })
  checkbox.style.margin = '0'
  label.append(checkbox, text)
  container.append(label)

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

const createControlTargetIndicator = ({ container, initialTarget }) => {
  const element = document.createElement('div')
  const labels = {
    camera: '镜头',
    player: 'Player',
  }

  Object.assign(element.style, {
    display: 'none',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
    pointerEvents: 'none',
  })

  const setTarget = (target) => {
    element.textContent = `控制目标：${labels[target] ?? target}`
  }

  setTarget(initialTarget)
  container.append(element)

  return {
    setTarget,
    syncCursorVisible: (visible) => {
      element.style.display = visible ? 'block' : 'none'
    },
    dispose: () => {
      element.remove()
    },
  }
}

const getCameraStateSignature = (camera) => (
  [
    ...camera.position.toArray(),
    ...camera.quaternion.toArray(),
  ].join('|')
)

const createCamera = () => {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(0, CAMERA_HEIGHT, 6)

  const savedState = readCameraState()
  if (savedState) {
    camera.position.fromArray(savedState.position)
    camera.quaternion.fromArray(savedState.quaternion)
  }

  return camera
}

export const createSceneApp = (app) => {
  if (!app) {
    throw new Error('Missing #app root element.')
  }

  const scene = new Scene()
  const camera = createCamera()
  const renderer = createRenderer(app)
  const overlayToolbar = createOverlayToolbar(app)
  const environment = createEnvironment(scene)
  const playerController = createPlayerController({
    camera,
    domElement: renderer.domElement,
    setPlayerForwardLeanActive: environment.setPlayerForwardLeanActive,
    initialControlTarget: readControlTarget(),
  })
  const controlPointsVisible = readControlPointsVisible()
  environment.setPlayerControlPointsVisible(controlPointsVisible)
  const controlPointToggle = createVisibilityToggle({
    container: overlayToolbar.element,
    label: '控制点',
    initialVisible: controlPointsVisible,
    onChange: (visible) => {
      environment.setPlayerControlPointsVisible(visible)
      writeControlPointsVisible(visible)
    },
  })
  const centerOfMassVisible = readCenterOfMassVisible()
  environment.setPlayerCenterOfMassVisible(centerOfMassVisible)
  const centerOfMassToggle = createVisibilityToggle({
    container: overlayToolbar.element,
    label: '质心',
    initialVisible: centerOfMassVisible,
    onChange: (visible) => {
      environment.setPlayerCenterOfMassVisible(visible)
      writeCenterOfMassVisible(visible)
    },
  })
  const controlTargetIndicator = createControlTargetIndicator({
    container: overlayToolbar.element,
    initialTarget: playerController.getControlTarget(),
  })
  const actionSettingsPanel = createActionSettingsPanel({
    app,
    controlsContainer: overlayToolbar.element,
    getIkTargetPosition: environment.getPlayerIkTargetPosition,
  })
  const createUserActionWheelActions = () => readUserActions().map((action) => ({
    label: action.label,
    isActive: () => environment.playerState.userActionId === action.id,
    toggle: () => {
      if (environment.playerState.userActionId === action.id) {
        environment.cancelPlayerUserAction()
      } else {
        environment.playPlayerUserAction(action)
      }
    },
  }))
  const createPlayerActionWheel = () => createActionWheel({
    scene,
    camera,
    domElement: renderer.domElement,
    actions: createUserActionWheelActions(),
    onOpenChange: (open) => {
      playerController.controls.enabled = !open
    },
  })
  let actionWheel = createPlayerActionWheel()
  const timer = new Timer()
  timer.connect(document)
  let lastCameraStateSignature = getCameraStateSignature(camera)
  let lastCameraStateSavedAt = 0

  const persistCameraState = () => {
    const signature = getCameraStateSignature(camera)
    if (signature === lastCameraStateSignature) return

    writeCameraState(camera)
    lastCameraStateSignature = signature
  }

  const persistCameraStateOnUnload = () => {
    writeCameraState(camera)
  }

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const onKeyDown = (event) => {
    if (event.repeat) return

    if (event.code === 'Tab' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      event.preventDefault()
      const target = playerController.toggleControlTarget()

      writeControlTarget(target)
      controlTargetIndicator.setTarget(target)
    }

    if (event.code === 'KeyG') {
      event.preventDefault()
      actionWheel.open()
    }
    if (event.code === 'Escape') {
      if (!playerController.controls.isLocked && actionSettingsPanel.handleEscape()) {
        event.preventDefault()
        return
      }

      actionWheel.close()
    }
  }

  const onKeyUp = (event) => {
    if (event.code !== 'KeyG') return

    event.preventDefault()
    actionWheel.close({ applySelection: true })
  }

  const onPlayUserAction = (event) => {
    if (event.detail.preview) {
      environment.previewPlayerUserAction(event.detail.action)
    } else {
      environment.playPlayerUserAction(event.detail.action)
    }
  }

  const onClearIkTargetMarkers = () => {
    environment.clearPlayerIkTargetMarkers()
  }

  const rebuildActionWheel = () => {
    if (
      environment.playerState.userActionId
      && !readUserActions().some((action) => action.id === environment.playerState.userActionId)
    ) {
      environment.cancelPlayerUserAction()
    }
    actionWheel.close()
    actionWheel.dispose()
    actionWheel = createPlayerActionWheel()
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('beforeunload', persistCameraStateOnUnload)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  app.addEventListener('qixing-town:play-action', onPlayUserAction)
  app.addEventListener('qixing-town:clear-ik-target-markers', onClearIkTargetMarkers)
  app.addEventListener('qixing-town:user-actions-changed', rebuildActionWheel)

  let animationFrameId = 0

  const renderFrame = (timestamp) => {
    timer.update(timestamp)
    const delta = timer.getDelta()

    playerController.update(delta)
    const cursorVisible = !playerController.controls.isLocked
    controlPointToggle.syncCursorVisible(cursorVisible)
    centerOfMassToggle.syncCursorVisible(cursorVisible)
    controlTargetIndicator.syncCursorVisible(cursorVisible)
    actionSettingsPanel.syncCursorVisible(cursorVisible)
    environment.update(delta)
    actionWheel.update()
    environment.updateGroundPosition(camera.position)
    const now = window.performance.now()
    if (now - lastCameraStateSavedAt >= CAMERA_STATE_SAVE_INTERVAL) {
      lastCameraStateSavedAt = now
      persistCameraState()
    }
    renderer.render(scene, camera)

    animationFrameId = window.requestAnimationFrame(renderFrame)
  }

  environment.updateGroundPosition(camera.position)
  renderFrame()

  const dispose = () => {
    window.cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('beforeunload', persistCameraStateOnUnload)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    app.removeEventListener('qixing-town:play-action', onPlayUserAction)
    app.removeEventListener('qixing-town:clear-ik-target-markers', onClearIkTargetMarkers)
    app.removeEventListener('qixing-town:user-actions-changed', rebuildActionWheel)
    persistCameraStateOnUnload()
    controlPointToggle.dispose()
    centerOfMassToggle.dispose()
    controlTargetIndicator.dispose()
    actionSettingsPanel.dispose()
    overlayToolbar.dispose()
    actionWheel.dispose()
    playerController.dispose()
    environment.dispose()
    timer.dispose()
    renderer.dispose()
  }

  return {
    scene,
    camera,
    renderer,
    dispose,
  }
}
