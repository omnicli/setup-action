/**
 * Unit tests for the action's cache functionality, src/cache.ts
 */

import * as actionsCore from '@actions/core'
import * as actionsCache from '@actions/cache'
import * as actionsGlob from '@actions/glob'

import * as cache from '../src/cache'
import * as cacheUtils from '../src/cache_utils'
import { omniDataHome, omniCacheHome } from '../src/env'

// Mock the external dependencies
jest.mock('@actions/core')
jest.mock('@actions/cache')
jest.mock('@actions/glob')
jest.mock('../src/cache_utils')
jest.mock('../src/env')

describe('cache.ts', () => {
  // Common mocks
  let getStateMock: jest.SpiedFunction<typeof actionsCore.getState>
  let saveCacheMock: jest.SpiedFunction<typeof actionsCache.saveCache>
  let hashCacheMock: jest.SpiedFunction<typeof cacheUtils.hashCache>
  let removeShimsMock: jest.SpiedFunction<typeof cacheUtils.removeShims>

  beforeEach(() => {
    jest.clearAllMocks()

    getStateMock = jest.spyOn(actionsCore, 'getState').mockImplementation()
    saveCacheMock = jest.spyOn(actionsCache, 'saveCache').mockImplementation()
    hashCacheMock = jest.spyOn(cacheUtils, 'hashCache').mockImplementation()
    removeShimsMock = jest.spyOn(cacheUtils, 'removeShims').mockImplementation()
  })

  describe('saveCache', () => {
    beforeEach(() => {
      hashCacheMock.mockResolvedValue('hash1234')
      removeShimsMock.mockResolvedValue(undefined)
    })

    it('does not save cache if no CACHE state', async () => {
      getStateMock.mockImplementation(() => '')

      await cache.saveCache()

      expect(saveCacheMock).not.toHaveBeenCalled()
      expect(hashCacheMock).not.toHaveBeenCalled()
      expect(removeShimsMock).not.toHaveBeenCalled()
    })

    it('does not save cache if CACHE state defined to false', async () => {
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

  describe('restoreCache', () => {
    let getBooleanInputMock: jest.SpiedFunction<
      typeof actionsCore.getBooleanInput
    >
    let getInputMock: jest.SpiedFunction<typeof actionsCore.getInput>
    let saveStateMock: jest.SpiedFunction<typeof actionsCore.saveState>
    let startGroupMock: jest.SpiedFunction<typeof actionsCore.startGroup>
    let setOutputMock: jest.SpiedFunction<typeof actionsCore.setOutput>
    let restoreCacheMock: jest.SpiedFunction<typeof actionsCache.restoreCache>
    let omniDataHomeMock: jest.SpiedFunction<typeof omniDataHome>
    let omniCacheHomeMock: jest.SpiedFunction<typeof omniCacheHome>

    beforeEach(() => {
      getBooleanInputMock = jest
        .spyOn(actionsCore, 'getBooleanInput')
        .mockImplementation()
      getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
      saveStateMock = jest.spyOn(actionsCore, 'saveState').mockImplementation()
      startGroupMock = jest
        .spyOn(actionsCore, 'startGroup')
        .mockImplementation()
      setOutputMock = jest.spyOn(actionsCore, 'setOutput').mockImplementation()
      restoreCacheMock = jest
        .spyOn(actionsCache, 'restoreCache')
        .mockImplementation()
      omniDataHomeMock = jest
        .spyOn({ omniDataHome }, 'omniDataHome')
        .mockReturnValue('/omni/data')
      omniCacheHomeMock = jest
        .spyOn({ omniCacheHome }, 'omniCacheHome')
        .mockReturnValue('/omni/cache')

      getBooleanInputMock.mockImplementation(name => {
        switch (name) {
          case 'cache_write':
            return true
          case 'cache_check_hash':
            return true
          default:
            return false
        }
      })
      getInputMock.mockImplementation(name => {
        if (name === 'cache_key_prefix') return 'omni-v0'
        return ''
      })
    })

    it('starts with cache restore group', async () => {
      await cache.restoreCache()

      expect(startGroupMock).toHaveBeenCalledWith('Restoring cache for omni')
    })

    it('sets up correct cache paths', async () => {
      await cache.restoreCache()

      expect(saveStateMock).toHaveBeenCalledWith(
        'CACHED_PATHS',
        '/omni/data\n/omni/cache'
      )
      expect(saveStateMock).toHaveBeenCalledWith(
        'CACHED_HASHED_PATHS',
        '/omni/data\n!/omni/data/shims'
      )
    })

    it('handles cache miss correctly', async () => {
      restoreCacheMock.mockResolvedValue(undefined)

      await cache.restoreCache()

      expect(setOutputMock).toHaveBeenCalledWith('cache-hit', false)
    })

    it('handles cache hit correctly', async () => {
      restoreCacheMock.mockResolvedValue('cache-key-123')

      await cache.restoreCache()

      expect(setOutputMock).toHaveBeenCalledWith('cache-hit', true)
      expect(removeShimsMock).toHaveBeenCalled()
    })

    it('saves cache hash when cache_write and cache_check_hash are true', async () => {
      restoreCacheMock.mockResolvedValue('cache-key-123')
      hashCacheMock.mockResolvedValue('hash123')

      await cache.restoreCache()

      expect(saveStateMock).toHaveBeenCalledWith('CACHE_HASH', 'hash123')
    })

    it('skips hash check when cache_check_hash is false', async () => {
      getBooleanInputMock.mockImplementation(name => name === 'cache_write')
      restoreCacheMock.mockResolvedValue('cache-key-123')

      await cache.restoreCache()

      expect(hashCacheMock).not.toHaveBeenCalled()
    })

    it('uses custom cache key prefix when provided', async () => {
      getInputMock.mockImplementation(() => 'custom-prefix')

      await cache.restoreCache()

      expect(saveStateMock).toHaveBeenCalledWith(
        'PRIMARY_KEY_PREFIX',
        expect.stringContaining('custom-prefix')
      )
    })
  })
})
