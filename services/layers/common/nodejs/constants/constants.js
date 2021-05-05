const awsProps = {
  // TODO : take from user input
  PARAMETER_PATH: process.env.Environment
    ? `/egps/connected-apps/${process.env.Environment}/chat-sentiment-analysis`
    : '/egps/connected-apps/dev/chat-sentiment-analysis',
  // TODO : take from user input
  SECRET_NAME: process.env.Environment
    ? `egps-${process.env.Environment}-chat-sentiment-analysis-secrets`
    : 'egps-dev-chat-sentiment-analysis-secrets',

  USER_CREDENTIAL_SECRET_KEY: 'egain-api-user-credential',
  EGAIN_PROXY_CREDENTIAL_SECRET_KEY: 'egain-api-proxy-credential',
  EGAIN_SMTP_CREDENTIAL_SECRET_KEY: 'egain-smtp-credential',

  PARAMETERS: {
    API_TIMEOUT: 'api-timeout-seconds',
    API_TIMEOUT_RETRY_ATTEMPTS: 'api-timeout-retry-attempts',
    MAX_CONTINUOUS_FAILURE_TO_ALLOWED: 'max-allowed-failure',
    NOTIFICATION_RULE: 'notification-rule',
    NOTIFICATION_FROM_EMAIL: 'notification-from-email',
    NOTIFICATION_EGAIN_EMAIL: 'notification-egain-to-email',
    NOTIFICATION_CUSTOMER_EMAIL: 'notification-customer-to-email',
    NOTIFICATION_EGAIN_BCC_EMAIL: 'notification-egain-bcc-email',
    NOTIFICATION_SMTP_SERVER: 'notification-smtp-server',
    NOTIFICATION_SMTP_PORT: 'notification-smtp-port',
    NOTIFICATION_BATCH_DATA_RETENTION_DAYS: 'batch-processing-data-retention-days',
    HALT_FLAG: 'halt-data-process-flag',
    EGAIN_API_HOST: 'egain-api-host',
    EGAIN_API_PROXY_HOST: 'egain-api-proxy-ip',
    EGAIN_API_PROXY_PORT: 'egain-api-proxy-port',
    EGAIN_API_PAGE_SIZE: 'egain-api-page-size',
    NOTIFICATION_FAILURE_EMAIL_TEMPLATE_KEY: 'notification-failure-email-key',
    NOTIFICATION_SUCCESS_EMAIL_TEMPLATE_KEY: 'notification-success-email-key',
    NOTIFICATION_SMTP_PROXY_HOST: 'egain-smtp-proxy-ip',
    NOTIFICATION_SMTP_PROXY_PORT: 'egain-smtp-proxy-port',
  },
};

const eGainAPIs = {
  LOGIN_API_URL: '/ws/v12/authentication/user/login',
  ACTIVITY_API_URL: '/ws/v12/interaction/activity',
  USER_API_URL: '/ws/v12/administration/user',
  SEARCH_API_PAGE_SIZE: 20,
};

const databaseProps = {
  POST_TIDEMARK_NAME: 'chat-sentiment-analysis-post',
  BOWWAVE_BYDATE_TIDEMARK_NAME: 'chat-sentiment-analysis-bowwave-bydate',
  BOWWAVE_BYID_TIDEMARK_NAME: 'chat-sentiment-analysis-bowwave-byid',
  TIDEMARK_TABLE_NAME: process.env.Environment
    ? `egps-${process.env.Environment}-chat-sentiment-analysis-tidemark`
    : 'egps-dev-chat-sentiment-analysis-tidemark',
  BATCH_DATA_TABLE_NAME: process.env.Environment
    ? `egps-${process.env.Environment}-chat-sentiment-analysis-batch`
    : 'egps-dev-chat-sentiment-analysis-batch',
};

const http = {
  METHODS: {
    POST: 'POST',
    GET: 'GET',
  },
  HEADERS: {
    ACCEPT: {
      APPLICATION_JSON: 'application/json',
    },
    CONTENT_TYPE: {
      APPLICATION_JSON: 'application/json;charset=utf-8',
    },
    LANGUAGE: {
      EN_US: 'en-US',
    },
  },
  RESPONSE_CODES: {
    OK: 200,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUEST: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    GATEWAY_TIMEOUT: 504,
  },
};

