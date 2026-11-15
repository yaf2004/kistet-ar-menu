const router = require('express').Router();
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Restaurant = require('../models/Restaurant');
const { protect, requireSuperAdmin, canAccessRestaurant } = require('../middleware/auth');
const { PLAN_DEFINITIONS, subscriptionIsUsable, createTrialDates } = require('../lib/planCatalog');

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await Plan.find({ active: true }).select('-__v').sort({ sortOrder: 1 }).lean();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    res.json(plans);
  } catch (err) { next(err); }
});

router.get('/current', protect, async (req, res, next) => {
  try {
    const restaurantId = req.user.role === 'super_admin'
      ? req.query.restaurantId
      : req.user.restaurant;
    if (!mongoose.isValidObjectId(restaurantId)) {
      return res.status(400).json({ error: 'A valid restaurantId is required' });
    }
    if (!canAccessRestaurant(req.user, restaurantId)) {
      return res.status(403).json({ error: 'Not your restaurant' });
    }
    const subscription = await Subscription.findOne({ restaurant: restaurantId })
      .populate('plan').populate('restaurant', 'name slug active').lean();
    if (!subscription) return res.status(404).json({ error: 'Subscription not found' });
    res.set('Cache-Control', 'no-store');
    res.json({ ...subscription, accessEnabled: subscriptionIsUsable(subscription) });
  } catch (err) { next(err); }
});

router.get('/', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.status) {
      if (!['trialing', 'active', 'past_due', 'canceled', 'suspended'].includes(req.query.status)) {
        return res.status(400).json({ error: 'Invalid subscription status' });
      }
      filter.status = req.query.status;
    }
    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter).populate('restaurant', 'name slug active')
        .populate('plan', 'code name limits features').sort({ updatedAt: -1 })
        .skip((page - 1) * limit).limit(limit).lean(),
      Subscription.countDocuments(filter)
    ]);
    res.json({ subscriptions: subscriptions.map((entry) => ({
      ...entry,
      accessEnabled: subscriptionIsUsable(entry)
    })), page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/:restaurantId', protect, requireSuperAdmin, async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    if (!mongoose.isValidObjectId(restaurantId)) return res.status(400).json({ error: 'Invalid restaurant ID' });
    if (!await Restaurant.exists({ _id: restaurantId })) return res.status(404).json({ error: 'Restaurant not found' });

    const allowedStatuses = ['trialing', 'active', 'past_due', 'canceled', 'suspended'];
    const data = {};
    if (req.body.planCode !== undefined) {
      if (typeof req.body.planCode !== 'string' || !PLAN_DEFINITIONS.some((plan) => plan.code === req.body.planCode)) {
        return res.status(400).json({ error: 'Choose a supported plan code' });
      }
      const plan = await Plan.findOne({ code: req.body.planCode, active: true });
      if (!plan) return res.status(400).json({ error: 'That plan is not currently available' });
      data.plan = plan._id;
      data.planCode = plan.code;
    }
    if (req.body.status !== undefined) {
      if (!allowedStatuses.includes(req.body.status)) return res.status(400).json({ error: 'Invalid subscription status' });
      data.status = req.body.status;
      if (req.body.status === 'active') data.canceledAt = null;
      if (req.body.status === 'canceled' || req.body.status === 'suspended') data.canceledAt = new Date();
    }
    if (req.body.trialEndsAt !== undefined) {
      const date = new Date(req.body.trialEndsAt);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid trial end date' });
      data.trialEndsAt = date;
    }
    if (req.body.currentPeriodEnd !== undefined) {
      const date = new Date(req.body.currentPeriodEnd);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid period end date' });
      data.currentPeriodEnd = date;
    }
    if (req.body.adminNotes !== undefined) {
      if (typeof req.body.adminNotes !== 'string' || req.body.adminNotes.length > 1000) {
        return res.status(400).json({ error: 'Admin notes must be 1000 characters or fewer' });
      }
      data.adminNotes = req.body.adminNotes.trim();
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No subscription changes supplied' });

    const subscription = await Subscription.findOneAndUpdate(
      { restaurant: restaurantId },
      {
        $set: data,
        $setOnInsert: {
          restaurant: restaurantId,
          ...(data.planCode ? {} : {
            planCode: 'starter',
            plan: (await Plan.findOne({ code: 'starter' }))._id
          }),
          status: data.status || 'trialing',
          ...createTrialDates()
        }
      },
      { upsert: true, new: true, runValidators: true }
    ).populate('restaurant', 'name slug active').populate('plan', 'code name limits features');
    res.json({ ...subscription.toObject(), accessEnabled: subscriptionIsUsable(subscription.toObject()) });
  } catch (err) { next(err); }
});

module.exports = router;
