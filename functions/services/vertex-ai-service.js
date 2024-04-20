const http = require("http");
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
  try {
    console.log('sendPromptToGemini()');
    console.log('prompt: ' + prompt);

    const apiKey = 'AIzaSyD0Z8yGfd5Zc77Vav3kYodZHekjFlcrh0c';
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey;
    const method = 'POST';

    const body = {
      'contents': [{
        'parts': [{
          'text': prompt,
        }]
      }]
    };

    const response = await fetch(
      apiUrl, {
      method: method,
      body: JSON.stringify(body),
    });

    let responseText = await response.text();
    responseText = extractJSONString(responseText);

    const responseJSON = JSON.parse(responseText);

    console.log('Response text:');
    console.log(responseText);

    console.log('Response JSON:');
    console.log(responseJSON);

    console.log("responseJSON.candidates[0].content.parts[0].text");
    console.log(responseJSON.candidates[0].content.parts[0].text);

    return responseJSON.candidates[0].content.parts[0].text;

  } catch (error) {
    console.error(error);
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
