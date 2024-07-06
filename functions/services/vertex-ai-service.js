const { VertexAI } = require('@google-cloud/vertexai');
const config = require("../values/config");

const LoggingService = require("./logging-service");
const FirebaseRemoteConfigService = require("./firebase-remote-config-service");

class VertexAiService {
  constructor() {
    this.log = new LoggingService(this.constructor.name);
    this.firebaseRemoteConfigService = new FirebaseRemoteConfigService();
  }

  async createPromptForAllCopy(address, features, contactDetails) {
    this.log.info('Creating prompt for all copy');

    let prompt = await this.firebaseRemoteConfigService.getParameter('prompt_all_copy');

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
    this.log.info('Creating prompt for contextual copy');

    let prompt = await this.firebaseRemoteConfigService.getParameter('prompt_contextual_copy');

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
    this.log.info('Creating prompt for single copy');

    let prompt = await this.firebaseRemoteConfigService.getParameter('prompt_single_copy');

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
    this.log.info('Sending prompt to Gemini:');
    this.log.info(prompt);

    let retries = 0;
    const maxRetries = config.llmRetryCount;

    while (retries <= maxRetries) {
      if (retries > 0) {
        this.log.warn(`Attempting retry ${retries} of ${maxRetries}...`);
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
