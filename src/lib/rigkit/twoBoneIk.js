// 提供三节点两段式 IK 求解，并把目标点应用到 Three 骨骼链上。
import { Vector3 } from 'three'
import { worldToFigureLocal } from './skeleton.js'

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI
const AXIS_BY_KEY = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
}
const clampValue = (value, min, max) => Math.min(Math.max(value, min), max)
const getDirection = (vector, fallback) => (
  vector.lengthSq() > 0
    ? vector.clone().normalize()
    : fallback.clone().normalize()
)
const createJointAxes = ({ parentDirection, restDirection }) => {
  const y = getDirection(parentDirection, AXIS_BY_KEY.y)
  const x = restDirection.clone().projectOnPlane(y)

  if (x.lengthSq() === 0) {
    x.copy(Math.abs(y.y) < 0.9 ? AXIS_BY_KEY.y : AXIS_BY_KEY.x).projectOnPlane(y)
  }

  x.normalize()

  const z = x.clone().cross(y).normalize()

  return { x, y, z }
}
const getLimitedDistanceRange = ({ upperLength, lowerLength, jointLimit }) => {
  if (!jointLimit) {
    return {
      min: Math.abs(upperLength - lowerLength) + 0.001,
      max: upperLength + lowerLength - 0.001,
    }
  }

  const minAngle = Number.isFinite(jointLimit.minAngle)
    ? jointLimit.minAngle * DEG_TO_RAD
    : 0
  const maxAngle = Number.isFinite(jointLimit.maxAngle)
    ? jointLimit.maxAngle * DEG_TO_RAD
    : Math.PI
  const toDistance = (angle) => Math.sqrt(Math.max(
    (upperLength * upperLength)
    + (lowerLength * lowerLength)
    - (2 * upperLength * lowerLength * Math.cos(angle)),
    0,
  ))

  return {
    min: Math.max(toDistance(minAngle), Math.abs(upperLength - lowerLength) + 0.001),
    max: Math.min(toDistance(maxAngle), upperLength + lowerLength - 0.001),
  }
}
const getSignedPlaneAngle = ({ from, to, axis }) => {
  const projectedFrom = from.clone().projectOnPlane(axis)
  const projectedTo = to.clone().projectOnPlane(axis)

  if (projectedFrom.lengthSq() === 0 || projectedTo.lengthSq() === 0) return 0

  projectedFrom.normalize()
  projectedTo.normalize()

  const angle = projectedFrom.angleTo(projectedTo)
  const sign = Math.sign(axis.dot(projectedFrom.clone().cross(projectedTo))) || 1

  return angle * sign * RAD_TO_DEG
}
const clampDirectionToAxisLimits = ({
  direction,
  restDirection,
  jointLimit,
  axes = AXIS_BY_KEY,
}) => {
  if (!jointLimit) return direction

  return Object.entries(axes).reduce((current, [axisKey, axis]) => {
    const range = jointLimit[axisKey]

    if (!Array.isArray(range) || range.length !== 2) return current

    const [min, max] = range

    if (!Number.isFinite(min) || !Number.isFinite(max)) return current

    const signedAngle = getSignedPlaneAngle({
      from: restDirection,
      to: current,
      axis,
    })
    const clampedAngle = clampValue(signedAngle, min, max)

    if (clampedAngle === signedAngle) return current

    return current
      .clone()
      .applyAxisAngle(axis, (clampedAngle - signedAngle) * DEG_TO_RAD)
      .normalize()
  }, direction)
}
const createFallbackBend = (forward) => {
  const fallback = Math.abs(forward.y) < 0.9
    ? new Vector3(0, 1, 0)
    : new Vector3(1, 0, 0)

  return fallback.projectOnPlane(forward).normalize()
}

