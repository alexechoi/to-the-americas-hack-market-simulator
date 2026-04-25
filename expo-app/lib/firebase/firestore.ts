import type { FirebaseFirestoreTypes } from "@react-native-firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";

import { db } from "./config";

export interface UserDocument {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  ipSignup: string;
  ipLastLogin: string;
  createdAt: FirebaseFirestoreTypes.FieldValue;
  updatedAt: FirebaseFirestoreTypes.FieldValue;
  acceptedMarketingAt: FirebaseFirestoreTypes.FieldValue | null;
  acceptedPrivacyPolicyAt: FirebaseFirestoreTypes.FieldValue;
  acceptedTermsAt: FirebaseFirestoreTypes.FieldValue;
}

/**
 * Get the client's public IP address
 */
export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "unknown";
  }
}

/**
 * Create a new user document in Firestore
 */
export async function createUserDocument(
  uid: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    acceptedMarketing: boolean;
  },
): Promise<void> {
  const ip = await getClientIP();

  const userDoc = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phoneNumber: data.phoneNumber,
    ipSignup: ip,
    ipLastLogin: ip,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    acceptedMarketingAt: data.acceptedMarketing ? serverTimestamp() : null,
    acceptedPrivacyPolicyAt: serverTimestamp(),
    acceptedTermsAt: serverTimestamp(),
  };

  const userRef = doc(collection(db, "users"), uid);
  await setDoc(userRef, userDoc);
}

/**
 * Update the last login IP for a user
 */
export async function updateLastLoginIP(uid: string): Promise<void> {
  const ip = await getClientIP();

  const userRef = doc(collection(db, "users"), uid);
  await updateDoc(userRef, {
    ipLastLogin: ip,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a user document from Firestore
 */
export async function getUserDocument(
  uid: string,
): Promise<UserDocument | null> {
  const userRef = doc(collection(db, "users"), uid);
  const docSnap = await getDoc(userRef);
  return docSnap.exists() ? (docSnap.data() as UserDocument) : null;
}
