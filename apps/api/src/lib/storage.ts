import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/skill-plant-uploads'

export async function saveUpload(
  filename: string,
  buffer: ArrayBuffer,
): Promise<{ path: string; key: string }> {
  const key = randomUUID()
  const dir = join(UPLOAD_DIR, key)
  await mkdir(dir, { recursive: true })
  const path = join(dir, filename)
  await writeFile(path, Buffer.from(buffer))
  return { path, key }
}

export async function getUploadPath(key: string, filename: string): Promise<string> {
  return join(UPLOAD_DIR, key, filename)
}
