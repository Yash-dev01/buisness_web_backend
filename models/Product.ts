import mongoose, { Schema, Document } from 'mongoose';

export interface IProductImage {
  url: string;
  publicId: string;
  alt?: string;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  categoryId: string;
  images: IProductImage[];
  available: boolean;
  featured: boolean;
  rating?: number;
  reviewsCount?: number;
  stockCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProductImageSchema = new Schema<IProductImage>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  alt: { type: String, default: '' },
}, { _id: false });

export const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  categoryId: { type: String, required: true, index: true },
  images: { type: [ProductImageSchema], default: [] },
  available: { type: Boolean, default: true, index: true },
  featured: { type: Boolean, default: false },
  rating: { type: Number, default: 4.8 },
  reviewsCount: { type: Number, default: 42 },
  stockCount: { type: Number, default: 15 },
}, {
  timestamps: true,
});

ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ categoryId: 1, available: 1 });

export const ProductModel = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);
