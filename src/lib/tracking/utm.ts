export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
}

export function buildTrackedUrl(baseUrl: string, params: UtmParams): string {
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", params.source);
    url.searchParams.set("utm_medium", params.medium);
    url.searchParams.set("utm_campaign", params.campaign);
    if (params.content) url.searchParams.set("utm_content", params.content);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export function parseUtmFromUrl(rawUrl: string | null): Partial<UtmParams> {
  if (!rawUrl) return {};
  try {
    const url = new URL(rawUrl);
    const result: Partial<UtmParams> = {};
    const source = url.searchParams.get("utm_source");
    const medium = url.searchParams.get("utm_medium");
    const campaign = url.searchParams.get("utm_campaign");
    const content = url.searchParams.get("utm_content");
    if (source) result.source = source;
    if (medium) result.medium = medium;
    if (campaign) result.campaign = campaign;
    if (content) result.content = content;
    return result;
  } catch {
    return {};
  }
}
