import {
  DoubleSide,
  Group,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js'
import { solveControlGraph } from './controlGraph.js'
import {
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const FIELD_RESOLUTION = 56
const FIELD_SIZE = 2.8
const FIELD_ISOLATION = 80
const FIELD_SUBTRACT = 14
const FIELD_CENTER = new Vector3(0, -0.06, Z_OFFSET)
const LIMB_RADIUS = 0.034
const TORSO_RADIUS = 0.046
const HEAD_RADIUS = 0.125
const SAMPLE_STEP = 0.028

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

const FIELD_SEGMENTS = [
  ['footLeft', 'kneeLeft', LIMB_RADIUS],
  ['kneeLeft', 'hipLeft', LIMB_RADIUS],
  ['hipLeft', 'hip', TORSO_RADIUS],
  ['hip', 'hipRight', TORSO_RADIUS],
  ['hipRight', 'kneeRight', LIMB_RADIUS],
  ['kneeRight', 'footRight', LIMB_RADIUS],
  ['hip', 'neck', TORSO_RADIUS],
  ['neck', 'head', TORSO_RADIUS],
  ['handLeft', 'elbowLeft', LIMB_RADIUS],
  ['elbowLeft', 'shoulderLeft', LIMB_RADIUS],
  ['shoulderLeft', 'neck', TORSO_RADIUS],
  ['neck', 'shoulderRight', TORSO_RADIUS],
  ['shoulderRight', 'elbowRight', LIMB_RADIUS],
  ['elbowRight', 'handRight', LIMB_RADIUS],
]

const FIELD_END_POINTS = [
  ['head', HEAD_RADIUS],
  ['handLeft', LIMB_RADIUS],
  ['handRight', LIMB_RADIUS],
  ['footLeft', LIMB_RADIUS],
  ['footRight', LIMB_RADIUS],
]

const toFieldPoint = (point) => ({
  x: (point.x - FIELD_CENTER.x) / FIELD_SIZE + 0.5,
  y: (point.y - FIELD_CENTER.y) / FIELD_SIZE + 0.5,
  z: (point.z - FIELD_CENTER.z) / FIELD_SIZE + 0.5,
})

const getStrength = (radius) => (
  (FIELD_ISOLATION + FIELD_SUBTRACT) * (radius / FIELD_SIZE) ** 2
)

const addFieldBall = ({ field, point, radius }) => {
  const fieldPoint = toFieldPoint(point)
  field.addBall(
    fieldPoint.x,
    fieldPoint.y,
    fieldPoint.z,
    getStrength(radius),
    FIELD_SUBTRACT,
  )
}

const addFieldSegment = ({ field, start, end, radius }) => {
  const distance = start.distanceTo(end)
  const sampleCount = Math.max(1, Math.ceil(distance / SAMPLE_STEP))

  // 线段用密集小球场采样，统一等值面会把关节和末端自然焊成整体。
  for (let index = 0; index <= sampleCount; index += 1) {
    addFieldBall({
      field,
      point: start.clone().lerp(end, index / sampleCount),
      radius,
    })
  }
}

const createImplicitFigure = ({ name, position, joints }) => {
  const material = new MeshBasicMaterial({ color: '#000000', side: DoubleSide })
  const field = new MarchingCubes(FIELD_RESOLUTION, material, false, false, 60000)
  field.name = `${name}-field`
  field.isolation = FIELD_ISOLATION
  field.scale.setScalar(FIELD_SIZE / 2)
  field.position.copy(FIELD_CENTER)
  field.reset()

  FIELD_SEGMENTS.forEach(([startKey, endKey, radius]) => {
    addFieldSegment({
      field,
      start: joints[startKey],
      end: joints[endKey],
      radius,
    })
  })

  FIELD_END_POINTS.forEach(([key, radius]) => {
    addFieldBall({ field, point: joints[key], radius })
  })

  field.update()

  const figure = new Group()
  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material
  figure.add(field)

  return figure
}

export const createNpc5 = ({
  name = 'npc5',
  position = [9.1, STICK_NPC_HEIGHT / 2, -4],
} = {}) => (
  createImplicitFigure({
    name,
    position,
    joints: solveControlGraph({
      points: CONTROL_POINTS,
      constraints: CONTROL_CONSTRAINTS,
    }),
  })
)
