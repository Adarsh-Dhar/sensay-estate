"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2 } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  role: "user" | "ai"
  content: string
}

type Property = {
  id: string
  address: string
  rent: number | null
  bhk: number | null
  sqft: number | null
  type: string | null
  image: string | null
  coordinates: {
    lat: number | null
    lng: number | null
  }
}

type ChatSidebarProps = {
  onPropertiesUpdate?: (properties: Property[]) => void
}

const initialMessages: Message[] = [
  {
    id: "m1",
    role: "ai",
    content: "Hello! How can I help you find a property today?",
  },
]

export function ChatSidebar({ onPropertiesUpdate }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          context: { properties: [] }, // We could pass current properties here for context
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: data.reply || "I'm sorry, I couldn't process your request.",
      }

      setMessages((prev) => [...prev, aiMessage])

      // Update properties if they were returned
      if (data.properties && Array.isArray(data.properties) && data.properties.length > 0) {
        onPropertiesUpdate?.(data.properties)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "ai",
        content: "I'm sorry, there was an error processing your request. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
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
            disabled={isLoading}
          />
          <Button type="submit" className="shrink-0" aria-label="Send message" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </form>
    </div>
  )
}
