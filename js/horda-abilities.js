// ══════════════════════════════════════════════════════════════════════════
// MODO HORDA — Lógica de habilidades y pasivas de los Orcos
// Depende de: gameState, addLog, applyDamageWithShield, applyBleed, applyStun,
// applyDebuff, applyBuff, applyWeaken, applyConfusion, applyFrenesi, applyHeal,
// applyShield, generateChargesInline, isImmuneToDebuff, normAccent, renderCharacters
// (todas ya definidas en los demás archivos JS del juego, cargados antes que este).
// ══════════════════════════════════════════════════════════════════════════

(function () {

    // ── Helpers de equipo ──
    function enemyTeamOf(team) { return team === 'team1' ? 'team2' : 'team1'; }
    function aliveOnTeam(team) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.team === team && !c.isDead && c.hp > 0;
        });
    }
    function aliveEnemiesOf(team) { return aliveOnTeam(enemyTeamOf(team)); }
    function isOrcName(name) { return typeof name === 'string' && name.indexOf('Orco') !== -1; }
    function orcAlliesOf(team) { return aliveOnTeam(team).filter(function (n) { return isOrcName(n); }); }
    function randomFrom(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
    function grantCharges(name, amount) {
        var c = gameState.characters[name];
        if (!c) return;
        c.charges = Math.min(20, (c.charges || 0) + amount);
    }
    function passiveHolders(team, passiveName) {
        return aliveOnTeam(team).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.passive && c.passive.name === passiveName;
        });
    }
    function grantExtraTurn(name) {
        // Reutiliza el mismo mecanismo de turno extra que ya usa el juego (Skeggöx, Anillo del Tiempo, etc.)
        gameState._skeggoxExtraTurn = name;
    }

    // ══════════════════════════════════════════════════════════════════════
    // MODIFICADORES DE DAÑO POR RELIQUIA (pre-golpe)
    // La mayoría de los efectos de reliquia (Sangrado al golpear, Aturdimiento,
    // drenar cargas, turno extra, robo de cargas de Frostmourne, etc.) YA
    // funcionan para los Orcos porque están enganchados dentro de
    // applyDamageWithShield(), que las 32 habilidades de Horda llaman
    // directamente. Lo que SÍ falta es el bloque de modificadores que se
    // calculan ANTES del golpe (Espada del Triunfo, Puño de Obsidiana,
    // Frostmourne x2, Shadowmourne, etc.) — eso vive únicamente en el motor
    // normal de ejecución de habilidades del jugador, que los Orcos no usan.
    // Esta función replica ese mismo bloque para que también les aplique.
    //   abilityType: 'basic' | 'special' | 'over'
    //   isAoeOrMt:   true si el movimiento golpea a varios objetivos (AOE/MT)
    function hordaComputeRelicDamage(casterName, targetName, baseDamage, abilityType, isAoeOrMt) {
        var caster = gameState.characters[casterName];
        if (!caster || baseDamage <= 0) return baseDamage;
        var dmg = baseDamage;
        // HIMNO DE LOS GIGANTES (Kargalgan): +5 daño base a TODOS los ataques (básico,
        // especial y over) del equipo aliado — se aplica aquí porque esta función la
        // llaman todas las habilidades de todos los Orcos, sin importar el tipo.
        if (caster._hordaGiantsHymnBonus) dmg += caster._hordaGiantsHymnBonus;
        (caster.equippedRelics || []).forEach(function (relicName) {
            var rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[relicName] : null;
            if (!rd || !rd.effect) return;

            if (rd.effect === 'crit_chance_bonus' && !gameState._isCritHit && Math.random() < 0.10) {
                dmg *= 2; gameState._isCritHit = true;
                addLog('💫 Cuerno del Caos: ¡Crítico! (+10%)', 'buff');
            }
            if (rd.effect === 'frostmourne') {
                dmg = dmg * 2;
                addLog('❄️ Frostmourne: daño duplicado (' + dmg + ')', 'buff');
            }
            if (rd.effect === 'varita_de_sauco' && isAoeOrMt) {
                dmg = dmg * 2;
                caster.hp = Math.max(1, (caster.hp || 0) - 3);
                addLog('🪄 Varita de Saúco: daño AOE duplicado — ' + casterName + ' pierde 3 HP', 'buff');
            }
            if (rd.effect === 'basic_dmg_50pct' && abilityType === 'basic') {
                dmg = Math.ceil(dmg * 1.5);
                addLog('⚔️ Espada del Triunfo: básico +50% daño', 'buff');
            }
            if (rd.effect === 'basic_dmg_plus2' && abilityType === 'basic') {
                dmg += 2;
                addLog('⚔️ Puño de Obsidiana: básico +2 daño', 'buff');
            }
            if (rd.effect === 'special_dmg_plus2' && (abilityType === 'special' || abilityType === 'over')) {
                dmg += 2;
                addLog('📋 Tabla de Elementos: especial +2 daño', 'buff');
            }
            if (rd.effect === 'direbounds' && !isAoeOrMt) {
                dmg += 5;
                addLog('🥊 Direbounds: movimiento ST +5 daño', 'buff');
            }
            if (rd.effect === 'double_heal') {
                caster._doubleHeal = true;
            }
            if (rd.effect === 'shadowmourne' && dmg > 0) {
                if (!caster._shadowmourneCounters) caster._shadowmourneCounters = 0;
                caster._shadowmourneCounters++;
                var smC = caster._shadowmourneCounters;
                dmg += 3 + smC;
                caster.charges = Math.min(20, (caster.charges || 0) + smC);
                if (smC >= 10 && isAoeOrMt) {
                    dmg *= 2;
                    addLog('💀 Shadowmourne: ' + smC + ' contadores — daño AOE/MT DOBLE (' + dmg + ' total), +' + smC + ' cargas', 'buff');
                } else {
                    addLog('💀 Shadowmourne: ' + smC + ' contador(es) — +' + (3 + smC) + ' daño, +' + smC + ' cargas', 'buff');
                }
            }
            // NOTA: Espada Nichirin Negra ya NO se calcula aquí — ahora vive de forma genérica
            // dentro de applyDamageWithShield (summons.js), que estas 32 habilidades ya llaman
            // directamente, así que aplica igual sin necesidad de duplicarlo aquí (evita doble-doblar
            // el daño). De paso, esto también arregla que los Orcos nunca aplicaban la Quemadura
            // Solar en sí — solo tenían el bono de daño, ahora tienen el efecto completo.
        });
        return Math.max(0, Math.floor(dmg));
    }

    // ══════════════════════════════════════════════════════════════════════
    // CREACIÓN DE PERSONAJE ENEMIGO (a partir de HORDA_CHARACTER_DATA)
    // ══════════════════════════════════════════════════════════════════════
    // Construye SOLO los datos del personaje (sin tocar gameState) — se usa para inyectar
    // el Orco en el objeto `selectedChars` ANTES de llamar a initGame, para que quede
    // incluido correctamente en gameState.characters y en el orden de turnos.
    window.hordaBuildEnemyCharacterData = function (orcType) {
        var tmpl = window.HORDA_CHARACTER_DATA[orcType];
        if (!tmpl) { console.error('[HORDA] Tipo de Orco desconocido:', orcType); return null; }
        var ch = {
            name: orcType,
            hp: tmpl.hp, maxHp: tmpl.maxHp, speed: tmpl.speed, charges: 0,
            statusEffects: [], shield: 0, shieldEffect: null, isDead: false,
            portrait: tmpl.portrait,
            passive: { name: tmpl.passive.name, description: tmpl.passive.description },
            abilities: tmpl.abilities.map(function (a) { return Object.assign({}, a); }),
            isHordaOrc: true, hordaOrcType: orcType
        };
        if (tmpl.passive.name === 'Rugido Provocador') {
            ch.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
        }
        return ch;
    };

    window.hordaCreateEnemyCharacter = function (orcType, uniqueName, team) {
        var ch = window.hordaBuildEnemyCharacterData(orcType);
        if (!ch) return null;
        ch.name = uniqueName || orcType;
        ch.team = team;
        gameState.characters[ch.name] = ch;
        return ch;
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: AL RECIBIR DAÑO
    // (Agresion / Alto Orco, Rugido Provocador / Orco Gigante, Fuerza descomunal / Titan)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnDamageReceived = function (targetName, realDmg, attackerName) {
        var target = gameState.characters[targetName];
        if (!target || target.isDead) return;

        // AGRESION (Alto Orco): cada vez que un aliado "Orco" recibe daño, TODOS los Alto Orco
        // de ese equipo con esta pasiva generan 2 cargas.
        if (isOrcName(targetName)) {
            passiveHolders(target.team, 'Agresion').forEach(function (n) {
                grantCharges(n, 2);
            });
        }

        // RUGIDO PROVOCADOR (Orco Gigante): al recibir daño, Escudo 5HP a 3 aliados aleatorios (incluyéndolo)
        if (target.passive && target.passive.name === 'Rugido Provocador') {
            var allies = aliveOnTeam(target.team);
            var pool = allies.slice();
            var chosen = [];
            for (var i = 0; i < 3 && pool.length; i++) {
                var idx = Math.floor(Math.random() * pool.length);
                chosen.push(pool.splice(idx, 1)[0]);
            }
            chosen.forEach(function (n) {
                if (typeof applyShield === 'function') applyShield(n, 5);
            });
            addLog('🛡️ Rugido Provocador: Escudo 5HP a ' + chosen.join(', '), 'buff');
        }

        // FUERZA DESCOMUNAL (Orco Titan): la PRIMERA vez por ronda que recibe daño → Mega Provocación 1T + Armadura 1T
        if (target.passive && target.passive.name === 'Fuerza descomunal' && !target._hordaTitanHitThisRound) {
            target._hordaTitanHitThisRound = true;
            if (typeof applyBuff === 'function') {
                applyBuff(targetName, { name: 'Mega Provocacion', type: 'buff', duration: 1, emoji: '🌑' });
                applyBuff(targetName, { name: 'Armadura', type: 'buff', duration: 1, emoji: '🪖' });
            }
            addLog('🗿 Fuerza descomunal: ' + targetName + ' recibe Mega Provocación + Armadura (1er golpe de la ronda)', 'buff');
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: AL MORIR UN PERSONAJE
    // (Sed de Sangre / Orco de Elite, Aniquilacion / General de la Horda)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnCharacterDeath = function (deadName) {
        var dead = gameState.characters[deadName];
        if (!dead) return;
        var team = dead.team;

        // SED DE SANGRE (Orco de Elite): cada vez que un Orco (de su equipo) es eliminado →
        // el/los Orco(s) de Elite ganan 1 turno extra y 8 cargas.
        if (isOrcName(deadName)) {
            passiveHolders(team, 'Sed de Sangre').forEach(function (n) {
                if (n === deadName) return;
                grantCharges(n, 8);
                grantExtraTurn(n);
                addLog('🩸 Sed de Sangre: ' + n + ' gana turno extra y 8 cargas (murió ' + deadName + ')', 'buff');
            });
        }

        // ANIQUILACION (General de la Horda): 50% de sustituir la tarjeta del aliado eliminado
        // por la de un Orco aleatorio vivo (100% HP, 0 cargas) — no aumenta el tamaño del equipo.
        passiveHolders(team, 'Aniquilacion').forEach(function (generalName) {
            if (generalName === deadName) return; // el propio General no se sustituye a sí mismo aquí
            if (Math.random() >= 0.5) return;
            var types = Object.keys(window.HORDA_CHARACTER_DATA || {}).filter(function (t) { return t !== 'Kargalgan'; }); // Kargalgan nunca puede "aparecer" reviviendo otra tarjeta
            var newType = randomFrom(types);
            if (!newType) return;
            var tmpl = window.HORDA_CHARACTER_DATA[newType];
            // Sustituir la tarjeta: mismo "slot" (nombre), nuevos datos completos
            dead.name = deadName; // conserva el nombre/slot para no romper turnOrder/UI
            dead.hp = tmpl.hp; dead.maxHp = tmpl.maxHp; dead.speed = tmpl.speed;
            dead.charges = 0; dead.statusEffects = [];
            dead.isDead = false; dead.shield = 0; dead.shieldEffect = null;
            dead.portrait = tmpl.portrait;
            dead.passive = { name: tmpl.passive.name, description: tmpl.passive.description };
            dead.abilities = tmpl.abilities.map(function (a) { return Object.assign({}, a); });
            dead.isHordaOrc = true; dead.hordaOrcType = newType;
            if (tmpl.passive.name === 'Rugido Provocador') {
                dead.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
            }
            addLog('👑 Aniquilacion: la tarjeta de ' + deadName + ' es sustituida por un ' + newType + ' (100% HP)', 'buff');
            if (typeof renderCharacters === 'function') renderCharacters();
            if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(deadName);
        });

        // DESTREZA DE LOS HUARGOS: al morir, elimina todos los buffs activos del equipo enemigo.
        if (dead.passive && dead.passive.name === 'Destreza de los Huargos') {
            var enemyTeam2 = enemyTeamOf(team);
            var cleared = 0;
            aliveOnTeam(enemyTeam2).forEach(function (n) {
                var c = gameState.characters[n];
                if (!c || !c.statusEffects) return;
                var before = c.statusEffects.length;
                c.statusEffects = c.statusEffects.filter(function (e) { return !e || e.type !== 'buff' || e.permanent; });
                cleared += before - c.statusEffects.length;
            });
            addLog('🐺 Destreza de los Huargos: al morir ' + deadName + ', se eliminan ' + cleared + ' buff(s) del equipo enemigo', 'debuff');
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: INICIO DE RONDA (Orco Titan — reset del flag de "primer golpe")
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnRoundStart = function () {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (c) c._hordaTitanHitThisRound = false;
        });

        // DESTREZA DE LOS HUARGOS: al inicio de la ronda, la velocidad del portador
        // se incrementa en la misma cantidad que la velocidad del enemigo con MÁS velocidad.
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0 || !c.passive || c.passive.name !== 'Destreza de los Huargos') return;
            var enemyTeam = enemyTeamOf(c.team);
            var enemies = aliveOnTeam(enemyTeam).map(function (en) { return gameState.characters[en]; }).filter(Boolean);
            if (!enemies.length) return;
            var maxEnemySpeed = Math.max.apply(null, enemies.map(function (e) { return e.speed || 0; }));
            if (maxEnemySpeed > 0) {
                c.speed = (c.speed || 0) + maxEnemySpeed;
                addLog('🐺 Destreza de los Huargos: ' + n + ' +' + maxEnemySpeed + ' velocidad (igual al enemigo más rápido)', 'buff');
            }
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: FIN DE RONDA
    // (Warmasters, Fuerza descomunal, Artes de la Sangre Oscura)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnRoundEnd = function () {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0) return;

            // WARMASTERS: al final de cada ronda, disipa sus propios debuffs y recupera 5 HP
            if (c.passive && c.passive.name === 'Warmasters') {
                var hadDebuffs = (c.statusEffects || []).some(function (e) { return e && e.type === 'debuff'; });
                c.statusEffects = (c.statusEffects || []).filter(function (e) { return !e || e.type !== 'debuff'; });
                c.hp = Math.min(c.maxHp, (c.hp || 0) + 5);
                if (hadDebuffs) addLog('⚔️ Warmasters: ' + n + ' disipa sus debuffs y recupera 5 HP', 'heal');
                else addLog('⚔️ Warmasters: ' + n + ' recupera 5 HP', 'heal');
            }

            // FUERZA DESCOMUNAL (Orco Titan): al final de cada ronda, +2 daño de básico a todos sus aliados (acumulable)
            if (c.passive && c.passive.name === 'Fuerza descomunal') {
                aliveOnTeam(c.team).forEach(function (an) {
                    var ac = gameState.characters[an];
                    if (!ac) return;
                    ac._hordaBasicDmgBonus = (ac._hordaBasicDmgBonus || 0) + 2;
                });
                addLog('🗿 Fuerza descomunal: todo el equipo de ' + n + ' gana +2 daño de ataque básico', 'buff');
            }
        });

        // ARTES DE LA SANGRE OSCURA (Orco Arcano): cada vez que un Buff expira en el equipo
        // ENEMIGO (del Arcano), genera 3 cargas. Aproximación: se revisan los buffs con 1 turno
        // de duración restante justo antes de que expiren en este fin de ronda.
        Object.keys(gameState.characters).forEach(function (n) {
            var arcano = gameState.characters[n];
            if (!arcano || arcano.isDead || !arcano.passive || arcano.passive.name !== 'Artes de la Sangre Oscura') return;
            var enemyTeam = enemyTeamOf(arcano.team);
            var expiredCount = 0;
            aliveOnTeam(enemyTeam).forEach(function (en) {
                var ec = gameState.characters[en];
                if (!ec || !ec.statusEffects) return;
                ec.statusEffects.forEach(function (e) {
                    if (e && e.type === 'buff' && !e.permanent && (e.duration || 0) <= 1) expiredCount++;
                });
            });
            if (expiredCount > 0) {
                grantCharges(n, 3 * expiredCount);
                addLog('🩸 Artes de la Sangre Oscura: ' + n + ' genera ' + (3 * expiredCount) + ' cargas (' + expiredCount + ' buffs enemigos expiraron)', 'buff');
            }
        });

        // HIMNO DE LA HORDA (Kargalgan): al final de cada ronda, revive a UN aliado
        // muerto al azar con 100% HP y 20 cargas. Kargalgan mismo nunca es candidato
        // (no puede ser revivido por nada, ni siquiera por su propia pasiva).
        Object.keys(gameState.characters).forEach(function (n) {
            var karg = gameState.characters[n];
            if (!karg || karg.isDead || karg.hp <= 0 || !karg.passive || karg.passive.name !== 'Himno de la Horda') return;
            var deadAllies = Object.keys(gameState.characters).filter(function (dn) {
                var dc = gameState.characters[dn];
                return dc && dc.team === karg.team && dc.isDead && dn.indexOf('Kargalgan') !== 0;
            });
            if (!deadAllies.length) return;
            var chosen = randomFrom(deadAllies);
            var rc = gameState.characters[chosen];
            rc.isDead = false;
            rc.hp = rc.maxHp;
            rc.charges = 20;
            addLog('🎵 Himno de la Horda: ' + n + ' revive a ' + chosen + ' con 100% HP y 20 cargas', 'heal');
            if (typeof renderCharacters === 'function') renderCharacters();
            if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(chosen);
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: UN ENEMIGO EJECUTA UN ESPECIAL (Sed de Sangre / Orco de Elite, Himno de la Horda / Kargalgan)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnEnemySpecialUsed = function (actorName) {
        var actor = gameState.characters[actorName];
        if (!actor) return;
        var enemyTeam = enemyTeamOf(actor.team);
        passiveHolders(enemyTeam, 'Sed de Sangre').forEach(function (n) {
            grantExtraTurn(n);
            if (typeof applyFrenesi === 'function') applyFrenesi(n, 2);
            addLog('🩸 Sed de Sangre: ' + n + ' gana turno extra y Frenesí 2T (' + actorName + ' usó un especial)', 'buff');
        });

        // HIMNO DE LA HORDA (Kargalgan): cada vez que un enemigo (del punto de vista de
        // Kargalgan) ejecuta un ataque ESPECIAL, aplica Quemaduras sobre un enemigo aleatorio
        // por una cantidad de HP igual al 10% de la suma del HP actual de todo su equipo (el
        // equipo enemigo desde la perspectiva de Kargalgan, es decir, el mismo equipo de quien
        // ejecutó el especial).
        passiveHolders(enemyTeam, 'Himno de la Horda').forEach(function (n) {
            var karg = gameState.characters[n];
            if (!karg) return;
            var kargEnemyTeam = enemyTeamOf(karg.team); // = actor.team
            var totalHp = 0;
            aliveOnTeam(kargEnemyTeam).forEach(function (en) { var ec = gameState.characters[en]; if (ec) totalHp += (ec.hp || 0); });
            var burnAmount = Math.max(1, Math.floor(totalHp * 0.10));
            var targets = aliveOnTeam(kargEnemyTeam);
            if (!targets.length) return;
            var tgt = randomFrom(targets);
            if (typeof applyBurn === 'function') applyBurn(tgt, burnAmount, 2);
            addLog('🎵 Himno de la Horda: ' + n + ' aplica Quemaduras (' + burnAmount + ' HP) a ' + tgt + ' (' + actorName + ' usó un especial)', 'debuff');
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: UN ENEMIGO EJECUTA UN OVER (Himno de la Horda / Kargalgan)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnEnemyOverUsed = function (actorName) {
        var actor = gameState.characters[actorName];
        if (!actor) return;
        var enemyTeam = enemyTeamOf(actor.team);
        passiveHolders(enemyTeam, 'Himno de la Horda').forEach(function (n) {
            var karg = gameState.characters[n];
            if (!karg || karg.isDead || karg.hp <= 0) return;
            var overAb = (karg.abilities || []).find(function (a) { return a && a.type === 'over'; });
            if (!overAb) return;
            addLog('🎵 Himno de la Horda: ' + n + ' ejecuta su Over (' + actorName + ' ejecutó un Over)', 'buff');
            var enemiesNow = aliveOnTeam(enemyTeamOf(karg.team));
            window.hordaExecuteAbility(overAb, n, randomFrom(enemiesNow), karg, overAb.damage);
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: DETECCIÓN DE CARGAS POR EFECTO (Warmasters — turno extra)
    // ══════════════════════════════════════════════════════════════════════
    window.hordaCheckWarmasterExtraTurn = function () {
        var snap = window._hordaChargeSnapshot;
        if (!snap) return;
        var actor = window._hordaChargeSnapshotActor;
        var actorGain = window._hordaChargeSnapshotActorGain || 0;
        var actorChar = gameState.characters[actor];
        if (!actorChar) { window._hordaChargeSnapshot = null; return; }

        var effectGenerated = false;
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            var before = snap[n] || 0;
            var after = c.charges || 0;
            var delta = after - before;
            if (delta <= 0) return;
            if (n === actor) {
                if (delta > actorGain) effectGenerated = true; // exceso sobre la ganancia normal del movimiento
            } else {
                effectGenerated = true; // cualquier ganancia en alguien que no es el actor viene de un efecto
            }
        });
        window._hordaChargeSnapshot = null;

        if (!effectGenerated) return;
        var enemyTeam = enemyTeamOf(actorChar.team);
        passiveHolders(enemyTeam, 'Warmasters').forEach(function (n) {
            grantExtraTurn(n);
            addLog('⚔️ Warmasters: ' + n + ' gana turno extra (' + actor + ' generó cargas por efecto)', 'buff');
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HABILIDADES — funciones núcleo reutilizables (se llaman desde el dispatcher
    // y también desde los movimientos "meta" que reejecutan otros movimientos)
    // ══════════════════════════════════════════════════════════════════════

    // ── ORCO ──
    function ability_orcoBasic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var dmg = 2 + (caster._hordaBasicDmgBonus || 0);
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyBleed === 'function') applyBleed(targetName, 1);
        generateChargesInline(casterName, 2);
        addLog('🪓 Tajo Sucio: ' + casterName + ' causa ' + dmg + ' daño y Sangrado 1T a ' + targetName, 'damage');
    }
    function ability_orcoSpecial1(casterName, targetName) {
        var dmg = hordaComputeRelicDamage(casterName, targetName, 4, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyStun === 'function') applyStun(targetName, 1);
        addLog('🦶 Pisotón Tembloroso: ' + casterName + ' causa ' + dmg + ' daño y Aturdimiento a ' + targetName, 'damage');
    }
    function ability_orcoSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        var debuffCount = 0;
        enemies.forEach(function (n) {
            var c = gameState.characters[n];
            debuffCount += (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff'; }).length;
        });
        var baseDmg = 4 + debuffCount;
        enemies.forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, baseDmg, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        addLog('🪨 Lanzamiento de Peñasco: ' + baseDmg + ' daño AOE (' + debuffCount + ' debuffs activos en el enemigo)', 'damage');
    }
    function ability_orcoOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var sacrificed = Math.ceil(caster.hp * 0.5);
        caster.hp = Math.max(1, caster.hp - sacrificed);
        addLog('🔥 Furia de la Horda: ' + casterName + ' sacrifica ' + sacrificed + ' HP', 'damage');
        var orcs = orcAlliesOf(caster.team);
        var enemyTeam = enemyTeamOf(caster.team);
        orcs.forEach(function (orcName) {
            var enemies = aliveOnTeam(enemyTeam);
            if (!enemies.length) return;
            var tgt = randomFrom(enemies);
            if (Math.random() < 0.5) ability_orcoBasic(orcName, tgt);
            else ability_orcoSpecial1(orcName, tgt);
        });
    }

    // ── ALTO ORCO ──
    function orcAlliesOfDead(team) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.team === team && c.isDead && isOrcName(n);
        }).length;
    }
    function ability_altoOrcoBasic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var deadOrcs = orcAlliesOfDead(caster.team);
        var dmg = 2 + deadOrcs + (caster._hordaBasicDmgBonus || 0);
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyBleed === 'function') applyBleed(targetName, 1);
        generateChargesInline(casterName, 1);
        addLog('⚔️ Mandoble de Hierro: ' + casterName + ' causa ' + dmg + ' daño y Sangrado 1T a ' + targetName, 'damage');
    }
    function ability_altoOrcoSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) {
            if (typeof applyBuff === 'function') applyBuff(n, { name: 'Armadura', type: 'buff', duration: 2, emoji: '🪖' });
            if (typeof applyFrenesi === 'function') applyFrenesi(n, 2);
        });
        addLog('📣 Grito de Mandato: Armadura + Frenesí 2T a todo el equipo', 'buff');
    }
    function ability_altoOrcoSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            var hasBleed = (c.statusEffects || []).some(function (e) { return e && (normAccent(e.name || '') === 'sangrado' || normAccent(e.name || '') === 'hemorragia'); });
            var dmg = hasBleed ? 8 : 4; // "golpe crítico" ≈ daño doble
            dmg = hordaComputeRelicDamage(casterName, n, dmg, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            if (typeof applyWeaken === 'function') applyWeaken(n, 3);
        });
        addLog('🌀 Torbellino de Sangre: 4 daño AOE (crítico a enemigos con Sangrado/Hemorragia) + Debilitar 3T', 'damage');
    }
    function ability_altoOrcoOver(casterName, targetName) {
        var crit = Math.random() < 0.5;
        var dmg = crit ? 20 : 10;
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'over', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('🔪 Guillotina de Hierro: ' + dmg + ' daño a ' + targetName + (crit ? ' (¡CRÍTICO!)' : ''), 'damage');
        // Aplicar Sangrado 2 turnos al objetivo
        var tgt = gameState.characters[targetName];
        if (tgt && !tgt.isDead && tgt.hp > 0) {
            if (typeof applyBleed === 'function') applyBleed(targetName, 2);
            addLog('🔪 Guillotina de Hierro: Sangrado 2T aplicado a ' + targetName, 'debuff');
        }
        if (crit) {
            var caster = gameState.characters[casterName];
            if (caster) {
                aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 10); });
                addLog('🔪 Guillotina de Hierro: ¡crítico! Todo el equipo genera 10 cargas', 'buff');
            }
        }
    }

    // ── ORCO GIGANTE ──
    function ability_giganteBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var totalDmg = 0;
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var triple = Math.random() < 0.5;
            var dmg = (1 + (caster._hordaBasicDmgBonus || 0)) * (triple ? 3 : 1);
            dmg = hordaComputeRelicDamage(casterName, n, dmg, 'basic', true);
            applyDamageWithShield(n, dmg, casterName);
            totalDmg += dmg;
        });
        if (totalDmg > 0 && typeof applyShield === 'function') applyShield(casterName, totalDmg);
        generateChargesInline(casterName, 2);
        addLog('👊 Manotazo Aplastante: daño AOE (50% triple) — ' + casterName + ' gana Escudo por ' + totalDmg + ' (el total de daño causado)', 'damage');
    }
    function ability_giganteSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var totalStolen = 0;
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 2, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            totalStolen += dmg;
        });
        caster.hp = Math.min(caster.maxHp, caster.hp + totalStolen);
        addLog('🌊 Ondas sísmicas: 2 daño AOE, ' + casterName + ' roba ' + totalStolen + ' HP en total', 'damage');
    }
    function ability_giganteSpecial2(casterName, targetName) {
        var caster = gameState.characters[casterName];
        var target = gameState.characters[targetName];
        var dmg = hordaComputeRelicDamage(casterName, targetName, 4, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (!target) return;
        var buffs = (target.statusEffects || []).filter(function (e) { return e && e.type === 'buff'; });
        var count = buffs.length;
        target.statusEffects = (target.statusEffects || []).filter(function (e) { return !e || e.type !== 'buff'; });
        if (count > 0 && caster) {
            aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 3 * count); });
        }
        addLog('🦶 Pisotón de Demolición: ' + dmg + ' daño + disipa ' + count + ' buffs (equipo genera ' + (3 * count) + ' cargas c/u)', 'damage');
    }
    function ability_giganteOver(casterName, targetName) {
        var caster = gameState.characters[casterName];
        var dmg = 3 + Math.floor(Math.random() * 8); // 3-10
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'over', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (caster && typeof applyHeal === 'function') {
            aliveOnTeam(caster.team).forEach(function (n) { applyHeal(n, dmg); });
        }
        addLog('💥 Brutalidad: ' + dmg + ' daño a ' + targetName + ' — todo el equipo se cura ' + dmg + ' HP', 'damage');
    }

    // ── ORCO DE ELITE ──
    function ability_eliteBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        for (var i = 0; i < 3; i++) {
            var enemies = aliveOnTeam(enemyTeam);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var dmg = 2 + (caster._hordaBasicDmgBonus || 0);
            dmg = hordaComputeRelicDamage(casterName, tgt, dmg, 'basic', false);
            applyDamageWithShield(tgt, dmg, casterName);
            var appliedAny = false;
            if (Math.random() < 0.5) { applyBleed(tgt, 1); appliedAny = true; }
            if (Math.random() < 0.5) { applyWeaken(tgt, 1); appliedAny = true; }
            if (Math.random() < 0.5) { applyStun(tgt, 1); appliedAny = true; }
            if (appliedAny) grantCharges(casterName, 1); // Sed de Sangre: +1 carga por debuff aplicado al atacar
        }
        generateChargesInline(casterName, 2);
        addLog('🗡️ Estocada Brutal: ' + casterName + ' golpea 3 veces al azar', 'damage');
    }
    function ability_eliteSpecial1(casterName, targetName) {
        var target = gameState.characters[targetName];
        if (!target) return;
        // Nuevo efecto: daño = 25% del HP actual del enemigo con MAYOR HP
        var casterChar = gameState.characters[casterName];
        var enemyTeam = casterChar ? enemyTeamOf(casterChar.team) : null;
        var maxHpEnemy = 0;
        if (enemyTeam) {
            aliveOnTeam(enemyTeam).forEach(function(n) {
                var c = gameState.characters[n];
                if (c && (c.hp||0) > maxHpEnemy) maxHpEnemy = c.hp;
            });
        }
        var dmg = Math.max(1, Math.floor(maxHpEnemy * 0.25));
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('💢 Rompeguardias: ' + dmg + ' daño a ' + targetName + ' (25% del HP del enemigo más fuerte: ' + maxHpEnemy + ' HP)', 'damage');
    }
    function ability_eliteSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var buffRolls = [
            { name: 'Armadura', emoji: '🪖' }, { name: 'Escudo', emoji: '🛡️', shield: 10 },
            { name: 'Infectar', emoji: '☣️' }, { name: 'Aura Oscura', emoji: '🖤' },
            { name: 'Aura de Fuego', emoji: '🔥' }, { name: 'Frenesi', emoji: '⚡' }, { name: 'Esquivar', emoji: '💨' }
        ];
        var applied = 0;
        buffRolls.forEach(function (b) {
            if (Math.random() >= 0.5) return;
            applied++;
            if (b.name === 'Frenesi' && typeof applyFrenesi === 'function') applyFrenesi(casterName, 2);
            else if (b.name === 'Escudo' && typeof applyShield === 'function') applyShield(casterName, 10);
            else if (typeof applyBuff === 'function') applyBuff(casterName, { name: b.name, type: 'buff', duration: 2, emoji: b.emoji });
        });
        addLog('🌪️ Carga de la Horda: ' + applied + ' buffs aplicados a ' + casterName, 'buff');
        for (var i = 0; i < applied; i++) {
            ability_eliteBasic(casterName);
        }
    }
    function ability_eliteOver(casterName, targetName) {
        var crit = Math.random() < 0.5;
        var triple = Math.random() < 0.5;
        var dmg = 5 * (crit ? 2 : 1) * (triple ? 3 : 1);
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'over', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('☠️ Aniquilacion Sangrienta: ' + dmg + ' daño a ' + targetName + (crit ? ' (crítico)' : '') + (triple ? ' (triple)' : ''), 'damage');
    }

    // ── ORCO ARCANO ──
    function ability_arcanoBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var myDebuffed = aliveOnTeam(caster.team).filter(function (n) {
            return (gameState.characters[n].statusEffects || []).some(function (e) { return e && e.type === 'debuff'; });
        });
        for (var i = 0; i < 3 && myDebuffed.length; i++) {
            var n = myDebuffed[Math.floor(Math.random() * myDebuffed.length)];
            var c = gameState.characters[n];
            var idx = (c.statusEffects || []).findIndex(function (e) { return e && e.type === 'debuff'; });
            if (idx !== -1) c.statusEffects.splice(idx, 1);
        }
        var lowest = aliveOnTeam(caster.team).sort(function (a, b) { return gameState.characters[a].hp - gameState.characters[b].hp; })[0];
        if (lowest && typeof applyHeal === 'function') applyHeal(lowest, 2);
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        if (enemies.length) applyWeaken(randomFrom(enemies), 2);
        generateChargesInline(casterName, 2);
        addLog('🩸 Runa de Sangre Oscura: limpia debuffs propios, cura al aliado con menos HP, Debilitar a un enemigo', 'buff');
    }
    function ability_arcanoSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var totalStolen = 0;
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 1, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            var c = gameState.characters[n];
            var stolen = Math.min(3, c.charges || 0);
            c.charges = Math.max(0, (c.charges || 0) - stolen);
            totalStolen += stolen;
        });
        var allies = aliveOnTeam(caster.team);
        if (allies.length && totalStolen > 0) grantCharges(randomFrom(allies), totalStolen);
        addLog('🩸 Maldición de la Sangre: roba ' + totalStolen + ' cargas del equipo enemigo en total', 'damage');
    }
    function ability_arcanoSpecial2(casterName, targetName) {
        var dmg = hordaComputeRelicDamage(casterName, targetName, 4, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyWeaken === 'function') applyWeaken(targetName, 2);
        if (typeof applyConfusion === 'function') applyConfusion(targetName, 2);
        var caster = gameState.characters[casterName];
        var orcs = caster ? orcAlliesOf(caster.team) : [];
        if (orcs.length) grantExtraTurn(randomFrom(orcs));
        addLog('🔮 Hechizo de Sangre Arcana: Debilitar 2T + Confusión 2T a ' + targetName + ', un Orco aliado gana turno extra', 'debuff');
    }
    function ability_arcanoOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) { if (n !== casterName) grantCharges(n, 5); });
        var dead = Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            // Kargalgan (Himno de la Horda) nunca puede ser revivido, ni por esta habilidad ni por ninguna otra
            return c && c.team === caster.team && c.isDead && n.indexOf('Kargalgan') !== 0;
        });
        addLog('💀 Magia de Muerte: equipo genera 5 cargas', 'buff');
        if (dead.length) {
            var revived = randomFrom(dead);
            var rc = gameState.characters[revived];
            rc.isDead = false;
            rc.hp = Math.max(1, Math.floor(rc.maxHp * 0.5));
            rc.charges = 5;
            grantExtraTurn(revived);
            addLog('💀 Magia de Muerte: ' + revived + ' revive con 50% HP, 5 cargas y turno adicional', 'buff');
            if (typeof renderCharacters === 'function') renderCharacters();
            if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(revived);
        }
    }

    // ── GENERAL DE LA HORDA ──
    function ability_generalBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) {
            if (typeof applyBuff === 'function') applyBuff(n, { name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '🛡️✨' });
            grantCharges(n, 1);
        });
        addLog('📯 Rugido de Reagrupación: Protección Sagrada 2T + 1 carga a todo el equipo', 'buff');
    }
    function ability_generalSpecial1(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var allies = aliveOnTeam(caster.team);
        allies.forEach(function (n) {
            var c = gameState.characters[n];
            var basicAb = (c.abilities || []).find(function (a) { return a.type === 'basic'; });
            if (!basicAb) return;
            var dmg = (basicAb.damage || 0) + (c._hordaBasicDmgBonus || 0);
            dmg = hordaComputeRelicDamage(n, targetName, dmg, 'basic', false);
            if (dmg > 0) applyDamageWithShield(targetName, dmg, n);
            if (basicAb.chargeGain) generateChargesInline(n, basicAb.chargeGain);
        });
        var _genDmg = hordaComputeRelicDamage(casterName, targetName, 3, 'special', false);
        applyDamageWithShield(targetName, _genDmg, casterName);
        var target = gameState.characters[targetName];
        if (target && (target.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'provocacion'; })) {
            target.hp = Math.max(0, Math.floor(target.hp * 0.5));
            addLog('⚔️ Ejecución de la Horda: ' + targetName + ' tenía Provocación — pierde 50% de su HP actual', 'damage');
        }
        addLog('⚔️ Ejecución de la Horda: todos los aliados atacan a ' + targetName + ' con su básico', 'damage');
    }
    function ability_generalSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var totalDisipados = 0;
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 3, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            var c = gameState.characters[n];
            var buffs = (c.statusEffects || []).filter(function (e) { return e && e.type === 'buff'; });
            totalDisipados += buffs.length;
            c.statusEffects = (c.statusEffects || []).filter(function (e) { return !e || e.type !== 'buff'; });
        });
        if (totalDisipados > 0) {
            aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 2 * totalDisipados); });
        }
        addLog('🚩 Carga del Estandarte: 3 daño AOE, disipa ' + totalDisipados + ' buffs enemigos', 'damage');
    }
    function ability_generalOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var allies = aliveOnTeam(caster.team).filter(function (n) { return n !== casterName; });
        var sacrificed = randomFrom(allies);
        if (sacrificed) {
            var _sacHp = gameState.characters[sacrificed].hp;
            applyDamageWithShield(sacrificed, _sacHp, casterName);
            addLog('🏳️ Marcha de la Victoria: ' + sacrificed + ' es sacrificado', 'damage');
        }
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        enemies.forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 5, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        var remaining = aliveOnTeam(caster.team).filter(function (n) { return n !== casterName; });
        remaining.forEach(function (n) {
            var c = gameState.characters[n];
            var overAb = (c.abilities || []).find(function (a) { return a.type === 'over'; });
            if (!overAb) return;
            var enemiesNow = aliveOnTeam(enemyTeam);
            if (!enemiesNow.length) return;
            if (overAb.effect && overAb.effect.indexOf('horda_') === 0 && typeof window.hordaExecuteAbility === 'function') {
                window.hordaExecuteAbility(overAb, n, randomFrom(enemiesNow), c, overAb.damage);
            }
        });
        addLog('🏳️ Marcha de la Victoria: 5 daño AOE, todos los aliados restantes ejecutan su Over', 'damage');
    }

    // ── WARMASTER ──
    function ability_warmasterBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var dmg = 3 + (caster._hordaBasicDmgBonus || 0);
        for (var i = 0; i < 3; i++) {
            var enemies = aliveOnTeam(enemyTeam);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var crit = Math.random() < 0.5;
            var hitDmg = dmg * (crit ? 2 : 1);
            hitDmg = hordaComputeRelicDamage(casterName, tgt, hitDmg, 'basic', false);
            applyDamageWithShield(tgt, hitDmg, casterName);
            if (crit) dmg += 1;
        }
        generateChargesInline(casterName, 1);
        addLog('💃 Danza de Sangre y Muerte: ' + casterName + ' golpea 3 veces al azar', 'damage');
    }
    function ability_warmasterSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var eliminated = Object.keys(gameState.summons || {}).length;
        Object.keys(gameState.summons || {}).forEach(function (sid) { delete gameState.summons[sid]; });
        var dmg = 4 + 5 * eliminated;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var hitDmg = hordaComputeRelicDamage(casterName, n, dmg, 'special', true);
            applyDamageWithShield(n, hitDmg, casterName);
        });
        addLog('🌪️ Furia de la Horda: elimina ' + eliminated + ' invocaciones, ' + dmg + ' daño AOE', 'damage');
    }
    function ability_warmasterSpecial2(casterName, targetName) {
        var target = gameState.characters[targetName];
        if (!target) return;
        var hpPct = target.hp / (target.maxHp || 1);
        var mult = hpPct >= 0.5 ? 3 : 1;
        var baseDmg = target._hordaWarmasterLanceBase || 5;
        var dmg = baseDmg * mult;
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'special', false);
        // Ignora Escudo/Reflejar/Escudo Sagrado: aplicar directo al HP, no vía applyDamageWithShield (que respeta escudo)
        target.hp = Math.max(0, target.hp - dmg);
        addLog('🗡️ Lanza de Oscuridad perforadora: ' + dmg + ' daño directo a ' + targetName + ' (ignora Escudo/Reflejar/Escudo Sagrado)', 'damage');
        var hasDebuff = (target.statusEffects || []).some(function (e) { return e && e.type === 'debuff'; });
        if (hasDebuff) {
            target._hordaWarmasterLanceBase = baseDmg * 2;
            addLog('🗡️ Lanza de Oscuridad perforadora: objetivo con debuff — el daño base de este movimiento se duplica permanentemente', 'damage');
        }
        if (target.hp <= 0 && !target.isDead) {
            // Este movimiento ignora Escudo/Reflejar/Escudo Sagrado a propósito, así que no puede
            // pasar por applyDamageWithShield para registrar la muerte (ya tiene el HP en 0, no
            // detectaría la transición). Se replican a mano los pasos esenciales de "murió":
            // marcar como muerto, registrar el kill (dispara pasivas de "al morir" como Sabiduría
            // Antigua o Estratega de Odin) y revisar fin de partida — si no, la partida se queda
            // trabada creyendo que sigue en curso aunque ya no queden enemigos vivos.
            target.isDead = true;
            if (typeof registerKill === 'function') registerKill(casterName, targetName, false);
            if (typeof checkGameOver === 'function') checkGameOver();
            if (typeof renderCharacters === 'function') renderCharacters();
        }
    }
    function ability_warmasterOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        var count = 0;
        enemies.forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 10, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
            if (typeof applyStun === 'function') applyStun(n, 2);
            count++;
        });
        if (count > 0) aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 3 * count); });
        addLog('👹 Rugido de los Titanes: Mega Aturdimiento a todos los enemigos, equipo genera ' + (3 * count) + ' cargas c/u', 'damage');
    }

    // ── ORCO TITAN ──
    function ability_titanBasic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var dmg = 4 + (caster._hordaBasicDmgBonus || 0);
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyStun === 'function') applyStun(targetName, 2);
        generateChargesInline(casterName, 2);
        addLog('👊 Impacto Colosal: ' + dmg + ' daño y Mega Aturdimiento a ' + targetName, 'damage');
    }
    function ability_titanSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            var hadStun = (c.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'aturdimiento'; });
            var dmg = 3 + (hadStun ? 7 : 0);
            dmg = hordaComputeRelicDamage(casterName, n, dmg, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            if (typeof applyStun === 'function') applyStun(n, 1);
        });
        addLog('🌍 Choque Sismico: daño AOE + Aturdimiento (+7 extra a quien ya lo tenía)', 'damage');
    }
    function ability_titanSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            var debuffCount = (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff'; }).length;
            for (var i = 0; i < debuffCount; i++) {
                if (gameState.characters[n] && !gameState.characters[n].isDead) ability_titanBasic(casterName, n);
            }
        });
        addLog('💢 Furia de Titanes: golpea a cada enemigo una vez por cada debuff activo, con Impacto Colosal', 'damage');
    }
    function ability_titanOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            // Daño base: entre 5 y 20
            var dmg = 5 + Math.floor(Math.random() * 16);
            // Daño adicional: entre 10% y 50% del HP actual del enemigo golpeado
            var bonusPct = 0.10 + Math.random() * 0.40; // 10% a 50%
            var bonusDmg = Math.max(1, Math.floor((c.hp||0) * bonusPct));
            var totalDmg = dmg + bonusDmg;
            totalDmg = hordaComputeRelicDamage(casterName, n, totalDmg, 'over', true);
            applyDamageWithShield(n, totalDmg, casterName);
            addLog('🌋 Devastación Planetaria: ' + totalDmg + ' daño a ' + n + ' (' + dmg + ' base + ' + bonusDmg + ' = ' + Math.round(bonusPct*100) + '% HP actual)', 'damage');
        });
        addLog('🌋 Devastación Planetaria: AOE 5-20 daño + 10%-50% del HP actual del enemigo', 'damage');
    }

    // ── HUARGOS ──
    function ability_huargosBasic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        // "Cada vez que se realiza este movimiento duplica el daño causado" → daño base x2
        var dmg = (5 + (caster._hordaBasicDmgBonus || 0)) * 2;
        dmg = hordaComputeRelicDamage(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyWeaken === 'function') applyWeaken(targetName, 2);
        generateChargesInline(casterName, 2);
        addLog('🐺 Rabia del Huargo: ' + casterName + ' causa ' + dmg + ' daño (x2) y Debilitar 2T a ' + targetName, 'damage');
    }
    function ability_huargosSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            c.hp = (c.hp || 0) * 2; // duplica el HP ACTUAL (puede superar temporalmente el máximo)
            c.speed = Math.round((c.speed || 80) * 1.5);
        });
        addLog('👁️ Ojos del Terror: ' + casterName + ' duplica el HP actual y +50% velocidad de todo el equipo', 'buff');
        if (typeof renderCharacters === 'function') renderCharacters();
    }
    function ability_huargosSpecial2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var hits = 2 + Math.floor(Math.random() * 4); // 2 a 5
        var totalDmg = 0, actualHits = 0;
        for (var i = 0; i < hits; i++) {
            var enemies = aliveOnTeam(enemyTeam);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var dmg = 5;
            if (Math.random() < 0.20) {
                var c = gameState.characters[tgt];
                dmg += Math.max(1, Math.floor((c.hp || 0) * 0.5));
            }
            dmg = hordaComputeRelicDamage(casterName, tgt, dmg, 'special', false);
            applyDamageWithShield(tgt, dmg, casterName);
            totalDmg += dmg;
            actualHits++;
        }
        addLog('🪓 Hacha Oscura del Verdugo: ' + casterName + ' golpea ' + actualHits + ' veces (' + totalDmg + ' daño total)', 'damage');
    }
    function ability_huargosOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        enemies.forEach(function (n) {
            var dmg = hordaComputeRelicDamage(casterName, n, 5, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        addLog('🌕 Aullido de la Horda: 5 daño AOE', 'damage');
        // +1 daño por cada 2 HP Escudo activo en el equipo enemigo, a un enemigo aleatorio
        var totalShield = 0;
        enemies.forEach(function (n) { var c = gameState.characters[n]; if (c) totalShield += (c.shield || 0); });
        var bonusDmg = Math.floor(totalShield / 2);
        if (bonusDmg > 0) {
            var stillAlive = aliveOnTeam(enemyTeam);
            if (stillAlive.length) {
                var tgt = randomFrom(stillAlive);
                applyDamageWithShield(tgt, bonusDmg, casterName);
                addLog('🌕 Aullido de la Horda: +' + bonusDmg + ' daño adicional a ' + tgt + ' (Escudo del equipo enemigo)', 'damage');
            }
        }
        // 10% de eliminar instantáneamente a cada enemigo con más de 100 HP
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            if (c && !c.isDead && c.hp > 100 && Math.random() < 0.10) {
                c.hp = 0; c.isDead = true;
                addLog('🌕 Aullido de la Horda: ¡' + n + ' eliminado! (más de 100 HP, 10% de probabilidad)', 'damage');
                if (typeof registerKill === 'function') registerKill(casterName, n, false);
                if (typeof checkGameOver === 'function') checkGameOver();
            }
        });
        if (typeof renderCharacters === 'function') renderCharacters();
    }

    // ── KARGALGAN ──
    function ability_kargalganBasic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            var inc = Math.ceil((c.maxHp || 0) * 0.2);
            c.maxHp = (c.maxHp || 0) + inc;
            c.hp = (c.hp || 0) + inc;
            if (typeof applyShield === 'function') applyShield(n, caster.hp || 0);
        });
        generateChargesInline(casterName, 3);
        addLog('🎵 Himno de Proteccion: ' + casterName + ' incrementa 20% HP y aplica Escudo (' + (caster.hp || 0) + ' HP) a todo el equipo', 'buff');
        if (typeof renderCharacters === 'function') renderCharacters();
    }
    function ability_kargalganSpecial1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveOnTeam(caster.team).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            c._hordaGiantsHymnBonus = (c._hordaGiantsHymnBonus || 0) + 5;
            grantCharges(n, 5);
        });
        addLog('🎵 Himno de los Gigantes: ' + casterName + ' incrementa +5 daño base a todo el equipo y genera 5 cargas', 'buff');
    }
    function ability_kargalganSpecial2(casterName, targetName) {
        var target = gameState.characters[targetName];
        if (!target) return;
        var hadMega = (target.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'mega congelacion'; });
        var hadCongel = (target.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'congelacion'; });
        var hadQuemadura = (target.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'quemadura'; });

        var dmg = hordaComputeRelicDamage(casterName, targetName, 5, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('❄️ Himno de Hielo: ' + casterName + ' causa ' + dmg + ' daño a ' + targetName, 'damage');

        var caster = gameState.characters[casterName];
        var tgt = gameState.characters[targetName];
        if (tgt && !tgt.isDead) {
            if (typeof applyDebuff === 'function') applyDebuff(targetName, { name: 'Megacongelacion', type: 'debuff', duration: 2, emoji: '🧊❄️' });
            addLog('❄️ Himno de Hielo: Megacongelación aplicada a ' + targetName, 'debuff');
        }
        if (caster) {
            var enemyTeam = enemyTeamOf(caster.team);
            var others = aliveOnTeam(enemyTeam).filter(function (n) { return n !== targetName; });
            var shuffled = others.sort(function () { return Math.random() - 0.5; }).slice(0, 2);
            shuffled.forEach(function (n) {
                if (typeof applyDebuff === 'function') applyDebuff(n, { name: 'Congelacion', type: 'debuff', duration: 1, emoji: '🧊' });
                addLog('❄️ Himno de Hielo: Congelación aplicada a ' + n, 'debuff');
            });
        }
        tgt = gameState.characters[targetName];
        if (tgt && !tgt.isDead) {
            if (hadMega) {
                tgt.hp = 0; tgt.isDead = true;
                addLog('❄️ Himno de Hielo: ¡' + targetName + ' eliminado! (ya tenía Megacongelación)', 'damage');
                if (typeof registerKill === 'function') registerKill(casterName, targetName, false);
                if (typeof checkGameOver === 'function') checkGameOver();
            } else if (hadCongel && Math.random() < 0.5) {
                tgt.hp = 0; tgt.isDead = true;
                addLog('❄️ Himno de Hielo: ¡' + targetName + ' eliminado! (ya tenía Congelación, 50%)', 'damage');
                if (typeof registerKill === 'function') registerKill(casterName, targetName, false);
                if (typeof checkGameOver === 'function') checkGameOver();
            }
        }
        tgt = gameState.characters[targetName];
        if (tgt && !tgt.isDead && hadQuemadura) {
            var steal = Math.max(1, Math.floor((tgt.hp || 0) * 0.5));
            tgt.hp = Math.max(0, tgt.hp - steal);
            if (caster) caster.hp = Math.min(caster.maxHp, (caster.hp || 0) + steal);
            addLog('❄️ Himno de Hielo: roba ' + steal + ' HP de ' + targetName + ' (ya tenía Quemaduras)', 'damage');
            if (tgt.hp <= 0 && !tgt.isDead) {
                tgt.isDead = true;
                if (typeof registerKill === 'function') registerKill(casterName, targetName, false);
                if (typeof checkGameOver === 'function') checkGameOver();
            }
        }
        if (typeof renderCharacters === 'function') renderCharacters();
    }
    function ability_kargalganOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        aliveOnTeam(enemyTeam).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            var hasDebuff = (c.statusEffects || []).some(function (e) { return e && e.type === 'debuff'; });
            var triple = hasDebuff && Math.random() < 0.5;
            var dmg = 100 * (triple ? 3 : 1);
            dmg = hordaComputeRelicDamage(casterName, n, dmg, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
            if (triple) addLog('🐉 Himno del Dragón de Fuego: ¡daño triple en ' + n + ' (tenía debuffs)!', 'damage');
            var after = gameState.characters[n];
            if (after && !after.isDead && after.hp > 0) {
                var halfMax = Math.floor((after.maxHp || 0) * 0.5);
                var halfHp = Math.floor((after.hp || 0) * 0.5);
                after.maxHp = Math.max(1, halfMax);
                after.hp = Math.min(after.maxHp, Math.max(1, halfHp));
                addLog('🐉 Himno del Dragón de Fuego: ' + n + ' sobrevive — HP Máx y actual reducidos 50%', 'damage');
            }
        });
        addLog('🐉 Himno del Dragón de Fuego: 100 daño AOE', 'damage');
        if (typeof renderCharacters === 'function') renderCharacters();
    }

    // ══════════════════════════════════════════════════════════════════════
    // DISPATCHER PRINCIPAL
    // ══════════════════════════════════════════════════════════════════════
    window.hordaExecuteAbility = function (ability, charName, targetName, attacker, finalDamage) {
        // ── HORDAS (Orco): cada vez que un aliado "Orco" ataca, genera 1 carga (a todos los que tengan esta pasiva) ──
        if (attacker && isOrcName(charName)) {
            passiveHolders(attacker.team, 'Hordas').forEach(function (n) { grantCharges(n, 1); });
        }
        // ── ARTES DE LA SANGRE OSCURA (Orco Arcano): ataque BÁSICO de un Orco → cura 2HP a todos los Orcos aliados ──
        if (attacker && ability.type === 'basic' && isOrcName(charName)) {
            passiveHolders(attacker.team, 'Artes de la Sangre Oscura').forEach(function () {
                orcAlliesOf(attacker.team).forEach(function (n) { if (typeof applyHeal === 'function') applyHeal(n, 2); });
            });
        }
        // ── FORTALEZA DEL GUARDIÁN: si el portador ejecuta un Over → recupera 5 HP + Protección Sagrada 2T ──
        if (attacker && ability.type === 'over' && (attacker.equippedRelics||[]).indexOf('Fortaleza del Guardian') !== -1) {
            if (typeof applyHeal === 'function') applyHeal(charName, 5);
            if (typeof applyBuff === 'function') applyBuff(charName, { name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '🛡️✨' });
            addLog('🛡️ Fortaleza del Guardián: ' + charName + ' recupera 5 HP y gana Protección Sagrada 2T', 'buff');
        }

        switch (ability.effect) {
            case 'horda_orco_basic':      ability_orcoBasic(charName, targetName); break;
            case 'horda_orco_special1':   ability_orcoSpecial1(charName, targetName); break;
            case 'horda_orco_special2':   ability_orcoSpecial2(charName); break;
            case 'horda_orco_over':       ability_orcoOver(charName); break;

            case 'horda_altoorco_basic':     ability_altoOrcoBasic(charName, targetName); break;
            case 'horda_altoorco_special1':  ability_altoOrcoSpecial1(charName); break;
            case 'horda_altoorco_special2':  ability_altoOrcoSpecial2(charName); break;
            case 'horda_altoorco_over':      ability_altoOrcoOver(charName, targetName); break;

            case 'horda_gigante_basic':     ability_giganteBasic(charName); break;
            case 'horda_gigante_special1':  ability_giganteSpecial1(charName); break;
            case 'horda_gigante_special2':  ability_giganteSpecial2(charName, targetName); break;
            case 'horda_gigante_over':      ability_giganteOver(charName, targetName); break;

            case 'horda_elite_basic':     ability_eliteBasic(charName); break;
            case 'horda_elite_special1':  ability_eliteSpecial1(charName, targetName); break;
            case 'horda_elite_special2':  ability_eliteSpecial2(charName); break;
            case 'horda_elite_over':      ability_eliteOver(charName, targetName); break;

            case 'horda_arcano_basic':     ability_arcanoBasic(charName); break;
            case 'horda_arcano_special1':  ability_arcanoSpecial1(charName); break;
            case 'horda_arcano_special2':  ability_arcanoSpecial2(charName, targetName); break;
            case 'horda_arcano_over':      ability_arcanoOver(charName); break;

            case 'horda_general_basic':     ability_generalBasic(charName); break;
            case 'horda_general_special1':  ability_generalSpecial1(charName, targetName); break;
            case 'horda_general_special2':  ability_generalSpecial2(charName); break;
            case 'horda_general_over':      ability_generalOver(charName); break;

            case 'horda_warmaster_basic':     ability_warmasterBasic(charName); break;
            case 'horda_warmaster_special1':  ability_warmasterSpecial1(charName); break;
            case 'horda_warmaster_special2':  ability_warmasterSpecial2(charName, targetName); break;
            case 'horda_warmaster_over':      ability_warmasterOver(charName); break;

            case 'horda_titan_basic':     ability_titanBasic(charName, targetName); break;
            case 'horda_titan_special1':  ability_titanSpecial1(charName); break;
            case 'horda_titan_special2':  ability_titanSpecial2(charName); break;
            case 'horda_titan_over':      ability_titanOver(charName); break;

            case 'horda_huargos_basic':     ability_huargosBasic(charName, targetName); break;
            case 'horda_huargos_special1':  ability_huargosSpecial1(charName); break;
            case 'horda_huargos_special2':  ability_huargosSpecial2(charName); break;
            case 'horda_huargos_over':      ability_huargosOver(charName); break;

            case 'horda_kargalgan_basic':     ability_kargalganBasic(charName); break;
            case 'horda_kargalgan_special1':  ability_kargalganSpecial1(charName); break;
            case 'horda_kargalgan_special2':  ability_kargalganSpecial2(charName, targetName); break;
            case 'horda_kargalgan_over':      ability_kargalganOver(charName); break;

            default:
                console.error('[HORDA] Efecto no reconocido:', ability.effect);
        }
        if (typeof renderCharacters === 'function') renderCharacters();
    };

    // ══════════════════════════════════════════════════════════════════════
    // IA DE LOS ORCOS — prioridad simple: Over > Especial > Básico
    // (a diferencia de la IA general del juego, que usa un sistema de puntaje
    // más sofisticado, los Orcos siempre usan el movimiento más poderoso que
    // puedan pagar, sin importar la situación táctica)
    // ══════════════════════════════════════════════════════════════════════
    window.executeHordaOrcTurn = function (charName) {
        try {
            const char = gameState.characters[charName];
            if (!char || char.isDead || char.hp <= 0) { endTurn(); return; }

            if (char.statusEffects) {
                const stunned = char.statusEffects.some(function (e) { return e && (normAccent(e.name || '') === 'aturdimiento' || normAccent(e.name || '') === 'mega aturdimiento'); });
                if (stunned) { addLog('⭐ ' + charName + ' está aturdido y pierde su turno', 'damage'); endTurn(); return; }
                if (typeof hasStatusEffect === 'function') {
                    if (hasStatusEffect(charName, 'Mega Congelacion')) { addLog('🧊 ' + charName + ' está Mega Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Congelacion') && Math.random() < 0.5) { addLog('❄️ ' + charName + ' está Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Miedo') && Math.random() < 0.5) { addLog('😱 ' + charName + ' está paralizado por el Miedo', 'damage'); endTurn(); return; }
                }
            }

            const myTeam = char.team;
            const enemyTeam = enemyTeamOf(myTeam);
            const enemies = aliveOnTeam(enemyTeam);
            if (enemies.length === 0) { endTurn(); return; }

            const charges = char.charges || 0;
            // Habilidades que el Orco puede pagar ahora mismo
            const usable = (char.abilities || []).filter(function (a) {
                if (a.type === 'basic') return true;
                return charges >= (a.cost || 0);
            });

            // Prioridad: Over > Especial > Básico. Si hay dos especiales usables, elige uno al azar.
            let chosen = usable.find(function (a) { return a.type === 'over'; });
            if (!chosen) {
                const specials = usable.filter(function (a) { return a.type === 'special'; });
                if (specials.length) chosen = specials[Math.floor(Math.random() * specials.length)];
            }
            if (!chosen) chosen = usable.find(function (a) { return a.type === 'basic'; });
            if (!chosen) { endTurn(); return; }

            const target = (chosen.target === 'single' || chosen.target === 'multi')
                ? randomFrom(enemies)
                : charName; // aoe/self no necesitan objetivo específico — executeAbility(charName) los maneja

            addLog('🌊 [Horda] ' + charName + ' decide usar ' + chosen.name + (target !== charName ? ' sobre ' + target : ''), 'info');
            gameState.selectedAbility = chosen;
            gameState.adjustedCost = chosen.cost;

            setTimeout(function () {
                if (chosen.target === 'aoe' || chosen.target === 'self' || chosen.target === 'multi') {
                    executeAbility(charName);
                } else if (target) {
                    executeAbility(target);
                } else {
                    endTurn();
                }
            }, chosen.type === 'over' ? 200 : 400);
        } catch (err) {
            console.error('[HORDA] Error en executeHordaOrcTurn:', err);
            endTurn();
        }
    };

})();
