/** Helpers for Base UI Select — raw values show in the trigger unless `items` is provided. */

export type SelectItemOption = {
  value: string
  label: string
}

/** Build the `items` prop Base UI needs to render labels instead of raw IDs/values. */
export function selectItems(
  options: Array<{ value: string | number; label: string }>,
): SelectItemOption[] {
  return options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }))
}

export function selectItemsRecord(
  entries: Record<string, string>,
): Record<string, string> {
  return entries
}
