import { defineConfig, splitVendorChunkPlugin } from 'vite';
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';

const isAnalyze = process.env.ANALYZE === 'true' || process.env.ANALYZE === '1';

export default defineConfig({
  base: './',
  plugins: [
    splitVendorChunkPlugin(),
    // Emit pre-compressed assets for optimal static hosting
    compression({ algorithm: 'brotliCompress', ext: '.br', deleteOriginFile: false, threshold: 1024 }),
    compression({ algorithm: 'gzip', ext: '.gz', deleteOriginFile: false, threshold: 1024 }),
    // Bundle visualizer (enable with ANALYZE=1)
    (isAnalyze && visualizer({
      filename: 'dist/bundle-analysis.html',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    })) as any,
  ].filter(Boolean),
  esbuild: {
    // Remove dev-only statements from production bundles
    drop: ['console', 'debugger'],
  },
  build: {
    target: 'es2019',
    sourcemap: false,
    cssCodeSplit: true,
    minify: 'esbuild',
    manifest: true,
    brotliSize: false,
    assetsDir: 'assets',
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
});
