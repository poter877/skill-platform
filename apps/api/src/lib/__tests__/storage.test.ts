import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { saveUpload, getUploadPath } from '../storage'

// Mock node:fs/promises
const mockMkdir = mock(() => Promise.resolve(undefined))
const mockWriteFile = mock(() => Promise.resolve(undefined))

mock.module('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}))

// Mock node:crypto
const MOCK_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
mock.module('node:crypto', () => ({
  randomUUID: () => MOCK_UUID,
}))

describe('saveUpload', () => {
  beforeEach(() => {
    mockMkdir.mockClear()
    mockWriteFile.mockClear()
  })

  test('creates directory and writes file', async () => {
    const buffer = new ArrayBuffer(4)
    const result = await saveUpload('test.pdf', buffer)

    expect(mockMkdir).toHaveBeenCalledTimes(1)
    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    expect(result.key).toBe(MOCK_UUID)
  })

  test('returns correct path with key and filename', async () => {
    const result = await saveUpload('doc.txt', new ArrayBuffer(0))
    expect(result.path).toContain(MOCK_UUID)
    expect(result.path).toContain('doc.txt')
  })

  test('creates directory recursively', async () => {
    await saveUpload('test.pdf', new ArrayBuffer(0))
    expect(mockMkdir).toHaveBeenCalledWith(expect.stringContaining(MOCK_UUID), { recursive: true })
  })
})

describe('getUploadPath', () => {
  test('returns correct path', async () => {
    const path = await getUploadPath('some-key', 'file.pdf')
    expect(path).toContain('some-key')
    expect(path).toContain('file.pdf')
  })
})
