import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kneadtoknow.app',
  appName: 'Knead to Know',
  // Angular production build output (same folder netlify.toml publishes).
  webDir: 'dist/knead-to-know/browser',
  android: {
    // The app talks to Supabase and PayMongo over HTTPS only.
    allowMixedContent: false,
  },
};

export default config;
