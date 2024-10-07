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

  // not ready to serve traffic, please wait エラーに対応してリトライ処理を追加
  const maxRetries = 3
  const retryDelay = 1000

  let attempt = 0
  while (attempt < maxRetries) {
    try {
      const response = await axios.get(requestEndpoint, requestOptions)
      if (response.data.SecretString === undefined) {
        return undefined
      }
      return JSON.parse(response.data.SecretString)
    } catch (error) {
      console.log(`Attempt ${attempt} failed: ${error}`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
      attempt++
    }
  }
  console.log('Max retries reached. Throwing error.')
  throw new Error('Failed to retrieve secret after maximum retries.')
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
