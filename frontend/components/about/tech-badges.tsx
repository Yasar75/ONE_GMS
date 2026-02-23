type Props = { items: string[] }

export default function TechBadges({ items }: Props) {
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {items.map((t) => (
        <li
          key={t}
          className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground/80"
        >
          {t}
        </li>
      ))}
    </ul>
  )
}
