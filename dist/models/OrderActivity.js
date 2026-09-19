import mongoose, { Schema } from 'mongoose';
export const OrderActivitySchema = new Schema({
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    price: { type: Number, required: true },
    categoryName: { type: String, required: true },
    whatsappUrl: { type: String },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
export const OrderActivityModel = mongoose.models.OrderActivity || mongoose.model('OrderActivity', OrderActivitySchema);
