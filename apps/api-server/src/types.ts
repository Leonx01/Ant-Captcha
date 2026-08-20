/**
 * 共享类型：媒体输入 / 答案输出 / 错误码
 * 协议对齐行业惯例（云码风格），仅 POST，见 docs/requirements.md §5
 */

/** 打码 API 错误码（docs/requirements.md §5.3） */
export const ErrorCode = {
  OK: 10000,
  PARAM_ERROR: 10001,
  NO_PERMISSION: 10003,
  NO_TYPE: 10004,
  BUSY: 10005,
  PAYLOAD_TOO_LARGE: 10006,
  INTERNAL: 10008,
  PENDING: 10009,
} as const

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]

/** 媒体输入：Solver 只接受媒体，不接受页面/浏览器对象 */
export interface SolveRequest {
  token: string
  type: string
  image?: string
  slide_image?: string
  background_image?: string
  extra?: string
  audio?: string
}

/** 答案输出（统一结构） */
export interface Answer {
  type: 'text' | 'coordinates' | 'choice'
  value: string
  confidence: number
  provider: string
  time: number
  meta?: Record<string, unknown>
}

/** 打码 API 统一响应 */
export interface SolveResponse {
  code: ErrorCode | number
  msg: string
  data?: {
    code: number
    data: string
    time: number
    provider: string
    confidence: number
    uniqueCode: string
    meta?: Record<string, unknown>
  }
}

export function ok(data: SolveResponse['data']): SolveResponse {
  return { code: ErrorCode.OK, msg: '请求成功', data }
}

export function err(code: ErrorCode, msg: string): SolveResponse {
  return { code, msg }
}
