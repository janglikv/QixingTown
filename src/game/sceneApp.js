import {
  BufferGeometry,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Timer,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { MOVE_SPEED, WORLD_TUNING } from '../config.js'
import { createActionSequencePanel, normalizeActionSequence, readUserActionSequences } from './actionSequencePanel.js'
import { createActionSettingsPanel, readUserActions } from './actionSettingsPanel.js'
import { createActionWheel } from './actionWheel.js'
import BUILTIN_JUMP_ASSETS from './actionAssets/jump.json'
import BUILTIN_RUN_ASSETS from './actionAssets/run.json'
import { PLAYER_MODEL_RIG } from './createPlayer.js'
import { createEnvironment } from './environment.js'
import { readMapData, writeMapData } from './mapData.js'
import { createPhysicsWorld } from './physicsWorld.js'
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
const CONTROL_TARGET_STORAGE_KEY = 'qixing-town:control-target'
const CAMERA_POSITION_STORAGE_KEY = 'qixing-town:camera-position'
const CAMERA_QUATERNION_STORAGE_KEY = 'qixing-town:camera-quaternion'
const PLAYER_POSITION_STORAGE_KEY = 'qixing-town:player-position'
const POSITION_CACHE_INTERVAL = 0.5
const DEFAULT_ACTION_SEQUENCE_STEP_DURATION = 0.9
const COMPOSED_ACTION_ID = 'action-sequences:composed'
const BUILTIN_ACTIONS = [
  ...BUILTIN_RUN_ASSETS.actions,
  ...BUILTIN_JUMP_ASSETS.actions,
]
const BUILTIN_SEQUENCES = [
  ...BUILTIN_RUN_ASSETS.sequences,
  ...BUILTIN_JUMP_ASSETS.sequences,
]

const applyButtonStyle = (button, variant = 'normal') => {
  Object.assign(button.style, {
    height: '30px',
    padding: '0 10px',
    border: '1px solid rgba(238, 245, 238, 0.24)',
    borderRadius: '5px',
    background: variant === 'danger' ? 'rgba(160, 38, 38, 0.82)' : 'rgba(238, 245, 238, 0.1)',
    color: '#eef5ee',
    font: 'inherit',
    cursor: 'pointer',
  })
}

const readControlPointsVisible = () => {
  try {
    const value = window.localStorage.getItem(CONTROL_POINTS_VISIBLE_STORAGE_KEY)

    return value === null ? false : value === 'true'
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

const readControlTarget = () => {
  try {
    const value = window.localStorage.getItem(CONTROL_TARGET_STORAGE_KEY)

    return value === 'camera' ? 'camera' : 'player'
  } catch {
    return 'player'
  }
}

const writeControlTarget = (target) => {
  try {
    window.localStorage.setItem(CONTROL_TARGET_STORAGE_KEY, target)
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readCachedPosition = (key) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key))
    if (![value?.x, value?.y, value?.z].every(Number.isFinite)) return null

    return value
  } catch {
    return null
  }
}

const applyCachedPosition = (position, key) => {
  const cachedPosition = readCachedPosition(key)
  if (!cachedPosition) return

  position.set(cachedPosition.x, cachedPosition.y, cachedPosition.z)
}

const writeCachedPosition = (key, position) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      x: position.x,
      y: position.y,
      z: position.z,
    }))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const readCachedQuaternion = (key) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key))
    if (![value?.x, value?.y, value?.z, value?.w].every(Number.isFinite)) return null

    return value
  } catch {
    return null
  }
}

const applyCachedQuaternion = (quaternion, key) => {
  const cachedQuaternion = readCachedQuaternion(key)
  if (!cachedQuaternion) return

  quaternion.set(cachedQuaternion.x, cachedQuaternion.y, cachedQuaternion.z, cachedQuaternion.w)
}

const writeCachedQuaternion = (key, quaternion) => {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    }))
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

