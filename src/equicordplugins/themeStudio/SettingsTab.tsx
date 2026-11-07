/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./editor.css";

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import { OptionComponentMap } from "@components/settings/tabs/plugins/components";
import { showToast, useEffect, useState } from "@webpack/common";

import { setThemeStudioDraft, settings } from "./index";

const SECTIONS = [
    {
        id: "look",
        title: "Colors & Wallpaper",
        description: "Choose the palette, background image and overall surface strength.",
        settings: ["accent", "accentSecondary", "background", "surface", "text", "unifiedTextColor", "muted", "wallpaper", "surfaceOpacity", "wallpaperDim"]
    },
    {
        id: "layout",
        title: "Glass & Layout",
        description: "Control blur, spacing, sizing and the shape of the interface.",
        settings: ["blur", "rounding", "spacing", "fontSize", "channelWidth", "memberWidth"]
    },
    {
        id: "messages",
        title: "Messages & Actions",
        description: "Adjust message density and the colorful expanded action toolbar.",
        settings: ["messageSpacing", "compactMessages", "enhancedMessageActions"]
    },
    {
        id: "names",
        title: "Name Bubbles",
        description: "Style usernames with role-colored pills, including ShowMeYourName effects.",
        settings: ["nameBubbles", "nameBubbleOpacity", "nameBubbleHoverOpacity", "nameBubblePadding", "nameBubbleRounding"]
    },
    {
        id: "music-controls",
        title: "MusicControls",
        description: "Blend MusicControls players and lyrics into the user panel without disturbing account or quest cards.",
        settings: ["spotifyPanel", "spotifyUseThemeAccent"]
    },
    {
        id: "motion",
        title: "Motion & Greeting",
        description: "Tune interface motion and the welcome toast shown when Nexora starts.",
        settings: ["animations", "showGreeting", "greetingText"]
    },
    {
        id: "visibility",
        title: "Visible Interface",
        description: "Hide distractions while keeping Discord's native layout intact.",
        settings: ["showMembers", "showChannelSidebar", "showServerList", "showUserPanel", "showSearch", "showHelp", "showShop", "showNitro"]
    },
    {
        id: "advanced",
        title: "Advanced",
        description: "Add CSS for anything the visual controls do not cover yet.",
        settings: ["customCss"]
    }
] as const;

const PRESETS = [
    { name: "Calm Purple", accent: "#8b5cf6", secondary: "#38bdf8", background: "#090b12", surface: "#181b2a" },
    { name: "Midnight", accent: "#5865f2", secondary: "#a78bfa", background: "#05060a", surface: "#11131d" },
    { name: "Ocean", accent: "#06b6d4", secondary: "#3b82f6", background: "#061219", surface: "#10242e" },
    { name: "Rose", accent: "#f43f5e", secondary: "#fb7185", background: "#14090e", surface: "#28141c" },
    { name: "AMOLED", accent: "#7c3aed", secondary: "#22d3ee", background: "#000000", surface: "#0a0a0c" }
] as const;

function noop() { }

function ThemeSetting({
    id,
    draft,
    onDraftChange
}: {
    id: keyof typeof settings.def;
    draft: Record<string, unknown> & { enabled: boolean };
    onDraftChange: (id: string, value: unknown) => void;
}) {
    const setting = settings.def[id];
    const Component = OptionComponentMap[setting.type];

    return (
        <ErrorBoundary noop>
            <Component
                id={id}
                setting={setting}
                onChange={value => onDraftChange(id, value)}
                pluginSettings={draft}
                definedSettings={settings}
                closePluginSettings={noop}
            />
        </ErrorBoundary>
    );
}

export default function ThemeStudioTab() {
    const pluginSettings = useSettings(["plugins.ThemeStudio.*"]).plugins.ThemeStudio;
    const [draft, setDraft] = useState<typeof pluginSettings>(() => ({ ...pluginSettings }));
    const colors = draft as unknown as { accent: string; accentSecondary: string; background: string; surface: string };

    useEffect(() => {
        setThemeStudioDraft(draft);
        return () => setThemeStudioDraft(null);
    }, [draft]);

    function updateDraft(id: string, value: unknown) {
        setDraft(current => {
            const next = { ...current, [id]: value };
            return next;
        });
    }

    function applyDraft() {
        for (const key of Object.keys(settings.def)) pluginSettings[key] = draft[key];
        setThemeStudioDraft(null);
        showToast({ text: "Your Theme Studio changes are applied.", variant: "success" });
    }

    function discardDraft() {
        const saved = { ...pluginSettings };
        setDraft(saved);
        setThemeStudioDraft(null);
        showToast({ text: "Preview discarded. Saved settings restored.", variant: "success" });
    }

    function resetToDefaults() {
        const defaults = {
            ...pluginSettings,
            ...Object.fromEntries(
            Object.entries(settings.def).map(([key, definition]) => [key, definition.default])
            )
        };
        for (const key of Object.keys(settings.def)) pluginSettings[key] = defaults[key];
        setDraft(defaults);
        setThemeStudioDraft(defaults);
        showToast({ text: "Theme Studio settings reset to defaults.", variant: "success" });
    }

    function applyPreset(preset: typeof PRESETS[number]) {
        updateDraft("accent", preset.accent);
        updateDraft("accentSecondary", preset.secondary);
        updateDraft("background", preset.background);
        updateDraft("surface", preset.surface);
        showToast({ text: `${preset.name} preview loaded. Apply to keep it.`, variant: "success" });
    }

    return (
        <SettingsTab>
            <div className="vc-theme-studio-editor-hero">
                <div>
                    <Heading>Make Discord feel like yours</Heading>
                    <Paragraph>Changes preview here first. Apply them when they feel right, or discard the preview.</Paragraph>
                </div>
                <div className="vc-theme-studio-editor-swatch" style={{
                    background: `linear-gradient(135deg, ${colors.background}, ${colors.surface})`
                }}>
                    <i style={{ background: colors.accent }} />
                    <i style={{ background: colors.accentSecondary }} />
                </div>
                <div className="vc-theme-studio-editor-actions">
                    <Button variant="secondary" onClick={discardDraft}>Discard preview</Button>
                    <Button variant="secondary" onClick={resetToDefaults}>Reset to defaults</Button>
                    <Button onClick={applyDraft}>Apply changes</Button>
                </div>
            </div>

            <section className="vc-theme-studio-editor-presets">
                <Heading>Quick presets</Heading>
                <Paragraph>Presets only replace the four main palette colors. Your wallpaper, layout and feature choices stay untouched.</Paragraph>
                <div className="vc-theme-studio-editor-preset-row">
                    {PRESETS.map(preset => (
                        <Button key={preset.name} variant="secondary" onClick={() => applyPreset(preset)}>
                            <span className="vc-theme-studio-editor-preset-dot" style={{ background: preset.accent }} />
                            {preset.name}
                        </Button>
                    ))}
                </div>
            </section>

            {SECTIONS.map(section => (
                <section className="vc-theme-studio-editor-section" key={section.id}>
                    <div className="vc-theme-studio-editor-section-heading">
                        <Heading>{section.title}</Heading>
                        <Paragraph>{section.description}</Paragraph>
                    </div>
                    <div className="vc-plugins-settings">
                        {section.settings.map(id => <ThemeSetting id={id} key={id} draft={draft} onDraftChange={updateDraft} />)}
                    </div>
                </section>
            ))}
        </SettingsTab>
    );
}
