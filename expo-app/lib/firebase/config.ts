import { getApp, getApps } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";

// Firebase is automatically initialized via native config files:
// - iOS: GoogleService-Info.plist
// - Android: google-services.json
// No manual initialization needed with React Native Firebase

// Get the default Firebase app (modular API)
export const app = getApps().length > 0 ? getApp() : null;

// Export Firebase service instances (modular API)
export const auth = getAuth();
export const db = getFirestore();
