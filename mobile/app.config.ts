import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "SpotUp",
  slug: "spotup",
  version: "0.1.0",
  scheme: "spotup",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/spotup-icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.spotup.mobile",
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "app.spotup.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/spotup-icon.png",
      backgroundColor: "#D5F45B",
    },
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/spotup-icon.png",
  },
  plugins: [
    "expo-router",
    "@react-native-community/datetimepicker",
    "expo-secure-store",
    "expo-video",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Choose sports videos and a profile photo to share with your SpotUp community.",
        cameraPermission: "Record sports moments and skill showcases.",
        microphonePermission: "Record audio with your sports videos.",
      },
    ],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Find games near you or choose a game venue. Your live location is never published.",
      },
    ],
    ["expo-notifications", { color: "#152E22" }],
    [
      "react-native-maps",
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY,
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_KEY,
      },
    ],
  ],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
};
export default config;
