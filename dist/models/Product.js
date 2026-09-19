import mongoose, { Schema } from 'mongoose';
const ProductImageSchema = new Schema({
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: '' },
}, { _id: false });
export const ProductSchema = new Schema({
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
export const ProductModel = mongoose.models.Product || mongoose.model('Product', ProductSchema);
