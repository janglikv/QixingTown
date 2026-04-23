import { Vector3 } from 'three'
import { solveControlGraph } from './controlGraph.js'
import {
  createStickFigure,
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const CONTROL_POINTS = {
  footLeft: new Vector3(-0.22, -1, Z_OFFSET),
  footRight: new Vector3(0.22, -1, Z_OFFSET),
}

const CONTROL_CONSTRAINTS = [
  { type: 'offset', from: 'footLeft', to: 'kneeLeft', offset: new Vector3(0.04, 0.62, 0) }, // 左脚推导左膝。
  { type: 'offset', from: 'kneeLeft', to: 'hipLeft', offset: new Vector3(0.08, 0.34, 0) }, // 左膝推导左胯。
  { type: 'offset', from: 'footRight', to: 'kneeRight', offset: new Vector3(-0.04, 0.62, 0) }, // 右脚推导右膝。
  { type: 'offset', from: 'kneeRight', to: 'hipRight', offset: new Vector3(-0.08, 0.34, 0) }, // 右膝推导右胯。
  { type: 'offset', from: 'footLeft', to: 'hip', offset: new Vector3(0.22, 0.96, 0) }, // 用左脚固定点推导中心胯。
  { type: 'offset', from: 'hip', to: 'neck', offset: new Vector3(0, 0.52, 0) }, // 中心胯推导脖子。
  { type: 'offset', from: 'neck', to: 'head', offset: new Vector3(0, 0.38, 0) }, // 脖子推导头部。
  { type: 'offset', from: 'neck', to: 'shoulderLeft', offset: new Vector3(-0.12, -0.0, 0) }, // 脖子推导左肩。
  { type: 'offset', from: 'neck', to: 'shoulderRight', offset: new Vector3(0.12, -0.0, 0) }, // 脖子推导右肩。
  { type: 'offset', from: 'shoulderLeft', to: 'elbowLeft', offset: new Vector3(-0.24, -0.1, 0) }, // 左肩推导左肘。
  { type: 'offset', from: 'elbowLeft', to: 'handLeft', offset: new Vector3(-0.32, -0.02, 0) }, // 左肘推导左手。
  { type: 'offset', from: 'shoulderRight', to: 'elbowRight', offset: new Vector3(0.24, -0.1, 0) }, // 右肩推导右肘。
  { type: 'offset', from: 'elbowRight', to: 'handRight', offset: new Vector3(0.32, -0.02, 0) }, // 右肘推导右手。
]

const NPC3_BONES = [
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

const NPC3_VISIBLE_JOINT_KEYS = [
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

export const createNpc3 = ({
  name = 'npc3',
  position = [5.9, STICK_NPC_HEIGHT / 2, -4],
} = {}) => (
  createStickFigure({
    name,
    position,
    joints: solveControlGraph({
      points: CONTROL_POINTS,
      constraints: CONTROL_CONSTRAINTS,
    }),
    bones: NPC3_BONES,
    visibleJointKeys: NPC3_VISIBLE_JOINT_KEYS,
  })
)
