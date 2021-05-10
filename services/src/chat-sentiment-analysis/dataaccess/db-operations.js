const dynamoDBClient = require(process.env.AWS_REGION
  ? '/opt/nodejs/aws-clients/db-client/dynamodb-client'
  : '../../../layers/common/nodejs/aws-clients/db-client/dynamodb-client.js');

const { Logger } = require('ps-chronicle');

const { commonConstants, databaseProps } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../../layers/common/nodejs/constants/constants.js');

const loggerContext = {
  fileName: 'db-operations.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};
const logger = new Logger(loggerContext, process.env.LogLevel);

/**
 * get tidemark item from tidemark table
 * @param {string} tidemarkName
 */
async function getTideMarkItem(tidemarkName) {
  let retVal = '';

  const params = {
    TableName: databaseProps.TIDEMARK_TABLE_NAME,
    Key: {
      TIDEMARK_NAME: tidemarkName,
    },
  };

  const response = await dynamoDBClient.getDataFromDynamoDB(params);

  retVal = response.data.Item;

  await logger.log('info', 'Returning tidemark as', { retVal });

  return retVal;
}

/**
 * Update call-miner-post tidemark last modified dates in tidemark table
 * @param {string} lastModifiedFromDate lastModified from date ISO string
 * @param {string} lastModifiedToDate lastModified to date ISO string
 */
async function updateLastModifiedTideMark(lastModifiedFromDate, lastModifiedToDate) {
  logger.log(
    'info',
    `updating tidemark to DB lastModifiedFromDate =${lastModifiedFromDate} & lastModifiedToDate= ${lastModifiedToDate}`,
  );

  const params = {
    TableName: databaseProps.TIDEMARK_TABLE_NAME,
    Key: {
      TIDEMARK_NAME: databaseProps.POST_TIDEMARK_NAME,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  if (lastModifiedToDate) {
    params.UpdateExpression =
      'set ACTIVITY_VALUE_FROM = :dateFrom, ACTIVITY_VALUE_TO = :dateTo, MODIFIEDDATE_UTC = :dateModified';
    params.ExpressionAttributeValues = {
      ':dateFrom': lastModifiedFromDate,
      ':dateTo': lastModifiedToDate,
      ':dateModified': new Date().toISOString(),
    };
  } else {
    params.UpdateExpression =
      'set ACTIVITY_VALUE_FROM = :dateFrom, MODIFIEDDATE_UTC = :dateModified';
    params.ExpressionAttributeValues = {
      ':dateFrom': lastModifiedFromDate,
      ':dateModified': new Date().toISOString(),
    };
  }

  const response = await dynamoDBClient.updateDataIntoDynamoDB(params);

  if (response.isError) {
    logger.log('info', 'Error while updating tidemark into DB', {
      response,
    });
  }

  return response;
}

/**
 * This method updates last run status as true/false in case of abrupt stop of normal processing
 * @param {boolean} runStatus
 */
async function updateRunStatusToPostTideMark(runStatus) {
  logger.log('info', `updating tidemark to DB runStatus =${runStatus}`);

  const params = {
    TableName: databaseProps.TIDEMARK_TABLE_NAME,
    Key: {
      TIDEMARK_NAME: 'call-miner-post',
    },
    ReturnValues: 'UPDATED_NEW',
  };

  params.UpdateExpression = 'set PROCESS_STATUS = :runStatus, MODIFIEDDATE_UTC = :dateModified';
  params.ExpressionAttributeValues = {
    ':runStatus': runStatus,
    ':dateModified': new Date().toISOString(),
  };

  const response = await dynamoDBClient.updateDataIntoDynamoDB(params);

  if (response.isError) {
    logger.log('info', 'Error while updating tidemark into DB', {
      response,
    });
  }

  return response;
}
/**
 * This method updates process status to true for Bowwave data processing tidemarks
 * in the tidemark table
 * @param {string} tidemarkName
 */
async function updateBowwaveProcessStatus(tidemarkName) {
  logger.log('info', `updating process status to DB for tidemark =${tidemarkName}`);

  const params = {
    TableName: databaseProps.TIDEMARK_TABLE_NAME,
    Key: {
      TIDEMARK_NAME: tidemarkName,
    },
    ReturnValues: 'UPDATED_NEW',
  };

  params.UpdateExpression = 'set PROCESS_STATUS = :processStatus, MODIFIEDDATE_UTC = :dateModified';
  params.ExpressionAttributeValues = {
    ':processStatus': true,
    ':dateModified': new Date().toISOString(),
  };

  const updateResponse = await dynamoDBClient.updateDataIntoDynamoDB(params);

  if (updateResponse.isError) {
    logger.log('error', 'Error while updating bowwave process status', {
      updateResponse,
    });
  } else {
    logger.log('info', 'Successfully updated bowwave process status', {
      updateResponse,
    });
  }
}
/**
 * This method updated batch run information to database.
 * @param {string} startTime processing start time ISO string
 * @param {string} endTime processing end time ISO string
 * @param {boolean} processTerminated boolean that shows that processing terminated abruptly
 * @param {object} successfullyPostedActivities array of comma separated activity ids
 * @param {object} failedActivities array of comma separated activity ids
 */
async function updateProcessingDetailsForCurrentRun(
  startTime,
  endTime,
  processTerminated,
  successfullyPostedActivities,
  failedActivities,
) {
  logger.log('info', 'updating processing details for this run in DB', {
    startTime,
    endTime,
    processTerminated,
    successfullyPostedActivities,
    failedActivities,
  });

  const expireTime = new Date();
  // setting Date after 30 days
  expireTime.setDate(
    expireTime.getDate() + parseInt(process.env.BatchProcessingDataRetentionDays, 10),
  );

  let runStatus = '';
  if (processTerminated) {
    // set to Abrupt if process is terminated.
    runStatus = 'Abrupt';
  } else if (failedActivities.length === 0) {
    // set to success if there is no failed activity and process is not terminated
    runStatus = 'Success';
  } else {
    runStatus = 'Failure';
  }

  const params = {
    TableName: databaseProps.BATCH_DATA_TABLE_NAME,
    Item: {
      BATCH_ID: new Date().getTime().toString(),
      BATCH_KEY_COLUMN_NAME: 'ACTIVITY_ID',
      BATCH_SUCCESS_KEY_COLUMN_VALUE: successfullyPostedActivities.join(),
      BATCH_UNPROCESSED_KEY_COLUMN_VALUE: failedActivities.join(),
      EXPIRE_TIME: parseInt(expireTime.getTime() / 1000, 10)
        .toFixed(0)
        .toString(),
      RECORDS_COUNT: successfullyPostedActivities.length + failedActivities.length,
      RUN_END_TIME_UTC: endTime.toString(),
      RUN_START_TIME_UTC: startTime.toString(),
      RUN_STATUS: runStatus,
      DATA_NAME: 'chat_transcript_data',
    },
  };

  const putResponse = await dynamoDBClient.putDataIntoDynamoDB(params);

  if (putResponse.isError) {
    logger.log('error', 'Error while putting batch data into DB', {
      putResponse,
    });
  } else {
    logger.log('info', 'Successfully added batch info to DB');
  }

  return putResponse;
}
module.exports = {
  getTideMarkItem,
  updateLastModifiedTideMark,
  updateBowwaveProcessStatus,
  updateProcessingDetailsForCurrentRun,
  updateRunStatusToPostTideMark,
};
