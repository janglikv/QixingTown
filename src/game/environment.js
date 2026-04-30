import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three'
import {
  GROUND_REPOSITION_STEP,
  GROUND_SIZE,
  WORLD_COLORS,
  WORLD_TUNING,
} from '../config.js'
import { createGroundTexture } from './createGroundTexture.js'
import { createCompassMarkers } from './createCompassMarkers.js'
import { createPlayer, PLAYER_MODEL_RIG } from './createPlayer.js'
import { createHelperMarkerSystem } from './helperMarkers.js'
import { createPolaris, createStarField } from './createStarField.js'
import { createTree } from './createTree.js'

const PLAYER_FORWARD_LEAN_ACTION = {
  id: 'player-forward-lean',
  label: '前倾',
  type: 'fk',
  controls: [
    {
      bone: 'hip',
      direction: 'backward',
      angle: 16,
    },
  ],
}

export const createEnvironment = (scene) => {
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
  const compassMarkers = createCompassMarkers()
  const player = createPlayer({
    name: 'player',
    position: [10.7, 2.15 / 2, -4],
  })
  const trees = []
  const treeRowCount = 5
  const treeSpacingZ = 12
  const treeRowX = 6
  for (let i = 0; i < treeRowCount; i++) {
    const z = (i - (treeRowCount - 1) / 2) * treeSpacingZ
    const leftTree = createTree()
    leftTree.position.set(-treeRowX, 0, z)
    trees.push(leftTree)
    const rightTree = createTree()
    rightTree.position.set(treeRowX, 0, z)
    trees.push(rightTree)
  }

  const playerState = {
    userActionId: null,
  }
  let playerForwardLeanActive = false
  const ikTargetGroundCrossSize = 0.32
  const centerOfMassGroundCrossSize = 2
  const helperLineWidth = 0.004
  const centerOfMassPolygonLineWidth = 0.002
  const helperMarkers = createHelperMarkerSystem({ root: scene })
  scene.add(starField, polaris, compassMarkers, ...trees, player)

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
  const centerOfMass = new Vector3()
  let playerCenterOfMassVisible = false

  const getConvexHull = (points) => {
    const sorted = [...points]
      .sort((a, b) => (a.x === b.x ? a.z - b.z : a.x - b.x))
      .filter((point, index, list) => (
        index === 0
        || point.x !== list[index - 1].x
        || point.z !== list[index - 1].z
      ))

    if (sorted.length <= 2) return sorted

    const cross = (origin, a, b) => (
      (a.x - origin.x) * (b.z - origin.z)
      - (a.z - origin.z) * (b.x - origin.x)
    )
    const lower = []
    const upper = []

    sorted.forEach((point) => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
        lower.pop()
      }
      lower.push(point)
    })
    sorted.slice().reverse().forEach((point) => {
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
        upper.pop()
      }
      upper.push(point)
    })

    return lower.slice(0, -1).concat(upper.slice(0, -1))
  }

  const update = (delta) => {
    polarisTwinkleTime += delta * WORLD_TUNING.polarisTwinkleSpeed
    const twinkle = (Math.sin(polarisTwinkleTime) + 1) / 2
    polaris.material.opacity = (
      WORLD_TUNING.polarisMinOpacity
      + twinkle * (WORLD_TUNING.polarisMaxOpacity - WORLD_TUNING.polarisMinOpacity)
    )
    player.userData.update(delta)
    syncPlayerCenterOfMassMarker()
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

  const setPlayerCenterOfMassVisible = (visible) => {
    playerCenterOfMassVisible = visible
    syncPlayerCenterOfMassMarker()
  }

  const getPlayerCenterOfMassSnapshot = () => {
    let totalMass = 0
    const groundPoints = []

    centerOfMass.set(0, 0, 0)
    player.updateMatrixWorld(true)
    PLAYER_MODEL_RIG.endBoneKeys.forEach((key) => {
      const child = player.userData.bones[key]
      if (!child) return

      const mass = PLAYER_MODEL_RIG.boneDefinitions[key].massScale ?? 1
      if (mass <= 0) return

      const nodePosition = child.getWorldPosition(new Vector3())
      const groundPoint = new Vector3(nodePosition.x, 0, nodePosition.z)

      groundPoints.push(groundPoint)
      centerOfMass.add(groundPoint.multiplyScalar(mass))
      totalMass += mass
    })

    if (totalMass <= 0) return null

    // 当前只关心最终骨骼末端在水平面上的加权平均点。
    centerOfMass.multiplyScalar(1 / totalMass)

    return {
      position: centerOfMass.clone(),
      polygon: getConvexHull(groundPoints),
    }
  }

  const syncPlayerCenterOfMassMarker = () => {
    if (!playerCenterOfMassVisible) {
      helperMarkers.hide('player-center-of-mass')
      helperMarkers.hide('player-center-of-mass-polygon')
      return
    }

    const snapshot = getPlayerCenterOfMassSnapshot()
    if (!snapshot) {
      helperMarkers.hide('player-center-of-mass')
      helperMarkers.hide('player-center-of-mass-polygon')
      return
    }

    const { position, polygon } = snapshot

    // 质心和地面投影都使用世界坐标，避免和 player 局部坐标混淆。
    helperMarkers.markPoint({
      id: 'player-center-of-mass',
      position,
      color: '#2f7dff',
      opacity: 0.9,
      visible: true,
      verticalLine: {
        fromY: 0,
        toY: 2,
        width: helperLineWidth,
        opacity: 0.9,
      },
      groundCross: {
        halfSize: centerOfMassGroundCrossSize,
        y: 0.01,
        width: helperLineWidth,
        opacity: 0.9,
      },
    })
    helperMarkers.markGroundPolygon({
      id: 'player-center-of-mass-polygon',
      points: polygon,
      color: '#5aa7ff',
      opacity: 0.28,
      y: 0.014,
      width: centerOfMassPolygonLineWidth,
    })
  }

  const getPlayerIkTargetPosition = (chainKey) => {
    const chain = PLAYER_MODEL_RIG.ikChainsByKey[chainKey]
    const bone = chain ? player.userData.bones[chain.end] : null

    if (!bone) return null

    player.updateMatrixWorld(true)

    const position = player.worldToLocal(bone.getWorldPosition(new Vector3()))

    return {
      x: position.x,
      y: position.y,
      z: position.z,
    }
  }

  const syncPlayerIkTargetMarkers = (action) => {
    const targets = action?.type === 'ik' && Array.isArray(action.ikTargets)
      ? action.ikTargets
      : []
    const activeIkTargetId = typeof action?.activeIkTargetId === 'string'
      ? action.activeIkTargetId
      : null
    helperMarkers.hidePrefix('ik-target-')
    targets.forEach((target) => {
      const position = target?.position
      const visible = (
        Number.isFinite(position?.x)
        && Number.isFinite(position?.y)
        && Number.isFinite(position?.z)
      )

      if (!visible) return

      const selected = target.id === activeIkTargetId

      const targetPosition = new Vector3(position.x, position.y, position.z)
      const targetWorldPosition = player.localToWorld(targetPosition.clone())
      const groundLocalPosition = player.worldToLocal(new Vector3(
        targetWorldPosition.x,
        0,
        targetWorldPosition.z,
      ))

      helperMarkers.markPoint({
        id: `ik-target-${target.id}`,
        parent: player,
        position: targetPosition,
        color: '#ff2d2d',
        opacity: selected ? 1 : 0.38,
        visible: true,
        sphere: {
          radius: 0.032,
          depthTest: false,
        },
        verticalLine: {
          fromY: groundLocalPosition.y,
          width: helperLineWidth,
          opacity: selected ? 0.85 : 0.35,
          depthTest: false,
        },
        groundCross: {
          halfSize: ikTargetGroundCrossSize,
          y: groundLocalPosition.y + 0.01,
          width: helperLineWidth,
          opacity: selected ? 0.9 : 0.35,
          depthTest: true,
        },
        heightDisc: {
          radius: 0.72,
          opacity: selected ? 0.16 : 0.06,
          depthTest: true,
          depthWrite: false,
        },
      })
    })
  }

  const playPlayerUserAction = (action) => {
    playerState.userActionId = action.id
    syncPlayerIkTargetMarkers(null)
    player.userData.playUserAction(action)
  }

  const previewPlayerUserAction = (action) => {
    syncPlayerIkTargetMarkers(action)
    player.userData.previewUserAction(action)
  }

  const cancelPlayerUserAction = () => {
    playerState.userActionId = null
    syncPlayerIkTargetMarkers(null)
    player.userData.cancelUserAction()
  }

  const setPlayerForwardLeanActive = (active) => {
    if (playerForwardLeanActive === active) return

    playerForwardLeanActive = active
    if (active) {
      playerState.userActionId = null
      syncPlayerIkTargetMarkers(null)
      player.userData.playUserAction(PLAYER_FORWARD_LEAN_ACTION)
      return
    }

    player.userData.cancelUserAction()
  }

  const dispose = () => {
    scene.remove(
      ambientLight,
      moonLight,
      starField,
      polaris,
      compassMarkers,
      ...trees,
      player,
      ground,
    )
    starField.geometry.dispose()
    starField.userData.spriteTexture?.dispose()
    starField.material.dispose()
    polaris.geometry.dispose()
    polaris.userData.spriteTexture?.dispose()
    polaris.material.dispose()
    compassMarkers.userData.dispose?.()
    trees.forEach((tree) => {
      tree.traverse((child) => {
        if (child.isMesh) child.geometry.dispose()
      })
      tree.userData.dispose?.()
    })
    player.traverse((child) => {
      if (child.userData.isHelperMarker) return
      if (child.isMesh) child.geometry.dispose()
    })
    player.userData.material.dispose()
    player.userData.dispose?.()
    helperMarkers.dispose()
    ground.geometry.dispose()
    ground.material.dispose()
    groundTexture.dispose()
  }

  return {
    playerState,
    setPlayerControlPointsVisible,
    setPlayerCenterOfMassVisible,
    setPlayerForwardLeanActive,
    playPlayerUserAction,
    previewPlayerUserAction,
    cancelPlayerUserAction,
    getPlayerIkTargetPosition,
    clearPlayerIkTargetMarkers: () => syncPlayerIkTargetMarkers(null),
    update,
    updateGroundPosition,
    dispose,
  }
}
