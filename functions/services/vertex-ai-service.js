const { VertexAI } = require('@google-cloud/vertexai');
const config = require("../values/config");
const firebaseRemoteConfig = require("./firebase-remote-config");

async function createPromptForAllCopy(address, features, contactDetails) {
  let prompt = await firebaseRemoteConfig.getParameter('prompt_all_copy');

  prompt = prompt.replace('${address}', address);
  prompt = prompt.replace('${features}', features);
  prompt = prompt.replace('${contactDetails}', contactDetails);

  const response = sendPromptToGemini(prompt);
  return response;
}

async function createPromptForContextualCopy(
  copyElementType,
  action,
  existingCopy,
  existingCopyToReplace,
  address,
  features,
  contactDetails,
  maxLength
) {
  let prompt = await firebaseRemoteConfig.getParameter('prompt_contextual_copy');

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

  const response = sendPromptToGemini(prompt);
  return response;
}

async function createPromptForSingleCopy(copyElementType, address, features, contactDetails, maxLength) {
  let prompt = await firebaseRemoteConfig.getParameter('prompt_single_copy');

  prompt = prompt.replace('${copyElementType}', copyElementType);
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

  const response = sendPromptToGemini(prompt);
  return response;
}

async function sendPromptToGemini(prompt) {
  console.log('sendPromptToGemini()');
  console.log('prompt: ' + prompt);

  let retries = 0;
  const maxRetries = config.llmRetryCount;

  while (retries <= maxRetries) {
    if (retries > 0) {
      console.warn(`Attempting retry ${retries} of ${maxRetries}...`);
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

      console.log("Response:");
      console.log(response);

      console.log("Copy response:");
      console.log(response.candidates[0].content.parts[0].text);

      return response.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error(error);

      retries++;
    }
  }
}


function extractJSONString(text) {
  try {
    // Remove backticks.
    text = text.replaceAll('`', '');

    // Remove the word 'json'.
    text = text.replaceAll('json', '');
    text = text.replaceAll('JSON', '');

    // Trim any leading or trailing whitespace.
    text = text.trim();

    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");

    if (startIndex !== -1 && endIndex !== -1) {
      const jsonString = text.substring(startIndex, endIndex + 1);
      return jsonString;
    }

    // This should never be reached.
    return null;
  } catch (error) {
    return null;
  }
}

module.exports = {
  createPromptForAllCopy: createPromptForAllCopy,
  createPromptForContextualCopy: createPromptForContextualCopy,
  createPromptForSingleCopy: createPromptForSingleCopy,
};
