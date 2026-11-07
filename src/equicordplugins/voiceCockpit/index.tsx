/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import { NexoraDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelRTCStore, ChannelStore, createRoot, FluxDispatcher, GuildStore, MediaEngineStore, SelectedChannelStore, useEffect, UserStore, useState, useStateFromStores, VoiceActions, VoiceStateStore } from "@webpack/common";
import type { Root } from "react-dom/client";

const settings = definePluginSettings({
    showSpeakers: {
        type: OptionType.BOOLEAN,
        description: "Show who is currently speaking.",
        default: true
    },
    showActivityMeter: {
        type: OptionType.BOOLEAN,
        description: "Show a subtle voice activity meter. It uses Discord's speaking signal; it does not capture or record audio.",
        default: true
    },
    showVoiceControls: {
        type: OptionType.BOOLEAN,
        description: "Show mute and deafen controls in the cockpit.",
        default: true
    },
    panelWidth: {
        type: OptionType.SLIDER,
        description: "Cockpit panel width.",
        markers: [260, 280, 300, 320, 360],
        default: 300,
        stickToMarkers: false
    },
    dockSide: {
        type: OptionType.SELECT,
        description: "Which side of the Discord window the cockpit rests on.",
        options: [
            { label: "Right", value: "right", default: true },
            { label: "Left", value: "left" }
        ]
    }
});

type SpeakingParticipant = {
    user: { id: string; username?: string; globalName?: string };
    speaking: boolean;
};

let panelHost: HTMLDivElement | null = null;
let panelRoot: Root | null = null;

function isDetachedDiscordWindow() {
    return Boolean(window.__OVERLAY__ || window.opener || window.name.startsWith("DISCORD_"));
}

function getCurrentVoiceChannelId() {
    const userId = UserStore.getCurrentUser()?.id;
    return userId
        ? VoiceStateStore.getVoiceStateForUser(userId)?.channelId ?? SelectedChannelStore.getVoiceChannelId()
        : SelectedChannelStore.getVoiceChannelId();
}

function closeCockpit() {
    panelRoot?.unmount();
    panelRoot = null;
    panelHost?.remove();
    panelHost = null;
}

function toggleCockpit() {
    if (isDetachedDiscordWindow()) return;
    if (panelRoot) {
        closeCockpit();
        return;
    }

    panelHost = document.createElement("div");
    panelHost.className = "vc-voice-cockpit-host";
    document.body.append(panelHost);
    panelRoot = createRoot(panelHost);
    panelRoot.render(<VoiceCockpit onClose={closeCockpit} />);
}

