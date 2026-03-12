        // ==================== IA ENGINE ====================
        function executeAITurn(charName) {
            try {
                const char = gameState.characters[charName];
                if (!char || char.isDead || char.hp <= 0) { endTurn(); return; }
                // Safety: re-check key debuffs in case AI was called directly
                // (normally handled by continueTurn, but guard here too)
                if (char.statusEffects) {
                    const stunned = char.statusEffects.some(e => e && (normAccent(e.name||'') === 'aturdimiento' || normAccent(e.name||'') === 'mega aturdimiento'));
                    if (stunned) { addLog('⭐ [IA] ' + charName + ' está aturdido y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Mega Congelacion')) { addLog('🧊 [IA] ' + charName + ' está Mega Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Congelacion') && Math.random() < 0.5) { addLog('❄️ [IA] ' + charName + ' está Congelado y pierde su turno', 'damage'); endTurn(); return; }
                    if (hasStatusEffect(charName, 'Miedo') && Math.random() < 0.5) { addLog('😱 [IA] ' + charName + ' está paralizado por el Miedo', 'damage'); endTurn(); return; }
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

                // ── Priority scoring system ───────────────────────────────────
                // Score each ability (higher = better)
                function scoreAbility(ab) {
                    let score = 0;

                    // === HEALING / SUPPORT ===
                    if (ab.target === 'ally_single' || ab.target === 'self') {
                        // Prioritize healing when hurt
                        const lowestAlly = allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        const lowestPct = hpPct(lowestAlly);
                        if (ab.effect && (ab.effect.includes('heal') || ab.effect === 'don_de_la_vida')) {
                            score += lowestPct < 0.35 ? 90 : lowestPct < 0.60 ? 50 : 20;
                        }
                        // Shields when low HP
                        if (ab.shieldAmount) score += lowestPct < 0.4 ? 65 : 30;
                        // Buffs (regen, protección, etc.)
                        if (ab.effect && (ab.effect.includes('regen') || ab.effect === 'leyenda_nordica')) score += 40;
                        if (ab.effect === 'grito_de_esparta') {
                            // Value highly if any ally has debuffs
                            const anyDebuffed = allies.some(n => gameState.characters[n].statusEffects.some(e => e && e.type === 'debuff'));
                            score += anyDebuffed ? 85 : 25;
                        }
                        if (ab.effect === 'ultra_instinto') score += char.ultraInstinto ? -100 : 70;
                        if (ab.effect === 'poder_del_anillo') score += char.sauronTransformed ? -100 : 65;
                        if (ab.effect === 'muzan_transform') score += 60;
                        if (ab.effect === 'kaio_ken') score += 55;
                    }

                    // === DAMAGE ===
                    if (ab.damage > 0) {
                        // Over abilities: use when lots of charges
                        if (ab.type === 'over') score += char.charges >= ab.cost + 2 ? 80 : 50;
                        else if (ab.type === 'special') score += 55;
                        else score += 30; // basic

                        // Bonus for high-damage abilities
                        score += ab.damage * 4;

                        // AOE vs single: prefer AOE when multiple enemies alive
                        if (ab.target === 'aoe' && enemies.length >= 2) score += 20;

                        // Execute check: blood_eagle — if any enemy ≤50% HP, highly prefer
                        if (ab.effect === 'blood_eagle') {
                            const weakEnemy = enemies.find(n => hpPct(n) <= 0.5);
                            if (weakEnemy) score += 60;
                        }

                        // Prefer abilities that apply debuffs
                        if (ab.effect && (ab.effect.includes('poison') || ab.effect.includes('burn') ||
                            ab.effect.includes('bleed') || ab.effect.includes('freeze') ||
                            ab.effect.includes('stun') || ab.effect.includes('fear'))) score += 20;

                        // Enuma Elish vs targets with shields
                        if (ab.effect === 'enuma_elish') {
                            const shielded = enemies.filter(n => (gameState.characters[n].shield||0) > 0);
                            score += shielded.length > 0 ? 40 : 0;
                        }

                        // Golpe Grave (extra turn)
                        if (ab.effect === 'golpe_grave') score += enemies.some(n => hpPct(n) <= 0.6) ? 50 : 20;
                    }

                    // === DEBUFFS (0-damage) ===
                    if (ab.damage === 0 && ab.target === 'single') {
                        if (ab.effect === 'apply_possession_1' || ab.effect === 'apply_possession') score += 55;
                        if (ab.effect === 'apply_confusion') score += 45;
                        if (ab.effect === 'apply_mega_stun') score += 70;
                        if (ab.effect === 'apply_fear_1') score += 40;
                        if (ab.effect === 'apply_counterattack') score += 35;
                        if (ab.effect === 'apply_megaprovocation_buff') score += 50;
                    }

                    // === SUMMONS ===
                    if (ab.effect === 'el_rey_caido') score += summonPresent('Sindragosa', myTeam) ? 20 : 70;
                    if (ab.effect === 'summon_sphinx') score += summonPresent('Sphinx Wehem-Mesut', myTeam) ? -50 : 55;
                    if (ab.effect === 'summon_ramesseum') score += summonPresent('Ramesseum Tentyris', myTeam) ? -50 : 50;
                    if (ab.effect === 'enkidu') {
                        const hasSummons = Object.values(gameState.summons).some(s => s && s.team === enemyTeam);
                        score += hasSummons ? 80 : 10;
                    }

                    // === Cadenas de Hielo: if enemy has high charges, provoc is strong ===
                    if (ab.effect === 'cadenas_hielo') score += enemies.some(n => gameState.characters[n].charges >= 5) ? 60 : 25;

                    // === Prefer cheaper abilities when low charges ===
                    if (char.charges < 4 && ab.type !== 'basic') score -= (ab.cost - char.charges) * 8;

                    return score;
                }

                // Pick best ability
                usable.sort((a,b) => scoreAbility(b) - scoreAbility(a));
                const chosen = usable[0];

                // ── Pick target ───────────────────────────────────────────────
                function pickTarget(ab) {
                    if (ab.target === 'self' || ab.target === 'aoe') return charName;

                    if (ab.target === 'ally_single') {
                        // Heal/shield: pick most hurt ally
                        return allies.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                    }

                    if (ab.target === 'single') {
                        // Mirror exact provocation logic from showTargetSelection
                        const sauronBypass = sauronIgnoresRestrictions();
                        let aiTauntTarget = null;

                        // 1. Aldebaran pasiva: siempre activa si está vivo en el equipo enemigo
                        const aldebaranAI = gameState.characters['Aldebaran'];
                        if (aldebaranAI && aldebaranAI.team === enemyTeam && !aldebaranAI.isDead && aldebaranAI.hp > 0) {
                            aiTauntTarget = 'Aldebaran';
                        }
                        // 1b. Thestalos pasiva: Provocación permanente igual que Aldebaran
                        if (!aiTauntTarget) {
                            const thestalosAI = gameState.characters['Thestalos'];
                            if (thestalosAI && thestalosAI.team === enemyTeam && !thestalosAI.isDead && thestalosAI.hp > 0) {
                                aiTauntTarget = 'Thestalos';
                            }
                        }
                        // 2. Buff Provocación en cualquier personaje enemigo
                        if (!aiTauntTarget) {
                            for (let _n in gameState.characters) {
                                const _c = gameState.characters[_n];
                                if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                                if (_c.statusEffects && _c.statusEffects.some(e => e && normAccent(e.name||'') === 'provocacion')) {
                                    aiTauntTarget = _n; break;
                                }
                            }
                        }
                        // 3. MegaProvocación (personaje con buff o invocación)
                        const kamishData = checkKamishMegaProvocation(enemyTeam);
                        if (kamishData && !kamishData.isCharacter && !sauronBypass) {
                            return null; // Kamish summon absorbs — let executeAbility handle it
                        }
                        if (kamishData && kamishData.isCharacter && !sauronBypass) {
                            aiTauntTarget = kamishData.characterName;
                        }
                        if (aiTauntTarget && !sauronBypass) return aiTauntTarget;

                        // blood_eagle: prefer target ≤50% HP
                        if (ab.effect === 'blood_eagle') {
                            const weak = enemies.filter(n => hpPct(n) <= 0.5);
                            if (weak.length > 0) return weak.reduce((a,b) => hpPct(a) < hpPct(b) ? a : b);
                        }

                        // apply_mega_stun/stun debuffs: prefer highest charge enemy
                        if (ab.effect === 'apply_mega_stun' || ab.effect === 'cadenas_hielo') {
                            return enemies.reduce((a,b) => (gameState.characters[a].charges||0) > (gameState.characters[b].charges||0) ? a : b);
                        }

                        // Possession/Confusion: prefer highest-damage enemy
                        if (ab.effect === 'apply_possession_1' || ab.effect === 'apply_possession' || ab.effect === 'apply_confusion') {
                            return enemies.reduce((a,b) => {
                                const dmgA = (gameState.characters[a].abilities || []).reduce((x,y) => Math.max(x, y.damage||0), 0);
                                const dmgB = (gameState.characters[b].abilities || []).reduce((x,y) => Math.max(x, y.damage||0), 0);
                                return dmgA > dmgB ? a : b;
                            });
                        }

                        // Default: random enemy target (avoids predictable behavior)
                        const shuffledEnemies = enemies.slice().sort(() => Math.random() - 0.5);
                        return shuffledEnemies[0];
                    }
                    // Random fallback
                    return enemies[Math.floor(Math.random() * enemies.length)];
                }

                const target = pickTarget(chosen);

                addLog('🤖 IA (' + charName + ') decide usar ' + chosen.name + (target && target !== charName ? ' sobre ' + target : ''), 'info');

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
