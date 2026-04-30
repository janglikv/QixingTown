// 基于支撑点和质心的轻量自平衡，调整躯干方向并让上半身跟随躯干坐标系。
import { Quaternion, Vector3 } from 'three'
import { estimateRigCenterOfMass } from './definition.js'
import {
  getBoneWorldPosition,
  readSkeletonJointPositions,
} from './skeleton.js'

const DEFAULT_HEIGHT_EPSILON = 0.001
const DEFAULT_DEAD_ZONE = 0.012
const DEFAULT_MAX_OFFSET = 0.16
const DEFAULT_STRENGTH = 0.72
const DEFAULT_RESPONSE = 8
const DEFAULT_MOMENT_ARM_WEIGHT = 0
const DEFAULT_SUPPORT_RESPONSE = 10

const clampLength = (vector, maxLength) => {
  const length = vector.length()

  if (length <= maxLength) return vector

  return vector.multiplyScalar(maxLength / length)
}

const getSupportCenter = ({
  bones,
  contactLocks,
  lockedContactKeys,
  heightEpsilon,
}) => {
  const contactEntries = Object.entries(contactLocks)
  const contacts = lockedContactKeys?.length
    ? contactEntries.filter(([key]) => lockedContactKeys.includes(key))
    : contactEntries

  if (contacts.length === 0) return null

  const currentContacts = contacts
    .filter(([key]) => bones[key])
    .map(([key, contactLock]) => ({
      current: getBoneWorldPosition(bones[key]),
      target: contactLock.worldTarget,
    }))

  if (currentContacts.length === 0) return null

  const lowestY = Math.min(...currentContacts.map(({ current }) => current.y))
  const supportContacts = lockedContactKeys?.length
    ? currentContacts
    : currentContacts.filter(({ current }) => (
      current.y <= lowestY + heightEpsilon
    ))

  // 平衡目标使用锁定的地面接触点，避免腿伸出去时支撑基准跟着脚尖漂移。
  return supportContacts
    .reduce((sum, { target }) => sum.add(target), new Vector3())
    .multiplyScalar(1 / supportContacts.length)
}

const getHorizontalDistance = (from, to) => {
  const dx = from.x - to.x
  const dz = from.z - to.z

  return Math.sqrt(dx * dx + dz * dz)
}

const estimateMomentWeightedCenterOfMass = ({ joints, comSegments, momentArmWeight }) => {
  const centerOfMass = estimateRigCenterOfMass({ joints, comSegments })

  if (momentArmWeight <= 0) return centerOfMass

  const center = new Vector3()
  let totalWeight = 0

  comSegments.forEach(({ start, end, mass }) => {
    const segmentCenter = joints[start].clone().add(joints[end]).multiplyScalar(0.5)
    // 水平力距越大，对平衡修正的有效权重越高。
    const weight = mass * (1 + getHorizontalDistance(segmentCenter, centerOfMass) * momentArmWeight)

    center.add(segmentCenter.multiplyScalar(weight))
    totalWeight += weight
  })

  return totalWeight > 0 ? center.multiplyScalar(1 / totalWeight) : centerOfMass
}

export const createRigBalanceController = ({
  rig,
  figure,
  bones,
  options = {},
}) => {
  const torsoKey = options.torsoBone ?? options.torso ?? 'neck'
  const torso = bones[torsoKey]

  if (!torso) return null

  const baseTorsoPosition = torso.position.clone()
  const heightEpsilon = options.heightEpsilon ?? DEFAULT_HEIGHT_EPSILON
  const deadZone = options.deadZone ?? DEFAULT_DEAD_ZONE
  const maxOffset = options.maxOffset ?? DEFAULT_MAX_OFFSET
  const strength = options.strength ?? DEFAULT_STRENGTH
  const response = options.response ?? DEFAULT_RESPONSE
  const immediate = options.immediate === true
  const momentArmWeight = options.momentArmWeight ?? DEFAULT_MOMENT_ARM_WEIGHT
  const supportResponse = options.supportResponse ?? DEFAULT_SUPPORT_RESPONSE
  const currentOffset = new Vector3()
  const targetOffset = new Vector3()
  const smoothedSupportCenter = new Vector3()
  let hasSmoothedSupportCenter = false
  const baseTorsoDirection = baseTorsoPosition.clone().normalize()
  const currentBalanceRotation = new Quaternion()

  const getLocalOffset = (worldOffset) => {
    const parent = torso.parent

    if (!parent) return worldOffset.clone()

    parent.updateMatrixWorld(true)
    const origin = parent.getWorldPosition(new Vector3())
    const localOrigin = parent.worldToLocal(origin.clone())
    const localTarget = parent.worldToLocal(origin.add(worldOffset))

    return localTarget.sub(localOrigin)
  }

  const update = (delta = 0) => {
    torso.position.copy(baseTorsoPosition)
    torso.quaternion.multiply(currentBalanceRotation.clone().invert())
    currentBalanceRotation.identity()
    figure.updateMatrixWorld(true)

    const supportCenter = getSupportCenter({
      bones,
      contactLocks: figure.userData.contactLocks,
      lockedContactKeys: figure.userData.lockedContactKeys,
      heightEpsilon,
    })

    targetOffset.set(0, 0, 0)

    if (supportCenter) {
      if (!hasSmoothedSupportCenter) {
        smoothedSupportCenter.copy(supportCenter)
        hasSmoothedSupportCenter = true
      } else {
        const supportAmount = delta > 0
          ? 1 - Math.exp(-supportResponse * delta)
          : 1

        smoothedSupportCenter.lerp(supportCenter, supportAmount)
      }

      const joints = readSkeletonJointPositions({ rig, figure, bones })
      const centerOfMass = figure.localToWorld(
        estimateMomentWeightedCenterOfMass({
          joints,
          comSegments: rig.comSegments,
          momentArmWeight,
        }).clone(),
      )
      const correction = smoothedSupportCenter.clone().sub(centerOfMass).setY(0)

      if (correction.length() > deadZone) {
        targetOffset.copy(
          getLocalOffset(
            clampLength(correction.multiplyScalar(strength), maxOffset),
          ).setY(0),
        )
      }
    }

    const amount = immediate
      ? 1
      : delta > 0
      ? 1 - Math.exp(-response * delta)
      : 1

    currentOffset.lerp(targetOffset, amount)
    torso.position.copy(baseTorsoPosition).add(currentOffset)
    currentBalanceRotation.setFromUnitVectors(
      baseTorsoDirection,
      torso.position.clone().normalize(),
    )
    // neck 的局部坐标系跟随 hip->neck 躯干方向，肩/头/手臂才会像固定在上身上一样倾斜。
    torso.quaternion.multiply(currentBalanceRotation)
  }

  return {
    update,
  }
}
