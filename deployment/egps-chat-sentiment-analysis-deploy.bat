echo off
FOR /F "tokens=1,2 delims==" %%G IN (egps-chat-sentiment-analysis-config.properties) DO (set %%G=%%H)

echo Setting local properties for deployment...

SET STACK_NAME=egps-%DEPLOYMENT_ENVIRONMENT%-chat-sentiment-analysis
SET TIDEMARK_TABLE=egps-%DEPLOYMENT_ENVIRONMENT%-chat-sentiment-analysis-tidemark
SET ISODATE=%DATA_START_POINT%
SET S3_FOLDER=chat/sentiment-analysis/%DEPLOYMENT_ENVIRONMENT%/code/service
SET S3_CODE_SERVICE_FOLDER=chat/sentiment-analysis/%DEPLOYMENT_ENVIRONMENT%/code/service
echo Local properties for deployment set successfully...

echo -------------- Installing dependencies --------------
cd ../services/layers/dependencies/nodejs
npm install &^
cd ../../../../deployment &^

echo --------------  &^
echo -------------- Dependencies installed, deploying AWS application -------------- &^
sam deploy --debug --capabilities CAPABILITY_IAM^
    --template-file egps-chat-sentiment-analysis-template.yaml^
    --s3-bucket %CODE_DEPLOY_BUCKET%^
	--s3-prefix %S3_FOLDER%^
    --region %AWS_REGION%^
    --stack-name %STACK_NAME%^
    --parameter-overrides^
    DeploymentEnvironment=%DEPLOYMENT_ENVIRONMENT%^
    LambdaMasterRole=%LAMBDA_MASTER_ROLE%^
	CodeBucketName=%CODE_DEPLOY_BUCKET%^
	eGainApiHost=%EGAIN_API_HOST%^
	eGainApiUserName=%EGAIN_API_USERNAME%^
	eGainApiPassword=%EGAIN_API_PASSWORD%^
	eGainApiProxyIp=%EGAIN_API_PROXY_IP%^
	eGainApiProxyPort=%EGAIN_API_PROXY_PORT%^
	VpcId=%VPC_ID%^
	SubnetIds=%SUBNET_IDS%^
	SecurityGroupId=%SECURITY_GROUP_ID%^
	DisableProxy=%DISABLE_PROXY%^
    LoggerLevel=%LOGGER_LEVEL% &^

rem echo ######################################################################### &^
echo Stack Deployment complete, please check command prompt logs for result! &^
echo Inserting data on the table...&^
aws dynamodb put-item --table-name "%TIDEMARK_TABLE%" --item "{""TIDEMARK_NAME"":{""S"":""chat-sentiment-analysis-bowwave-bydate""},""ACTIVITY_VALUE_FROM"":{""S"":""""},""ACTIVITY_VALUE_TO"":{""S"":""""},""MODIFIEDDATE_UTC"":{""S"":""%ISODATE%""},""PROCESS_STATUS"":{""BOOL"":"true"}}" --return-consumed-capacity TOTAL &^
aws dynamodb put-item --table-name "%TIDEMARK_TABLE%" --item "{""TIDEMARK_NAME"":{""S"":""chat-sentiment-analysis-post""},""ACTIVITY_VALUE_FROM"":{""S"":""%ISODATE%""},""ACTIVITY_VALUE_TO"":{""S"":""""},""MODIFIEDDATE_UTC"":{""S"":""%ISODATE%""},""PROCESS_STATUS"":{""BOOL"":"true"}}" --return-consumed-capacity TOTAL &^
aws dynamodb put-item --table-name "%TIDEMARK_TABLE%" --item "{""TIDEMARK_NAME"":{""S"":""chat-sentiment-analysis-bowwave-byid""},""ACTIVITY_VALUE_FROM"":{""S"":""""},""ACTIVITY_VALUE_TO"":{""S"":""""},""MODIFIEDDATE_UTC"":{""S"":""%ISODATE%""},""PROCESS_STATUS"":{""BOOL"":"true"}}" --return-consumed-capacity TOTAL &^
echo Inserting data complete. &^

cmd /k