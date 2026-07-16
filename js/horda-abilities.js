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
            var types = Object.keys(window.HORDA_CHARACTER_DATA || {});
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
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: INICIO DE RONDA (Orco Titan — reset del flag de "primer golpe")
    // ══════════════════════════════════════════════════════════════════════
    window.hordaOnRoundStart = function () {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (c) c._hordaTitanHitThisRound = false;
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
    };

    // ══════════════════════════════════════════════════════════════════════
    // GANCHO: UN ENEMIGO EJECUTA UN ESPECIAL (Sed de Sangre / Orco de Elite)
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
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyBleed === 'function') applyBleed(targetName, 1);
        generateChargesInline(casterName, 2);
        addLog('🪓 Tajo Sucio: ' + casterName + ' causa ' + dmg + ' daño y Sangrado 1T a ' + targetName, 'damage');
    }
    function ability_orcoSpecial1(casterName, targetName) {
        applyDamageWithShield(targetName, 4, casterName);
        if (typeof applyStun === 'function') applyStun(targetName, 1);
        addLog('🦶 Pisotón Tembloroso: ' + casterName + ' causa 4 daño y Aturdimiento a ' + targetName, 'damage');
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
        var dmg = 4 + debuffCount;
        enemies.forEach(function (n) { applyDamageWithShield(n, dmg, casterName); });
        addLog('🪨 Lanzamiento de Peñasco: ' + dmg + ' daño AOE (' + debuffCount + ' debuffs activos en el enemigo)', 'damage');
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
            applyDamageWithShield(n, dmg, casterName);
            if (typeof applyWeaken === 'function') applyWeaken(n, 3);
        });
        addLog('🌀 Torbellino de Sangre: 4 daño AOE (crítico a enemigos con Sangrado/Hemorragia) + Debilitar 3T', 'damage');
    }
    function ability_altoOrcoOver(casterName, targetName) {
        var crit = Math.random() < 0.5;
        var dmg = crit ? 20 : 10;
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('🔪 Guillotina de Hierro: ' + dmg + ' daño a ' + targetName + (crit ? ' (¡CRÍTICO!)' : ''), 'damage');
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
            applyDamageWithShield(n, 2, casterName);
            totalStolen += 2;
        });
        caster.hp = Math.min(caster.maxHp, caster.hp + totalStolen);
        addLog('🌊 Ondas sísmicas: 2 daño AOE, ' + casterName + ' roba ' + totalStolen + ' HP en total', 'damage');
    }
    function ability_giganteSpecial2(casterName, targetName) {
        var caster = gameState.characters[casterName];
        var target = gameState.characters[targetName];
        applyDamageWithShield(targetName, 4, casterName);
        if (!target) return;
        var buffs = (target.statusEffects || []).filter(function (e) { return e && e.type === 'buff'; });
        var count = buffs.length;
        target.statusEffects = (target.statusEffects || []).filter(function (e) { return !e || e.type !== 'buff'; });
        if (count > 0 && caster) {
            aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 3 * count); });
        }
        addLog('🦶 Pisotón de Demolición: 4 daño + disipa ' + count + ' buffs (equipo genera ' + (3 * count) + ' cargas c/u)', 'damage');
    }
    function ability_giganteOver(casterName, targetName) {
        var caster = gameState.characters[casterName];
        var dmg = 3 + Math.floor(Math.random() * 8); // 3-10
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
        var noCharges = (target.charges || 0) <= 0;
        var dmg = noCharges ? 6 : 3; // "daño crítico" ≈ doble
        applyDamageWithShield(targetName, dmg, casterName);
        if (noCharges) {
            var caster = gameState.characters[casterName];
            var enemyTeam = caster ? enemyTeamOf(caster.team) : null;
            var enemies = enemyTeam ? aliveOnTeam(enemyTeam) : [];
            for (var i = 0; i < 2 && enemies.length; i++) {
                var e = enemies.splice(Math.floor(Math.random() * enemies.length), 1)[0];
                if (typeof applyStun === 'function') applyStun(e, 2);
            }
            addLog('💢 Rompeguardias: ¡objetivo sin cargas! Crítico + Mega Aturdimiento a 2 enemigos aleatorios', 'damage');
        } else {
            addLog('💢 Rompeguardias: ' + dmg + ' daño a ' + targetName, 'damage');
        }
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
            applyDamageWithShield(n, 1, casterName);
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
        applyDamageWithShield(targetName, 4, casterName);
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
            return c && c.team === caster.team && c.isDead;
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
            if (dmg > 0) applyDamageWithShield(targetName, dmg, n);
            if (basicAb.chargeGain) generateChargesInline(n, basicAb.chargeGain);
        });
        applyDamageWithShield(targetName, 3, casterName);
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
            applyDamageWithShield(n, 3, casterName);
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
            gameState.characters[sacrificed].isDead = true;
            gameState.characters[sacrificed].hp = 0;
            addLog('🏳️ Marcha de la Victoria: ' + sacrificed + ' es sacrificado', 'damage');
        }
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        enemies.forEach(function (n) { applyDamageWithShield(n, 5, casterName); });
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
        aliveOnTeam(enemyTeam).forEach(function (n) { applyDamageWithShield(n, dmg, casterName); });
        addLog('🌪️ Furia de la Horda: elimina ' + eliminated + ' invocaciones, ' + dmg + ' daño AOE', 'damage');
    }
    function ability_warmasterSpecial2(casterName, targetName) {
        var target = gameState.characters[targetName];
        if (!target) return;
        var hpPct = target.hp / (target.maxHp || 1);
        var mult = hpPct >= 0.5 ? 3 : 1;
        var baseDmg = target._hordaWarmasterLanceBase || 5;
        var dmg = baseDmg * mult;
        // Ignora Escudo/Reflejar/Escudo Sagrado: aplicar directo al HP, no vía applyDamageWithShield (que respeta escudo)
        target.hp = Math.max(0, target.hp - dmg);
        addLog('🗡️ Lanza de Oscuridad perforadora: ' + dmg + ' daño directo a ' + targetName + ' (ignora Escudo/Reflejar/Escudo Sagrado)', 'damage');
        var hasDebuff = (target.statusEffects || []).some(function (e) { return e && e.type === 'debuff'; });
        if (hasDebuff) {
            target._hordaWarmasterLanceBase = baseDmg * 2;
            addLog('🗡️ Lanza de Oscuridad perforadora: objetivo con debuff — el daño base de este movimiento se duplica permanentemente', 'damage');
        }
        if (target.hp <= 0 && !target.isDead && typeof applyDamageWithShield === 'function') {
            // Forzar el flujo normal de derrota (ya se descontó el HP directo arriba)
            applyDamageWithShield(targetName, 0, casterName);
        }
    }
    function ability_warmasterOver(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemyTeam = enemyTeamOf(caster.team);
        var enemies = aliveOnTeam(enemyTeam);
        var count = 0;
        enemies.forEach(function (n) {
            applyDamageWithShield(n, 10, casterName);
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
            var dmg = 5 + Math.floor(Math.random() * 16); // 5-20
            applyDamageWithShield(n, dmg, casterName);
            if (Math.random() < 0.10) {
                var c = gameState.characters[n];
                if (c && !c.isDead) { c.hp = 0; applyDamageWithShield(n, 0, casterName); }
                addLog('🌋 Devastacion planetaria: ¡' + n + ' eliminado! (10%)', 'damage');
            }
        });
        addLog('🌋 Devastacion planetaria: 5-20 daño AOE a todos los enemigos', 'damage');
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
