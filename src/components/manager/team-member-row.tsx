import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { TeamMemberStatus } from "@/lib/types";

export function TeamMemberRow({ member, onClick }: { member: TeamMemberStatus; onClick?: () => void }) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition"
      onClick={onClick}
    >
      <Avatar>
        <AvatarFallback>{member.user.avatarInitials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{member.user.name}</span>
          {member.atRisk && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              At Risk
            </Badge>
          )}
          {/* Streak hidden in v0.1 to keep focus practical (deprioritized gamification) */}
        </div>
        <div className="flex items-center gap-3">
          <Progress value={member.completionRate} className="h-2 flex-1" />
          <span className="text-sm font-medium w-10 text-right">
            {member.completionRate}%
          </span>
        </div>
        {member.gapAreas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {member.gapAreas.map((gap) => (
              <Badge key={gap} variant="outline" className="text-xs">
                {gap}
              </Badge>
            ))}
          </div>
        )}
        {member.user.priorityCategories && member.user.priorityCategories.length > 0 && (
          <div className="text-[10px] text-muted-foreground">
            Priorities: {member.user.priorityCategories.slice(0, 3).join(", ")}{member.user.priorityCategories.length > 3 ? "..." : ""}
          </div>
        )}
      </div>
    </div>
  );
}