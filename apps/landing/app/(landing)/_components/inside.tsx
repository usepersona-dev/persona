import { INSIDE } from "../_lib/content"
import { Canvas, SceneBody, Sidebar } from "./app-window"
import { InsideTabs } from "./inside-tabs"

// "Inside the factory": the app window on a soft sky stage, with the six steps over it
export function Inside() {
  return (
    <section className="inside" id="inside" aria-labelledby="inside-title">
      <div className="wrap center howhead">
        <p className="eyebrow">{INSIDE.eyebrow}</p>
        <h2 className="h2" id="inside-title">
          {INSIDE.title}
        </h2>
        <p className="lede">{INSIDE.lede}</p>
      </div>
      <InsideTabs
        steps={INSIDE.steps.map(({ label, caption }) => ({ label, caption }))}
        sidebar={<Sidebar />}
        canvas={<Canvas />}
        scenes={INSIDE.steps.map(({ scene }) => (
          <SceneBody key={scene} scene={scene} />
        ))}
      />
    </section>
  )
}
