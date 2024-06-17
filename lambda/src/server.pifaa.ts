import { Handler } from 'aws-lambda'

import { getData, sendData } from './helper/orion'
import { getSecret, getSecretFromCache, setSecret } from './helper/secretsManager'

import axios from 'axios'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Tokyo");

// 人流センサーID
const peopleFlowSensorId = 'INFO.LOUNGE_00114116'

/**
 * Username / Password でPifaaにログインし、Cookie一式をSecrets Managerに格納するLambdaハンドラ (30分毎に実行)
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
 * 定期的に人流データを取得してOrionに格納するLambdaハンドラ (10分ごとに実行)
 */
export const importPeopleFlowHandler: Handler = async () => {
  console.log('定期的なジョブを実行中: ' + new Date())

  try {
    const endpoint = process.env.PIFAA_ENDPOINT ?? ''

    console.log(process.env.SECRET_PIFAA_COOKIES)

    const cookies: {[key: string]: string} = await getSecretFromCache(process.env.SECRET_PIFAA_COOKIES ?? '')
    const cookieString = Object.keys(cookies).reduce((str, key) => str + `${key}=${cookies[key]}; `, '')

    const currentTimestamp = Math.floor(Date.now() / 1e3)
    const roundTimestamp10Min = Math.floor(currentTimestamp / 600) * 600 // 10分単位切り下げ
    const timestamp_start = roundTimestamp10Min - 600 * 2 // 20分前
    const timestamp_end   = roundTimestamp10Min - 600 * 1 // 10分前

    // 20分前～10分前のデータをPifaa Cloudから取得する
    console.log(`${dayjs(timestamp_start * 1e3).tz().format()}から${dayjs(timestamp_end * 1e3).tz().format()}のデータを取り込みます`)
    const result = await axios.get(
      `${endpoint}/api/v1/sensor/data`, {
        headers: {
          Cookie: cookieString
        },
        params: {
          param: JSON.stringify({
            device_id: peopleFlowSensorId,
            sensor_type: 'peopleflow',
            timestamp_start,
            timestamp_end,
          })
        }
      }
    )
    const data: any[] = result.data.rows

    // 10分間の入退出者の合計を算出
    const totalEnters = data.reduce((total: number, datum) => total + parseInt(JSON.parse(datum.value).Enters, 10), 0)
    const totalExits  = data.reduce((total: number, datum) => total + parseInt(JSON.parse(datum.value).Exits,  10), 0)
    console.log(`Enters: ${totalEnters}, Exits: ${totalExits}`)

    // 現在の滞在人数をOrionから取得
    const currentRoomPopulation = await getData('peopleflow', peopleFlowSensorId)
      .then(data => data.currentRoomPopulation.value)
      .catch(_error => 0) // 存在しなければ0とする

    // 入退室人数を滞在人数に反映
    const updatedRoomPopulation = currentRoomPopulation + totalEnters - totalExits
    console.log(`Current: ${currentRoomPopulation}, Updated: ${updatedRoomPopulation}`)

    // Orionのエンティティを更新
    const payload = {
      dateObserved: {
        type: 'DateTime',
        value: new Date(timestamp_end * 1e3)
      },
      currentRoomPopulation:{
        type: 'Number',
        value: updatedRoomPopulation
      }
    }
    await sendData('peopleflow', peopleFlowSensorId, payload)
  } catch (error) {
    console.log(error)
  }
}

// 環境センサーID
const environmentDataSensorId = '017fbf7850b5da0adc59c80b00000000'

/**
 * 10分おきに環境データを取得し、Orionに格納するLambdaハンドラ
 * 気温・湿度・二酸化炭素濃度
 */
export const importEnvironmentDataHandler: Handler = async () => {
  console.log('定期的な環境データ取得ジョブを実行:', new Date())

  try {

    const endpoint = process.env.PIFAA_ENDPOINT ?? ''
    console.log(process.env.SECRET_PIFAA_COOKIES)

    const cookies: {[key: string]: string} = await getSecretFromCache(process.env.SECRET_PIFAA_COOKIES ?? '')
    const cookieString = Object.keys(cookies).reduce((str, key) => str + `${key}=${cookies[key]}; `, '')

    const currentTimestamp = Math.floor(Date.now() / 1e3)
    const roundTimestamp10Min = Math.floor(currentTimestamp / 600) * 600 // 10分単位切り下げ
    const timestamp_start = roundTimestamp10Min - 600 * 1 // 10分前
    const timestamp_end   = roundTimestamp10Min // 現在

    // 10分前~現在のデータをPifaa Cloudから取得する
    console.log(`${dayjs(timestamp_start * 1e3).tz().format()}から${dayjs(timestamp_end * 1e3).tz().format()}のデータを取り込みます`)
    const result = await axios.get(
      `${endpoint}/api/v1/sensor/data/current`, {
        headers: {
          Cookie: cookieString
        },
        params: {
          param: JSON.stringify({
            device_id: environmentDataSensorId,
            sensor_types: [
              'temperature',
              'humidity',
              'co2',
            ],
            timestamp_start,
          })
        }
      }
    )
    const data: any[] = result.data

    for (const record of data) {
      let payload
      let ngsiType
      if (record.path1 === '3303' && record.path3 === '28320') {
        ngsiType = 'envTemperature'
        payload = {
          dateObserved: {
            type: 'DateTime',
            value: new Date(record.unix_timestamp),
          },
          currentTemperature: {
            type: 'Number',
            value: Number(record.value),
          }
        }
      } else if (record.path1 === '3304' && record.path3 === '28320') {
        ngsiType = 'envHumidity'
        payload = {
          dateObserved: {
            type: 'DateTime',
            value: new Date(record.unix_timestamp),
          },
          currentHumidity: {
            type: 'Number',
            value: Number(record.value),
          }
        }
      } else if (record.path1 === '38008' && record.path3 === '28320') {
        ngsiType = 'envCo2'
        payload = {
          dateObserved: {
            type: 'DateTime',
            value: new Date(record.unix_timestamp),
          },
          currentCo2: {
            type: 'Number',
            value: Number(record.value),
          }
        }
      } else {
        continue
      }

      await sendData(ngsiType, `${environmentDataSensorId}_${record.path2}`, payload )
    }
  } catch (err) {
    console.log(err)
    console.error(err)
  }
}
