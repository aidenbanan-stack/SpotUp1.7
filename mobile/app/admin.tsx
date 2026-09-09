import React, { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  Card,
  ErrorBox,
  Field,
  Header,
  Loading,
  Screen,
  Section,
  Txt,
} from "../src/components/ui";
import Video from "../src/components/Video";
import { Media } from "../src/lib/types";
import { rows, rpc, supabase } from "../src/lib/supabase";
import { useAction } from "../src/lib/hooks";
export default function Admin() {
  const role = useQuery({
    queryKey: ["admin"],
    queryFn: () => rpc<boolean>("is_admin"),
  });
  const reports = useQuery({
    queryKey: ["reports"],
    enabled: role.data === true,
    queryFn: () =>
      rows<{
        id: string;
        target_type: string;
        target_id: string;
        reason: string;
      }>("reports", "*", { status: "open" }),
  });
  const media = useQuery({
    queryKey: ["pendingMedia"],
    enabled: role.data === true,
    queryFn: () => rows<Media>("media_assets", "*", { state: "pending" }),
  });
  const action = useAction(
    (v: { rid: string; decision: string; note: string }) =>
      rpc("moderate_report", v),
  );
  if (role.isLoading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  if (!role.data)
    return (
      <Screen>
        <Header title="Moderator access required" />
        <ErrorBox error={role.error} />
      </Screen>
    );
  return (
    <Screen>
      <Header title="Community moderation" />
      <ErrorBox error={reports.error || media.error || action.error} />
      <Section title="Pending videos" />
      {media.data?.map((m) => (
        <MediaReview key={m.id} media={m} />
      ))}
      {!media.data?.length && <Txt>No pending media.</Txt>}
      <Section title="Open reports" />
      {reports.data?.map((r) => (
        <ReportReview
          key={r.id}
          report={r}
          busy={action.isPending}
          onReview={(decision, note) =>
            action.mutate({ rid: r.id, decision, note })
          }
        />
      ))}
      {!reports.data?.length && <Txt>No open reports.</Txt>}
    </Screen>
  );
}
function MediaReview({ media }: { media: Media }) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState("");
  const [bytes, setBytes] = useState("");
  const q = useQuery({
    queryKey: ["reviewMedia", media.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("videos")
        .createSignedUrl(media.object_path, 120);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const action = useAction((approved: boolean) =>
    rpc("review_media", {
      mid: media.id,
      approved,
      verified_seconds: Number(seconds) || null,
      verified_bytes: Number(bytes) || null,
    }),
  );
  return (
    <Card>
      <Txt>{media.id}</Txt>
      <Button
        title={open ? "Close video" : "Inspect uploaded video"}
        kind="secondary"
        onPress={() => setOpen(!open)}
      />
      {open && q.data && (
        <View style={{ height: 360 }}>
          <Video uri={q.data} />
        </View>
      )}
      <Txt>
        Review the entire video and verify duration, file size, and sports
        relevance before approval. These fields must come from media inspection,
        not the uploader’s claims.
      </Txt>
      <Field
        label="Verified duration (seconds)"
        value={seconds}
        onChangeText={setSeconds}
        keyboardType="decimal-pad"
      />
      <Field
        label="Verified size (bytes)"
        value={bytes}
        onChangeText={setBytes}
        keyboardType="number-pad"
      />
      <ErrorBox error={q.error || action.error} />
      <Button
        title="Approve inspected video"
        disabled={!seconds || !bytes || !open}
        loading={action.isPending}
        onPress={() => action.mutate(true)}
      />
      <Button
        title="Reject video"
        kind="danger"
        loading={action.isPending}
        onPress={() => action.mutate(false)}
      />
    </Card>
  );
}
function ReportReview({
  report: r,
  busy,
  onReview,
}: {
  report: {
    id: string;
    target_type: string;
    target_id: string;
    reason: string;
  };
  busy: boolean;
  onReview: (decision: string, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const tables: Record<string, string> = {
    post: "posts",
    showcase: "showcases",
    comment: "comments",
    message: "messages",
    game: "games",
    user: "profiles",
  };
  const detail = useQuery({
    queryKey: ["reportedContent", r.target_type, r.target_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tables[r.target_type])
        .select("*")
        .eq("id", r.target_id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        body?: string;
        caption?: string;
        name?: string;
        title?: string;
      } | null;
    },
  });
  return (
    <Card>
      <Txt>
        {r.target_type} · {r.target_id}
      </Txt>
      <Txt>{r.reason}</Txt>
      <ErrorBox error={detail.error} />
      <Txt>
        {detail.data?.body ||
          detail.data?.caption ||
          detail.data?.title ||
          detail.data?.name ||
          "No text available for this item."}
      </Txt>
      {["post", "showcase", "game", "user"].includes(r.target_type) && (
        <Button
          title="Open reported item"
          kind="secondary"
          onPress={() => {
            if (r.target_type === "showcase")
              router.push({
                pathname: "/clip/[id]",
                params: { id: r.target_id, kind: "showcase" },
              });
            else
              router.push(
                `/${r.target_type === "post" ? "clip" : r.target_type === "user" ? "player" : "game"}/${r.target_id}` as never,
              );
          }}
        />
      )}
      <Field
        label="Moderator findings"
        value={note}
        onChangeText={setNote}
        multiline
      />
      <Button
        title="Remove reported content"
        kind="danger"
        disabled={note.trim().length < 3 || r.target_type === "user"}
        loading={busy}
        onPress={() => onReview("removed", note)}
      />
      <Button
        title="Dismiss report"
        kind="secondary"
        disabled={note.trim().length < 3}
        loading={busy}
        onPress={() => onReview("dismissed", note)}
      />
      {r.target_type === "user" && (
        <Txt>
          Account suspension is handled through trusted Supabase Auth
          administration.
        </Txt>
      )}
    </Card>
  );
}
