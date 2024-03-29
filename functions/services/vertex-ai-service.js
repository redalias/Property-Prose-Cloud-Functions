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

async function createPromptForSingleCopy(copyElementType, address, features, contactDetails) {
  let prompt = await firebaseRemoteConfig.getParameter('prompt_single_copy');

  prompt = prompt.replace('${copyElementType}', copyElementType);
  prompt = prompt.replace('${address}', address);
  prompt = prompt.replace('${features}', features);
  prompt = prompt.replace('${contactDetails}', contactDetails);

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


function extractJSON(text) {
  try {
    // Attempt to parse the entire string directly as JSON first
    return JSON.parse(text);
  } catch (error) {
    // If parsing fails, attempt to extract the JSON object from within the string
    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");

    if (startIndex !== -1 && endIndex !== -1) {
      const potentialJSON = text.substring(startIndex, endIndex + 1);
      try {
        return JSON.parse(potentialJSON);
      } catch (error) {
        // If extraction also fails, return null
        return null;
      }
    } else {
      // If no JSON object is found, return null
      return null;
    }
  }
}

module.exports = {
  createPromptForAllCopy: createPromptForAllCopy,
  createPromptForSingleCopy: createPromptForSingleCopy,
};
