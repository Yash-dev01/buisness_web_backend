import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';

import { requireAuth, generateToken } from './auth.js';
import { ProductModel } from './models/Product.js';
import { CategoryModel } from './models/Category.js';
import { StoreSettingsModel } from './models/StoreSettings.js';
import { AdminModel } from './models/Admin.js';
import { OrderActivityModel } from './models/OrderActivity.js';

import { uploadToCloudinary, deleteFromCloudinary } from './cloudinary.js';
import { calculateNewPrice } from './priceCalculator.js';
import { isDbConnected } from './db.js';

import { PriceAdjustment } from './types.js';
import mongoose from 'mongoose';
export const apiRouter = Router();

function requireDatabase(res: Response): boolean {
  if (!isDbConnected()) {
    res.status(503).json({
      error: 'Database is not connected',
    });
    return false;
  }

  return true;
}

// ------------------------------------------------------------
// Slugify helper
// ------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// ------------------------------------------------------------
// SETTINGS
// ------------------------------------------------------------

apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    if (!requireDatabase(res)) return;

    const settings = await StoreSettingsModel.findOne().lean();

    if (!settings) {
      res.status(404).json({
        error: 'Store settings not configured',
      });
      return;
    }

    res.json(settings);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to fetch store settings',
    });
  }
});

apiRouter.put(
  '/settings',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const updateData = req.body;

      const settings = await StoreSettingsModel.findOneAndUpdate(
        {},
        { $set: updateData },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      ).lean();

      res.json(settings);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to update store settings',
      });
    }
  }
);

// ------------------------------------------------------------
// CATEGORIES
// ------------------------------------------------------------

apiRouter.get('/categories', async (req: Request, res: Response) => {
  try {
    if (!requireDatabase(res)) return;

    const categories = await CategoryModel.find()
      .sort({ createdAt: -1 })
      .lean();

    const counts = await ProductModel.aggregate([
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(
      counts.map((item) => [String(item._id), item.count])
    );

    const enriched = categories.map((category) => ({
      ...category,
      id: category._id.toString(),
      productCount: countMap.get(category._id.toString()) || 0,
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to fetch categories',
    });
  }
});

apiRouter.post(
  '/categories',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { name, image } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({
          error: 'Category name is required',
        });
        return;
      }

      const slug = slugify(name);

      const existing = await CategoryModel.findOne({ slug });

      if (existing) {
        res.status(400).json({
          error: 'A category with this name already exists',
        });
        return;
      }

      const newCategory = await CategoryModel.create({
        name: name.trim(),
        slug,
        image: image || '',
      });

      res.status(201).json({
        ...newCategory.toObject(),
        id: newCategory._id.toString(),
        productCount: 0,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to create category',
      });
    }
  }
);

apiRouter.put(
  '/categories/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { id } = req.params;
      const { name, image } = req.body;

      if (!name || !name.trim()) {
        res.status(400).json({
          error: 'Category name is required',
        });
        return;
      }

      const category = await CategoryModel.findById(id);

      if (!category) {
        res.status(404).json({
          error: 'Category not found',
        });
        return;
      }

      const slug = slugify(name);

      const duplicate = await CategoryModel.findOne({
        slug,
        _id: { $ne: id },
      });

      if (duplicate) {
        res.status(400).json({
          error: 'A category with this name already exists',
        });
        return;
      }

      category.name = name.trim();
      category.slug = slug;

      if (image !== undefined) {
        category.image = image;
      }

      await category.save();

      res.json({
        ...category.toObject(),
        id: category._id.toString(),
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to update category',
      });
    }
  }
);

apiRouter.delete(
  '/categories/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { id } = req.params;

      const productCount = await ProductModel.countDocuments({
        categoryId: id,
      });

      if (productCount > 0) {
        res.status(400).json({
          error: `Cannot delete category. It contains ${productCount} products. Move or delete them first.`,
        });
        return;
      }

      const deleted = await CategoryModel.findByIdAndDelete(id);

      if (!deleted) {
        res.status(404).json({
          error: 'Category not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Category deleted',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to delete category',
      });
    }
  }
);

