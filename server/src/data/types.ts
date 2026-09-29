export interface OrderSummary {
  readonly orderId: string
  readonly customer: string
  readonly product: string
  readonly valueRupees: number
}

export type Order =
  | (OrderSummary & {
      readonly status: 'Out for Delivery'
      readonly courier: string
      readonly tracking: string
      readonly expected: string
    })
  | (OrderSummary & {
      readonly status: 'Delivered'
      readonly courier: string
      readonly tracking: string
      readonly delivered: string
    })
  | (OrderSummary & {
      readonly status: 'Processing'
      readonly ordered: string
      readonly cancellation: 'Eligible'
    })

export interface ShippingPolicy {
  readonly freeDeliveryAboveRupees: number
  readonly feeBelowThresholdRupees: number
  readonly standardDeliveryBusinessDays: { readonly min: number; readonly max: number }
}

export interface ReturnsPolicy {
  readonly returnWindowDays: number
  readonly returnWindowMeasuredFrom: 'delivery'
  readonly acceptedCondition: readonly ['unopened', 'unused']
  readonly originalPackagingRequired: true
  readonly damagedDefectiveReportWindowHours: number
  readonly damageReportWindowMeasuredFrom: 'delivery'
  readonly damageReportRequiresPhotos: true
  readonly damageResolution: 'replacement'
}

export interface CancellationPolicy {
  readonly cancellableStatus: 'Processing'
  readonly nonCancellableStatuses: readonly ['Shipped', 'Out for Delivery']
  readonly mayRefuseDeliveryAtDoorstep: true
}

export interface CodPolicy {
  readonly maximumOrderValueRupees: number
  readonly doorstepPaymentMethods: readonly ['cash', 'UPI']
}

export interface BrandPolicyInfo {
  readonly brand: {
    readonly name: 'Aura Skincare'
    readonly description: string
  }
  readonly shipping: ShippingPolicy
  readonly returnsAndRefunds: ReturnsPolicy
  readonly cancellation: CancellationPolicy
  readonly cod: CodPolicy
}

export interface ProductCategory {
  readonly category: string
  readonly price_range: string
}

export interface ProductCatalogResult {
  readonly ok: true
  readonly categories: readonly ProductCategory[]
}

export interface InvalidToolArgumentsResult {
  readonly ok: false
  readonly error: {
    readonly code: 'INVALID_TOOL_ARGUMENTS'
    readonly message: string
  }
}

export type OrderLookupErrorCode = 'MISSING_ORDER_ID' | 'ORDER_NOT_FOUND'

export interface OrderLookupError {
  readonly code: OrderLookupErrorCode
  readonly message: string
}

export type OrderLookupResult =
  | { readonly ok: true; readonly order: Order }
  | { readonly ok: false; readonly error: OrderLookupError }
