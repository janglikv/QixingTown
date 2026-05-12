import {
  CanvasTexture,
  MeshStandardMaterial,
} from 'three'
import {
  createRigDefinition,
  createRigFigure,
  createRigJointPositions,
} from '../lib/rigkit/index.js'
import { CAMERA_HEIGHT } from '../config.js'

/**
 * 角色比例配置
 * 方便调整手长、腿长、身高等
 */
export const PLAYER_PROPORTIONS = {
  // 躯干与头部
  hipWidth: 0.1,         // 胯宽（单侧）
  spineLength: 0.52,     // 脊柱/脖子长度
  headLength: 0.38,      // 头部骨骼长度
  headRadius: 0.18,      // 头部渲染半径
  shoulderWidth: 0.14,   // 肩宽（单侧）

  // 腿部
  upperLegLength: 0.35,  // 大腿长度
  lowerLegLength: 0.52,  // 小腿长度

  // 手臂
  upperArmLength: 0.35,  // 大臂长度
  lowerArmLength: 0.32,  // 小臂长度
}

/**
 * 计算角色的总高度
 */
export const STICK_FIGURE_HEIGHT = (
  PLAYER_PROPORTIONS.spineLength +
  PLAYER_PROPORTIONS.headLength +
  PLAYER_PROPORTIONS.headRadius +
  (PLAYER_PROPORTIONS.upperLegLength + PLAYER_PROPORTIONS.lowerLegLength)
)

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
        length: PLAYER_PROPORTIONS.hipWidth,
        direction: [-1, 0, 0],
        children: {
          kneeLeft: {
            key: 'kneeLeft',
            cname: '左腿',
            length: PLAYER_PROPORTIONS.upperLegLength,
            direction: [-0.08, -0.34, 0],
            children: {
              footLeft: {
                key: 'footLeft',
                cname: '左脚',
                length: PLAYER_PROPORTIONS.lowerLegLength,
                direction: [-0.04, -0.62, 0],
              },
            },
          },
        },
      },
      hipRight: {
        key: 'hipRight',
        cname: '右胯',
        length: PLAYER_PROPORTIONS.hipWidth,
        direction: [1, 0, 0],
        children: {
          kneeRight: {
            key: 'kneeRight',
            cname: '右腿',
            length: PLAYER_PROPORTIONS.upperLegLength,
            direction: [0.08, -0.34, 0],
            children: {
              footRight: {
                key: 'footRight',
                cname: '右脚',
                length: PLAYER_PROPORTIONS.lowerLegLength,
                direction: [0.04, -0.62, 0],
              },
            },
          },
        },
      },
      neck: {
        key: 'neck',
        cname: '脖子',
        length: PLAYER_PROPORTIONS.spineLength,
        direction: [0, 1, 0],
        children: {
          head: {
            key: 'head',
            cname: '头部',
            length: PLAYER_PROPORTIONS.headLength,
            direction: [0, 1, 0],
          },
          shoulderLeft: {
            key: 'shoulderLeft',
            cname: '左肩',
            length: PLAYER_PROPORTIONS.shoulderWidth,
            direction: [-1, 0, 0],
            children: {
              elbowLeft: {
                key: 'elbowLeft',
                cname: '左臂',
                length: PLAYER_PROPORTIONS.upperArmLength,
                direction: [-0.1, -0.34, 0],
                children: {
                  handLeft: {
                    key: 'handLeft',
                    cname: '左手',
                    length: PLAYER_PROPORTIONS.lowerArmLength,
                    direction: [-0.04, -0.32, 0],
                  },
                },
              },
            },
          },
          shoulderRight: {
            key: 'shoulderRight',
            cname: '右肩',
            length: PLAYER_PROPORTIONS.shoulderWidth,
            direction: [1, 0, 0],
            children: {
              elbowRight: {
                key: 'elbowRight',
                cname: '右臂',
                length: PLAYER_PROPORTIONS.upperArmLength,
                direction: [0.1, -0.34, 0],
                children: {
                  handRight: {
                    key: 'handRight',
                    cname: '右手',
                    length: PLAYER_PROPORTIONS.lowerArmLength,
                    direction: [0.04, -0.32, 0],
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
          radius: PLAYER_PROPORTIONS.headRadius,
          rotation: [0, HEAD_EYES_YAW, 0],
          createMaterial: createHeadMaterial,
        },
      },
    },
  },
}

export const PLAYER_MODEL_RIG = createRigDefinition(PLAYER_DEFINITION)
export const PLAYER_ACTION_BONE_OPTIONS = PLAYER_MODEL_RIG.actionBoneOptions

export const createPlayerJointPositions = () => createRigJointPositions(PLAYER_MODEL_RIG)

export const createPlayer = ({
  name = 'player',
  position = [0, STICK_FIGURE_HEIGHT / 2, -4],
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
