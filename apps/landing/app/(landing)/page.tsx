import { Cta } from "./_components/cta"
import { Footer } from "./_components/footer"
import { Hero } from "./_components/hero"
import { HowTo } from "./_components/how-to"
import { Inside } from "./_components/inside"
import { Nav } from "./_components/nav"
import { Parts } from "./_components/parts"
import { Questions } from "./_components/questions"

export default function Page() {
  return (
    <>
      <div id="top" />
      <Nav />
      <main>
        <Hero />
        <Inside />
        <Parts />
        <HowTo />
        <Questions />
        <Cta />
      </main>
      <Footer />
    </>
  )
}
