const SecretManager = require('aws-sdk/clients/secretsmanager');
const { Logger } = require('ps-chronicle');

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../constants/constants.js');

const loggerContext = {
  fileName: 'secret-manager-client.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};
const logger = new Logger(loggerContext, process.env.LogLevel);

const secretClient = new SecretManager({
  region: process.env.region,
});

/**
 * This methods secret value of given secretId from aws secret manager
 * @param {string} secretId
 */
async function getSecret(secretId) {
  logger.log('debug', `inside getSecret Method. secretId : ${secretId}`);
  let secretValue = '';
  await secretClient
    .getSecretValue({ SecretId: secretId })
    .promise()
    .then((data) => {
      if ('SecretString' in data) {
        secretValue = data.SecretString;
      } else {
        // eslint-disable-next-line new-cap
        const buff = new Buffer.from(data.SecretBinary, 'base64');
        secretValue = buff.toString('ascii');
      }
    })
    .catch((err) => {
      logger.log(
        'error',
        `error while getting secret value from secret Manager for secretId :${secretId}`,
        err
      );
    });

  return secretValue;
}

module.exports = {
  getSecret,
};
