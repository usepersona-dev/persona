import { ArrowRight } from "lucide-react"

import { Icon, Mark } from "./marks"

// The page's main button: a dark pill with the cloud, the words and an arrow that moves on hover
export function GoButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="go" href={href}>
      <Mark />
      {children}
      <Icon of={ArrowRight} size={18} stroke={2.2} />
    </a>
  )
}
