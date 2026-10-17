import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.algordeev.privet',
  appName: 'Privet',
  webDir: 'dist-native',
  // CSS owns safe-area spacing; don't also inset the WKWebView scroll view.
  ios: { contentInset: 'never', backgroundColor: '#f8f6f0' }
};

export default config;
