import { Handler } from 'aws-lambda'

import { genRainData, getStreamGaugeData, sendData } from './app'
import { getJwt } from './helper/cognito'
import { getSecret, setSecret } from './helper/secretsManager'

/**
 * Username / Password からJWTを生成して格納するハンドラ
 */
export const setJwtHandler: Handler = async () => {
  console.log('新しいJWTを生成中: ' + new Date())

  const secret = await getSecret(process.env.SECRET_NAME_USER_PASS ?? '')
  const jwt = await getJwt(
    process.env.USER_POOL_ID ?? '',
    process.env.APP_CLIENT_ID ?? '',
    secret.username,
    secret.password
  )
  await setSecret(process.env.SECRET_NAME_JWT ?? '', { jwt })
}

/**
 * 定期的にデータを取得してOrionに格納するハンドラ
 */
export const importWeatherHandler: Handler = async () => {
   console.log('定期的なジョブを実行中: ' + new Date())

  try {
    const rainData = await genRainData()

    const rainDataPromise = rainData.map(async (data) => {
      const id = data.id
      const _data: any = data
      delete _data.id
      await sendData('rain_hamamatsu', id, _data)
    })
    await Promise.all(rainDataPromise)
  } catch (error) {
    console.log(error)
  }

  // sleep 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000))

  try {
    const streamGaugeData = await getStreamGaugeData()
    const validData = streamGaugeData.filter(
      (data) => data.waterLevel.value !== null
    )

    const streamGaugeDataPromise = validData.map(async (data) => {
      const id = data.id
      const _data: any = data
      delete _data.id
      await sendData('stream_gauge_hamamatsu', id, _data)
    })
    await Promise.all(streamGaugeDataPromise)
  } catch (error) {
    console.log(error)
  }
}
