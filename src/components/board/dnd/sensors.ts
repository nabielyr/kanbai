import { KeyboardSensor, MouseSensor, TouchSensor, type Activators } from "@dnd-kit/core";
import type { SyntheticEvent } from "react";

// Sensors that ignore events coming from interactive children (menu buttons, inline inputs),
// so clicking a card's "…" button or typing a space in its title never starts a drag.

const INTERACTIVE = "button, a, input, textarea, select, [role='menuitem'], [data-no-dnd]";

function fromInteractiveChild(event: SyntheticEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target || target === event.currentTarget) return false;
  const interactive = target.closest(INTERACTIVE);
  // The draggable node itself may have role="button" (dnd-kit default); only children count.
  return interactive !== null && interactive !== event.currentTarget;
}

/** Wraps dnd-kit's own activators so their behaviour is kept, behind an extra check. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches dnd-kit's handler signature
function guard<A extends Activators<any>>(
  activators: A,
  allow: (event: SyntheticEvent) => boolean,
): A {
  return activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      allow(args[0] as SyntheticEvent) ? activator.handler(...args) : false,
  })) as A;
}

export class SmartMouseSensor extends MouseSensor {
  static activators = guard(MouseSensor.activators, (e) => !fromInteractiveChild(e));
}

export class SmartTouchSensor extends TouchSensor {
  static activators = guard(TouchSensor.activators, (e) => !fromInteractiveChild(e));
}

export class SmartKeyboardSensor extends KeyboardSensor {
  // Keyboard drags start only when the draggable itself is focused, never from a child input.
  static activators = guard(KeyboardSensor.activators, (e) => e.target === e.currentTarget);
}
