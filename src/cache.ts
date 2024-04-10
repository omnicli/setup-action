import * as fs from 'fs'

import * as actionsCache from '@actions/cache'
import * as actionsCore from '@actions/core'
import * as actionsGlob from '@actions/glob'
import * as toolCache from '@actions/tool-cache'

import { omniDataHome, omniCacheHome } from './env'
import { getCurrentArch, getCurrentPlatform } from './utils'

export async function saveCache(): Promise<void> {
  if (!actionsCore.getState('CACHE')) {
    actionsCore.info('Skipping saving cache')
    return
  }

  const state = actionsCore.getState('CACHE_KEY')
  const primaryKey = actionsCore.getState('PRIMARY_KEY')
  const cachePaths = actionsCore.getState('CACHED_PATHS').split('\n')

  const cacheId = await actionsCache.saveCache(cachePaths, primaryKey)
  if (cacheId === -1) return

  actionsCore.info(`Cache saved from ${cachePaths} with key: ${primaryKey}`)
}

export async function restoreCache(): Promise<void> {
  actionsCore.startGroup('Restoring cache for omni')

  const cachePaths = [omniDataHome(), omniCacheHome()]

  const fileHash = await actionsGlob.hashFiles([`.omni.yaml`].join('\n'))
  const prefix = actionsCore.getInput('cache_key_prefix') || 'omni'
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

  actionsCore.saveState('CACHE_KEY', cacheKey)
  actionsCore.info(`omni cache restored from key: ${cacheKey}`)
}
