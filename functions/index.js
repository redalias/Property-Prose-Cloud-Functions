// Import modules.
const firebaseAdmin = require("firebase-admin");
firebaseAdmin.initializeApp();

// const config = require("./values/config");
const firebaseRemoteConfig = require("./services/firebase-remote-config");
const firestoreService = require("./services/firestore-service");
const functions = require("firebase-functions/v2");
const stripeService = require("./services/stripe-service");
const vertexAiService = require("./services/vertex-ai-service");

/*
  Creates a session of the Stripe Customer Portal.
  See https://docs.stripe.com/api/customer_portal/sessions/create.
*/
exports.createStripeCustomerPortalSession = functions.https.onCall(
  async (request, context) => {
    try {
      const portalSession = await stripeService.createCustomerPortalSession(request);

      console.log("Created Stripe customer portal session");
      console.log(portalSession);

      return portalSession;
    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send("Error creating Stripe customer portal session");
    }
  },
);

exports.createStripePaymentLink = functions.https.onCall(
  async (request, context) => {
    try {
      const paymentLink = await stripeService.createPaymentLink(request);

      console.log("Created payment link");
      console.log(paymentLink);

      return paymentLink.url;
    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send("Error creating payment link");
    }
  },
);

/* 
  Called when certain Stripe events are triggered.
*/
exports.stripeWebhook = functions.https.onRequest(async (request, res) => {
  try {
    console.log('Called Stripe webhook');

    await stripeService.webhook(request);

  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Error handling webhook");
  }
});

exports.updateStripeCustomer = functions.https.onCall(
  async (request, context) => {
    try {
      await stripeService.updateCustomer(
        request.data.stripe_customer_id,
        {
          email: request.data.email,
          name: request.data.name,
        }
      );

      console.log("Updated Stripe customer");
      console.log(portalSession);

      return portalSession;
    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send("Error updating Stripe customer");
    }
  },
);

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

    } catch (error) {
      console.error(error);

      res
        .status(500)
        .send("Error checking if user is able to generate copy");
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

      res
        .status(500)
        .send("Error generating all copy");
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

      res
        .status(500)
        .send("Error generating contextual copy");
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

      res
        .status(500)
        .send("Error generating single copy");
    }
  },
);


exports.proxyGoogleMapsPlacesAutocomplete = functions.https.onRequest(async (request, res) => {
  console.log('proxyGoogleMapsPlacesAutocomplete');

  // Fetch the URL from the request.
  var url = request.url;

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