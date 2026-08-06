// ══════════════════════════════════════════════════════════════════════
// EVENTO: PROBABILIDAD AUMENTADA — Cofre Arcano
// 3 veces por semana (lunes a domingo), en un día y hora aleatorios entre
// las 10:00 y las 22:59 (para que la duración de 60 min nunca pase de las
// 23:59), sumando un bonus aleatorio (+1% / +1.5% / +2% / +2.5%, mismo
// peso c/u) a la probabilidad base de 0.5% de Reliquia Legendaria.
//
// El horario corre en tiempo real (basado en reloj), NO depende de que
// haya jugadores conectados: se calcula y guarda una única vez por semana
// en Firebase (el primer cliente que entra esa semana lo genera, de forma
// atómica vía transaction para evitar duplicados), y desde ahí cualquier
// cliente puede saber en cualquier momento si el evento está activo con
// una simple comparación de fechas. Si nadie estuvo conectado durante el
// evento, el jugador recibe la notificación retroactiva en su buzón la
// próxima vez que entre, indicando de qué hora a qué hora estuvo activo.
//
// Firebase (Realtime DB):
//   events/arcane_boost/{weekId} = { weekId, generatedAt, slots:[
//       { id:'s0', day:0-6, start:ms, end:ms, bonusPct:0.01-0.025 }, ...
//   ]}
//   users/{uid}/arcane_boost_notified/{weekId_slotId} = true  (ya avisado)
// ══════════════════════════════════════════════════════════════════════
(function () {

    var BONUS_OPTIONS    = [0.01, 0.015, 0.02, 0.025];
    var EVENT_DURATION_MS = 60 * 60 * 1000;
    var _scheduleCache   = {}; // weekId -> schedule obj (o null si no existe/aplica)

    function _pad(n) { return n < 10 ? '0' + n : '' + n; }

    // Lunes 00:00:00 (hora local) de la semana que contiene `date`
    function getMondayOfWeek(date) {
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        var day = d.getDay(); // 0=Dom,1=Lun,...,6=Sáb
        var diff = (day === 0 ? -6 : 1 - day);
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function getWeekId(date) {
        var monday = getMondayOfWeek(date);
        return monday.getFullYear() + '-' + _pad(monday.getMonth() + 1) + '-' + _pad(monday.getDate());
    }

    function _shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    // Genera 3 slots en 3 días distintos de la semana, hora aleatoria 10:00-22:59
    function _generateSchedule(weekId, monday) {
        var days = _shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3);
        var slots = days.map(function (dayOffset, i) {
            var hour = 10 + Math.floor(Math.random() * 13); // 10..22
            var minute = Math.floor(Math.random() * 60);
            var start = new Date(monday.getTime());
            start.setDate(start.getDate() + dayOffset);
            start.setHours(hour, minute, 0, 0);
            var startMs = start.getTime();
            return {
                id: 's' + i,
                day: dayOffset,
                start: startMs,
                end: startMs + EVENT_DURATION_MS,
                bonusPct: BONUS_OPTIONS[Math.floor(Math.random() * BONUS_OPTIONS.length)]
            };
        }).sort(function (a, b) { return a.start - b.start; });
        return { weekId: weekId, generatedAt: Date.now(), slots: slots };
    }

    // Asegura que exista el horario de esa semana en Firebase (idempotente)
    async function _ensureWeekSchedule(weekId, monday) {
        if (weekId in _scheduleCache) return _scheduleCache[weekId];
        if (typeof db === 'undefined') return null;
        var ref = db.ref('events/arcane_boost/' + weekId);
        try {
            var result = await ref.transaction(function (current) {
                if (current) return; // ya existe: no tocar (aborta sin error)
                return _generateSchedule(weekId, monday);
            });
            var schedule = result && result.snapshot ? result.snapshot.val() : null;
            if (!schedule) schedule = (await ref.once('value')).val();
            _scheduleCache[weekId] = schedule;
            return schedule;
        } catch (e) {
            console.warn('[arcane-event] No se pudo generar/leer el horario semanal:', e);
            return null;
        }
    }

    // Solo LEE (no genera) el horario de una semana pasada, si existía
    async function _readWeekSchedule(weekId) {
        if (weekId in _scheduleCache) return _scheduleCache[weekId];
        if (typeof db === 'undefined') return null;
        try {
            var snap = await db.ref('events/arcane_boost/' + weekId).once('value');
            _scheduleCache[weekId] = snap.val();
            return _scheduleCache[weekId];
        } catch (e) {
            return null;
        }
    }

    // Carga semana actual (generándola si hace falta) + semana anterior (solo lectura,
    // para poder avisar retroactivamente si el jugador se perdió un evento pasado)
    async function loadArcaneEventSchedules() {
        var now = new Date();
        var thisMonday = getMondayOfWeek(now);
        var thisWeekId = getWeekId(now);
        var prevMonday = new Date(thisMonday.getTime() - 7 * 86400000);
        var prevWeekId = getWeekId(prevMonday);
        await _ensureWeekSchedule(thisWeekId, thisMonday);
        await _readWeekSchedule(prevWeekId);
        return [thisWeekId, prevWeekId];
    }

    function _allCachedSlots() {
        var all = [];
        Object.keys(_scheduleCache).forEach(function (wid) {
            var sched = _scheduleCache[wid];
            if (sched && sched.slots) {
                sched.slots.forEach(function (s) { all.push({ weekId: wid, slot: s }); });
            }
        });
        return all;
    }

    // Evento activo AHORA MISMO (o null) — cómputo 100% local, sin llamadas a Firebase
    function getActiveArcaneBoostEvent() {
        var now = Date.now();
        var found = null;
        _allCachedSlots().forEach(function (entry) {
            if (now >= entry.slot.start && now < entry.slot.end) found = entry.slot;
        });
        return found;
    }
    window.getActiveArcaneBoostEvent = getActiveArcaneBoostEvent;

    // ── Notificaciones pendientes: cualquier slot ya iniciado que el jugador no ha visto ──
    async function checkArcaneBoostNotifications(uid) {
        if (!uid || typeof db === 'undefined') return;
        await loadArcaneEventSchedules();
        var now = Date.now();
        var pending = _allCachedSlots().filter(function (entry) { return entry.slot.start <= now; });
        if (pending.length === 0) return;
        var notifiedSnap = await db.ref('users/' + uid + '/arcane_boost_notified').once('value');
        var notifiedMap = notifiedSnap.val() || {};
        var updates = {};
        pending.forEach(function (entry) {
            var key = entry.weekId + '_' + entry.slot.id;
            if (notifiedMap[key]) return;
            var startStr = new Date(entry.slot.start).toLocaleString('es-MX', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
            var endStr = new Date(entry.slot.end).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            var bonusStr = (entry.slot.bonusPct * 100).toFixed(1).replace('.0', '') + '%';
            var stillActive = now < entry.slot.end;
            var msg = stillActive
                ? ('🎲 ¡Evento de Probabilidad Aumentada ACTIVO! +' + bonusStr + ' de probabilidad extra de Reliquia Legendaria en el Cofre Arcano, hasta las ' + endStr + '. ¡Corre al Mercado!')
                : ('🎲 Hubo un Evento de Probabilidad Aumentada el ' + startStr + ' hasta las ' + endStr + ' (+' + bonusStr + ' de probabilidad de Reliquia Legendaria en el Cofre Arcano).');
            var notifRef = db.ref('users/' + uid + '/notifications').push();
            updates['users/' + uid + '/notifications/' + notifRef.key] = { type: 'arcane_boost', msg: msg, ts: Date.now(), read: false };
            updates['users/' + uid + '/arcane_boost_notified/' + key] = true;
        });
        if (Object.keys(updates).length > 0) await db.ref().update(updates);
    }
    window.checkArcaneBoostNotifications = checkArcaneBoostNotifications;

    // ── UI: badge sobre el botón Mercado + banner sobre el Cofre Arcano ──
    function _formatCountdown(ms) {
        var totalSec = Math.max(0, Math.ceil(ms / 1000));
        var m = Math.floor(totalSec / 60);
        var s = totalSec % 60;
        return _pad(m) + ':' + _pad(s);
    }

    function _tickArcaneEventUI() {
        var event = getActiveArcaneBoostEvent();
        var marketBadge = document.getElementById('marketEventBadge');
        if (marketBadge) {
            if (event) {
                marketBadge.style.display = 'flex';
                var timerEl = marketBadge.querySelector('.aeb-timer');
                if (timerEl) timerEl.textContent = _formatCountdown(event.end - Date.now());
            } else {
                marketBadge.style.display = 'none';
            }
        }
        var banner = document.getElementById('arcaneEventBanner');
        if (banner) {
            if (event) {
                var bonusStr = (event.bonusPct * 100).toFixed(1).replace('.0', '') + '%';
                banner.style.display = 'block';
                banner.innerHTML = '🎲 ¡PROBABILIDAD AUMENTADA! +' + bonusStr + ' Legendario · Termina en ' +
                    '<span style="font-family:Orbitron,sans-serif;">' + _formatCountdown(event.end - Date.now()) + '</span>';
            } else {
                banner.style.display = 'none';
            }
        }
    }
    window._tickArcaneEventUI = _tickArcaneEventUI;

    var _arcaneUITimer = null;
    var _arcaneRefreshTimer = null;
    function startArcaneEventUI() {
        if (_arcaneUITimer) return;
        loadArcaneEventSchedules().then(_tickArcaneEventUI);
        _arcaneUITimer = setInterval(_tickArcaneEventUI, 1000);
        // Refresca el caché cada 5 min por si cruza a una nueva semana con la sesión abierta
        _arcaneRefreshTimer = setInterval(function () { loadArcaneEventSchedules(); }, 5 * 60 * 1000);
    }
    window.startArcaneEventUI = startArcaneEventUI;

    function stopArcaneEventUI() {
        if (_arcaneUITimer) { clearInterval(_arcaneUITimer); _arcaneUITimer = null; }
        if (_arcaneRefreshTimer) { clearInterval(_arcaneRefreshTimer); _arcaneRefreshTimer = null; }
    }

    // Hook automático al iniciar sesión
    var _arcaneAuthHooked = false;
    function _hookAuth() {
        if (_arcaneAuthHooked) return;
        if (typeof firebase === 'undefined' || !firebase.auth) { setTimeout(_hookAuth, 300); return; }
        _arcaneAuthHooked = true;
        firebase.auth().onAuthStateChanged(function (user) {
            if (user) {
                loadArcaneEventSchedules().then(function () {
                    checkArcaneBoostNotifications(user.uid);
                    startArcaneEventUI();
                });
            } else {
                stopArcaneEventUI();
            }
        });
    }
    _hookAuth();

    // ── DEBUG/ADMIN: forzar un evento activo AHORA MISMO (solo para pruebas) ──
    // Uso en consola: adminForceArcaneEvent()            → 60 min, bonus aleatorio
    //                 adminForceArcaneEvent(5)            → 5 min, bonus aleatorio
    //                 adminForceArcaneEvent(5, 0.025)      → 5 min, bonus fijo +2.5%
    // Se guarda en Firebase igual que un evento real, así que se ve para TODOS los
    // jugadores conectados y también dispara la notificación de buzón normalmente.
    window.adminForceArcaneEvent = async function (durationMinutes, bonusPct) {
        if (typeof isAdmin === 'function' && !isAdmin()) { console.warn('[arcane-event] Solo admin puede forzar el evento.'); return null; }
        if (typeof db === 'undefined') { console.warn('[arcane-event] Firebase no disponible.'); return null; }
        var now = Date.now();
        var dur = (durationMinutes || 60) * 60000;
        var bonus = bonusPct || BONUS_OPTIONS[Math.floor(Math.random() * BONUS_OPTIONS.length)];
        var weekId = getWeekId(new Date());
        var monday = getMondayOfWeek(new Date());
        var slot = { id: 'debug' + now, day: new Date().getDay(), start: now, end: now + dur, bonusPct: bonus };
        var ref = db.ref('events/arcane_boost/' + weekId);
        var snap = await ref.once('value');
        var sched = snap.val() || { weekId: weekId, generatedAt: now, slots: [] };
        sched.slots = sched.slots || [];
        sched.slots.push(slot);
        await ref.set(sched);
        _scheduleCache[weekId] = sched;
        _tickArcaneEventUI();
        console.log('✅ [arcane-event] Evento forzado activo por ' + (durationMinutes || 60) + ' min con bonus +' + (bonus * 100).toFixed(1) + '%:', slot);
        return slot;
    };

})();
