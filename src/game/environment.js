import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three'
import {
  GROUND_REPOSITION_STEP,
  GROUND_SIZE,
  WORLD_COLORS,
  WORLD_TUNING,
} from '../config.js'
import { createGroundTexture } from './createGroundTexture.js'
import { createPlayer } from './createPlayer.js'
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
  const ikTargetGeometry = new SphereGeometry(0.032, 16, 12)
  const ikTargetMaterial = new MeshBasicMaterial({
    color: '#ff2d2d',
    depthTest: false,
  })
  const ikTargetLineMaterial = new LineBasicMaterial({
    color: '#ff2d2d',
    depthTest: false,
    transparent: true,
    opacity: 0.65,
  })
  const ikTargetLineGroundDepth = 0.8
  const ikTargetMarkers = []
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

  const movePlayer = (offset) => {
    player.position.x += offset.x
    player.position.z += offset.z
  }

  const syncPlayerIkTargetMarkers = (action) => {
    const targets = action?.type === 'ik' && Array.isArray(action.ikTargets)
      ? action.ikTargets
      : []

    while (ikTargetMarkers.length < targets.length) {
      const marker = new Mesh(ikTargetGeometry, ikTargetMaterial)
      const line = new Line(new BufferGeometry(), ikTargetLineMaterial)

      marker.renderOrder = 100
      marker.userData.isIkTargetMarker = true
      line.renderOrder = 99
      line.userData.isIkTargetMarker = true
      marker.userData.groundLine = line
      ikTargetMarkers.push(marker)
      player.add(line)
      player.add(marker)
    }

    ikTargetMarkers.forEach((marker, index) => {
      const line = marker.userData.groundLine
      const target = targets[index]
      const position = target?.position
      const visible = (
        Number.isFinite(position?.x)
        && Number.isFinite(position?.y)
        && Number.isFinite(position?.z)
      )

      marker.visible = visible
      line.visible = visible
      if (visible) {
        marker.position.set(position.x, position.y, position.z)
        // 调试目标点的垂线固定在玩家局部地面上，便于从任意视角判断水平落点。
        line.geometry.setFromPoints([
          marker.position.clone().setY(-ikTargetLineGroundDepth),
          marker.position.clone(),
        ])
      }
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
      if (child.userData.isIkTargetMarker) return
      if (child.isMesh) child.geometry.dispose()
    })
    player.userData.material.dispose()
    player.userData.dispose?.()
    ikTargetGeometry.dispose()
    ikTargetMaterial.dispose()
    ikTargetLineMaterial.dispose()
    ikTargetMarkers.forEach((marker) => {
      marker.userData.groundLine?.geometry.dispose()
    })
    ground.geometry.dispose()
    ground.material.dispose()
    groundTexture.dispose()
  }

  return {
    playerState,
    setPlayerControlPointsVisible,
    movePlayer,
    playPlayerUserAction,
    previewPlayerUserAction,
    cancelPlayerUserAction,
    clearPlayerIkTargetMarkers: () => syncPlayerIkTargetMarkers(null),
    update,
    updateGroundPosition,
    dispose,
  }
}
