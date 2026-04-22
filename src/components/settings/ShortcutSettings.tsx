import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, Plus, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProvidersQuery } from "@/lib/query";
import type { ShortcutBinding } from "@/types";

interface ShortcutSettingsProps {
  shortcutBindings: ShortcutBinding[];
  onChange: (bindings: ShortcutBinding[]) => void;
}

export function ShortcutSettings({
  shortcutBindings,
  onChange,
}: ShortcutSettingsProps) {
  const { t } = useTranslation();
  const { data: providersData } = useProvidersQuery("claude");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [capturingForProvider, setCapturingForProvider] = useState<string | null>(null);
  const [capturedKey, setCapturedKey] = useState<string>("");
  const captureRef = useRef<HTMLInputElement>(null);

  // 按 sortIndex 排序后的 provider 列表
  const providers = providersData
    ? Object.values(providersData.providers)
    : [];

  // 获取已绑定快捷键的 provider id 集合
  const boundProviderIds = new Set(shortcutBindings.map((b) => b.providerId));

  // 获取某 provider 绑定的快捷键
  const getBindingForProvider = (providerId: string) =>
    shortcutBindings.find((b) => b.providerId === providerId);

  // 删除绑定
  const handleRemoveBinding = (providerId: string) => {
    onChange(shortcutBindings.filter((b) => b.providerId !== providerId));
  };

  // 添加绑定：选择 provider 后进入捕获模式
  const handleSelectProvider = (providerId: string) => {
    setSelectedProviderId(providerId);
    setCapturedKey("");
    setCapturingForProvider(providerId);
    // 延迟聚焦到捕获输入框
    setTimeout(() => captureRef.current?.focus(), 50);
  };

  // 捕获按键
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCapturingForProvider(null);
        setSelectedProviderId("");
        setCapturedKey("");
        return;
      }

      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push(navigator.platform.includes("Mac") ? "Cmd" : "Ctrl");
      if (e.altKey) parts.push(navigator.platform.includes("Mac") ? "Option" : "Alt");
      if (e.shiftKey) parts.push("Shift");

      // 排除修饰键单独按下
      if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(key);

      const shortcutStr = parts.join("+");

      // 检查是否已被其他 provider 占用
      const existing = shortcutBindings.find(
        (b) => b.shortcut === shortcutStr && b.providerId !== capturingForProvider,
      );
      if (existing) {
        const existingProvider = providers.find((p) => p.id === existing.providerId);
        toast.error(
          t("settings.shortcut.duplicate", {
            shortcut: shortcutStr,
            provider: existingProvider?.name ?? existing.providerId,
          }),
        );
        return;
      }

      setCapturedKey(shortcutStr);
    },
    [capturingForProvider, shortcutBindings, providers, t],
  );

  // 确认绑定
  const handleConfirmBinding = () => {
    if (!capturedKey || !capturingForProvider) return;

    // 移除该 provider 旧绑定（如果有），添加新绑定
    const filtered = shortcutBindings.filter(
      (b) => b.providerId !== capturingForProvider,
    );
    onChange([...filtered, { shortcut: capturedKey, providerId: capturingForProvider }]);

    toast.success(
      t("settings.shortcut.bound", {
        shortcut: capturedKey,
        provider: providers.find((p) => p.id === capturingForProvider)?.name ?? capturingForProvider,
      }),
    );

    setCapturingForProvider(null);
    setSelectedProviderId("");
    setCapturedKey("");
  };

  // 取消绑定
  const handleCancelBinding = () => {
    setCapturingForProvider(null);
    setSelectedProviderId("");
    setCapturedKey("");
  };

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          {t("settings.shortcut.title")}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("settings.shortcut.description")}
        </p>
      </header>

      {/* 已有绑定列表 */}
      {shortcutBindings.length > 0 && (
        <div className="space-y-2">
          {shortcutBindings.map((binding) => {
            const provider = providers.find((p) => p.id === binding.providerId);
            return (
              <div
                key={binding.providerId}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono rounded bg-primary/10 text-primary px-1.5 py-0.5 shrink-0">
                    {binding.shortcut}
                  </span>
                  <span className="text-sm truncate">
                    {provider?.name ?? binding.providerId}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveBinding(binding.providerId)}
                  title={t("settings.shortcut.remove")}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* 添加绑定区域 */}
      {capturingForProvider ? (
        <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/5 px-3 py-2">
          <span className="text-sm shrink-0">
            {providers.find((p) => p.id === capturingForProvider)?.name ?? capturingForProvider}
          </span>
          <span className="text-muted-foreground shrink-0">→</span>
          <input
            ref={captureRef}
            type="text"
            readOnly
            value={capturedKey}
            placeholder={t("settings.shortcut.pressKey")}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-0 text-sm font-mono bg-transparent border-none outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelBinding}
              className="h-7 text-xs"
            >
              {t("common.cancel")}
            </Button>
            {capturedKey && (
              <Button
                size="sm"
                onClick={handleConfirmBinding}
                className="h-7 text-xs"
              >
                {t("common.confirm")}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={selectedProviderId} onValueChange={handleSelectProvider}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder={t("settings.shortcut.selectProvider")} />
            </SelectTrigger>
            <SelectContent>
              {providers
                .filter((p) => !boundProviderIds.has(p.id))
                .map((provider) => (
                  <SelectItem
                    key={provider.id}
                    value={provider.id}
                    className="text-xs"
                  >
                    {provider.name}
                  </SelectItem>
                ))}
              {providers.filter((p) => !boundProviderIds.has(p.id)).length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {t("settings.shortcut.noMoreProviders")}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </section>
  );
}
