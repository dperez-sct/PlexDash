import { useState } from 'react';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    ClipboardIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';

interface AccordionProps {
    title: string;
    icon: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function Accordion({ title, icon, children, defaultOpen = false }: AccordionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-plex-dark rounded-lg border border-gray-800 overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <span className="text-2xl">{icon}</span>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                </div>
                {open ? (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
            </button>
            {open && (
                <div className="px-5 pb-5 border-t border-gray-800">
                    {children}
                </div>
            )}
        </div>
    );
}

function CodeBlock({ code, language = 'python' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group mt-3 mb-3">
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-gray-700/80 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                title="Copiar"
            >
                {copied ? (
                    <CheckIcon className="h-4 w-4 text-green-400" />
                ) : (
                    <ClipboardIcon className="h-4 w-4" />
                )}
            </button>
            <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto text-sm">
                <code className={`language-${language} text-gray-300`}>
                    {code}
                </code>
            </pre>
        </div>
    );
}

const KILL_STREAM_PYTHON = `#!/usr/bin/env python3
"""
PlexDash Kill Stream Script for Tautulli
Guarda como: plexdash_check.py
Requiere: requests (ya incluido en lscr.io/linuxserver/tautulli)
"""
import requests
import sys
import os

# ======= CONFIG =======
PLEXDASH_URL = "http://TU_IP:8000"  # URL de tu PlexDash
TAUTULLI_URL = os.environ.get("TAUTULLI_URL", "http://localhost:8181")
TAUTULLI_API_KEY = os.environ.get("TAUTULLI_APIKEY", "TU_API_KEY_AQUI")
# =======================

def main():
    if len(sys.argv) < 3:
        print("Usage: plexdash_check.py <plex_user_id> <session_id>")
        sys.exit(1)

    plex_id = sys.argv[1]
    session_id = sys.argv[2]

    try:
        resp = requests.get(
            f"{PLEXDASH_URL}/api/tautulli/check/{plex_id}",
            timeout=10
        )
        data = resp.json()
    except Exception as e:
        print(f"Error connecting to PlexDash: {e}")
        sys.exit(1)

    if data.get("action") == "kill":
        message = data.get("message", "Contacta con el administrador.")
        try:
            requests.get(f"{TAUTULLI_URL}/api/v2", params={
                "apikey": TAUTULLI_API_KEY,
                "cmd": "terminate_session",
                "session_id": session_id,
                "message": message
            }, timeout=10)
            print(f"[KILL] Stream cortado para {plex_id}: {message}")
        except Exception as e:
            print(f"Error killing stream: {e}")
    else:
        reason = data.get("reason", "unknown")
        print(f"[ALLOW] Stream permitido para {plex_id} (reason: {reason})")

if __name__ == "__main__":
    main()`;

const KILL_STREAM_BASH = `#!/bin/bash
# PlexDash Kill Stream Script for Tautulli (Bash version)
# Guarda como: plexdash_check.sh
# Sin dependencias extra — solo usa curl (incluido en cualquier imagen Docker)

# ======= CONFIG =======
PLEXDASH_URL="http://TU_IP:8000"  # URL de tu PlexDash
TAUTULLI_URL="http://localhost:8181"
TAUTULLI_API_KEY="TU_API_KEY_AQUI"
# =======================

PLEX_ID="$1"
SESSION_ID="$2"

if [ -z "$PLEX_ID" ] || [ -z "$SESSION_ID" ]; then
    echo "Usage: plexdash_check.sh <plex_user_id> <session_id>"
    exit 1
fi

# Check with PlexDash
RESPONSE=$(curl -s --max-time 10 "$PLEXDASH_URL/api/tautulli/check/$PLEX_ID")

# Parse fields from JSON (handles both "key":"val" and "key": "val")
ACTION=$(echo "$RESPONSE" | grep -o '"action" *: *"[^"]*"' | head -1 | sed 's/"action" *: *"\\(.*\\)"/\\1/')
MESSAGE=$(echo "$RESPONSE" | grep -o '"message" *: *"[^"]*"' | head -1 | sed 's/"message" *: *"\\(.*\\)"/\\1/')
REASON=$(echo "$RESPONSE" | grep -o '"reason" *: *"[^"]*"' | head -1 | sed 's/"reason" *: *"\\(.*\\)"/\\1/')

if [ "$ACTION" = "kill" ]; then
    # URL-encode the message for the API call
    ENCODED_MSG=$(printf '%s' "$MESSAGE" | sed 's/ /%20/g; s/!/%21/g; s/"/%22/g')
    curl -s --max-time 10 "$TAUTULLI_URL/api/v2?apikey=$TAUTULLI_API_KEY&cmd=terminate_session&session_id=$SESSION_ID&message=$ENCODED_MSG" > /dev/null
    echo "[KILL] Stream cortado para $PLEX_ID: $MESSAGE"
else
    echo "[ALLOW] Stream permitido para $PLEX_ID (reason: $REASON)"
fi`;

function ScriptTabs({ pythonCode, bashCode }: { pythonCode: string; bashCode: string }) {
    const [tab, setTab] = useState<'python' | 'bash'>('bash');
    return (
        <div className="mt-3">
            <div className="flex space-x-1 bg-gray-900 rounded-t-lg border border-gray-700 border-b-0 p-1">
                <button
                    onClick={() => setTab('bash')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tab === 'bash'
                        ? 'bg-plex-yellow/20 text-plex-yellow'
                        : 'text-gray-400 hover:text-gray-200'
                        }`}
                >
                    🐧 Bash (recomendado)
                </button>
                <button
                    onClick={() => setTab('python')}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${tab === 'python'
                        ? 'bg-plex-yellow/20 text-plex-yellow'
                        : 'text-gray-400 hover:text-gray-200'
                        }`}
                >
                    🐍 Python
                </button>
            </div>
            <div className="[&>div]:mt-0 [&>div>pre]:rounded-t-none [&>div>pre]:border-t-0">
                <CodeBlock
                    code={tab === 'bash' ? bashCode : pythonCode}
                    language={tab === 'bash' ? 'bash' : 'python'}
                />
            </div>
            <p className="text-gray-500 text-xs mt-1">
                {tab === 'bash'
                    ? '✅ Sin dependencias — solo usa curl. Funciona en cualquier imagen Docker.'
                    : '✅ Usa requests, ya incluido en lscr.io/linuxserver/tautulli.'}
            </p>
        </div>
    );
}


export default function Help() {
    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">📖 Ayuda</h1>
                <p className="text-gray-400 mt-1">Guías de configuración y documentación de PlexDash</p>
            </div>

            {/* Quick overview */}
            <div className="bg-gradient-to-r from-plex-yellow/10 to-transparent rounded-lg p-5 border border-plex-yellow/20">
                <h2 className="text-lg font-semibold text-plex-yellow mb-2">¿Qué es PlexDash?</h2>
                <p className="text-gray-300 text-sm leading-relaxed">
                    PlexDash es un panel de administración para gestionar usuarios de Plex, sus suscripciones, pagos mensuales y gastos.
                    Se integra con <strong className="text-white">Tautulli</strong> para obtener estadísticas de reproducción y,
                    opcionalmente, cortar streams de usuarios con pagos pendientes.
                </p>
            </div>

            {/* Accordion sections */}
            <div className="space-y-3">

                {/* Kill Stream Setup */}
                <Accordion title="Configurar Kill Stream (Tautulli)" icon="⚡" defaultOpen={true}>
                    <div className="space-y-4 mt-4">
                        <p className="text-gray-300 text-sm">
                            El <strong className="text-white">Kill Stream</strong> permite cortar automáticamente la primera reproducción del día
                            a usuarios con pagos pendientes, mostrándoles un mensaje de aviso. Las reproducciones siguientes ese mismo día se permiten
                            (modo <em>warn-once</em>).
                        </p>

                        {/* Step 1 */}
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-plex-yellow/20 text-plex-yellow rounded-full flex items-center justify-center font-bold text-sm">1</div>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">Configurar Tautulli en PlexDash</h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    Ve a <strong className="text-gray-300">Ajustes → Tautulli</strong> e introduce la URL y API Key de tu instancia de Tautulli.
                                    Usa el botón "Test" para verificar la conexión.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-plex-yellow/20 text-plex-yellow rounded-full flex items-center justify-center font-bold text-sm">2</div>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">Activar el toggle por usuario</h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    En la página de detalle de cada usuario, activa el switch <strong className="text-gray-300">⚠️ Aviso de pago</strong> en
                                    el panel de Acciones Rápidas. Solo los usuarios con este toggle activado pueden tener su stream cortado.
                                    Los usuarios de prueba o que no quieras controlar, déjalos desactivados.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-plex-yellow/20 text-plex-yellow rounded-full flex items-center justify-center font-bold text-sm">3</div>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">Crear el script en el servidor</h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    Crea el archivo en la carpeta de scripts de Tautulli (normalmente <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs">/config/scripts/</code>).
                                    Edita las variables <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs">PLEXDASH_URL</code> y <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 text-xs">TAUTULLI_API_KEY</code>.
                                    Puedes elegir entre Bash (sin dependencias) o Python:
                                </p>
                                <ScriptTabs pythonCode={KILL_STREAM_PYTHON} bashCode={KILL_STREAM_BASH} />
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-plex-yellow/20 text-plex-yellow rounded-full flex items-center justify-center font-bold text-sm">4</div>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">Crear Notification Agent en Tautulli</h4>
                                <div className="text-gray-400 text-sm mt-1 space-y-2">
                                    <p>En Tautulli, ve a <strong className="text-gray-300">Settings → Notification Agents → Add a new notification agent → Script</strong>.</p>
                                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 space-y-3">
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wider">Configuration</span>
                                            <ul className="mt-1 space-y-1 text-sm">
                                                <li>• <strong className="text-gray-300">Script Folder:</strong> la carpeta donde guardaste el script</li>
                                                <li>• <strong className="text-gray-300">Script File:</strong> <code className="bg-gray-800 px-1 py-0.5 rounded text-plex-yellow text-xs">plexdash_check.sh</code> o <code className="bg-gray-800 px-1 py-0.5 rounded text-plex-yellow text-xs">.py</code></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wider">Triggers</span>
                                            <ul className="mt-1 space-y-1 text-sm">
                                                <li>• ✅ Marca solo <strong className="text-gray-300">Playback Start</strong></li>
                                            </ul>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wider">Arguments → Playback Start</span>
                                            <ul className="mt-1 space-y-1 text-sm">
                                                <li>• Escribe: <code className="bg-gray-800 px-1.5 py-0.5 rounded text-plex-yellow text-xs">{'{user_id} {session_id}'}</code></li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Step 5 */}
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center font-bold text-sm">✓</div>
                            <div className="flex-1">
                                <h4 className="text-white font-medium">¡Listo!</h4>
                                <p className="text-gray-400 text-sm mt-1">
                                    Cuando un usuario con el toggle activado y meses sin pagar empiece a reproducir,
                                    Tautulli ejecutará el script, consultará PlexDash, y si tiene deuda cortará la sesión con
                                    el mensaje configurado. La segunda reproducción del día se permitirá (warn-once).
                                </p>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="bg-plex-darker border border-gray-700 rounded-lg p-4 mt-2">
                            <p className="text-gray-300 text-sm font-medium mb-2">Opciones en Ajustes → Tautulli</p>
                            <ul className="text-gray-400 text-sm space-y-2">
                                <li>• <strong className="text-gray-300">Modo de aviso</strong> — Siempre cortar / Una vez al día / Desactivado</li>
                                <li>• <strong className="text-gray-300">Período de deuda</strong> — qué meses se cuentan como impagados (año actual, últimos N meses, desde alta, todo el historial)</li>
                                <li>• <strong className="text-gray-300">Ignorar el mes en curso</strong> — el mes actual no cuenta como deuda aunque no esté pagado. Útil si tus usuarios pagan a mediados de mes.</li>
                                <li>• <strong className="text-gray-300">Mensaje personalizado</strong> — variables disponibles: <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-plex-yellow">{'{username}'}</code> y <code className="bg-gray-800 px-1 py-0.5 rounded text-xs text-plex-yellow">{'{months}'}</code></li>
                            </ul>
                        </div>

                        {/* Warning */}
                        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-4 mt-2">
                            <p className="text-yellow-400 text-sm font-medium">⚠️ Importante</p>
                            <ul className="text-gray-400 text-sm mt-1 space-y-1">
                                <li>• PlexDash necesita ser <strong className="text-gray-300">accesible desde Tautulli</strong> por red (misma LAN o VPN)</li>
                                <li>• El endpoint <code className="bg-gray-800 px-1 py-0.5 rounded text-xs">/api/tautulli/check/</code> es público (no requiere auth)</li>
                                <li>• El script bash usa <strong className="text-gray-300">solo curl</strong> — sin dependencias extra</li>
                                <li>• El script python usa <code className="bg-gray-800 px-1 py-0.5 rounded text-xs">requests</code> (ya incluido en <code className="bg-gray-800 px-1 py-0.5 rounded text-xs">lscr.io/linuxserver/tautulli</code>)</li>
                            </ul>
                        </div>
                    </div>
                </Accordion>

                {/* Tautulli Activity Stats */}
                <Accordion title="Estadísticas de Actividad (Tautulli)" icon="📊">
                    <div className="space-y-3 mt-4">
                        <p className="text-gray-300 text-sm">
                            Una vez configurado Tautulli, la página de detalle de cada usuario mostrará automáticamente:
                        </p>
                        <ul className="text-gray-400 text-sm space-y-2">
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Reproducciones</strong> — conteo de plays del último mes en las tarjetas de stats</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Widget de Actividad</strong> — plays y tiempo visto por período (hoy, 7 días, 30 días, total)</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Últimas reproducciones</strong> — las 5 últimas cosas vistas con progreso</span>
                            </li>
                        </ul>
                        <p className="text-gray-500 text-xs mt-2">
                            No necesitas configuración adicional — solo tener Tautulli conectado en Ajustes.
                        </p>
                    </div>
                </Accordion>

                {/* Payments */}
                <Accordion title="Gestión de Pagos" icon="💳">
                    <div className="space-y-3 mt-4">
                        <p className="text-gray-300 text-sm">PlexDash gestiona pagos mensuales por usuario:</p>
                        <ul className="text-gray-400 text-sm space-y-2">
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Cuota mensual</strong> — configurable en Ajustes → Precio mensual</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Pago Rápido</strong> — botón en detalle de usuario para registrar el pago del mes actual</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Tabla Anual</strong> — vista mensual con toggle de pagado/no pagado por cada mes</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Auditoría</strong> — todos los cambios quedan registrados en Actividad</span>
                            </li>
                        </ul>
                    </div>
                </Accordion>

                {/* Backups */}
                <Accordion title="Copias de Seguridad" icon="💾">
                    <div className="space-y-3 mt-4">
                        <p className="text-gray-300 text-sm">
                            En <strong className="text-white">Ajustes → Bakup</strong> puedes:
                        </p>
                        <ul className="text-gray-400 text-sm space-y-2">
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Exportar</strong> — Descarga un archivo JSON con todos los datos (usuarios, pagos, gastos, ajustes)</span>
                            </li>
                            <li className="flex items-start space-x-2">
                                <span className="text-plex-yellow mt-0.5">▸</span>
                                <span><strong className="text-gray-300">Importar</strong> — Restaura un backup previo sobreescribiendo los datos actuales</span>
                            </li>
                        </ul>
                        <p className="text-yellow-400/80 text-xs mt-2">
                            ⚠️ Importar un backup sobreescribe todos los datos. Haz un export antes si no estás seguro.
                        </p>
                    </div>
                </Accordion>

            </div>

            {/* Footer */}
            <div className="text-center text-gray-600 text-xs py-4">
                PlexDash — Panel de gestión para Plex
            </div>
        </div>
    );
}
