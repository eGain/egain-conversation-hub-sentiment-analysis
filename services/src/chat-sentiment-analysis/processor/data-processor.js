// eslint-disable-next-line import/no-extraneous-dependencies
const { JSDOM } = require('jsdom');
const { Logger } = require('ps-chronicle');

const AWS = require('aws-sdk');

const comprehend = new AWS.Comprehend();

const util = require('util');

const { egGlobalCache } = require(process.env.AWS_REGION
  ? '/opt/nodejs/cache/global-cache'
  : '../../../layers/common/nodejs/cache/global-cache');

const { awsProps, commonConstants, cacheKeys, databaseProps, transcriptProps } = require(process.env
  .AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../../layers/common/nodejs/constants/constants.js');

const awsSystemManagerClient = require(process.env.AWS_REGION
  ? '/opt/nodejs/aws-clients/system-manager/system-manager-client'
  : '../../../layers/common/nodejs/aws-clients/system-manager/system-manager-client.js');

const egainAPIService = require('../service/egain-api-service.js');

const cacheInitiator = require('../cache/cache-initiator.js');

const dbOperations = require('../dataaccess/db-operations.js');

const { createHTML } = require('../helper/htmlHelper');

const { getPercentage } = require('../util/utils');

let timeToStopProcessing;

const loggerContext = {
  fileName: 'data-processor.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

let successfullyPostedActivities = [];
let failedToPostActivities = [];

let isProcessingTerminated = false;

const customerTranscriptMap = new Map(); // <customerName,[transcripts]>
async function getParsedTranscriptContent(activity) {
  logger.log('info', `parsing activity transcript for activity${activity.id}`);

  // need to mask activity object for PII Data so commenting the logger
  // logger.log("debug", "logging activity object", { activity: activity });

  let chatTranscript = '';

  // find html chat transcript from transcript object
  for (let x = 0; x < activity.payload.chat.transcript.content.length; x += 1) {
    if (activity.payload.chat.transcript.content[x].type === 'html')
      chatTranscript = activity.payload.chat.transcript.content[x];
  }
  const transcripts = [];

  const { contactPointData } = activity;

  if (activity.customer) {
    let { customerName } = activity.customer;

    const userMap = {};

    const isTransferOrConferenceActivity =
      activity.payload.chat.isConference && activity.payload.chat.isConference.value;
    /* incase of conference or transfer we need to get user details using users API.
  As we need to get screenName and user id mapping. This method will be changed to
   store userid and screenName for single run so we can save multiple API calls
  */
    if (isTransferOrConferenceActivity) {
      const userIds = [];
      const users = activity.payload.chat.isConference.users.user;
      for (let i = 0; i < users.length; i += 1) {
        userIds.push(users[i].id);
      }
      const usersAPIResponse = await egainAPIService.getUsersByIds(userIds.join());
      const usersArray = usersAPIResponse.users;

      for (let i = 0; i < usersArray.length; i += 1) {
        const screenName = usersArray[i].screenName.toUpperCase();
        userMap[screenName] = {
          id: usersArray[i].id,
          name: `${usersArray[i].lastName} ${usersArray[i].firstName}`,
        };
      }
    }
    logger.log('debug', 'userMap', userMap);

    // get customer name from contact person.
    // The format is last name + first name so we cant use custName property of response directly
    if (
      activity.customer.contactPersons &&
      activity.customer.contactPersons.contactPerson &&
      activity.customer.contactPersons.contactPerson.length > 0
    ) {
      const contactPerson = activity.customer.contactPersons.contactPerson[0];

      customerName = contactPerson.lastName
        ? `${contactPerson.lastName} ${contactPerson.firstName}`.trim()
        : contactPerson.firstName;
    }

    // create a transcript dom from transcript html
    const transcriptDOM = new JSDOM(chatTranscript.value);

    let transferTime;
    let systemTransferMessageIndex = 0;
    let customerMessageIndexStartForTransfer;
    let currentNumberOfAgent = 1;

    const sentimentCustomerMessages = [];
    try {
      // get chat start time from start message
      let chatStartTimeString = '';
      const chatStartTimeLElement = transcriptDOM.window.document.querySelectorAll(
        '.chatStartTime',
      );
      chatStartTimeString = chatStartTimeLElement[0].textContent
        .replace(/[\n\r]+|[\s]{2,}/g, ' ')
        .trim();
      //  <B>CHAT STARTED AT</B> 8:47 AM (24 Nov 2020)
      // get Chat start date from chat start message of transcript.
      const chatStartDate = chatStartTimeString.substring(
        chatStartTimeString.indexOf('(') + 1,
        chatStartTimeString.indexOf(')'),
      );
      // keepGoing flag will help to iterate for transcripts
      // for multiple agents in case of transfer and conference
      let keepGoing = true;
      let numberOfAgentsInConference = 1;

      while (keepGoing || numberOfAgentsInConference > 0) {
        // currentNumberOfAgent += 1;
        numberOfAgentsInConference = -1;
        const messageArray = [];
        let agentScreenName;

        // get All system messages using .system class as query selector.
        const systemTranscriptElements = transcriptDOM.window.document.querySelectorAll('.system');
        // Iterate over all system messages to parse them
        for (
          let index = systemTransferMessageIndex;
          index < systemTranscriptElements.length;
          index += 1
        ) {
          const systemTranscriptText = systemTranscriptElements[index].textContent
            .replace(/[\n\r]+|[\s]{2,}/g, ' ')
            .trim();
          // get time of text using time format regax.
          const textTime = systemTranscriptText.match(transcriptProps.TIME_FORMAT_REGEX)[0];
          // system messages only have message text and timestamp. so replacing time with blank
          // will give actual text
          const messageText = systemTranscriptText.replace(textTime, '').trim();
          // messages doesn't have date into message time so we can build time using start date and time stamp
          const textTimeStamp = new Date(Date.parse(`${chatStartDate} ${textTime}`));
          // push this message to messageArray
          messageArray.push({
            speaker: '3',
            Text: messageText,
            PostDateTime: textTimeStamp.toISOString(),
            TextInformation: '',
          });
          logger.log(
            'debug',
            `Index :${index} Total system messages ${systemTranscriptElements.length}`,
          );
          // if we reach to end of all system messages means no transfer and no conference.
          // So we will need only single agent transcript. marking keepGoing false.
          if (index === systemTranscriptElements.length - 1) {
            keepGoing = false;
            systemTransferMessageIndex = index + 1;
          }
          if (
            isTransferOrConferenceActivity &&
            messageText.match(transcriptProps.NOW_CHATTING_WITH_AGENT_REGEX)
          ) {
            agentScreenName = messageText
              .match(transcriptProps.NOW_CHATTING_WITH_AGENT_REGEX)[1]
              .toUpperCase();
          } else if (
            isTransferOrConferenceActivity &&
            messageText.toUpperCase().indexOf(transcriptProps.TRANSFER_TEXT) > -1
          ) {
            // transfer text found. will not transfer time so we can split
            // customer messages in different transcripts based on time.
            // for next run we will start system messages from next message index
            transferTime = new Date(Date.parse(`${chatStartDate} ${textTime}`));
            systemTransferMessageIndex = index + 1;
            logger.log(
              'debug',
              `transfer message found at index :${index}time stamp :${transferTime}`,
            );
            break;
          } else if (
            isTransferOrConferenceActivity &&
            messageText.toUpperCase().indexOf(transcriptProps.CONFERENCE_TEXT) > -1
          ) {
            // conference text found. one more agent joined so increase number of agents in conference
            numberOfAgentsInConference += 1;
          }
        }

        // current number of agent will be used to generate class name for agent messages. ex agent1, agent2...
        const agentClassName = `.agent${currentNumberOfAgent}`;
        // get all agent message elements from transcript dom using agent class selector
        const agentTranscriptElements = transcriptDOM.window.document.querySelectorAll(
          agentClassName,
        );
        let agentMessageFound = false;
        // Iterate over all message elements and parse message timestamp, agent screenName and actual text
        for (let index = 0; index < agentTranscriptElements.length; index += 1) {
          const agentTranscriptText = agentTranscriptElements[index].textContent
            .replace(/[\n\r]+|[\s]{2,}/g, ' ')
            .trim();
          const textTime = agentTranscriptText.match(transcriptProps.TIME_FORMAT_REGEX)[0];
          const textTimeStamp = new Date(Date.parse(`${chatStartDate} ${textTime}`));
          if (transferTime && transferTime < textTimeStamp) {
            break;
          } else {
            agentMessageFound = true;
          }
          // splitting message on time stamp will give array of two elements, agent screen name and actual text
          const textMessageArr = agentTranscriptText.split(textTime);
          agentScreenName = textMessageArr[0].trim().toUpperCase();
          // logger.log("debug", "Agent Screen Name " + agentScreenName);
          const messageText = textMessageArr[1].trim();
          // const textTimeStamp = new Date(Date.parse(`${chatStartDate} ${textTime}`));
          messageArray.push({
            speaker: '1',
            Text: messageText,
            PostDateTime: textTimeStamp.toISOString(),
            TextInformation: '',
          });
        }
        if (agentMessageFound) {
          currentNumberOfAgent += 1;
        }

        // get all customer messages elements using .customer class selector
        const customerTranscriptElements = transcriptDOM.window.document.querySelectorAll(
          '.customer',
        );
        logger.log(
          'debug',
          `start index for customer messages: ${customerMessageIndexStartForTransfer} total customer messages ${customerTranscriptElements.length}`,
        );
        for (
          let index = customerMessageIndexStartForTransfer || 0;
          index < customerTranscriptElements.length;
          index += 1
        ) {
          const customerTranscriptText = customerTranscriptElements[index].textContent
            .replace(/[\n\r]+|[\s]{2,}/g, ' ')
            .trim();
          // get customer text time
          const textTime = customerTranscriptText.match(transcriptProps.TIME_FORMAT_REGEX)[0];
          // split the message to get actual text
          const textMessageArr = customerTranscriptText.split(textTime);
          const messageText = textMessageArr[1].trim();
          const textTimeStamp = new Date(Date.parse(`${chatStartDate} ${textTime}`));
          if (transferTime && transferTime < textTimeStamp) {
            // this message was sent after transfer so it should go with next agent transcript
            logger.log(
              'debug',
              `this message should be included in next transcript ${textMessageArr}`,
            );
            // set customer message index to current index so for next agent transcript
            // we can start processing from here
            customerMessageIndexStartForTransfer = index;
            // reset transfer time So we can detect new transfer time
            transferTime = null;
            break;
          }
          if (index === customerTranscriptElements.length - 1) {
            customerMessageIndexStartForTransfer = index + 1;
          }

          sentimentCustomerMessages.push(messageText);

          messageArray.push({
            speaker: '2',
            Text: messageText,
            PostDateTime: textTimeStamp.toISOString(),
            TextInformation: contactPointData,
          });
        }

        // sort message array based on message timestamp
        messageArray.sort((a, b) => Date.parse(a.PostDateTime) - Date.parse(b.PostDateTime));

        logger.log('info', 'Message Array :', { messageArray });

        transcripts.push({
          Transcript: messageArray,
          ClientCaptureDate: activity.created.date,
        });

        // Sentiment analysis map
        let transcriptArr = [];
        if (customerTranscriptMap.has(customerName)) {
          transcriptArr = customerTranscriptMap.get(customerName);
        }
        transcriptArr.push(sentimentCustomerMessages);
        customerTranscriptMap.set(customerName, transcriptArr);
      }
    } catch (error) {
      logger.log('error', `error while parsing the transcript for activity id \n ${error}`);
      failedToPostActivities.push(activity.id);
      return [];
    }
  }
  logger.log(
    'info',
    'Customer not present in chat, activity seems to be for anonymous customer, skipping',
  );
  logger.log('debug', 'returning transcripts as', { transcripts });
  return transcripts;
}

/**
 * This method gets Activity details
 * @param {*} activityId
 */
async function processActivity(activityId) {
  let keepProcessing = true;

  logger.log('info', `processing activity Id : ${activityId}`);
  const activityResponse = await egainAPIService.getAllDetailsOfActivity(activityId);

  if (activityResponse.terminateProcessing) {
    // Send Error Notification
    failedToPostActivities.push(activityId);
    // await sendErrorNotification(activityResponse.error);
    keepProcessing = false;
    isProcessingTerminated = true;
    // return keepProcessing;
  } else if (activityResponse.error) {
    failedToPostActivities.push(activityId);
    // return keepProcessing;
    logger.log(
      'error',
      `error while getting details of activity, This activity will be skipped ${activityId}`,
    );
  } else {
    const { activity } = activityResponse;
    if (activity && activity.type.value === 'chat' && activity.status.value === 'completed') {
      const transcripts = await getParsedTranscriptContent(activity);

      logger.log('debug', 'Transcripts need to be posted for this activity', transcripts);
      for (let idx = 0; idx < transcripts.length; idx += 1) {
        // logger.log('info', 'Posting transcript below transcript', transcripts[idx]);
        // const postResponse = await callMinerAPIService.postDataToCallMiner(transcripts[idx]);
        // if (postResponse.isDataPosted && idx === transcripts.length - 1) {
        if (idx === transcripts.length - 1) {
          logger.log('error', `Activity Posted successfully: ${activity.id}`);
          if (!egGlobalCache.get(cacheKeys.IS_BOWWAVE_PROCESSING)) {
            logger.log(
              'info',
              `updating last modified tidemark with : ${activity.lastModified.date}`,
            );
            await dbOperations.updateLastModifiedTideMark(activity.lastModified.date);
          }
          // successfullyPostedActivities.push(activityId);
        }
        //  else if (postResponse.terminateProcessing) {
        //   // log error and send notification and exit
        //   logger.log('error', 'Terminal error while posting transcript', [
        //     activityId,
        //     transcripts[idx],
        //     postResponse,
        //   ]);
        //   failedToPostActivities.push(activityId);
        //   // await sendErrorNotification(postResponse.error, true);
        //   keepProcessing = false;
        //   isProcessingTerminated = true;
        //   break;
        // } else if (!postResponse.isDataPosted) {
        //   // error
        //   logger.log('error', 'Error while posting transcript', [
        //     activityId,
        //     transcripts[idx],
        //     postResponse,
        //   ]);
        //   failedToPostActivities.push(activityId);
        //   break;
        // }
      }
    }
  }

  return keepProcessing;
}
/**
 * This method processes data transfer for input activity list
 * @param {object} activityList list of activity ids to be processed
 */
async function processActivities(activityList) {
  for (let index = 0; index < activityList.length; index += 1) {
    const keepProcessing = await processActivity(activityList[index]);

    if (Date.now() > timeToStopProcessing) {
      logger.log(
        'error',
        'Run time approaching towards lambda timeout. Lambda will stop processing activities now to gracefully exit.',
      );
      break;
    }

    if (!keepProcessing) {
      isProcessingTerminated = true;
      break;
    }
  }
}

/**
 * This method searches and processes  activities matching last Modified date filter
 * @param {string} lastModifiedDateFilter ISO date filter string. Format - [from,to]
 */
async function searchAndProcessActivities(lastModifiedDateFilter) {
  // get X-eGain-session using login API
  const loginAPIResponse = await egainAPIService.getXeGainSession();

  if (!loginAPIResponse.isAuthenticationSuccess) {
    // Couldn't login to eGain. So send Error Notification and stop processing
    // await sendErrorNotification(loginAPIResponse.error);
    isProcessingTerminated = true;
    return false;
  }

  let currentPageNum = 1;
  let keepProcessing = true;

  while (keepProcessing) {
    // search activities those needs to be processed
    const activitiesToBeProcessed = await egainAPIService.searchActivities(
      lastModifiedDateFilter,
      currentPageNum,
    );
    // console.info("activities to be processed", activitiesToBeProcessed);
    if (!activitiesToBeProcessed.terminateProcessing) {
      if (activitiesToBeProcessed.activity.length === 0) {
        keepProcessing = false;
        break;
      }
      for (let index = 0; index < activitiesToBeProcessed.activity.length; index += 1) {
        const activityId = activitiesToBeProcessed.activity[index].id;
        keepProcessing = await processActivity(activityId);
        if (Date.now() > timeToStopProcessing) {
          logger.log(
            'error',
            'Run time approaching towards lambda timeout. Lambda will stop processing activities now to gracefully exit.',
          );
          break;
        }
        if (!keepProcessing) break;
      }
      currentPageNum += 1;
      if (Date.now() > timeToStopProcessing) {
        logger.log(
          'error',
          'Run time approaching towards lambda timeout. Lambda will stop processing activities now to gracefully exit.',
        );
        break;
      }
      if (
        activitiesToBeProcessed.paginationInfo &&
        activitiesToBeProcessed.paginationInfo.count <=
          activitiesToBeProcessed.paginationInfo.pagenum *
            activitiesToBeProcessed.paginationInfo.pagesize
      ) {
        keepProcessing = false;
      }
    } else {
      // send Error Notification of failure
      // await sendErrorNotification(activitiesToBeProcessed.error);
      keepProcessing = false;
      isProcessingTerminated = true;
      break;
    }
  }
  return true;
}

const processSentimentAnalysis = async () => {
  logger.log('debug', 'inside processSentimentAnalysis method');

  const customerList = Array.from(customerTranscriptMap.keys());
  for (let i = 0; i < customerList.length; i += 1) {
    const customer = customerList[i];
    const transcriptArr = customerTranscriptMap.get(customer);

    const transcriptArrStr = [];
    transcriptArr.map((transcript) => {
      transcriptArrStr.push(transcript.join());
    });

    const params = {
      LanguageCode: 'en',
      TextList: transcriptArrStr,
    };
    const saRes = await comprehend.batchDetectSentiment(params).promise();

    if (saRes.ErrorList && saRes.ErrorList.length > 0) {
      logger.log('error', 'error while getting sentiment analysis ', saRes.ErrorList);
    }
    if (saRes.ResultList && saRes.ResultList.length > 0) {
      let positiveScore = 0;
      let negativeScore = 0;
      let neutralScore = 0;
      let mixedScore = 0;

      saRes.ResultList.forEach((result) => {
        const { SentimentScore } = result;
        positiveScore += SentimentScore.Positive;
        negativeScore += SentimentScore.Negative;
        neutralScore += SentimentScore.Neutral;
        mixedScore += SentimentScore.Mixed;
      });
      const { length } = saRes.ResultList;

      const averageScore = {
        positive: getPercentage(positiveScore, length),
        negative: getPercentage(negativeScore, length),
        neutral: getPercentage(neutralScore, length),
        mixed: getPercentage(mixedScore, length),
      };

      await createHTML(customer, averageScore);
    }
  }
};
/**
 * This method takes event as input and processes chat transcripts
 * @param {object} event
 */
async function processDataIngestion(event, context) {
  const processingStartTime = new Date().toISOString();

  logger.log('debug', 'inside processDataIngestion method', [event, context]);

  // Stop process gracefully before 30 seconds
  timeToStopProcessing = Date.now() + context.getRemainingTimeInMillis() - 30000;

  // initialize config cache
  await cacheInitiator.initializeConfigCache();

  const isBowwaveProcessing = event['bowwave-process'];

  const awsAccountId = JSON.stringify(context.invokedFunctionArn).split(':')[4];

  egGlobalCache.set(cacheKeys.ACCOUNT_ID, awsAccountId);

  egGlobalCache.set(cacheKeys.IS_BOWWAVE_PROCESSING, isBowwaveProcessing);

  egGlobalCache.set(cacheKeys.PROCESSING_START_TIME, processingStartTime);

  // egGlobalCache.set(cacheKeys.STACK_NAME, event.ResourceProperties.StackName);

  isProcessingTerminated = false;

  successfullyPostedActivities = [];
  failedToPostActivities = [];

  egGlobalCache.set(cacheKeys.CURRENT_MAX_FAILURE_ACTIVITY_API, 0);
  // egGlobalCache.set(cacheKeys.CURRENT_MAX_FAILURE_CALLMINER_API, 0);

  logger.log('debug', `is halted: ${egGlobalCache.get(cacheKeys.IS_PROCESSING_HALTED)}`);

  // Continue if processing is not halted
  if (!egGlobalCache.get(cacheKeys.IS_PROCESSING_HALTED)) {
    // get last modified tide mark and So we can check last run status.
    const lastModifiedDateTidemark = await dbOperations.getTideMarkItem(
      databaseProps.POST_TIDEMARK_NAME,
    );
    // get last run status from post tidemark and add last Run Abrupt flag to egGlobalCache
    if (!lastModifiedDateTidemark.PROCESS_STATUS) {
      egGlobalCache.set(cacheKeys.IS_LAST_RUN_TERMINATED, true);
    }

    if (isBowwaveProcessing) {
      // process bowwave processing
      logger.log('info', 'Starting Bowwave data processing: ');
      // get bowwave date tidemark
      const bowwaveDateTideMark = await dbOperations.getTideMarkItem(
        databaseProps.BOWWAVE_BYDATE_TIDEMARK_NAME,
      );
      // process bowwave by date only if processing status is false.
      // This will be set to true by code once processing done
      if (!bowwaveDateTideMark.PROCESS_STATUS) {
        const lastModifiedDateFilter = `[${bowwaveDateTideMark.ACTIVITY_VALUE_FROM},${bowwaveDateTideMark.ACTIVITY_VALUE_TO}]`;
        logger.log(
          'info',
          `Starting Bowwave Date range data processing. Date filter: ${lastModifiedDateFilter}`,
        );
        // search activities for last modified date range and process
        await searchAndProcessActivities(lastModifiedDateFilter);

        // update process status
        if (!isProcessingTerminated) {
          await dbOperations.updateBowwaveProcessStatus(databaseProps.BOWWAVE_BYDATE_TIDEMARK_NAME);
        }
      }
      // get bowwave activity id tidemark

      const bowwaveActivityTideMark = await dbOperations.getTideMarkItem(
        databaseProps.BOWWAVE_BYID_TIDEMARK_NAME,
      );

      // process bowwave by id only if processing status is false.
      // This will be set to true by code once processing done
      if (!bowwaveActivityTideMark.PROCESS_STATUS && !isProcessingTerminated) {
        logger.log('info', 'Starting Bowwave data processing by Activity Ids');
        let activityList = [];
        // if we will ignore ACTIVITY_VALUE_TO if ACTIVITY_VALUE_FROM has comma separated values,
        // ACTIVITY_VALUE_TO will be considered if ACTIVITY_VALUE_FROM has single activity id.
        if (bowwaveActivityTideMark.ACTIVITY_VALUE_FROM.indexOf(',') > 0) {
          activityList = bowwaveActivityTideMark.ACTIVITY_VALUE_FROM.split(',');
        } else {
          const startActivity = parseInt(bowwaveActivityTideMark.ACTIVITY_VALUE_FROM, 10);
          const lastActivity = parseInt(bowwaveActivityTideMark.ACTIVITY_VALUE_TO, 10);
          // create a list of activities
          for (let index = startActivity; index <= lastActivity; index += 1) {
            activityList.push(index);
          }
        }
        logger.log('info', `Bowwave data processing by Activity Ids${activityList}`);
        await processActivities(activityList);
        // update bowwave by id processing status to true
        if (!isProcessingTerminated) {
          await dbOperations.updateBowwaveProcessStatus(databaseProps.BOWWAVE_BYID_TIDEMARK_NAME);
        }
      }
    } else {
      const lastModifiedDate = new Date(Date.parse(lastModifiedDateTidemark.ACTIVITY_VALUE_FROM));
      // increase last modified date by 1000 millisecond
      lastModifiedDate.setMilliseconds(lastModifiedDate.getMilliseconds() + 1000);
      const lastModifiedDateFilter = `[${lastModifiedDate.toISOString()},]`;
      await searchAndProcessActivities(lastModifiedDateFilter);
    }

    await processSentimentAnalysis();
    const processingEndTime = new Date().toISOString();

    logger.log(
      'info',
      `List of Successfully posted activities in this batch: ${successfullyPostedActivities}`,
    );
    logger.log(
      'info',
      `List of activities those were failed in this batch: ${failedToPostActivities}`,
    );

    // update DB with processed and failed activities,start time, end time etc for this run
    await dbOperations.updateProcessingDetailsForCurrentRun(
      processingStartTime,
      processingEndTime,
      isProcessingTerminated,
      successfullyPostedActivities,
      failedToPostActivities,
    );

    // TODO: send success message

    if (isProcessingTerminated) {
      // update post tidemark with abrupt
      await dbOperations.updateRunStatusToPostTideMark(false);
      if (egGlobalCache.get(cacheKeys.IS_LAST_RUN_TERMINATED)) {
        // update holt flag to true
        const parameter = {
          Name: `${awsProps.PARAMETER_PATH}/${awsProps.PARAMETERS.HALT_FLAG}`,
          Value: 'true',
          Overwrite: true,
        };

        await awsSystemManagerClient.putParameterToStore(parameter);
      }
    } else {
      // if (egGlobalCache.get(cacheKeys.NOTIFICATION_RULE).indexOf('success') > -1) {
      // send success email
      // await sendSuccessNotification();
      logger.log('info', `Data processed for ${customerTranscriptMap.size} customers, exiting`);
      customerTranscriptMap.clear();
      // }
      await dbOperations.updateRunStatusToPostTideMark(true);
    }
  }
  return isProcessingTerminated;
}

module.exports = {
  processDataIngestion,
};
