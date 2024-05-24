const config = require("../values/config");
const firebaseRemoteConfig = require("./firebase-remote-config");
const stripeConfig = require("../values/stripe-strings");
const stripeStrings = require("../values/stripe-strings");

// Fetch Stripe keys from Firebase Remote Config.
const createStripeConfig = async () => {
  try {
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
      secretKey: await firebaseRemoteConfig.getParameterFromGroup(
          stripeConfig.remoteConfigParameterName,
          secretKey,
      ),
      webhookSigningSecret: await firebaseRemoteConfig.getParameterFromGroup(
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
