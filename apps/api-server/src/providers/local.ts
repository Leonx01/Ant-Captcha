import { Context } from '@deepseek-ai/cordis'
import type { Answer, SolveRequest } from '../types.ts'
import type { Provider, SolverRuntime } from './index.ts'

export interface LocalProviderConfig {
  /** 推理服务地址（契约端点），默认 http://127.0.0.1:8000 */
  baseUrl?: string
  /** 超时毫秒 */
  timeoutMs?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    localProvider: Provider
  }
}

/** 本地推理 provider：调自建 model-server（契约 openapi.yaml） */
export default {
  inject: ['providers'],
  apply(ctx: Context, config: LocalProviderConfig = {}) {
  const baseUrl = config.baseUrl ?? process.env.MODEL_SERVER_URL ?? 'http://127.0.0.1:8000'
  const timeoutMs = config.timeoutMs ?? 10_000

  const call = async <T>(path: string, body: unknown): Promise<T> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        throw new Error(`model-server ${path} -> HTTP ${res.status}`)
      }
      return (await res.json()) as T
    } finally {
      clearTimeout(timer)
    }
  }

  const provider: Provider = {
    name: 'local',
    async solve(def: SolverRuntime, media: SolveRequest): Promise<Answer> {
      const requestId = `ant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      switch (def.type) {
        case '1001':
        case '1002':
        case '1003': {
          // 图形文本：OCR
          const r = await call<{ text: string; confidence: number }>('/v1/captcha/ocr', {
            image: media.image,
            request_id: requestId,
          })
          return { type: 'text', value: r.text, confidence: r.confidence, provider: 'local', time: 0 }
        }
        case '2001': {
          // 滑块缺口：背景 + 滑块
          const r = await call<{ x: number; y: number | null; confidence: number }>('/v1/captcha/slide', {
            background_image: media.background_image,
            slide_image: media.slide_image,
            request_id: requestId,
          })
          return {
            type: 'coordinates',
            value: `${r.x}${r.y != null ? `,${r.y}` : ''}`,
            confidence: r.confidence,
            provider: 'local',
            time: 0,
          }
        }
        default:
          throw new Error(`local provider does not support type ${def.type}`)
      }
    },
  }

  ctx.providers.register(provider)
  ctx.provide('localProvider', provider)
  },
}
