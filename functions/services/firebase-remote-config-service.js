const firebaseAdmin = require("firebase-admin");
const LoggingService = require("./logging-service");

class FirebaseRemoteConfigService {
  constructor() {
    this.log = new LoggingService(this.constructor.name);
  }

  async getTemplate() {
    return await firebaseAdmin.remoteConfig().getTemplate();
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
  async getParameter(parameterKey) {
    this.log.info("Finding parameter key '" + parameterKey + "'");
    const template = await this.getTemplate();
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
  async getParameterFromGroup(
    parameterGroup,
    parameterKey,
  ) {
    this.log.info("Finding parameter key '" + parameterKey + "' in group '" + parameterGroup + "'");
    const template = await this.getTemplate();

    return template.parameterGroups[parameterGroup].parameters[
      parameterKey
    ].defaultValue.value;
  }
}

module.exports = FirebaseRemoteConfigService;
