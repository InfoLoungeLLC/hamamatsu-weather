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
  secretNameUserPass: string
  secretNameJwt: string
  userPoolId: string
  appClientId: string
  orionEndpoint: string
  fiwareService: string
  fiwareServicePath: string
}

interface HamamatsuWeatherProps extends cdk.StackProps {
  context: Context
}

export class HamamatsuWeatherStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HamamatsuWeatherProps) {
    super(scope, id, props)

    // 6時間毎にトークンを更新してSecrets Managerに登録するLambda Function
    const setJwtFunction = new NodejsFunction(this, 'setJwtFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.weather.ts'),
      handler: 'setJwtHandler',
      timeout: cdk.Duration.minutes(1),
      environment: {
        SECRET_NAME_USER_PASS: props.context.secretNameUserPass,
        SECRET_NAME_JWT: props.context.secretNameJwt,
        USER_POOL_ID: props.context.userPoolId,
        APP_CLIENT_ID: props.context.appClientId,
      }
    })
    new Rule(this, 'ruleEvery6hours', {
      schedule: Schedule.cron({ minute: '0', hour: '*/6' }),
      targets: [
        new LambdaFunction(setJwtFunction, { retryAttempts: 0 })
      ]
    })

    // データを毎分チェックするLambda Function
    const paramsAndSecrets = ParamsAndSecretsLayerVersion.fromVersion(ParamsAndSecretsVersions.V1_0_103)
    const importWeatherFunction = new NodejsFunction(this, 'importWeatherFunction', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/src/server.weather.ts'),
      handler: 'importWeatherHandler',
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
        new LambdaFunction(importWeatherFunction, { retryAttempts: 0 })
      ]
    })

    // UserPassのシークレットはsetJwtFunctionからの読み込みのみ
    const secretUserPass = Secret.fromSecretNameV2(this, 'secretUserPass', props.context.secretNameUserPass)
    secretUserPass.grantRead(setJwtFunction)

    // JWTのシークレットはsetJwtFuncitonからの書き込みとimportWeatherFunctionからの読み込み
    const secretJwt = Secret.fromSecretNameV2(this, 'secretJwt', props.context.secretNameJwt)
    secretJwt.grantWrite(setJwtFunction)
    secretJwt.grantRead(importWeatherFunction)
  }
}