// ------------------------------------------------------------
// PRODUCTS
// ------------------------------------------------------------

apiRouter.get('/products', async (req: Request, res: Response) => {
  try {
    if (!requireDatabase(res)) return;

    const {
      search,
      category,
      available,
      sort,
      featured,
    } = req.query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        {
          name: {
            $regex: String(search),
            $options: 'i',
          },
        },
        {
          description: {
            $regex: String(search),
            $options: 'i',
          },
        },
      ];
    }

    if (category && category !== 'all') {
  let matchedCategory;

  if (mongoose.isValidObjectId(category)) {
    matchedCategory = await CategoryModel.findOne({
      $or: [
        { slug: String(category) },
        { _id: category },
      ],
    }).lean();
  } else {
    matchedCategory = await CategoryModel.findOne({
      slug: String(category),
    }).lean();
  }

  if (matchedCategory) {
    filter.categoryId = matchedCategory._id.toString();
  } else {
    filter.categoryId = '__category_not_found__';
  }
}

    if (available === 'true') {
      filter.available = true;
    } else if (available === 'false') {
      filter.available = false;
    }

    if (featured === 'true') {
      filter.featured = true;
    }

    let sortOptions: any = {
      createdAt: -1,
    };

    if (sort === 'price_asc') {
      sortOptions = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOptions = { price: -1 };
    } else if (sort === 'name') {
      sortOptions = { name: 1 };
    }

    const products = await ProductModel.find(filter)
      .sort(sortOptions)
      .lean();

    const categories = await CategoryModel.find().lean();

    const categoryMap = new Map(
      categories.map((category) => [
        category._id.toString(),
        category.name,
      ])
    );

    const enriched = products.map((product) => ({
      ...product,
      id: product._id.toString(),
      categoryName:
        categoryMap.get(product.categoryId) || 'General',
    }));

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to fetch products',
    });
  }
});

apiRouter.get(
  '/products/:slugOrId',
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { slugOrId } = req.params;

      let product: any = null;

      if (/^[0-9a-fA-F]{24}$/.test(slugOrId)) {
        product = await ProductModel.findById(slugOrId).lean();
      }

      if (!product) {
        product = await ProductModel.findOne({
          slug: slugOrId,
        }).lean();
      }

      if (!product) {
        res.status(404).json({
          error: 'Product not found',
        });
        return;
      }

      const category = await CategoryModel.findById(
        product.categoryId
      ).lean();

      res.json({
        ...product,
        id: product._id.toString(),
        categoryName: category?.name || 'General',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to fetch product',
      });
    }
  }
);

apiRouter.post(
  '/products',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const {
        name,
        price,
        categoryId,
        description,
        images,
        available,
        featured,
      } = req.body;

      if (!name || price === undefined || !categoryId) {
        res.status(400).json({
          error: 'Name, price, and category are required',
        });
        return;
      }

      const category = await CategoryModel.findById(categoryId).lean();

      if (!category) {
        res.status(400).json({
          error: 'Selected category does not exist',
        });
        return;
      }

      const baseSlug = slugify(name);
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const parsedPrice = Math.max(
        0,
        Number(price) || 0
      );

      const sanitizedImages = Array.isArray(images)
        ? images.slice(0, 8).map((img: any, index: number) => ({
            url: img.url,
            publicId:
              img.publicId ||
              `img_${Date.now()}_${index}`,
            alt: img.alt || name,
          }))
        : [];

      const newProduct = await ProductModel.create({
        name: name.trim(),
        slug,
        description: description || '',
        price: parsedPrice,
        categoryId,
        images: sanitizedImages,
        available:
          available !== undefined ? Boolean(available) : true,
        featured: Boolean(featured),
      });

      res.status(201).json({
        ...newProduct.toObject(),
        id: newProduct._id.toString(),
        categoryName: category.name,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to create product',
      });
    }
  }
);

