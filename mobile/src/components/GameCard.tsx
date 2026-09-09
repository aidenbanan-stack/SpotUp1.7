import { useSports } from "../lib/sports";
import React from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Game } from "../lib/types";
import { formatDate, gameLabel } from "../lib/domain";
import { Card, C, Icon, Row, Tag, Txt } from "./ui";
export default function GameCard({ game }: { game: Game }) {
  const SPORTS = useSports();
  const count = game.game_players?.length ?? 0;
  const label = gameLabel(game.status, count, game.capacity, game.starts_at);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${game.title}, ${label}`}
      onPress={() => router.push(`/game/${game.id}`)}
    >
      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Row>
            <View
              style={{
                padding: 10,
                backgroundColor: C.soft,
                borderRadius: 13,
              }}
            >
              <Icon
                name={
                  SPORTS.find((s) => s.id === game.sport_id)?.icon ??
                  "fitness-outline"
                }
              />
            </View>
            <Txt size={12} bold color={C.muted}>
              {game.sport_id.toUpperCase()} · {game.format}
            </Txt>
          </Row>
          <Tag color={label === "Filling up" ? C.lime : C.soft}>
            {label.toUpperCase()}
          </Tag>
        </Row>
        <Txt size={21} bold>
          {game.title}
        </Txt>
        <Row>
          <Icon name="location-outline" size={16} color={C.muted} />
          <Txt size={13} color={C.muted}>
            {game.locations?.name}
          </Txt>
        </Row>
        <Row>
          <Icon name="time-outline" size={16} color={C.muted} />
          <Txt size={13} color={C.muted}>
            {formatDate(game.starts_at)}
          </Txt>
        </Row>
        <View style={{ height: 1, backgroundColor: C.line }} />
        <Row style={{ justifyContent: "space-between" }}>
          <Txt size={12} bold>
            {count}/{game.capacity} players · {game.skill}
          </Txt>
          <Icon name="arrow-forward" size={20} />
        </Row>
        <View style={{ height: 4, borderRadius: 3, backgroundColor: C.soft }}>
          <View
            style={{
              height: 4,
              borderRadius: 3,
              backgroundColor: C.lime,
              width: `${Math.min(100, (count / game.capacity) * 100)}%`,
            }}
          />
        </View>
      </Card>
    </Pressable>
  );
}
