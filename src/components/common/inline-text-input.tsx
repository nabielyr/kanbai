"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface InlineTextInputProps {
  initialValue?: string;
  placeholder?: string;
  "aria-label": string;
  /** Called with the trimmed value on Enter or blur. Empty values call `onCancel` instead. */
  onSubmit: (value: string) => void;
  onCancel: () => void;
  /** Keep focus and clear the field after Enter (for adding several items in a row). */
  keepOpenOnEnter?: boolean;
  maxLength?: number;
  className?: string;
}

/** Text field for quick edits: Enter saves, Escape cancels, clicking away saves. */
export function InlineTextInput({
  initialValue = "",
  placeholder,
  onSubmit,
  onCancel,
  keepOpenOnEnter = false,
  maxLength = 200,
  className,
  ...props
}: InlineTextInputProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);
  // Prevents the blur that follows Enter/Escape from submitting a second time.
  const settled = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function finish(kind: "enter" | "blur") {
    const trimmed = value.trim();
    if (!trimmed) {
      settled.current = true;
      onCancel();
      return;
    }
    onSubmit(trimmed);
    if (kind === "enter" && keepOpenOnEnter) {
      setValue("");
    } else {
      settled.current = true;
    }
  }

  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-label={props["aria-label"]}
      // Lets a surrounding dialog leave Escape to this field (cancel the edit, keep the dialog).
      data-inline-edit=""
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          finish("enter");
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          settled.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!settled.current) finish("blur");
      }}
      className={cn(
        "border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px]",
        className,
      )}
    />
  );
}
