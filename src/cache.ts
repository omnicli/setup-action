import * as actionsCache from '@actions/cache'
import * as actionsCore from '@actions/core'
import * as actionsGlob from '@actions/glob'
import * as path from 'path'
import { hashCache, removeShims } from './cache_utils'
import { omniCacheHome, omniDataHome } from './env'
import { getCurrentArch, getCurrentPlatform } from './utils'

export async function saveCache(): Promise<void> {
  const shouldCache = actionsCore.getState('CACHE') === 'true'
  if (!shouldCache) {
    actionsCore.info('Skipping saving cache')
    return
  }

  await removeShims()

  const primaryKeyPrefix = actionsCore.getState('PRIMARY_KEY_PREFIX')
  const cachePaths = actionsCore.getState('CACHED_PATHS').split('\n')
  const cacheHashPaths = actionsCore.getState('CACHED_HASHED_PATHS').split('\n')

  const currentCacheHash = await hashCache(cacheHashPaths)
  const initialCacheHash = actionsCore.getState('CACHE_HASH')
  if (initialCacheHash && initialCacheHash === currentCacheHash) {
    actionsCore.info('Cache up-to-date (hash), skipping saving cache')
    return
  }

  const cacheHitKey = actionsCore.getState('CACHE_KEY')
  const savePrimaryKey = `${primaryKeyPrefix}${currentCacheHash}`
  if (cacheHitKey && cacheHitKey === savePrimaryKey) {
    actionsCore.info('Cache up-to-date (key), skipping saving cache')
    return
  }

  const cacheId = await actionsCache.saveCache(cachePaths, savePrimaryKey)
  if (cacheId === -1) return

  actionsCore.info(`Cache saved from ${cachePaths} with key: ${savePrimaryKey}`)
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
  const primaryKeyPrefix = `${full_key_prefix}-${fileHash}-`
  const restoreKeys = [`${full_key_prefix}-`]

  const cacheWrite = actionsCore.getBooleanInput('cache_write') ?? true
  actionsCore.saveState('CACHE', cacheWrite)
  actionsCore.saveState('PRIMARY_KEY_PREFIX', primaryKeyPrefix)
  actionsCore.saveState('RESTORE_KEYS', restoreKeys.join('\n'))
  actionsCore.saveState('CACHED_PATHS', cachePaths.join('\n'))
  actionsCore.saveState('CACHED_HASHED_PATHS', cacheHashPaths.join('\n'))

  const cacheKey = await actionsCache.restoreCache(
    cachePaths,
    primaryKeyPrefix,
    restoreKeys
  )
  actionsCore.setOutput('cache-hit', Boolean(cacheKey))

  if (!cacheKey) {
    actionsCore.info(
      `omni cache not found for any of ${primaryKeyPrefix}, ${restoreKeys.join(', ')}`
    )
    return
  }

  await removeShims()

  actionsCore.saveState('CACHE_KEY', cacheKey)
  actionsCore.info(`omni cache restored from key: ${cacheKey}`)

  const cacheCheckHash = actionsCore.getBooleanInput('cache_check_hash') ?? true
  if (cacheWrite && cacheCheckHash) {
    const cacheHash = await hashCache(cacheHashPaths)
    actionsCore.saveState('CACHE_HASH', cacheHash)
  }
}
