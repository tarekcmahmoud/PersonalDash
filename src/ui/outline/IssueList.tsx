import { AlertIcon, XCircleFillIcon } from '@primer/octicons-react'
import type { OutlineIssue } from '../../domain/outline'
import styles from './IssueList.module.css'

/** Errors (danger) and warnings (attention) of a parsed outline; each issue jumps to its line. */
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
    <div className={styles.root}>
      <div className={styles.summary} role="status">
        {summary}
      </div>
      <ul className={styles.list} aria-label="Outline issues">
        {issues.map((issue, i) => {
          const isError = issue.severity === 'error'
          const prefix = issue.line > 0 ? `Line ${issue.line}:` : 'Whole outline:'
          const content = (
            <>
              <span className={isError ? styles.iconError : styles.iconWarning} aria-hidden="true">
                {isError ? <XCircleFillIcon size={16} /> : <AlertIcon size={16} />}
              </span>
              <span className={styles.text}>
                <span className={styles.prefix}>{prefix}</span> {issue.message}
              </span>
            </>
          )
          return (
            <li
              key={`${issue.line}-${i}`}
              className={isError ? styles.error : styles.warning}
              data-severity={issue.severity}
            >
              {issue.line > 0 && onJumpToLine ? (
                <button type="button" className={styles.item} onClick={() => onJumpToLine(issue.line)}>
                  {content}
                </button>
              ) : (
                <div className={styles.item}>{content}</div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
