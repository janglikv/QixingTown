import { Vector3 } from 'three'
import {
  createStickFigure,
  mirrorX,
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const BASIC_PROPORTIONS = {
  // 脚底高度是整个人物的基准；腿变长时，上方关节会往上推，脚保持贴地。
  footY: -1,
  // 左右脚离身体中线的距离，越大站姿越开。
  footHalfWidth: 0.2,
  // 小腿长度：脚到膝盖。调大后，膝盖、髋、身体、头都会跟着上移。
  lowerLegLength: 0.62,
  // 大腿长度：膝盖到髋。调大后，髋、身体、头都会跟着上移。
  upperLegLength: 0.34,
  // 膝盖离身体中线的距离，越大腿越向外撇。
  upperLegInset: 0.16,
  // 肚子/身体长度：髋到脖子。调小就是“肚子短一点”。
  torsoLength: 0.52,
  // 脖子长度：脖子到头。调大就是“脖子长一点”。
  neckLength: 0.38,
  // 肩膀比脖子低多少。调大后肩膀下移，手臂起点更低。
  shoulderDrop: 0.2,
  // 半个肩宽。调大后肩膀和手臂整体更宽。
  shoulderHalfWidth: 0.25,
  // 上手臂：肩膀到肘。现在故意很短，调 x/y 可以控制肘相对肩膀的位置。
  upperArmOffset: new Vector3(0.01, -0.02, 0),
  // 下手臂：肘到手。调大 x 会让手伸得更远。
  lowerArmOffset: new Vector3(0.4, 0, 0),
}

const createBasicJointPositions = () => {
  // 从脚往上推导，保证下方段变长时，上方身体整体跟着移动。
  const kneeY = BASIC_PROPORTIONS.footY + BASIC_PROPORTIONS.lowerLegLength
  const hipY = kneeY + BASIC_PROPORTIONS.upperLegLength
  const neckY = hipY + BASIC_PROPORTIONS.torsoLength
  const headY = neckY + BASIC_PROPORTIONS.neckLength
  const shoulderY = neckY - BASIC_PROPORTIONS.shoulderDrop

  const shoulderRight = new Vector3(
    BASIC_PROPORTIONS.shoulderHalfWidth,
    shoulderY,
    Z_OFFSET,
  )
  const elbowRight = shoulderRight.clone().add(BASIC_PROPORTIONS.upperArmOffset)
  const handRight = elbowRight.clone().add(BASIC_PROPORTIONS.lowerArmOffset)

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
    kneeLeft: new Vector3(-BASIC_PROPORTIONS.upperLegInset, kneeY, Z_OFFSET),
    kneeRight: new Vector3(BASIC_PROPORTIONS.upperLegInset, kneeY, Z_OFFSET),
    footLeft: new Vector3(-BASIC_PROPORTIONS.footHalfWidth, BASIC_PROPORTIONS.footY, Z_OFFSET),
    footRight: new Vector3(BASIC_PROPORTIONS.footHalfWidth, BASIC_PROPORTIONS.footY, Z_OFFSET),
  }
}

const BASIC_BONES = [
  ['head', 'neck'],
  ['neck', 'shoulderLeft'],
  ['neck', 'shoulderRight'],
  ['shoulderLeft', 'elbowLeft'],
  ['shoulderRight', 'elbowRight'],
  ['elbowLeft', 'handLeft'],
  ['elbowRight', 'handRight'],
  ['neck', 'hip'],
  ['hip', 'kneeLeft'],
  ['hip', 'kneeRight'],
  ['kneeLeft', 'footLeft'],
  ['kneeRight', 'footRight'],
]

const BASIC_VISIBLE_JOINT_KEYS = [
  'head',
  'neck',
  'elbowLeft',
  'elbowRight',
  'handLeft',
  'handRight',
  'hip',
  'kneeLeft',
  'kneeRight',
  'footLeft',
  'footRight',
]

export const createNpc1 = ({
  name = 'npc1',
  position = [2.5, STICK_NPC_HEIGHT / 2, -4],
} = {}) => (
  createStickFigure({
    name,
    position,
    joints: createBasicJointPositions(),
    bones: BASIC_BONES,
    visibleJointKeys: BASIC_VISIBLE_JOINT_KEYS,
  })
)
