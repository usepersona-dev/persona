import { cn } from "@/lib/utils"

// A part of a page: its name and a line on what it holds, its actions to the side, then the content.
//
//   <Section>
//     <SectionHeader>
//       <SectionTitle>Instructions</SectionTitle>
//       <SectionDescription>Rules Nadia follows in every chat.</SectionDescription>
//       <SectionAction>
//         <Button size="sm">New rule</Button>
//       </SectionAction>
//     </SectionHeader>
//     …
//   </Section>

function Section({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="section" className={cn("mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 pt-7 pb-24", className)} {...props} />
}

function SectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="section-header" className={cn("grid items-end gap-x-4 gap-y-0.5 has-data-[slot=section-action]:grid-cols-[1fr_auto]", className)} {...props} />
}

function SectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="section-title" className={cn("font-heading text-3xl leading-tight font-semibold tracking-tight", className)} {...props} />
}

function SectionDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="section-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function SectionAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="section-action" className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center", className)} {...props} />
}

export { Section, SectionAction, SectionDescription, SectionHeader, SectionTitle }
