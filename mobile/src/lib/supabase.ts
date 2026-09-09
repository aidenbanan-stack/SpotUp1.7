import "react-native-url-polyfill/auto";
import { PROJECT_URL, PROJECT_PUBLISHABLE_KEY } from "./project";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || PROJECT_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || PROJECT_PUBLISHABLE_KEY;
export const configured = !!url && !!key;
// Chunk native sessions to fit SecureStore's per-value limit.
const secureStorage = {
  async getItem(key: string) {
    const count = await SecureStore.getItemAsync(key + ".count");
    if (!count) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) =>
        SecureStore.getItemAsync(key + "." + i),
      ),
    );
    return parts.some((p) => p === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const parts = value.match(/[\s\S]{1,1500}/g) ?? [];
    for (let i = 0; i < parts.length; i++)
      await SecureStore.setItemAsync(key + "." + i, parts[i]);
    await SecureStore.setItemAsync(key + ".count", String(parts.length));
  },
  async removeItem(key: string) {
    const count = Number((await SecureStore.getItemAsync(key + ".count")) ?? 0);
    await SecureStore.deleteItemAsync(key + ".count");
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(key + "." + i);
  },
};
export const supabase = createClient(
  url || "https://unconfigured.supabase.co",
  key || "unconfigured",
  {
    auth: {
      storage: Platform.OS === "web" ? AsyncStorage : secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === "web",
    },
  },
);
if (Platform.OS !== "web")
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
export async function rpc<T = void>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (!configured) throw Error("Connect your Supabase project first.");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Error(error.message);
  return data as T;
}
export async function rows<T>(
  table: string,
  select = "*",
  filters: Record<string, unknown> = {},
  order = "created_at",
  limit = 100,
): Promise<T[]> {
  let q = supabase.from(table).select(select);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q
    .order(order, { ascending: false })
    .limit(limit);
  if (error) throw Error(error.message);
  return (data ?? []) as unknown as T[];
}
export async function one<T>(
  table: string,
  id: string,
  select = "*",
): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq("id", id)
    .single();
  if (error) throw Error(error.message);
  return data as T;
}
export async function track(event: string, entity?: string) {
  try {
    await rpc("track_event", { event_name: event, entity: entity ?? null });
  } catch {
    /* Analytics must never block participation. */
  }
}
