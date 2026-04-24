import {
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Vector3,
} from 'three'

const UI_DISTANCE = 1.6
const WHEEL_INNER_RADIUS = 0.28
const WHEEL_OUTER_RADIUS = 0.48
const SEGMENT_GAP_PIXELS = 1
const LABEL_WIDTH = 0.34
const LABEL_HEIGHT = 0.13
const POINTER_LIMIT = 0.48
const POINTER_SELECT_MIN = 0.1
const LABEL_TEXTURE_WIDTH = 512
const LABEL_TEXTURE_HEIGHT = Math.round(LABEL_TEXTURE_WIDTH * (LABEL_HEIGHT / LABEL_WIDTH))

const createLabelTexture = (text) => {
  const canvas = document.createElement('canvas')
  canvas.width = LABEL_TEXTURE_WIDTH
  canvas.height = LABEL_TEXTURE_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create action wheel label texture context.')
  }

  context.clearRect(0, 0, LABEL_TEXTURE_WIDTH, LABEL_TEXTURE_HEIGHT)
  context.fillStyle = 'rgba(238, 238, 238, 0.78)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '600 64px "PingFang SC", "Noto Sans SC", sans-serif'
  context.fillText(text, LABEL_TEXTURE_WIDTH / 2, LABEL_TEXTURE_HEIGHT / 2)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const createSegmentGeometry = ({ index, total, gapAngle }) => {
  const slice = (Math.PI * 2) / total
  const center = Math.PI / 2 - index * slice

  return new RingGeometry(
    WHEEL_INNER_RADIUS,
    WHEEL_OUTER_RADIUS,
    48,
    1,
    center - slice / 2 + gapAngle / 2,
    slice - gapAngle,
  )
}

const createWheelSegment = ({ index, total, gapAngle }) => {
  const material = new MeshBasicMaterial({
    color: '#4a4a4a',
    opacity: 0.72,
    transparent: true,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new Mesh(createSegmentGeometry({ index, total, gapAngle }), material)
  mesh.renderOrder = 1000
  mesh.userData.index = index

  return mesh
}

const createWheelLabel = ({ action, index, total }) => {
  const slice = (Math.PI * 2) / total
  const angle = Math.PI / 2 - index * slice
  const texture = createLabelTexture(action.label)
  const material = new MeshBasicMaterial({
    map: texture,
    opacity: 0.78,
    transparent: true,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new Mesh(new PlaneGeometry(LABEL_WIDTH, LABEL_HEIGHT), material)
  const labelRadius = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2

  mesh.position.set(Math.cos(angle) * labelRadius, Math.sin(angle) * labelRadius, 0.01)
  mesh.renderOrder = 1001
  mesh.userData.texture = texture

  return mesh
}

const createPointer = () => {
  const material = new MeshBasicMaterial({
    color: '#b8b8b8',
    opacity: 0.58,
    transparent: true,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  const pointer = new Mesh(new RingGeometry(0.018, 0.034, 24), material)
  pointer.position.z = 0.02
  pointer.renderOrder = 1002
  return pointer
}

const getSelectedIndex = ({ pointer, actionCount }) => {
  if (pointer.length() < POINTER_SELECT_MIN) return -1

  const angle = Math.atan2(pointer.y, pointer.x)
  const slice = (Math.PI * 2) / actionCount
  const normalized = (Math.PI / 2 - angle + slice / 2 + Math.PI * 2) % (Math.PI * 2)

  return Math.floor(normalized / slice)
}

export const createActionWheel = ({ scene, camera, domElement, actions, onOpenChange }) => {
  const group = new Group()
  const pointer = createPointer()
  const pointerPosition = new Vector3(0, 0, 0)
  const segments = actions.map((action, index) => createWheelSegment({
    index,
    total: actions.length,
    gapAngle: 0,
  }))
  const labels = actions.map((action, index) => createWheelLabel({
    action,
    index,
    total: actions.length,
  }))
  let isOpen = false
  let selectedIndex = -1
  let lastViewportHeight = 0

  group.visible = false
  group.name = 'action-wheel'
  segments.forEach((segment) => group.add(segment))
  labels.forEach((label) => group.add(label))
  group.add(pointer)
  scene.add(group)

  const getSegmentGapAngle = () => {
    const viewportHeight = domElement.clientHeight || window.innerHeight
    const worldHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * UI_DISTANCE
    const gapWorld = (worldHeight / viewportHeight) * SEGMENT_GAP_PIXELS
    const centerRadius = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2

    return gapWorld / centerRadius
  }

  const syncSegmentGaps = () => {
    const viewportHeight = domElement.clientHeight || window.innerHeight
    if (viewportHeight === lastViewportHeight) return

    lastViewportHeight = viewportHeight
    const gapAngle = getSegmentGapAngle()
    segments.forEach((segment) => {
      segment.geometry.dispose()
      segment.geometry = createSegmentGeometry({
        index: segment.userData.index,
        total: actions.length,
        gapAngle,
      })
    })
  }

  const syncVisualState = () => {
    segments.forEach((segment, index) => {
      const selected = index === selectedIndex
      const active = actions[index].isActive()

      segment.material.color.set(selected ? '#8f8f8f' : active ? '#666666' : '#3f3f3f')
      segment.material.opacity = selected ? 0.56 : active ? 0.5 : 0.38
    })
  }

  const handleMouseMove = (event) => {
    if (!isOpen) return

    pointerPosition.x += event.movementX * 0.0028
    pointerPosition.y -= event.movementY * 0.0028
    if (pointerPosition.length() > POINTER_LIMIT) {
      pointerPosition.setLength(POINTER_LIMIT)
    }
    pointer.position.x = pointerPosition.x
    pointer.position.y = pointerPosition.y
    selectedIndex = getSelectedIndex({
      pointer: pointerPosition,
      actionCount: actions.length,
    })
    syncVisualState()
  }

  const open = () => {
    if (isOpen) return

    isOpen = true
    selectedIndex = -1
    pointerPosition.set(0, 0, 0)
    pointer.position.set(0, 0, 0.02)
    syncSegmentGaps()
    group.visible = true
    syncVisualState()
    onOpenChange?.(true)
  }

  const close = ({ applySelection = false } = {}) => {
    if (!isOpen) return

    const action = applySelection ? actions[selectedIndex] : null
    isOpen = false
    group.visible = false
    onOpenChange?.(false)
    action?.toggle()
  }

  const update = () => {
    if (!isOpen) return

    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)
    group.translateZ(-UI_DISTANCE)
    syncSegmentGaps()
  }

  const dispose = () => {
    window.removeEventListener('mousemove', handleMouseMove)
    scene.remove(group)
    segments.forEach((segment) => {
      segment.geometry.dispose()
      segment.material.dispose()
    })
    labels.forEach((label) => {
      label.geometry.dispose()
      label.material.dispose()
      label.userData.texture.dispose()
    })
    pointer.geometry.dispose()
    pointer.material.dispose()
  }

  window.addEventListener('mousemove', handleMouseMove)

  return {
    open,
    close,
    update,
    dispose,
  }
}
