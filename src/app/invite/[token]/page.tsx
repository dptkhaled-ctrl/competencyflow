import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { InviteAccept } from "@/components/auth/invite-accept";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      }
    >
      <InviteAccept token={token} />
    </Suspense>
  );
}