/*
 * Nexora, a Discord client mod
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { FluxDispatcher, React, RestAPI, Select, TextInput, useState } from "@webpack/common";

const statusOptions = [
    { label: "is yapping…", value: 1 },
    { label: "is venting…", value: 2 },
    { label: "is oversharing…", value: 3 },
    { label: "is barking…", value: 4 },
    { label: "is babbling…", value: 5 },
    { label: "is daydreaming…", value: 6 },
    { label: "is meowing…", value: 7 },
];

const animationOptions = [
    { label: "None", value: 0 },
    { label: "Pulse", value: 1 },
    { label: "Ring", value: 2 },
    { label: "Wave", value: 3 },
];

function parseEmoji(value: string) {
    const emoji = value.trim();
    const customEmoji = emoji.match(/^<(a?):[^:>]+:(\d+)>$/);

    return customEmoji
        ? { custom_emoji_id: customEmoji[2] }
        : { unicode_emoji: emoji };
}

function TypingIndicatorTab() {
    const settings = useSettings(["plugins.CustomTypingIndicator.*"]);
    const typingSettings = settings.plugins.CustomTypingIndicator;
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const emojiOne = typingSettings.emojiOne ?? "✨";
    const emojiTwo = typingSettings.emojiTwo ?? "💜";
    const emojiThree = typingSettings.emojiThree ?? "🌙";
    const animation = typingSettings.animation ?? 0;
    const status = typingSettings.status ?? 1;

    async function save(style: Record<string, unknown> | null) {
        const response = await RestAPI.patch({
            url: "/users/@me",
            body: { typing_indicator_style: style }
        }) as { body: Record<string, unknown>; };

        FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: response.body });
    }

    async function apply() {
        const emojis = [emojiOne, emojiTwo, emojiThree].map(parseEmoji);
        const identities = emojis.map(emoji => "custom_emoji_id" in emoji ? emoji.custom_emoji_id : emoji.unicode_emoji);

        if (identities.some(emoji => !emoji)) {
            setMessage("Choose all three emojis before applying your typing indicator.");
            return;
        }

        if (new Set(identities).size !== identities.length) {
            setMessage("Discord requires three different emojis for a custom typing indicator.");
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            await save({ emojis, animation, typing_suggestion: status });
            setMessage("Saved to your Discord account. Your indicator appears when you are the only person typing.");
        } catch (error) {
            setMessage(error instanceof Error
                ? `Discord did not save the typing indicator: ${error.message}`
                : "Discord did not save the typing indicator. Make sure your account has the feature enabled.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsTab>
            <Heading className={Margins.top16}>Custom Typing Indicator</Heading>
            <Paragraph className={Margins.bottom16}>
                Choose the same typing indicator controls available in Discord mobile, right from Nexora desktop.
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                This saves through Discord's normal profile settings. Discord must have enabled Custom Typing Indicator for your account.
            </Notice.Info>

            <Heading>Emojis</Heading>
            <Paragraph className={Margins.bottom8}>
                Select three different Unicode emojis, or paste a custom Discord emoji as <code>&lt;:name:id&gt;</code>.
            </Paragraph>
            <TextInput value={emojiOne} placeholder="First emoji" onChange={value => { typingSettings.emojiOne = value; }} />
            <div className={Margins.top8}>
                <TextInput value={emojiTwo} placeholder="Second emoji" onChange={value => { typingSettings.emojiTwo = value; }} />
            </div>
            <div className={Margins.top8}>
                <TextInput value={emojiThree} placeholder="Third emoji" onChange={value => { typingSettings.emojiThree = value; }} />
            </div>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Animation</Heading>
            <Select
                options={animationOptions}
                isSelected={value => value === animation}
                select={value => { typingSettings.animation = value; }}
                serialize={value => String(value)}
                closeOnSelect
            />

            <Heading className={Margins.top20}>Typing text</Heading>
            <Select
                options={statusOptions}
                isSelected={value => value === status}
                select={value => { typingSettings.status = value; }}
                serialize={value => String(value)}
                closeOnSelect
            />

            <Divider className={Margins.top20} />

            <Button disabled={saving} onClick={apply}>
                {saving ? "Applying…" : "Apply typing indicator"}
            </Button>
            <Button
                variant="dangerPrimary"
                className={Margins.left8}
                disabled={saving}
                onClick={async () => {
                    setSaving(true);
                    setMessage(null);
                    try {
                        await save(null);
                        setMessage("Your custom typing indicator was removed.");
                    } catch (error) {
                        setMessage(error instanceof Error
                            ? `Discord did not remove the typing indicator: ${error.message}`
                            : "Discord did not remove the typing indicator.");
                    } finally {
                        setSaving(false);
                    }
                }}
            >
                Reset
            </Button>
            {message && <Paragraph className={Margins.top16}>{message}</Paragraph>}
        </SettingsTab>
    );
}

export default wrapTab(TypingIndicatorTab, "Typing Indicator");
