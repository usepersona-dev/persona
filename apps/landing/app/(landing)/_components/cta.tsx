import { CTA, SIGN_UP } from "../_lib/content"
import { GoButton } from "./go-button"

// The closing card: the question, one line, the button, and the dusk painting of many agents in its lower part
export function Cta() {
  return (
    <section className="cta-box" aria-labelledby="close-title">
      <div className="copy">
        <h2 className="h1" id="close-title">
          {CTA.title} <em>{CTA.last}</em>
        </h2>
        <p className="sub">{CTA.text}</p>
        <GoButton href={SIGN_UP}>{CTA.button}</GoButton>
        <p className="free">{CTA.free}</p>
      </div>
      <div className="cta-box-art" role="img" aria-label="A painting of a dusk sky full of small cloud agents over a hill town" />
    </section>
  )
}
