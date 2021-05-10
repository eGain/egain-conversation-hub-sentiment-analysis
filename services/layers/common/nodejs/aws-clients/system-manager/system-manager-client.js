const SystemManager = require('aws-sdk/clients/ssm');

const { Logger } = require('ps-chronicle');

const ssm = new SystemManager();

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../constants/constants.js');

const loggerContext = {
  fileName: 'system-manager-client.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

/**
 * This method returns all the parameters from parameter store available at given path
 * @param {string} parameterPath
 */
async function getParametersFromStore(parameterPath) {
  logger.log(
    'debug',
    `inside getParametersFromStore method.Input parameter path : ${parameterPath}`,
  );
  let retVal = [];
  let hasMoreParameters = true;
  let nextToken;
  const req = { Path: parameterPath, MaxResults: 10 };
  while (hasMoreParameters) {
    // nextToken is used to fetch next set of parameters
    if (nextToken) req.NextToken = nextToken;
    await ssm
      .getParametersByPath(req)
      .promise()
      // eslint-disable-next-line no-loop-func
      .then((data) => {
        if (data.NextToken) {
          // nextToken is returned if there are more parameters to fetch
          nextToken = data.NextToken;
          hasMoreParameters = true;
        } else {
          hasMoreParameters = false;
        }
        retVal = retVal.concat(data.Parameters);
      })
      // eslint-disable-next-line no-loop-func
      .catch((err) => {
        logger.log(
          'error',
          `error while getting parameters from parameter store for path :${parameterPath}`,
          err,
        );
        return retVal;
      });
  }

  return retVal;
}

async function putParameterToStore(params) {
  let retVal = {};
  logger.log('debug', 'inside putParameterToStore method.Input params', params);
  await ssm
    .putParameter(params)
    .promise()
    .then((data) => {
      retVal = data;
    })
    .catch((err) => {
      logger.log('error', 'error while putting parameter to parameter store', err);
    });

  return retVal;
}

module.exports = {
  getParametersFromStore,
  putParameterToStore,
};
