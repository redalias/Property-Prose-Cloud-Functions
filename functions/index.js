// Import modules.
const firebaseAdmin = require("firebase-admin");
firebaseAdmin.initializeApp();

const functions = require("firebase-functions/v2");

const LoggingService = require("./services/logging-service");
const FirebaseRemoteConfigService = require("./services/firebase-remote-config-service");
const FirestoreService = require("./services/firestore-service");
const StripeService = require("./services/stripe-service");
const VertexAiService = require("./services/vertex-ai-service");

// exports.createStripeCheckoutSession = functions.https.onCall(
//   async (request, response) => {
//     const log = new LoggingService('MAIN');

//     try {
//       const session = await stripe.checkout.sessions.create({
//         ui_mode: 'embedded',
//         line_items: [
//           {
//             // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
//             price: 'prod_QA4qaCkaDGo81g',
//             quantity: 1,
//           },
//         ],
//         mode: 'payment',
//         return_url: `https://app.copyspark.co?session_id=${CHECKOUT_SESSION_ID}`,
//       });

//       response.send({ clientSecret: session.client_secret });
//     } catch (error) {
//       log.error(error);

//       response
//         .status(500)
//         .send("Error creating payment link");
//     }
//   },
// );

/*
  Creates a session of the Stripe Customer Portal.
  See https://docs.stripe.com/api/customer_portal/sessions/create.
*/
exports.createStripeCustomerPortalSession = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      const stripeService = new StripeService();
      const portalSession = await stripeService.createCustomerPortalSession(request);

      log.info("Created Stripe customer portal session");
      log.info(portalSession);

      return portalSession;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error creating Stripe customer portal session");
    }
  },
);

// exports.createStripePaymentIntent = functions.https.onCall(
//   async (request, response) => {
//     const log = new LoggingService('MAIN');

//     try {
//       // Create a PaymentIntent with the order amount and currency.
//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: 500,
//         currency: "nzd",
//       });

//       response.send({
//         clientSecret: paymentIntent.client_secret,
//       });
//     } catch (error) {
//       log.error(error);

//       response
//         .status(500)
//         .send("Error creating payment link");
//     }
//   },
// );

exports.createStripePaymentLink = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      const stripeService = new StripeService();
      const paymentLink = await stripeService.createPaymentLink(request);

      log.info("Created payment link");
      log.info(paymentLink);

      return paymentLink.url;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error creating payment link");
    }
  },
);

/* 
  Called when certain Stripe events are triggered.
*/
exports.stripeWebhook = functions.https.onRequest(async (request, response) => {
  const log = new LoggingService('MAIN');

  try {
    log.info('Called Stripe webhook');

    const stripeService = new StripeService();
    await stripeService.webhook(request);

    response.status(200).send();

  } catch (error) {
    log.error(error);

    response
      .status(500)
      .send("Error handling webhook");
  }
});

exports.updateStripeCustomer = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      const stripeService = new StripeService();
      const response = await stripeService.updateCustomer(
        request.data.stripe_customer_id,
        {
          email: request.data.email,
          name: request.data.name,
        }
      );

      log.info("Updated Stripe customer");
      log.info(log.formatObject(response));

      return response;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error updating Stripe customer");
    }
  },
);

exports.isUserAbleToGenerateCopy = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      log.info('isUserAbleToGenerateCopy');
      log.info(log.formatObject(request));

      // Fetch user data from Firestore.
      const firestoreService = new FirestoreService();
      let user = firestoreService.user(request.data['address']);
      let isPaid = user['is_paid'];

      if (isPaid) {
        // If the user is a paying user, then they can generate copy.
        return true;
      } else {
        // If the user is not a paying user, then check if they
        const firebaseRemoteConfigService = new FirebaseRemoteConfigService();
        let maximumFreeCopyGenerations = await firebaseRemoteConfigService.getParameter('maximum_free_copy_generations');
        let lifetimeCopyGenerations = user['lifetime_copy_generations'];
        let remainingCopyGenerations = maximumFreeCopyGenerations - lifetimeCopyGenerations;

        if (remainingCopyGenerations > 1) {
          return true;
        } else {
          return false;
        }
      }

    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error checking if user is able to generate copy");
    }
  },
);


exports.generateAllCopy = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      log.info('generateAllCopy data');
      log.info(log.formatObject(request));

      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const userSubscriptionStatus = request.data['user_subscription_status'];

      const vertexAiService = new VertexAiService();
      const response = await vertexAiService.createPromptForAllCopy(
        address,
        features,
        contactDetails,
        userSubscriptionStatus,
      );

      log.info(log.formatObject(response));

      return response;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error generating all copy");
    }
  },
);

