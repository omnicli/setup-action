/**
 * Unit tests for the action's main functionality, src/main.ts
 *
 * These should be run as if the action was called from a workflow.
 * Specifically, the inputs listed in `action.yml` should be set as environment
 * variables following the pattern `INPUT_<INPUT_NAME>`.
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

// Mock the main functions
const runIndexMock = jest.spyOn(main, 'run_index')
const runPostMock = jest.spyOn(main, 'run_post')

// Mock the omni functions
const omniVersionMock = jest.spyOn(omni, 'omniVersion')
const omniUpMock = jest.spyOn(omni, 'omniUp')
const omniReshimMock = jest.spyOn(omni, 'omniReshim')

// Mock the setup functions
const setupMock = jest.spyOn(setup, 'setup')

// Mock the GitHub Actions core library
// let debugMock: jest.SpiedFunction<typeof actionsCore.debug>
// let errorMock: jest.SpiedFunction<typeof actionsCore.error>
let getInputMock: jest.SpiedFunction<typeof actionsCore.getInput>
let getBooleanInputMock: jest.SpiedFunction<typeof actionsCore.getBooleanInput>
let setFailedMock: jest.SpiedFunction<typeof actionsCore.setFailed>
// let setOutputMock: jest.SpiedFunction<typeof actionsCore.setOutput>

function setInputValues(
  getInput: jest.SpiedFunction<typeof actionsCore.getInput>,
  getBooleanInput: jest.SpiedFunction<typeof actionsCore.getBooleanInput>,
  overrideInputs: Record<string, string | boolean>
): void {
  const inputs: Record<string, string | boolean> = {
    cache: true,
    cache_write: true,
    cache_key_prefix: 'omni-v0',
    up: false,
    up_args: '',
    version: ''
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

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
    getBooleanInputMock = jest
      .spyOn(actionsCore, 'getBooleanInput')
      .mockImplementation()
    setFailedMock = jest.spyOn(actionsCore, 'setFailed').mockImplementation()
  })

  it('runs the action with default inputs', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('0.0.23')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).not.toHaveBeenCalled()
    expect(omniReshimMock).not.toHaveBeenCalled()
    expect(setEnvMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('runs the action with cache disabled', async () => {
    setInputValues(getInputMock, getBooleanInputMock, { cache: false })

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('0.0.23')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).not.toHaveBeenCalled()
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).not.toHaveBeenCalled()
    expect(omniReshimMock).not.toHaveBeenCalled()
    expect(setEnvMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('runs the action with up', async () => {
    setInputValues(getInputMock, getBooleanInputMock, { up: true })

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('0.0.23')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).toHaveBeenCalledTimes(1)
    expect(omniReshimMock).not.toHaveBeenCalled()
    expect(setEnvMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('runs with reshim if version == 0.0.24', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('0.0.24')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).not.toHaveBeenCalled()
    expect(omniReshimMock).toHaveBeenCalledTimes(1)
    expect(setEnvMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('runs with reshim if version > 0.0.24', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('1.0.0')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).not.toHaveBeenCalled()
    expect(omniReshimMock).toHaveBeenCalledTimes(1)
    expect(setEnvMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('fails if omniVersion returns an invalid version', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('invalid')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_index()
    expect(runIndexMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(restoreCacheMock).toHaveBeenCalledTimes(1)
    expect(setupMock).toHaveBeenCalledTimes(1)
    expect(omniVersionMock).toHaveBeenCalledTimes(1)
    expect(omniUpMock).not.toHaveBeenCalled()
    expect(omniReshimMock).not.toHaveBeenCalled()
    expect(setEnvMock).not.toHaveBeenCalled()

    // Verify that the action failed
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Invalid version: invalid')
  })
})

describe('post-action', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
    getBooleanInputMock = jest
      .spyOn(actionsCore, 'getBooleanInput')
      .mockImplementation()
    setFailedMock = jest.spyOn(actionsCore, 'setFailed').mockImplementation()
  })

  it('runs the action with default inputs', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    restoreCacheMock.mockResolvedValue()
    setupMock.mockResolvedValue()
    omniVersionMock.mockResolvedValue('0.0.23')
    omniUpMock.mockResolvedValue(0)
    omniReshimMock.mockResolvedValue(0)
    setEnvMock.mockResolvedValue()

    await main.run_post()
    expect(runPostMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(saveCacheMock).toHaveBeenCalledTimes(1)

    // Expect the action to have succeeded
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('fails if saveCache throws an error', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    saveCacheMock.mockRejectedValue(new Error('Failed to save cache'))

    await main.run_post()
    expect(runPostMock).toHaveReturned()

    // Verify that all of the expected functions have been called
    expect(saveCacheMock).toHaveBeenCalledTimes(1)

    // Verify that the action failed
    expect(setFailedMock).toHaveBeenNthCalledWith(1, 'Failed to save cache')
  })

  it('throws if saveCache throws a non-Error', async () => {
    setInputValues(getInputMock, getBooleanInputMock, {})

    saveCacheMock.mockRejectedValue('Failed to save cache')

    await expect(main.run_post()).rejects.toEqual('Failed to save cache')

    // Verify that all of the expected functions have been called
    expect(saveCacheMock).toHaveBeenCalledTimes(1)

    // Verify that the action failed
    expect(setFailedMock).not.toHaveBeenCalled()
  })
})
