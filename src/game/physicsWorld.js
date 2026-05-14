import { Vector3 } from 'three'
import { STICK_FIGURE_HEIGHT } from './createPlayer.js'

const PLAYER_RADIUS = 0.35
const PLAYER_CAPSULE_HALF_HEIGHT = Math.max(0.1, STICK_FIGURE_HEIGHT / 2 - PLAYER_RADIUS)
const CHARACTER_CONTROLLER_OFFSET = 0.03

const getMeshTrimeshData = (mesh) => {
  mesh.updateMatrixWorld(true)
  const geometry = mesh.geometry
  const positionAttribute = geometry.getAttribute('position')
  const vertices = new Float32Array(positionAttribute.count * 3)
  const vertex = new Vector3()

  for (let i = 0; i < positionAttribute.count; i++) {
    vertex.fromBufferAttribute(positionAttribute, i)
    vertex.applyMatrix4(mesh.matrixWorld)
    vertices[i * 3] = vertex.x
    vertices[i * 3 + 1] = vertex.y
    vertices[i * 3 + 2] = vertex.z
  }

  if (geometry.index) {
    return {
      vertices,
      indices: new Uint32Array(geometry.index.array),
    }
  }

  const indices = new Uint32Array(positionAttribute.count)
  for (let i = 0; i < indices.length; i++) {
    indices[i] = i
  }

  return { vertices, indices }
}

const addMeshCollider = (RAPIER, world, mesh) => {
  const { vertices, indices } = getMeshTrimeshData(mesh)
  world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices))
}

export const createPhysicsWorld = async ({ wallMeshes, playerPosition }) => {
  const RAPIER = await import('@dimforge/rapier3d-compat')
  await RAPIER.init()

  const world = new RAPIER.World({ x: 0, y: 0, z: 0 })
  wallMeshes.forEach((mesh) => {
    addMeshCollider(RAPIER, world, mesh)
  })

  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(playerPosition.x, playerPosition.y, playerPosition.z),
  )
  const playerColliderDesc = RAPIER.ColliderDesc.capsule(PLAYER_CAPSULE_HALF_HEIGHT, PLAYER_RADIUS)
  const playerCollider = world.createCollider(
    playerColliderDesc,
    playerBody,
  )
  const characterController = world.createCharacterController(CHARACTER_CONTROLLER_OFFSET)
  characterController.setSlideEnabled(true)
  world.step()

  let lastPlayerPosition = {
    x: playerPosition.x,
    y: playerPosition.y,
    z: playerPosition.z,
  }

  const syncPlayerPosition = (position) => {
    const isSynced = (
      Math.abs(position.x - lastPlayerPosition.x) < 0.0001
      && Math.abs(position.y - lastPlayerPosition.y) < 0.0001
      && Math.abs(position.z - lastPlayerPosition.z) < 0.0001
    )
    if (isSynced) return

    playerBody.setTranslation({
      x: position.x,
      y: position.y,
      z: position.z,
    }, true)
    lastPlayerPosition = {
      x: position.x,
      y: position.y,
      z: position.z,
    }
    world.step()
  }

  const movePlayer = (position, desiredMove) => {
    syncPlayerPosition(position)
    characterController.computeColliderMovement(playerCollider, {
      x: desiredMove.x,
      y: desiredMove.y,
      z: desiredMove.z,
    })

    const movement = characterController.computedMovement()
    const nextPosition = {
      x: position.x + movement.x,
      y: position.y + movement.y,
      z: position.z + movement.z,
    }
    playerBody.setNextKinematicTranslation(nextPosition)
    world.step()
    lastPlayerPosition = nextPosition

    return movement
  }

  const isPlayerOverlapping = (position) => (
    world.intersectionWithShape(
      { x: position.x, y: position.y, z: position.z },
      { x: 0, y: 0, z: 0, w: 1 },
      playerColliderDesc.shape,
      undefined,
      undefined,
      playerCollider,
    ) !== null
  )

  const dispose = () => {
    world.removeCharacterController(characterController)
    world.free()
  }

  return {
    isPlayerOverlapping,
    movePlayer,
    dispose,
  }
}
