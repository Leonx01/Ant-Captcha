import { Context } from '@deepseek-ai/cordis'

/** 内置 Solver 注册（M1：数英 OCR + 滑块缺口；M2 扩展中文/计算题/点选） */
export default {
  inject: ['solverRegistry'],
  apply(ctx: Context) {
    ctx.solverRegistry.register({
      type: '1001',
      name: 'numeric-ocr',
      fallback: ['local'],
      media: ['image'],
    })
    ctx.solverRegistry.register({
      type: '1002',
      name: 'chinese-ocr',
      fallback: ['local'],
      media: ['image'],
    })
    ctx.solverRegistry.register({
      type: '1003',
      name: 'math-ocr',
      fallback: ['local'],
      media: ['image'],
    })
    ctx.solverRegistry.register({
      type: '2001',
      name: 'slider-gap',
      fallback: ['local'],
      media: ['slide_image', 'background_image'],
    })
    ctx.logger('solvers').info('builtin solvers registered: 1001/1002/1003/2001')
  },
}
