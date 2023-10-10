import 'dotenv/config'
import cron from 'node-cron'
import { genRainData, getStreamGaugeData, sendData } from './app'
import { setJwt } from './auth'

console.log('起動')

const cronExpression = process.env.CRON_EXPRESSION || '*/10 * * * *'
global.jwt = ''

setJwt()

// 6時間ごとにJWTを更新
cron.schedule('* */6 * * *', async () => {
  await setJwt()
})

cron.schedule(cronExpression, async () => {
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
})
