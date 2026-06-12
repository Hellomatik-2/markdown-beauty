"use client";

/**
 * VideoPlayer — primitive sobre `<video>` HTML5 o iframe de YouTube.
 *
 * Diseño Apple HIG: deferir al control nativo del proveedor (browser
 * para HTML5, YouTube player para YT) en vez de reimplementar
 * play/pause/scrubber/volumen. Los usuarios ya conocen esos controles.
 *
 *   ┌────────────────────────────────────────────────┐
 *   │                                                │
 *   │              [poster / vídeo]                  │
 *   │                                                │
 *   │  ◀◀ ▶  ━━━━━━━━━━━━━━━━━━  3:22/9:56  🔊 ⛶   │ ← controles nativos
 *   └────────────────────────────────────────────────┘
 *
 * Dos modos según las props:
 *   1. `src`         → `<video src>` HTML5 (MP4/MOV/WebM)
 *   2. `youtubeId`   → iframe de YouTube con `?enablejsapi=1` + seek por
 *                       postMessage (sin necesidad de cargar la IFrame API)
 *
 * Exposición vía `ref` (idéntica para ambos modos):
 *   · `seekTo(seconds)` — salta al timestamp y reproduce
 *   · `pause()`         — pausa
 *   · `getCurrentTime()`— posición actual (HTML5 fiable; YT devuelve el
 *                          último valor reportado vía evento `onStateChange`)
 *
 * Eventos:
 *   · `onTimeUpdate(seconds)` — para resaltar capítulo activo en listas.
 *     En HTML5 viene del evento nativo; en YouTube viene de un poll
 *     ligero (1Hz) mientras se reproduce.
 */

import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useRef,
} from "react";
import { cx } from "@/utils/cx";

export interface VideoPlayerRef {
    seekTo:         ( seconds: number ) => void;
    pause:          () => void;
    getCurrentTime: () => number;
}

