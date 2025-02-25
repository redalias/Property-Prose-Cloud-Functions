const { VertexAI } = require('@google-cloud/vertexai');
const config = require("../values/config");
const firebaseRemoteConfigKeys = require("../values/firebase-remote-config-keys");
const strings = require("../values/strings");

const LoggingService = require("./logging-service");
const FirebaseRemoteConfigService = require("./firebase-remote-config-service");

class VertexAiService {
  constructor() {
    this.log = new LoggingService(this.constructor.name);
    this.firebaseRemoteConfigService = new FirebaseRemoteConfigService();
  }

  async createPromptForAllCopy(
    address,
    features,
    contactDetails,
    userSubscriptionStatus
  ) {
    this.log.info('Creating prompt for all copy');

    // Fetch the prompt from Firebase Remote Config.    
    let firebaseRemoteConfigKey = firebaseRemoteConfigKeys.prompt.allCopy;
    let promptAllCopyJson = JSON.parse(await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey));

    // Extract the correct version of the prompt, depending on the user's subscription status.
    let promptAllCopy = userSubscriptionStatus === strings.subscriptionStatusFree
      ? promptAllCopyJson.free
      : promptAllCopyJson.pro;

    // Replace all placeholders in the prompt with the correct values.
    promptAllCopy = promptAllCopy.replace('${address}', address);
    promptAllCopy = promptAllCopy.replace('${features}', features);
    promptAllCopy = promptAllCopy.replace('${contactDetails}', contactDetails);

    // Fetching the JSON schema from from Firebase Remote Config, depending on the user's subscription status.
    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.allCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.allCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema);

    const response = await this.sendPromptToGemini(promptAllCopy, jsonSchema);
    return response;
  }

  async createPromptForContextualCopy(
    copyElementType,
    action,
    existingCopy,
    existingCopyToReplace,
    address,
    features,
    contactDetails,
    maxLength,
    userSubscriptionStatus,
  ) {
    this.log.info('Creating prompt for contextual copy');

    // Fetch the prompt from Firebase Remote Config.    
    let firebaseRemoteConfigKey = firebaseRemoteConfigKeys.prompt.contextualCopy;
    let promptContextualCopyJson = JSON.parse(await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey));

    // Extract the prompt for the given copy element type.
    let promptContextualCopy;

    switch (action.toLowerCase()) {
      case strings.condense.toLowerCase():
        promptContextualCopy = promptContextualCopyJson['condense'];
        break;

      case strings.expand.toLowerCase():
        promptContextualCopy = promptContextualCopyJson['expand'];
        break;

      case strings.rewrite.toLowerCase():
        promptContextualCopy = promptContextualCopyJson['rewrite'];
        break;
    }

    // Extract the correct version of the prompt, depending on the user's subscription status.
    promptContextualCopy = userSubscriptionStatus === strings.subscriptionStatusFree
      ? promptContextualCopy.free
      : promptContextualCopy.pro;

    // Replace all placeholders in the prompt with the correct values.
    promptContextualCopy = promptContextualCopy.replace('${copyElementType}', copyElementType);
    promptContextualCopy = promptContextualCopy.replace('${existingCopy}', existingCopy);
    promptContextualCopy = promptContextualCopy.replace('${existingCopyToReplace}', existingCopyToReplace);
    promptContextualCopy = promptContextualCopy.replace('${address}', address);
    promptContextualCopy = promptContextualCopy.replace('${features}', features);
    promptContextualCopy = promptContextualCopy.replace('${contactDetails}', contactDetails);

    if (maxLength == null || maxLength == 0) {
      // Remove the character length requirement in the prompt.
      promptContextualCopy = promptContextualCopy.replace('Make it a maximum of ${maxLength} characters long.', '');
    } else {
      // Update the character length requirement in the prompt.
      promptContextualCopy = promptContextualCopy.replace('${maxLength}', maxLength);
    }

    // Fetching the JSON schema from from Firebase Remote Config, depending on the user's subscription status.
    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.contextualCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.contextualCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema);

    const response = await this.sendPromptToGemini(promptContextualCopy, jsonSchema);
    return response;
  }

  async createPromptForSingleCopy(
    copyElementType,
    address,
    features,
    contactDetails,
    maxLength,
    userSubscriptionStatus
  ) {
    this.log.info('Creating prompt for single copy');

    // Fetch the prompt from Firebase Remote Config.    
    let firebaseRemoteConfigKey = firebaseRemoteConfigKeys.prompt.singleCopy;
    let promptSingleCopyJson = JSON.parse(await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey));

    // Extract the prompt for the given copy element type.
    let promptSingleCopy;

    switch (copyElementType) {
      case strings.listingTitle:
        promptSingleCopy = promptSingleCopyJson['property_listing']['title'];
        break;

      case strings.listingBody:
        promptSingleCopy = promptSingleCopyJson['property_listing']['body'];
        break;

      case strings.prospectiveEmailSubject:
        promptSingleCopy = promptSingleCopyJson['prospective_email']['subject'];
        break;

      case strings.prospectiveEmailBody:
        promptSingleCopy = promptSingleCopyJson['prospective_email']['body'];
        break;

      case strings.facebookPost:
        promptSingleCopy = promptSingleCopyJson['social_media']['facebook'];
        break;

      case strings.instagramPost:
        promptSingleCopy = promptSingleCopyJson['social_media']['instagram'];
        break;

      case strings.linkedInPost:
        promptSingleCopy = promptSingleCopyJson['social_media']['linkedin'];
        break;

      case strings.xPost:
        promptSingleCopy = promptSingleCopyJson['social_media']['x'];
        break;

      case strings.videoScript:
        promptSingleCopy = promptSingleCopyJson['video_script'];
        break;
    }

    // Extract the correct version of the prompt, depending on the user's subscription status.
    promptSingleCopy = userSubscriptionStatus === strings.subscriptionStatusFree
      ? promptSingleCopy.free
      : promptSingleCopy.pro;

    // Replace all placeholders in the prompt with the correct values.
    promptSingleCopy = promptSingleCopy.replace('${address}', address);
    promptSingleCopy = promptSingleCopy.replace('${features}', features);
    promptSingleCopy = promptSingleCopy.replace('${contactDetails}', contactDetails);

    // Fetching the JSON schema from from Firebase Remote Config, depending on the user's subscription status.
    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.singleCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.singleCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema);

    const response = await this.sendPromptToGemini(promptSingleCopy, jsonSchema);
    return response;
  }

  async sendPromptToGemini(prompt, jsonSchema) {
    this.log.info('Sending prompt to Gemini:');
    this.log.info(prompt);

    let retries = 0;
    const maxRetries = config.llmRetryCount;
    const retryDelay = config.llmRetryDelayMilliseconds;

    while (retries <= maxRetries) {
      if (retries > 0) {
        this.log.warn(`Attempting retry ${retries} of ${maxRetries}...`);
        this.log.info(`Waiting ${retryDelay} milliseconds before retrying...`);

        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      try {
        const vertexAI = new VertexAI({
          project: config.googleCloudProjectName,
          location: config.googleCloudProjectLocation
        });

        const generativeModel = vertexAI.getGenerativeModel({
          model: config.llmModel,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
          },
        });

        const resp = await generativeModel.generateContent(prompt);
        const response = await resp.response;

        this.log.info("Response:");
        this.log.info(this.log.formatObject(response));

        this.log.info("Copy response:");
        this.log.info(response.candidates[0].content.parts[0].text);

        return response.candidates[0].content.parts[0].text;

      } catch (error) {
        this.log.error(error);

        retries++;
      }
    }
  }
}

module.exports = VertexAiService;
