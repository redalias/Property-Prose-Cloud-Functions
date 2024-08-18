const stripeEvents = {
  checkoutSessionCompleted: "checkout.session.completed",
  customerSubscriptionDeleted: "customer.subscription.deleted",
  customerSubscriptionUpdated: "customer.subscription.updated",
  paymentIntentFailed: "payment_intent.failed",
  paymentIntentProcessing: "payment_intent.processing",
  paymentIntentSucceeded: "payment_intent.succeeded",
};

module.exports = stripeEvents;
