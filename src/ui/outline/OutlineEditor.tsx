import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { parseOutline, type ParseResult } from '../../domain/outline'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { IssueList } from './IssueList'
import { lineRange } from './outlineStats'
import { OutlinePreview } from './OutlinePreview'

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
  previewClassName,
  previewCard = false,
  placeholder = '# Project name\noutcome: Done when …\ntarget: 2026-12-31 soft\n\n## Milestone\n- First task [S]',
}: {
  value: string
  onChange: (value: string) => void
  /** Called with the latest parse result (initially, then ~200ms after each edit). */
  onParse?: (result: ParseResult) => void
  label?: string
  placeholder?: string
  /** Extra classes for the preview pane (e.g. a max height on desktop). */
  previewClassName?: string
  /** Show the preview inside a card (full pages; dialogs keep it plain). */
  previewCard?: boolean
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
  const preview = hasText ? (
    <OutlinePreview doc={parsed.doc} />
  ) : (
    <p className="text-sm text-muted-foreground">Paste or type an outline to see the plan here.</p>
  )

  return (
    <div data-tab={tab}>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Edit or preview"
        value={tab}
        onValueChange={(v) => {
          if (v === 'edit' || v === 'preview') setTab(v)
        }}
        className="mb-3 w-full lg:hidden"
      >
        <ToggleGroupItem value="edit" className="flex-1">
          Edit
        </ToggleGroupItem>
        <ToggleGroupItem value="preview" className="flex-1">
          Preview
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className={cn('min-w-0', tab === 'preview' && 'max-lg:hidden')}>
          <Textarea
            ref={areaRef}
            aria-label={label}
            className="field-sizing-fixed min-h-[22rem] resize-y font-mono text-[13px] leading-6 md:text-[13px] lg:min-h-[34rem]"
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
        <div
          className={cn('min-w-0', tab === 'edit' && 'max-lg:hidden', !previewCard && previewClassName)}
          aria-label="Preview"
          role="region"
        >
          {previewCard ? (
            <Card size="sm" className="gap-0 py-0">
              <CardContent className={cn('py-4', previewClassName)}>{preview}</CardContent>
            </Card>
          ) : (
            preview
          )}
        </div>
      </div>
    </div>
  )
}
