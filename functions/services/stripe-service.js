const config = require("../values/config");
const firebaseAdmin = require("firebase-admin");
const stripeEvents = require("../values/stripe-events");

const FirebaseRemoteConfig = require("./firebase-remote-config");
const FirestoreService = require("./firestore-service");
const LoggingService = require("./logging-service");

class StripeService {
  constructor() {
    this.logger = new LoggingService(this.constructor.name);
    this.firebaseRemoteConfig = new FirebaseRemoteConfig();
    this.firestoreService = new FirestoreService();
  }

  // Fetch Stripe keys from Firebase Remote Config.
  async createRemoteConfigStrings() {
    try {
      const remoteConfigParameterName = config.stripeRemoteConfigKeys.remoteConfigParameterName;

      const stripeRemoteConfig = {
        paymentSuccessfulText: await this.firebaseRemoteConfig.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.paymentSuccessfulText,
        ),
        priceId: await this.firebaseRemoteConfig.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.priceId,
        ),
        secretKey: await this.firebaseRemoteConfig.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.secretKey,
        ),
        webhookSecret: await this.firebaseRemoteConfig.getParameterFromGroup(
          remoteConfigParameterName,
          config.stripeRemoteConfigKeys.webhookSecret,
        ),
      };

      this.logger.info('Remote Config Strings:')
      this.logger.info(this.logger.formatObject(stripeRemoteConfig));

      return stripeRemoteConfig;
    } catch (error) {
      this.logger.error(
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

  async createPaymentLink(request) {
    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
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

  async upgradeCustomerSubscription(event) {
    this.logger.info("Upgrading customer subscription");

    const data = event.data.object;

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

  async updateCustomerSubscription(event) {
    this.logger.info("Updating customer subscription");

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
      this.logger.info("Cancelling customer subscription at end of billing period");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
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
      this.logger.info("Reactivating customer subscription");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
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
      this.logger.info("Renewing customer subscription for another billing period");

      // Fetch the customer from Stripe and get their Firebase user ID.
      const customer = await getCustomer(event.data.object.customer);

      // Update the user's subscription in Firestore.
      await this.firestoreService.updateUser(
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

  async downgradeCustomerSubscription(event) {
    this.logger.info("Downgrading customer subscription");

    const data = event.data.object;

    // Fetch the customer from Stripe and get their Firebase user ID.
    const customer = await getCustomer(data.customer);

    // Update the user's subscription status in Firebase.
    await this.firestoreService.updateUser(
      customer.metadata.firebase_user_id,
      {
        "subscription.status": "Free",
      },
    );
  }

  async getCustomer(customerId) {
    this.logger.info("Getting customer " + customerId + " from Stripe");

    // Initialise Stripe.
    const stripeConfig = await this.createRemoteConfigStrings();
    const stripe = require("stripe")(stripeConfig.secretKey);

    // Get the customer.
    const customer = await stripe.customers.retrieve(customerId);

    this.logger.info('Customer:');
    this.logger.info(customer);

    return customer;
  }

  async updateCustomer(customerId, data) {
    this.logger.info("Updating customer details");

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

    this.logger.info("Event:");
    this.logger.info(event);

    // Save the Stripe event to Firestore.
    await this.firestoreService.addStripeEvent(event);

    // Check which Stripe events can be handled by this webhoook.
    const supportedStripeEvents = Object.values(stripeEvents);
    const isSupportedStripeEvent = supportedStripeEvents.indexOf(event.type) > -1;
    this.logger.info("Webhook supports this Stripe event? " + isSupportedStripeEvent);

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

      this.logger.info("Webhook handled successfully for event " + event.id);
    } else {
      throw new Error(`Unhandled event type: ${event.type}`);
    }
  }
}

module.exports = StripeService;