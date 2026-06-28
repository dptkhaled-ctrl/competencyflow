"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/store/hooks";

type AuthState = {
  configured: boolean;
  authenticated: boolean;
};

export function UserMenu() {
  const router = useRouter();
  const platformUser = useCurrentUser();
  const [auth, setAuth] = useState<AuthState>({
    configured: false,
    authenticated: false,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) =>
        setAuth({
          configured: Boolean(data.configured),
          authenticated: Boolean(data.authenticated),
        })
      )
      .catch(() => setAuth({ configured: false, authenticated: false }));
  }, []);

  if (!auth.configured) return null;

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
        <UserRound className="h-4 w-4" />
        <span>{platformUser.name}</span>
      </div>
      {auth.authenticated && (
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      )}
    </div>
  );
}