// ==================== PROCESAMIENTO DE EFECTOS DE ESTADO ====================
        function processRegenerationEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            
            const regenEffects = char.statusEffects.filter(e => e && e.name === 'Regeneracion');
            if (regenEffects.length > 0) {
                regenEffects.forEach(regen => {
                    // Support both flat amount and percent-based healing
                    let healAmount;
                    if (regen.amount) {
                        healAmount = regen.amount;
                    } else if (regen.percent) {
                        healAmount = Math.ceil(char.maxHp * (regen.percent / 100));
                    } else {
                        healAmount = 2;
                    }
                    const oldHp = char.hp;
                    char.hp = Math.min(char.maxHp, char.hp + healAmount);
                    const actualHeal = char.hp - oldHp;
                    
                    if (actualHeal > 0) {
                        addLog(`💖 ${charName} recuperó ${actualHeal} HP por Regeneración`, 'heal');
                        // Activar pasiva de Min Byung si está en el equipo
                        triggerBendicionSagrada(char.team, actualHeal);
                        // HECHIZO DE SANGRE (Tamayo): 50% de confusión a enemigo aleatorio en cada tick
                        if (regen.hechizoDeSangre) {
                            if (Math.random() < 0.5) {
                                const enemyTeamHS = char.team === 'team1' ? 'team2' : 'team1';
                                const enemiesHS = Object.keys(gameState.characters).filter(n => {
                                    const c = gameState.characters[n];
                                    return c && c.team === enemyTeamHS && !c.isDead && c.hp > 0;
                                });
                                if (enemiesHS.length > 0) {
                                    const targetHS = enemiesHS[Math.floor(Math.random() * enemiesHS.length)];
                                    applyConfusion(targetHS, 1);
                                    addLog(`🩸 Hechizo de Sangre: tick de Regeneración aplica Confusión a ${targetHS}`, 'debuff');
                                }
                            }
                        }
                    }
                });
            }
        }

        function processBurnEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            const burnEffects = char.statusEffects.filter(e => e && e.name === 'Quemadura');
            if (burnEffects.length === 0) return;
            const totalPct = burnEffects.reduce(function(sum, b){ return sum + (b.percent || 0); }, 0);
            let damage = Math.ceil(char.maxHp * (totalPct / 100));
            damage = applyTuskPassive(charName, damage);
            if (damage > 0) {
                // Pass charName as attackerName=null but use helper that allows Ragnar passive
                const oldHp = char.hp;
                applyDamageWithShield(charName, damage, null);
                addLog('🔥 ' + charName + ' recibe ' + damage + ' de daño por Quemadura (' + totalPct + '%)', 'damage');
                // Ragnar passive already fires inside applyDamageWithShield now (attackerName check removed)
                // RENGOKU PASIVA: Corazón Ardiente — genera 1 carga por tick de quemadura en cualquier enemigo
                const rengoku = gameState.characters['Rengoku'];
                if (rengoku && !rengoku.isDead && rengoku.hp > 0 && rengoku.team !== char.team) {
                    rengoku.charges = Math.min(20, (rengoku.charges || 0) + 1);
                    addLog('🔥 Corazón Ardiente: Rengoku genera 1 carga (quemadura en enemigo)', 'buff');
                }
            }
        }

        function processNewDebuffEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;

            // VENENO: stackeable — cada stack hace daño creciente por turno
            const allPoison = char.statusEffects.filter(e => e && normAccent(e.name||'') === 'veneno');
            if (allPoison.length > 0) {
                let totalVenenoDmg = 0;
                let hasChargeDrain = false;
                allPoison.forEach(function(poisonEffect) {
                    poisonEffect.poisonTick = (poisonEffect.poisonTick || 0) + 1;
                    totalVenenoDmg += poisonEffect.poisonTick;
                    if (poisonEffect.poisonChargeDrain) hasChargeDrain = true;
                });
                applyDamageWithShield(charName, totalVenenoDmg, null);
                addLog('☠️ ' + charName + ' recibe ' + totalVenenoDmg + ' de daño por Veneno', 'damage');
                // PROGENITOR DEMONIACO (Muzan): genera 1 carga cuando veneno hace daño
                const muzanP = gameState.characters['Muzan Kibutsuji'];
                if (muzanP && !muzanP.isDead && muzanP.hp > 0 && muzanP.team !== (gameState.characters[charName] && gameState.characters[charName].team)) {
                    muzanP.charges = Math.min(20, (muzanP.charges || 0) + 1);
                    addLog('🩸 Progenitor Demoniaco: Muzan genera 1 carga (veneno activo)', 'buff');
                }
                // LAZO DIVINO (Goku Black): 50% chance de drenar 2 cargas por tick
                if (hasChargeDrain && Math.random() < 0.5) {
                    const victim = gameState.characters[charName];
                    if (victim && victim.charges > 0) {
                        victim.charges = Math.max(0, victim.charges - 2);
                        addLog('🌀 Lazo Divino: ' + charName + ' pierde 2 cargas por el veneno', 'damage');
                    }
                }
            }
        }

        function processSolarBurnEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            if (hasStatusEffect(charName, 'Proteccion Sagrada')) return;
            const solarEffects = char.statusEffects.filter(e => e && e.name === 'Quemadura Solar');
            if (solarEffects.length === 0) return;
            const totalPercent = solarEffects.reduce((sum, e) => sum + (e.percent || 0), 0);
            const damage = Math.ceil(char.maxHp * (totalPercent / 100));
            if (damage > 0) {
                applyDamageWithShield(charName, damage, null);
                addLog(`☀️ ${charName} recibe ${damage} de daño por Quemadura Solar (${totalPercent}%)`, 'damage');
                // Quemadura Solar: pierde 1 carga por cada tick
                if (char.charges > 0) {
                    char.charges = Math.max(0, char.charges - 1);
                    addLog(`☀️ Quemadura Solar: ${charName} pierde 1 carga`, 'damage');
                }
                // SPHINX WEHEM-MESUT: cada vez que un enemigo recibe daño de QS, pierde 2 cargas adicionales
                const sphinx = Object.values(gameState.summons).find(s => s && s.name === 'Sphinx Wehem-Mesut' && s.team !== char.team);
                if (sphinx) {
                    char.charges = Math.max(0, char.charges - 2);
                    addLog(`🦁 Sphinx Wehem-Mesut: ${charName} pierde 2 cargas por Quemadura Solar`, 'damage');
                }
                // RAMESSEUM TENTYRIS: todos los aliados del Ramesseum recuperan 1 HP
                const ram = Object.values(gameState.summons).find(s => s && s.name === 'Ramesseum Tentyris' && s.team !== char.team);
                if (ram) {
                    const ramTeam = ram.team;
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === ramTeam && !c.isDead && c.hp > 0 && c.hp < c.maxHp) {
                            c.hp = Math.min(c.maxHp, c.hp + 1);
                        }
                    }
                    addLog(`🏛️ Ramesseum Tentyris: aliados recuperan 1 HP`, 'heal');
                }
                // PROGENITOR DEMONIACO (Muzan): genera 1 carga cada vez que veneno/QS hace daño -- handled in poison, this is solar
                // MUZAN: 1 carga si fue su veneno (not solar, handled separately)
                const muzan = gameState.characters['Muzan Kibutsuji'];
                if (muzan && !muzan.isDead && muzan.hp > 0) {
                    // Muzan gains 1 charge if solar burn does damage on enemy
                    if (muzan.team !== char.team) {
                        muzan.charges += 1;
                    }
                }
            }
        }

        function updateStatusEffectDurations(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            
            char.statusEffects = char.statusEffects.map(effect => {
                if (effect && effect.duration !== undefined && !effect.untilRoundEnd && !effect.permanent) effect.duration--;
                return effect;
            }).filter(effect => {
                if (!effect) return false;
                if (effect.permanent) return true; // Nunca expiran los buffs permanentes
                if (effect.untilRoundEnd) return true;
                if (effect.duration <= 0) {
                    // PALPATINE PASSIVE: when an enemy debuff expires, 50% chance to stun them
                    if (effect.type === 'debuff') {
                        const palChar = gameState.characters['Emperador Palpatine'];
                        const thisChar = gameState.characters[charName];
                        if (palChar && !palChar.isDead && palChar.hp > 0 && thisChar && palChar.team !== thisChar.team) {
                            if (Math.random() < 0.5) {
                                applyStun(charName, 1);
                                addLog('⚡ Emperador de la Galaxia: ' + charName + ' aturdido al expirar ' + effect.name, 'damage');
                            }
                        }
                    }
                    const nname = normAccent(effect.name || '');
                    // Limpiar Forma Dragón de Alexstrasza cuando Escudo Sagrado expira
                    if (nname === 'escudo sagrado' && charName === 'Alexstrasza') {
                        char.dragonFormActive = false;
                        addLog(`🐉 Alexstrasza vuelve a su forma normal`, 'info');
                    }
                    // Restaurar velocidad si era congelacion
                    if ((nname === 'congelacion' || nname === 'mega congelacion') && effect.speedPenalty) {
                        char.speed = Math.round(char.speed / (1 - effect.speedPenalty));
                        addLog(`${effect.emoji || '❄️'} ${charName} se descongela (velocidad restaurada)`, 'buff');
                    }
                    // Restaurar velocidad si era celeridad
                    if (nname === 'celeridad' && effect.speedBonus) {
                        char.speed = Math.max(1, char.speed - effect.speedBonus);
                        addLog(`💨 Celeridad de ${charName} expira (velocidad restaurada)`, 'info');
                    }
                    return false;
                }
                return true;
            });
        }

        function applyBurn(targetName, percent, duration) {
            const target = gameState.characters[targetName];
            if (!target) {
                console.error(`applyBurn: Target ${targetName} no encontrado`);
                return;
            }
            // Guard: never apply burns with 0% or undefined percent
            const validPct = (typeof percent === 'number' && percent > 0) ? percent : null;
            if (!validPct) {
                console.warn(`applyBurn: percent inválido (${percent}) para ${targetName} — ignorado`);
                return;
            }
            if (!target.statusEffects) {
                target.statusEffects = [];
            }
            target.statusEffects.push({
                name: 'Quemadura',
                type: 'debuff',
                percent: validPct,
                duration: duration
            });
            addLog(`🔥 ${targetName} ha sido quemado (${validPct}% por ${duration} turno${duration > 1 ? 's' : ''})`, 'debuff');
        }

        // Normaliza tildes para comparaciones de efectos
        function normAccent(s) {
            return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        }

        // Cap charges at MAX 20 for any character
        function capCharges(charObj) {
            if (charObj && charObj.charges > 20) charObj.charges = 20;
        }
        function addCharges(charObj, amount) {
            if (!charObj) return;
            charObj.charges = Math.min(20, (charObj.charges || 0) + amount);
        }


        function hasStatusEffect(charName, effectName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return false;
            const normTarget = normAccent(effectName);
            return char.statusEffects.some(e => e && normAccent(e.name) === normTarget);
        }
