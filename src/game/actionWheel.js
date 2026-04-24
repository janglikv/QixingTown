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
const CHILD_WHEEL_INNER_RADIUS = 0.52
const CHILD_WHEEL_OUTER_RADIUS = 0.78
const SEGMENT_GAP_PIXELS = 1
const LABEL_WIDTH = 0.34
const LABEL_HEIGHT = 0.13
const POINTER_LIMIT = 0.78
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

const getSegmentCenterAngle = ({ index, total }) => {
  const slice = (Math.PI * 2) / total

  return Math.PI / 2 - index * slice
}

const getChildSegmentCenterAngle = ({ index, total, parentIndex, parentTotal }) => {
  const parentSlice = (Math.PI * 2) / parentTotal
  const childSlice = parentSlice / total

  return getSegmentCenterAngle({ index: parentIndex, total: parentTotal })
    + ((total - 1) / 2 - index) * childSlice
}

const createSegmentGeometry = ({
  index,
  total,
  gapAngle,
  innerRadius,
  outerRadius,
  parentIndex = null,
  parentTotal = null,
}) => {
  const slice = parentTotal ? (Math.PI * 2) / parentTotal / total : (Math.PI * 2) / total
  const center = parentTotal
    ? getChildSegmentCenterAngle({ index, total, parentIndex, parentTotal })
    : getSegmentCenterAngle({ index, total })

  return new RingGeometry(
    innerRadius,
    outerRadius,
    48,
    1,
    center - slice / 2 + gapAngle / 2,
    slice - gapAngle,
  )
}

const createWheelSegment = ({
  index,
  total,
  gapAngle,
  innerRadius = WHEEL_INNER_RADIUS,
  outerRadius = WHEEL_OUTER_RADIUS,
  parentIndex = null,
  parentTotal = null,
}) => {
  const material = new MeshBasicMaterial({
    color: '#4a4a4a',
    opacity: 0.72,
    transparent: true,
    side: DoubleSide,
    depthTest: false,
    depthWrite: false,
  })
  const mesh = new Mesh(createSegmentGeometry({
    index,
    total,
    gapAngle,
    innerRadius,
    outerRadius,
    parentIndex,
    parentTotal,
  }), material)
  mesh.renderOrder = parentTotal ? 1002 : 1000
  mesh.userData.index = index
  mesh.userData.total = total
  mesh.userData.innerRadius = innerRadius
  mesh.userData.outerRadius = outerRadius
  mesh.userData.parentIndex = parentIndex
  mesh.userData.parentTotal = parentTotal

  return mesh
}

const createWheelLabel = ({
  action,
  index,
  total,
  radius = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2,
  parentIndex = null,
  parentTotal = null,
}) => {
  const angle = parentTotal
    ? getChildSegmentCenterAngle({ index, total, parentIndex, parentTotal })
    : getSegmentCenterAngle({ index, total })
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

  mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.01)
  mesh.renderOrder = parentTotal ? 1003 : 1001
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
  pointer.renderOrder = 1004
  return pointer
}

const getSelectedIndex = ({ pointer, actionCount }) => {
  if (pointer.length() < POINTER_SELECT_MIN) return -1

  const angle = Math.atan2(pointer.y, pointer.x)
  const slice = (Math.PI * 2) / actionCount
  const normalized = (Math.PI / 2 - angle + slice / 2 + Math.PI * 2) % (Math.PI * 2)

  return Math.floor(normalized / slice)
}

const getSelectedChildIndex = ({ pointer, parentIndex, parentTotal, childCount }) => {
  const radius = pointer.length()
  if (radius < CHILD_WHEEL_INNER_RADIUS || radius > CHILD_WHEEL_OUTER_RADIUS) return -1

  const angle = Math.atan2(pointer.y, pointer.x)
  const parentSlice = (Math.PI * 2) / parentTotal
  const childSlice = parentSlice / childCount
  const normalized = (Math.PI / 2 - angle + parentSlice / 2 + Math.PI * 2) % (Math.PI * 2)
  const local = normalized - parentIndex * parentSlice

  if (local < 0 || local >= parentSlice) return -1

  return Math.floor(local / childSlice)
}

