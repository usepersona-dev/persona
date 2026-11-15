import { ChevronsUpDown, Compass, Ellipsis, LayoutGrid, Plus, Settings } from "lucide-react"

import type { Scene } from "../_lib/content"
import { AGENTS, OWNER, PANEL_TABS, PROJECT } from "../_lib/example"
import { Icon } from "./marks"
import { AppsPanel, AutomationsPanel, ChatPanel, Face, RulesPanel, SkillsPanel, UsagePanel } from "./panels"

// The app window's fixed parts: the sidebar of the bakery project and its canvas of agents. The panel on the right changes with the step (see InsideTabs).

export function Sidebar() {
  return (
    <aside className="win-side">
      <div className="lights">
        <i />
        <i />
        <i />
      </div>
      <div className="side-row proj">
        <span className="ptile">{PROJECT.slice(0, 1)}</span>
        <b>{PROJECT}</b>
        <Icon of={ChevronsUpDown} size={13} />
      </div>
      <div className="side-row on">
        <Icon of={LayoutGrid} size={15} />
        Canvas
      </div>
      <div className="side-row">
        <Icon of={Plus} size={15} />
        Create
      </div>
      <div className="side-row">
        <Icon of={Compass} size={15} />
        Discover
      </div>
      <div className="side-label">Personas</div>
      {AGENTS.map((agent) => (
        <div key={agent.name} className={agent.name === "Front Desk" ? "side-row pick" : "side-row"}>
          <Face seed={agent.name} size={20} />
          {agent.name}
        </div>
      ))}
      <div className="side-foot">
        <span className="ptile round">{OWNER.slice(0, 1)}</span>
        {OWNER}
      </div>
    </aside>
  )
}

export function Canvas() {
  return (
    <div className="canvas">
      {AGENTS.map((agent) => (
        <div key={agent.name} className={agent.name === "Front Desk" ? "node on" : "node"} style={{ left: `${agent.x}%`, top: `${agent.y}%` }}>
          <Face seed={agent.name} size={76} />
          <span>{agent.name}</span>
        </div>
      ))}
      <div className="zoom">
        <span>−</span>
        <b>100%</b>
        <span>+</span>
      </div>
    </div>
  )
}

function AgentHead({ tab }: { tab: string }) {
  return (
    <>
      <div className="panel-head">
        <Face seed="Front Desk" size={30} />
        <b>Front Desk</b>
        <span className="dots">
          <Icon of={Ellipsis} size={16} />
        </span>
      </div>
      <div className="ptabs">
        {PANEL_TABS.map((name) => (
          <span key={name} className={name === tab ? "on" : undefined}>
            {name}
          </span>
        ))}
      </div>
    </>
  )
}

// Usage lives in the app's Settings, next to Organization, Billing and API keys
function SettingsHead() {
  return (
    <>
      <div className="panel-head">
        <span className="ptile big">
          <Icon of={Settings} size={15} />
        </span>
        <b>Settings</b>
        <span className="dots">
          <Icon of={Ellipsis} size={16} />
        </span>
      </div>
      <div className="ptabs">
        <span>Organization</span>
        <span className="on">Usage</span>
        <span>Billing</span>
        <span>API keys</span>
      </div>
    </>
  )
}

const SCENES: Record<Scene, { tab?: string; body: () => React.ReactNode }> = {
  chat: { tab: "Chat", body: ChatPanel },
  rules: { tab: "Instructions", body: RulesPanel },
  skills: { tab: "Skills", body: SkillsPanel },
  apps: { tab: "Integrations", body: AppsPanel },
  automations: { tab: "Automations", body: AutomationsPanel },
  usage: { body: UsagePanel },
}

// One state of the right-hand panel
export function SceneBody({ scene }: { scene: Scene }) {
  const { tab, body: Body } = SCENES[scene]
  return (
    <>
      {tab ? <AgentHead tab={tab} /> : <SettingsHead />}
      <div className="pbody">
        <Body />
      </div>
    </>
  )
}
