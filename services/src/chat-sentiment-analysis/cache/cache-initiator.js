const awsSystemManagerClient = require(process.env.AWS_REGION
  ? '/opt/nodejs/aws-clients/system-manager/system-manager-client'
  : '../../../layers/common/nodejs/aws-clients/system-manager/system-manager-client.js');

const awsSecretManagerClient = require(process.env.AWS_REGION
  ? '/opt/nodejs/aws-clients/secret-manager/secret-manager-client'
  : '../../../layers/common/nodejs/aws-clients/secret-manager/secret-manager-client.js');

const { egGlobalCache } = require(process.env.AWS_REGION
  ? '/opt/nodejs/cache/global-cache'
  : '../../../layers/common/nodejs/cache/global-cache.js');

const { awsProps, commonConstants, cacheKeys } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../../layers/common/nodejs/constants/constants.js');

const { Logger } = require('ps-chronicle');

const loggerContext = {
  fileName: 'cache-initiator.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

async function initializeConfigCache() {
  logger.log('debug', 'inside initializeConfigCache');

  const configParameters = await awsSystemManagerClient.getParametersFromStore(
    awsProps.PARAMETER_PATH,
  );

  logger.log('info', 'parameters from Parameter Store', {
    Parameters: configParameters,
  });

  // let smtpProxyHost;
  // let smtpProxyPort;

  for (let i = 0; i < configParameters.length; i += 1) {
    const param = configParameters[i];

    switch (param.Name) {
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.API_TIMEOUT}`:
        egGlobalCache.set(cacheKeys.AXIOS_API_REQUEST_TIMEOUT, parseInt(param.Value, 10));
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.API_TIMEOUT_RETRY_ATTEMPTS}`:
        egGlobalCache.set(cacheKeys.NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT, parseInt(param.Value, 10));
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.MAX_CONTINUOUS_FAILURE_TO_ALLOWED}`:
        egGlobalCache.set(cacheKeys.MAX_CONTINUOUS_FAILURE_TO_STOP, parseInt(param.Value, 10));
        break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_RULE}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_RULE, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_FROM_EMAIL}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_FROM_EMAIL, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_EGAIN_EMAIL}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_EGAIN_EMAIL, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_CUSTOMER_EMAIL}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_CUSTOMER_EMAIL, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_EGAIN_BCC_EMAIL}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_EGAIN_BCC_EMAIL, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_SMTP_SERVER}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_SERVER, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_SMTP_PORT}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_PORT, parseInt(param.Value, 10));
      //   break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_BATCH_DATA_RETENTION_DAYS}`:
        egGlobalCache.set(cacheKeys.BATCH_DATA_RETENTION_DAYS, parseInt(param.Value, 10));
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.HALT_FLAG}`:
        egGlobalCache.set(cacheKeys.IS_PROCESSING_HALTED, param.Value === 'true');
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.EGAIN_API_HOST}`:
        egGlobalCache.set(cacheKeys.EGAIN_HOST_URL, param.Value);
        break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.CALLMINER_API_HOST}`:
      //   egGlobalCache.set(cacheKeys.CALL_MINER_INGESTION_API_URL, param.Value);
      //   break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.EGAIN_API_PROXY_HOST}`:
        egGlobalCache.set(cacheKeys.PROXY_HOST, param.Value);
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.EGAIN_API_PROXY_PORT}`:
        egGlobalCache.set(cacheKeys.PROXY_PORT, parseInt(param.Value, 10));
        break;
      case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.EGAIN_API_PAGE_SIZE}`:
        egGlobalCache.set(cacheKeys.EGAIN_API_PAGE_SIZE, parseInt(param.Value, 10));
        break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_SUCCESS_EMAIL_TEMPLATE_KEY}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_SUCCESS_EMAIL_TEMPLATE_KEY, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_FAILURE_EMAIL_TEMPLATE_KEY}`:
      //   egGlobalCache.set(cacheKeys.NOTIFICATION_FAILURE_EMAIL_TEMPLATE_KEY, param.Value);
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_SMTP_PROXY_HOST}`:
      //   smtpProxyHost = param.Value;
      //   break;
      // case `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.NOTIFICATION_SMTP_PROXY_PORT}`:
      //   smtpProxyPort = parseInt(param.Value, 10);
      //   break;
      default:
        break;
    }
  }

  const proxy = {
    host: egGlobalCache.get(cacheKeys.PROXY_HOST),
    port: egGlobalCache.get(cacheKeys.PROXY_PORT),
  };

  const secretString = await awsSecretManagerClient.getSecret(awsProps.SECRET_NAME);

  const secretJson = JSON.parse(secretString);

  egGlobalCache.set(
    cacheKeys.EGAIN_USER_CREDENTIALS,
    JSON.parse(secretJson[awsProps.USER_CREDENTIAL_SECRET_KEY]),
  );

  // egGlobalCache.set(
  //   cacheKeys.CALL_MINER_INGESTION_API_TOKEN,
  //   secretJson[awsProps.CALLMINER_JWT_SECRET_KEY],
  // );

  if (
    secretJson[awsProps.EGAIN_PROXY_CREDENTIAL_SECRET_KEY] &&
    process.env.ProxyAuth.toUpperCase() === 'TRUE'
  ) {
    egGlobalCache.set(
      cacheKeys.EGAIN_PROXY_USER_CREDENTIALS,
      JSON.parse(secretJson[awsProps.EGAIN_PROXY_CREDENTIAL_SECRET_KEY]),
    );
    proxy.auth = egGlobalCache.get(cacheKeys.EGAIN_PROXY_USER_CREDENTIALS);
  }
  if (!process.env.DisableProxy || process.env.DisableProxy.toUpperCase() === 'FALSE') {
    // given an option to disable proxy if required. By default this env variable wont be available or set to false
    egGlobalCache.set(cacheKeys.PROXY, proxy);
    // egGlobalCache.set(
    //   cacheKeys.SMTP_SOCK_PROXY,
    //   commonConstants.SOCKS5 +
    //     commonConstants.COLON +
    //     commonConstants.DOUBLE_FORWARD_SLASH +
    //     smtpProxyHost +
    //     commonConstants.COLON +
    //     smtpProxyPort,
    // );
  }

  // if (
  //   process.env.SMTPAuth.toUpperCase() === 'TRUE' &&
  //   secretJson[awsProps.EGAIN_SMTP_CREDENTIAL_SECRET_KEY]
  // ) {
  //   const SMTPCredentials = JSON.parse(secretJson[awsProps.EGAIN_SMTP_CREDENTIAL_SECRET_KEY]);
  //   egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_AUTH, {
  //     user: SMTPCredentials.username,
  //     pass: SMTPCredentials.password,
  //   });
  // }

  /** To be commented */

  /* egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_SERVER, 'smtp.office365.com');
  egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_PORT, 587);
  egGlobalCache.set(cacheKeys.NOTIFICATION_SMTP_AUTH, {
    user: 'indiaPStest1@egain.com',
    pass: 'ke9x@8pbq',
  }); */
}

module.exports = {
  initializeConfigCache,
};
