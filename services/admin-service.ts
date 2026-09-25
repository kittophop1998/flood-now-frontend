import { adminClient } from "@/services/api-client";
import type {
  Announcement,
  AnnouncementInput,
  ImportantPlace,
  ImportantPlaceInput,
  ModerationAction,
  ModerationItem,
} from "@/types/community";

// Operator endpoints (/api/v1/admin/*). The token is the shared ADMIN_TOKEN
// the API is configured with; FloodNow has no user accounts.
export function adminService(token: string) {
  const api = adminClient(token);
  return {
    queue: () => api.get<{ items: ModerationItem[] }>("/api/v1/admin/moderation/queue").then((r) => r.items),
    moderate: (reportId: string, action: ModerationAction) =>
      api.post<void>(`/api/v1/admin/reports/${reportId}/moderation`, { action }),

    announcements: () => api.get<{ announcements: Announcement[] }>("/api/v1/admin/announcements").then((r) => r.announcements),
    createAnnouncement: (input: AnnouncementInput) => api.post<Announcement>("/api/v1/admin/announcements", input),
    updateAnnouncement: (id: string, input: AnnouncementInput) => api.patch<Announcement>(`/api/v1/admin/announcements/${id}`, input),
    setPublished: (id: string, publish: boolean) =>
      api.post<Announcement>(`/api/v1/admin/announcements/${id}/${publish ? "publish" : "unpublish"}`),
    deleteAnnouncement: (id: string) => api.delete<void>(`/api/v1/admin/announcements/${id}`),

    createPlace: (input: ImportantPlaceInput) => api.post<ImportantPlace>("/api/v1/admin/important-places", input),
    updatePlace: (id: string, input: ImportantPlaceInput) => api.patch<ImportantPlace>(`/api/v1/admin/important-places/${id}`, input),
    deletePlace: (id: string) => api.delete<void>(`/api/v1/admin/important-places/${id}`),
  };
}
