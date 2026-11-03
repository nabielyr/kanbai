// The Supabase URL and publishable (anon) key are public by design: Row Level Security is what
// protects the data. When they're missing, login is switched off and guests keep working.

export interface SupabaseConfig {
  url: string;
  key: string;
}

export function readSupabaseConfig(url?: string, key?: string): SupabaseConfig | null {
  const cleanUrl = url?.trim();
  const cleanKey = key?.trim();
  if (!cleanUrl || !cleanKey) return null;
  try {
    const { protocol } = new URL(cleanUrl);
    if (protocol !== "https:" && protocol !== "http:") return null;
  } catch {
    return null;
  }
  return { url: cleanUrl.replace(/\/+$/, ""), key: cleanKey };
}

/** Next only inlines NEXT_PUBLIC_* values written out in full, so they're read right here. */
export function getSupabaseConfig(): SupabaseConfig | null {
  return readSupabaseConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
