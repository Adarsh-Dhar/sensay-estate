"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  role: "user" | "ai"
  content: string
}

const initialMessages: Message[] = [
  {
    id: "m1",
    role: "user",
    content: "Looking for a quiet neighborhood with parks near Indiranagar.",
  },
  {
    id: "m2",
    role: "ai",
    content:
      "Indiranagar offers good walkability with several parks nearby. Consider areas around 80 Feet Road and HAL 2nd Stage for quieter streets.",
  },
  {
    id: "m3",
    role: "user",
    content: "What are typical 3 BHK rents around 1200 sqft?",
  },
  {
    id: "m4",
    role: "ai",
    content:
      "Typical 3 BHK (≈1200 sqft) rentals range from ₹14,000 to ₹18,000 per month depending on exact location and amenities.",
  },
]

export function ChatSidebar() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")

  function onSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed) return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      // Mock AI response for demo
      {
        id: crypto.randomUUID(),
        role: "ai",
        content: "Thanks! I’ll analyze that area’s safety, commute, and amenities to recommend options.",
      },
    ])
    setInput("")
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b bg-muted/60 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
          NN
          <span className="sr-only">Neighborhood Navigator logo</span>
        </div>
        <h1 className="text-sm font-medium tracking-wide text-pretty">Neighborhood Navigator</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="flex">
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm",
                  m.role === "user" ? "bg-card" : "bg-info",
                )}
                aria-label={m.role === "user" ? "User message" : "AI message"}
              >
                {m.content}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={onSend} className="sticky bottom-0 border-t bg-muted/60 px-3 py-3" aria-label="Chat input area">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a neighborhood..."
            className="flex-1"
            aria-label="Chat prompt"
          />
          <Button type="submit" className="shrink-0" aria-label="Send message">
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
