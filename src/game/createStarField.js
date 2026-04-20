import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  SRGBColorSpace,
} from 'three'
import { STAR_COUNT, WORLD_COLORS, WORLD_TUNING } from '../config.js'

const createStarSprite = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64

  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)

  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.22, 'rgba(255, 250, 235, 0.95)')
  gradient.addColorStop(0.5, 'rgba(185, 210, 255, 0.35)')
  gradient.addColorStop(1, 'rgba(185, 210, 255, 0)')

  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  return texture
}

export const createStarField = () => {
  const positions = new Float32Array(STAR_COUNT * 3)

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const azimuth = Math.random() * Math.PI * 2
    const minY = WORLD_TUNING.starMinAltitude
    const y = minY + Math.random() * (1 - minY)
    const horizontalRadius = Math.sqrt(1 - y * y) * WORLD_TUNING.starSphereRadius
    const offset = index * 3

    positions[offset] = Math.cos(azimuth) * horizontalRadius
    positions[offset + 1] = y * WORLD_TUNING.starSphereRadius
    positions[offset + 2] = Math.sin(azimuth) * horizontalRadius
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const sprite = createStarSprite()

  const material = new PointsMaterial({
    color: WORLD_COLORS.starLight,
    size: WORLD_TUNING.starSize,
    sizeAttenuation: true,
    map: sprite,
    transparent: true,
    opacity: WORLD_TUNING.starOpacity,
    alphaTest: 0.01,
    fog: false,
    depthWrite: false,
    blending: AdditiveBlending,
  })

  const starField = new Points(geometry, material)
  starField.userData.spriteTexture = sprite

  return starField
}
