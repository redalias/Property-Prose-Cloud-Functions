const config = require("../values/config");
const firebaseAdmin = require("firebase-admin");
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

async function upgradeCustomerPlan(event) {
  console.log("Upgrading customer plan");

  const data = event.data.object;

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

  // Add the user's Firebase ID as metadata in their Stripe customer
  // profile.
  await updateCustomer(
    data.customer,
    {
      metadata: {
        firebase_user_id: data.client_reference_id,
      }
    }
  );
}

async function updateCustomerSubscription(event) {
  console.log("Updating customer subscription");

  const cancelAtPeriodEndBefore = event.data.previous_attributes.cancel_at_period_end;
  const cancelAtPeriodEndAfter = event.data.object.cancel_at_period_end;

  if (cancelAtPeriodEndBefore == false && cancelAtPeriodEndAfter == true) {
    // The customer has set to cancel their subscription at the end of
    // their current billing period. Update the user's membership in
    // Firestore.
    console.log("Cancelling customer subscription at end of billing period");

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(event.data.object.customer);

    // Update the user's membership in Firestore.
    await firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        "membership.plan": "Pro (pending downgrade)",
      },
    );
  } else if (cancelAtPeriodEndBefore == true && cancelAtPeriodEndAfter == false) {
    // The customer has renewed their subscription after previously
    //setting it to cancel.
    console.log("Renewing customer subscription");

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(event.data.object.customer);

    // Update the user's membership in Firestore.
    await firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        "membership.plan": "Pro",
      },
    );
  }
}

async function downgradeCustomerPlan(event) {
  console.log("Downgrading customer plan");

  const data = event.data.object;

  // Fetch the customer from Stripe and get their Firebase user ID.
  const customer = await getCustomer(data.customer);

  // Update the user's membership status in Firebase.
  await firestoreService.updateUser(
    customer.metadata.firebase_user_id,
    {
      "membership.plan": "Free",
    },
  );
}

async function getCustomer(customerId) {
  console.log("Getting customer " + customerId + " from Stripe");

  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  return await stripe.customers.retrieve(customerId);
}

async function updateCustomer(customerId, data) {
  console.log("Updating customer details");

  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Call the Stripe API to update the customer's details.
  await stripe.customers.update(
    customerId,
    data,
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

  console.log("Event:");
  console.log(event);

  // Save the Stripe event to Firestore.
  await firestoreService.addStripeEvent(event);

  // Check which Stripe events can be handled by this webhoook.
  const supportedStripeEvents = Object.values(stripeEvents);
  const isSupportedStripeEvent = supportedStripeEvents.indexOf(event.type) > -1;

  if (isSupportedStripeEvent) {
    switch (event.type) {
      case stripeEvents.checkoutSessionCompleted:
        // The customer upgraded from Free to Pro.
        await upgradeCustomerPlan(event);
        break;

      case stripeEvents.customerSubscriptionUpdated:
        // The customer updated their subscription.
        await updateCustomerSubscription(event);
        break;

      case stripeEvents.customerSubscriptionDeleted:
        // The customer's pending subscription downgrade has taken effect.
        await downgradeCustomerPlan(event);
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
