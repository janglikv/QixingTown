import {
  Bone,
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
const CONTROL_POINT_RADIUS = 0.01
const HEAD_EYES_TEXTURE_SIZE = 512
const HEAD_EYES_FONT_SIZE = 180
const HEAD_EYES_YAW = -Math.PI / 2
const UPPER_BODY_TRANSITION_SPEED = 7.2
const UPPER_BODY_REACH_EPSILON = 0.025
const WAVE_LOOP_SPEED = 7.4
const LOWER_BODY_TRANSITION_DURATION = 0.46
const SQUAT_ACTION_SPEED = 3.4
const SQUAT_BODY_FORWARD_Z = 0.28
const BUTT_TWIST_ACTION_SPEED = 7.2
const BUTT_TWIST_HIP_X = 0.16
const BUTT_TWIST_THIGH_Z = 0.22

const UPPER_BODY_POSES = {
  idle: {
    shoulderLeftZ: 0,
    elbowLeftZ: 0,
    shoulderRightZ: 0,
    elbowRightZ: 0,
  },
  holdHead: {
    shoulderLeftZ: -1.9,
    elbowLeftZ: -2.03,
    shoulderRightZ: 1.9,
    elbowRightZ: 2.03,
  },
  raiseLeft: {
    shoulderLeftZ: -2.05,
    elbowLeftZ: -0.8,
    shoulderRightZ: 0,
    elbowRightZ: 0,
  },
  raiseRight: {
    shoulderLeftZ: 0,
    elbowLeftZ: 0,
    shoulderRightZ: 2.05,
    elbowRightZ: 0.8,
  },
  raiseBoth: {
    shoulderLeftZ: -2.05,
    elbowLeftZ: -0.8,
    shoulderRightZ: 2.05,
    elbowRightZ: 0.8,
  },
}

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

const lockNpc6Feet = ({ figure }) => {
  const joints = readSkeletonJointPositions({
    figure,
    bones: figure.userData.bones,
  })
  const lockedFeet = Object.entries(figure.userData.footLocks)
    .filter(([, footLock]) => footLock.enabled)
  if (lockedFeet.length === 0) return

  const offset = lockedFeet
    .reduce((sum, [key, footLock]) => sum.add(footLock.target.clone().sub(joints[key])), new Vector3())
    .multiplyScalar(1 / lockedFeet.length)

  // hip 是骨架根节点；用已锁定脚的平均偏移反推根节点位置，避免支撑脚被关键帧带着滑动。
  figure.userData.skeletonRoot.position.add(offset)
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
    controlPoint.renderOrder = 20
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
    color: '#ffea4d',
    emissive: '#ff9f1a',
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.25,
    depthTest: false,
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
  figure.userData.controlPointGroup = controlPointGroup
  figure.userData.controlPoints = controlPoints
  figure.userData.controlPointMaterial = controlPointMaterial
  figure.userData.headEyesTexture = headEyesTexture
  figure.userData.headMaterial = headMaterial

  return figure
}

const attachNpc6SkeletonSync = ({ figure }) => {
  figure.userData.update = (delta) => {
    figure.userData.updateLowerBody?.(delta)
    figure.userData.updateUpperBody?.(delta)
    lockNpc6Feet({ figure })

    const joints = readSkeletonJointPositions({
      figure,
      bones: figure.userData.bones,
    })
    syncTubeStickFigurePose({ figure, joints })
  }
}

const createLowerBodyPoses = (joints) => {
  const neckOffset = joints.neck.clone().sub(joints.hip)
  const hipLeftOffset = joints.hipLeft.clone().sub(joints.hip)
  const hipRightOffset = joints.hipRight.clone().sub(joints.hip)

  return {
    stand: {
      rootX: joints.hip.x,
      hipZ: 0,
      hipLeftOffsetX: hipLeftOffset.x,
      hipRightOffsetX: hipRightOffset.x,
      neckX: neckOffset.x,
      neckZ: neckOffset.z,
      neckRotationZ: 0,
      hipLeftX: 0,
      hipLeftZ: 0,
      kneeLeftX: 0,
      hipRightX: 0,
      hipRightZ: 0,
      kneeRightX: 0,
    },
    squat: {
      rootX: joints.hip.x,
      hipZ: 0,
      hipLeftOffsetX: hipLeftOffset.x,
      hipRightOffsetX: hipRightOffset.x,
      neckX: neckOffset.x,
      neckZ: neckOffset.z + SQUAT_BODY_FORWARD_Z,
      neckRotationZ: 0,
      hipLeftX: -1.3,
      hipLeftZ: 0,
      kneeLeftX: 1.85,
      hipRightX: -1.3,
      hipRightZ: 0,
      kneeRightX: 1.85,
    },
  }
}

const getNpc6ArmPose = ({ bones }) => ({
  shoulderLeftZ: bones.shoulderLeft.rotation.z,
  elbowLeftZ: bones.elbowLeft.rotation.z,
  shoulderRightZ: bones.shoulderRight.rotation.z,
  elbowRightZ: bones.elbowRight.rotation.z,
})

const moveValueToward = ({ current, target, maxStep }) => {
  const diff = target - current
  if (Math.abs(diff) <= maxStep) return target

  return current + Math.sign(diff) * maxStep
}

const movePoseToward = ({ current, target, maxStep }) => ({
  ...Object.fromEntries(
    Object.keys(target).map((key) => [
      key,
      moveValueToward({
        current: current[key],
        target: target[key],
        maxStep,
      }),
    ]),
  ),
})

const getPoseDistance = ({ current, target }) => Math.max(
  ...Object.keys(target).map((key) => Math.abs(current[key] - target[key])),
)

const mixPose = ({ from, to, amount }) => Object.fromEntries(
  Object.keys(to).map((key) => [
    key,
    from[key] + (to[key] - from[key]) * amount,
  ]),
)

const smoothStep = (value) => {
  const amount = Math.min(Math.max(value, 0), 1)

  return amount * amount * (3 - 2 * amount)
}

const applyNpc6LowerBodyPose = ({ bones, pose }) => {
  bones.hip.position.x = pose.rootX
  bones.hip.rotation.z = pose.hipZ
  bones.hipLeft.position.x = pose.hipLeftOffsetX
  bones.hipRight.position.x = pose.hipRightOffsetX
  bones.neck.position.x = pose.neckX
  bones.neck.position.z = pose.neckZ
  bones.neck.rotation.z = pose.neckRotationZ
  bones.hipLeft.rotation.x = pose.hipLeftX
  bones.hipLeft.rotation.z = pose.hipLeftZ
  bones.kneeLeft.rotation.x = pose.kneeLeftX
  bones.hipRight.rotation.x = pose.hipRightX
  bones.hipRight.rotation.z = pose.hipRightZ
  bones.kneeRight.rotation.x = pose.kneeRightX
}

const applyNpc6ArmPose = ({ bones, pose }) => {
  bones.shoulderLeft.rotation.z = pose.shoulderLeftZ
  bones.elbowLeft.rotation.z = pose.elbowLeftZ
  bones.shoulderRight.rotation.z = pose.shoulderRightZ
  bones.elbowRight.rotation.z = pose.elbowRightZ
}

const createNpc6LowerBodyController = ({ bones, joints }) => {
  const poses = createLowerBodyPoses(joints)
  const state = {
    mode: 'stand',
    phase: 'hold',
    actionTime: 0,
    buttTwistEnabled: false,
    buttTwistTime: 0,
    currentBasePose: poses.stand,
    transitionFrom: poses.stand,
    transitionTo: poses.stand,
    transitionElapsed: 0,
  }

  const getTargetPose = () => {
    if (state.mode === 'squatPose' || state.mode === 'squatAction') return poses.squat

    return poses.stand
  }

  const setMode = (mode) => {
    if (state.mode === mode && state.phase !== 'transition') return

    state.mode = mode
    state.phase = 'transition'
    state.actionTime = 0
    state.transitionFrom = state.currentBasePose
    state.transitionTo = getTargetPose()
    state.transitionElapsed = 0
  }

  const applyPose = (pose) => {
    state.currentBasePose = pose

    if (!state.buttTwistEnabled) {
      applyNpc6LowerBodyPose({ bones, pose })
      return
    }

    const sway = Math.sin(state.buttTwistTime)
    const hipOffset = sway * BUTT_TWIST_HIP_X

    // 在当前基础姿态上叠加：腰/胯左右摆，大腿跟随转向，肩膀通过 neck 反向位移保持稳定。
    applyNpc6LowerBodyPose({
      bones,
      pose: {
        ...pose,
        rootX: pose.rootX + hipOffset,
        hipLeftOffsetX: pose.hipLeftOffsetX - hipOffset,
        hipRightOffsetX: pose.hipRightOffsetX - hipOffset,
        neckX: pose.neckX - hipOffset,
        hipLeftZ: pose.hipLeftZ + sway * BUTT_TWIST_THIGH_Z,
        hipRightZ: pose.hipRightZ + sway * BUTT_TWIST_THIGH_Z,
      },
    })
  }

  const update = (delta) => {
    if (state.buttTwistEnabled) state.buttTwistTime += delta * BUTT_TWIST_ACTION_SPEED

    if (state.phase === 'transition') {
      state.transitionElapsed += delta
      applyPose(mixPose({
        from: state.transitionFrom,
        to: state.transitionTo,
        amount: smoothStep(state.transitionElapsed / LOWER_BODY_TRANSITION_DURATION),
      }))
      if (state.transitionElapsed >= LOWER_BODY_TRANSITION_DURATION) {
        applyPose(state.transitionTo)
        if (state.mode === 'squatAction') state.actionTime = 0
        state.phase = state.mode === 'squatAction' ? 'actionLoop' : 'hold'
      }
      return
    }

    if (state.phase === 'actionLoop') {
      state.actionTime += delta * SQUAT_ACTION_SPEED
      applyPose(mixPose({
        from: poses.stand,
        to: poses.squat,
        amount: (Math.cos(state.actionTime) + 1) / 2,
      }))
      return
    }

    applyPose(getTargetPose())
  }

  return {
    setMode,
    setButtTwistEnabled: (enabled) => {
      state.buttTwistEnabled = enabled
      if (enabled) state.buttTwistTime = 0
    },
    update,
  }
}

const getUpperBodyTargetPose = (mode) => {
  if (mode === 'holdHead') return UPPER_BODY_POSES.holdHead
  if (mode === 'raiseLeft' || mode === 'waveLeft') return UPPER_BODY_POSES.raiseLeft
  if (mode === 'raiseRight' || mode === 'waveRight') return UPPER_BODY_POSES.raiseRight
  if (mode === 'raiseBoth' || mode === 'waveBothSame' || mode === 'waveBothMirror') {
    return UPPER_BODY_POSES.raiseBoth
  }

  return UPPER_BODY_POSES.idle
}

const isUpperBodyWaveMode = (mode) => (
  mode === 'waveLeft'
  || mode === 'waveRight'
  || mode === 'waveBothSame'
  || mode === 'waveBothMirror'
)

const getUpperBodyWavePose = ({ mode, waveTime }) => {
  const wave = Math.sin(waveTime) * 0.7

  if (mode === 'waveLeft') {
    return {
      ...UPPER_BODY_POSES.raiseLeft,
      elbowLeftZ: -0.95 - wave,
    }
  }
  if (mode === 'waveBothSame') {
    return {
      ...UPPER_BODY_POSES.raiseBoth,
      elbowLeftZ: -0.95 - wave,
      elbowRightZ: 0.95 + wave,
    }
  }
  if (mode === 'waveBothMirror') {
    return {
      ...UPPER_BODY_POSES.raiseBoth,
      elbowLeftZ: -0.95 - wave,
      elbowRightZ: 0.95 - wave,
    }
  }

  return {
    ...UPPER_BODY_POSES.raiseRight,
    elbowRightZ: 0.95 + wave,
  }
}

const createNpc6UpperBodyController = ({ bones }) => {
  const state = {
    mode: 'idle',
    phase: 'hold',
    waveTime: 0,
  }

  const setMode = (mode) => {
    if (state.mode === mode && state.phase !== 'transition') return

    state.mode = mode
    state.phase = 'transition'
    state.waveTime = 0
  }

  const update = (delta) => {
    if (state.phase === 'transition') {
      const target = getUpperBodyTargetPose(state.mode)
      const nextPose = movePoseToward({
        current: getNpc6ArmPose({ bones }),
        target,
        maxStep: UPPER_BODY_TRANSITION_SPEED * delta,
      })

      applyNpc6ArmPose({ bones, pose: nextPose })
      if (getPoseDistance({ current: nextPose, target }) <= UPPER_BODY_REACH_EPSILON) {
        applyNpc6ArmPose({ bones, pose: target })
        state.phase = isUpperBodyWaveMode(state.mode) ? 'waveLoop' : 'hold'
      }
      return
    }

    if (state.phase === 'waveLoop') {
      state.waveTime += delta * WAVE_LOOP_SPEED
      applyNpc6ArmPose({
        bones,
        pose: getUpperBodyWavePose({
          mode: state.mode,
          waveTime: state.waveTime,
        }),
      })
      return
    }

    applyNpc6ArmPose({
      bones,
      pose: getUpperBodyTargetPose(state.mode),
    })
  }

  return {
    setMode,
    update,
  }
}

export const createNpc6 = ({
  name = 'npc6',
  position = [10.7, STICK_NPC_HEIGHT / 2, -4],
  proportions = NPC6_PROPORTIONS,
  upperPose = 'idle',
  squatPose = false,
  squatAction = false,
  buttTwistAction = false,
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
  figure.userData.proportions = proportions
  figure.userData.skeletonRoot = skeleton.root
  figure.userData.bones = skeleton.bones
  figure.userData.footLocks = {
    footLeft: { enabled: true, target: joints.footLeft.clone() },
    footRight: { enabled: true, target: joints.footRight.clone() },
  }
  const lowerBody = createNpc6LowerBodyController({ bones: skeleton.bones, joints })
  const upperBody = createNpc6UpperBodyController({ bones: skeleton.bones })
  figure.userData.updateLowerBody = lowerBody.update
  figure.userData.updateUpperBody = upperBody.update
  figure.userData.setSquatPose = (enabled) => {
    lowerBody.setMode(enabled ? 'squatPose' : 'stand')
  }
  figure.userData.setSquatAction = (enabled) => {
    lowerBody.setMode(enabled ? 'squatAction' : 'stand')
  }
  figure.userData.setButtTwistAction = (enabled) => {
    lowerBody.setButtTwistEnabled(enabled)
  }
  figure.userData.setControlPointsVisible = (visible) => {
    figure.userData.controlPointGroup.visible = visible
  }
  figure.userData.setHoldHeadPose = (enabled) => {
    upperBody.setMode(enabled ? 'holdHead' : 'idle')
  }
  figure.userData.setHandRaisePose = (side) => {
    if (side === 'left') {
      upperBody.setMode('raiseLeft')
    } else if (side === 'right') {
      upperBody.setMode('raiseRight')
    } else if (side === 'both') {
      upperBody.setMode('raiseBoth')
    } else {
      upperBody.setMode('idle')
    }
  }
  figure.userData.setWaveAction = (side) => {
    if (side === 'left') {
      upperBody.setMode('waveLeft')
    } else if (side === 'right') {
      upperBody.setMode('waveRight')
    } else if (side === 'bothSame') {
      upperBody.setMode('waveBothSame')
    } else if (side === 'bothMirror') {
      upperBody.setMode('waveBothMirror')
    } else {
      upperBody.setMode('idle')
    }
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
  if (upperPose === 'holdHead') {
    figure.userData.setHoldHeadPose(true)
  } else if (upperPose !== 'idle') {
    figure.userData.setHandRaisePose(upperPose)
  }
  if (squatAction) {
    figure.userData.setSquatAction(true)
  } else if (squatPose) {
    figure.userData.setSquatPose(true)
  }
  if (buttTwistAction) {
    figure.userData.setButtTwistAction(true)
  }

  figure.userData.dispose = () => {
    figure.userData.headEyesTexture?.dispose()
    figure.userData.headMaterial?.dispose()
    figure.userData.controlPointMaterial?.dispose()
  }

  return figure
}
