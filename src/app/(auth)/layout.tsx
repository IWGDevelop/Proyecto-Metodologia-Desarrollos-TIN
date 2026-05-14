export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-50 px-4"
      style={{
        backgroundImage:
          'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {children}
    </div>
  )
}
