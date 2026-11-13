import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, FlatList, Image, type ImageStyle, Linking, Pressable, SafeAreaView, ScrollView,
  Share, StatusBar, StyleSheet, Text, TextInput, View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import KitchenAccountModal from "./KitchenAccountModal";
import { auth, account as kitchenAccount, favoriteSlugs, saveFavorite, history as getHistory, logCook, localFavorites, setLocalFavorites, restoreSession, type CookHistory } from "./kitchenSync";

const API = "https://timcskitchen.com/api/recipes/mobile-catalog";
const CATALOG_CACHE_KEY = "timcskitchen:published-recipes:v1";
const SITE = "https://timcskitchen.com";
const PLUM = "#57384F";
const GOLD = "#D6A965";
const CREAM = "#FBF6EC";
const INK = "#503E4B";

type Step = { title: string; duration: string; text: string };
type Recipe = {
  slug: string; title: string; category: string; emoji: string; inspiration: string;
  prepMinutes: number; cookMinutes: number; servings: string;
  ingredients: string[]; steps: Step[]; tips: string[]; photoUrl: string;
};
type Catalog = { ok: boolean; version: number; recipes: Recipe[] };
type Mode = "library" | "details" | "cooking";

function Tap({
  children, onPress, secondary = false, disabled = false, style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, secondary ? styles.buttonSecondary : null, disabled ? styles.disabled : null, style]}
    >
      <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : null]}>{children}</Text>
    </Pressable>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.smallLabel}>{children}</Text>;
}

function roundSeconds(value: string): number {
  const match = value.toLowerCase().replace(/[–—]/g, "-").match(/(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(hours?|hrs?|minutes?|mins?)/);
  if (!match) return 0;
  return Number(match[2] ?? match[1]) * (match[3].startsWith("h") ? 3600 : 60);
}
function formatTime(n: number): string {
  const s = Math.max(0, Math.round(n));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, "0")).join(":");
}

