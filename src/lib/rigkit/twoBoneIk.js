// 提供三节点两段式 IK 求解，并把目标点应用到 Three 骨骼链上。
import { Vector3 } from 'three'
import { worldToFigureLocal } from './skeleton.js'

const clampValue = (value, min, max) => Math.min(Math.max(value, min), max)

export const solveTwoBoneIk = ({ root, endTarget, upperLength, lowerLength, bendDirection }) => {
  const rootToEnd = endTarget.clone().sub(root)
  const distance = clampValue(
    rootToEnd.length(),
    Math.abs(upperLength - lowerLength) + 0.001,
    upperLength + lowerLength - 0.001,
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

  if (bend.lengthSq() === 0) bend.set(0, 1, 0).projectOnPlane(forward)
  bend.normalize()

  return {
    end,
    mid: root
      .clone()
      .add(forward.multiplyScalar(along))
      .add(bend.multiplyScalar(height)),
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
  const solution = solveTwoBoneIk({
    root,
    endTarget: target,
    upperLength,
    lowerLength,
    bendDirection: new Vector3(0, 0, 1),
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
