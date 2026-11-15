// The vault link's frame: the form alone in the middle of the page
export default function CollectLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-[400px]">{children}</div>
    </main>
  )
}
