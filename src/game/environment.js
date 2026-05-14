import {
  AmbientLight,
  Color,
  DirectionalLight,
  ExtrudeGeometry,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from 'three'
import {
  GROUND_REPOSITION_STEP,
  GROUND_SIZE,
  WORLD_COLORS,
  WORLD_TUNING,
} from '../config.js'
import { createGroundTexture } from './createGroundTexture.js'
import { readMapData } from './mapData.js'
import { createPlayer, STICK_FIGURE_HEIGHT } from './createPlayer.js'
import { createPolaris, createStarField } from './createStarField.js'

const PLAYER_SPAWN = [0, STICK_FIGURE_HEIGHT / 2, -4]

const normalizeDirection = (from, to) => {
  const x = to[0] - from[0]
  const z = to[1] - from[1]
  const length = Math.hypot(x, z) || 1

  return { x: x / length, z: z / length }
}

const createNormal = (direction) => ({
  x: -direction.z,
  z: direction.x,
})

const createWallShapePoints = (path, width) => {
  const halfWidth = width / 2
  const left = []
  const right = []

  path.forEach(([x, z], index) => {
    const previous = path[index - 1]
    const next = path[index + 1]
    const previousDirection = previous ? normalizeDirection(previous, [x, z]) : null
    const nextDirection = next ? normalizeDirection([x, z], next) : null
    const normal = !previousDirection || !nextDirection
      ? createNormal(nextDirection ?? previousDirection)
      : (() => {
        const tangent = {
          x: previousDirection.x + nextDirection.x,
          z: previousDirection.z + nextDirection.z,
        }
        const tangentLength = Math.hypot(tangent.x, tangent.z)
        if (tangentLength < 0.0001) return createNormal(nextDirection)

        const miter = createNormal({
          x: tangent.x / tangentLength,
          z: tangent.z / tangentLength,
        })
        const nextNormal = createNormal(nextDirection)
        const scale = halfWidth / Math.max(0.2, Math.abs(miter.x * nextNormal.x + miter.z * nextNormal.z))

        return {
          x: miter.x * scale / halfWidth,
          z: miter.z * scale / halfWidth,
        }
      })()

    left.push([x + normal.x * halfWidth, z + normal.z * halfWidth])
    right.unshift([x - normal.x * halfWidth, z - normal.z * halfWidth])
  })

  return [...left, ...right]
}

const createExtrudedWall = ({ points, height, position, material }) => {
  const shape = new Shape()
  shape.moveTo(points[0][0], -points[0][1])
  points.slice(1).forEach(([x, z]) => {
    shape.lineTo(x, -z)
  })
  shape.lineTo(points[0][0], -points[0][1])

  const wall = new Mesh(
    new ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    }),
    material,
  )
  wall.rotation.x = -Math.PI / 2
  wall.position.set(...position)
  wall.castShadow = true
  wall.receiveShadow = true

  return wall
}

const createMapWalls = (mapData) => {
  const materials = []
  const walls = mapData.walls.map((wallData) => {
    const material = new MeshStandardMaterial({
      color: wallData.color,
      roughness: 0.9,
      metalness: 0,
    })
    materials.push(material)

    // 地图只维护中心线路径，墙体轮廓由宽度生成，避免模型和碰撞体分开定义。
    return createExtrudedWall({
      points: createWallShapePoints(wallData.path, wallData.width),
      height: wallData.height,
      position: wallData.position,
      material,
    })
  })

  return {
    walls,
    colliders: walls,
    dispose: () => {
      walls.forEach((wall) => wall.geometry.dispose())
      materials.forEach((material) => material.dispose())
    },
  }
}

