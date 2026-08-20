import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { createApp } from '../src/index.ts'
import type { SolveResponse } from '../src/types.ts'

let ctx: Context
const PORT = 18080
const TOKEN = 'test-token'

before(async () => {
  process.env.ANTCAPTCHA_TOKEN = TOKEN
  process.env.PORT = String(PORT)
  process.env.MODEL_SERVER_URL = 'http://127.0.0.1:19999' // 指向不存在服务：验证降级/错误路径
  ctx = await createApp()
})

after(async () => {
  await ctx.httpServer.close()
})

const post = async (body: unknown): Promise<SolveResponse> => {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<SolveResponse>
}

describe('M1：/api/solve 路由与校验', () => {
  it('已注册类型但缺媒体字段 → 10001', async () => {
    const res = await post({ token: TOKEN, type: '1001' })
    assert.equal(res.code, 10001)
    assert.match(res.msg, /image/)
  })

  it('滑块类型缺 slide_image → 10001', async () => {
    const res = await post({ token: TOKEN, type: '2001', background_image: 'x' })
    assert.equal(res.code, 10001)
    assert.match(res.msg, /slide_image/)
  })

  it('未知 type → 10004', async () => {
    const res = await post({ token: TOKEN, type: '9999', image: 'x' })
    assert.equal(res.code, 10004)
  })

  it('缺少 token → 10003', async () => {
    const res = await post({ type: '1001', image: 'x' })
    assert.equal(res.code, 10003)
  })

  it('缺少 type → 10001', async () => {
    const res = await post({ token: TOKEN })
    assert.equal(res.code, 10001)
  })

  it('Solver 已注册（注册表非空）', () => {
    const types = ctx.solverRegistry.list().map((s) => s.type)
    assert.ok(types.includes('1001'))
    assert.ok(types.includes('2001'))
  })

  it('provider 不可达 → 10008 内部错误（降级链耗尽）', async () => {
    const res = await post({ token: TOKEN, type: '1001', image: 'ZmFrZQ==' })
    assert.equal(res.code, 10008)
  })

  it('GET /healthz 返回 200', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`)
    assert.equal(res.status, 200)
  })
})
