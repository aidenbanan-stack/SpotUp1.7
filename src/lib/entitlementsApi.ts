import { supabase } from "@/lib/supabaseClient";

export type AccessState = {
  is_pro: boolean;
  is_admin: boolean;
};

export async function fetchMyAccessState(): Promise<AccessState> {
  const { data, error } = await supabase.rpc('get_my_access_state');
  if (error) {
    console.warn('[entitlements] get_my_access_state failed:', error);
    return { is_pro: false, is_admin: false };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    is_pro: Boolean((row as any)?.is_pro),
    is_admin: Boolean((row as any)?.is_admin),
  };
}

export async function adminGrantPro(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_grant_pro', { p_user_id: userId });
  if (error) throw error;
}

export async function adminRevokePro(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_revoke_pro', { p_user_id: userId });
  if (error) throw error;
}
