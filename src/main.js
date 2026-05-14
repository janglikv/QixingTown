import './style.css'
import { createSceneApp } from './game/sceneApp.js'

try {
  await createSceneApp(document.querySelector('#app'))
} catch (error) {
  console.error('Failed to initialize Three.js scene.', error)
}
