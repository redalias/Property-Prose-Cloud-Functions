// Import modules.
const admin = require("firebase-admin");
admin.initializeApp();

// const config = require("./values/config");
const firebaseRemoteConfig = require("./services/firebase-remote-config");
const firestoreService = require("./services/firestore-service");
const functions = require("firebase-functions/v2");
const stripeStrings = require("./values/stripe-strings");
const stripeService = require("./services/stripe-service");
const vertexAiService = require("./services/vertex-ai-service");

exports.createStripePaymentLink = functions.https.onCall(
  async (request, context) => {
    try {
      const stripeConfig = await stripeService.createStripeConfig();
      const stripe = require("stripe")(stripeConfig.secretKey);

      const paymentLink = await stripe.paymentLinks.create({
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

      console.log("Created payment link");
      console.log(paymentLink);

      return paymentLink.url;
    } catch (error) {
      console.error(error);
      return "Error creating payment link";
    }
  },
);

// Called when a customer processes a payment.
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  try {
    console.log('Called Stripe webhook');

    const stripeConfig = await stripeService.createStripeConfig();
    const stripe = require("stripe")(stripeConfig.secretKey);

    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      req.headers["stripe-signature"],
      stripeConfig.webhookSecret,
    );

    const session = event.data.object;

    if (event.type === "checkout.session.completed") {
      // Save payment details to Firestore.
      await firestoreService.addPayment({
        id: session.id,
        amount_subtotal: session.amount_subtotal,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_id: session.customer,
        customer_details: session.customer_details,
        date_created_stripe: session.created,
        date_created_firestore: admin.firestore.Timestamp.now(),
        date_expired_stripe: session.expires_at,
        invoice_id: session.invoice,
        metadata: session.metadata,
        object: session.object,
        payment_link: session.payment_link,
        payment_status: session.payment_status,
        subscription_id: session.subscription,
        status: session.status,
        total_details: session.total_details,
        url: session.url,
        user_id: session.client_reference_id,
      });

      await firestoreService.updateUser(
        session.metadata.firebase_user_id,
        {
          membership: {
            date_latest_payment: admin.firestore.Timestamp.now(),
            date_latest_payment_id: session.id,
            plan: "Pro",
            stripe_customer_id: session.customer,
            latest_subscription_id: session.subscription,
          }
        },
      );

      res
        .status(200)
        .send("Webhook handled successfully for checkout session " + session.id);
    } else {
      res.status(200).send(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Error handling webhook");
  }
});

exports.isUserAbleToGenerateCopy = functions.https.onCall(
  async (request, context) => {
    try {
      console.log('isUserAbleToGenerateCopy');
      console.log(request);

      // Fetch user data from Firestore.
      let user = firestoreService.user(request.data['address']);
      let isPaid = user['is_paid'];

      if (isPaid) {
        // If the user is a paying user, then they can generate copy.
        return true;
      } else {
        // If the user is not a paying user, then check if they
        let maximumFreeCopyGenerations = await firebaseRemoteConfig.getParameter('maximum_free_copy_generations');
        let lifetimeCopyGenerations = user['lifetime_copy_generations'];
        let remainingCopyGenerations = maximumFreeCopyGenerations - lifetimeCopyGenerations;

        if (remainingCopyGenerations > 1) {
          return true;
        } else {
          return false;
        }
      }

      console.log(response);

      return response;
    } catch (error) {
      console.error(error);
      return "Error checking if user is able to generate copy";
    }
  },
);


exports.generateAllCopy = functions.https.onCall(
  async (request, context) => {
    try {
      console.log('generateAllCopy data');
      console.log(request);

      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];

      const response = await vertexAiService.createPromptForAllCopy(
        address,
        features,
        contactDetails,
      );

      console.log(response);

      return response;
    } catch (error) {
      console.error(error);
      return "Error creating all copy";
    }
  },
);

exports.generateContextualCopy = functions.https.onCall(
  async (request, context) => {
    try {
      console.log('generateContextualCopy data');
      console.log(request);

      const copyElementType = request.data['copy_element_type'];
      const action = request.data['action'];
      const existingCopy = request.data['existing_copy'];
      const existingCopyToReplace = request.data['existing_copy_to_replace'];
      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const maxLength = request.data['max_length'];

      const response = await vertexAiService.createPromptForContextualCopy(
        copyElementType,
        action,
        existingCopy,
        existingCopyToReplace,
        address,
        features,
        contactDetails,
        maxLength
      );

      console.log(response);

      return response;
    } catch (error) {
      console.error(error);
      return "Error creating single copy";
    }
  },
);

exports.generateSingleCopy = functions.https.onCall(
  async (request, context) => {
    try {
      console.log('generateSingleCopy data');
      console.log(request);

      const copyElementType = request.data['copy_element_type'];
      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const maxLength = request.data['max_length'];

      const response = await vertexAiService.createPromptForSingleCopy(
        copyElementType,
        address,
        features,
        contactDetails,
        maxLength,
      );

      console.log(response);

      return response;
    } catch (error) {
      console.error(error);
      return "Error creating single copy";
    }
  },
);


exports.proxyGoogleMapsPlacesAutocomplete = functions.https.onRequest(async (req, res) => {
  console.log('proxyGoogleMapsPlacesAutocomplete');

  // Fetch the URL from the request.
  var url = req.url;

  // Remove the prefix from the URL.
  url = url.replace('/?url=', '');

  try {
    const response = await fetch(url);

    // Process and return the response data
    const responseData = await response.json();

    res
      .status(200)
      .send(responseData);

    return responseData;
  } catch (error) {
    console.error(error);

    res
      .status(400)
      .send(error);
  }
});