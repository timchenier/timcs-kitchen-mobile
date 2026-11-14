import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { createClient, type Session } from "@supabase/supabase-js";

const config = Constants.expoConfig?.extra || {};
const projectUrl = String(config.supabaseUrl || "");
const publishableKey = String(config.supabasePublishableKey || "");
const API = "https://timcskitchen.com/api/recipes/mobile-sync";
export const LOCAL_FAVORITES_KEY = "timcskitchen:mobile:favorites:v1";

// Keep long sessions in the OS credential vault. Split values for platform
// limits; never put auth tokens into AsyncStorage or the public recipe cache.
const MAX_PART = 1500;
function safeKey(key: string) { return "tck_" + key.replace(/[^a-zA-Z0-9._-]/g, "_"); }
const secureStorage = {
  async getItem(key: string) {
    const k = safeKey(key);
    const parts = Number(await SecureStore.getItemAsync(k + ".count") || "0");
    if (!Number.isInteger(parts) || parts < 1 || parts > 30) return null;
    const chunks = await Promise.all(Array.from({ length: parts }, (_, i) => SecureStore.getItemAsync(k + "." + i)));
    return chunks.every((chunk) => chunk !== null) ? chunks.join("") : null;
  },
  async setItem(key: string, value: string) {
    const k = safeKey(key);
    const old = Number(await SecureStore.getItemAsync(k + ".count") || "0");
    const chunks = value.match(new RegExp(`.{1,${MAX_PART}}`, "gs")) || [];
    if (chunks.length > 30) throw new Error("Session exceeds secure storage capacity.");
    // Count is published last, so interrupted writes are not treated as complete.
    for (let i = 0; i < chunks.length; i++) await SecureStore.setItemAsync(k + "." + i, chunks[i]);
    await SecureStore.setItemAsync(k + ".count", String(chunks.length));
    for (let i = chunks.length; i < Math.min(old, 30); i++) await SecureStore.deleteItemAsync(k + "." + i);
  },
  async removeItem(key: string) {
    const k = safeKey(key);
    const old = Number(await SecureStore.getItemAsync(k + ".count") || "0");
    await SecureStore.deleteItemAsync(k + ".count");
    for (let i = 0; i < Math.min(old, 30); i++) await SecureStore.deleteItemAsync(k + "." + i);
  },
};

export const auth = createClient(projectUrl, publishableKey, {
  auth: {
    storage: secureStorage,
    storageKey: "kitchen_native_session_v1",
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type KitchenAccount = { ok: boolean; signedIn: boolean; email: string; approved: boolean; owner: boolean; pending: boolean };
export type CookHistory = { id: string; recipe_slug: string; cooked_on: string; rating: number | null; notes: string; outcome: string };
type Json = Record<string, unknown>;

async function call(resource: string, body?: Json): Promise<Json> {
  const { data, error } = await auth.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Sign in to sync with your Kitchen account.");
  const response = await fetch(API + (body ? "" : "?resource=" + encodeURIComponent(resource)), {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + data.session.access_token,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as Json;
  if (!response.ok || payload.ok !== true) throw new Error(typeof payload.error === "string" ? payload.error : "Kitchen Sync is unavailable.");
  return payload;
}
export async function account(): Promise<KitchenAccount> {
  const response = await call("account");
  return response as KitchenAccount;
}
export async function favoriteSlugs(): Promise<string[]> {
  const response = await call("favorites");
  return Array.isArray(response.slugs) ? response.slugs.filter((v): v is string => typeof v === "string") : [];
}
export async function saveFavorite(slug: string, favorite: boolean): Promise<void> {
  await call("favorites", { action: "favorite", slug, favorite });
}
export async function auditSignIn(): Promise<void> {
  await call("account", { action: "sign-in" });
}
export async function history(): Promise<CookHistory[]> {
  const response = await call("history");
  return Array.isArray(response.entries) ? response.entries as CookHistory[] : [];
}
export async function logCook(slug: string, notes = "", rating: number | null = null, clientKey = "native_" + Date.now() + "_" + Math.random().toString(36).slice(2, 11)): Promise<CookHistory> {
  const day = new Date();
  const cookedOn = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, "0"), String(day.getDate()).padStart(2, "0")].join("-");
  const response = await call("history", { action: "log-cook", recipeSlug: slug, cookedOn, clientKey, outcome: "made", notes, rating });
  return response.entry as CookHistory;
}
export async function localFavorites(): Promise<string[]> {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(LOCAL_FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch { return []; }
}
export async function setLocalFavorites(slugs: string[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_FAVORITES_KEY, JSON.stringify([...new Set(slugs)]));
}
export async function restoreSession(): Promise<Session | null> {
  const { data, error } = await auth.auth.getSession();
  if (error) throw error;
  return data.session;
}
