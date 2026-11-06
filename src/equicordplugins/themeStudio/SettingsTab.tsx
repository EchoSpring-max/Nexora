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
import { showToast } from "@webpack/common";

import { settings } from "./index";

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

function applyPreset(preset: typeof PRESETS[number]) {
    settings.store.accent = preset.accent;
    settings.store.accentSecondary = preset.secondary;
    settings.store.background = preset.background;
    settings.store.surface = preset.surface;
    showToast({ text: `${preset.name} applied.`, variant: "success" });
}

function noop() { }

function ThemeSetting({ id }: { id: keyof typeof settings.def; }) {
    const pluginSettings = useSettings(["plugins.ThemeStudio.*"]).plugins.ThemeStudio;
    const setting = settings.def[id];
    const Component = OptionComponentMap[setting.type];

    return (
        <ErrorBoundary noop>
            <Component
                id={id}
                setting={setting}
                onChange={value => pluginSettings[id] = value}
                pluginSettings={pluginSettings}
                definedSettings={settings}
                closePluginSettings={noop}
            />
        </ErrorBoundary>
    );
}

export default function ThemeStudioTab() {
    const colors = settings.use(["accent", "accentSecondary", "background", "surface"]);

    return (
        <SettingsTab>
            <div className="vc-theme-studio-editor-hero">
                <div>
                    <Heading>Make Discord feel like yours</Heading>
                    <Paragraph>Every change applies immediately. Start with a preset, then fine-tune only the sections you care about.</Paragraph>
                </div>
                <div className="vc-theme-studio-editor-swatch" style={{
                    background: `linear-gradient(135deg, ${colors.background}, ${colors.surface})`
                }}>
                    <i style={{ background: colors.accent }} />
                    <i style={{ background: colors.accentSecondary }} />
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
                        {section.settings.map(id => <ThemeSetting id={id} key={id} />)}
                    </div>
                </section>
            ))}
        </SettingsTab>
    );
}
