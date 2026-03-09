import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  backHref?: string
  backLabel?: string
  className?: string
}

export function PageHeader({ title, backHref, backLabel, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {backHref && backLabel && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  )
}
