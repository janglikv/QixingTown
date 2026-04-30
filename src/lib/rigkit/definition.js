// 提供把声明式骨骼 definition 编译成运行时 rig 数据和初始关节点的能力。
import { Vector3 } from 'three'

const flattenBoneTree = (node, parentKey = null) => {
  const { children = {}, ...bone } = node
  const current = {
    ...bone,
    parentKey,
  }

  return [
    current,
    ...Object.values(children).flatMap((child) => flattenBoneTree(child, node.key)),
  ]
}

const createBoneOffset = ({ length, direction }) => (
  new Vector3(...direction).normalize().multiplyScalar(length)
)

const createEndBoneKeys = (boneNodes) => {
  const parentKeys = new Set(
    boneNodes
      .map((bone) => bone.parentKey)
      .filter((key) => typeof key === 'string'),
  )

  return boneNodes
    .filter((bone) => !parentKeys.has(bone.key))
    .map((bone) => bone.key)
}

const createIkChainsByKey = (boneDefinitions) => (
  Object.values(boneDefinitions)
    .filter((bone) => bone.ik)
    .map((bone) => {
      const ik = bone.ik === true ? { up: 2 } : bone.ik

      if (ik.up !== 2) {
        throw new Error(`Unsupported IK up value for ${bone.key}: ${ik.up}`)
      }

      const mid = boneDefinitions[bone.parentKey]
      const root = mid ? boneDefinitions[mid.parentKey] : null

      if (!mid || !root) {
        throw new Error(`IK chain ${bone.key} requires two parent bones.`)
      }

      // 当前 IK 求解器只支持三节点链：root -> mid -> end。
      return [
        bone.key,
        {
          key: bone.key,
          cname: ik.cname ?? bone.cname,
          root: root.key,
          mid: mid.key,
          end: bone.key,
          rootJointLimit: mid.jointLimit,
          midJointLimit: bone.jointLimit,
        },
      ]
    })
)

const createSupportContactKeys = (boneNodes) => (
  boneNodes
    .filter((bone) => bone.supportContact)
    .map((bone) => bone.key)
)

export const createRigDefinition = (definition) => {
  const boneNodes = flattenBoneTree(definition.root)
  const rootBoneKey = definition.root.key
  const controlGroups = definition.controlGroups ?? []
  const boneDefinitions = Object.fromEntries(
    boneNodes.map(({ parentKey, ...bone }) => [
      bone.key,
      {
        ...bone,
        parentKey,
      },
    ]),
  )

  return {
    definition,
    boneNodes,
    rootBoneKey,
    boneDefinitions,
    hierarchy: boneNodes
      .filter((bone) => typeof bone.parentKey === 'string')
      .map((bone) => [bone.parentKey, bone.key]),
    actionBoneOptions: [
      ...controlGroups.map(({ key, cname }) => ({
        value: key,
        label: cname,
      })),
      ...boneNodes.map((bone) => ({
        value: bone.key,
        label: bone.cname,
      })),
    ],
    controlGroupsByKey: Object.fromEntries(
      controlGroups.map((group) => [group.key, group.bones]),
    ),
    ikChainsByKey: Object.fromEntries(createIkChainsByKey(boneDefinitions)),
    supportContactKeys: createSupportContactKeys(boneNodes),
    boneKeys: Object.keys(boneDefinitions),
    endBoneKeys: createEndBoneKeys(boneNodes),
  }
}

export const createRigJointPositions = (rig) => {
  const joints = {
    [rig.rootBoneKey]: new Vector3(),
  }

  rig.boneNodes
    .filter((bone) => typeof bone.parentKey === 'string')
    .forEach((bone) => {
      const parent = rig.boneDefinitions[bone.parentKey]
      const attach = Number.isFinite(bone.attach) ? bone.attach : 1
      // attach 是子骨骼挂在父骨骼段上的比例，默认接到父段末端。
      const attachPoint = typeof parent.parentKey === 'string'
        ? joints[parent.parentKey].clone().lerp(joints[bone.parentKey], attach)
        : joints[bone.parentKey].clone()

      joints[bone.key] = attachPoint.add(createBoneOffset(bone))
    })

  return joints
}
