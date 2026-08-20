import { Context } from '@deepseek-ai/cordis'
import { ErrorCode, err, ok } from '../../types.ts'
import type { Answer, SolveRequest, SolveResponse } from '../../types.ts'

export interface SolveRouteConfig {
  maxPayloadBytes?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    solve: (req: SolveRequest) => Promise<SolveResponse>
  }
  interface Events {
    'http/route': (
      method: string,
      pathname: string,
      body: unknown,
      reply: (r: SolveResponse) => void,
    ) => void
  }
}

/** 求解入口：type 路由 → Solver → provider 降级链 → Answer */
export function provideSolve(ctx: Context) {
  ctx.provide('solve', async (req: SolveRequest): Promise<SolveResponse> => {
    const start = Date.now()
    // 1. 校验必填
    if (!req || typeof req.type !== 'string' || !req.type) {
      return err(ErrorCode.PARAM_ERROR, '参数错误')
    }
    // 2. type 路由
    const def = ctx.solverRegistry.get(req.type)
    if (!def) {
      return err(ErrorCode.NO_TYPE, '无此验证类型')
    }
    // 3. 校验媒体字段
    for (const field of def.media) {
      if (!req[field]) {
        return err(ErrorCode.PARAM_ERROR, `缺少参数: ${field}`)
      }
    }
    // 4. provider 降级链
    try {
      const answer: Answer = await ctx.providers.dispatch(def, req)
      return ok({
        code: 200,
        data: answer.value,
        time: Date.now() - start,
        provider: answer.provider,
        confidence: answer.confidence,
        uniqueCode: `u-${start.toString(36)}`,
        meta: answer.meta,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      ctx.logger('solve').warn(`solve failed: ${msg}`)
      return err(ErrorCode.INTERNAL, `内部错误: ${msg}`)
    }
  })
}

export default {
  inject: ['auth', 'solverRegistry', 'providers'],
  apply(ctx: Context, config: SolveRouteConfig = {}) {
    const maxPayload = config.maxPayloadBytes ?? 8 * 1024 * 1024
    provideSolve(ctx)

    ctx.on('http/route', (method: string, pathname: string, body: unknown, reply: (r: SolveResponse) => void) => {
      if (method !== 'POST' || pathname !== '/api/solve') return
      const req = body as SolveRequest
      if (typeof req !== 'object' || req === null) {
        reply(err(ErrorCode.PARAM_ERROR, '参数错误'))
        return
      }
      // 鉴权
      if (!ctx.auth.check(req.token ?? '')) {
        reply(err(ErrorCode.NO_PERMISSION, '无此访问权限'))
        return
      }
      void maxPayload
      ctx
        .solve(req)
        .then(reply)
        .catch(() => reply(err(ErrorCode.INTERNAL, '内部错误')))
    })
  },
}
