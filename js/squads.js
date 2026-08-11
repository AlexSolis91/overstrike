// ══════════════════════════════════════════════════════════════════════
// MODO SQUADS (2v2) — FASE 1: Salas, unión de jugadores y sorteo de equipos
// ══════════════════════════════════════════════════════════════════════
//
// Cualquier jugador puede crear una sala. Otras salas ya creadas se listan
// mostrando cuántos jugadores ya se unieron (X/4) para que se pueda elegir
// a cuál entrar. Al llegar a 4 jugadores, se sortea aleatoriamente la
// conformación de HAUNTERS vs REAPERS (2 y 2) y arranca el reloj del
// evento (eventStartAt), que ancla TODAS las fases siguientes por tiempo
// absoluto — igual que el evento de probabilidad aumentada: no depende de
// que nadie esté conectado en el momento exacto, cualquier cliente que
// entre calcula en qué fase está comparando la hora actual contra los
// timestamps guardados.
//
// ── ESQUEMA DE FIREBASE (Realtime DB) ──────────────────────────────────
// squads_rooms/{roomId} = {
//     id: roomId,
//     createdBy: uid, createdByName: string, createdAt: ms,
//     status: 'waiting' | 'teams_assigned' | 'building' | 'attacking_day2'
//           | 'attacking_day3' | 'finished',
//     players: { uid: { name, joinedAt } },              // máx 4
//     teams: { haunters: [uid, uid], reapers: [uid, uid] }, // se llena al llegar a 4
//     eventStartAt: ms,   // ancla de tiempo: +24h = fin construcción,
//                         // +48h = fin ataques día 2, +72h = fin evento
//     defenses:     { uid: { def1: {chars:[...], order:0}, def2:{...}, def3:{...} } },
//     defenseOrder: { haunters: [defKey,...], reapers: [defKey,...] }, // orden de exhibición
//     revealed:     { defKey: true },                    // defensas ya reveladas
//     deadChars:    { uid: { charName: true } },          // bloqueados permanentemente para ese jugador
//     soulFragments:  { haunters: 0, reapers: 0 },
//     fragmentsClaimed: { defKey: { charName: true } },   // 1 sola vez por personaje de defensa
//     attacksUsed:  { uid: { day2: 0, day3: 0 } },
//     winner: null | 'haunters' | 'reapers' | 'tie',
//     rewardsClaimed: { uid: true },
//     bossEvent: { active:false, bossId, hp, maxHp, expiresAt, activatedBy, defeated:false }
// }
// ══════════════════════════════════════════════════════════════════════
(function () {

    var _squadsRoomsListener = null;
    var _squadsRoomListener = null;
    var _squadsCurrentRoomId = null;

    function _pad(n) { return n < 10 ? '0' + n : '' + n; }
    function _fmtTimeLeft(ms) {
        if (ms <= 0) return '00:00:00';
        var totalSec = Math.floor(ms / 1000);
        var h = Math.floor(totalSec / 3600);
        var m = Math.floor((totalSec % 3600) / 60);
        var s = totalSec % 60;
        return _pad(h) + ':' + _pad(m) + ':' + _pad(s);
    }

    // ── Fase actual del evento, calculada por tiempo absoluto ──
    // Devuelve: 'building' (0-24h), 'attacking_day2' (24-48h),
    //           'attacking_day3' (48-72h), 'finished' (72h+)
    function _squadsPhaseFor(eventStartAt) {
        if (!eventStartAt) return null;
        var elapsed = Date.now() - eventStartAt;
        var H = 3600000;
        if (elapsed < 24 * H) return 'building';
        if (elapsed < 48 * H) return 'attacking_day2';
        if (elapsed < 72 * H) return 'attacking_day3';
        return 'finished';
    }
    window._squadsPhaseFor = _squadsPhaseFor;

    // ── Ventana raíz del modo SQUADS: lista de salas ──
    window.showSquadsLobby = function () {
        if (!currentUser) { alert('Debes iniciar sesión.'); return; }
        var existing = document.getElementById('squadsLobbyModal');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'squadsLobbyModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML =
            '<div style="background:linear-gradient(135deg,#0a0e17,#1a0033);border:2px solid #c864ff;border-radius:20px;padding:24px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 0 40px rgba(200,100,255,0.25);">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                    '<div style="font-family:Orbitron,sans-serif;color:#c864ff;font-size:1.1rem;font-weight:900;">👥⚔️ SQUADS — 2v2</div>' +
                    '<button id="squadsLobbyCloseBtn" style="background:none;border:1px solid #ff3366;color:#ff3366;border-radius:8px;padding:4px 10px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.7rem;">✕ CERRAR</button>' +
                '</div>' +
                '<div style="font-size:.68rem;color:#888;margin-bottom:14px;">Únete a una sala existente o crea una nueva. Cuando 4 jugadores estén dentro, los equipos HAUNTERS y REAPERS se sortean al azar.</div>' +
                '<button id="squadsCreateRoomBtn" style="width:100%;padding:12px;margin-bottom:16px;background:linear-gradient(135deg,#3a0066,#6a00b8);border:2px solid #c864ff;color:#fff;border-radius:12px;font-family:Orbitron,sans-serif;font-weight:900;font-size:.85rem;cursor:pointer;letter-spacing:.04em;">➕ CREAR NUEVA SALA</button>' +
                '<div id="squadsRoomList"></div>' +
            '</div>';
        document.body.appendChild(overlay);
        overlay.querySelector('#squadsLobbyCloseBtn').onclick = function () { _squadsStopRoomsListener(); overlay.remove(); };
        overlay.onclick = function (e) { if (e.target === overlay) { _squadsStopRoomsListener(); overlay.remove(); } };
        overlay.querySelector('#squadsCreateRoomBtn').onclick = window.squadsCreateRoom;

        _squadsStopRoomsListener();
        _squadsRoomsListener = db.ref('squads_rooms').orderByChild('status');
        _squadsRoomsListener.on('value', function (snap) {
            _squadsRenderRoomList(snap.val() || {});
        });
    };

    function _squadsStopRoomsListener() {
        if (_squadsRoomsListener) { _squadsRoomsListener.off('value'); _squadsRoomsListener = null; }
    }

    function _squadsRenderRoomList(rooms) {
        var list = document.getElementById('squadsRoomList');
        if (!list) return;
        var ids = Object.keys(rooms).filter(function (id) { return rooms[id] && rooms[id].status !== 'finished'; });
        // Salas más nuevas primero
        ids.sort(function (a, b) { return (rooms[b].createdAt || 0) - (rooms[a].createdAt || 0); });
        if (!ids.length) {
            list.innerHTML = '<div style="text-align:center;color:#666;font-size:.75rem;padding:20px;">No hay salas activas ahora mismo. ¡Crea una!</div>';
            return;
        }
        var html = '';
        ids.forEach(function (id) {
            var r = rooms[id];
            var count = Object.keys(r.players || {}).length;
            var full = count >= 4;
            var statusLabel = r.status === 'waiting' ? 'Esperando jugadores' :
                r.status === 'teams_assigned' || r.status === 'building' ? '🛡️ Construyendo defensas' :
                r.status === 'attacking_day2' ? '⚔️ Día 2 — Ataques' :
                r.status === 'attacking_day3' ? '⚔️ Día 3 — Ataques' : r.status;
            var alreadyIn = currentUser && r.players && r.players[currentUser.uid];
            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + (full ? 'rgba(255,255,255,0.08)' : 'rgba(200,100,255,0.3)') + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;">' +
                '<div>' +
                    '<div style="font-size:.78rem;color:#fff;font-weight:700;">Sala de ' + (r.createdByName || 'Jugador') + '</div>' +
                    '<div style="font-size:.65rem;color:#aaa;">' + statusLabel + ' · ' + count + '/4 jugadores</div>' +
                '</div>' +
                (alreadyIn
                    ? '<button onclick="window.squadsShowRoomDetail(\'' + id + '\')" style="padding:8px 14px;background:linear-gradient(135deg,#003a1a,#00aa55);border:2px solid #00ff88;color:#00ff88;border-radius:8px;font-family:Orbitron,sans-serif;font-size:.65rem;font-weight:700;cursor:pointer;white-space:nowrap;">ENTRAR</button>'
                    : full
                        ? '<button disabled style="padding:8px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#666;border-radius:8px;font-family:Orbitron,sans-serif;font-size:.65rem;font-weight:700;white-space:nowrap;">LLENA</button>'
                        : '<button onclick="window.squadsJoinRoom(\'' + id + '\')" style="padding:8px 14px;background:linear-gradient(135deg,#3a0066,#6a00b8);border:2px solid #c864ff;color:#fff;border-radius:8px;font-family:Orbitron,sans-serif;font-size:.65rem;font-weight:700;cursor:pointer;white-space:nowrap;">UNIRSE</button>') +
                '</div>';
        });
        list.innerHTML = html;
    }

    // ── Crear sala ──
    window.squadsCreateRoom = async function () {
        if (!currentUser) return;
        var name = currentUser.displayName || 'Jugador';
        var ref = db.ref('squads_rooms').push();
        var roomId = ref.key;
        await ref.set({
            id: roomId,
            createdBy: currentUser.uid,
            createdByName: name,
            createdAt: Date.now(),
            status: 'waiting',
            players: {}
        });
        await ref.child('players/' + currentUser.uid).set({ name: name, joinedAt: Date.now() });
        window.squadsShowRoomDetail(roomId);
    };

    // ── Unirse a una sala (transacción para evitar exceder 4 jugadores por carrera) ──
    window.squadsJoinRoom = async function (roomId) {
        if (!currentUser) return;
        var name = currentUser.displayName || 'Jugador';
        var playersRef = db.ref('squads_rooms/' + roomId + '/players');
        var result = await playersRef.transaction(function (players) {
            players = players || {};
            if (players[currentUser.uid]) return players; // ya está dentro
            if (Object.keys(players).length >= 4) return; // llena — abortar
            players[currentUser.uid] = { name: name, joinedAt: Date.now() };
            return players;
        });
        if (!result.committed) {
            alert('Esta sala ya está llena.');
            return;
        }
        var players = result.snapshot.val() || {};
        if (Object.keys(players).length === 4) {
            await _squadsAssignTeams(roomId, players);
        }
        window.squadsShowRoomDetail(roomId);
    };

    // ── Sorteo de equipos al llegar a 4 jugadores (transacción — solo un cliente lo ejecuta) ──
    async function _squadsAssignTeams(roomId, players) {
        var roomRef = db.ref('squads_rooms/' + roomId);
        await roomRef.transaction(function (room) {
            if (!room || room.teams) return room; // ya se asignó (evita doble sorteo por carrera)
            var uids = Object.keys(room.players || players);
            if (uids.length !== 4) return room;
            // Fisher-Yates shuffle
            for (var i = uids.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var t = uids[i]; uids[i] = uids[j]; uids[j] = t;
            }
            room.teams = { haunters: [uids[0], uids[1]], reapers: [uids[2], uids[3]] };
            room.status = 'teams_assigned';
            room.eventStartAt = Date.now();
            room.soulFragments = { haunters: 0, reapers: 0 };
            return room;
        });
    }

    // ── Vista de detalle de una sala (sala de espera / equipos asignados) ──
    window.squadsShowRoomDetail = function (roomId) {
        _squadsCurrentRoomId = roomId;
        var existing = document.getElementById('squadsRoomModal');
        if (existing) existing.remove();
        var lobbyModal = document.getElementById('squadsLobbyModal');
        if (lobbyModal) { _squadsStopRoomsListener(); lobbyModal.remove(); }

        var overlay = document.createElement('div');
        overlay.id = 'squadsRoomModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.innerHTML = '<div id="squadsRoomContent" style="background:linear-gradient(135deg,#0a0e17,#1a0033);border:2px solid #c864ff;border-radius:20px;padding:24px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;box-shadow:0 0 40px rgba(200,100,255,0.25);"></div>';
        document.body.appendChild(overlay);
        overlay.onclick = function (e) { if (e.target === overlay) window.squadsCloseRoom(); };

        _squadsStopRoomListener();
        _squadsRoomListener = db.ref('squads_rooms/' + roomId);
        _squadsRoomListener.on('value', function (snap) {
            var room = snap.val();
            if (!room) { window.squadsCloseRoom(); return; }
            _squadsRenderRoomDetail(room);
        });
    };

    function _squadsStopRoomListener() {
        if (_squadsRoomListener) { _squadsRoomListener.off('value'); _squadsRoomListener = null; }
    }

    window.squadsCloseRoom = function () {
        _squadsStopRoomListener();
        var m = document.getElementById('squadsRoomModal');
        if (m) m.remove();
        _squadsCurrentRoomId = null;
    };

    function _squadsRenderRoomDetail(room) {
        var content = document.getElementById('squadsRoomContent');
        if (!content) return;
        var myUid = currentUser ? currentUser.uid : null;
        var count = Object.keys(room.players || {}).length;

        var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<div style="font-family:Orbitron,sans-serif;color:#c864ff;font-size:1rem;font-weight:900;">👥⚔️ Sala de ' + (room.createdByName || 'Jugador') + '</div>' +
            '<button onclick="window.squadsCloseRoom()" style="background:none;border:1px solid #ff3366;color:#ff3366;border-radius:8px;padding:4px 10px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.7rem;">✕ CERRAR</button>' +
            '</div>';

        if (!room.teams) {
            // ── Sala de espera ──
            html += '<div style="text-align:center;padding:20px 0;">' +
                '<div style="font-family:Orbitron,sans-serif;color:#fff;font-size:1.4rem;font-weight:900;">' + count + ' / 4</div>' +
                '<div style="font-size:.7rem;color:#888;margin-top:4px;">Esperando jugadores...</div>' +
                '</div>';
            html += '<div style="display:flex;flex-direction:column;gap:8px;">';
            var uids = Object.keys(room.players || {});
            for (var i = 0; i < 4; i++) {
                if (uids[i]) {
                    var p = room.players[uids[i]];
                    html += '<div style="background:rgba(0,255,136,0.06);border:1px solid rgba(0,255,136,0.3);border-radius:10px;padding:10px 14px;font-size:.78rem;color:#fff;">✅ ' + p.name + (uids[i] === myUid ? ' (tú)' : '') + '</div>';
                } else {
                    html += '<div style="background:rgba(255,255,255,0.02);border:1px dashed rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;font-size:.78rem;color:#555;">Esperando jugador...</div>';
                }
            }
            html += '</div>';
        } else {
            // ── Equipos ya sorteados ──
            var haunters = room.teams.haunters.map(function (uid) { return (room.players[uid] || {}).name || uid; });
            var reapers = room.teams.reapers.map(function (uid) { return (room.players[uid] || {}).name || uid; });
            var myTeam = room.teams.haunters.indexOf(myUid) !== -1 ? 'haunters' : (room.teams.reapers.indexOf(myUid) !== -1 ? 'reapers' : null);
            var phase = window._squadsPhaseFor(room.eventStartAt);

            html += '<div style="text-align:center;margin-bottom:16px;">' +
                '<div style="font-size:.68rem;color:#ffd700;font-weight:700;">⚔️ EQUIPOS SORTEADOS</div>' +
                (myTeam ? '<div style="font-size:.66rem;color:#aaa;margin-top:2px;">Tu equipo: <b style="color:' + (myTeam === 'haunters' ? '#4fc3f7' : '#ff4444') + ';">' + myTeam.toUpperCase() + '</b></div>' : '') +
                '</div>';
            html += '<div style="display:flex;gap:12px;margin-bottom:16px;">' +
                '<div style="flex:1;background:rgba(79,195,247,0.06);border:2px solid #4fc3f7;border-radius:12px;padding:12px;">' +
                    '<div style="font-family:Orbitron,sans-serif;color:#4fc3f7;font-size:.75rem;font-weight:900;margin-bottom:8px;">🔷 HAUNTERS</div>' +
                    haunters.map(function (n) { return '<div style="font-size:.72rem;color:#fff;padding:4px 0;">👤 ' + n + '</div>'; }).join('') +
                '</div>' +
                '<div style="flex:1;background:rgba(255,68,68,0.06);border:2px solid #ff4444;border-radius:12px;padding:12px;">' +
                    '<div style="font-family:Orbitron,sans-serif;color:#ff4444;font-size:.75rem;font-weight:900;margin-bottom:8px;">🔴 REAPERS</div>' +
                    reapers.map(function (n) { return '<div style="font-size:.72rem;color:#fff;padding:4px 0;">👤 ' + n + '</div>'; }).join('') +
                '</div>' +
                '</div>';

            var H = 3600000;
            var buildEnd = room.eventStartAt + 24 * H;
            var day2End = room.eventStartAt + 48 * H;
            var day3End = room.eventStartAt + 72 * H;
            var now = Date.now();
            var phaseLabel, phaseTimeLeft, phaseColor;
            if (phase === 'building') { phaseLabel = '🛡️ Construyendo defensas'; phaseTimeLeft = buildEnd - now; phaseColor = '#00ff88'; }
            else if (phase === 'attacking_day2') { phaseLabel = '⚔️ Día 2 — Ataques (6 por jugador)'; phaseTimeLeft = day2End - now; phaseColor = '#ffaa00'; }
            else if (phase === 'attacking_day3') { phaseLabel = '⚔️ Día 3 — Ataques (6 por jugador)'; phaseTimeLeft = day3End - now; phaseColor = '#ff6644'; }
            else { phaseLabel = '🏁 Evento finalizado'; phaseTimeLeft = 0; phaseColor = '#888'; }

            html += '<div style="text-align:center;background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;margin-bottom:14px;">' +
                '<div style="font-family:Orbitron,sans-serif;color:' + phaseColor + ';font-size:.8rem;font-weight:900;">' + phaseLabel + '</div>' +
                (phase !== 'finished' ? '<div style="font-family:Orbitron,sans-serif;color:#fff;font-size:1.1rem;margin-top:4px;">' + _fmtTimeLeft(phaseTimeLeft) + '</div>' : '') +
                '</div>';

            html += '<div style="text-align:center;background:rgba(200,100,255,0.06);border:1px solid rgba(200,100,255,0.3);border-radius:12px;padding:12px;margin-bottom:8px;">' +
                '<div style="font-size:.68rem;color:#aaa;">💠 Fragmentos de Alma</div>' +
                '<div style="font-size:.8rem;color:#fff;margin-top:4px;"><b style="color:#4fc3f7;">HAUNTERS: ' + (room.soulFragments ? room.soulFragments.haunters : 0) + '</b>' +
                '&nbsp;&nbsp;vs&nbsp;&nbsp;<b style="color:#ff4444;">REAPERS: ' + (room.soulFragments ? room.soulFragments.reapers : 0) + '</b></div>' +
                '</div>';

            html += '<div style="text-align:center;font-size:.64rem;color:#666;margin-top:10px;">Las siguientes fases (construcción de defensas, ataques y recompensas) están en construcción — pronto disponibles aquí mismo.</div>';
        }

        content.innerHTML = html;
    }

})();
