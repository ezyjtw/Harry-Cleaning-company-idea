import { render, screen, fireEvent } from '@testing-library/react'
import Button from '@/components/ui/Button'

// Mock the Spinner component
jest.mock('@/components/ui/Spinner', () => {
  return function MockSpinner({ size }: { size?: string }) {
    return <span data-testid="spinner" data-size={size}>Loading spinner</span>
  }
})

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click Me</Button>)
    expect(screen.getByRole('button', { name: 'Click Me' })).toBeInTheDocument()
  })

  it('renders as a button element', () => {
    render(<Button>Test</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  // Click events
  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn()
    render(
      <Button onClick={handleClick} disabled>
        Click
      </Button>
    )

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('does not call onClick when loading', () => {
    const handleClick = jest.fn()
    render(
      <Button onClick={handleClick} loading>
        Click
      </Button>
    )

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).not.toHaveBeenCalled()
  })

  // Loading state
  it('shows loading state with spinner', () => {
    render(<Button loading>Submit</Button>)

    expect(screen.getByTestId('spinner')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('hides children text when loading', () => {
    render(<Button loading>Submit</Button>)

    expect(screen.queryByText('Submit')).not.toBeInTheDocument()
  })

  it('shows children when not loading', () => {
    render(<Button>Submit</Button>)

    expect(screen.getByText('Submit')).toBeInTheDocument()
    expect(screen.queryByTestId('spinner')).not.toBeInTheDocument()
  })

  // Disabled state
  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>)

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies disabled styles', () => {
    render(<Button disabled>Test</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('disabled:cursor-not-allowed')
    expect(button.className).toContain('disabled:opacity-50')
  })

  // Variant classes
  it('applies primary variant classes by default', () => {
    render(<Button>Primary</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-brand-600')
    expect(button.className).toContain('text-white')
  })

  it('applies secondary variant classes', () => {
    render(<Button variant="secondary">Secondary</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-white')
    expect(button.className).toContain('text-brand-700')
  })

  it('applies danger variant classes', () => {
    render(<Button variant="danger">Danger</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-red-600')
    expect(button.className).toContain('text-white')
  })

  it('applies ghost variant classes', () => {
    render(<Button variant="ghost">Ghost</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-transparent')
    expect(button.className).toContain('text-gray-700')
  })

  // Size classes
  it('applies medium size by default', () => {
    render(<Button>Medium</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('px-4')
    expect(button.className).toContain('py-2')
  })

  it('applies small size classes', () => {
    render(<Button size="sm">Small</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('px-3')
    expect(button.className).toContain('py-1.5')
  })

  it('applies large size classes', () => {
    render(<Button size="lg">Large</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('px-6')
    expect(button.className).toContain('py-3')
  })

  // Full width
  it('applies full width class when fullWidth is true', () => {
    render(<Button fullWidth>Full Width</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('w-full')
  })

  it('does not apply full width class by default', () => {
    render(<Button>Normal Width</Button>)

    const button = screen.getByRole('button')
    expect(button.className).not.toContain('w-full')
  })

  // Custom className
  it('accepts additional custom className', () => {
    render(<Button className="my-custom-class">Custom</Button>)

    const button = screen.getByRole('button')
    expect(button.className).toContain('my-custom-class')
  })

  // HTML attributes
  it('passes through HTML button attributes', () => {
    render(
      <Button type="submit" aria-label="Submit form">
        Submit
      </Button>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveAttribute('aria-label', 'Submit form')
  })

  // Display name
  it('has a display name for dev tools', () => {
    expect(Button.displayName).toBe('Button')
  })
})
