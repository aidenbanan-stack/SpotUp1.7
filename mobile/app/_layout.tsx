import React, { useEffect } from "react";
import { Stack, router, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { SessionProvider, useSession, queryClient } from "../src/lib/session";
import { C, Loading, Screen } from "../src/components/ui";
function Navigation() {
  const { session, loading } = useSession();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  useEffect(() => {
    if (loading) return;
    const auth = segments[0] === "auth";
    if (!session && !auth)
      router.replace({ pathname: "/auth", params: { next: pathname } });
  }, [session, loading, segments, pathname]);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const path = response.notification.request.content.data?.path;
        if (
          typeof path === "string" &&
          /^\/(game|tournament|squad|player)\/[0-9a-f-]+$/i.test(path)
        )
          router.push(path as never);
      },
    );
    return () => sub.remove();
  }, []);
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.ink,
          headerTitleStyle: { fontSize: 16 },
          headerShadowVisible: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: C.bg },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="create"
          options={{ title: "Create game", presentation: "modal" }}
        />
        <Stack.Screen
          name="upload"
          options={{ title: "Share your game", presentation: "modal" }}
        />
        <Stack.Screen
          name="feed"
          options={{
            title: "SpotUp Moments",
            headerStyle: { backgroundColor: C.dark },
            headerTintColor: "white",
          }}
        />
        <Stack.Screen name="game/[id]" options={{ title: "Game day" }} />
        <Stack.Screen
          name="player/[id]"
          options={{ title: "Player profile" }}
        />
        <Stack.Screen name="clip/[id]" options={{ title: "Sports video" }} />
        <Stack.Screen name="squad/[id]" options={{ title: "Squad" }} />
        <Stack.Screen
          name="tournament/[id]"
          options={{ title: "Tournament" }}
        />
      </Stack>
    </>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Navigation />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
