import type { Metadata } from "next"

import { LegalContent, LegalDescription, LegalHeader, LegalTitle } from "../_components/legal-layout"
import privacy from "./privacy.md"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Odinex, Inc. collects, uses, shares and protects personal information through Persona.",
}

export default function PrivacyPage() {
  return (
    <>
      <LegalHeader>
        <LegalTitle>Privacy Policy</LegalTitle>
        <LegalDescription>Last updated November 6, 2026</LegalDescription>
      </LegalHeader>
      <LegalContent>{privacy}</LegalContent>
    </>
  )
}
