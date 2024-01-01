import axios from 'axios'
import { getSecretFromCache } from './secretsManager'

export const orionAxiosClient = async () => {
  const secret = await getSecretFromCache(process.env.SECRET_NAME_JWT ?? '')
  return axios.create({
    headers: {
      Authorization: secret.jwt,
      'Fiware-Service': process.env.FIWARE_SERVICE ?? '',
      'Fiware-ServicePath': process.env.FIWARE_SERVICE_PATH ?? '',
    },
  })
}

export const checkDataExist = async (type: string, id: string): Promise<boolean> => {
  let result = true
  const client = await orionAxiosClient()
  await client.get(
    `${process.env.ORION_ENDPOINT}/v2/entities/${id}?type=${type}`
  ).catch(err => {
    result = false
  })
  return result
}
