export default function AuthForm({
  onSubmit,
  loading,
  error,
  buttonText,
  children,
}) {
  return (
    <form onSubmit={onSubmit}>
      {children}

      {error && (
        <p className="mb-3 text-sm text-red-500">{error}</p>
      )}

      <button
        disabled={loading}
        className="w-full rounded-md bg-black py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? "Please wait…" : buttonText}
      </button>
    </form>
  )
}
