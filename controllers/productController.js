import Product from '../models/Product.js';

// GET /api/products?page=1&pageSize=10
export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize) || 10);

    const skip = (page - 1) * pageSize;
    const filter = {}; // Add filters if needed

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort('name').skip(skip).limit(pageSize),
    ]);

    res.json({
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      products,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/products
export const createProduct = async (req, res, next) => {
  try {
    const { name, category, costPrice, sellingPrice, lowStockThreshold } = req.body;
    const product = new Product({ name, category, costPrice, sellingPrice, lowStockThreshold });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// PUT /api/products/:id
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, category, costPrice, sellingPrice, lowStockThreshold } = req.body;
    const product = await Product.findByIdAndUpdate(
      id,
      { name, category, costPrice, sellingPrice, lowStockThreshold },
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};
