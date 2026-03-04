'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from '@/components/ui/form'
import { API_BASE_URL } from '@/lib/api'
import type { FormField as SkillFormField } from '@skill-plant/shared'

interface DynamicFormProps {
  fields: SkillFormField[]
  onSubmit: (data: Record<string, string>) => void
  isSubmitting?: boolean
}

function buildSchema(fields: SkillFormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  const defaults: Record<string, unknown> = {}

  for (const field of fields) {
    defaults[field.name] = field.default ?? ''

    if (field.type === 'number') {
      shape[field.name] = field.required
        ? z.coerce.number({ invalid_type_error: `${field.label} must be a number` })
        : z.coerce.number().optional()
    } else if (field.type === 'url') {
      shape[field.name] = field.required
        ? z.string().url(`${field.label} must be a valid URL`).min(1, `${field.label} is required`)
        : z.string().url(`${field.label} must be a valid URL`).optional().or(z.literal(''))
    } else if (field.type === 'file') {
      shape[field.name] = z.string().optional()
    } else {
      shape[field.name] = field.required
        ? z.string().min(1, `${field.label} is required`)
        : z.string().optional()
    }
  }

  return { schema: z.object(shape), defaults }
}

export function DynamicForm({ fields, onSubmit, isSubmitting }: DynamicFormProps) {
  const { schema, defaults } = useMemo(() => buildSchema(fields), [fields])
  const form = useForm({ resolver: zodResolver(schema), defaultValues: defaults })
  const fileRefs = useRef<Record<string, File>>({})

  async function handleSubmit(values: Record<string, unknown>) {
    try {
      const resolved: Record<string, string> = {}

      for (const [key, value] of Object.entries(values)) {
        const field = fields.find(f => f.name === key)
        if (field?.type === 'file' && fileRefs.current[key]) {
          const formData = new FormData()
          formData.append('file', fileRefs.current[key])
          const res = await fetch(`${API_BASE_URL}/uploads`, {
            method: 'POST',
            body: formData,
          })
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
          const { path } = await res.json()
          resolved[key] = path
        } else {
          resolved[key] = String(value ?? '')
        }
      }

      onSubmit(resolved)
    } catch (err) {
      form.setError('root', {
        message: err instanceof Error ? err.message : 'Submit failed',
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {fields.map(field => (
          <FormField
            key={field.name}
            control={form.control}
            name={field.name}
            render={({ field: rhfField }) => (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  {field.type === 'file' ? (
                    <Input
                      type="file"
                      accept={field.accept?.join(',')}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          fileRefs.current[field.name] = file
                          rhfField.onChange(file.name)
                        }
                      }}
                    />
                  ) : field.type === 'textarea' ? (
                    <Textarea placeholder={field.placeholder} {...rhfField} />
                  ) : field.type === 'select' ? (
                    <Select onValueChange={rhfField.onChange} value={rhfField.value as string}>
                      <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'multiselect' ? (
                    <div className="space-y-2">
                      {field.options?.map(opt => (
                        <label key={opt} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            value={opt}
                            checked={(rhfField.value as string ?? '').split(',').filter(Boolean).includes(opt)}
                            onChange={e => {
                              const current = (rhfField.value as string ?? '').split(',').filter(Boolean)
                              const next = e.target.checked
                                ? [...current, opt]
                                : current.filter(v => v !== opt)
                              rhfField.onChange(next.join(','))
                            }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Input
                      type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                      placeholder={field.placeholder}
                      {...rhfField}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}

        {form.formState.errors.root && (
          <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Running...' : '▶ Run Skill'}
        </Button>
      </form>
    </Form>
  )
}
