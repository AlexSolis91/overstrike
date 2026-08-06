// ══════════════════════════════════════════════════════════════════════
// MISIONES DIARIAS
// 6 misiones individuales + 1 misión meta (completar las 6). Se reinician
// cada día a las 00:00 (hora local) porque el progreso se guarda bajo una
// clave de fecha (igual patrón que usa el Raid Diario en firebase-auth.js).
//
// Firebase (Realtime DB):
//   users/{uid}/daily_missions/{dateKey} = {
//       progress: { m1:0, m2:0, m3:0, m4:false, m5:0, m6:0 },
//       claimed:  { m1:false, ..., m7:false }
//   }
// ══════════════════════════════════════════════════════════════════════
(function () {

    var MISSIONS = [
        { id: 'm1', title: 'Ataques Diarios',        desc: 'Realiza tus 5 ataques Ranked diarios (Raid Diario)',       target: 5,      type: 'counter', reward: { apply: function (uid) { return addGold(uid, 15000); },                          label: '+15,000 🪙 Oro' } },
        { id: 'm2', title: 'Victorias Ranked',        desc: 'Gana 10 ataques en modo Ranked',                            target: 10,     type: 'counter', reward: { apply: function (uid) { return db.ref('users/' + uid + '/portal_runes').transaction(function (v) { return (v || 0) + 1; }); }, label: '+1 Runa de Portal' } },
        { id: 'm3', title: 'Fortuna del Día',         desc: 'Gana 200,000 de Oro (todo el oro que recibas hoy cuenta)', target: 200000, type: 'counter', reward: { apply: function (uid) { return db.ref('users/' + uid + '/arcane_keys').transaction(function (v) { return (v || 0) + 1; }); }, label: '+1 🗝️ Llave Arcana' } },
        { id: 'm4', title: 'Victoria Perfecta',       desc: 'Gana una batalla en modo Ranked en PERFECT',                target: 1,      type: 'flag',    reward: { apply: function (uid) { return db.ref('users/' + uid + '/attack_runes').transaction(function (v) { return (v || 0) + 1; }); }, label: '+1 🔮 Runa de Ataque' } },
        { id: 'm5', title: 'Cacería de Orcos',        desc: 'Elimina 50 Orcos en Modo Horda',                            target: 50,     type: 'counter', reward: { apply: function (uid) { return addGold(uid, 50000); },                          label: '+50,000 🪙 Oro' } },
        { id: 'm6', title: 'Guerrero Incansable',     desc: 'Juega 30 partidas en modo Ranked',                          target: 30,     type: 'counter', reward: { apply: function (uid) { return null; }, label: '1 Reliquia Aleatoria (30% Épica / 70% Especial)', isRelic: true } },
        { id: 'm7', title: 'Misión Perfecta',         desc: 'Completa las 6 misiones diarias anteriores',                target: 6,      type: 'meta',    reward: { apply: function (uid) { return db.ref('users/' + uid + '/arcane_keys').transaction(function (v) { return (v || 0) + 1; }); }, label: '+1 🗝️ Llave Arcana' } }
    ];
    var COUNTER_IDS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
    window.OVERSTRIKE_MISSIONS = MISSIONS;

    function _pad(n) { return n < 10 ? '0' + n : '' + n; }
    function getTodayDateKey() {
        var d = new Date();
        return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
    }

    function _defOf(id) { for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i].id === id) return MISSIONS[i]; return null; }

    async function getTodayMissionsData(uid) {
        if (typeof db === 'undefined' || !uid) return { progress: {}, claimed: {} };
        var snap = await db.ref('users/' + uid + '/daily_missions/' + getTodayDateKey()).once('value');
        var data = snap.val() || {};
        data.progress = data.progress || {};
        data.claimed = data.claimed || {};
        return data;
    }

    function _isComplete(data, id) {
        var def = _defOf(id);
        if (!def) return false;
        if (def.type === 'meta') {
            return COUNTER_IDS.every(function (cid) { return _isComplete(data, cid); });
        }
        if (def.type === 'flag') return !!data.progress[id];
        return (data.progress[id] || 0) >= def.target;
    }

    // ── Progreso: incremento atómico de un contador numérico ──
    async function _incrementProgress(uid, id, amount) {
        if (typeof db === 'undefined' || !uid) return;
        var ref = db.ref('users/' + uid + '/daily_missions/' + getTodayDateKey() + '/progress/' + id);
        await ref.transaction(function (cur) { return (cur || 0) + amount; });
        _refreshMissionsBadge(uid);
    }
    async function _setFlag(uid, id) {
        if (typeof db === 'undefined' || !uid) return;
        await db.ref('users/' + uid + '/daily_missions/' + getTodayDateKey() + '/progress/' + id).set(true);
        _refreshMissionsBadge(uid);
    }

    // ── Hooks públicos para que otros archivos reporten progreso ──
    // Llamado desde firebase-auth.js al finalizar CUALQUIER ataque Ranked (Raid o Buscar Rival)
    window.registerRankedMissionProgress = async function (uid, opts) {
        if (!uid) return;
        opts = opts || {};
        if (opts.isRaid) await _incrementProgress(uid, 'm1', 1);
        await _incrementProgress(uid, 'm6', 1); // cualquier partida Ranked cuenta (Raid + Buscar Rival)
        if (opts.won) await _incrementProgress(uid, 'm2', 1);
        if (opts.won && opts.isPerfect) await _setFlag(uid, 'm4');
    };
    // Llamado desde addGold() en firebase-auth.js — cuenta CUALQUIER oro recibido hoy
    window.registerGoldEarnedForMissions = async function (uid, amount) {
        if (!uid || !amount || amount <= 0) return;
        await _incrementProgress(uid, 'm3', amount);
    };
    // Llamado desde el wrapper de hordaHandleGameOver más abajo
    window.registerOrcKillsForMissions = async function (uid, count) {
        if (!uid || !count) return;
        await _incrementProgress(uid, 'm5', count);
    };

    // ── Reliquia aleatoria de la misión 6: 30% Épica / 70% Especial ──
    function _rollMissionRelic() {
        var pool = { Epico: [], Especial: [] };
        if (typeof RELICS_DATA !== 'undefined') {
            Object.keys(RELICS_DATA).forEach(function (name) {
                var r = RELICS_DATA[name];
                if (name === 'Memorex' || r.isEventRelic) return;
                if (r.tier === 'Epico') pool.Epico.push(name);
                else if (r.tier === 'Especial') pool.Especial.push(name);
            });
        }
        var tier = Math.random() < 0.30 ? 'Epico' : 'Especial';
        var list = pool[tier].length ? pool[tier] : (pool.Especial.length ? pool.Especial : pool.Epico);
        var name = list.length ? list[Math.floor(Math.random() * list.length)] : 'Anillo de la Vida';
        return (typeof RELICS_DATA !== 'undefined' && RELICS_DATA[name]) ? Object.assign({ name: name }, RELICS_DATA[name]) : { name: name, tier: tier };
    }

    // ── Reclamar una misión ──
    window.claimMission = async function (missionId) {
        var user = firebase.auth().currentUser;
        if (!user) return { ok: false, reason: 'no_auth' };
        var uid = user.uid;
        var def = _defOf(missionId);
        if (!def) return { ok: false, reason: 'invalid' };
        var data = await getTodayMissionsData(uid);
        if (data.claimed[missionId]) return { ok: false, reason: 'already' };
        if (!_isComplete(data, missionId)) return { ok: false, reason: 'incomplete' };

        var relicWon = null;
        if (def.reward.isRelic) {
            relicWon = _rollMissionRelic();
            await addRelicToInventory(uid, relicWon.name);
        } else {
            await def.reward.apply(uid);
        }
        await db.ref('users/' + uid + '/daily_missions/' + getTodayDateKey() + '/claimed/' + missionId).set(true);
        if (typeof updateLobbyHUD === 'function') updateLobbyHUD();
        _refreshMissionsBadge(uid);
        return { ok: true, relic: relicWon };
    };

    // ── Badge de alerta sobre el botón MISIONES ──
    async function _refreshMissionsBadge(uid) {
        if (!uid) { var u = firebase.auth().currentUser; uid = u ? u.uid : null; }
        if (!uid) return;
        var data = await getTodayMissionsData(uid);
        var claimable = MISSIONS.some(function (m) { return !data.claimed[m.id] && _isComplete(data, m.id); });
        var badge = document.getElementById('missionsBadge');
        if (badge) badge.style.display = claimable ? 'block' : 'none';
    }
    window.refreshMissionsBadge = _refreshMissionsBadge;

    // ── Ventana de Misiones ──
    window.showMissionsModal = async function () {
        var user = firebase.auth().currentUser;
        if (!user) return;
        var uid = user.uid;
        var data = await getTodayMissionsData(uid);
        var existing = document.getElementById('missionsModal');
        if (existing) existing.remove();

        var doneCount = COUNTER_IDS.filter(function (id) { return _isComplete(data, id); }).length;

        var overlay = document.createElement('div');
        overlay.id = 'missionsModal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;';

        var card = document.createElement('div');
        card.style.cssText = 'background:linear-gradient(135deg,#0a0e17,#0d1a25);border:2px solid #ffe14f;border-radius:20px;padding:24px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 0 40px rgba(255,225,79,0.2);';

        var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
            '<div style="font-family:Orbitron,sans-serif;color:#ffe14f;font-size:1.05rem;font-weight:700;">🎯 MISIONES DIARIAS</div>' +
            '<button id="missionsCloseBtn" style="background:none;border:1px solid #ff3366;color:#ff3366;border-radius:8px;padding:4px 10px;cursor:pointer;font-family:Orbitron,sans-serif;font-size:.7rem;">✕ CERRAR</button>' +
            '</div>' +
            '<div style="font-size:.66rem;color:#888;margin-bottom:16px;">Se reinician todos los días a las 00:00. Progreso de hoy.</div>';

        MISSIONS.forEach(function (m) {
            var isM7 = m.id === 'm7';
            var complete = _isComplete(data, m.id);
            var claimed = !!data.claimed[m.id];
            var pct, progressLabel;
            if (isM7) {
                pct = (doneCount / 6) * 100;
                progressLabel = doneCount + '/6';
            } else if (m.type === 'flag') {
                pct = complete ? 100 : 0;
                progressLabel = complete ? '1/1' : '0/1';
            } else {
                var cur = Math.min(data.progress[m.id] || 0, m.target);
                pct = (cur / m.target) * 100;
                progressLabel = (m.id === 'm3' ? cur.toLocaleString() + ' / ' + m.target.toLocaleString() : cur + '/' + m.target);
            }
            var btnHTML;
            if (claimed) {
                btnHTML = '<button disabled style="background:rgba(0,255,136,0.1);border:1px solid #00ff88;color:#00ff88;border-radius:8px;padding:8px 12px;font-family:Orbitron,sans-serif;font-size:.62rem;font-weight:700;cursor:default;white-space:nowrap;">✅ RECLAMADO</button>';
            } else if (complete) {
                btnHTML = '<button onclick="window._claimMissionUI(\'' + m.id + '\')" style="background:linear-gradient(135deg,#003a1a,#00aa55);border:2px solid #00ff88;color:#00ff88;border-radius:8px;padding:8px 12px;font-family:Orbitron,sans-serif;font-size:.62rem;font-weight:700;cursor:pointer;white-space:nowrap;animation:arcaneEventPulse 1.2s infinite;">🎁 RECLAMAR</button>';
            } else {
                btnHTML = '<button disabled style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.15);color:#666;border-radius:8px;padding:8px 12px;font-family:Orbitron,sans-serif;font-size:.62rem;font-weight:700;cursor:not-allowed;white-space:nowrap;">🔒 BLOQUEADO</button>';
            }
            var borderColor = isM7 ? '#ffd700' : 'rgba(255,255,255,0.1)';
            html += '<div style="background:' + (isM7 ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + borderColor + ';border-radius:12px;padding:12px 14px;margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
                '<div style="flex:1;min-width:0;">' +
                '<div style="font-size:.8rem;color:' + (isM7 ? '#ffd700' : '#fff') + ';font-weight:700;margin-bottom:2px;">' + (isM7 ? '⭐ ' : '') + m.title + '</div>' +
                '<div style="font-size:.66rem;color:#aaa;margin-bottom:6px;">' + m.desc + '</div>' +
                '<div style="font-size:.66rem;color:#ffd700;margin-bottom:6px;">🎁 ' + m.reward.label + '</div>' +
                '<div style="background:rgba(255,255,255,0.08);border-radius:6px;height:6px;overflow:hidden;">' +
                '<div style="height:100%;width:' + Math.min(100, pct).toFixed(0) + '%;background:linear-gradient(90deg,#00d9ff,#00ff88);"></div>' +
                '</div>' +
                '<div style="font-size:.58rem;color:#666;margin-top:3px;">' + progressLabel + '</div>' +
                '</div>' +
                '<div>' + btnHTML + '</div>' +
                '</div></div>';
        });

        card.innerHTML = html;
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        card.querySelector('#missionsCloseBtn').onclick = function () { overlay.remove(); };
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };
    };

    // ── Botón "Reclamar" dentro de la ventana ──
    window._claimMissionUI = async function (missionId) {
        var result = await window.claimMission(missionId);
        if (!result || !result.ok) {
            if (result && result.reason === 'incomplete') alert('Aún no has completado esta misión.');
            return;
        }
        window.showMissionsModal(); // refrescar la ventana con el nuevo estado
        if (missionId === 'm6' && result.relic && typeof showChestOpenModal === 'function') {
            showChestOpenModal('mission', result.relic, 0, false);
        } else {
            var t = document.createElement('div');
            t.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1a3a0a,#4a8c1c);color:#fff;padding:14px 24px;border-radius:12px;font-family:Orbitron,sans-serif;font-size:.85rem;font-weight:700;z-index:2147483647;box-shadow:0 0 30px rgba(74,140,28,0.6);';
            t.textContent = '✅ Recompensa reclamada';
            document.body.appendChild(t);
            setTimeout(function () { t.remove(); }, 2500);
        }
    };

    // ── Hook: Orcos eliminados en Modo Horda ──
    // Se envuelve hordaHandleGameOver (definida en horda-battle.js, ya cargado antes que
    // este script): cuando el jugador GANA una oleada, todos los enemigos de esa oleada
    // quedaron derrotados — se cuentan los que tengan "Orco" en el nombre.
    (function () {
        var _origHordaGameOver = window.hordaHandleGameOver;
        window.hordaHandleGameOver = function (message) {
            try {
                var won = typeof message === 'string' && message.indexOf('HUNTERS') !== -1;
                if (won && typeof gameState !== 'undefined' && gameState.characters) {
                    var orcCount = 0;
                    Object.keys(gameState.characters).forEach(function (n) {
                        var c = gameState.characters[n];
                        if (c && c.team === 'team2' && typeof n === 'string' && n.indexOf('Orco') !== -1) orcCount++;
                    });
                    var user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
                    if (user && orcCount > 0) window.registerOrcKillsForMissions(user.uid, orcCount);
                }
            } catch (e) { console.warn('[missions] Fallo al contar Orcos eliminados:', e); }
            if (typeof _origHordaGameOver === 'function') return _origHordaGameOver.apply(this, arguments);
        };
    })();

    // ── Refrescar badge al iniciar sesión ──
    var _missionsAuthHooked = false;
    function _hookAuth() {
        if (_missionsAuthHooked) return;
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(_hookAuth, 300); return; }
        _missionsAuthHooked = true;
        firebase.auth().onAuthStateChanged(function (user) {
            if (user) _refreshMissionsBadge(user.uid);
        });
    }
    _hookAuth();

})();
