// 提供基于 rig definition 创建 Three 骨骼树、读取骨骼关节点、以及本地/世界坐标转换的通用能力。
import { Bone, Vector3 } from 'three'

const createNamedBone = (key) => {
  const bone = new Bone()
  bone.name = key
  return bone
}

const setBoneOffset = ({ bones, joints, key, parentKey }) => {
  bones[key].position.copy(joints[key]).sub(joints[parentKey])
}

export const createRigSkeleton = ({ rig, joints }) => {
  const bones = Object.fromEntries(
    rig.boneKeys.map((key) => [key, createNamedBone(key)]),
  )
  const rootKey = rig.rootBoneKey

  bones[rootKey].position.copy(joints[rootKey])
  rig.hierarchy.forEach(([parentKey, key]) => {
    bones[parentKey].add(bones[key])
    setBoneOffset({ bones, joints, key, parentKey })
  })

  return {
    root: bones[rootKey],
    bones,
  }
}

export const readSkeletonJointPositions = ({ rig, figure, bones }) => {
  const joints = {}

  figure.updateMatrixWorld(true)
  rig.boneKeys.forEach((key) => {
    joints[key] = figure.worldToLocal(bones[key].getWorldPosition(new Vector3()))
  })

  return joints
}

export const getBoneWorldPosition = (bone) => bone.getWorldPosition(new Vector3())

export const worldToFigureLocal = (figure, position) => figure.worldToLocal(position.clone())

export const localJointsToWorldJoints = ({ figure, joints }) => (
  Object.fromEntries(
    Object.entries(joints).map(([key, position]) => [
      key,
      figure.localToWorld(position.clone()),
    ]),
  )
)
