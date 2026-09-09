import React from "react";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInputProps,
  ViewStyle,
  ColorValue,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
export const C = {
  bg: "#090D12",
  card: "#121922",
  ink: "#F4F7FB",
  muted: "#9AA8BA",
  line: "#263140",
  lime: "#B9F95B",
  dark: "#0D151D",
  soft: "#1C2935",
  red: "#FF8C86",
  orange: "#FFAC66",
};
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: string;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Ionicons
      name={name as React.ComponentProps<typeof Ionicons>["name"]}
      size={size}
      color={color}
    />
  );
}
export function Txt({
  children,
  size = 15,
  color = C.ink,
  bold = false,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  bold?: boolean;
  style?: object;
}) {
  return (
    <Text
      style={[
        {
          fontSize: size,
          color,
          fontWeight: bold ? "700" : "400",
          letterSpacing: bold ? -0.3 : 0,
          lineHeight: size * 1.4,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Screen({
  children,
  refresh,
  refreshing = false,
}: {
  children: React.ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: C.bg }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
        refreshControl={
          refresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[s.row, style]}>{children}</View>;
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  return <Animated.View entering={reduced ? undefined : FadeInDown.duration(260).springify().damping(22)} style={[s.card, style]}>{children}</Animated.View>;
}
export function Header({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <Row
      style={{
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow && (
          <Txt
            size={11}
            bold
            color={C.muted}
            style={{ letterSpacing: 2, marginBottom: 6 }}
          >
            {eyebrow.toUpperCase()}
          </Txt>
        )}
        <Txt size={32} bold style={{ letterSpacing: -1 }}>
          {title}
        </Txt>
      </View>
      {right}
    </Row>
  );
}
export function Button({
  title,
  onPress,
  kind = "primary",
  icon,
  disabled = false,
  loading = false,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor:
            kind === "primary"
              ? C.lime
              : kind === "secondary"
                ? C.soft
                : kind === "danger"
                  ? "#301C23"
                  : "transparent",
          opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={C.ink} />
      ) : (
        icon && (
          <Icon
            name={icon}
            size={19}
            color={kind === "danger" ? C.red : kind === "primary" ? "#101A0A" : C.ink}
          />
        )
      )}
      <Txt size={14} bold color={kind === "danger" ? C.red : kind === "primary" ? "#101A0A" : C.ink}>
        {title}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.iconButton}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt size={12} bold color={C.muted}>
        {label}
      </Txt>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor="#899187"
        style={[
          s.input,
          props.multiline && { height: 100, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: { id: string; name: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {items.map((x) => (
        <Pressable
          key={x.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value === x.id }}
          onPress={() => onChange(x.id)}
          style={[
            s.chip,
            {
              backgroundColor: value === x.id ? C.lime : C.card,
              borderColor: value === x.id ? C.lime : C.line,
            },
          ]}
        >
          <Txt size={12} bold color={value === x.id ? "#101A0A" : C.muted}>
            {x.name}
          </Txt>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function Tag({
  children,
  color = C.soft,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Txt size={10} bold color={color === C.lime ? "#101A0A" : C.ink}>
        {children}
      </Txt>
    </View>
  );
}
export function Empty({
  icon = "people-outline",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <Card style={{ padding: 28, alignItems: "center", gap: 14 }}>
      <View style={{ padding: 18, borderRadius: 30, backgroundColor: C.soft }}>
        <Icon name={icon} size={30} />
      </View>
      <Txt size={20} bold>
        {title}
      </Txt>
      <Txt color={C.muted} style={{ textAlign: "center" }}>
        {body}
      </Txt>
      {action}
    </Card>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <Card style={{ backgroundColor: "#301C23" }}>
      <Txt color={C.red}>
        {error instanceof Error ? error.message : String(error)}
      </Txt>
      {retry && <Button title="Try again" kind="ghost" onPress={retry} />}
    </Card>
  );
}
export function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator color={C.lime} />
      <Txt color={C.muted} style={{ textAlign: "center", marginTop: 12 }}>
        Getting things ready…
      </Txt>
    </View>
  );
}
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: C.soft,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt size={size * 0.35} bold>
        {name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </Txt>
    </View>
  );
}
export function Section({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 8 }}>
      <Txt size={20} bold>
        {title}
      </Txt>
      {action}
    </Row>
  );
}
export const s = StyleSheet.create({
  page: {
    padding: 22,
    gap: 18,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 17,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: C.ink,
    minHeight: 50,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 24,
    minHeight: 44,
  },
  iconButton: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
  },
});
