import type { FirebaseAuthTypes } from "@react-native-firebase/auth";
import { createContext, useContext, useEffect, useState } from "react";

import { onAuthStateChanged } from "@/lib/firebase/auth";
import { updateLastLoginIP } from "@/lib/firebase/firestore";

interface AuthContextType {
  user: FirebaseAuthTypes.User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (user) => {
      setUser(user);
      setLoading(false);

      // Update last login IP when user signs in
      if (user) {
        try {
          await updateLastLoginIP(user.uid);
        } catch {
          // User doc might not exist yet (during signup flow)
        }
      }
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
