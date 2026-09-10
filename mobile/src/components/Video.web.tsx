import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, ErrorBox } from "./ui";
export default function Video({
  uri,
  active = false,
  controls = true,
}: {
  uri: string;
  active?: boolean;
  controls?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setError(undefined);
    setBlocked(false);
    const video = ref.current;
    if (!video) return;
    if (active) void video.play().catch(() => setBlocked(true));
    else video.pause();
    return () => video.pause();
  }, [uri, active]);
  useEffect(() => {
    const onVisibility = () => {
      const video = ref.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (active) void video.play().catch(() => setBlocked(true));
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active]);
  return (
    <View
      style={{
        flex: 1,
        minHeight: 240,
        backgroundColor: "#080F19",
        borderRadius: 18,
        overflow: "hidden",
      }}
    >
      <video
        ref={ref}
        src={uri}
        controls={controls}
        muted
        playsInline
        loop
        preload="metadata"
        aria-label="Sports video"
        onError={() =>
          setError(
            "This video could not be played. Refresh to renew access, or use an MP4 (H.264) video.",
          )
        }
        style={{
          width: "100%",
          height: "100%",
          minHeight: 240,
          objectFit: "contain",
          position: "absolute",
          inset: 0,
        }}
      />
      {blocked && (
        <View style={{ position: "absolute", top: "40%", alignSelf: "center" }}>
          <Button
            title="Play video"
            icon="play"
            onPress={() => {
              void ref.current
                ?.play()
                .then(() => setBlocked(false))
                .catch(() =>
                  setError("Tap the video controls to start playback."),
                );
            }}
          />
        </View>
      )}
      {!!error && (
        <View style={{ padding: 12 }}>
          <ErrorBox error={Error(error)} />
        </View>
      )}
    </View>
  );
}
