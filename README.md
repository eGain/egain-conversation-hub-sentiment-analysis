# egps-chat-sentiment-analysis
App to fetch chat with customers from eGain and determine customer's sentiment score for chat using AWS Comprehend service.

**Integrate eGain messaging hub with AWS Comprehend**

Traditionally most organizations were leveraging survey as a primary tool to measure the customer satisfaction. With the improvement in AI technologies in last few years, getting insights on how your customers are talking to you will paint a better picture. Conversations transcripts are one of the source for measuring the customer satisfaction. This repository contains an example application to determine the sentiments of a conversation in eGain messaging hub. Using sentiment analysis, this information can help paint a more accurate picture of the health of customer relationships with your service agents. This example enables developers to pull the eGain conversation data and sent to AWS comprehend. Developers can use other conversational analytics tool such as Callminer, Clarabridge , Microsoft text analytics as well. You can also use this pattern for getting more insights such as product information from the conversation. 

<<screenshot of the outcome>>

**Pre-requsiites**
1. Git installed on your computer
2. eGain Cloud advisor credentials availability 
3. AWS cloud credentials where AWS Comprehend, Lambda and all mentioned below services from "Additional Information" are enabled
4. AWS account has access to eGain URL
5. Required s3 bucket folder and IAM roles are created referring json provided with the sample app in "" directory
6. Role with permissions defined is "sentimentAnalyserrole.json" created before the deployment and used while deploying the application
7. Simple email service is configured for AWS account
8. AWS CLI, please refer https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html to install and configure AWS CLI
9. SAM CLI, please refer https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install-windows.html to install and configure SAM CLI
10. You need to run the 'aws configure' to configure the aws profile for deployment

**Architecture Diagram**




**Flow** 
1. Cloudwatch event rule is configured to execute the lambda every x hours
2. eGain chat transcripts of closed chats are fetched at regular interval using eGain messaging hub provided interaction APIs. 
3.1 Tidemark maintained to define start and end date of batch
3.2. Chat transcripts are processed to separate agent and customer messages
4. Chat transcripts are forwarded to AWS comprehend sentiment analyzer
5. Sentiment details of the chat transcript are returned from the AWS Comprehend service
6. Tidemark and batch status is updated
7. Transcripts along with sentiments are fed to HTML and written to S3 bucket.

**Getting Started**
Configure eGain  - TBD
Create eGain User with Chat Advisor role and platform license
client app etc TBD for R21   Screenshots 

**Installation**
Clone the repository
Modify files if needed etc. 
Login to AWS Cloud
Upload the stack [ With Screenshots]
Modify the parameter store etc [ With Screenshots]

**Additional Information**
This Integration leverage the below services from AWS
1. AWS Lambda - Processed chat transcripts and comprehend call for sentiment analysis
2. Amazon Cloud Watch  - Triggers lambda at regular interval
3. Amazon Secrets Manager - Stores required sensitive information 
4. Amazon Dynamo DB  - Stores tidemarks for batch processing of data
5. Parameter Store - Stores required parameters
6. SES (simple email service) - Sends analyzed data to registered email address ( optional)
7. AWS Comprehend - Sentiment analysis service which returns sentiment of the input text. 
