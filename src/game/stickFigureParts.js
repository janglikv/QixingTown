import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three'

export const STICK_NPC_HEIGHT = 2.15
export const Z_OFFSET = 0.02

const LINE_RADIUS = 0.025
const JOINT_RADIUS = 0.06
const cylinderDirection = new Vector3(0, 1, 0)

export const mirrorX = (vector) => new Vector3(-vector.x, vector.y, vector.z)

const createBone = ({ start, end, material }) => {
  const direction = new Vector3().subVectors(end, start)
  const length = direction.length()
  const geometry = new CylinderGeometry(LINE_RADIUS, LINE_RADIUS, length, 10)
  const bone = new Mesh(geometry, material)

  bone.position.copy(start).add(end).multiplyScalar(0.5)
  bone.quaternion.copy(new Quaternion().setFromUnitVectors(
    cylinderDirection,
    direction.normalize(),
  ))

  return bone
}

const createJoint = ({ position, material }) => {
  const joint = new Mesh(new SphereGeometry(JOINT_RADIUS, 16, 12), material)
  joint.position.copy(position)
  return joint
}

export const createStickFigure = ({ name, position, joints, bones, visibleJointKeys }) => {
  const figure = new Group()
  const material = new MeshBasicMaterial({ color: '#000000' })

  bones.forEach(([startKey, endKey]) => {
    figure.add(createBone({
      start: joints[startKey],
      end: joints[endKey],
      material,
    }))
  })

  visibleJointKeys.forEach((key) => {
    figure.add(createJoint({ position: joints[key], material }))
  })

  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material

  return figure
}
