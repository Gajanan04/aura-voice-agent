import { productCatalog } from '../data/productCatalog.js'
import type { ProductCatalogResult } from '../data/types.js'

/** Returns the approved product categories and category-level price ranges. */
export function get_product_catalog(): ProductCatalogResult {
  return { ok: true, categories: productCatalog }
}
