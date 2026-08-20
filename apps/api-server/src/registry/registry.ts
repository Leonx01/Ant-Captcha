import { Context, Service } from '@deepseek-ai/cordis'

/** Solver 注册表：type 代码 ↔ Solver 定义 */
export interface SolverDef {
  type: string
  name: string
  /** 降级链：provider 名列表，按序尝试 */
  fallback: string[]
  /** 输入需要哪些媒体字段 */
  media: ('image' | 'slide_image' | 'background_image' | 'extra' | 'audio')[]
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    solverRegistry: SolverRegistryService
  }
}

export class SolverRegistryService extends Service {
  private solvers = new Map<string, SolverDef>()

  constructor(ctx: Context) {
    super(ctx, 'solverRegistry')
  }

  /** 注册一个 Solver（内置插件或定制类型注册器调用） */
  register(def: SolverDef): void {
    if (this.solvers.has(def.type)) {
      this.ctx.logger('registry').warn(`solver type ${def.type} already registered, overwriting`)
    }
    this.solvers.set(def.type, def)
    this.ctx.logger('registry').info(`solver registered: type=${def.type} name=${def.name}`)
  }

  /** 查询 Solver；不存在返回 undefined → 上层返回 10004 */
  get(type: string): SolverDef | undefined {
    return this.solvers.get(type)
  }

  list(): SolverDef[] {
    return [...this.solvers.values()]
  }
}
