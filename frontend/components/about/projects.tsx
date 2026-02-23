import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Project = {
  title: string
  description: string
  tags: string[]
  status: "In Progress" | "Shipped"
}

export default function ProjectsInProgress({ projects }: { projects: Project[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {projects.map((p) => (
        <Card key={p.title}>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <span className="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent">
                {p.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {p.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                  {tag}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6 text-muted-foreground">{p.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
