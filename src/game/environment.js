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
  CHARACTER_TURN_SPEED,
  GROUND_REPOSITION_STEP,
  GROUND_SIZE,
  WORLD_COLORS,
  WORLD_TUNING,
} from '../config.js'
import { createGroundTexture } from './createGroundTexture.js'
import { createNpc6 } from './createNpc6.js'
import { createPolaris, createStarField } from './createStarField.js'

const FRONT_CAMERA_DISTANCE = 4.2
const FRONT_CAMERA_HEIGHT = 1.35
const FRONT_CAMERA_TARGET_HEIGHT = 0.35
const MAX_BODY_TWIST_Y = Math.PI / 4
const FOOT_RECENTER_EPSILON = 0.0001
const FIXED_VIEW_TARGET_HEIGHT = 1.45
const FIXED_VIEW_CAMERA_RADIUS = 4
const FIXED_VIEW_MAX_POLAR_ANGLE = Math.PI * 0.28

const getNormalizedAngleDelta = (target, current) => Math.atan2(
  Math.sin(target - current),
  Math.cos(target - current),
)

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
  let npc6AimRotationY = npc6.rotation.y
  let npc6TargetRotationY = npc6.rotation.y
  let npc6MovedThisFrame = false
  let npc6TurnedThisFrame = false
  let npc6WalkSpeedMultiplier = 1
  const cameraForward = new Vector3()
  const cameraTarget = new Vector3()

  const rotateNpc6TowardTarget = (delta, speedMultiplier) => {
    const rotationDelta = getNormalizedAngleDelta(npc6TargetRotationY, npc6.rotation.y)
    const maxStep = CHARACTER_TURN_SPEED * speedMultiplier * delta
    const rotationStep = Math.sign(rotationDelta) * Math.min(Math.abs(rotationDelta), maxStep)

    npc6.rotation.y += rotationStep

    return rotationStep
  }

  const update = (delta) => {
    polarisTwinkleTime += delta * WORLD_TUNING.polarisTwinkleSpeed
    const twinkle = (Math.sin(polarisTwinkleTime) + 1) / 2
    polaris.material.opacity = (
      WORLD_TUNING.polarisMinOpacity
      + twinkle * (WORLD_TUNING.polarisMaxOpacity - WORLD_TUNING.polarisMinOpacity)
    )
    let rotationStep = 0
    const footRotationDelta = getNormalizedAngleDelta(npc6TargetRotationY, npc6.rotation.y)
    const isFootRecentering = Math.abs(footRotationDelta) > FOOT_RECENTER_EPSILON

    if (npc6MovedThisFrame || npc6TurnedThisFrame || isFootRecentering) {
      rotationStep = rotateNpc6TowardTarget(delta, npc6WalkSpeedMultiplier)
    }
    const bodyTwistY = isFootRecentering ? 0 : getNormalizedAngleDelta(npc6AimRotationY, npc6.rotation.y)

    npc6.userData.setWalking(npc6MovedThisFrame, npc6WalkSpeedMultiplier)
    npc6.userData.setTurning(Math.abs(rotationStep) > 0.0001, Math.sign(rotationStep) || 1)
    npc6.userData.setFacingTwist(bodyTwistY)
    npc6MovedThisFrame = false
    npc6TurnedThisFrame = false
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

  const moveNpc6 = (
    offset,
    speedMultiplier = 1,
    { recenterFacing = false, updateFacing = true } = {},
  ) => {
    if (updateFacing) {
      npc6TargetRotationY = Math.atan2(offset.x, offset.z)
      npc6AimRotationY = npc6TargetRotationY
    } else if (recenterFacing) {
      npc6TargetRotationY = npc6AimRotationY
      npc6TurnedThisFrame = true
    }
    npc6MovedThisFrame = true
    npc6WalkSpeedMultiplier = Math.max(npc6WalkSpeedMultiplier, speedMultiplier)
    npc6.position.add(offset)
  }

  const turnNpc6ByPointer = (rotationOffsetY) => {
    // 跟随视角先扭身，超过阈值后才让脚步追上视线方向。
    npc6AimRotationY += rotationOffsetY
    const bodyTwistY = getNormalizedAngleDelta(npc6AimRotationY, npc6.rotation.y)
    const isFootRecentering = (
      Math.abs(getNormalizedAngleDelta(npc6TargetRotationY, npc6.rotation.y)) > FOOT_RECENTER_EPSILON
    )

    if (Math.abs(bodyTwistY) > MAX_BODY_TWIST_Y || isFootRecentering) {
      npc6TargetRotationY = npc6AimRotationY
      npc6TurnedThisFrame = true
    }
  }

  const syncCameraToNpc6Front = (camera) => {
    camera.up.set(0, 1, 0)
    cameraForward.set(-Math.sin(npc6AimRotationY), 0, -Math.cos(npc6AimRotationY))
    camera.position
      .copy(npc6.position)
      .addScaledVector(cameraForward, FRONT_CAMERA_DISTANCE)
    camera.position.y += FRONT_CAMERA_HEIGHT
    cameraTarget.copy(npc6.position)
    cameraTarget.y += FRONT_CAMERA_TARGET_HEIGHT
    camera.lookAt(cameraTarget)
  }

  const syncCameraToNpc6FixedView = (camera, pointerOffset = { x: 0, y: 0 }) => {
    // 指针指向的是要让出的视野方向，相机在角色球面的反方向落位。
    const pointerWorldX = pointerOffset.x
    const pointerWorldZ = pointerOffset.y
    const pointerDistance = Math.min(1, Math.hypot(pointerWorldX, pointerWorldZ))
    const polarAngle = pointerDistance * FIXED_VIEW_MAX_POLAR_ANGLE
    const horizontalDistance = Math.sin(polarAngle) * FIXED_VIEW_CAMERA_RADIUS
    const verticalDistance = Math.cos(polarAngle) * FIXED_VIEW_CAMERA_RADIUS
    const directionScale = pointerDistance > 0 ? 1 / pointerDistance : 0

    camera.up.set(0, 0, 1)
    cameraTarget.copy(npc6.position)
    cameraTarget.y += FIXED_VIEW_TARGET_HEIGHT
    camera.position.copy(cameraTarget)
    camera.position.x += pointerWorldX * directionScale * horizontalDistance
    camera.position.y += verticalDistance
    camera.position.z += pointerWorldZ * directionScale * horizontalDistance
    camera.lookAt(cameraTarget)
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
    turnNpc6ByPointer,
    syncCameraToNpc6Front,
    syncCameraToNpc6FixedView,
    setNpc6WaveAction,
    update,
    updateGroundPosition,
    dispose,
  }
}
