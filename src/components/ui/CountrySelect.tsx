import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_COUNTRIES, COMMON_COUNTRIES } from "@/lib/countries";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  placeholder?: string;
}

export function CountrySelect({ value, onValueChange, placeholder }: Props) {
  const others = ALL_COUNTRIES.filter(
    (c) => !(COMMON_COUNTRIES as readonly string[]).includes(c),
  );
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectGroup>
          <SelectLabel>Algeng lönd</SelectLabel>
          {COMMON_COUNTRIES.map((c) => (
            <SelectItem key={`common-${c}`} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          {others.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
