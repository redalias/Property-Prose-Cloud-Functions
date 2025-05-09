const config = require("../values/config");
const firebaseAdmin = require("firebase-admin");
const stripeEvents = require("../values/stripe-events");

const FirebaseRemoteConfigService = require("./firebase-remote-config-service");
const FirestoreService = require("./firestore-service");
const LoggingService = require("./logging-service");

class StripeService {
  constructor() {
    this.log = new LoggingService(this.constructor.name);
    this.firebaseRemoteConfigService = new FirebaseRemoteConfigService();
    this.firestoreService = new FirestoreService();
  }

  // Fetch Stripe keys from Firebase Remote Config.
  async createRemoteConfigStrings() {
    try {
      const remoteConfigParameterName = config.stripeRemoteConfigKeys.remoteConfigParameterName;

      const stripeRemoteConfig = {
        paymentSuccessfulText: await this.firebaseRemoteConfigService.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.paymentSuccessfulText,
        ),
        priceIds: JSON.parse(await this.firebaseRemoteConfigService.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.priceIds,
        )),
        secretKey: await this.firebaseRemoteConfigService.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.secretKey,
        ),
        webhookSecret: await this.firebaseRemoteConfigService.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.webhookSecret,
        ),
      };

      this.log.info('Remote Config Strings:')
      this.log.info(this.log.formatObject(stripeRemoteConfig));

      return stripeRemoteConfig;
    } catch (error) {
      this.log.error(
        "Error fetching Stripe configuration from Remote Config:",
        error,
      );
      throw new Error("Failed to retrieve Stripe configuration");
    }
  }

  async createCustomerPortalSession(request) {
    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);

    // Call the Stripe API to create a new customer portal session.
    return await stripe.billingPortal.sessions.create({
      customer: request.data.stripe_customer_id,
    });
  }

  async createPaymentLink(firebaseUserId, plan, frequency) {
    try {
      // Initialise Stripe.
      const stripeConfig = await this.createRemoteConfigStrings();
      const stripe = require("stripe")(stripeConfig.secretKey);

      plan = plan.toLowerCase();
      frequency = frequency.toLowerCase();

      let planJson = stripeConfig.priceIds[plan][frequency][0];
      if (!planJson || !planJson["price_id"]) {
        this.log.error("Invalid plan or frequency. Plan JSON: " + JSON.stringify(planJson));
        throw new Error("Invalid plan or frequency");
      }
      this.log.info("Found pricing plan JSON: " + JSON.stringify(planJson));

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
            price: planJson["price_id"],
            quantity: 1,
          },
        ],
        metadata: {
          firebase_user_id: firebaseUserId,
        },
      });
    } catch (error) {
      this.log.error("Error creating payment link: ", error);
      throw new Error("Failed to create payment link");
    }
  }

  async upgradeCustomerSubscription(event) {
    this.log.info("Upgrading customer subscription");

    const data = event.data.object;

    // Fetch the subscription details from Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);
    const subscription = await stripe.subscriptions.retrieve(data.subscription);

    // Extract the frequency from the subscription.
    const frequency = subscription.items.data[0].plan.interval;

    this.log.info("data.id: " + data.id);
    this.log.info("data.customer: " + data.customer);
    this.log.info("data.client_reference_id: " + data.client_reference_id);
    this.log.info("data.subscription: " + data.subscription);
    this.log.info("Subscription frequency: " + frequency);

    // Update the user's subscription in Firestore.
    await this.firestoreService.updateUser(
      data.metadata.firebase_user_id,
      {
        subscription: {
          date_upgraded: firebaseAdmin.firestore.Timestamp.now(),
          latest_invoice_id: data.id,
          status: "Pro",
          stripe_customer_id: data.customer,
          subscription_id: data.subscription,
          frequency: frequency,
          amount: subscription.items.data[0].plan.amount,
          currency: subscription.items.data[0].plan.currency,
          price_id: subscription.items.data[0].price.id,
        }
      },
    );

    // Add the user's Firebase ID as metadata in their Stripe customer
    // profile.
    await this.updateCustomer(
      data.customer,
      {
        metadata: {
          firebase_user_id: data.client_reference_id,
        }
      }
    );
  }

  async updateCustomerSubscription(event) {
    this.log.info("Updating customer subscription");

    const cancelAtPeriodEndBefore = event.data.previous_attributes.cancel_at_period_end;
    const cancelAtPeriodEndAfter = event.data.object.cancel_at_period_end;

    const currentPeriodStartBefore = event.data.previous_attributes.current_period_start;
    const currentPeriodStartAfter = event.data.object.current_period_start;

    const currentPeriodEndBefore = event.data.previous_attributes.current_period_end;
    const currentPeriodEndAfter = event.data.object.current_period_end;

    // Fetch the subscription details from Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);
    const subscription = await stripe.subscriptions.retrieve(event.data.object.id);

    // Extract the frequency from the subscription.
    const frequency = subscription.items.data[0].plan.interval;

    if (cancelAtPeriodEndBefore == false && cancelAtPeriodEndAfter == true) {
      // The customer has set to cancel their subscription at the end of
      // their current billing period. Update the user's subscription in
      // Firestore.
      this.log.info("Cancelling customer subscription at end of billing period");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await this.getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
        customer.metadata.firebase_user_id,
        {
          subscription: {
            date_cancelled: firebaseAdmin.firestore.Timestamp.now(),
            status: "Pro (pending downgrade)",
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.id,
            frequency: frequency,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            plan_id: subscription.items.data[0].plan.id,
            amount: subscription.items.data[0].plan.amount,
            currency: subscription.items.data[0].plan.currency,
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            created: subscription.created,
            metadata: subscription.metadata,
          }
        },
      );
    } else if (cancelAtPeriodEndBefore == true && cancelAtPeriodEndAfter == false) {
      // The customer has reactivated their subscription after previously
      // setting it to cancel.
      this.log.info("Reactivating customer subscription");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await this.getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
        customer.metadata.firebase_user_id,
        {
          subscription: {
            date_reactivated: firebaseAdmin.firestore.Timestamp.now(),
            status: "Pro",
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.id,
            frequency: frequency,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            plan_id: subscription.items.data[0].plan.id,
            amount: subscription.items.data[0].plan.amount,
            currency: subscription.items.data[0].plan.currency,
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            created: subscription.created,
            metadata: subscription.metadata,
          }
        },
      );
    } else if ((currentPeriodStartBefore != currentPeriodStartAfter) &&
      (currentPeriodEndBefore != currentPeriodEndAfter)) {
      // The customer has renewed their subscription for another billing period.
      this.log.info("Renewing customer subscription for another billing period");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await this.getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
        customer.metadata.firebase_user_id,
        {
          subscription: {
            date_renewed: firebaseAdmin.firestore.Timestamp.now(),
            latest_invoice_id: event.data.object.id,
            status: "Pro",
            stripe_customer_id: event.data.object.customer,
            subscription_id: event.data.object.subscription,
            frequency: frequency,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            plan_id: subscription.items.data[0].plan.id,
            amount: subscription.items.data[0].plan.amount,
            currency: subscription.items.data[0].plan.currency,
            trial_start: subscription.trial_start,
            trial_end: subscription.trial_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
            created: subscription.created,
            metadata: subscription.metadata,
          }
        },
      );
    }
  }

  async downgradeCustomerSubscription(event) {
    this.log.info("Downgrading customer subscription");

    const data = event.data.object;

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await this.getCustomer(data.customer);

    // Update the user's subscription status in Firebase.
    await this.firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        "subscription.status": "Free",
      },
    );
  }

  async getCustomer(customerId) {
    this.log.info("Getting customer " + customerId + " from Stripe");

    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);

    // Get the customer.
    const customer = await stripe.customers.retrieve(customerId);

    this.log.info('Customer:');
    this.log.info(this.log.formatObject(customer));

    return customer;
  }

  async updateCustomer(customerId, data) {
    this.log.info("Updating customer details");

    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);

    // Call the Stripe API to update the customer's details.
    return await stripe.customers.update(
      customerId,
      data,
    );
  }

  async webhook(request) {
    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);

    const event = stripe.webhooks.constructEvent(
      request.rawBody,
      request.headers["stripe-signature"],
      stripeConfig.webhookSecret,
    );

    this.log.info("Event:");
    this.log.info(this.log.formatObject(event));

    // Save the Stripe event to Firestore.
    await this.firestoreService.addStripeEvent(event);

    // Check which Stripe events can be handled by this webhoook.
    const supportedStripeEvents = Object.values(stripeEvents);
    const isSupportedStripeEvent = supportedStripeEvents.indexOf(event.type) > -1;
    this.log.info("Webhook supports this Stripe event? " + isSupportedStripeEvent);

    if (isSupportedStripeEvent) {
      switch (event.type) {
        case stripeEvents.checkoutSessionCompleted:
          // The customer upgraded from Free to Pro.
          await this.upgradeCustomerSubscription(event);
          break;

        case stripeEvents.customerSubscriptionUpdated:
          // The customer updated their subscription. For example, they renewed,
          // canceled, or reactivated it.
          await this.updateCustomerSubscription(event);
          break;

        case stripeEvents.customerSubscriptionDeleted:
          // The customer's pending subscription downgrade has taken effect.
          await this.downgradeCustomerSubscription(event);
          break;
      }

      this.log.info("Webhook handled successfully for event " + event.id);
    } else {
      throw new Error(`Unhandled event type: ${event.type}`);
    }
  }
}

module.exports = StripeService;