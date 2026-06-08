const GUMROAD_BASE = "https://api.gumroad.com/v2";

export interface GumroadProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  url: string;
  short_url: string;
  published: boolean;
  sales_count: number;
  revenue: number;
}

export interface GumroadListingInput {
  name: string;
  description: string;
  price: number;
  url?: string;
  published?: boolean;
  tags?: string[];
}

export interface GumroadSaleEvent {
  resource_name: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  price: number;
  currency_symbol: string;
  quantity: number;
  email: string;
  country: string;
  created_at: string;
}

async function gumroadRequest<T>(
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: Record<string, unknown>
): Promise<T> {
  const accessToken = process.env.GUMROAD_ACCESS_TOKEN;
  if (!accessToken) throw new Error("GUMROAD_ACCESS_TOKEN not configured");

  const res = await fetch(`${GUMROAD_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!data.success) throw new Error((data.message as string | undefined) ?? "Gumroad API error");
  return data as T;
}

export const gumroad = {
  createProduct: (input: GumroadListingInput) =>
    gumroadRequest<{ success: true; product: GumroadProduct }>("/products", "POST", input as unknown as Record<string, unknown>),

  updateProduct: (id: string, input: Partial<GumroadListingInput>) =>
    gumroadRequest<{ success: true; product: GumroadProduct }>(`/products/${id}`, "PUT", input as unknown as Record<string, unknown>),

  enableProduct: (id: string) =>
    gumroadRequest<{ success: true; product: GumroadProduct }>(`/products/${id}/enable`, "PUT"),

  disableProduct: (id: string) =>
    gumroadRequest<{ success: true; product: GumroadProduct }>(`/products/${id}/disable`, "PUT"),

  deleteProduct: (id: string) =>
    gumroadRequest<{ success: true; message: string }>(`/products/${id}`, "DELETE"),

  getProducts: () =>
    gumroadRequest<{ success: true; products: GumroadProduct[] }>("/products", "GET"),

  getSales: (productId: string) =>
    gumroadRequest<{ success: true; sales: GumroadSaleEvent[] }>(`/sales?product_id=${productId}`, "GET"),
};
