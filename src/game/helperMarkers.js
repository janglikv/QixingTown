import {
  BoxGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three'

const UNIT_BOX = new BoxGeometry(1, 1, 1)
const SPHERE = new SphereGeometry(1, 16, 12)
const DISC = new CircleGeometry(1, 48)

const createMaterial = ({ color, opacity, depthTest = true, depthWrite = true }) => (
  new MeshStandardMaterial({
    color,
    depthTest,
    depthWrite,
    transparent: opacity < 1,
    opacity,
    side: DoubleSide,
    roughness: 0.72,
    metalness: 0,
  })
)

const setMaterial = (mesh, {
  color,
  opacity,
  depthTest = true,
  depthWrite = true,
}) => {
  mesh.material.color.set(color)
  mesh.material.opacity = opacity
  mesh.material.transparent = opacity < 1
  mesh.material.depthTest = depthTest
  mesh.material.depthWrite = depthWrite
  mesh.material.needsUpdate = true
}

const createMesh = ({
  geometry,
  color,
  opacity,
  depthTest,
  depthWrite,
}) => (
  new Mesh(geometry, createMaterial({
    color,
    opacity,
    depthTest,
    depthWrite,
  }))
)

export const createHelperMarkerSystem = ({ root }) => {
  const markers = new Map()

  const createMarker = (id) => {
    const group = new Group()
    group.name = `helper-marker-${id}`
    group.userData.isHelperMarker = true

    const marker = {
      group,
      sphere: null,
      vertical: null,
      crossX: null,
      crossZ: null,
      disc: null,
      edges: [],
    }

    markers.set(id, marker)
    root.add(group)

    return marker
  }

  const ensureChild = (marker, key, create) => {
    if (marker[key]) return marker[key]

    marker[key] = create()
    marker[key].userData.isHelperMarker = true
    marker.group.add(marker[key])

    return marker[key]
  }

  const syncParent = (marker, parent = root) => {
    if (marker.group.parent === parent) return

    marker.group.parent?.remove(marker.group)
    parent.add(marker.group)
  }

  const markPoint = ({
    id,
    parent = root,
    position,
    color = '#ffffff',
    opacity = 1,
    visible = true,
    sphere = false,
    verticalLine = null,
    groundCross = null,
    heightDisc = null,
  }) => {
    const marker = markers.get(id) ?? createMarker(id)

    syncParent(marker, parent)
    marker.group.visible = visible
    if (!visible) return

    marker.group.position.copy(position)

    if (sphere) {
      const config = sphere === true ? {} : sphere
      const mesh = ensureChild(marker, 'sphere', () => createMesh({
        geometry: SPHERE,
        color,
        opacity,
        depthTest: config.depthTest ?? false,
      }))

      mesh.visible = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.scale.setScalar(config.radius ?? 0.032)
      mesh.position.set(0, 0, 0)
      setMaterial(mesh, {
        color,
        opacity,
        depthTest: config.depthTest ?? false,
      })
    } else if (marker.sphere) {
      marker.sphere.visible = false
    }

    if (verticalLine) {
      const config = verticalLine === true ? {} : verticalLine
      const fromY = config.fromY ?? 0
      const toY = config.toY ?? position.y
      const height = Math.abs(toY - fromY)
      const mesh = ensureChild(marker, 'vertical', () => createMesh({
        geometry: UNIT_BOX,
        color,
        opacity,
        depthTest: config.depthTest ?? true,
      }))

      mesh.visible = height > 0
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.position.set(0, ((fromY + toY) * 0.5) - position.y, 0)
      mesh.scale.set(config.width ?? 0.008, height, config.width ?? 0.008)
      setMaterial(mesh, {
        color,
        opacity: config.opacity ?? opacity,
        depthTest: config.depthTest ?? true,
      })
    } else if (marker.vertical) {
      marker.vertical.visible = false
    }

    if (groundCross) {
      const config = groundCross === true ? {} : groundCross
      const halfSize = config.halfSize ?? config.size ?? 0.32
      const width = config.width ?? 0.035
      const y = (config.y ?? 0.01) - position.y
      const crossOpacity = config.opacity ?? opacity
      const crossX = ensureChild(marker, 'crossX', () => createMesh({
        geometry: UNIT_BOX,
        color,
        opacity: crossOpacity,
        depthTest: config.depthTest ?? true,
      }))
      const crossZ = ensureChild(marker, 'crossZ', () => createMesh({
        geometry: UNIT_BOX,
        color,
        opacity: crossOpacity,
        depthTest: config.depthTest ?? true,
      }))

      crossX.visible = true
      crossZ.visible = true
      crossX.castShadow = false
      crossZ.castShadow = false
      crossX.receiveShadow = true
      crossZ.receiveShadow = true
      crossX.position.set(0, y, 0)
      crossZ.position.set(0, y, 0)
      crossX.scale.set(halfSize * 2, width, width)
      crossZ.scale.set(width, width, halfSize * 2)
      ;[crossX, crossZ].forEach((mesh) => {
        setMaterial(mesh, {
          color,
          opacity: crossOpacity,
          depthTest: config.depthTest ?? true,
        })
      })
    } else {
      if (marker.crossX) marker.crossX.visible = false
      if (marker.crossZ) marker.crossZ.visible = false
    }

    if (heightDisc) {
      const config = heightDisc === true ? {} : heightDisc
      const mesh = ensureChild(marker, 'disc', () => createMesh({
        geometry: DISC,
        color,
        opacity: config.opacity ?? opacity,
        depthTest: config.depthTest ?? true,
        depthWrite: config.depthWrite ?? true,
      }))

      mesh.visible = true
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.position.set(0, 0, 0)
      mesh.rotation.x = -Math.PI / 2
      mesh.scale.setScalar(config.radius ?? 0.72)
      setMaterial(mesh, {
        color,
        opacity: config.opacity ?? opacity,
        depthTest: config.depthTest ?? true,
        depthWrite: config.depthWrite ?? true,
      })
    } else if (marker.disc) {
      marker.disc.visible = false
    }
  }

  const markGroundPolygon = ({
    id,
    parent = root,
    points = [],
    color = '#ffffff',
    opacity = 1,
    y = 0.012,
    width = 0.004,
    visible = true,
    depthTest = true,
  }) => {
    const marker = markers.get(id) ?? createMarker(id)

    syncParent(marker, parent)
    marker.group.visible = visible && points.length >= 3
    if (!marker.group.visible) return

    marker.group.position.set(0, 0, 0)
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      const dx = next.x - point.x
      const dz = next.z - point.z
      const length = Math.hypot(dx, dz)
      const edge = marker.edges[index] ?? createMesh({
        geometry: UNIT_BOX,
        color,
        opacity,
        depthTest,
      })

      if (!marker.edges[index]) {
        edge.userData.isHelperMarker = true
        marker.group.add(edge)
        marker.edges[index] = edge
      }

      edge.visible = length > 0
      edge.castShadow = false
      edge.receiveShadow = true
      edge.position.set((point.x + next.x) * 0.5, y, (point.z + next.z) * 0.5)
      edge.rotation.set(0, -Math.atan2(dz, dx), 0)
      edge.scale.set(length, width, width)
      setMaterial(edge, {
        color,
        opacity,
        depthTest,
      })
    })

    marker.edges.slice(points.length).forEach((edge) => {
      edge.visible = false
    })
  }

  const hide = (id) => {
    const marker = markers.get(id)
    if (marker) marker.group.visible = false
  }

  const hidePrefix = (prefix) => {
    markers.forEach((marker, id) => {
      if (id.startsWith(prefix)) marker.group.visible = false
    })
  }

  const dispose = () => {
    markers.forEach((marker) => {
      marker.group.parent?.remove(marker.group)
      ;[
        marker.sphere,
        marker.vertical,
        marker.crossX,
        marker.crossZ,
        marker.disc,
        ...marker.edges,
      ].forEach((mesh) => {
        mesh?.material?.dispose()
      })
    })
    markers.clear()
  }

  return {
    markPoint,
    markGroundPolygon,
    hide,
    hidePrefix,
    dispose,
  }
}
