const config = require("../values/config");
const firebaseAdmin = require("firebase-admin");
const firebaseRemoteConfig = require("./firebase-remote-config");
const firestoreService = require("./firestore-service");
const stripeEvents = require("../values/stripe-events");

// Fetch Stripe keys from Firebase Remote Config.
const createRemoteConfigStrings = async () => {
  try {
    const remoteConfigParameterName = config.stripeRemoteConfigKeys.remoteConfigParameterName;

    const stripeRemoteConfig = {
      paymentSuccessfulText: await firebaseRemoteConfig.getParameterFromGroup(
        remoteConfigParameterName,
        config.stripeRemoteConfigKeys.paymentSuccessfulText,
      ),
      priceId: await firebaseRemoteConfig.getParameterFromGroup(
        remoteConfigParameterName,
        config.stripeRemoteConfigKeys.priceId,
      ),
      secretKey: await firebaseRemoteConfig.getParameterFromGroup(
        remoteConfigParameterName,
        config.stripeRemoteConfigKeys.secretKey,
      ),
      webhookSecret: await firebaseRemoteConfig.getParameterFromGroup(
        remoteConfigParameterName,
        config.stripeRemoteConfigKeys.webhookSecret,
      ),
    };

    console.log(stripeRemoteConfig);

    return stripeRemoteConfig;
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

async function upgradeCustomerSubscription(event) {
  console.log("Upgrading customer subscription");

  const data = event.data.object;

  // Update the user's subscription in Firestore.
  await firestoreService.updateUser(
    data.metadata.firebase_user_id,
    {
      subscription: {
        date_upgraded: firebaseAdmin.firestore.Timestamp.now(),
        latest_invoice_id: data.id,
        status: "Pro",
        stripe_customer_id: data.customer,
        subscription_id: data.subscription,
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

  const currentPeriodStartBefore = event.data.previous_attributes.current_period_start;
  const currentPeriodStartAfter = event.data.object.current_period_start;

  const currentPeriodEndBefore = event.data.previous_attributes.current_period_end;
  const currentPeriodEndAfter = event.data.object.current_period_end;

  if (cancelAtPeriodEndBefore == false && cancelAtPeriodEndAfter == true) {
    // The customer has set to cancel their subscription at the end of
    // their current billing period. Update the user's subscription in
    // Firestore.
    console.log("Cancelling customer subscription at end of billing period");

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(event.data.object.customer);

    // Update the user's subscription in Firestore.
    await firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        subscription: {
          date_cancelled: firebaseAdmin.firestore.Timestamp.now(),
          status: "Pro (pending downgrade)",
          stripe_customer_id: event.data.object.customer,
        }
      },
    );
  } else if (cancelAtPeriodEndBefore == true && cancelAtPeriodEndAfter == false) {
    // The customer has reactivated their subscription after previously
    // setting it to cancel.
    console.log("Reactivating customer subscription");

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(event.data.object.customer);

    // Update the user's subscription in Firestore.
    await firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        subscription: {
          date_reactivated: firebaseAdmin.firestore.Timestamp.now(),
          status: "Pro",
          stripe_customer_id: event.data.object.customer,
          subscription_id: event.data.object.id,
        }
      },
    );

  } else if ((currentPeriodStartBefore != currentPeriodStartAfter) &&
    (currentPeriodEndBefore != currentPeriodEndAfter)) {
    // The customer has renewed their subscription for another billing period.
    console.log("Renewing customer subscription for another billing period");

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(event.data.object.customer);

    // Update the user's subscription in Firestore.
    await firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        subscription: {
          date_renewed: firebaseAdmin.firestore.Timestamp.now(),
          latest_invoice_id: event.data.object.id,
          status: "Pro",
          subscription_id: event.data.object.subscription,
        }
      },
    );
  }
}

async function downgradeCustomerSubscription(event) {
  console.log("Downgrading customer subscription");

  const data = event.data.object;

  // Fetch the customer from Stripe and get their Firebase user ID.
  const customer = await getCustomer(data.customer);

  // Update the user's subscription status in Firebase.
  await firestoreService.updateUser(
    customer.metadata.firebase_user_id,
    {
      "subscription.status": "Free",
    },
  );
}

async function getCustomer(customerId) {
  console.log("Getting customer " + customerId + " from Stripe");

  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Get the customer.
  const customer = await stripe.customers.retrieve(customerId);

  console.log('Customer:');
  console.log(customer);

  return customer;
}

async function updateCustomer(customerId, data) {
  console.log("Updating customer details");

  // Initialise Stripe.
  const stripeConfig = await createRemoteConfigStrings();
  const stripe = require("stripe")(stripeConfig.secretKey);

  // Call the Stripe API to update the customer's details.
  return await stripe.customers.update(
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
  console.log("Webhook supports this Stripe event? " + isSupportedStripeEvent);

  if (isSupportedStripeEvent) {
    switch (event.type) {
      case stripeEvents.checkoutSessionCompleted:
        // The customer upgraded from Free to Pro.
        await upgradeCustomerSubscription(event);
        break;

      case stripeEvents.customerSubscriptionUpdated:
        // The customer updated their subscription. For example, they renewed,
        // canceled, or reactivated it.
        await updateCustomerSubscription(event);
        break;

      case stripeEvents.customerSubscriptionDeleted:
        // The customer's pending subscription downgrade has taken effect.
        await downgradeCustomerSubscription(event);
        break;
    }

    console.log("Webhook handled successfully for event " + event.id);
  } else {
    throw new Error(`Unhandled event type: ${event.type}`);
  }
}

module.exports = {
  createPaymentLink,
  createCustomerPortalSession,
  createRemoteConfigStrings,
  upgradeCustomerSubscription,
  updateCustomerSubscription,
  downgradeCustomerSubscription,
  updateCustomer,
  webhook,
};
