"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, sending])

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
      const reply: ChatMessage = {
        id: `m-${Date.now()}-a`,
        role: "assistant",
        content: assistantText || (json?.error ? String(json.error) : "Unable to parse response"),
      }
      setMessages((prev) => [...prev, reply])
    } catch (e: any) {
      setError(e?.message || "Something went wrong sending your message")
    } finally {
      setSending(false)
    }
  }, [messageInput, sending, userId, replicaUuid])

  const canSend = useMemo(() => messageInput.trim().length > 0 && !sending, [messageInput, sending])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-xl p-0 overflow-hidden", className)}>
        <div className="flex h-[70vh] min-h-[28rem] flex-col">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4">
            <div className="mx-auto w-full max-w-none py-4">
              {messages.length === 0 ? (
                <div className="text-muted-foreground py-16 text-center text-sm">
                  Start the conversation by asking a question.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}> 
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


