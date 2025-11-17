/* eslint-disable import/first */

// Mock fs before any imports
const fsPromises = {
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn()
}

jest.mock('fs', () => ({
  promises: fsPromises,
  existsSync: jest.fn(),
  // Add constants that @actions/io needs
  constants: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    S_IFMT: 0o170000,
    S_IFREG: 0o100000,
    S_IFDIR: 0o040000,
    S_IFCHR: 0o020000,
    S_IFBLK: 0o060000,
    S_IFIFO: 0o010000,
    S_IFLNK: 0o120000,
    S_IFSOCK: 0o140000,
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1
  }
}))

/**
 * Unit tests for cache utilities, src/cache_utils.ts
 */

import * as actionsCore from '@actions/core'
import * as actionsExec from '@actions/exec'
import * as actionsGlob from '@actions/glob'
import * as fs from 'fs'
import * as path from 'path'

import * as cacheUtils from '../src/cache_utils'
import * as envModule from '../src/env'

// Mock remaining external modules
jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('@actions/glob')
jest.mock('../src/env')

describe('cache_utils.ts', () => {
  // Common mocks
  let infoMock: jest.SpiedFunction<typeof actionsCore.info>
  let execMock: jest.SpiedFunction<typeof actionsExec.exec>
  let hashFilesMock: jest.SpiedFunction<typeof actionsGlob.hashFiles>
  let existsSyncMock: jest.SpiedFunction<typeof fs.existsSync>
  let omniDataHomeMock: jest.SpiedFunction<typeof envModule.omniDataHome>

  // Store original process.env
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset process.env before each test
    process.env = { ...originalEnv }

    // Setup mocks
    infoMock = jest.spyOn(actionsCore, 'info').mockImplementation()
    execMock = jest.spyOn(actionsExec, 'exec').mockImplementation()
    hashFilesMock = jest.spyOn(actionsGlob, 'hashFiles').mockImplementation()
    existsSyncMock = jest.spyOn(fs, 'existsSync').mockImplementation()
    omniDataHomeMock = jest
      .spyOn(envModule, 'omniDataHome')
      .mockImplementation()
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('hashCache', () => {
    beforeEach(() => {
      process.env.GITHUB_WORKSPACE = '/workspace'
    })

    it('hashes cache paths correctly', async () => {
      hashFilesMock.mockResolvedValue('hash123')
      const paths = ['/path/1', '/path/2']

      const result = await cacheUtils.hashCache(paths)

      expect(result).toBe('hash123')
      expect(hashFilesMock).toHaveBeenCalledWith(paths.join('\n'), '', {
        followSymbolicLinks: false
      })
      expect(infoMock).toHaveBeenCalledWith(
        'Hashing cache paths: /path/1,/path/2'
      )
      expect(infoMock).toHaveBeenCalledWith('Cache hash: hash123')
    })

    it('temporarily unsets GITHUB_WORKSPACE during hash computation', async () => {
      hashFilesMock.mockResolvedValue('hash123')
      const paths = ['/path/1']

      await cacheUtils.hashCache(paths)

      // The GITHUB_WORKSPACE should be temporarily unset during hashFiles call
      expect(process.env.GITHUB_WORKSPACE).toBe('/workspace')
    })

    it('restores GITHUB_WORKSPACE even if hash operation fails', async () => {
      hashFilesMock.mockRejectedValue(new Error('Hash failed'))
      const paths = ['/path/1']

      await expect(cacheUtils.hashCache(paths)).rejects.toThrow('Hash failed')

      // The GITHUB_WORKSPACE should be restored even after error
      expect(process.env.GITHUB_WORKSPACE).toBe('/workspace')
    })

    it('handles empty paths array', async () => {
      hashFilesMock.mockResolvedValue('')

      const result = await cacheUtils.hashCache([])

      expect(result).toBe('')
      expect(hashFilesMock).toHaveBeenCalledWith('', '', {
        followSymbolicLinks: false
      })
      expect(infoMock).toHaveBeenCalledWith('Hashing cache paths: ')
    })
  })

  describe('removeShims', () => {
    it('removes shims directory if it exists', async () => {
      existsSyncMock.mockReturnValue(true)
      omniDataHomeMock.mockReturnValue('/omni/data')
      execMock.mockResolvedValue(0)

      await cacheUtils.removeShims()

      const expectedShimsPath = path.join('/omni/data', 'shims')
      expect(execMock).toHaveBeenCalledWith('rm', ['-rf', expectedShimsPath])
      expect(infoMock).toHaveBeenCalledWith(
        `Removing shims directory: ${expectedShimsPath}`
      )
    })

    it('does nothing if shims directory does not exist', async () => {
      existsSyncMock.mockReturnValue(false)
      omniDataHomeMock.mockReturnValue('/omni/data')

      await cacheUtils.removeShims()

      expect(execMock).not.toHaveBeenCalled()
      expect(infoMock).not.toHaveBeenCalled()
    })

    it('propagates execution errors', async () => {
      existsSyncMock.mockReturnValue(true)
      omniDataHomeMock.mockReturnValue('/omni/data')
      execMock.mockRejectedValue(new Error('Remove failed'))

      await expect(cacheUtils.removeShims()).rejects.toThrow('Remove failed')
    })
  })
})
