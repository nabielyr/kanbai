import type { User } from "@supabase/supabase-js";

export interface UserDisplay {
  name: string;
  email: string | null;
  initials: string;
  /** The provider's profile photo (Google, GitHub), if there is a safe one. */
  avatarUrl: string | null;
}

const firstText = (...values: unknown[]) =>
  values.find((v): v is string => typeof v === "string" && v.trim() !== "")?.trim();

function initialsOf(name: string): string {
  const words = name.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toUpperCase();
}

const httpsUrl = (value: string | undefined) => (value?.startsWith("https://") ? value : null);

/** Name, email, initials and photo for the account menu, whatever way the person logged in. */
export function getUserDisplay(user: Pick<User, "email" | "user_metadata">): UserDisplay {
  const meta = user.user_metadata ?? {};
  const email = firstText(user.email) ?? null;
  const name =
    firstText(meta.full_name, meta.name, meta.user_name) ?? email?.split("@")[0] ?? "Account";
  const avatarUrl = httpsUrl(firstText(meta.avatar_url, meta.picture));
  return { name, email, initials: initialsOf(name), avatarUrl };
}
