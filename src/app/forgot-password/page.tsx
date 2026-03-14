'use client'

import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Please enter your email address.')
      return
    }

    setIsLoading(true)

    // TODO: Replace with real password reset API call
    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsLoading(false)
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {submitted ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Check Your Email</h1>
            <p className="mt-3 text-gray-600">
              If an account exists for <span className="font-medium text-gray-900">{email}</span>, we&apos;ve sent password reset instructions to your inbox.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Didn&apos;t receive an email? Check your spam folder or try again.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => { setSubmitted(false); setEmail('') }}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Try Another Email
              </button>
              <Link
                href="/login"
                className="block w-full rounded-lg bg-brand-600 py-2.5 text-center font-semibold text-white hover:bg-brand-700"
              >
                Back to Log In
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="text-center text-3xl font-bold text-gray-900">
              Forgot Password?
            </h1>
            <p className="mt-2 text-center text-gray-600">
              Enter your email and we&apos;ll send you instructions to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600">
              Remember your password?{' '}
              <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                Log in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