function CookingScreen({ recipe, onBack }: { recipe: Recipe; onBack: () => void }) {
  useKeepAwake();
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [checked, setChecked] = useState<number[]>([]);
  const current = recipe.steps[stepIndex];
  const duration = roundSeconds(current?.duration || "");
  const [seconds, setSeconds] = useState(duration);
  const [running, setRunning] = useState(false);
  const deadline = useRef<number | null>(null);

  const refreshTimer = useCallback(() => {
    if (deadline.current === null) return;
    const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
    setSeconds(left);
    if (left === 0) {
      deadline.current = null;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(refreshTimer, 300);
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") refreshTimer(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [running, refreshTimer]);

  function stepTo(index: number) {
    setStepIndex(Math.min(recipe.steps.length - 1, Math.max(0, index)));
    deadline.current = null;
    setRunning(false);
    setSeconds(roundSeconds(recipe.steps[index]?.duration || ""));
  }
  function startPause() {
    if (running) {
      refreshTimer();
      deadline.current = null;
      setRunning(false);
    } else if (seconds > 0) {
      deadline.current = Date.now() + seconds * 1000;
      setRunning(true);
    }
  }
  function reset() {
    deadline.current = null;
    setRunning(false);
    setSeconds(duration);
  }
  const completionPct = completed.length / Math.max(1, recipe.steps.length) * 100;
  return (
    <View style={styles.flex}>
      <View style={styles.cookHeader}>
        <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.backText}>‹ Back to recipe</Text></Pressable>
        <Text style={styles.cookHeaderTitle}>COOKING MODE</Text>
        <Text style={styles.stepCount}>{stepIndex + 1} / {recipe.steps.length}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.cookBody}>
        <SmallLabel>✦ NOW COOKING</SmallLabel>
        <Text style={styles.cookRecipeTitle}>{recipe.title}</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completionPct}%` }]} /></View>
        <Text style={styles.meta}>{completed.length} of {recipe.steps.length} steps complete</Text>
        <View style={styles.cookCard}>
          <Text style={styles.stepBadge}>STEP {stepIndex + 1}</Text>
          <Text style={styles.stepTitle}>{current.title}</Text>
          <Text style={styles.stepText}>{current.text}</Text>
          <View style={styles.timerPanel}>
            <Text style={styles.meta}>{current.duration}</Text>
            <Text style={styles.timerNumber}>{formatTime(seconds)}</Text>
            <View style={styles.buttonRow}>
              <Tap onPress={startPause} disabled={seconds <= 0} style={styles.fill}>{running ? "Pause" : "Start timer"}</Tap>
              <Tap onPress={reset} secondary>Reset</Tap>
            </View>
          </View>
          <Tap secondary onPress={() => setCompleted((old) => old.includes(stepIndex) ? old.filter((x) => x !== stepIndex) : [...old, stepIndex])}>
            {completed.includes(stepIndex) ? "✓ Step completed" : "✓ Mark step complete"}
          </Tap>
          <View style={styles.buttonRow}>
            <Tap secondary disabled={stepIndex === 0} style={styles.fill} onPress={() => stepTo(stepIndex - 1)}>‹ Previous</Tap>
            <Tap disabled={stepIndex === recipe.steps.length - 1} style={styles.fill} onPress={() => stepTo(stepIndex + 1)}>Next ›</Tap>
          </View>
        </View>
        <View style={styles.ingredientCard}>
          <Text style={styles.sectionHeading}>Ingredients</Text>
          <Text style={styles.meta}>{checked.length} / {recipe.ingredients.length} ready</Text>
          {recipe.ingredients.map((item, index) => (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: checked.includes(index) }} key={index} style={styles.ingredientRow} onPress={() => setChecked((old) => old.includes(index) ? old.filter((x) => x !== index) : [...old, index])}>
              <Text style={styles.checkbox}>{checked.includes(index) ? "☑" : "☐"}</Text>
              <Text style={[styles.ingredientText, checked.includes(index) ? styles.strike : null]}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RecipeDetails({
  recipe, onBack, onCook, favorite, onFavorite, owner, onLogCook, historyEntries,
}: {
  recipe: Recipe; onBack: () => void; onCook: () => void; favorite: boolean;
  onFavorite: () => void; owner: boolean; onLogCook: () => void; historyEntries: CookHistory[];
}) {
  return (
    <View style={styles.flex}>
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.backText}>‹ All recipes</Text></Pressable>
        <View style={styles.buttonRow}>
          <Pressable onPress={onFavorite} accessibilityRole="button" accessibilityLabel={favorite ? "Remove favorite" : "Save favorite"}><Text style={styles.backText}>{favorite ? "♥ Saved" : "♡ Save"}</Text></Pressable>
          <Pressable onPress={() => void Share.share({ message: `${recipe.title} — ${SITE}/recipes/${recipe.slug}` })} accessibilityRole="button"><Text style={styles.backText}>Share ↗</Text></Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.detailBody}>
        <Image source={{ uri: recipe.photoUrl }} style={styles.detailImage as ImageStyle} resizeMode="cover" />
        <SmallLabel>{recipe.category.toUpperCase()}</SmallLabel>
        <Text style={styles.detailTitle}>{recipe.title}</Text>
        <Text style={styles.meta}>{recipe.inspiration} · {recipe.servings}</Text>
        <View style={styles.summaryRow}>
          <View><Text style={styles.summaryNum}>{recipe.prepMinutes}m</Text><Text style={styles.meta}>Prep</Text></View>
          <View><Text style={styles.summaryNum}>{recipe.cookMinutes}m</Text><Text style={styles.meta}>Cook</Text></View>
          <View><Text style={styles.summaryNum}>{recipe.steps.length}</Text><Text style={styles.meta}>Steps</Text></View>
        </View>
        <Tap onPress={onCook} style={styles.wideButton}>🍳  Start cooking</Tap>
        {owner && (
          <View style={styles.ingredientCard}>
            <Text style={styles.sectionHeading}>Cooking journal</Text>
            <Text style={styles.meta}>{historyEntries.length} recorded {historyEntries.length === 1 ? "cook" : "cooks"} for this recipe</Text>
            <Tap secondary onPress={onLogCook}>+ Record cooking today</Tap>
            {historyEntries.slice(0, 3).map((entry) => (
              <Text style={styles.bodyListText} key={entry.id}>✓ {entry.cooked_on}{entry.rating ? ` · ${entry.rating}/5 ★` : ""}{entry.notes ? ` · ${entry.notes}` : ""}</Text>
            ))}
          </View>
        )}
        <View style={styles.buttonRow}>
          <Tap secondary style={styles.fill} onPress={() => void Linking.openURL(`${SITE}/recipes/${recipe.slug}`)}>Journal & edits ↗</Tap>
          <Tap secondary style={styles.fill} onPress={() => void Share.share({ message: recipe.ingredients.map((item) => `☐ ${item}`).join("\n") })}>Share grocery list</Tap>
        </View>
        <View style={styles.ingredientCard}>
          <Text style={styles.sectionHeading}>Ingredients</Text>
          {recipe.ingredients.map((item, i) => <Text style={styles.bodyListText} key={i}>◦  {item}</Text>)}
        </View>
        <View style={styles.ingredientCard}>
          <Text style={styles.sectionHeading}>The steps</Text>
          {recipe.steps.map((step, i) => (
            <View style={styles.previewStep} key={i}>
              <Text style={styles.previewNumber}>{i + 1}</Text>
              <View style={styles.fill}>
                <Text style={styles.previewTitle}>{step.title} · {step.duration}</Text>
                <Text style={styles.bodyListText}>{step.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hasCatalog = useRef(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [mode, setMode] = useState<Mode>("library");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [syncModal, setSyncModal] = useState(false);
  const [syncSignedIn, setSyncSignedIn] = useState(false);
  const [syncConnected, setSyncConnected] = useState(false);
  const [syncPending, setSyncPending] = useState(false);
  const [syncOwner, setSyncOwner] = useState(false);
  const [syncEmail, setSyncEmail] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState("");
  const [cookEntries, setCookEntries] = useState<CookHistory[]>([]);
  const favoriteInFlight = useRef(new Set<string>());

  const syncKitchen = useCallback(async () => {
    setSyncBusy(true);
    setSyncNotice("");
    try {
      const profile = await kitchenAccount();
      setSyncSignedIn(true);
      setSyncConnected(profile.approved);
      setSyncPending(profile.pending);
      setSyncOwner(profile.owner);
      setSyncEmail(profile.email);
      if (profile.approved) setFavorites(await favoriteSlugs());
      else setFavorites(await localFavorites());
      setCookEntries(profile.owner ? await getHistory() : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Kitchen Sync could not connect.";
      setSyncNotice(message);
      throw e;
    } finally { setSyncBusy(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void localFavorites().then((slugs) => { if (active) setFavorites(slugs); });
    void restoreSession().then((session) => {
      if (active && session) void syncKitchen().catch(() => {});
    }).catch(() => {});
    return () => { active = false; };
  }, [syncKitchen]);

  async function signOutKitchen() {
    setSyncBusy(true);
    try {
      const result = await auth.auth.signOut();
      if (result.error) throw result.error;
      setSyncSignedIn(false);
      setSyncConnected(false);
      setSyncPending(false);
      setSyncOwner(false);
      setSyncEmail("");
      setCookEntries([]);
      setFavorites(await localFavorites());
      setSyncNotice("");
      setSyncModal(false);
    } catch (e) {
      setSyncNotice(e instanceof Error ? e.message : "Could not sign out.");
    } finally { setSyncBusy(false); }
  }
  async function toggleFavorite(slug: string) {
    if (favoriteInFlight.current.has(slug)) return;
    favoriteInFlight.current.add(slug);
    const before = favorites;
    const favorite = !before.includes(slug);
    const next = favorite ? [...before, slug] : before.filter((item) => item !== slug);
    setFavorites(next);
    try {
      if (syncConnected) await saveFavorite(slug, favorite);
      else await setLocalFavorites(next);
    } catch {
      setFavorites(before);
      Alert.alert("Favorite not saved", "The Kitchen couldn't save that change. Please try again.");
    } finally { favoriteInFlight.current.delete(slug); }
  }
  function confirmLogCook(recipe: Recipe) {
    Alert.alert("Record today's cook?", `Save a cooking journal entry for ${recipe.title}? You can add notes and photos later on the website.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Save entry", onPress: () => {
        void (async () => {
          try {
            await logCook(recipe.slug);
            setCookEntries(await getHistory());
            Alert.alert("Saved to Kitchen", "Your cooking session is now recorded in your Kitchen journal.");
          } catch (e) {
            Alert.alert("Could not save", e instanceof Error ? e.message : "Try again when connected.");
          }
        })();
      } },
    ]);
  }

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    // Display previously downloaded public recipes while the network refreshes.
    // No private recipes, credentials, or account data are stored on-device.
    if (!refresh) {
      try {
        const saved = await AsyncStorage.getItem(CATALOG_CACHE_KEY);
        const cached = saved ? (JSON.parse(saved) as Recipe[]) : null;
        if (Array.isArray(cached) && cached.length > 0) {
          hasCatalog.current = true;
          setRecipes(cached);
          setLoading(false);
        }
      } catch {
        // A missing or damaged cache must never stop the live request.
      }
    }

    try {
      const response = await fetch(API);
      if (!response.ok) throw new Error("Kitchen catalog unavailable");
      const data = (await response.json()) as Catalog;
      if (!data.ok || !Array.isArray(data.recipes)) throw new Error("Invalid catalog");
      hasCatalog.current = true;
      setRecipes(data.recipes);
      try {
        await AsyncStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(data.recipes));
      } catch {
        // The online cookbook remains usable when device storage is unavailable.
      }
    } catch {
      if (!hasCatalog.current) {
        setError("Can't connect to the Kitchen right now. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => ["All", ...new Set(recipes.map((r) => r.category))], [recipes]);
  const matching = useMemo(() => recipes.filter((r) =>
    (category === "All" || r.category === category) &&
    (!favoritesOnly || favorites.includes(r.slug)) &&
    `${r.title} ${r.category}`.toLowerCase().includes(query.trim().toLowerCase())
  ), [recipes, category, query, favorites, favoritesOnly]);

  function openRecipe(recipe: Recipe) { setSelected(recipe); setMode("details"); }
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {mode === "cooking" && selected
        ? <CookingScreen key={selected.slug} recipe={selected} onBack={() => setMode("details")} />
        : mode === "details" && selected
          ? <RecipeDetails recipe={selected} onBack={() => setMode("library")} onCook={() => setMode("cooking")}
              favorite={favorites.includes(selected.slug)} onFavorite={() => void toggleFavorite(selected.slug)}
              owner={syncOwner} onLogCook={() => confirmLogCook(selected)}
              historyEntries={cookEntries.filter((entry) => entry.recipe_slug === selected.slug)} />
          : (
            <View style={styles.flex}>
              <View style={styles.brandBar}>
                <View style={styles.brandSeal}><Text style={styles.brandSealText}>✦</Text></View>
                <View><Text style={styles.brandTitle}>TimC&apos;s <Text style={styles.brandAccent}>Kitchen</Text></Text><Text style={styles.brandTag}>RECIPES WORTH MAKING</Text></View>
              </View>
              <FlatList
                data={matching}
                refreshing={refreshing}
                onRefresh={() => void load(true)}
                keyExtractor={(item) => item.slug}
                contentContainerStyle={styles.listBody}
                ListHeaderComponent={
                  <>
                    <View style={styles.hero}>
                      <SmallLabel>✦ YOUR PERSONAL COOKBOOK</SmallLabel>
                      <Text style={styles.heroTitle}>Every good recipe{"\n"}has a story.</Text>
                      <Text style={styles.heroCopy}>All your delicious dishes, ready when you are.</Text>
                    </View>
                    <View style={styles.statsRow}>
                      <Text style={styles.statsText}>{recipes.length} curated recipes</Text>
                      <Pressable onPress={() => setSyncModal(true)} accessibilityRole="button">
                        <Text style={styles.statsText}>{syncConnected ? "✓ Kitchen Sync" : syncPending ? "◷ Approval pending" : syncSignedIn ? "Reconnect Kitchen ↗" : "Sign in to sync ↗"}</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.sectionHeading}>Find something delicious</Text>
                    <TextInput placeholder="Search recipes…" placeholderTextColor="#A18F99" value={query} onChangeText={setQuery} autoCorrect={false} style={styles.search} />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                      <Pressable accessibilityRole="button" style={[styles.categoryPill, favoritesOnly && styles.categorySelected]} onPress={() => setFavoritesOnly((old) => !old)}>
                        <Text style={[styles.categoryText, favoritesOnly && styles.categoryTextSelected]}>♥ Favorites ({favorites.length})</Text>
                      </Pressable>
                      {categories.map((name) => <Pressable accessibilityRole="button" key={name} style={[styles.categoryPill, category === name && styles.categorySelected]} onPress={() => setCategory(name)}><Text style={[styles.categoryText, category === name && styles.categoryTextSelected]}>{name}</Text></Pressable>)}
                    </ScrollView>
                    {loading && <ActivityIndicator size="large" color={PLUM} style={styles.loading} />}
                    {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text><Tap onPress={() => void load()}>Retry</Tap></View>}
                  </>
                }
                renderItem={({ item }) => <Pressable onPress={() => openRecipe(item)} style={styles.recipeCard}>
                  <Image source={{ uri: item.photoUrl }} style={styles.cardImage as ImageStyle} />
                  <View style={styles.cardCopy}><Text style={styles.cardCategory}>{item.category}</Text><Text numberOfLines={2} style={styles.cardTitle}>{item.title}</Text><Text style={styles.meta}>{item.prepMinutes + item.cookMinutes} min · {item.steps.length} timed steps</Text></View>
                  <Pressable accessibilityRole="button" accessibilityLabel={favorites.includes(item.slug) ? "Remove favorite" : "Save favorite"} onPress={(event) => { event.stopPropagation(); void toggleFavorite(item.slug); }}>
                    <Text style={styles.cardChevron}>{favorites.includes(item.slug) ? "♥" : "♡"}</Text>
                  </Pressable>
                </Pressable>}
                ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>No recipes match those filters.</Text> : undefined}
                ListFooterComponent={<View style={styles.footer}><Tap secondary onPress={() => void Linking.openURL(`${SITE}/recipes/studio`)}>Open Recipe Studio ↗</Tap><Text style={styles.footerCopy}>Recipes worth making. Memories worth keeping. 💜</Text></View>}
              />
            </View>
          )}
      <KitchenAccountModal
        visible={syncModal} email={syncEmail} connected={syncConnected} pending={syncPending}
        loading={syncBusy} notice={syncNotice} onClose={() => setSyncModal(false)}
        onConnected={syncKitchen} onSignOut={signOutKitchen}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: CREAM },
  flex: { flex: 1 },
  brandBar: { minHeight: 78, flexDirection: "row", alignItems: "center", paddingHorizontal: 19, gap: 12, backgroundColor: "#FFF9F2", borderBottomWidth: 1, borderColor: "#EADBD6" },
  brandSeal: { width: 48, height: 48, borderRadius: 13, backgroundColor: PLUM, borderWidth: 2, borderColor: GOLD, justifyContent: "center", alignItems: "center" },
  brandSealText: { color: "#F1C980", fontSize: 27 },
  brandTitle: { fontFamily: "Georgia", fontWeight: "700", fontSize: 26, color: PLUM },
  brandAccent: { fontWeight: "400", fontStyle: "italic", color: "#AA7F43" },
  brandTag: { color: "#A38B92", fontSize: 9, letterSpacing: 1.6, marginTop: 3, fontWeight: "800" },
  listBody: { padding: 16, paddingBottom: 40, gap: 12 },
  hero: { borderRadius: 22, padding: 24, paddingTop: 29, backgroundColor: PLUM, minHeight: 184, justifyContent: "center" },
  heroTitle: { fontFamily: "Georgia", fontSize: 31, lineHeight: 38, color: "#FFF7EF", marginTop: 11, marginBottom: 10 },
  heroCopy: { color: "#EADAE5", fontSize: 13, lineHeight: 20 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginVertical: 9 },
  statsText: { color: "#846F7B", fontSize: 12, fontWeight: "700" },
  sectionHeading: { fontFamily: "Georgia", fontSize: 27, color: PLUM, marginBottom: 13 },
  smallLabel: { fontSize: 10, color: GOLD, fontWeight: "900", letterSpacing: 1.6 },
  search: { borderWidth: 1.5, borderColor: "#E0CDD0", borderRadius: 12, backgroundColor: "#FFF", color: INK, fontSize: 16, paddingHorizontal: 15, paddingVertical: 13 },
  categoryRow: { paddingVertical: 14, gap: 8 },
  categoryPill: { borderRadius: 99, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: "#E4CECD", backgroundColor: "#FFFCF7" },
  categorySelected: { backgroundColor: PLUM, borderColor: PLUM },
  categoryText: { fontSize: 12, color: PLUM, fontWeight: "700" },
  categoryTextSelected: { color: "#FFF" },
  recipeCard: { flexDirection: "row", alignItems: "center", gap: 13, padding: 10, borderRadius: 16, backgroundColor: "#FFFDF8", borderColor: "#E9DAD3", borderWidth: 1 },
  cardImage: { height: 96, width: 105, borderRadius: 11, backgroundColor: "#EEE1D7" },
  cardCopy: { flex: 1, gap: 5 },
  cardCategory: { fontSize: 10, color: "#AD7C57", fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 },
  cardTitle: { fontFamily: "Georgia", fontSize: 20, lineHeight: 23, color: PLUM },
  cardChevron: { fontSize: 29, color: "#9A7687" },
  meta: { color: "#927B85", fontSize: 12, lineHeight: 19 },
  loading: { padding: 25 },
  errorCard: { padding: 14, borderRadius: 12, backgroundColor: "#FAEBE9", gap: 10 },
  errorText: { color: "#8A3750", fontSize: 14 },
  empty: { color: "#8F7985", textAlign: "center", marginVertical: 20, fontSize: 14 },
  footer: { marginTop: 22, gap: 14, alignItems: "center" },
  footerCopy: { fontSize: 12, color: "#9B7D8C", textAlign: "center" },
  detailHeader: { paddingHorizontal: 20, paddingVertical: 17, flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FFFAF5", borderBottomWidth: 1, borderColor: "#E9D6D0" },
  backText: { color: PLUM, fontSize: 15, fontWeight: "700" },
  detailBody: { padding: 20, paddingBottom: 55, gap: 15 },
  detailImage: { height: 225, borderRadius: 19, backgroundColor: "#E8D4C7" },
  detailTitle: { fontFamily: "Georgia", fontSize: 37, lineHeight: 42, color: PLUM },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "#E4D2CA", backgroundColor: "#FFF8F2", borderRadius: 13, padding: 18 },
  summaryNum: { fontSize: 23, fontWeight: "800", color: PLUM },
  button: { backgroundColor: PLUM, minHeight: 48, borderRadius: 11, paddingVertical: 13, paddingHorizontal: 14, justifyContent: "center", alignItems: "center", marginTop: 8 },
  buttonSecondary: { backgroundColor: "#FFF8F2", borderWidth: 1.3, borderColor: "#D8BDBF" },
  buttonText: { fontSize: 14, fontWeight: "800", color: "#FFF" },
  buttonTextSecondary: { color: PLUM },
  disabled: { opacity: 0.35 },
  wideButton: { minHeight: 59 },
  fill: { flex: 1 },
  buttonRow: { flexDirection: "row", gap: 9, alignItems: "stretch" },
  ingredientCard: { padding: 18, borderRadius: 15, backgroundColor: "#FFFDF8", borderWidth: 1, borderColor: "#ECDCD5", marginTop: 7 },
  bodyListText: { color: INK, fontSize: 15, lineHeight: 24, marginBottom: 8 },
  previewStep: { flexDirection: "row", gap: 12, marginBottom: 18 },
  previewNumber: { width: 29, height: 29, borderRadius: 15, textAlign: "center", textAlignVertical: "center", overflow: "hidden", backgroundColor: PLUM, color: "#FFF", fontWeight: "800" },
  previewTitle: { fontSize: 16, color: PLUM, fontWeight: "800", marginBottom: 5 },
  cookHeader: { paddingHorizontal: 17, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: "#E8D4D2", backgroundColor: "#FFF8F1" },
  cookHeaderTitle: { fontSize: 10, letterSpacing: 1, fontWeight: "900", color: "#A87564" },
  stepCount: { fontWeight: "800", color: PLUM, fontSize: 13 },
  cookBody: { padding: 18, paddingBottom: 50, gap: 12 },
  cookRecipeTitle: { fontFamily: "Georgia", fontSize: 31, lineHeight: 37, color: PLUM },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: "#E9D7D7", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#A77091" },
  cookCard: { borderRadius: 19, borderWidth: 1, borderColor: "#E6D5CD", backgroundColor: "#FFFCF8", padding: 18, gap: 12 },
  stepBadge: { fontWeight: "900", color: "#AA7963", letterSpacing: 1.5, fontSize: 11 },
  stepTitle: { fontFamily: "Georgia", fontSize: 31, lineHeight: 36, color: PLUM },
  stepText: { color: INK, fontSize: 19, lineHeight: 31 },
  timerPanel: { borderRadius: 13, backgroundColor: "#F8EBE5", padding: 17, gap: 6 },
  timerNumber: { fontFamily: "Georgia", fontSize: 43, color: PLUM, fontVariant: ["tabular-nums"], letterSpacing: 2 },
  ingredientRow: { flexDirection: "row", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderColor: "#F2E7DF" },
  checkbox: { color: "#8A5A74", fontSize: 23, width: 29 },
  ingredientText: { flex: 1, fontSize: 17, lineHeight: 25, color: INK },
  strike: { textDecorationLine: "line-through", opacity: 0.5 },
});
