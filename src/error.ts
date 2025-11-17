export class ContextualizedError extends Error {
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
    this.name = 'ContextualizedError'
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
