import { ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { useApply, useImageSrc, useSnapshot } from '../../data/hooks'
import { useServices } from '../../data/services'
import { makeResource } from '../../domain/factories'
import type { ID, Milestone, Resource } from '../../domain/types'
import { hostnameOf, isImageUrl, normalizeUrl } from './resourceUrl'

/** Soft limit: the counter turns to a warning past it, saving is never blocked. */
const DESCRIPTION_SOFT_LIMIT = 200

type ImageMode = 'upload' | 'link'

interface Props {
  projectId: ID
  /** Edit this resource; omit to add one. */
  resource?: Resource
  /** The project's workstreams, in order. */
  workstreams: Milestone[]
  onClose: () => void
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <div className="text-xs text-muted-foreground">{hint}</div>
      )}
    </div>
  )
}

/** Add or edit a resource: link, optional title and description, an uploaded or linked image, workstreams. */
export function ResourceDialog({ projectId, resource, workstreams, onClose }: Props) {
  const apply = useApply()
  const { repo } = useServices()
  const { data } = useSnapshot()
  const uid = useId()
  const fileInput = useRef<HTMLInputElement>(null)

  const [url, setUrl] = useState(resource?.url ?? '')
  const [title, setTitle] = useState(resource?.title ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [mode, setMode] = useState<ImageMode>(resource?.imageUrl && !resource.imagePath ? 'link' : 'upload')
  const [imagePath, setImagePath] = useState<string | null>(resource?.imagePath ?? null)
  const [imageLink, setImageLink] = useState(resource?.imageUrl ?? '')
  const [linkFailed, setLinkFailed] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [workstreamIds, setWorkstreamIds] = useState<ID[]>(resource?.workstreamIds ?? [])
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  // Uploads made in this dialog that were not saved must not be left behind in storage.
  const uploaded = useRef(new Set<string>())
  const saved = useRef(false)
  useEffect(
    () => () => {
      if (saved.current) return
      for (const path of uploaded.current) void repo.deleteImage(path).catch(() => undefined)
    },
    [repo],
  )

  const previewSrc = useImageSrc({ imagePath, imageUrl: null })
  const normalizedUrl = normalizeUrl(url)
  const urlError = submitted && !normalizedUrl ? 'Enter a web link, like https://example.com.' : null
  const trimmedLink = imageLink.trim()
  const linkError = submitted && mode === 'link' && trimmedLink && !isImageUrl(trimmedLink)
  const overLimit = description.length > DESCRIPTION_SOFT_LIMIT

  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const path = await repo.uploadImage(file)
      uploaded.current.add(path)
      // A replaced upload from this dialog is no longer needed.
      if (imagePath && uploaded.current.has(imagePath)) {
        uploaded.current.delete(imagePath)
        void repo.deleteImage(imagePath).catch(() => undefined)
      }
      setImagePath(path)
      setLinkFailed(false)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'The image could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    if (mode === 'upload') {
      if (imagePath && uploaded.current.has(imagePath)) {
        uploaded.current.delete(imagePath)
        void repo.deleteImage(imagePath).catch(() => undefined)
      }
      setImagePath(null)
      setUploadError(null)
    } else {
      setImageLink('')
      setLinkFailed(false)
    }
  }

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setDragging(false)
    void upload(e.dataTransfer.files[0])
  }

  const toggleWorkstream = (id: ID, on: boolean) =>
    setWorkstreamIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)))

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (!normalizedUrl || uploading) return
    if (mode === 'link' && trimmedLink && !isImageUrl(trimmedLink)) return
    setSaving(true)
    try {
      const finalPath = mode === 'upload' ? imagePath : null
      const fields = {
        url: normalizedUrl,
        title: title.trim(),
        description: description.trim(),
        imagePath: finalPath,
        imageUrl: mode === 'link' && trimmedLink ? trimmedLink : null,
        // Keep the grid order of the workstreams, not the click order.
        workstreamIds: workstreams.filter((w) => workstreamIds.includes(w.id)).map((w) => w.id),
      }
      const positions = (data?.resources ?? [])
        .filter((r) => r.projectId === projectId)
        .map((r) => r.position)
      const position = Math.max(-1, ...positions) + 1
      const next = resource ? { ...resource, ...fields } : makeResource({ projectId, position, ...fields })
      await apply({ kind: 'saveResources', resources: [next] })
      saved.current = true
      // Storage clean-up: the previous upload when it was replaced or removed, and unused uploads from here.
      const unused = new Set(uploaded.current)
      if (resource?.imagePath) unused.add(resource.imagePath)
      if (finalPath) unused.delete(finalPath)
      for (const path of unused) void repo.deleteImage(path).catch(() => undefined)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const host = normalizedUrl ? hostnameOf(normalizedUrl) : ''
  const hasUpload = mode === 'upload' && imagePath !== null
  const hasLink = mode === 'link' && trimmedLink !== '' && isImageUrl(trimmedLink)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg max-sm:h-[100dvh] max-sm:max-h-none max-sm:max-w-none max-sm:rounded-none max-sm:border-0"
        onOpenAutoFocus={(e) => {
          // Focus the link without the keyboard popping up on phones.
          e.preventDefault()
          if (!window.matchMedia('(pointer: coarse)').matches) document.getElementById(`${uid}-url`)?.focus()
        }}
      >
        <DialogHeader className="gap-1 px-4 pt-5 pb-3 text-left sm:px-6">
          <DialogTitle className="text-base">{resource ? 'Edit resource' : 'Add resource'}</DialogTitle>
          <DialogDescription>A link that helps with this project.</DialogDescription>
        </DialogHeader>

        <form
          id={`${uid}-form`}
          className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-2 sm:px-6"
          onSubmit={(e) => void save(e)}
          noValidate
        >
          <Field label="Link" htmlFor={`${uid}-url`} error={urlError}>
            <Input
              id={`${uid}-url`}
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com/page"
              value={url}
              aria-invalid={urlError ? true : undefined}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>

          <Field label="Title (optional)" htmlFor={`${uid}-title`}>
            <Input
              id={`${uid}-title`}
              placeholder={host || 'Defaults to the site name'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>

          <Field
            label="Description (optional)"
            htmlFor={`${uid}-description`}
            hint={
              <span className={cn('tabular-nums', overLimit && 'text-warning')}>
                {`${description.length}/${DESCRIPTION_SOFT_LIMIT}`}
              </span>
            }
          >
            <Textarea
              id={`${uid}-description`}
              rows={3}
              className="min-h-16"
              placeholder="Why is this useful?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid content-start gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-normal text-muted-foreground">Image (optional)</Label>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-label="Image source"
                value={mode}
                onValueChange={(v) => v && setMode(v as ImageMode)}
              >
                <ToggleGroupItem value="upload" className="data-[state=on]:font-medium">
                  Upload
                </ToggleGroupItem>
                <ToggleGroupItem value="link" className="data-[state=on]:font-medium">
                  Link
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {mode === 'upload' && !hasUpload && (
              <label
                htmlFor={`${uid}-file`}
                data-dragging={dragging}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/50 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 data-[dragging=true]:bg-muted"
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                <span>{uploading ? 'Uploading…' : 'Drop an image here, or choose a file'}</span>
                <span className="text-xs text-muted-foreground/60">PNG, JPG, GIF or WebP · up to 5 MB</span>
                <input
                  ref={fileInput}
                  id={`${uid}-file`}
                  type="file"
                  accept="image/*"
                  aria-label="Upload image"
                  className="sr-only"
                  onChange={(e) => {
                    void upload(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            )}

            {mode === 'link' && (
              <Input
                id={`${uid}-image-link`}
                type="text"
                inputMode="url"
                autoComplete="off"
                aria-label="Image link"
                placeholder="https://example.com/picture.jpg"
                value={imageLink}
                aria-invalid={linkError ? true : undefined}
                onChange={(e) => {
                  setImageLink(e.target.value)
                  setLinkFailed(false)
                }}
              />
            )}
            {uploadError && mode === 'upload' && (
              <p role="alert" className="text-xs text-destructive">
                {uploadError}
              </p>
            )}
            {linkError && (
              <p className="text-xs text-destructive">Enter an image link starting with https://.</p>
            )}

            {(hasUpload || hasLink) && (
              <div className="relative overflow-hidden rounded-2xl bg-muted">
                {(hasUpload ? previewSrc : trimmedLink) && !linkFailed ? (
                  <img
                    src={(hasUpload ? previewSrc : trimmedLink) ?? undefined}
                    alt="Image preview"
                    onError={() => setLinkFailed(true)}
                    className="aspect-video max-h-44 w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-video max-h-44 place-items-center text-xs text-muted-foreground">
                    {linkFailed ? 'This image could not be loaded.' : 'Loading preview…'}
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X /> Remove image
                </Button>
              </div>
            )}
          </div>

          <fieldset className="grid content-start gap-2">
            <legend className="mb-1 text-xs text-muted-foreground">Workstreams</legend>
            {workstreams.length === 0 ? (
              <p className="text-sm text-muted-foreground">This project has no workstreams yet.</p>
            ) : (
              <div className="grid gap-1 sm:grid-cols-2">
                {workstreams.map((w) => (
                  <label
                    key={w.id}
                    className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-1 text-sm"
                  >
                    <Checkbox
                      checked={workstreamIds.includes(w.id)}
                      onCheckedChange={(on) => toggleWorkstream(w.id, on === true)}
                      aria-label={w.name}
                    />
                    <span className="min-w-0 truncate">{w.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {workstreamIds.length === 0
                ? 'None selected: the resource is project-wide and stays in colour in every focus.'
                : 'Shown in colour when you focus on any of these workstreams.'}
            </p>
          </fieldset>
        </form>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={`${uid}-form`} disabled={saving || uploading}>
            {resource ? 'Save' : 'Add resource'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
