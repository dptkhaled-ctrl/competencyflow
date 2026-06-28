import { createAdminClient } from "@/lib/supabase/admin";

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

export async function ensureAuthUserWithPassword(input: {
  email: string;
  password: string;
  name: string;
  role: string;
}): Promise<string> {
  const admin = createAdminClient();
  const email = input.email.trim().toLowerCase();
  const metadata = {
    full_name: input.name,
    role: input.role,
  };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (!error && data.user) {
    return data.user.id;
  }

  const message = error?.message?.toLowerCase() ?? "";
  const alreadyExists =
    message.includes("already") ||
    message.includes("registered") ||
    message.includes("exists");

  if (!alreadyExists) {
    throw error ?? new Error("Could not create account");
  }

  for (let page = 1; page <= 10; page++) {
    const { data: listData, error: listError } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listError) throw listError;

    const existing = listData.users.find(
      (u) => u.email?.trim().toLowerCase() === email
    );
    if (existing) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        existing.id,
        {
          password: input.password,
          email_confirm: true,
          user_metadata: metadata,
        }
      );
      if (updateError) throw updateError;
      return existing.id;
    }

    if (listData.users.length < 200) break;
  }

  throw new Error("Account exists but could not be updated. Contact support.");
}