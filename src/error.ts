export class ExecContextError extends Error {
  stdout: string
  stderr: string
  command?: string
  originalMessage: string
  returnCode?: number

  constructor(
    message: string,
    stdout: string,
    stderr: string,
    command?: string,
    returnCode?: number
  ) {
    super(message)
    this.name = 'ExecContextError'
    this.originalMessage = message
    this.stdout = stdout
    this.stderr = stderr
    this.command = command
    this.returnCode = returnCode

    // Override message property to include command and stderr detail
    const detail = this.getDetail()
    if (command) {
      this.message = `${command}: ${detail}`
    } else {
      this.message = detail
    }
  }

  private getDetail(): string {
    // Try to get the last line of stderr
    const stderrTrimmed = this.stderr.trim()
    if (stderrTrimmed) {
      const stderrLines = stderrTrimmed.split('\n')
      const lastLine = stderrLines[stderrLines.length - 1]
      if (lastLine) {
        return lastLine
      }
    }
    // Fall back to original message
    return this.originalMessage
  }

  toString(): string {
    return this.message
  }
}

export class ExecContext {
  command: string
  stdout: string
  stderr: string

  constructor(command: string) {
    this.command = command
    this.stdout = ''
    this.stderr = ''
  }

  listeners(): {
    stdout: (data: Buffer) => void
    stderr: (data: Buffer) => void
  } {
    return {
      stdout: (data: Buffer) => {
        this.stdout += data.toString()
      },
      stderr: (data: Buffer) => {
        this.stderr += data.toString()
      }
    }
  }

  setReturnCode(returnCode: number): void {
    if (returnCode !== 0) {
      throw new ExecContextError(
        `Process exited with code ${returnCode}`,
        this.stdout,
        this.stderr,
        this.command,
        returnCode
      )
    }
  }

  throwWithError(error: unknown): never {
    if (error instanceof ExecContextError) {
      throw error
    }
    const originalMessage =
      error instanceof Error ? error.message : String(error)
    throw new ExecContextError(
      originalMessage,
      this.stdout,
      this.stderr,
      this.command
    )
  }
}
