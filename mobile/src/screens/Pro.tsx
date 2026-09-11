import React from "react";
import { router } from "expo-router";
import {
  Button,
  Card,
  C,
  ErrorBox,
  Header,
  Screen,
  Tag,
  Txt,
} from "../components/ui";
import { useAccess } from "../lib/access";
export default function Pro() {
  const access = useAccess();
  return (
    <Screen>
      <Tag color={C.blue}>SPOTUP PRO</Tag>
      <Header title="Your game. Your people." />
      <Txt color={C.muted}>
        More control for the people bringing everyone together.
      </Txt>
      <Card>
        <Txt size={24} bold>
          {access.data?.is_pro ? "You’re a Pro member" : "Host your way"}
        </Txt>
        {[
          "Private games for invited players",
          "Plan up to eight weekly sessions",
          "Minimum XP and Pro member entry filters",
          "Join up to five squads",
        ].map((t) => (
          <Txt key={t}>✓ {t}</Txt>
        ))}
      </Card>
      <ErrorBox error={access.error} retry={() => access.refetch()} />
      {access.data?.is_pro ? (
        <Button title="Host a game" onPress={() => router.push("/create")} />
      ) : (
        <Card>
          <Txt bold>Subscriptions are coming</Txt>
          <Txt color={C.muted}>
            Existing Pro access is honored. New paid subscriptions are not
            available yet.
          </Txt>
        </Card>
      )}
      <Txt size={12} color={C.muted}>
        Joining open games, friends, messages, and Moments stay part of the core
        SpotUp experience.
      </Txt>
    </Screen>
  );
}
