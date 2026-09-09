import { createClient } from "npm:@supabase/supabase-js@2.115.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type",
  "Content-Type": "application/json",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return Response.json(
      { error: "Method not allowed" },
      { status: 405, headers },
    );
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization") ?? "" },
        },
      },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return Response.json(
        { error: "Sign in required" },
        { status: 401, headers },
      );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const erased = await admin.rpc("erase_profile", { uid: user.id });
    if (erased.error) throw erased.error;
    // All assets are hidden by erase_profile; remove underlying media in batches.
    let offset = 0;
    while (true) {
      const { data, error } = await admin
        .from("media_assets")
        .select("object_path")
        .eq("owner_id", user.id)
        .range(offset, offset + 99);
      if (error) throw error;
      if (!data.length) break;
      const result = await admin.storage
        .from("videos")
        .remove(data.map((m) => m.object_path));
      if (result.error) throw result.error;
      offset += 100;
    }
    while (true) {
      const listed = await admin.storage
        .from("spotup-avatars")
        .list(user.id, { limit: 100 });
      if (listed.error) throw listed.error;
      if (!listed.data.length) break;
      const removed = await admin.storage
        .from("spotup-avatars")
        .remove(listed.data.map((file) => user.id + "/" + file.name));
      if (removed.error) throw removed.error;
    }
    const removed = await admin.auth.admin.deleteUser(user.id, true);
    if (removed.error) throw removed.error;
    return Response.json({ deleted: true }, { headers });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400, headers },
    );
  }
});
