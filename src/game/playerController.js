import { Vector2, Vector3 } from 'three'
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

  let controlTarget = Object.values(CONTROL_TARGETS).includes(initialControlTarget)
    ? initialControlTarget
    : CONTROL_TARGETS.player

  const resetMovement = () => {
    movement.forward = false
    movement.backward = false
    movement.left = false
    movement.right = false
    lastVertical = ''
    lastHorizontal = ''
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
      if (movement.forward || movement.backward || movement.left || movement.right) {
        setPlayerRunSequenceActive?.(true)
      }
    }
  }

  const handleKeyUp = (event) => {
    if (isCameraMoveKey(event.code)) event.preventDefault()

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
      if (!movement.forward && !movement.backward && !movement.left && !movement.right) {
        setPlayerRunSequenceActive?.(false)
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
      let xDir = 0
      let zDir = 0

      if (movement.left && movement.right) {
        xDir = lastHorizontal === 'KeyD' ? 1 : -1
      } else {
        xDir = Number(movement.right) - Number(movement.left)
      }

      if (movement.forward && movement.backward) {
        zDir = lastVertical === 'KeyS' ? 1 : -1
      } else {
        zDir = Number(movement.backward) - Number(movement.forward)
      }

      // 归一化输入向量，确保斜向移动速度一致
      moveIntent.set(xDir, -zDir)
      if (moveIntent.lengthSq() > 0) {
        moveIntent.normalize()
      }

      // 移动向量插值
      const lerpFactor = 1 - Math.exp(-SMOOTHING * delta)
      currentMoveDir.lerp(moveIntent, lerpFactor)

      if (currentMoveDir.lengthSq() > 0.0001) {
        if (controlTarget === CONTROL_TARGETS.camera) {
          // 相机模式平滑移动
          controls.moveRight(currentMoveDir.x * MOVE_SPEED * delta)
          controls.moveForward(currentMoveDir.y * MOVE_SPEED * delta)
        } else if (player) {
          // 转向平滑：使用单独的旋转逻辑
          if (moveIntent.lengthSq() > 0) {
            const targetRotation = Math.atan2(moveIntent.x, -moveIntent.y) + Math.PI
            
            // 处理旋转角度绕回 (360度)，确保总是选择最短路径转向
            let diff = targetRotation - player.rotation.y
            while (diff < -Math.PI) diff += Math.PI * 2
            while (diff > Math.PI) diff -= Math.PI * 2
            
            const rotationLerpFactor = 1 - Math.exp(-ROTATION_SMOOTHING * delta)
            player.rotation.y += diff * rotationLerpFactor
          }

          // 始终沿着玩家当前的正面方向移动
          const moveVector = new Vector3()
          moveVector.set(0, 0, -1).applyQuaternion(player.quaternion)
          
          // 这里的速度受平滑移动向量长度影响，产生平滑的加减速感
          const speedMultiplier = currentMoveDir.length()
          moveVector.multiplyScalar(MOVE_SPEED * delta * speedMultiplier)

          player.position.add(moveVector)
          camera.position.add(moveVector)
        }
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
      return controlTarget
    },
    update,
    dispose,
  }
}
