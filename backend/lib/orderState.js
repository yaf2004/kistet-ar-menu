const ORDER_TRANSITIONS = Object.freeze({
  new: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed'],
  completed: [],
  cancelled: []
});

function canTransitionOrder(currentStatus, nextStatus) {
  return Boolean(ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus));
}

module.exports = { ORDER_TRANSITIONS, canTransitionOrder };
