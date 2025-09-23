import { ChatSidebar } from "@/components/chat-sidebar"
import { MapAndResults } from "@/components/map-and-results"

export default function Page() {
  return (
    <main className="h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-[35%] bg-muted border-r">
        <ChatSidebar />
      </aside>

      <section className="w-full md:w-[65%] flex-1 bg-background">
        <MapAndResults />
      </section>
    </main>
  )
}
