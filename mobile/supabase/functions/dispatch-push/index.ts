import { createClient } from "npm:@supabase/supabase-js@2.115.0";
Deno.serve(async (req) => {
  const secret = Deno.env.get("DISPATCH_SECRET");
  if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.rpc("claim_push_batch");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  let sent = 0;
  for (const n of data ?? []) {
    const { data: tokens, error } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", n.user_id);
    if (error) continue;
    if (!tokens?.length) {
      await admin
        .from("notifications")
        .update({ delivered_at: new Date().toISOString() })
        .eq("id", n.id);
      continue;
    }
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(Deno.env.get("EXPO_ACCESS_TOKEN")
            ? { Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}` }
            : {}),
        },
        body: JSON.stringify(
          tokens.map((t) => ({
            to: t.token,
            title: n.title,
            body: n.body,
            data: { path: n.path, notificationId: n.id },
            sound: "default",
          })),
        ),
      });
      if (!res.ok) continue;
      const ticket = await res.json();
      if (ticket.data?.every((t: any) => t.status === "ok")) {
        await admin
          .from("notifications")
          .update({ delivered_at: new Date().toISOString() })
          .eq("id", n.id);
        sent++;
      } else
        for (let i = 0; i < (ticket.data ?? []).length; i++) {
          if (ticket.data[i].details?.error === "DeviceNotRegistered")
            await admin
              .from("push_tokens")
              .delete()
              .eq("token", tokens[i].token);
        }
    } catch {
      /* Lease expiry permits bounded retry. */
    }
  }
  return Response.json({ accepted: sent });
});
