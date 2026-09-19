import { PriceAdjustment } from './types.js';

export function calculateNewPrice(currentPrice: number, adjustment: PriceAdjustment): number {
  let calculated = currentPrice;

  switch (adjustment.type) {
    case 'fixed':
      calculated = currentPrice + adjustment.value;
      break;
    case 'percent_increase':
      calculated = currentPrice + (currentPrice * adjustment.value / 100);
      break;
    case 'percent_decrease':
      calculated = currentPrice - (currentPrice * adjustment.value / 100);
      break;
    case 'set_price':
      calculated = adjustment.value;
      break;
    default:
      calculated = currentPrice;
  }

  // Never allow negative prices
  calculated = Math.max(0, calculated);

  // Apply rounding if requested
  if (adjustment.rounding && adjustment.rounding !== 'none') {
    const step = parseInt(adjustment.rounding, 10);
    if (!isNaN(step) && step > 0) {
      calculated = Math.round(calculated / step) * step;
    }
  } else {
    calculated = Math.round(calculated);
  }

  return calculated;
}
