import * as actionsCore from '@actions/core'
import * as semver from 'semver'

import { restoreCache, saveCache } from './cache'
import { setEnv, setOrg } from './env'
import {
  disableOmniAutoBootstrapUser,
  omniCheck,
  omniReshim,
  omniTrust,
  omniUp,
  omniVersion
} from './omni'
import { setup } from './setup'

export async function run_index(): Promise<void> {
  try {
    // Export GH_TOKEN for child processes (like omni up) if a token is available
    // Check for a GitHub token using the same approach as setup.ts
    const potentialTokens = [
      process.env.GITHUB_TOKEN,
      process.env.GH_TOKEN,
      actionsCore.getInput('github_token')
    ]
    const ghToken = potentialTokens.find(t => t !== undefined && t !== '')
    if (ghToken && !process.env.GH_TOKEN) {
      actionsCore.exportVariable('GH_TOKEN', ghToken)
    }

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

    const runCheck = actionsCore.getBooleanInput('check')
    if (runCheck) {
      if (semver.satisfies(version, '>=2025.1.0')) {
        await omniCheck()
      } else {
        // Skip running since the command is not available
        actionsCore.warning(
          'omni config check is not available in this version'
        )
      }
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
    const errorMessage = e instanceof Error ? e.message : String(e)
    actionsCore.setOutput('failure-reason', errorMessage)
    actionsCore.setFailed(errorMessage)
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
