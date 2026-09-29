import type { ProductCategory } from './types.js'

export const productCatalog = [
  { category: 'Face Wash', price_range: '₹299–₹599' },
  { category: 'Serums', price_range: '₹499–₹1,299' },
  { category: 'Sunscreens', price_range: '₹399–₹899' },
  { category: 'Toners', price_range: '₹349–₹699' },
  { category: 'Moisturizers', price_range: '₹399–₹999' },
  { category: 'Face Masks', price_range: '₹299–₹699' },
  { category: 'Lip Care', price_range: '₹199–₹499' },
  { category: 'Body Care', price_range: '₹299–₹899' },
  { category: 'Hair Care', price_range: '₹299–₹999' },
  { category: 'Perfumes / Fragrances', price_range: '₹599–₹1,499' },
] as const satisfies readonly ProductCategory[]
