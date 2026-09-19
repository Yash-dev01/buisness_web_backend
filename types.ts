export interface PriceAdjustment {
  type: 'fixed' | 'percent_increase' | 'percent_decrease' | 'set_price';
  value: number;
  rounding?: 'none' | '10' | '50' | '100';
}