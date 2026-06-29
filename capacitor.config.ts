import { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.aa53957ba947475b8f3155fc66d2cf9b',
  appName: 'aipos',
  webDir: 'dist',
  server: {
    url: 'https://aa53957b-a947-475b-8f31-55fc66d2cf9b.lovableproject.com?forceHideBadge=true',
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
