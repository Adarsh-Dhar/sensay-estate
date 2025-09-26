"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  parsed?: any
}

type ChatbotDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  initialPrompt?: string
  userId?: string
  replicaUuid?: string
  projectId?: string
  projectContext?: Record<string, any>
  className?: string
}

function extractAssistantText(data: any): string {
  if (!data) return ""
  // Try common shapes; fallback to JSON string
  const candidates: Array<any> = [
    data?.message?.content,
    data?.content,
    data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.text,
    data?.reply?.content,
  ]
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c
  }
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

function tryParseJSON(text: string): any | null {
  try {
    const obj = JSON.parse(text)
    if (obj && typeof obj === "object" && ("action" in obj)) return obj
    return null
  } catch {
    return null
  }
}

export function ChatbotDialog({
  open,
  onOpenChange,
  title = "Ask AI",
  description = "Ask questions about this listing or neighborhood.",
  initialPrompt,
  userId,
  replicaUuid,
  projectId,
  projectContext,
  className,
}: ChatbotDialogProps) {
  const [messageInput, setMessageInput] = useState<string>("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) {
      // reset transient error when closing
      setError(null)
      return
    }
    // optional initial prompt when opened
    if (open && initialPrompt && messages.length === 0) {
      setMessageInput(initialPrompt)
    }
  }, [open])

  useEffect(() => {
    // Use setTimeout to ensure DOM is updated before scrolling
    setTimeout(() => {
      if (endRef.current) {
        endRef.current.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    }, 100)
  }, [messages, sending])

  // Alternative scroll method for better reliability
  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const content = messageInput.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)

    const userMsg: ChatMessage = {
      id: `m-${Date.now()}-u`,
      role: "user",
      content,
    }
    setMessages((prev) => [...prev, userMsg])
    setMessageInput("")
    // Scroll to bottom after adding user message
    setTimeout(scrollToBottom, 100)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, userId, replicaUuid, projectId, projectContext }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(text || `Request failed: ${res.status}`)
      }
      const json = await res.json()
      const success = Boolean(json?.success)
      const assistantText = success ? extractAssistantText(json?.data) : ""
      const parsed = assistantText ? tryParseJSON(assistantText) : null
      const reply: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: assistantText || (json?.error ? String(json.error) : "Unable to parse response"),
        parsed,
      }
      setMessages((prev) => [...prev, reply])
      // Scroll to bottom after adding message
      setTimeout(scrollToBottom, 100)
    } catch (e: any) {
      setError(e?.message || "Something went wrong sending your message")
    } finally {
      setSending(false)
    }
  }, [messageInput, sending, userId, replicaUuid, scrollToBottom])

  const canSend = useMemo(() => messageInput.trim().length > 0 && !sending, [messageInput, sending])

  const handleViewResults = useCallback((filters: Record<string, any>) => {
    const params = new URLSearchParams()
    // Pass through recognized filter fields
    if (filters?.location) params.set("location", String(filters.location))
    if (filters?.rent_max != null) params.set("rent_max", String(filters.rent_max))
    if (filters?.rent_min != null) params.set("rent_min", String(filters.rent_min))
    if (filters?.price_max != null) params.set("price_max", String(filters.price_max))
    if (filters?.price_min != null) params.set("price_min", String(filters.price_min))
    if (filters?.beds_min != null) params.set("beds_min", String(filters.beds_min))
    if (filters?.property_type) params.set("property_type", String(filters.property_type))
    router.push(`/?${params.toString()}`)
  }, [router])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-xl p-0 overflow-hidden", className)}>
        <div className="flex h-[70vh] min-h-[28rem] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="px-4 py-4">
                {messages.length === 0 ? (
                  <div className="text-muted-foreground py-16 text-center text-sm">
                    Start the conversation by asking a question.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((m) => (
                      <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                        {m.role === "assistant" && m.parsed && m.parsed.action === "search" ? (
                          <div className="bg-muted max-w-[80%] rounded-lg px-3 py-2 text-sm">
                            <div className="mb-2 font-medium">Search prepared</div>
                            <div className="text-muted-foreground mb-2">
                              {(() => {
                                const f = m.parsed?.filters || {}
                                const loc = f.location ? `Location: ${f.location}` : "Location: —"
                                const beds = f.beds_min != null ? ` • Beds ≥ ${f.beds_min}` : ""
                                const type = f.property_type ? ` • Type: ${f.property_type}` : ""
                                const price = f.price_max != null || f.price_min != null
                                  ? ` • Price ${f.price_min != null ? `$${f.price_min}` : ''}${f.price_min != null || f.price_max != null ? '-' : ''}${f.price_max != null ? `$${f.price_max}` : ''}`
                                  : (f.rent_max != null || f.rent_min != null
                                    ? ` • Rent ${f.rent_min != null ? `$${f.rent_min}` : ''}${f.rent_min != null || f.rent_max != null ? '-' : ''}${f.rent_max != null ? `$${f.rent_max}` : ''}`
                                    : "")
                                return `${loc}${beds}${type}${price}`
                              })()}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleViewResults(m.parsed?.filters || {})}>View results</Button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm",
                              m.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            {m.content}
                          </div>
                        )}
                      </div>
                    ))}
                    {sending ? (
                      <div className="flex justify-start">
                        <div className="bg-muted text-muted-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm">
                          Thinking…
                        </div>
                      </div>
                    ) : null}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="border-t p-3 sm:p-4">
            {error ? (
              <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void sendMessage()
              }}
            >
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Ask anything…"
                rows={2}
                className="border-input placeholder:text-muted-foreground focus-visible:ring-ring/50 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              />
              <Button type="submit" disabled={!canSend} className="self-stretch">
                {sending ? "Sending…" : "Send"}
              </Button>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChatbotDialog


