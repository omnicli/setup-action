import * as semver from 'semver'

import * as actionsCore from '@actions/core'
import * as toolCache from '@actions/tool-cache'

import type { components } from '@octokit/openapi-types'

import {
  getCurrentArch,
  getCurrentPlatform,
  parseVersion,
  printVersion
} from './utils'

type GitHubRelease = components['schemas']['release']
type GitHubReleaseAsset = components['schemas']['release-asset']

async function getReleaseUrl(
  version: string,
  platform: string,
  arch: string
): Promise<string> {
  // List releases from the GitHub API
  // https://developer.github.com/v3/repos/releases/#list-releases
  const url = `https://api.github.com/repos/XaF/omni/releases`
  actionsCore.info(`Getting releases from ${url}`)
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  // Check for a GitHub token, either through a passed environment variable
  // or through the action input (which defaults to the current context's token)
  const potentialTokens = [
    process.env.GITHUB_TOKEN,
    process.env.GH_TOKEN,
    actionsCore.getInput('github_token')
  ]
  const ghToken = potentialTokens.find(t => t !== undefined && t !== '')
  if (ghToken) {
    headers['Authorization'] = `token ${ghToken}`
  }

  const response = await fetch(url, {
    headers
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch releases: ${response.statusText}`)
  }

  const releases = await response.json()
  const release = releases.find(
    (r: GitHubRelease) =>
      // Release version should match the version passed by the user
      r.tag_name.startsWith(version) &&
      // Release should not be a draft
      r.draft === false &&
      // Release should not be a prerelease
      r.prerelease === false &&
      // Release should have assets
      r.assets.length > 0 &&
      // Release should have an asset for the platform and architecture
      r.assets.some(
        (a: GitHubReleaseAsset) =>
          // Asset should be for the platform
          a.name.includes(platform) &&
          // Asset should be for the architecture
          a.name.includes(arch) &&
          // Asset should have a size greater than 1 kilobyte
          a.size > 1024
      )
  )
  if (!release) {
    throw new Error(
      `Release not found for '${version}', platform '${platform}' and architecture '${arch}'`
    )
  }
  actionsCore.info(`Found release: ${release.tag_name}`)

  const asset = release.assets.find(
    (a: GitHubReleaseAsset) =>
      // Asset should be a .tar.gz or .zip file
      (a.name.endsWith('.tar.gz') || a.name.endsWith('.zip')) &&
      // Asset should be for the platform
      a.name.includes(platform) &&
      // Asset should be for the architecture
      a.name.includes(arch) &&
      // Asset should have a size greater than 1 kilobyte
      a.size > 1024
  )
  if (!asset) {
    throw new Error(
      `Asset not found for platform '${platform}' and architecture '${arch}'`
    )
  }
  actionsCore.info(`Found asset: ${asset.name}`)

  const releaseVersion = semver.clean(release.tag_name)
  actionsCore.setOutput('version', releaseVersion)

  return asset.browser_download_url
}

export async function setup(): Promise<void> {
  // Get version of tool to be installed
  const version = parseVersion(actionsCore.getInput('version'))
  actionsCore.startGroup(`Setup omni@${printVersion(version)}`)

  const platform = getCurrentPlatform()
  const arch = getCurrentArch()

  // Download the specific version of the tool
  const releaseUrl = await getReleaseUrl(version, platform, arch)
  const pathToTarball = await toolCache.downloadTool(releaseUrl)

  // Extract the tarball/zipball onto host runner
  const extract = releaseUrl.endsWith('.zip')
    ? toolCache.extractZip
    : toolCache.extractTar
  const pathToCLI = await extract(pathToTarball)

  // Expose the tool by adding it to the PATH
  actionsCore.addPath(pathToCLI)

  // Add an environment variable to indicate we're in non-interactive mode
  actionsCore.exportVariable('OMNI_NONINTERACTIVE', '1')
}
