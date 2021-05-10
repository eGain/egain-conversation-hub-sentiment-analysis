const AWSDynamoDB = require('aws-sdk/clients/dynamodb');

const { Logger } = require('ps-chronicle');

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../constants/constants.js');

const loggerContext = {
  fileName: 'dynamodb-client.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

const dynamodbClient = new AWSDynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
});
/**
 * This method gets data from Dynamo DB. It returns an object with return data and error flag
 * @param {object} params
 */
async function getDataFromDynamoDB(params) {
  logger.log('debug', 'inside method getDataFromDynamoDB with data', {
    params,
  });

  const retVal = {
    isError: false,
  };
  await dynamodbClient
    .get(params)
    .promise()
    .then((data) => {
      logger.log('debug', 'Successfully got data from DynamoDB ', {
        data,
      });
      retVal.data = data;
    })
    .catch((err) => {
      logger.log('error', 'error while fetching data from DynamoDB', err);
      retVal.isError = true;
    });

  return retVal;
}

/**
 * This method puts data into Dynamo DB. It returns an object with return data and error flag
 * @param {object} params
 */
async function putDataIntoDynamoDB(params) {
  logger.log('debug', 'inside method putDataIntoDynamoDB with data', {
    params,
  });

  const retVal = {
    isError: false,
  };
  await dynamodbClient
    .put(params)
    .promise()
    .then((data) => {
      logger.log('info', 'Successfully added data to DynamoDB', {
        data,
      });
      retVal.data = data;
    })
    .catch((err) => {
      logger.log('error', 'Error while adding data to DynamoDB', err);
      retVal.isError = true;
    });
  return retVal;
}

/**
 * This method puts data into Dynamo DB. It returns an object with return data and error flag
 * @param {object} params
 */
async function updateDataIntoDynamoDB(params) {
  logger.log('debug', 'inside method updateDataIntoDynamoDB with data', {
    params,
  });

  const retVal = {
    isError: false,
  };
  await dynamodbClient
    .update(params)
    .promise()
    .then((data) => {
      logger.log('debug', 'Successfully data updated into DynamoDB', {
        data,
      });
      retVal.data = data;
    })
    .catch((err) => {
      logger.log('error', 'error while updating data into DynamoDB', err);
      retVal.isError = true;
    });
  return retVal;
}

module.exports = {
  getDataFromDynamoDB,
  putDataIntoDynamoDB,
  updateDataIntoDynamoDB,
};
