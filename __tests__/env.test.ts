/**
 * Unit tests for env functionality, src/env.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import * as actionsCore from '@actions/core'
import * as actionsGithub from '@actions/github'

import * as env from '../src/env'
import * as omni from '../src/omni'

// Mock external modules
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn()
  }
}))
jest.mock('os')
jest.mock('path')
jest.mock('@actions/core')
jest.mock('@actions/github')
jest.mock('../src/omni')

describe('env.ts', () => {
  // Common mocks
  let getStateMock: jest.SpiedFunction<typeof actionsCore.getState>
  let saveStateMock: jest.SpiedFunction<typeof actionsCore.saveState>
  let homedirMock: jest.SpiedFunction<typeof os.homedir>
  let joinMock: jest.SpiedFunction<typeof path.join>
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset process.env before each test
    process.env = { ...originalEnv }

    // Clear any environment variables that might affect tests
    delete process.env.OMNI_DATA_HOME
    delete process.env.OMNI_CACHE_HOME
    delete process.env.XDG_DATA_HOME
    delete process.env.XDG_CACHE_HOME
    delete process.env.HOME

    // Setup common mocks
    getStateMock = jest.spyOn(actionsCore, 'getState').mockImplementation()
    saveStateMock = jest.spyOn(actionsCore, 'saveState').mockImplementation()
    homedirMock = jest.spyOn(os, 'homedir').mockReturnValue('/home/user')
    joinMock = jest
      .spyOn(path, 'join')
      .mockImplementation((...paths: string[]) => paths.join('/'))
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('omniDataHome', () => {
    it('returns cached value if available', () => {
      getStateMock.mockReturnValue('/cached/path')

      const result = env.omniDataHome()

      expect(result).toBe('/cached/path')
      expect(saveStateMock).not.toHaveBeenCalled()
      expect(homedirMock).not.toHaveBeenCalled()
    })

    it('uses OMNI_DATA_HOME if set', () => {
      process.env.OMNI_DATA_HOME = '/custom/omni/data'

      const result = env.omniDataHome()

      expect(result).toBe('/custom/omni/data')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_DATA_HOME',
        '/custom/omni/data'
      )
    })

    it('uses XDG_DATA_HOME if set and OMNI_DATA_HOME not set', () => {
      process.env.XDG_DATA_HOME = '/xdg/data'
      joinMock.mockReturnValueOnce('/xdg/data/omni')

      const result = env.omniDataHome()

      expect(result).toBe('/xdg/data/omni')
      expect(joinMock).toHaveBeenCalledWith('/xdg/data', 'omni')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_DATA_HOME',
        '/xdg/data/omni'
      )
    })

    it('uses default path if no environment variables set', () => {
      joinMock.mockReturnValueOnce('/home/user/.local/share/omni')

      const result = env.omniDataHome()

      expect(result).toBe('/home/user/.local/share/omni')
      expect(joinMock).toHaveBeenCalledWith('/home/user', '.local/share/omni')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_DATA_HOME',
        '/home/user/.local/share/omni'
      )
    })
  })

  describe('omniCacheHome', () => {
    it('returns cached value if available', () => {
      getStateMock.mockReturnValue('/cached/cache/path')

      const result = env.omniCacheHome()

      expect(result).toBe('/cached/cache/path')
      expect(saveStateMock).not.toHaveBeenCalled()
    })

    it('uses OMNI_CACHE_HOME if set', () => {
      process.env.OMNI_CACHE_HOME = '/custom/omni/cache'

      const result = env.omniCacheHome()

      expect(result).toBe('/custom/omni/cache')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_CACHE_HOME',
        '/custom/omni/cache'
      )
    })

    it('uses XDG_CACHE_HOME if set and OMNI_CACHE_HOME not set', () => {
      process.env.XDG_CACHE_HOME = '/xdg/cache'
      joinMock.mockReturnValueOnce('/xdg/cache/omni')

      const result = env.omniCacheHome()

      expect(result).toBe('/xdg/cache/omni')
      expect(joinMock).toHaveBeenCalledWith('/xdg/cache', 'omni')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_CACHE_HOME',
        '/xdg/cache/omni'
      )
    })

    it('uses default path if no environment variables set', () => {
      joinMock.mockReturnValueOnce('/home/user/.cache/omni')

      const result = env.omniCacheHome()

      expect(result).toBe('/home/user/.cache/omni')
      expect(joinMock).toHaveBeenCalledWith('/home/user', '.cache/omni')
      expect(saveStateMock).toHaveBeenCalledWith(
        'OMNI_CACHE_HOME',
        '/home/user/.cache/omni'
      )
    })
  })

  describe('setOrg', () => {
    let infoMock: jest.SpiedFunction<typeof actionsCore.info>
    let warningMock: jest.SpiedFunction<typeof actionsCore.warning>
    let exportVariableMock: jest.SpiedFunction<
      typeof actionsCore.exportVariable
    >

    beforeEach(() => {
      infoMock = jest.spyOn(actionsCore, 'info').mockImplementation()
      warningMock = jest.spyOn(actionsCore, 'warning').mockImplementation()
      exportVariableMock = jest
        .spyOn(actionsCore, 'exportVariable')
        .mockImplementation()

      // Mock GitHub context
      const mockContext = {
        serverUrl: 'https://github.com',
        repo: {
          owner: 'testowner',
          repo: 'testrepo'
        }
      }
      ;(actionsGithub as any).context = mockContext
    })

    it('sets OMNI_ORG with repository and organization', async () => {
      const result = await env.setOrg()

      expect(result).toBe(true)
      expect(exportVariableMock).toHaveBeenCalledWith(
        'OMNI_ORG',
        'https://github.com/testowner/testrepo,https://github.com/testowner'
      )
      expect(infoMock).toHaveBeenCalledWith(
        'Setting OMNI_ORG=https://github.com/testowner/testrepo,https://github.com/testowner'
      )
    })

    it('appends to existing OMNI_ORG values', async () => {
      process.env.OMNI_ORG = 'existing-org'

      const result = await env.setOrg()

      expect(result).toBe(true)
      expect(exportVariableMock).toHaveBeenCalledWith(
        'OMNI_ORG',
        'existing-org,https://github.com/testowner/testrepo,https://github.com/testowner'
      )
    })

    it('handles errors and returns false', async () => {
      // Simulate error by removing required properties
      // eslint-disable-next-line no-extra-semi
      ;(actionsGithub as any).context = {}

      const result = await env.setOrg()

      expect(result).toBe(false)
      expect(warningMock).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get repository information')
      )
      expect(warningMock).toHaveBeenCalledWith('Repository will not be trusted')
    })
  })

  describe('setEnv', () => {
    let infoMock: jest.SpiedFunction<typeof actionsCore.info>
    let addPathMock: jest.SpiedFunction<typeof actionsCore.addPath>
    let exportVariableMock: jest.SpiedFunction<
      typeof actionsCore.exportVariable
    >
    let startGroupMock: jest.SpiedFunction<typeof actionsCore.startGroup>
    let mkdirMock: jest.SpiedFunction<typeof fs.promises.mkdir>
    let writeFileMock: jest.SpiedFunction<typeof fs.promises.writeFile>
    let omniHookEnvMock: jest.SpiedFunction<typeof omni.omniHookEnv>

    beforeEach(() => {
      infoMock = jest.spyOn(actionsCore, 'info').mockImplementation()
      addPathMock = jest.spyOn(actionsCore, 'addPath').mockImplementation()
      exportVariableMock = jest
        .spyOn(actionsCore, 'exportVariable')
        .mockImplementation()
      startGroupMock = jest
        .spyOn(actionsCore, 'startGroup')
        .mockImplementation((_name: string) => {})
      omniHookEnvMock = jest.spyOn(omni, 'omniHookEnv').mockResolvedValue([])

      // Setup fs mocks
      const mockedFs = jest.mocked(fs)
      mockedFs.existsSync.mockReturnValue(false)
      mkdirMock = mockedFs.promises.mkdir as jest.Mock
      writeFileMock = mockedFs.promises.writeFile as jest.Mock
      mkdirMock.mockResolvedValue(undefined)
      writeFileMock.mockResolvedValue(undefined)

      // Setup path mocking
      const configPath = '/home/user/.config/omni/config.yaml'
      const configDir = '/home/user/.config/omni'
      joinMock.mockImplementation((...paths: string[]) => paths.join('/'))
      jest.spyOn(path, 'dirname').mockReturnValue(configDir)

      // Setup HOME environment variable
      process.env.HOME = '/home/user'
    })

    it('creates config file if it does not exist', async () => {
      expect(infoMock).not.toHaveBeenCalled()

      const configPath = '/home/user/.config/omni/config.yaml'

      await env.setEnv('0.0.24')

      expect(writeFileMock).toHaveBeenCalledWith(configPath, '')
    })

    it('adds shims directory to PATH for version >= 0.0.24', async () => {
      await env.setEnv('0.0.24')

      expect(addPathMock).toHaveBeenCalledWith(
        '/home/user/.local/share/omni/shims'
      )
    })

    it('sets environment variables for version < 0.0.24', async () => {
      omniHookEnvMock.mockResolvedValue([
        { operation: 'export', key: 'TEST_VAR', value: 'test_value' },
        { operation: 'unset', key: 'UNSET_VAR' }
      ])

      await env.setEnv('0.0.23')

      expect(exportVariableMock).toHaveBeenCalledWith('TEST_VAR', 'test_value')
      expect(exportVariableMock).toHaveBeenCalledWith('UNSET_VAR', null)
    })

    it('starts with environment setup group', async () => {
      await env.setEnv('0.0.24')

      expect(startGroupMock).toHaveBeenCalledWith(
        'Setting environment to use omni'
      )
    })
  })
})
