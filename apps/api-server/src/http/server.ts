import { Context } from '@deepseek-ai/cordis'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { err, ErrorCode } from '../types.ts'
import type { SolveResponse } from '../types.ts'

export interface HttpServerConfig {
  port: number
  host?: string
  /** 单请求体上限（默认 8MB） */
  maxPayloadBytes?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    httpServer: {
      port: number
      host: string
      close(): Promise<void>
    }
    /** 路由事件：HTTP 层收到请求后广播，监听器匹配 method+path 并 reply */
    'http/route': (method: string, pathname: string, body: unknown, reply: (r: SolveResponse) => void) => void
  }
}

export default function httpServer(ctx: Context, config: HttpServerConfig) {
  const port = config.port ?? 8080
  const host = config.host ?? '0.0.0.0'
  const maxPayload = config.maxPayloadBytes ?? 8 * 1024 * 1024

  const readBody = (req: IncomingMessage): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > maxPayload) {
          reject(new Error('payload too large'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        if (chunks.length === 0) return resolve(null)
        const raw = Buffer.concat(chunks).toString('utf-8')
        try {
          resolve(JSON.parse(raw))
        } catch {
          reject(new Error('invalid json'))
        }
      })
      req.on('error', reject)
    })

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const reply = (r: SolveResponse) => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(r))
    }
    try {
      if (url.pathname === '/healthz') {
        reply(ok())
        return
      }
      const body = await readBody(req)
      ctx.emit('http/route', req.method ?? 'GET', url.pathname, body, reply)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      ctx.logger.warn(`request failed: ${msg}`)
      if (!res.headersSent) {
        reply(err(ErrorCode.PARAM_ERROR, `参数错误: ${msg}`))
      } else {
        res.destroy()
      }
    }
  })

  ctx.effect(() => {
    server.listen(port, host)
    ctx.logger.info(`http server listening on ${host}:${port}`)
    return () => {
      server.close()
    }
  })

  ctx.provide('httpServer', {
    port,
    host,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  })
}

function ok(): SolveResponse {
  return { code: 10000, msg: 'ok' }
}
