const config = require("../values/config");
const firebaseRemoteConfig = require("./firebase-remote-config");
const stripeConfig = require("../values/stripe-strings");
const stripeStrings = require("../values/stripe-strings");

// Fetch Stripe keys from Firebase Remote Config.
const createStripeConfig = async () => {
  try {
    const customerPortalUrl = config.isTestMode ?
      stripeConfig.customerPortalTestModeUrl :
      stripeConfig.customerPortalLiveModeUrl;

    const secretKey = config.isTestMode ?
      stripeConfig.secretTestModeKey :
      stripeConfig.secretLiveModeKey;

    const webhookSecret = config.isTestMode ?
      stripeConfig.webhookTestModeSecret :
      stripeConfig.webhookLiveModeSecret;

    const priceId = config.isTestMode ?
      stripeConfig.testModePriceId :
      stripeConfig.liveModePriceId;

    const paymentSuccessfulText = stripeStrings.paymentSuccessfulText;

    return {
      customerPortalUrl: await firebaseRemoteConfig.getParameterFromGroup(
        stripeConfig.remoteConfigParameterName,
        customerPortalUrl,
      ),
      secretKey: await firebaseRemoteConfig.getParameterFromGroup(
        stripeConfig.remoteConfigParameterName,
        secretKey,
      ),
      webhookSecret: await firebaseRemoteConfig.getParameterFromGroup(
        stripeConfig.remoteConfigParameterName,
        webhookSecret,
      ),
      priceId: await firebaseRemoteConfig.getParameterFromGroup(
        stripeConfig.remoteConfigParameterName,
        priceId,
      ),
      paymentSuccessfulText: await firebaseRemoteConfig.getParameterFromGroup(
        stripeConfig.remoteConfigParameterName,
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

module.exports = {
  createStripeConfig,
};
