import { useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import {
  ALL_PHONE_COUNTRIES,
  COMMON_PHONE_COUNTRIES,
} from "@/lib/phoneCountries";
import { maskIcelandicLocal } from "@/lib/formatters";

interface Props {
  countryCode: string;
  localNumber: string;
  onCountryCodeChange: (v: string) => void;
  onLocalNumberChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}

export function PhoneInput({
  countryCode,
  localNumber,
  onCountryCodeChange,
  onLocalNumberChange,
  placeholder,
  id,
}: Props) {
  const others = useMemo(() => {
    const commonKeys = new Set(
      COMMON_PHONE_COUNTRIES.map((c) => `${c.code}-${c.name}`),
    );
    return ALL_PHONE_COUNTRIES.filter(
      (c) => !commonKeys.has(`${c.code}-${c.name}`),
    );
  }, []);

  const handleLocalChange = (raw: string) => {
    if (countryCode === "+354") {
      onLocalNumberChange(maskIcelandicLocal(raw));
    } else {
      // Strip everything but digits + spaces for general entry; store digits only
      onLocalNumberChange(raw.replace(/[^\d\s-]/g, ""));
    }
  };

  // Use code|name as value to disambiguate shared codes (e.g. +1 US/CA)
  const selectValue = `${countryCode}`;

  return (
    <div className="flex gap-2">
      <div className="w-[120px] flex-shrink-0">
        <Select value={selectValue} onValueChange={onCountryCodeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              <SelectLabel>Algeng</SelectLabel>
              {COMMON_PHONE_COUNTRIES.map((c) => (
                <SelectItem key={`common-${c.code}-${c.name}`} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              {others.map((c) => (
                <SelectItem key={`all-${c.code}-${c.name}`} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Input
        id={id}
        value={localNumber}
        onChange={(e) => handleLocalChange(e.target.value)}
        placeholder={placeholder ?? (countryCode === "+354" ? "555-5555" : "")}
        inputMode="tel"
        className="flex-1"
      />
    </div>
  );
}
