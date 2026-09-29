import { apiClient, toQuery } from "@/services/api-client";
import type { LatLng } from "@/types/community";
import type {
  CancelReason,
  CreateServiceRequestInput,
  IssueReason,
  MyProvider,
  OfferBrief,
  OfferInput,
  ProviderInput,
  ProviderJob,
  ProviderOffer,
  RedactedRequest,
  ServiceCategory,
  ServiceProvider,
  ServiceRequest,
  ServiceRequestStatus,
  Topup,
  Wallet,
} from "@/types/local-services";

// Local services (commercial): browsing providers is public; everything
// else needs a session (the API answers 401 to guests). Separate from SOS.
export const providersService = {
  list: (query: { at: LatLng; category?: ServiceCategory | null; q?: string; availableOnly?: boolean; radiusM?: number }, signal?: AbortSignal) =>
    apiClient
      .get<{ providers: ServiceProvider[] }>(
        `/api/v1/service-providers${toQuery({
          lat: query.at.latitude,
          lng: query.at.longitude,
          category: query.category ?? undefined,
          q: query.q?.trim() || undefined,
          available_only: query.availableOnly ? "true" : undefined,
          radius_m: query.radiusM,
        })}`,
        signal,
      )
      .then((r) => r.providers),
  get: (id: string, at?: LatLng | null, signal?: AbortSignal) =>
    apiClient.get<ServiceProvider>(`/api/v1/service-providers/${id}${toQuery({ lat: at?.latitude, lng: at?.longitude })}`, signal),
};

export const serviceRequestsService = {
  create: (input: CreateServiceRequestInput) => apiClient.post<ServiceRequest>("/api/v1/service-requests", input),
  mine: (signal?: AbortSignal) =>
    apiClient.get<{ requests: ServiceRequest[] }>("/api/v1/service-requests/mine", signal).then((r) => r.requests),
  get: (id: string, signal?: AbortSignal) => apiClient.get<ServiceRequest>(`/api/v1/service-requests/${id}`, signal),
  // Choosing a provider only asks them to confirm; it never charges anyone.
  selectOffer: (id: string, offerId: string) => apiClient.post<ServiceRequest>(`/api/v1/service-requests/${id}/offers/${offerId}/select`),
  setStatus: (id: string, status: ServiceRequestStatus) => apiClient.post<ServiceRequest>(`/api/v1/service-requests/${id}/status`, { status }),
  // 204 (undefined) when a provider backs out of a job.
  cancel: (id: string, reason: CancelReason, note?: string | null) =>
    apiClient.post<ServiceRequest | undefined>(`/api/v1/service-requests/${id}/cancel`, { reason, note: note || null }),
  reportIssue: (id: string, reason: IssueReason, details?: string | null) =>
    apiClient.post<void>(`/api/v1/service-requests/${id}/issues`, { reason, details: details || null }),
};

export const providerService = {
  me: (signal?: AbortSignal) => apiClient.get<{ provider: MyProvider | null }>("/api/v1/provider/me", signal).then((r) => r.provider),
  save: (input: ProviderInput) => apiClient.put<{ provider: MyProvider }>("/api/v1/provider/me", input).then((r) => r.provider),
  setAvailable: (available: boolean) =>
    apiClient.post<{ provider: MyProvider }>("/api/v1/provider/me/availability", { available }).then((r) => r.provider),
  nearbyRequests: (signal?: AbortSignal) =>
    apiClient.get<{ requests: RedactedRequest[] }>("/api/v1/provider/requests/nearby", signal).then((r) => r.requests),
  dismiss: (requestId: string) => apiClient.post<void>(`/api/v1/provider/requests/${requestId}/dismiss`),
  // Free: sending or editing an offer never costs credit.
  sendOffer: (requestId: string, input: OfferInput) => apiClient.post<OfferBrief>(`/api/v1/provider/requests/${requestId}/offer`, input),
  offers: (signal?: AbortSignal) => apiClient.get<{ offers: ProviderOffer[] }>("/api/v1/provider/offers", signal).then((r) => r.offers),
  // The qualified match: the match fee is deducted here (402 INSUFFICIENT_CREDIT otherwise).
  accept: (offerId: string) => apiClient.post<ServiceRequest>(`/api/v1/provider/offers/${offerId}/accept`),
  reject: (offerId: string) => apiClient.post<void>(`/api/v1/provider/offers/${offerId}/reject`),
  jobs: (signal?: AbortSignal) => apiClient.get<{ jobs: ProviderJob[] }>("/api/v1/provider/jobs", signal).then((r) => r.jobs),
  wallet: (signal?: AbortSignal) => apiClient.get<Wallet>("/api/v1/provider/wallet", signal),
  // A PromptPay QR (via Stripe) for a server-defined package; credit arrives
  // only via the verified webhook.
  startTopup: (packageId: string) =>
    apiClient.post<{ topup: Topup }>("/api/v1/provider/wallet/topups", { package_id: packageId }).then((r) => r.topup),
  topup: (id: string, signal?: AbortSignal) => apiClient.get<Topup>(`/api/v1/provider/wallet/topups/${id}`, signal),
};
