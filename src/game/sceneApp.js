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

const CAMERA_STATE_STORAGE_KEY = 'qixing-town:camera-state'
const CAMERA_STATE_SAVE_INTERVAL = 250
const CONTROL_POINTS_VISIBLE_STORAGE_KEY = 'qixing-town:control-points-visible'
const PHOTO_MODE_STORAGE_KEY = 'qixing-town:photo-mode'

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

const writeControlPointsVisible = (visible) => {
  try {
    window.localStorage.setItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY, String(visible))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readPhotoMode = () => {
  try {
    const value = window.localStorage.getItem(PHOTO_MODE_STORAGE_KEY)

    return value === null ? true : value === 'true'
  } catch {
    return true
  }
}

const writePhotoMode = (enabled) => {
  try {
    window.localStorage.setItem(PHOTO_MODE_STORAGE_KEY, String(enabled))
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
  const environment = createEnvironment(scene)
  const photoMode = readPhotoMode()
  const player = createPlayerController({
    camera,
    domElement: renderer.domElement,
    onCharacterMove: environment.moveNpc6,
  })
  player.setPhotoMode(photoMode)
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
  const photoModeToggle = createTopRightToggle({
    app,
    initialChecked: photoMode,
    top: '54px',
    labelText: '拍照模式',
    onChange: (enabled) => {
      player.setPhotoMode(enabled)
      writePhotoMode(enabled)
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
  const clock = new Clock()
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
  window.addEventListener('beforeunload', persistCameraStateOnUnload)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  let animationFrameId = 0

  const renderFrame = () => {
    const delta = clock.getDelta()

    player.update(delta)
    controlPointToggle.syncCursorVisible(!player.controls.isLocked)
    photoModeToggle.syncCursorVisible(!player.controls.isLocked)
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
    persistCameraStateOnUnload()
    controlPointToggle.dispose()
    photoModeToggle.dispose()
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