export const createEnvironment = (scene, mapData = readMapData()) => {
  scene.background = new Color(WORLD_COLORS.sky)
  scene.fog = new FogExp2(WORLD_COLORS.fog, WORLD_TUNING.fogDensity)

  const ambientLight = new AmbientLight(
    WORLD_COLORS.ambientLight,
    WORLD_TUNING.ambientLightIntensity,
  )
  scene.add(ambientLight)

  const moonLight = new DirectionalLight(
    WORLD_COLORS.moonLight,
    WORLD_TUNING.moonLightIntensity,
  )
  moonLight.position.set(6, 10, 4)
  moonLight.castShadow = true
  moonLight.shadow.mapSize.set(1024, 1024)
  moonLight.shadow.camera.near = 1
  moonLight.shadow.camera.far = 40
  moonLight.shadow.camera.left = -14
  moonLight.shadow.camera.right = 14
  moonLight.shadow.camera.top = 14
  moonLight.shadow.camera.bottom = -14
  scene.add(moonLight)

  const starField = createStarField()
  const polaris = createPolaris()
  const player = createPlayer({
    name: 'player',
    position: PLAYER_SPAWN,
  })
  const mapWalls = createMapWalls(mapData)

  const playerState = {
    userActionId: null,
  }
  scene.add(starField, polaris, player, ...mapWalls.walls)

  const groundTexture = createGroundTexture()
  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshStandardMaterial({
      color: new Color(WORLD_COLORS.ground),
      map: groundTexture,
      roughness: 0.96,
      metalness: 0,
    }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  let lastGroundCellX = Number.NaN
  let lastGroundCellZ = Number.NaN
  let polarisTwinkleTime = 0

  const update = (delta) => {
    polarisTwinkleTime += delta * WORLD_TUNING.polarisTwinkleSpeed
    const twinkle = (Math.sin(polarisTwinkleTime) + 1) / 2
    polaris.material.opacity = (
      WORLD_TUNING.polarisMinOpacity
      + twinkle * (WORLD_TUNING.polarisMaxOpacity - WORLD_TUNING.polarisMinOpacity)
    )
    player.userData.update(delta)
  }

  const updateGroundPosition = (cameraPosition) => {
    const nextCellX = Math.round(cameraPosition.x / GROUND_REPOSITION_STEP)
    const nextCellZ = Math.round(cameraPosition.z / GROUND_REPOSITION_STEP)

    if (nextCellX === lastGroundCellX && nextCellZ === lastGroundCellZ) return

    lastGroundCellX = nextCellX
    lastGroundCellZ = nextCellZ
    ground.position.x = nextCellX * GROUND_REPOSITION_STEP
    ground.position.z = nextCellZ * GROUND_REPOSITION_STEP
  }

  const setPlayerControlPointsVisible = (visible) => {
    player.userData.setControlPointsVisible(visible)
  }

  const playPlayerUserAction = (action, options) => {
    playerState.userActionId = action.id
    player.userData.playUserAction(action, options)
  }

  const previewPlayerUserAction = (action) => {
    player.userData.previewUserAction(action)
  }

  const cancelPlayerUserAction = () => {
    playerState.userActionId = null
    player.userData.cancelUserAction()
  }

  const dispose = () => {
    scene.remove(
      ambientLight,
      moonLight,
      starField,
      polaris,
      player,
      ...mapWalls.walls,
      ground,
    )
    starField.geometry.dispose()
    starField.userData.spriteTexture?.dispose()
    starField.material.dispose()
    polaris.geometry.dispose()
    polaris.userData.spriteTexture?.dispose()
    polaris.material.dispose()
    player.traverse((child) => {
      if (child.isMesh) child.geometry.dispose()
    })
    player.userData.material.dispose()
    player.userData.dispose?.()
    mapWalls.dispose()
    ground.geometry.dispose()
    ground.material.dispose()
    groundTexture.dispose()
  }

  return {
    player,
    playerState,
    playerSpawn: PLAYER_SPAWN,
    wallColliders: mapWalls.colliders,
    mapWallTargets: mapWalls.walls,
    mapHitTargets: [ground, ...mapWalls.walls],
    setPlayerControlPointsVisible,
    playPlayerUserAction,
    previewPlayerUserAction,
    cancelPlayerUserAction,
    update,
    updateGroundPosition,
    dispose,
  }
}
