// 提供基于 rig definition 和关节点数据渲染、同步、释放火柴人模型的能力。
import {
  CatmullRomCurve3,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
} from 'three'

const DEFAULT_TUBE_RADIUS = 0.045
const DEFAULT_TUBE_RADIAL_SEGMENTS = 12
const DEFAULT_END_CAP_RADIUS = 0.07
const DEFAULT_CONTROL_POINT_RADIUS = 0.01
const DEFAULT_JOINT_CAP_RADIUS_FACTOR = 1.25

const createTubeGeometry = ({ keys, joints, radius, radialSegments }) => {
  const points = keys.map((key) => joints[key])
  const curve = new CatmullRomCurve3(points, false, 'centripetal')

  return new TubeGeometry(
    curve,
    (points.length - 1) * 18,
    radius,
    radialSegments,
    false,
  )
}

const createTube = ({ keys, joints, material, radius, radialSegments }) => (
  new Mesh(createTubeGeometry({ keys, joints, radius, radialSegments }), material)
)

const createDefaultMaterial = () => (
  new MeshStandardMaterial({
    color: '#000000',
    emissive: '#000000',
    emissiveIntensity: 0,
    metalness: 0.85,
    roughness: 0.28,
  })
)

const createDefaultControlPointMaterial = () => (
  new MeshStandardMaterial({
    color: '#ffea4d',
    emissive: '#ff9f1a',
    emissiveIntensity: 0.9,
    metalness: 0.1,
    roughness: 0.25,
    depthTest: false,
  })
)

const createChildKeysByParent = (rig) => {
  const childKeysByParent = {}

  rig.hierarchy.forEach(([parentKey, childKey]) => {
    childKeysByParent[parentKey] ??= []
    childKeysByParent[parentKey].push(childKey)
  })

  return childKeysByParent
}

const createDefaultTubePaths = (rig) => {
  const childKeysByParent = createChildKeysByParent(rig)
  const paths = []

  const walk = (key, path) => {
    const childKeys = childKeysByParent[key] ?? []

    // 单子节点链路合并成一条软管，分叉处拆开并交给 joint cap 遮缝。
    if (childKeys.length !== 1) {
      if (path.length > 1) paths.push(path)
      childKeys.forEach((childKey) => walk(childKey, [key, childKey]))
      return
    }

    walk(childKeys[0], [...path, childKeys[0]])
  }

  walk(rig.rootBoneKey, [rig.rootBoneKey])

  return paths
}

const createDefaultJointCapKeys = (rig) => (
  Object.entries(createChildKeysByParent(rig))
    .filter(([, childKeys]) => childKeys.length > 1)
    .map(([key]) => key)
)

const getEndCapConfig = ({ render, key }) => {
  const endCaps = render.endCaps ?? {}
  const config = endCaps.byKey?.[key] ?? {}
  const customMaterial = config.createMaterial?.() ?? null

  return {
    enabled: config.enabled ?? endCaps.enabled ?? false,
    radius: config.radius ?? endCaps.radius ?? DEFAULT_END_CAP_RADIUS,
    material: customMaterial?.material ?? customMaterial,
    textures: customMaterial?.textures ?? [],
    rotation: config.rotation ?? null,
  }
}

const createEndCap = ({ key, position, material, config, resources }) => {
  const endCap = new Mesh(
    new SphereGeometry(config.radius, 16, 12),
    config.material ?? material,
  )

  endCap.position.copy(position)
  endCap.castShadow = true
  if (config.rotation) endCap.rotation.set(...config.rotation)
  if (config.material) resources.materials.push(config.material)
  resources.textures.push(...config.textures)
  endCap.name = `${key}EndCap`

  return endCap
}

const createControlPoints = ({ joints, rig, render, material }) => {
  const group = new Group()
  const controlPoints = {}
  const config = render.controlPoints ?? {}
  const radius = config.radius ?? DEFAULT_CONTROL_POINT_RADIUS

  ;(config.keys ?? rig.boneKeys).forEach((key) => {
    const controlPoint = new Mesh(
      new SphereGeometry(radius, 12, 8),
      material,
    )
    controlPoint.name = `${key}ControlPoint`
    controlPoint.position.copy(joints[key])
    controlPoint.renderOrder = 20
    controlPoints[key] = controlPoint
    group.add(controlPoint)
  })

  group.name = 'rig-control-points'

  return {
    group,
    controlPoints,
  }
}

