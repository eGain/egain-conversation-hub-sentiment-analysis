const { egGlobalCache } = require(process.env.AWS_REGION
  ? '/opt/nodejs/cache/global-cache'
  : '../../../layers/common/nodejs/cache/global-cache.js');

const { commonConstants, cacheKeys, http, eGainAPIs } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../../layers/common/nodejs/constants/constants.js');

const axiosClient = require(process.env.AWS_REGION
  ? '/opt/nodejs/axios-client/axios-client'
  : '../../../layers/common/nodejs/axios-client/axios-client.js');

const { Logger } = require('ps-chronicle');

const loggerContext = {
  fileName: 'egain-api-service.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};
const logger = new Logger(loggerContext, process.env.LogLevel);

let xEgainSession;

/**
 * This method gets X-egain session using the credentials stored in secret manager.
 * The X-egain-session is assigned to a file variable xEgainSession which is used further to call egain APIs
 * @param {number} retryCount Count of retry. if not provided default value is taken as 1
 */
async function getXeGainSession(retryCount) {
  if (!retryCount) {
    // eslint-disable-next-line no-param-reassign
    retryCount = 1;
  }

  logger.log('debug', 'inside getXeGainSession method', { retry: retryCount });

  let response = {
    isAuthenticationSuccess: false,
    terminateProcessing: false,
  };

  try {
    const loginURL = egGlobalCache.get(cacheKeys.EGAIN_HOST_URL) + eGainAPIs.LOGIN_API_URL;

    const requestHeaders = {
      Accept: http.HEADERS.ACCEPT.APPLICATION_JSON,
      'Accept-Language': http.HEADERS.LANGUAGE.EN_US,
    };

    const requestBody = egGlobalCache.get(cacheKeys.EGAIN_USER_CREDENTIALS);

    const params = {
      forceLogin: 'yes',
    };

    const request = {
      method: http.METHODS.POST,
      url: loginURL,
      headers: requestHeaders,
      params,
      data: requestBody,
      timeout: 1000 * egGlobalCache.get(cacheKeys.AXIOS_API_REQUEST_TIMEOUT),
    };

    if (egGlobalCache.get(cacheKeys.PROXY)) request.proxy = egGlobalCache.get(cacheKeys.PROXY);

    let clientResponse = await axiosClient.makeRequest(request);

    if (!clientResponse.error) {
      response.sessionHeader = clientResponse.headers['x-egain-session'];
      xEgainSession = clientResponse.headers['x-egain-session'];
      // response.isAuthenticationSuccess = true;
      if (xEgainSession && xEgainSession !== '') {
        response.isAuthenticationSuccess = true;
        logger.log('INFO', 'User authenticated successfully');
      }
    } else {
      response.error = clientResponse.error;
      if (
        response.error.code === 'ECONNABORTED' ||
        response.error.status === http.RESPONSE_CODES.GATEWAY_TIMEOUT
      ) {
        // retry
        if (retryCount < egGlobalCache.get(cacheKeys.NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT)) {
          logger.log(
            'error',
            'Axios request timeout while getting x-egain-session. Will retry now'
          );
          response = await getXeGainSession(retryCount + 1);
        } else {
          logger.log(
            'error',
            'Axios request timeout while getting x-egain-session. Max retry done.',
            { error: response.error }
          );
          response.terminateProcessing = true;
        }
      } else {
        logger.log('error', 'Error while getting x-egain-session. Will stop processing now.', {
          error: response.error,
        });
        response.terminateProcessing = true;
      }
    }
  } catch (error) {
    logger.log('error', 'unhandled error ', { error });
    response.terminateProcessing = true;
  }
  return response;
}

/**
 * This method returns the list of searched activities in response object.
 * @param {string} lastModifiedDateFilter Date range filter.ISO date format. format - [from,to]
 * @param {number} pageNumber page number of search results.
 * @param {number} retryCount retry count. default is 1
 */
async function searchActivities(lastModifiedDateFilter, pageNumber, retryCount) {
  if (!retryCount) {
    // eslint-disable-next-line no-param-reassign
    retryCount = 1;
  }

  logger.log('debug', 'inside SearchActivities method...', [
    lastModifiedDateFilter,
    pageNumber,
    retryCount,
  ]);

  let response = { terminateProcessing: false };

  if (!xEgainSession || xEgainSession === '') {
    logger.log('info', 'x-egain-session is not available. Will get that now');
    const loginResponse = await getXeGainSession();
    if (!loginResponse.isAuthenticationSuccess) {
      response.terminateProcessing = true;
      response.error = loginResponse.error;
      return response;
    }
  }

  try {
    const activityAPIURL = egGlobalCache.get(cacheKeys.EGAIN_HOST_URL) + eGainAPIs.ACTIVITY_API_URL;

    const requestHeaders = {
      Accept: http.HEADERS.ACCEPT.APPLICATION_JSON,
      'Accept-Language': http.HEADERS.LANGUAGE.EN_US,
      'X-egain-session': xEgainSession,
    };
    const params = {
      status: 'completed',
      type: 'chat',
      lastModifiedDate: lastModifiedDateFilter,
      $pagenum: pageNumber,
      $pagesize: egGlobalCache.get(cacheKeys.EGAIN_API_PAGE_SIZE),
      $sort: 'lastModifiedDate',
    };

    const request = {
      method: http.METHODS.GET,
      url: activityAPIURL,
      headers: requestHeaders,
      params,
      timeout: 1000 * egGlobalCache.get(cacheKeys.AXIOS_API_REQUEST_TIMEOUT),
    };

    if (egGlobalCache.get(cacheKeys.PROXY)) request.proxy = egGlobalCache.get(cacheKeys.PROXY);

    const clientResponse = await axiosClient.makeRequest(request);
    if (!clientResponse.error) {
      response.activity = clientResponse.data.activity ? clientResponse.data.activity : [];
      if (clientResponse.paginationInfo) {
        response.paginationInfo = clientResponse.paginationInfo;
      }
    } else {
      response.error = clientResponse.error;
      if (
        response.error.code === 'ECONNABORTED' ||
        response.error.status === http.RESPONSE_CODES.GATEWAY_TIMEOUT
      ) {
        // retry
        if (retryCount < egGlobalCache.get(cacheKeys.NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT)) {
          logger.log('error', 'Request timeout error while searching activities...Will retry now');
          response = await searchActivities(lastModifiedDateFilter, pageNumber, retryCount + 1);
        } else {
          logger.log(
            'error',
            'Request timeout error while searching activities. Max retry done. Will stop processing now',
            { error: response.error }
          );
          response.terminateProcessing = true;
        }
      } else if (response.error.status === http.RESPONSE_CODES.UNAUTHORIZED) {
        xEgainSession = '';
        response = await searchActivities(lastModifiedDateFilter, pageNumber, retryCount + 1);
      } else {
        logger.log('error', 'Error While searching activities.', {
          error: response.error,
        });
        response.terminateProcessing = true;
      }
    }
  } catch (error) {
    logger.log('error', 'unhandled error ', { error });
    response.terminateProcessing = true;
  }

  return response;
}

/**
 * This method returns details of activity id in response object required for this customization.
 * @param {number} activityId
 * @param {number} retryCount
 */
async function getAllDetailsOfActivity(activityId, retryCount) {
  if (!retryCount) {
    // eslint-disable-next-line no-param-reassign
    retryCount = 1;
  }

  logger.log('debug', `inside getAllDetailsOfActivity method. Activity Id = ${activityId}`);

  let response = {};

  if (!xEgainSession || xEgainSession === '') {
    logger.log('error', 'x-egain-session is not available. Will get that now');
    const loginResponse = await getXeGainSession();
    if (!loginResponse.isAuthenticationSuccess) {
      response.terminateProcessing = true;
      response.error = loginResponse.error;
      return response;
    }
  }
  try {
    const activityAPIURL = `${
      egGlobalCache.get(cacheKeys.EGAIN_HOST_URL) + eGainAPIs.ACTIVITY_API_URL
    }/${activityId}`;

    const requestHeaders = {
      Accept: http.HEADERS.ACCEPT.APPLICATION_JSON,
      'Accept-Language': http.HEADERS.LANGUAGE.EN_US,
      'X-egain-session': xEgainSession,
    };
    const params = {
      $attribute: 'payload,contactPointData,created,userLastWorked',
    };

    const request = {
      method: http.METHODS.GET,
      url: activityAPIURL,
      headers: requestHeaders,
      params,
      timeout: 1000 * egGlobalCache.get(cacheKeys.AXIOS_API_REQUEST_TIMEOUT),
    };

    if (egGlobalCache.get(cacheKeys.PROXY)) {
      request.proxy = egGlobalCache.get(cacheKeys.PROXY);
    }
    const clientResponse = await axiosClient.makeRequest(request);

    if (!clientResponse.error) {
      response.activity = clientResponse.data.activity[0];
      egGlobalCache.set(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API, 0);
    } else {
      response.error = clientResponse.error;
      if (
        response.error.code === 'ECONNABORTED' ||
        response.error.status === http.RESPONSE_CODES.GATEWAY_TIMEOUT
      ) {
        // retry
        if (retryCount < egGlobalCache.get(cacheKeys.NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT)) {
          logger.log(
            'error',
            'Request timeout error while getting activity detail.. Will retry now'
          );
          response = await getAllDetailsOfActivity(activityId, retryCount + 1);
        } else {
          logger.log(
            'error',
            'Request timeout error while getting activity detail. Max retry done.',
            { error: response.error }
          );
          egGlobalCache.set(
            cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API,
            egGlobalCache.get(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API) + 1
          );
        }
      } else if (response.error.status === http.RESPONSE_CODES.UNAUTHORIZED) {
        xEgainSession = '';
        response = await getAllDetailsOfActivity(activityId, retryCount + 1);
      } else {
        logger.log('error', 'Error while getting activity detail.', {
          error: response.error,
        });
        egGlobalCache.set(
          cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API,
          egGlobalCache.get(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API) + 1
        );
      }
    }
  } catch (error) {
    logger.log('error', 'unhandled error ', { error });
    egGlobalCache.set(
      cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API,
      egGlobalCache.get(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API) + 1
    );
  }
  if (
    egGlobalCache.get(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API) ===
    egGlobalCache.get(cacheKeys.MAX_CONTINUOUS_FAILURE_TO_STOP)
  ) {
    logger.log(
      'error',
      'Processing Will Stop as Maximum Continuous failure count reached.',
      egGlobalCache.get(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API)
    );
    response.terminateProcessing = true;
  }
  return response;
}

/**
 * This method returns summary attributes of users
 * @param {string} userIds a comma separated list of userids.
 * @param {*} retryCount retry count. default is 1.
 */
async function getUsersByIds(userIds, retryCount) {
  if (!retryCount) {
    // eslint-disable-next-line no-param-reassign
    retryCount = 1;
  }

  logger.log('debug', `inside getUsersByIds method. userIds = ${userIds}`);

  let response = {};

  if (!xEgainSession || xEgainSession === '') {
    logger.log('error', 'x-egain-session is not available. Will get that now');
    const loginResponse = await getXeGainSession();
    if (!loginResponse.isAuthenticationSuccess) {
      response.terminateProcessing = true;
      response.error = loginResponse.error;
      return response;
    }
  }
  try {
    const getUsersAPIURL = `${
      egGlobalCache.get(cacheKeys.EGAIN_HOST_URL) + eGainAPIs.USER_API_URL
    }/${userIds}`;

    const requestHeaders = {
      Accept: http.HEADERS.ACCEPT.APPLICATION_JSON,
      'Accept-Language': http.HEADERS.LANGUAGE.EN_US,
      'X-egain-session': xEgainSession,
    };
    const params = {};

    const request = {
      method: http.METHODS.GET,
      url: getUsersAPIURL,
      headers: requestHeaders,
      params,
      timeout: 1000 * egGlobalCache.get(cacheKeys.AXIOS_API_REQUEST_TIMEOUT),
    };

    if (egGlobalCache.get(cacheKeys.PROXY)) {
      request.proxy = egGlobalCache.get(cacheKeys.PROXY);
    }

    const clientResponse = await axiosClient.makeRequest(request);
    if (!clientResponse.error) {
      response.users = clientResponse.data.user;
    } else {
      response.error = clientResponse.error;
      if (
        response.error.code === 'ECONNABORTED' ||
        response.error.status === http.RESPONSE_CODES.GATEWAY_TIMEOUT
      ) {
        // retry
        if (retryCount < egGlobalCache.get(cacheKeys.NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT)) {
          logger.log('error', 'Request timeout error while getting users.. Will retry now');
          response = await getUsersByIds(userIds, retryCount + 1);
        } else {
          logger.log('error', 'Request timeout error while getting users. Max retry done.', {
            error: response.error,
          });
        }
      } else if (response.error.status === http.RESPONSE_CODES.UNAUTHORIZED) {
        xEgainSession = '';
        response = await getUsersByIds(userIds, retryCount + 1);
      } else {
        logger.log('error', 'Error while getting users detail.', {
          error: response.error,
        });
      }
    }
  } catch (error) {
    logger.log('error', 'unhandled error ', { error });
  }

  return response;
}
module.exports = {
  getXeGainSession,
  searchActivities,
  getAllDetailsOfActivity,
  getUsersByIds,
};
