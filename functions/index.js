// Import modules.
const firebaseAdmin = require("firebase-admin");
firebaseAdmin.initializeApp();

// const config = require("./values/config");
const firebaseRemoteConfig = require("./services/firebase-remote-config");
const firestoreService = require("./services/firestore-service");
const functions = require("firebase-functions/v2");
const StripeService = require("./services/stripe-service");
const VertexAiService = require("./services/vertex-ai-service");

/*
  Creates a session of the Stripe Customer Portal.
  See https://docs.stripe.com/api/customer_portal/sessions/create.
*/
exports.createStripeCustomerPortalSession = functions.https.onCall(
  async (request, response) => {
    try {
      const stripeService = new StripeService();
      const portalSession = await stripeService.createCustomerPortalSession(request);

      console.log("Created Stripe customer portal session");
      console.log(portalSession);

      return portalSession;
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .send("Error creating Stripe customer portal session");
    }
  },
);

exports.createStripePaymentLink = functions.https.onCall(
  async (request, response) => {
    try {
      const stripeService = new StripeService();
      const paymentLink = await stripeService.createPaymentLink(request);

      console.log("Created payment link");
      console.log(paymentLink);

      return paymentLink.url;
    } catch (error) {
      console.error(error);

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
  try {
    console.log('Called Stripe webhook');

    const stripeService = new StripeService();
    await stripeService.webhook(request);

    response.status(200).send();

  } catch (error) {
    console.error(error);

    response
      .status(500)
      .send("Error handling webhook");
  }
});

exports.updateStripeCustomer = functions.https.onCall(
  async (request, response) => {
    try {
      const stripeService = new StripeService();
      const response = await stripeService.updateCustomer(
        request.data.stripe_customer_id,
        {
          email: request.data.email,
          name: request.data.name,
        }
      );

      console.log("Updated Stripe customer");
      console.log(response);

      return response;
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .send("Error updating Stripe customer");
    }
  },
);

exports.isUserAbleToGenerateCopy = functions.https.onCall(
  async (request, response) => {
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

    } catch (error) {
      console.error(error);

      response
        .status(500)
        .send("Error checking if user is able to generate copy");
    }
  },
);


exports.generateAllCopy = functions.https.onCall(
  async (request, response) => {
    try {
      console.log('generateAllCopy data');
      console.log(request);

      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];

      const vertexAiService = new VertexAiService();
      const response = await vertexAiService.createPromptForAllCopy(
        address,
        features,
        contactDetails,
      );

      console.log(response);

      return response;
    } catch (error) {
      console.error(error);

      response
        .status(500)
        .send("Error generating all copy");
    }
  },
);

exports.generateContextualCopy = functions.https.onCall(
  async (request, response) => {
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

      const vertexAiService = new VertexAiService();
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

      response
        .status(500)
        .send("Error generating contextual copy");
    }
  },
);

exports.generateSingleCopy = functions.https.onCall(
  async (request, response) => {
    try {
      console.log('generateSingleCopy data');
      console.log(request);

      const copyElementType = request.data['copy_element_type'];
      const address = request.data['address'];
      const features = request.data['features'];
      const contactDetails = request.data['contact_details'];
      const maxLength = request.data['max_length'];

      const vertexAiService = new VertexAiService();
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

      response
        .status(500)
        .send("Error generating single copy");
    }
  },
);


exports.proxyGoogleMapsPlacesAutocomplete = functions.https.onRequest(
  async (request, response) => {
    console.log('proxyGoogleMapsPlacesAutocomplete');

    try {
      // Set CORS headers for the response.
      response.set('Access-Control-Allow-Origin', '*');
      response.set('Access-Control-Allow-Methods', 'GET, POST');
      response.set('Access-Control-Allow-Headers', 'Content-Type');

      // Fetch parameters from the request.
      var targetUrl = request.query['target_url'];
      var firebaseUserIdToken = request.query['firebase_user_id_token'];
      var apiKey = request.query['key'];
      var components = request.query['components'];

      // Construct the Google Maps request.
      var googleMapsRequestUrl = targetUrl + "&key=" + apiKey;

      // TODO: uncomment below to use components, once the https://country.is location fetch is setup.
      // var googleMapsRequestUrl = targetUrl + "&key=" + apiKey + "&components=" + components;

      console.log("Google Maps autocomplete request URL: " + googleMapsRequestUrl);
      console.log(googleMapsRequestUrl);

      // Execute the authenticated request and return the data.
      const googleMapsResponse = await fetch(googleMapsRequestUrl, {
        'Authorization': 'Bearer ' + firebaseUserIdToken
      });

      const googleMapsResponseData = await googleMapsResponse.json();

      response
        .status(200)
        .send(googleMapsResponseData);

      // return responseData;
    } catch (error) {
      console.error(error);

      response
        .status(400)
        .send(error);
    }
  });