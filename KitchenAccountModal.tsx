import React, { useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { auth } from "./kitchenSync";

const PLUM = "#57384F";
const SITE = "https://timcskitchen.com";

export default function KitchenAccountModal({
  visible, email, connected, pending, loading, notice, onClose, onConnected, onSignOut,
}: {
  visible: boolean; email: string; connected: boolean; pending: boolean; loading: boolean; notice: string;
  onClose: () => void; onConnected: () => Promise<void>; onSignOut: () => Promise<void>;
}) {
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const busy = working || loading;

  async function signIn() {
    if (!loginEmail.trim() || !password || busy) return;
    setWorking(true);
    setError("");
    try {
      const result = await auth.auth.signInWithPassword({ email: loginEmail.trim(), password });
      if (result.error) throw result.error;
      setPassword("");
      await onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally { setWorking(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Kitchen Sync</Text>
            <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.close}>Done ✕</Text></Pressable>
          </View>
          <Text style={styles.description}>Your same TimC’s Kitchen account keeps favorites together on your phone and the website.</Text>
          {connected || pending ? (
            <>
              <Text style={styles.status}>{connected ? "✓ Connected" : "◷ Awaiting Kitchen account approval"}</Text>
              {!!email && <Text style={styles.secondary}>{email}</Text>}
              {pending && <Text style={styles.secondary}>You can still browse and save favorites locally until your account is approved.</Text>}
              <Pressable style={styles.button} onPress={() => void onConnected()} disabled={busy}><Text style={styles.buttonText}>{busy ? "Checking…" : "Refresh sync"}</Text></Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void onSignOut()} disabled={busy}><Text style={styles.secondaryButtonText}>Sign out</Text></Pressable>
            </>
          ) : (
            <>
              <TextInput style={styles.input} accessibilityLabel="Email address" placeholder="Email address" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={loginEmail} onChangeText={setLoginEmail} />
              <TextInput style={styles.input} accessibilityLabel="Password" placeholder="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} />
              <Pressable style={styles.button} disabled={busy || !loginEmail.trim() || !password} onPress={() => void signIn()}>
                <Text style={styles.buttonText}>{busy ? "Signing in…" : "Sign in to sync"}</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(SITE + "/recipes/sign-in")}>
                <Text style={styles.link}>Create a Kitchen account on the website ↗</Text>
              </Pressable>
            </>
          )}
          {busy && <ActivityIndicator color={PLUM}/>}
          {!!(error || notice) && <Text style={styles.notice}>{error || notice}</Text>}
          <Text style={styles.footnote}>Kitchen members sync favorites. Private cooking history remains owner-only.</Text>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(30,20,28,.45)", justifyContent: "center", padding: 20 },
  panel: { backgroundColor: "#FFF9F2", borderRadius: 22, padding: 20, gap: 12, maxHeight: "90%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontFamily: "Georgia", fontSize: 27, color: PLUM },
  close: { color: PLUM, fontWeight: "700", fontSize: 14 },
  description: { color: "#725D6A", fontSize: 14, lineHeight: 21 },
  status: { color: PLUM, fontWeight: "800", fontSize: 15 },
  secondary: { color: "#816F7C", fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#DEC7CE", borderRadius: 12, padding: 14, color: PLUM, fontSize: 16 },
  button: { minHeight: 48, padding: 14, backgroundColor: PLUM, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: { padding: 12, alignItems: "center" },
  secondaryButtonText: { color: PLUM, fontWeight: "700" },
  link: { color: PLUM, fontSize: 13, textDecorationLine: "underline", marginTop: 4, alignSelf: "center" },
  notice: { color: "#8A3750", fontSize: 13 },
  footnote: { fontSize: 11, lineHeight: 16, color: "#9B7D8C" },
});
