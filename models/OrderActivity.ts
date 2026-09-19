import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderActivity extends Document {
  productId: string;
  productName: string;
  price: number;
  categoryName: string;
  whatsappUrl?: string;
  createdAt: Date;
}

export const OrderActivitySchema = new Schema<IOrderActivity>({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  categoryName: { type: String, required: true },
  whatsappUrl: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

export const OrderActivityModel = mongoose.models.OrderActivity || mongoose.model<IOrderActivity>('OrderActivity', OrderActivitySchema);
