import axios from 'axios'
import { SecretsManager } from 'aws-sdk'

const secretsManager = new SecretsManager()

/**
 * キャッシュを利用したシークレットの取得 (高速/低コスト/キャッシュ遅延あり)
 * @param secretId シークレットの名前
 */
export const getSecretFromCache = async (secretId: string): Promise<any> => {
  // Reference: https://docs.aws.amazon.com/ja_jp/secretsmanager/latest/userguide/retrieving-secrets_lambda.html
  const requestEndpoint = 'http://localhost:2773/secretsmanager/get'
  const requestOptions = {
    params: {
      secretId,
    },
    headers: {
      'X-Aws-Parameters-Secrets-Token': process.env.AWS_SESSION_TOKEN,
    }
  }
  const response = await axios.get(requestEndpoint, requestOptions)
  if (response.data.SecretString === undefined) {
    return undefined
  }
  return JSON.parse(response.data.SecretString)
}

/**
 * Secrets Managerからのダイレクトな取得 (低速/高コスト/キャッシュ遅延なし)
 * @param secretId シークレットの名前
 */
export const getSecret = async (secretId: string): Promise<any> => {
  const response = await secretsManager.getSecretValue({
    SecretId: secretId,
  }).promise()

  if (response.SecretString === undefined) {
    return undefined
  }
  return JSON.parse(response.SecretString)
}

/**
 * Secrets Managerの更新 (新規作成は行わない)
 * @param secretId シークレットの名前
 * @param secret シークレットのオブジェクト
 */
export const setSecret = async (secretId: string, secret: any) => {
  await secretsManager.putSecretValue({
    SecretId: secretId,
    SecretString: JSON.stringify(secret)
  }).promise()
}
