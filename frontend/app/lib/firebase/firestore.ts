import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./config";

export interface UserDocument {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  ipSignup: string;
  ipLastLogin: string;
  createdAt: ReturnType<typeof serverTimestamp>;
  updatedAt: ReturnType<typeof serverTimestamp>;
  acceptedMarketingAt: ReturnType<typeof serverTimestamp> | null;
  acceptedPrivacyPolicyAt: ReturnType<typeof serverTimestamp>;
  acceptedTermsAt: ReturnType<typeof serverTimestamp>;
}

export async function getClientIP(): Promise<string> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch {
    return "unknown";
  }
}

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

  const userDoc: UserDocument = {
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

  await setDoc(doc(db, "users", uid), userDoc);
}

export async function updateLastLoginIP(uid: string): Promise<void> {
  const ip = await getClientIP();

  await updateDoc(doc(db, "users", uid), {
    ipLastLogin: ip,
    updatedAt: serverTimestamp(),
  });
}

export async function getUserDocument(uid: string) {
  const docRef = doc(db, "users", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}