export const solveTwoBoneIk = ({
  root,
  endTarget,
  upperLength,
  lowerLength,
  bendDirection,
  restUpperDirection,
  rootParentDirection,
  rootJointLimit,
  midJointLimit,
}) => {
  const rootToEnd = endTarget.clone().sub(root)
  const distanceRange = getLimitedDistanceRange({ upperLength, lowerLength, jointLimit: midJointLimit })
  const distance = clampValue(
    rootToEnd.length(),
    distanceRange.min,
    distanceRange.max,
  )
  const forward = rootToEnd.normalize()
  const end = root.clone().add(forward.clone().multiplyScalar(distance))
  const along = (
    (upperLength * upperLength)
    - (lowerLength * lowerLength)
    + (distance * distance)
  ) / (2 * distance)
  const height = Math.sqrt(Math.max(upperLength * upperLength - along * along, 0))
  const bend = bendDirection.clone().projectOnPlane(forward)

  if (bend.lengthSq() === 0) bend.copy(createFallbackBend(forward))
  else bend.normalize()

  const solution = {
    end,
    mid: root
      .clone()
      .add(forward.multiplyScalar(along))
      .add(bend.multiplyScalar(height)),
  }

  const restDirection = getDirection(restUpperDirection, bendDirection)
  const upperDirection = getDirection(solution.mid.clone().sub(root), restDirection)
  const limitedUpperDirection = clampDirectionToAxisLimits({
    direction: upperDirection,
    restDirection,
    jointLimit: rootJointLimit,
    // 上段关节的 x/y/z 以父骨段方向为参考系，而不是固定世界轴。
    axes: createJointAxes({
      parentDirection: rootParentDirection,
      restDirection,
    }),
  })
  const limitedMid = root.clone().add(limitedUpperDirection.clone().multiplyScalar(upperLength))
  const lowerDirection = getDirection(endTarget.clone().sub(limitedMid), solution.end.clone().sub(solution.mid))
  const limitedLowerLength = clampValue(
    endTarget.distanceTo(limitedMid),
    Math.max(0.001, lowerLength - 0.001),
    lowerLength,
  )

  return {
    mid: limitedMid,
    end: limitedMid.clone().add(lowerDirection.multiplyScalar(limitedLowerLength)),
  }
}

export const applyTwoBoneIk = ({ figure, bones, chain, target }) => {
  const { root: rootKey, mid: midKey, end: endKey } = chain
  const upperLength = bones[midKey].position.length()
  const lowerLength = bones[endKey].position.length()

  bones[rootKey].rotation.set(0, 0, 0)
  bones[midKey].rotation.set(0, 0, 0)
  figure.updateMatrixWorld(true)

  const root = figure.worldToLocal(bones[rootKey].getWorldPosition(new Vector3()))
  const mid = figure.worldToLocal(bones[midKey].getWorldPosition(new Vector3()))
  const rootParent = bones[rootKey].parent?.isBone
    ? figure.worldToLocal(bones[rootKey].parent.getWorldPosition(new Vector3()))
    : root.clone().sub(AXIS_BY_KEY.y)
  const restUpperDirection = mid.clone().sub(root)
  const rootParentDirection = root.clone().sub(rootParent)
  const solution = solveTwoBoneIk({
    root,
    endTarget: target,
    upperLength,
    lowerLength,
    // 用静止姿态的中间关节方向约束弯曲平面，避免手臂过渡时肘部向人体不自然的方向翻折。
    bendDirection: restUpperDirection.clone(),
    restUpperDirection,
    rootParentDirection,
    rootJointLimit: chain.rootJointLimit,
    midJointLimit: chain.midJointLimit,
  })

  bones[midKey].position.copy(
    bones[rootKey].worldToLocal(figure.localToWorld(solution.mid.clone())),
  )
  figure.updateMatrixWorld(true)
  bones[endKey].position.copy(
    bones[midKey].worldToLocal(figure.localToWorld(solution.end.clone())),
  )
}

export const applyTwoBoneIkWorld = ({ figure, bones, chain, worldTarget }) => {
  applyTwoBoneIk({
    figure,
    bones,
    chain,
    target: worldToFigureLocal(figure, worldTarget),
  })
}
