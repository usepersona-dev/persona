import { Empty } from "@/components/ui/empty"
import { Item, ItemGroup } from "@/components/ui/item"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// The parts of a settings page: a header, sections of card rows, and a card for empty and failed states.
// Spacing lives on the slots, so a page is just the slots in order:
//
//   <ScreenHeader>
//     <ScreenTitle>API keys</ScreenTitle>
//     <ScreenDescription>Keys for connecting your own tools to your organization.</ScreenDescription>
//     <ScreenActions><Button>New API key</Button></ScreenActions>
//   </ScreenHeader>
//   <ScreenSection>
//     <ScreenSectionTitle>Team <ScreenSectionCount>3</ScreenSectionCount></ScreenSectionTitle>
//     <ScreenRows>
//       <ScreenRow>…ItemMedia, ItemContent, ItemActions…</ScreenRow>
//     </ScreenRows>
//     <ScreenPager page={page} pages={pages} onPage={setPage} />
//   </ScreenSection>
//   <ScreenEmpty>
//     <EmptyHeader>
//       <EmptyMedia variant="icon"><ChartLineIcon /></EmptyMedia>
//       <EmptyTitle>Coming soon</EmptyTitle>
//       <EmptyDescription>Usage for the whole organization isn't ready yet.</EmptyDescription>
//     </EmptyHeader>
//   </ScreenEmpty>

function ScreenHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="screen-header" className={cn("grid auto-rows-min items-end gap-x-4 gap-y-0.5 has-data-[slot=screen-actions]:grid-cols-[minmax(0,1fr)_auto]", className)} {...props} />
}

function ScreenTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return <h1 data-slot="screen-title" className={cn("font-heading text-3xl leading-tight font-semibold tracking-tight", className)} {...props} />
}

function ScreenDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="screen-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

function ScreenActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="screen-actions" className={cn("col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-center", className)} {...props} />
}

function ScreenSection({ className, ...props }: React.ComponentProps<"section">) {
  return <section data-slot="screen-section" className={cn("flex flex-col gap-3", className)} {...props} />
}

function ScreenSectionTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="screen-section-title" className={cn("flex min-h-7 items-center gap-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase", className)} {...props} />
}

function ScreenSectionCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="screen-section-count" className={cn("text-muted-foreground/70 tabular-nums", className)} {...props} />
}

function ScreenRows({ className, ...props }: React.ComponentProps<typeof ItemGroup>) {
  return <ItemGroup className={cn("gap-2.5", className)} {...props} />
}

// A card row: the Item parts go inside, the title is bold, and the small description sits close under it on one line.
// The description never wraps, so the media stays centered (Item tops it when a description exists).
function ScreenRow({ className, ...props }: React.ComponentProps<typeof Item>) {
  return <Item variant="outline" className={cn("rounded-[10px] bg-card **:data-[slot=item-media]:translate-y-0 **:data-[slot=item-media]:self-center **:data-[slot=item-content]:gap-0.5 **:data-[slot=item-description]:line-clamp-1 **:data-[slot=item-description]:text-xs **:data-[slot=item-title]:font-bold", className)} {...props} />
}

// A row while its list loads, the same height as the real one: the media is ItemMedia's image size, and each bar sits in a line as tall as the title's and the description's. Rows with no icon or logo pass media={false}.
function ScreenRowSkeleton({ media = true, className, ...props }: React.ComponentProps<typeof Item> & { media?: boolean }) {
  return (
    <ScreenRow aria-hidden className={className} {...props}>
      {media && <Skeleton className="size-10 shrink-0 rounded-md" />}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="flex h-[1.375em] items-center text-sm">
          <Skeleton className="h-3.5 w-32 rounded-sm" />
        </span>
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-48 rounded-sm" />
        </span>
      </span>
    </ScreenRow>
  )
}

// A part of a settings page, labeled like the panels' sections: a small label (with a count, or a line about the part), then its fields or rows
function ScreenGroup({ title, count, description, className, children, ...props }: Omit<React.ComponentProps<"section">, "title"> & { title: string; count?: number; description?: React.ReactNode }) {
  return (
    <ScreenSection className={className} {...props}>
      <div className="flex flex-col">
        <ScreenSectionTitle>
          {title}
          {count !== undefined && <ScreenSectionCount>{count}</ScreenSectionCount>}
        </ScreenSectionTitle>
        {description && <p className="text-xs text-muted-foreground/70">{description}</p>}
      </div>
      {children}
    </ScreenSection>
  )
}

// A dashed card: shadcn's Empty parts go inside
function ScreenEmpty({ className, ...props }: React.ComponentProps<typeof Empty>) {
  return <Empty data-slot="screen-empty" className={cn("rounded-[12px] border border-dashed bg-card", className)} {...props} />
}

// The pages under a list: Previous and Next stay at the edges so the row does not jump, and the numbers show the first page, the last and the ones around this page (1 … 4 5 6 … 84)
function ScreenPager({ page, pages, onPage, className, ...props }: React.ComponentProps<"nav"> & { page: number; pages: number; onPage: (page: number) => void }) {
  const numbers = [...new Set([1, page - 1, page, page + 1, pages])].filter((number) => number >= 1 && number <= pages).sort((a, b) => a - b)
  const entries = numbers.flatMap((number, index) => (number - (numbers[index - 1] ?? number) > 1 ? ["gap" as const, number] : [number]))

  // The links are anchors (shadcn's Pagination), so a click must not follow the "#"
  function go(event: React.MouseEvent, to: number) {
    event.preventDefault()
    if (to < 1 || to > pages || to === page) return
    onPage(to)
  }

  return (
    <Pagination data-slot="screen-pager" className={className} {...props}>
      <PaginationContent className="w-full justify-between">
        <PaginationItem>
          <PaginationPrevious href="#" size="sm" aria-disabled={page === 1} className="text-muted-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40" onClick={(event) => go(event, page - 1)} />
        </PaginationItem>
        <PaginationItem className="flex items-center gap-1">
          {entries.map((entry, index) =>
            entry === "gap" ? (
              <PaginationEllipsis key={`gap-${index}`} className="size-8 text-muted-foreground" />
            ) : (
              <PaginationLink key={entry} href="#" size="icon-sm" isActive={entry === page} className="text-muted-foreground tabular-nums data-[active=true]:text-foreground" onClick={(event) => go(event, entry)}>
                {entry}
              </PaginationLink>
            ),
          )}
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" size="sm" aria-disabled={page === pages} className="text-muted-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40" onClick={(event) => go(event, page + 1)} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export {
  ScreenActions,
  ScreenDescription,
  ScreenEmpty,
  ScreenGroup,
  ScreenHeader,
  ScreenPager,
  ScreenRow,
  ScreenRows,
  ScreenRowSkeleton,
  ScreenSection,
  ScreenSectionCount,
  ScreenSectionTitle,
  ScreenTitle,
}
