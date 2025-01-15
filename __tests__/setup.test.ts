/**
 * Unit tests for setup functionality, src/setup.ts
 */

import * as actionsCore from '@actions/core'
import * as toolCache from '@actions/tool-cache'

import * as setup from '../src/setup'
import * as utils from '../src/utils'

// Mock external modules
jest.mock('@actions/tool-cache')
jest.mock('@actions/core')
jest.mock('../src/utils')

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('setup.ts', () => {
  let getInputMock: jest.SpiedFunction<typeof actionsCore.getInput>
  let addPathMock: jest.SpiedFunction<typeof actionsCore.addPath>
  let exportVariableMock: jest.SpiedFunction<typeof actionsCore.exportVariable>
  let setOutputMock: jest.SpiedFunction<typeof actionsCore.setOutput>
  let downloadToolMock: jest.SpiedFunction<typeof toolCache.downloadTool>
  let extractTarMock: jest.SpiedFunction<typeof toolCache.extractTar>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let getCurrentPlatformMock: jest.SpiedFunction<
    typeof utils.getCurrentPlatform
  >
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let getCurrentArchMock: jest.SpiedFunction<typeof utils.getCurrentArch>
  let parseVersionMock: jest.SpiedFunction<typeof utils.parseVersion>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock core functions
    getInputMock = jest.spyOn(actionsCore, 'getInput').mockImplementation()
    addPathMock = jest.spyOn(actionsCore, 'addPath').mockImplementation()
    exportVariableMock = jest
      .spyOn(actionsCore, 'exportVariable')
      .mockImplementation()
    setOutputMock = jest.spyOn(actionsCore, 'setOutput').mockImplementation()

    // Mock tool-cache functions
    downloadToolMock = jest
      .spyOn(toolCache, 'downloadTool')
      .mockResolvedValue('/path/to/download')
    extractTarMock = jest
      .spyOn(toolCache, 'extractTar')
      .mockResolvedValue('/path/to/extract')

    // Mock utils functions
    getCurrentPlatformMock = jest
      .spyOn(utils, 'getCurrentPlatform')
      .mockReturnValue('darwin')
    getCurrentArchMock = jest
      .spyOn(utils, 'getCurrentArch')
      .mockReturnValue('x86_64')
    parseVersionMock = jest
      .spyOn(utils, 'parseVersion')
      .mockReturnValue('v1.2.3')

    // Reset process.env
    process.env = {}
  })

  describe('setup', () => {
    beforeEach(() => {
      // Mock successful GitHub API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          Promise.resolve([
            {
              tag_name: 'v1.2.3',
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: 'omni-darwin-x86_64.tar.gz',
                  browser_download_url: 'https://example.com/download.tar.gz',
                  size: 1024 * 1024 // 1MB
                }
              ]
            }
          ])
      })

      // Default input version to latest
      getInputMock.mockImplementation((name: string) => {
        if (name === 'version') return 'latest'
        if (name === 'github_token') return 'mock-token'
        throw new Error(`Unexpected input: ${name}`)
      })
    })

    it('successfully sets up omni with latest version', async () => {
      await setup.setup()

      // Verify GitHub API call
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/XaF/omni/releases',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token mock-token'
          })
        })
      )

      // Verify download and extraction
      expect(downloadToolMock).toHaveBeenCalledWith(
        'https://example.com/download.tar.gz'
      )
      expect(extractTarMock).toHaveBeenCalledWith('/path/to/download')

      // Verify environment setup
      expect(addPathMock).toHaveBeenCalledWith('/path/to/extract')
      expect(exportVariableMock).toHaveBeenCalledWith(
        'OMNI_NONINTERACTIVE',
        '1'
      )
      expect(setOutputMock).toHaveBeenCalledWith('version', '1.2.3')
    })

    it('successfully sets up omni with specific version', async () => {
      getInputMock.mockImplementation((name: string) => {
        if (name === 'version') return '1.2.3'
        if (name === 'github_token') return 'mock-token'
        throw new Error(`Unexpected input: ${name}`)
      })

      await setup.setup()

      expect(parseVersionMock).toHaveBeenCalledWith('1.2.3')
      expect(setOutputMock).toHaveBeenCalledWith('version', '1.2.3')
    })

    it('handles missing GitHub token', async () => {
      getInputMock.mockImplementation((name: string) => {
        if (name === 'version') return 'latest'
        if (name === 'github_token') return ''
        throw new Error(`Unexpected input: ${name}`)
      })

      await setup.setup()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/XaF/omni/releases',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String)
          })
        })
      )
    })

    it('throws error when release not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => Promise.resolve([])
      })

      await expect(setup.setup()).rejects.toThrow(
        "Release not found for 'v1.2.3', platform 'darwin' and architecture 'x86_64'"
      )
    })

    it('throws error when asset not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          Promise.resolve([
            {
              tag_name: 'v1.2.3',
              draft: false,
              prerelease: false,
              assets: []
            }
          ])
      })

      await expect(setup.setup()).rejects.toThrow(
        "Release not found for 'v1.2.3', platform 'darwin' and architecture 'x86_64'"
      )
    })

    it('throws error on GitHub API failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      })

      await expect(setup.setup()).rejects.toThrow(
        'Failed to fetch releases: Not Found'
      )
    })

    it('ignores draft releases', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          Promise.resolve([
            {
              tag_name: 'v1.2.3',
              draft: true,
              prerelease: false,
              assets: [
                {
                  name: 'omni-darwin-x86_64.tar.gz',
                  browser_download_url: 'https://example.com/download.tar.gz',
                  size: 1024 * 1024
                }
              ]
            }
          ])
      })

      await expect(setup.setup()).rejects.toThrow(
        "Release not found for 'v1.2.3', platform 'darwin' and architecture 'x86_64'"
      )
    })

    it('ignores prerelease versions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          Promise.resolve([
            {
              tag_name: 'v1.2.3',
              draft: false,
              prerelease: true,
              assets: [
                {
                  name: 'omni-darwin-x86_64.tar.gz',
                  browser_download_url: 'https://example.com/download.tar.gz',
                  size: 1024 * 1024
                }
              ]
            }
          ])
      })

      await expect(setup.setup()).rejects.toThrow(
        "Release not found for 'v1.2.3', platform 'darwin' and architecture 'x86_64'"
      )
    })

    it('ignores assets with invalid size', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () =>
          Promise.resolve([
            {
              tag_name: 'v1.2.3',
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: 'omni-darwin-x86_64.tar.gz',
                  browser_download_url: 'https://example.com/download.tar.gz',
                  size: 512 // Less than 1KB
                }
              ]
            }
          ])
      })

      await expect(setup.setup()).rejects.toThrow(
        "Release not found for 'v1.2.3', platform 'darwin' and architecture 'x86_64'"
      )
    })

    it('uses environment token if available', async () => {
      process.env.GITHUB_TOKEN = 'env-token'
      getInputMock.mockImplementation((name: string) => {
        if (name === 'version') return 'latest'
        if (name === 'github_token') return ''
        throw new Error(`Unexpected input: ${name}`)
      })

      await setup.setup()

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/XaF/omni/releases',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'token env-token'
          })
        })
      )
    })

    describe('file extraction', () => {
      let extractZipMock: jest.SpiedFunction<typeof toolCache.extractZip>

      beforeEach(() => {
        extractZipMock = jest
          .spyOn(toolCache, 'extractZip')
          .mockResolvedValue('/path/to/extract')
      })

      it('uses extractZip for .zip files', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () =>
            Promise.resolve([
              {
                tag_name: 'v1.2.3',
                draft: false,
                prerelease: false,
                assets: [
                  {
                    name: 'omni-v1.2.3-darwin-x86_64.zip',
                    browser_download_url: 'https://example.com/download.zip',
                    size: 1024 * 1024
                  }
                ]
              }
            ])
        })

        await setup.setup()

        expect(extractZipMock).toHaveBeenCalledWith('/path/to/download')
        expect(extractTarMock).not.toHaveBeenCalled()
      })

      it('uses extractTar for .tar.gz files', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () =>
            Promise.resolve([
              {
                tag_name: 'v1.2.3',
                draft: false,
                prerelease: false,
                assets: [
                  {
                    name: 'omni-v1.2.3-darwin-x86_64.tar.gz',
                    browser_download_url: 'https://example.com/download.tar.gz',
                    size: 1024 * 1024
                  }
                ]
              }
            ])
        })

        await setup.setup()

        expect(extractTarMock).toHaveBeenCalledWith('/path/to/download')
        expect(extractZipMock).not.toHaveBeenCalled()
      })

      it('uses correct extractor based on download URL', async () => {
        // Test both types in sequence to ensure the selection logic works properly
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: async () =>
              Promise.resolve([
                {
                  tag_name: 'v1.2.3',
                  draft: false,
                  prerelease: false,
                  assets: [
                    {
                      name: 'omni-v1.2.3-darwin-x86_64.zip',
                      browser_download_url: 'https://example.com/archive.zip',
                      size: 1024 * 1024
                    }
                  ]
                }
              ])
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () =>
              Promise.resolve([
                {
                  tag_name: 'v1.2.3',
                  draft: false,
                  prerelease: false,
                  assets: [
                    {
                      name: 'omni-v1.2.3-darwin-x86_64.tar.gz',
                      browser_download_url:
                        'https://example.com/archive.tar.gz',
                      size: 1024 * 1024
                    }
                  ]
                }
              ])
          })

        // Test zip extraction
        await setup.setup()
        expect(extractZipMock).toHaveBeenCalledWith('/path/to/download')
        expect(extractTarMock).not.toHaveBeenCalled()

        // Reset mocks for second test
        jest.clearAllMocks()

        // Test tar extraction
        await setup.setup()
        expect(extractTarMock).toHaveBeenCalledWith('/path/to/download')
        expect(extractZipMock).not.toHaveBeenCalled()
      })
    })
  })
})
