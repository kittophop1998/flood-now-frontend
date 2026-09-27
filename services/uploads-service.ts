import { adminClient, apiClient, ApiError } from "@/services/api-client";
import type { PresignUploadResult } from "@/types/report";

// Uploads a single image: presign via the API, then PUT bytes straight to
// R2. Returns the object_key to submit with the report. This is the only
// place the browser writes to object storage directly — see
// docs/architecture.md#web--api-boundary.
export async function uploadReportImage(file: File): Promise<string> {
  const presign = await apiClient.post<PresignUploadResult>("/api/v1/uploads/presign", {
    content_type: file.type,
    content_length: file.size,
  });
  await putObject(presign, file);
  return presign.object_key;
}

// Same flow for an official-announcement image, presigned by the operator
// endpoint (ADMIN_TOKEN) so the key lands under the announcements/ prefix
// the API requires for announcement images.
export async function uploadAnnouncementImage(token: string, file: File): Promise<string> {
  const presign = await adminClient(token).post<PresignUploadResult>("/api/v1/admin/uploads/presign", {
    content_type: file.type,
    content_length: file.size,
  });
  await putObject(presign, file);
  return presign.object_key;
}

async function putObject(presign: PresignUploadResult, file: File): Promise<void> {
  let res: Response;
  try {
    res = await fetch(presign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ApiError(0, { code: "UPLOAD_FAILED", message: "Image upload failed. Check your connection and try again." });
  }

  if (!res.ok) {
    throw new ApiError(res.status, { code: "UPLOAD_FAILED", message: "Image upload failed. Try again." });
  }
}
