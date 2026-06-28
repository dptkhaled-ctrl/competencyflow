"use client";

import { useEffect } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);
  const organizations = useAppStore((s) => s.organizations || []);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const staffLabel = "staff";
  const managerLabel = "manager";

  // Recover stale currentUserId (e.g. deleted user or old localStorage id) in an effect,
  // never during render — avoids maximum update depth errors.
  useEffect(() => {
    if (!users.length) return;
    const valid = users.some((u) => u.id === currentUserId);
    if (!valid) {
      const fallback = users.find((u) => u.role === "staff") ?? users[0];
      if (fallback) setCurrentUser(fallback.id);
    }
  }, [currentUserId, users, setCurrentUser]);

  const currentUser =
    users.find((u) => u.id === currentUserId) ??
    users.find((u) => u.role === "staff") ??
    users[0];

  if (!currentUser) {
    // Extremely early render before any data – render a minimal safe trigger
    return (
      <div className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 opacity-50")}>
        Loading user…
      </div>
    );
  }

  const org = organizations.find((o) => o.id === currentUser!.orgId) || organizations[0];

  const grouped = organizations.map((organization) => ({
    organization,
    members: users.filter((u) => u.orgId === organization.id),
  }));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-2 max-w-[220px]"
        )}
      >
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
            {currentUser.avatarInitials}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-left">
          <span className="block text-xs font-medium leading-tight">{currentUser.name}</span>
          <span className="block text-[10px] text-muted-foreground capitalize leading-tight">
            {currentUser.role === "staff" ? staffLabel : managerLabel} · {org.name}
          </span>
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Switch demo user
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {grouped.map(({ organization, members }) => (
          <DropdownMenuGroup key={organization.id}>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {organization.name}
            </DropdownMenuLabel>
            {members.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => {
                  setCurrentUser(user.id);
                  if (user.role === "staff") window.location.href = "/staff";
                  else window.location.href = "/manager";
                }}
                className="gap-2"
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px]">
                    {user.avatarInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role === "staff" ? staffLabel : managerLabel}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}