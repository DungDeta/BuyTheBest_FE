export type ProductCondition = 'new' | 'like_new' | 'used' | 'refurbished'

export interface PublicProductCategory {
  id: number
  name: string
  slug: string
}

export interface PublicProductSeller {
  id: number
  public_id?: string
  display_name: string
  shop_name?: string
  description?: string
  avg_rating?: number
  total_sales?: number
}

export interface PublicProductImage {
  id: number
  url: string
  sort_order: number
  is_primary: boolean
}

export interface PublicProductListItem {
  id: string
  title: string
  slug: string
  condition: ProductCondition | string
  status: string
  category_id: number
  seller_id: number
  category?: PublicProductCategory | null
  seller?: PublicProductSeller | null
  cover?: PublicProductImage | null
  created_at: string
}

export interface PublicProduct extends PublicProductListItem {
  description: string
  images: PublicProductImage[]
  updated_at: string
}

export interface PublicProductListResponse {
  items: PublicProductListItem[]
  total: number
  limit: number
  offset: number
}
