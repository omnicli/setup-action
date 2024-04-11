import * as actionsCore from '@actions/core'
import * as actionsExec from '@actions/exec'

// @ts-expect-error There is no declaration file for this package
import { parse } from 'shell-quote'

interface ExecOutput {
  returnCode: number
  stdout: string
  stderr: string
}

const omni = async (args: string[]): Promise<number> =>
  actionsCore.group(`Running omni ${args.join(' ')}`, async () => {
    return actionsExec.exec('omni', args)
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

export async function omniUp(): Promise<number> {
  const up_args = parse(actionsCore.getInput('up_args').trim())
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
    const exportOp = line.match(/^export (\S+)=(['"])(.*)\2$/)
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

export const omniReshim = async (): Promise<number> => omni(['config', 'reshim'])
