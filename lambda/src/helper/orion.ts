import axios, { AxiosInstance } from 'axios'

import { getSecretFromCache } from './secretsManager'

/**
 * axiosヘッダーに認証情報とテナント情報を付与
 * @param fiwareService Fiware-Service
 * @param fiwareServicePath Fiware-ServicePath
 */
const orionAxiosClient = async (
  fiwareService: string,
  fiwareServicePath: string
): Promise<AxiosInstance> => {
  const secret = await getSecretFromCache(process.env.SECRET_NAME_JWT ?? '')
  return axios.create({
    headers: {
      Authorization: secret.jwt,
      'Fiware-Service': fiwareService,
      'Fiware-ServicePath': fiwareServicePath,
    },
  })
}

/**
 * Orionにデータを登録する (新規はPOST/既存はPUT)
 * @param type NGSIのType
 * @param id NGSIのID
 * @param data NGSIのペイロード
 * 
 * @todo: ORION障害時の対応 (既存データのチェックでは404確認を行っていない)
 * @todo: 処理の最適化 (本当に先にGETすべきなのか？)
 */
export const sendData = async (type: string, id: string, data: any) => {
  const client = await orionAxiosClient(
    process.env.FIWARE_SERVICE ?? '',
    process.env.FIWARE_SERVICE_PATH ?? '',
  )
  try {
    // 既存データかどうかの確認
    await client.get(
      `${process.env.ORION_ENDPOINT}/v2/entities/${id}?type=${type}`
    ).then(async () => {
      // 既存データである場合はPUT
      await client.put(
        `${process.env.ORION_ENDPOINT}/v2/entities/${id}/attrs?type=${type}`,
        data
      )
    }).catch(async () => {
      // 既存データではない場合はPOST
      await client.post(
        `${process.env.ORION_ENDPOINT}/v2/entities`,
        {
          type,
          id,
          ...data,
        }
      )
    })
  } catch (error) {
    console.log(error)
    throw error
  }
}
