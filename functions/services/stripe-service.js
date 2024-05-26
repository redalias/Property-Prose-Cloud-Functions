const firebaseAdmin = require("firebase-admin");
const config = require("../values/config");
const firebaseRemoteConfig = require("./firebase-remote-config");
const firestoreService = require("./firestore-service");
const stripeEvents = require("../values/stripe-events");
const stripeRemoteConfigKeys = require("../values/stripe-remote-config-keys");

// Fetch Stripe keys from Firebase Remote Config.
const createRemoteConfigStrings = async () => {
  try {
    const customerPortalUrl = config.isTestMode ?
      stripeRemoteConfigKeys.customerPortalTestModeUrl :
      stripeRemoteConfigKeys.customerPortalLiveModeUrl;

    const secretKey = config.isTestMode ?
      stripeRemoteConfigKeys.secretTestModeKey :
      stripeRemoteConfigKeys.secretLiveModeKey;

    const webhookSecret = config.isTestMode ?
      stripeRemoteConfigKeys.webhookTestModeSecret :
      stripeRemoteConfigKeys.webhookLiveModeSecret;

    const priceId = config.isTestMode ?
      stripeRemoteConfigKeys.testModePriceId :
      stripeRemoteConfigKeys.liveModePriceId;

    const paymentSuccessfulText = stripeRemoteConfigKeys.paymentSuccessfulText;

    return {
      customerPortalUrl: await firebaseRemoteConfig.getParameterFromGroup(
        stripeRemoteConfigKeys.remoteConfigParameterName,
        customerPortalUrl,
      ),
      secretKey: await firebaseRemoteConfig.getParameterFromGroup(
        stripeRemoteConfigKeys.remoteConfigParameterName,
        secretKey,
      ),
      webhookSecret: await firebaseRemoteConfig.getParameterFromGroup(
        stripeRemoteConfigKeys.remoteConfigParameterName,
        webhookSecret,
      ),
      priceId: await firebaseRemoteConfig.getParameterFromGroup(
        stripeRemoteConfigKeys.remoteConfigParameterName,
        priceId,
      ),
      paymentSuccessfulText: await firebaseRemoteConfig.getParameterFromGroup(
        stripeRemoteConfigKeys.remoteConfigParameterName,
        paymentSuccessfulText,
      ),
    };
  } catch (error) {
    console.error(
      "Error fetching Stripe configuration from Remote Config:",
      error,
    );
    throw new Error("Failed to retrieve Stripe configuration");
  }
};

async function createCustomerPortalSession(request) {
  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Call the Stripe API to create a new customer portal session.
  return await stripe.billingPortal.sessions.create({
    customer: request.data.stripe_customer_id,
  });
}

async function createPaymentLink(request) {
  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Call the Stripe API to create a new payment link.
  return await stripe.paymentLinks.create({
    allow_promotion_codes: true,
    after_completion: {
      hosted_confirmation: {
        custom_message: stripeConfig.paymentSuccessfulText,
      },
      type: "hosted_confirmation",
    },
    line_items: [
      {
        price: stripeConfig.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      firebase_user_id: request.data.firebase_user_id,
    },
  });
}

async function upgradeCustomerPlan(data) {
  console.log("Upgrading customer plan");

  // Save payment details to Firestore.
  await firestoreService.addPayment({
    id: data.id,
    amount_subtotal: data.amount_subtotal,
    amount_total: data.amount_total,
    currency: data.currency,
    customer_id: data.customer,
    customer_details: data.customer_details,
    date_created_stripe: data.created,
    date_created_firestore: firebaseAdmin.firestore.Timestamp.now(),
    date_expired_stripe: data.expires_at,
    invoice_id: data.invoice,
    metadata: data.metadata,
    object: data.object,
    payment_link: data.payment_link,
    payment_status: data.payment_status,
    subscription_id: data.subscription,
    status: data.status,
    total_details: data.total_details,
    url: data.url,
    user_id: data.client_reference_id,
  });

  // Update the user's membership in Firestore.
  await firestoreService.updateUser(
    data.metadata.firebase_user_id,
    {
      membership: {
        date_latest_payment: firebaseAdmin.firestore.Timestamp.now(),
        latest_payment_id: data.id,
        plan: "Pro",
        stripe_customer_id: data.customer,
        latest_subscription_id: data.subscription,
      }
    },
  );
}

async function updateCustomerSubscription(data) {
  console.log("Updating customer subscription");

  if (data.cancel_at_period_end === true) {
    // The customer has set to cancel their subscription at the end of
    // their current billing period. Update the user's membership in
    // Firestore.
    await firestoreService.updateUser(
      data.metadata.firebase_user_id,
      {
        membership: {
          plan: "Pro (pending cancellation)",
        }
      },
    );
  }
}

async function updateCustomer(request) {
  console.log("Upgrading customer details");

  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Call the Stripe API to update the customer's details.
  await stripe.customers.update(
    request.data.stripe_customer_id,
    {
      email: request.data.email,
      name: request.data.name,
    }
  );
}

async function webhook(request) {
  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  const event = stripe.webhooks.constructEvent(
    request.rawBody,
    request.headers["stripe-signature"],
    stripeConfig.webhookSecret,
  );

  console.log("Event type: " + event.type);

  const data = event.data.object;
  console.log("Data:");
  console.log(data);

  // Check which Stripe events can be handled by this webhoook.
  const supportedStripeEvents = Object.values(stripeEvents);
  const isSupportedStripeEvent = supportedStripeEvents.indexOf(event.type) > -1;

  if (isSupportedStripeEvent) {
    switch (event.type) {
      case stripeEvents.checkoutSessionCompleted:
        // The customer upgraded from Free to Pro.
        await upgradeCustomerPlan(data);
        break;

      case stripeEvents.customerSubscriptionUpdated:
        // The customer updated their subscription.
        await updateCustomerSubscription(data);
        break;

      case stripeEvents.customerSubscriptionDeleted:
        // The customer's pending subscription downgrade has taken effect.
        await downgradeCustomerPlan(data);
        break;
    }
  } else {
    throw new Error(`Unhandled event type: ${event.type}`);
  }
}


module.exports = {
  createPaymentLink,
  createCustomerPortalSession,
  createRemoteConfigStrings,
  upgradeCustomerPlan,
  updateCustomerSubscription,
  updateCustomer,
  webhook,
};
