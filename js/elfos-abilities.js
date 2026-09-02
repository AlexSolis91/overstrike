// ══════════════════════════════════════════════════════════════════════════
// MODO HORDA — Lógica de habilidades y pasivas de los ELFOS OSCUROS
// Espejo de js/horda-abilities.js. Se apoya en los mismos helpers globales del
// juego (applyDamageWithShield, applyDebuff, applyBuff, applyHeal, ...) y en
// hordaComputeRelicDamage, que ya expone horda-abilities.js.
// ══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Helpers ──
    function enemyTeamOf(team) { return team === 'team1' ? 'team2' : 'team1'; }
    function aliveOnTeam(team) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.team === team && !c.isDead && c.hp > 0;
        });
    }
    function aliveEnemiesOf(team) { return aliveOnTeam(enemyTeamOf(team)); }
    function deadOnTeam(team) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.team === team && (c.isDead || c.hp <= 0);
        });
    }
    function randomFrom(arr) { return arr && arr.length ? arr[Math.floor(Math.random() * arr.length)] : null; }
    function grantCharges(name, amount) {
        var c = gameState.characters[name];
        if (!c) return;
        c.charges = Math.min(20, (c.charges || 0) + amount);
    }
    function relicDmg(caster, target, base, type, isAoe) {
        if (typeof window.hordaComputeRelicDamage === 'function') {
            return window.hordaComputeRelicDamage(caster, target, base, type, !!isAoe);
        }
        return base;
    }
    function countEffects(name, type) {
        var c = gameState.characters[name];
        if (!c) return 0;
        return (c.statusEffects || []).filter(function (e) { return e && e.type === type && !e.passiveHidden; }).length;
    }
    function hasEffect(name, effName) {
        var c = gameState.characters[name];
        if (!c) return false;
        var target = (typeof normAccent === 'function') ? normAccent(effName) : effName.toLowerCase();
        return (c.statusEffects || []).some(function (e) {
            if (!e || !e.name) return false;
            var n = (typeof normAccent === 'function') ? normAccent(e.name) : e.name.toLowerCase();
            return n === target;
        });
    }
    function addBuff(name, effName, duration, emoji, extra) {
        if (typeof applyBuff !== 'function') return;
        var obj = { name: effName, type: 'buff', duration: duration, emoji: emoji || '✨' };
        if (extra) Object.keys(extra).forEach(function (k) { obj[k] = extra[k]; });
        applyBuff(name, obj);
    }
    function addDebuff(name, effName, duration, emoji, extra) {
        if (typeof applyDebuff !== 'function') return;
        var obj = { name: effName, type: 'debuff', duration: duration, emoji: emoji || '💀' };
        if (extra) Object.keys(extra).forEach(function (k) { obj[k] = extra[k]; });
        applyDebuff(name, obj);
    }
    function stealCharges(fromName, toName, amount) {
        var f = gameState.characters[fromName], t = gameState.characters[toName];
        if (!f || !t) return 0;
        var stolen = Math.min(amount, f.charges || 0);
        f.charges = Math.max(0, (f.charges || 0) - stolen);
        t.charges = Math.min(20, (t.charges || 0) + stolen);
        return stolen;
    }
    function stealHp(fromName, toName, amount, casterName) {
        var f = gameState.characters[fromName];
        if (!f) return 0;
        var stolen = Math.min(amount, f.hp || 0);
        if (stolen > 0) {
            applyDamageWithShield(fromName, stolen, casterName || toName);
            if (typeof applyHeal === 'function') applyHeal(toName, stolen);
        }
        return stolen;
    }
    // Marca de la Oscuridad — contador permanente invisible, solo lo leen las
    // habilidades de Klaord. No se muestra como debuff en la carta.
    function addDarkMark(name, count) {
        var c = gameState.characters[name];
        if (!c) return;
        c._elfosDarkMarks = (c._elfosDarkMarks || 0) + (count || 1);
    }
    function getDarkMarks(name) {
        var c = gameState.characters[name];
        return c ? (c._elfosDarkMarks || 0) : 0;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ELFO OSCURO
    // ══════════════════════════════════════════════════════════════════════
    function eo_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var dmg = relicDmg(casterName, targetName, 2 + (caster._elfosBasicBonus || 0), 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        var hpStolen = stealHp(targetName, casterName, 3, casterName);
        var chStolen = stealCharges(targetName, casterName, 3);
        generateChargesInline(casterName, 2);
        addLog('🗡️ Daga de Energía Oscura: ' + dmg + ' daño a ' + targetName + ' (roba ' + hpStolen + ' HP y ' + chStolen + ' cargas)', 'damage');
    }
    function eo_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        addBuff(casterName, 'Sigilo', 2, '👤');
        addBuff(casterName, 'Proteccion Sagrada', 2, '🛡️✨');
        caster._elfosBasicBonus = (caster._elfosBasicBonus || 0) + 1;
        addLog('🌑 Ocultación: ' + casterName + ' gana Sigilo y Protección Sagrada 2T (+1 daño básico permanente → +' + caster._elfosBasicBonus + ')', 'buff');
    }
    function eo_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var extra = countEffects(n, 'debuff');
            var dmg = relicDmg(casterName, n, 3 + extra, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            addDebuff(n, 'Miedo', 2, '😱');
        });
        addLog('🌲 Secretos del Bosque de la Muerte: AOE + Miedo 2T (daño extra por debuffs activos)', 'damage');
    }
    function eo_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        for (var i = 0; i < 5; i++) {
            var enemies = aliveEnemiesOf(caster.team);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var buffs = (gameState.characters[tgt].statusEffects || []).filter(function (e) { return e && e.type === 'buff' && !e.passiveHidden; });
            var dmg = 3;
            if (buffs.length > 0) {
                dmg += 5;
                var idx = (gameState.characters[tgt].statusEffects || []).indexOf(buffs[0]);
                if (idx >= 0) gameState.characters[tgt].statusEffects.splice(idx, 1);
            }
            dmg = relicDmg(casterName, tgt, dmg, 'over', true);
            applyDamageWithShield(tgt, dmg, casterName);
            addDebuff(tgt, 'Confusion', 3, '😵');
        }
        addLog('🌌 Terror de la Noche: 5 ataques con limpieza de buffs y Confusión 3T', 'damage');
    }

    // ══════════════════════════════════════════════════════════════════════
    // ARQUERO DEL BOSQUE DE LA MUERTE
    // ══════════════════════════════════════════════════════════════════════
    function arq_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var dmg = 3 + (caster._elfosAllDmgBonus || 0);
        if (Math.random() < 0.20) {
            var debuffs = countEffects(targetName, 'debuff');
            if (debuffs > 0) { dmg *= 3; addLog('🏹 Flecha Necrótica: ¡daño triple! (' + debuffs + ' debuffs activos)', 'buff'); }
        }
        dmg = relicDmg(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (Math.random() < 0.50) addDebuff(targetName, 'Miedo', 2, '😱');
        addDebuff(targetName, 'Debilitar', 1, '💔'); // pasiva: todos sus ataques debilitan
        generateChargesInline(casterName, 1);
        addLog('🏹 Flecha Necrótica: ' + dmg + ' daño a ' + targetName, 'damage');
    }
    function arq_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var hits = Math.floor(Math.random() * 8) + 3; // 3 a 10
        for (var i = 0; i < hits; i++) {
            var enemies = aliveEnemiesOf(caster.team);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var isCrit = (typeof window.rollCrit === 'function') ? window.rollCrit(0.50, casterName) : (Math.random() < 0.5);
            var dmg = (1 + (caster._elfosAllDmgBonus || 0)) * (isCrit ? 2 : 1);
            dmg = relicDmg(casterName, tgt, dmg, 'special', true);
            applyDamageWithShield(tgt, dmg, casterName);
            addDebuff(tgt, 'Debilitar', 1, '💔');
        }
        addLog('🏹 Ráfaga de Flechas Negras: ' + hits + ' ataques a enemigos aleatorios', 'damage');
    }
    function arq_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        addBuff(casterName, 'Regeneracion', 3, '💚', { healPercent: 30 });
        addBuff(casterName, 'Armadura', 3, '🪖');
        aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, 3); });
        caster._elfosAllDmgBonus = (caster._elfosAllDmgBonus || 0) + 1;
        addLog('🖤 Capucha de Energía Oscura: Regeneración 30% y Armadura 3T, aliados +3 cargas (+' + caster._elfosAllDmgBonus + ' daño base)', 'buff');
    }
    function arq_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var totalStolen = 0;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var tc = gameState.characters[n];
            var dmg = 4 + (caster._elfosAllDmgBonus || 0);
            if (countEffects(n, 'buff') > 0) dmg *= 3;
            else if (countEffects(n, 'debuff') > 0) dmg *= 2; // "daño crítico"
            dmg = relicDmg(casterName, n, dmg, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
            totalStolen += stealCharges(n, casterName, tc.charges || 0);
            addDebuff(n, 'Debilitar', 1, '💔');
        });
        addLog('🌑 Lluvia de Flechas del Caos: AOE — roba ' + totalStolen + ' cargas en total', 'damage');
    }

    // ══════════════════════════════════════════════════════════════════════
    // NECROBRUJA
    // ══════════════════════════════════════════════════════════════════════
    function nb_basic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        for (var i = 0; i < 3; i++) {
            var enemies = aliveEnemiesOf(caster.team);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var dmg = relicDmg(casterName, tgt, 1, 'basic', true);
            applyDamageWithShield(tgt, dmg, casterName);
            stealHp(tgt, casterName, Math.floor(Math.random() * 3) + 1, casterName);
        }
        generateChargesInline(casterName, 2);
        addLog('🩸 Drenaje de Vitalidad: 3 ataques con robo de HP', 'damage');
    }
    function nb_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var dmg = relicDmg(casterName, n, 2, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            var stacks = Math.floor(Math.random() * 4) + 1;
            if (typeof applyPoison === 'function') applyPoison(n, stacks);
            else for (var s = 0; s < stacks; s++) addDebuff(n, 'Veneno', 99, '☠️');
            if (countEffects(n, 'buff') > 0) stealCharges(n, casterName, 5);
        });
        addLog('☠️ Plaga del Mortífago: AOE con 1-4 stacks de Veneno', 'damage');
    }
    function nb_special2(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        caster._elfosNecromantisPct = (caster._elfosNecromantisPct || 0) + 10;
        var enemies = aliveEnemiesOf(caster.team);
        var highest = 0;
        enemies.forEach(function (n) { highest = Math.max(highest, gameState.characters[n].maxHp || 0); });
        var extra = Math.floor(highest * (caster._elfosNecromantisPct / 100));
        var dmg = relicDmg(casterName, targetName, 3 + extra, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('💀 Necromantis: ' + dmg + ' daño (' + caster._elfosNecromantisPct + '% del HP máx mayor = ' + extra + ')', 'damage');
    }
    function nb_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        if (typeof applyShield === 'function') applyShield(casterName, 20);
        else addBuff(casterName, 'Escudo', 999, '🛡️', { shield: 20 });

        var dead = deadOnTeam(caster.team);
        if (dead.length >= 2) {
            // Sacrificio: se elimina y revive a 2 aliados al 100% con 20 cargas
            var revived = dead.sort(function () { return Math.random() - 0.5; }).slice(0, 2);
            revived.forEach(function (n) {
                var c = gameState.characters[n];
                if (!c) return;
                c.isDead = false;
                c.hp = c.maxHp;
                c.charges = 20;
                if (gameState.diedThisRound) {
                    var di = gameState.diedThisRound.indexOf(n);
                    if (di >= 0) gameState.diedThisRound.splice(di, 1);
                }
            });
            addLog('💜 Vida Eterna: ' + casterName + ' se sacrifica y revive a ' + revived.join(' y ') + ' al 100% con 20 cargas', 'buff');
            if (typeof killCharacter === 'function') killCharacter(casterName, casterName);
            else { caster.hp = 0; caster.isDead = true; }
            return;
        }

        // Robo de 30 HP repartido entre enemigos → curación repartida entre aliados
        var enemies = aliveEnemiesOf(caster.team);
        var pool = 30, stolen = 0;
        while (pool > 0 && enemies.length > 0) {
            var tgt = randomFrom(enemies);
            var take = Math.min(pool, Math.max(1, Math.ceil(30 / Math.max(1, enemies.length))));
            var actual = Math.min(take, gameState.characters[tgt].hp || 0);
            if (actual > 0) { applyDamageWithShield(tgt, actual, casterName); stolen += actual; }
            pool -= take;
            enemies = aliveEnemiesOf(caster.team);
        }
        var allies = aliveOnTeam(caster.team);
        var remaining = stolen;
        while (remaining > 0 && allies.length > 0) {
            var a = randomFrom(allies);
            var give = Math.min(remaining, Math.max(1, Math.ceil(stolen / allies.length)));
            if (typeof applyHeal === 'function') applyHeal(a, give);
            remaining -= give;
        }
        addLog('💜 Vida Eterna: Escudo 20 HP, roba ' + stolen + ' HP del enemigo y lo reparte entre aliados', 'buff');
    }

    // ══════════════════════════════════════════════════════════════════════
    // GUARDIANS
    // ══════════════════════════════════════════════════════════════════════
    function gd_rollCrit(casterName) {
        var isCrit = (typeof window.rollCrit === 'function') ? window.rollCrit(0.50, casterName) : (Math.random() < 0.5);
        if (isCrit) {
            var c = gameState.characters[casterName];
            if (c) c._elfosAllDmgBonus = (c._elfosAllDmgBonus || 0) + 1;
        }
        return isCrit;
    }
    function gd_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var isCrit = gd_rollCrit(casterName);
        var dmg = (1 + (caster._elfosAllDmgBonus || 0)) * (isCrit ? 2 : 1);
        dmg = relicDmg(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (typeof applyShield === 'function') applyShield(casterName, 3);
        var enemies = aliveEnemiesOf(caster.team);
        if (enemies.length) {
            var rnd = randomFrom(enemies);
            if (Math.random() < 0.5) addDebuff(rnd, 'Debilitar', 2, '💔');
            else if (typeof applyBleed === 'function') applyBleed(rnd, 2);
            else addDebuff(rnd, 'Sangrado', 2, '🩸');
        }
        generateChargesInline(casterName, 1);
        addLog('⚔️ Cortes Dimensionales: ' + dmg + ' daño a ' + targetName + (isCrit ? ' (¡crítico!)' : '') + ' + Escudo 3 HP', 'damage');
    }
    function gd_special1(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var totalEffects = 0;
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead) return;
            totalEffects += (c.statusEffects || []).filter(function (e) { return e && !e.passiveHidden && (e.type === 'buff' || e.type === 'debuff'); }).length;
        });
        var isCrit = gd_rollCrit(casterName);
        var tc = gameState.characters[targetName];
        var dmg = 4 + (caster._elfosAllDmgBonus || 0);
        if (tc && (tc.hp || 0) > 50) dmg += Math.floor((tc.maxHp || 0) * 0.15);
        if (isCrit) dmg *= 2;
        dmg = relicDmg(casterName, targetName, dmg, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (totalEffects > 0) {
            stealHp(targetName, casterName, totalEffects, casterName);
            stealCharges(targetName, casterName, totalEffects);
        }
        generateChargesInline(casterName, 1);
        addLog('🖤 Orden de la Oscuridad: ' + dmg + ' daño, roba ' + totalEffects + ' HP y cargas', 'damage');
    }
    function gd_special2(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var guardians = aliveOnTeam(caster.team).filter(function (n) { return n.indexOf('Guardians') !== -1; }).length;
        var tc = gameState.characters[targetName];
        var dmg = (7 + (caster._elfosAllDmgBonus || 0)) * Math.max(1, guardians);
        dmg += Math.floor((tc.maxHp || 0) * 0.05 * guardians);
        if (gd_rollCrit(casterName)) dmg *= 2;
        dmg = relicDmg(casterName, targetName, dmg, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        // Sustituir un aliado eliminado por un Guardians nuevo
        var dead = deadOnTeam(caster.team);
        if (dead.length > 0 && typeof window.elfosSpawnGuardians === 'function') {
            window.elfosSpawnGuardians(caster.team, dead[0]);
        }
        generateChargesInline(casterName, 1);
        addLog('⚫ Legión de la Oscuridad: ' + dmg + ' daño (' + guardians + ' Guardians en el equipo)', 'damage');
    }
    function gd_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var anyCrit = false;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var isCrit = Math.random() < 0.10;
            if (isCrit) anyCrit = true;
            var dmg = (5 + (caster._elfosAllDmgBonus || 0)) * (isCrit ? 2 : 1);
            dmg = relicDmg(casterName, n, dmg, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        if (anyCrit) {
            grantCharges(casterName, 15);
            if (typeof window.grantExtraTurn === 'function') window.grantExtraTurn(casterName, 'Torbellino de las Sombras');
            addLog('🌪️ Torbellino de las Sombras: ¡crítico! ' + casterName + ' gana turno adicional y 15 cargas', 'buff');
        } else {
            addLog('🌪️ Torbellino de las Sombras: AOE sobre el equipo enemigo', 'damage');
        }
        generateChargesInline(casterName, 1);
    }

    // ══════════════════════════════════════════════════════════════════════
    // NECROMANCER DE ELITE
    // ══════════════════════════════════════════════════════════════════════
    function nec_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var dmg = 3;
        var tc = gameState.characters[targetName];
        var burnStacks = (tc.statusEffects || []).filter(function (e) {
            if (!e || !e.name) return false;
            var n = (typeof normAccent === 'function') ? normAccent(e.name) : e.name.toLowerCase();
            return n === 'quemadura' || n === 'quemadura solar';
        });
        if (burnStacks.length > 0) {
            dmg += burnStacks.reduce(function (s, e) { return s + (e.damage || 1); }, 0);
        }
        if (hasEffect(targetName, 'Congelacion')) {
            var frozenTotal = 0;
            aliveEnemiesOf(caster.team).forEach(function (n) {
                if (hasEffect(n, 'Congelacion')) frozenTotal += Math.floor((gameState.characters[n].maxHp || 0) * 0.05);
            });
            dmg += frozenTotal;
        }
        dmg = relicDmg(casterName, targetName, dmg, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        generateChargesInline(casterName, 1);
        addLog('🔥 Fuego Oscuro de Nash: ' + dmg + ' daño a ' + targetName, 'damage');
    }
    function nec_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var hadBurn = (gameState.characters[n].statusEffects || []).some(function (e) {
                if (!e || !e.name) return false;
                var nm = (typeof normAccent === 'function') ? normAccent(e.name) : e.name.toLowerCase();
                return nm === 'quemadura' || nm === 'quemadura solar';
            });
            var dmg = relicDmg(casterName, n, 1, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            addDebuff(n, 'Congelacion', 2, '❄️');
            if (hadBurn && typeof applyHeal === 'function') {
                applyHeal(casterName, Math.max(1, Math.floor((gameState.characters[n].maxHp || 0) * 0.10)));
            }
        });
        addLog('❄️ Energía Gélida: AOE + Congelación a todos los golpeados', 'damage');
    }
    function nec_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        caster.maxHp = (caster.maxHp || 0) * 2;
        addBuff(casterName, 'Regeneracion', 2, '💚', { healPercent: 20 });
        addBuff(casterName, 'Aura Oscura', 3, '🖤');
        addLog('📖 Conjuro Necronicus: ' + casterName + ' duplica su HP máx a ' + caster.maxHp + ' + Regeneración 20% y Aura Oscura', 'buff');
    }
    function nec_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var totalHealed = 0;
        aliveOnTeam(caster.team).forEach(function (n) {
            var c = gameState.characters[n];
            var heal = Math.floor((c.maxHp || 0) * 0.50);
            var before = c.hp;
            if (typeof applyHeal === 'function') applyHeal(n, heal);
            totalHealed += Math.max(0, (c.hp || 0) - before);
        });
        var bursts = Math.floor(totalHealed / 10);
        for (var i = 0; i < bursts; i++) {
            var enemies = aliveEnemiesOf(caster.team);
            if (!enemies.length) break;
            applyDamageWithShield(randomFrom(enemies), 10, casterName);
        }
        addLog('👑 Rey de la Muerte: cura ' + totalHealed + ' HP al equipo y lanza ' + bursts + ' explosiones de 10 daño', 'buff');
    }

    // ══════════════════════════════════════════════════════════════════════
    // ELFO ENLOQUECIDO
    // ══════════════════════════════════════════════════════════════════════
    function ee_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var dmg = relicDmg(casterName, targetName, 4, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addBuff(casterName, 'Mega Provocacion', 2, '🌑');
        addBuff(casterName, 'Aura Oscura', 2, '🖤');
        generateChargesInline(casterName, 1);
        addLog('👹 Rugido del Rey Loco: ' + dmg + ' daño + Mega Provocación y Aura Oscura 2T', 'damage');
    }
    function ee_special1(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var tc = gameState.characters[targetName];
        var base = Math.floor(Math.random() * 6) + 1; // 1 a 6
        var isCrit = (tc.charges || 0) > (caster.charges || 0);
        var dmg = relicDmg(casterName, targetName, base * (isCrit ? 2 : 1), 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        aliveOnTeam(caster.team).forEach(function (n) {
            if (typeof applyShield === 'function') applyShield(n, dmg);
        });
        addLog('🏰 Conjuro de Fortaleza Oscura: ' + dmg + ' daño' + (isCrit ? ' (¡crítico garantizado!)' : '') + ' — Escudo ' + dmg + ' HP a todos los aliados', 'damage');
    }
    function ee_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemies = aliveEnemiesOf(caster.team);
        var totalEnemyHp = enemies.reduce(function (s, n) { return s + (gameState.characters[n].hp || 0); }, 0);
        enemies.forEach(function (n) {
            var dmg = 5;
            if (hasEffect(n, 'Mega Aturdimiento')) dmg += Math.floor(totalEnemyHp * 0.50);
            dmg = relicDmg(casterName, n, dmg, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        addLog('💥 Megadestrucción: AOE con bono contra enemigos con Mega Aturdimiento', 'damage');
    }
    function ee_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var before = aliveEnemiesOf(caster.team);
        before.forEach(function (n) {
            var dmg = relicDmg(casterName, n, 8, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        var survivors = aliveEnemiesOf(caster.team);
        survivors.sort(function () { return Math.random() - 0.5; }).slice(0, 3).forEach(function (n) {
            addDebuff(n, 'Mega Aturdimiento', 2, '💫');
        });
        grantCharges(casterName, survivors.length * 2);
        addLog('🌑 Explosión de Oscuridad Concentrada: AOE, Mega Aturdimiento a 3 enemigos, +' + (survivors.length * 2) + ' cargas', 'damage');
    }

    // ══════════════════════════════════════════════════════════════════════
    // KLAORD — ALTO MANDO
    // ══════════════════════════════════════════════════════════════════════
    function kl_basic(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        for (var i = 0; i < 5; i++) {
            var enemies = aliveEnemiesOf(caster.team);
            if (!enemies.length) break;
            var tgt = randomFrom(enemies);
            var dmg = relicDmg(casterName, tgt, 1, 'basic', true);
            applyDamageWithShield(tgt, dmg, casterName);
            if (Math.random() < 0.50) addDarkMark(tgt, 1);
        }
        generateChargesInline(casterName, 2);
        addLog('🌑 Dominio de la Oscuridad: 5 ataques con 50% de Marca de la Oscuridad', 'damage');
    }
    function kl_special1(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var marks = getDarkMarks(targetName);
        var tc = gameState.characters[targetName];
        var dmg = 4 + Math.floor((tc.hp || 0) * 0.05 * marks);
        dmg = relicDmg(casterName, targetName, dmg, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        addLog('🗡️ Tajo Umbrío: ' + dmg + ' daño a ' + targetName + ' (' + marks + ' Marcas de la Oscuridad)', 'damage');
    }
    function kl_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemies = aliveEnemiesOf(caster.team);
        enemies.forEach(function (n) {
            var dmg = relicDmg(casterName, n, 7, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        var gain = enemies.length * 3;
        aliveOnTeam(caster.team).forEach(function (n) { grantCharges(n, gain); });
        addLog('☠️ Ola de Destrucción y Muerte: AOE — aliados +' + gain + ' cargas', 'damage');
    }
    function kl_over(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var dead = deadOnTeam(caster.team).sort(function () { return Math.random() - 0.5; }).slice(0, 2);
        var revivedHp = 0;
        dead.forEach(function (n) {
            var c = gameState.characters[n];
            if (!c) return;
            var pct = (Math.floor(Math.random() * 10) + 1) / 10; // 10% a 100%
            c.isDead = false;
            c.hp = Math.max(1, Math.floor((c.maxHp || 1) * pct));
            revivedHp += c.hp;
            if (gameState.diedThisRound) {
                var di = gameState.diedThisRound.indexOf(n);
                if (di >= 0) gameState.diedThisRound.splice(di, 1);
            }
            addLog('💀 Resurrección: ' + n + ' revive con ' + c.hp + ' HP (' + Math.round(pct * 100) + '%)', 'buff');
        });
        var enemies = aliveEnemiesOf(caster.team);
        if (revivedHp > 0 && enemies.length) {
            applyDamageWithShield(randomFrom(enemies), revivedHp, casterName);
        }
        enemies.forEach(function (n) { addDarkMark(n, dead.length * 2); });
        // Reduce a la mitad la velocidad enemiga; los aliados reparten el 50% robado
        var totalStolenSpeed = 0;
        enemies.forEach(function (n) {
            var c = gameState.characters[n];
            var lost = Math.floor((c.speed || 0) / 2);
            c.speed = Math.max(1, (c.speed || 0) - lost);
            totalStolenSpeed += lost;
        });
        var share = Math.floor(totalStolenSpeed * 0.50);
        var allies = aliveOnTeam(caster.team);
        while (share > 0 && allies.length > 0) {
            var a = randomFrom(allies);
            var give = Math.min(share, Math.max(1, Math.ceil(totalStolenSpeed * 0.5 / allies.length)));
            gameState.characters[a].speed = (gameState.characters[a].speed || 0) + give;
            share -= give;
        }
        if (typeof applyHeal === 'function') applyHeal(casterName, Math.floor((caster.maxHp || 0) * 0.25));
        caster.maxHp = Math.floor((caster.maxHp || 0) * 1.10);
        addLog('👑 Resurrección de las Almas Perdidas: ' + dead.length + ' aliados revividos, velocidad enemiga reducida a la mitad', 'buff');
    }

    // ══════════════════════════════════════════════════════════════════════
    // MALYS
    // ══════════════════════════════════════════════════════════════════════
    function ml_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var alreadyFrozen = hasEffect(targetName, 'Megacongelacion') || hasEffect(targetName, 'Mega Congelacion');
        var dmg = relicDmg(casterName, targetName, 3, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (alreadyFrozen) {
            var tc = gameState.characters[targetName];
            var enemies = aliveEnemiesOf(caster.team).filter(function (n) { return n !== targetName; });
            if (enemies.length && tc) {
                applyDamageWithShield(randomFrom(enemies), tc.hp || 0, casterName);
                addLog('❄️ Flecha Aurora: el objetivo ya estaba Megacongelado — daño masivo a otro enemigo', 'damage');
            }
        }
        addDebuff(targetName, 'Megacongelacion', 2, '🧊');
        generateChargesInline(casterName, 1);
        addLog('🏹 Flecha Aurora: ' + dmg + ' daño + Megacongelación a ' + targetName, 'damage');
    }
    function ml_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var allies = aliveOnTeam(caster.team).sort(function () { return Math.random() - 0.5; }).slice(0, 3);
        allies.forEach(function (n) {
            var c = gameState.characters[n];
            var debuffs = (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.permanent; });
            if (debuffs.length > 0) {
                c.statusEffects = (c.statusEffects || []).filter(function (e) { return !(e && e.type === 'debuff' && !e.permanent); });
                grantCharges(n, debuffs.length * 5);
                c.maxHp = (c.maxHp || 0) + debuffs.length * 10;
            }
        });
        addLog('🌙 Carga de Viento Nocturno: debuffs disipados en 3 aliados', 'buff');
    }
    function ml_special2(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var mult = countEffects(casterName, 'buff') + countEffects(casterName, 'debuff') +
                   countEffects(targetName, 'buff') + countEffects(targetName, 'debuff');
        var dmg = 10 * Math.max(1, mult);
        dmg = relicDmg(casterName, targetName, dmg, 'special', false);
        applyDamageWithShield(targetName, dmg, casterName);
        if (dmg >= 40) {
            var enemies = aliveEnemiesOf(caster.team);
            if (enemies.length) {
                var victim = randomFrom(enemies);
                if (typeof killCharacter === 'function') killCharacter(victim, casterName);
                addLog('🌑 Disparo de Oscuridad Concentrada: ¡' + victim + ' eliminado! (daño ≥ 40)', 'damage');
            }
        }
        addLog('🌑 Disparo de Oscuridad Concentrada: ' + dmg + ' daño (x' + Math.max(1, mult) + ' por efectos activos)', 'damage');
    }
    function ml_over(casterName, targetName, dmgMultiplier) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var enemies = aliveEnemiesOf(caster.team);
        var totalHp = enemies.reduce(function (s, n) { return s + (gameState.characters[n].hp || 0); }, 0);
        var extra = Math.floor(totalHp * 0.10);
        enemies.forEach(function (n) {
            var dmg = (5 + extra) * (dmgMultiplier || 1);
            dmg = relicDmg(casterName, n, dmg, 'over', true);
            applyDamageWithShield(n, dmg, casterName);
        });
        addLog('💥 Explosión del Caos: AOE de ' + ((5 + extra) * (dmgMultiplier || 1)) + ' daño' + (dmgMultiplier > 1 ? ' (¡daño triple!)' : ''), 'damage');
    }
    window.elfosMalysOverTriple = function (casterName) { ml_over(casterName, null, 3); };

    // ══════════════════════════════════════════════════════════════════════
    // REY SUPREMO KAEL (jefe SSS)
    // ══════════════════════════════════════════════════════════════════════
    function rk_afterHit(casterName, targetName) {
        // Pasiva: sus ataques reducen 10% el HP máx del objetivo; si el objetivo
        // queda con HP ≤ 50% del HP actual de Kael, lo elimina.
        var caster = gameState.characters[casterName];
        var tc = gameState.characters[targetName];
        if (!caster || !tc || tc.isDead) return;
        tc.maxHp = Math.max(1, Math.floor((tc.maxHp || 1) * 0.90));
        if (tc.hp > tc.maxHp) tc.hp = tc.maxHp;
        if ((tc.hp || 0) <= Math.floor((caster.hp || 0) * 0.50)) {
            if (typeof killCharacter === 'function') killCharacter(targetName, casterName);
            addLog('👑 Reino de la Oscuridad: ' + targetName + ' es aniquilado por el Rey Supremo Kael', 'damage');
        }
    }
    function rk_basic(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var tc = gameState.characters[targetName];
        var hpBefore = tc ? (tc.hp || 0) : 0;
        var dmg = relicDmg(casterName, targetName, 5, 'basic', false);
        applyDamageWithShield(targetName, dmg, casterName);
        caster.maxHp = (caster.maxHp || 0) + Math.floor(hpBefore * 0.10);
        generateChargesInline(casterName, 3);
        rk_afterHit(casterName, targetName);
        addLog('👑 Decreto del Rey Supremo: ' + dmg + ' daño, +' + Math.floor(hpBefore * 0.10) + ' HP máx', 'damage');
    }
    function rk_special1(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var stolen = 0;
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var c = gameState.characters[n];
            var take = Math.max(1, Math.floor((c.hp || 0) * 0.10));
            applyDamageWithShield(n, take, casterName);
            stolen += take;
        });
        caster.maxHp = (caster.maxHp || 0) + stolen;
        if (typeof applyHeal === 'function') applyHeal(casterName, stolen);
        addBuff(casterName, 'Armadura', 2, '🪖');
        addLog('🔮 Esfera de Caos: roba ' + stolen + ' HP y suma esa cantidad a su HP máx + Armadura 2T', 'buff');
    }
    function rk_special2(casterName) {
        var caster = gameState.characters[casterName];
        if (!caster) return;
        var bonus = Math.floor((caster.hp || 0) * 0.80);
        aliveEnemiesOf(caster.team).forEach(function (n) {
            var dmg = relicDmg(casterName, n, 1 + bonus, 'special', true);
            applyDamageWithShield(n, dmg, casterName);
            if (Math.random() < 0.50) addDebuff(n, 'Mega Posesion', 2, '👁️');
            rk_afterHit(casterName, n);
        });
        addLog('🌑 Lanzas de Energía Oscura: AOE de ' + (1 + bonus) + ' daño (80% del HP de Kael)', 'damage');
    }
    function rk_over(casterName, targetName) {
        var caster = gameState.characters[casterName];
        if (!caster || !targetName) return;
        var deadBefore = deadOnTeam(enemyTeamOf(caster.team)).length;
        var dmg = relicDmg(casterName, targetName, 50, 'over', false);
        applyDamageWithShield(targetName, dmg, casterName);
        var healed = (caster.maxHp || 0) - (caster.hp || 0);
        if (typeof applyHeal === 'function') applyHeal(casterName, caster.maxHp || 0);
        var enemies = aliveEnemiesOf(caster.team);
        if (healed > 0 && enemies.length) applyDamageWithShield(randomFrom(enemies), healed, casterName);
        rk_afterHit(casterName, targetName);
        var deadAfter = deadOnTeam(enemyTeamOf(caster.team)).length;
        if (deadAfter > deadBefore) {
            aliveOnTeam(caster.team).forEach(function (n) {
                var c = gameState.characters[n];
                c.maxHp = (c.maxHp || 0) * 2;
                c.hp = (c.hp || 0) * 2;
            });
            addLog('👑 Devorador de Almas: ¡eliminó a un enemigo! Todos los aliados duplican su HP', 'buff');
        }
        addLog('👑 Devorador de Almas: ' + dmg + ' daño y curación total de ' + healed + ' HP', 'damage');
    }

    // ══════════════════════════════════════════════════════════════════════
    // DISPATCHER
    // ══════════════════════════════════════════════════════════════════════
    window.elfosExecuteAbility = function (ability, charName, targetName) {
        if (!ability || !ability.effect) return false;
        switch (ability.effect) {
            case 'elfos_eo_basic':      eo_basic(charName, targetName); return true;
            case 'elfos_eo_special1':   eo_special1(charName); return true;
            case 'elfos_eo_special2':   eo_special2(charName); return true;
            case 'elfos_eo_over':       eo_over(charName); return true;

            case 'elfos_arq_basic':     arq_basic(charName, targetName); return true;
            case 'elfos_arq_special1':  arq_special1(charName); return true;
            case 'elfos_arq_special2':  arq_special2(charName); return true;
            case 'elfos_arq_over':      arq_over(charName); return true;

            case 'elfos_nb_basic':      nb_basic(charName); return true;
            case 'elfos_nb_special1':   nb_special1(charName); return true;
            case 'elfos_nb_special2':   nb_special2(charName, targetName); return true;
            case 'elfos_nb_over':       nb_over(charName); return true;

            case 'elfos_gd_basic':      gd_basic(charName, targetName); return true;
            case 'elfos_gd_special1':   gd_special1(charName, targetName); return true;
            case 'elfos_gd_special2':   gd_special2(charName, targetName); return true;
            case 'elfos_gd_over':       gd_over(charName); return true;

            case 'elfos_nec_basic':     nec_basic(charName, targetName); return true;
            case 'elfos_nec_special1':  nec_special1(charName); return true;
            case 'elfos_nec_special2':  nec_special2(charName); return true;
            case 'elfos_nec_over':      nec_over(charName); return true;

            case 'elfos_ee_basic':      ee_basic(charName, targetName); return true;
            case 'elfos_ee_special1':   ee_special1(charName, targetName); return true;
            case 'elfos_ee_special2':   ee_special2(charName); return true;
            case 'elfos_ee_over':       ee_over(charName); return true;

            case 'elfos_kl_basic':      kl_basic(charName); return true;
            case 'elfos_kl_special1':   kl_special1(charName, targetName); return true;
            case 'elfos_kl_special2':   kl_special2(charName); return true;
            case 'elfos_kl_over':       kl_over(charName); return true;

            case 'elfos_ml_basic':      ml_basic(charName, targetName); return true;
            case 'elfos_ml_special1':   ml_special1(charName); return true;
            case 'elfos_ml_special2':   ml_special2(charName, targetName); return true;
            case 'elfos_ml_over':       ml_over(charName, targetName, 1); return true;

            case 'elfos_rk_basic':      rk_basic(charName, targetName); return true;
            case 'elfos_rk_special1':   rk_special1(charName); return true;
            case 'elfos_rk_special2':   rk_special2(charName); return true;
            case 'elfos_rk_over':       rk_over(charName, targetName); return true;
        }
        return false;
    };

    // ══════════════════════════════════════════════════════════════════════
    // PASIVAS — ganchos globales
    // ══════════════════════════════════════════════════════════════════════

    // Un aliado Elfo recibió daño / murió / etc.
    window.elfosOnDamageTaken = function (targetName, attackerName, amount) {
        var tc = gameState.characters[targetName];
        if (!tc || !tc.isElfoOscuro) return;

        // CORRUPCION (Elfo Oscuro): +5 velocidad al recibir daño
        if (tc.passive && tc.passive.name === 'Corrupcion') {
            tc.speed = (tc.speed || 0) + 5;
        }
        // CANTO DE LA OSCURIDAD (Necrobruja): 2 de daño al atacante
        if (tc.passive && tc.passive.name === 'Canto de la Oscuridad' && attackerName) {
            var atk = gameState.characters[attackerName];
            if (atk && !atk.isDead && atk.team !== tc.team) {
                applyDamageWithShield(attackerName, 2, targetName);
                addLog('🎵 Canto de la Oscuridad: ' + targetName + ' devuelve 2 de daño a ' + attackerName, 'damage');
            }
        }
        // ARTES ELFICAS OSCURAS (Necromancer de Elite): se cura lo que reciba un aliado
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0) return;
            if (!c.passive || c.passive.name !== 'Artes Elficas Oscuras') return;
            if (c.team !== tc.team || n === targetName) return;
            if (typeof applyHeal === 'function') applyHeal(n, amount);
        });
    };

    // Un Elfo fue eliminado
    window.elfosOnDeath = function (deadName) {
        var dc = gameState.characters[deadName];
        if (!dc || !dc.isElfoOscuro) return;
        // CORRUPCION: los Elfos Oscuros aliados generan 5 cargas
        aliveOnTeam(dc.team).forEach(function (n) {
            var c = gameState.characters[n];
            if (c && c.passive && c.passive.name === 'Corrupcion') grantCharges(n, 5);
        });
        // FURIA DE REY LOCO (Elfo Enloquecido): 30 de daño repartido al morir
        if (dc.passive && dc.passive.name === 'Furia de Rey Loco') {
            var enemies = aliveEnemiesOf(dc.team);
            if (enemies.length) {
                var each = Math.ceil(30 / enemies.length);
                enemies.forEach(function (n) { applyDamageWithShield(n, each, deadName); });
                addLog('👹 Furia de Rey Loco: ' + deadName + ' estalla causando 30 de daño repartido', 'damage');
            }
        }
        // REDENTOR DE LA OSCURIDAD (Klaord): si muere y hay aliados vivos, sacrifica
        // a uno y revive con HP máx duplicado, 20 cargas y turno adicional.
        if (dc.passive && dc.passive.name === 'Redentor de la Oscuridad' && !dc._elfosKlaordRevived) {
            var allies = aliveOnTeam(dc.team).filter(function (n) { return n !== deadName; });
            if (allies.length > 0) {
                var sacrifice = randomFrom(allies);
                dc._elfosKlaordRevived = true;
                if (typeof killCharacter === 'function') killCharacter(sacrifice, deadName);
                dc.isDead = false;
                dc.maxHp = (dc.maxHp || 0) * 2;
                dc.hp = dc.maxHp;
                dc.charges = 20;
                if (gameState.diedThisRound) {
                    var di = gameState.diedThisRound.indexOf(deadName);
                    if (di >= 0) gameState.diedThisRound.splice(di, 1);
                }
                if (typeof window.grantExtraTurn === 'function') window.grantExtraTurn(deadName, 'Redentor de la Oscuridad');
                addLog('👑 Redentor de la Oscuridad: ' + sacrifice + ' se sacrifica — ' + deadName + ' revive con HP máx duplicado y 20 cargas', 'buff');
            }
        }
    };

    // Un enemigo ejecutó una habilidad (para pasivas reactivas)
    window.elfosOnEnemyAbility = function (enemyName, ability) {
        if (!ability) return;
        var ec = gameState.characters[enemyName];
        if (!ec) return;
        var elfTeam = enemyTeamOf(ec.team);

        aliveOnTeam(elfTeam).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || !c.isElfoOscuro || !c.passive) return;

            // FURIA DE REY LOCO: Over enemigo → Mega Aturdimiento a todos los enemigos
            if (c.passive.name === 'Furia de Rey Loco') {
                if (ability.type === 'over') {
                    aliveEnemiesOf(c.team).forEach(function (en) { addDebuff(en, 'Mega Aturdimiento', 2, '💫'); });
                    addLog('👹 Furia de Rey Loco: Over enemigo — Mega Aturdimiento a todo el equipo enemigo', 'debuff');
                } else if (ability.type === 'basic') {
                    grantCharges(n, 1);
                }
            }
            // REDENTOR DE LA OSCURIDAD (Klaord): especial u Over enemigo → roba 3 cargas de cada enemigo
            if (c.passive.name === 'Redentor de la Oscuridad' && (ability.type === 'special' || ability.type === 'over')) {
                var total = 0;
                aliveEnemiesOf(c.team).forEach(function (en) { total += stealCharges(en, n, 3); });
                if (total > 0) addLog('👑 Redentor de la Oscuridad: ' + n + ' roba ' + total + ' cargas del equipo enemigo', 'buff');
            }
            // VENGANZA DE LA NOCHE (Guardians): sobrevivir a un Over → 5 Cortes Dimensionales
            if (c.passive.name === 'Venganza de la Noche' && ability.type === 'over') {
                if (!c.isDead && c.hp > 0) {
                    for (var i = 0; i < 5; i++) {
                        if (!gameState.characters[enemyName] || gameState.characters[enemyName].isDead) break;
                        gd_basic(n, enemyName);
                    }
                    addLog('⚔️ Venganza de la Noche: ' + n + ' contraataca con 5 Cortes Dimensionales', 'damage');
                }
            }
        });
    };

    // Inicio de ronda — pasivas de Klaord
    window.elfosOnRoundStart = function () {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0 || !c.isElfoOscuro || !c.passive) return;

            if (c.passive.name === 'Redentor de la Oscuridad') {
                // Posesión a un enemigo aleatorio
                var enemies = aliveEnemiesOf(c.team);
                if (enemies.length) addDebuff(randomFrom(enemies), 'Posesion', 2, '👁️');
                // Revivir a un aliado eliminado + 50 de daño a un enemigo
                var dead = deadOnTeam(c.team);
                if (dead.length > 0) {
                    var revived = randomFrom(dead);
                    var rc = gameState.characters[revived];
                    if (rc) {
                        rc.isDead = false;
                        rc.hp = Math.max(1, Math.floor((rc.maxHp || 1) * 0.50));
                        if (gameState.diedThisRound) {
                            var di = gameState.diedThisRound.indexOf(revived);
                            if (di >= 0) gameState.diedThisRound.splice(di, 1);
                        }
                        addLog('👑 Redentor de la Oscuridad: ' + revived + ' revive con ' + rc.hp + ' HP', 'buff');
                        var es = aliveEnemiesOf(c.team);
                        if (es.length) applyDamageWithShield(randomFrom(es), 50, n);
                    }
                }
            }
        });
    };

    // Fin de ronda — Klaord roba HP por Marcas de la Oscuridad
    window.elfosOnRoundEnd = function () {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0 || !c.isElfoOscuro || !c.passive) return;
            if (c.passive.name !== 'Redentor de la Oscuridad') return;
            var total = 0;
            aliveEnemiesOf(c.team).forEach(function (en) {
                var marks = getDarkMarks(en);
                if (marks > 0) total += stealHp(en, n, marks, n);
            });
            if (total > 0) addLog('👑 Redentor de la Oscuridad: ' + n + ' roba ' + total + ' HP por Marcas de la Oscuridad', 'buff');
        });
    };

    // Un buff/debuff fue aplicado en cualquier equipo (pasiva de Necrobruja)
    window.elfosOnEffectApplied = function (effectType) {
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.isDead || c.hp <= 0 || !c.isElfoOscuro || !c.passive) return;
            if (c.passive.name !== 'Canto de la Oscuridad') return;
            if (effectType === 'buff') {
                if (typeof applyHeal === 'function') applyHeal(n, 5);
            } else if (effectType === 'debuff') {
                c.maxHp = (c.maxHp || 0) + 5;
            }
        });
    };

    // Spawn de un Guardians nuevo en el hueco de un aliado eliminado
    window.elfosSpawnGuardians = function (team, deadSlotName) {
        if (typeof window.hordaCreateEnemyCharacter !== 'function') return;
        var base = 'Guardians';
        var idx = 2;
        var uniqueName = base + ' ' + idx;
        while (gameState.characters[uniqueName]) { idx++; uniqueName = base + ' ' + idx; }
        var ch = window.hordaCreateEnemyCharacter(base, uniqueName, team);
        if (!ch) return;
        gameState.characters[uniqueName] = ch;
        // Ocupa el hueco: se inserta en la cola de turnos de la ronda actual
        if (gameState.turnOrder && gameState.turnOrder.indexOf(uniqueName) === -1) {
            gameState.turnOrder.push(uniqueName);
        }
        if (typeof renderCharacters === 'function') renderCharacters();
        addLog('⚫ Legión de la Oscuridad: ' + uniqueName + ' toma el lugar de ' + deadSlotName, 'buff');
    };
})();
