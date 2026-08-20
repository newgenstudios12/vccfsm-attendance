import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vccfsm.attendance',
  appName: 'VCCF Santa Maria',
  webDir: 'public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
