import { MeshStandardMaterial } from 'three'
import {
  createRigDefinition,
  createRigFigure,
  createRigJointPositions,
} from '../lib/rigkit/index.js'

const MIN_BRANCH_LENGTH = 0.18
const TREE_TUBE_RADIUS = 0.045
const LEAF_RADIUS = 0.19
const SMALL_LEAF_DISTANCE = 0.55

/**
 * 核心逻辑：递归生成树的分支结构
 * @param {number} depth 当前递归深度
 * @param {number} maxDepth 最大分叉层数
 * @param {number} baseLength 当前节段的基础长度
 * @param {number} offMainDepth 偏离主干的层数
 */
const generateBranch = (depth, maxDepth, baseLength, offMainDepth = 0) => {
  if (depth > maxDepth) return null

  // 长度随高度和偏离主干程度衰减，侧枝越远越短。
  const currentLength = baseLength * Math.pow(0.75, depth) * Math.pow(0.72, offMainDepth)
  const keyBase = `branch_d${depth}_${Math.random().toString(36).substr(2, 4)}`

  const getMainDir = () => [
    (Math.random() - 0.5) * 0.35,
    1,
    (Math.random() - 0.5) * 0.35,
  ]
  const getSideDir = (nextOffMainDepth) => {
    const heightFactor = Math.max(0.18, Math.pow(0.58, nextOffMainDepth))

    return [
      (Math.random() - 0.5) * 1.8,
      0.9 * heightFactor,
      (Math.random() - 0.5) * 1.8,
    ]
  }

  const mainSide = Math.random() > 0.5 ? 'left' : 'right'
  const sideBranchDepth = offMainDepth + 1
  // 太短的枝条不再分叉，避免末端生成过密。
  const shouldSplit = depth < maxDepth && currentLength >= MIN_BRANCH_LENGTH
  const children = shouldSplit ? {
    [mainSide]: {
      key: `${keyBase}_${mainSide}`,
      length: currentLength * 0.88,
      direction: getMainDir(),
      children: generateBranch(depth + 1, maxDepth, baseLength, offMainDepth)?.children,
    },
    [mainSide === 'left' ? 'right' : 'left']: {
      key: `${keyBase}_${mainSide === 'left' ? 'right' : 'left'}`,
      length: currentLength * 0.78 * Math.pow(0.72, sideBranchDepth),
      direction: getSideDir(sideBranchDepth),
      children: generateBranch(depth + 1, maxDepth, baseLength, sideBranchDepth)?.children,
    },
  } : {}

  return {
    key: keyBase,
    cname: `分叉_${depth}`,
    length: currentLength,
    direction: [0, 1, 0], // 这里的 direction 是相对于父级的，我们通常让骨骼沿 Y 生长
    children,
  }
}

// 材质定义
const treeMaterial = new MeshStandardMaterial({
  color: '#000000',
  roughness: 0.9,
})

const createLeafEndCapConfig = ({ rig, joints }) => {
  const placedLeaves = []
  const leafKeys = [...rig.endBoneKeys].sort((a, b) => joints[b].y - joints[a].y)

  return Object.fromEntries(
    leafKeys.map((key) => {
      const position = joints[key]
      const nearestDistance = placedLeaves.reduce(
        (nearest, leaf) => Math.min(nearest, position.distanceTo(leaf)),
        Infinity,
      )

      placedLeaves.push(position)

      return [
        key,
        {
          radius: nearestDistance < SMALL_LEAF_DISTANCE ? TREE_TUBE_RADIUS : LEAF_RADIUS,
        },
      ]
    }),
  )
}

/**
 * 构建完整的树定义
 */
export const createTree = (maxDepth = 5) => {
  const rootBranch = generateBranch(0, maxDepth, 1.2)

  const rig = createRigDefinition({
    root: {
      key: 'root_trunk',
      cname: '树干',
      direction: [0, 1, 0],
      length: 1.0,
      children: {
        split: rootBranch
      }
    },
    render: {
      createMaterial: () => treeMaterial,
      tube: {
        radius: TREE_TUBE_RADIUS,
      },
      endCaps: {
        enabled: true,
        radius: LEAF_RADIUS,
        // 注意：在实际渲染中，你可以根据 depth 动态计算 radius
      }
    }
  })
  const joints = createRigJointPositions(rig)
  // 根据末端距离控制树叶密度，避免相邻末端重复生成同尺寸叶子。
  rig.definition.render.endCaps.byKey = createLeafEndCapConfig({ rig, joints })
  const { figure } = createRigFigure({
    name: 'tree',
    position: [0, 0, 0],
    joints,
    rig,
  })
  figure.userData.setControlPointsVisible(false)

  return figure
}