export interface VideoPlayerProps {
    /** URL playable HTML5 (MP4/MOV/WebM). Ignorado si `youtubeId` está presente. */
    src?:        string;
    /** Si está presente, se usa iframe de YouTube en lugar de `<video>`. */
    youtubeId?:  string;
    /** Imagen estática previa a la primera reproducción (solo HTML5). */
    poster?:     string;
    /** Idioma del audio (atributo `lang` para accesibilidad). */
    lang?:       string;
    /** Notifica cada actualización de tiempo. Útil para resaltar el
     *  capítulo activo en una lista externa. */
    onTimeUpdate?: ( seconds: number ) => void;
    /** Notifica metadata loaded — solo dispara en modo HTML5. */
    onLoadedMetadata?: ( durationSec: number ) => void;
    /** Clase extra para el wrapper exterior. */
    className?:  string;
    /** Texto alternativo / título del player. */
    title?:      string;
    /**
     * `fillHeight` — modo "ocupa la altura del contenedor manteniendo 16:9".
     * Por defecto el player es `aspect-video w-full` (la anchura manda y
     * la altura se calcula). En `fillHeight=true` invertimos: el wrapper
     * usa `h-full flex items-center justify-center` y el media interno
     * `h-full w-auto aspect-video max-w-full` — la altura manda y la
     * anchura sigue al ratio. Si la anchura calculada excede el contenedor,
     * `max-w-full` activa el clamp inverso (encoge ambos manteniendo el
     * aspecto). Pensado para layouts "no scroll" donde la altura del
     * contenedor es lo que dicta el tamaño.
     */
    fillHeight?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// YouTube IFrame API
//
// Para LEER el currentTime de un YT embed hace falta la IFrame API
// oficial — postMessage sólo sirve para ENVIAR comandos, no para
// recibir el valor de `getCurrentTime` (la respuesta no llega vía
// `message`). Cargamos el script `iframe_api.js` (~30KB) una sola vez,
// y desde ahí instanciamos `new YT.Player()` sobre el iframe, lo que
// expone `.getCurrentTime()` síncrono que sí devuelve segundos reales.
//
// Seek/pause siguen usando postMessage directamente para mantener
// imperativeHandle síncrono incluso antes de que la API esté ready.
// ─────────────────────────────────────────────────────────────────

interface YTPlayer {
    getCurrentTime:  () => number;
    /** -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued */
    getPlayerState?: () => number;
    seekTo:          ( seconds: number, allowSeekAhead?: boolean ) => void;
    playVideo:       () => void;
    pauseVideo:      () => void;
    destroy:         () => void;
}

interface YTPlayerOptions {
    videoId?:    string;
    host?:       string;
    playerVars?: Record<string, number | string>;
    events?:     Record<string, () => void>;
}

interface YTGlobal {
    Player: new (
        elOrId: HTMLIFrameElement | string,
        opts?: YTPlayerOptions,
    ) => YTPlayer;
}

declare global {
    interface Window {
        YT?:                  YTGlobal;
        onYouTubeIframeAPIReady?: () => void;
    }
}

/** Carga la IFrame API de YouTube una sola vez. Devuelve una promesa
 *  que resuelve cuando `window.YT.Player` está disponible. */
let ytApiPromise: Promise<YTGlobal> | null = null;
function loadYouTubeIframeApi(): Promise<YTGlobal> {
    if( typeof window === "undefined" ) return Promise.reject(new Error("SSR"));
    if( window.YT?.Player ) return Promise.resolve( window.YT );
    if( ytApiPromise ) return ytApiPromise;
    ytApiPromise = new Promise<YTGlobal>(( resolve ) => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            prev?.();
            if( window.YT?.Player ) resolve( window.YT );
        };
        const s = document.createElement("script");
        s.src = "https://www.youtube.com/iframe_api";
        s.async = true;
        document.head.appendChild( s );
    });
    return ytApiPromise;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
    function VideoPlayer(
        { src, youtubeId, poster, lang, onTimeUpdate, onLoadedMetadata, className, title, fillHeight = false },
        ref,
    ) {
        const videoRef    = useRef<HTMLVideoElement>( null );
        // Wrapper estable controlado por React. Dentro creamos un
        // placeholder programáticamente que YT.Player reemplaza por su
        // iframe. Mantener el wrapper separado del placeholder evita
        // que re-renders de React maten el iframe (ver useEffect YT).
        const ytMountRef  = useRef<HTMLDivElement>( null );
        const reactId     = useId();
        const ytSlotId    = `yt-player-${reactId.replace(/:/g, "")}`;
        // Cache local del currentTime — el iframe de YT no permite leerlo
        // de forma síncrona desde el padre. Lo mantenemos vía polling de
        // `player.getCurrentTime()` (arranca en `onReady`).
        const ytTimeRef = useRef<number>( 0 );
        const ytPlayerRef = useRef<YTPlayer | null>( null );

        const isYT = !!youtubeId;

        useImperativeHandle( ref, () => ( {
            seekTo: ( seconds: number ) => {
                const safe = Math.max( 0, seconds );
                if( isYT ) {
                    const p = ytPlayerRef.current;
                    if( p?.seekTo ) {
                        p.seekTo( safe, true );
                        p.playVideo?.();
                    }
                    ytTimeRef.current = safe;
                    // Notifica al padre inmediatamente — sin esto el
                    // highlight de la transcripción esperaría al próximo
                    // poll (≤250 ms) tras el seek. Eco síncrono = feedback
                    // visual inmediato al click.
                    onTimeUpdate?.( safe );
                    return;
                }
                const v = videoRef.current;
                if( !v ) return;
                v.currentTime = safe;
                v.play().catch( () => { /* autoplay bloqueado en Safari sin gesto */ } );
            },
            pause: () => {
                if( isYT ) {
                    ytPlayerRef.current?.pauseVideo?.();
                    return;
                }
                videoRef.current?.pause();
            },
            getCurrentTime: () => isYT ? ytTimeRef.current : ( videoRef.current?.currentTime ?? 0 ),
        }) );

        // ── YouTube: IFrame API + poll cada 250ms para timeline ────────
        // Cargamos `iframe_api.js` lazy (solo la primera vez que se monta
        // un VideoPlayer YT). Cuando `YT.Player` está disponible, lo
        // instanciamos sobre el `<div id={ytSlotId}>` placeholder — YT
        // REEMPLAZA el div con su propio iframe (handshake completo,
        // métodos públicos disponibles). `onReady` arranca el poll
        // síncrono de `getCurrentTime()`. 250 ms (4 Hz) da resolución
        // suficiente para que la transcripción "siga" al vídeo sin
        // saltos perceptibles y sin saturar la UI.
        useEffect(() => {
            if( !isYT || !youtubeId ) return;
            const mount = ytMountRef.current;
            if( !mount ) return;
            // Crear placeholder programáticamente dentro del wrapper.
            // No usamos JSX para el placeholder porque React lo
            // reconciliaría en cada render y mataría el iframe que
            // YT crea dentro. Insertamos imperatively + cleanup.
            const placeholder = document.createElement("div");
            placeholder.id = ytSlotId;
            mount.appendChild( placeholder );
            let cancelled = false;
            let pollId: ReturnType<typeof setInterval> | null = null;
            loadYouTubeIframeApi().then(( YT ) => {
                if( cancelled || !document.getElementById( ytSlotId ) ) return;
                const startPolling = () => {
                    if( !onTimeUpdate ) return;
                    pollId = setInterval(() => {
                        try {
                            const p = ytPlayerRef.current;
                            // Solo emitir cuando el player está PLAYING (1)
                            // o BUFFERING (3). En PAUSED (2), CUED (5),
                            // ENDED (0) o UNSTARTED (-1), `getCurrentTime`
                            // devuelve 0 hasta que el video empiece a
                            // reproducir — emitir 0 sobreescribiría el
                            // `currentTimeSec` que un seek manual acaba
                            // de poner. El componente padre vería v1::0
                            // como activo aunque acabe de hacer click en
                            // un timestamp más adelante.
                            const state = p?.getPlayerState?.();
                            if( state !== 1 && state !== 3 ) return;
                            const t = p?.getCurrentTime?.();
                            if( typeof t === "number" && Number.isFinite( t ) && t !== ytTimeRef.current ) {
                                ytTimeRef.current = t;
                                onTimeUpdate( t );
                            }
                        } catch {
                            /* player no listo todavía */
                        }
                    }, 250);
                };
                ytPlayerRef.current = new YT.Player( ytSlotId, {
                    videoId: youtubeId,
                    host: "https://www.youtube-nocookie.com",
                    playerVars: {
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                        enablejsapi: 1,
                    },
                    events: { onReady: startPolling },
                });
            }).catch(() => { /* SSR / network */ });
            return () => {
                cancelled = true;
                if( pollId ) clearInterval( pollId );
                try { ytPlayerRef.current?.destroy?.(); } catch { /* ya destruido */ }
                ytPlayerRef.current = null;
                // Limpiar el iframe que YT inyectó en el wrapper.
                if( mount ) mount.innerHTML = "";
            };
        }, [ isYT, youtubeId, onTimeUpdate, ytSlotId ]);

        const handleTimeUpdate = useCallback( () => {
            if( !onTimeUpdate || !videoRef.current ) return;
            onTimeUpdate( videoRef.current.currentTime );
        }, [ onTimeUpdate ] );

        const handleLoadedMetadata = useCallback( () => {
            if( !onLoadedMetadata || !videoRef.current ) return;
            onLoadedMetadata( videoRef.current.duration );
        }, [ onLoadedMetadata ] );

        if( isYT ) {
            // Mount stable: React controla este wrapper (`ytMountRef`)
            // y NO toca lo que hay adentro. El useEffect inserta un
            // placeholder programáticamente y le pasa el id a
            // `new YT.Player()`, que lo REEMPLAZA por su iframe. Sin
            // este patrón, React re-renderiza el placeholder JSX en
            // cada update y mata el iframe creado por YT (state se
            // congela, clicks dejan de funcionar).
            // `aspect-video w-full` mantiene el ratio 16:9 responsive
            // independientemente de width/height hardcoded del iframe.
            const wrapperInner = (
                <div
                    ref={ytMountRef}
                    title={title ?? "YouTube video"}
                    aria-label={title ?? "YouTube video"}
                    className="block aspect-video w-full bg-black [&>iframe]:h-full [&>iframe]:w-full"
                />
            );
            if( fillHeight ) {
                return (
                    <div className={cx( "flex h-full w-full items-center justify-center", className )}>
                        <div className="aspect-video h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl border border-secondary bg-black">
                            {wrapperInner}
                        </div>
                    </div>
                );
            }
            return (
                <div className={cx( "overflow-hidden rounded-xl border border-secondary bg-black", className )}>
                    {wrapperInner}
                </div>
            );
        }

        if( !src ) {
            if( fillHeight ) {
                return (
                    <div className={cx( "flex h-full w-full items-center justify-center", className )}>
                        <div className="flex aspect-video h-full max-h-full w-auto max-w-full items-center justify-center rounded-xl border border-secondary bg-secondary/30 text-sm text-tertiary">
                            Sin vídeo disponible para este idioma todavía.
                        </div>
                    </div>
                );
            }
            return (
                <div
                    className={cx(
                        "flex aspect-video w-full items-center justify-center",
                        "rounded-xl border border-secondary bg-secondary/30",
                        "text-sm text-tertiary",
                        className,
                    )}
                >
                    Sin vídeo disponible para este idioma todavía.
                </div>
            );
        }

        if( fillHeight ) {
            return (
                <div className={cx( "flex h-full w-full items-center justify-center", className )}>
                    <div className="aspect-video h-full max-h-full w-auto max-w-full overflow-hidden rounded-xl border border-secondary bg-black">
                        <video
                            ref={videoRef}
                            src={src}
                            poster={poster}
                            lang={lang}
                            controls
                            playsInline
                            preload="metadata"
                            title={title}
                            onTimeUpdate={handleTimeUpdate}
                            onLoadedMetadata={handleLoadedMetadata}
                            className="block h-full w-full bg-black"
                        />
                    </div>
                </div>
            );
        }

        return (
            <div
                className={cx(
                    "overflow-hidden rounded-xl border border-secondary bg-black",
                    className,
                )}
            >
                <video
                    ref={videoRef}
                    src={src}
                    poster={poster}
                    lang={lang}
                    controls
                    playsInline
                    preload="metadata"
                    title={title}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                    className="block aspect-video w-full bg-black"
                />
            </div>
        );
    },
);
