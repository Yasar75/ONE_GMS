"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Props = { to: string }

export default function ContactForm({ to }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [inquiry, setInquiry] = useState("General")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent(`${inquiry} inquiry from ${name || "your website"}`)
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nInquiry: ${inquiry}\n\nMessage:\n${message}`)
    return `mailto:${to}?subject=${subject}&body=${body}`
  }, [to, name, email, inquiry, message])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNotice(null)

    if (!email || !message) {
      setNotice("Please provide at least your email and a short message.")
      return
    }
    setBusy(true)
    try {
      window.location.href = mailtoHref
      setTimeout(() => {
        setBusy(false)
        setNotice("Opening your email app… If nothing happens, click the Email link above.")
      }, 800)
    } catch {
      setBusy(false)
      setNotice("Could not open your email app. Please email us directly.")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="form-feedback">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            id="name"
            name="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="inquiry" className="text-sm font-medium text-foreground">
          Inquiry type
        </label>
        <select
          id="inquiry"
          name="inquiry"
          value={inquiry}
          onChange={(e) => setInquiry(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option>General</option>
          <option>MERN/Django Project</option>
          <option>GenAI/Chatbot</option>
          <option>Other</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-medium text-foreground">
          Message
        </label>
        <Textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="Tell us about your project… (Hindi/English allowed)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Opening Email…" : "Send via Email"}
        </Button>
        <a href={mailtoHref} className="text-sm font-medium text-accent underline underline-offset-4">
          Or click to email directly
        </a>
      </div>

      <p id="form-feedback" aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
        {notice}
      </p>
    </form>
  )
}
