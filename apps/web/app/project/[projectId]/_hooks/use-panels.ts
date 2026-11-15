"use client"

import { parseAsBoolean, parseAsString, useQueryStates } from "nuqs"

import { usePanelState } from "@/components/side-panel"

// The only place that knows the URL keys of the project's panels and dialogs.
// Panels: ?persona=<id> opens that persona's panel on the page in &section=<page> (Chat when none; a page change replaces history), and &automation=<id>, &webhook=<id>, &instruction=<id>, &skill=<id>, &connection=<id> or &credential=<id> (or new, or new:<preset>) opens one of its automations, webhooks, instructions, skills, connections or vault credentials over it, &skillsHub=true the skills hub, &hubSkill=<skills.sh id> one of its skills over the hub, &automationsHub=true the automations hub (a pick opens &automation=new:<suggestion id> over it), and &link=<line id> the Link panel of a number or bot. ?create=new the New persona panel, and ?create=<id> the same panel with that persona picked to copy (Duplicate), ?settings=true the project's settings on the part in &section=<part> (Settings when none), with &add=bot over it. One at a time; opening and closing push history, so Back closes the panel opened last.
// The dialog: ?discover=true, over whatever panel is open. It replaces history, so Back skips it.
const PARAMS = {
  persona: parseAsString,
  section: parseAsString,
  automation: parseAsString,
  automationsHub: parseAsBoolean,
  webhook: parseAsString,
  instruction: parseAsString,
  skill: parseAsString,
  skillsHub: parseAsBoolean,
  hubSkill: parseAsString,
  link: parseAsString,
  connection: parseAsString,
  credential: parseAsString,
  create: parseAsString,
  settings: parseAsBoolean,
  add: parseAsString,
  discover: parseAsBoolean,
}

const NO_PANEL = { persona: null, section: null, automation: null, automationsHub: null, webhook: null, instruction: null, skill: null, skillsHub: null, hubSkill: null, link: null, connection: null, credential: null, create: null, settings: null, add: null }
const NO_DIALOG = { discover: null }

export function usePanels() {
  const [params, setParams] = useQueryStates(PARAMS)
  const panelOpen = Object.keys(NO_PANEL).some((key) => params[key as keyof typeof NO_PANEL] !== null)
  
  // An automation, webhook, instruction, skill, connection or credential panel (and the two hubs) keeps its id while it slides out, after the key leaves the URL
  const automation = usePanelState(params.automation)
  const automationsHub = usePanelState(params.automationsHub)
  const webhook = usePanelState(params.webhook)
  const instruction = usePanelState(params.instruction)
  const skill = usePanelState(params.skill)
  const skillsHub = usePanelState(params.skillsHub)
  const hubSkill = usePanelState(params.hubSkill)
  const link = usePanelState(params.link)
  const connection = usePanelState(params.connection)
  const credential = usePanelState(params.credential)
  const add = usePanelState(params.add)

  function openPersona(personaId: string, section?: string) {
    void setParams({ ...NO_PANEL, ...NO_DIALOG, persona: personaId, section: section ?? null }, { history: "push" })
  }

  function openSection(section: string) {
    void setParams({ section }, { history: "replace" })
  }

  function openAutomation(automationId: string) {
    void setParams({ automation: automationId }, { history: "push" })
  }

  function closeAutomation() {
    void setParams({ automation: null }, { history: "push" })
  }

  function openAutomationsHub() {
    void setParams({ automationsHub: true }, { history: "push" })
  }

  function closeAutomationsHub() {
    void setParams({ automationsHub: null, automation: null }, { history: "push" })
  }

  function openWebhook(webhookId: string) {
    void setParams({ webhook: webhookId }, { history: "push" })
  }

  function closeWebhook() {
    void setParams({ webhook: null }, { history: "push" })
  }

  function openInstruction(instructionId: string) {
    void setParams({ instruction: instructionId }, { history: "push" })
  }

  function closeInstruction() {
    void setParams({ instruction: null }, { history: "push" })
  }

  function openSkill(skillId: string) {
    void setParams({ skill: skillId }, { history: "push" })
  }

  function closeSkill() {
    void setParams({ skill: null }, { history: "push" })
  }

  function openSkillsHub() {
    void setParams({ skillsHub: true }, { history: "push" })
  }

  function closeSkillsHub() {
    void setParams({ skillsHub: null, hubSkill: null }, { history: "push" })
  }

  function openHubSkill(marketplaceId: string) {
    void setParams({ hubSkill: marketplaceId }, { history: "push" })
  }

  function closeHubSkill() {
    void setParams({ hubSkill: null }, { history: "push" })
  }

  function openLink(lineId: string) {
    void setParams({ link: lineId }, { history: "push" })
  }

  function closeLink() {
    void setParams({ link: null }, { history: "push" })
  }

  function openConnection(connectionId: string) {
    void setParams({ connection: connectionId }, { history: "push" })
  }

  function closeConnection() {
    void setParams({ connection: null }, { history: "push" })
  }

  function openCredential(credentialId: string) {
    void setParams({ credential: credentialId }, { history: "push" })
  }

  function closeCredential() {
    void setParams({ credential: null }, { history: "push" })
  }

  function openCreate() {
    void setParams({ ...NO_PANEL, ...NO_DIALOG, create: "new" }, { history: "push" })
  }

  function openSettings(section?: string) {
    void setParams({ ...NO_PANEL, ...NO_DIALOG, settings: true, section: section ?? null }, { history: "push" })
  }

  function openAdd(kind: "bot") {
    void setParams({ add: kind }, { history: "push" })
  }

  function closeAdd() {
    void setParams({ add: null }, { history: "push" })
  }

  function openDuplicate(personaId: string) {
    void setParams({ ...NO_PANEL, ...NO_DIALOG, create: personaId }, { history: "push" })
  }

  function close() {
    void setParams({ ...NO_PANEL, ...NO_DIALOG }, { history: "push" })
  }

  function reset() {
    void setParams({ ...NO_PANEL, ...NO_DIALOG }, { history: "replace" })
  }

  function openDiscover() {
    void setParams({ ...NO_DIALOG, discover: true })
  }

  function toggleDiscover() {
    void setParams((current) => ({ ...NO_DIALOG, discover: current.discover ? null : true }))
  }

  function closeDialog() {
    void setParams(NO_DIALOG)
  }

  return {
    persona: params.persona,
    section: params.section,
    automation,
    automationsHub,
    webhook,
    instruction,
    skill,
    skillsHub,
    hubSkill,
    link,
    connection,
    credential,
    add,
    creating: params.create,
    settings: params.settings === true,
    discovering: params.discover === true,
    panelOpen,
    openPersona,
    openSection,
    openAutomation,
    closeAutomation,
    openAutomationsHub,
    closeAutomationsHub,
    openWebhook,
    closeWebhook,
    openInstruction,
    closeInstruction,
    openSkill,
    closeSkill,
    openSkillsHub,
    closeSkillsHub,
    openHubSkill,
    closeHubSkill,
    openLink,
    closeLink,
    openConnection,
    closeConnection,
    openCredential,
    closeCredential,
    openCreate,
    openSettings,
    openAdd,
    closeAdd,
    openDuplicate,
    close,
    reset,
    openDiscover,
    toggleDiscover,
    closeDialog,
  }
}
