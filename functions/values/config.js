const config = {
  // Is true if the project is in development.
  isTestMode: true,

  googleCloudProjectNameTest: "property-prose-dev",
  googleCloudProjectNameLive: "property-prose",

  // The project location is the same across both test and live environments.
  googleCloudProjectLocation: "us-central1",

  // The AI model used to generate the copy.
  llmModelTest: "gemini-1.5-flash",
  llmModelLive: "gemini-1.5-flash",
};

module.exports = config;
