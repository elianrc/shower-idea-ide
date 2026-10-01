import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'

export interface ProcessResult {
  code: number
  stdout: string
  stderr: string
}

interface RunOptions {
  cwd: string
  env?: NodeJS.ProcessEnv
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
  processId?: string
}

export class ProcessManager {
  private readonly running = new Map<string, ReturnType<typeof spawn>>()

  run(command: string, args: string[], options: RunOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      if (options.processId) this.running.set(options.processId, child)

      let stdout = ''
      let stderr = ''
      this.consume(child.stdout, (chunk) => {
        stdout += `${chunk}\n`
        options.onStdout?.(chunk)
      })
      this.consume(child.stderr, (chunk) => {
        stderr += `${chunk}\n`
        options.onStderr?.(chunk)
      })

      child.once('error', (error) => {
        if (options.processId) this.running.delete(options.processId)
        reject(error)
      })
      child.once('close', (code) => {
        if (options.processId) this.running.delete(options.processId)
        resolve({ code: code ?? 1, stdout, stderr })
      })
    })
  }

  runShell(command: string, cwd: string, processId?: string): Promise<ProcessResult> {
    const shell = process.env.SHELL || '/bin/zsh'
    return this.run(shell, ['-lc', command], { cwd, processId })
  }

  cancel(processId: string): boolean {
    const child = this.running.get(processId)
    if (!child) return false
    child.kill('SIGTERM')
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }, 2_500).unref()
    return true
  }

  private consume(
    stream: NodeJS.ReadableStream,
    onLine: (line: string) => void,
  ): void {
    const decoder = new StringDecoder('utf8')
    let pending = ''
    stream.on('data', (buffer: Buffer) => {
      pending += decoder.write(buffer)
      const lines = pending.split(/\r?\n/)
      pending = lines.pop() ?? ''
      for (const line of lines) onLine(line)
    })
    stream.on('end', () => {
      pending += decoder.end()
      if (pending) onLine(pending)
    })
  }
}
