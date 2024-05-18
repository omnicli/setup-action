/**
 * Unit tests for the action's cache functionality, src/cache.ts.
 */

import * as actionsCore from '@actions/core'
import * as actionsCache from '@actions/cache'

import * as cache from '../src/cache'
import * as cacheUtils from '../src/cache_utils'

// Mock the hashCache function
const hashCacheMock = jest.spyOn(cacheUtils, 'hashCache')
const removeShimsMock = jest.spyOn(cacheUtils, 'removeShims')

// Mock the GitHub Actions core library
let getStateMock: jest.SpiedFunction<typeof actionsCore.getState>
let saveCacheMock: jest.SpiedFunction<typeof actionsCache.saveCache>

describe('saveCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getStateMock = jest.spyOn(actionsCore, 'getState').mockImplementation()
    saveCacheMock = jest.spyOn(actionsCache, 'saveCache').mockImplementation()
  })

  it('does not save cache if no CACHE state', async () => {
    hashCacheMock.mockResolvedValue('hash1234')
    removeShimsMock.mockResolvedValue(undefined)
    getStateMock.mockImplementation(() => {
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).not.toHaveBeenCalled()
    expect(hashCacheMock).not.toHaveBeenCalled()
    expect(removeShimsMock).not.toHaveBeenCalled()
  })

  it('does not save cache if CACHE state defined to false', async () => {
    hashCacheMock.mockResolvedValue('hash1234')
    removeShimsMock.mockResolvedValue(undefined)
    getStateMock.mockImplementation((key: string) => {
      if (key === 'CACHE') return 'false'
      if (key === 'PRIMARY_KEY_PREFIX') return 'primary_key_prefix_'
      if (key === 'CACHED_PATHS') return 'path1\npath2'
      if (key === 'CACHED_HASHED_PATHS') return 'path1\n!path1/shims'
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).not.toHaveBeenCalled()
    expect(hashCacheMock).not.toHaveBeenCalled()
    expect(removeShimsMock).not.toHaveBeenCalled()
  })

  it('saves cache if CACHE state defined to true', async () => {
    hashCacheMock.mockResolvedValue('hash1234')
    removeShimsMock.mockImplementation(undefined)
    getStateMock.mockImplementation((key: string) => {
      if (key === 'CACHE') return 'true'
      if (key === 'PRIMARY_KEY_PREFIX') return 'primary_key_prefix_'
      if (key === 'CACHED_PATHS') return 'path1\npath2'
      if (key === 'CACHED_HASHED_PATHS') return 'path1\n!path1/shims'
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).toHaveBeenCalledWith(
      ['path1', 'path2'],
      'primary_key_prefix_hash1234'
    )
    expect(hashCacheMock).toHaveBeenCalledWith(['path1', '!path1/shims'])
    expect(removeShimsMock).toHaveBeenCalled()
  })

  it('does not save cache if hash is the same as the cache key', async () => {
    hashCacheMock.mockResolvedValue('hash1234')
    removeShimsMock.mockResolvedValue(undefined)
    getStateMock.mockImplementation((key: string) => {
      if (key === 'CACHE') return 'true'
      if (key === 'PRIMARY_KEY_PREFIX') return 'primary_key_prefix_'
      if (key === 'CACHE_KEY') return 'primary_key_prefix_hash1234'
      if (key === 'CACHED_PATHS') return 'path1\npath2'
      if (key === 'CACHED_HASHED_PATHS') return 'path1\n!path1/shims'
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).not.toHaveBeenCalled()
    expect(hashCacheMock).toHaveBeenCalledWith(['path1', '!path1/shims'])
    expect(removeShimsMock).toHaveBeenCalled()
  })

  it('saves cache if hash is different from the cache key', async () => {
    hashCacheMock.mockResolvedValue('hash5678')
    removeShimsMock.mockResolvedValue(undefined)
    getStateMock.mockImplementation((key: string) => {
      if (key === 'CACHE') return 'true'
      if (key === 'PRIMARY_KEY_PREFIX') return 'primary_key_prefix_'
      if (key === 'CACHE_KEY') return 'primary_key_prefix_hash1234'
      if (key === 'CACHED_PATHS') return 'path1\npath2'
      if (key === 'CACHED_HASHED_PATHS') return 'path1\n!path1/shims'
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).toHaveBeenCalledWith(
      ['path1', 'path2'],
      'primary_key_prefix_hash5678'
    )
    expect(hashCacheMock).toHaveBeenCalledWith(['path1', '!path1/shims'])
    expect(removeShimsMock).toHaveBeenCalled()
  })

  it('does not save cache if CACHE_HASH is the same as the current hash', async () => {
    hashCacheMock.mockResolvedValue('hash1234')
    removeShimsMock.mockResolvedValue(undefined)
    getStateMock.mockImplementation((key: string) => {
      if (key === 'CACHE') return 'true'
      if (key === 'PRIMARY_KEY_PREFIX') return 'primary_key_prefix_'
      if (key === 'CACHE_HASH') return 'hash1234'
      if (key === 'CACHED_PATHS') return 'path1\npath2'
      if (key === 'CACHED_HASHED_PATHS') return 'path1\n!path1/shims'
      return ''
    })

    await cache.saveCache()

    expect(saveCacheMock).not.toHaveBeenCalled()
    expect(hashCacheMock).toHaveBeenCalledWith(['path1', '!path1/shims'])
    expect(removeShimsMock).toHaveBeenCalled()
  })
})
