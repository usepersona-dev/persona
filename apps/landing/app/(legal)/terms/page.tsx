import type { Metadata } from "next"

import { LegalContent, LegalDescription, LegalHeader, LegalTitle } from "../_components/legal-layout"
import terms from "./terms.md"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Persona, by Odinex, Inc.",
}

export default function TermsPage() {
  return (
    <>
      <LegalHeader>
        <LegalTitle>Terms of Service</LegalTitle>
        <LegalDescription>Last updated October 27, 2026</LegalDescription>
      </LegalHeader>
      <LegalContent>{terms}</LegalContent>
    </>
  )
}
