import * as actionsCore from '@actions/core'

import { restoreCache, saveCache } from './cache'
import { setup, omniVersion, omniUp } from './setup'
import { setEnv } from './env'

export async function run_index(): Promise<void> {
  try {
    const useCache = actionsCore.getBooleanInput('cache')
    if (useCache) {
      await restoreCache()
    } else {
      actionsCore.setOutput('cache-hit', false)
    }

    await setup()
    await omniVersion()
    await setEnv()

    const runUp = actionsCore.getBooleanInput('up')
    if (runUp) {
      await omniUp()
    }
  } catch (e) {
    actionsCore.setFailed((e as Error).message)
  }
}

export async function run_post(): Promise<void> {
  try {
    await saveCache()
  } catch (error) {
    if (error instanceof Error) actionsCore.setFailed(error.message)
    else throw error
  }
}
