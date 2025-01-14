import * as semver from 'semver'

import * as actionsCore from '@actions/core'

import { restoreCache, saveCache } from './cache'
import { setEnv, setOrg } from './env'
import {
  omniVersion,
  omniUp,
  omniTrust,
  omniReshim,
  omniCheck,
  OmniCheckOptions,
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

    const runCheck = actionsCore.getBooleanInput('check')
    if (runCheck) {
      if (semver.satisfies(version, '>=2025.1.0')) {
        // Split patterns by newlines or colons and filter empty strings
        const patterns = actionsCore
          .getInput('check_patterns')
          .split(/[\n:]/)
          .map(p => p.trim())
          .filter(Boolean)

        // Split ignore/select by newlines or commas and filter empty strings
        const ignore = actionsCore
          .getInput('check_ignore')
          .split(/[\n,]/)
          .map(i => i.trim())
          .filter(Boolean)
        const select = actionsCore
          .getInput('check_select')
          .split(/[\n,]/)
          .map(s => s.trim())
          .filter(Boolean)

        const checkOptions: OmniCheckOptions = { args: ['--local'] }
        if (patterns.length > 0) checkOptions.patterns = patterns
        if (ignore.length > 0) checkOptions.ignore = ignore
        if (select.length > 0) checkOptions.select = select

        const checkResult = await omniCheck(checkOptions)
        if (checkResult !== 0) {
          throw new Error('omni config check failed')
        }
      } else {
        // Skip running since the command is not available
        actionsCore.warning(
          'omni config check is not available in this version'
        )
      }
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
