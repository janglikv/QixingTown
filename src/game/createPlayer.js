import {
  CanvasTexture,
  MeshStandardMaterial,
} from 'three'
import {
  createRigDefinition,
  createRigFigure,
  createRigJointPositions,
} from '../lib/rigkit/index.js'
import { STICK_FIGURE_HEIGHT } from './stickFigureParts.js'

const HEAD_EYES_TEXTURE_SIZE = 512
const HEAD_EYES_FONT_SIZE = 180
const HEAD_EYES_YAW = Math.PI / 2

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

const createHeadMaterial = () => {
  const texture = createHeadEyesTexture()

  return {
    material: new MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#000000',
      emissiveIntensity: 0,
      metalness: 0.85,
      roughness: 0.28,
      map: texture,
    }),
    textures: [texture],
  }
}

const PLAYER_DEFINITION = {
  root: {
    key: 'hip',
    cname: '身体',
    children: {
      // Player 本地坐标里 x < 0 是左侧，z < 0 是正面，和眼睛朝向保持一致。
      hipLeft: {
        key: 'hipLeft',
        cname: '左胯',
        length: 0.1,
        direction: [-1, 0, 0],
        children: {
          kneeLeft: {
            key: 'kneeLeft',
            cname: '左腿',
            length: 0.35,
            direction: [-0.08, -0.34, 0],
            children: {
              footLeft: {
                key: 'footLeft',
                cname: '左脚',
                length: 0.62,
                direction: [-0.04, -0.62, 0],
                supportContact: true,
                ik: {
                  up: 2,
                },
              },
            },
          },
        },
      },
      hipRight: {
        key: 'hipRight',
        cname: '右胯',
        length: 0.1,
        direction: [1, 0, 0],
        children: {
          kneeRight: {
            key: 'kneeRight',
            cname: '右腿',
            length: 0.35,
            direction: [0.08, -0.34, 0],
            children: {
              footRight: {
                key: 'footRight',
                cname: '右脚',
                length: 0.62,
                direction: [0.04, -0.62, 0],
                supportContact: true,
                ik: {
                  up: 2,
                },
              },
            },
          },
        },
      },
      neck: {
        key: 'neck',
        cname: '脖子',
        length: 0.52,
        direction: [0, 1, 0],
        children: {
          head: {
            key: 'head',
            cname: '头部',
            length: 0.38,
            direction: [0, 1, 0],
          },
          shoulderLeft: {
            key: 'shoulderLeft',
            cname: '左肩',
            length: 0.14,
            direction: [-1, 0, 0],
            children: {
              elbowLeft: {
                key: 'elbowLeft',
                cname: '左臂',
                length: 0.35,
                direction: [-0.1, -0.34, 0],
                children: {
                  handLeft: {
                    key: 'handLeft',
                    cname: '左手',
                    length: 0.32,
                    direction: [-0.04, -0.32, 0],
                    ik: {
                      up: 2,
                    },
                  },
                },
              },
            },
          },
          shoulderRight: {
            key: 'shoulderRight',
            cname: '右肩',
            length: 0.14,
            direction: [1, 0, 0],
            children: {
              elbowRight: {
                key: 'elbowRight',
                cname: '右臂',
                length: 0.35,
                direction: [0.1, -0.34, 0],
                children: {
                  handRight: {
                    key: 'handRight',
                    cname: '右手',
                    length: 0.32,
                    direction: [0.04, -0.32, 0],
                    ik: {
                      up: 2,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  controlGroups: [
    { key: 'bothArms', cname: '双臂', bones: ['shoulderLeft', 'shoulderRight'] },
    { key: 'bothHands', cname: '双手', bones: ['elbowLeft', 'elbowRight'] },
    { key: 'bothLegs', cname: '双腿', bones: ['hipLeft', 'hipRight'] },
    { key: 'bothFeet', cname: '双脚', bones: ['kneeLeft', 'kneeRight'] },
  ],
  balance: {
    torsoBone: 'neck',
    strength: 1.35,
    maxOffset: 0.32,
    immediate: true,
    momentArmWeight: 2.8,
    supportResponse: 8,
  },
  render: {
    endCaps: {
      enabled: true,
      byKey: {
        head: {
          radius: 0.18,
          rotation: [0, HEAD_EYES_YAW, 0],
          createMaterial: createHeadMaterial,
        },
      },
    },
  },
}

export const PLAYER_MODEL_RIG = createRigDefinition(PLAYER_DEFINITION)
export const PLAYER_ACTION_BONE_OPTIONS = PLAYER_MODEL_RIG.actionBoneOptions
export const PLAYER_ACTION_IK_CHAIN_OPTIONS = Object.values(PLAYER_MODEL_RIG.ikChainsByKey)
  .map((chain) => ({
    value: chain.key,
    label: chain.cname,
  }))
export const PLAYER_ACTION_IK_DEFAULT_TARGETS = Object.fromEntries(
  Object.values(PLAYER_MODEL_RIG.ikChainsByKey).map((chain) => {
    const joints = createRigJointPositions(PLAYER_MODEL_RIG)
    const end = joints[chain.end]

    return [
      chain.key,
      {
        x: end.x,
        y: end.y,
        z: end.z,
      },
    ]
  }),
)

const PLAYER_WALK_ACTION_ID = 'player-preset-walk'
const PLAYER_WALK_STRIDE = 0.24
const PLAYER_WALK_LIFT = 0.13
const PLAYER_WALK_DURATION = 1.1

const lerpValue = (from, to, amount) => from + (to - from) * amount

const createWalkFootPosition = ({ base, progress, footStart, footMid, footEnd }) => {
  if (progress < footStart) return { x: base.x, y: base.y, z: base.z }

  if (progress < footMid) {
    const amount = (progress - footStart) / (footMid - footStart)

    return {
      x: base.x,
      y: lerpValue(base.y, base.y + PLAYER_WALK_LIFT, amount),
      z: lerpValue(base.z, base.z - PLAYER_WALK_STRIDE * 0.5, amount),
    }
  }

  if (progress < footEnd) {
    const amount = (progress - footMid) / (footEnd - footMid)

    return {
      x: base.x,
      y: lerpValue(base.y + PLAYER_WALK_LIFT, base.y, amount),
      z: lerpValue(base.z - PLAYER_WALK_STRIDE * 0.5, base.z - PLAYER_WALK_STRIDE, amount),
    }
  }

  return {
    x: base.x,
    y: base.y,
    z: base.z - PLAYER_WALK_STRIDE,
  }
}

export const createPlayerWalkIkAction = (elapsed) => {
  const leftBase = PLAYER_ACTION_IK_DEFAULT_TARGETS.footLeft
  const rightBase = PLAYER_ACTION_IK_DEFAULT_TARGETS.footRight
  const progress = Math.min(Math.max(elapsed / PLAYER_WALK_DURATION, 0), 1)

  return {
    id: PLAYER_WALK_ACTION_ID,
    label: '走路',
    type: 'ik',
    controls: [],
    ikTargets: [
      {
        chain: 'footLeft',
        position: createWalkFootPosition({
          base: leftBase,
          progress,
          footStart: 0,
          footMid: 0.25,
          footEnd: 0.5,
        }),
      },
      {
        chain: 'footRight',
        position: createWalkFootPosition({
          base: rightBase,
          progress,
          footStart: 0.5,
          footMid: 0.75,
          footEnd: 1,
        }),
      },
    ],
  }
}

export const createPlayerJointPositions = () => createRigJointPositions(PLAYER_MODEL_RIG)

export const createPlayer = ({
  name = 'player',
  position = [10.7, STICK_FIGURE_HEIGHT / 2, -4],
} = {}) => {
  const joints = createPlayerJointPositions()
  const { figure } = createRigFigure({
    name,
    position,
    joints,
    rig: PLAYER_MODEL_RIG,
    actions: true,
  })

  return figure
}
