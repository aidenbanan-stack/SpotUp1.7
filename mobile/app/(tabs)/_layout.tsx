import React from "react";
import { Tabs } from "expo-router";
import { C, Icon } from "../../src/components/ui";
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopColor: C.line,
          height: 82,
          paddingTop: 8,
          paddingBottom: 18,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      {[
        { name: "index", title: "Home", icon: "home-outline" },
        { name: "map", title: "Map", icon: "map-outline" },
        { name: "feed", title: "Moments", icon: "play-circle-outline" },
        { name: "play", title: "Play", icon: "trophy-outline" },
        { name: "profile", title: "Profile", icon: "person-outline" },
      ].map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <Icon
                name={focused ? t.icon.replace("-outline", "") : t.icon}
                color={color}
                size={focused ? 25 : 23}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="my-games" options={{ href: null }} />
    </Tabs>
  );
}