exports.generateContextualCopy = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      log.info('generateContextualCopy data');
      log.info(log.formatObject(request));

      const copyElementType = request.data['copy_element_type'];
      const action = request.data['action'];
      const existingCopy = request.data['existing_copy'];
      const existingCopyToReplace = request.data['existing_copy_to_replace'];
      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const maxLength = request.data['max_length'];
      const userSubscriptionStatus = request.data['user_subscription_status'];

      const vertexAiService = new VertexAiService();
      const response = await vertexAiService.createPromptForContextualCopy(
        copyElementType,
        action,
        existingCopy,
        existingCopyToReplace,
        address,
        features,
        contactDetails,
        maxLength,
        userSubscriptionStatus,
      );

      log.info(log.formatObject(response));

      return response;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error generating contextual copy");
    }
  },
);

exports.generateSingleCopy = functions.https.onCall(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      log.info('generateSingleCopy data');
      log.info(log.formatObject(request));

      const copyElementType = request.data['copy_element_type'];
      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const maxLength = request.data['max_length'];
      const userSubscriptionStatus = request.data['user_subscription_status'];

      const vertexAiService = new VertexAiService();
      const response = await vertexAiService.createPromptForSingleCopy(
        copyElementType,
        address,
        features,
        contactDetails,
        maxLength,
        userSubscriptionStatus,
      );

      log.info(log.formatObject(response));

      return response;
    } catch (error) {
      log.error(error);

      response
        .status(500)
        .send("Error generating single copy");
    }
  },
);

exports.fetchUserLocation = functions.https.onRequest(async (request, response) => {
  const log = new LoggingService('MAIN');

  try {
    response.set('Access-Control-Allow-Origin', '*');
    response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    log.info("Fetching user's location");

    const forwardedFor = request.header('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.ip;
    log.info("User's IP address: " + ipAddress);

    // Handle the case where ipAddress is null
    if (!ipAddress) {
      log.error("IP address is null");
      response.status(400).send({ error: "Could not determine IP address." });
      return;
    }

    const apiResponse = await fetch(`https://api.country.is/${ipAddress}`);

    // Check for API errors.
    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      const errorMessage = errorData.error || `Country lookup failed: ${apiResponse.status} ${apiResponse.statusText}`;
      log.error(errorMessage);
      response.status(apiResponse.status).send({ error: errorMessage });
      return;
    }

    const apiData = await apiResponse.json();
    const country = apiData.country;

    log.info("User's country: " + country);

    response.status(200).send(apiData);

  } catch (error) {
    log.error("Error in fetchUserLocation:", error);
    response.status(500).send({ error: error.message });
  }
});



exports.proxyGoogleMapsPlacesAutocomplete = functions.https.onRequest(
  async (request, response) => {
    const log = new LoggingService('MAIN');

    try {
      // Set CORS headers for the response.
      response.set('Access-Control-Allow-Origin', '*');
      response.set('Access-Control-Allow-Methods', 'GET, POST');
      response.set('Access-Control-Allow-Headers', 'Content-Type, X-Goog-Api-Key, X-Goog-FieldMask');

      // Fetch parameters from the request.
      var targetUrl = request.query['target_url'];
      var firebaseUserIdToken = request.query['firebase_user_id_token'];
      var apiKey = request.header('X-Goog-Api-Key');
      var components = request.query['components'];
      var input = request.body['input'];

      // Construct the request URL.
      var googleMapsRequestUrl = `${targetUrl}?key=${apiKey}&input=${input}`;
      var fields = '*';

      if (components != null) {
        googleMapsRequestUrl += "&components=" + components;
      }

      log.info("Google Maps autocomplete request URL: " + googleMapsRequestUrl);

      // Construct the request header.
      var googleMapsRequestHeader = {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fields,
      };

      log.info('Request header: ' + JSON.stringify(googleMapsRequestHeader));

      // Construct the request body.
      var googleMapsRequestBody = {
        'input': input,
      };

      // Execute the authenticated request and return the data.
      const googleMapsResponse = await fetch(googleMapsRequestUrl, {
        method: 'POST',
        headers: googleMapsRequestHeader,
        body: JSON.stringify(googleMapsRequestBody),
      });

      const googleMapsResponseData = await googleMapsResponse.json();

      log.info('Google Maps response: ' + JSON.stringify(googleMapsResponseData));

      response
        .status(200)
        .send(googleMapsResponseData);

      // return responseData;
    } catch (error) {
      log.error(error);

      response
        .status(400)
        .send(error);
    }
  });