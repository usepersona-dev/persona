import { defineEval } from "eve/evals"
import { satisfies } from "eve/evals/expect"

import type config from "@/evals/evals.config"
import { said } from "@/evals/shared"

// A browser race: real sites, each answer checked against the live fact wherever one can be looked up
type Task = { name: string; prompt: string; check?: (answer: string) => Promise<boolean> }

const tasks: Task[] = [
  { name: "wikipedia", prompt: "Using Wikipedia (start at https://en.wikipedia.org), find the year the Eiffel Tower was completed.", check: async (answer) => answer.includes("1889") },
  { name: "book price", prompt: "On https://books.toscrape.com, find the price of the book Sharp Objects.", check: async (answer) => answer.includes("47.82") },
  { name: "book count", prompt: "On https://books.toscrape.com, how many books are in the Poetry category?", check: async (answer) => /\b19\b/.test(answer) },
  { name: "hacker news", prompt: "On https://news.ycombinator.com, what is the title of the top story right now?", check: async (answer) => plain(answer).includes(plain(await readTopStory()).slice(0, 40)) },
  { name: "github stars", prompt: "On https://github.com/vercel-labs/agent-browser, how many stars does the repository have?", check: async (answer) => isNear(answer, await readStars()) },
  { name: "npm version", prompt: "On https://www.npmjs.com/package/agent-browser, what is the latest published version?", check: async (answer) => answer.includes(await readLatestVersion()) },
  { name: "duckduckgo", prompt: "Search DuckDuckGo (https://duckduckgo.com) for TypeSafe Jev and tell me the title of the first result." },
  { name: "wolt", prompt: "On https://wolt.com, find a pizza restaurant that delivers to Dizengoff Center in Tel Aviv, and tell me its name and delivery fee." },
  { name: "google flights", prompt: "On https://www.google.com/travel/flights, find the cheapest one-way flight from Tel Aviv to London on October 20, 2026, and tell me the price and airline." },
]

export default tasks.map((task) =>
  defineEval<typeof config>({
    description: `Browser race: ${task.name}`,
    tags: ["browser", "race"],
    async test(t) {
      const { headers } = await t.context.makePersona()
      // The race measures the browser, so the main agent is told to use it instead of its web tools
      const turn = await t.send(`Use the browser for this. ${task.prompt}`, { headers })
      const answer = said(turn)
      t.log(answer)

      t.succeeded()
      t.calledTool("browser_task")
      if (!task.check) return

      const right = await task.check(answer)
      t.check(right, satisfies((value) => value === true, `the answer to "${task.name}" matches the live fact`))
    },
  }),
)

function plain(text: string) {
  const normal = text.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ")
  return normal
}

/** True when a number in the answer is within 2% of the real one; GitHub shows stars rounded, such as 21.3k. */
function isNear(answer: string, stars: number) {
  const numbers = [...answer.matchAll(/(\d[\d,.]*)\s*(k\b)?/gi)].map(([, digits, thousand]) => Number(digits!.replace(/,/g, "")) * (thousand ? 1000 : 1))
  const near = numbers.some((value) => Math.abs(value - stars) / stars < 0.02)
  return near
}

async function readTopStory() {
  const top = (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json").then((reply) => reply.json())) as number[]
  const story = (await fetch(`https://hacker-news.firebaseio.com/v0/item/${top[0]}.json`).then((reply) => reply.json())) as { title: string }
  return story.title
}

async function readStars() {
  const repository = (await fetch("https://api.github.com/repos/vercel-labs/agent-browser").then((reply) => reply.json())) as { stargazers_count: number }
  return repository.stargazers_count
}

async function readLatestVersion() {
  const latest = (await fetch("https://registry.npmjs.org/agent-browser/latest").then((reply) => reply.json())) as { version: string }
  return latest.version
}
