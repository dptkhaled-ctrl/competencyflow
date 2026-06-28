import { ManagerChatPanel } from "@/components/manager/chat-panel";

export default function ManagerChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Competency AI</h1>
        <p className="text-sm text-muted-foreground">
          Live intelligence across lessons, staff, rotation schedules, survey
          readiness, and uploaded policies. Ask anything — it can also assign
          training when you need action.
        </p>
      </div>
      <ManagerChatPanel />
    </div>
  );
}