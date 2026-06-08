declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
  }
}

export async function ipc<T>(channel: string, ...args: unknown[]): Promise<T> {
  return window.electronAPI.invoke(channel, ...args) as Promise<T>
}
