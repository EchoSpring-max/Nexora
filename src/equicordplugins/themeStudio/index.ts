/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { managedStyleRootNode } from "@api/Styles";
import { PaintbrushIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { NexoraDevs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { SettingsRouter, UserStore } from "@webpack/common";

let variableStyle: HTMLStyleElement | null = null;
let greeting: HTMLDivElement | null = null;
let greetingTimer: number | undefined;
let removeTimer: number | undefined;

function validColor(value: string) {
    return /^#[\da-f]{6}$/i.test(value) || "Use a six digit hex color such as #8b5cf6.";
}

function refreshStyle() {
    if (!variableStyle) return;

    const s = settings.store;
    document.documentElement.classList.toggle("vc-theme-studio-message-actions", s.enhancedMessageActions);
    document.documentElement.classList.toggle("vc-theme-studio-name-bubbles", s.nameBubbles);
    document.documentElement.classList.toggle("vc-theme-studio-spotify", s.spotifyPanel);
    const wallpaper = s.wallpaper.trim()
        ? `url("${s.wallpaper.replace(/["\\]/g, "\\$&")}")`
        : "none";

    variableStyle.textContent = `:root {
        --nts-accent: ${s.accent};
        --nts-accent-secondary: ${s.accentSecondary};
        --nts-background: ${s.background};
        --nts-surface-color: ${s.surface};
        --nts-surface: color-mix(in srgb, ${s.surface} ${s.surfaceOpacity}%, transparent);
        --nts-surface-strong: color-mix(in srgb, ${s.surface} ${Math.min(s.surfaceOpacity + 8, 100)}%, transparent);
        --nts-text: ${s.text};
        --nts-muted: ${s.muted};
        --nts-wallpaper: ${wallpaper};
        --nts-wallpaper-dim: ${s.wallpaperDim / 100};
        --nts-blur: ${s.blur}px;
        --nts-radius: ${s.rounding}px;
        --nts-spacing: ${s.spacing}px;
        --nts-font-size: ${s.fontSize}px;
        --nts-channel-width: ${s.channelWidth}px;
        --nts-member-width: ${s.memberWidth}px;
        --nts-message-gap: ${s.compactMessages ? 0 : s.messageSpacing}px;
        --nts-name-bubble-opacity: ${s.nameBubbleOpacity}%;
        --nts-name-bubble-hover-opacity: ${s.nameBubbleHoverOpacity}%;
        --nts-name-bubble-padding: ${s.nameBubblePadding}px;
        --nts-name-bubble-radius: ${s.nameBubbleRounding}px;
        --nts-spotify-accent: ${s.spotifyUseThemeAccent ? "var(--nts-accent)" : "#1db954"};
        --nts-transition: ${s.animations ? "160ms" : "0ms"};
        --nts-transition-slow: ${s.animations ? "240ms" : "0ms"};
        --nts-message-animation: ${s.animations ? "nts-message-in" : "none"};
    }
    ${s.showMembers ? "" : ':is([class^="membersWrap_"], [class*=" membersWrap_"]) { display: none !important; }'}
    ${s.showChannelSidebar ? "" : ':is([class^="sidebarList_"], [class*=" sidebarList_"]) { display: none !important; }'}
    ${s.showServerList ? "" : ':is([class^="guilds_"], [class*=" guilds_"]) { display: none !important; }'}
    ${s.showUserPanel ? "" : ':is([class^="panels_"], [class*=" panels_"]) { display: none !important; }'}
    ${s.showSearch ? "" : ':is([class^="toolbar_"], [class*=" toolbar_"]) :is([class^="search_"], [class*=" search_"]) { display: none !important; }'}
    ${s.showHelp ? "" : '[aria-label="Help"] { display: none !important; }'}
    ${s.showShop ? "" : 'a[href="/shop"], a[href^="/shop?"] { display: none !important; }'}
    ${s.showNitro ? "" : 'a[href="/store"], a[href^="/store?"] { display: none !important; }'}
    ${s.customCss}`;
}

function showGreeting() {
    if (!settings.store.showGreeting) return;

    const user = UserStore.getCurrentUser();
    const name = user?.globalName || user?.username || "friend";
    greeting = document.createElement("div");
    greeting.className = "vc-theme-studio-greeting";
    greeting.textContent = settings.store.greetingText.replaceAll("{name}", name);
    document.body.append(greeting);
    greetingTimer = window.setTimeout(() => greeting?.classList.add("vc-theme-studio-greeting-leaving"), 3500);
    removeTimer = window.setTimeout(() => {
        greeting?.remove();
        greeting = null;
    }, 4000);
}

const live = { onChange: refreshStyle };
export const settings = definePluginSettings({
    accent: {
        type: OptionType.STRING,
        description: "Primary accent color.",
        default: "#8b5cf6",
        isValid: validColor,
        ...live
    },
    accentSecondary: {
        type: OptionType.STRING,
        description: "Secondary accent used by gradients and highlights.",
        default: "#38bdf8",
        isValid: validColor,
        ...live
    },
    background: {
        type: OptionType.STRING,
        description: "Base background color.",
        default: "#090b12",
        isValid: validColor,
        ...live
    },
    surface: {
        type: OptionType.STRING,
        description: "Panel and card color.",
        default: "#181b2a",
        isValid: validColor,
        ...live
    },
    text: {
        type: OptionType.STRING,
        description: "Main text color.",
        default: "#f4f5fb",
        isValid: validColor,
        ...live
    },
    muted: {
        type: OptionType.STRING,
        description: "Muted text and icon color.",
        default: "#a8adc2",
        isValid: validColor,
        ...live
    },
    wallpaper: {
        type: OptionType.STRING,
        description: "HTTPS wallpaper URL. Leave empty for a clean gradient.",
        default: "",
        isValid: (value: string) => !value.trim() || /^https:\/\//i.test(value) || "Use an HTTPS URL or leave this empty.",
        ...live
    },
    surfaceOpacity: {
        type: OptionType.SLIDER,
        description: "Panel opacity.",
        markers: [35, 50, 65, 80, 92, 100],
        default: 82,
        stickToMarkers: false,
        ...live
    },
    wallpaperDim: {
        type: OptionType.SLIDER,
        description: "Wallpaper darkness.",
        markers: [0, 20, 40, 60, 80, 100],
        default: 55,
        stickToMarkers: false,
        ...live
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Glass blur strength.",
        markers: [0, 4, 8, 12, 18, 24, 32],
        default: 14,
        stickToMarkers: false,
        ...live
    },
    rounding: {
        type: OptionType.SLIDER,
        description: "Corner rounding.",
        markers: [0, 4, 8, 12, 16, 22, 28],
        default: 14,
        stickToMarkers: false,
        ...live
    },
    spacing: {
        type: OptionType.SLIDER,
        description: "Space between the main panels.",
        markers: [0, 4, 8, 12, 16, 20],
        default: 8,
        stickToMarkers: false,
        ...live
    },
    fontSize: {
        type: OptionType.SLIDER,
        description: "Interface font size.",
        markers: [12, 13, 14, 15, 16, 17, 18],
        default: 15,
        stickToMarkers: false,
        ...live
    },
    channelWidth: {
        type: OptionType.SLIDER,
        description: "Channel sidebar width.",
        markers: [200, 220, 240, 260, 280, 320, 360],
        default: 260,
        stickToMarkers: false,
        ...live
    },
    memberWidth: {
        type: OptionType.SLIDER,
        description: "Member list width.",
        markers: [180, 200, 220, 240, 280, 320],
        default: 240,
        stickToMarkers: false,
        ...live
    },
    messageSpacing: {
        type: OptionType.SLIDER,
        description: "Extra space between message groups.",
        markers: [0, 2, 4, 6, 8, 12, 16],
        default: 4,
        stickToMarkers: false,
        ...live
    },
    animations: {
        type: OptionType.BOOLEAN,
        description: "Use smooth, restrained interface motion.",
        default: true,
        ...live
    },
    compactMessages: {
        type: OptionType.BOOLEAN,
        description: "Tighten message spacing.",
        default: false,
        ...live
    },
    showMembers: {
        type: OptionType.BOOLEAN,
        description: "Show the member list.",
        default: true,
        ...live
    },
    showChannelSidebar: {
        type: OptionType.BOOLEAN,
        description: "Show the channel sidebar.",
        default: true,
        ...live
    },
    showServerList: {
        type: OptionType.BOOLEAN,
        description: "Show the server list.",
        default: true,
        ...live
    },
    showUserPanel: {
        type: OptionType.BOOLEAN,
        description: "Show the account and voice panel.",
        default: true,
        ...live
    },
    showSearch: {
        type: OptionType.BOOLEAN,
        description: "Show the search control.",
        default: true,
        ...live
    },
    showHelp: {
        type: OptionType.BOOLEAN,
        description: "Show the help button.",
        default: false,
        ...live
    },
    showShop: {
        type: OptionType.BOOLEAN,
        description: "Show the shop entry.",
        default: false,
        ...live
    },
    showNitro: {
        type: OptionType.BOOLEAN,
        description: "Show the Nitro entry.",
        default: false,
        ...live
    },
    showGreeting: {
        type: OptionType.BOOLEAN,
        description: "Show a centered welcome toast when Nexora starts.",
        default: true
    },
    greetingText: {
        type: OptionType.STRING,
        description: "Welcome text. Use {name} for your display name.",
        default: "Welcome back, {name}."
    },
    enhancedMessageActions: {
        type: OptionType.BOOLEAN,
        description: "Use a larger colorful message toolbar with all available actions.",
        default: true,
        ...live
    },
    nameBubbles: {
        type: OptionType.BOOLEAN,
        description: "Place role-colored bubbles behind usernames and compatible custom names.",
        default: true,
        ...live
    },
    nameBubbleOpacity: {
        type: OptionType.SLIDER,
        description: "Username bubble strength.",
        markers: [5, 10, 15, 20, 25, 30, 40],
        default: 20,
        stickToMarkers: false,
        ...live
    },
    nameBubbleHoverOpacity: {
        type: OptionType.SLIDER,
        description: "Username bubble strength while hovered.",
        markers: [10, 20, 25, 30, 35, 40, 50],
        default: 30,
        stickToMarkers: false,
        ...live
    },
    nameBubblePadding: {
        type: OptionType.SLIDER,
        description: "Horizontal space inside username bubbles.",
        markers: [0, 2, 4, 6, 8, 10, 12],
        default: 6,
        stickToMarkers: false,
        ...live
    },
    nameBubbleRounding: {
        type: OptionType.SLIDER,
        description: "Username bubble corner rounding.",
        markers: [0, 3, 5, 7, 9, 12, 16],
        default: 5,
        stickToMarkers: false,
        ...live
    },
    spotifyPanel: {
        type: OptionType.BOOLEAN,
        description: "Style the MusicControls Spotify player to match Theme Studio.",
        default: true,
        ...live
    },
    spotifyUseThemeAccent: {
        type: OptionType.BOOLEAN,
        description: "Use the theme accent for Spotify controls instead of Spotify green.",
        default: true,
        ...live
    },
    customCss: {
        type: OptionType.STRING,
        description: "Advanced CSS overrides for anything not covered above.",
        default: "",
        multiline: true,
        ...live
    }
});

export default definePlugin({
    name: "ThemeStudio",
    description: "A calm glass theme with live controls for Discord's colors, layout, motion and visibility.",
    authors: [NexoraDevs.EchoSpring],
    tags: ["Appearance", "Customisation"],
    dependencies: ["Settings", "ShowAllMessageButtons"],
    settings,
    startAt: StartAt.WebpackReady,
    toolboxActions: {
        "Open Theme Studio"() {
            SettingsRouter.openUserSettings("nexora_theme_studio_panel");
        }
    },
    start() {
        SettingsPlugin.customEntries.push({
            key: "nexora_theme_studio",
            title: "Theme Studio",
            Component: require("./SettingsTab").default,
            Icon: PaintbrushIcon
        });
        variableStyle = createAndAppendStyle("vc-theme-studio-vars", managedStyleRootNode);
        refreshStyle();
        showGreeting();
    },
    stop() {
        if (greetingTimer !== undefined) clearTimeout(greetingTimer);
        if (removeTimer !== undefined) clearTimeout(removeTimer);
        greeting?.remove();
        greeting = null;
        greetingTimer = undefined;
        removeTimer = undefined;
        document.documentElement.classList.remove("vc-theme-studio-message-actions");
        document.documentElement.classList.remove("vc-theme-studio-name-bubbles");
        document.documentElement.classList.remove("vc-theme-studio-spotify");
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === "nexora_theme_studio");
        variableStyle?.remove();
        variableStyle = null;
    }
});
