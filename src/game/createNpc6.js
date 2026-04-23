import {
  CanvasTexture,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three'
import {
  STICK_NPC_HEIGHT,
  Z_OFFSET,
} from './stickFigureParts.js'

const TUBE_RADIUS = 0.045
const TUBE_RADIAL_SEGMENTS = 12
const END_CAP_RADIUS = 0.07
const HEAD_RADIUS = 0.18
const BREATH_SPEED = 18.9
// 走路阶段保持重心稳定，避免头部上下位移。
const BREATH_TORSO_AMPLITUDE = 0
const BREATH_SHOULDER_AMPLITUDE = 0.001
const HEAD_EYES_TEXTURE_SIZE = 512
const HEAD_EYES_FONT_SIZE = 180
const HEAD_EYES_YAW = -Math.PI / 2

export const NPC6_PROPORTIONS = {
  // 脚底高度，调大/调小会整体改变脚在模型局部坐标里的高度。
  footY: -1,
  // 双脚离身体中线的半宽度，越大站姿越宽。
  footHalfWidth: 0.22,
  // 小腿：从脚 foot 到膝盖 knee，direction 的 x 控制左右偏移，y 控制向上高度。
  lowerLeg: {
    left: { length: Math.hypot(0.04, 0.62), direction: new Vector3(0.04, 0.62, 0) },
    right: { length: Math.hypot(0.04, 0.62), direction: new Vector3(-0.04, 0.62, 0) },
  },
  // 大腿：从膝盖 knee 到左右胯 hipLeft/hipRight。
  upperLeg: {
    left: { length: Math.hypot(0.38, 0.34), direction: new Vector3(0.08, 0.34, 0) },
    right: { length: Math.hypot(0.38, 0.34), direction: new Vector3(-0.08, 0.34, 0) },
  },
  // 躯干：从中心胯 hip 到脖子 neck。
  torso: { length: 0.52, direction: new Vector3(0, 1, 0) },
  // 颈部/头部高度：从脖子 neck 到头部中心 head。
  neck: { length: 0.38, direction: new Vector3(0, 1, 0) },
  // 肩宽：从脖子 neck 分别延伸到左右肩 shoulderLeft/shoulderRight。
  shoulder: {
    left: { length: 0.14, direction: new Vector3(-1, 0, 0) },
    right: { length: 0.14, direction: new Vector3(1, 0, 0) },
  },
  // 上臂：从肩 shoulder 到手肘 elbow。y 为负表示手臂向下垂。
  upperArm: {
    left: { length: Math.hypot(0.1, 0.34), direction: new Vector3(-0.1, -0.34, 0) },
    right: { length: Math.hypot(0.1, 0.34), direction: new Vector3(0.1, -0.34, 0) },
  },
  // 前臂：从手肘 elbow 到手 hand。x 越大，手离身体越远。
  lowerArm: {
    left: { length: Math.hypot(0.04, 0.32), direction: new Vector3(-0.04, -0.32, 0) },
    right: { length: Math.hypot(0.04, 0.32), direction: new Vector3(0.04, -0.32, 0) },
  },
}

const createSegmentOffset = ({ length, direction }) => (
  direction.clone().normalize().multiplyScalar(length)
)

export const createNpc6JointPositions = (proportions = NPC6_PROPORTIONS) => {
  const lowerLeft = createSegmentOffset(proportions.lowerLeg.left)
  const lowerRight = createSegmentOffset(proportions.lowerLeg.right)
  const upperLeft = createSegmentOffset(proportions.upperLeg.left)
  const upperRight = createSegmentOffset(proportions.upperLeg.right)
  // 以躯干为锚点，再向下反解腿部，让脚在摆动阶段可以真正离开地面。
  const hipY = proportions.footY + (
    lowerLeft.y + upperLeft.y + lowerRight.y + upperRight.y
  ) / 2
  const hipLeft = new Vector3(
    -proportions.footHalfWidth + lowerLeft.x + upperLeft.x,
    hipY,
    Z_OFFSET,
  )
  const hipRight = new Vector3(
    proportions.footHalfWidth + lowerRight.x + upperRight.x,
    hipY,
    Z_OFFSET,
  )
  const hip = hipLeft.clone().add(hipRight).multiplyScalar(0.5)
  const kneeLeft = hipLeft.clone().sub(upperLeft)
  const kneeRight = hipRight.clone().sub(upperRight)
  const footLeft = kneeLeft.clone().sub(lowerLeft)
  const footRight = kneeRight.clone().sub(lowerRight)
  const neck = hip.clone().add(createSegmentOffset(proportions.torso))
  const head = neck.clone().add(createSegmentOffset(proportions.neck))
  const shoulderLeft = neck.clone().add(createSegmentOffset(proportions.shoulder.left))
  const shoulderRight = neck.clone().add(createSegmentOffset(proportions.shoulder.right))
  const elbowLeft = shoulderLeft.clone().add(createSegmentOffset(proportions.upperArm.left))
  const elbowRight = shoulderRight.clone().add(createSegmentOffset(proportions.upperArm.right))
  const handLeft = elbowLeft.clone().add(createSegmentOffset(proportions.lowerArm.left))
  const handRight = elbowRight.clone().add(createSegmentOffset(proportions.lowerArm.right))

  return {
    footLeft,
    footRight,
    kneeLeft,
    kneeRight,
    hipLeft,
    hipRight,
    hip,
    neck,
    head,
    shoulderLeft,
    shoulderRight,
    elbowLeft,
    elbowRight,
    handLeft,
    handRight,
  }
}

const NPC6_TUBE_PATHS = [
  ['footLeft', 'kneeLeft', 'hipLeft', 'hip', 'hipRight', 'kneeRight', 'footRight'],
  ['handLeft', 'elbowLeft', 'shoulderLeft', 'neck', 'shoulderRight', 'elbowRight', 'handRight'],
  ['hip', 'neck', 'head'],
]

const NPC6_END_CAP_KEYS = [
  'head',
  'handLeft',
  'handRight',
  'footLeft',
  'footRight',
]

const createTubeGeometry = ({ keys, joints }) => {
  const points = keys.map((key) => joints[key])
  const curve = new CatmullRomCurve3(points, false, 'centripetal')

  return new TubeGeometry(
    curve,
    (points.length - 1) * 18,
    TUBE_RADIUS,
    TUBE_RADIAL_SEGMENTS,
    false,
  )
}

const createTube = ({ keys, joints, material }) => (
  new Mesh(createTubeGeometry({ keys, joints }), material)
)

const syncTubeStickFigurePose = ({ figure, joints }) => {
  figure.userData.tubes.forEach(({ mesh, keys }) => {
    mesh.geometry.dispose()
    mesh.geometry = createTubeGeometry({ keys, joints })
  })

  Object.entries(figure.userData.endCaps).forEach(([key, endCap]) => {
    endCap.position.copy(joints[key])
  })
}

const createEndCap = ({ key, position, material }) => {
  const radius = key === 'head' ? HEAD_RADIUS : END_CAP_RADIUS
  const endCap = new Mesh(new SphereGeometry(radius, 16, 12), material)
  endCap.position.copy(position)
  if (key === 'head') {
    // 把贴图中心转到角色正前方，避免眼睛跑到侧面。
    endCap.rotation.y = HEAD_EYES_YAW
  }
  return endCap
}

const createHeadEyesTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = HEAD_EYES_TEXTURE_SIZE
  canvas.height = HEAD_EYES_TEXTURE_SIZE
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Unable to create head texture context.')
  }

  context.fillStyle = '#000000'
  context.fillRect(0, 0, HEAD_EYES_TEXTURE_SIZE, HEAD_EYES_TEXTURE_SIZE)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `${HEAD_EYES_FONT_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`
  context.fillText('👀', HEAD_EYES_TEXTURE_SIZE / 2, HEAD_EYES_TEXTURE_SIZE / 2)

  const texture = new CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

