"use client"

import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// The properties of a panel form, above its document:
// <Property icon={RepeatIcon} label="Repeats"><Choose items={FREQS} value={freq} onChange={setFreq} /></Property>
// <Property icon={ClockIcon} label="Time"><Edit value="9:00 AM"><Input type="time" … /></Edit></Property>

// One property: its icon and name, then its value
function Property({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[8.5rem_minmax(0,1fr)] items-center justify-items-start gap-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      {children}
    </div>
  )
}

// A value as a chip: Choose opens a menu to pick one, Edit opens the value's own editor
function Choose<Value extends string | number>({ items, value, onChange }: { items: { value: Value; label: string }[]; value: Value; onChange: (value: Value) => void }) {
  const picked = items.find((item) => item.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="secondary" size="sm" className="max-w-full" />}>
        <span className="truncate">{picked?.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value} closeOnClick>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Edit({ value, invalid, children }: { value: string; invalid?: boolean; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="secondary" size="sm" aria-invalid={invalid} className="max-w-full" />}>
        <span className="truncate">{value}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        {children}
      </PopoverContent>
    </Popover>
  )
}

export { Choose, Edit, Property }
