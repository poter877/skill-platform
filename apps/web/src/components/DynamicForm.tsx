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
import type { FormField as SkillFormField } from '@skill-plant/shared'

interface DynamicFormProps {
  fields: SkillFormField[]
  onSubmit: (data: Record<string, string>) => void
  isSubmitting?: boolean
}

// Build a Zod schema dynamically from field definitions
function buildZodSchema(fields: SkillFormField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    let validator: z.ZodTypeAny = z.string()
    if (field.required) {
      validator = z.string().min(1, `${field.label} is required`)
    } else {
      validator = z.string().optional()
    }
    shape[field.name] = validator
  }
  return z.object(shape)
}

export function DynamicForm({ fields, onSubmit, isSubmitting }: DynamicFormProps) {
  const schema = useMemo(() => buildZodSchema(fields), [fields])
  const form = useForm({ resolver: zodResolver(schema) })
  const fileRefs = useRef<Record<string, File>>({})

  async function handleSubmit(values: Record<string, unknown>) {
    // For file fields, upload first then replace value with returned path
    const resolved: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      const field = fields.find(f => f.name === key)
      if (field?.type === 'file' && fileRefs.current[key]) {
        const formData = new FormData()
        formData.append('file', fileRefs.current[key])
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/uploads`, {
          method: 'POST',
          body: formData,
        })
        const { path } = await res.json()
        resolved[key] = path
      } else {
        resolved[key] = value as string
      }
    }
    onSubmit(resolved)
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
                    <Select onValueChange={rhfField.onChange} defaultValue={field.default}>
                      <SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger>
                      <SelectContent>
                        {field.options?.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Running...' : '▶ Run Skill'}
        </Button>
      </form>
    </Form>
  )
}
