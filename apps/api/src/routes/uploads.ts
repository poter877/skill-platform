import { Hono } from 'hono'
import { saveUpload } from '../lib/storage'

export const uploadsRouter = new Hono()

uploadsRouter.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null

    if (!file) return c.json({ error: 'No file provided' }, 400)

    const buffer = await file.arrayBuffer()
    const { path, key } = await saveUpload(file.name, buffer)

    return c.json({ key, filename: file.name, path })
  } catch (err) {
    console.error('Upload failed:', err)
    return c.json({ error: 'Upload failed' }, 500)
  }
})
