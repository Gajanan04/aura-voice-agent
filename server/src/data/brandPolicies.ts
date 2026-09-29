import type { BrandPolicyInfo } from './types.js'

export const brandPolicyInfo = {
  brand: {
    name: 'Aura Skincare',
    description: 'Premium organic Indian skincare brand focused on simple, effective skincare products with thoughtfully selected ingredients.',
  },
  shipping: {
    freeDeliveryAboveRupees: 499,
    feeBelowThresholdRupees: 50,
    standardDeliveryBusinessDays: { min: 3, max: 5 },
  },
  returnsAndRefunds: {
    returnWindowDays: 7,
    returnWindowMeasuredFrom: 'delivery',
    acceptedCondition: ['unopened', 'unused'],
    originalPackagingRequired: true,
    damagedDefectiveReportWindowHours: 48,
    damageReportWindowMeasuredFrom: 'delivery',
    damageReportRequiresPhotos: true,
    damageResolution: 'replacement',
  },
  cancellation: {
    cancellableStatus: 'Processing',
    nonCancellableStatuses: ['Shipped', 'Out for Delivery'],
    mayRefuseDeliveryAtDoorstep: true,
  },
  cod: {
    maximumOrderValueRupees: 2500,
    doorstepPaymentMethods: ['cash', 'UPI'],
  },
} as const satisfies BrandPolicyInfo
