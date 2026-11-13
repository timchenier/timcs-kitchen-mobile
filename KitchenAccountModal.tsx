import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import { auth, auditSignIn } from "./kitchenSync";

const PLUM = "#57384F";
const SITE = "https://timcskitchen.com";
type Mode = "sign-in" | "join";

export default function KitchenAccountModal({
  visible, email, signedIn, connected, pending, loading, notice, onClose, onConnected, onSignOut,
}: {
  visible: boolean; email: string; signedIn: boolean; connected: boolean;
  pending: boolean; loading: boolean; notice: string;
  onClose: () => void; onConnected: () => Promise<void>; onSignOut: () => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const busy = working || loading;

  useEffect(() => {
    if (!visible) {
      setPassword("");
      setError("");
    }
  }, [visible]);

  function switchMode(next: Mode) {
    setMode(next);
    setPassword("");
    setError("");
    setMessage("");
  }

  async function submit() {
    const address = loginEmail.trim();
    if (!address.includes("@") || password.length < (mode === "join" ? 8 : 1) || busy) {
      setError(mode === "join" ? "Enter a valid email and password of at least eight characters." : "Enter your email address and password.");
      return;
    }
    setWorking(true);
    setError("");
    setMessage("");
    try {
      if (mode === "join") {
        // Confirmation uses the same already-configured website redirect.
        // No private Studio access is granted by creating an account.
        const result = await auth.auth.signUp({
          email: address, password,
          options: { emailRedirectTo: SITE + "/recipes" },
        });
        if (result.error) throw result.error;
        setPassword("");
        if (result.data.session) {
          await auditSignIn();
          await onConnected();
        } else {
          switchMode("sign-in");
          setMessage("Check your email to confirm your new Kitchen account, then return here to sign in. Favorites syncing requires approval.");
        }
      } else {
        const result = await auth.auth.signInWithPassword({ email: address, password });
        if (result.error) throw result.error;
        setPassword("");
        // Creates a pending membership on a first-ever native sign-in and
        // records the audit event. The server never auto-approves the member.
        await auditSignIn();
        await onConnected();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete account sign-in.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.panel}>
          <ScrollView contentContainerStyle={styles.panelBody} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Text style={styles.title}>Kitchen Account</Text>
              <Pressable onPress={onClose} accessibilityRole="button">
                <Text style={styles.close}>Done ✕</Text>
              </Pressable>
            </View>
            <Text style={styles.description}>One account for your TimC’s Kitchen website and mobile cookbook. Your existing recipes and appearance stay the same.</Text>
            {signedIn ? (
              <>
                <Text style={styles.status}>
                  {connected ? "✓ Favorites connected" : pending ? "◷ Approval pending" : "◷ Account connected — sync needs attention"}
                </Text>
                {!!email && <Text style={styles.secondary}>{email}</Text>}
                {pending && <Text style={styles.secondary}>Your account request awaits approval. You can keep browsing and saving hearts on this phone in the meantime.</Text>}
                <Pressable style={styles.button} onPress={() => void onConnected().catch(() => {})} disabled={busy} accessibilityRole="button">
                  <Text style={styles.buttonText}>{busy ? "Checking…" : "Refresh account & favorites"}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()} disabled={busy} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Sign out</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.modeRow}>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === "sign-in" }}
                    style={[styles.modeButton, mode === "sign-in" && styles.modeSelected]}
                    onPress={() => switchMode("sign-in")} disabled={busy}>
                    <Text style={[styles.modeLabel, mode === "sign-in" && styles.modeLabelSelected]}>Sign in</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === "join" }}
                    style={[styles.modeButton, mode === "join" && styles.modeSelected]}
                    onPress={() => switchMode("join")} disabled={busy}>
                    <Text style={[styles.modeLabel, mode === "join" && styles.modeLabelSelected]}>Create account</Text>
                  </Pressable>
                </View>
                <TextInput style={styles.input} accessibilityLabel="Email address" placeholder="Email address"
                  autoCapitalize="none" autoComplete="email" keyboardType="email-address"
                  value={loginEmail} onChangeText={setLoginEmail} />
                <TextInput style={styles.input} accessibilityLabel="Password"
                  placeholder={mode === "join" ? "Create a password (8+ characters)" : "Password"}
                  secureTextEntry autoComplete={mode === "join" ? "new-password" : "current-password"}
                  value={password} onChangeText={setPassword} />
                <Pressable style={[styles.button, busy && styles.disabled]}
                  disabled={busy || !loginEmail.trim() || !password} accessibilityRole="button"
                  onPress={() => void submit()}>
                  <Text style={styles.buttonText}>
                    {busy ? "Working…" : mode === "join" ? "Create my Kitchen account" : "Sign in to Kitchen"}
                  </Text>
                </Pressable>
                {mode === "sign-in" && (
                  <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(SITE + "/recipes/reset-password")}>
                    <Text style={styles.link}>Forgot your password?</Text>
                  </Pressable>
                )}
                <Text style={styles.secondary}>
                  {mode === "join"
                    ? "New accounts must confirm their email and be approved before favorites sync. Private Studio access is not included."
                    : "Sign in with the same email and password you use on timcskitchen.com."}
                </Text>
              </>
            )}
            {busy && <ActivityIndicator color={PLUM} />}
            {!!error && <Text style={styles.notice}>{error}</Text>}
            {!!message && <Text style={styles.success}>{message}</Text>}
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            <Text style={styles.footnote}>Kitchen members sync favorites. Private cooking history and Recipe Studio remain owner-only.</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(30,20,28,.45)", justifyContent: "center", padding: 20 },
  panel: { backgroundColor: "#FFF9F2", borderRadius: 22, maxHeight: "90%" },
  panelBody: { padding: 20, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: "Georgia", fontSize: 25, color: PLUM },
  close: { color: PLUM, fontWeight: "700", fontSize: 14 },
  description: { color: "#725D6A", fontSize: 14, lineHeight: 21 },
  status: { color: PLUM, fontWeight: "800", fontSize: 15 },
  secondary: { color: "#816F7C", fontSize: 13, lineHeight: 19 },
  modeRow: { flexDirection: "row", borderRadius: 11, borderWidth: 1, borderColor: "#DEC7CE", overflow: "hidden" },
  modeButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 42, backgroundColor: "#FFFCF7" },
  modeSelected: { backgroundColor: PLUM },
  modeLabel: { fontSize: 13, fontWeight: "700", color: PLUM },
  modeLabelSelected: { color: "#FFF" },
  input: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DEC7CE", borderRadius: 12, padding: 14, color: PLUM, fontSize: 16 },
  button: { minHeight: 48, padding: 14, backgroundColor: PLUM, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  disabled: { opacity: 0.5 },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryButtonText: { color: PLUM, fontWeight: "700" },
  link: { color: PLUM, fontSize: 13, textDecorationLine: "underline", marginTop: 4, alignSelf: "center" },
  notice: { color: "#8A3750", fontSize: 13 },
  success: { color: "#37724F", fontSize: 13, lineHeight: 20 },
  footnote: { fontSize: 11, lineHeight: 16, color: "#9B7D8C" },
});
