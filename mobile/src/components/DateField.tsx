import React, { useState } from "react";
import { View, Platform } from "react-native";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Button, Row, Txt, C } from "./ui";
export function localDateValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  const parsed = new Date(value);
  const date = Number.isFinite(parsed.getTime())
    ? parsed
    : new Date(Date.now() + 3600000);
  function change(event: DateTimePickerEvent, next?: Date) {
    if (Platform.OS === "android") setMode(null);
    if (next && event.type !== "dismissed") onChange(localDateValue(next));
  }
  return (
    <View style={{ gap: 8 }}>
      <Txt size={12} color={C.muted} bold>
        {label}
      </Txt>
      <Row>
        <Button
          title={value ? date.toLocaleDateString() : "Choose date"}
          kind="secondary"
          icon="calendar-outline"
          onPress={() => setMode("date")}
        />
        <Button
          title={
            value
              ? date.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Choose time"
          }
          kind="secondary"
          icon="time-outline"
          onPress={() => setMode("time")}
        />
      </Row>
      {mode && (
        <>
          <DateTimePicker value={date} mode={mode} onChange={change} />
          {Platform.OS === "ios" && (
            <Button
              title="Done"
              kind="ghost"
              onPress={() => {
                if (!value) onChange(localDateValue(date));
                setMode(null);
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
