import { Context } from '@deepseek-ai/cordis'
import { SolverRegistryService } from './registry/registry.ts'
import httpServer from './http/server.ts'
import auth from './http/auth.ts'
import solveRoute from './http/routes/solve.ts'
import providers from './providers/index.ts'
import localProvider from './providers/local.ts'
import builtinSolvers from './solvers/builtin.ts'

/** 应用组装：编程式插件注册（与 cordis.yml 声明一一对应） */
export async function createApp(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SolverRegistryService)
  await ctx.plugin(auth, { token: process.env.ANTCAPTCHA_TOKEN })
  await ctx.plugin(providers)
  await ctx.plugin(localProvider, {})
  await ctx.plugin(builtinSolvers)
  await ctx.plugin(httpServer, { port: Number(process.env.PORT ?? 8080) })
  await ctx.plugin(solveRoute, {})
  return ctx
}

/** 应用启动入口（供 main.ts / 测试调用） */
export async function start(): Promise<Context> {
  const ctx = await createApp()
  ctx.logger('app').info('[ant-captcha] api-server started (M1)')
  return ctx
}
