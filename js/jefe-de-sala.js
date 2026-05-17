// ==================== JEFE DE SALA — MÓDULO COMPLETO v2.0 ====================
// Cargar DESPUÉS de skills.js en index.html:
//   <script src="js/jefe-de-sala.js?v=1"></script>
//
// Qué hace este módulo:
//   1. Define BOSS_RANK_REWARDS (recompensas por posición).
//   2. Expone window.startBossBattle (llamado por attackBoss en firebase-auth.js).
//   3. Reemplaza window.initBossAttack con implementación real (verifica límite diario,
//      abre character select en modo 'solo').
//   4. Parchea window.initGame para inyectar al Jefe como team2 en modo boss.
//   5. Parchea window.showGameOver para registrar el daño en Firebase y mostrar
//      un toast de resultado.
//   6. Reemplaza window.loadBossScreen con versión mejorada: tabla de clasificación
//      + columna de recompensas por posición + tarjeta de tu posición actual.

(function () {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // 1. RECOMPENSAS POR POSICIÓN
    // ─────────────────────────────────────────────────────────────────────────
    var BOSS_RANK_REWARDS = [
        { rank: 1,  label: '🥇 1er Lugar',  gold: 100000, keys: 2, extra: '2 Llaves Arcanas',  color: '#ffd700', bg: 'rgba(255,215,0,0.12)'  },
        { rank: 2,  label: '🥈 2do Lugar',  gold: 50000,  keys: 1, extra: '1 Llave Arcana',    color: '#c0c0c0', bg: 'rgba(192,192,192,0.08)' },
        { rank: 3,  label: '🥉 3er Lugar',  gold: 20000,  keys: 0, extra: 'Cofre Épico',        color: '#cd7f32', bg: 'rgba(205,127,50,0.08)'  },
        { rank: 4,  label: '4to Lugar',      gold: 10000,  keys: 0, extra: 'Cofre Especial',     color: '#4fc3f7', bg: 'rgba(79,195,247,0.06)'  },
        { rank: 5,  label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' },
        { rank: 6,  label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' },
        { rank: 7,  label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' },
        { rank: 8,  label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' },
        { rank: 9,  label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' },
        { rank: 10, label: 'Top 5+',         gold: 5000,   keys: 0, extra: null,                 color: '#888',    bg: 'rgba(255,255,255,0.02)' }
    ];

    function getBossRewardForRank(rank) {
        if (!rank || rank <= 0) return { gold: 5000, keys: 0, extra: null, color: '#888', bg: 'transparent' };
        if (rank === 1) return { rank:1, gold:100000, keys:2, extra:'2 Llaves Arcanas', color:'#ffd700', bg:'rgba(255,215,0,0.12)' };
        if (rank === 2) return { rank:2, gold:50000,  keys:1, extra:'1 Llave Arcana',   color:'#c0c0c0', bg:'rgba(192,192,192,0.08)' };
        if (rank === 3) return { rank:3, gold:20000,  keys:0, extra:'Cofre Épico',      color:'#cd7f32', bg:'rgba(205,127,50,0.08)' };
        if (rank === 4) return { rank:4, gold:10000,  keys:0, extra:'Cofre Especial',   color:'#4fc3f7', bg:'rgba(79,195,247,0.06)' };
        return           { rank:rank, gold:5000,   keys:0, extra:null,              color:'#888',    bg:'rgba(255,255,255,0.02)' };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. startBossBattle (punto de entrada para attackBoss en firebase-auth.js)
    // ─────────────────────────────────────────────────────────────────────────
    window.startBossBattle = function (uid, playerName, playerTeam, boss) {
        // Guardar contexto de la batalla
        window._bossMode        = true;
        window._bossBattleUid   = uid;
        window._bossBattleData  = { boss: boss };
        window._bossHpAtStart   = boss.hp || 10000;

        // Ocultar pantalla del jefe
        if (typeof hideBossScreen === 'function') hideBossScreen();

        // Abrir selector de personajes en modo boss
        // csSelectMode está expuesta como window.csSelectMode desde index.html
        var modeScreen = document.getElementById('modeSelectScreen');
        var charScreen = document.getElementById('charSelectScreen');

        if (typeof window.csSelectMode === 'function') {
            // Asegurarse de que modeSelectScreen esté visible para que csSelectMode pueda ocultarlo
            if (modeScreen) modeScreen.style.display = 'flex';
            window.csSelectMode('boss');
        } else {
            // Fallback: mostrar charSelectScreen directamente
            if (modeScreen) modeScreen.style.display = 'none';
            if (charScreen) charScreen.style.display = 'block';
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Override initBossAttack — implementación real
    // ─────────────────────────────────────────────────────────────────────────
    window.initBossAttack = async function () {
        var user = (typeof firebase !== 'undefined' && firebase.auth)
            ? firebase.auth().currentUser
            : null;
        if (!user) {
            alert('Debes iniciar sesión para atacar al Jefe de Sala.');
            return;
        }

        // Obtener datos del jefe
        var boss;
        try { boss = await getBossData(); } catch (e) { boss = null; }
        if (!boss || boss.status !== 'active') {
            alert('No hay Jefe de Sala activo en este momento.');
            return;
        }

        // Verificar límite diario (1 ataque por día)
        var today = new Date().toISOString().split('T')[0];
        var lastSnap;
        try {
            lastSnap = await db.ref('weekly_boss/damage_log/' + user.uid + '/lastAttack').once('value');
        } catch (e) { lastSnap = null; }

        if (lastSnap && lastSnap.val() === today) {
            // Ya atacó hoy — mostrar mensaje en la pantalla del jefe sin cerrarla
            var el = document.getElementById('boss-content');
            if (el) {
                el.insertAdjacentHTML('afterbegin',
                    '<div id="bossAlreadyMsg" style="background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.3);' +
                    'border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;animation:bossFadeIn .4s ease;">' +
                    '<div style="font-size:1.6rem;margin-bottom:6px;">⏰</div>' +
                    '<div style="font-family:Orbitron,sans-serif;color:#ffaa00;font-size:.85rem;font-weight:700;margin-bottom:4px;">Ataque diario realizado</div>' +
                    '<div style="color:#888;font-size:.75rem;">Ya realizaste tu ataque de hoy.<br>¡Vuelve mañana para seguir acumulando daño!</div>' +
                    '</div>');
            }
            return;
        }

        // Todo OK — lanzar flujo de batalla
        window.startBossBattle(user.uid, user.displayName || user.email || user.uid, null, boss);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Patch initGame — inyectar el Jefe como team2 en modo boss
    // ─────────────────────────────────────────────────────────────────────────
    (function patchInitGame() {
        // Esperar a que initGame esté disponible (init-render.js carga antes)
        if (typeof window.initGame !== 'function') {
            setTimeout(patchInitGame, 80);
            return;
        }
        var _orig = window.initGame;

        window.initGame = function (selectedChars) {
            if (!window._bossMode || !window._bossBattleData || !window._bossBattleData.boss) {
                return _orig(selectedChars);
            }

            var boss = window._bossBattleData.boss;

            // Clonar el objeto de personajes seleccionados
            var chars = selectedChars
                ? JSON.parse(JSON.stringify(selectedChars))
                : {};

            // Eliminar los personajes que el CS generó para team2 (IA)
            Object.keys(chars).forEach(function (k) {
                if (chars[k] && chars[k].team === 'team2') delete chars[k];
            });

            // Inyectar al Jefe de Sala como único miembro de team2
            var bossKey = boss.name || 'Broly';
            chars[bossKey] = {
                hp:           boss.hp     || 10000,
                maxHp:        boss.maxHp  || 10000,
                speed:        boss.speed  || 95,
                charges:      0,
                team:         'team2',
                isBoss:       true,          // ← INMUNIDAD A ONE-HIT KO + PORTRAIT GRANDE
                statusEffects:[],
                shield:       0,
                shieldEffect: null,
                isDead:       false,
                portrait:     boss.portrait || '',
                passive:      boss.passive  || {
                    name: 'Legendario Super Sayajin',
                    description: 'Cada vez que recibe daño, genera 3 cargas.'
                },
                abilities:    boss.abilities || (
                    typeof BOSS_DATA !== 'undefined' && BOSS_DATA.broly
                        ? BOSS_DATA.broly.abilities
                        : []
                )
            };

            // Llamar al initGame original con los personajes ya inyectados
            _orig(chars);

            // Forzar modo boss DESPUÉS de que initGame lo haya configurado
            if (typeof gameState !== 'undefined') {
                gameState.gameMode = 'boss';
                gameState.aiTeam   = 'team2';  // la IA controla al Jefe
                gameState.myTeam   = 'team1';

                // ── Cargar reliquias del jugador en modo boss ──
                var _bUser = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
                if (_bUser && typeof db !== 'undefined') {
                    Object.keys(gameState.characters).forEach(function(charName) {
                        var _ch = gameState.characters[charName];
                        if (!_ch || _ch.team !== 'team1') return;
                        var baseName = charName.replace(/ v\d+$/, '');
                        db.ref('users/' + _bUser.uid + '/characters/' + baseName + '/slots').once('value').then(function(snap) {
                            var equip = snap.val();
                            if (!equip) return;
                            var slots = [equip.slot1, equip.slot2, equip.slot3].filter(Boolean);
                            if (!slots.length) return;
                            _ch.equippedRelics = slots;
                            if (typeof RELICS_DATA !== 'undefined') {
                                slots.forEach(function(relicName) {
                                    var rd = RELICS_DATA[relicName];
                                    if (!rd) return;
                                    if (rd.hpBonus)  { _ch.hp = (_ch.hp||0) + rd.hpBonus; _ch.maxHp = (_ch.maxHp||0) + rd.hpBonus; }
                                    if (rd.velBonus) { _ch.speed = (_ch.speed||0) + rd.velBonus; }
                                });
                            }
                            if (typeof renderCharacters === 'function') renderCharacters();
                        }).catch(function(){});
                    });
                }
            }
        };
    }());

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Patch showGameOver — registrar daño al finalizar la batalla
    // ─────────────────────────────────────────────────────────────────────────
    (function patchShowGameOver() {
        if (typeof window.showGameOver !== 'function') {
            setTimeout(patchShowGameOver, 80);
            return;
        }
        var _orig = window.showGameOver;

        window.showGameOver = function (message) {
            if (window._bossMode) {
                _processBossResult(); // async, no bloquea
                window._bossMode = false; // limpiar flag para partidas posteriores
            }
            _orig(message);
        };
    }());

    async function _processBossResult() {
        try {
            var bossKey = (window._bossBattleData && window._bossBattleData.boss)
                ? (window._bossBattleData.boss.name || 'Broly')
                : 'Broly';

            // HP restante del jefe en el estado del juego
            var bossChar = (typeof gameState !== 'undefined' && gameState.characters)
                ? gameState.characters[bossKey]
                : null;
            var hpRestante  = bossChar ? Math.max(0, bossChar.hp || 0) : 0;
            var damageDealt = Math.max(0, (window._bossHpAtStart || 10000) - hpRestante);

            var uid = window._bossBattleUid;
            if (!uid) {
                var user = (typeof firebase !== 'undefined' && firebase.auth)
                    ? firebase.auth().currentUser : null;
                uid = user ? user.uid : null;
            }
            if (!uid) return;

            var result = null;
            if (damageDealt > 0) {
                try {
                    result = await registerBossDamage(uid, damageDealt);
                } catch (e) {
                    console.error('[JEFE] Error registrando daño:', e);
                }
            }

            var goldEarned = result ? (result.goldReward || 0) : 0;

            // Mostrar toast DESPUÉS de que aparezca la pantalla épica de resultado
            setTimeout(function () {
                _showBossResultToast(damageDealt, goldEarned);
            }, 2800);

        } catch (e) {
            console.error('[JEFE] Error en _processBossResult:', e);
        }
    }

    function _showBossResultToast(damageDealt, goldEarned) {
        // Inyectar estilos de animación si aún no existen
        if (!document.getElementById('bossToastCSS')) {
            var style = document.createElement('style');
            style.id = 'bossToastCSS';
            style.textContent = [
                '@keyframes bossToastIn{',
                '  from{opacity:0;transform:translateX(-50%) translateY(24px) scale(.94)}',
                '  to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}',
                '}',
                '@keyframes bossFadeIn{',
                '  from{opacity:0;transform:translateY(-8px)}',
                '  to{opacity:1;transform:translateY(0)}',
                '}'
            ].join('');
            document.head.appendChild(style);
        }

        // Eliminar toast anterior si existe
        var prev = document.getElementById('bossResultToast');
        if (prev) prev.remove();

        var toast = document.createElement('div');
        toast.id = 'bossResultToast';
        toast.style.cssText = [
            'position:fixed',
            'bottom:32px',
            'left:50%',
            'transform:translateX(-50%)',
            'background:linear-gradient(135deg,rgba(8,2,18,0.98),rgba(25,0,8,0.98))',
            'border:2px solid #ff4444',
            'border-radius:18px',
            'padding:22px 28px',
            'z-index:99999',
            'text-align:center',
            'min-width:300px',
            'max-width:90vw',
            'box-shadow:0 0 50px rgba(255,68,68,0.45),0 8px 32px rgba(0,0,0,0.8)',
            'animation:bossToastIn .45s cubic-bezier(.2,.8,.3,1.1) forwards'
        ].join(';');

        var dmgHtml = damageDealt > 0
            ? '<div style="font-size:2.2rem;font-weight:900;color:#fff;letter-spacing:-.02em;margin:4px 0 2px;">'
              + damageDealt.toLocaleString()
              + '<span style="font-size:1rem;color:#ff4444;margin-left:4px;font-weight:400;">HP</span></div>'
            : '<div style="font-size:1.2rem;color:#555;margin:8px 0;">Sin daño registrado</div>';

        var goldHtml = goldEarned > 0
            ? '<div style="font-size:.85rem;color:#ffd700;margin-bottom:14px;">+ '
              + goldEarned.toLocaleString()
              + ' 🪙 ganados</div>'
            : '<div style="height:14px;margin-bottom:14px;"></div>';

        toast.innerHTML = [
            '<div style="font-family:Orbitron,sans-serif;font-size:.8rem;font-weight:900;',
                'color:#ff4444;letter-spacing:.12em;margin-bottom:6px;text-transform:uppercase;">',
                '⚔️ Daño al Jefe de Sala',
            '</div>',
            dmgHtml,
            goldHtml,
            '<div style="display:flex;gap:8px;justify-content:center;">',
                '<button id="bossToastRankBtn" ',
                    'style="background:linear-gradient(135deg,#500000,#aa0000);border:2px solid #ff4444;',
                    'color:#ff4444;padding:9px 18px;border-radius:9px;font-family:Orbitron,sans-serif;',
                    'font-size:.72rem;cursor:pointer;letter-spacing:.06em;font-weight:700;',
                    'transition:box-shadow .2s;box-shadow:0 0 14px rgba(255,68,68,0.3);" ',
                    'onmouseover="this.style.boxShadow=\'0 0 24px rgba(255,68,68,0.6)\'" ',
                    'onmouseout="this.style.boxShadow=\'0 0 14px rgba(255,68,68,0.3)\'">',
                    '📊 VER RANKING',
                '</button>',
                '<button id="bossToastCloseBtn" ',
                    'style="background:rgba(255,255,255,0.04);border:1px solid #333;color:#666;',
                    'padding:9px 14px;border-radius:9px;font-size:.75rem;cursor:pointer;">',
                    '✕',
                '</button>',
            '</div>'
        ].join('');

        document.body.appendChild(toast);

        // Eventos de los botones
        document.getElementById('bossToastRankBtn').addEventListener('click', function () {
            toast.remove();
            if (typeof window.showBossScreen === 'function') window.showBossScreen();
        });
        document.getElementById('bossToastCloseBtn').addEventListener('click', function () {
            toast.remove();
        });

        // Auto-dismiss después de 15 segundos
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 15000);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Override loadBossScreen — versión mejorada con recompensas
    // ─────────────────────────────────────────────────────────────────────────
    window.loadBossScreen = async function () {
        var content = document.getElementById('boss-content');
        if (!content) return;

        content.innerHTML = [
            '<div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:48px 20px;color:#333;">',
            '<div style="width:20px;height:20px;border:2px solid #ff4444;border-top-color:transparent;',
                'border-radius:50%;animation:bossSpin 0.7s linear infinite;"></div>',
            '<span style="font-family:Orbitron,sans-serif;font-size:.85rem;">Cargando datos del jefe...</span>',
            '</div>'
        ].join('');

        // Animación spinner
        if (!document.getElementById('bossSpinCSS')) {
            var spinStyle = document.createElement('style');
            spinStyle.id = 'bossSpinCSS';
            spinStyle.textContent = '@keyframes bossSpin{to{transform:rotate(360deg)}}';
            document.head.appendChild(spinStyle);
        }

        var boss = null;
        try { boss = await getBossData(); } catch (e) { /* continuar */ }

        var user = (typeof firebase !== 'undefined' && firebase.auth)
            ? firebase.auth().currentUser : null;

        // ── Sin jefe activo ──────────────────────────────────────────────────
        if (!boss || boss.status !== 'active') {
            content.innerHTML = [
                '<div style="text-align:center;padding:60px 20px;">',
                '<div style="font-size:3.5rem;margin-bottom:16px;filter:grayscale(1);">😴</div>',
                '<div style="font-family:Orbitron,sans-serif;color:#444;font-size:.9rem;margin-bottom:6px;">',
                    'No hay Jefe de Sala activo',
                '</div>',
                '<div style="color:#333;font-size:.78rem;">',
                    'El administrador activará el próximo evento pronto.',
                '</div>',
                '</div>'
            ].join('');
            return;
        }

        // ── Cargar ranking desde Firebase ────────────────────────────────────
        var logData = {};
        try {
            var logSnap = await db.ref('weekly_boss/damage_log').once('value');
            logData = logSnap.val() || {};
        } catch (e) { /* continuar */ }

        var today = new Date().toISOString().split('T')[0];

        // Ordenar ranking por daño total descendente
        var ranking = Object.entries(logData)
            .map(function (e) {
                return {
                    uid:         e[0],
                    playerName:  e[1].playerName  || e[0],
                    totalDamage: e[1].totalDamage  || 0,
                    lastAttack:  e[1].lastAttack   || null
                };
            })
            .sort(function (a, b) { return b.totalDamage - a.totalDamage; });

        var myLog          = user ? (logData[user.uid] || null) : null;
        var alreadyAttacked = myLog && myLog.lastAttack === today;
        var myRankIndex    = user
            ? ranking.findIndex(function (e) { return e.uid === user.uid; })
            : -1;
        var myRank   = myRankIndex >= 0 ? myRankIndex + 1 : null;
        var myReward = myRank ? getBossRewardForRank(myRank) : null;

        // Barra de HP
        var hpPct   = Math.max(0, Math.min(100, ((boss.hp || 0) / (boss.maxHp || 1)) * 100));
        var hpColor = hpPct > 60 ? '#00ff88' : hpPct > 30 ? '#ffaa00' : '#ff4444';

        var html = [];

        // ── Tarjeta del jefe ─────────────────────────────────────────────────
        html.push(
            '<div style="display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;',
                'background:rgba(255,68,68,0.05);border:1px solid rgba(255,68,68,0.25);',
                'border-radius:14px;padding:18px;margin-bottom:18px;">',

            '<img src="', boss.portrait, '" ',
                'style="width:115px;height:115px;object-fit:cover;border-radius:12px;',
                'border:2px solid #ff4444;flex-shrink:0;',
                'box-shadow:0 0 24px rgba(255,68,68,0.35);" ',
                'onerror="this.style.display=\'none\'">',

            '<div style="flex:1;min-width:180px;">',
                '<div style="font-family:Orbitron,sans-serif;font-size:1.05rem;color:#ff4444;',
                    'font-weight:900;margin-bottom:4px;letter-spacing:.05em;">',
                    boss.name || '???',
                '</div>',
                '<div style="font-size:.72rem;color:#666;margin-bottom:10px;">',
                    '⚡ VEL: ', (boss.speed || 0),
                    ' &nbsp;|&nbsp; ',
                    '📅 ', (boss.startDate || '').split('T')[0],
                    ' → ', (boss.endDate || '').split('T')[0],
                '</div>',

                // HP text
                '<div style="display:flex;justify-content:space-between;font-size:.73rem;',
                    'color:#aaa;margin-bottom:5px;">',
                    '<span>HP del Jefe</span>',
                    '<span><span style="color:#ff4444;font-weight:700;">',
                        (boss.hp || 0).toLocaleString(),
                    '</span> / ', (boss.maxHp || 0).toLocaleString(), '</span>',
                '</div>',

                // HP bar
                '<div style="background:rgba(255,68,68,0.12);border-radius:8px;height:12px;',
                    'overflow:hidden;margin-bottom:14px;border:1px solid rgba(255,68,68,0.15);">',
                    '<div style="background:linear-gradient(90deg,', hpColor, ',#ff4444);',
                        'height:100%;width:', hpPct.toFixed(2), '%;',
                        'transition:width .6s;border-radius:8px;',
                        'box-shadow:0 0 10px ', hpColor, '55;">',
                    '</div>',
                '</div>',

                // Botón atacar o mensaje
                alreadyAttacked
                    ? '<div style="background:rgba(255,170,0,0.08);border:1px solid rgba(255,170,0,0.3);' +
                      'border-radius:9px;padding:11px;font-size:.75rem;color:#ffaa00;text-align:center;">' +
                      '⏰ Ataque diario realizado &mdash; ¡Vuelve mañana!</div>'

                    : '<button onclick="initBossAttack()" ' +
                      'style="width:100%;padding:13px;' +
                      'background:linear-gradient(135deg,#4a0000,#990000);' +
                      'border:2px solid #ff4444;color:#ff5555;' +
                      'border-radius:10px;font-family:Orbitron,sans-serif;font-size:.82rem;' +
                      'cursor:pointer;letter-spacing:.06em;font-weight:700;' +
                      'box-shadow:0 0 22px rgba(255,68,68,0.28);transition:all .2s;" ' +
                      'onmouseover="this.style.background=\'linear-gradient(135deg,#660000,#cc0000)\';' +
                          'this.style.boxShadow=\'0 0 36px rgba(255,68,68,0.55)\';" ' +
                      'onmouseout="this.style.background=\'linear-gradient(135deg,#4a0000,#990000)\';' +
                          'this.style.boxShadow=\'0 0 22px rgba(255,68,68,0.28)\';">' +
                      '⚔️ ATACAR AL JEFE DE SALA' +
                      '</button>',

            '</div>',
            '</div>'
        );

        // ── Mi posición actual (si estoy en el ranking) ──────────────────────
        if (myRank && myReward && myLog) {
            var medalMe = myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🎖️';
            html.push(
                '<div style="background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.22);',
                    'border-radius:12px;padding:14px 18px;margin-bottom:18px;',
                    'display:flex;align-items:center;gap:14px;flex-wrap:wrap;">',
                '<div style="font-size:2rem;flex-shrink:0;">', medalMe, '</div>',
                '<div style="flex:1;min-width:140px;">',
                    '<div style="font-family:Orbitron,sans-serif;font-size:.78rem;color:#ffd700;',
                        'font-weight:700;margin-bottom:2px;">',
                        'Tu posición: #', myRank,
                    '</div>',
                    '<div style="font-size:.74rem;color:#888;">',
                        'Daño acumulado: ',
                        '<span style="color:#ff5555;font-weight:700;">',
                            (myLog.totalDamage || 0).toLocaleString(),
                        '</span> HP',
                    '</div>',
                '</div>',
                '<div style="text-align:right;flex-shrink:0;">',
                    '<div style="font-size:.65rem;color:#555;margin-bottom:2px;">',
                        'Recompensa estimada',
                    '</div>',
                    '<div style="font-size:.88rem;color:#ffd700;font-weight:700;">',
                        '🪙 ', myReward.gold.toLocaleString(),
                    '</div>',
                    myReward.extra
                        ? '<div style="font-size:.68rem;color:#aaa;">+ ' + myReward.extra + '</div>'
                        : '',
                '</div>',
                '</div>'
            );
        }

        // ── Grid: tabla + recompensas ────────────────────────────────────────
        html.push(
            '<div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">'
        );

        // ── Tabla de clasificación ───────────────────────────────────────────
        html.push(
            '<div style="flex:1;min-width:300px;background:rgba(255,68,68,0.04);',
                'border:1px solid rgba(255,68,68,0.2);border-radius:12px;padding:16px;">',

            '<div style="font-family:Orbitron,sans-serif;font-size:.82rem;color:#ff4444;',
                'margin-bottom:14px;font-weight:700;letter-spacing:.05em;">',
                '🏆 TABLA DE CLASIFICACIÓN',
            '</div>'
        );

        if (ranking.length === 0) {
            html.push(
                '<div style="text-align:center;color:#444;font-size:.8rem;padding:24px;">',
                    'Nadie ha atacado al Jefe todavía.<br>¡Sé el primero!',
                '</div>'
            );
        } else {
            // Encabezado de columnas
            html.push(
                '<div style="display:grid;grid-template-columns:32px 1fr 80px 60px;',
                    'font-size:.65rem;color:#444;padding:0 8px 8px;',
                    'border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:6px;">',
                '<span>#</span>',
                '<span>Jugador</span>',
                '<span style="text-align:right;">Daño</span>',
                '<span style="text-align:right;">🪙</span>',
                '</div>'
            );

            ranking.slice(0, 20).forEach(function (entry, i) {
                var r       = i + 1;
                var medals  = ['🥇', '🥈', '🥉'];
                var medal   = medals[i] !== undefined ? medals[i] : (r + '.');
                var isMe    = user && entry.uid === user.uid;
                var rw      = getBossRewardForRank(r);
                var rowBg   = isMe
                    ? 'rgba(255,68,68,0.14)'
                    : (i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent');

                html.push(
                    '<div style="display:grid;grid-template-columns:32px 1fr 80px 60px;',
                        'align-items:center;background:', rowBg, ';',
                        'border-radius:7px;padding:8px 8px;margin-bottom:2px;',
                        isMe ? 'border:1px solid rgba(255,68,68,0.35);' : '',
                    '">',

                    '<span style="font-size:.8rem;">', medal, '</span>',

                    '<span style="font-size:.74rem;color:', isMe ? '#fff' : '#ccc', ';',
                        'font-weight:', isMe ? '700' : '400', ';',
                        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">',
                        _escHtml(entry.playerName || '???'),
                        isMe ? ' <span style="color:#ff4444;font-size:.62rem;">(tú)</span>' : '',
                    '</span>',

                    '<span style="font-size:.75rem;color:#ff5555;font-weight:700;text-align:right;">',
                        (entry.totalDamage || 0).toLocaleString(),
                    '</span>',

                    '<span style="font-size:.68rem;color:', rw ? rw.color : '#555', ';text-align:right;">',
                        rw ? rw.gold.toLocaleString() : '250',
                    '</span>',

                    '</div>'
                );
            });
        }

        html.push('</div>'); // fin tabla

        // ── Panel de recompensas ─────────────────────────────────────────────
        html.push(
            '<div style="width:220px;flex-shrink:0;background:rgba(255,215,0,0.04);',
                'border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:16px;">',

            '<div style="font-family:Orbitron,sans-serif;font-size:.8rem;color:#ffd700;',
                'margin-bottom:6px;font-weight:700;">',
                '🎁 RECOMPENSAS',
            '</div>',
            '<div style="font-size:.66rem;color:#444;margin-bottom:12px;font-style:italic;">',
                'Distribuidas al finalizar el evento',
            '</div>'
        );

        // Filas de recompensa individuales (1-4)
        var rewardRows = [
            { r:1, label:'🥇 1er Lugar', gold:100000, extra:'2 Llaves Arcanas', color:'#ffd700', bg:'rgba(255,215,0,0.12)' },
            { r:2, label:'🥈 2do Lugar', gold:50000,  extra:'1 Llave Arcana',   color:'#c0c0c0', bg:'rgba(192,192,192,0.08)' },
            { r:3, label:'🥉 3er Lugar', gold:20000,  extra:'Cofre Épico',      color:'#cd7f32', bg:'rgba(205,127,50,0.08)' },
            { r:4, label:'4to Lugar',    gold:10000,  extra:'Cofre Especial',   color:'#4fc3f7', bg:'rgba(79,195,247,0.06)' }
        ];
        rewardRows.forEach(function(rw) {
            var isMeRow = myRank === rw.r;
            html.push(
                '<div style="display:flex;align-items:center;justify-content:space-between;',
                    'background:', (isMeRow ? 'rgba(255,68,68,0.15)' : rw.bg), ';',
                    'border:1px solid ', (isMeRow ? 'rgba(255,68,68,0.4)' : 'rgba(255,255,255,0.06)'), ';',
                    'border-radius:7px;padding:7px 9px;margin-bottom:4px;">',
                '<span style="font-size:.72rem;color:', rw.color, ';font-weight:700;font-family:Orbitron,sans-serif;">', rw.label, '</span>',
                '<div style="text-align:right;flex-shrink:0;">',
                    '<div style="font-size:.72rem;color:#ffd700;font-weight:700;">🪙 ', rw.gold.toLocaleString(), '</div>',
                    '<div style="font-size:.62rem;color:#aaa;">+ ', rw.extra, '</div>',
                '</div>',
                '</div>'
            );
        });

        // Fila 5to en adelante
        var isMeRest = myRank && myRank >= 5;
        html.push(
            '<div style="display:flex;align-items:center;justify-content:space-between;',
                'background:', (isMeRest ? 'rgba(255,68,68,0.12)' : 'rgba(255,255,255,0.02)'), ';',
                'border:1px solid ', (isMeRest ? 'rgba(255,68,68,0.3)' : 'rgba(255,255,255,0.04)'), ';',
                'border-radius:7px;padding:7px 9px;margin-bottom:4px;">',
            '<span style="font-size:.7rem;color:#666;">5to en adelante</span>',
            '<div style="text-align:right;"><div style="font-size:.7rem;color:#888;">🪙 5,000</div></div>',
            '</div>'
        );

        html.push('</div>'); // fin rewards panel
        html.push('</div>'); // fin flex grid

        // Volcar todo de una vez
        content.innerHTML = html.join('');
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Utilidades internas
    // ─────────────────────────────────────────────────────────────────────────
    function _escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

}());
