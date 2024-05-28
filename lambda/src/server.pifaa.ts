import { Handler } from 'aws-lambda'

import { sendData } from './helper/orion'
import { getSecret, setSecret } from './helper/secretsManager'
import { genRainData, getStreamGaugeData } from './app'

import axios, { AxiosInstance } from 'axios'

/**
 * Username / Password でPifaaにログインし、Cookie一式をSecrets Managerに格納するLambdaハンドラ
 */
export const setPifaaCookie: Handler = async () => {
  console.log('新しいCookieを取得中: ' + new Date())

  try {
    const endpoint = process.env.PIFAA_ENDPOINT ?? ''
    const secret = await getSecret(process.env.SECRET_PIFAA_USER_PASS ?? '')
    const result = await axios.post(
      `${endpoint}/api/v1/user/login`, secret, { maxRedirects: 0 }
    )
    const setCookieStrings = result.headers['set-cookie']
    const cookies: { [key: string]: string } = {}
    setCookieStrings?.forEach(setCookieString => {
      const splited = setCookieString.split(/(?<=^[^=]+?)=/) // 最初の"="でのみ分割 (肯定後読み)
      const key = splited[0]
      const value = splited[1].split(';')[0].replace(/^"(.*)"$/, '$1')
      cookies[key] = value
    })
    await setSecret(process.env.SECRET_PIFAA_COOKIES ?? '', cookies)
  } catch (error) {
    console.log(error)
  }
}

/**
 * [WIP] 定期的に人流データを取得してOrionに格納するLambdaハンドラ
 */
export const importPeopleFlowHandler: Handler = async () => {
  console.log('定期的なジョブを実行中: ' + new Date())
}
