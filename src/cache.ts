import * as path from 'path'

import * as actionsCache from '@actions/cache'
import * as actionsCore from '@actions/core'
import * as actionsGlob from '@actions/glob'

import { omniDataHome, omniCacheHome } from './env'
import { getCurrentArch, getCurrentPlatform } from './utils'

export async function hashCache(cachePaths: string[]): Promise<string> {
  actionsCore.info(`Hashing cache paths: ${cachePaths}`)

  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE
  try {
    // Override GITHUB_WORKSPACE to be empty so that we can hash anything
    // without having to worry about the actual workspace; this is required
    // because the function will ignore anything outside of the github workspace
    // https://github.com/actions/toolkit/blob/9ddf153e007b587270658b32cc50a457e959c02c/packages/glob/src/internal-hash-files.ts#L24
    process.env.GITHUB_WORKSPACE = ''
    const hash = await actionsGlob.hashFiles(cachePaths.join('\n'), '', {
      followSymbolicLinks: false
    })
    actionsCore.info(`Cache hash: ${hash}`)
    return hash
  } finally {
    // Reset GITHUB_WORKSPACE to its original value
    process.env.GITHUB_WORKSPACE = GITHUB_WORKSPACE
  }
}

export async function saveCache(): Promise<void> {
  if (!actionsCore.getState('CACHE')) {
    actionsCore.info('Skipping saving cache')
    return
  }

  const primaryKey = actionsCore.getState('PRIMARY_KEY')
  const cachePaths = actionsCore.getState('CACHED_PATHS').split('\n')
  const cacheHashPaths = actionsCore.getState('CACHED_HASHED_PATHS').split('\n')

  const cacheCheckHash = actionsCore.getBooleanInput('cache_check_hash')
  if (cacheCheckHash) {
    const cacheHash = actionsCore.getState('CACHE_HASH')
    const currentCacheHash = await hashCache(cacheHashPaths)

    if (cacheHash === currentCacheHash) {
      actionsCore.info('Cache up-to-date, skipping saving cache')
      return
    }
  }

  const cacheId = await actionsCache.saveCache(cachePaths, primaryKey)
  if (cacheId === -1) return

  actionsCore.info(`Cache saved from ${cachePaths} with key: ${primaryKey}`)
}

export async function restoreCache(): Promise<void> {
  actionsCore.startGroup('Restoring cache for omni')

  const cachePaths = [omniDataHome(), omniCacheHome()]
  const cacheHashPaths = [
    omniDataHome(),
    `!${path.join(omniDataHome(), 'shims')}`
  ]

  const fileHash = await actionsGlob.hashFiles([`.omni.yaml`].join('\n'))
  const prefix = actionsCore.getInput('cache_key_prefix') || 'omni-v0'
  const full_key_prefix = `${prefix}-${getCurrentPlatform()}-${getCurrentArch()}`
  const primaryKey = `${full_key_prefix}-${fileHash}`
  const restoreKeys = [`${full_key_prefix}-`]

  actionsCore.saveState(
    'CACHE',
    actionsCore.getBooleanInput('cache_write') ?? true
  )
  actionsCore.saveState('PRIMARY_KEY', primaryKey)
  actionsCore.saveState('RESTORE_KEYS', restoreKeys.join('\n'))
  actionsCore.saveState('CACHED_PATHS', cachePaths.join('\n'))
  actionsCore.saveState('CACHED_HASHED_PATHS', cacheHashPaths.join('\n'))

  const cacheKey = await actionsCache.restoreCache(
    cachePaths,
    primaryKey,
    restoreKeys
  )
  actionsCore.setOutput('cache-hit', Boolean(cacheKey))

  if (!cacheKey) {
    actionsCore.info(`omni cache not found for ${primaryKey}`)
    return
  }

  const cacheCheckHash = actionsCore.getBooleanInput('cache_check_hash')
  if (cacheCheckHash) {
    const cacheHash = await hashCache(cacheHashPaths)
    actionsCore.saveState('CACHE_HASH', cacheHash)
  }

  actionsCore.saveState('CACHE_KEY', cacheKey)
  actionsCore.info(`omni cache restored from key: ${cacheKey}`)
}
