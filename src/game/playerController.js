import { Vector2 } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import {
  CAMERA_HEIGHT,
  MOVE_SPEED,
  WORLD_TUNING,
} from '../config.js'

const CONTROL_TARGETS = {
  camera: 'camera',
  player: 'player',
}
const STANDING_CAMERA_YAW_OFFSET = Math.PI / 12
const PLAYER_CAMERA_Z = 6

export const createPlayerController = ({
  camera,
  player,
  domElement,
  setPlayerWalkIkActive,
  setPlayerRunSequenceActive,
  initialControlTarget = CONTROL_TARGETS.camera,
}) => {
  const controls = new PointerLockControls(camera, domElement)
  controls.pointerSpeed = WORLD_TUNING.pointerSpeed
  controls.minPolarAngle = WORLD_TUNING.minPolarAngle
  controls.maxPolarAngle = Math.PI - WORLD_TUNING.maxPolarAnglePadding

  const movement = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  }
  let lastVertical = '' // 'KeyW' or 'KeyS'
  let lastHorizontal = '' // 'KeyA' or 'KeyD'

  const moveIntent = new Vector2()
  const currentMoveDir = new Vector2()
  const SMOOTHING = 12 // 移动平滑系数
  const ROTATION_SMOOTHING = 15 // 转向平滑系数
  const ROTATION_EPSILON = 0.001
  let targetPlayerRotation = null
  const playerCameraQuaternion = camera.quaternion.clone()
  const stationaryCameraQuaternion = playerCameraQuaternion.clone()
  const cameraControlPosition = camera.position.clone()
  const cameraControlQuaternion = camera.quaternion.clone()
  let isPlayerCameraLocked = false

  let controlTarget = Object.values(CONTROL_TARGETS).includes(initialControlTarget)
    ? initialControlTarget
    : CONTROL_TARGETS.player

  const getMovementAxes = () => {
    let xDir = 0
    let zDir = 0

    if (movement.left && movement.right) {
      xDir = lastHorizontal === 'KeyD' ? 1 : -1
    } else {
      xDir = Number(movement.right) - Number(movement.left)
    }

    if (controlTarget === CONTROL_TARGETS.camera) {
      if (movement.forward && movement.backward) {
        zDir = lastVertical === 'KeyS' ? 1 : -1
      } else {
        zDir = Number(movement.backward) - Number(movement.forward)
      }
    }

    return { xDir, zDir }
  }

  const hasPlayerHorizontalMovement = () => movement.left || movement.right

  const lockPlayerCamera = () => {
    stationaryCameraQuaternion.copy(playerCameraQuaternion)
    camera.quaternion.copy(stationaryCameraQuaternion)
    isPlayerCameraLocked = true
  }

  const unlockPlayerCamera = () => {
    isPlayerCameraLocked = false
  }

  const applyPlayerCameraPose = () => {
    if (player) camera.position.x = player.position.x
    camera.position.y = CAMERA_HEIGHT
    camera.position.z = PLAYER_CAMERA_Z
    lockPlayerCamera()
  }

  const enterPlayerControl = () => {
    cameraControlPosition.copy(camera.position)
    cameraControlQuaternion.copy(camera.quaternion)
    applyPlayerCameraPose()
  }

  const enterCameraControl = () => {
    unlockPlayerCamera()
    camera.position.copy(cameraControlPosition)
    camera.quaternion.copy(cameraControlQuaternion)
  }

  if (controlTarget === CONTROL_TARGETS.player) {
    applyPlayerCameraPose()
  }

  const getPlayerStandingRotation = (key) => (
    key === 'KeyA'
      ? Math.PI / 2 + STANDING_CAMERA_YAW_OFFSET
      : -Math.PI / 2 - STANDING_CAMERA_YAW_OFFSET
  )

  const updateTargetPlayerRotation = ({ xDir, zDir }) => {
    if (controlTarget !== CONTROL_TARGETS.player || !player) return
    moveIntent.set(xDir, -zDir)
    if (moveIntent.lengthSq() === 0) return
    moveIntent.normalize()
    targetPlayerRotation = Math.atan2(moveIntent.x, -moveIntent.y) + Math.PI
  }

  const resetMovement = () => {
    movement.forward = false
    movement.backward = false
    movement.left = false
    movement.right = false
    lastVertical = ''
    lastHorizontal = ''
    targetPlayerRotation = null
  }

  const isCameraMoveKey = (code) => (
    code === 'KeyW'
    || code === 'KeyS'
    || code === 'KeyA'
    || code === 'KeyD'
  )

  const lockOnClick = () => {
    if (!controls.isLocked) controls.lock()
  }

  const handleKeyDown = (event) => {
    if (!controls.isLocked) return
    if (event.repeat) return
    if (isCameraMoveKey(event.code)) event.preventDefault()

    switch (event.code) {
      case 'KeyW':
        movement.forward = true
        lastVertical = 'KeyW'
        break
      case 'KeyS':
        movement.backward = true
        lastVertical = 'KeyS'
        break
      case 'KeyA':
        movement.left = true
        lastHorizontal = 'KeyA'
        break
      case 'KeyD':
        movement.right = true
        lastHorizontal = 'KeyD'
        break
    }

    if (controlTarget === CONTROL_TARGETS.player) {
      // 按键触发时立即锁定目标朝向，短按松开后也继续转到位。
      updateTargetPlayerRotation(getMovementAxes())
      if (hasPlayerHorizontalMovement()) {
        setPlayerRunSequenceActive?.(true)
      }
    }
  }

  const handleKeyUp = (event) => {
    if (isCameraMoveKey(event.code)) event.preventDefault()
    const releasedHorizontal = event.code === 'KeyA' || event.code === 'KeyD'
      ? event.code
      : ''

    if (event.code === 'AltLeft' || event.code === 'AltRight') {
      resetMovement()
      return
    }

    switch (event.code) {
      case 'KeyW':
        movement.forward = false
        if (lastVertical === 'KeyW') lastVertical = movement.backward ? 'KeyS' : ''
        break
      case 'KeyS':
        movement.backward = false
        if (lastVertical === 'KeyS') lastVertical = movement.forward ? 'KeyW' : ''
        break
      case 'KeyA':
        movement.left = false
        if (lastHorizontal === 'KeyA') lastHorizontal = movement.right ? 'KeyD' : ''
        break
      case 'KeyD':
        movement.right = false
        if (lastHorizontal === 'KeyD') lastHorizontal = movement.left ? 'KeyA' : ''
        break
    }

    if (controlTarget === CONTROL_TARGETS.player) {
      if (!hasPlayerHorizontalMovement()) {
        if (releasedHorizontal) {
          // 停下后恢复站立偏转，避免角色停在纯侧面。
          targetPlayerRotation = getPlayerStandingRotation(releasedHorizontal)
        }
        lockPlayerCamera()
        setPlayerRunSequenceActive?.(false)
      } else {
        updateTargetPlayerRotation(getMovementAxes())
      }
    }
  }

  const handleUnlock = () => {
    resetMovement()
  }

  const handleBlur = () => {
    resetMovement()
  }

  domElement.addEventListener('click', lockOnClick)
  controls.addEventListener('unlock', handleUnlock)
  window.addEventListener('blur', handleBlur)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)

  const update = (delta) => {
    if (controls.isLocked) {
      const { xDir, zDir } = getMovementAxes()

      // 归一化输入向量，确保斜向移动速度一致
      moveIntent.set(xDir, -zDir)
      if (moveIntent.lengthSq() > 0) {
        moveIntent.normalize()
      }

      if (moveIntent.lengthSq() > 0) {
        updateTargetPlayerRotation({ xDir, zDir })
      }

      // 移动向量插值
      const lerpFactor = 1 - Math.exp(-SMOOTHING * delta)
      currentMoveDir.lerp(moveIntent, lerpFactor)

      if (controlTarget === CONTROL_TARGETS.player && player && targetPlayerRotation !== null) {
        let diff = targetPlayerRotation - player.rotation.y
        while (diff < -Math.PI) diff += Math.PI * 2
        while (diff > Math.PI) diff -= Math.PI * 2

        if (Math.abs(diff) <= ROTATION_EPSILON) {
          player.rotation.y = targetPlayerRotation
          targetPlayerRotation = null
        } else {
          const rotationLerpFactor = 1 - Math.exp(-ROTATION_SMOOTHING * delta)
          player.rotation.y += diff * rotationLerpFactor
        }
      }

      if (currentMoveDir.lengthSq() > 0.0001) {
        if (controlTarget === CONTROL_TARGETS.camera) {
          // 相机模式平滑移动
          controls.moveRight(currentMoveDir.x * MOVE_SPEED * delta)
          controls.moveForward(currentMoveDir.y * MOVE_SPEED * delta)
        } else if (player) {
          // 玩家模式锁定 z，A/D 只在世界 x 轴上移动。
          const moveX = currentMoveDir.x * MOVE_SPEED * delta
          player.position.x += moveX
          camera.position.x += moveX
        }
      }

      if (controlTarget === CONTROL_TARGETS.player && isPlayerCameraLocked) {
        camera.quaternion.copy(stationaryCameraQuaternion)
        camera.position.z = PLAYER_CAMERA_Z
      }
    }

    camera.position.y = CAMERA_HEIGHT
    document.body.classList.toggle('cursor-visible', !controls.isLocked)
  }

  const dispose = () => {
    domElement.removeEventListener('click', lockOnClick)
    controls.removeEventListener('unlock', handleUnlock)
    window.removeEventListener('blur', handleBlur)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('keyup', handleKeyUp)

    if (controls.isLocked) controls.unlock()
    controls.dispose()
  }

  return {
    controls,
    getControlTarget: () => controlTarget,
    toggleControlTarget: () => {
      controlTarget = controlTarget === CONTROL_TARGETS.camera
        ? CONTROL_TARGETS.player
        : CONTROL_TARGETS.camera
      resetMovement()
      if (controlTarget === CONTROL_TARGETS.player) {
        enterPlayerControl()
      } else {
        enterCameraControl()
      }
      return controlTarget
    },
    update,
    dispose,
  }
}
