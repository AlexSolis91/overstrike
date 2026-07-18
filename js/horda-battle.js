// ══════════════════════════════════════════════════════════════════════════
// MODO HORDA — Orquestador de partida
// Maneja: entrada al modo (nueva corrida / continuar), inyección de los
// enemigos generados en el motor de batalla existente, la elección entre
// curar y cofre misterioso al pasar de oleada, guardar progreso, y la
// pantalla final de recompensas al ser derrotado.
// ══════════════════════════════════════════════════════════════════════════

(function () {

    // ── Tabla de recompensas del cofre misterioso ──
    // (Runa de Portal ya NO es posible aquí — se movió a un bono del 5% al ganar Ranked)
    var CHEST_TABLE = [
        { type: 'gold',              weight: 40 },
        { type: 'relic_Raro',        weight: 30 },
        { type: 'relic_Especial',    weight: 10 },
        { type: 'arcane_key',        weight: 10 },
        { type: 'relic_Epico',       weight: 5 },
        { type: 'relic_Legendario',  weight: 0.05 }
    ];

    function pickChestReward() {
        var total = CHEST_TABLE.reduce(function (s, e) { return s + e.weight; }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < CHEST_TABLE.length; i++) {
            r -= CHEST_TABLE[i].weight;
            if (r <= 0) return CHEST_TABLE[i].type;
        }
        return 'gold';
    }

    function randomRelicOfTier(tier) {
        if (typeof RELICS_DATA === 'undefined') return null;
        var pool = Object.keys(RELICS_DATA).filter(function (n) { return RELICS_DATA[n].tier === tier; });
        return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }

    function currentUid() {
        var u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : (typeof currentUser !== 'undefined' ? currentUser : null);
        return u ? u.uid : null;
    }
    function currentDisplayName() {
        var u = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : (typeof currentUser !== 'undefined' ? currentUser : null);
        return (u && u.displayName) || 'Jugador';
    }

    // ══════════════════════════════════════════════════════════════════════
    // FONDO DE VIDEO EXCLUSIVO DEL MODO HORDA
    // ══════════════════════════════════════════════════════════════════════
    window.hordaShowVideoBackground = function () {
        var v = document.getElementById('hordaBattleVideo');
        if (!v) return;
        v.style.display = 'block';
        var gc = document.querySelector('.game-container');
        if (gc) gc.style.background = 'transparent';
        try { v.currentTime = 0; v.play().catch(function () {}); } catch (e) {}
    };
    window.hordaHideVideoBackground = function () {
        var v = document.getElementById('hordaBattleVideo');
        if (!v) return;
        v.style.display = 'none';
        try { v.pause(); } catch (e) {}
    };

    // ══════════════════════════════════════════════════════════════════════
    // ENTRADA AL MODO — desde el botón "🌊 MODO HORDA" del modal de Modo de Juego
    // ══════════════════════════════════════════════════════════════════════
    window.hordaEnterMode = async function () {
        var uid = currentUid();
        if (!uid) { alert('Debes iniciar sesión.'); return; }
        var runSnap = await db.ref('horda_runs/' + uid).once('value');
        var run = runSnap.val();

        if (run && run.active) {
            var cont = confirm('Tienes una corrida de Modo Horda en curso (Oleada ' + run.wave + '). ¿Quieres continuarla?\n\nCancelar = abandonar esta corrida y empezar una nueva (requiere Runa de Portal).');
            if (cont) {
                window._hordaResuming = true;
                window._hordaCurrentWave = run.wave;
                csState.gameMode = 'horda';
                csState.team1 = run.team.slice();
                csState.team2 = ['_horda1', '_horda2', '_horda3', '_horda4', '_horda5'];
                document.getElementById('modeSelectScreen').style.display = 'none';
                var myName = currentDisplayName();
                window._teamNames = { team1: myName, team2: 'La Horda' };
                csStartGame();
                return;
            } else {
                var abandon = confirm('¿Seguro que quieres ABANDONAR tu corrida actual (Oleada ' + run.wave + ')? Se perderá el progreso de esa corrida (el oro y reliquias ya reclamados NO se pierden, solo el avance de oleada).');
                if (!abandon) return;
                await db.ref('horda_runs/' + uid + '/active').set(false);
            }
        }

        // Nueva corrida — requiere confirmar el uso de 1 Runa de Portal
        var runeSnap = await db.ref('users/' + uid + '/portal_runes').once('value');
        var runes = runeSnap.val() || 0;
        if (runes < 1) {
            alert('🌀 No tienes Runas de Portal para abrir el portal de los Orcos.\n\nPuedes conseguirlas en la tienda (50,000 🪙) o como recompensa (5% de probabilidad al ganar una partida Ranked).');
            return;
        }
        showPortalConfirmModal(runes);
    };

    function showPortalConfirmModal(runes) {
        var modal = ensureHordaModal('hordaPortalConfirmModal');
        modal.innerHTML = [
            '<div style="width:100%;max-width:400px;background:linear-gradient(135deg,#0d1220,#160a24);border:2px solid #b46cff;border-radius:20px;padding:28px;text-align:center;box-shadow:0 0 50px rgba(160,60,255,.35);">',
                '<img src="https://i.ibb.co/Qv7MFXyj/image.png" style="width:80px;height:80px;object-fit:contain;margin:0 auto 14px;display:block;filter:drop-shadow(0 0 12px rgba(160,60,255,.6));">',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.05rem;font-weight:900;color:#b46cff;letter-spacing:.05em;margin-bottom:10px;">🌀 ABRIR PORTAL DE LOS ORCOS</div>',
                '<div style="color:#aaa;font-size:.8rem;margin-bottom:6px;">Esto consumirá <b style="color:#b46cff;">1 Runa de Portal</b> para abrir el portal y entrar al Modo Horda.</div>',
                '<div style="color:#666;font-size:.7rem;margin-bottom:22px;">Runas disponibles: ' + runes + '</div>',
                '<div style="display:flex;gap:10px;">',
                    '<button id="hordaPortalCancel" style="flex:1;padding:12px;background:rgba(255,255,255,.04);border:1px solid #333;color:#888;border-radius:10px;font-family:Orbitron,sans-serif;font-size:.78rem;cursor:pointer;">CANCELAR</button>',
                    '<button id="hordaPortalAccept" style="flex:1;padding:12px;background:linear-gradient(135deg,#3a0a5c,#7a1aa6);border:2px solid #b46cff;color:#fff;border-radius:10px;font-family:Orbitron,sans-serif;font-size:.78rem;font-weight:700;cursor:pointer;">✅ ACEPTAR</button>',
                '</div>',
            '</div>'
        ].join('');
        modal.style.display = 'flex';
        document.getElementById('hordaPortalCancel').onclick = function () { modal.style.display = 'none'; };
        document.getElementById('hordaPortalAccept').onclick = function () {
            modal.style.display = 'none';
            window._hordaResuming = false;
            window._hordaCurrentWave = 1;
            window.csSelectMode('horda');
        };
    }

    // Se llama justo después de que csStartGame arma el equipo1 por primera vez (nueva corrida)
    async function consumePortalRuneAndInitRun(team) {
        var uid = currentUid();
        if (!uid) return;
        var runeSnap = await db.ref('users/' + uid + '/portal_runes').once('value');
        var runes = runeSnap.val() || 0;
        if (runes < 1) { alert('Ya no tienes Runas de Portal.'); return false; }
        await db.ref('users/' + uid + '/portal_runes').set(runes - 1);
        var teamState = {};
        team.forEach(function (name) {
            var base = (typeof characterData !== 'undefined' ? characterData : window.characterData)[name];
            if (!base) return;
            teamState[name] = { hp: base.hp, maxHp: base.hp, charges: 0, statusEffects: [], shield: 0 };
        });
        await db.ref('horda_runs/' + uid).set({
            active: true, wave: 1, team: team, teamState: teamState,
            goldTotal: 0, rewardsLog: [], startedAt: Date.now()
        });
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════
    // PATCH initGame — inyecta los 5 Orcos de la oleada como team2, y restaura
    // el HP/cargas/estado persistido del jugador en team1 (igual patrón que
    // usa jefe-de-sala.js para inyectar al Jefe).
    // ══════════════════════════════════════════════════════════════════════
    (function patchInitGameForHorda() {
        if (typeof window.initGame !== 'function') { setTimeout(patchInitGameForHorda, 80); return; }
        var _orig = window.initGame;

        window.initGame = function (selectedChars) {
            if (typeof csState === 'undefined' || csState.gameMode !== 'horda') {
                return _orig(selectedChars);
            }

            var wave = window._hordaCurrentWave || 1;
            var chars = selectedChars ? JSON.parse(JSON.stringify(selectedChars)) : {};

            // Quitar los placeholders de team2 generados por csConfirm
            Object.keys(chars).forEach(function (k) {
                if (chars[k] && chars[k].team === 'team2') delete chars[k];
            });

            // Generar los 5 Orcos de esta oleada y fusionarlos en `chars` ANTES de
            // llamar a initGame — así quedan incluidos correctamente en
            // gameState.characters y en el orden de turnos (igual que jefe-de-sala.js
            // inyecta al Jefe). Inyectarlos DESPUÉS los dejaría fuera del turnOrder.
            var waveEnemies = window.hordaGenerateWaveEnemies(wave);
            var usedNames = {};
            var enemyRelicMap = {}; // nombre único -> lista de reliquias a equipar

            // ── ESCALADO PROGRESIVO DE HP/VELOCIDAD POR OLEADA ──
            // Cada 3 oleadas: +HORDA_HP_STEP HP máximo. Cada 4 oleadas: +1 velocidad.
            // NOTA: por ahora HORDA_HP_STEP = 2 (tal como se pidió textualmente); si la
            // fórmula real debía ser +1 por cada 3 oleadas, solo hay que cambiar esta constante.
            var HORDA_HP_STEP = 2;
            var hpIncrements = Math.floor(wave / 3);
            var spdIncrements = Math.floor(wave / 4);
            var hpBonus = hpIncrements * HORDA_HP_STEP;
            var spdBonus = spdIncrements * 1;

            // ── BUFF ALEATORIO DESDE LA OLEADA 25 (25% de probabilidad, 1 buff, 2 turnos) ──
            var HORDA_BUFF_POOL = [
                { name: 'Esquiva Area',       emoji: '💨' },
                { name: 'Esquivar',           emoji: '💨' },
                { name: 'Armadura',           emoji: '🪖' },
                { name: 'Sigilo',             emoji: '👤' },
                { name: 'Furia',              emoji: '🔥' },
                { name: 'Proteccion Sagrada', emoji: '🛡️✨' },
                { name: 'Escudo Sagrado',     emoji: '🛡️' },
                { name: 'Cuerpo Perfecto',    emoji: '💠' },
                { name: 'Espinas',            emoji: '🌵' },
                { name: 'Contraataque',       emoji: '⚔️' },
                { name: 'Celeridad',          emoji: '💨' },
                { name: 'Aura de Fuego',      emoji: '🔥' },
                { name: 'Aura Oscura',        emoji: '🖤' },
                { name: 'Reflejar',           emoji: '🪞' },
                { name: 'Intimidacion',       emoji: '😤' }
            ];

            waveEnemies.forEach(function (e) {
                var baseName = e.orcType;
                usedNames[baseName] = (usedNames[baseName] || 0) + 1;
                var uniqueName = usedNames[baseName] > 1 ? baseName + ' ' + usedNames[baseName] : baseName;
                var chData = window.hordaBuildEnemyCharacterData(baseName);
                if (!chData) return;
                chData.name = uniqueName;
                chData.team = 'team2';

                if (hpBonus > 0) { chData.hp += hpBonus; chData.maxHp += hpBonus; }
                if (spdBonus > 0) { chData.speed += spdBonus; }

                if (wave >= 25 && Math.random() < 0.25) {
                    var chosenBuff = HORDA_BUFF_POOL[Math.floor(Math.random() * HORDA_BUFF_POOL.length)];
                    chData.statusEffects.push({ name: chosenBuff.name, type: 'buff', duration: 2, emoji: chosenBuff.emoji });
                }

                var relicNames = Object.values(e.relics || {}).filter(Boolean);
                if (relicNames.length) {
                    chData.equippedRelics = relicNames;
                    relicNames.forEach(function (rn) {
                        var rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[rn] : null;
                        if (!rd) return;
                        if (rd.hpBonus) { chData.hp += rd.hpBonus; chData.maxHp += rd.hpBonus; }
                        if (rd.velBonus) { chData.speed += rd.velBonus; }
                    });
                }
                chars[uniqueName] = chData;
            });

            _orig(chars);

            if (typeof gameState === 'undefined') return;
            gameState.gameMode = 'horda';
            gameState.aiTeam = 'team2';
            gameState.myTeam = 'team1';

            // SÍNCRONO — BUG CRÍTICO CORREGIDO: antes las invocaciones (Igris, MinByung, etc.)
            // solo se restauraban dentro del bloque async de más abajo (esperando una lectura
            // de Firebase). Como initGame() ya no es async, el turno de Sun Jin Woo podía
            // empezar a procesarse ANTES de que esa lectura terminara — en ese instante
            // gameState.summons todavía estaba vacío (recién reseteado por _orig), así que
            // Arise! no veía ningún Igris existente y invocaba uno nuevo. Milisegundos después
            // llegaba la restauración y volvía a meter el Igris de la oleada anterior — dos
            // Igris vivos a la vez, y así se iban acumulando oleada tras oleada.
            // Solución: cuando la transición viene de la MISMA sesión (resolveHordaChoice ya
            // guardó gameState.summons en una variable en memoria antes de llamar a initGame),
            // restaurarlas aquí mismo de forma síncrona, antes de que cualquier turno arranque.
            var _hordaSyncRestoreDone = false;
            if (window._hordaTransientSummons) {
                Object.keys(window._hordaTransientSummons).forEach(function (sid) {
                    gameState.summons[sid] = window._hordaTransientSummons[sid];
                });
                window._hordaTransientSummons = null;
                _hordaSyncRestoreDone = true;
            }

            if (typeof renderCharacters === 'function') renderCharacters();
            if (typeof addLog === 'function') addLog('🌊 Modo Horda — Oleada ' + wave + ': ' + waveEnemies.map(function (e) { return e.orcType + ' (' + e.rank + ')'; }).join(', '), 'info');
            showHordaWaveBanner(wave);

            // ── A partir de aquí, trabajo asíncrono con Firebase — solo TOCA propiedades
            // de personajes que YA existen en gameState.characters (hp/cargas/etc), nunca
            // agrega/quita claves, así que no invalida el turnOrder ya construido arriba.
            // Las invocaciones YA se restauraron síncronamente arriba si veníamos de la misma
            // sesión; este bloque solo las restaura por Firebase para el caso de "retomar una
            // corrida guardada tras recargar la página" (ahí sí hay tiempo de sobra, porque el
            // jugador todavía tiene que pasar por la selección de personajes antes de pelear). ──
            (async function () {
                var uid = currentUid();

                if (!window._hordaResuming) {
                    var team1Names = Object.keys(gameState.characters).filter(function (n) { return gameState.characters[n].team === 'team1'; });
                    await consumePortalRuneAndInitRun(team1Names);
                    window._hordaRunTeam = team1Names;
                }
                window._hordaResuming = false;

                if (uid) {
                    var runSnap = await db.ref('horda_runs/' + uid).once('value');
                    var run = runSnap.val();
                    if (run) {
                        window._hordaRunTeam = run.team;
                        if (run.teamState) {
                            Object.keys(run.teamState).forEach(function (n) {
                                var c = gameState.characters[n];
                                var st = run.teamState[n];
                                if (!c || !st) return;
                                c.hp = st.hp; c.maxHp = st.maxHp; c.charges = st.charges || 0;
                                c.statusEffects = st.statusEffects || [];
                                c.shield = st.shield || 0;
                                c.isDead = st.hp <= 0;
                                if (st.equippedRelics) c.equippedRelics = st.equippedRelics;
                            });
                        }

                        // Restaurar las invocaciones VIVAS del jugador de la oleada anterior
                        // (Igris, MinByung, etc.) — SOLO si no se hizo ya de forma síncrona arriba.
                        if (!_hordaSyncRestoreDone && run.summons) {
                            Object.keys(run.summons).forEach(function (sid) {
                                gameState.summons[sid] = run.summons[sid];
                            });
                        }

                        if (typeof renderCharacters === 'function') renderCharacters();
                    }
                }

                // BLINDAJE: si algún personaje de team1 llegó hasta aquí sin equippedRelics
                // cargado (condición de carrera con loadGameRelics(), asíncrona y disparada
                // por csStartGame en la oleada 1), lo cargamos directo aquí y esperamos a que
                // termine antes de dejar que arranque la partida — así reliquias como "Orbe de
                // las Sombras" (bono de HP al invocar) no se pierden por llegar tarde.
                var _hordaSlotKeys = ['arma1', 'arma2', 'equip1', 'equip2', 'joya1', 'joya2'];
                var _hordaTeam1 = Object.keys(gameState.characters).filter(function (n) { return gameState.characters[n].team === 'team1'; });
                await Promise.all(_hordaTeam1.map(async function (n) {
                    var c = gameState.characters[n];
                    if (!c || c.equippedRelics) return; // ya está cargada
                    var baseName = c.baseName || n.replace(/ v\d+$/, '');
                    try {
                        var slotsSnap = await db.ref('users/' + uid + '/characters/' + baseName + '/slots_v2').once('value');
                        var slotsObj = slotsSnap.val();
                        if (!slotsObj) return;
                        var relicNames = _hordaSlotKeys.map(function (k) { return slotsObj[k]; }).filter(Boolean);
                        if (!relicNames.length) return;
                        c.equippedRelics = relicNames;
                    } catch (e) { /* sin conexión momentánea — no bloquear la partida por esto */ }
                }));
            })();
        };
    })();

    // ══════════════════════════════════════════════════════════════════════
    // GUARDAR PROGRESO
    // ══════════════════════════════════════════════════════════════════════
    window.hordaSaveProgress = async function (silent) {
        var uid = currentUid();
        if (!uid || gameState.gameMode !== 'horda') return;
        var team = window._hordaRunTeam || Object.keys(gameState.characters).filter(function (n) { return gameState.characters[n].team === 'team1'; });
        var teamState = {};
        team.forEach(function (name) {
            var c = gameState.characters[name];
            if (!c) return;
            teamState[name] = {
                hp: c.hp, maxHp: c.maxHp, charges: c.charges || 0,
                statusEffects: c.statusEffects || [], shield: c.shield || 0,
                equippedRelics: c.equippedRelics || []
            };
        });
        await db.ref('horda_runs/' + uid + '/teamState').set(teamState);
        await db.ref('horda_runs/' + uid + '/wave').set(window._hordaCurrentWave || 1);

        // Persistir las invocaciones VIVAS del jugador (Igris, MinByung, etc.) — initGame()
        // resetea gameState.summons a {} en cada oleada, así que sin esto se pierden.
        var mySummons = {};
        Object.keys(gameState.summons || {}).forEach(function (sid) {
            var s = gameState.summons[sid];
            if (s && s.team === 'team1' && s.hp > 0) mySummons[sid] = s;
        });
        await db.ref('horda_runs/' + uid + '/summons').set(mySummons);

        if (!silent) addLog('💾 Progreso de Modo Horda guardado', 'info');
    };

    // ══════════════════════════════════════════════════════════════════════
    // FIN DE COMBATE — enrutado desde showGameOver (skills.js)
    // ══════════════════════════════════════════════════════════════════════
    // Reutiliza goToMainMenu() (ya oculta correctamente .game-container, el modal de fin
    // de partida normal, resetea csState, y muestra el lobby) — antes el botón de Horda
    // solo escondía su propio modal y dejaba .game-container superpuesto sobre el lobby.
    window.hordaBackToLobby = function () {
        var dm = document.getElementById('hordaDefeatModal');
        if (dm) dm.style.display = 'none';
        window.hordaHideVideoBackground();
        gameState.gameMode = 'multi';
        gameState.aiTeam = null;
        window._hordaCurrentWave = null;
        window._hordaRunTeam = null;
        if (typeof goToMainMenu === 'function') {
            goToMainMenu();
        } else {
            if (typeof showScreen === 'function') showScreen('lobbyScreen');
            if (typeof showLobby === 'function') showLobby();
        }
    };

    window.hordaHandleGameOver = function (message) {
        var won = message.indexOf('HUNTERS') !== -1; // el jugador siempre es team1/HUNTERS en Horda
        if (won) {
            // Oleada superada: la música y el fondo de video de Horda NO se tocan — siguen sonando/mostrándose.
            showHordaWaveClearedModal();
        } else {
            // Derrota final de la corrida completa: aquí sí se detiene la música y el fondo.
            if (typeof audioManager !== 'undefined' && typeof audioManager.stopBattleMusic === 'function') audioManager.stopBattleMusic();
            if (typeof audioManager !== 'undefined' && typeof audioManager.playDefeatSfx === 'function') audioManager.playDefeatSfx();
            window.hordaHideVideoBackground();
            showHordaDefeatModal();
        }
    };

    // ── Modal: oleada superada — elegir Curar vs Cofre misterioso ──
    function showHordaWaveClearedModal() {
        var modal = ensureHordaModal('hordaWaveModal');
        var wave = window._hordaCurrentWave || 1;
        modal.innerHTML = [
            '<div style="width:100%;max-width:460px;background:linear-gradient(135deg,#0d1220,#160a24);border:2px solid #b46cff;border-radius:20px;padding:28px;text-align:center;box-shadow:0 0 50px rgba(160,60,255,.3);">',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.1rem;font-weight:900;color:#b46cff;letter-spacing:.06em;margin-bottom:6px;">🌊 ¡OLEADA ' + wave + ' SUPERADA!</div>',
                '<div style="color:#888;font-size:.78rem;margin-bottom:22px;">Elige una opción antes de comenzar la Oleada ' + (wave + 1) + '</div>',
                '<button id="hordaChoiceHeal" style="width:100%;padding:16px;margin-bottom:12px;background:rgba(0,255,136,0.07);border:2px solid #00ff88;color:#00ff88;border-radius:12px;font-family:Orbitron,sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;">',
                    '❤️ CURAR 5 HP<br><span style="font-size:.68rem;color:#5fbf9a;font-weight:400;">a todo tu equipo</span>',
                '</button>',
                '<button id="hordaChoiceChest" style="width:100%;padding:16px;background:rgba(255,215,0,0.07);border:2px solid #ffd700;color:#ffd700;border-radius:12px;font-family:Orbitron,sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;">',
                    '🎁 RECOMPENSA SORPRESA<br><span style="font-size:.68rem;color:#c2ab5f;font-weight:400;">contenido desconocido</span>',
                '</button>',
            '</div>'
        ].join('');
        modal.style.display = 'flex';

        document.getElementById('hordaChoiceHeal').onclick = function () { resolveHordaChoice('heal'); };
        document.getElementById('hordaChoiceChest').onclick = function () { resolveHordaChoice('chest'); };
    }

    // Construye el HTML de una tarjeta de revelado de recompensa (con imagen + tooltip para reliquias)
    var HORDA_TIER_COLORS = { 'Raro': '#4fc3f7', 'Especial': '#ff9800', 'Epico': '#b46cff', 'Legendario': '#ffee00' };

    window._hordaClaimGoldFromDefeat = async function () {
        var btn = document.getElementById('hordaDefeatClaimBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Reclamando…'; }
        try {
            var uid = currentUid();
            var claimed = uid && typeof claimPendingGold === 'function' ? await claimPendingGold(uid) : 0;
            var amountEl = document.getElementById('hordaDefeatGoldAmount');
            if (amountEl) amountEl.textContent = '0';
            if (btn) { btn.textContent = '✅ +' + claimed.toLocaleString() + ' reclamado'; btn.style.opacity = '.7'; }
        } catch (e) {
            if (btn) { btn.textContent = 'Error — reintenta'; btn.disabled = false; }
        }
    };

    function buildRewardRevealHtml(entry) {
        if (entry.type === 'gold') {
            return '<div style="font-size:2.4rem;margin-bottom:8px;">🪙</div>' +
                '<div style="color:#ffd700;font-family:Orbitron,sans-serif;font-weight:900;font-size:1.3rem;">+' + entry.amount.toLocaleString() + ' oro</div>';
        }
        if (entry.type === 'arcane_key') {
            return '<div style="font-size:2.4rem;margin-bottom:8px;">🗝️</div>' +
                '<div style="color:#ffd700;font-family:Orbitron,sans-serif;font-weight:900;font-size:1.05rem;">+1 Llave Arcana</div>';
        }
        if (entry.type === 'relic') {
            var rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[entry.relicName] : null;
            var img = rd ? rd.img : '';
            var desc = rd ? (entry.tier + ' — ' + (rd.desc || '')) : entry.tier;
            var tierColor = HORDA_TIER_COLORS[entry.tier] || '#ffd700';
            return '<div style="position:relative;display:inline-block;margin-bottom:10px;" ' +
                    'onmouseover="var t=this.querySelector(\'.hrTooltip\'); if(t) t.style.opacity=\'1\';" ' +
                    'onmouseout="var t=this.querySelector(\'.hrTooltip\'); if(t) t.style.opacity=\'0\';">' +
                    '<img src="' + img + '" style="width:84px;height:84px;object-fit:cover;border-radius:12px;border:2px solid ' + tierColor + ';box-shadow:0 0 16px ' + tierColor + '66;">' +
                    '<div class="hrTooltip" style="opacity:0;transition:opacity .15s;position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;width:220px;background:#0e0509;border:1px solid ' + tierColor + ';border-radius:8px;padding:8px 10px;font-size:.68rem;color:#ccc;text-align:left;pointer-events:none;z-index:10;">' + desc + '</div>' +
                '</div>' +
                '<div style="color:' + tierColor + ';font-family:Orbitron,sans-serif;font-weight:900;font-size:1rem;">' + entry.relicName + '</div>' +
                '<div style="color:#888;font-size:.7rem;">Reliquia ' + entry.tier + '</div>';
        }
        return '';
    }

    async function resolveHordaChoice(choice) {
        var uid = currentUid();
        var modal = document.getElementById('hordaWaveModal');
        var wave = window._hordaCurrentWave || 1;

        if (choice === 'heal') {
            (window._hordaRunTeam || []).forEach(function (n) {
                var c = gameState.characters[n];
                if (c && !c.isDead) c.hp = Math.min(c.maxHp, c.hp + 5);
            });
            if (typeof addLog === 'function') addLog('❤️ Modo Horda: +5 HP a todo el equipo', 'heal');
            if (typeof renderCharacters === 'function') renderCharacters();
        } else {
            var rewardType = pickChestReward();
            var entry = { wave: wave, ts: Date.now() };
            var logMsg = '';

            if (rewardType === 'gold') {
                var amount = (Math.floor(Math.random() * 271) + 80) * wave;
                if (typeof checkMemorexGoldBonus === 'function' && checkMemorexGoldBonus(window._hordaRunTeam || [])) {
                    amount = Math.floor(amount * 1.5);
                }
                if (typeof addPendingGold === 'function') await addPendingGold(uid, amount, { mode: 'horda' });
                entry.type = 'gold'; entry.amount = amount;
                logMsg = '🪙 +' + amount.toLocaleString() + ' oro';
            } else if (rewardType === 'arcane_key') {
                var ks = await db.ref('users/' + uid + '/arcane_keys').once('value');
                await db.ref('users/' + uid + '/arcane_keys').set((ks.val() || 0) + 1);
                entry.type = 'arcane_key';
                logMsg = '🗝️ +1 Llave Arcana';
            } else {
                var tier = rewardType.replace('relic_', '');
                var relicName = randomRelicOfTier(tier);
                if (relicName && typeof addRelicToInventory === 'function') {
                    await addRelicToInventory(uid, relicName);
                    entry.type = 'relic'; entry.relicName = relicName; entry.tier = tier;
                    logMsg = '💎 Reliquia ' + tier + ': ' + relicName;
                } else {
                    var fallback = (Math.floor(Math.random() * 271) + 80) * wave;
                    if (typeof checkMemorexGoldBonus === 'function' && checkMemorexGoldBonus(window._hordaRunTeam || [])) {
                        fallback = Math.floor(fallback * 1.5);
                    }
                    if (typeof addPendingGold === 'function') await addPendingGold(uid, fallback, { mode: 'horda' });
                    entry.type = 'gold'; entry.amount = fallback;
                    logMsg = '🪙 +' + fallback.toLocaleString() + ' oro (compensación)';
                }
            }

            var runRef = db.ref('horda_runs/' + uid + '/rewardsLog');
            var logSnap = await runRef.once('value');
            var log = logSnap.val() || [];
            log.push(entry);
            await runRef.set(log);
            if (typeof addLog === 'function') addLog('🎁 Modo Horda — Recompensa sorpresa: ' + logMsg, 'buff');
            if (modal) {
                modal.innerHTML = '<div style="max-width:380px;background:#160a24;border:2px solid #ffd700;border-radius:18px;padding:30px;text-align:center;">' +
                    buildRewardRevealHtml(entry) +
                    '</div>';
                await new Promise(function (r) { setTimeout(r, 1800); });
            }
        }

        window._hordaCurrentWave = wave + 1;
        if (modal) modal.style.display = 'none';
        await window.hordaSaveProgress(true);

        // Iniciar la siguiente oleada re-ejecutando el flujo de batalla
        window._hordaResuming = true; // ya se consumió la runa al inicio de la corrida
        // Capturar las invocaciones actuales EN MEMORIA (síncronamente) para que el patch de
        // initGame las restaure de inmediato, sin esperar una lectura de Firebase — evita la
        // condición de carrera que dejaba duplicar invocaciones (ej. 2-3 Igris a la vez).
        window._hordaTransientSummons = JSON.parse(JSON.stringify(gameState.summons || {}));
        var team1Names = window._hordaRunTeam || Object.keys(gameState.characters).filter(function (n) { return gameState.characters[n].team === 'team1'; });
        var selectedChars = {};
        team1Names.forEach(function (n) {
            var c = gameState.characters[n];
            if (c) selectedChars[n] = Object.assign({}, c, { team: 'team1' });
        });
        document.querySelector('.game-container').style.display = 'block';
        window.initGame(selectedChars);
    }

    // ── Modal: derrota final — resumen de recompensas de toda la corrida ──
    async function showHordaDefeatModal() {
        var uid = currentUid();
        var wave = window._hordaCurrentWave || 1;
        if (uid) {
            await window.updateHordaHighScore(uid, currentDisplayName(), wave);
            await db.ref('horda_runs/' + uid + '/active').set(false);
        }
        var runSnap = uid ? await db.ref('horda_runs/' + uid).once('value') : null;
        var run = runSnap ? runSnap.val() : null;
        var log = (run && run.rewardsLog) || [];

        var relicCounts = {}, keys = 0, thisRunGold = 0;
        log.forEach(function (e) {
            if (e.type === 'relic') relicCounts[e.relicName] = (relicCounts[e.relicName] || 0) + 1;
            else if (e.type === 'arcane_key') keys++;
            else if (e.type === 'gold') thisRunGold += e.amount || 0;
        });

        // Oro PENDIENTE real (incluye esta corrida + cualquier otro oro sin reclamar de antes)
        var pendingGold = uid && typeof getPendingGold === 'function' ? await getPendingGold(uid) : 0;
        var otherPendingGold = Math.max(0, pendingGold - thisRunGold);

        var relicLines = Object.keys(relicCounts).map(function (n) {
            var rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[n] : null;
            var img = rd ? rd.img : '';
            var tierColor = HORDA_TIER_COLORS[rd ? rd.tier : ''] || '#ffd700';
            return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">' +
                '<img src="' + img + '" style="width:32px;height:32px;object-fit:cover;border-radius:6px;border:1px solid ' + tierColor + ';" title="' + (rd ? rd.desc : '') + '">' +
                '<span style="color:#ccc;font-size:.78rem;">' + n + (relicCounts[n] > 1 ? ' ×' + relicCounts[n] : '') + '</span>' +
            '</div>';
        }).join('');

        var modal = ensureHordaModal('hordaDefeatModal');
        modal.innerHTML = [
            '<div style="width:100%;max-width:460px;background:linear-gradient(135deg,#1a0505,#0d0a1f);border:2px solid #ff4444;border-radius:20px;padding:28px;text-align:center;box-shadow:0 0 50px rgba(255,68,68,.3);max-height:85vh;overflow-y:auto;">',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.2rem;font-weight:900;color:#ff4444;letter-spacing:.06em;margin-bottom:4px;">💀 CORRIDA TERMINADA</div>',
                '<div style="color:#888;font-size:.8rem;margin-bottom:20px;">Llegaste hasta la Oleada ' + wave + '</div>',
                '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.25);border-radius:12px;padding:16px;margin-bottom:16px;">',
                    '<div style="font-size:1.6rem;">🪙</div>',
                    '<div style="color:#fff;font-family:Orbitron,sans-serif;font-size:1.2rem;font-weight:900;">' + thisRunGold.toLocaleString() + '</div>',
                    '<div style="color:#888;font-size:.68rem;margin-bottom:8px;">oro obtenido en ESTA corrida</div>',
                    (otherPendingGold > 0 ? '<div style="color:#666;font-size:.65rem;margin-bottom:6px;">+ ' + otherPendingGold.toLocaleString() + ' 🪙 pendiente de antes</div>' : ''),
                    '<div id="hordaDefeatGoldAmount" style="color:#ffd700;font-family:Orbitron,sans-serif;font-size:1.5rem;font-weight:900;border-top:1px solid rgba(255,215,0,.2);padding-top:8px;">' + pendingGold.toLocaleString() + ' 🪙 total a reclamar</div>',
                (pendingGold > 0 ? '<button id="hordaDefeatClaimBtn" onclick="window._hordaClaimGoldFromDefeat()" style="margin-top:10px;width:100%;padding:10px;background:linear-gradient(135deg,#5c4400,#a67c00);border:2px solid #ffd700;color:#ffd700;border-radius:9px;font-family:Orbitron,sans-serif;font-size:.75rem;font-weight:700;cursor:pointer;">💰 RECLAMAR</button>' : ''),
                '</div>',
                (keys ? '<div style="color:#ccc;font-size:.8rem;margin-bottom:10px;">🗝️ ' + keys + ' Llave(s) Arcana(s)</div>' : ''),
                (relicLines ? '<div style="text-align:left;margin-bottom:16px;">' + relicLines + '</div>' : ''),
                '<button onclick="window.hordaBackToLobby()" ',
                    'style="width:100%;padding:13px;background:linear-gradient(135deg,#003a5c,#006fa6);border:2px solid #00c4ff;color:#00c4ff;border-radius:10px;font-family:Orbitron,sans-serif;font-size:.85rem;font-weight:700;cursor:pointer;">',
                    '🏠 VOLVER AL LOBBY',
                '</button>',
            '</div>'
        ].join('');
        modal.style.display = 'flex';
    }

    // Banner cinematográfico de OLEADA — reutiliza EXACTAMENTE el mismo id/CSS que el
    // banner de RONDA del juego (#roundBanner), solo con texto distinto. Como nunca se
    // muestran los dos a la vez, es seguro reusar el mismo id.
    function showHordaWaveBanner(wave) {
        var existing = document.getElementById('roundBanner');
        if (existing) existing.remove();
        var banner = document.createElement('div');
        banner.id = 'roundBanner';
        banner.innerHTML = '<div style="text-align:center;position:relative;">' +
            '<div class="round-banner-lines top"></div>' +
            '<div class="round-text">OLEADA ' + wave + '</div>' +
            '<div class="round-sub">· MODO HORDA ·</div>' +
            '<div class="round-banner-lines bottom"></div>' +
        '</div>';
        document.body.appendChild(banner);
        setTimeout(function () { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 1650);
    }

    function ensureHordaModal(id) {
        var modal = document.getElementById(id);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = id;
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:60000;display:none;align-items:center;justify-content:center;padding:20px;';
            document.body.appendChild(modal);
        }
        return modal;
    }

})();
