'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b bg-background/60 backdrop-blur-md">
      <nav className="container mx-auto h-full px-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
          <Sprout className="size-5" />
          <span>Skill Plant</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className={cn(
              'text-sm px-3 py-2 rounded-md transition-colors hover:bg-accent hover:text-accent-foreground',
              pathname === '/' ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}
          >
            市场
          </Link>
          <Button asChild size="sm" variant={pathname === '/generate' ? 'default' : 'outline'}>
            <Link href="/generate">+ 生成</Link>
          </Button>
        </div>
      </nav>
    </header>
  )
}
