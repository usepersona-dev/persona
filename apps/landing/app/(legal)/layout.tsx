import "@/app/(landing)/factory.css"
import { Footer } from "@/app/(landing)/_components/footer"

import { LegalLayout } from "./_components/legal-layout"

// The landing's own footer closes the legal pages. Its rules are scoped under .factory, so only the footer gets the class and the legal text keeps its own styles.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <LegalLayout>
      {children}
      <div className="factory">
        <Footer />
      </div>
    </LegalLayout>
  )
}
