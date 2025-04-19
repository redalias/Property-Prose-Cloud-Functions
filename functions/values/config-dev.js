const config = {
  // The name of the project in Google Cloud.
  googleCloudProjectName: "property-prose-dev",

  // The geographic location of the project in Google Cloud.
  googleCloudProjectLocation: "us-central1",

  // Firebase Remote Config Keys used specifically for Stripe.
  stripeRemoteConfigKeys: {
    // The text shown to the user after purchasing Copyspark Pro.
    paymentSuccessfulText: "stripe_payment_successful_text",

    // The unique IDs of the pricing plans.
    priceIds: "stripe_price_ids",

    // The Remote Config group used to contain all Stripe keys.
    remoteConfigParameterName: "Stripe",

    // The API key used to authenticate Stripe requests.
    secretKey: "stripe_secret_key",

    // The webhook secret used to construct webhook events.
    webhookSecret: "stripe_webhook_secret",
  }
};

module.exports = config;
