import * as os from 'os'
import * as path from 'path'

import * as actionsCore from '@actions/core'

export function omniDataHome(): string {
  if (process.env.OMNI_DATA_HOME) {
    return process.env.OMNI_DATA_HOME
  }

  const dataHome = process.env.XDG_DATA_HOME || `${os.homedir()}/.local/share`
  return `${dataHome}/omni`
}

export function omniCacheHome(): string {
  if (process.env.OMNI_CACHE_HOME) {
    return process.env.OMNI_CACHE_HOME
  }

  const cacheHome = process.env.XDG_CACHE_HOME || `${os.homedir()}/.cache`
  return `${cacheHome}/omni`
}

export async function setEnv(): Promise<void> {
  actionsCore.startGroup('Setting environment variables to use omni')

  const shimsPath = path.join(omniDataHome(), 'shims')
  actionsCore.info(`Adding ${shimsPath} to PATH`)
  actionsCore.addPath(shimsPath)
}
