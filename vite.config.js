import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 9999,
  },
  preview: {
    port: 9999,
  },
  build: {
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('/node_modules/three/')) return

          if (id.includes('/node_modules/three/examples/')) return 'three-examples'
          if (id.includes('/node_modules/three/src/renderers/')) return 'three-renderers'
          if (id.includes('/node_modules/three/src/geometries/')) return 'three-geometries'
          if (id.includes('/node_modules/three/src/materials/')) return 'three-materials'
          if (id.includes('/node_modules/three/src/lights/')) return 'three-lights'
          if (id.includes('/node_modules/three/build/')) return 'three-core'

          return 'three-core'
        },
      },
    },
  },
})
