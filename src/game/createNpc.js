import { BoxGeometry, Group, MathUtils, Mesh, MeshStandardMaterial } from 'three'

const createBlock = ({ width, height, depth, x = 0, y = 0, z = 0, material }) => {
  const block = new Mesh(new BoxGeometry(width, height, depth), material)
  block.position.set(x, y, z)
  block.castShadow = true
  block.receiveShadow = true
  return block
}

export const createNpc = () => {
  const npc = new Group()
  npc.name = 'npc-voxel-base-mesh'

  const unit = 0.1

  const headMaterial = new MeshStandardMaterial({
    color: '#c7b3a1',
    roughness: 0.96,
    metalness: 0.01,
  })
  const torsoMaterial = new MeshStandardMaterial({
    color: '#b39f8f',
    roughness: 0.97,
    metalness: 0.01,
  })
  const limbMaterial = new MeshStandardMaterial({
    color: '#9f8c7d',
    roughness: 0.98,
    metalness: 0.01,
  })
  const faceMaterial = new MeshStandardMaterial({
    color: '#2b241f',
    roughness: 1,
    metalness: 0,
  })

  npc.add(
    createBlock({
      width: 8 * unit,
      height: 8 * unit,
      depth: 8 * unit,
      y: 2.8,
      material: headMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 1 * unit,
      height: 1 * unit,
      depth: 0.2 * unit,
      x: -1.4 * unit,
      y: 2.9,
      z: 4.1 * unit,
      material: faceMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 1 * unit,
      height: 1 * unit,
      depth: 0.2 * unit,
      x: 1.4 * unit,
      y: 2.9,
      z: 4.1 * unit,
      material: faceMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 2 * unit,
      height: 0.6 * unit,
      depth: 0.2 * unit,
      y: 2.52,
      z: 4.1 * unit,
      material: faceMaterial,
    }),
  )

  npc.add(
    createBlock({
      width: 8 * unit,
      height: 12 * unit,
      depth: 4 * unit,
      y: 1.7,
      material: torsoMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 8 * unit,
      height: 12 * unit,
      depth: 4 * unit,
      x: 36 * unit,
      y: 1.7,
      material: torsoMaterial,
    }),
  )

  npc.add(
    createBlock({
      width: 12 * unit,
      height: 4 * unit,
      depth: 4 * unit,
      x: -10 * unit,
      y: 2.1,
      material: limbMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 12 * unit,
      height: 4 * unit,
      depth: 4 * unit,
      x: 10 * unit,
      y: 2.1,
      material: limbMaterial,
    }),
  )

  npc.add(
    createBlock({
      width: 4 * unit,
      height: 12 * unit,
      depth: 4 * unit,
      x: -2.3 * unit,
      y: 0.5,
      material: limbMaterial,
    }),
  )
  npc.add(
    createBlock({
      width: 4 * unit,
      height: 12 * unit,
      depth: 4 * unit,
      x: 2.3 * unit,
      y: 0.5,
      material: limbMaterial,
    }),
  )

  npc.position.set(0, 0, -7)
  npc.rotation.y = MathUtils.degToRad(-12)

  const dispose = () => {
    npc.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose()
      }
    })
    headMaterial.dispose()
    torsoMaterial.dispose()
    limbMaterial.dispose()
    faceMaterial.dispose()
  }

  return {
    npc,
    dispose,
  }
}
