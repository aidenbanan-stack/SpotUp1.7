import React, { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Button, C, ErrorBox, Loading, Txt } from "./ui";
export default function Video({
  uri,
  active = false,
  controls = true,
  immersive = false,
}: {
  uri: string;
  active?: boolean;
  controls?: boolean;
  immersive?: boolean;
}) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);
  useEffect(() => {
    if (active) player.play();
    else player.pause();
    return () => {
      player.pause();
    };
  }, [active, player]);
  useEffect(() => {
    const s = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
      else if (active) player.play();
    });
    return () => s.remove();
  }, [player, active]);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#080F19",
        minHeight: 240,
        borderRadius: immersive ? 0 : 18,
        overflow: "hidden",
      }}
    >
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%", minHeight: 240 }}
        contentFit={immersive ? "cover" : "contain"}
        nativeControls={controls}
        accessibilityLabel="Sports video"
      />
      {status === "loading" && (
        <View style={{ position: "absolute", top: "40%", alignSelf: "center" }}>
          <Loading />
        </View>
      )}
      {status === "error" && (
        <View style={{ position: "absolute", top: 20, left: 20, right: 20 }}>
          <ErrorBox
            error={Error(
              error?.message ??
                "This video could not be played. Try opening it again.",
            )}
          />
        </View>
      )}
      <View style={{ position: "absolute", top: 12, left: 12 }}>
        <Button
          title={muted ? "Unmute" : "Mute"}
          kind="secondary"
          icon={muted ? "volume-mute-outline" : "volume-high-outline"}
          onPress={() => setMuted(!muted)}
        />
      </View>
    </View>
  );
}
