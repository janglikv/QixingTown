// 提供把动作控制项转换为骨骼旋转，并在动作切换时做平滑过渡的通用 FK 控制能力。
import { Vector3 } from 'three'
import { applyTwoBoneIk } from './twoBoneIk.js'

const DEFAULT_TRANSITION_DURATION = 0.45
const DEG_TO_RAD = Math.PI / 180

const smoothStep = (value) => {
  const amount = Math.min(Math.max(value, 0), 1)

  return amount * amount * (3 - 2 * amount)
}

export const resolveDirectionalControlRotation = ({ bone, direction, angle }) => {
  const value = angle * DEG_TO_RAD

  if (direction === 'forward') return { axis: 'x', value }
  if (direction === 'backward') return { axis: 'x', value: -value }
  if (direction === 'up') return { axis: 'z', value: bone.endsWith('Left') ? -value : value }
  if (direction === 'down') return { axis: 'z', value: bone.endsWith('Left') ? value : -value }

  return null
}

export const createRigActionController = ({
  figure,
  bones,
  controlGroupsByKey,
  ikChainsByKey = {},
  resolveControlRotation = resolveDirectionalControlRotation,
  transitionDuration = DEFAULT_TRANSITION_DURATION,
}) => {
  const basePositions = Object.fromEntries(
    Object.entries(bones).map(([key, bone]) => [key, bone.position.clone()]),
  )
  figure.updateMatrixWorld(true)
  const baseIkTargets = Object.fromEntries(
    Object.entries(ikChainsByKey).map(([key, chain]) => [
      key,
      figure.worldToLocal(bones[chain.end].getWorldPosition(new Vector3())),
    ]),
  )
  const state = {
    action: null,
    currentRotations: {},
    fromRotations: {},
    targetRotations: {},
    touchedBones: new Set(),
    currentIkTargets: {},
    fromIkTargets: {},
    targetIkTargets: {},
    touchedIkChains: new Set(),
    transitionElapsed: 0,
    transitionDuration,
  }

  const getControlBones = (bone) => controlGroupsByKey[bone] ?? [bone]
  const getActionType = (action) => (action?.type === 'ik' ? 'ik' : 'fk')

  const restoreBonePositions = (boneKeys) => {
    boneKeys.forEach((key) => {
      const position = basePositions[key]
      if (!position) return

      bones[key].position.copy(position)
    })
  }

  const restoreAllPositions = () => {
    restoreBonePositions(Object.keys(basePositions))
  }

  const restoreIkChainPositions = (chainKeys) => {
    const boneKeys = new Set()

    chainKeys.forEach((chainKey) => {
      const chain = ikChainsByKey[chainKey]
      if (!chain) return

      boneKeys.add(chain.mid)
      boneKeys.add(chain.end)
    })
    restoreBonePositions(boneKeys)
  }

  const createTargetRotations = (action) => {
    const targets = {}

    if (getActionType(action) !== 'fk') return targets

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

  const getCurrentIkEndTarget = (chainKey) => {
    const chain = ikChainsByKey[chainKey]
    if (!chain) return null

    figure.updateMatrixWorld(true)
    return figure.worldToLocal(bones[chain.end].getWorldPosition(new Vector3()))
  }

  const createTargetIkTargets = (action) => {
    const targets = {}
    if (getActionType(action) !== 'ik') return targets

    ;(Array.isArray(action.ikTargets) ? action.ikTargets : []).forEach((target) => {
      const chain = ikChainsByKey[target.chain]
      const position = target.position

      if (!chain || !position) return
      if (
        !Number.isFinite(position.x)
        || !Number.isFinite(position.y)
        || !Number.isFinite(position.z)
      ) return

      targets[chain.key] = new Vector3(position.x, position.y, position.z)
    })

    return targets
  }

  const applyIkTargets = (targets) => {
    Object.entries(targets).forEach(([chainKey, target]) => {
      const chain = ikChainsByKey[chainKey]
      if (!chain || !target) return

      applyTwoBoneIk({
        figure,
        bones,
        chain,
        target,
      })
    })
  }

  const reapplyCurrentIkTargets = () => {
    if (Object.keys(state.currentIkTargets).length === 0) return

    // 平衡已经改过躯干位置，IK 重解只恢复 IK 会直接改写的链段。
    restoreIkChainPositions(Object.keys(state.currentIkTargets))
    applyIkTargets(state.currentIkTargets)
  }

  const blendReleasedIkPositionsToBase = ({ chainKeys, amount }) => {
    chainKeys.forEach((chainKey) => {
      if (state.targetIkTargets[chainKey]) return

      const chain = ikChainsByKey[chainKey]
      if (!chain) return

      ;[chain.mid, chain.end].forEach((boneKey) => {
        const basePosition = basePositions[boneKey]
        if (!basePosition) return

        bones[boneKey].position.lerp(basePosition, amount)
      })
    })
  }

  const setTarget = ({ action, immediate = false }) => {
    const controls = Array.isArray(action?.controls) ? action.controls : []
    const ikTargets = Array.isArray(action?.ikTargets) ? action.ikTargets : []

    state.action = {
      ...action,
      type: getActionType(action),
      controls,
      ikTargets,
    }
    state.fromRotations = { ...state.currentRotations }
    state.targetRotations = createTargetRotations(state.action)
    state.targetIkTargets = createTargetIkTargets(state.action)
    state.touchedBones = new Set([
      ...Object.keys(state.currentRotations),
      ...Object.keys(state.targetRotations),
    ])
    state.touchedIkChains = new Set([
      ...Object.keys(state.currentIkTargets),
      ...Object.keys(state.targetIkTargets),
    ])
    state.fromIkTargets = Object.fromEntries(
      [...state.touchedIkChains].map((chainKey) => [
        chainKey,
        state.currentIkTargets[chainKey]?.clone()
          ?? getCurrentIkEndTarget(chainKey)
          ?? baseIkTargets[chainKey]?.clone(),
      ]).filter(([, target]) => target),
    )
    state.transitionElapsed = immediate ? state.transitionDuration : 0
    if (immediate) {
      state.touchedBones.forEach((bone) => {
        const rotation = state.targetRotations[bone] ?? { x: 0, z: 0 }

        bones[bone].rotation.x = rotation.x
        bones[bone].rotation.z = rotation.z
      })
      state.currentRotations = { ...state.targetRotations }
      state.currentIkTargets = Object.fromEntries(
        Object.entries(state.targetIkTargets).map(([key, target]) => [key, target.clone()]),
      )
      restoreAllPositions()
      applyIkTargets(state.currentIkTargets)
    }
  }

  const cancel = () => {
    state.action = null
    state.fromRotations = { ...state.currentRotations }
    state.targetRotations = {}
    state.touchedBones = new Set(Object.keys(state.currentRotations))
    state.targetIkTargets = {}
    state.touchedIkChains = new Set(Object.keys(state.currentIkTargets))
    state.fromIkTargets = Object.fromEntries(
      [...state.touchedIkChains].map((chainKey) => [
        chainKey,
        state.currentIkTargets[chainKey]?.clone()
          ?? getCurrentIkEndTarget(chainKey)
          ?? baseIkTargets[chainKey]?.clone(),
      ]).filter(([, target]) => target),
    )
    state.transitionElapsed = 0
    restoreAllPositions()
  }

  const update = (delta) => {
    if (state.touchedBones.size === 0 && state.touchedIkChains.size === 0) return null

    state.transitionElapsed = Math.min(
      state.transitionElapsed + delta,
      state.transitionDuration,
    )
    const amount = smoothStep(state.transitionElapsed / state.transitionDuration)
    const nextRotations = {}

    restoreAllPositions()
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
    const nextIkTargets = {}
    state.touchedIkChains.forEach((chainKey) => {
      const from = state.fromIkTargets[chainKey] ?? baseIkTargets[chainKey]
      const target = state.targetIkTargets[chainKey] ?? baseIkTargets[chainKey]
      if (!from || !target) return

      nextIkTargets[chainKey] = from.clone().lerp(target, amount)
    })
    applyIkTargets(nextIkTargets)
    blendReleasedIkPositionsToBase({
      chainKeys: state.touchedIkChains,
      amount,
    })
    state.currentIkTargets = Object.fromEntries(
      Object.entries(nextIkTargets)
        .filter(([chainKey]) => state.targetIkTargets[chainKey])
        .map(([chainKey, target]) => [chainKey, target.clone()]),
    )
    if (amount >= 1 && Object.keys(state.currentRotations).length === 0) {
      state.touchedBones.clear()
    }
    if (amount >= 1 && Object.keys(state.currentIkTargets).length === 0) {
      state.touchedIkChains.clear()
    }

    return {
      reapplyIk: Object.keys(state.currentIkTargets).length > 0
        ? reapplyCurrentIkTargets
        : null,
    }
  }

  return {
    cancel,
    play: (action) => setTarget({ action }),
    preview: (action) => setTarget({ action, immediate: true }),
    update,
  }
}
