import { ArrowUp, Brain, Cpu, FileText, Link as LinkIcon, Lock, Plus, Repeat, Sparkles, Webhook } from "lucide-react"
import Image from "next/image"
import { Fragment } from "react"

import { CHANNELS } from "../_lib/content"
import { APPS, AUTOMATIONS, CHAT, MEMORY, MODELS, NOTES, PHONE_CHAT, RULES, SKILLS, USAGE } from "../_lib/example"
import { face } from "../_lib/faces"
import { AppLogo, ChannelIcon, Icon } from "./marks"

// The app's panels, drawn small for the window and the ten parts. The data is the bakery example.

function Head({ title, text }: { title: string; text: string }) {
  return (
    <div className="phead">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  )
}

function Row({ tile, brand, title, text, end }: { tile?: React.ReactNode; brand?: boolean; title: React.ReactNode; text?: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="row">
      {tile && <span className={brand ? "tile brand" : "tile"}>{tile}</span>}
      <span className="tx">
        <b>{title}</b>
        {text && <span>{text}</span>}
      </span>
      {end}
    </div>
  )
}

const Switch = ({ on }: { on: boolean }) => <span className={on ? "sw on" : "sw"} />
const Chip = ({ ok, children }: { ok?: boolean; children: React.ReactNode }) => <span className={ok ? "chip ok" : "chip"}>{children}</span>
const SmallButton = ({ children }: { children: React.ReactNode }) => <span className="btn-s">{children}</span>

export function Face({ seed, size }: { seed: string; size: number }) {
  return <Image unoptimized src={face(seed)} alt="" width={size} height={size} />
}

export function ChatPanel() {
  return (
    <>
      <div className="chat">
        {CHAT.map((message) => (
          <div key={message.text} className={`msg ${message.from}`}>
            {message.text}
          </div>
        ))}
        <div className="evt">
          <span className="tile">
            <Icon of={Repeat} size={14} />
          </span>
          <span className="tx">
            <b>Morning orders</b>
            <span>Automation · Every day at 07:00</span>
          </span>
          <Chip ok>On</Chip>
        </div>
      </div>
      <div className="composer">
        <span>Message</span>
        <span className="send">
          <Icon of={ArrowUp} size={14} stroke={2.4} />
        </span>
      </div>
    </>
  )
}

export function RulesPanel() {
  return (
    <>
      <Head title="Instructions" text="Rules for every chat." />
      <div className="rows">
        {RULES.map((rule) => (
          <Row key={rule.name} title={rule.name} text={rule.text} end={<Switch on={rule.on} />} />
        ))}
      </div>
    </>
  )
}

export function SkillsPanel() {
  return (
    <>
      <Head title="Skills" text="Procedures in Markdown, with their files." />
      <div className="rows">
        {SKILLS.map((skill) => (
          <Row key={skill.name} tile={<Icon of={Sparkles} size={14} />} title={<span className="mono">{skill.name}</span>} text={skill.text} end={<Chip>{skill.from}</Chip>} />
        ))}
      </div>
    </>
  )
}

export function AppsPanel() {
  return (
    <>
      <Head title="Integrations" text="Apps this agent can work in." />
      <div className="rows">
        {APPS.map((app) => (
          <Row key={app.app} brand tile={<AppLogo app={app.app} size={18} />} title={app.name} text={app.text} end={app.connected ? <Chip ok>Connected</Chip> : <SmallButton>Connect</SmallButton>} />
        ))}
      </div>
    </>
  )
}

export function AutomationsPanel() {
  return (
    <>
      <Head title="Automations" text="Tasks that run on a schedule." />
      <div className="rows">
        {AUTOMATIONS.map((automation) => (
          <Row key={automation.name} tile={<Icon of={Repeat} size={14} />} title={automation.name} text={automation.text} end={<Switch on={automation.on} />} />
        ))}
      </div>
    </>
  )
}

export function UsagePanel() {
  return (
    <>
      <Head title="Usage" text="Last 30 days, by persona." />
      <div className="rows tab">
        <div className="row total">
          <span className="tx">
            <b>Total</b>
          </span>
          <span className="num">{USAGE.total}</span>
        </div>
        {USAGE.rows.map((row) => (
          <div key={row.name} className="row">
            <Face seed={row.name} size={24} />
            <span className="tx">
              <b>{row.name}</b>
            </span>
            <span className="num">{row.credits}</span>
          </div>
        ))}
      </div>
    </>
  )
}

export function ModelsPanel() {
  return (
    <>
      <Head title="Models" text="Up to five, each with when to use it." />
      <div className="rows">
        {MODELS.map((model) => (
          <Row key={model.id} tile={<Icon of={Cpu} size={14} />} title={<span className="mono">{model.id}</span>} text={model.when} />
        ))}
        <Row tile={<Icon of={Plus} size={14} />} title="Add a model" text="Any model on the gateway that can use tools" />
      </div>
    </>
  )
}

