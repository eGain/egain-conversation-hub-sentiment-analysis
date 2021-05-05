const axios = require('axios');

const { Logger } = require('ps-chronicle');

const maskUtil = require(process.env.AWS_REGION
  ? '/opt/nodejs/utils/masker'
  : '../utils/masker.js');

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../constants/constants.js');

const maskingOptions = {
  enabled: process.env.LogMasking.toUpperCase() === 'TRUE',
  fields: commonConstants.MASKING_OPTIONS.fields,
  maskWith: commonConstants.MASKING_OPTIONS.maskWith,
};

const mask = maskUtil(maskingOptions);

const loggerContext = {
  fileName: 'axios-client.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

async function makeRequest(request) {
  //logger.log('debug', 'inside makeRequest of axios client');

  let response = {};

  logger.log('wspayload', 'inside makeRequest of axios client, Request: ', mask(request));

  await axios(request)
    .then((resp) => {
      response = resp;
    })
    .catch((err) => {
      logger.log('error', 'error while making API request:', mask(err));
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        response.error = err.response;
      } else {
        // Something happened in setting up the request that triggered an Error
        response.error = err;
      }
    });

  logger.log('wspayload', 'returning response from client', {
    data: mask(response.data),
    headers: mask(response.headers),
  });

  return response;
}

module.exports = {
  makeRequest,
};
