const admin = require("firebase-admin");

async function getTemplate() {
  return await admin.remoteConfig().getTemplate();
}

/* Fetches the value of a parameter from Firebase Remote Config with the given
 * key name.
 *
 * @param {remoteConfigTemplate} An object fetched from Firebase Remote Config
 * containing the parameters.
 *
 * @param {parameterKey} The key of the parameter to fetch.
 *
 * @returns {dynamic} The value of the found parameter.
 */
async function getParameter(parameterKey) {
  console.log("Finding parameter key '" + parameterKey + "'");
  const template = await getTemplate();
  return template.parameters[parameterKey].defaultValue.value;
}

/* Fetches the value of a parameter from Firebase Remote Config with the given
 * key name and group name.
 *
 * @param {remoteConfigTemplate} An object fetched from Firebase Remote Config
 * containing the parameters.
 *
 * @param {parameterGroup} The group of parameters to which the parameter belongs.
 *
 * @param {parameterKey} The key of the parameter to fetch.
 *
 * @returns {dynamic} The value of the found parameter.
*/
async function getParameterFromGroup(
    parameterGroup,
    parameterKey,
) {
  console.log("Finding parameter key '" + parameterKey + "' in group '" + parameterGroup + "'");
  const template = await getTemplate();

  return template.parameterGroups[parameterGroup].parameters[
      parameterKey
  ].defaultValue.value;
}

module.exports = {
  getParameter,
  getParameterFromGroup,
};