const createControlPointToggle = ({ app, initialVisible, onChange }) => {
  const label = document.createElement('label')
  const checkbox = document.createElement('input')
  const text = document.createElement('span')

  checkbox.type = 'checkbox'
  checkbox.checked = initialVisible
  text.textContent = '控制点'
  Object.assign(label.style, {
    position: 'absolute',
    right: '6px',
    top: '14px',
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

const createControlTargetIndicator = ({ app, initialTarget }) => {
  const element = document.createElement('div')
  const labels = {
    camera: '镜头',
    player: 'Player',
  }

  Object.assign(element.style, {
    position: 'absolute',
    right: '6px',
    top: '40px',
    zIndex: '10',
    display: 'none',
    padding: '8px 10px',
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
  app.append(element)

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

const createResetButton = ({ app, label = '重置视角', onReset }) => {
  const button = document.createElement('button')
  button.textContent = label
  applyButtonStyle(button)
  Object.assign(button.style, {
    position: 'absolute',
    right: '14px',
    top: '196px',
    zIndex: '10',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    padding: '0px 12px',
  })

  const stopPointerLock = (event) => {
    event.stopPropagation()
  }

  button.addEventListener('pointerdown', stopPointerLock)
  button.addEventListener('click', onReset)
  app.append(button)

  return {
    element: button,
    syncCursorVisible: (visible) => {
      button.style.display = visible ? 'inline-flex' : 'none'
    },
    dispose: () => {
      button.removeEventListener('pointerdown', stopPointerLock)
      button.removeEventListener('click', onReset)
      button.remove()
    },
  }
}

const createToast = ({ app }) => {
  const element = document.createElement('div')
  let hideTimer = 0

  Object.assign(element.style, {
    position: 'absolute',
    right: '14px',
    top: '14px',
    zIndex: '20',
    display: 'none',
    padding: '8px 14px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.86)',
    color: '#eef5ee',
    fontSize: '14px',
    pointerEvents: 'none',
    border: '1px solid rgba(238, 245, 238, 0.16)',
  })
  app.append(element)

  return {
    show: (message) => {
      window.clearTimeout(hideTimer)
      element.textContent = message
      element.style.display = 'block'
      hideTimer = window.setTimeout(() => {
        element.style.display = 'none'
      }, 1600)
    },
    dispose: () => {
      window.clearTimeout(hideTimer)
      element.remove()
    },
  }
}

const createMapEditHint = ({ app }) => {
  const element = document.createElement('div')

  element.textContent = 'Cmd+S 保存  |  Cmd+P 地图设置'
  Object.assign(element.style, {
    position: 'absolute',
    right: '14px',
    top: '14px',
    zIndex: '10',
    display: 'none',
    padding: '7px 12px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.76)',
    color: '#eef5ee',
    fontSize: '14px',
    userSelect: 'none',
    pointerEvents: 'none',
    border: '1px solid rgba(238, 245, 238, 0.16)',
  })
  app.append(element)

  return {
    setVisible: (nextVisible) => {
      element.style.display = nextVisible ? 'block' : 'none'
    },
    dispose: () => {
      element.remove()
    },
  }
}

const createMapEditTargetHint = ({ app }) => {
  const element = document.createElement('div')

  element.textContent = '按 E 编辑'
  Object.assign(element.style, {
    position: 'absolute',
    left: '50%',
    bottom: '14px',
    zIndex: '10',
    display: 'none',
    padding: '7px 12px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.76)',
    color: '#eef5ee',
    fontSize: '14px',
    transform: 'translateX(-50%)',
    userSelect: 'none',
    pointerEvents: 'none',
    border: '1px solid rgba(238, 245, 238, 0.16)',
  })
  app.append(element)

  return {
    setVisible: (visible) => {
      element.style.display = visible ? 'block' : 'none'
    },
    dispose: () => {
      element.remove()
    },
  }
}

const createMapSettingsPanel = ({ app, getMapData, onImport }) => {
  const panel = document.createElement('section')
  const title = document.createElement('div')
  const textarea = document.createElement('textarea')
  const actions = document.createElement('div')
  const exportButton = document.createElement('button')
  const importButton = document.createElement('button')
  const closeButton = document.createElement('button')
  let visible = false

  title.textContent = '地图设置'
  textarea.placeholder = '地图 JSON 数据'
  exportButton.textContent = '导出'
  importButton.textContent = '导入'
  closeButton.textContent = '关闭'
  ;[exportButton, importButton, closeButton].forEach((button) => {
    applyButtonStyle(button)
  })
  Object.assign(panel.style, {
    position: 'absolute',
    left: '50%',
    top: '58px',
    zIndex: '20',
    display: 'none',
    width: '520px',
    maxWidth: 'calc(100vw - 28px)',
    padding: '12px',
    border: '1px solid rgba(238, 245, 238, 0.18)',
    borderRadius: '8px',
    background: '#07111f',
    color: '#eef5ee',
    fontSize: '14px',
    transform: 'translateX(-50%)',
    userSelect: 'none',
  })
  Object.assign(title.style, {
    marginBottom: '10px',
    fontSize: '15px',
    fontWeight: '600',
  })
  Object.assign(textarea.style, {
    boxSizing: 'border-box',
    width: '100%',
    height: '260px',
    padding: '8px',
    border: '1px solid rgba(238, 245, 238, 0.24)',
    borderRadius: '5px',
    background: 'rgba(7, 17, 31, 0.88)',
    color: '#eef5ee',
    font: '12px monospace',
    resize: 'vertical',
  })
  Object.assign(actions.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '10px',
  })
  actions.append(exportButton, importButton, closeButton)
  panel.append(title, textarea, actions)
  app.append(panel)

  const setVisible = (nextVisible) => {
    visible = nextVisible
    panel.style.display = visible ? 'block' : 'none'
    if (visible) textarea.focus()
  }
  const stopPointerLock = (event) => {
    event.stopPropagation()
  }
  const handleExport = () => {
    textarea.value = JSON.stringify(getMapData(), null, 2)
    textarea.focus()
    textarea.select()
  }
  const handleImport = () => {
    onImport(JSON.parse(textarea.value))
  }

  panel.addEventListener('pointerdown', stopPointerLock)
  panel.addEventListener('click', stopPointerLock)
  exportButton.addEventListener('click', handleExport)
  importButton.addEventListener('click', handleImport)
  closeButton.addEventListener('click', () => setVisible(false))

  return {
    toggle: () => setVisible(!visible),
    dispose: () => {
      panel.removeEventListener('pointerdown', stopPointerLock)
      panel.removeEventListener('click', stopPointerLock)
      exportButton.removeEventListener('click', handleExport)
      importButton.removeEventListener('click', handleImport)
      panel.remove()
    },
  }
}

const createMapEditButton = ({ app, onToggle }) => {
  const button = document.createElement('button')
  let active = false

  button.textContent = '地图编辑 Cmd+M'
  applyButtonStyle(button)
  Object.assign(button.style, {
    position: 'absolute',
    right: '14px',
    top: '156px',
    zIndex: '10',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    fontSize: '14px',
    padding: '0px 12px',
  })

  const syncActiveStyle = () => {
    button.textContent = active ? '退出地图编辑 Cmd+M' : '地图编辑 Cmd+M'
    button.style.background = active ? 'rgba(59, 130, 246, 0.72)' : 'rgba(238, 245, 238, 0.1)'
  }
  const stopPointerLock = (event) => {
    event.stopPropagation()
  }
  const handleClick = () => {
    active = !active
    syncActiveStyle()
    onToggle(active)
  }

  syncActiveStyle()
  button.addEventListener('pointerdown', stopPointerLock)
  button.addEventListener('click', handleClick)
  app.append(button)

  return {
    setActive: (nextActive) => {
      if (active === nextActive) return

      active = nextActive
      syncActiveStyle()
    },
    syncCursorVisible: (visible) => {
      button.style.display = visible ? 'inline-flex' : 'none'
    },
    dispose: () => {
      button.removeEventListener('pointerdown', stopPointerLock)
      button.removeEventListener('click', handleClick)
      button.remove()
    },
  }
}

const normalizeMapEditDirection = (from, to) => {
  const x = to.x - from.x
  const z = to.z - from.z
  const length = Math.hypot(x, z) || 1

  return { x: x / length, z: z / length }
}

const createMapEditNormal = (direction) => ({
  x: -direction.z,
  z: direction.x,
})

const createMapEditWallShapePoints = (points, width) => {
  const halfWidth = width / 2
  const left = []
  const right = []

  points.forEach((point, index) => {
    const previous = points[index - 1]
    const next = points[index + 1]
    const previousDirection = previous ? normalizeMapEditDirection(previous, point) : null
    const nextDirection = next ? normalizeMapEditDirection(point, next) : null
    const normal = !previousDirection || !nextDirection
      ? createMapEditNormal(nextDirection ?? previousDirection)
      : (() => {
        const tangent = {
          x: previousDirection.x + nextDirection.x,
          z: previousDirection.z + nextDirection.z,
        }
        const tangentLength = Math.hypot(tangent.x, tangent.z)
        if (tangentLength < 0.0001) return createMapEditNormal(nextDirection)

        const miter = createMapEditNormal({
          x: tangent.x / tangentLength,
          z: tangent.z / tangentLength,
        })
        const nextNormal = createMapEditNormal(nextDirection)
        const scale = halfWidth / Math.max(0.2, Math.abs(miter.x * nextNormal.x + miter.z * nextNormal.z))

        return {
          x: miter.x * scale / halfWidth,
          z: miter.z * scale / halfWidth,
        }
      })()

    left.push([point.x + normal.x * halfWidth, point.z + normal.z * halfWidth])
    right.unshift([point.x - normal.x * halfWidth, point.z - normal.z * halfWidth])
  })

  return [...left, ...right]
}

const createMapEditWallGeometry = (points, wallSize) => {
  const shapePoints = createMapEditWallShapePoints(points, wallSize.width)
  const shape = new Shape()

  shape.moveTo(shapePoints[0][0], -shapePoints[0][1])
  shapePoints.slice(1).forEach(([x, z]) => {
    shape.lineTo(x, -z)
  })
  shape.lineTo(shapePoints[0][0], -shapePoints[0][1])

  return new ExtrudeGeometry(shape, {
    depth: wallSize.height,
    bevelEnabled: false,
  })
}

const createMapEditAimPoint = ({ scene, targets, initialMapData, initialWallTargets }) => {
  const activeWallColor = '#b46a24'
  const finalWallColor = '#2f3336'
  const screenCenter = new Vector2(0, 0)
  const raycaster = new Raycaster()
  const paths = []
  const markGeometry = new SphereGeometry(0.09, 16, 12)
  const activeMarkMaterial = new MeshBasicMaterial({ color: activeWallColor })
  const finalMarkMaterial = new MeshBasicMaterial({ color: finalWallColor })
  const markerRedMaterial = new MeshBasicMaterial({ color: '#ff1f1f' })
  const markerYellowMaterial = new MeshBasicMaterial({ color: '#ffd34d' })
  const wallSize = {
    width: 0.5,
    height: 1,
  }
  const activeConnectionMaterial = new MeshStandardMaterial({
    color: activeWallColor,
    roughness: 0.9,
    metalness: 0,
  })
  const finalConnectionMaterial = new MeshStandardMaterial({
    color: finalWallColor,
    roughness: 0.9,
    metalness: 0,
  })
  const marker = new Mesh(
    new SphereGeometry(0.07, 16, 12),
    markerRedMaterial,
  )
  let activePath = null
  let hoveredPath = null

  marker.visible = false
  scene.add(marker)

  const getCenterHit = (camera) => {
    raycaster.setFromCamera(screenCenter, camera)
    const pathTargets = paths.map((path) => path.connection).filter((connection) => connection.visible)
    const pathHit = raycaster.intersectObjects(pathTargets, false)[0] ?? null
    if (pathHit) {
      hoveredPath = paths.find((path) => path.connection === pathHit.object) ?? null
      return pathHit
    }

    const targetHit = raycaster.intersectObjects(targets, false)[0] ?? null
    hoveredPath = targetHit ? paths.find((path) => path.sourceTarget === targetHit.object) ?? null : null

    return targetHit
  }

  const createPath = ({ editable = true } = {}) => {
    const connection = new Mesh(
      new BufferGeometry(),
      editable ? activeConnectionMaterial : finalConnectionMaterial,
    )
    connection.visible = false
    connection.rotation.x = -Math.PI / 2
    connection.position.y = 0.02
    scene.add(connection)

    const path = {
      points: [],
      marks: [],
      wallSize: { ...wallSize },
      connection,
      sourceTarget: null,
      finalized: !editable,
    }
    paths.push(path)
    if (editable) activePath = path
    return path
  }

  const updateConnection = (path) => {
    path.connection.geometry?.dispose()
    path.connection.visible = path.points.length > 1
    if (!path.connection.visible) {
      path.connection.geometry = new BufferGeometry()
      return
    }

    // 连接线按地图平面投影成低矮墙体，保持和地图墙体一致的实体渲染方式。
    path.connection.geometry = createMapEditWallGeometry(path.points, path.wallSize)
  }

  const getSavablePaths = () => paths.filter((path) => path.points.length > 1)

  const setPathEditing = (path) => {
    if (activePath && activePath !== path && activePath.points.length > 1) {
      finalizeActivePath()
    }
    activePath = path
    activePath.finalized = false
    activePath.marks.forEach((mark) => {
      mark.material = activeMarkMaterial
    })
    activePath.connection.material = activeConnectionMaterial
  }

  const finalizeActivePath = () => {
    if (!activePath || activePath.points.length < 2) return false

    activePath.finalized = true
    activePath.marks.forEach((mark) => {
      mark.material = finalMarkMaterial
    })
    activePath.connection.material = finalConnectionMaterial
    activePath = null
    return true
  }

  ;(initialMapData?.walls ?? []).forEach((wall, index) => {
    const path = createPath({ editable: false })
    path.sourceTarget = initialWallTargets[index] ?? null
    if (path.sourceTarget) {
      path.sourceTarget.visible = false
    }
    path.wallSize = { width: wall.width, height: wall.height }
    path.points = wall.path.map(([x, z]) => new Vector3(
      x + wall.position[0],
      wall.position[1],
      z + wall.position[2],
    ))
    updateConnection(path)
  })

  return {
    scaleWall: ({ width = 1, height = 1 }) => {
      wallSize.width *= width
      wallSize.height *= height
      if (activePath) {
        activePath.wallSize = { ...wallSize }
        updateConnection(activePath)
      }
      return { ...wallSize }
    },
    deleteActiveLastNode: () => {
      if (!activePath || activePath.points.length === 0) return false

      const mark = activePath.marks.pop()
      if (mark) scene.remove(mark)
      activePath.points.pop()

      if (activePath.points.length === 0) {
        scene.remove(activePath.connection)
        activePath.connection.geometry?.dispose()
        if (activePath.sourceTarget) {
          activePath.sourceTarget.visible = false
        }
        paths.splice(paths.indexOf(activePath), 1)
        activePath = null
        hoveredPath = null
        return true
      }

      updateConnection(activePath)
      return true
    },
    finalizeActivePath,
    isHoveringEditableTarget: () => Boolean(hoveredPath && hoveredPath !== activePath),
    selectHoveredPath: () => {
      if (!hoveredPath) return false

      setPathEditing(hoveredPath)
      return true
    },
    setVisible: (visible) => {
      marker.visible = visible
    },
    update: (camera) => {
      const hit = getCenterHit(camera)
      marker.visible = Boolean(hit)
      if (!hit) return

      marker.material = hoveredPath ? markerYellowMaterial : markerRedMaterial
      marker.position.copy(hit.point)
    },
    addMark: (camera) => {
      const hit = getCenterHit(camera)
      if (!hit) return null

      const point = hit.point.clone()
      const path = activePath ?? createPath()
      const mark = new Mesh(markGeometry, activeMarkMaterial)
      mark.position.copy(point)
      scene.add(mark)
      path.points.push(point)
      path.marks.push(mark)
      updateConnection(path)

      return point
    },
    moveActivePath: (offset) => {
      const path = activePath ?? hoveredPath
      if (!path) return

      path.points.forEach((point, index) => {
        point.add(offset)
        if (path.marks[index]) {
          path.marks[index].position.copy(point)
        }
      })
      updateConnection(path)
    },
    createMapData: () => {
      const savablePaths = getSavablePaths()
      if (savablePaths.length === 0) return null

      return {
        type: 'qixing-town:map',
        version: 1,
        walls: savablePaths.map((path, index) => ({
          id: `edited-wall-${Date.now().toString(36)}-${index + 1}`,
          label: `编辑墙体 ${index + 1}`,
          path: path.points.map((point) => [
              Number(point.x.toFixed(3)),
              Number(point.z.toFixed(3)),
          ]),
          width: path.wallSize.width,
          height: path.wallSize.height,
          position: [0, 0, 0],
          color: finalWallColor,
        })),
      }
    },
    dispose: () => {
      paths.forEach((path) => {
        path.marks.forEach((mark) => {
          scene.remove(mark)
        })
        scene.remove(path.connection)
        path.connection.geometry?.dispose()
      })
      scene.remove(marker)
      activeConnectionMaterial.dispose()
      finalConnectionMaterial.dispose()
      marker.geometry.dispose()
      markerRedMaterial.dispose()
      markerYellowMaterial.dispose()
      markGeometry.dispose()
      activeMarkMaterial.dispose()
      finalMarkMaterial.dispose()
    },
  }
}

const createCoordinatesIndicator = ({ app }) => {
  const element = document.createElement('div')
  Object.assign(element.style, {
    position: 'absolute',
    left: '14px',
    bottom: '14px',
    zIndex: '10',
    display: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '12px',
    fontFamily: 'monospace',
    whiteSpace: 'pre',
    userSelect: 'none',
    pointerEvents: 'none',
    lineHeight: '1.6',
    border: '1px solid rgba(238, 245, 238, 0.12)',
  })

  app.append(element)

  return {
    update: (cameraPos, cameraRotation, playerPos) => {
      const rotationX = (cameraRotation.x * 180 / Math.PI).toFixed(1)
      const rotationY = (cameraRotation.y * 180 / Math.PI).toFixed(1)
      const rotationZ = (cameraRotation.z * 180 / Math.PI).toFixed(1)

      element.textContent = `相机 X:${cameraPos.x.toFixed(2)} Y:${cameraPos.y.toFixed(2)} Z:${cameraPos.z.toFixed(2)}\n旋转 X:${rotationX} Y:${rotationY} Z:${rotationZ}\n玩家 X:${playerPos.x.toFixed(2)} Y:${playerPos.y.toFixed(2)} Z:${playerPos.z.toFixed(2)}`
    },
    syncCursorVisible: (visible) => {
      element.style.display = visible ? 'block' : 'none'
    },
    dispose: () => {
      element.remove()
    },
  }
}

const createFpsIndicator = ({ app }) => {
  const element = document.createElement('div')
  const label = document.createElement('span')
  const value = document.createElement('strong')
  let frameCount = 0
  let elapsed = 0

  label.textContent = 'FPS'
  value.textContent = '--'
  Object.assign(element.style, {
    position: 'absolute',
    left: '14px',
    top: '14px',
    zIndex: '10',
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '8px',
    minWidth: '74px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgba(7, 17, 31, 0.72)',
    color: '#eef5ee',
    fontSize: '12px',
    fontFamily: 'monospace',
    userSelect: 'none',
    pointerEvents: 'none',
    border: '1px solid rgba(238, 245, 238, 0.12)',
  })
  Object.assign(label.style, {
    color: 'rgba(238, 245, 238, 0.66)',
    fontWeight: '400',
  })
  Object.assign(value.style, {
    color: '#39ff14',
    fontSize: '16px',
    fontWeight: '700',
    lineHeight: '1',
  })

  element.append(label, value)
  app.append(element)

  return {
    update: (delta) => {
      frameCount += 1
      elapsed += delta
      if (elapsed < 0.5) return

      // 半秒采样一次，降低 DOM 更新频率同时保留即时性。
      value.textContent = String(Math.round(frameCount / elapsed))
      frameCount = 0
      elapsed = 0
    },
    dispose: () => {
      element.remove()
    },
  }
}

const createCamera = () => {
  const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500)
  camera.position.set(0.12, 9.97, 0.82)
  camera.rotation.set(-51.9 * Math.PI / 180, 0.4 * Math.PI / 180, 0.5 * Math.PI / 180)
  return camera
}

export const createSceneApp = async (app) => {
  if (!app) {
    throw new Error('Missing #app root element.')
  }

  const scene = new Scene()
  const camera = createCamera()
  applyCachedPosition(camera.position, CAMERA_POSITION_STORAGE_KEY)
  applyCachedQuaternion(camera.quaternion, CAMERA_QUATERNION_STORAGE_KEY)
  const renderer = createRenderer(app)
  const initialMapData = readMapData()
  const environment = createEnvironment(scene, initialMapData)
  applyCachedPosition(environment.player.position, PLAYER_POSITION_STORAGE_KEY)
  const physics = await createPhysicsWorld({
    wallMeshes: environment.wallColliders,
    playerPosition: environment.player.position,
  })
  if (physics.isPlayerOverlapping(environment.player.position)) {
    // 缓存位置可能来自旧碰撞逻辑，落在墙里时回到出生点避免开局卡住。
    environment.player.position.set(...environment.playerSpawn)
  }
  let mapEditActive = false
  const playerController = createPlayerController({
    camera,
    player: environment.player,
    domElement: renderer.domElement,
    physics,
    setPlayerRunSequenceActive: (active) => {
      const sequence = BUILTIN_SEQUENCES.find((s) => s.label === '奔跑')
      if (!sequence) return

      if (active) {
        if (!isActionSequenceActive(sequence.id)) {
          startActionSequence(sequence)
        }
      } else {
        stopActionSequence(sequence.id)
      }
    },
    initialControlTarget: readControlTarget(),
  })
  const controlPointsVisible = readControlPointsVisible()
  environment.setPlayerControlPointsVisible(controlPointsVisible)
  const controlPointToggle = createControlPointToggle({
    app,
    initialVisible: controlPointsVisible,
    onChange: (visible) => {
      environment.setPlayerControlPointsVisible(visible)
      writeControlPointsVisible(visible)
    },
  })
  const controlTargetIndicator = createControlTargetIndicator({
    app,
    initialTarget: playerController.getControlTarget(),
  })
  const coordinatesIndicator = createCoordinatesIndicator({ app })
  const fpsIndicator = createFpsIndicator({ app })
  const toast = createToast({ app })
  let shouldWriteCachedPositions = true
  const resetButton = createResetButton({
    app,
    label: '全部重置',
    onReset: () => {
      if (!confirm('确定要清空所有自定义动作、序列并重置视角吗？该操作不可撤销。')) return

      shouldWriteCachedPositions = false
      // 清除所有以 qixing-town: 开头的存储项
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith('qixing-town:')) {
          window.localStorage.removeItem(key)
        }
      })

      // 重新加载页面以恢复初始状态
      window.location.reload()
    },
  })
  const actionSettingsPanel = createActionSettingsPanel({
    app,
  })
  const actionSequencePanel = createActionSequencePanel({ app })
  const mapEditHint = createMapEditHint({ app })
  const mapEditTargetHint = createMapEditTargetHint({ app })
  let mapEditButton = null
  const mapEditAimPoint = createMapEditAimPoint({
    scene,
    targets: environment.mapHitTargets,
    initialMapData,
    initialWallTargets: environment.mapWallTargets,
  })
  const setMapEditActive = (active) => {
    mapEditActive = active
    mapEditButton?.setActive(active)
    mapEditAimPoint.setVisible(active)
    mapEditHint.setVisible(active)
    if (!active) {
      mapEditTargetHint.setVisible(false)
    }
  }
  mapEditButton = createMapEditButton({
    app,
    onToggle: (active) => {
      setMapEditActive(active)

      const target = playerController.setControlTarget(active ? 'camera' : 'player')
      writeControlTarget(target)
      controlTargetIndicator.setTarget(target)
    },
  })
  const getCurrentMapData = () => mapEditAimPoint.createMapData() ?? {
    type: 'qixing-town:map',
    version: 1,
    walls: [],
  }
  const mapSettingsPanel = createMapSettingsPanel({
    app,
    getMapData: getCurrentMapData,
    onImport: (data) => {
      writeMapData(data)
      toast.show('地图导入成功')
      window.setTimeout(() => {
        window.location.reload()
      }, 500)
    },
  })
  const actionSequenceState = {
    activeSequences: [],
    activeAction: null,
    positionOffset: new Vector3(),
    actionSignature: '',
  }

  const clearActionSequencePositionOffset = () => {
    if (actionSequenceState.positionOffset.lengthSq() === 0) return

    environment.player.position.sub(actionSequenceState.positionOffset)
    actionSequenceState.positionOffset.set(0, 0, 0)
  }

  const clearActionSequenceState = () => {
    clearActionSequencePositionOffset()
    actionSequenceState.activeSequences = []
    actionSequenceState.activeAction = null
    actionSequenceState.actionSignature = ''
  }

  const isActionSequenceActive = (sequenceId) => (
    actionSequenceState.activeSequences.some((sequence) => sequence.id === sequenceId)
  )

  const createActionsById = () => {
    const allActions = [
      ...BUILTIN_ACTIONS,
      ...readUserActions(),
    ]
    return new Map(allActions.map((action) => {
      if (action.isMirrored && action.sourceId && (!action.controls || action.controls.length === 0)) {
        const source = allActions.find((a) => a.id === action.sourceId)
        if (source) {
          const controls = (source.controls || []).map((control) => ({
            ...control,
            bone: control.bone.endsWith('Left') ? control.bone.replace('Left', 'Right') : 
                  control.bone.endsWith('Right') ? control.bone.replace('Right', 'Left') : control.bone
          }))
          return [action.id, { ...action, controls }]
        }
      }
      return [action.id, action]
    }))
  }

  const createSequenceSteps = (sequence, visitedSequenceIds = new Set()) => {
    const actionsById = createActionsById()
    const sequencesById = new Map([
      ...BUILTIN_SEQUENCES.map((item) => [item.id, normalizeActionSequence(item)]),
      ...readUserActionSequences().map((item) => [item.id, item]),
    ])
    const nextVisitedSequenceIds = new Set([...visitedSequenceIds, sequence.id])

    return normalizeActionSequence(sequence).steps.flatMap((step) => {
      if (step.type === 'action') {
        const action = actionsById.get(step.targetId)

        return action
          ? [{
            action,
            duration: Number.isFinite(step.duration)
              ? Math.max(0, step.duration)
              : DEFAULT_ACTION_SEQUENCE_STEP_DURATION,
          }]
          : []
      }

      if (step.type === 'sequence') {
        const nestedSequence = sequencesById.get(step.targetId)
        // 嵌套序列只展开步骤，不继承循环；已访问集合用于阻止循环引用。
        if (!nestedSequence || nextVisitedSequenceIds.has(nestedSequence.id)) return []

        const repeat = Math.max(1, Math.floor(step.repeat))
        const nestedSteps = createSequenceSteps(nestedSequence, nextVisitedSequenceIds)

        return Array.from({ length: repeat }).flatMap(() => nestedSteps)
      }

      if (step.type === 'delay') {
        return [{
          action: null,
          duration: Number.isFinite(step.duration)
            ? Math.max(0, step.duration)
            : DEFAULT_ACTION_SEQUENCE_STEP_DURATION,
        }]
      }

      if (step.type === 'position') {
        return [{
          action: null,
          position: {
            axis: step.axis ?? step.targetId,
            amount: Number.isFinite(step.amount) ? step.amount : 0,
          },
          duration: Number.isFinite(step.duration)
            ? Math.max(0, step.duration)
            : DEFAULT_ACTION_SEQUENCE_STEP_DURATION,
        }]
      }

      return []
    })
  }

  const createSequenceTracks = (sequence) => {
    const normalizedSequence = normalizeActionSequence(sequence)
    const tracks = normalizedSequence.tracks.map((track) => ({
      id: track.id,
      label: track.label,
      loop: track.loop === true,
      steps: createSequenceSteps({ ...normalizedSequence, tracks: undefined, steps: track.steps }),
      index: 0,
      elapsed: 0,
      done: false,
      positionOffset: new Vector3(),
    })).filter((track) => track.steps.length > 0)

    return tracks
  }

  const getControlBones = (control) => (
    PLAYER_MODEL_RIG.controlGroupsByKey[control.bone] ?? [control.bone]
  )

  const createComposedAction = () => {
    const controlsByBone = new Map()
    const applyActionControls = (action) => {
      if (!action || action.type === 'ik') return

      const nextControlsByBone = new Map()
      ;(action.controls || []).forEach((control) => {
        getControlBones(control).forEach((bone) => {
          const controls = nextControlsByBone.get(bone) ?? []
          controls.push({
            ...control,
            bone,
          })
          nextControlsByBone.set(bone, controls)
        })
      })
      nextControlsByBone.forEach((controls, bone) => {
        controlsByBone.set(bone, controls)
      })
    }

    actionSequenceState.activeSequences.forEach((activeSequence) => {
      activeSequence.tracks.forEach((track) => {
        const step = track.steps[track.index]

        applyActionControls(step?.action)
      })
    })
    // 普通动作作为最后一层，覆盖序列里的同骨骼控制，但不影响未控制骨骼。
    applyActionControls(actionSequenceState.activeAction)

    const controls = [...controlsByBone.values()].flat()
    if (controls.length === 0) return null

    return {
      id: COMPOSED_ACTION_ID,
      label: '动作序列叠加',
      type: 'fk',
      controls,
      ikTargets: [],
    }
  }

  const createComposedActionSignature = () => actionSequenceState.activeSequences
    .map((activeSequence) => activeSequence.tracks.map((track) => {
      const step = track.steps[track.index]

      return step?.action ? `${activeSequence.id}:${track.id}:${step.action.id}` : `${activeSequence.id}:${track.id}:`
    }).join('|'))
    .join('|')
    + (actionSequenceState.activeAction ? `|action:${actionSequenceState.activeAction.id}` : '')

  const playComposedActionSequence = (transitionDuration = DEFAULT_ACTION_SEQUENCE_STEP_DURATION) => {
    const action = createComposedAction()
    if (!action) {
      environment.cancelPlayerUserAction()
      return
    }

    environment.playPlayerUserAction(action, {
      transitionDuration,
    })
  }

  const applySequencePositionDelta = (track, { axis, amount }) => {
    if (!['x', 'y', 'z'].includes(axis) || amount === 0) return

    track.positionOffset[axis] += amount
  }

  const createTrackPositionOffset = (track) => {
    const offset = new Vector3()

    if (track.positionOffset.x !== 0 || track.positionOffset.z !== 0) {
      const localOffset = new Vector3(track.positionOffset.x, 0, track.positionOffset.z)

      localOffset.applyQuaternion(environment.player.quaternion)
      offset.add(localOffset)
    }
    offset.y = track.positionOffset.y

    return offset
  }

  const syncActionSequencePositionOffset = () => {
    environment.player.position.sub(actionSequenceState.positionOffset)
    actionSequenceState.positionOffset.set(0, 0, 0)
    actionSequenceState.activeSequences.forEach((activeSequence) => {
      activeSequence.tracks.forEach((track) => {
        actionSequenceState.positionOffset.add(createTrackPositionOffset(track))
      })
    })
    environment.player.position.add(actionSequenceState.positionOffset)
  }

  const startActionSequence = (sequence) => {
    clearActionSequencePositionOffset()
    const sequenceTracks = createSequenceTracks(sequence)
    if (sequenceTracks.length === 0) return
    const hasActiveSequence = actionSequenceState.activeSequences.length > 0

    actionSequenceState.activeSequences = [
      ...actionSequenceState.activeSequences.filter((item) => item.id !== sequence.id),
      {
        id: sequence.id,
        tracks: sequenceTracks,
      },
    ]
    syncActionSequencePositionOffset()
    actionSequenceState.actionSignature = createComposedActionSignature()
    playComposedActionSequence(hasActiveSequence
      ? 0
      : Math.max(...sequenceTracks.map((track) => (
        track.steps[track.index]?.action ? track.steps[track.index].duration ?? 0 : 0
      )))
    )
  }

  const stopActionSequence = (sequenceId) => {
    if (!isActionSequenceActive(sequenceId)) return

    clearActionSequencePositionOffset()
    actionSequenceState.activeSequences = actionSequenceState.activeSequences
      .filter((sequence) => sequence.id !== sequenceId)
    syncActionSequencePositionOffset()
    actionSequenceState.actionSignature = createComposedActionSignature()
    playComposedActionSequence(0)
  }

  const setComposedUserAction = (action) => {
    actionSequenceState.activeAction = action
    actionSequenceState.actionSignature = createComposedActionSignature()
    playComposedActionSequence(0)
  }

  const clearComposedUserAction = () => {
    if (!actionSequenceState.activeAction) return

    actionSequenceState.activeAction = null
    actionSequenceState.actionSignature = createComposedActionSignature()
    playComposedActionSequence(0)
  }

  const updateActionSequence = (delta) => {
    if (actionSequenceState.activeSequences.length === 0) return

    clearActionSequencePositionOffset()

    const sequencesById = new Map([
      ...BUILTIN_SEQUENCES.map(normalizeActionSequence),
      ...readUserActionSequences(),
    ].map((sequence) => [sequence.id, sequence]))

    let actionChanged = false
    let transitionDuration = 0
    const nextActiveSequences = []

    actionSequenceState.activeSequences.forEach((activeSequence) => {
      const sequence = sequencesById.get(activeSequence.id)
      if (!sequence) {
        actionChanged = true
        return
      }

      activeSequence.tracks.forEach((track) => {
        if (track.done) return

        let remainingDelta = delta
        let guard = 0
        while (guard < 100 && remainingDelta >= 0 && !track.done) {
          const currentStep = track.steps[track.index]
          const duration = currentStep?.duration ?? 0
          if (!currentStep) break

          if (duration > 0) {
            const remainingDuration = Math.max(0, duration - track.elapsed)
            const consumed = Math.min(remainingDelta, remainingDuration)
            if (currentStep.position) {
              applySequencePositionDelta(track, {
                axis: currentStep.position.axis,
                amount: currentStep.position.amount * (consumed / duration),
              })
            }
            track.elapsed += consumed
            remainingDelta -= consumed
            if (track.elapsed < duration) break
          } else if (currentStep.position) {
            applySequencePositionDelta(track, currentStep.position)
          }

          track.elapsed = duration > 0 ? track.elapsed - duration : 0
          track.index += 1
          if (track.index >= track.steps.length) {
            if (track.loop || sequence.loop) {
              track.index = 0
              track.positionOffset.set(0, 0, 0)
            } else {
              track.index = track.steps.length - 1
              track.done = true
            }
          }
          const nextStep = track.steps[track.index]
          if (currentStep.action !== nextStep?.action) {
            actionChanged = true
            transitionDuration = Math.max(transitionDuration, nextStep?.action ? nextStep.duration ?? 0 : 0)
          }
          guard += 1
          if (remainingDelta === 0 && duration > 0) break
        }
      })

      if (activeSequence.tracks.every((track) => track.done)) {
        actionChanged = true
        return
      }
      nextActiveSequences.push(activeSequence)
    })

    actionSequenceState.activeSequences = nextActiveSequences
    syncActionSequencePositionOffset()
    const nextActionSignature = createComposedActionSignature()
    if (nextActionSignature !== actionSequenceState.actionSignature) {
      actionSequenceState.actionSignature = nextActionSignature
      playComposedActionSequence(actionChanged ? transitionDuration : 0)
    }
  }

  const createUserActionWheelActions = () => readUserActions().map((action) => ({
    label: action.label,
    isActive: () => actionSequenceState.activeAction?.id === action.id
      || environment.playerState.userActionId === action.id,
    toggle: () => {
      if (actionSequenceState.activeSequences.length > 0) {
        if (actionSequenceState.activeAction?.id === action.id) {
          clearComposedUserAction()
          return
        }

        setComposedUserAction(action)
        return
      }

      if (environment.playerState.userActionId === action.id) {
        environment.cancelPlayerUserAction()
        return
      }

      clearActionSequenceState()
      environment.playPlayerUserAction(action)
    },
  }))
  const createUserActionSequenceWheelActions = () => readUserActionSequences().map((sequence) => ({
    label: `序列：${sequence.label}`,
    isActive: () => isActionSequenceActive(sequence.id),
    toggle: () => {
      if (isActionSequenceActive(sequence.id)) {
        stopActionSequence(sequence.id)
        return
      }

      startActionSequence(sequence)
    },
  }))
  const createPlayerActionWheel = () => createActionWheel({
    scene,
    camera,
    domElement: renderer.domElement,
    actions: [
      ...createUserActionWheelActions(),
      ...createUserActionSequenceWheelActions(),
    ],
    onOpenChange: (open) => {
      playerController.controls.enabled = !open
    },
  })
  let actionWheel = createPlayerActionWheel()
  const timer = new Timer()
  timer.connect(document)

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const onKeyDown = (event) => {
    if (event.repeat) return

    if (mapEditActive && event.metaKey && event.code === 'KeyS') {
      event.preventDefault()
      const mapData = mapEditAimPoint.createMapData()
      if (!mapData) {
        console.warn('地图编辑保存失败：至少需要一条完整路径')
        return
      }

      writeMapData(mapData)
      toast.show('地图保存成功')
      console.log('地图已保存到本地', mapData)
      return
    }

    if (event.metaKey && event.code === 'KeyM') {
      event.preventDefault()
      setMapEditActive(!mapEditActive)
      const target = playerController.setControlTarget(mapEditActive ? 'camera' : 'player')
      writeControlTarget(target)
      controlTargetIndicator.setTarget(target)
      return
    }

    if (event.metaKey && event.code === 'KeyP') {
      event.preventDefault()
      mapSettingsPanel.toggle()
      return
    }

    if (mapEditActive && event.code === 'KeyE') {
      event.preventDefault()
      if (mapEditAimPoint.selectHoveredPath()) {
        toast.show('已选中路径')
      }
      return
    }

    if (mapEditActive && (event.code === 'Delete' || event.code === 'Backspace')) {
      event.preventDefault()
      if (mapEditAimPoint.deleteActiveLastNode()) {
        console.log('地图编辑已删除最后一个节点')
      }
      return
    }

    if (mapEditActive && event.code === 'Enter') {
      event.preventDefault()
      if (!mapEditAimPoint.finalizeActivePath()) {
        console.warn('地图编辑路径完成失败：至少需要两个连接点')
        return
      }

      console.log('地图编辑路径已完成')
      return
    }

    if (mapEditActive && playerController.controls.isLocked) {
      const wallSizeScaleByKey = {
        ArrowUp: { height: 2 },
        ArrowDown: { height: 0.5 },
        ArrowRight: { width: 2 },
        ArrowLeft: { width: 0.5 },
      }
      const scale = wallSizeScaleByKey[event.code]
      if (scale) {
        event.preventDefault()
        const size = mapEditAimPoint.scaleWall(scale)
        console.log('地图编辑墙体尺寸', {
          width: Number(size.width.toFixed(3)),
          height: Number(size.height.toFixed(3)),
        })
        return
      }
    }

    if (event.code === 'Tab' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      event.preventDefault()
      const target = playerController.toggleControlTarget()

      writeControlTarget(target)
      controlTargetIndicator.setTarget(target)
      if (target !== 'camera' && mapEditActive) {
        setMapEditActive(false)
      }
    }

    if (event.code === 'KeyG') {
      event.preventDefault()
      actionWheel.open()
    }
    if (
      event.code === 'Space'
      && playerController.controls.isLocked
      && playerController.getControlTarget() === 'player'
    ) {
      const sequence = BUILTIN_SEQUENCES.find((s) => s.label === '跳')
      if (!sequence) return

      event.preventDefault()
      startActionSequence(sequence)
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

  const onPlayUserAction = (event) => {
    if (event.detail.preview) {
      environment.previewPlayerUserAction(event.detail.action)
    } else {
      if (actionSequenceState.activeSequences.length > 0) {
        setComposedUserAction(event.detail.action)
        return
      }

      environment.playPlayerUserAction(event.detail.action)
    }
  }

  const rebuildActionWheel = () => {
    const allActions = [...BUILTIN_ACTIONS, ...readUserActions()]
    const allSequences = [...BUILTIN_SEQUENCES, ...readUserActionSequences()]

    if (
      environment.playerState.userActionId
      && environment.playerState.userActionId !== COMPOSED_ACTION_ID
      && !allActions.some((action) => action.id === environment.playerState.userActionId)
    ) {
      environment.cancelPlayerUserAction()
    }
    if (
      actionSequenceState.activeAction
      && !allActions.some((action) => action.id === actionSequenceState.activeAction.id)
    ) {
      actionSequenceState.activeAction = null
    }
    if (
      actionSequenceState.activeSequences.length > 0
      && actionSequenceState.activeSequences.some((activeSequence) => (
        !allSequences.some((sequence) => sequence.id === activeSequence.id)
      ))
    ) {
      clearActionSequencePositionOffset()
      actionSequenceState.activeSequences = actionSequenceState.activeSequences.filter((activeSequence) => (
        allSequences.some((sequence) => sequence.id === activeSequence.id)
      ))
    }
    if (actionSequenceState.activeSequences.length > 0) {
      clearActionSequencePositionOffset()
      actionSequenceState.activeSequences = actionSequenceState.activeSequences.flatMap((activeSequence) => {
        const sequence = allSequences.find((item) => item.id === activeSequence.id)
        const sequenceTracks = sequence ? createSequenceTracks(sequence) : []

        return sequenceTracks.length > 0
          ? [{ ...activeSequence, tracks: sequenceTracks }]
          : []
      })
      syncActionSequencePositionOffset()
      actionSequenceState.actionSignature = createComposedActionSignature()
      playComposedActionSequence()
    }
    actionWheel.close()
    actionWheel.dispose()
    actionWheel = createPlayerActionWheel()
  }

  const writeCachedPositions = () => {
    if (!shouldWriteCachedPositions) return

    writeCachedPosition(CAMERA_POSITION_STORAGE_KEY, camera.position)
    writeCachedQuaternion(CAMERA_QUATERNION_STORAGE_KEY, camera.quaternion)
    writeCachedPosition(PLAYER_POSITION_STORAGE_KEY, environment.player.position)
  }

  const handleMapEditClick = () => {
    if (!mapEditActive) return
    if (!playerController.controls.isLocked) return

    const point = mapEditAimPoint.addMark(camera)
    if (!point) return

    console.log('地图编辑点击点', {
      x: Number(point.x.toFixed(3)),
      y: Number(point.y.toFixed(3)),
      z: Number(point.z.toFixed(3)),
    })
  }

  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('beforeunload', writeCachedPositions)
  renderer.domElement.addEventListener('click', handleMapEditClick)
  app.addEventListener('qixing-town:play-action', onPlayUserAction)
  app.addEventListener('qixing-town:user-actions-changed', rebuildActionWheel)
  app.addEventListener('qixing-town:action-sequences-changed', rebuildActionWheel)

  let animationFrameId = 0
  let positionCacheElapsed = 0

  const renderFrame = (timestamp) => {
    timer.update(timestamp)
    const delta = timer.getDelta()

    playerController.update(delta)
    const cursorVisible = !playerController.controls.isLocked
    controlPointToggle.syncCursorVisible(cursorVisible)
    controlTargetIndicator.syncCursorVisible(cursorVisible)
    coordinatesIndicator.syncCursorVisible(cursorVisible)
    coordinatesIndicator.update(camera.position, camera.rotation, environment.player.position)
    fpsIndicator.update(delta)
    resetButton.syncCursorVisible(cursorVisible)
    actionSettingsPanel.syncCursorVisible(cursorVisible)
    actionSequencePanel.syncCursorVisible(cursorVisible)
    mapEditButton.syncCursorVisible(cursorVisible)
    if (mapEditActive) {
      mapEditAimPoint.update(camera)
      mapEditTargetHint.setVisible(mapEditAimPoint.isHoveringEditableTarget())

      if (playerController.isAltPressed()) {
        const moveDir = playerController.getCurrentMoveDir()
        if (moveDir.lengthSq() > 0.0001) {
          const moveVector = new Vector3()
          const cameraRight = new Vector3()
          const cameraForward = new Vector3()

          cameraRight.setFromMatrixColumn(camera.matrix, 0)
          cameraForward.crossVectors(camera.up, cameraRight)

          moveVector.addScaledVector(cameraRight, moveDir.x * MOVE_SPEED * delta)
          moveVector.addScaledVector(cameraForward, moveDir.y * MOVE_SPEED * delta)

          mapEditAimPoint.moveActivePath(moveVector)
        }
      }
    }
    updateActionSequence(delta)
    environment.update(delta)
    actionWheel.update()
    environment.updateGroundPosition(camera.position)
    renderer.render(scene, camera)
    positionCacheElapsed += delta
    if (positionCacheElapsed >= POSITION_CACHE_INTERVAL) {
      writeCachedPositions()
      positionCacheElapsed = 0
    }

    animationFrameId = window.requestAnimationFrame(renderFrame)
  }

  environment.updateGroundPosition(camera.position)
  renderFrame()

  const dispose = () => {
    window.cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('beforeunload', writeCachedPositions)
    renderer.domElement.removeEventListener('click', handleMapEditClick)
    app.removeEventListener('qixing-town:play-action', onPlayUserAction)
    app.removeEventListener('qixing-town:user-actions-changed', rebuildActionWheel)
    app.removeEventListener('qixing-town:action-sequences-changed', rebuildActionWheel)
    controlPointToggle.dispose()
    controlTargetIndicator.dispose()
    coordinatesIndicator.dispose()
    fpsIndicator.dispose()
    toast.dispose()
    resetButton.dispose()
    mapEditButton.dispose()
    mapEditHint.dispose()
    mapEditTargetHint.dispose()
    mapEditAimPoint.dispose()
    mapSettingsPanel.dispose()
    actionSettingsPanel.dispose()
    actionSequencePanel.dispose()
    actionWheel.dispose()
    playerController.dispose()
    physics.dispose()
    writeCachedPositions()
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
