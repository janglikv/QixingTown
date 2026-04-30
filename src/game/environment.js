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
import { createPlayer, createPlayerWalkIkAction, PLAYER_MODEL_RIG } from './createPlayer.js'
import { createHelperMarkerSystem } from './helperMarkers.js'
import { createPolaris, createStarField } from './createStarField.js'
import { createTree } from './createTree.js'

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
  const playerWalkState = {
    active: false,
    elapsed: 0,
  }
  const ikTargetLineGroundDepth = 0.8
  const ikTargetGroundCrossSize = 0.32
  const centerOfMassGroundCrossSize = 2
  const helperLineWidth = 0.004
  const helperMarkers = createHelperMarkerSystem({ root: scene })
  scene.add(starField, polaris, ...trees, player)

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

  const update = (delta) => {
    polarisTwinkleTime += delta * WORLD_TUNING.polarisTwinkleSpeed
    const twinkle = (Math.sin(polarisTwinkleTime) + 1) / 2
    polaris.material.opacity = (
      WORLD_TUNING.polarisMinOpacity
      + twinkle * (WORLD_TUNING.polarisMaxOpacity - WORLD_TUNING.polarisMinOpacity)
    )
    if (playerWalkState.active) {
      playerWalkState.elapsed += delta
      // 走路预置是逐帧 IK 目标，不写入用户动作列表。
      player.userData.previewUserAction(createPlayerWalkIkAction(playerWalkState.elapsed))
    }
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

  const getPlayerCenterOfMass = () => {
    let totalMass = 0

    centerOfMass.set(0, 0, 0)
    player.updateMatrixWorld(true)
    PLAYER_MODEL_RIG.boneNodes.forEach((bone) => {
      if (typeof bone.parentKey !== 'string') return

      const parent = player.userData.bones[bone.parentKey]
      const child = player.userData.bones[bone.key]
      if (!parent || !child) return

      const mass = bone.length * (bone.massScale ?? 1)
      const segmentCenter = parent
        .getWorldPosition(new Vector3())
        .add(child.getWorldPosition(new Vector3()))
        .multiplyScalar(0.5)

      centerOfMass.add(segmentCenter.multiplyScalar(mass))
      totalMass += mass
    })

    if (totalMass <= 0) return null

    // 当前只关心水平面上的质心投影，y 固定到地面，避免垂直抬高手脚影响显示判断。
    centerOfMass.multiplyScalar(1 / totalMass)
    centerOfMass.y = 0

    return centerOfMass.clone()
  }

  const syncPlayerCenterOfMassMarker = () => {
    if (!playerCenterOfMassVisible) {
      helperMarkers.hide('player-center-of-mass')
      return
    }

    const position = getPlayerCenterOfMass()
    if (!position) return

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

      helperMarkers.markPoint({
        id: `ik-target-${target.id}`,
        parent: player,
        position: new Vector3(position.x, position.y, position.z),
        color: '#ff2d2d',
        opacity: selected ? 1 : 0.38,
        visible: true,
        sphere: {
          radius: 0.032,
          depthTest: false,
        },
        verticalLine: {
          fromY: -ikTargetLineGroundDepth,
          width: helperLineWidth,
          opacity: selected ? 0.85 : 0.35,
          depthTest: false,
        },
        groundCross: {
          halfSize: ikTargetGroundCrossSize,
          y: -ikTargetLineGroundDepth + 0.01,
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
    setPlayerWalkIkActive(false)
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

  const setPlayerWalkIkActive = (active) => {
    if (playerWalkState.active === active) return

    playerWalkState.active = active
    playerWalkState.elapsed = 0
    if (active) {
      playerState.userActionId = null
      syncPlayerIkTargetMarkers(null)
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
    setPlayerWalkIkActive,
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
