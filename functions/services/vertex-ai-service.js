const { VertexAI } = require('@google-cloud/vertexai');
const config = require("../values/config");

const LoggingService = require("./logging-service");
const FirebaseRemoteConfig = require('./firebase-remote-config');

class VertexAiService {
  constructor() {
    this.logger = new LoggingService(this.constructor.name);
    this.firebaseRemoteConfig = new FirebaseRemoteConfig();
  }

  async createPromptForAllCopy(address, features, contactDetails) {
    this.logger.info('Creating prompt for all copy');

    let prompt = await this.firebaseRemoteConfig.getParameter('prompt_all_copy');

    prompt = prompt.replace('${address}', address);
    prompt = prompt.replace('${features}', features);
    prompt = prompt.replace('${contactDetails}', contactDetails);

    const response = await this.sendPromptToGemini(prompt);
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
    maxLength
  ) {
    this.logger.info('Creating prompt for contextual copy');

    let prompt = await this.firebaseRemoteConfig.getParameter('prompt_contextual_copy');

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

    const response = await this.sendPromptToGemini(prompt);
    return response;
  }

  async createPromptForSingleCopy(copyElementType, address, features, contactDetails, maxLength) {
    this.logger.info('Creating prompt for single copy');

    let prompt = await this.firebaseRemoteConfig.getParameter('prompt_single_copy');

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

    const response = await this.sendPromptToGemini(prompt);
    return response;
  }

  async sendPromptToGemini(prompt) {
    this.logger.info('Sending prompt to Gemini:');
    this.logger.info(prompt);

    let retries = 0;
    const maxRetries = config.llmRetryCount;

    while (retries <= maxRetries) {
      if (retries > 0) {
        this.logger.warn(`Attempting retry ${retries} of ${maxRetries}...`);
      }

      try {
        const vertexAI = new VertexAI({
          project: config.googleCloudProjectName,
          location: config.googleCloudProjectLocation
        });

        const generativeModel = vertexAI.getGenerativeModel({
          model: config.llmModel,
        });

        const resp = await generativeModel.generateContent(prompt);
        const response = await resp.response;

        this.logger.info("Response:");
        this.logger.info(this.logger.formatObject(response));

        this.logger.info("Copy response:");
        this.logger.info(response.candidates[0].content.parts[0].text);

        return response.candidates[0].content.parts[0].text;

      } catch (error) {
        this.logger.error(error);

        retries++;
      }
    }
  }
}

module.exports = VertexAiService;
