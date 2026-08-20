import { Context } from '@deepseek-ai/cordis'
import type { Answer, SolveRequest } from '../types.ts'

/** Provider 调用约定：媒体进 → 答案出（纯数据，无浏览器） */
export interface Provider {
  name: string
  /** 尝试求解；失败时抛出异常由降级链捕获 */
  solve(def: SolverRuntime, media: SolveRequest): Promise<Answer>
}

/** Solver 定义（注册表条目） */
export interface SolverRuntime {
  type: string
  name: string
  fallback: string[]
  media: ('image' | 'slide_image' | 'background_image' | 'extra' | 'audio')[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    providers: {
      register(p: Provider): void
      /** 按降级链依次尝试，全部失败抛出 */
      dispatch(def: SolverRuntime, media: SolveRequest): Promise<Answer>
    }
  }
}

export default function providers(ctx: Context) {
  const registry = new Map<string, Provider>()

  ctx.provide('providers', {
    register(p: Provider) {
      if (registry.has(p.name)) {
        ctx.logger('providers').warn(`provider ${p.name} already registered, overwriting`)
      }
      registry.set(p.name, p)
      ctx.logger('providers').info(`provider registered: ${p.name}`)
    },

    async dispatch(def: SolverRuntime, media: SolveRequest): Promise<Answer> {
      const errors: string[] = []
      for (const name of def.fallback) {
        const p = registry.get(name)
        if (!p) {
          errors.push(`${name}: not registered`)
          continue
        }
        try {
          const answer = await p.solve(def, media)
          ctx.logger('providers').info(`solved via ${name}: type=${def.type} answer=${answer.value}`)
          return answer
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          ctx.logger('providers').warn(`provider ${name} failed: ${msg}`)
          errors.push(`${name}: ${msg}`)
        }
      }
      throw new Error(`all providers failed for type ${def.type}: ${errors.join(' | ')}`)
    },
  })
}