export const createActionWheel = ({ scene, camera, domElement, actions, onOpenChange }) => {
  const group = new Group()
  const pointer = createPointer()
  const pointerPosition = new Vector3(0, 0, 0)
  let segments = []
  let labels = []
  let childSegments = []
  let childLabels = []
  let isOpen = false
  let selectedIndex = -1
  let selectedChildIndex = -1
  let childParentIndex = -1
  let lastViewportHeight = 0

  group.visible = false
  group.name = 'action-wheel'
  group.add(pointer)
  scene.add(group)

  const getSegmentGapAngle = () => {
    const viewportHeight = domElement.clientHeight || window.innerHeight
    const worldHeight = 2 * Math.tan((camera.fov * Math.PI) / 360) * UI_DISTANCE
    const gapWorld = (worldHeight / viewportHeight) * SEGMENT_GAP_PIXELS
    const centerRadius = (WHEEL_INNER_RADIUS + WHEEL_OUTER_RADIUS) / 2

    return gapWorld / centerRadius
  }

  const disposeMeshes = ({ targetSegments, targetLabels }) => {
    targetSegments.forEach((segment) => {
      group.remove(segment)
      segment.geometry.dispose()
      segment.material.dispose()
    })
    targetLabels.forEach((label) => {
      group.remove(label)
      label.geometry.dispose()
      label.material.dispose()
      label.userData.texture.dispose()
    })
  }

  const disposeSegments = () => {
    disposeMeshes({ targetSegments: segments, targetLabels: labels })
    segments = []
    labels = []
  }

  const disposeChildSegments = () => {
    disposeMeshes({ targetSegments: childSegments, targetLabels: childLabels })
    childSegments = []
    childLabels = []
    childParentIndex = -1
  }

  const syncSegmentGaps = () => {
    const viewportHeight = domElement.clientHeight || window.innerHeight
    if (viewportHeight === lastViewportHeight) return

    lastViewportHeight = viewportHeight
    const gapAngle = getSegmentGapAngle()
    ;[...segments, ...childSegments].forEach((segment) => {
      segment.geometry.dispose()
      segment.geometry = createSegmentGeometry({
        index: segment.userData.index,
        total: segment.userData.total,
        gapAngle,
        innerRadius: segment.userData.innerRadius,
        outerRadius: segment.userData.outerRadius,
        parentIndex: segment.userData.parentIndex,
        parentTotal: segment.userData.parentTotal,
      })
    })
  }

  const syncVisualState = () => {
    segments.forEach((segment, index) => {
      const selected = index === selectedIndex
      const active = actions[index].isActive?.()

      segment.material.color.set(selected ? '#8f8f8f' : active ? '#666666' : '#3f3f3f')
      segment.material.opacity = selected ? 0.56 : active ? 0.5 : 0.38
    })
    childSegments.forEach((segment, index) => {
      const selected = index === selectedChildIndex
      const active = actions[childParentIndex]?.children?.[index]?.isActive?.()

      segment.material.color.set(selected ? '#9a9a9a' : active ? '#6d6d6d' : '#464646')
      segment.material.opacity = selected ? 0.58 : active ? 0.52 : 0.4
    })
  }

  const rebuildMenu = () => {
    disposeSegments()
    disposeChildSegments()
    segments = actions.map((action, index) => createWheelSegment({
      index,
      total: actions.length,
      gapAngle: 0,
    }))
    labels = actions.map((action, index) => createWheelLabel({
      action,
      index,
      total: actions.length,
    }))
    segments.forEach((segment) => group.add(segment))
    labels.forEach((label) => group.add(label))
    group.add(pointer)
    lastViewportHeight = 0
    syncSegmentGaps()
    syncVisualState()
  }

  const rebuildChildMenu = (parentIndex) => {
    if (childParentIndex === parentIndex) return

    disposeChildSegments()
    const parentAction = actions[parentIndex]
    if (!parentAction?.children) return

    childParentIndex = parentIndex
    childSegments = parentAction.children.map((action, index) => createWheelSegment({
      index,
      total: parentAction.children.length,
      gapAngle: 0,
      innerRadius: CHILD_WHEEL_INNER_RADIUS,
      outerRadius: CHILD_WHEEL_OUTER_RADIUS,
      parentIndex,
      parentTotal: actions.length,
    }))
    childLabels = parentAction.children.map((action, index) => createWheelLabel({
      action,
      index,
      total: parentAction.children.length,
      radius: (CHILD_WHEEL_INNER_RADIUS + CHILD_WHEEL_OUTER_RADIUS) / 2,
      parentIndex,
      parentTotal: actions.length,
    }))
    childSegments.forEach((segment) => group.add(segment))
    childLabels.forEach((label) => group.add(label))
    group.add(pointer)
    lastViewportHeight = 0
    syncSegmentGaps()
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

    if (actions[selectedIndex]?.children) {
      rebuildChildMenu(selectedIndex)
      selectedChildIndex = getSelectedChildIndex({
        pointer: pointerPosition,
        parentIndex: selectedIndex,
        parentTotal: actions.length,
        childCount: actions[selectedIndex].children.length,
      })
    } else {
      selectedChildIndex = -1
      disposeChildSegments()
    }
    syncVisualState()
  }

  const applySelectedAction = () => {
    const action = actions[selectedIndex]
    if (!action) return

    if (action.children) {
      const child = action.children[selectedChildIndex] ?? action.children[0]

      child?.toggle?.()
      return
    }

    action.toggle?.()
  }

  const open = () => {
    if (isOpen) return

    rebuildMenu()
    isOpen = true
    selectedIndex = -1
    selectedChildIndex = -1
    pointerPosition.set(0, 0, 0)
    pointer.position.set(0, 0, 0.02)
    group.visible = true
    syncVisualState()
    onOpenChange?.(true)
  }

  const close = ({ applySelection = false } = {}) => {
    if (!isOpen) return

    if (applySelection) applySelectedAction()
    isOpen = false
    group.visible = false
    onOpenChange?.(false)
    disposeChildSegments()
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
    disposeSegments()
    disposeChildSegments()
    pointer.geometry.dispose()
    pointer.material.dispose()
  }

  window.addEventListener('mousemove', handleMouseMove)
  rebuildMenu()

  return {
    open,
    close,
    update,
    dispose,
  }
}
