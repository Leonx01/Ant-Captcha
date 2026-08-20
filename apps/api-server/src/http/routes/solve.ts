import { Context } from '@deepseek-ai/cordis'
import { ErrorCode, err, ok } from '../../types.ts'
import type { SolveRequest, SolveResponse } from '../../types.ts'

export interface SolveRouteConfig {
  /** M0：注册表为空，所有 type 返回 10004；M1 接入真实 Solver */
  maxPayloadBytes?: number
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    solve: (req: SolveRequest) => SolveResponse | Promise<SolveResponse>
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

/** 求解入口：M0 空壳实现（注册表为空 → 10004） */
export function provideSolve(ctx: Context) {
  ctx.provide('solve', (req: SolveRequest): SolveResponse => {
    // 1. 校验必填
    if (!req || typeof req.type !== 'string' || !req.type) {
      return err(ErrorCode.PARAM_ERROR, '参数错误')
    }
    // 2. type 路由（M0 注册表为空，一律 10004）
    const def = ctx.solverRegistry.get(req.type)
    if (!def) {
      return err(ErrorCode.NO_TYPE, '无此验证类型')
    }
    // M1：走 waterfall solver/preprocess → solver/route → provider → solver/postprocess
    return err(ErrorCode.NO_TYPE, `solver ${req.type} not implemented yet`)
  })
}

export default {
  inject: ['auth', 'solverRegistry'],
  apply(ctx: Context, config: SolveRouteConfig = {}) {
    const maxPayload = config.maxPayloadBytes ?? 8 * 1024 * 1024
    provideSolve(ctx)

    // HTTP 层接入（M0 由 server.ts 直接调用 ctx.solve）
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
      // 简化 M0：原样调用（校验由 ctx.solve 完成）
      const result = ctx.solve(req)
      void maxPayload
      if (result instanceof Promise) {
        result.then(reply).catch(() => reply(err(ErrorCode.INTERNAL, '内部错误')))
      } else {
        reply(result)
      }
    })
  },
}
