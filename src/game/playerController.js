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

export const createPlayerController = ({ camera, domElement, movePlayer }) => {
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

  const moveIntent = new Vector2()
  const playerMove = new Vector3()
  const cameraForward = new Vector3()
  const cameraRight = new Vector3()
  let controlTarget = CONTROL_TARGETS.camera

  const resetMovement = () => {
    movement.forward = false
    movement.backward = false
    movement.left = false
    movement.right = false
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
    if (isCameraMoveKey(event.code)) event.preventDefault()

    switch (event.code) {
      case 'KeyW':
        movement.forward = true
        break
      case 'KeyS':
        movement.backward = true
        break
      case 'KeyA':
        movement.left = true
        break
      case 'KeyD':
        movement.right = true
        break
      default:
        break
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
        break
      case 'KeyS':
        movement.backward = false
        break
      case 'KeyA':
        movement.left = false
        break
      case 'KeyD':
        movement.right = false
        break
      default:
        break
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
      moveIntent.set(
        Number(movement.right) - Number(movement.left),
        Number(movement.forward) - Number(movement.backward),
      )

      if (moveIntent.lengthSq() > 0) {
        moveIntent.normalize()
        if (controlTarget === CONTROL_TARGETS.camera) {
          controls.moveRight(moveIntent.x * MOVE_SPEED * delta)
          controls.moveForward(moveIntent.y * MOVE_SPEED * delta)
        } else {
          camera.getWorldDirection(cameraForward)
          cameraForward.y = 0
          cameraForward.normalize()
          cameraRight.crossVectors(cameraForward, camera.up).normalize()
          playerMove
            .copy(cameraRight)
            .multiplyScalar(moveIntent.x)
            .add(cameraForward.multiplyScalar(moveIntent.y))
            .multiplyScalar(MOVE_SPEED * delta)
          movePlayer(playerMove)
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
