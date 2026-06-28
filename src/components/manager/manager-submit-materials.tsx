"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/store/hooks";

export function ManagerSubmitMaterials() {
  const user = useCurrentUser();
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadRequest, setUploadRequest] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  return (
    <Card className="border-blue-200" id="submit-materials">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Request new lessons
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Upload policies or documents. The admin team will turn them into lessons
          in the right categories.
        </p>
      </CardHeader>
      <CardContent>
        {uploadSuccess ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            Submitted. The admin team will review and add lessons within 48 hours.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Files (PDF, Word, etc.)</Label>
              <input
                type="file"
                multiple
                className="block w-full text-sm border rounded p-2 mt-1 bg-background"
                onChange={(e) => {
                  if (e.target.files) setUploadFiles(Array.from(e.target.files));
                }}
              />
              {uploadFiles.length > 0 && (
                <div className="mt-1 text-xs">
                  Selected: {uploadFiles.map((f) => f.name).join(", ")}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 h-5 px-1 text-[10px]"
                    onClick={() => setUploadFiles([])}
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Instructions (optional)</Label>
              <Textarea
                placeholder="e.g. Create 3 short fall-prevention lessons for CNAs."
                value={uploadRequest}
                onChange={(e) => setUploadRequest(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>

            <Button
              onClick={async () => {
                if (uploadFiles.length === 0 && !uploadRequest.trim()) {
                  alert("Upload a file or add instructions.");
                  return;
                }

                const formData = new FormData();
                formData.append("orgId", user.orgId);
                formData.append("managerId", user.id);
                formData.append("managerName", user.name);
                formData.append("requestNote", uploadRequest.trim());
                uploadFiles.forEach((file) => formData.append("files", file));

                try {
                  const res = await fetch("/api/manager/submit-materials", {
                    method: "POST",
                    body: formData,
                  });
                  const data = await res.json();
                  if (!res.ok) {
                    alert(data.error ?? "Failed to submit. Try again.");
                    return;
                  }
                  setUploadSuccess(true);
                  setTimeout(() => {
                    setUploadFiles([]);
                    setUploadRequest("");
                    setUploadSuccess(false);
                  }, 6000);
                } catch {
                  alert("Network error — could not submit.");
                }
              }}
              className="w-full sm:w-auto"
            >
              Submit to admin team
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}