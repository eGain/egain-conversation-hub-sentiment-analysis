// eslint-disable-next-line import/no-unresolved
const S3 = require('aws-sdk/clients/s3');

const { Logger } = require('ps-chronicle');

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../constants/constants.js');

const loggerContext = {
  fileName: 's3-client.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};
const logger = new Logger(loggerContext, process.env.LogLevel);

const s3 = new S3();

/**
 * @description Function to get file from s3 bucket
 * @author eGain\anilk
 * @param  {} params get parameters
 * @returns object with boolean specifying whether get is successful and file content
 */
async function getFromS3(params) {
  logger.log('debug', 'inside getFromS3: ', params);
  const response = {
    isS3Error: false,
    s3Response: {},
  };
  try {
    response.s3Response = await s3.getObject(params).promise();
    logger.log('info', 'get from s3 successful');
  } catch (error) {
    logger.log('error', 'error while getting file from S3 ', error.message);
    response.isS3Error = true;
  }
  return response;
}

/**
 * @description Function to put file in S3 bucket
 * @author eGain\anilk
 * @param  {} params put parameters
 * @returns object with boolean specifying if error
 */
async function putInS3(params) {
  logger.log('debug', 'inside putInS3: ', params);
  const response = {
    isS3Error: false,
  };

  await s3
    .putObject(params)
    .promise()
    .then((data) => {
      logger.log('info', 'file uploaded to s3 ', data);
    })
    .catch((err) => {
      logger.log('error', 'error while putting file in S3 ', err);
      response.isS3Error = true;
    });

  return response;
}

module.exports = {
  getFromS3,
  putInS3,
};
