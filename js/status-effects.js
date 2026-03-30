// ==================== PROCESAMIENTO DE EFECTOS DE ESTADO ====================
        function processRegenerationEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            
            // QUEMADURA SOLAR: no puede recuperar HP de ninguna fuente
            if ((char.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'quemadura solar')) {
                addLog('☀️ Quemadura Solar: ' + charName + ' no puede recuperar HP (Regeneración bloqueada)', 'debuff');
                return;
            }

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
                        // PRESENCIA OSCURA (Darth Vader): +1 carga cuando enemigo recupera HP
                        if (typeof triggerPresenciaOscura === 'function') triggerPresenciaOscura(charName);
                        // TESORO DEL CIELO sub-pasiva: cuando Shaka recupera HP, aplica debuff aleatorio a enemigo aleatorio
                        if (char.passive && char.passive.name === 'Tesoro del Cielo') {
                            if (typeof triggerShakaHealDebuff === 'function') triggerShakaHealDebuff(charName);
                        }
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

        

        function triggerDaenerysPassiveBurnHeal(charName) {
            // Dinastía del Dragón: cura 1 HP a Daenerys cuando un burn es bloqueado/limpiado
            const dae = gameState.characters['Daenerys Targaryen'];
            if (!dae || dae.isDead || dae.hp <= 0) return;
            const oldHpDae = dae.hp;
            dae.hp = Math.min(dae.maxHp, dae.hp + 1);
            if (dae.hp > oldHpDae) {
                addLog('🐉 Dynastía del Dragón: Daenerys recupera 1 HP (inmunidad a Quemadura)', 'heal');
            }
        }
        function applyFlatBurn(targetName, flatHp, duration) {
            // Apply a burn that does flat HP damage (not percent)
            const target = gameState.characters[targetName];
            if (!target) return;
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) {
                addLog('🦸 Saitama es inmune a Quemadura (Espíritu del Héroe)', 'buff');
                return;
            }
            // DAENERYS - Dinastía del Dragón: inmune a Quemadura y Quemadura Solar
            if ((targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2')) {
                addLog('🐉 Dynastía del Dragón: Daenerys es inmune a Quemadura', 'buff');
                triggerDaenerysPassiveBurnHeal('Daenerys Targaryen');
                return;
            }
            // DONCELLA ESCUDERA (Lagertha): 50% de esquivar Quemadura
            if (target.passive && target.passive.name === 'Doncella Escudera') {
                if (Math.random() < 0.50) {
                    addLog('🛡️ Doncella Escudera: Lagertha esquiva Quemadura (50%)', 'buff');
                    return;
                }
            }
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) {
                addLog('🛡️ ' + targetName + ' es inmune a Quemadura (Protección Sagrada)', 'buff');
                return;
            }
            if (!target.statusEffects) target.statusEffects = [];
            target.statusEffects.push({
                name: 'Quemadura', type: 'debuff',
                flatHp: flatHp, percent: 0, duration: duration || 1, emoji: '🔥'
            });
            // PADME Negociaciones Hostiles: aliado recibe quemadura → Padme +1 carga
            (function() {
                const _padme = gameState.characters['Padme Amidala'] ||
                    Object.values(gameState.characters).find(c => c && c.passive && c.passive.name === 'Negociaciones Hostiles' && !c.isDead);
                if (_padme && !_padme.isDead && _padme.hp > 0) {
                    const _tgt = gameState.characters[targetName];
                    if (_tgt && _tgt.team === _padme.team) {
                        _padme.charges = Math.min(20, (_padme.charges || 0) + 1);
                        addLog('🌹 Negociaciones Hostiles: Padmé gana 1 carga (' + _padme.charges + ')', 'buff');
                    }
                }
            })();
            addLog('🔥 ' + targetName + ' sufre Quemadura ' + flatHp + ' HP por ' + (duration||1) + ' turno(s)', 'damage');
            // IZANAMI: trigger Part B when Quemadura is applied to an ally
            if (typeof triggerIzanamiPartB === 'function') triggerIzanamiPartB(targetName);
        }
function processBurnEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            // DAENERYS: immune to Quemadura — remove any that slipped through and heal
            if ((charName === 'Daenerys Targaryen' || charName === 'Daenerys Targaryen v2')) {
                const burnsBefore = char.statusEffects.filter(e => e && e.name === 'Quemadura').length;
                char.statusEffects = char.statusEffects.filter(e => !e || e.name !== 'Quemadura');
                if (burnsBefore > 0 && typeof triggerDaenerysPassiveBurnHeal === 'function') triggerDaenerysPassiveBurnHeal(charName);
                return;
            }
            const burnEffects = char.statusEffects.filter(e => e && e.name === 'Quemadura');
            if (burnEffects.length === 0) return;
            // Support both flat HP (new) and percent (legacy)
            let damage = 0;
            burnEffects.forEach(function(b) {
                if (b.flatHp) {
                    damage += b.flatHp; // flat HP damage
                } else {
                    damage += Math.ceil(char.maxHp * ((b.percent || 10) / 100)); // legacy percent
                }
            });
            damage = applyTuskPassive(charName, damage);
            if (damage > 0) {
                applyDamageWithShield(charName, damage, null);
                addLog('🔥 ' + charName + ' recibe ' + damage + ' de daño por Quemadura', 'damage');
                // RENGOKU PASIVA: genera 1 carga por tick de quemadura en enemigo
                const rengoku = gameState.characters['Rengoku'];
                if (rengoku && !rengoku.isDead && rengoku.hp > 0 && rengoku.team !== char.team) {
                    rengoku.charges = Math.min(20, (rengoku.charges || 0) + 1);
                    addLog('🔥 Corazón Ardiente: Rengoku genera 1 carga', 'buff');
                }
            }
        }

        function processNewDebuffEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;

            // VENENO: un solo stack consolidado con daño progresivo por continuidad
            const poisonEffect = char.statusEffects.find(e => e && normAccent(e.name||'') === 'veneno');
            if (poisonEffect) {
                poisonEffect.poisonTick = (poisonEffect.poisonTick || 0) + 1;
                let totalVenenoDmg = poisonEffect.poisonTick;
                const hasChargeDrain = !!poisonEffect.poisonChargeDrain;

                // PILAR DEL INSECTO (Shinobu Kocho): Veneno activo en enemigos causa daño doble
                if (!passiveExecuting) {
                    const _shinTeam = char.team === 'team1' ? 'team2' : 'team1';
                    for (const _sn in gameState.characters) {
                        const _sc = gameState.characters[_sn];
                        if (!_sc || _sc.isDead || _sc.hp <= 0 || _sc.team !== _shinTeam) continue;
                        if (_sc.passive && _sc.passive.name === 'Pilar del Insecto') {
                            totalVenenoDmg *= 2;
                            addLog('🦋 Pilar del Insecto: Veneno daño doble (' + totalVenenoDmg + ')', 'damage');
                            break;
                        }
                    }
                }

                applyDamageWithShield(charName, totalVenenoDmg, null);

                // ANARQUÍA (Joker): 50% stun when a character takes poison damage
                if (!passiveExecuting) {
                    const _jkrChar = gameState.characters[charName];
                    if (_jkrChar) {
                        const _jkrEnemyTeam = _jkrChar.team === 'team1' ? 'team2' : 'team1';
                        for (const _jkn in gameState.characters) {
                            const _jkc = gameState.characters[_jkn];
                            if (!_jkc || _jkc.isDead || _jkc.hp <= 0 || _jkc.team !== _jkrEnemyTeam) continue;
                            if (!_jkc.passive || _jkc.passive.name !== 'Anarquía') continue;
                            if (Math.random() < 0.50) {
                                applyStun(charName, 1);
                                addLog('🃏 Anarquía: ' + charName + ' queda Aturdido por daño de Veneno', 'debuff');
                            }
                            break;
                        }
                    }
                }
                addLog('☠️ ' + charName + ' recibe ' + totalVenenoDmg + ' de daño por Veneno (tick ' + poisonEffect.poisonTick + ')', 'damage');

                // PILAR DEL INSECTO (Shinobu): genera 1 carga al equipo aliado cuando Shinobu recibe daño de Veneno
                if (!passiveExecuting) {
                    const _shinSelf = gameState.characters[charName];
                    if (_shinSelf && (_shinSelf.passive && _shinSelf.passive.name === 'Pilar del Insecto')) {
                        for (const _an in gameState.characters) {
                            const _a = gameState.characters[_an];
                            if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _shinSelf.team) continue;
                            _a.charges = Math.min(20, (_a.charges||0) + 1);
                        }
                        addLog('🦋 Pilar del Insecto: Equipo aliado genera 1 carga (Shinobu recibió daño de Veneno)', 'buff');
                    }
                }

                // PROGENITOR DEMONIACO (Muzan): genera 1 carga cuando veneno hace daño
                const muzanP = gameState.characters['Muzan Kibutsuji'];
                if (muzanP && !muzanP.isDead && muzanP.hp > 0 && muzanP.team !== (gameState.characters[charName] && gameState.characters[charName].team)) {
                    muzanP.charges = Math.min(20, (muzanP.charges || 0) + 1);
                    addLog('🧛‍♂️ Progenitor Demoniaco: Muzan genera 1 carga (veneno activo)', 'buff');
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
            // DAENERYS: immune to Quemadura Solar
            if ((charName === 'Daenerys Targaryen' || charName === 'Daenerys Targaryen v2')) {
                const solarBefore = char.statusEffects.filter(e => e && e.name === 'Quemadura Solar').length;
                char.statusEffects = char.statusEffects.filter(e => !e || e.name !== 'Quemadura Solar');
                if (solarBefore > 0 && typeof triggerDaenerysPassiveBurnHeal === 'function') triggerDaenerysPassiveBurnHeal(charName);
                return;
            }
            if (hasStatusEffect(charName, 'Proteccion Sagrada')) return;
            const solarEffects = char.statusEffects.filter(e => e && e.name === 'Quemadura Solar');
            if (solarEffects.length === 0) return;
            // QS ya no hace daño por %. Solo bloquea curación (gestionado por canHeal())
            addLog('☀️ ' + charName + ' tiene Quemadura Solar activa (no puede recuperar HP)', 'debuff');
            // SPHINX WEHEM-MESUT: pierde 2 cargas adicionales por tener QS activa
            const sphinx = Object.values(gameState.summons).find(s => s && (s.name === 'Sphinx Wehem-Mesut' || s.name === 'Abu el-Hol Sphinx') && s.team !== char.team);
            if (sphinx) {
                char.charges = Math.max(0, char.charges - 2);
                addLog('🦁 Sphinx: ' + charName + ' pierde 2 cargas por Quemadura Solar', 'damage');
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
                    // DAENERYS Dinastía del Dragón: heal 1 HP when Quemadura/QS expires
                    if ((charName === 'Daenerys Targaryen' || charName === 'Daenerys Targaryen v2') && (effect.name === 'Quemadura' || effect.name === 'Quemadura Solar')) {
                        if (typeof triggerDaenerysPassiveBurnHeal === 'function') triggerDaenerysPassiveBurnHeal(charName);
                    }
                    // PALPATINE PASSIVE: when an enemy debuff expires, 50% chance to stun them
                    if (effect.type === 'debuff') {
                        const palChar = gameState.characters['Emperador Palpatine'];
                        const thisChar = gameState.characters[charName];
                        if (palChar && !palChar.isDead && palChar.hp > 0 && thisChar && palChar.team !== thisChar.team) {
                            triggerPalpatinePassive(charName);
                        }
                    }
                    const nname = normAccent(effect.name || '');
                    // Limpiar Forma Dragón de Alexstrasza cuando Escudo Sagrado expira
                    if (nname === 'escudo sagrado' && (charName === 'Alexstrasza' || charName === 'Alexstrasza v2')) {
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
            // SAITAMA: inmune a todos los debuffs incluyendo Quemadura
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) {
                addLog('🦸 Saitama es inmune a Quemadura (Espíritu del Héroe)', 'buff');
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
            // CONCENTRACION: duplica cargas generadas
            let finalAmount = amount;
            const charName = Object.keys(gameState.characters).find(n => gameState.characters[n] === charObj);
            if (charName && hasStatusEffect(charName, 'Concentración')) {
                finalAmount = amount * 2;
            }
            charObj.charges = Math.min(20, (charObj.charges || 0) + finalAmount);
        }


        function hasStatusEffect(charName, effectName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return false;
            const normTarget = normAccent(effectName);
            return char.statusEffects.some(e => e && normAccent(e.name) === normTarget);
        }

        // QUEMADURA SOLAR: ninguna fuente de curación funciona mientras esté activa
        function canHeal(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return true;
            if (char.statusEffects.some(e => e && normAccent(e.name||'') === 'quemadura solar')) {
                return false;
            }
            return true;
        }
