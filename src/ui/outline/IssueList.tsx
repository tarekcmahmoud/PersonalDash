import type { OutlineIssue } from '../../domain/outline'
import { cn } from '@/lib/utils'

/** Errors and warnings of a parsed outline as quiet lines; each issue jumps to its line. */
export function IssueList({
  issues,
  onJumpToLine,
}: {
  issues: OutlineIssue[]
  onJumpToLine?: (line: number) => void
}) {
  if (issues.length === 0) return null
  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors
  const summary = [
    errors > 0 ? `${errors} ${errors === 1 ? 'error' : 'errors'}` : null,
    warnings > 0 ? `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="mt-3">
      <p className="mb-1 text-xs text-muted-foreground" role="status">
        {summary}
      </p>
      <ul className="divide-y divide-border/60" aria-label="Outline issues">
        {issues.map((issue, i) => {
          const isError = issue.severity === 'error'
          const prefix = issue.line > 0 ? `Line ${issue.line} ·` : 'Whole outline ·'
          const content = (
            <>
              <span className="text-muted-foreground">{prefix}</span>{' '}
              <span className={isError ? 'text-destructive' : 'text-warning'}>{issue.message}</span>
            </>
          )
          const className = 'block w-full py-1.5 text-left text-sm'
          return (
            <li key={`${issue.line}-${i}`} data-severity={issue.severity}>
              {issue.line > 0 && onJumpToLine ? (
                <button
                  type="button"
                  className={cn(className, 'cursor-pointer underline-offset-4 hover:underline')}
                  onClick={() => onJumpToLine(issue.line)}
                >
                  {content}
                </button>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
