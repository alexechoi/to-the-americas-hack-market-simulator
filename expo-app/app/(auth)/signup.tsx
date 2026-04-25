import { Link, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { signUpWithEmail } from "@/lib/firebase/auth";
import { getFirebaseErrorMessage } from "@/lib/firebase/errors";
import { createUserDocument } from "@/lib/firebase/firestore";

export default function SignupScreen() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
    acceptedPrivacy: false,
    acceptedMarketing: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updateField(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setError("");

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.password
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!formData.acceptedTerms || !formData.acceptedPrivacy) {
      setError("You must accept the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signUpWithEmail(
        formData.email,
        formData.password,
      );

      // Create user document in Firestore
      try {
        await createUserDocument(userCredential.user.uid, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          acceptedMarketing: formData.acceptedMarketing,
        });
      } catch (firestoreErr) {
        console.error("Failed to create user document:", firestoreErr);
      }

      router.replace("/(app)");
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Get started with your account</Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(v) => updateField("firstName", v)}
                  placeholder="John"
                  placeholderTextColor="#71717a"
                  autoComplete="given-name"
                />
              </View>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(v) => updateField("lastName", v)}
                  placeholder="Doe"
                  placeholderTextColor="#71717a"
                  autoComplete="family-name"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="you@example.com"
                placeholderTextColor="#71717a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone number (optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.phoneNumber}
                onChangeText={(v) => updateField("phoneNumber", v)}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#71717a"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={formData.password}
                onChangeText={(v) => updateField("password", v)}
                placeholder="••••••••"
                placeholderTextColor="#71717a"
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={formData.confirmPassword}
                onChangeText={(v) => updateField("confirmPassword", v)}
                placeholder="••••••••"
                placeholderTextColor="#71717a"
                secureTextEntry
                autoComplete="new-password"
              />
            </View>

            <View style={styles.checkboxGroup}>
              <Pressable
                style={styles.checkboxRow}
                onPress={() =>
                  updateField("acceptedTerms", !formData.acceptedTerms)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    formData.acceptedTerms && styles.checkboxChecked,
                  ]}
                >
                  {formData.acceptedTerms && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the{" "}
                  <Text style={styles.link}>Terms of Service</Text>
                </Text>
              </Pressable>

              <Pressable
                style={styles.checkboxRow}
                onPress={() =>
                  updateField("acceptedPrivacy", !formData.acceptedPrivacy)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    formData.acceptedPrivacy && styles.checkboxChecked,
                  ]}
                >
                  {formData.acceptedPrivacy && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  I agree to the <Text style={styles.link}>Privacy Policy</Text>
                </Text>
              </Pressable>

              <Pressable
                style={styles.checkboxRow}
                onPress={() =>
                  updateField("acceptedMarketing", !formData.acceptedMarketing)
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    formData.acceptedMarketing && styles.checkboxChecked,
                  ]}
                >
                  {formData.acceptedMarketing && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
                <Text style={styles.checkboxLabel}>
                  I want to receive marketing emails (optional)
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#09090b" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#09090b",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 48,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fafafa",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#a1a1aa",
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
  },
  form: {
    gap: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#d4d4d8",
  },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#fafafa",
  },
  checkboxGroup: {
    gap: 12,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#3f3f46",
    backgroundColor: "#18181b",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#fafafa",
    borderColor: "#fafafa",
  },
  checkmark: {
    color: "#09090b",
    fontSize: 12,
    fontWeight: "bold",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: "#a1a1aa",
    lineHeight: 20,
  },
  link: {
    color: "#fafafa",
    textDecorationLine: "underline",
  },
  button: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: "#e4e4e7",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#09090b",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#a1a1aa",
    fontSize: 14,
  },
  footerLink: {
    color: "#fafafa",
    fontSize: 14,
    fontWeight: "500",
  },
});
