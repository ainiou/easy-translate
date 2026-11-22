import type { HoldTriggerKey } from '../shared/types'

/** 按住触发键的最短时间，低于该时长视为快速点按，不触发翻译。 */
export const MIN_HOLD_MS = 120

export interface ModifierState {
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

const MODIFIER_PROPERTY: Record<HoldTriggerKey, keyof ModifierState> = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Shift: 'shiftKey',
}

export function isModifierHeld(state: ModifierState, key: HoldTriggerKey): boolean {
  return state[MODIFIER_PROPERTY[key]] === true
}

export function shouldTriggerHold(
  holdToTranslate: boolean,
  state: ModifierState,
  key: HoldTriggerKey,
  heldMs: number,
): boolean {
  if (!holdToTranslate) return false
  if (!Number.isFinite(heldMs) || heldMs < MIN_HOLD_MS) return false
  return isModifierHeld(state, key)
}

/** 记录触发键的按下与松开状态，忽略按键自动重复。 */
export class HoldTriggerController {
  private pressedAt = 0
  private held = false

  constructor(private readonly now: () => number = () => performance.now()) {}

  press(): void {
    if (this.held) return
    this.held = true
    this.pressedAt = this.now()
  }

  /** 返回松开前是否处于按住状态。 */
  release(): boolean {
    const wasHeld = this.held
    this.held = false
    this.pressedAt = 0
    return wasHeld
  }

  cancel(): void {
    this.held = false
    this.pressedAt = 0
  }

  heldMs(): number {
    return this.held ? this.now() - this.pressedAt : Number.NaN
  }

  get isHeld(): boolean {
    return this.held
  }
}
