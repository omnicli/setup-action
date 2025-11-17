/**
 * Unit tests for utility functions, src/utils.ts
 */

import * as actionsCore from '@actions/core'
import * as fs from 'fs'
import * as os from 'os'

import * as utils from '../src/utils'

// Mock external dependencies
jest.mock('os')
const osMock = jest.mocked(os)

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  promises: {
    writeFile: jest.fn(),
    mkdir: jest.fn()
  }
}))

describe('utils.ts', () => {
  describe('parseVersion', () => {
    it('parses full version numbers correctly', () => {
      expect(utils.parseVersion('1.2.3')).toBe('v1.2.3')
      expect(utils.parseVersion('v1.2.3')).toBe('v1.2.3')
    })

    it('parses partial version numbers without dots', () => {
      expect(utils.parseVersion('1')).toBe('v1.')
      expect(utils.parseVersion('1.2')).toBe('v1.2.')
    })

    // Removing test for partial versions with trailing dots as it's an invalid format

    it('handles "latest" and empty string versions', () => {
      expect(utils.parseVersion('latest')).toBe('v')
      expect(utils.parseVersion('')).toBe('v')
    })

    it('throws error for invalid versions', () => {
      expect(() => utils.parseVersion('invalid')).toThrow('Invalid version')
      expect(() => utils.parseVersion('1.2.3.4')).toThrow('Invalid version')
      expect(() => utils.parseVersion('v1.2.3.4')).toThrow('Invalid version')
      expect(() => utils.parseVersion('1.2.')).toThrow('Invalid version')
    })
  })

  describe('printVersion', () => {
    it('formats full version numbers correctly', () => {
      expect(utils.printVersion('v1.2.3')).toBe('1.2.3')
      expect(utils.printVersion('1.2.3')).toBe('1.2.3')
    })

    it('handles partial versions correctly', () => {
      expect(utils.printVersion('v1.2.')).toBe('1.2')
      expect(utils.printVersion('1.2.')).toBe('1.2')
    })

    it('handles empty version as latest', () => {
      expect(utils.printVersion('v')).toBe('latest')
      expect(utils.printVersion('')).toBe('latest')
    })
  })

  describe('getCurrentArch', () => {
    beforeEach(() => {
      jest.resetAllMocks()
    })

    it('returns arm64 for arm64 architecture', () => {
      osMock.arch.mockReturnValue('arm64')
      expect(utils.getCurrentArch()).toBe('arm64')
    })

    it('returns x86_64 for x64 architecture', () => {
      osMock.arch.mockReturnValue('x64')
      expect(utils.getCurrentArch()).toBe('x86_64')
    })

    it('throws error for unsupported architectures', () => {
      osMock.arch.mockReturnValue('ia32')
      expect(() => utils.getCurrentArch()).toThrow('Unsupported architecture')
    })
  })

  describe('getCurrentPlatform', () => {
    beforeEach(() => {
      jest.resetAllMocks()
    })

    it('returns darwin for macOS', () => {
      osMock.platform.mockReturnValue('darwin')
      expect(utils.getCurrentPlatform()).toBe('darwin')
    })

    it('returns linux for Linux', () => {
      osMock.platform.mockReturnValue('linux')
      expect(utils.getCurrentPlatform()).toBe('linux')
    })

    it('throws error for unsupported platforms', () => {
      osMock.platform.mockReturnValue('win32')
      expect(() => utils.getCurrentPlatform()).toThrow('Unsupported platform')
    })
  })

  describe('writeFile', () => {
    let groupMock: jest.SpiedFunction<typeof actionsCore.group>

    beforeEach(() => {
      jest.resetAllMocks()
      groupMock = jest
        .spyOn(actionsCore, 'group')
        .mockImplementation(async (name, fn) => fn())
    })

    it('writes file without creating directory if it exists', async () => {
      // Use the mocked fs module
      const mockedFs = jest.mocked(fs)
      mockedFs.existsSync.mockReturnValue(true)

      await utils.writeFile('existing/path/file.txt', 'content')

      expect(mockedFs.existsSync).toHaveBeenCalledWith('existing/path')
      expect(mockedFs.promises.mkdir).not.toHaveBeenCalled()
      expect(mockedFs.promises.writeFile).toHaveBeenCalledWith(
        'existing/path/file.txt',
        'content',
        { encoding: 'utf8' }
      )
    })

    it('creates directory before writing file if it does not exist', async () => {
      const mockedFs = jest.mocked(fs)
      mockedFs.existsSync.mockReturnValue(false)

      await utils.writeFile('new/path/file.txt', 'content')

      expect(mockedFs.existsSync).toHaveBeenCalledWith('new/path')
      expect(mockedFs.promises.mkdir).toHaveBeenCalledWith('new/path', {
        recursive: true
      })
      expect(mockedFs.promises.writeFile).toHaveBeenCalledWith(
        'new/path/file.txt',
        'content',
        { encoding: 'utf8' }
      )
    })

    it('handles root path files correctly', async () => {
      const mockedFs = jest.mocked(fs)

      await utils.writeFile('root.txt', 'content')

      expect(mockedFs.existsSync).not.toHaveBeenCalled() // No directory component
      expect(mockedFs.promises.mkdir).not.toHaveBeenCalled()
      expect(mockedFs.promises.writeFile).toHaveBeenCalledWith(
        'root.txt',
        'content',
        { encoding: 'utf8' }
      )
    })

    it('runs in an actions group', async () => {
      await utils.writeFile('file.txt', 'content')

      expect(groupMock).toHaveBeenCalledWith(
        'Writing file: file.txt',
        expect.any(Function)
      )
    })
  })
})
