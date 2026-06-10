import type { EcommerceProductType } from '@/types/data'

export const getDiscountAmount = (product: EcommerceProductType): number => {
  return product.sale?.type == 'amount' ? product.sale.discount : product.sale?.type == 'percent' ? (product.price / 100) * product.sale.discount : 0
}

export const getCalculatedPrice = (product: EcommerceProductType): number => {
  return getPreciseCurrency(product.price - getDiscountAmount(product))
}

export const getPreciseCurrency = (price: number): number => {
  return parseFloat(price.toFixed(2))
}
