import { CHANNELS, HERO, SIGN_UP } from "../_lib/content"
import { GoButton } from "./go-button"
import { ChannelIcon } from "./marks"

// The painted workshop from the top of the page, the title on its sky, the button, and the chat apps. On a phone the painting moves under the words, in two crops.
export function Hero() {
  return (
    <section className="hero solo">
      <div className="hero-art" aria-hidden />
      <div className="hero-top">
        <div className="wrap">
          <h1 className="h1">
            {HERO.first}
            <em>{HERO.second}</em>
          </h1>
          <p className="sub">
            {HERO.lines[0]} <br />
            {HERO.lines[1]}
          </p>
          <GoButton href={SIGN_UP}>{HERO.button}</GoButton>
          <p className="free">{HERO.free}</p>
          <p className="chatsline">
            <span className="lbl">{HERO.chatsOn}</span>
            {CHANNELS.map((channel) => (
              <span key={channel.id} title={channel.name}>
                <ChannelIcon channel={channel.id} size={22} />
              </span>
            ))}
          </p>
        </div>
        <div className="hero-crops" aria-hidden>
          <i />
          <i />
        </div>
      </div>
      <div className="fig">
        <span>{HERO.figure}</span>
        <em>{HERO.caption}</em>
      </div>
    </section>
  )
}
