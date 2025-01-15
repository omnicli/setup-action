import * as actionsCore from '@actions/core'
import * as actionsExec from '@actions/exec'

// @ts-expect-error There is no declaration file for this package
import { parse } from 'shell-quote'

import { writeFile } from './utils'

interface ExecOutput {
  returnCode: number
  stdout: string
  stderr: string
}

const omni = async (args: string[]): Promise<number> =>
  actionsCore.group(`Running omni ${args.join(' ')}`, async () => {
    // Run the command and throw an error if it fails
    let exit_code = await actionsExec.exec('omni', args)
    if (exit_code !== 0) {
      throw new Error(
        `omni ${args.join(' ')} failed with exit code ${exit_code}`
      )
    }
    return exit_code
  })

const omniOutput = async (args: string[]): Promise<ExecOutput> =>
  actionsCore.group(
    `Running omni ${args.join(' ')} (grab output)`,
    async () => {
      let stdout = ''
      let stderr = ''
      const returnCode: number = await actionsExec.exec('omni', args, {
        listeners: {
          stdout: (data: Buffer) => {
            stdout += data.toString()
          },
          stderr: (data: Buffer) => {
            stderr += data.toString()
          }
        }
      })
      return { returnCode, stdout, stderr }
    }
  )

export async function omniUp(trusted: boolean): Promise<number> {
  const up_args = parse(actionsCore.getInput('up_args').trim())

  let has_bootstrap_arg = false
  let has_clone_suggested_arg = false
  let has_update_user_config_arg = false
  for (const arg of up_args) {
    switch (arg) {
      case '--bootstrap':
        has_bootstrap_arg = true
        break
      case '--clone-suggested':
        has_clone_suggested_arg = true
        break
      case '--update-user-config':
        has_update_user_config_arg = true
        break
      default:
        break
    }
  }

  if (!has_bootstrap_arg) {
    if (!has_clone_suggested_arg) {
      up_args.push(...['--clone-suggested', 'no'])
    }
    if (!has_update_user_config_arg) {
      up_args.push(...['--update-user-config', 'no'])
    }
  }

  if (!trusted) {
    up_args.push(...['--trust', 'always'])
  }

  return omni(['up', ...up_args])
}

export async function omniVersion(): Promise<string> {
  const output = await omniOutput(['--version'])
  if (output.returnCode !== 0) {
    throw new Error(
      `Failed to get omni version (${output.returnCode}): ${output.stderr}`
    )
  }

  // Version will be in the format "omni version x.y.z", let's use a regex
  // to extract the version number
  const match = output.stdout.match(/\d+\.\d+\.\d+/)
  if (!match) {
    throw new Error(`Failed to parse omni version: ${output.stdout}`)
  }

  return match[0]
}

export interface OmniEnvOperation {
  operation: 'export' | 'unset'
  key: string
  value?: string
}

export async function omniHookEnv(): Promise<OmniEnvOperation[]> {
  const output = await omniOutput(['hook', 'env', 'bash'])
  if (output.returnCode !== 0) {
    throw new Error(
      `Failed to get omni hook env (${output.returnCode}): ${output.stderr}`
    )
  }

  const env: OmniEnvOperation[] = []
  for (const line of output.stdout.split('\n')) {
    // Skip empty line
    if (line === '') {
      continue
    }

    // Try to parse the line as an export operation
    const exportOp = line.match(/^export (\S+)=(['"])?(.*)\2$/)
    if (exportOp) {
      const [, key, , value] = exportOp
      env.push({ operation: 'export', key, value })
      continue
    }

    // Try to parse the line as an unset operation
    const unsetOp = line.match(/^unset (\S+)$/)
    if (unsetOp) {
      const [, key] = unsetOp
      env.push({ operation: 'unset', key })
      continue
    }

    // Show warning if line could not be parsed
    actionsCore.warning(`Failed to parse line: ${line}`)
  }

  return env
}

export const omniTrust = async (): Promise<number> => omni(['config', 'trust'])

export const omniReshim = async (): Promise<number> =>
  omni(['config', 'reshim'])

export const omniCheck = async (): Promise<number> => {
  const cmdArgs = ['config', 'check', '--local']

  // Split patterns by newlines or colons and filter empty strings
  const patterns = (actionsCore.getInput('check_patterns') || '')
    .split(/[\n:]/)
    .map((p: string) => p.trim())
    .filter(Boolean)
  for (const pattern of patterns) {
    cmdArgs.push('--pattern', pattern)
  }

  // Split ignore/select by newlines or commas and filter empty strings
  const ignore = (actionsCore.getInput('check_ignore') || '')
    .split(/[\n,]/)
    .map((i: string) => i.trim())
    .filter(Boolean)
  for (const ign of ignore) {
    cmdArgs.push('--ignore', ign)
  }

  const select = (actionsCore.getInput('check_select') || '')
    .split(/[\n,]/)
    .map((s: string) => s.trim())
    .filter(Boolean)
  for (const sel of select) {
    cmdArgs.push('--select', sel)
  }

  return omni(cmdArgs)
}

export async function disableOmniAutoBootstrapUser(): Promise<void> {
  await writeFile(
    `${process.env.HOME}/.config/omni/config.yaml`,
    'up_command:\n  auto_bootstrap: false\n'
  )
}
