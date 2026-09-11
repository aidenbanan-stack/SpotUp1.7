import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Button, ErrorBox, Field, Row, Txt, C } from "./ui";
export default function PlayerSearch({
  onSelect,
  busy = false,
  label = "Find a player",
  button = "Select",
}: {
  onSelect: (id: string) => void;
  busy?: boolean;
  label?: string;
  button?: string;
}) {
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const q = useQuery({
    queryKey: ["playerSearch", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,city")
        .eq("disabled", false)
        .ilike("name", `%${search.replace(/[%_]/g, "")}%`)
        .limit(8);
      if (error) throw error;
      return data;
    },
  });
  return (
    <View style={{ gap: 10 }}>
      <Field
        label={label}
        placeholder="Type a player’s name"
        value={text}
        onChangeText={setText}
      />
      {search === text.trim() &&
        q.data?.map((p) => (
          <Row key={p.id}>
            <View style={{ flex: 1 }}>
              <Txt bold>{p.name}</Txt>
              <Txt color={C.muted} size={12}>
                {p.city}
              </Txt>
            </View>
            <Button
              title={button}
              kind="secondary"
              loading={busy}
              onPress={() => onSelect(p.id)}
            />
          </Row>
        ))}
      <ErrorBox error={q.error} />
    </View>
  );
}
