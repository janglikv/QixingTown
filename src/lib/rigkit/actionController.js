// 提供把动作控制项转换为骨骼旋转，并在动作切换时做平滑过渡的通用 FK 控制能力。
const DEFAULT_TRANSITION_DURATION = 0.45
const DEG_TO_RAD = Math.PI / 180

const smoothStep = (value) => {
  const amount = Math.min(Math.max(value, 0), 1)

  return amount * amount * (3 - 2 * amount)
}

export const resolveDirectionalControlRotation = ({ bone, direction, angle }) => {
  const value = angle * DEG_TO_RAD

  if (direction === 'forward') return { axis: 'x', value: -value }
  if (direction === 'backward') return { axis: 'x', value }
  if (direction === 'up') return { axis: 'z', value: bone.endsWith('Left') ? -value : value }
  if (direction === 'down') return { axis: 'z', value: bone.endsWith('Left') ? value : -value }

  return null
}

export const createRigActionController = ({
  bones,
  controlGroupsByKey,
  resolveControlRotation = resolveDirectionalControlRotation,
  transitionDuration = DEFAULT_TRANSITION_DURATION,
}) => {
  const state = {
    action: null,
    currentRotations: {},
    fromRotations: {},
    targetRotations: {},
    touchedBones: new Set(),
    transitionElapsed: 0,
    transitionDuration,
  }

  const getControlBones = (bone) => controlGroupsByKey[bone] ?? [bone]

  const createTargetRotations = (action) => {
    const targets = {}

    action.controls.forEach((control) => {
      if (!Number.isFinite(control.angle)) return

      getControlBones(control.bone).forEach((bone) => {
        if (!bones[bone]) return

        const rotation = resolveControlRotation({ ...control, bone })
        if (!rotation) return

        targets[bone] ??= { x: 0, z: 0 }
        targets[bone][rotation.axis] += rotation.value
      })
    })

    return targets
  }

  const setTarget = ({ action, immediate = false }) => {
    const controls = Array.isArray(action?.controls) ? action.controls : []

    state.action = {
      ...action,
      controls,
    }
    state.fromRotations = { ...state.currentRotations }
    state.targetRotations = createTargetRotations(state.action)
    state.touchedBones = new Set([
      ...Object.keys(state.currentRotations),
      ...Object.keys(state.targetRotations),
    ])
    state.transitionElapsed = immediate ? state.transitionDuration : 0
    if (immediate) state.currentRotations = { ...state.targetRotations }
  }

  const cancel = () => {
    state.action = null
    state.fromRotations = { ...state.currentRotations }
    state.targetRotations = {}
    state.touchedBones = new Set(Object.keys(state.currentRotations))
    state.transitionElapsed = 0
  }

  const update = (delta) => {
    if (state.touchedBones.size === 0) return

    state.transitionElapsed = Math.min(
      state.transitionElapsed + delta,
      state.transitionDuration,
    )
    const amount = smoothStep(state.transitionElapsed / state.transitionDuration)
    const nextRotations = {}

    state.touchedBones.forEach((bone) => {
      const from = state.fromRotations[bone] ?? { x: 0, z: 0 }
      const target = state.targetRotations[bone] ?? { x: 0, z: 0 }
      const rotation = {
        x: from.x + (target.x - from.x) * amount,
        z: from.z + (target.z - from.z) * amount,
      }

      bones[bone].rotation.x = rotation.x
      bones[bone].rotation.z = rotation.z
      if (rotation.x !== 0 || rotation.z !== 0) nextRotations[bone] = rotation
    })
    state.currentRotations = nextRotations
    if (amount >= 1 && Object.keys(state.currentRotations).length === 0) {
      state.touchedBones.clear()
    }
  }

  return {
    cancel,
    play: (action) => setTarget({ action }),
    preview: (action) => setTarget({ action, immediate: true }),
    update,
  }
}
