import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
dotenv.config();
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
export const isCloudinaryConfigured = Boolean(cloudName &&
    apiKey &&
    apiSecret);
if (!isCloudinaryConfigured) {
    console.warn('Cloudinary credentials are not configured.');
}
else {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });
}
export async function uploadToCloudinary(fileData, folder = 'khilona_point') {
    if (!isCloudinaryConfigured) {
        throw new Error('Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to backend/.env');
    }
    try {
        const uploadResult = await cloudinary.uploader.upload(fileData, {
            folder,
            resource_type: 'image',
            transformation: [
                {
                    quality: 'auto',
                    fetch_format: 'auto',
                },
            ],
        });
        return {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            alt: uploadResult.original_filename ||
                'Product Image',
        };
    }
    catch (err) {
        console.error('Cloudinary API upload error:', err);
        throw new Error(`Cloudinary upload failed: ${err?.message || 'Unknown error'}`);
    }
}
export async function deleteFromCloudinary(publicId) {
    if (!publicId) {
        return true;
    }
    if (!isCloudinaryConfigured) {
        console.warn('Cloudinary is not configured. Cannot delete:', publicId);
        return false;
    }
    try {
        await cloudinary.uploader.destroy(publicId);
        return true;
    }
    catch (err) {
        console.warn('Could not delete Cloudinary asset:', publicId, err);
        return false;
    }
}
