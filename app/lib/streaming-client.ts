export interface StreamingClientOptions {
  onOutput?: (data: string) => void
  onError?: (error: string) => void
  onProgress?: (progress: { keyword: string; status: string }) => void
  onComplete?: (result: { success: boolean; keyword?: string; summary?: string }) => void
}

export class StreamingClient {
  private abortController: AbortController | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null

  constructor(
    private url: string,
    private body: any
  ) {}

  async connect(options: StreamingClientOptions) {
    this.abortController = new AbortController()

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.body),
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      this.reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await this.reader.read()
        
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue
          
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.slice(6))
              
              switch (eventData.type) {
                case 'output':
                  options.onOutput?.(eventData.data)
                  break
                case 'error':
                  options.onError?.(eventData.data)
                  break
                case 'progress':
                  options.onProgress?.(eventData.data)
                  break
                case 'complete':
                  options.onComplete?.(eventData.data)
                  break
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', e)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream aborted')
      } else {
        throw error
      }
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.reader) {
      this.reader.cancel()
      this.reader = null
    }
  }
}