apiRouter.put(
  '/products/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { id } = req.params;

      const {
        name,
        price,
        categoryId,
        description,
        images,
        available,
        featured,
      } = req.body;

      const product = await ProductModel.findById(id);

      if (!product) {
        res.status(404).json({
          error: 'Product not found',
        });
        return;
      }

      const parsedPrice =
        price !== undefined
          ? Math.max(0, Number(price) || 0)
          : undefined;

      if (name) {
        product.name = name.trim();
      }

      if (parsedPrice !== undefined) {
        product.price = parsedPrice;
      }

      if (categoryId) {
        const category = await CategoryModel.findById(categoryId);

        if (!category) {
          res.status(400).json({
            error: 'Selected category does not exist',
          });
          return;
        }

        product.categoryId = categoryId;
      }

      if (description !== undefined) {
        product.description = description;
      }

      if (Array.isArray(images)) {
        product.images = images.slice(0, 8);
      }

      if (available !== undefined) {
        product.available = Boolean(available);
      }

      if (featured !== undefined) {
        product.featured = Boolean(featured);
      }

      await product.save();

      const category = await CategoryModel.findById(
        product.categoryId
      ).lean();

      res.json({
        ...product.toObject(),
        id: product._id.toString(),
        categoryName: category?.name || 'General',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to update product',
      });
    }
  }
);

apiRouter.delete(
  '/products/:id',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { id } = req.params;

      const product = await ProductModel.findById(id);

      if (!product) {
        res.status(404).json({
          error: 'Product not found',
        });
        return;
      }

      for (const image of product.images) {
        if (image.publicId) {
          await deleteFromCloudinary(image.publicId);
        }
      }

      await ProductModel.findByIdAndDelete(id);

      res.json({
        success: true,
        message: 'Product deleted',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to delete product',
      });
    }
  }
);

// ------------------------------------------------------------
// BULK PRICE PREVIEW
// ------------------------------------------------------------

apiRouter.post(
  '/products/bulk-preview',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const {
        productIds,
        adjustment,
      }: {
        productIds: string[];
        adjustment: PriceAdjustment;
      } = req.body;

      if (
        !Array.isArray(productIds) ||
        productIds.length === 0 ||
        !adjustment
      ) {
        res.status(400).json({
          error: 'Product IDs and adjustment rule are required',
        });
        return;
      }

      const products = await ProductModel.find({
        _id: { $in: productIds },
      }).lean();

      const previewItems = products.map((product) => {
        const currentPrice = product.price;
        const newPrice = calculateNewPrice(
          currentPrice,
          adjustment
        );

        return {
          id: product._id.toString(),
          name: product.name,
          currentPrice,
          newPrice,
          difference: newPrice - currentPrice,
        };
      });

      res.json(previewItems);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to generate price preview',
      });
    }
  }
);

// ------------------------------------------------------------
// BULK OPERATIONS
// ------------------------------------------------------------

apiRouter.post(
  '/products/bulk',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const {
        action,
        productIds,
        adjustment,
        categoryId,
        available,
      } = req.body;

      if (
        !Array.isArray(productIds) ||
        productIds.length === 0
      ) {
        res.status(400).json({
          error: 'No products specified for bulk operation',
        });
        return;
      }

      // PRICE
      if (action === 'price') {
        if (!adjustment) {
          res.status(400).json({
            error: 'Price adjustment details required',
          });
          return;
        }

        const products = await ProductModel.find({
          _id: { $in: productIds },
        });

        const bulkOperations = products.map((product) => ({
          updateOne: {
            filter: { _id: product._id },
            update: {
              $set: {
                price: calculateNewPrice(
                  product.price,
                  adjustment
                ),
              },
            },
          },
        }));

        if (bulkOperations.length > 0) {
          await ProductModel.bulkWrite(bulkOperations);
        }

        res.json({
          success: true,
          count: bulkOperations.length,
          message: `${bulkOperations.length} product prices updated`,
        });

        return;
      }

      // CATEGORY
      if (action === 'category') {
        if (!categoryId) {
          res.status(400).json({
            error: 'Category ID required',
          });
          return;
        }

        const category = await CategoryModel.findById(
          categoryId
        );

        if (!category) {
          res.status(400).json({
            error: 'Category not found',
          });
          return;
        }

        const result = await ProductModel.updateMany(
          {
            _id: { $in: productIds },
          },
          {
            $set: {
              categoryId,
            },
          }
        );

        res.json({
          success: true,
          count: result.modifiedCount,
          message: `Category updated for ${result.modifiedCount} products`,
        });

        return;
      }

      // AVAILABILITY
      if (action === 'availability') {
        const isAvailable = Boolean(available);

        const result = await ProductModel.updateMany(
          {
            _id: { $in: productIds },
          },
          {
            $set: {
              available: isAvailable,
            },
          }
        );

        res.json({
          success: true,
          count: result.modifiedCount,
          message: `Availability updated for ${result.modifiedCount} products`,
        });

        return;
      }

      // DELETE
      if (action === 'delete') {
        const products = await ProductModel.find({
          _id: { $in: productIds },
        });

        for (const product of products) {
          for (const image of product.images) {
            if (image.publicId) {
              await deleteFromCloudinary(image.publicId);
            }
          }
        }

        const result = await ProductModel.deleteMany({
          _id: { $in: productIds },
        });

        res.json({
          success: true,
          count: result.deletedCount,
          message: `${result.deletedCount} products deleted`,
        });

        return;
      }

      res.status(400).json({
        error: 'Unknown bulk action',
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Bulk operation failed',
      });
    }
  }
);

