// ══════════════════════════════════════════════════════════════════════════
// RELIQUIAS EXCLUSIVAS DE LA HORDA DE ELFOS OSCUROS
// ──────────────────────────────────────────────────────────────────────────
// 30 reliquias (10 Raras, 10 Especiales, 10 Épicas). Los efectos se enganchan
// al motor mediante los hooks window.elfrOn*(...) que invocan summons.js,
// turn-logic.js y skills.js en los puntos correspondientes.
//
// Convención de contadores propios (todos en el objeto del personaje):
//   _elfrHungaroMarks   → Capa del Rey Húngaro
//   _elfrCritBonus      → Cuchillas de Depredador
//   _elfrArcantos       → Escudo Arcantos
//   _elfrTasokidan      → Cadena Tasokidan (marca sobre el ENEMIGO)
//   _elfrAoeBonus       → Abanico de Acero
//   _elfrMangualUses    → Mangual de Ophiuchus (contador por ronda)
// ══════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Helpers ──
    function RD(name) { return (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[name] : null; }
    function hasRelic(charName, effectKey) {
        var c = gameState.characters[charName];
        if (!c) return false;
        return (c.equippedRelics || []).some(function (rn) {
            var rd = RD(rn); return rd && rd.effect === effectKey;
        });
    }
    function holdersOf(effectKey) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && !c.isDead && c.hp > 0 && hasRelic(n, effectKey);
        });
    }
    function enemyTeamOf(team) { return team === 'team1' ? 'team2' : 'team1'; }
    function aliveOnTeam(team) {
        return Object.keys(gameState.characters).filter(function (n) {
            var c = gameState.characters[n];
            return c && c.team === team && !c.isDead && c.hp > 0;
        });
    }
    function aliveEnemiesOf(team) { return aliveOnTeam(enemyTeamOf(team)); }
    function randomFrom(a) { return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }
    function grantCharges(n, amt) {
        var c = gameState.characters[n];
        if (c) c.charges = Math.min(20, (c.charges || 0) + amt);
    }
    function norm(s) {
        if (typeof normAccent === 'function') return normAccent(s || '');
        return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    function buffsOf(n) {
        var c = gameState.characters[n];
        if (!c) return [];
        return (c.statusEffects || []).filter(function (e) { return e && e.type === 'buff' && !e.passiveHidden; });
    }
    function debuffsOf(n) {
        var c = gameState.characters[n];
        if (!c) return [];
        return (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.passiveHidden; });
    }
    function hasEff(n, name) {
        var c = gameState.characters[n];
        if (!c) return false;
        var t = norm(name);
        return (c.statusEffects || []).some(function (e) { return e && norm(e.name) === t; });
    }
    function addShield(n, amt) {
        if (typeof applyShield === 'function') applyShield(n, amt);
        else {
            var c = gameState.characters[n];
            if (c) c.shield = (c.shield || 0) + amt;
        }
    }
    function addBuff(n, name, dur, emoji) {
        if (typeof applyBuff === 'function') applyBuff(n, { name: name, type: 'buff', duration: dur, emoji: emoji || '✨' });
    }

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador RECIBE daño — se llama ANTES de aplicar el daño y
    // devuelve el daño ya modificado (puede ser 0 para anularlo).
    // Firma: elfrModifyIncomingDamage(targetName, attackerName, damage, ability)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrModifyIncomingDamage = function (targetName, attackerName, damage, ability) {
        var t = gameState.characters[targetName];
        if (!t || damage <= 0) return damage;
        var isDirectHit = !!attackerName; // daño por golpe (no por DOT)

        // ── BRAZALETE FERNDUR: inmune a MT; con AOE gana Escudo 5 ──
        if (hasRelic(targetName, 'elfr_brazalete_ferndur') && ability) {
            if (ability.target === 'mt') {
                addLog('🔗 Brazalete Ferndur: ' + targetName + ' es inmune a ataques MT', 'buff');
                return 0;
            }
            if (ability.target === 'aoe') addShield(targetName, 5);
        }

        // ── CORONA DE LOS NO MUERTOS: solo recibe daño POR GOLPE de enemigos
        //    con más HP actual. El daño directo (DOT) no se bloquea. ──
        if (isDirectHit && hasRelic(targetName, 'elfr_corona_no_muertos')) {
            var atk = gameState.characters[attackerName];
            if (atk && (atk.hp || 0) <= (t.hp || 0)) {
                addLog('👑 Corona de los no muertos: ' + attackerName + ' no tiene HP suficiente para dañar a ' + targetName, 'buff');
                return 0;
            }
        }

        // ── KARUKA: -25% de daño por cada buff activo del portador ──
        if (hasRelic(targetName, 'elfr_karuka')) {
            var nb = buffsOf(targetName).length;
            if (nb > 0) {
                var red = Math.min(1, nb * 0.25);
                var before = damage;
                damage = Math.max(0, Math.floor(damage * (1 - red)));
                if (damage !== before) addLog('🛡️ Karuka: daño reducido ' + Math.round(red * 100) + '% (' + nb + ' buffs) → ' + damage, 'buff');
                if (damage <= 0) return 0;
            }
        }

        // ── ESCUDO ARCANTOS: el daño se reparte entre TODOS los contadores
        //    activos de ambos equipos; cada personaje recibe la parte que le
        //    corresponde según cuántos contadores tenga. ──
        if (hasRelic(targetName, 'elfr_escudo_arcantos') && !gameState._elfrArcantosSplitting) {
            var carriers = Object.keys(gameState.characters).filter(function (n) {
                var c = gameState.characters[n];
                return c && !c.isDead && c.hp > 0 && (c._elfrArcantos || 0) > 0;
            });
            var totalCounters = carriers.reduce(function (s, n) { return s + (gameState.characters[n]._elfrArcantos || 0); }, 0);
            if (totalCounters > 1) {
                var perCounter = damage / totalCounters;
                gameState._elfrArcantosSplitting = true;
                var ownShare = 0;
                carriers.forEach(function (n) {
                    var share = Math.round(perCounter * (gameState.characters[n]._elfrArcantos || 0));
                    if (n === targetName) { ownShare = share; return; }
                    if (share > 0 && typeof applyDamageWithShield === 'function') {
                        applyDamageWithShield(n, share, attackerName);
                    }
                });
                gameState._elfrArcantosSplitting = false;
                addLog('🔵 Escudo Arcantos: ' + damage + ' de daño repartido entre ' + totalCounters + ' contadores (' + Math.round(perCounter) + ' por contador)', 'buff');
                return ownShare;
            }
        }

        return damage;
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador RECIBIÓ daño (ya aplicado)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnDamageTaken = function (targetName, attackerName, damage, ability) {
        var t = gameState.characters[targetName];
        if (!t || damage <= 0) return;

        // ── CAPA DEL REY HÚNGARO: acumula marca, cura 3 HP por marca ──
        if (hasRelic(targetName, 'elfr_capa_hungaro')) {
            t._elfrHungaroMarks = (t._elfrHungaroMarks || 0) + 1;
            var heal = t._elfrHungaroMarks * 3;
            if (typeof applyHeal === 'function') applyHeal(targetName, heal);
            addLog('🧛 Capa del Rey Húngaro: marca ' + t._elfrHungaroMarks + ' — recupera ' + heal + ' HP', 'buff');
        }

        // ── GEMA DE VITALIDAD: cura 2 HP a todos los aliados ──
        if (hasRelic(targetName, 'elfr_gema_vitalidad')) {
            aliveOnTeam(t.team).forEach(function (n) {
                if (typeof applyHeal === 'function') applyHeal(n, 2);
            });
        }

        // ── ARMADURA DE HUESO: Sangrado al atacante; si tenía Hemorragia,
        //    elimina 5 cargas de todos los enemigos ──
        if (attackerName && hasRelic(targetName, 'elfr_armadura_hueso')) {
            var atkC = gameState.characters[attackerName];
            if (atkC && !atkC.isDead && atkC.team !== t.team) {
                if (typeof applyBleed === 'function') applyBleed(attackerName, 2);
                if (hasEff(attackerName, 'Hemorragia')) {
                    aliveEnemiesOf(t.team).forEach(function (n) {
                        var c = gameState.characters[n];
                        c.charges = Math.max(0, (c.charges || 0) - 5);
                    });
                    addLog('🦴 Armadura de Hueso: el equipo enemigo pierde 5 cargas (Hemorragia en ' + attackerName + ')', 'debuff');
                }
            }
        }

        // ── ESPÍRITU DE NANDI: los portadores aliados se curan el 30% del daño ──
        holdersOf('elfr_espiritu_nandi').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.team !== t.team || n === targetName) return;
            var amt = Math.max(1, Math.floor(damage * 0.30));
            if (typeof applyHeal === 'function') applyHeal(n, amt);
        });

        // ── MÁSCARA DE NIGROMANTE: el daño recibido por sus Esqueletos ya se
        //    procesa en elfrOnSummonDamaged (más abajo) ──
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador CAUSA daño (modificador de salida)
    // Devuelve el daño ya modificado.
    // ══════════════════════════════════════════════════════════════════════
    window.elfrModifyOutgoingDamage = function (attackerName, targetName, damage, ability) {
        var a = gameState.characters[attackerName];
        if (!a || damage <= 0) return damage;

        // ── CAPA DEL REY HÚNGARO: +10% por marca ──
        if (hasRelic(attackerName, 'elfr_capa_hungaro')) {
            var m = a._elfrHungaroMarks || 0;
            if (m > 0) damage = Math.floor(damage * (1 + m * 0.10));
        }

        // ── SABLE DE LUZ DE OBI-WAN: +2% por cada punto de Escudo activo ──
        if (hasRelic(attackerName, 'elfr_sable_obiwan')) {
            var sh = a.shield || 0;
            if (sh > 0) damage = Math.floor(damage * (1 + sh * 0.02));
        }

        // ── ABANICO DE ACERO: +N al daño base de los AOE ──
        if (ability && ability.target === 'aoe' && hasRelic(attackerName, 'elfr_abanico_acero')) {
            damage += (a._elfrAoeBonus || 0);
        }

        // ── GARRA DEL REY LOBO: daño doble contra enemigos con debuff ──
        if (targetName && hasRelic(attackerName, 'elfr_garra_rey_lobo')) {
            var dbs = debuffsOf(targetName);
            if (dbs.length > 0) {
                damage *= 2;
                if (typeof applyHeal === 'function') applyHeal(attackerName, dbs.length * 5);
                addLog('🐺 Garra del Rey Lobo: daño doble y +' + (dbs.length * 5) + ' HP (' + dbs.length + ' debuffs en ' + targetName + ')', 'buff');
            }
        }

        // ── MINUTERO ZAFKIEL: contra enemigos más lentos, crítico garantizado
        //    y 10% de daño triple ──
        if (targetName && hasRelic(attackerName, 'elfr_minutero_zafkiel')) {
            var tc = gameState.characters[targetName];
            if (tc && (tc.speed || 0) < (a.speed || 0)) {
                damage *= (Math.random() < 0.10) ? 3 : 2;
            }
        }

        return damage;
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador CAUSÓ daño (efectos posteriores al golpe)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnDamageDealt = function (attackerName, targetName, damage, ability) {
        var a = gameState.characters[attackerName];
        var t = gameState.characters[targetName];
        if (!a || damage <= 0) return;

        // ── SABLE DE LUZ DE OBI-WAN: Escudo acumulable igual al daño ──
        if (hasRelic(attackerName, 'elfr_sable_obiwan')) addShield(attackerName, damage);

        // ── ESPADAS DEL CAOS / CUCHILLAS DE DEPREDADOR: efectos por crítico ──
        if (gameState._isCritHit) {
            if (hasRelic(attackerName, 'elfr_cuchillas_depredador')) {
                a._elfrCritBonus = (a._elfrCritBonus || 0.10) + 0.10;
            }
            if (hasRelic(attackerName, 'elfr_espadas_caos')) {
                a.maxHp = (a.maxHp || 0) + 4;
                var es = aliveEnemiesOf(a.team);
                if (es.length) {
                    var extra = Math.max(1, Math.floor((a.maxHp || 0) * 0.25));
                    if (typeof applyDamageWithShield === 'function') applyDamageWithShield(randomFrom(es), extra, attackerName);
                    addLog('⚔️ Espadas del Caos: crítico — ' + extra + ' de daño extra y +4 HP máx', 'damage');
                }
            }
        }

        if (!t) return;

        // ── MINUTERO ZAFKIEL / PISTOLA ZAFKEI: reducción de velocidad ──
        if (hasRelic(attackerName, 'elfr_minutero_zafkiel')) t.speed = Math.max(1, (t.speed || 0) - 3);
        if (hasRelic(attackerName, 'elfr_pistola_zafkei'))    t.speed = Math.max(1, (t.speed || 0) - 5);

        // ── MANGUAL DE OPHIUCHUS: 1 a 3 stacks de Veneno por golpe ──
        if (hasRelic(attackerName, 'elfr_mangual_ophiuchus')) {
            var stacks = Math.floor(Math.random() * 3) + 1;
            if (typeof applyPoison === 'function') applyPoison(targetName, stacks);
        }

        // ── AZOTE DEL INVIERNO: AOE con 50% de Congelación; roba 5 HP si ya
        //    estaba congelado antes del golpe ──
        if (ability && ability.target === 'aoe' && hasRelic(attackerName, 'elfr_azote_invierno')) {
            if (hasEff(targetName, 'Congelacion')) {
                var steal = Math.min(5, t.hp || 0);
                if (steal > 0 && typeof applyDamageWithShield === 'function') {
                    applyDamageWithShield(targetName, steal, attackerName);
                    if (typeof applyHeal === 'function') applyHeal(attackerName, steal);
                }
            } else if (Math.random() < 0.50 && typeof applyDebuff === 'function') {
                applyDebuff(targetName, { name: 'Congelacion', type: 'debuff', duration: 2, emoji: '❄️' });
            }
        }

        // ── CADENA TASOKIDAN: marca al objetivo y salpica a los marcados ──
        if (hasRelic(attackerName, 'elfr_cadena_tasokidan') && !gameState._elfrTasokidanSplashing) {
            gameState._elfrTasokidanSplashing = true;
            // Salpicadura: cada enemigo marcado recibe 10% del daño por marca
            aliveEnemiesOf(a.team).forEach(function (n) {
                var marks = (gameState.characters[n]._elfrTasokidan || 0);
                if (marks <= 0) return;
                var splash = Math.max(1, Math.floor(damage * 0.10 * marks));
                if (typeof applyDamageWithShield === 'function') applyDamageWithShield(n, splash, attackerName);
            });
            gameState._elfrTasokidanSplashing = false;
            // El objetivo golpeado acumula una marca nueva
            t._elfrTasokidan = (t._elfrTasokidan || 0) + 1;
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: bono de crítico por reliquia (lo suma rollCrit en skills.js)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrCritBonus = function (charName) {
        var c = gameState.characters[charName];
        if (!c) return 0;
        if (!hasRelic(charName, 'elfr_cuchillas_depredador')) return 0;
        if (c._elfrCritBonus === undefined) c._elfrCritBonus = 0.10;
        return c._elfrCritBonus;
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: se aplicó un DEBUFF al portador (antes de aplicarlo).
    // Devuelve true para BLOQUEARLO.
    // ══════════════════════════════════════════════════════════════════════
    window.elfrBlockDebuff = function (targetName, effectName) {
        var t = gameState.characters[targetName];
        if (!t) return false;
        var n = norm(effectName);

        // ── PIEDRA DEL SOL: inmune a Ceguera y Confusión ──
        if (hasRelic(targetName, 'elfr_piedra_sol') && (n === 'ceguera' || n === 'confusion')) {
            addLog('☀️ Piedra del Sol: ' + targetName + ' es inmune a ' + effectName, 'buff');
            return true;
        }
        // ── KARUKA: inmune a Aturdimiento y Mega Aturdimiento ──
        if (hasRelic(targetName, 'elfr_karuka') && (n === 'aturdimiento' || n === 'mega aturdimiento')) {
            addLog('🛡️ Karuka: ' + targetName + ' es inmune a ' + effectName, 'buff');
            return true;
        }
        // ── CAPA NAMEKIANA: inmune a debuffs mientras tenga un buff activo ──
        if (hasRelic(targetName, 'elfr_capa_namekiana') && buffsOf(targetName).length > 0) {
            addLog('🟢 Capa Namekiana: ' + targetName + ' es inmune a debuffs (tiene buffs activos)', 'buff');
            return true;
        }
        // ── SABLE DE LUZ DE OBI-WAN: consume 10 de Escudo para anularlo ──
        if (hasRelic(targetName, 'elfr_sable_obiwan') && (t.shield || 0) >= 10) {
            t.shield -= 10;
            addLog('🔵 Sable de Luz de Obi-Wan: consume 10 de Escudo y anula ' + effectName, 'buff');
            return true;
        }
        return false;
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: se aplicó un DEBUFF al portador (ya aplicado)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnDebuffReceived = function (targetName, effectName) {
        var t = gameState.characters[targetName];
        if (!t) return;

        // ── NEBULARIS: limpia 1 debuff de UN aliado al azar y gana Escudo 4 ──
        if (hasRelic(targetName, 'elfr_nebularis')) {
            var allies = aliveOnTeam(t.team);
            var cleaned = 0;
            var pick = randomFrom(allies);
            if (pick) {
                var c = gameState.characters[pick];
                var dbs = (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.permanent; });
                if (dbs.length > 0) {
                    var idx = c.statusEffects.indexOf(randomFrom(dbs));
                    if (idx >= 0) { c.statusEffects.splice(idx, 1); cleaned++; }
                }
            }
            if (cleaned > 0) {
                addShield(targetName, cleaned * 4);
                addLog('🌫️ Nebularis: limpia ' + cleaned + ' debuff de ' + pick + ' → Escudo ' + (cleaned * 4) + ' HP', 'buff');
            }
        }

        // ── ABANICO DE ACERO: limpia 1 debuff de CADA aliado; +1 daño AOE
        //    por cada debuff limpiado ──
        if (hasRelic(targetName, 'elfr_abanico_acero')) {
            var total = 0;
            aliveOnTeam(t.team).forEach(function (n) {
                var c = gameState.characters[n];
                var dbs = (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.permanent; });
                if (dbs.length > 0) {
                    var i = c.statusEffects.indexOf(dbs[0]);
                    if (i >= 0) { c.statusEffects.splice(i, 1); total++; }
                }
            });
            if (total > 0) {
                t._elfrAoeBonus = (t._elfrAoeBonus || 0) + total;
                addLog('🪭 Abanico de Acero: limpia ' + total + ' debuffs del equipo → +' + total + ' daño AOE (total +' + t._elfrAoeBonus + ')', 'buff');
            }
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: un personaje va a recibir daño por QUEMADURA.
    // Devuelve true si el daño debe convertirse en curación (Drafuriz).
    // ══════════════════════════════════════════════════════════════════════
    window.elfrBurnHeals = function (charName) {
        return hasRelic(charName, 'elfr_drafuriz');
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: un enemigo recibió daño por VENENO (Mangual de Ophiuchus)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnPoisonDamage = function (poisonedName) {
        var pc = gameState.characters[poisonedName];
        if (!pc) return;
        holdersOf('elfr_mangual_ophiuchus').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.team === pc.team) return;
            if ((c._elfrMangualUses || 0) >= 3) return; // máx. 3 activaciones por ronda
            var aoes = (c.abilities || []).filter(function (a) {
                return a && a.target === 'aoe' && (a.type === 'basic' || a.type === 'special');
            });
            if (!aoes.length) return;
            c._elfrMangualUses = (c._elfrMangualUses || 0) + 1;
            var ab = randomFrom(aoes);
            addLog('⛓️ Mangual de Ophiuchus: ' + n + ' ejecuta ' + ab.name + ' automáticamente (' + c._elfrMangualUses + '/3 esta ronda)', 'buff');
            var prevSel = gameState.selectedCharacter, prevAb = gameState.selectedAbility;
            var prevSup = gameState._suppressAutoEndTurn;
            gameState.selectedCharacter = n;
            gameState.selectedAbility = ab;
            gameState.adjustedCost = 0;
            passiveExecuting = true;
            gameState._suppressAutoEndTurn = true;
            try {
                if (typeof window.hordaExecuteAbility === 'function' && String(ab.effect).indexOf('horda_') === 0) {
                    window.hordaExecuteAbility(ab, n, null, c, ab.damage);
                } else if (typeof window.elfosExecuteAbility === 'function' && String(ab.effect).indexOf('elfos_') === 0) {
                    window.elfosExecuteAbility(ab, n, null);
                } else if (typeof _executeAbilityCore === 'function') {
                    _executeAbilityCore(null);
                }
            } catch (e) { console.error('[Mangual de Ophiuchus]', e); }
            passiveExecuting = false;
            gameState._suppressAutoEndTurn = prevSup;
            gameState.selectedCharacter = prevSel;
            gameState.selectedAbility = prevAb;
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: un personaje gastó cargas para ejecutar un movimiento
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnChargesSpent = function (casterName, amount) {
        var caster = gameState.characters[casterName];
        if (!caster || !amount || amount <= 0) return;

        // ── CINTURÓN ARCANO: un ALIADO (no el portador) gastó cargas → +3 ──
        holdersOf('elfr_cinturon_arcano').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.team !== caster.team || n === casterName) return;
            grantCharges(n, 3);
        });

        // ── DRAFURIZ: un ENEMIGO gastó cargas → el portador se aplica Quemadura 2 ──
        holdersOf('elfr_drafuriz').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c || c.team === caster.team) return;
            if (typeof applyDebuff === 'function') {
                applyDebuff(n, { name: 'Quemadura', type: 'debuff', duration: 99, damage: 2, emoji: '🔥' });
            }
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: un personaje ejecutó una habilidad
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnAbilityExecuted = function (casterName, ability) {
        var caster = gameState.characters[casterName];
        if (!caster || !ability) return;

        // ── MAZA NECRÓTICA: +1 carga por movimiento ejecutado ──
        if (hasRelic(casterName, 'elfr_maza_necrotica')) grantCharges(casterName, 1);

        // ── PIEDRA DEL SOL: al ejecutar un Over, los aliados disipan debuffs
        //    y generan 5 cargas ──
        if (ability.type === 'over' && hasRelic(casterName, 'elfr_piedra_sol')) {
            aliveOnTeam(caster.team).forEach(function (n) {
                var c = gameState.characters[n];
                c.statusEffects = (c.statusEffects || []).filter(function (e) { return !(e && e.type === 'debuff' && !e.permanent); });
                grantCharges(n, 5);
            });
            addLog('☀️ Piedra del Sol: el equipo aliado disipa sus debuffs y gana 5 cargas', 'buff');
        }

        // ── TALISMÁN DE HARVART: Over ENEMIGO → Esquivar y Armadura 1T ──
        if (ability.type === 'over') {
            holdersOf('elfr_talisman_harvart').forEach(function (n) {
                var c = gameState.characters[n];
                if (!c || c.team === caster.team) return;
                addBuff(n, 'Esquivar', 1, '💨');
                addBuff(n, 'Armadura', 1, '🪖');
                addLog('🔱 Talismán de Harvart: ' + n + ' gana Esquivar y Armadura 1T', 'buff');
            });
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: un personaje ganó un turno adicional (Markas de Sigurd)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnExtraTurnGranted = function (charName) {
        var c = gameState.characters[charName];
        if (!c) return;
        holdersOf('elfr_markas_sigurd').forEach(function (n) {
            var h = gameState.characters[n];
            if (!h || h.team === c.team) return;         // solo si lo ganó un ENEMIGO
            if (gameState._elfrSigurdChain) return;        // evita cadenas infinitas
            gameState._elfrSigurdChain = true;
            h.speed = (h.speed || 0) + 5;
            if (typeof window.grantExtraTurn === 'function') window.grantExtraTurn(n, 'Markas de Sigurd');
            gameState._elfrSigurdChain = false;
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador fue ELIMINADO
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnDeath = function (deadName) {
        var d = gameState.characters[deadName];
        if (!d) return;

        // ── GEMA DE VITALIDAD: cura 50% del HP máx a los aliados y disipa debuffs ──
        if (hasRelic(deadName, 'elfr_gema_vitalidad')) {
            aliveOnTeam(d.team).forEach(function (n) {
                var c = gameState.characters[n];
                if (typeof applyHeal === 'function') applyHeal(n, Math.floor((c.maxHp || 0) * 0.50));
                c.statusEffects = (c.statusEffects || []).filter(function (e) { return !(e && e.type === 'debuff' && !e.permanent); });
            });
            addLog('💎 Gema de Vitalidad: el equipo aliado se cura el 50% y disipa sus debuffs', 'buff');
        }

        // ── CAPA NAMEKIANA: 10 cargas a todos los aliados ──
        if (hasRelic(deadName, 'elfr_capa_namekiana')) {
            aliveOnTeam(d.team).forEach(function (n) { grantCharges(n, 10); });
            addLog('🟢 Capa Namekiana: el equipo aliado gana 10 cargas', 'buff');
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: el portador TOMA su turno (Corona de los no muertos)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnTurnStart = function (charName) {
        if (!hasRelic(charName, 'elfr_corona_no_muertos')) return;
        var c = gameState.characters[charName];
        if (!c) return;
        var enemies = aliveEnemiesOf(c.team);
        if (!enemies.length) return;
        var best = enemies.reduce(function (a, b) {
            return (gameState.characters[a].hp || 0) >= (gameState.characters[b].hp || 0) ? a : b;
        });
        var heal = Math.max(1, Math.floor((gameState.characters[best].hp || 0) * 0.10));
        if (typeof applyHeal === 'function') applyHeal(charName, heal);
        addLog('👑 Corona de los no muertos: ' + charName + ' se cura ' + heal + ' HP (10% del HP de ' + best + ')', 'buff');
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: inicio de ronda
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnRoundStart = function () {
        // Reset del contador por ronda del Mangual
        Object.keys(gameState.characters).forEach(function (n) {
            var c = gameState.characters[n];
            if (c) c._elfrMangualUses = 0;
        });

        // ── ESCUDO ARCANTOS: 1 contador propio al inicio de la partida y
        //    1 contador a un enemigo aleatorio cada ronda ──
        holdersOf('elfr_escudo_arcantos').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c._elfrArcantosInit) { c._elfrArcantosInit = true; c._elfrArcantos = (c._elfrArcantos || 0) + 1; }
            var es = aliveEnemiesOf(c.team);
            if (es.length) {
                var tgt = randomFrom(es);
                var tc = gameState.characters[tgt];
                tc._elfrArcantos = (tc._elfrArcantos || 0) + 1;
                addLog('🔵 Escudo Arcantos: contador colocado en ' + tgt + ' (' + tc._elfrArcantos + ')', 'debuff');
            }
        });

        // ── MÁSCARA DE NIGROMANTE: invoca 2 Esqueletos ──
        holdersOf('elfr_mascara_nigromante').forEach(function (n) {
            var c = gameState.characters[n];
            var live = Object.values(gameState.summons || {}).filter(function (s) {
                return s && s.name === 'Esqueleto' && s.summoner === n && s.hp > 0;
            }).length;
            var toSummon = Math.max(0, 2 - live);
            for (var i = 0; i < toSummon; i++) {
                if (typeof summonShadow === 'function') summonShadow('Esqueleto', n, c.team);
            }
            if (toSummon > 0) addLog('💀 Máscara de Nigromante: ' + n + ' invoca ' + toSummon + ' Esqueleto(s)', 'buff');
        });

        // ── PISTOLA DE CHISPA ZAFKEI: solo en la RONDA 1, 3 básicos ST ──
        if (gameState.currentRound === 1) {
            holdersOf('elfr_pistola_zafkei').forEach(function (n) {
                var c = gameState.characters[n];
                var basic = (c.abilities || []).find(function (a) { return a && a.type === 'basic'; });
                if (!basic || basic.target !== 'single') return;
                addLog('🔫 Pistola de Chispa Zafkei: ' + n + ' abre la partida con 3 disparos', 'buff');
                for (var i = 0; i < 3; i++) {
                    var es = aliveEnemiesOf(c.team);
                    if (!es.length) break;
                    var tgt = randomFrom(es);
                    var prevSel = gameState.selectedCharacter, prevAb = gameState.selectedAbility;
                    var prevSup = gameState._suppressAutoEndTurn;
                    gameState.selectedCharacter = n;
                    gameState.selectedAbility = basic;
                    gameState.adjustedCost = 0;
                    passiveExecuting = true;
                    gameState._suppressAutoEndTurn = true;
                    try {
                        if (typeof window.hordaExecuteAbility === 'function' && String(basic.effect).indexOf('horda_') === 0) {
                            window.hordaExecuteAbility(basic, n, tgt, c, basic.damage);
                        } else if (typeof window.elfosExecuteAbility === 'function' && String(basic.effect).indexOf('elfos_') === 0) {
                            window.elfosExecuteAbility(basic, n, tgt);
                        } else if (typeof _executeAbilityCore === 'function') {
                            _executeAbilityCore(tgt);
                        }
                    } catch (e) { console.error('[Pistola Zafkei]', e); }
                    passiveExecuting = false;
                    gameState._suppressAutoEndTurn = prevSup;
                    gameState.selectedCharacter = prevSel;
                    gameState.selectedAbility = prevAb;
                }
            });
        }

        // ── GREBAS OSCURAS: +15 HP máx (una sola vez) ──
        holdersOf('elfr_grebas_oscuras').forEach(function (n) {
            var c = gameState.characters[n];
            if (!c._elfrGrebasInit) {
                c._elfrGrebasInit = true;
                c.maxHp = (c.maxHp || 0) + 15;
                c.hp = (c.hp || 0) + 15;
            }
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: fin de ronda
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnRoundEnd = function () {
        // ── NEKROVUS: 50% de robar 1 HP y 1 carga de cada enemigo (x2 con <50% HP) ──
        holdersOf('elfr_nekrovus').forEach(function (n) {
            if (Math.random() >= 0.50) return;
            var c = gameState.characters[n];
            var mult = ((c.hp || 0) < (c.maxHp || 1) * 0.50) ? 2 : 1;
            var totalHp = 0, totalCh = 0;
            aliveEnemiesOf(c.team).forEach(function (en) {
                var ec = gameState.characters[en];
                var hp = Math.min(1 * mult, ec.hp || 0);
                if (hp > 0 && typeof applyDamageWithShield === 'function') {
                    applyDamageWithShield(en, hp, n);
                    totalHp += hp;
                }
                var ch = Math.min(1 * mult, ec.charges || 0);
                ec.charges = Math.max(0, (ec.charges || 0) - ch);
                totalCh += ch;
            });
            if (totalHp > 0 && typeof applyHeal === 'function') applyHeal(n, totalHp);
            if (totalCh > 0) grantCharges(n, totalCh);
            if (totalHp > 0 || totalCh > 0) {
                addLog('📜 Nekrovus: ' + n + ' roba ' + totalHp + ' HP y ' + totalCh + ' cargas' + (mult > 1 ? ' (duplicado por HP bajo)' : ''), 'buff');
            }
        });

        // ── CAPUCHA DEL ASESINO DE LA NOCHE: limpia 1 debuff del portador ──
        holdersOf('elfr_capucha_asesino').forEach(function (n) {
            var c = gameState.characters[n];
            var dbs = (c.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.permanent; });
            if (dbs.length > 0) {
                var i = c.statusEffects.indexOf(dbs[0]);
                if (i >= 0) {
                    c.statusEffects.splice(i, 1);
                    addLog('🥷 Capucha del Asesino: ' + n + ' limpia 1 debuff', 'buff');
                }
            }
        });

        // ── GREBAS OSCURAS: con ≤20% de HP, Escudo del 20% del HP máx ──
        holdersOf('elfr_grebas_oscuras').forEach(function (n) {
            var c = gameState.characters[n];
            if ((c.hp || 0) <= (c.maxHp || 1) * 0.20) {
                var sh = Math.max(1, Math.floor((c.maxHp || 0) * 0.20));
                addShield(n, sh);
                addLog('🦿 Grebas Oscuras: ' + n + ' gana Escudo de ' + sh + ' HP (HP bajo)', 'buff');
            }
        });
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: una INVOCACIÓN recibió daño (Máscara de Nigromante)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrOnSummonDamaged = function (summonId, damage) {
        var s = (gameState.summons || {})[summonId];
        if (!s || !s.summoner || damage <= 0) return;
        if (s.name !== 'Esqueleto') return;
        var owner = gameState.characters[s.summoner];
        if (!owner || !hasRelic(s.summoner, 'elfr_mascara_nigromante')) return;

        if ((owner.hp || 0) < (owner.maxHp || 0)) {
            if (typeof applyHeal === 'function') applyHeal(s.summoner, damage);
            addLog('💀 Máscara de Nigromante: ' + s.summoner + ' recupera ' + damage + ' HP del daño del Esqueleto', 'buff');
        } else {
            var es = aliveEnemiesOf(owner.team);
            if (es.length && typeof applyDamageWithShield === 'function') {
                var tgt = randomFrom(es);
                applyDamageWithShield(tgt, damage, s.summoner);
                addLog('💀 Máscara de Nigromante: HP al máximo — ' + damage + ' de daño redirigido a ' + tgt, 'damage');
            }
        }
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: ¿el portador ignora Provocación? (Capucha del Asesino de la noche)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrIgnoresTaunt = function (charName) {
        return hasRelic(charName, 'elfr_capucha_asesino');
    };

    // ══════════════════════════════════════════════════════════════════════
    // HOOK: multiplicador de robo de HP (Maza Necrótica)
    // ══════════════════════════════════════════════════════════════════════
    window.elfrLifestealMultiplier = function (charName) {
        return hasRelic(charName, 'elfr_maza_necrotica') ? 1.5 : 1;
    };
})();
