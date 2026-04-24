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
  CHARACTER_TURN_SPEED,
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
    upperPose: 'idle',
    squatPose: false,
    squatAction: false,
    buttTwistAction: false,
    waveAction: null,
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
  let npc6TargetRotationY = npc6.rotation.y
  let npc6MovedThisFrame = false
  let npc6WalkSpeedMultiplier = 1

  const rotateNpc6TowardTarget = (delta, speedMultiplier) => {
    const rotationDelta = Math.atan2(
      Math.sin(npc6TargetRotationY - npc6.rotation.y),
      Math.cos(npc6TargetRotationY - npc6.rotation.y),
    )
    const maxStep = CHARACTER_TURN_SPEED * speedMultiplier * delta

    npc6.rotation.y += Math.sign(rotationDelta) * Math.min(Math.abs(rotationDelta), maxStep)
  }

  const update = (delta) => {
    polarisTwinkleTime += delta * WORLD_TUNING.polarisTwinkleSpeed
    const twinkle = (Math.sin(polarisTwinkleTime) + 1) / 2
    polaris.material.opacity = (
      WORLD_TUNING.polarisMinOpacity
      + twinkle * (WORLD_TUNING.polarisMaxOpacity - WORLD_TUNING.polarisMinOpacity)
    )
    if (npc6MovedThisFrame) rotateNpc6TowardTarget(delta, npc6WalkSpeedMultiplier)
    npc6.userData.setWalking(npc6MovedThisFrame, npc6WalkSpeedMultiplier)
    npc6MovedThisFrame = false
    npc6WalkSpeedMultiplier = 1
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

  const setNpc6HoldHead = (enabled) => {
    npc6State.waveAction = null
    npc6State.upperPose = enabled ? 'holdHead' : 'idle'
    npc6.userData.setHoldHeadPose(enabled)
  }

  const setNpc6HandRaise = (side) => {
    const nextPose = npc6State.upperPose === side ? 'idle' : side

    npc6State.waveAction = null
    npc6State.upperPose = nextPose
    npc6.userData.setHandRaisePose(nextPose === 'idle' ? null : nextPose)
  }

  const setNpc6SquatPose = (enabled) => {
    if (enabled && npc6State.squatAction) {
      npc6State.squatAction = false
    }
    npc6State.squatPose = enabled
    npc6.userData.setSquatPose(enabled)
  }

  const setNpc6SquatAction = (enabled) => {
    if (enabled && npc6State.squatPose) {
      npc6State.squatPose = false
    }
    npc6State.squatAction = enabled
    npc6.userData.setSquatAction(enabled)
  }

  const setNpc6ButtTwistAction = (enabled) => {
    npc6State.buttTwistAction = enabled
    npc6.userData.setButtTwistAction(enabled)
  }

  const setNpc6ControlPointsVisible = (visible) => {
    npc6.userData.setControlPointsVisible(visible)
  }

  const moveNpc6 = (offset, speedMultiplier = 1) => {
    npc6TargetRotationY = Math.atan2(offset.x, offset.z)
    npc6MovedThisFrame = true
    npc6WalkSpeedMultiplier = Math.max(npc6WalkSpeedMultiplier, speedMultiplier)
    npc6.position.add(offset)
  }

  const setNpc6WaveAction = (side) => {
    const nextAction = npc6State.waveAction === side ? null : side

    if (nextAction) npc6State.upperPose = 'idle'
    npc6State.waveAction = nextAction
    npc6.userData.setWaveAction(nextAction)
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
    setNpc6HoldHead,
    setNpc6HandRaise,
    setNpc6SquatPose,
    setNpc6SquatAction,
    setNpc6ButtTwistAction,
    setNpc6ControlPointsVisible,
    moveNpc6,
    setNpc6WaveAction,
    update,
    updateGroundPosition,
    dispose,
  }
}
