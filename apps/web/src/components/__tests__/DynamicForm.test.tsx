import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DynamicForm } from '../DynamicForm'
import type { FormField } from '@skill-plant/shared'

// Mock next/link just in case
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const textField: FormField = {
  name: 'title',
  type: 'text',
  label: 'Title',
  required: true,
}

const textareaField: FormField = {
  name: 'description',
  type: 'textarea',
  label: 'Description',
  required: false,
  placeholder: 'Enter description',
}

const numberField: FormField = {
  name: 'count',
  type: 'number',
  label: 'Count',
  required: false,
}

const urlField: FormField = {
  name: 'website',
  type: 'url',
  label: 'Website',
  required: false,
}

const selectField: FormField = {
  name: 'language',
  type: 'select',
  label: 'Language',
  required: false,
  options: ['English', 'French', 'German'],
}

const multiselectField: FormField = {
  name: 'tags',
  type: 'multiselect',
  label: 'Tags',
  required: false,
  options: ['AI', 'ML', 'NLP'],
}

const fileField: FormField = {
  name: 'upload',
  type: 'file',
  label: 'Upload File',
  required: false,
  accept: ['.pdf', '.txt'],
}

describe('DynamicForm', () => {
  const mockSubmit = vi.fn()

  beforeEach(() => {
    mockSubmit.mockClear()
  })

  test('renders text field with label', () => {
    render(<DynamicForm fields={[textField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
  })

  test('renders textarea field with placeholder', () => {
    render(<DynamicForm fields={[textareaField]} onSubmit={mockSubmit} />)
    expect(screen.getByPlaceholderText('Enter description')).toBeInTheDocument()
  })

  test('renders number field', () => {
    render(<DynamicForm fields={[numberField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Count')).toBeInTheDocument()
  })

  test('renders url field', () => {
    render(<DynamicForm fields={[urlField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Website')).toBeInTheDocument()
  })

  test('renders select field with options', () => {
    render(<DynamicForm fields={[selectField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Language')).toBeInTheDocument()
  })

  test('renders multiselect field with checkboxes', () => {
    render(<DynamicForm fields={[multiselectField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('ML')).toBeInTheDocument()
    expect(screen.getByText('NLP')).toBeInTheDocument()
  })

  test('renders file field', () => {
    render(<DynamicForm fields={[fileField]} onSubmit={mockSubmit} />)
    expect(screen.getByText('Upload File')).toBeInTheDocument()
  })

  test('renders submit button', () => {
    render(<DynamicForm fields={[textField]} onSubmit={mockSubmit} />)
    expect(screen.getByRole('button', { name: /run skill/i })).toBeInTheDocument()
  })

  test('shows loading state when isSubmitting', () => {
    render(<DynamicForm fields={[textField]} onSubmit={mockSubmit} isSubmitting />)
    const button = screen.getByRole('button', { name: /running/i })
    expect(button).toBeDisabled()
  })

  test('shows validation error for required field', async () => {
    const user = userEvent.setup()
    render(<DynamicForm fields={[textField]} onSubmit={mockSubmit} />)

    await user.click(screen.getByRole('button', { name: /run skill/i }))

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument()
    })
    expect(mockSubmit).not.toHaveBeenCalled()
  })

  test('submits form with valid data', async () => {
    const user = userEvent.setup()
    render(<DynamicForm fields={[textField]} onSubmit={mockSubmit} />)

    const input = screen.getByRole('textbox')
    await user.type(input, 'My Title')
    await user.click(screen.getByRole('button', { name: /run skill/i }))

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({ title: 'My Title' })
    })
  })

  test('renders multiple fields', () => {
    render(
      <DynamicForm
        fields={[textField, textareaField, numberField]}
        onSubmit={mockSubmit}
      />
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Count')).toBeInTheDocument()
  })
})
