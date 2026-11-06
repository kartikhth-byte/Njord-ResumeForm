// Chart colors as CSS values backed by theme tokens (docs/ui-theme-spec.md §3.3).
export const chartColor = (index) => `rgb(var(--chart-${index}))`
export const toneColor = (tone) => `rgb(var(--${tone}))`
