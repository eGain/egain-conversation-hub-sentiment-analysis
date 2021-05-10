const { Logger } = require('ps-chronicle');

const { commonConstants } = require(process.env.AWS_REGION
  ? '/opt/nodejs/constants/constants'
  : '../../../layers/common/nodejs/constants/constants.js');

const s3Client = require(process.env.AWS_REGION
  ? '/opt/nodejs/aws-clients/s3-client/s3-client'
  : '../../../layers/common/nodejs/aws-clients/s3-client/s3-client');
const loggerContext = {
  fileName: 'htmlHelper.js',
  customerName: commonConstants.CUSTOMER_NAME,
  format: commonConstants.LOG_FORMAT_JSON,
};

const logger = new Logger(loggerContext, process.env.LogLevel);

const createHTML = async (customerName, sentimentObj) => {
  logger.log('debug', 'in createHTML method');

  let content = `
  <html>
  <body style="font-family: Arial, Helvetica, sans-serif">
    <h3 style="text-align: center">Customer name: $customer_name$</h3>
    <canvas id="sentiment-chart" width="800" height="500"  style="margin-left: 15%"></canvas>
    <h5 style="text-align: left">
      * Based on customer interactions in last 7 days
    </h5>
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.2.1/dist/chart.min.js"></script>
    <script>
      new Chart(document.getElementById('sentiment-chart'), {
        type: 'pie',
        data: {
          labels: ['Positive', 'Negative', 'Neutral', 'Mixed'],
          datasets: [
            {
              label: 'Sentiment Score (percentage)',
              backgroundColor: ['#2596be', '#EA493A', '#d9d9d9', '#CDEB19'],
              data: [$positive_score$, $negative_score$, $neutral_score$, $mixed_score$],
            },
          ],
        },
        options: {
          //legend: { display: false },
          title: {
            display: true,
            text: 'Customer Sentiment Score(percentage) based on chat',
          },
          responsive: false,
        },
      });
    </script>
  </body>
</html>
`;
  content = content.replace('$customer_name$', customerName);

  content = content.replace('$positive_score$', sentimentObj.positive);
  content = content.replace('$negative_score$', sentimentObj.negative);
  content = content.replace('$neutral_score$', sentimentObj.neutral);
  content = content.replace('$mixed_score$', sentimentObj.mixed);

  logger.log('debug', `html content ${content}`);

  const currentDate = new Date().toISOString().replace('T', ' ').substr(0, 19);
  const uploadKey = `chat/sentiment-analysis/output/${customerName}_sentiment_score_${currentDate}.html`;
  const s3PutParams = {
    Bucket: process.env.CodeBucketName,
    Key: uploadKey,
    Body: content,
  };
  await s3Client.putInS3(s3PutParams);
};

module.exports = { createHTML };
