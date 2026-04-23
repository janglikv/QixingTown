import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

export const createGroundTexture = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512

  const context = canvas.getContext('2d')
  context.fillStyle = '#07111f'
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.strokeStyle = '#245f96'
  context.lineWidth = 2.5

  for (let offset = 0; offset <= canvas.width; offset += 32) {
    context.beginPath()
    context.moveTo(offset, 0)
    context.lineTo(offset, canvas.height)
    context.stroke()

    context.beginPath()
    context.moveTo(0, offset)
    context.lineTo(canvas.width, offset)
    context.stroke()
  }

  context.strokeStyle = '#5cb8ff'
  context.lineWidth = 4

  for (let offset = 0; offset <= canvas.width; offset += 128) {
    context.beginPath()
    context.moveTo(offset, 0)
    context.lineTo(offset, canvas.height)
    context.stroke()

    context.beginPath()
    context.moveTo(0, offset)
    context.lineTo(canvas.width, offset)
    context.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(110, 110)

  return texture
}
