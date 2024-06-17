import * as cdk from 'aws-cdk-lib'
import { Rule, Schedule } from 'aws-cdk-lib/aws-events'
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets'
import {
  Runtime,
  ParamsAndSecretsLayerVersion,
  ParamsAndSecretsVersions
} from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'
import { Construct } from 'constructs'
import path from 'path'

export interface Context {
  stackName: string
  secretNameJwt: string
  secretPifaaUserPass: string
  secretPifaaCookies: string
  orionEndpoint: string
  fiwareService: string
  fiwareServicePath: string
  pifaaEndpoint: string
}

interface HamamatsuPifaaProps extends cdk.StackProps {
  context: Context
}

export class HamamatsuPifaaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HamamatsuPifaaProps) {
    super(scope, id, props)

    // 30分毎にログインしてCookieを取得しSecrets Managerに登録するLambda Function
    const setPifaaCookieFunction = new NodejsFunction(this, 'setPifaaCookie', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.pifaa.ts'),
      handler: 'setPifaaCookie',
      timeout: cdk.Duration.minutes(1),
      environment: {
        SECRET_PIFAA_USER_PASS: props.context.secretPifaaUserPass,
        SECRET_PIFAA_COOKIES: props.context.secretPifaaCookies,
        PIFAA_ENDPOINT: props.context.pifaaEndpoint,
      }
    })
    new Rule(this, 'ruleEvery30minutes', {
      schedule: Schedule.cron({ minute: '*/30' }),
      targets: [
        new LambdaFunction(setPifaaCookieFunction, { retryAttempts: 0 })
      ]
    })

    // 滞在人数を10分毎に更新するLambda Function
    const paramsAndSecrets = ParamsAndSecretsLayerVersion.fromVersion(ParamsAndSecretsVersions.V1_0_103)
    const importPeopleFlowFunction = new NodejsFunction(this, 'importPeopleFlowFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.pifaa.ts'),
      handler: 'importPeopleFlowHandler',
      timeout: cdk.Duration.minutes(5),
      environment: {
        SECRET_PIFAA_COOKIES: props.context.secretPifaaCookies,
        SECRET_NAME_JWT: props.context.secretNameJwt,
        ORION_ENDPOINT: props.context.orionEndpoint,
        FIWARE_SERVICE: props.context.fiwareService,
        FIWARE_SERVICE_PATH: props.context.fiwareServicePath,
        PIFAA_ENDPOINT: props.context.pifaaEndpoint,
      },
      paramsAndSecrets, // Use AWS Parameters and Secrets Lambda Extension
    })

    // 気温・湿度・二酸化炭素濃度を10分毎に更新するLambda Function
    const importEnvironmentDataFunction = new NodejsFunction(this, 'importEnvironmentDataFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.pifaa.ts'),
      handler: 'importEnvironmentDataHandler',
      timeout: cdk.Duration.minutes(5),
      environment: {
        SECRET_PIFAA_COOKIES: props.context.secretPifaaCookies,
        SECRET_NAME_JWT: props.context.secretNameJwt,
        ORION_ENDPOINT: props.context.orionEndpoint,
        FIWARE_SERVICE: props.context.fiwareService,
        FIWARE_SERVICE_PATH: props.context.fiwareServicePath,
        PIFAA_ENDPOINT: props.context.pifaaEndpoint,
      },
      paramsAndSecrets,
    })
    new Rule(this, 'ruleEvery10Minute', {
      schedule: Schedule.cron({ minute: '*/10' }),
      targets: [
        new LambdaFunction(importPeopleFlowFunction, { retryAttempts: 0 }),
        new LambdaFunction(importEnvironmentDataFunction, { retryAttempts: 0 }),
      ]
    })

    // UserPassのシークレットはsetPifaaCookieFunctionからの読み込みのみ
    const secretPifaaUserPass = Secret.fromSecretNameV2(this, 'secretPifaaUserPass', props.context.secretPifaaUserPass)
    secretPifaaUserPass.grantRead(setPifaaCookieFunction)

    // PifaaのCookiesシークレットにはsetPifaaCookieFunctionから書き込み、importPeopleFlowFunctionからの読み込み可能
    const secretPifaaCookies = Secret.fromSecretNameV2(this, 'secretPifaaCookies', props.context.secretPifaaCookies)
    secretPifaaCookies.grantWrite(setPifaaCookieFunction)
    secretPifaaCookies.grantRead(importPeopleFlowFunction)
    secretPifaaCookies.grantRead(importEnvironmentDataFunction)

    // JWTのシークレットはimportPeopleFlowFunctionからの読み取り許可
    const secretJwt = Secret.fromSecretNameV2(this, 'secretJwt', props.context.secretNameJwt)
    secretJwt.grantRead(importPeopleFlowFunction)
    secretJwt.grantRead(importEnvironmentDataFunction)
  }
}
