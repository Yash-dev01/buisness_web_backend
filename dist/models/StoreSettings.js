import mongoose, { Schema } from 'mongoose';
export const StoreSettingsSchema = new Schema({
    businessName: { type: String, default: 'Khilona Point' },
    tagline: { type: String, default: 'Toys | Cycles | Kids Happiness' },
    logo: { type: String, default: '🧸' },
    whatsappNumber: { type: String, default: '+919876543210' },
    phone: { type: String, default: '+91 98765 43210' },
    address: { type: String, default: 'Shop 4, Anand Vihar Market, Near City Park, Delhi' },
    about: { type: String, default: 'We bring toys, cycles and kids essentials together in one place to make shopping easy for parents and fun for little ones.' },
    instagram: { type: String, default: 'khilonapoint_toys' },
    facebook: { type: String, default: 'khilonapoint' },
    heroTitle: { type: String, default: 'Toys for Brighter Tomorrows' },
    heroSubtitle: { type: String, default: 'Quality toys, cycles and more for your little ones.' },
}, {
    timestamps: true,
});
export const StoreSettingsModel = mongoose.models.StoreSettings || mongoose.model('StoreSettings', StoreSettingsSchema);
