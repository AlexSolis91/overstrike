// ==================== IA ENGINE ====================
        function executeAITurn(charName) {
            try {
                const char = gameState.characters[charName];
                if (!char || char.isDead || char.hp <= 0) { endTurn(); return; }
                // Safety: re-check key debuffs in case AI was called directly
                // (normally handled by continueTurn, but guard here too)
                if (char.statusEffects) {
                    const stunned = char.statusEffects.some(e => e && (normAccent(e.name||'') === 'aturdimiento' || normAccent(e.name||'') === 'mega aturdimiento'));
                    if (stunned) { addLog('⭐ ' + (gameState.gameMode !== 'ranked' ? '[IA] ' : '') + charName + ' está aturdido y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Mega Congelacion')) { addLog('🧊 ' + (gameState.gameMode !== 'ranked' ? '[IA] ' : '') + charName + ' está Mega Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Congelacion') && Math.random() < 0.5) { addLog('❄️ ' + (gameState.gameMode !== 'ranked' ? '[IA] ' : '') + charName + ' está Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Miedo') && Math.random() < 0.5) { addLog('😱 ' + (gameState.gameMode !== 'ranked' ? '[IA] ' : '') + charName + ' está paralizado por el Miedo', 'damage'); endTurn(); return; }
                }

                const myTeam = char.team;
                const enemyTeam = myTeam === 'team1' ? 'team2' : 'team1';

                // ── Helpers ──────────────────────────────────────────────────
                function getAliveAllies() {
                    return Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === myTeam && !c.isDead && c.hp > 0;
                    });
                }
                function getAliveEnemies() {
                    return Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === enemyTeam && !c.isDead && c.hp > 0 &&
                            !(c.statusEffects && c.statusEffects.some(e => e && normAccent(e.name||'') === 'sigilo'));
                    });
                }
                function getUsableAbilities() {
                    return char.abilities.filter(ab => !ab.used && char.charges >= ab.cost);
                }
                function hpPct(n) {
                    const c = gameState.characters[n]; return c ? c.hp / c.maxHp : 1;
                }
                function hasDebuff(n, dbName) { return hasStatusEffect(n, dbName); }
                function hasBuff(n, bName) { return hasStatusEffect(n, bName); }
                function summonPresent(sName, team) {
                    return Object.values(gameState.summons).some(s => s && s.name === sName && s.team === team);
                }

                const allies = getAliveAllies();
                const enemies = getAliveEnemies();
                const usable = getUsableAbilities();

                if (enemies.length === 0 || usable.length === 0) { endTurn(); return; }

                // ── Priority scoring system (HARD MODE AI) ───────────────────────────────────
                // SUPPORT characters — AI focuses on killing these
                const SUPPORT_EFFECTS = ['heal', 'don_de_la_vida', 'regen', 'shield', 'summon',
                    'el_rey_caido', 'summon_sphinx', 'summon_ramesseum', 'summon_dragon',
                    'arise_summon', 'enkidu', 'dispel_target_padme_charges', 'summon_señuelo'];
                function isSupportChar(name) {
                    const c = gameState.characters[name];
                    if (!c || !c.abilities) return false;
                    return c.abilities.some(function(ab) {
                        return SUPPORT_EFFECTS.some(function(eff) { return (ab.effect||'').includes(eff); })
                            || ab.target === 'ally_single';
                    });
                }
                // Ability tier rank: over=3, special=2, basic=1
                function abilityTier(ab) {
                    if (ab.type === 'over') return 3;
                    if (ab.type === 'special') return 2;
                    return 1;
                }
                function scoreAbility(ab) {
                    let score = 0;
                    // ── TIER BONUS: always prefer higher tier ──────────────────
                    score += abilityTier(ab) * 120; // over=360, special=240, basic=120

                    // === CLEANSE / DISPEL (highest support priority when allies have debuffs) ===
                    const CLEANSE_EFFECTS = ['heal_cleanse', 'aoe_cleanse_allies', 'dispel_heal_allies',
                        'grito_de_esparta', 'dispel_target_padme_charges'];
                    const _allyDebuffCount = allies.reduce(function(sum, n) {
                        const c = gameState.characters[n];
                        return sum + (c && c.statusEffects ? c.statusEffects.filter(function(e) { return e && e.type === 'debuff'; }).length : 0);
                    }, 0);
                    if (CLEANSE_EFFECTS.includes(ab.effect) || (ab.effect && ab.effect.includes('cleanse'))) {
                        // High priority if allies have debuffs
                        score += _allyDebuffCount >= 3 ? 200 : _allyDebuffCount >= 1 ? 120 : 10;
                    }

                    // === HEALING / SUPPORT ===
                    if (ab.target === 'ally_single' || ab.target === 'self') {
                        const lowestAlly = allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        const lowestPct = hpPct(lowestAlly);
                        if (ab.effect && (ab.effect.includes('heal') || ab.effect === 'don_de_la_vida')) {
                            score += lowestPct < 0.35 ? 90 : lowestPct < 0.60 ? 50 : 20;
                        }
                        if (ab.shieldAmount) score += lowestPct < 0.4 ? 65 : 30;
                        if (ab.effect && (ab.effect.includes('regen') || ab.effect === 'leyenda_nordica')) score += 40;
                        if (ab.effect === 'grito_de_esparta') {
                            const anyDebuffed = allies.some(n => gameState.characters[n].statusEffects.some(e => e && e.type === 'debuff'));
                            score += anyDebuffed ? 85 : 25;
                        }
                        if (ab.effect === 'ultra_instinto') score += char.ultraInstinto ? -999 : 70;
                        if (ab.effect === 'poder_del_anillo') score += char.sauronTransformed ? -999 : 65;
                        if (ab.effect === 'muzan_transform') score += char.muzanTransformed ? -999 : 60;
                        if (ab.effect === 'kaio_ken') score += 55;
                    }

                    // === DAMAGE ===
                    if (ab.damage > 0) {
                        score += ab.damage * 5;
                        // AOE: bonus when multiple enemies
                        if (ab.target === 'aoe' && enemies.length >= 2) score += 25 * enemies.length;
                        // blood_eagle execute
                        if (ab.effect === 'blood_eagle') {
                            const weakEnemy = enemies.find(n => hpPct(n) <= 0.5);
                            if (weakEnemy) score += 70;
                        }
                        // Debuff-applying attacks bonus
                        if (ab.effect && (ab.effect.includes('poison') || ab.effect.includes('burn') ||
                            ab.effect.includes('bleed') || ab.effect.includes('freeze') ||
                            ab.effect.includes('stun') || ab.effect.includes('fear'))) score += 25;
                        if (ab.effect === 'enuma_elish') {
                            const shielded = enemies.filter(n => (gameState.characters[n].shield||0) > 0);
                            score += shielded.length > 0 ? 45 : 0;
                        }
                        if (ab.effect === 'golpe_grave') score += enemies.some(n => hpPct(n) <= 0.6) ? 55 : 20;
                    }

                    // === DEBUFFS (0-damage) ===
                    if (ab.damage === 0 && (ab.target === 'single' || ab.target === 'aoe')) {
                        if (ab.effect === 'apply_mega_stun') score += 75;
                        if (ab.effect === 'apply_possession_1' || ab.effect === 'apply_possession') score += 60;
                        if (ab.effect === 'apply_confusion') score += 50;
                        if (ab.effect === 'apply_fear_1') score += 45;
                        if (ab.effect === 'apply_counterattack') score += 40;
                        if (ab.effect === 'apply_megaprovocation_buff') score += 55;
                        if (ab.effect === 'purgatorio_v2') score += 80;
                    }

                    // === SUMMONS ===
                    if (ab.effect === 'el_rey_caido') score += summonPresent('Sindragosa', myTeam) ? 20 : 75;
                    if (ab.effect === 'summon_sphinx') score += summonPresent('Sphinx Wehem-Mesut', myTeam) ? -200 : 60;
                    if (ab.effect === 'summon_ramesseum') score += summonPresent('Ramesseum Tentyris', myTeam) ? -200 : 55;
                    if (ab.effect === 'arise_summon') {
                        const teamSummonCount = Object.values(gameState.summons).filter(s => s && s.team === myTeam).length;
                        score += teamSummonCount < 4 ? 65 : 10;
                    }
                    if (ab.effect === 'enkidu') {
                        const hasSummons = Object.values(gameState.summons).some(s => s && s.team === enemyTeam);
                        score += hasSummons ? 90 : 10;
                    }
                    if (ab.effect === 'cadenas_hielo') score += enemies.some(n => gameState.characters[n].charges >= 5) ? 65 : 25;

                    // === Can't afford: penalize heavily ===
                    if (ab.type !== 'basic' && char.charges < ab.cost) score -= 999;

                    // === Prefer cheaper abilities when very low charges ===
                    if (char.charges < 3 && ab.type !== 'basic') score -= (ab.cost - char.charges) * 10;

                    return score;
                }

                // Pick best ability (highest score = highest tier + most damage)
                usable.sort((a,b) => scoreAbility(b) - scoreAbility(a));
                const chosen = usable[0];

                // ── Pick target (HARD MODE: focus vulnerable + support enemies) ─────────
                function pickTarget(ab) {
                    if (ab.target === 'self' || ab.target === 'aoe') return charName;

                    if (ab.target === 'ally_single') {
                        return allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                    }

                    if (ab.target === 'single') {
                        // Always respect taunt/provocation rules
                        const sauronBypass = sauronIgnoresRestrictions();
                        let aiTauntTarget = null;
                        const aldebaranAI = gameState.characters['Aldebaran'];
                        if (aldebaranAI && aldebaranAI.team === enemyTeam && !aldebaranAI.isDead && aldebaranAI.hp > 0) aiTauntTarget = 'Aldebaran';
                        if (!aiTauntTarget) {
                            const thestalosAI = gameState.characters['Thestalos'];
                            if (thestalosAI && thestalosAI.team === enemyTeam && !thestalosAI.isDead && thestalosAI.hp > 0) aiTauntTarget = 'Thestalos';
                        }
                        if (!aiTauntTarget) {
                            for (let _n in gameState.characters) {
                                const _c = gameState.characters[_n];
                                if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                                if (_c.statusEffects && _c.statusEffects.some(e => e && normAccent(e.name||'') === 'provocacion')) { aiTauntTarget = _n; break; }
                            }
                        }
                        const kamishData = checkKamishMegaProvocation(enemyTeam);
                        if (kamishData && !kamishData.isCharacter && !sauronBypass) return null;
                        if (kamishData && kamishData.isCharacter && !sauronBypass) aiTauntTarget = kamishData.characterName;
                        if (aiTauntTarget && !sauronBypass) return aiTauntTarget;

                        // No taunt — pick smartest target:
                        // Priority 1: Enemy that can be killed this hit
                        const killShot = enemies.find(n => {
                            const c = gameState.characters[n];
                            return c && c.hp > 0 && c.hp <= ab.damage;
                        });
                        if (killShot) return killShot;

                        // Priority 2: Support/healer enemies — take them out first
                        const supportEnemy = enemies.find(n => isSupportChar(n));
                        if (supportEnemy) return supportEnemy;

                        // Priority 3: Most vulnerable (lowest HP %)
                        const mostVulnerable = enemies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        if (hpPct(mostVulnerable) < 0.6) return mostVulnerable;

                        // Priority 4: Highest charge (most dangerous)
                        if (ab.effect === 'apply_mega_stun' || ab.effect === 'cadenas_hielo') {
                            return enemies.reduce((a,b) => (gameState.characters[a].charges||0) > (gameState.characters[b].charges||0) ? a : b);
                        }

                        // Priority 5: Highest damage dealer
                        return enemies.reduce((a,b) => {
                            const dmgA = (gameState.characters[a].abilities||[]).reduce((x,y) => Math.max(x,y.damage||0), 0);
                            const dmgB = (gameState.characters[b].abilities||[]).reduce((x,y) => Math.max(x,y.damage||0), 0);
                            return dmgA >= dmgB ? a : b;
                        });
                    }
                    return enemies[Math.floor(Math.random() * enemies.length)];
                }

                const target = pickTarget(chosen);

                addLog((gameState.gameMode !== 'ranked' ? '🤖 IA (' + charName + ')' : '⚔️ ' + charName) + ' decide usar ' + chosen.name + (target && target !== charName ? ' sobre ' + target : ''), 'info');

                // Execute
                gameState.selectedAbility = chosen;
                gameState.adjustedCost = chosen.cost;

                setTimeout(function() {
                    if (chosen.target === 'aoe' || chosen.target === 'self') {
                        executeAbility(charName);
                    } else if (target) {
                        executeAbility(target);
                    } else {
                        // Kamish redirect or no target
                        endTurn();
                    }
                }, 400);

            } catch(err) {
                console.error('Error en executeAITurn:', err);
                endTurn();
            }
        }
        // ==================== FIN IA ENGINE ====================