function CockpitIcon({ height = 20, width = 20 }: { height?: number; width?: number; }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6 10v1a6 6 0 0 0 12 0v-1M12 17v4m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function CockpitButton() {
    const channelId = useStateFromStores([SelectedChannelStore, VoiceStateStore], getCurrentVoiceChannelId);
    if (!channelId || isDetachedDiscordWindow()) return null;

    return (
        <HeaderBarButton
            icon={CockpitIcon}
            tooltip="Voice Cockpit"
            aria-label="Open Voice Cockpit"
            selected={!!panelRoot}
            onClick={toggleCockpit}
        />
    );
}

function VoiceCockpit({ onClose }: { onClose: () => void; }) {
    const channelId = useStateFromStores([SelectedChannelStore, VoiceStateStore], getCurrentVoiceChannelId);
    const [tick, setTick] = useState(0);
    const [selfSpeaking, setSelfSpeaking] = useState(false);
    const muted = useStateFromStores([MediaEngineStore], () => MediaEngineStore.isSelfMute());
    const deafened = useStateFromStores([MediaEngineStore], () => MediaEngineStore.isSelfDeaf());
    const prefs = settings.use(["showSpeakers", "showActivityMeter", "showVoiceControls", "panelWidth", "dockSide"]);

    useEffect(() => {
        const timer = window.setInterval(() => setTick(value => value + 1), 240);
        const userId = UserStore.getCurrentUser()?.id;
        const onSpeaking = ({ userId: speakingUserId, speakingFlags }: { userId: string; speakingFlags: number; }) => {
            if (speakingUserId === userId) setSelfSpeaking(speakingFlags === 1);
            setTick(value => value + 1);
        };
        FluxDispatcher.subscribe("SPEAKING", onSpeaking);
        return () => {
            window.clearInterval(timer);
            FluxDispatcher.unsubscribe("SPEAKING", onSpeaking);
        };
    }, []);

    useEffect(() => {
        if (!channelId) onClose();
    }, [channelId, onClose]);

    if (!channelId) return null;

    // Reading the stores on this small timer also refreshes the display if Discord
    // changes the call roster without emitting a speaking event.
    void tick;
    const channel = ChannelStore.getChannel(channelId);
    const channelName = channel?.name ?? "Voice call";
    const guildName = channel?.guild_id ? GuildStore.getGuild(channel.guild_id)?.name : undefined;
    const participants = (ChannelRTCStore.getSpeakingParticipants(channelId) ?? []) as SpeakingParticipant[];
    const speakers = participants.filter(participant => participant.speaking && participant.user?.id);
    const memberCount = Object.keys(VoiceStateStore.getVoiceStatesForChannel(channelId) ?? {}).length;
    const currentUser = UserStore.getCurrentUser();
    const currentName = currentUser?.globalName || currentUser?.username || "You";
    const selfIsListed = speakers.some(participant => participant.user.id === currentUser?.id);
    const speakerRows = [
        ...(selfSpeaking && !selfIsListed && currentUser ? [{ user: currentUser, speaking: true }] : []),
        ...speakers
    ].slice(0, 4);

    return (
        <section className={`vc-voice-cockpit vc-voice-cockpit-${prefs.dockSide}`} style={{ width: prefs.panelWidth }} aria-label="Voice Cockpit">
            <header className="vc-voice-cockpit-header">
                <div className="vc-voice-cockpit-title-wrap">
                    <span className="vc-voice-cockpit-live-dot" />
                    <div>
                        <strong>Voice Cockpit</strong>
                        <div className="vc-voice-cockpit-subtitle">{guildName ? `${guildName} · ` : ""}{channelName} · {memberCount} {memberCount === 1 ? "person" : "people"}</div>
                    </div>
                </div>
                <button className="vc-voice-cockpit-close" onClick={onClose} aria-label="Close Voice Cockpit">×</button>
            </header>

            {prefs.showActivityMeter && <div className="vc-voice-cockpit-meter-row">
                <span className={`vc-voice-cockpit-mic ${selfSpeaking && !muted ? "is-speaking" : ""}`} aria-hidden="true">
                    {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
                </span>
                <span className="vc-voice-cockpit-meter-label">{muted ? "Mic muted" : selfSpeaking ? "Voice active" : "Mic ready"}</span>
            </div>}

            {prefs.showSpeakers && <div className="vc-voice-cockpit-speakers">
                <div className="vc-voice-cockpit-section-label">SPEAKING NOW</div>
                {speakerRows.length ? speakerRows.map(({ user }) => {
                    const name = user.globalName || user.username || "Unknown user";
                    return <div className="vc-voice-cockpit-speaker" key={user.id}>
                        <span className="vc-voice-cockpit-avatar">{name.slice(0, 1).toUpperCase()}</span>
                        <span className="vc-voice-cockpit-speaker-name">{name}</span>
                        <span className="vc-voice-cockpit-speaking-bars"><i /><i /><i /></span>
                    </div>;
                }) : <div className="vc-voice-cockpit-empty">{currentName ? "All quiet for now" : "Waiting for voice activity"}</div>}
            </div>}

            {prefs.showVoiceControls && <footer className="vc-voice-cockpit-controls">
                <button className={`vc-voice-cockpit-control ${muted ? "is-active" : ""}`} onClick={() => VoiceActions.toggleSelfMute()} aria-pressed={muted}>
                    <span aria-hidden="true">{muted ? "×" : "⌁"}</span>{muted ? "Unmute" : "Mute"}
                </button>
                <button className={`vc-voice-cockpit-control ${deafened ? "is-active" : ""}`} onClick={() => VoiceActions.toggleSelfDeaf()} aria-pressed={deafened}>
                    <span aria-hidden="true">{deafened ? "×" : "◖"}</span>{deafened ? "Undeafen" : "Deafen"}
                </button>
            </footer>}
            <span className="vc-voice-cockpit-footnote">Activity only · no audio is recorded</span>
        </section>
    );
}

export default definePlugin({
    name: "VoiceCockpit",
    description: "A compact, customizable call panel with live voice activity and quick controls.",
    tags: ["Voice", "Utility", "Appearance"],
    authors: [NexoraDevs.EchoSpring],
    settings,
    dependencies: ["HeaderBarAPI"],
    headerBarButton: {
        icon: CockpitIcon,
        priority: 5,
        render: () => <CockpitButton />
    },
    stop: closeCockpit
});
