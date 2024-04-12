import * as semver from 'semver'

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as actionsGithub from '@actions/github'
import * as actionsCore from '@actions/core'

import { omniHookEnv } from './omni'

export function omniDataHome(): string {
  let dataHome = actionsCore.getState('OMNI_DATA_HOME')
  if (dataHome) return dataHome

  const { OMNI_DATA_HOME, XDG_DATA_HOME } = process.env
  if (OMNI_DATA_HOME) dataHome = OMNI_DATA_HOME
  else if (XDG_DATA_HOME) dataHome = path.join(XDG_DATA_HOME, 'omni')
  else dataHome = path.join(os.homedir(), '.local/share/omni')

  actionsCore.saveState('OMNI_DATA_HOME', dataHome)
  return dataHome
}

export function omniCacheHome(): string {
  let cacheHome = actionsCore.getState('OMNI_CACHE_HOME')
  if (cacheHome) return cacheHome

  const { OMNI_CACHE_HOME, XDG_CACHE_HOME } = process.env
  if (OMNI_CACHE_HOME) cacheHome = OMNI_CACHE_HOME
  else if (XDG_CACHE_HOME) cacheHome = path.join(XDG_CACHE_HOME, 'omni')
  else cacheHome = path.join(os.homedir(), '.cache/omni')

  actionsCore.saveState('OMNI_CACHE_HOME', cacheHome)
  return cacheHome
}

export async function setOrg(): Promise<boolean> {
  // Add the current github repository as trusted using the OMNI_ORG
  // environment variable, this will allow the user to use the omni
  // commands without having to trust the repository
  //
  // We will try to get the information from the github context since
  // we will be running in a github action context, and the environment
  // will thus refer to the current repository (the action) instead of
  // the repository calling the action

  const context = actionsGithub.context
  try {
    const { owner, repo } = context.repo
    const { OMNI_ORG } = process.env

    const currentRepository = `${context.serverUrl}/${owner}/${repo}`
    const currentOrg = `${context.serverUrl}/${owner}`

    const currentOmniOrg =
      OMNI_ORG && OMNI_ORG.trim() !== '' ? OMNI_ORG.trim().split(',') : []
    for (const org of [currentRepository, currentOrg]) {
      if (!currentOmniOrg.includes(org)) {
        currentOmniOrg.push(org)
      }
    }
    actionsCore.info(`Setting OMNI_ORG=${currentOmniOrg.join(',')}`)
    actionsCore.exportVariable('OMNI_ORG', currentOmniOrg.join(','))

    return true
  } catch (e) {
    actionsCore.warning(`Failed to get repository information: ${e}`)
    actionsCore.warning('Repository will not be trusted')

    return false
  }
}

export async function setEnv(version: string): Promise<void> {
  actionsCore.startGroup('Setting environment to use omni')

  // Make sure that ~/.config/omni/config.yaml exists even
  // if empty, so that omni won't trigger any bootstrap
  const configPath = path.join(os.homedir(), '.config', 'omni', 'config.yaml')
  if (!fs.existsSync(configPath)) {
    actionsCore.info(`Creating ${configPath}`)
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(configPath, '')
  }

  if (semver.satisfies(version, '>=0.0.24')) {
    // We prefer using the shims directory for the github actions
    // since it will allow loading dynamically the right binaries
    // no matter which directory the user is currently in, vs. the
    // env var manipulation which will only load the environment
    // variables for the current directory
    const shimsPath = path.join(omniDataHome(), 'shims')
    actionsCore.info(`Adding ${shimsPath} to PATH`)
    actionsCore.addPath(shimsPath)
  } else {
    // We need to do some env var manipulation here since we can't use
    // the shims directory for versions of omni that are less than 0.0.24
    const envOperations = await omniHookEnv()
    for (const operation of envOperations) {
      if (operation.operation === 'export') {
        if (operation.key !== '__omni_dynenv') {
          actionsCore.info(`Setting ${operation.key}=${operation.value}`)
        }
        actionsCore.exportVariable(operation.key, operation.value)
      } else if (operation.operation === 'unset') {
        actionsCore.info(`Unsetting ${operation.key}`)
        actionsCore.exportVariable(operation.key, null)
      }
    }
  }
}
