import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/sala_translations_is";

export function AppTab() {
  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
        {t.settings.appHardcodedNotice}
      </div>

      <div className="space-y-4 rounded-md border border-border bg-card p-6">
        <div className="space-y-1.5">
          <Label>{t.settings.appCompanyName}</Label>
          <Input defaultValue="IDÉ House of Brands" disabled />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.appCompanyLogo}</Label>
          <Input type="file" disabled />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.appDefaultCurrency}</Label>
          <Input defaultValue="ISK" disabled />
        </div>
        <div className="space-y-1.5">
          <Label>{t.settings.appPaydayStatus}</Label>
          <div>
            <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
              {t.settings.appPaydayConnected}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