const commonConstants = {
  // all constants go here
  LOG_FORMAT_JSON: 'json',
  CUSTOMER_NAME: process.env.Customer ? process.env.Customer : 'Connected Apps',
  // NOTIFICATION_EMAIL_SUBJECT_ERROR: 'Error Encountered in Data Ingesting',
  // NOTIFICATION_EMAIL_SUBJECT_SUCCESS: 'Successfully Ingested Data for this run',
  // NOTIFICATION_EMAIL_SUCCESS_TEXT_LINE_1: 'The job has been completed successfully. Details below',
  // NOTIFICATION_EMAIL_SUCCESS_TEXT_LINE_1_BOWWAVE:
  //   'The bowwave job has been completed successfully. Details below',
  // NOTIFICATION_EMAIL_SUCCESS_TEXT_SUCCESS_ACTIVITIES: 'Activities ingested successfully',
  // NOTIFICATION_EMAIL_SUCCESS_TEXT_FAILED_ACTIVITIES: 'Activities failed to ingest',
  COLON: ':',
  SPACE: ' ',
  NEWLINE: '\n',
  TOTAL_ACTIVITIES_PROCESSED: 'Total Activities Processed',
  // NOTIFICATION_EMAIL_ERROR_TEXT_LINE_1:
  //   'Data ingestion process encountered error. Please see cloudwatch logs for more details.',
  // NOTIFICATION_EMAIL_TEXT_ERROR: 'Error',
  // NOTIFICATION_EMAIL_TEXT_ERROR_CODE: 'Error Code',
  // NOTIFICATION_EMAIL_TEXT_ERROR_DATE: 'Error Date',
  // NOTIFICATION_EMAIL_TEXT_IMPACT: 'Impact',
  CUSTOMER_TEXT: 'Customer',
  APP_NAME_TEXT: 'App Name',
  NOTIFICATION_DATE: 'Date',
  // DEFAULT_ERROR_IMPACT_TEXT: 'Solution is unable to Process the Data on Current Cycle.',
  // HALT_ERROR_IMPACT_TEXT:
  //   'Solution is unable to Process the Data on Current Cycle and Halt Flag is enable. Manual intervention require to Troubleshoot the error and enable the processing.',
  ABANDONED_CHAT: 'abandoned_chat',
  SYSTEM_USER_NAME: 'System',
  SYSTEM_USER_ID: 12,
  REGION: 'AWS Region',
  ACCOUNT_ID: 'AWS Account Id',
  NONE: 'None',
  SOCKS5: 'socks5',
  DOUBLE_FORWARD_SLASH: '//',
  MASKING_OPTIONS: {
    maskWith: '*',
    // It should be an array
    // Field names to mask. Can give multiple fields.
    fields: ['password', 'pass', 'Authorization'],
  },
};

const cacheKeys = {
  AXIOS_API_REQUEST_TIMEOUT: 'AXIOS_API_REQUEST_TIMEOUT',
  NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT: 'NO_OF_RETRY_ATTEMPTS_ON_TIMEOUT',
  MAX_FAILURE_COUNT_FOR_HALT: 'MAX_FAILURE_COUNT_FOR_HALT',
  NOTIFICATION_FROM_EMAIL: 'NOTIFICATION_FROM_EMAIL',
  NOTIFICATION_EGAIN_EMAIL: 'NOTIFICATION_EGAIN_EMAIL',
  NOTIFICATION_CUSTOMER_EMAIL: 'NOTIFICATION_CUSTOMER_EMAIL',
  NOTIFICATION_EGAIN_BCC_EMAIL: 'NOTIFICATION_EGAIN_BCC_EMAIL',
  NOTIFICATION_SMTP_SERVER: 'NOTIFICATION_SMTP_SERVER',
  NOTIFICATION_SMTP_PORT: 'NOTIFICATION_SMTP_PORT',
  BATCH_DATA_RETENTION_DAYS: 'BATCH_DATA_RETENTION_DAYS',
  IS_PROCESSING_HALTED: 'IS_PROCESSING_HALTED',
  EGAIN_HOST_URL: 'EGAIN_HOST_URL',
  CALL_MINER_INGESTION_API_URL: 'CALL_MINER_INGESTION_API_URL',
  PROXY_HOST: 'PROXY_HOST',
  PROXY_PORT: 'PROXY_PORT',
  PROXY: 'PROXY',
  EGAIN_USER_CREDENTIALS: 'EGAIN_USER_CREDENTIALS',
  CALL_MINER_INGESTION_API_TOKEN: 'CALL_MINER_INGESTION_API_TOKEN',
  IS_BOWWAVE_PROCESSING: 'IS_BOWWAVE_PROCESSING',
  MAX_CONTINUOUS_FAILURE_TO_STOP: 'MAX_CONTINUOUS_FAILURE_TO_STOP',
  NOTIFICATION_RULE: 'NOTIFICATION_RULE',
  IS_LAST_RUN_TERMINATED: 'IS_LAST_RUN_TERMINATED',
  NOTIFICATION_SMTP_AUTH: 'NOTIFICATION_SMTP_AUTH',
  STACK_NAME: 'STACK_NAME',
  EGAIN_API_PAGE_SIZE: 'EGAIN_API_PAGE_SIZE',
  ACCOUNT_ID: 'ACCOUNT_ID',
  CURRENT_MAX_FAILURE_ACTIVITY_API: 'CURRENT_MAX_FAILURE_ACTIVITY_API',
  CURRENT_MAX_FAILURE_CALLMINER_API: 'CURRENT_MAX_FAILURE_CALLMINER_API',
  EGAIN_PROXY_USER_CREDENTIALS: 'EGAIN_PROXY_USER_CREDENTIALS',
  NOTIFICATION_FAILURE_EMAIL_TEMPLATE_KEY: 'NOTIFICATION_FAILURE_EMAIL_TEMPLATE_KEY',
  NOTIFICATION_SUCCESS_EMAIL_TEMPLATE_KEY: 'NOTIFICATION_SUCCESS_EMAIL_TEMPLATE_KEY',
  PROCESSING_START_TIME: 'PROCESSING_START_TIME',
  SMTP_SOCK_PROXY: 'SMTP_SOCK_PROXY',
};

const transcriptProps = {
  TRANSFER_TEXT: 'YOU HAVE BEEN TRANSFERRED',
  CONFERENCE_TEXT: 'HAS JOINED THE CHAT',
  TIME_FORMAT_REGEX: /(\d\d?:\d\d(:\d\d)?)(\s[ap]m)/i,
  NOW_CHATTING_WITH_AGENT_REGEX: /You are now chatting with (.*)/i,
};

module.exports = {
  awsProps,
  eGainAPIs,
  databaseProps,
  http,
  commonConstants,
  cacheKeys,
  transcriptProps,
};
