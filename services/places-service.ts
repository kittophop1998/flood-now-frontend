import { apiClient, toQuery } from "@/services/api-client";
import type { BoundingBox, Place } from "@/types/report";
import type { Locale } from "@/lib/i18n/locale";

export const placesService = {
  search: (q: string, lang: Locale, near?: BoundingBox, signal?: AbortSignal) =>
    apiClient
      .get<{ places: Place[] }>(
        `/api/v1/places/search${toQuery({
          q,
          lang,
          min_lat: near?.minLat,
          max_lat: near?.maxLat,
          min_lng: near?.minLng,
          max_lng: near?.maxLng,
        })}`,
        signal,
      )
      .then((r) => r.places),

  reverse: (latitude: number, longitude: number, lang: Locale, signal?: AbortSignal) =>
    apiClient
      .get<{ place: Place | null }>(`/api/v1/places/reverse${toQuery({ lat: latitude, lng: longitude, lang })}`, signal)
      .then((r) => r.place),
};
