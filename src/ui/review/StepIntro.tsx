import type { ReactNode } from 'react'

/** One grey line of guidance at the top of a review step. The step name is a visually hidden heading. */
export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="sr-only">{title}</h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
    </div>
  )
}
