import { Vector3 } from 'three'
import {
  createStickFigure,
  mirrorX,
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const EXTRA_PROPORTIONS = {
  // 这个火柴人有独立肩关节和左右胯关节；改这里不会影响基础火柴人。
  // 脚底高度是整个人物的基准；腿变长时，上方关节会往上推，脚保持贴地。
  footY: -1,
  // 左右脚离身体中线的距离，越大站姿越开。
  footHalfWidth: 0.2,
  // 小腿长度：脚到膝盖。调大后，膝盖、胯、身体、头都会跟着上移。
  lowerLegLength: 0.62,
  // 大腿长度：膝盖到胯。调大后，胯、身体、头都会跟着上移。
  upperLegLength: 0.34,
  // 膝盖离身体中线的距离，越大腿越向外撇。
  upperLegInset: 0.16,
  // 左右胯关节离身体中线的距离，越大胯越宽。
  hipHalfWidth: 0.12,
  // 肚子/身体长度：中心胯到脖子。调小就是“肚子短一点”。
  torsoLength: 0.52,
  // 脖子长度：脖子到头。调大就是“脖子长一点”。
  neckLength: 0.38,
  // 肩膀比脖子低多少。调大后肩膀下移，手臂起点更低。
  shoulderDrop: 0.2,
  // 半个肩宽。调大后肩膀和手臂整体更宽。
  shoulderHalfWidth: 0.18,
  // 上手臂：肩膀到肘。调 x/y 可以控制肘相对肩膀的位置。
  upperArmOffset: new Vector3(0.12, -0.08, 0),
  // 下手臂：肘到手。调大 x 会让手伸得更远。
  lowerArmOffset: new Vector3(0.4, 0, 0),
}

const createExtraJointPositions = () => {
  const kneeY = EXTRA_PROPORTIONS.footY + EXTRA_PROPORTIONS.lowerLegLength
  const hipY = kneeY + EXTRA_PROPORTIONS.upperLegLength
  const neckY = hipY + EXTRA_PROPORTIONS.torsoLength
  const headY = neckY + EXTRA_PROPORTIONS.neckLength
  const shoulderY = neckY - EXTRA_PROPORTIONS.shoulderDrop

  const shoulderRight = new Vector3(
    EXTRA_PROPORTIONS.shoulderHalfWidth,
    shoulderY,
    Z_OFFSET,
  )
  const elbowRight = shoulderRight.clone().add(EXTRA_PROPORTIONS.upperArmOffset)
  const handRight = elbowRight.clone().add(EXTRA_PROPORTIONS.lowerArmOffset)

  return {
    head: new Vector3(0, headY, Z_OFFSET),
    neck: new Vector3(0, neckY, Z_OFFSET),
    shoulderLeft: mirrorX(shoulderRight),
    shoulderRight,
    elbowLeft: mirrorX(elbowRight),
    elbowRight,
    handLeft: mirrorX(handRight),
    handRight,
    hip: new Vector3(0, hipY, Z_OFFSET),
    hipLeft: new Vector3(-EXTRA_PROPORTIONS.hipHalfWidth, hipY, Z_OFFSET),
    hipRight: new Vector3(EXTRA_PROPORTIONS.hipHalfWidth, hipY, Z_OFFSET),
    kneeLeft: new Vector3(-EXTRA_PROPORTIONS.upperLegInset, kneeY, Z_OFFSET),
    kneeRight: new Vector3(EXTRA_PROPORTIONS.upperLegInset, kneeY, Z_OFFSET),
    footLeft: new Vector3(-EXTRA_PROPORTIONS.footHalfWidth, EXTRA_PROPORTIONS.footY, Z_OFFSET),
    footRight: new Vector3(EXTRA_PROPORTIONS.footHalfWidth, EXTRA_PROPORTIONS.footY, Z_OFFSET),
  }
}

const EXTRA_BONES = [
  ['head', 'neck'],
  ['neck', 'shoulderLeft'],
  ['neck', 'shoulderRight'],
  ['shoulderLeft', 'elbowLeft'],
  ['shoulderRight', 'elbowRight'],
  ['elbowLeft', 'handLeft'],
  ['elbowRight', 'handRight'],
  ['neck', 'hip'],
  ['hip', 'hipLeft'],
  ['hip', 'hipRight'],
  ['hipLeft', 'kneeLeft'],
  ['hipRight', 'kneeRight'],
  ['kneeLeft', 'footLeft'],
  ['kneeRight', 'footRight'],
]

const EXTRA_VISIBLE_JOINT_KEYS = [
  'head',
  'neck',
  'shoulderLeft',
  'shoulderRight',
  'elbowLeft',
  'elbowRight',
  'handLeft',
  'handRight',
  'hip',
  'hipLeft',
  'hipRight',
  'kneeLeft',
  'kneeRight',
  'footLeft',
  'footRight',
]

export const createNpc2 = ({
  name = 'npc2',
  position = [4.3, STICK_NPC_HEIGHT / 2, -4],
} = {}) => (
  createStickFigure({
    name,
    position,
    joints: createExtraJointPositions(),
    bones: EXTRA_BONES,
    visibleJointKeys: EXTRA_VISIBLE_JOINT_KEYS,
  })
)
