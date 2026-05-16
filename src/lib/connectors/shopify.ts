/**
 * Shopify connector — products via Admin REST API v2024-01.
 *
 * Auth: X-Shopify-Access-Token header.
 * Docs: https://shopify.dev/docs/api/admin-rest
 *
 * shop: store name without .myshopify.com (e.g. "my-store")
 * accessToken: Shopify Admin API access token (shpat_...)
 */

export interface ContentItem {
  id: string
  name: string
  state: string
  itemCount: number
}

interface ShopifyShop {
  name: string
  myshopify_domain: string
  email: string
}

interface ShopifyVariant {
  id: number
  title: string
  price: string
  sku: string
}

interface ShopifyOption {
  id: number
  name: string
  values: string[]
}

interface ShopifyProduct {
  id: number
  title: string
  body_html: string
  vendor: string
  product_type: string
  status: string
  tags: string
  options: ShopifyOption[]
  variants: ShopifyVariant[]
}

interface ShopifyMetafield {
  id?: number
  namespace: string
  key: string
  value: string
  type: string
}

function base(shop: string): string {
  return `https://${shop}.myshopify.com/admin/api/2024-01`
}

function headers(accessToken: string): Record<string, string> {
  return {
    "X-Shopify-Access-Token": accessToken,
    "Content-Type": "application/json",
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export async function testConnection(
  shop: string,
  accessToken: string
): Promise<{ ok: boolean; displayName?: string; error?: string }> {
  try {
    const res = await fetch(`${base(shop)}/shop.json`, {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Invalid access token or insufficient permissions" }
      }
      return { ok: false, error: `Shopify responded with ${res.status}` }
    }
    const data = await res.json() as { shop: ShopifyShop }
    return { ok: true, displayName: data.shop.name }
  } catch (err) {
    return { ok: false, error: `Connection failed: ${(err as Error).message}` }
  }
}

export async function listContent(shop: string, accessToken: string): Promise<ContentItem[]> {
  const res = await fetch(
    `${base(shop)}/products.json?limit=250&fields=id,title,status,variants`,
    {
      headers: headers(accessToken),
      signal: AbortSignal.timeout(15_000),
    }
  )
  if (!res.ok) {
    throw new Error(`Shopify products list failed with status ${res.status}`)
  }
  const data = await res.json() as { products: Array<{ id: number; title: string; status: string; variants: ShopifyVariant[] }> }
  return data.products.map((p) => ({
    id: `product:${p.id}`,
    name: p.title,
    state: p.status,
    itemCount: p.variants?.length ?? 0,
  }))
}

export async function fetchContent(
  shop: string,
  accessToken: string,
  contentId: string
): Promise<Record<string, string>> {
  const numericId = contentId.replace(/^product:/, "")
  const res = await fetch(`${base(shop)}/products/${numericId}.json`, {
    headers: headers(accessToken),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new Error(`Shopify product fetch failed with status ${res.status}`)
  }
  const data = await res.json() as { product: ShopifyProduct }
  const product = data.product
  const result: Record<string, string> = {}

  if (product.title) result["title"] = product.title
  if (product.body_html) {
    const stripped = stripHtml(product.body_html)
    if (stripped) result["body_html"] = stripped
  }
  if (product.vendor) result["vendor"] = product.vendor
  if (product.product_type) result["product_type"] = product.product_type
  if (product.tags) result["tags"] = product.tags

  // Option names
  if (Array.isArray(product.options)) {
    product.options.forEach((opt, idx) => {
      if (opt.name) result[`option_${idx + 1}_name`] = opt.name
    })
  }

  // Variant titles (excluding the default "Default Title")
  if (Array.isArray(product.variants)) {
    product.variants.forEach((variant, idx) => {
      if (variant.title && variant.title !== "Default Title") {
        result[`variant_${idx + 1}_title`] = variant.title
      }
    })
  }

  return result
}

export async function pushTranslation(
  shop: string,
  accessToken: string,
  contentId: string,
  locale: string,
  translations: Record<string, string>
): Promise<void> {
  const numericId = contentId.replace(/^product:/, "")
  const h = headers(accessToken)
  const value = JSON.stringify(translations)

  // Attempt to create the metafield
  const createRes = await fetch(`${base(shop)}/products/${numericId}/metafields.json`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      metafield: {
        namespace: "translations",
        key: locale,
        value,
        type: "json",
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (createRes.ok) return

  // 422 = metafield already exists — find existing id and update it
  if (createRes.status === 422) {
    const listRes = await fetch(
      `${base(shop)}/products/${numericId}/metafields.json?namespace=translations&key=${encodeURIComponent(locale)}`,
      { headers: h, signal: AbortSignal.timeout(15_000) }
    )
    if (!listRes.ok) {
      throw new Error(`Shopify metafield list failed with status ${listRes.status}`)
    }
    const listData = await listRes.json() as { metafields: ShopifyMetafield[] }
    const existing = listData.metafields[0]
    if (!existing?.id) {
      throw new Error("Shopify metafield conflict but could not locate existing metafield id")
    }

    const updateRes = await fetch(
      `${base(shop)}/products/${numericId}/metafields/${existing.id}.json`,
      {
        method: "PUT",
        headers: h,
        body: JSON.stringify({
          metafield: { id: existing.id, value, type: "json" },
        }),
        signal: AbortSignal.timeout(15_000),
      }
    )
    if (!updateRes.ok) {
      const msg = await updateRes.text()
      throw new Error(`Shopify metafield update failed ${updateRes.status}: ${msg.slice(0, 200)}`)
    }
    return
  }

  const msg = await createRes.text()
  throw new Error(`Shopify metafield create failed ${createRes.status}: ${msg.slice(0, 200)}`)
}
