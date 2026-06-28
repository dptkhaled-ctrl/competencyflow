/** Download an uploaded file via the admin API (requires admin session cookie). */
export async function downloadAdminFile(
  materialId: string,
  fileName: string
): Promise<void> {
  const res = await fetch(`/api/admin/files/${materialId}`, {
    credentials: "same-origin",
  });

  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) message = data.error;
    } catch {
      // response was not JSON
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName || "download";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}