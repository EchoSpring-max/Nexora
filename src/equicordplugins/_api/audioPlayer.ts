/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { AudioPlayerInternal, AudioPlayerOptions, audioProcessorFunctions, AudioType, identifyAudioType, playAudio } from "@api/AudioPlayer";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "AudioPlayerAPI",
    description: "API to play internal Discord audio files or external audio links.",
    authors: [EquicordDevs.Etorix],
    AudioType,
    playAudio,

    patches: [
        {
            find: "could not play audio",
            group: true,
            replacement: [
                {
                    // Uses the audio as-is if external, otherwise checks for an internal Discord sound.
                    // Also force loads the internal sounds module to account for the second patch group below,
                    // as well as accounting for not calling the module in this patch when this.type is not DISCORD.
                    match: /(let \i=class.{0,1000}?new Audio;\i.src=)((\i\(\d+\))(?:\(`\.\/\$\{|.{0,50}concat\())this.name(\}\.mp3`\))/,
                    replace: "$3;$1this.type!==$self.AudioType.DISCORD?this.audio:$2this.audio$4"
                },
                {
                    // Adds an optional persistent boolean as well as a callback and error handler to the
                    // audio player which is called after the audio finishes playing and when an error occurs.
                    // Also processes the audio before playing to apply override functions set by plugins.
                    match: /constructor\(((?:\i,){3}\i)([^)]*)\)\{[^}]+}/,
                    replace: "constructor(options,$1$2){$self.buildPlayer(this,options,$1);}"
                },
                {
                    // Prevents an error from the source being cleared during destroyAudio().
                    match: /(\i.pause\(\),(\i).src="".{0,20}?null)/,
                    replace: "$2.onerror=()=>{},$1"
                },
                {
                    // Applies the playback rate passed through options.
                    match: /(?<=(\i).onloadeddata=\(\)=>{)/,
                    replace: "$1.playbackRate=this._speed,"
                },
                {
                    // Makes use of the error handler if an error occurs during playback.
                    match: /(onerror=\()(\)=>{)(?=let)/,
                    replace: "$1error$2this.onError?.(error);"
                },
                {
                    // Makes use of the onEnded callback and persists flag once the audio ends.
                    match: /(?<=onended=\(\)=>)(.{0,40}?),/,
                    replace: "{$self.stopAudio(this);this.onEnded?.();},"
                },
                {
                    // Makes use of the persists flag once the audio is stopped.
                    match: /(stop\()(\){)this.destroyAudio\(\)/,
                    replace: "$1restart$2$self.stopAudio(this,restart);"
                },
                {
                    // Use our playAudio function in place of the default playGiftSound.
                    match: /let \i=new Audio\((\(0,\i.\i\)\(\i\)).{0,35}?play\(\)/,
                    replace: "$self.playAudio($1)"
                }
            ]
        },
        // Do not patch Discord's SoundUtils separately from the grouped player patch above.
        // Discord changes this code frequently; applying only the old argument-shifting patch
        // after the player patch no longer matches makes ordinary sounds resolve as
        // "./undefined.mp3". Normal Discord sounds must remain untouched until the full API
        // patch can match the active client build.
    ],

    stopAudio(player: AudioPlayerInternal, restart?: boolean) {
        if (restart) {
            player.ensureAudio().then(audio => {
                audio.currentTime = 0;
                audio.play();
            });
        } else {
            if (!player.persistent) {
                player.destroyAudio();
            } else {
                // Use _audio instead of ensureAudio() to avoid
                // loading the audio if there is none loaded.
                player._audio?.then(audio => {
                    audio.pause();
                    audio.currentTime = 0;
                });
            }
        }
    },

    processAudio(player: AudioPlayerInternal) {
        player.preprocessDataPrevious = player.preprocessDataCurrent ? structuredClone(player.preprocessDataCurrent) : null;
        player.preprocessDataCurrent = structuredClone(player.preprocessDataOriginal);
        player.preprocessDataCurrent.volume *= 100;

        for (const processor of Object.values(audioProcessorFunctions)) {
            processor(player.preprocessDataCurrent);
        }

        player.preprocessDataCurrent.volume /= 100;
        player.audio = player.preprocessDataCurrent.audio;
        player.type = identifyAudioType(player.preprocessDataCurrent.audio);
        player._volume = Math.max(0, Math.min(1, player.preprocessDataCurrent.volume));
        player._speed = Math.max(0.0625, Math.min(16, player.preprocessDataCurrent.speed));

        if (player.preprocessDataCurrent.audio !== player.preprocessDataPrevious?.audio) {
            player.destroyAudio();
            player.persistent && player.ensureAudio();
        }

        if (player.preprocessDataCurrent.volume !== player.preprocessDataPrevious?.volume) {
            player._audio?.then(audio => {
                audio.volume = player._volume;
            });
        }

        if (player.preprocessDataCurrent.speed !== player.preprocessDataPrevious?.speed) {
            player._audio?.then(audio => {
                audio.playbackRate = player._speed;
            });
        }
    },

    buildPlayer(
        player: AudioPlayerInternal,
        options: AudioPlayerOptions = {},
        audio: string,
        unused: any,
        internalVolume: number,
        channel: string
    ) {
        player.preprocessDataOriginal = {
            audio: audio,
            type: identifyAudioType(audio),
            volume: Math.max(0, Math.min(1, (internalVolume || (options.volume ? options.volume / 100 : 1)))),
            speed: Math.max(0.0625, Math.min(16, options.speed ?? 1)),
        };

        player.audio = player.preprocessDataOriginal.audio;
        player._audio = null;
        player._volume = player.preprocessDataOriginal.volume;
        player._speed = player.preprocessDataOriginal.speed;
        player.preload = options.preload ?? false;
        player.persistent = options.persistent ?? false;
        player.type = identifyAudioType(audio);
        player.outputChannel = channel;
        player.onEnded = options.onEnded;
        player.onError = options.onError;

        player.processAudio = () => this.processAudio(player);
        player.processAudio();
        player.preload && player.ensureAudio();
    }
});
