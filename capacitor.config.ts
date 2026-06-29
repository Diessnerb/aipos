import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'com.ordergeniesolution.app',
  appName: 'OrderGenieSolution',
  webDir: 'dist',
  server: {
    cleartext: true
  },
  plugins: {
    KeepAwake: {},
    StatusBar: {
      style: 'DARK'
    }
  }
};

export default config;
