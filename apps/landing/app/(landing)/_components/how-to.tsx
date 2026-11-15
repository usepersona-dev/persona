import { ArrowRight } from "lucide-react"
import Image from "next/image"

import { CHANNELS, DOCS, HOW_TO, type Chapter } from "../_lib/content"
import { HowToTabs } from "./how-to-tabs"
import { AppLogo, ChannelIcon, Icon } from "./marks"

// "How to build a business of personal AI agents": three chapters, one shown at a time, chosen on the left
export function HowTo() {
  return (
    <section className="sect" id="how" aria-labelledby="how-title">
      <div className="wrap howhead">
        <p className="eyebrow">{HOW_TO.eyebrow}</p>
        <h2 className="h2" id="how-title">
          {HOW_TO.title}
        </h2>
        <p className="lede">{HOW_TO.lede}</p>
      </div>
      <HowToTabs
        chapters={HOW_TO.chapters.map(({ id, short }) => ({ id, short }))}
        panels={HOW_TO.chapters.map((chapter, index) => (
          <ChapterBody key={chapter.id} chapter={chapter} number={index + 1} />
        ))}
        note={HOW_TO.note}
      />
    </section>
  )
}

function ChapterBody({ chapter, number }: { chapter: Chapter; number: number }) {
  const { picture } = chapter
  return (
    <>
      <div className="frame">
        <Image src={picture.src} alt={picture.alt} width={picture.width} height={picture.height} sizes="(max-width: 860px) 100vw, 360px" style={{ objectPosition: picture.position }} />
      </div>
      <div>
        <span className="eyebrow">Chapter {number}</span>
        <h3>{chapter.title}</h3>
        <p className="sum">{chapter.text}</p>
        <ol className="steps">
          {chapter.steps.map((step, index) => (
            <li key={step.title}>
              <i>
                {number}.{index + 1}
              </i>
              <b>{step.title}</b>
              <span>{step.text}</span>
              {"apps" in step && step.apps && (
                <span className="logos">
                  {step.apps.map((app) => (
                    <span key={app} className="tilebox">
                      <AppLogo app={app} size={16} />
                    </span>
                  ))}
                </span>
              )}
              {"channels" in step && step.channels && (
                <span className="logos">
                  {CHANNELS.map((channel) => (
                    <ChannelIcon key={channel.id} channel={channel.id} size={28} />
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
        <a className="more" href={`${DOCS}${chapter.more.href}`}>
          {chapter.more.label} <Icon of={ArrowRight} size={14} />
        </a>
      </div>
    </>
  )
}
