import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three'
import {
  GROUND_REPOSITION_STEP,
  GROUND_SIZE,
  WORLD_COLORS,
  WORLD_TUNING,
} from '../config.js'
import { createGroundTexture } from './createGroundTexture.js'
import { createNpc6 } from './createNpc6.js'
import { createPolaris, createStarField } from './createStarField.js'

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
  const npc6 = createNpc6({
    name: 'npc6',
    position: [10.7, 2.15 / 2, -4],
  })
  const npc6State = {
    userActionId: null,
  }
  scene.add(starField, polaris, npc6)

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
    npc6.userData.update(delta)
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

  const setNpc6ControlPointsVisible = (visible) => {
    npc6.userData.setControlPointsVisible(visible)
  }

  const playNpc6UserAction = (action) => {
    npc6State.userActionId = action.id
    npc6.userData.playUserAction(action)
  }

  const previewNpc6UserAction = (action) => {
    npc6.userData.previewUserAction(action)
  }

  const cancelNpc6UserAction = () => {
    npc6State.userActionId = null
    npc6.userData.cancelUserAction()
  }

  const dispose = () => {
    scene.remove(
      ambientLight,
      moonLight,
      starField,
      polaris,
      npc6,
      ground,
    )
    starField.geometry.dispose()
    starField.userData.spriteTexture?.dispose()
    starField.material.dispose()
    polaris.geometry.dispose()
    polaris.userData.spriteTexture?.dispose()
    polaris.material.dispose()
    npc6.traverse((child) => {
      if (child.isMesh) child.geometry.dispose()
    })
    npc6.userData.material.dispose()
    npc6.userData.dispose?.()
    ground.geometry.dispose()
    ground.material.dispose()
    groundTexture.dispose()
  }

  return {
    npc6State,
    setNpc6ControlPointsVisible,
    playNpc6UserAction,
    previewNpc6UserAction,
    cancelNpc6UserAction,
    update,
    updateGroundPosition,
    dispose,
  }
}
