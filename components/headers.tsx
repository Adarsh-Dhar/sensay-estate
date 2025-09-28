import Image from "next/image"
import Link from "next/link"

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <Image
              src="/logo-minimal.png"
              alt="Nexus Reality Logo"
              width={64}
              height={64}   
              className="h-16 w-16"
              priority
            />
          <span className="text-xl font-bold text-foreground">
            Nexus Reality
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-6">
          <Link 
            href="/" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </Link>
          <Link 
            href="/search" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Search
          </Link>
          <Link 
            href="/about" 
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  )
}
