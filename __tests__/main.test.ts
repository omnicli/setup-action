/**
 * Unit tests for the action's main functionality, src/main.ts
 */

import * as actionsCore from '@actions/core'

import * as cache from '../src/cache'
import * as env from '../src/env'
import * as main from '../src/main'
import * as omni from '../src/omni'
import * as setup from '../src/setup'

// Mock the cache functions
const restoreCacheMock = jest.spyOn(cache, 'restoreCache')
const saveCacheMock = jest.spyOn(cache, 'saveCache')

// Mock the env functions
const setEnvMock = jest.spyOn(env, 'setEnv')
const setOrgMock = jest.spyOn(env, 'setOrg')

// Mock the main functions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const runIndexMock = jest.spyOn(main, 'run_index')
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const runPostMock = jest.spyOn(main, 'run_post')

// Mock the omni functions
const omniVersionMock = jest.spyOn(omni, 'omniVersion')
const omniUpMock = jest.spyOn(omni, 'omniUp')
const omniTrustMock = jest.spyOn(omni, 'omniTrust')
const omniReshimMock = jest.spyOn(omni, 'omniReshim')
const omniCheckMock = jest.spyOn(omni, 'omniCheck')
const disableOmniAutoBootstrapUserMock = jest.spyOn(
  omni,
  'disableOmniAutoBootstrapUser'
)

// Mock the setup functions
const setupMock = jest.spyOn(setup, 'setup')

// Mock the GitHub Actions core library
let getInputMock: jest.SpiedFunction<typeof actionsCore.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof actionsCore.getBooleanInput>
let setFailedMock: jest.SpiedFunction<typeof actionsCore.setFailed>
let warningMock: jest.SpiedFunction<typeof actionsCore.warning>
let exportVariableMock: jest.SpiedFunction<typeof actionsCore.exportVariable>

function setInputValues(
  getInput: jest.SpiedFunction<typeof actionsCore.getInput>,
  getBooleanInput: jest.SpiedFunction<typeof actionsCore.getBooleanInput>,
  overrideInputs: Record<string, string | boolean>
): void {
  const inputs: Record<string, string | boolean> = {
    cache: true,
    cache_write: true,
    cache_check_hash: true,
    cache_key_prefix: 'omni-v0',
    up: false,
    up_args: '',
    version: '',
    check: false,
    check_patterns: '',
    check_ignore: '',
    check_select: '',
    github_token: ''
  }
  for (const [key, value] of Object.entries(overrideInputs)) {
    if (key in inputs) {
      inputs[key] = value
    } else {
      throw new Error(`Unknown input key: ${key}`)
    }
  }

  getInput.mockImplementation(name => {
    if (name in inputs) {
      return inputs[name] as string
    }
    throw new Error(`Unknown input (getInput): ${name}`)
  })

  getBooleanInput.mockImplementation(name => {
    if (name in inputs) {
      return inputs[name] as boolean
    }
    throw new Error(`Unknown input (getBooleanInput): ${name}`)
  })
}

