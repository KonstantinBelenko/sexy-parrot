"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState } from "react"

export interface ModelOption {
  value: string
  label: string
  description?: string
}

interface ModelSelectorProps {
  models: ModelOption[]
  defaultValue?: string
  onSelect: (value: string) => void
  className?: string
}

export function ModelSelector({
  models,
  defaultValue = "SD 1.5",
  onSelect,
  className,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultValue)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value
            ? models.find((model) => model.value === value)?.label || value
            : "Select model..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search models..." />
          <CommandEmpty>No model found.</CommandEmpty>
          <CommandGroup>
            {models.map((model) => (
              <CommandItem
                key={model.value}
                value={model.value}
                onSelect={(currentValue) => {
                  const newValue = currentValue === value ? "" : currentValue
                  setValue(newValue || defaultValue)
                  onSelect(newValue || defaultValue)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === model.value ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{model.label}</span>
                  {model.description && (
                    <span className="text-xs text-muted-foreground">{model.description}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 