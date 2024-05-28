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
        PIFAA_ENDPOINT: props.context.pifaaEndpoint
      }
    })
    new Rule(this, 'ruleEvery30minutes', {
      schedule: Schedule.cron({ minute: '*/30' }),
      targets: [
        new LambdaFunction(setPifaaCookieFunction, { retryAttempts: 0 })
      ]
    })

    // データを毎分チェックするLambda Function
    const paramsAndSecrets = ParamsAndSecretsLayerVersion.fromVersion(ParamsAndSecretsVersions.V1_0_103)
    const importPeopleFlowFunction = new NodejsFunction(this, 'importPeopleFlowFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.pifaa.ts'),
      handler: 'importPeopleFlowHandler',
      timeout: cdk.Duration.minutes(5),
      environment: {
        SECRET_NAME_JWT: props.context.secretNameJwt,
        ORION_ENDPOINT: props.context.orionEndpoint,
        FIWARE_SERVICE: props.context.fiwareService,
        FIWARE_SERVICE_PATH: props.context.fiwareServicePath,
      },
      paramsAndSecrets, // Use AWS Parameters and Secrets Lambda Extension
    })
    new Rule(this, 'ruleEveryMinute', {
      schedule: Schedule.cron({ minute: '*' }),
      targets: [
        new LambdaFunction(importPeopleFlowFunction, { retryAttempts: 0 })
      ]
    })

    // UserPassのシークレットはsetPifaaCookieFunctionからの読み込みのみ
    const secretPifaaUserPass = Secret.fromSecretNameV2(this, 'secretPifaaUserPass', props.context.secretPifaaUserPass)
    secretPifaaUserPass.grantRead(setPifaaCookieFunction)

    // PifaaのCookiesシークレットにはsetPifaaCookieFunctionから書き込み可能
    const secretPifaaCookies = Secret.fromSecretNameV2(this, 'secretPifaaCookies', props.context.secretPifaaCookies)
    secretPifaaCookies.grantWrite(setPifaaCookieFunction)

    // JWTのシークレットはimportPeopleFlowFunctionからの読み取り許可
    const secretJwt = Secret.fromSecretNameV2(this, 'secretJwt', props.context.secretNameJwt)
    secretJwt.grantRead(importPeopleFlowFunction)
  }
}