describe('main.ts', () => {
  interface MocksValues {
    version?: string
  }

  function setupMocks(values: MocksValues = {}): void {
    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue(values.version || '0.0.25')
    omniTrustMock.mockResolvedValue(0)
    setOrgMock.mockResolvedValue(true)
    disableOmniAutoBootstrapUserMock.mockResolvedValue()
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    omniCheckMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
    getBooleanInputMock = jest
      .spyOn(actionsCore, 'getBooleanInput')
      .mockImplementation()
    setFailedMock = jest.spyOn(actionsCore, 'setFailed').mockImplementation()
    warningMock = jest.spyOn(actionsCore, 'warning').mockImplementation()
    exportVariableMock = jest
      .spyOn(actionsCore, 'exportVariable')
      .mockImplementation()
  })

  describe('basic functionality', () => {
    it('runs with default inputs', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks()

      await main.run_index()

      expect(restoreCacheMock).toHaveBeenCalledTimes(1)
      expect(setupMock).toHaveBeenCalledTimes(1)
      expect(omniVersionMock).toHaveBeenCalledTimes(1)
      expect(omniTrustMock).toHaveBeenCalled()
      expect(setOrgMock).not.toHaveBeenCalledTimes(1)
      expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('exports GH_TOKEN when github_token is provided', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {
        github_token: 'test-token'
      })
      setupMocks()

      await main.run_index()

      expect(exportVariableMock).toHaveBeenCalledWith('GH_TOKEN', 'test-token')
    })

    it('does not export GH_TOKEN when github_token is empty', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks()

      await main.run_index()

      expect(exportVariableMock).not.toHaveBeenCalled()
    })

    it('handles invalid version', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks()
      omniVersionMock.mockResolvedValue('invalid')

      await main.run_index()

      expect(setFailedMock).toHaveBeenCalledWith('Invalid version: invalid')
    })
  })

  describe('cache functionality', () => {
    it('restores cache when enabled', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { cache: true })
      setupMocks()

      await main.run_index()

      expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    })

    it('skips cache when disabled', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { cache: false })
      setupMocks()

      await main.run_index()

      expect(restoreCacheMock).not.toHaveBeenCalled()
    })
  })

  describe('up functionality', () => {
    it('runs up when enabled', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { up: true })
      setupMocks()

      await main.run_index()

      expect(omniUpMock).toHaveBeenCalledTimes(1)
    })

    it('skips up when disabled', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { up: false })
      setupMocks()

      await main.run_index()

      expect(omniUpMock).not.toHaveBeenCalled()
    })

    it('handles up command failure', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { up: true })
      setupMocks()
      omniUpMock.mockImplementation(() => {
        throw new Error('omni up failed with exit code 1')
      })

      await main.run_index()

      expect(omniUpMock).toHaveBeenCalled()
      expect(omniReshimMock).not.toHaveBeenCalled()
    })
  })

  describe('check functionality', () => {
    it('does not run check by default', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks()

      await main.run_index()

      expect(omniCheckMock).not.toHaveBeenCalled()
      expect(warningMock).not.toHaveBeenCalled()
    })

    it('skips check for unsupported version', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { check: true })
      setupMocks({ version: '0.0.25' })

      await main.run_index()

      expect(omniCheckMock).not.toHaveBeenCalled()
      expect(warningMock).toHaveBeenCalledWith(
        'omni config check is not available in this version'
      )
    })

    it('runs check for supported version', async () => {
      setInputValues(getInputMock, getBooleanInputMock, { check: true })
      setupMocks({ version: '2025.1.0' })

      await main.run_index()

      expect(omniCheckMock).toHaveBeenCalled()
      expect(warningMock).not.toHaveBeenCalled()
    })

    it('handles check command failure', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {
        check: true,
        up: true
      })
      setupMocks({ version: '2025.1.0' })
      omniCheckMock.mockImplementation(() => {
        throw new Error('omni config check failed with exit code 1')
      })

      await main.run_index()

      expect(omniCheckMock).toHaveBeenCalled()
      expect(omniUpMock).not.toHaveBeenCalled()
    })
  })

  describe('version-specific behavior', () => {
    it('disables auto-bootstrap for version < 0.0.24', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks({ version: '0.0.23' })

      await main.run_index()

      expect(disableOmniAutoBootstrapUserMock).toHaveBeenCalled()
      expect(omniReshimMock).not.toHaveBeenCalled()
    })

    it('disables auto-bootstrap for version == 0.0.24', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks({ version: '0.0.24' })

      await main.run_index()

      expect(disableOmniAutoBootstrapUserMock).toHaveBeenCalled()
      expect(omniReshimMock).toHaveBeenCalledTimes(1)
    })

    it('skips auto-bootstrap disable for version > 0.0.24', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      setupMocks({ version: '0.0.25' })

      await main.run_index()

      expect(disableOmniAutoBootstrapUserMock).not.toHaveBeenCalled()
      expect(omniReshimMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('post-action', () => {
    it('saves cache successfully', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      saveCacheMock.mockResolvedValue()

      await main.run_post()

      expect(saveCacheMock).toHaveBeenCalledTimes(1)
      expect(setFailedMock).not.toHaveBeenCalled()
    })

    it('handles save cache error', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      saveCacheMock.mockRejectedValue(new Error('Failed to save cache'))

      await main.run_post()

      expect(setFailedMock).toHaveBeenCalledWith('Failed to save cache')
    })

    it('throws non-Error objects', async () => {
      setInputValues(getInputMock, getBooleanInputMock, {})
      saveCacheMock.mockRejectedValue('Failed to save cache')

      await expect(main.run_post()).rejects.toEqual('Failed to save cache')
      expect(setFailedMock).not.toHaveBeenCalled()
    })
  })
})
