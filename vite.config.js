import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(() => {
  const noOptimize = process.env.VITE_NO_OPTIMIZE === '1';
  const usePolling = process.env.VITE_POLLING === '1';

  return {
    // 依赖预构建：首次启动会进行一次 esbuild 预打包，体量大的库建议纳入
    optimizeDeps: {
      include: ['echarts', 'xlsx'],
      disabled: noOptimize,
      // force: false  // 如需强制重建缓存，可在命令行使用 `vite --force`
    },
    server: {
      host: true,
      port: 5173,
      open: false,
      strictPort: false,
      // 如果代码在网络/映射盘上，原生文件监听可能会卡顿或失效：
      // 将 usePolling 设为 true 可提升稳定性（代价是更高的 CPU 占用）。
      watch: {
        usePolling,
        // interval: 100,
      },
    },
    preview: { port: 4173 },
    logLevel: 'info',
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        },
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
