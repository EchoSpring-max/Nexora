/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 EchoSpring-max
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { NexoraDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { React, Tooltip } from "@webpack/common";
import type { JSX } from "react";

type BadgeEntry = string | {
    badge: string;
    name: string;
};

type BadgeResponse = Record<string, BadgeEntry[]>;

interface CachedBadges {
    badges: BadgeResponse;
    expiresAt: number;
}

const API_URL = "https://globalbadges-bot-production.up.railway.app";
const LEGACY_ASSET_URL = "https://raw.githubusercontent.com/EchoSpring-max/ClientModBadges-API/main";
const CACHE_DURATION = 15 * 60 * 1000;
const badgeCache = new Map<string, CachedBadges>();
const legacyNames: Record<string, string> = {
    early: "Early User",
    hunter: "Bug Hunter"
};
const cl = classNameFactory("nx-badge-bridge-");
const logger = new Logger("BadgeBridge");

async function loadBadges(userId: string, signal: AbortSignal): Promise<BadgeResponse> {
    const cached = badgeCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.badges;

    const response = await fetch(`${API_URL}/users/${userId}`, { signal });
    if (response.status === 404) return {};
    if (!response.ok) throw new Error(`BadgeBridge API returned HTTP ${response.status}`);

    const badges = await response.json() as BadgeResponse;
    badgeCache.set(userId, { badges, expiresAt: Date.now() + CACHE_DURATION });
    return badges;
}

function legacyBadge(source: string, badgeId: string): { image: string; name: string; } {
    const cleanId = badgeId.replace(source, "").trim().split(" ")[0].toLowerCase();
    const cleanName = legacyNames[cleanId] ?? badgeId.replace(source, "").trim();
    return {
        image: `${LEGACY_ASSET_URL}/badges/${source.toLowerCase()}/${cleanId}.png`,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1)
    };
}

function BadgeIcon({ image, name }: { image: string; name: string; }) {
    return (
        <Tooltip text={name}>
            {tooltipProps => <img {...tooltipProps} alt={name} src={image} className={cl("icon")} />}
        </Tooltip>
    );
}

function BadgeBridgeProfile({ userId }: BadgeUserArgs) {
    const [badges, setBadges] = React.useState<BadgeResponse>({});

    React.useEffect(() => {
        const controller = new AbortController();
        loadBadges(userId, controller.signal)
            .then(setBadges)
            .catch(error => {
                if (error instanceof DOMException && error.name === "AbortError") return;
                logger.error("Failed to load badges", error);
            });
        return () => controller.abort();
    }, [userId]);

    const icons: JSX.Element[] = [];
    for (const [source, entries] of Object.entries(badges)) {
        if (source.toLowerCase() === "vencord") continue;

        entries.forEach((entry, index) => {
            const isCommunityBadge = typeof entry !== "string";
            if (isCommunityBadge && !showCommunityBadges()) return;

            const normalized = typeof entry === "string"
                ? legacyBadge(source, entry)
                : { image: entry.badge, name: entry.name.replace(source, "").trim() };
            const label = showSourceLabels() ? `${source} · ${normalized.name}` : normalized.name;
            icons.push(
                <BadgeIcon
                    key={`${source}-${normalized.name}-${index}`}
                    image={normalized.image}
                    name={label}
                />
            );
        });
    }

    return icons.length ? <div className={cl("badges")}>{icons}</div> : null;
}

const profileBadge: ProfileBadge = {
    id: "nexora_badge_bridge_profile_badge",
    component: BadgeBridgeProfile,
    position: BadgePosition.START
};

// Existing installations may not have option keys written until a user changes
// them. Treat an absent key as the documented default, rather than hiding all
// remotely approved badges after an update.
const showSourceLabels = () => Vencord.Settings.plugins.BadgeBridge.showSourceLabels !== false;
const showCommunityBadges = () => Vencord.Settings.plugins.BadgeBridge.showCommunityBadges !== false;

export default definePlugin({
    name: "BadgeBridge",
    description: "Displays approved Nexora community badges and preserved client-mod badges on profiles.",
    authors: [NexoraDevs.EchoSpring],
    dependencies: ["BadgeAPI"],
    required: true,
    enabledByDefault: true,
    tags: ["Appearance"],
    website: API_URL,
    repository: "https://github.com/EchoSpring-max/BadgeBridge",

    start: () => addProfileBadge(profileBadge),
    stop: () => removeProfileBadge(profileBadge),

    options: {
        showSourceLabels: {
            type: OptionType.BOOLEAN,
            description: "Show the badge source in tooltips.",
            default: true,
            restartNeeded: false
        },
        showCommunityBadges: {
            type: OptionType.BOOLEAN,
            description: "Show community badges approved through BadgeBridge.",
            default: true,
            restartNeeded: false
        }
    }
});
