import { EnvironmentType } from '@verida/types'
import { Client } from '@verida/client-ts'
import { WebUser } from '@verida/web-helpers'

// (optional) Import WalletConnect if required
//import WalletConnect from '@walletconnect/client'

// API docs:
// https://developers.verida.network/docs/single-sign-on-sdk/web-user

const VERIDA_ENVIRONMENT = EnvironmentType.TESTNET
const CONTEXT_NAME = 'funDAOmental: Hyperbox'
const VAULT_CONTEXT = 'Verida: Vault'
const SNAPSPHOT_DB_NAME = 'room_snapshots'
const LOGO_URL = 'https://hyperbox-stage-2301.fundaomental.com/oathring_512x512.png'

class HyperboxWebUser extends WebUser {

  getDidAddress(){
    return this.did?.split(':')?.slice(-1)?.[0] ?? null
  }

  //
  // Database API:
  // https://developers.verida.network/docs/api/verida-js/interfaces/verida_client_ts.Database
  async getSnapshotDb() {
    const context = await VeridaUser.getContext()
    const roomSnapshotsDb = await context.openDatabase(SNAPSPHOT_DB_NAME, {
      permissions: {
        read: 'public',
        write: 'users',
      }
    })
    return roomSnapshotsDb
  }

  // @todo: Create a proper schema
  async saveData(docId, data) {
    console.log(`verida.saveData(${docId}, ${docId})`)
    if (!docId || !data) return false
    const roomSnapshotsDb = await VeridaUser.getSnapshotDb()
    let roomItem = {
      _id: docId
    }

    try {
      roomItem = await roomSnapshotsDb.get(docId)
    } catch (err) {
      if (err.name != 'not_found') {
        throw err
      }
    }

    roomItem.snapshot = JSON.stringify(data)
    const result = await roomSnapshotsDb.save(roomItem)
    console.log('Room saved!', result)

    if (!result) {
      console.log('Save room error')
      console.log(roomSnapshotsDb.errors)
      return false
    }

    return true
  }

  async restoreData(docId) {
    console.log(`verida.restoreData(${docId})`)
    if (!docId) return false
    const roomSnapshotsDb = await VeridaUser.getSnapshotDb()
    try {
      const roomItem = await roomSnapshotsDb.get(docId)
      console.log(`verida.restored:`, roomItem)
      return roomItem.snapshot
    } catch (err) {
      console.warn(`verida.restore error:`, err)
      // If the room isn't found, return empty
      // Otherwise re-raise the error
      if (err.error != 'not_found') {
        throw err
      }
    }
    return false
  }


  async retrieveLastTweet(onFinished) {
    await VeridaUser.requireConnection()
    const messaging = await VeridaUser.context.getMessaging()
    const message = 'Please share your social media posts with hyperbox'
    const messageType = 'inbox/type/dataRequest'

    // Note: You could apply a filter `{sourceApplication: 'https://twitter.com/'}` to only include twitter results
    const data = {
      requestSchema:
        'https://common.schemas.verida.io/social/post/v0.1.0/schema.json',
      filter: {
        sourceApplication: 'https://twitter.com/'
      },
      userSelect: false
    }
    const config = {
      recipientContextName: VAULT_CONTEXT
    }

    messaging.onMessage(function (message) {
      const recentPosts = message.data.data[0]
      const lastPost = recentPosts[0]
      if(!lastPost) {
        onFinished(null)
        return
      }
      console.log('Most recent twitter post:')
      console.log(lastPost)
      const content = `<img src='${lastPost.sourceData.user.avatar}' /><strong>@${lastPost.sourceData.user.screen_name}</strong>: ${lastPost.content}`

      onFinished(content)
    })

    console.log('Requesting tweet data from user\'s mobile')
    await messaging.send(VeridaUser.did, messageType, data, message, config)
  }
}

export const VeridaUser = new HyperboxWebUser({
  accountConfig: {
    request: {
      logoUrl: LOGO_URL
    }
  },
  clientConfig: {
    environment: VERIDA_ENVIRONMENT
  },
  contextConfig: {
    name: CONTEXT_NAME
  },
  debug: true
}).setMaxListeners(20)


// client setup: https://developers.verida.network/docs/client-sdk/authentication
const getClient = async  () => {
  const isConnected = await VeridaUser.isConnected()
  if (!isConnected) return null

  const client = new Client({
    environment: VERIDA_ENVIRONMENT
  })
  await client.connect(VeridaUser.account)

  return client
}

// profile fetch: https://developers.verida.network/docs/client-sdk/profiles
export const getPublicProfile = async (didAddress) => {
  const client = await getClient()
  if (!client) return null

  const did = `did:vda:testnet:${didAddress}`
  const profileConnection = await client.openPublicProfile(did, VAULT_CONTEXT, 'basicProfile')
  const publicProfile = await profileConnection.getMany()

  return publicProfile
}
