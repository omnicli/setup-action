import * as semver from 'semver'

import * as actionsCore from '@actions/core'

import { restoreCache, saveCache } from './cache'
import { setEnv, setOrg } from './env'
import {
  omniVersion,
  omniUp,
  omniTrust,
  omniReshim,
  disableOmniAutoBootstrapUser
} from './omni'
import { setup } from './setup'

export async function run_index(): Promise<void> {
  try {
    const useCache = actionsCore.getBooleanInput('cache')
    if (useCache) {
      await restoreCache()
    } else {
      actionsCore.setOutput('cache-hit', false)
    }

    await setup()

    const version = await omniVersion()
    if (!semver.valid(version)) {
      throw new Error(`Invalid version: ${version}`)
    }

    const trusted = semver.satisfies(version, '>=0.0.24')
      ? (await omniTrust()) === 0
      : await setOrg()

    if (semver.satisfies(version, '<0.0.25')) {
      await disableOmniAutoBootstrapUser()
    }

    const runUp = actionsCore.getBooleanInput('up')
    if (runUp) {
      await omniUp(trusted)
    }

    if (semver.satisfies(version, '>=0.0.24')) {
      await omniReshim()
    }

    await setEnv(version)
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
