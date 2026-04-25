"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/components/AuthProvider";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";
import { usePushNotifications } from "@/app/components/PushNotificationProvider";
import { apiGet, apiPost } from "@/app/lib/api";
import { signOut } from "@/app/lib/firebase/auth";
import { getUserDocument } from "@/app/lib/firebase/firestore";

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
}

interface ApiTestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    isSupported: notificationsSupported,
    permission: notificationPermission,
    isEnabled: notificationsEnabled,
    enableNotifications,
  } = usePushNotifications();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendApiResult, setBackendApiResult] =
    useState<ApiTestResult | null>(null);
  const [backendApiLoading, setBackendApiLoading] = useState(false);
  const [nextApiResult, setNextApiResult] = useState<ApiTestResult | null>(
    null,
  );
  const [nextApiLoading, setNextApiLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [testNotificationResult, setTestNotificationResult] = useState<
    string | null
  >(null);

  useEffect(() => {
    async function fetchUserData() {
      if (user) {
        try {
          const data = await getUserDocument(user.uid);
          if (data) {
            setUserData(data as UserData);
          }
        } catch {
          // User doc might not exist
        }
      }
      setLoading(false);
    }

    fetchUserData();
  }, [user]);

  async function handleTestBackendApi() {
    setBackendApiLoading(true);
    setBackendApiResult(null);

    try {
      const data = await apiGet("/me");
      setBackendApiResult({ success: true, data });
    } catch (err) {
      setBackendApiResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBackendApiLoading(false);
    }
  }

  async function handleTestNextApi() {
    setNextApiLoading(true);
    setNextApiResult(null);

    try {
      // Call the Next.js API route directly (same origin)
      const token = await import("@/app/lib/firebase/config").then((m) =>
        m.auth.currentUser?.getIdToken(),
      );
      const response = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }
      setNextApiResult({ success: true, data });
    } catch (err) {
      setNextApiResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setNextApiLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/auth/login");
    } catch {
      // Handle error silently
    }
  }

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ""}`.trim()
    : user?.displayName || user?.email || "User";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Dashboard
          </h1>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
          {loading ? (
            <div className="text-zinc-500">Loading...</div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Welcome, {displayName}
              </h2>
              <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                You are signed in as {user?.email}
              </p>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Account Status
                  </div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    Active
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Email Verified
                  </div>
                  <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {user?.emailVerified ? "Yes" : "No"}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                  <div className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    User ID
                  </div>
                  <div className="mt-1 truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                    {user?.uid}
                  </div>
                </div>
              </div>

              {/* Push Notifications Section */}
              <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Push Notifications
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Enable browser notifications to receive updates
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {!notificationsSupported ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Push notifications are not supported in this browser
                    </p>
                  ) : notificationsEnabled ? (
                    <>
                      <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Notifications Enabled
                      </span>
                      <button
                        onClick={async () => {
                          setNotificationLoading(true);
                          setTestNotificationResult(null);
                          try {
                            const result = await apiPost("/notifications/test");
                            setTestNotificationResult(
                              `✓ ${(result as { message?: string }).message || "Test notification sent!"}`,
                            );
                          } catch (err) {
                            setTestNotificationResult(
                              `✗ ${err instanceof Error ? err.message : "Failed to send"}`,
                            );
                          } finally {
                            setNotificationLoading(false);
                          }
                        }}
                        disabled={notificationLoading}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {notificationLoading
                          ? "Sending..."
                          : "Send Test Notification"}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Permission: {notificationPermission || "unknown"}
                      </span>
                      <button
                        onClick={async () => {
                          setNotificationLoading(true);
                          const success = await enableNotifications();
                          setNotificationLoading(false);
                          if (!success) {
                            setTestNotificationResult(
                              "✗ Failed to enable notifications. Check console for details.",
                            );
                          }
                        }}
                        disabled={notificationLoading}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {notificationLoading
                          ? "Enabling..."
                          : "Enable Notifications"}
                      </button>
                    </>
                  )}
                </div>

                {testNotificationResult && (
                  <div
                    className={`mt-4 rounded-lg p-3 text-sm ${
                      testNotificationResult.startsWith("✓")
                        ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200"
                        : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200"
                    }`}
                  >
                    {testNotificationResult}
                  </div>
                )}
              </div>

              {/* API Test Section */}
              <div className="mt-8 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  API Authentication Tests
                </h3>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Test protected endpoints with your Firebase token
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {/* Python Backend Test */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Python Backend
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      FastAPI /me endpoint
                    </p>
                    <button
                      onClick={handleTestBackendApi}
                      disabled={backendApiLoading}
                      className="mt-3 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {backendApiLoading ? "Testing..." : "Test Backend API"}
                    </button>

                    {backendApiResult && (
                      <div
                        className={`mt-3 rounded-lg p-3 ${
                          backendApiResult.success
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-red-50 dark:bg-red-900/20"
                        }`}
                      >
                        <div
                          className={`text-xs font-medium ${
                            backendApiResult.success
                              ? "text-green-800 dark:text-green-200"
                              : "text-red-800 dark:text-red-200"
                          }`}
                        >
                          {backendApiResult.success ? "✓ Success" : "✗ Failed"}
                        </div>
                        <pre
                          className={`mt-1 overflow-auto text-xs ${
                            backendApiResult.success
                              ? "text-green-700 dark:text-green-300"
                              : "text-red-700 dark:text-red-300"
                          }`}
                        >
                          {JSON.stringify(
                            backendApiResult.data || backendApiResult.error,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Next.js API Test */}
                  <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
                    <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Next.js API Route
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      /api/me endpoint
                    </p>
                    <button
                      onClick={handleTestNextApi}
                      disabled={nextApiLoading}
                      className="mt-3 w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                    >
                      {nextApiLoading ? "Testing..." : "Test Next.js API"}
                    </button>

                    {nextApiResult && (
                      <div
                        className={`mt-3 rounded-lg p-3 ${
                          nextApiResult.success
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-red-50 dark:bg-red-900/20"
                        }`}
                      >
                        <div
                          className={`text-xs font-medium ${
                            nextApiResult.success
                              ? "text-green-800 dark:text-green-200"
                              : "text-red-800 dark:text-red-200"
                          }`}
                        >
                          {nextApiResult.success ? "✓ Success" : "✗ Failed"}
                        </div>
                        <pre
                          className={`mt-1 overflow-auto text-xs ${
                            nextApiResult.success
                              ? "text-green-700 dark:text-green-300"
                              : "text-red-700 dark:text-red-300"
                          }`}
                        >
                          {JSON.stringify(
                            nextApiResult.data || nextApiResult.error,
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