// ------------------------------------------------------------
// IMAGE UPLOAD
// ------------------------------------------------------------

apiRouter.post(
  '/upload',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({
          error: 'Image file or base64 data required',
        });
        return;
      }

      const uploaded = await uploadToCloudinary(image);

      res.json(uploaded);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Image upload failed',
      });
    }
  }
);

// ------------------------------------------------------------
// AUTHENTICATION
// ------------------------------------------------------------

apiRouter.post(
  '/auth/login',
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          error: 'Email and password are required',
        });
        return;
      }

      const admin = await AdminModel.findOne({
        email: email.toLowerCase().trim(),
      });

      if (!admin) {
        res.status(401).json({
          error: 'Invalid email or password',
        });
        return;
      }

      const isMatch = bcrypt.compareSync(
        password,
        admin.passwordHash
      );

      if (!isMatch) {
        res.status(401).json({
          error: 'Invalid email or password',
        });
        return;
      }

      const token = generateToken({
        id: admin._id.toString(),
        email: admin.email,
        name: admin.name,
        role: admin.role,
      });

      res.json({
        token,
        user: {
          id: admin._id.toString(),
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Login failed',
      });
    }
  }
);

apiRouter.get(
  '/auth/me',
  requireAuth,
  async (req: Request, res: Response) => {
    const user = (req as any).user;

    res.json({
      user,
    });
  }
);

// ------------------------------------------------------------
// DASHBOARD STATS
// ------------------------------------------------------------

apiRouter.get(
  '/stats',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const [
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        whatsappOrders,
      ] = await Promise.all([
        ProductModel.countDocuments(),
        ProductModel.countDocuments({
          available: true,
        }),
        ProductModel.countDocuments({
          available: false,
        }),
        OrderActivityModel.countDocuments(),
      ]);

      res.json({
        totalProducts,
        inStockProducts,
        outOfStockProducts,
        orders: whatsappOrders,
        totalOrders: whatsappOrders,
        websiteViews: 0,
        whatsappOrders,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to fetch statistics',
      });
    }
  }
);

// ------------------------------------------------------------
// ORDERS / WHATSAPP ACTIVITY
// ------------------------------------------------------------

apiRouter.get(
  '/orders',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const orders = await OrderActivityModel.find()
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      res.json(
        orders.map((order) => ({
          ...order,
          timestamp: order.createdAt.toISOString(),
        }))
      );
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to fetch orders',
      });
    }
  }
);

apiRouter.post(
  '/orders/log',
  async (req: Request, res: Response) => {
    try {
      if (!requireDatabase(res)) return;

      const {
        productId,
        productName,
        price,
        categoryName,
        whatsappUrl,
      } = req.body;

      await OrderActivityModel.create({
        productId: productId || 'unknown',
        productName:
          productName || 'Catalogue Product',
        price: Number(price) || 0,
        categoryName:
          categoryName || 'General',
        whatsappUrl,
      });

      res.json({
        success: true,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to log order',
      });
    }
  }
);