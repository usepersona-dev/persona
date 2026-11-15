import Link from "next/link"

import { FOOTER } from "../_lib/content"
import { Mark } from "./marks"

// The footer: the about block and three link columns, the legal row, then the balcony painting as the last thing on the page. The legal pages use it too, so the logo goes to the landing's top from anywhere.
export function Footer() {
  return (
    <footer className="foot foot-end">
      <div className="wrap foot-grid">
        <div className="about">
          <Link className="logo" href="/#top">
            <Mark />
            persona
          </Link>
          <p>{FOOTER.tagline}</p>
          <p>{FOOTER.about}</p>
        </div>
        {FOOTER.columns.map((column) => (
          <div key={column.title}>
            <h4>{column.title}</h4>
            <ul>
              {column.links.map((link) => (
                <li key={link.label}>{link.href.startsWith("/") ? <Link href={link.href}>{link.label}</Link> : <a href={link.href}>{link.label}</a>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="wrap legal">
        <span>© 2026 Persona</span>
        <span>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
      </div>
      <div className="foot-art" role="img" aria-label="A painting of cloud agents resting on a balcony over a bay" />
    </footer>
  )
}
