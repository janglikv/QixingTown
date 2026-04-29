// 提供把指定骨骼接触点锁定在世界坐标上的通用能力，用于避免姿态更新后支撑点漂移。
import { Vector3 } from 'three'
import {
  getBoneWorldPosition,
  readSkeletonJointPositions,
} from './skeleton.js'

const DEFAULT_HEIGHT_EPSILON = 0.001

export const createRigContactLocks = ({ figure, joints, contactKeys }) => (
  Object.fromEntries(
    contactKeys.map((key) => [
      key,
      { worldTarget: figure.localToWorld(joints[key].clone()) },
    ]),
  )
)

export const lockRigContacts = ({
  rig,
  figure,
  bones,
  skeletonRoot,
  contactLocks,
  lockedContactKeys,
  heightEpsilon = DEFAULT_HEIGHT_EPSILON,
}) => {
  const contactEntries = Object.entries(contactLocks)
  const lockedContacts = lockedContactKeys?.length
    ? contactEntries.filter(([key]) => lockedContactKeys.includes(key))
    : (() => {
      const joints = readSkeletonJointPositions({ rig, figure, bones })
      const lowestY = Math.min(...contactEntries.map(([key]) => joints[key].y))

      return contactEntries.filter(([key]) => (
        joints[key].y <= lowestY + heightEpsilon
      ))
    })()

  const offset = lockedContacts
    .reduce((sum, [key, contactLock]) => (
      sum.add(contactLock.worldTarget.clone().sub(getBoneWorldPosition(bones[key])))
    ), new Vector3())
    .multiplyScalar(1 / lockedContacts.length)

  skeletonRoot.position.add(
    skeletonRoot.parent.worldToLocal(
      skeletonRoot.parent.localToWorld(new Vector3()).add(offset),
    ),
  )
}
