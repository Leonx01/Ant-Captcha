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

describe('M0 出口条件：/api/solve', () => {
  it('注册表为空 → 未知 type 返回 10004', async () => {
    const res = await post({ token: TOKEN, type: '1001' })
    assert.equal(res.code, 10004)
  })

  it('缺少 token → 10003', async () => {
    const res = await post({ type: '1001' })
    assert.equal(res.code, 10003)
  })

  it('缺少 type → 10001', async () => {
    const res = await post({ token: TOKEN })
    assert.equal(res.code, 10001)
  })

  it('GET /healthz 返回 200', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/healthz`)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.code, 10000)
  })
})
