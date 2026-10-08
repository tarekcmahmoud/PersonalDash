/** Upload rules shared by every backend: images only, at most 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export function checkImage(file: File): void {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be uploaded.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller.')
}

/** Lower-case file extension for a storage path ('png'), from the file name, else the mime type, else 'img'. */
export function imageExtension(file: { name: string; type: string }): string {
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1]
  const fromType = /^image\/([a-z0-9]+)/i.exec(file.type)?.[1]
  return (fromName ?? fromType ?? 'img').toLowerCase()
}
