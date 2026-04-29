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
const HEAD_EYES_YAW = -Math.PI / 2

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
      hipLeft: {
        key: 'hipLeft',
        cname: '右胯',
        length: 0.1,
        direction: [-1, 0, 0],
        children: {
          kneeLeft: {
            key: 'kneeLeft',
            cname: '右腿',
            length: 0.35,
            direction: [-0.08, -0.34, 0],
            jointLimit: {
              x: [-80, 80],
              y: [-35, 55],
              z: [-35, 35],
            },
            children: {
              footLeft: {
                key: 'footLeft',
                cname: '右脚',
                length: 0.62,
                direction: [-0.04, -0.62, 0],
                supportContact: true,
                jointLimit: {
                  minAngle: 25,
                  maxAngle: 172,
                },
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
        cname: '左胯',
        length: 0.1,
        direction: [1, 0, 0],
        children: {
          kneeRight: {
            key: 'kneeRight',
            cname: '左腿',
            length: 0.35,
            direction: [0.08, -0.34, 0],
            jointLimit: {
              x: [-80, 80],
              y: [-55, 35],
              z: [-35, 35],
            },
            children: {
              footRight: {
                key: 'footRight',
                cname: '左脚',
                length: 0.62,
                direction: [0.04, -0.62, 0],
                supportContact: true,
                jointLimit: {
                  minAngle: 25,
                  maxAngle: 172,
                },
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
            cname: '右肩',
            length: 0.14,
            direction: [-1, 0, 0],
            children: {
              elbowLeft: {
                key: 'elbowLeft',
                cname: '右臂',
                length: 0.35,
                direction: [-0.1, -0.34, 0],
                jointLimit: {
                  x: [-70, 120],
                  y: [-35, 95],
                  z: [-55, 55],
                },
                children: {
                  handLeft: {
                    key: 'handLeft',
                    cname: '右手',
                    length: 0.32,
                    direction: [-0.04, -0.32, 0],
                    jointLimit: {
                      minAngle: 35,
                      maxAngle: 172,
                    },
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
            cname: '左肩',
            length: 0.14,
            direction: [1, 0, 0],
            children: {
              elbowRight: {
                key: 'elbowRight',
                cname: '左臂',
                length: 0.35,
                direction: [0.1, -0.34, 0],
                jointLimit: {
                  x: [-70, 120],
                  y: [-95, 35],
                  z: [-55, 55],
                },
                children: {
                  handRight: {
                    key: 'handRight',
                    cname: '左手',
                    length: 0.32,
                    direction: [0.04, -0.32, 0],
                    jointLimit: {
                      minAngle: 35,
                      maxAngle: 172,
                    },
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
