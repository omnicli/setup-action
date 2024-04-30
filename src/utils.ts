import * as fs from 'fs'
import * as os from 'os'

import * as actionsCore from '@actions/core'

export function parseVersion(version: string): string {
  const matchDetails = version.match(/^[v]?(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/)
  if (matchDetails) {
    const versions = []
    for (let i = 1; i < 4; i++) {
      if (matchDetails[i]) {
        versions.push(matchDetails[i])
      }
    }
    if (!matchDetails[3]) {
      versions.push('') // Add empty string so we only accept versions that properly match the passed version
    }
    return `v${versions.join('.')}`
  }
  if (version === 'latest' || version === '') {
    return 'v'
  }
  throw new Error(`Invalid version: '${version}'`)
}

export function printVersion(version: string): string {
  if (version.startsWith('v')) {
    version = version.slice(1)
  }
  if (version.endsWith('.')) {
    version = version.slice(0, -1)
  }
  return version === '' ? 'latest' : version
}

export function getCurrentArch(): string {
  const arch = os.arch()
  switch (arch) {
    case 'arm64':
      return 'arm64'
    case 'x64':
      return 'x86_64'
    default:
      throw new Error(`Unsupported architecture: '${arch}'`)
  }
}

export function getCurrentPlatform(): string {
  const platform = os.platform()
  switch (platform) {
    case 'darwin':
      return 'darwin'
    case 'linux':
      return 'linux'
    default:
      throw new Error(`Unsupported platform: '${platform}'`)
  }
}

export async function writeFile(
  file: fs.PathLike,
  contents: string
): Promise<void> {
  actionsCore.group(`Writing file: ${file}`, async () => {
    // Make sure the directory exists
    const dir = file.toString().split('/').slice(0, -1).join('/')
    if (dir.length > 0 && !fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }

    actionsCore.info(`Contents:\n\n${contents}`)
    await fs.promises.writeFile(file, contents, { encoding: 'utf8' })
  })
}
