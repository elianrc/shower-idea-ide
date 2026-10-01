export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="brand-mark"
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <path d="M7 22.5c3.1-1.2 5-3.5 5.7-6.9.7-3.6 2.9-6.1 6.6-7.6" />
      <path d="M12.3 25c3.6-1.1 5.8-3.5 6.4-7.1.6-3.3 2.5-5.6 5.8-7" />
      <circle cx="7" cy="22.5" r="2" />
      <circle cx="19.3" cy="8" r="2" />
      <circle cx="12.3" cy="25" r="2" />
      <circle cx="24.5" cy="10.9" r="2" />
    </svg>
  )
}