export function TriggersPanel() {
  return (
    <>
      <Head title="Triggers and webhooks" text="Events that start a task." />
      <div className="rows">
        <Row brand tile={<AppLogo app="gmail" size={18} />} title="New email in Gmail" text="Draft a reply and ask before sending" end={<Chip>Trigger</Chip>} />
        <Row brand tile={<AppLogo app="googlecalendar" size={18} />} title="Event starts soon" text="Send the day's delivery list" end={<Chip>Trigger</Chip>} />
        <Row tile={<Icon of={Webhook} size={14} />} title="Order form" text={<span className="mono">app.usepersona.dev/…/hooks/••••a91c</span>} end={<Chip>Webhook</Chip>} />
      </div>
    </>
  )
}

export function NotesPanel() {
  return (
    <>
      <Head title="Memory" text="What this agent remembers." />
      <div className="rows">
        {MEMORY.map((item) => (
          <Row key={item.text} tile={<Icon of={Brain} size={14} />} title={item.text} text={item.when} />
        ))}
      </div>
      <Head title="Notes" text="Lists and drafts the agent keeps." />
      <div className="rows">
        {NOTES.map((item) => (
          <Row key={item.text} tile={<Icon of={FileText} size={14} />} title={item.text} text={item.when} />
        ))}
      </div>
    </>
  )
}

export function VaultPanel() {
  return (
    <>
      <Head title="Vault" text="Values never pass through the chat." />
      <div className="rows">
        <Row tile={<Icon of={Lock} size={14} />} title="Supplier portal" text="Use when ordering flour" end={<Chip ok>2 of 2 filled</Chip>} />
        <div className="fields">
          <span>
            <i>Username</i>
            <b>••••••••</b>
          </span>
          <span>
            <i>Password</i>
            <b>••••••••••••</b>
          </span>
        </div>
        <Row tile={<Icon of={Lock} size={14} />} title="Card for supplies" text="Use for orders under the monthly limit" end={<Chip ok>3 of 3 filled</Chip>} />
        <Row tile={<Icon of={LinkIcon} size={14} />} title="Form link" text="The person types the values on a form" end={<SmallButton>Send link</SmallButton>} />
      </div>
    </>
  )
}

// Each line is a list of pieces: plain text, a comment ("c") or a quoted string ("s")
const API_LINES: [string, ("c" | "s")?][][] = [
  [["# Make an agent", "c"]],
  [["curl -X POST $APP/api/projects/$PROJECT/personas \\"]],
  [["  -H "], ['"Authorization: Bearer $PERSONA_KEY"', "s"], [" \\"]],
  [["  -H "], ['"Content-Type: application/json"', "s"], [" \\"]],
  [["  -d "], [`'{ "name": "Front Desk" }'`, "s"]],
  [],
  [["# Give it a rule", "c"]],
  [["curl -X POST $APP/api/personas/$PERSONA/instructions \\"]],
  [["  -H "], ['"Authorization: Bearer $PERSONA_KEY"', "s"], [" \\"]],
  [["  -H "], ['"Content-Type: application/json"', "s"], [" \\"]],
  [["  -d "], [`'{ "name": "Tone", "content": "Warm and short." }'`, "s"]],
]

export function ApiPanel() {
  return (
    <pre className="code">
      {API_LINES.map((line, index) => (
        <Fragment key={index}>
          {index > 0 && "\n"}
          {line.map(([text, kind], piece) =>
            kind ? (
              <span key={piece} className={kind}>
                {text}
              </span>
            ) : (
              <Fragment key={piece}>{text}</Fragment>
            )
          )}
        </Fragment>
      ))}
    </pre>
  )
}

// A phone with one chat, and the chat app's icon on the agent's face
export function Phone({ name = "Front Desk", lines = PHONE_CHAT, badge }: { name?: string; lines?: readonly { from: string; text: string }[]; badge?: React.ReactNode }) {
  return (
    <div className="phone">
      <div className="notch" />
      <div className="phone-head">
        <span className="pface">
          <Face seed={name} size={38} />
          {badge}
        </span>
        <b>{name}</b>
      </div>
      <div className="chat">
        {lines.map((line) => (
          <div key={line.text} className={`msg ${line.from}`}>
            {line.text}
          </div>
        ))}
      </div>
      <div className="composer">
        <span>Message</span>
        <span className="send">
          <Icon of={ArrowUp} size={13} stroke={2.4} />
        </span>
      </div>
    </div>
  )
}

export function ChannelsPanel() {
  return (
    <div className="chan-fit">
      <div className="rows">
        {CHANNELS.map((channel) => (
          <div key={channel.id} className="row">
            <ChannelIcon channel={channel.id} size={28} />
            <span className="tx">
              <b>{channel.name}</b>
            </span>
          </div>
        ))}
      </div>
      <Phone badge={<ChannelIcon channel="whatsapp" size={18} />} />
    </div>
  )
}
