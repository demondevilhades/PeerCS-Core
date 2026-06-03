import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { peercs: 'src/index.ts' },
  format: ['cjs', 'esm', 'iife'],
  globalName: 'PeerCS',
  dts: true,
  clean: true,
})
