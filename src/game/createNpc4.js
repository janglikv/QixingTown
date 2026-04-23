import {
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import { solveControlGraph } from './controlGraph.js'
import {
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const TUBE_RADIUS = 0.045
const TUBE_RADIAL_SEGMENTS = 12
const END_CAP_RADIUS = 0.07
const HEAD_RADIUS = 0.18

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

const NPC4_TUBE_PATHS = [
  ['footLeft', 'kneeLeft', 'hipLeft', 'hip', 'hipRight', 'kneeRight', 'footRight'],
  ['handLeft', 'elbowLeft', 'shoulderLeft', 'neck', 'shoulderRight', 'elbowRight', 'handRight'],
  ['hip', 'neck', 'head'],
]

const NPC4_END_CAP_KEYS = [
  'head',
  'handLeft',
  'handRight',
  'footLeft',
  'footRight',
]

const createTube = ({ keys, joints, material }) => {
  const points = keys.map((key) => joints[key])
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  const geometry = new TubeGeometry(
    curve,
    (points.length - 1) * 18,
    TUBE_RADIUS,
    TUBE_RADIAL_SEGMENTS,
    false,
  )

  return new Mesh(geometry, material)
}

const createEndCap = ({ key, position, material }) => {
  const radius = key === 'head' ? HEAD_RADIUS : END_CAP_RADIUS
  const endCap = new Mesh(new SphereGeometry(radius, 16, 12), material)
  endCap.position.copy(position)
  return endCap
}

const createTubeStickFigure = ({ name, position, joints, tubePaths, endCapKeys }) => {
  const figure = new Group()
  const material = new MeshBasicMaterial({ color: '#000000' })

  tubePaths.forEach((keys) => {
    figure.add(createTube({ keys, joints, material }))
  })

  endCapKeys.forEach((key) => {
    figure.add(createEndCap({ key, position: joints[key], material }))
  })

  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material

  return figure
}

export const createNpc4 = ({
  name = 'npc4',
  position = [7.5, STICK_NPC_HEIGHT / 2, -4],
} = {}) => (
  createTubeStickFigure({
    name,
    position,
    joints: solveControlGraph({
      points: CONTROL_POINTS,
      constraints: CONTROL_CONSTRAINTS,
    }),
    tubePaths: NPC4_TUBE_PATHS,
    endCapKeys: NPC4_END_CAP_KEYS,
  })
)
