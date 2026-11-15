"use client"

import { ChevronDownIcon, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// A menu in a list's head that picks one value, with each option's count when given:
// <Filter icon={SlidersHorizontalIcon} label="Provider" value={provider} options={providers} onChange={setProvider} />
function Filter({ icon: Icon, label, value, options, onChange }: { icon: LucideIcon; label: string; value: string; options: { value: string; label: string; count?: number }[]; onChange: (value: string) => void }) {
  const picked = options.find((option) => option.value === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="xs" className="text-muted-foreground" />}>
        <Icon data-icon="inline-start" />
        {picked?.label}
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
                {option.label}
                {option.count !== undefined && <DropdownMenuShortcut>{option.count}</DropdownMenuShortcut>}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { Filter }
