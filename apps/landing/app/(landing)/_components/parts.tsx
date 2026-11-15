import { Brain, Cpu, Lock, MessageCircle, Plug, Repeat, ScrollText, Sparkles, Terminal, Webhook, type LucideIcon } from "lucide-react"

import { PARTS, type PartPanel } from "../_lib/content"
import { Icon } from "./marks"
import { ApiPanel, AppsPanel, AutomationsPanel, ChannelsPanel, ModelsPanel, NotesPanel, RulesPanel, SkillsPanel, TriggersPanel, VaultPanel } from "./panels"

const PANELS: Record<PartPanel, { icon: LucideIcon; body: () => React.ReactNode }> = {
  models: { icon: Cpu, body: ModelsPanel },
  rules: { icon: ScrollText, body: RulesPanel },
  skills: { icon: Sparkles, body: SkillsPanel },
  apps: { icon: Plug, body: AppsPanel },
  automations: { icon: Repeat, body: AutomationsPanel },
  triggers: { icon: Webhook, body: TriggersPanel },
  channels: { icon: MessageCircle, body: ChannelsPanel },
  notes: { icon: Brain, body: NotesPanel },
  vault: { icon: Lock, body: VaultPanel },
  api: { icon: Terminal, body: ApiPanel },
}

// "Everything an agent needs": ten framed plates, each a small panel of the app with a numbered caption
export function Parts() {
  return (
    <section className="gallery wrap" id="product" aria-labelledby="parts-title">
      <p className="eyebrow">{PARTS.eyebrow}</p>
      <h2 className="h2" id="parts-title">
        {PARTS.title[0]}
        <br />
        {PARTS.title[1]}
      </h2>
      <p className="lede">{PARTS.lede}</p>
      <div className="plates">
        {PARTS.items.map((part, index) => {
          const { icon, body: Body } = PANELS[part.panel]
          return (
            <article key={part.panel} className="plate">
              <div className="frame">
                <div className="strip">
                  <Icon of={icon} size={14} />
                  {part.label}
                </div>
                <div className="body ui">
                  <Body />
                </div>
              </div>
              <div className="cap">
                <i>{String(index + 1).padStart(2, "0")}</i>
                <h3>{part.title}</h3>
                <p>{part.text}</p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
