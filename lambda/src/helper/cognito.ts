import {
  AuthenticationDetails,
  CognitoUserPool,
  CognitoUser
} from 'amazon-cognito-identity-js'

export const getJwt = async (
  userPoolId: string,
  appClientId: string,
  username: string,
  password: string,
): Promise<string> => {
  const authenticationData = {
    Username: username,
    Password: password
  }
  const authenticationDetails = new AuthenticationDetails(
    authenticationData
  )
  const poolData = {
    UserPoolId: userPoolId,
    ClientId: appClientId,
  }
  const userPool = new CognitoUserPool(poolData)
  const userData = {
    Username: authenticationData.Username,
    Pool: userPool,
  }
  const cognitoUser = new CognitoUser(userData)

  return new Promise<string>((resolve, reject) =>
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: async function (result: any) {
        const idToken = result.getIdToken().getJwtToken()
        resolve(idToken)
      },
      onFailure: function (err: any) {
        reject(err)
      },
    })
  )
}
