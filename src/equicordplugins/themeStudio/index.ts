/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle, requireStyle } from "@api/Styles";
import { PaintbrushIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { NexoraDevs } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { removeFromArray } from "@utils/misc";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { SettingsRouter, UserStore } from "@webpack/common";

import style from "./style.css?managed";

let variableStyle: HTMLStyleElement | null = null;
let greeting: HTMLDivElement | null = null;
let greetingTimer: number | undefined;
let removeTimer: number | undefined;

const STOCK_OVERLAY_WINDOWS = new Set([
    "DISCORD_OVERLAY_POPOUT",
    "DISCORD_OutOfProcessOverlay",
    "DISCORD_CHANNEL_CALL_POPOUT",
    "DISCORD_CALL_TILE_POPOUT"
]);

function isOverlayWindow() {
    return Boolean(window.__OVERLAY__) || STOCK_OVERLAY_WINDOWS.has(window.name);
}

function validColor(value: string) {
    return /^#[\da-f]{6}$/i.test(value) || "Use a six digit hex color such as #8b5cf6.";
}

function refreshStyle() {
    if (!variableStyle) return;

    const s = settings.store;
    document.documentElement.classList.toggle("vc-theme-studio-message-actions", s.enhancedMessageActions);
    document.documentElement.classList.toggle("vc-theme-studio-name-bubbles", s.nameBubbles);
    document.documentElement.classList.toggle("vc-theme-studio-spotify", s.spotifyPanel);
    document.documentElement.classList.toggle("vc-theme-studio-music-controls", s.spotifyPanel);
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
        --nts-muted: ${s.unifiedTextColor ? s.text : s.muted};
        --nts-wallpaper: ${wallpaper};
        --nts-wallpaper-dim: ${s.wallpaperDim / 100};
        --nts-blur: ${Math.round(s.blur * 1.75)}px;
        --nts-radius: ${Math.round(s.rounding * 1.3)}px;
        --nts-spacing: ${s.spacing}px;
        --nts-font-size: ${s.fontSize}px;
        --nts-channel-width: ${s.channelWidth}px;
        --nts-member-width: ${s.memberWidth}px;
        --nts-message-gap: ${s.compactMessages ? 0 : s.messageSpacing}px;
        --nts-name-bubble-opacity: ${s.nameBubbleOpacity}%;
        --nts-name-bubble-hover-opacity: ${s.nameBubbleHoverOpacity}%;
        --nts-name-bubble-padding: ${s.nameBubblePadding}px;
        --nts-name-bubble-radius: ${s.nameBubbleRounding}px;
        --nts-music-accent: ${s.spotifyUseThemeAccent ? "var(--nts-accent)" : "#1db954"};
        --nts-spotify-accent: var(--nts-music-accent);
        --nts-transition: ${s.animations ? "160ms" : "0ms"};
        --nts-transition-slow: ${s.animations ? "240ms" : "0ms"};
        --nts-message-animation: ${s.animations ? "nts-message-in" : "none"};
    }
    ${s.showMembers ? "" : ':is([class^="membersWrap_"], [class*=" membersWrap_"]) { display: none !important; }'}
    ${s.showChannelSidebar ? "" : ':is([class^="sidebarList"], [class*=" sidebarList"]) { display: none !important; }'}
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
        description: "Text color used throughout Discord.",
        default: "#f4f5fb",
        isValid: validColor,
        ...live
    },
    unifiedTextColor: {
        type: OptionType.BOOLEAN,
        description: "Use the main text color for secondary, muted and placeholder text too.",
        default: true,
        ...live
    },
    muted: {
        type: OptionType.STRING,
        description: "Secondary text and icon color when unified text colors are disabled.",
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
        description: "Glass panel opacity. Lower values reveal more of the wallpaper.",
        markers: [35, 50, 65, 80, 92, 100],
        default: 68,
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
        description: "Frosted-glass blur intensity. Higher values soften the wallpaper behind panels.",
        markers: [0, 8, 14, 20, 28, 40, 56],
        default: 28,
        stickToMarkers: false,
        ...live
    },
    rounding: {
        type: OptionType.SLIDER,
        description: "Corner rounding for panels, cards and controls.",
        markers: [0, 6, 12, 16, 20, 28, 40],
        default: 20,
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
        description: "Style MusicControls players and lyrics in the user panel to match Theme Studio.",
        default: true,
        ...live
    },
    spotifyUseThemeAccent: {
        type: OptionType.BOOLEAN,
        description: "Use the theme accent for MusicControls instead of each service's default color.",
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
        // Keep Theme Studio styles out of Discord's game overlay renderer.
        // Its transparent full-screen window sits over the game, so themed glass
        // backgrounds there tint the game itself.
        if (isOverlayWindow()) return;

        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "nexora_theme_studio",
            title: "Theme Studio",
            Component: require("./SettingsTab").default,
            Icon: PaintbrushIcon
        });
        variableStyle = createAndAppendStyle("vc-theme-studio-vars", document.head);
        // Keep the stylesheet local to this renderer instead of copying it into
        // Discord's separate game overlay window.
        const themeStyle = requireStyle(style).dom;
        if (themeStyle) document.head.append(themeStyle);
        refreshStyle();
        showGreeting();
    },
    stop() {
        if (isOverlayWindow()) return;

        if (greetingTimer !== undefined) clearTimeout(greetingTimer);
        if (removeTimer !== undefined) clearTimeout(removeTimer);
        greeting?.remove();
        greeting = null;
        greetingTimer = undefined;
        removeTimer = undefined;
        document.documentElement.classList.remove("vc-theme-studio-message-actions");
        document.documentElement.classList.remove("vc-theme-studio-name-bubbles");
        document.documentElement.classList.remove("vc-theme-studio-spotify");
        document.documentElement.classList.remove("vc-theme-studio-music-controls");
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === "nexora_theme_studio");
        disableStyle(style);
        variableStyle?.remove();
        variableStyle = null;
    }
});