const createTubeStickFigure = ({ name, position, joints, tubePaths, endCapKeys }) => {
  const figure = new Group()
  const material = new MeshStandardMaterial({
    color: '#000000',
    emissive: '#000000',
    emissiveIntensity: 0,
    metalness: 0.85,
    roughness: 0.28,
  })
  const tubes = []
  const endCaps = {}
  const headEyesTexture = createHeadEyesTexture()
  const headMaterial = new MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#000000',
    emissiveIntensity: 0,
    metalness: 0.85,
    roughness: 0.28,
    map: headEyesTexture,
  })

  tubePaths.forEach((keys) => {
    const mesh = createTube({ keys, joints, material })
    tubes.push({ mesh, keys })
    figure.add(mesh)
  })

  endCapKeys.forEach((key) => {
    const endCap = createEndCap({
      key,
      position: joints[key],
      material: key === 'head' ? headMaterial : material,
    })
    endCaps[key] = endCap
    figure.add(endCap)
  })

  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material
  figure.userData.tubes = tubes
  figure.userData.endCaps = endCaps
  figure.userData.headEyesTexture = headEyesTexture
  figure.userData.headMaterial = headMaterial

  return figure
}

const createBreathingProportions = ({ baseProportions, elapsed }) => {
  const breath = Math.sin(elapsed * BREATH_SPEED)

  return {
    ...baseProportions,
    torso: {
      ...baseProportions.torso,
      length: baseProportions.torso.length + breath * BREATH_TORSO_AMPLITUDE,
    },
    shoulder: {
      left: {
        ...baseProportions.shoulder.left,
        length: baseProportions.shoulder.left.length + breath * BREATH_SHOULDER_AMPLITUDE,
      },
      right: {
        ...baseProportions.shoulder.right,
        length: baseProportions.shoulder.right.length + breath * BREATH_SHOULDER_AMPLITUDE,
      },
    },
  }
}

const attachNpc6Breathing = ({ figure, proportions }) => {
  let elapsed = 0

  figure.userData.update = (delta) => {
    elapsed += delta

    const animatedProportions = createBreathingProportions({
      baseProportions: proportions,
      elapsed,
    })
    const joints = createNpc6JointPositions(animatedProportions)
    syncTubeStickFigurePose({ figure, joints })
  }
}

export const createNpc6 = ({
  name = 'npc6',
  position = [10.7, STICK_NPC_HEIGHT / 2, -4],
  proportions = NPC6_PROPORTIONS,
} = {}) => {
  const figure = createTubeStickFigure({
    name,
    position,
    joints: createNpc6JointPositions(proportions),
    tubePaths: NPC6_TUBE_PATHS,
    endCapKeys: NPC6_END_CAP_KEYS,
  })
  attachNpc6Breathing({ figure, proportions })

  figure.userData.dispose = () => {
    figure.userData.headEyesTexture?.dispose()
    figure.userData.headMaterial?.dispose()
  }

  return figure
}
