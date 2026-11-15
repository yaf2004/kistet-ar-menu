const Plan = require('../models/Plan');
const Restaurant = require('../models/Restaurant');
const Subscription = require('../models/Subscription');
const { PLAN_DEFINITIONS, createTrialDates } = require('./planCatalog');

async function ensurePlatformCatalog() {
  for (const definition of PLAN_DEFINITIONS) {
    const { code, ...fields } = definition;
    await Plan.findOneAndUpdate(
      { code },
      { $set: fields, $setOnInsert: { code } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }

  const starter = await Plan.findOne({ code: 'starter', active: true });
  if (!starter) throw new Error('The active Starter plan could not be initialized.');

  const restaurants = await Restaurant.find().select('_id').lean();
  const now = new Date();
  const trialDates = createTrialDates(now);
  if (restaurants.length) {
    await Subscription.bulkWrite(restaurants.map(({ _id }) => ({
      updateOne: {
        filter: { restaurant: _id },
        update: {
          $setOnInsert: {
            restaurant: _id,
            plan: starter._id,
            planCode: starter.code,
            status: 'trialing',
            ...trialDates
          }
        },
        upsert: true
      }
    })), { ordered: false });
  }
}

async function createDefaultTrial(restaurantId, assignedBy = null) {
  const starter = await Plan.findOne({ code: 'starter', active: true });
  if (!starter) throw new Error('The Starter plan is not initialized.');
  const dates = createTrialDates();
  return Subscription.create({
    restaurant: restaurantId,
    plan: starter._id,
    planCode: starter.code,
    status: 'trialing',
    ...dates,
    assignedBy
  });
}

module.exports = { ensurePlatformCatalog, createDefaultTrial };
