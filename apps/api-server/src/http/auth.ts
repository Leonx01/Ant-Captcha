import { Context } from '@deepseek-ai/cordis'

export interface AuthConfig {
  /** 共享密钥；为空时跳过鉴权（M0 开发便利，M1 前必须配置） */
  token?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    auth: {
      /** 校验 token，返回是否通过 */
      check(token: string): boolean
    }
  }
}

export default function auth(ctx: Context, config: AuthConfig = {}) {
  const expected = config.token ?? process.env.ANTCAPTCHA_TOKEN ?? ''
  ctx.provide('auth', {
    check(token: string): boolean {
      if (!expected) {
        ctx.logger.warn('ANTCAPTCHA_TOKEN not configured, auth disabled')
        return true
      }
      return token === expected
    },
  })
}
