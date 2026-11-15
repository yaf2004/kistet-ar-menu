const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const MenuCategory = require('../models/MenuCategory');
const Restaurant = require('../models/Restaurant');
const { protect, canAccessRestaurant } = require('../middleware/auth');
const orderCreationLimiter = require('../middleware/orderCreationLimiter');
const { ORDER_TRANSITIONS, canTransitionOrder } = require('../lib/orderState');
const { enforceLimit } = require('../lib/tenantEntitlements');

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function makeTrackingToken(restaurantId, idempotencyKey) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET)
    .update(`order-track:${restaurantId}:${idempotencyKey}`)
    .digest('base64url');
}

function money(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeRequestedItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    const error = new Error('Choose between 1 and 50 menu lines');
    error.status = 400;
    throw error;
  }
  const quantities = new Map();
  for (const line of items) {
    if (!line || !mongoose.isValidObjectId(line.itemId) ||
        !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1 || Number(line.quantity) > 50) {
      const error = new Error('Each order line needs a valid item and quantity between 1 and 50');
      error.status = 400;
      throw error;
    }
    const id = String(line.itemId);
    quantities.set(id, (quantities.get(id) || 0) + Number(line.quantity));
  }
  if ([...quantities.values()].some((quantity) => quantity > 50)) {
    const error = new Error('A menu item cannot be ordered more than 50 times');
    error.status = 400;
    throw error;
  }
  return quantities;
}

router.post('/:slug', orderCreationLimiter, async (req, res, next) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '');
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
    }

    const restaurant = await Restaurant.findOne({ slug, active: true }).select('_id slug currency tables.tableNumber').lean();
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });

    const token = makeTrackingToken(restaurant._id, idempotencyKey);
    const tokenHash = hash(token);
    const existingOrder = await Order.findOne({
      restaurant: restaurant._id,
      idempotencyKey
    }).select('+trackingTokenHash').lean();
    if (existingOrder) {
      return res.status(200).json({
        order: publicOrder(existingOrder),
        trackingToken: token,
        replayed: true
      });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyOrders = await Order.countDocuments({ restaurant: restaurant._id, createdAt: { $gte: monthStart } });
    await enforceLimit(restaurant._id, 'monthlyOrders', monthlyOrders);

    const requested = normalizeRequestedItems(req.body.items);
    const ids = [...requested.keys()];
    const activeCategoryIds = await MenuCategory.find({
      restaurant: restaurant._id,
      is_active: true
    }).distinct('_id');
    const menuItems = await MenuItem.find({
      _id: { $in: ids },
      restaurant: restaurant._id,
      category_id: { $in: activeCategoryIds },
      is_available: true
    }).select('name price is_available').lean();
    if (menuItems.length !== ids.length) {
      return res.status(409).json({ error: 'One or more selected items are unavailable. Refresh the menu and try again.' });
    }

    const lines = menuItems.map((item) => {
      const quantity = requested.get(String(item._id));
      const unitPrice = money(item.price);
      return {
        menuItem: item._id,
        name: item.name,
        unitPrice,
        quantity,
        lineTotal: money(unitPrice * quantity)
      };
    });
    const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));

    const tableNumber = req.body.tableNumber == null || req.body.tableNumber === ''
      ? null : String(req.body.tableNumber).trim();
    if (tableNumber && (!/^.{1,12}$/.test(tableNumber) ||
        !restaurant.tables?.some((table) => String(table.tableNumber) === tableNumber))) {
      return res.status(400).json({ error: 'The table number is not registered for this restaurant' });
    }

    const customerName = typeof req.body.customerName === 'string' ? req.body.customerName.trim().slice(0, 120) : '';
    const customerPhone = typeof req.body.customerPhone === 'string' ? req.body.customerPhone.trim().slice(0, 40) : '';
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 500) : '';
    if (customerName.length < 2) return res.status(400).json({ error: 'Please enter your name' });
    if (customerPhone && !/^[+0-9()\-\s]{6,40}$/.test(customerPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number' });
    }

    const orderNumber = `K${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const order = await Order.create({
      restaurant: restaurant._id,
      orderNumber,
      idempotencyKey,
      trackingTokenHash: tokenHash,
      items: lines,
      subtotal,
      total: subtotal,
      currency: restaurant.currency || '$',
      tableNumber,
      customerName,
      customerPhone: customerPhone || null,
      notes: notes || null,
      paymentMethod: 'pay_at_restaurant',
      paymentStatus: 'unpaid',
      statusHistory: [{ status: 'new', at: new Date(), actor: null }]
    });

    res.set('Cache-Control', 'no-store');
    return res.status(201).json({
      order: publicOrder(order.toObject()),
      trackingToken: token,
      replayed: false
    });
  } catch (err) {
    if (err.code === 11000 && req.params.slug) {
      try {
        const restaurant = await Restaurant.findOne({ slug: req.params.slug }).select('_id').lean();
        if (restaurant) {
          const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotencyKey || '');
          const existing = await Order.findOne({ restaurant: restaurant._id, idempotencyKey }).lean();
          if (existing) return res.status(200).json({
            order: publicOrder(existing),
            trackingToken: makeTrackingToken(restaurant._id, idempotencyKey),
            replayed: true
          });
        }
      } catch (lookupError) { return next(lookupError); }
    }
    return next(err);
  }
});

function staffOrder(order) {
  return {
    ...publicOrder(order),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    notes: order.notes,
    statusHistory: order.statusHistory || []
  };
}

function publicOrder(order) {
  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    items: order.items,
    subtotal: order.subtotal,
    total: order.total,
    currency: order.currency,
    tableNumber: order.tableNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt
  };
}

router.get('/track/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token || '');
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const order = await Order.findOne({ trackingTokenHash: hash(token) }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.set('Cache-Control', 'no-store');
    return res.json(publicOrder(order));
  } catch (err) { return next(err); }
});

router.get('/restaurant/:restaurantId', protect, async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    if (!mongoose.isValidObjectId(restaurantId)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    if (!canAccessRestaurant(req.user, restaurantId)) return res.status(403).json({ error: 'Not your restaurant' });
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 30));
    const filter = { restaurant: restaurantId };
    if (req.query.status) {
      if (!Object.prototype.hasOwnProperty.call(ORDER_TRANSITIONS, req.query.status)) {
        return res.status(400).json({ error: 'Invalid order status filter' });
      }
      filter.status = req.query.status;
    }
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Order.countDocuments(filter)
    ]);
    return res.json({ orders: orders.map(staffOrder), page, limit, total });
  } catch (err) { return next(err); }
});

router.patch('/:id/status', protect, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid order ID' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!canAccessRestaurant(req.user, order.restaurant)) return res.status(403).json({ error: 'Not your order' });
    const nextStatus = req.body.status;
    if (!canTransitionOrder(order.status, nextStatus)) {
      return res.status(409).json({ error: `Cannot move an order from ${order.status} to ${String(nextStatus)}` });
    }
    order.status = nextStatus;
    order.statusHistory.push({ status: nextStatus, actor: req.user._id, at: new Date() });
    try { await order.save(); }
    catch (err) {
      if (err.name === 'VersionError') return res.status(409).json({ error: 'This order changed in another session. Refresh and try again.' });
      throw err;
    }
    return res.json(staffOrder(order.toObject()));
  } catch (err) { return next(err); }
});

module.exports = router;
