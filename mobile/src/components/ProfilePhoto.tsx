import React from "react";
import { Image } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "./ui";
import { supabase } from "../lib/supabase";
export default function ProfilePhoto({
  name,
  path,
  size = 72,
}: {
  name: string;
  path?: string | null;
  size?: number;
}) {
  const q = useQuery({
    queryKey: ["avatar", path],
    enabled: !!path,
    staleTime: 90000,
    queryFn: async () => {
      if (path?.startsWith("https://qzssyfzfrghvmgggzplc.supabase.co/storage/v1/object/public/avatars/")) return path;
      const { data, error } = await supabase.storage
        .from("spotup-avatars")
        .createSignedUrl(path!, 120);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  return q.data ? (
    <Image
      accessibilityLabel={`${name} profile photo`}
      source={{ uri: q.data }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <Avatar name={name} size={size} />
  );
}
