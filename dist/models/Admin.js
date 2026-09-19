import mongoose, { Schema } from 'mongoose';
export const AdminSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'owner' },
}, {
    timestamps: true,
});
export const AdminModel = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
