import {
  AnimationClip,
  AnimationMixer,
  Bone,
  CanvasTexture,
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  NumberKeyframeTrack,
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
const CONTROL_POINT_RADIUS = 0.04
const HEAD_EYES_TEXTURE_SIZE = 512
const HEAD_EYES_FONT_SIZE = 180
const HEAD_EYES_YAW = -Math.PI / 2
const SQUAT_CLIP_DURATION = 1.4

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
  const leftLegHeight = lowerLeft.y + upperLeft.y
  const rightLegHeight = lowerRight.y + upperRight.y
  // 以最低的脚为地面锚点，另一只脚缩短时才能自然离地。
  const hipY = proportions.footY + Math.max(leftLegHeight, rightLegHeight)
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

const NPC6_CONTROL_POINT_KEYS = [
  'footLeft',
  'kneeLeft',
  'hipLeft',
  'hip',
  'hipRight',
  'kneeRight',
  'footRight',
  'neck',
  'head',
  'shoulderLeft',
  'shoulderRight',
  'elbowLeft',
  'elbowRight',
  'handLeft',
  'handRight',
]

const NPC6_BONE_KEYS = NPC6_CONTROL_POINT_KEYS

const createNamedBone = (key) => {
  const bone = new Bone()
  bone.name = key
  return bone
}

const setBoneOffset = ({ bones, joints, key, parentKey }) => {
  bones[key].position.copy(joints[key]).sub(joints[parentKey])
}

const createNpc6Skeleton = (joints) => {
  const bones = Object.fromEntries(
    NPC6_BONE_KEYS.map((key) => [key, createNamedBone(key)]),
  )

  bones.hip.position.copy(joints.hip)
  bones.hip.add(bones.hipLeft, bones.hipRight, bones.neck)
  bones.hipLeft.add(bones.kneeLeft)
  bones.kneeLeft.add(bones.footLeft)
  bones.hipRight.add(bones.kneeRight)
  bones.kneeRight.add(bones.footRight)
  bones.neck.add(bones.head, bones.shoulderLeft, bones.shoulderRight)
  bones.shoulderLeft.add(bones.elbowLeft)
  bones.elbowLeft.add(bones.handLeft)
  bones.shoulderRight.add(bones.elbowRight)
  bones.elbowRight.add(bones.handRight)

  setBoneOffset({ bones, joints, key: 'hipLeft', parentKey: 'hip' })
  setBoneOffset({ bones, joints, key: 'hipRight', parentKey: 'hip' })
  setBoneOffset({ bones, joints, key: 'neck', parentKey: 'hip' })
  setBoneOffset({ bones, joints, key: 'kneeLeft', parentKey: 'hipLeft' })
  setBoneOffset({ bones, joints, key: 'footLeft', parentKey: 'kneeLeft' })
  setBoneOffset({ bones, joints, key: 'kneeRight', parentKey: 'hipRight' })
  setBoneOffset({ bones, joints, key: 'footRight', parentKey: 'kneeRight' })
  setBoneOffset({ bones, joints, key: 'head', parentKey: 'neck' })
  setBoneOffset({ bones, joints, key: 'shoulderLeft', parentKey: 'neck' })
  setBoneOffset({ bones, joints, key: 'shoulderRight', parentKey: 'neck' })
  setBoneOffset({ bones, joints, key: 'elbowLeft', parentKey: 'shoulderLeft' })
  setBoneOffset({ bones, joints, key: 'handLeft', parentKey: 'elbowLeft' })
  setBoneOffset({ bones, joints, key: 'elbowRight', parentKey: 'shoulderRight' })
  setBoneOffset({ bones, joints, key: 'handRight', parentKey: 'elbowRight' })

  return {
    root: bones.hip,
    bones,
  }
}

const readSkeletonJointPositions = ({ figure, bones }) => {
  const joints = {}

  figure.updateMatrixWorld(true)
  NPC6_BONE_KEYS.forEach((key) => {
    joints[key] = figure.worldToLocal(bones[key].getWorldPosition(new Vector3()))
  })

  return joints
}

const getFootCenter = (joints) => (
  joints.footLeft.clone().add(joints.footRight).multiplyScalar(0.5)
)

const lockNpc6Feet = ({ figure }) => {
  const joints = readSkeletonJointPositions({
    figure,
    bones: figure.userData.bones,
  })
  const offset = figure.userData.plantedFootCenter.clone().sub(getFootCenter(joints))

  // hip 是骨架根节点；用脚中心反推根节点位置，避免支撑脚被关键帧带着滑动。
  figure.userData.skeletonRoot.position.add(offset)
}

const createNpc6SquatClip = (joints) => {
  const times = [0, SQUAT_CLIP_DURATION / 2, SQUAT_CLIP_DURATION]
  const neckOffset = joints.neck.clone().sub(joints.hip)

  return new AnimationClip('npc6-squat-stand', SQUAT_CLIP_DURATION, [
    // neck 是躯干顶点；移动它而不是旋转它，才能真正让 hip->neck 这段躯干前倾。
    new NumberKeyframeTrack('neck.position[y]', times, [neckOffset.y, neckOffset.y - 0.16, neckOffset.y]),
    new NumberKeyframeTrack('neck.position[z]', times, [neckOffset.z, neckOffset.z + 0.46, neckOffset.z]),
    new NumberKeyframeTrack('hipLeft.rotation[x]', times, [0, -1.3, 0]),
    new NumberKeyframeTrack('kneeLeft.rotation[x]', times, [0, 1.85, 0]),
    new NumberKeyframeTrack('hipRight.rotation[x]', times, [0, -1.3, 0]),
    new NumberKeyframeTrack('kneeRight.rotation[x]', times, [0, 1.85, 0]),
    new NumberKeyframeTrack('shoulderLeft.rotation[z]', times, [0, 0.18, 0]),
    new NumberKeyframeTrack('shoulderRight.rotation[z]', times, [0, -0.18, 0]),
  ])
}

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

  Object.entries(figure.userData.controlPoints).forEach(([key, controlPoint]) => {
    controlPoint.position.copy(joints[key])
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

const createControlPoints = ({ joints, material }) => {
  const group = new Group()
  const controlPoints = {}

  NPC6_CONTROL_POINT_KEYS.forEach((key) => {
    const controlPoint = new Mesh(
      new SphereGeometry(CONTROL_POINT_RADIUS, 12, 8),
      material,
    )
    controlPoint.name = `${key}ControlPoint`
    controlPoint.position.copy(joints[key])
    controlPoints[key] = controlPoint
    group.add(controlPoint)
  })

  group.name = 'npc6-control-points'

  return {
    group,
    controlPoints,
  }
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
  const controlPointMaterial = new MeshStandardMaterial({
    color: '#4de6ff',
    emissive: '#116d80',
    emissiveIntensity: 0.45,
    metalness: 0.1,
    roughness: 0.25,
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

  const { group: controlPointGroup, controlPoints } = createControlPoints({
    joints,
    material: controlPointMaterial,
  })
  figure.add(controlPointGroup)

  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material
  figure.userData.tubes = tubes
  figure.userData.endCaps = endCaps
  figure.userData.controlPoints = controlPoints
  figure.userData.controlPointMaterial = controlPointMaterial
  figure.userData.headEyesTexture = headEyesTexture
  figure.userData.headMaterial = headMaterial

  return figure
}

const attachNpc6SkeletonSync = ({ figure }) => {
  figure.userData.update = (delta) => {
    figure.userData.mixer?.update(delta)
    lockNpc6Feet({ figure })

    const joints = readSkeletonJointPositions({
      figure,
      bones: figure.userData.bones,
    })
    syncTubeStickFigurePose({ figure, joints })
  }
}

export const createNpc6 = ({
  name = 'npc6',
  position = [10.7, STICK_NPC_HEIGHT / 2, -4],
  proportions = NPC6_PROPORTIONS,
} = {}) => {
  const joints = createNpc6JointPositions(proportions)
  const skeleton = createNpc6Skeleton(joints)
  const figure = createTubeStickFigure({
    name,
    position,
    joints,
    tubePaths: NPC6_TUBE_PATHS,
    endCapKeys: NPC6_END_CAP_KEYS,
  })
  figure.add(skeleton.root)
  const squatClip = createNpc6SquatClip(joints)
  figure.userData.proportions = proportions
  figure.userData.mixer = new AnimationMixer(figure)
  figure.userData.squatAction = figure.userData.mixer.clipAction(squatClip)
  figure.userData.squatAction.play()
  figure.userData.skeletonRoot = skeleton.root
  figure.userData.bones = skeleton.bones
  figure.userData.plantedFootCenter = getFootCenter(joints)
  figure.userData.animations = {
    squat: squatClip,
  }
  figure.userData.syncPose = () => {
    syncTubeStickFigurePose({
      figure,
      joints: readSkeletonJointPositions({
        figure,
        bones: skeleton.bones,
      }),
    })
  }
  attachNpc6SkeletonSync({ figure })

  figure.userData.dispose = () => {
    figure.userData.mixer.stopAllAction()
    figure.userData.headEyesTexture?.dispose()
    figure.userData.headMaterial?.dispose()
    figure.userData.controlPointMaterial?.dispose()
  }

  return figure
}