export const createStickFigureRig = ({ name, position, joints, rig, render }) => {
  const figure = new Group()
  const material = render.createMaterial?.() ?? createDefaultMaterial()
  const controlPointMaterial = render.controlPoints?.createMaterial?.()
    ?? createDefaultControlPointMaterial()
  const resources = {
    materials: [material, controlPointMaterial],
    textures: [],
  }
  const tubes = []
  const endCaps = {}
  const jointCaps = {}
  const tubeRadius = render.tube?.radius ?? DEFAULT_TUBE_RADIUS
  const tubeRadialSegments = render.tube?.radialSegments ?? DEFAULT_TUBE_RADIAL_SEGMENTS
  const tubePaths = render.tubes ?? createDefaultTubePaths(rig)
  const jointCapKeys = render.jointCaps?.keys ?? createDefaultJointCapKeys(rig)
  const jointCapRadius = render.jointCaps?.radius ?? tubeRadius * DEFAULT_JOINT_CAP_RADIUS_FACTOR

  tubePaths.forEach((keys) => {
    const mesh = createTube({
      keys,
      joints,
      material,
      radius: tubeRadius,
      radialSegments: tubeRadialSegments,
    })
    mesh.castShadow = true
    tubes.push({ mesh, keys })
    figure.add(mesh)
  })

  jointCapKeys.forEach((key) => {
    const jointCap = new Mesh(
      new SphereGeometry(jointCapRadius, 16, 12),
      material,
    )

    jointCap.position.copy(joints[key])
    jointCap.castShadow = true
    jointCap.name = `${key}JointCap`
    jointCaps[key] = jointCap
    figure.add(jointCap)
  })

  ;(rig.endBoneKeys ?? []).forEach((key) => {
    const config = getEndCapConfig({ render, key })
    if (!config.enabled) return

    const endCap = createEndCap({
      key,
      position: joints[key],
      material,
      config,
      resources,
    })
    endCaps[key] = endCap
    figure.add(endCap)
  })

  const { group: controlPointGroup, controlPoints } = createControlPoints({
    joints,
    rig,
    render,
    material: controlPointMaterial,
  })
  figure.add(controlPointGroup)

  figure.name = name
  figure.position.set(...position)
  figure.userData.material = material
  figure.userData.tubes = tubes
  figure.userData.jointCaps = jointCaps
  figure.userData.endCaps = endCaps
  figure.userData.controlPointGroup = controlPointGroup
  figure.userData.controlPoints = controlPoints
  figure.userData.rigRender = {
    render,
    resources,
    tubePaths,
    tubeRadius,
    tubeRadialSegments,
    jointCapKeys,
    jointCapRadius,
  }

  return figure
}

export const syncStickFigureRigPose = ({ figure, joints }) => {
  const { render, tubeRadius, tubeRadialSegments } = figure.userData.rigRender

  figure.userData.tubes.forEach(({ mesh, keys }) => {
    mesh.geometry.dispose()
    mesh.geometry = createTubeGeometry({
      keys,
      joints,
      radius: tubeRadius,
      radialSegments: tubeRadialSegments,
    })
  })

  Object.entries(figure.userData.endCaps).forEach(([key, endCap]) => {
    endCap.position.copy(joints[key])
  })

  Object.entries(figure.userData.jointCaps).forEach(([key, jointCap]) => {
    jointCap.position.copy(joints[key])
  })

  Object.entries(figure.userData.controlPoints).forEach(([key, controlPoint]) => {
    controlPoint.position.copy(joints[key])
  })

  render.afterSync?.({ figure, joints })
}

export const disposeStickFigureRig = (figure) => {
  const resources = figure.userData.rigRender?.resources
  resources?.textures.forEach((texture) => texture.dispose())
  resources?.materials.forEach((material) => material.dispose())
}
