import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type Member = {
  name: string
  role: string
  imageUrl?: string
}

export default function TeamGrid({ members }: { members: Member[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      {members.map((m) => (
        <li key={m.name + m.role} className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-14 w-14">
              {m.imageUrl ? (
                <AvatarImage
                  src={m.imageUrl || "/placeholder.svg?height=56&width=56&query=team%20member"}
                  alt={`${m.name} profile photo`}
                />
              ) : null}
              <AvatarFallback aria-label={`${m.name} avatar`}>{getInitials(m.name)}</AvatarFallback>
            </Avatar>
            <p className="mt-3 text-sm font-semibold text-foreground">{m.name}</p>
            <p className="text-xs text-muted-foreground">{m.role}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return (first + last).toUpperCase()
}
