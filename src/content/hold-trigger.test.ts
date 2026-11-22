import { describe, expect, it } from 'vitest'
import {
  HoldTriggerController,
  MIN_HOLD_MS,
  isModifierHeld,
  shouldTriggerHold,
} from './hold-trigger'

const idle = { altKey: false, ctrlKey: false, shiftKey: false }

function createClock(start = 1000) {
  let current = start
  return {
    now: () => current,
    advance(ms: number) {
      current += ms
    },
  }
}

describe('按住触发判断', () => {
  it('按住模式关闭时不触发', () => {
    expect(shouldTriggerHold(false, { ...idle, altKey: true }, 'Alt', 500)).toBe(false)
  })

  it('按住的键与配置一致且超过最短时长才触发', () => {
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', MIN_HOLD_MS)).toBe(true)
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', MIN_HOLD_MS - 1)).toBe(false)
  })

  it('快速点按或按住时间未知时不触发', () => {
    expect(shouldTriggerHold(true, { ...idle, ctrlKey: true }, 'Control', 60)).toBe(false)
    expect(shouldTriggerHold(true, { ...idle, ctrlKey: true }, 'Control', Number.NaN)).toBe(false)
  })

  it('按住的键与配置不一致时不触发', () => {
    expect(shouldTriggerHold(true, { ...idle, ctrlKey: true }, 'Alt', 500)).toBe(false)
    expect(shouldTriggerHold(true, { ...idle, shiftKey: true }, 'Shift', 500)).toBe(true)
  })

  it('正确读取各触发键的修饰状态', () => {
    expect(isModifierHeld({ ...idle, altKey: true }, 'Alt')).toBe(true)
    expect(isModifierHeld({ ...idle, ctrlKey: true }, 'Control')).toBe(true)
    expect(isModifierHeld({ ...idle, shiftKey: true }, 'Shift')).toBe(true)
    expect(isModifierHeld(idle, 'Alt')).toBe(false)
  })
})

describe('按住触发状态机', () => {
  it('短按后松开：不触发翻译，但松开可触发取消', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)

    controller.press()
    clock.advance(40)
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', controller.heldMs())).toBe(
      false,
    )

    expect(controller.release()).toBe(true)
    expect(controller.heldMs()).toBeNaN()
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', controller.heldMs())).toBe(
      false,
    )
  })

  it('长按保持：超过最短时长后触发', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)

    controller.press()
    clock.advance(MIN_HOLD_MS)
    expect(controller.isHeld).toBe(true)
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', controller.heldMs())).toBe(
      true,
    )

    clock.advance(3000)
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', controller.heldMs())).toBe(
      true,
    )
  })

  it('中途松开：返回已松开并终止后续触发', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)

    controller.press()
    clock.advance(500)
    expect(controller.release()).toBe(true)
    expect(controller.isHeld).toBe(false)
    expect(controller.release()).toBe(false)
    expect(
      shouldTriggerHold(true, { ...idle, altKey: true }, 'Alt', controller.heldMs()),
    ).toBe(false)
  })

  it('忽略按键自动重复，不重置按住时长', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)

    controller.press()
    clock.advance(200)
    controller.press()
    clock.advance(100)
    expect(controller.heldMs()).toBe(300)
  })

  it('取消后需要重新按下才会再次生效', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)

    controller.press()
    clock.advance(500)
    controller.cancel()
    expect(controller.isHeld).toBe(false)
    expect(controller.heldMs()).toBeNaN()

    controller.press()
    clock.advance(MIN_HOLD_MS)
    expect(shouldTriggerHold(true, { ...idle, shiftKey: true }, 'Shift', controller.heldMs())).toBe(
      true,
    )
  })

  it('不同按键组合按配置的触发键判断', () => {
    const clock = createClock()
    const controller = new HoldTriggerController(clock.now)
    controller.press()
    clock.advance(400)

    expect(
      shouldTriggerHold(
        true,
        { altKey: true, ctrlKey: true, shiftKey: true },
        'Control',
        controller.heldMs(),
      ),
    ).toBe(true)
    expect(shouldTriggerHold(true, { ...idle, altKey: true }, 'Control', controller.heldMs())).toBe(
      false,
    )
    expect(shouldTriggerHold(true, { ...idle, ctrlKey: true }, 'Alt', controller.heldMs())).toBe(
      false,
    )
  })
})
