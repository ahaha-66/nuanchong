import { defineConfig } from '@tarojs/cli';
export default defineConfig({
  projectName: 'nuanchong', date: '2026-06-21', designWidth: 750, deviceRatio: { 750: 1 },
  sourceRoot: 'src', outputRoot: 'dist', framework: 'react', compiler: 'webpack5',
  mini: { postcss: { pxtransform: { enable: true }, url: { enable: true, config: { limit: 1024 } }, cssModules: { enable: false } } },
});

