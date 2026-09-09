import React from "react";
import { View } from "react-native";
import { C, Txt } from "./ui";
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
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Txt size={12} color={C.muted} bold>
        {label}
      </Txt>
      <input
        aria-label={label}
        type="datetime-local"
        value={value.replace(" ", "T")}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: 14,
          minHeight: 24,
          fontSize: 16,
          borderRadius: 12,
          border: "1px solid " + C.line,
          color: C.ink,
          backgroundColor: "white",
        }}
      />
    </View>
  );
}
