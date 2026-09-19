import mongoose, { Schema } from 'mongoose';
export const CategorySchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    image: { type: String, default: '' },
}, {
    timestamps: true,
});
export const CategoryModel = mongoose.models.Category || mongoose.model('Category', CategorySchema);
