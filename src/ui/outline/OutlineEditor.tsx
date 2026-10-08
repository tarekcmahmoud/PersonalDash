import { SegmentedControl, Textarea } from '@primer/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { parseOutline, type ParseResult } from '../../domain/outline'
import { IssueList } from './IssueList'
import { lineRange } from './outlineStats'
import { OutlinePreview } from './OutlinePreview'
import styles from './OutlineEditor.module.css'

const DEBOUNCE_MS = 200

/**
 * Outline textarea with live (debounced) parsing, an issue list and a read-only preview. Side by side on
 * desktop; on phones an Edit / Preview switch.
 */
export function OutlineEditor({
  value,
  onChange,
  onParse,
  label = 'Outline',
  placeholder = '# Project name\noutcome: Done when …\ntarget: 2026-12-31 soft\n\n## Milestone\n- First task [S]',
}: {
  value: string
  onChange: (value: string) => void
  /** Called with the latest parse result (initially, then ~200ms after each edit). */
  onParse?: (result: ParseResult) => void
  label?: string
  placeholder?: string
}) {
  const [parsed, setParsed] = useState<ParseResult>(() => parseOutline(value))
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const onParseRef = useRef(onParse)
  useEffect(() => {
    onParseRef.current = onParse
  })

  useEffect(() => {
    const timer = window.setTimeout(() => setParsed(parseOutline(value)), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [value])

  useEffect(() => {
    onParseRef.current?.(parsed)
  }, [parsed])

  const jumpToLine = useCallback(
    (line: number) => {
      // The textarea is hidden on the phone's Preview tab and cannot take focus there.
      flushSync(() => setTab('edit'))
      const area = areaRef.current
      if (!area) return
      const [start, end] = lineRange(value, line)
      area.focus()
      area.setSelectionRange(start, end)
      // Scroll the selected line into view (textareas do not do it on setSelectionRange).
      const lineHeight = parseFloat(getComputedStyle(area).lineHeight) || 20
      area.scrollTop = Math.max(0, (line - 3) * lineHeight)
    },
    [value],
  )

  const hasText = value.trim() !== ''
  const issues = hasText ? parsed.issues : []

  return (
    <div className={styles.root} data-tab={tab}>
      <div className={styles.switcher}>
        <SegmentedControl
          aria-label="Edit or preview"
          fullWidth
          onChange={(i) => setTab(i === 0 ? 'edit' : 'preview')}
        >
          <SegmentedControl.Button selected={tab === 'edit'}>Edit</SegmentedControl.Button>
          <SegmentedControl.Button selected={tab === 'preview'}>Preview</SegmentedControl.Button>
        </SegmentedControl>
      </div>
      <div className={styles.panes}>
        <div className={styles.editPane}>
          <Textarea
            ref={areaRef}
            aria-label={label}
            className={styles.editor}
            block
            resize="vertical"
            rows={20}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <IssueList issues={issues} onJumpToLine={jumpToLine} />
        </div>
        <div className={styles.previewPane} aria-label="Preview" role="region">
          {hasText ? (
            <OutlinePreview doc={parsed.doc} />
          ) : (
            <p className={styles.hint}>Paste or type an outline on the left to see the plan here.</p>
          )}
        </div>
      </div>
    </div>
  )
}
