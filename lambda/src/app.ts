import axios from 'axios'
import dayjs from 'dayjs'
import papa from 'papaparse'

import { RAINFALL_OBSERVATORY } from './constants/rainfall_observatory'
import { STREAMGAUGE_OBSERVATORY } from './constants/streamgauge_observatory'

export const genRainData = async () => {
  const { data } = await axios.get(
    `https://www.hamamatsu-dobokuportal.net/rainfall/${dayjs()
      .locale('ja')
      .get('year')}/daily_rain_${dayjs().locale('ja').format('YYYYMMDD')}.csv`
  )

  // remove first 3 lines from data
  const lines = data.split('\n')
  lines.shift()
  lines.shift()
  lines.shift()
  const _data = lines.join('\n')

  // parse csv data and remove header
  const result = papa.parse<string>(_data)
  result.data.shift()

  const currentDateTime = dayjs().toDate()
  const currentTime = dayjs().format(' HH:mm').slice(0, -1) + '0'

  const currentData: string[] = result.data.find(
    (d) => d[0] === currentTime
  ) as any

  const ngsiData = RAINFALL_OBSERVATORY.map((observatory) => {
    const precipitation10m = currentData[observatory.csvColumnIndex]
    const precipitation60m = currentData[observatory.csvColumnIndex + 1]
    return {
      id: observatory.id,
      ...observatory.ngsi,
      dateObserved: {
        type: 'DateTime',
        value: currentDateTime,
      },
      precipitation_10m: {
        type: 'Number',
        value: Number(precipitation10m),
      },
      precipitation_60m: {
        type: 'Number',
        value: Number(precipitation60m),
      },
    }
  })
  return ngsiData
}

export const getStreamGaugeData = async () => {
  const { data } = await axios.get(
    `https://www.hamamatsu-dobokuportal.net/water_level/${dayjs()
      .locale('ja')
      .get('year')}/daily_water_${dayjs()
      .locale('ja')
      .format('YYYYMMDD')}.csv`
  )

  // remove first 3 lines from data
  const lines = data.split('\n')
  lines.shift()
  lines.shift()
  lines.shift()
  const _data = lines.join('\n')

  // parse csv data and remove header
  const result = papa.parse<string>(_data)
  result.data.shift()

  const currentDateTime = dayjs().toDate()
  const currentTime = dayjs().format(' HH:mm').slice(0, -1) + '0'

  const currentData: string[] = result.data.find(
    (d) => d[0] === currentTime
  ) as any

  const ngsiData = STREAMGAUGE_OBSERVATORY.map((observatory) => {
    const waterLevel = currentData[observatory.csvColumnIndex]
    return {
      id: observatory.id,
      ...observatory.ngsi,
      dateObserved: {
        type: 'DateTime',
        value: currentDateTime,
      },
      waterLevel: {
        type: 'Number',
        value: waterLevel && waterLevel !== '---' ? Number(waterLevel) : null,
      },
    }
  })
  return ngsiData
}
