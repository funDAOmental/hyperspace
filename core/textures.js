import * as THREE from 'three'
import { textureData, spritesheets } from './texture-data'
import { deepCopy } from '/core/merge/tiny-merge'

const textures = {}

export const loadTextures = async () =>
  new Promise((resolve, reject) => {
    let _textureData = deepCopy(textureData)
    for(const sheet of spritesheets) {
      _textureData[sheet.src] = sheet
    }
    let imagesToLoad = Object.keys(_textureData).length
    Object.keys(_textureData).forEach((name) => {
      const td = _textureData[name]
      const image = new Image()
      image.src = td.src
      image.onload = () => {
        textures[name] = {
          ...td,
          scale: td.scale ?? 1,
          width: image.width,
          height: image.height,
          image,
        }
        if (td.sprites) {
          const width = image.width / td.sprites.columns
          const height = image.height / td.sprites.rows
          let boxes = []
          for (let x = 0; x < image.width; x += width) {
            let col = []
            for (let y = 0; y < image.height; y += height) {
              col.push([x, y])
            }
            boxes.push(col)
          }
          textures[name].sprites = {
            ...td.sprites,
            width,
            height,
            boxes,
          }
        }
        if (--imagesToLoad == 0) {
          resolve()
        }
      }
    })
  })

export const getTextureByName = name => textures[name] ?? null
export const getTextureImageByName = name => textures[name]?.image ?? null

export const createRenderTexture = (width, height) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.width = width
  canvas.height = height

  const texture = new THREE.CanvasTexture(canvas)

  return {
    canvas,
    context,
    texture,
    width,
    height,
  }
}

// Currently only accepts png.
export const fromSourceToDataURL = (src) => (
  new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = image.width
      canvas.height = image.height
      context.drawImage(image, 0, 0)
      const dataUrl = canvas.toDataURL('image/png')
      resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      reject()
    }
    image.src = src
  })
)
