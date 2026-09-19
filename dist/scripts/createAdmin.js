import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { AdminModel } from '../models/Admin.js';
dotenv.config();
async function createAdmin() {
    const { MONGODB_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, } = process.env;
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is required.');
    }
    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
        throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    }
    if (ADMIN_PASSWORD.length < 8) {
        throw new Error('Admin password must contain at least 8 characters.');
    }
    await mongoose.connect(MONGODB_URI);
    const email = ADMIN_EMAIL.toLowerCase().trim();
    const existingAdmin = await AdminModel.findOne({ email });
    if (existingAdmin) {
        console.log(`Admin already exists: ${email}`);
        await mongoose.disconnect();
        return;
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    const admin = await AdminModel.create({
        name: ADMIN_NAME.trim(),
        email,
        passwordHash,
        role: 'owner',
    });
    console.log('Admin created successfully.');
    console.log(`Name: ${admin.name}`);
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    await mongoose.disconnect();
}
createAdmin().catch(async (error) => {
    console.error('Failed to create admin:', error);
    await mongoose.disconnect().catch(() => { });
    process.exit(1);
});
