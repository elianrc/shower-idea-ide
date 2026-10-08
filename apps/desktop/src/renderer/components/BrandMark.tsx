export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <path d="M16 4 6 11v15l10-6 10 6V11L16 4Z" />
      <path d="M16 4v16" />
    </svg>
  )
}
