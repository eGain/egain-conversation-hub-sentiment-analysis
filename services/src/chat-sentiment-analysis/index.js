const dataProcessor = require('./processor/data-processor.js');

/**
 * This lambda function performs chat sentiment analysis
 * It gets data from eGain for chat activities and formats the data and
 * posts calls AWS Comprehend
 * @param {*} event
 * @param {*} context
 */
exports.handler = async (event, context) => {
  const response = {};

  let isDataTransferSuccess = false;

  try {
    isDataTransferSuccess = await dataProcessor.processDataIngestion(event, context);
    response.statusCode = 200;
  } catch (error) {
    console.log(error);
    response.statusCode = 500;
  }
  response.body = JSON.stringify({ dataTransfer: isDataTransferSuccess });

  return response;
};
