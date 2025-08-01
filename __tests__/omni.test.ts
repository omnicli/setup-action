/**
 * Unit tests for the omni commands, src/omni.ts
 */

import * as actionsCore from '@actions/core'
import * as actionsExec from '@actions/exec'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as fs from 'fs'

import * as omni from '../src/omni'
import * as utils from '../src/utils'

// Mock the GitHub Actions core library
let getInputMock: jest.SpiedFunction<typeof actionsCore.getInput>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let setFailedMock: jest.SpiedFunction<typeof actionsCore.setFailed>

// Mock the GitHub Actions exec library
let execMock: jest.SpiedFunction<typeof actionsExec.exec>

// Mock utils
const writeFileMock = jest.spyOn(utils, 'writeFile')

describe('omni.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
    setFailedMock = jest.spyOn(actionsCore, 'setFailed').mockImplementation()
    execMock = jest.spyOn(actionsExec, 'exec').mockImplementation()
  })

  describe('omniVersion', () => {
    it('returns version from omni --version output', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('omni version 1.2.3\n'))
        }
        return 0
      })

      const version = await omni.omniVersion()
      expect(version).toBe('1.2.3')
      expect(execMock).toHaveBeenCalledWith(
        'omni',
        ['--version'],
        expect.any(Object)
      )
    })

    it('throws error on non-zero exit code', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stderr) {
          options.listeners.stderr(Buffer.from('command not found\n'))
        }
        return 1
      })

      await expect(omni.omniVersion()).rejects.toThrow(
        'Failed to get omni version (1)'
      )
    })

    it('throws error on unparseable version', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(Buffer.from('invalid version format\n'))
        }
        return 0
      })

      await expect(omni.omniVersion()).rejects.toThrow(
        'Failed to parse omni version'
      )
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniVersion()).rejects.toThrow('failed')
    })
  })

  describe('omniUp', () => {
    beforeEach(() => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --bar'
        if (name === 'up_retries') return '0'
        if (name === 'up_retry_delay') return '1000'
        if (name === 'up_retry_jitter') return '10'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })
    })

    it('runs omni up with trusted=true', async () => {
      execMock.mockResolvedValue(0)
      await omni.omniUp(true)

      expect(execMock).toHaveBeenCalledWith('omni', [
        'up',
        '--foo',
        '--bar',
        '--clone-suggested',
        'no',
        '--update-user-config',
        'no'
      ])
    })

    it('runs omni up with trusted=false', async () => {
      execMock.mockResolvedValue(0)
      await omni.omniUp(false)

      expect(execMock).toHaveBeenCalledWith('omni', [
        'up',
        '--foo',
        '--bar',
        '--clone-suggested',
        'no',
        '--update-user-config',
        'no',
        '--trust',
        'always'
      ])
    })

    it('preserves bootstrap flags when provided', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--bootstrap --foo'
        if (name === 'up_retries') return '0'
        if (name === 'up_retry_delay') return '1000'
        if (name === 'up_retry_jitter') return '10'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      execMock.mockResolvedValue(0)
      await omni.omniUp(true)

      expect(execMock).toHaveBeenCalledWith('omni', [
        'up',
        '--bootstrap',
        '--foo'
      ])
    })

    it('preserves --clone-suggested when provided', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --clone-suggested yes --bar'
        if (name === 'up_retries') return '0'
        if (name === 'up_retry_delay') return '1000'
        if (name === 'up_retry_jitter') return '10'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      execMock.mockResolvedValue(0)
      await omni.omniUp(true)

      // Should not add another --clone-suggested flag since it's already present
      expect(execMock).toHaveBeenCalledWith('omni', [
        'up',
        '--foo',
        '--clone-suggested',
        'yes',
        '--bar',
        '--update-user-config',
        'no'
      ])
    })

    it('preserves --update-user-config when provided', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --update-user-config yes --bar'
        if (name === 'up_retries') return '0'
        if (name === 'up_retry_delay') return '1000'
        if (name === 'up_retry_jitter') return '10'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      execMock.mockResolvedValue(0)
      await omni.omniUp(true)

      // Should not add another --update-user-config flag since it's already present
      expect(execMock).toHaveBeenCalledWith('omni', [
        'up',
        '--foo',
        '--update-user-config',
        'yes',
        '--bar',
        '--clone-suggested',
        'no'
      ])
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniUp(true)).rejects.toThrow('failed')
    })

    it('retries when configured and command fails', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --bar'
        if (name === 'up_retries') return '2'
        if (name === 'up_retry_delay') return '100'
        if (name === 'up_retry_jitter') return '0'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      let callCount = 0
      execMock.mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          return 1 // Fail first two times
        }
        return 0 // Succeed on third try
      })

      const result = await omni.omniUp(true)
      expect(result).toBe(0)
      expect(execMock).toHaveBeenCalledTimes(3)
    })

    it('does not retry when retries is 0', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --bar'
        if (name === 'up_retries') return '0'
        if (name === 'up_retry_delay') return '1000'
        if (name === 'up_retry_jitter') return '10'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      execMock.mockResolvedValue(1)
      const result = await omni.omniUp(true)

      expect(result).toBe(1)
      expect(execMock).toHaveBeenCalledTimes(1)
    })

    it('returns failure exit code after all retries exhausted', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'up_args') return '--foo --bar'
        if (name === 'up_retries') return '2'
        if (name === 'up_retry_delay') return '100'
        if (name === 'up_retry_jitter') return '0'
        if (name === 'up_retry_backoff') return '1'
        throw new Error(`Unexpected input: ${name}`)
      })

      execMock.mockResolvedValue(1) // Always fail

      const result = await omni.omniUp(true)
      expect(result).toBe(1)
      expect(execMock).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })
  })

  describe('omniCheck', () => {
    beforeEach(() => {
      execMock.mockResolvedValue(0)
    })

    it('runs omni config check with no options', async () => {
      await omni.omniCheck()

      expect(execMock).toHaveBeenCalledWith('omni', [
        'config',
        'check',
        '--local'
      ])
    })

    it('runs with patterns', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'check_patterns') return '*.sh:!test/*\ntest.sh'
        else if (name === 'check_ignore') return ''
        else if (name === 'check_select') return ''
        throw new Error(`Unexpected input: ${name}`)
      })

      await omni.omniCheck()

      expect(execMock).toHaveBeenCalledWith('omni', [
        'config',
        'check',
        '--local',
        '--pattern',
        '*.sh',
        '--pattern',
        '!test/*',
        '--pattern',
        'test.sh'
      ])
    })

    it('runs with ignore', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'check_patterns') return ''
        else if (name === 'check_ignore') return 'M,C00\nC102'
        else if (name === 'check_select') return ''
        throw new Error(`Unexpected input: ${name}`)
      })

      await omni.omniCheck()

      expect(execMock).toHaveBeenCalledWith('omni', [
        'config',
        'check',
        '--local',
        '--ignore',
        'M',
        '--ignore',
        'C00',
        '--ignore',
        'C102'
      ])
    })

    it('runs with select', async () => {
      getInputMock.mockImplementation(name => {
        if (name === 'check_patterns') return ''
        else if (name === 'check_ignore') return ''
        else if (name === 'check_select') return 'M,C00\nC102'
        throw new Error(`Unexpected input: ${name}`)
      })

      await omni.omniCheck()

      expect(execMock).toHaveBeenCalledWith('omni', [
        'config',
        'check',
        '--local',
        '--select',
        'M',
        '--select',
        'C00',
        '--select',
        'C102'
      ])
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniCheck()).rejects.toThrow('failed')
    })
  })

  describe('omniHookEnv', () => {
    it('parses export operations', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              ['export FOO=bar', 'export BAR="baz"', "export BAZ='qux'"].join(
                '\n'
              )
            )
          )
        }
        return 0
      })

      const env = await omni.omniHookEnv()
      expect(env).toEqual([
        { operation: 'export', key: 'FOO', value: 'bar' },
        { operation: 'export', key: 'BAR', value: 'baz' },
        { operation: 'export', key: 'BAZ', value: 'qux' }
      ])
    })

    it('parses unset operations', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(['unset FOO', 'unset BAR'].join('\n'))
          )
        }
        return 0
      })

      const env = await omni.omniHookEnv()
      expect(env).toEqual([
        { operation: 'unset', key: 'FOO' },
        { operation: 'unset', key: 'BAR' }
      ])
    })

    it('handles mixed operations', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              ['export FOO=bar', 'unset BAR', 'export BAZ="qux"'].join('\n')
            )
          )
        }
        return 0
      })

      const env = await omni.omniHookEnv()
      expect(env).toEqual([
        { operation: 'export', key: 'FOO', value: 'bar' },
        { operation: 'unset', key: 'BAR' },
        { operation: 'export', key: 'BAZ', value: 'qux' }
      ])
    })

    it('processes valid lines while warning on invalid ones', async () => {
      const warningMock: jest.SpiedFunction<typeof actionsCore.warning> = jest
        .spyOn(actionsCore, 'warning')
        .mockImplementation()

      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stdout) {
          options.listeners.stdout(
            Buffer.from(
              [
                'export VALID1=foo', // valid export
                'invalid line format', // invalid line
                'unset VALID2', // valid unset
                'export VALID3="bar baz"' // valid export with quotes
              ].join('\n')
            )
          )
        }
        return 0
      })

      const env = await omni.omniHookEnv()

      // Should have processed all valid lines
      expect(env).toEqual([
        { operation: 'export', key: 'VALID1', value: 'foo' },
        { operation: 'unset', key: 'VALID2' },
        { operation: 'export', key: 'VALID3', value: 'bar baz' }
      ])

      // Should have warned about the invalid line
      expect(warningMock).toHaveBeenCalledTimes(1)
      expect(warningMock).toHaveBeenCalledWith(
        'Failed to parse line: invalid line format'
      )
    })

    it('throws error on exec failure', async () => {
      execMock.mockImplementation(async (cmd, args, options) => {
        if (options?.listeners?.stderr) {
          options.listeners.stderr(Buffer.from('hook failed\n'))
        }
        return 1
      })

      await expect(omni.omniHookEnv()).rejects.toThrow(
        'Failed to get omni hook env (1)'
      )
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniHookEnv()).rejects.toThrow('failed')
    })
  })

  describe('omniTrust', () => {
    it('runs omni config trust', async () => {
      execMock.mockResolvedValue(0)
      const result = await omni.omniTrust()

      expect(result).toBe(0)
      expect(execMock).toHaveBeenCalledWith('omni', ['config', 'trust'])
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniTrust()).rejects.toThrow('failed')
    })
  })

  describe('omniReshim', () => {
    it('runs omni config reshim', async () => {
      execMock.mockResolvedValue(0)
      const result = await omni.omniReshim()

      expect(result).toBe(0)
      expect(execMock).toHaveBeenCalledWith('omni', ['config', 'reshim'])
    })

    it('handles command failure', async () => {
      execMock.mockImplementation(async () => {
        throw new Error('failed')
      })
      await expect(omni.omniReshim()).rejects.toThrow('failed')
    })
  })

  describe('disableOmniAutoBootstrapUser', () => {
    beforeEach(() => {
      process.env.HOME = '/home/user'
    })

    it('writes config to disable auto bootstrap', async () => {
      writeFileMock.mockResolvedValue(undefined)

      await omni.disableOmniAutoBootstrapUser()

      expect(writeFileMock).toHaveBeenCalledWith(
        '/home/user/.config/omni/config.yaml',
        'up_command:\n  auto_bootstrap: false\n'
      )
    })
  })
})
