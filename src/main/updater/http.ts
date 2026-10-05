/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { writeFileSync } from "original-fs";

import gitRemote from "~git-remote";

import { Updater } from ".";
import { ASAR_FILE } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
let PendingUpdate: string | null = null;

interface GithubRelease {
    tag_name: string;
    name: string | null;
    author?: { login?: string; };
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

function isNewerVersion(tag: string) {
    const releaseParts = tag.replace(/^v/i, "").split(".").map(part => Number.parseInt(part, 10) || 0);
    const currentParts = VERSION.split(".").map(part => Number.parseInt(part, 10) || 0);

    for (let i = 0; i < Math.max(releaseParts.length, currentParts.length); i++) {
        const releasePart = releaseParts[i] ?? 0;
        const currentPart = currentParts[i] ?? 0;
        if (releasePart !== currentPart)
            return releasePart > currentPart;
    }

    return false;
}

function getDesktopAsset(release: GithubRelease) {
    const asset = release.assets.find(asset => asset.name === ASAR_FILE);
    if (!asset)
        throw new Error(`The ${release.tag_name} release does not include ${ASAR_FILE}.`);
    return asset;
}

async function listUpdates() {
    const release = await githubGet<GithubRelease>("/releases/latest");
    if (!isNewerVersion(release.tag_name)) return [];

    getDesktopAsset(release);
    return [{
        hash: release.tag_name,
        author: release.author?.login ?? "Nexora",
        message: release.name ?? `Nexora ${release.tag_name}`
    }];
}

async function fetchUpdate() {
    const release = await githubGet<GithubRelease>("/releases/latest");
    if (!isNewerVersion(release.tag_name)) return false;

    const asset = getDesktopAsset(release);
    PendingUpdate = asset.browser_download_url;

    return true;
}

async function applyUpdate() {
    if (!PendingUpdate) return true;

    const data = await fetchBuffer(PendingUpdate);
    writeFileSync(__dirname, data, { flush: true });

    PendingUpdate = null;

    return true;
}

const HttpUpdater: Updater = {
    getRepo: async () => `https://github.com/${gitRemote}`,
    listUpdates,
    fetchUpdate,
    applyUpdate
};

export default HttpUpdater;
