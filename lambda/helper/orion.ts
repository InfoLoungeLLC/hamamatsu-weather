import axios from 'axios'
import 'dotenv/config'

export const orionAxiosClient = () => {
  return axios.create({
    headers: {
      Authorization: global.jwt,
      'Fiware-Service': process.env.FIWARE_SERVICE!,
      'Fiware-ServicePath': process.env.FIWARE_SERVICE_PATH!,
    },
  })
}

export const checkDataExist = async (type: string, id: string) => {
  try {
    await orionAxiosClient().get(
      `${process.env.ORION_ENDPOINT}/v2/entities/${id}?type=${type}`
    )
    return true
  } catch (error) {
    return false
  }
}
