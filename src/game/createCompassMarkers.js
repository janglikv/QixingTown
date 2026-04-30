import { MeshStandardMaterial } from 'three'
import {
  createRigDefinition,
  createRigFigure,
  createRigJointPositions,
} from '../lib/rigkit/index.js'

const COMPASS_RADIUS = 0.035
const COMPASS_Y = 0.06
const AXIS_LENGTH = 3.3
const ARROW_HEAD_LENGTH = 0.52
const ARROW_HEAD_SPREAD = 0.34

const compassMaterial = new MeshStandardMaterial({
  color: '#000000',
  emissive: '#000000',
  emissiveIntensity: 0,
  metalness: 0.2,
  roughness: 0.35,
})

const createCompassRig = () => createRigDefinition({
  root: {
    key: 'center',
    cname: '中心',
    children: {
      east: {
        key: 'east',
        cname: '东',
        length: AXIS_LENGTH,
        direction: [1, 0, 0],
        children: {
          eastHeadNorth: {
            key: 'eastHeadNorth',
            cname: '东箭头北翼',
            length: ARROW_HEAD_LENGTH,
            direction: [-1, 0, -ARROW_HEAD_SPREAD],
          },
          eastHeadSouth: {
            key: 'eastHeadSouth',
            cname: '东箭头南翼',
            length: ARROW_HEAD_LENGTH,
            direction: [-1, 0, ARROW_HEAD_SPREAD],
          },
        },
      },
      west: {
        key: 'west',
        cname: '西',
        length: AXIS_LENGTH,
        direction: [-1, 0, 0],
      },
      north: {
        key: 'north',
        cname: '北',
        length: AXIS_LENGTH,
        direction: [0, 0, -1],
        children: {
          northHeadEast: {
            key: 'northHeadEast',
            cname: '北箭头东翼',
            length: ARROW_HEAD_LENGTH,
            direction: [ARROW_HEAD_SPREAD, 0, 1],
          },
          northHeadWest: {
            key: 'northHeadWest',
            cname: '北箭头西翼',
            length: ARROW_HEAD_LENGTH,
            direction: [-ARROW_HEAD_SPREAD, 0, 1],
          },
        },
      },
      south: {
        key: 'south',
        cname: '南',
        length: AXIS_LENGTH,
        direction: [0, 0, 1],
      },
    },
  },
  render: {
    createMaterial: () => compassMaterial,
    tube: {
      radius: COMPASS_RADIUS,
      radialSegments: 8,
    },
    jointCaps: {
      radius: COMPASS_RADIUS * 1.7,
    },
    endCaps: {
      enabled: true,
      radius: COMPASS_RADIUS * 1.8,
    },
  },
})

export const createCompassMarkers = () => {
  const rig = createCompassRig()
  const joints = createRigJointPositions(rig)
  const { figure } = createRigFigure({
    name: 'compass-markers',
    position: [0, COMPASS_Y, 0],
    joints,
    rig,
  })

  figure.userData.setControlPointsVisible(false)

  return figure
}
