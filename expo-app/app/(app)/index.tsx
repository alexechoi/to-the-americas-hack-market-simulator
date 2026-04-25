import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/components/AuthProvider";
import { apiGet } from "@/lib/api";
import { signOut } from "@/lib/firebase/auth";

interface ApiTestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [apiTestResult, setApiTestResult] = useState<ApiTestResult | null>(
    null,
  );
  const [apiTestLoading, setApiTestLoading] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  async function handleTestProtectedRoute() {
    setApiTestLoading(true);
    setApiTestResult(null);

    try {
      const data = await apiGet("/me");
      setApiTestResult({ success: true, data });
    } catch (err) {
      setApiTestResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setApiTestLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>
            You&apos;re signed in as {user?.email || "Unknown"}
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Dashboard</Text>
            <Text style={styles.cardText}>
              This is your authenticated home screen. You can customize this to
              show your app&apos;s main content.
            </Text>
          </View>

          {/* API Test Section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Backend API Test</Text>
            <Text style={styles.cardText}>
              Test the protected /me endpoint with your Firebase token
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.testButton,
                pressed && styles.testButtonPressed,
                apiTestLoading && styles.testButtonDisabled,
              ]}
              onPress={handleTestProtectedRoute}
              disabled={apiTestLoading}
            >
              {apiTestLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.testButtonText}>Test Protected Route</Text>
              )}
            </Pressable>

            {apiTestResult && (
              <View
                style={[
                  styles.resultContainer,
                  apiTestResult.success
                    ? styles.resultSuccess
                    : styles.resultError,
                ]}
              >
                <Text
                  style={[
                    styles.resultTitle,
                    apiTestResult.success
                      ? styles.resultTitleSuccess
                      : styles.resultTitleError,
                  ]}
                >
                  {apiTestResult.success ? "✓ Success" : "✗ Failed"}
                </Text>
                <Text
                  style={[
                    styles.resultText,
                    apiTestResult.success
                      ? styles.resultTextSuccess
                      : styles.resultTextError,
                  ]}
                >
                  {JSON.stringify(
                    apiTestResult.data || apiTestResult.error,
                    null,
                    2,
                  )}
                </Text>
              </View>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#fafafa",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#a1a1aa",
    marginBottom: 32,
  },
  card: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fafafa",
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: "#a1a1aa",
    lineHeight: 22,
  },
  testButton: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 16,
  },
  testButtonPressed: {
    backgroundColor: "#4f46e5",
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  resultContainer: {
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  resultSuccess: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  resultError: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  resultTitleSuccess: {
    color: "#4ade80",
  },
  resultTitleError: {
    color: "#f87171",
  },
  resultText: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  resultTextSuccess: {
    color: "#86efac",
  },
  resultTextError: {
    color: "#fca5a5",
  },
  signOutButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signOutButtonPressed: {
    backgroundColor: "#27272a",
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#fafafa",
  },
});
