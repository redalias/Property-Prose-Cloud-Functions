const config = {
  // The name of the project in Google Cloud.
  googleCloudProjectName: "property-prose",

  // The geographic location of the project in Google Cloud.
  googleCloudProjectLocation: "us-central1",

  // The AI model used to generate the copy.
  llmModel: "gemini-1.5-flash",

  // Number of times to retry a failed AI model prompt before stopping altogether.
  llmRetryCount: 2,

  // Firebase Remote Config Keys used specifically for Stripe.
  stripeRemoteConfigKeys: {
    // The text shown to the user after purchasing Copyspark Pro.
    paymentSuccessfulText: "stripe_payment_successful_text",

    // The price ID of the Copyspark Pro plan.
    priceId: "stripe_price_id",

    // The Remote Config group used to contain all Stripe keys.
    remoteConfigParameterName: "Stripe",

    // The API key used to authenticate Stripe requests.
    secretKey: "stripe_secret_key",

    // The webhook secret used to construct webhook events.
    webhookSecret: "stripe_webhook_secret",
  }
};

module.exports = config;
