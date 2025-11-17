import * as actionsCore from '@actions/core'
import * as actionsExec from '@actions/exec'
import * as actionsGlob from '@actions/glob'
import * as fs from 'fs'
import * as path from 'path'

import { omniDataHome } from './env'

export async function hashCache(cachePaths: string[]): Promise<string> {
  actionsCore.info(`Hashing cache paths: ${cachePaths}`)

  const GITHUB_WORKSPACE = process.env.GITHUB_WORKSPACE
  try {
    // Override GITHUB_WORKSPACE to be empty so that we can hash anything
    // without having to worry about the actual workspace; this is required
    // because the function will ignore anything outside of the github workspace
    // https://github.com/actions/toolkit/blob/9ddf153e007b587270658b32cc50a457e959c02c/packages/glob/src/internal-hash-files.ts#L24
    process.env.GITHUB_WORKSPACE = ''
    const hash = await actionsGlob.hashFiles(cachePaths.join('\n'), '', {
      followSymbolicLinks: false
    })
    actionsCore.info(`Cache hash: ${hash}`)
    return hash
  } finally {
    // Reset GITHUB_WORKSPACE to its original value
    process.env.GITHUB_WORKSPACE = GITHUB_WORKSPACE
  }
}

export async function removeShims(): Promise<void> {
  const shimsPath = path.join(omniDataHome(), 'shims')
  if (!fs.existsSync(shimsPath)) return
  actionsCore.info(`Removing shims directory: ${shimsPath}`)
  await actionsExec.exec('rm', ['-rf', shimsPath])
}
