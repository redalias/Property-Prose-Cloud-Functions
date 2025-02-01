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

    let firebaseRemoteConfigKey = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.prompt.allCopy.free
      : firebaseRemoteConfigKeys.prompt.allCopy.pro;

    let prompt = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey);

    prompt = prompt.replace('${address}', address);
    prompt = prompt.replace('${features}', features);
    prompt = prompt.replace('${contactDetails}', contactDetails);

    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.allCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.allCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema);

    const response = await this.sendPromptToGemini(prompt, jsonSchema);
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

    let firebaseRemoteConfigKey = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.prompt.contextualCopy.free
      : firebaseRemoteConfigKeys.prompt.contextualCopy.pro;

    let prompt = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey);

    prompt = prompt.replace('${copyElementType}', copyElementType);
    prompt = prompt.replace('${action}', action);
    prompt = prompt.replace('${existingCopy}', existingCopy);
    prompt = prompt.replace('${existingCopyToReplace}', existingCopyToReplace);
    prompt = prompt.replace('${address}', address);
    prompt = prompt.replace('${features}', features);
    prompt = prompt.replace('${contactDetails}', contactDetails);

    if (maxLength == null || maxLength == 0) {
      // Remove the character length requirement in the prompt.
      prompt = prompt.replace('Make it a maximum of ${maxLength} characters long.', '');
    } else {
      // Update the character length requirement in the prompt.
      prompt = prompt.replace('${maxLength}', maxLength);
    }

    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.contextualCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.contextualCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema); jsonSchema = JSON.parse(jsonSchema);


    const response = await this.sendPromptToGemini(prompt, jsonSchema);
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

    let firebaseRemoteConfigKey = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.prompt.singleCopy.free
      : firebaseRemoteConfigKeys.prompt.singleCopy.pro;

    let prompt = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigKey);

    prompt = prompt.replace('${copyElementType}', copyElementType);
    prompt = prompt.replace('${address}', address);
    prompt = prompt.replace('${features}', features);
    prompt = prompt.replace('${contactDetails}', contactDetails);

    if (maxLength == null || maxLength == 0) {
      // Remove the character length requirement in the prompt.
      prompt = prompt.replace('Make it a maximum of ${maxLength} characters long.', '');
    } else {
      // Update the character length requirement in the prompt.
    }

    let firebaseRemoteConfigJsonSchema = userSubscriptionStatus === strings.subscriptionStatusFree
      ? firebaseRemoteConfigKeys.jsonSchema.singleCopy.free
      : firebaseRemoteConfigKeys.jsonSchema.singleCopy.pro;

    let jsonSchema = await this.firebaseRemoteConfigService.getParameter(firebaseRemoteConfigJsonSchema);
    jsonSchema = JSON.parse(jsonSchema);

    const response = await this.sendPromptToGemini(prompt, jsonSchema);
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
