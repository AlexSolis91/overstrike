// ==================== EJECUCIÓN DE HABILIDAD ====================

        // Aplicar daño AOE a TODOS los enemigos (personajes + invocaciones)

        function generateChargesInline(charName, amount) {
            if (!amount || amount <= 0) return;
            const c = gameState.characters[charName];
            if (!c) return;
            let finalAmt = amount;
            if (hasStatusEffect(charName, 'Concentración')) finalAmt = amount * 2;
            c.charges = Math.min(20, (c.charges || 0) + finalAmt);
            if (typeof _animCard === 'function') _animCard(charName, 'anim-charge', 500);
        }
        function applyAOEDamageToTeam(enemyTeam, damage, attackerName) {
            let _kyoAOEHits = 0;
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (c && c.team === enemyTeam && !c.isDead && c.hp > 0) {
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) {
                        addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff');
                        continue;
                    }
                    applyDamageWithShield(n, damage, attackerName);
                    _kyoAOEHits++;
                }
            }
            // Pasiva Llamarada Kusanagi: quemaduras al atacante por cada aliado golpeado
            if (_kyoAOEHits > 0 && attackerName && typeof triggerKyoAOEPassive === 'function') {
                triggerKyoAOEPassive(attackerName, _kyoAOEHits);
            }
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (s && s.team === enemyTeam && s.hp > 0) {
                    applySummonDamage(sid, damage, attackerName);
                }
            }
        }

        // Aplicar AOE a equipo ALIADO (para habilidades que afectan a tu equipo)
        function applyAOEToAllyTeam(allyTeam, damage, attackerName) {
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (c && c.team === allyTeam && !c.isDead && c.hp > 0) {
                    applyDamageWithShield(n, damage, attackerName);
                }
            }
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (s && s.team === allyTeam && s.hp > 0) {
                    applySummonDamage(sid, damage, attackerName);
                }
            }
        }


        // ── AOE HELPER: applies MegaProv redirect + returns true if target is immune (EA) ──
        function handleAOETarget(n, dmg, attackerName, targetTeam) {
            // Returns actual damage dealt (0 if EA immune)
            const c = gameState.characters[n];
            if (!c || c.team !== targetTeam || c.isDead || c.hp <= 0) return -1; // skip
            if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) {
                addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff');
                return 0; // immune
            }
            return applyDamageWithShield(n, dmg, attackerName);
        }

        // ── AOE MEGAPROV HELPER: check if MegaProv exists and redirect total AOE damage ──
        // Helper: aplicar daño AOE a todas las invocaciones enemigas
        function applyAOEToSummons(targetTeam, damage, attackerName) {
            for (const _sid in gameState.summons) {
                const _s = gameState.summons[_sid];
                if (!_s || _s.team !== targetTeam || _s.hp <= 0) continue;
                applySummonDamage(_sid, damage, attackerName);
            }
        }

        function checkAndRedirectAOEMegaProv(targetTeam, dmgPerTarget, attackerName) {
            // JINETE DE DRAGONES (Daemon): ignora Provocacion y MegaProvocacion
            if (attackerName) {
                const _djIgn = gameState.characters[attackerName];
                if (_djIgn && _djIgn.passive && _djIgn.passive.name === 'Principe Rebelde' && (_djIgn.daemonJineteTurns||0) > 0) return false;
            }
            // EL REY PROMETIDO: activar pasiva de Jon Snow cuando el enemigo usa AOE
            if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(attackerName);
            const mpData = checkKamishMegaProvocation(targetTeam);
            if (!mpData) return false;
            const mult = countMegaProvMultiplier(targetTeam, mpData);
            const totalDmg = dmgPerTarget * mult;
            const holderName = mpData.isCharacter ? mpData.characterName : (mpData.holder ? mpData.holder.name : 'Invocación');
            if (mpData.isCharacter) {
                applyDamageWithShield(mpData.characterName, totalDmg, attackerName);
            } else {
                applySummonDamage(mpData.id, totalDmg, attackerName);
            }
            addLog('🎯 ' + holderName + ' (Mega Provocación) absorbe ' + totalDmg + ' daño AOE (' + dmgPerTarget + '×' + mult + ')', 'damage');
            return true;
        }

        function executeAbility(targetName) {
            // ── OVER CINEMATIC: mostrar pantalla épica antes de ejecutar ──
            if (gameState.selectedAbility && gameState.selectedAbility.type === 'over' &&
                typeof _showOverCinematic === 'function') {
                const _ocChar = gameState.selectedCharacter;
                const _ocAb   = gameState.selectedAbility;
                const _ocTeam = (gameState.characters[_ocChar] || {}).team || 'team1';
                _showOverCinematic(_ocChar, _ocAb.name, _ocAb.effect, _ocTeam, function() {
                    _executeAbilityCore(targetName);
                });
                return; // esperar callback
            }
            _executeAbilityCore(targetName);
        }

        function _executeAbilityCore(targetName) {
            audioManager.playSelect(); // SFX on every ability/action
            // SFX especial para OVER
            if (gameState.selectedAbility && gameState.selectedAbility.type === 'over') {
                audioManager.playOverSfx();
                if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-over', 700);
                if (gameState.battleStats) gameState.battleStats.oversUsed++;
                // ── CLIMA AOE por tipo de Over ──
                if (typeof _triggerAOEWeather === 'function') {
                    const _ab = gameState.selectedAbility;
                    const _abEff = (_ab && _ab.effect) || '';
                    let _weatherType = 'generic';
                    if (_abEff.includes('burn') || _abEff.includes('fire') || _abEff.includes('fuego') ||
                        _abEff.includes('purgatorio') || _abEff.includes('destruccion') || _abEff.includes('explosi')) _weatherType = 'fire';
                    else if (_abEff.includes('ice') || _abEff.includes('hielo') || _abEff.includes('frio') ||
                             _abEff.includes('freeze') || _abEff.includes('congelaci')) _weatherType = 'ice';
                    else if (_abEff.includes('shadow') || _abEff.includes('dark') || _abEff.includes('sombra') ||
                             _abEff.includes('death') || _abEff.includes('muerte') || _abEff.includes('rikudo')) _weatherType = 'dark';
                    if (_ab && _ab.target === 'aoe') _triggerAOEWeather(_weatherType);
                }
            }
            try {
                closeTargetModal();
                
                const attacker = gameState.characters[gameState.selectedCharacter];
                const charName = gameState.selectedCharacter;
                const ability = gameState.selectedAbility;
                let adjustedCost = (gameState.adjustedCost !== undefined && gameState.adjustedCost !== null) ? gameState.adjustedCost : ability.cost;
                // MODO RIKUDŌ (Madara): costo a la mitad
                if (attacker && attacker.rikudoMode && adjustedCost > 0 &&
                    (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2') &&
                    ability.effect !== 'rikudo_mode_madara') {
                    adjustedCost = Math.ceil(adjustedCost / 2);
                }
                
                // ── SILENCIAR: bloquea la categoría silenciada ──────────────
                if (ability && attacker) {
                    const _silEffect = (attacker.statusEffects || []).find(e => e && normAccent(e.name || '') === 'silenciar');
                    if (_silEffect && _silEffect.silencedCategory && _silEffect.silencedCategory === ability.type) {
                        addLog('🔇 ' + charName + ' está Silenciado — no puede usar habilidades tipo ' + _silEffect.silencedCategory.toUpperCase(), 'damage');
                        endTurn();
                        return;
                    }
                }

                if (!attacker || !ability) {
                    console.error('executeAbility: Missing attacker or ability');
                    return;
                }
                
                // VERIFICAR BELLION - Cancelar Special/Over
                if (checkBellionCounter(gameState.selectedCharacter, ability.type)) {
                    // La habilidad fue cancelada por Bellion
                    // Las cargas YA se consumieron, así que las devolvemos
                    attacker.charges = Math.min(20, (attacker.charges || 0) + adjustedCost);
                    renderCharacters();
                    renderSummons();
                    
                    // Verificar fin del juego (por si Bellion mató al atacante)
                    if (checkGameOver()) {
                        return;
                    }
                    
                    // Finalizar turno sin ejecutar la habilidad
                    endTurn();
                    return;
                }

            // Phalanx (Leonidas) passive now fires at round start — removed enemy special trigger
            
            // Calcular daño y generación de cargas ajustados por modo Rikudō
            let finalDamage = ability.damage;
            let finalChargeGain = ability.chargeGain;
            // ESPÍRITU DEL HÉROE (Saitama): +accumulated bonus on basic attacks
            if (ability.type === 'basic' && attacker.passive && attacker.passive.name === 'Espíritu del Héroe') {
                finalChargeGain = (ability.chargeGain || 1) + (attacker.saitamaBasicChargeBonus || 0);
                attacker.saitamaBasicChargeBonus = (attacker.saitamaBasicChargeBonus || 0) + 2;
            }
            
            if (attacker.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                finalDamage *= 2;
                finalChargeGain *= 2;
            }

            // BUFF FURIA: +50% daño
            if (finalDamage > 0 && hasStatusEffect(gameState.selectedCharacter, 'Furia')) {
                finalDamage = Math.ceil(finalDamage * 1.5);
            }
            // BUFF FRENESÍ: 50% de crítico en este ataque (daño doble)
            if (finalDamage > 0 && (hasStatusEffect(gameState.selectedCharacter, 'Frenesi') || hasStatusEffect(gameState.selectedCharacter, 'Frenesí'))) {
                if (Math.random() < 0.50) {
                    finalDamage *= 2;
                    addLog(`⚡ ¡FRENESÍ CRÍTICO! ${gameState.selectedCharacter}`, 'buff');
                }
            }
            // GOKU: bonus daño de Entrenamiento de los Dioses
            if ((gameState.selectedCharacter === 'Goku' || gameState.selectedCharacter === 'Goku v2') && attacker.gokuBonusDamage > 0 && finalDamage > 0) {
                finalDamage += attacker.gokuBonusDamage;
            }
            // SAURON transformado: +1 daño adicional
            if (attacker.sauronTransformed && finalDamage > 0) {
                finalDamage += 1;
            }
            // SAURON transformado: habilidades cuestan 3 menos (ya en adjustedCost)
            // MIEDO: atacante con Miedo activo sufre -50% daño
            if (finalDamage > 0 && gameState._miedoActive) {
                finalDamage = Math.max(1, Math.floor(finalDamage * 0.5));
                addLog(`😱 Miedo: ${charName} ataca con -50% de daño`, 'damage');
            }
            // BOLVAR FORDRAGON: +100% daño habilidades
            const bolvar = Object.values(gameState.summons).find(s => s && s.name === 'Necrofago' && s.team === attacker.team);
            if (bolvar && finalDamage > 0 && (ability.type === 'special' || ability.type === 'over')) {
                finalDamage *= 2;
                addLog(`🔱 Bolvar Fordragon: daño de habilidad duplicado`, 'buff');
            }
            // DARION MORGRAINE: +50% prob crit (se aplica a critChance del ability inline)
            // REGLA DE ORO (Gilgamesh): +25% crit base sobre cualquier critChance (NO mutar ability)
            // Se aplica inline en cada handler como gilgameshCritBonus = 0.25

            // MODO KURAMA (Minato): +3 daño en todos los ataques
            if (attacker.kuramaMode && (gameState.selectedCharacter === 'Minato Namikaze' || gameState.selectedCharacter === 'Minato Namikaze v2') && finalDamage > 0) {
                finalDamage += 3;
            }
            // MODO KURAMA: +1 carga base en todos los ataques
            if (attacker.kuramaMode && (gameState.selectedCharacter === 'Minato Namikaze' || gameState.selectedCharacter === 'Minato Namikaze v2')) {
                finalChargeGain += 1;
            }

            // ARMADURA DIVINA DEL FÉNIX (Ikki): daño triple en enemigos con Quemadura
            if (attacker.fenixArmorActive && (gameState.selectedCharacter === 'Ikki de Fenix' || gameState.selectedCharacter === 'Ikki de Fenix v2') && finalDamage > 0) {
                const tgtIkki = gameState.characters[targetName];
                if (tgtIkki && hasStatusEffect(targetName, 'Quemadura')) {
                    finalDamage *= 3;
                    addLog(`🦅 Armadura Divina: daño triple en ${targetName} (tiene Quemadura)`, 'buff');
                }
            }
            
            // Consumir cargas
            attacker.charges -= adjustedCost;
            // Marcar que el personaje activo realizó un ataque (para romper Sigilo)
            if (ability.target === 'single' || ability.target === 'aoe') {
                gameState._attackedThisTurn = true;
            }
            
            // Ejecutar efecto según el tipo de habilidad
            if (ability.effect === 'arise_summon') {
                // SUN JIN WOO - Arise!: Invoca UNA sombra aleatoria
                try {
                    const shadowWeights = { 'Igris': 25, 'Iron': 25, 'Tusk': 15, 'Beru': 12, 'Bellion': 5, 'Kaisel': 10 };
                    const shadowPool = ['Igris', 'Iron', 'Tusk', 'Beru', 'Bellion', 'Kaisel'];
                    const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    const existingNames = new Set(myShadows.filter(s => s && s.name).map(s => s.name));
                    const available = shadowPool.filter(n => !existingNames.has(n));
                    if (available.length === 0) {
                        addLog(`❌ ${gameState.selectedCharacter} ya tiene todas las sombras invocadas`, 'info');
                    } else {
                        const blockedW = shadowPool.filter(n => existingNames.has(n)).reduce((s,n) => s + shadowWeights[n], 0);
                        const redistrib = available.length > 0 ? blockedW / available.length : 0;
                        const adjW = {};
                        available.forEach(n => { adjW[n] = shadowWeights[n] + redistrib; });
                        const totalW = available.reduce((s,n) => s + adjW[n], 0);
                        let rand = Math.random() * totalW;
                        let chosen = available[available.length - 1];
                        for (const n of available) { rand -= adjW[n]; if (rand <= 0) { chosen = n; break; } }
                        summonShadow(chosen, gameState.selectedCharacter);
                        addLog(`👻 ${gameState.selectedCharacter} invoca: ${chosen}`, 'buff');
                    }
                } catch (e) {
                    console.error('Error en arise_summon:', e);
                    addLog('❌ Error al invocar sombra', 'info');
                }

            } else if (ability.effect === 'daga_kamish') {
                // SUN JIN WOO - Daga de Kamish: 2 daño base + 2 por sombra invocada
                const shadowsActive = getSummonsBySummoner(gameState.selectedCharacter).length;
                const dagaDmg = finalDamage + (shadowsActive * 2);
                applyDamageWithShield(targetName, dagaDmg, gameState.selectedCharacter);
                addLog(`🗡️ Daga de Kamish: ${dagaDmg} daño (base ${finalDamage} + ${shadowsActive * 2} por ${shadowsActive} sombra${shadowsActive !== 1 ? 's' : ''})`, 'damage');

            } else if (ability.effect === 'stealth') {
                // Sigilo - dura hasta fin de la ronda actual (1 ronda)
                applyStealth(gameState.selectedCharacter, 1);
                // Sigilo se pierde si el mismo usuario ataca — se gestiona en checkAndRemoveStealth


            // ── GOKU BLACK EFFECTS ──
            } else if (ability.effect === 'espada_ki') {
                let kiDmg = finalDamage;
                if (attacker.darkSideAwakened) kiDmg += 2;
                applyDamageWithShield(targetName, kiDmg, charName);
                addLog('⚔️ Espada de Ki: ' + kiDmg + ' daño a ' + targetName, 'damage');
                // 50% Buff Aura Oscura sobre Goku Black self
                if (Math.random() < 0.50) {
                    attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.name !== 'Aura oscura');
                    attacker.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 2, emoji: '🌑' });
                    addLog('🌑 Espada de Ki: ' + charName + ' gana Buff Aura Oscura', 'buff');
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'teleportacion_confusion') {
                applyConfusion(targetName, 2);
                const stolen = Math.min(2, gameState.characters[targetName] ? gameState.characters[targetName].charges : 0);
                if (gameState.characters[targetName]) gameState.characters[targetName].charges = Math.max(0, (gameState.characters[targetName].charges||0) - 2);
                attacker.charges = Math.min(20, (attacker.charges||0) + stolen);
                addLog('🌀 Teletransportación: Confusión + roba ' + stolen + ' cargas de ' + targetName, 'damage');

            // lazo_divino viejo eliminado — usar handler nuevo (Goku Black Fake Black)

            } else if (ability.effect === 'guadana_divina') {
                const enemyTeamGD = attacker.team === 'team1' ? 'team2' : 'team1';
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(enemyTeamGD, finalDamage, gameState.selectedCharacter)) {
                    addLog('🎯 guadana_divina: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamGD || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    c.charges = 0;
                    addLog('⚰️ Guadaña Divina: ' + n + ' pierde todas sus cargas', 'damage');
                }
                }
                // Daño AOE también a invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeamGD && _s.hp > 0) {
                        applySummonDamage(_sid, finalDamage, charName);
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('⚰️ Guadaña Divina: ' + finalDamage + ' daño AOE', 'damage');

            } else if (ability.effect === 'charge_steal') {
                // Robo de cargas: quita cargas al objetivo y las suma al atacante
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const stealAmount = ability.stealAmount || 2;
                stealCharges(gameState.selectedCharacter, targetName, stealAmount);
                addLog(`⚡ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_stun') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyStun(targetName, ability.stunDuration || 1);
                addLog(`⭐ ${gameState.selectedCharacter} aturde a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_mega_stun') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyStun(targetName, 2);
                addLog(`💫 ${gameState.selectedCharacter} aplica Mega Aturdimiento a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_bleed') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyBleed(targetName, ability.bleedDuration || 1);
                addLog(`🩸 ${gameState.selectedCharacter} provoca Sangrado en ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_fear') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFear(targetName, ability.fearDuration || 2);
                addLog(`😱 ${gameState.selectedCharacter} infunde Miedo en ${targetName}`, 'damage');

            } else if (ability.effect === 'explosion_galaxias') {
                // Explosión de Galaxias: 10 AOE + 30% crit por objetivo
                const _egTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const _critChance = ability.critChance || 0.30;
                let _egLog = [];
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(_egTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⛓️ explosion_galaxias: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (_c && _c.team === _egTeam && !_c.isDead && _c.hp > 0) {
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' esquiva el AOE (Esquiva Área)', 'buff'); continue; }
                        const _isCrit = Math.random() < _critChance;
                        const _dmg = _isCrit ? finalDamage * 2 : finalDamage;
                        applyDamageWithShield(_n, _dmg, gameState.selectedCharacter);
                        _egLog.push(_n + (_isCrit ? ' 💥CRIT(' + _dmg + ')' : '(' + _dmg + ')'));
                    }
                }
                }
                // Also drain 1 charge per enemy (keeping original bonus from Onda de Fuerza flavor)
                for (let _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (_c && _c.team === _egTeam && !_c.isDead && _c.hp > 0 && _c.charges > 0) {
                        _c.charges = Math.max(0, _c.charges - 1);
                    }
                }
                applyAOEToSummons(_egTeam, finalDamage, gameState.selectedCharacter);
                addLog('💥 Explosión de Galaxias: ' + _egLog.join(', '), 'damage');
            } else if (ability.effect === 'genro_maoken') {
                // Genrō Maō Ken: 3 AOE + 50% Posesión por objetivo
                const _gmTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                let _gmLog = [];
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(_gmTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⛓️ genro_maoken: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (_c && _c.team === _gmTeam && !_c.isDead && _c.hp > 0) {
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' esquiva el AOE (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        if (Math.random() < 0.5) {
                            applyPossession(_n, 1);
                            _gmLog.push(_n + ' (💀Posesión)');
                        } else {
                            _gmLog.push(_n);
                        }
                    }
                }
                }
                applyAOEToSummons(_gmTeam, finalDamage, gameState.selectedCharacter);
                addLog('👁️ Genrō Maō Ken: ' + finalDamage + ' AOE — ' + _gmLog.join(', '), 'damage');
            } else if (ability.effect === 'apply_possession') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPossession(targetName, ability.possessionDuration || 1);
                addLog(`👁️ ${gameState.selectedCharacter} posee a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_poison') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPoison(targetName, ability.poisonDuration || 4);
                addLog(`☠️ ${gameState.selectedCharacter} envenena a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_freeze') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFreeze(targetName, ability.freezeDuration || 2, false);
                addLog(`❄️ ${gameState.selectedCharacter} congela a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_mega_freeze') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFreeze(targetName, ability.freezeDuration || 2, true);
                addLog(`🧊❄️ ${gameState.selectedCharacter} aplica Mega Congelación a ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_holy_shield') {
                applyHolyShield(targetName, ability.shieldDuration || 2);
                addLog(`✝️ ${gameState.selectedCharacter} aplica Escudo Sagrado a ${targetName}`, 'buff');

            } else if (ability.effect === 'apply_holy_protection') {
                applyHolyProtection(targetName, ability.protectionDuration || 2);
                addLog(`🛡️ ${gameState.selectedCharacter} aplica Protección Sagrada a ${targetName}`, 'buff');

            // ── EFECTOS NUEVOS DE PERSONAJES ─────────────────────────────

            } else if (ability.effect === 'aoe_drain_charges') {
                // Guadaña Divina: daño AOE + drena todas las cargas
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        if (c.charges > 0) { addLog(`⚡ ${n} pierde todas sus cargas`, 'damage'); c.charges = 0; }
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }

            } else if (ability.effect === 'aoe_drain_charges_1') {
                // Onda de Fuerza: elimina 1 carga a cada enemigo
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) {
                        if (c.charges > 0) { c.charges = Math.max(0, c.charges - 1); addLog(`⚡ ${n} pierde 1 carga`, 'damage'); }
                    }
                }

            } else if (ability.effect === 'dark_awakening') {
                // Despertar del Lado Oscuro: 5 golpes básicos con 50% crit
                const basicAbility = attacker.abilities[0];
                const baseDmg = basicAbility ? basicAbility.damage : 1;
                let extraCharges = 0;
                for (let i = 0; i < 5; i++) {
                    const isCrit = Math.random() < 0.5;
                    const dmg = isCrit ? baseDmg * 2 : baseDmg;
                    applyDamageWithShield(targetName, dmg, gameState.selectedCharacter);
                    addLog(`${isCrit ? '💥 CRÍTICO' : '⚔️'} Golpe ${i+1}: ${dmg} daño a ${targetName}`, 'damage');
                    if (isCrit) extraCharges++;
                    if (gameState.characters[targetName] && gameState.characters[targetName].hp <= 0) break;
                }
                if (extraCharges > 0) { attacker.charges += extraCharges; addLog(`⚡ ${gameState.selectedCharacter} genera ${extraCharges} carga(s) por críticos`, 'buff'); }

            } else if (ability.effect === 'blood_eagle') {
                // Águila de Sangre: 10 daño. Si TRAS el daño el objetivo tiene <50% HP restante → ejecutar.
                // Si mata (por daño o ejecución), aplica Miedo 2 turnos a 2 enemigos aleatorios.
                const beDmgDealt = applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtBE = gameState.characters[targetName];
                // Solo ejecutar si el daño llegó Y el HP resultante es menor al 50% del máximo
                if (beDmgDealt > 0 && tgtBE && !tgtBE.isDead && tgtBE.hp > 0 && tgtBE.hp < tgtBE.maxHp * 0.5) {
                    tgtBE.hp = 0;
                    tgtBE.shield = 0;
                    tgtBE.shieldEffect = null;
                    tgtBE.isDead = true;
                    addLog(`🦅 Águila de Sangre: ¡${targetName} ejecutado! (quedó con <50% HP)`, 'damage');
                }
                // Si murió, aplica Miedo a 2 enemigos aleatorios
                if (!tgtBE || tgtBE.isDead || tgtBE.hp <= 0) {
                    const fearTargets = Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === (attacker.team === 'team1' ? 'team2' : 'team1') && !c.isDead && c.hp > 0 && n !== targetName;
                    }).sort(() => Math.random() - 0.5).slice(0, 2);
                    fearTargets.forEach(n => applyFear(n, 2));
                    if (fearTargets.length > 0) addLog(`🦅 Águila de Sangre: Miedo aplicado a ${fearTargets.join(', ')}`, 'damage');
                }
                addLog(`⚔️ ${gameState.selectedCharacter} usa Águila de Sangre en ${targetName} (${finalDamage} daño)`, 'damage');

            } else if (ability.effect === 'muro_de_escudo') {
                // Muro de Escudo (Ragnar): Provocación 1 turno (dur=2) + Escudo 3 HP
                attacker.statusEffects = attacker.statusEffects.filter(e => normAccent(e.name || '') !== 'provocacion');
                attacker.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 2, emoji: '🛡️' });
                attacker.shield = 3; attacker.shieldEffect = null;
                addLog(`🛡️ ${gameState.selectedCharacter} activa Provocación (1 turno) y gana Escudo 3 HP`, 'buff');

            } else if (ability.effect === 'precepto') {
                // Precepto (Leonidas): daño + 50% probabilidad Aturdimiento + Phalanx bonus
                const leonBonus = attacker.phalanxBonusDmg || 0;
                const leonCgBonus = attacker.phalanxBonusCg || 0;
                applyDamageWithShield(targetName, finalDamage + leonBonus, gameState.selectedCharacter);
                if (leonCgBonus > 0) {
                    attacker.charges = Math.min(20, (attacker.charges || 0) + leonCgBonus);
                }
                // 50% Aturdimiento
                if (Math.random() < 0.50) {
                    applyStun(targetName, 1);
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'grito_de_esparta') {
                // Grito de Esparta: Limpia 1 debuff a todos los aliados + Buff Frenesi
                const _geTeam = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== _geTeam || c.isDead || c.hp <= 0) continue;
                    const _geDebuffs = (c.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (_geDebuffs.length > 0) {
                        const _geRm = _geDebuffs[Math.floor(Math.random() * _geDebuffs.length)];
                        c.statusEffects = c.statusEffects.filter(e => e !== _geRm);
                        addLog('⚔️ Grito de Esparta: ' + (_geRm.name||'Debuff') + ' limpiado de ' + n, 'buff');
                    }
                    applyFrenesi(n, 2);
                }
                addLog('⚔️ Grito de Esparta: Frenesi 2T aplicado a todos los aliados', 'buff');


            } else if (ability.effect === 'apply_possession_1') {
                // ASPROS - Genma Ken legacy: aplica Posesión 1 turno
                if (finalDamage > 0) applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPossession(targetName, 1);
                addLog(`👁️ Genma Ken: ${gameState.selectedCharacter} aplica Posesión a ${targetName}`, 'damage');

            } else if (ability.effect === 'genma_ken_v2') {
                // ASPROS - Genma Ken v2: daño + Confusión + strip buffs
                applyDamageWithShield(targetName, finalDamage, charName);
                applyConfusion(targetName, 1);
                const tgtGK = gameState.characters[targetName];
                if (tgtGK && tgtGK.statusEffects) {
                    const buffsBefore = tgtGK.statusEffects.filter(e => e && e.type === 'buff').length;
                    tgtGK.statusEffects = tgtGK.statusEffects.filter(e => !e || e.type !== 'buff' || e.permanent);
                    if (buffsBefore > 0) addLog('✨ Genma Ken: ' + targetName + ' pierde ' + buffsBefore + ' buff(s)', 'damage');
                }

            } else if (ability.effect === 'colapso_dimensional') {
                // ASPROS - Colapso Dimensional: daño + 2 debuffs aleatorios
                applyDamageWithShield(targetName, finalDamage, charName);
                const tgtCD = gameState.characters[targetName];
                const nonStackCD = ['miedo','confusion','posesion','debilitar','aturdimiento','mega aturdimiento'];
                const debuffPoolCD = [
                    { name:'quemadura',  fn: function(){ applyFlatBurn(targetName, 2, 2); } },
                    { name:'sangrado',   fn: function(){ applyBleed(targetName, 2); } },
                    { name:'veneno',     fn: function(){ applyPoison(targetName, 2); } },
                    { name:'miedo',      fn: function(){ applyFear(targetName, 1); } },
                    { name:'confusion',  fn: function(){ applyConfusion(targetName, 1); } },
                    { name:'aturdimiento', fn: function(){ applyStun(targetName, 1); } },
                    { name:'debilitar',  fn: function(){ applyWeaken(targetName, 2); } },
                    { name:'congelacion',fn: function(){ applyFreeze(targetName, 2); } },
                ];
                const availableCD = debuffPoolCD.filter(function(d) {
                    if (nonStackCD.includes(d.name) && tgtCD && tgtCD.statusEffects &&
                        tgtCD.statusEffects.some(function(e){ return e && normAccent(e.name||'') === d.name; })) return false;
                    return true;
                }).sort(function(){ return Math.random() - 0.5; });
                const appliedCDDebuffs = availableCD.slice(0, 2);
                const appliedCDNames = [];
                appliedCDDebuffs.forEach(function(d){ d.fn(); appliedCDNames.push(d.name); });
                const cdNamesStr = appliedCDNames.map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' y ');
                addLog('💫 Colapso Dimensional: ' + targetName + ' recibe ' + cdNamesStr, 'damage');

            } else if (ability.effect === 'arc_geminga') {
                // ASPROS - Arc Geminga: daño (doble si target tiene debuffs)
                const tgtAG = gameState.characters[targetName];
                const hasDebuffsAG = tgtAG && tgtAG.statusEffects && tgtAG.statusEffects.some(e => e && e.type === 'debuff');
                const arcDmg = hasDebuffsAG ? finalDamage * 2 : finalDamage;
                applyDamageWithShield(targetName, arcDmg, charName);
                if (hasDebuffsAG) addLog('⚡ Arc Geminga: DAÑO DOBLE (' + arcDmg + ') — ' + targetName + ' tiene debuffs activos', 'damage');
                else addLog('⚡ Arc Geminga: ' + finalDamage + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'apertura_camino') {
                // Apertura del Camino de los Dioses: daño + Sigilo (solo si no tiene Sigilo ya)
                if (hasStatusEffect(charName, 'Sigilo')) {
                    addLog('👤 ' + charName + ' ya tiene Buff Sigilo activo — Apertura no puede usarse', 'info');
                    attacker.charges = Math.min(20, (attacker.charges || 0) + (gameState.adjustedCost || ability.cost));
                    renderCharacters(); endTurn(); return;
                }
                applyDamageWithShield(targetName, finalDamage, charName);
                applyStealth(charName, 3);
                addLog('👤 ' + charName + ' aplica Buff Sigilo (2 turnos)', 'buff');

            } else if (ability.effect === 'stealth_2rounds') {
                // ASPROS / MUZAN - Sigilo por 2 rondas + daño
                if (finalDamage > 0) applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyStealth(gameState.selectedCharacter, 2);

            } else if (ability.effect === 'another_dimension') {
                // ASPROS - Another Dimension: daño + roba mitad de cargas + cooldown
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtAnother = gameState.characters[targetName];
                if (tgtAnother) {
                    const stolen = Math.floor(tgtAnother.charges / 2);
                    tgtAnother.charges -= stolen;
                    attacker.charges += stolen;
                    addLog(`🌀 Another Dimension: ${gameState.selectedCharacter} roba ${stolen} cargas de ${targetName}`, 'buff');
                }
                // Aplicar cooldown de 2 turnos
                ability.cooldown = ability.maxCooldown || 2;
                addLog(`⏳ Another Dimension no podrá usarse por ${ability.cooldown} turnos`, 'info');

            } else if (ability.effect === 'double_if_debuff') {
                // ASPROS - Arc Geminga: daño doble si el objetivo tiene debuffs
                let dmgArc = finalDamage;
                const tgtArc = gameState.characters[targetName];
                if (tgtArc && tgtArc.statusEffects && tgtArc.statusEffects.some(e => e && e.type === 'debuff')) {
                    dmgArc *= 2;
                    addLog(`💥 Arc Geminga: daño doble (${targetName} tiene debuffs activos)`, 'damage');
                }
                applyDamageWithShield(targetName, dmgArc, gameState.selectedCharacter);
                addLog(`🌌 ${gameState.selectedCharacter} usa Arc Geminga en ${targetName} causando ${dmgArc} daño`, 'damage');

            } else if (ability.effect === 'crit_chance_basic') {
                // Ataque con probabilidad de crítico (Goku Kamehameha, Golpe Serio Saitama, etc.)
                let baseDmgCrit = finalDamage;
                const darionBuff = Object.values(gameState.summons).find(s => s && s.name === 'Valkyr' && s.team === attacker.team);
                const critBonusFromDarion = darionBuff ? 0.50 : 0;
                const gilgameshBonus = ((gameState.selectedCharacter === 'Gilgamesh' || gameState.selectedCharacter === 'Gilgamesh v2')) ? 0.25 : 0;
                const muzanCritB = ((gameState.selectedCharacter === 'Muzan Kibutsuji' || gameState.selectedCharacter === 'Muzan Kibutsuji v2')) ? (attacker.muzanCritBonus || 0) : 0;
                const isCritBasic = Math.random() < Math.min(1, (ability.critChance || 0) + critBonusFromDarion + gilgameshBonus + muzanCritB);
                if (isCritBasic) {
                    baseDmgCrit *= 2;
                    addLog(`💥 ¡CRÍTICO! ${gameState.selectedCharacter} usa ${ability.name}`, 'damage');
                    triggerGokuCrit(gameState.selectedCharacter);
                    triggerGilgameshCrit(gameState.selectedCharacter);
                    // ESPÍRITU DEL HÉROE (Saitama): cargas = mitad del daño en crítico
                    if ((gameState.selectedCharacter === 'Saitama' || gameState.selectedCharacter === 'Saitama v2')) {
                        const critCharges = Math.floor(baseDmgCrit / 2);
                        attacker.charges += critCharges;
                        addLog(`💪 Espíritu del Héroe: Saitama gana ${critCharges} cargas por crítico`, 'buff');
                    }
                }
                if (ability.target === 'aoe' || targetName === null) {
                    // AOE: dañar a todos los enemigos (p.ej. Gate of Babylon de Gilgamesh)
                    const critAoeTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    // EL REY PROMETIDO: Jon Snow activa su pasiva cuando el enemigo usa AOE
                    if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(gameState.selectedCharacter);
                    checkAndRemoveStealth(critAoeTeam);
                    let critAoeLog = [];
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === critAoeTeam && !c.isDead && c.hp > 0) {
                            // ESQUIVA ÁREA: Aspros, Min Byung, Minato, y cualquier personaje con buff/pasiva
                            if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                            // Each enemy gets its own crit roll
                            const darionB2 = Object.values(gameState.summons).find(s => s && s.name === 'Valkyr' && s.team === attacker.team);
                            const criB2 = darionB2 ? 0.50 : 0;
                            const gilB2 = ((gameState.selectedCharacter === 'Gilgamesh' || gameState.selectedCharacter === 'Gilgamesh v2')) ? 0.10 : 0;
                            const mzB2 = ((gameState.selectedCharacter === 'Muzan Kibutsuji' || gameState.selectedCharacter === 'Muzan Kibutsuji v2')) ? (attacker.muzanCritBonus || 0) : 0;
                            const isCrit2 = Math.random() < Math.min(1, (ability.critChance || 0) + criB2 + gilB2 + mzB2);
                            let dmg2 = finalDamage;
                            if (isCrit2) { dmg2 *= 2; triggerGilgameshCrit(gameState.selectedCharacter); }
                            applyDamageWithShield(n, dmg2, gameState.selectedCharacter);
                            critAoeLog.push(`${n}${isCrit2 ? ' (💥CRIT)' : ''}: ${dmg2}`);
                        }
                    }
                    // AOE también afecta invocaciones
                    for (let _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team !== attacker.team && _s.hp > 0) {
                            applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                        }
                    }
                    addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} — AOE: ${critAoeLog.join(', ')}`, 'damage');
                } else {
                    applyDamageWithShield(targetName, baseDmgCrit, gameState.selectedCharacter);
                    addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${baseDmgCrit} daño`, 'damage');
                }


            // ══════════════════════════════════════════════════════
            // GOKU — handlers nuevos
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'kame_hame_ha_goku') {
                // GOKU — Kame Hame Ha: 3 daño ST
                const _kkhG = gameState.characters[gameState.selectedCharacter];
                let _kkhDmg = finalDamage;
                // UI: +5 daño adicional
                if (_kkhG && _kkhG.gokuForm === 'ui') _kkhDmg += 5;
                // SS3: crítico siempre
                if (_kkhG && _kkhG.gokuForm === 'ss3') { _kkhDmg *= 2; addLog('💥 SS3: daño crítico automático', 'damage'); }
                applyDamageWithShield(targetName, _kkhDmg, gameState.selectedCharacter);
                addLog('🔵 Kame Hame Ha: ' + _kkhDmg + ' daño a ' + targetName, 'damage');
                // SS1: +3 cargas por golpe
                if (_kkhG && _kkhG.gokuForm === 'ss1') {
                    _kkhG.charges = Math.min(20, (_kkhG.charges||0) + 3);
                    addLog('⚡ SS1: Goku genera 3 cargas adicionales', 'buff');
                }

            } else if (ability.effect === 'kaio_ken_goku') {
                // GOKU — Kaio Ken: Buff Contraataque 3T + Buff Furia 3T
                const _kkG = gameState.characters[gameState.selectedCharacter];
                applyBuff(gameState.selectedCharacter, { name: 'Contraataque', type: 'buff', duration: 3, emoji: '⚔️' });
                applyFuria(gameState.selectedCharacter, 3);
                addLog('🔥 Kaio Ken: ' + gameState.selectedCharacter + ' gana Contraataque 3T + Furia 3T', 'buff');

            } else if (ability.effect === 'transformacion_goku') {
                // GOKU — Transformacion: 35% SS1 / 30% SS3 / 25% SSBlue / 10% UI
                const _tG = gameState.characters[gameState.selectedCharacter];
                if (!_tG) { endTurn(); return; }
                const _tRoll = Math.random();
                let _tForm, _tPortrait, _tFormName;
                if (_tRoll < 0.35) {
                    _tForm = 'ss1'; _tPortrait = _tG.portraitSS1;
                    _tFormName = 'Super Sayajin';
                } else if (_tRoll < 0.65) {
                    _tForm = 'ss3'; _tPortrait = _tG.portraitSS3;
                    _tFormName = 'Super Sayajin 3';
                } else if (_tRoll < 0.90) {
                    _tForm = 'ssblue'; _tPortrait = _tG.portraitSSBlue;
                    _tFormName = 'Super Sayajin Blue';
                } else {
                    _tForm = 'ui'; _tPortrait = _tG.portraitUI;
                    _tFormName = 'Ultra Instinto';
                }
                _tG.gokuForm = _tForm;
                // Cambiar portrait
                if (_tPortrait) {
                    _tG.portrait = _tPortrait;
                    _tG.currentPortrait = _tPortrait;
                }
                // Recuperar 5 HP (pasiva)
                if (typeof canHeal === 'function' ? canHeal(gameState.selectedCharacter) : true) {
                    _tG.hp = Math.min(_tG.maxHp, (_tG.hp||0) + 5);
                    addLog('💚 Superacion de Limites: Goku recupera 5 HP al transformarse', 'heal');
                }
                audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                addLog('✨ Goku se transforma en ' + _tFormName + '!', 'buff');
                // UI: aplicar Esquiva Area + Esquivar permanentes
                if (_tForm === 'ui') {
                    _tG.statusEffects = (_tG.statusEffects||[]).filter(function(e){ return !e || (normAccent(e.name||'') !== 'esquiva area' && normAccent(e.name||'') !== 'esquivar'); });
                    _tG.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: false, emoji: '💨' });
                    _tG.hasDodge = true;
                    addLog('💨 Ultra Instinto: Goku gana Esquiva Área + Esquivar permanentes', 'buff');
                }
                // SS3: limpiar flags de formas anteriores
                if (_tForm !== 'ui') {
                    _tG.hasDodge = false;
                    _tG.statusEffects = (_tG.statusEffects||[]).filter(function(e){ return !e || (normAccent(e.name||'') !== 'esquiva area' && normAccent(e.name||'') !== 'esquivar'); });
                }
                // Turno adicional
                if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _tG.team);
                renderCharacters();
                renderSummons();
                showContinueButton();
                return;

            } else if (ability.effect === 'genkidama_goku') {
                // GOKU — Genkidama: 8 AOE con efectos por forma
                const _gdG = gameState.characters[gameState.selectedCharacter];
                const _gdETeam = _gdG ? (_gdG.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _gdForm = _gdG ? _gdG.gokuForm : null;
                const _gdSS3 = _gdForm === 'ss3'; // SS3: ignora esquivar y esquiva area

                if (checkAndRedirectAOEMegaProv(_gdETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('💥 Genkidama redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _gdETeam || _c.isDead || _c.hp <= 0) continue;
                        // SS3 ignora esquivas
                        if (!_gdSS3 && (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n))) {
                            applyAOEToSummons(_gdETeam, finalDamage, gameState.selectedCharacter);
                addLog('💨 ' + _n + ' esquiva Genkidama (Esquiva Área)', 'buff'); continue;
                        }
                        let _gdDmg = finalDamage;
                        // UI: +5 daño
                        if (_gdForm === 'ui') _gdDmg += 5;
                        // SS3: crítico
                        if (_gdSS3) { _gdDmg *= 2; addLog('💥 SS3: Genkidama crítico en ' + _n, 'damage'); }
                        applyDamageWithShield(_n, _gdDmg, gameState.selectedCharacter);
                        if (_c.isDead || _c.hp <= 0) continue;
                        // SS1: roba 5 cargas
                        if (_gdForm === 'ss1') {
                            const stolen = Math.min(5, _c.charges||0);
                            _c.charges = Math.max(0, (_c.charges||0) - stolen);
                            if (_gdG) _gdG.charges = Math.min(20, (_gdG.charges||0) + stolen);
                            addLog('⚡ SS1 Genkidama: roba ' + stolen + ' cargas de ' + _n, 'buff');
                        }
                        // SS Blue: reduce cargas a 0
                        if (_gdForm === 'ssblue') {
                            _c.charges = 0;
                            addLog('🔵 SS Blue Genkidama: cargas de ' + _n + ' reducidas a 0', 'debuff');
                        }
                        // UI: 50% eliminar
                        if (_gdForm === 'ui' && Math.random() < 0.50) {
                            _c.hp = 0; _c.isDead = true;
                            addLog('✨ Ultra Instinto Genkidama: ¡' + _n + ' eliminado!', 'damage');
                            if (typeof checkGameOver === 'function') checkGameOver();
                        }
                        // SS1: +3 cargas por golpe
                        if (_gdForm === 'ss1' && _gdG) {
                            _gdG.charges = Math.min(20, (_gdG.charges||0) + 3);
                        }
                    }
                    // Daño a invocaciones
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (!_s || _s.team !== _gdETeam || _s.hp <= 0) continue;
                        let _gsdDmg = finalDamage;
                        if (_gdForm === 'ui') _gsdDmg += 5;
                        if (_gdSS3) _gsdDmg *= 2;
                        applySummonDamage(_sid, _gsdDmg, gameState.selectedCharacter);
                    }
                }
                addLog('💥 Genkidama: ' + finalDamage + ' AOE' + (_gdForm ? ' (' + _gdForm.toUpperCase() + ')' : ''), 'damage');

            } else if (ability.effect === 'kaio_ken') {
                // GOKU (legacy) - Kaio Ken: aplica Furia + Frenesí 2 turnos
                applyFuria(gameState.selectedCharacter, 2);
                applyFrenesi(gameState.selectedCharacter, 2);
                addLog('🔥 ' + gameState.selectedCharacter + ' activa Kaio Ken (Furia + Frenesí 2 turnos)', 'buff');

            } else if (ability.effect === 'genkidama') {
                // GOKU - Genkidama: AOE, críticos reducen cargas a 0
                const gkTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(gkTeam);
                const darionGk = Object.values(gameState.summons).find(s => s && s.name === 'Valkyr' && s.team === attacker.team);
                const critBonusGk = darionGk ? 0.50 : 0;
                                // MEGA PROVOCACIÓN: redirect all AOE damage
                if (checkAndRedirectAOEMegaProv(gkTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⛓️ genkidama: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== gkTeam || c.isDead || c.hp <= 0) continue;
                    const isCritGk = Math.random() < ((ability.critChance || 0.10) + critBonusGk);
                    let dmgGk = finalDamage;
                    if (isCritGk) {
                        dmgGk *= 2;
                        c.charges = 0;
                        addLog(`💥 ¡CRÍTICO Genkidama! ${n} pierde todas sus cargas`, 'damage');
                        triggerGokuCrit(gameState.selectedCharacter);
                        triggerGilgameshCrit(gameState.selectedCharacter);
                    }
                    applyDamageWithShield(n, dmgGk, gameState.selectedCharacter);
                }
                }
                for (let sId in gameState.summons) {
                    const s = gameState.summons[sId];
                    if (s && s.team === gkTeam && s.hp > 0) applySummonDamage(sId, finalDamage, gameState.selectedCharacter);
                }
                addLog(`💥 Genkidama: ${gameState.selectedCharacter} causa ${finalDamage} daño AOE`, 'damage');

            } else if (ability.effect === 'ultra_instinto') {
                // GOKU - Ultra Instinto: transformación permanente con esquivar
                attacker.ultraInstinto = true;
                applyDodge(gameState.selectedCharacter);
                ability.used = true;
                audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                addLog(`✨ ¡${gameState.selectedCharacter} activa Ultra Instinto! Buff Esquivar permanente`, 'buff');

            } else if (ability.effect === 'apply_weaken') {
                // SAITAMA - Golpe Normal: daño + Debilitar 2 turnos
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyWeaken(targetName, 2);
                addLog(`⚔️ ${gameState.selectedCharacter} usa Golpe Normal en ${targetName} causando ${finalDamage} daño`, 'damage');

            } else if (ability.effect === 'consecutive_hits') {
                // SAITAMA - Golpes Normales Consecutivos: 1-3 hits, crítico si Debilitar o Escudo
                const hits = Math.floor(Math.random() * 3) + 1;
                let totalConsDmg = 0;
                const tgtCons = gameState.characters[targetName];
                for (let h = 0; h < hits; h++) {
                    if (!tgtCons || tgtCons.isDead || tgtCons.hp <= 0) break;
                    let hitDmg = finalDamage;
                    const hasWeaken = hasStatusEffect(targetName, 'Debilitar');
                    const hasShield = tgtCons.shield > 0;
                    if (hasWeaken || hasShield) {
                        hitDmg *= 2;
                        addLog(`💥 ¡Golpe Crítico! (${hasWeaken ? 'Debilitar' : 'Escudo activo'})`, 'damage');
                        // ESPÍRITU DEL HÉROE (Saitama): cargas = mitad del daño crítico
                        attacker.charges += Math.floor(hitDmg / 2);
                    }
                    applyDamageWithShield(targetName, hitDmg, gameState.selectedCharacter);
                    totalConsDmg += hitDmg;
                    addLog(`🥊 Golpe ${h+1}/${hits}: ${hitDmg} daño a ${targetName}`, 'damage');
                }
                addLog(`⚔️ Golpes Normales Consecutivos: ${hits} golpe${hits>1?'s':''}, ${totalConsDmg} daño total`, 'damage');

            } else if (ability.effect === 'golpe_grave') {
                // SAITAMA - Golpe Grave: Elimina directamente al objetivo + turno adicional
                const tgtGrave = gameState.characters[targetName];
                if (tgtGrave && !tgtGrave.isDead && tgtGrave.hp > 0) {
                    // Forzar eliminación ignorando escudo e invulnerabilidad
                    tgtGrave.hp = 0;
                    tgtGrave.isDead = true;
                    addLog('💀 ¡GOLPE GRAVE! ' + gameState.selectedCharacter + ' elimina a ' + targetName + ' de un solo golpe', 'damage');
                    if (typeof checkGameOver === 'function') checkGameOver();
                    // Turno adicional
                    triggerAnticipacion(gameState.selectedCharacter, attacker.team);
                    renderCharacters();
                    renderSummons();
                    showContinueButton();
                    return;
                } else {
                    addLog('💀 Golpe Grave: ' + targetName + ' no es un objetivo válido', 'info');
                }

            } else if (ability.effect === 'apply_confusion') {
                // NAKIME - Nota del Biwa: aplica Confusión 2 turnos
                if (finalDamage > 0) applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyConfusion(targetName, 2); // Log incluido en applyConfusion

            } else if (ability.effect === 'cambio_energia') {
                // NAKIME - Cambio de Energía: intercambia cargas y debuffs entre aliado y enemigo aleatorio
                const myTeam = attacker.team;
                const enemyTeamCE = myTeam === 'team1' ? 'team2' : 'team1';
                const alliesCE = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === myTeam && !c.isDead && c.hp > 0; });
                const enemiesCE = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === enemyTeamCE && !c.isDead && c.hp > 0; });
                if (alliesCE.length > 0 && enemiesCE.length > 0) {
                    const allyName = alliesCE[Math.floor(Math.random() * alliesCE.length)];
                    const enemyName = enemiesCE[Math.floor(Math.random() * enemiesCE.length)];
                    const ally = gameState.characters[allyName];
                    const enemy = gameState.characters[enemyName];
                    // Intercambiar cargas
                    const tempCharges = ally.charges;
                    ally.charges = enemy.charges;
                    enemy.charges = tempCharges;
                    // Intercambiar debuffs
                    const allyDebuffs = ally.statusEffects.filter(e => e && e.type === 'debuff');
                    const enemyDebuffs = enemy.statusEffects.filter(e => e && e.type === 'debuff');
                    ally.statusEffects = ally.statusEffects.filter(e => e && e.type !== 'debuff').concat(enemyDebuffs);
                    enemy.statusEffects = enemy.statusEffects.filter(e => e && e.type !== 'debuff').concat(allyDebuffs);
                    addLog(`🎵 Cambio de Energía: Cargas y debuffs intercambiados entre ${allyName} y ${enemyName}`, 'buff');
                }

            } else if (ability.effect === 'cambio_vida') {
                // NAKIME - Cambio de Vida: intercambia HP y buffs entre enemigo y aliado aleatorio
                const myTeamCV = attacker.team;
                const enemyTeamCV = myTeamCV === 'team1' ? 'team2' : 'team1';
                const alliesCV = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === myTeamCV && !c.isDead && c.hp > 0; });
                const enemiesCV = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === enemyTeamCV && !c.isDead && c.hp > 0; });
                if (alliesCV.length > 0 && enemiesCV.length > 0) {
                    const allyNameCV = alliesCV[Math.floor(Math.random() * alliesCV.length)];
                    const enemyNameCV = enemiesCV[Math.floor(Math.random() * enemiesCV.length)];
                    const allyCV = gameState.characters[allyNameCV];
                    const enemyCV = gameState.characters[enemyNameCV];
                    // Intercambiar HP (clamp a maxHp)
                    const tempHp = allyCV.hp;
                    allyCV.hp = Math.min(allyCV.maxHp, enemyCV.hp);
                    enemyCV.hp = Math.min(enemyCV.maxHp, tempHp);
                    // Intercambiar buffs
                    const allyBuffs = allyCV.statusEffects.filter(e => e && e.type === 'buff');
                    const enemyBuffs = enemyCV.statusEffects.filter(e => e && e.type === 'buff');
                    allyCV.statusEffects = allyCV.statusEffects.filter(e => e && e.type !== 'buff').concat(enemyBuffs);
                    enemyCV.statusEffects = enemyCV.statusEffects.filter(e => e && e.type !== 'buff').concat(allyBuffs);
                    addLog(`🎵 Cambio de Vida: HP y buffs intercambiados entre ${allyNameCV} y ${enemyNameCV}`, 'buff');
                    if (allyCV.hp <= 0) { allyCV.isDead = true; }
                    if (enemyCV.hp <= 0) { enemyCV.isDead = true; }
                }

            // ── CAMBIO DE SANGRE (Nakime updated) ──
            } else if (ability.effect === 'cambio_sangre') {
                // Cambio de Sangre: intercambia HP entre aliado (menos HP) y enemigo (más HP)
                gameState.nakimePendingSwap = { type: 'sangre', enemy: targetName };
                // If AI controls Nakime: auto-select targets
                const _nakimeChar = gameState.characters[gameState.selectedCharacter];
                const _isAITurn = _nakimeChar && _nakimeChar.team === gameState.aiTeam;
                if (_isAITurn) {
                    // AI: ally with lowest HP, enemy with highest HP (targetName is enemy)
                    const _allyTeam = _nakimeChar.team;
                    const _allies = Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n]; return c && c.team === _allyTeam && !c.isDead && c.hp > 0;
                    });
                    const _lowestAlly = _allies.reduce((a, b) => 
                        (gameState.characters[a].hp / gameState.characters[a].maxHp) < (gameState.characters[b].hp / gameState.characters[b].maxHp) ? a : b
                    );
                    // Execute swap directly
                    const _allyChar = gameState.characters[_lowestAlly];
                    const _enemyChar = gameState.characters[targetName];
                    const _tempHp = _allyChar.hp;
                    _allyChar.hp = Math.min(_enemyChar.hp, _allyChar.maxHp);
                    _enemyChar.hp = Math.min(_tempHp, _enemyChar.maxHp);
                    if (_enemyChar.hp <= 0) { _enemyChar.isDead = true; }
                    addLog('🔄 Cambio de Sangre: HP de ' + _lowestAlly + ' y ' + targetName + ' intercambiados (IA)', 'damage');
                    gameState.nakimePendingSwap = null;
                    renderCharacters();
                    if (checkGameOver()) return;
                } else {
                    showNakimeSecondTarget('sangre', targetName);
                    return;
                }

            // ── CAMBIO DEMONÍACO (Nakime - cargas y buffs bidireccional) ──
            } else if (ability.effect === 'cambio_demoniaco') {
                // Cambio Demoniaco: intercambia CARGAS entre aliado (menos cargas) y enemigo (más cargas)
                gameState.nakimePendingSwap = { type: 'demoniaco', enemy: targetName };
                const _nakimeChar2 = gameState.characters[gameState.selectedCharacter];
                const _isAITurn2 = _nakimeChar2 && _nakimeChar2.team === gameState.aiTeam;
                if (_isAITurn2) {
                    const _allyTeam2 = _nakimeChar2.team;
                    const _allies2 = Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n]; return c && c.team === _allyTeam2 && !c.isDead && c.hp > 0;
                    });
                    const _lowestChargeAlly = _allies2.reduce((a, b) =>
                        (gameState.characters[a].charges || 0) < (gameState.characters[b].charges || 0) ? a : b
                    );
                    const _allyChar2 = gameState.characters[_lowestChargeAlly];
                    const _enemyChar2 = gameState.characters[targetName];
                    const _tempCharges = _allyChar2.charges || 0;
                    _allyChar2.charges = Math.min(20, _enemyChar2.charges || 0);
                    _enemyChar2.charges = Math.max(0, _tempCharges);
                    addLog('🔄 Cambio Demoniaco: Cargas de ' + _lowestChargeAlly + ' y ' + targetName + ' intercambiadas (IA)', 'damage');
                    gameState.nakimePendingSwap = null;
                    renderCharacters();
                } else {
                    showNakimeSecondTarget('demoniaco', targetName);
                    return;
                }

            } else if (ability.effect === 'colapso') {
                // NAKIME - Colapso: intercambia HP y cargas de los equipos completos
                const myTeamCo = attacker.team;
                const enemyTeamCo = myTeamCo === 'team1' ? 'team2' : 'team1';
                const alliesCo = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === myTeamCo && !c.isDead && c.hp > 0; });
                const enemiesCo = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === enemyTeamCo && !c.isDead && c.hp > 0; });
                if (alliesCo.length > 0 && enemiesCo.length > 0) {
                    const allyNameCo = alliesCo[Math.floor(Math.random() * alliesCo.length)];
                    const enemyNameCo = enemiesCo[Math.floor(Math.random() * enemiesCo.length)];
                    const allyCo = gameState.characters[allyNameCo];
                    const enemyCo = gameState.characters[enemyNameCo];
                    const tempHpCo = allyCo.hp;
                    allyCo.hp = Math.min(allyCo.maxHp, enemyCo.hp);
                    enemyCo.hp = Math.min(enemyCo.maxHp, tempHpCo);
                    const tempChargesCo = allyCo.charges;
                    allyCo.charges = enemyCo.charges;
                    enemyCo.charges = tempChargesCo;
                    addLog(`🎵 Colapso: HP y cargas intercambiadas entre ${allyNameCo} y ${enemyNameCo}`, 'buff');
                    if (allyCo.hp <= 0) { allyCo.isDead = true; }
                    if (enemyCo.hp <= 0) { enemyCo.isDead = true; }
                }

            } else if (ability.effect === 'apply_poison_2') {
                // MUZAN - Espinas de Sangre
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPoison(targetName, 2);
                addLog(`⚔️ ${gameState.selectedCharacter} usa Espinas de Sangre en ${targetName} causando ${finalDamage} daño`, 'damage');

            } else if (ability.effect === 'sangre_demoniaca') {
                // MUZAN - Sangre Demoniaca: daño + veneno 3 turnos + cura 3 HP a Muzan
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPoison(targetName, 3);
                const muzanHeal = Math.min(3, attacker.maxHp - attacker.hp);
                if (muzanHeal > 0) { attacker.hp = Math.min(attacker.maxHp, attacker.hp + muzanHeal); addLog(`🩸 Muzan recupera ${muzanHeal} HP`, 'heal'); }
                addLog(`⚔️ Sangre Demoniaca: ${finalDamage} daño + Veneno 3 turnos a ${targetName}`, 'damage');

            } else if (ability.effect === 'sombra_noche') {
                // MUZAN - Sombra de la Noche: AOE daño + Sigilo 2T + Veneno 3T a enemigos
                const snTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(snTeam);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === snTeam && !c.isDead && c.hp > 0) {
                        if (!checkAsprosAOEImmunity(n, true)) {
                            applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                            applyPoison(n, 3);
                        }
                    }
                }
                // Sigilo con flag appliedThisTurn para sobrevivir el turno actual
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && normAccent(e.name||'') !== 'sigilo');
                attacker.statusEffects.push({ name: 'Sigilo', type: 'buff', duration: 2, emoji: '👤', appliedThisTurn: true });
                addLog('🌑 Sombra de la Noche: ' + finalDamage + ' AOE + Veneno 3T + Sigilo aplicado a ' + charName, 'damage');

            
            } else if (ability.effect === 'muzan_transform') {
                // MUZAN - Rey de los Demonios Definitivo: TRANSFORMACION
                // 1 AOE + Veneno 5T + +10 velocidad + ataques activan ticks de veneno
                attacker.muzanTransformed = true;
                const _mzTP = attacker.transformPortrait || attacker.transformationPortrait;
                if (_mzTP) { attacker.portrait = _mzTP; }
                audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                const mzTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(mzTeam);
                // 1 daño AOE
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === mzTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        applyPoison(n, 5);
                    }
                }
                for (let sid in gameState.summons) {
                    const s = gameState.summons[sid];
                    if (s && s.team === mzTeam && s.hp > 0) applySummonDamage(sid, finalDamage, gameState.selectedCharacter);
                }
                // +10 velocidad permanente
                attacker.speed = (attacker.speed || 86) + 10;
                // Flag: ataques de Muzan activarán ticks de veneno (procesado en applyDamageWithShield)
                attacker.muzanVenomOnHit = true;
                ability.used = true;
                addLog('👹 ¡Rey de los Demonios Definitivo! 1 AOE + Veneno 5T al equipo enemigo. Muzan gana +10 VEL. Sus ataques activarán ticks de veneno.', 'buff');

            } else if (ability.effect === 'apply_fear_1') {
                // SAURON Voluntad de Mordor / DARTH VADER Intimidación del Imperio
                if (finalDamage > 0) applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFear(targetName, 1); // 1 turno de duración
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName}`, 'damage');

            } else if (ability.effect === 'aoe_fear_50') {
                // SAURON - Mano Negra: AOE daño + 50% chance miedo
                const sfTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(sfTeam);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === sfTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        if (Math.random() < 0.50) applyFear(n, 1);
                    }
                }
                addLog(`🖤 Mano Negra: ${finalDamage} daño AOE con 50% chance Miedo`, 'damage');

            } else if (ability.effect === 'apply_mega_stun') {
                // SAURON - Señor Oscuro: daño + Mega Aturdimiento
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyStun(targetName, 2); // 2 = Mega Aturdimiento
                addLog(`⚔️ Señor Oscuro: ${finalDamage} daño + Mega Aturdimiento a ${targetName}`, 'damage');

            } else if (ability.effect === 'poder_del_anillo') {
                // SAURON - Poder del Anillo: MegaProvocacion 4t + Regeneracion 20% 4t
                attacker.sauronTransformed = true;
                attacker.statusEffects.push({ name: 'MegaProvocacion', type: 'buff', duration: 4, emoji: '🎯' });
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 4, percent: 20, emoji: '💖' });
                addLog('💍 ¡Poder del Anillo! Sauron activa MegaProvocación 4t + Regeneración 20% 4t', 'buff');

            } else if (ability.effect === 'apply_counterattack') {
                // DARTH VADER - Puño del Imperio: Buff Contraataque
                applyCounterattackBuff(gameState.selectedCharacter, ability.counterDuration || 4);
                addLog(`⚔️ ${gameState.selectedCharacter} activa Contraataque por ${ability.counterDuration || 4} turnos`, 'buff');

            } else if (ability.effect === 'apply_megaprovocation_buff') {
                // DARTH VADER - Lado Oscuro de la Fuerza: Mega Provocación 4 turnos
                // Use Kamish-style mega provocation as a character buff
                attacker.statusEffects.push({ name: 'MegaProvocacion', type: 'buff', duration: ability.provDuration || 4, emoji: '🎯' });
                addLog('🎯 ' + gameState.selectedCharacter + ' activa Mega Provocación por ' + (ability.provDuration || 4) + ' turnos', 'buff');

            } else if (ability.effect === 'ira_elegido') {
                // DARTH VADER - Ira del Elegido Caído: 2 AOE + 1 por HP perdido
                const iraBonusDmg = attacker.maxHp - attacker.hp;
                const iraTotal = finalDamage + iraBonusDmg;
                const iraTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(iraTeam);
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(iraTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🎯 ira_elegido: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === iraTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, iraTotal, gameState.selectedCharacter);
                    }
                }
                }
                for (let sId in gameState.summons) {
                    const s = gameState.summons[sId];
                    if (s && s.team === iraTeam && s.hp > 0) applySummonDamage(sId, iraTotal, gameState.selectedCharacter);
                }
                addLog(`⚡ Ira del Elegido Caído: ${iraTotal} daño AOE (${finalDamage} base + ${iraBonusDmg} por HP perdido)`, 'damage');

            } else if (ability.effect === 'agonia_escarcha') {
                // LICH KING - Agonía de Escarcha: 1 daño + roba 1 HP + Buff Provocación 2T
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtAE = gameState.characters[targetName];
                if (tgtAE && !tgtAE.isDead && tgtAE.hp > 0) {
                    tgtAE.hp = Math.max(0, tgtAE.hp - 1);
                    if (tgtAE.hp <= 0) { tgtAE.isDead = true; addLog('💀 ' + targetName + ' fue derrotado', 'damage'); }
                    else {
                        addLog('❄️ Agonía de Escarcha: roba 1 HP de ' + targetName, 'damage');
                        // Curar 1 HP a Lich King (respeta QS y Aura de Luz)
                        if (typeof applyHeal === 'function') {
                            applyHeal(charName, 1, 'Agonía de Escarcha');
                        } else if (typeof canHeal === 'function' ? canHeal(charName) : true) {
                            attacker.hp = Math.min(attacker.maxHp, (attacker.hp||0) + 1);
                            addLog('❄️ Lich King recupera 1 HP (robo de vida)', 'heal');
                        }
                    }
                }
                // Buff Provocación 2T a Lich King
                attacker.statusEffects = (attacker.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'provocacion');
                attacker.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                addLog('🛡️ Agonía de Escarcha: Lich King gana Provocación 2T', 'buff');
                addLog('❄️ Agonía de Escarcha: ' + finalDamage + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'cadenas_hielo') {
                // LICH KING - Cadenas de Hielo: 1 AOE + 50% Congelación por objetivo
                const _chETeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_chETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('❄️ Cadenas de Hielo redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _chETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' esquiva (EA)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        if (Math.random() < 0.50) {
                            applyFreeze(_n, 1);
                            addLog('❄️ Cadenas de Hielo: Congelación 1T a ' + _n, 'debuff');
                        }
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _chETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                    addLog('❄️ Cadenas de Hielo: 1 AOE completado', 'damage');
                }

            } else if (ability.effect === 'segador_almas') {
                // LICH KING - Segador de Almas OVER: 10 daño, si mata revive como aliado
                const tgtSegador = gameState.characters[targetName];
                const aliveBeforeSeg = tgtSegador && !tgtSegador.isDead && tgtSegador.hp > 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog(`⚔️ Segador de Almas: ${finalDamage} daño a ${targetName}`, 'damage');
                if (aliveBeforeSeg && tgtSegador && (tgtSegador.isDead || tgtSegador.hp <= 0)) {
                    // Revivir como aliado de Lich King
                    tgtSegador.isDead = false;
                    tgtSegador.hp = Math.ceil(tgtSegador.maxHp * 0.50);
                    tgtSegador.team = attacker.team; // Cambia de equipo
                    tgtSegador.statusEffects = [];
                    addLog(`💀➡️👻 ¡${targetName} revive como aliado de Lich King con ${tgtSegador.hp} HP!`, 'buff');
                }

            } else if (ability.effect === 'el_rey_caido') {
                // LICH KING - El Rey Caído: 3 invocaciones aleatorias
                const lichPool = ['Sindragosa', 'Banshee', 'Valkyr', 'Necrofago', 'Caballero de la Muerte'];
                const lichWeights = { 'Sindragosa': 24, 'Banshee': 24, 'Valkyr': 24, 'Necrofago': 24, 'Caballero de la Muerte': 4 };
                const myLichSummons = getSummonsBySummoner(gameState.selectedCharacter);
                const existingLich = new Set(myLichSummons.map(s => s.name));
                const availableLich = lichPool.filter(n => !existingLich.has(n));
                if (availableLich.length === 0) {
                    addLog(`❌ ${gameState.selectedCharacter} ya tiene todas las invocaciones activas`, 'info');
                } else {
                    function pickWeightedLich(pool, weights) {
                        const total = pool.reduce((s, n) => s + weights[n], 0);
                        let rand = Math.random() * total;
                        for (const n of pool) { rand -= weights[n]; if (rand <= 0) return n; }
                        return pool[pool.length - 1];
                    }
                    // El Rey Caído: 1 invocación aleatoria
                    const _totalSummons = Object.values(gameState.summons).filter(s => s && s.team === attacker.team).length;
                    const _slotsLeft = Math.max(0, 5 - _totalSummons);
                    const toSummonLich = Math.min(1, _slotsLeft); // solo 1 invocación
                    const remainingLich = [...availableLich];
                    const selectedLich = [];
                    for (let i = 0; i < toSummonLich; i++) {
                        if (remainingLich.length === 0) break;
                        const chosen = pickWeightedLich(remainingLich, lichWeights);
                        selectedLich.push(chosen);
                        remainingLich.splice(remainingLich.indexOf(chosen), 1);
                        summonShadow(chosen, gameState.selectedCharacter);
                        // Invocaciones especiales con Mega Provocación permanente
                        if (chosen === 'Sindragosa' || chosen === 'Caballero de la Muerte') {
                            const newSummon = Object.values(gameState.summons).find(s => s && s.name === chosen && s.summoner === gameState.selectedCharacter);
                            if (newSummon) newSummon.megaProvocation = true;
                        }
                    }
                    addLog(`👑 El Rey Caído: Lich King invoca ${selectedLich.join(', ')} (1 invocación aleatoria)`, 'buff');
                }

            } else if (ability.effect === 'animacion') {
                // OZYMANDIAS - Animación
                const tgtAnim = gameState.characters[targetName];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (tgtAnim && tgtAnim.statusEffects && tgtAnim.statusEffects.some(e => e && e.name === 'Quemadura Solar')) {
                    attacker.animacionBonusChargeGain = (attacker.animacionBonusChargeGain || 0) + 1;
                    addLog(`☀️ Animación: Ozymandias gana +1 generación de cargas permanente (total: ${1 + attacker.animacionBonusChargeGain})`, 'buff');
                }
                finalChargeGain += (attacker.animacionBonusChargeGain || 0);
                addLog(`⚔️ Animación: ${finalDamage} daño a ${targetName}`, 'damage');

            // sentencia_del_sol viejo eliminado — usar handler AOE más abajo

            } else if (ability.effect === 'summon_sphinx') {
                // OZYMANDIAS — invoca Abu el-Hol Sphinx (bloqueado si ya está activa)
                const existingSphinx = Object.values(gameState.summons).find(function(s){ return s && (s.name === 'Abu el-Hol Sphinx' || s.name === 'Sphinx Wehem-Mesut') && s.hp > 0; });
                if (existingSphinx) {
                    addLog('❌ Abu el-Hol Sphinx ya está activa en el campo — no puede invocarse de nuevo', 'info');
                    endTurn(); return;
                } else {
                    summonShadow('Abu el-Hol Sphinx', gameState.selectedCharacter);
                    addLog('🦁 Ozymandias invoca a Abu el-Hol Sphinx', 'buff');
                }

            } else if (ability.effect === 'summon_ramesseum') {
                // OZYMANDIAS — Ramesseum Tentyris (bloqueado si ya está activa)
                const existingRam = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Ramesseum Tentyris' && s.hp > 0; });
                if (existingRam) {
                    addLog('❌ Ramesseum Tentyris ya está activa en el campo — no puede invocarse de nuevo', 'info');
                    endTurn(); return;
                } else {
                    summonShadow('Ramesseum Tentyris', gameState.selectedCharacter);
                    addLog('🏛️ Ozymandias invoca a Ramesseum Tentyris', 'buff');
                }

            } else if (ability.effect === 'espada_merodach') {
                // GILGAMESH - Espada Merodach: AOE daño + elimina 3 cargas
                const emTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(emTeam);
                const darionEM = Object.values(gameState.summons).find(s => s && s.name === 'Valkyr' && s.team === attacker.team);
                const muzanEM = ((gameState.selectedCharacter === 'Muzan Kibutsuji' || gameState.selectedCharacter === 'Muzan Kibutsuji v2')) ? (attacker.muzanCritBonus || 0) : 0;
                const critBonusEM = (darionEM ? 0.50 : 0) + 0.10 + muzanEM;

                // ── MEGA PROVOCACIÓN: redirige todo el daño al portador ──
                const emKamish = checkKamishMegaProvocation(emTeam);
                if (emKamish) {
                    // Count alive targets for damage multiplication
                    let emTargetCount = 0;
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === emTeam && !c.isDead && c.hp > 0) emTargetCount++;
                    }
                    for (let sId in gameState.summons) {
                        const s = gameState.summons[sId];
                        if (s && s.team === emTeam && s.hp > 0 && sId !== emKamish.id) emTargetCount++;
                    }
                    const emTotalDmg = finalDamage * Math.max(1, emTargetCount);
                    if (emKamish.isCharacter) {
                        applyDamageWithShield(emKamish.characterName, emTotalDmg, gameState.selectedCharacter);
                        addLog('🌑 ' + emKamish.characterName + ' (Mega Provocación) absorbe ' + emTotalDmg + ' daño de Espada Merodach', 'damage');
                    } else {
                        applySummonDamage(emKamish.id, emTotalDmg, gameState.selectedCharacter);
                        addLog('🐉 ' + (emKamish.kamish ? emKamish.kamish.name : 'Invocación') + ' (Mega Provocación) absorbe ' + emTotalDmg + ' daño de Espada Merodach', 'damage');
                    }
                    addLog('⚔️ Espada Merodach (Mega Prov): ' + emTotalDmg + ' daño total redirigido', 'damage');
                } else {
                    // Sin Mega Provocación — AOE normal
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== emTeam || c.isDead || c.hp <= 0) continue;
                        // ESQUIVA ÁREA: inmune a todo efecto AOE
                        if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) {
                            addLog('🌟 ' + n + ' es inmune a Espada Merodach (Esquiva Área)', 'buff');
                            continue; // skip damage AND charge drain
                        }
                        const isCritEM = Math.random() < ((ability.critChance || 0.10) + critBonusEM);
                        let dmgEM = finalDamage;
                        if (isCritEM) {
                            dmgEM *= 2;
                            addLog('💥 ¡CRÍTICO! Espada Merodach en ' + n, 'damage');
                            triggerGilgameshCrit(gameState.selectedCharacter);
                        }
                        applyDamageWithShield(n, dmgEM, gameState.selectedCharacter);
                        // Only drain charges if NOT Esquiva Area (already skipped above via continue)
                        c.charges = Math.max(0, c.charges - 3);
                        addLog('👑 ' + n + ' pierde 3 cargas (Espada Merodach)', 'damage');
                    }
                    for (let sId in gameState.summons) {
                        const s = gameState.summons[sId];
                        if (s && s.team === emTeam && s.hp > 0) applySummonDamage(sId, finalDamage, gameState.selectedCharacter);
                    }
                    addLog('⚔️ Espada Merodach: ' + finalDamage + ' daño AOE a todos los enemigos', 'damage');
                }
            } else if (ability.effect === 'enkidu' || ability.effect === 'enkidu_cadenas') {
                // GILGAMESH - Enkidu Cadenas del Cielo: cancela invocaciones + Mega Stun a >5 cargas
                const enkTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                // Cancelar todas las invocaciones enemigas
                const enemySummons = Object.keys(gameState.summons).filter(id => gameState.summons[id] && gameState.summons[id].team === enkTeam);
                if (enemySummons.length === 0) {
                    addLog('⛓️ Enkidu: No hay invocaciones enemigas que cancelar', 'info');
                } else {
                    enemySummons.forEach(id => {
                        const sName = gameState.summons[id] ? gameState.summons[id].name : '?';
                        addLog('⛓️ Enkidu cancela la invocación de ' + sName, 'damage');
                        delete gameState.summons[id];
                    });
                    renderSummons();
                }
                // Mega Aturdimiento a enemigos con >5 cargas
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === enkTeam && !c.isDead && c.hp > 0 && c.charges > 5) {
                        applyStun(n);
                        addLog('⛓️ Enkidu: ' + n + ' queda Mega Aturdido (tenía ' + c.charges + ' cargas)', 'damage');
                    }
                }
                addLog(`⛓️ ¡Enkidu: Cadenas del Cielo! Invocaciones canceladas`, 'damage');

            } else if (ability.effect === 'enuma_elish') {
                // GILGAMESH - Enuma Elish: 10 daño, doble si el objetivo tiene Escudo HP
                const tgtEE = gameState.characters[targetName];
                let dmgEE = finalDamage;
                if (tgtEE && tgtEE.shield > 0) {
                    dmgEE *= 2;
                    addLog(`💥 Enuma Elish: daño doble (${targetName} tiene Escudo HP activo)`, 'damage');
                }
                applyDamageWithShield(targetName, dmgEE, gameState.selectedCharacter);
                addLog(`⚔️ Enuma Elish: ${dmgEE} daño a ${targetName}`, 'damage');

            } else if (ability.effect === 'sangre_de_esparta') {
                // Sangre de Esparta: sacrifica 10 HP, todos los aliados (excepto Leonidas) generan 6 cargas
                const _seAtk = gameState.characters[gameState.selectedCharacter];
                if (_seAtk) {
                    _seAtk.hp = Math.max(1, (_seAtk.hp || 0) - 10);
                    addLog('Sangre de Esparta: ' + charName + ' sacrifica 10 HP', 'damage');
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.isDead || c.hp <= 0 || c.team !== _seAtk.team || n === charName) continue;
                        c.charges = Math.min(20, (c.charges || 0) + 6);
                        addLog('Sangre de Esparta: ' + n + ' genera 6 cargas', 'buff');
                    }
                }

            } else if (ability.effect === 'gloria_300') {
                // Gloria de los 300: AOE 4 + Regen 25% 2T a aliados + limpia 1 debuff a aliados
                const gloriaEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const gloriaAllyTeam = attacker.team;
                // AOE damage to enemies
                const gloriaKamish = checkKamishMegaProvocation(gloriaEnemyTeam);
                if (gloriaKamish) {
                    let gloriaCount = 0;
                    for (let n in gameState.characters) { const c = gameState.characters[n]; if (c && c.team === gloriaEnemyTeam && !c.isDead && c.hp > 0) gloriaCount++; }
                    for (let sid in gameState.summons) { const s = gameState.summons[sid]; if (s && s.team === gloriaEnemyTeam && s.hp > 0 && sid !== gloriaKamish.id) gloriaCount++; }
                    const gloriaTotalDmg = finalDamage * gloriaCount;
                    if (gloriaKamish.isCharacter) { const gc = gameState.characters[gloriaKamish.characterName]; if (gc) { const gco = gc.hp; applyDamageWithShield(gloriaKamish.characterName, gloriaTotalDmg, charName); } }
                    else applySummonDamage(gloriaKamish.id, gloriaTotalDmg, charName);
                    addLog('🐉 Kamish absorbe ' + gloriaTotalDmg + ' daño AOE (Gloria de los 300)', 'buff');
                } else {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== gloriaEnemyTeam || c.isDead || c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE', 'buff'); continue; }
                        applyDamageWithShield(n, finalDamage, charName);
                    }
                    for (let sid in gameState.summons) { const s = gameState.summons[sid]; if (s && s.team === gloriaEnemyTeam && s.hp > 0) applySummonDamage(sid, finalDamage, charName); }
                    addLog('⚔️ Gloria de los 300: ' + finalDamage + ' AOE a todos los enemigos', 'damage');
                }
                // Regen 25% 2T + disipa TODOS los debuffs del equipo aliado
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== gloriaAllyTeam || c.isDead || c.hp <= 0) continue;
                    c.statusEffects = (c.statusEffects || []).filter(e => e && !(e.name === 'Regeneracion' && e.gloria300));
                    c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 2, percent: 25, gloria300: true, emoji: '💖' });
                    const _g3Debuffs = (c.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (_g3Debuffs.length > 0) {
                        c.statusEffects = c.statusEffects.filter(e => !e || e.type !== 'debuff' || e.permanent);
                        addLog('Gloria de los 300: ' + _g3Debuffs.length + ' debuff(s) disipados de ' + n, 'buff');
                    }
                }
                addLog('Gloria de los 300: Regeneracion 25pct 2T + todos los debuffs del equipo aliado disipados', 'buff');

            
            } else if (ability.effect === 'self_provocation') {
                // Doomsday Provocación
                attacker.statusEffects = attacker.statusEffects.filter(e => e.name !== 'Provocación');
                attacker.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 2, emoji: '🛡️' });
                addLog(`🛡️ ${gameState.selectedCharacter} activa Provocación`, 'buff');

            } else if (ability.effect === 'rugido_devastador') {
                // Doomsday: Rugido del Devastador — Provocación + Cuerpo Perfecto
                const dday = attacker;
                dday.statusEffects = (dday.statusEffects || []).filter(e => e && e.name !== 'Provocación' && e.name !== 'Cuerpo Perfecto');
                dday.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 2, emoji: '🛡️', passiveHidden: false });
                dday.statusEffects.push({ name: 'Cuerpo Perfecto', type: 'buff', duration: 2, emoji: '💠', passiveHidden: false });
                addLog(`🛡️ ${charName} activa Rugido del Devastador: Provocación + Cuerpo Perfecto`, 'buff');
                if (ability.chargeGain) {
                    attacker.charges = Math.min(20, (attacker.charges || 0) + ability.chargeGain);
                }

            } else if (ability.effect === 'aoe_stun_chance') {
                // Smashing Strike: ST daño 3 + Aturdimiento
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyStun(targetName, 1);
                addLog('💥 Smashing Strike: ' + targetName + ' recibe ' + finalDamage + ' daño y Aturdimiento', 'damage');

            
            } else if (ability.effect === 'skill_drain') {
                // Skill Drain: 0 daño de golpe, causa 1-3 de daño por efecto a cada enemigo. Cura HP = daño total
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                let totalDmg = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) {
                        const effectDmg = Math.floor(Math.random() * 3) + 1;
                        applyDamageWithShield(n, effectDmg, gameState.selectedCharacter);
                        totalDmg += effectDmg;
                        addLog(`⚡ Skill Drain: ${n} recibe ${effectDmg} de daño`, 'damage');
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        const effectDmgS = Math.floor(Math.random() * 3) + 1;
                        applySummonDamage(_sid, effectDmgS, gameState.selectedCharacter);
                        totalDmg += effectDmgS;
                    }
                }
                if (totalDmg > 0) {
                    const oldHp = attacker.hp;
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + totalDmg);
                    const actualHeal = attacker.hp - oldHp;
                    if (actualHeal > 0) triggerBendicionSagrada(attacker.team, actualHeal);
                }
                addLog(`💚 ${gameState.selectedCharacter} recupera ${totalDmg} HP (Skill Drain)`, 'heal');
            } else if (ability.effect === 'speed_up_self') {
                // Shingun Ken: daño + +1 velocidad propia + 50% Posesión al objetivo
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                attacker.speed += 1;
                addLog('⚡ ' + gameState.selectedCharacter + ' aumenta su velocidad en 1 (ahora ' + attacker.speed + ')', 'buff');
                if (Math.random() < 0.50) {
                    applyPossession(targetName, 1);
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'speed_bonus_damage') {
                // Kōsoku Ken: daño + 1 por cada punto de diferencia de velocidad
                const tgtChar = gameState.characters[targetName];
                const speedDiff = Math.max(0, attacker.speed - (tgtChar ? tgtChar.speed : 0));
                const totalDmg = finalDamage + speedDiff;
                applyDamageWithShield(targetName, totalDmg, gameState.selectedCharacter);
                addLog(`⚡ Kōsoku Ken: ${totalDmg} daño (+${speedDiff} por diferencia de velocidad)`, 'damage');

            } else if (ability.effect === 'crit_chance') {
                // AOE con probabilidad de crit por objetivo
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(enemyTeam);
                // Bonos de crit acumulados
                const gilBonus = ((gameState.selectedCharacter === 'Gilgamesh' || gameState.selectedCharacter === 'Gilgamesh v2')) ? 0.10 : 0;
                const muzanBonus = ((gameState.selectedCharacter === 'Muzan Kibutsuji' || gameState.selectedCharacter === 'Muzan Kibutsuji v2')) ? (attacker.muzanCritBonus || 0) : 0;
                const darionBonus = Object.values(gameState.summons).find(s => s && s.name === 'Valkyr' && s.team === attacker.team) ? 0.50 : 0;
                const totalCritBonus = gilBonus + muzanBonus + darionBonus;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeam || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog(`🌌 Esquiva Área: Aspros es inmune al ataque AOE`, 'buff'); continue; }
                    const isCrit = Math.random() < Math.min(1, (ability.critChance || 0.1) + totalCritBonus);
                    const dmg = isCrit ? finalDamage * 2 : finalDamage;
                    applyDamageWithShield(n, dmg, gameState.selectedCharacter);
                    if (isCrit) {
                        addLog(`💥 ¡CRÍTICO en ${n}!`, 'damage');
                        triggerGilgameshCrit(gameState.selectedCharacter);
                        triggerGokuCrit(gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, dmg, gameState.selectedCharacter);
                    }
                }
                for (let sId in gameState.summons) {
                    const s = gameState.summons[sId];
                    if (s && s.team === enemyTeam && s.hp > 0) applySummonDamage(sId, finalDamage, gameState.selectedCharacter);
                }

            } else if (ability.effect === 'phoenix_genma_ken') {
                // AOE + si tiene quemadura genera 2 cargas
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                let extraCharges = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        if (hasStatusEffect(n, 'Quemadura')) extraCharges += 2;
                    }
                }
                if (extraCharges > 0) { attacker.charges += extraCharges; addLog(`⚡ Phoenix Genma Ken: +${extraCharges} cargas por objetivos con Quemadura`, 'buff'); }

            } else if (ability.effect === 'fenix_armor') {
                // Armadura Divina del Fénix: transformación — mismo patrón que Antares
                attacker.fenixArmorActive = true;
                attacker.basePortrait = attacker.basePortrait || attacker.portrait;
                if (attacker.transformPortrait) { attacker.portrait = attacker.transformPortrait; }
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 99, emoji: '💖', amount: Math.ceil(attacker.maxHp * 0.20) });
                audioManager.playTransformSfx();
                if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700);
                if (typeof _triggerPowerUp === 'function') { _triggerPowerUp(gameState.selectedCharacter, attacker.team); }
                addLog(`🦅 ${gameState.selectedCharacter} equipa la Armadura Divina del Fénix`, 'buff');
                ability.used = true;
                renderCharacters();

            } else if (ability.effect === 'heal_ally') {
                // Curación de aliado (Alexstrasza Fuego Vital / Min Byung)
                const healAmt = ability.healAmount || ability.heal || 2;
                const tgt2 = gameState.characters[targetName];
                if (tgt2) {
                    const old = tgt2.hp; tgt2.hp = Math.min(tgt2.maxHp, tgt2.hp + healAmt);
                    const actual = tgt2.hp - old;
                    addLog(`💚 ${targetName} recupera ${actual} HP`, 'heal');
                    triggerBendicionSagrada(tgt2.team, actual);
                }

            } else if (ability.effect === 'fuego_vital') {
                // ALEXSTRAZA - Fuego Vital: Escudo 2 HP + Aura de fuego
                const tgtFV = gameState.characters[targetName];
                if (tgtFV) {
                    applyShield(targetName, ability.shieldAmount || 2);
                    // Apply Aura de fuego buff
                    if (!hasStatusEffect(targetName, 'Aura de fuego')) {
                        applyBuff(targetName, { name: 'Aura de fuego', type: 'buff', duration: 4, emoji: '🔥', description: 'Quemadura 2HP al atacante' });
                    }
                    addLog('🔥 ' + targetName + ' recibe Escudo ' + (ability.shieldAmount || 2) + ' HP + Aura de Fuego (Fuego Vital)', 'buff');
                }

            } else if (ability.effect === 'llama_preservadora') {
                // ALEXSTRAZA - Llama Preservadora: Escudo 5 HP + Aura de fuego + Aura de Luz
                const tgtLP = gameState.characters[targetName];
                if (tgtLP) {
                    applyShield(targetName, ability.shieldAmount || 5, 'fire_charge_regen');
                    // Apply Aura de fuego
                    if (!hasStatusEffect(targetName, 'Aura de fuego')) {
                        applyBuff(targetName, { name: 'Aura de fuego', type: 'buff', duration: 4, emoji: '🔥', description: 'Quemadura 2HP al atacante' });
                    }
                    // Apply Aura de Luz
                    if (!hasStatusEffect(targetName, 'Aura de Luz') && !hasStatusEffect(targetName, 'Aura de luz')) {
                        applyBuff(targetName, { name: 'Aura de Luz', type: 'buff', duration: 4, emoji: '✨', description: 'Duplica la recuperación de HP' });
                    }
                    addLog('🔥✨ Llama Preservadora: ' + targetName + ' recibe Escudo ' + (ability.shieldAmount || 5) + ' HP + Aura de Fuego + Aura de Luz', 'buff');
                }

            } else if (ability.effect === 'don_de_la_vida') {
                // Don de la Vida (Alexstrasza actualizado): cura 4 HP al objetivo
                const tgtDV = gameState.characters[targetName];
                if (tgtDV) {
                    const oldHpDV = tgtDV.hp;
                    tgtDV.hp = Math.min(tgtDV.maxHp, tgtDV.hp + 4);
                    const _ddvHeal = tgtDV.hp - oldHpDV;
                    if (_ddvHeal > 0) triggerBendicionSagrada(tgtDV.team, _ddvHeal);
                    addLog(`💚 ${targetName} recupera ${tgtDV.hp - oldHpDV} HP (Don de la Vida)`, 'heal');
                }

            } else if (ability.effect === 'fire_retaliation_shield') {
                // Llama Preservadora: escudo + represalia de quemadura
                const tgt3 = gameState.characters[targetName];
                if (tgt3) {
                    tgt3.shield = (ability.shieldAmount || 5);
                    tgt3.shieldEffect = 'fire_retaliation';
                    addLog(`🔥 ${targetName} recibe Escudo ${ability.shieldAmount} HP con represalia de Quemadura (Llama Preservadora)`, 'buff');
                }

            } else if (ability.effect === 'leyenda_nordica') {
                // RAGNAR - Leyenda Nórdica: Escudo 6 HP + Regeneración 10% x2 turnos
                attacker.shield = 6; attacker.shieldEffect = null;
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, emoji: '💖', amount: Math.ceil(attacker.maxHp * 0.10) });
                addLog(`⚔️ ${gameState.selectedCharacter} activa Leyenda Nórdica: Escudo 6 HP + Regeneración 10% (2 turnos)`, 'buff');

            // ── DOUBLE GREAT HORN (Aldebaran): MT 2 objetivos, 60% x2 / 40% x3, escudo = daño total ──
            } else if (ability.effect === 'double_great_horn') {
                // Seleccionar hasta 2 objetivos del equipo enemigo
                const enemyTeamDGH = attacker.team === 'team1' ? 'team2' : 'team1';
                const aliveEnemiesDGH = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === enemyTeamDGH && !c.isDead && c.hp > 0;
                });
                // Si fue llamado con targetName, ese es el primer objetivo
                // Segundo objetivo: aleatorio entre los demás enemigos vivos (o el mismo si solo hay 1)
                const targets = [];
                if (targetName && aliveEnemiesDGH.includes(targetName)) {
                    targets.push(targetName);
                    const others = aliveEnemiesDGH.filter(n => n !== targetName);
                    if (others.length > 0) {
                        targets.push(others[Math.floor(Math.random() * others.length)]);
                    } else {
                        targets.push(targetName); // golpea 2 veces al mismo
                    }
                } else if (aliveEnemiesDGH.length > 0) {
                    targets.push(aliveEnemiesDGH[Math.floor(Math.random() * aliveEnemiesDGH.length)]);
                    targets.push(aliveEnemiesDGH[Math.floor(Math.random() * aliveEnemiesDGH.length)]);
                }
                
                let totalDamageDGH = 0;
                targets.forEach(function(tgt) {
                    let dmg = finalDamage;
                    // 60% doble, 40% triple
                    if (Math.random() < 0.60) {
                        dmg = finalDamage * 2;
                        addLog(`💥 Double Great Horn: ¡Daño doble (${dmg}) contra ${tgt}!`, 'damage');
                    } else {
                        dmg = finalDamage * 3;
                        addLog(`💥💥 Double Great Horn: ¡Daño TRIPLE (${dmg}) contra ${tgt}!`, 'damage');
                    }
                    applyDamageWithShield(tgt, dmg, gameState.selectedCharacter);
                    totalDamageDGH += dmg;
                });
                
                // Ganar escudo = daño total causado
                attacker.shield = (attacker.shield || 0) + totalDamageDGH;
                attacker.shieldEffect = 'golden_shield';
                addLog(`🛡️ ${gameState.selectedCharacter} gana Escudo de ${totalDamageDGH} HP (= daño total causado)`, 'buff');

            } else if (ability.effect === 'embate_escudo') {
                // RAGNAR - Embate con Escudo: 2 daño, 50% aturdimiento, si no aturde genera 2 cargas
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (Math.random() < 0.5) {
                    applyStun(targetName, 2); // duration=2 → lasts through next full turn
                    addLog(`⚔️ Embate con Escudo: ¡${targetName} aturdido!`, 'damage');
                } else {
                    attacker.charges += 2;
                    addLog(`⚔️ Embate con Escudo: Sin aturdimiento → Ragnar gana 2 cargas`, 'buff');
                }

            } else if (ability.effect === 'dragon_of_life') {
                // Dragón de la Vida: burn AOE + regen aliados + Escudo Sagrado a Alexstrasza + Forma Dragón
                const myTeam = attacker.team; const eTeam = myTeam === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === eTeam && !c.isDead && c.hp > 0) applyFlatBurn(n, 4, 2);
                    if (c.team === myTeam && !c.isDead && c.hp > 0) c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, emoji: '💖', amount: Math.ceil(c.maxHp * 0.30) });
                }
                applyHolyShield(gameState.selectedCharacter, 3); // dur=3 → activo 2 turnos reales
                attacker.dragonFormActive = true;
                // Support both field names (transformPortrait and transformationPortrait)
                const _alexTP = attacker.transformPortrait || attacker.transformationPortrait;
                if (_alexTP) { attacker.portrait = _alexTP; }
                audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                addLog(`🐉 Dragón de la Vida: Burn 30% en enemigos, Regen 30% en aliados, Escudo Sagrado en ${gameState.selectedCharacter}`, 'buff');

            } else if (ability.effect === 'kiiroi_senko' || ability.effect === 'kiiroi_senko_v2') {
                // Kiiroi Senkō (nuevo): 1 daño + Celeridad 10% 2t + Buff aleatorio 2t
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const celerityBonus = Math.round(attacker.speed * 0.10);
                attacker.speed += celerityBonus;
                applyBuff(gameState.selectedCharacter, { name: 'Celeridad', type: 'buff', percent: 10, duration: 2, emoji: '⚡', speedBonus: celerityBonus });
                const randomBuffs = ['Esquivar','Furia','Frenesi','Contraataque','Proteccion Sagrada'];
                const rBuff = randomBuffs[Math.floor(Math.random() * randomBuffs.length)];
                applyBuff(gameState.selectedCharacter, { name: rBuff, type: 'buff', duration: 2, emoji: '✨' });
                addLog(`⚡ ${gameState.selectedCharacter} usa Kiiroi Senkō: +Celeridad ${celerityBonus} vel + ${rBuff}`, 'buff');

            } else if (ability.effect === 'legado_hokage') {
                // Legado del Cuarto Hokage: intercambia buffs y cargas con aliado seleccionado
                const allyName = targetName; // target is ally_single
                const ally = gameState.characters[allyName];
                if (ally && !ally.isDead) {
                    // Swap buffs
                    const minatoBufss = (attacker.statusEffects || []).filter(e => e && e.type === 'buff');
                    const allyBuffs = (ally.statusEffects || []).filter(e => e && e.type === 'buff');
                    attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.type !== 'buff').concat(allyBuffs);
                    ally.statusEffects = (ally.statusEffects || []).filter(e => e && e.type !== 'buff').concat(minatoBufss);
                    // Swap charges
                    const tmpCharges = attacker.charges;
                    attacker.charges = ally.charges;
                    ally.charges = tmpCharges;
                    addLog(`🌀 ${gameState.selectedCharacter} intercambia Buffs y Cargas con ${allyName}`, 'buff');
                }
                finalChargeGain = 0;

            } else if (ability.effect === 'rasen_senko') {
                // Rasen Senkō (legacy): daño ST con 50% de robar 1 carga por golpe
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtRS = gameState.characters[targetName];
                if (tgtRS && Math.random() < 0.5 && tgtRS.charges > 0) {
                    tgtRS.charges = Math.max(0, tgtRS.charges - 1);
                    attacker.charges = Math.min(20, attacker.charges + 1);
                    addLog(`🌀 Rasen Senkō: ${gameState.selectedCharacter} roba 1 carga de ${targetName}`, 'buff');
                }

            // ── DESTELLO DE LA DANZA AULLANTE (Minato nuevo special 1) ──
            } else if (ability.effect === 'destello_danza') {
                const enemyTeamDD = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(enemyTeamDD);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamDD || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                    if (c.speed < attacker.speed) {
                        // Enemigo más lento: debuff aleatorio 2 turnos
                        const debuffPool = ['Quemadura','Veneno','Sangrado','Confusion','Debilitar','Congelacion','Silenciar','Miedo','Agotamiento','Aturdimiento'];
                        const chosen = debuffPool[Math.floor(Math.random() * debuffPool.length)];
                        if (chosen === 'Quemadura') applyFlatBurn(n, 2, 1);  // 1T, valor 2HP (10% de 20HP)
                        else if (chosen === 'Veneno') { c.statusEffects.push({ name: 'Veneno', type: 'debuff', duration: 1, emoji: '🐍', poisonTick: 0 }); }
                        else if (chosen === 'Sangrado') applyBleed(n, 1);
                        else if (chosen === 'Confusion') applyConfusion(n, 1);
                        else if (chosen === 'Debilitar') applyWeaken(n, 2);  // 2T per table
                        else if (chosen === 'Miedo') applyFear(n, 1);
                        else if (chosen === 'Aturdimiento') applyStun(n, 1);
                        else if (chosen === 'Agotamiento') {
                            const redAgt = Math.floor(Math.random() * 3) + 1;
                            const cAgt = gameState.characters[n];
                            if (cAgt) cAgt.charges = Math.max(0, (cAgt.charges||0) - redAgt);
                            addLog('💨 ' + n + ' sufre Agotamiento: pierde ' + redAgt + ' carga(s)', 'debuff');
                        }
                        else if (chosen === 'Congelacion') applyFreeze(targetName || n, 1);  // 1T per table c.speed = Math.round(c.speed * 0.90); }
                        else if (chosen === 'Silenciar') { c.statusEffects.push({ name: 'Silenciar', type: 'debuff', duration: 3, emoji: '🔇' }); }
                        addLog(`⚡ Destello: ${n} (más lento) recibe ${chosen} 2t`, 'damage');
                    } else {
                        // Enemigo más rápido: roba 2 cargas
                        const stolen = Math.min(2, c.charges || 0);
                        if (stolen > 0) {
                            c.charges -= stolen;
                            attacker.charges = Math.min(20, attacker.charges + stolen);
                            addLog(`⚡ Destello: ${n} (más rápido) pierde ${stolen} cargas → Minato las roba`, 'buff');
                        }
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, gameState.selectedCharacter);
                addLog(`⚡ Destello de la Danza Aullante: ${finalDamage} daño AOE`, 'damage');

            // ── RASEN SENKO V2 (Minato nuevo special 2: AOE, 50% robar 3 cargas) ──
            } else if (ability.effect === 'rasen_senko_v2') {
                const enemyTeamRS2 = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(enemyTeamRS2);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamRS2 || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                    if (Math.random() < 0.5 && c.charges > 0) {
                        const stolen = Math.min(3, c.charges);
                        c.charges -= stolen;
                        attacker.charges = Math.min(20, attacker.charges + stolen);
                        addLog(`🌀 Rasen Senkō: roba ${stolen} cargas de ${n}`, 'buff');
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, gameState.selectedCharacter);
                addLog(`🌀 Rasen Senkō Chō Rinbu: ${finalDamage} daño AOE`, 'damage');

            // ── LEGADO DEL CUARTO HOKAGE V2 (Minato nuevo Over: 8 cargas a aliados) ──
            } else if (ability.effect === 'legado_hokage_v2') {
                const allyTeamLH = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== allyTeamLH || c.isDead || c.hp <= 0 || n === gameState.selectedCharacter) continue;
                    c.charges = Math.min(20, (c.charges || 0) + 8);
                    addLog(`⚡ Legado del Cuarto Hokage: ${n} recibe 8 cargas`, 'buff');
                }
                addLog(`⚡ ${gameState.selectedCharacter} usa Legado del Cuarto Hokage: +8 cargas a todo el equipo`, 'buff');


            } else if (ability.effect === 'celeridad_buff') {
                // Celeridad: +15% velocidad por N turnos
                const speedIncrease = Math.round(attacker.speed * (ability.speedBoost || 0.15));
                attacker.speed += speedIncrease;
                attacker.statusEffects.push({ name: 'Celeridad', type: 'buff', duration: ability.buffDuration || 2, emoji: '💨', speedBonus: speedIncrease });
                addLog(`💨 ${gameState.selectedCharacter} gana Celeridad +${speedIncrease} velocidad por ${ability.buffDuration || 2} turnos`, 'buff');

            } else if (ability.effect === 'kurama_mode') {
                // Modo Kurama: transformación de Minato
                attacker.kuramaMode = true;
                if (attacker.transformPortrait) { attacker.portrait = attacker.transformPortrait; }
                attacker.speed += 5;
                addLog(`🦊 ${gameState.selectedCharacter} activa el Modo Kurama (+5 vel, +3 dmg, +1 cargas)`, 'buff');
                ability.used = true;

            } else if (ability.effect === 'hiraishin') {
                // Hiraishin: daño doble si enemigo tiene menos velocidad
                const tgtH = gameState.characters[targetName];
                const speedAdvantage = tgtH && attacker.speed > tgtH.speed;
                const dmg = speedAdvantage ? finalDamage * 2 : finalDamage;
                applyDamageWithShield(targetName, dmg, gameState.selectedCharacter);
                if (speedAdvantage) addLog(`⚡ Hiraishin: daño doble por ventaja de velocidad (${attacker.speed} vs ${tgtH.speed})`, 'buff');

            } else if (ability.effect === 'fire_shield') {
                // Mar de Fuego (Rengoku): escudo a sí mismo y aliado aleatorio
                attacker.shield = (attacker.shield || 0) + (ability.shieldAmount || 4);
                attacker.shieldEffect = 'fire_charge_regen';
                addLog(`🔥 ${gameState.selectedCharacter} gana Escudo ${ability.shieldAmount} HP (Mar de Fuego)`, 'buff');
                const fireAllies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c.team === attacker.team && n !== gameState.selectedCharacter && !c.isDead && c.hp > 0; });
                if (fireAllies.length > 0) {
                    const ally = fireAllies[Math.floor(Math.random() * fireAllies.length)];
                    gameState.characters[ally].shield = (gameState.characters[ally].shield || 0) + (ability.shieldAmount || 4);
                    gameState.characters[ally].shieldEffect = 'fire_charge_regen';
                    addLog(`🔥 ${ally} también recibe Escudo ${ability.shieldAmount} HP (Mar de Fuego)`, 'buff');
                }

            // ── SOL ASCENDENTE (Rengoku básico) ──
            } else if (ability.effect === 'sol_ascendente') {
                const _saETeam = attacker ? (attacker.team === 'team1' ? 'team2' : 'team1') : 'team2';
                applyDamageWithShield(targetName, finalDamage, charName);
                applyFlatBurn(targetName, ability.burnAmount || 1, 1);
                if (typeof applyAOEToSummons === 'function') applyAOEToSummons(_saETeam, finalDamage, gameState.selectedCharacter);
                addLog('☀️ Sol Ascendente: ' + targetName + ' recibe Quemadura ' + (ability.burnAmount||1) + 'HP', 'damage');

            // ── TIGRE DE FUEGO V2 (Rengoku updated) ──
            } else if (ability.effect === 'tigre_fuego_v2') {
                const enemyTeamTF = attacker.team === 'team1' ? 'team2' : 'team1';
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(enemyTeamTF, finalDamage, gameState.selectedCharacter)) {
                    addLog('⛓️ tigre_fuego_v2: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamTF || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    const hadBurn = hasStatusEffect(n, 'Quemadura');
                    applyDamageWithShield(n, finalDamage, charName);
                    applyFlatBurn(n, 2, 2);
                    if (hadBurn) {
                        // Genera 1 carga a todo el equipo aliado
                        for (let a in gameState.characters) {
                            const ally = gameState.characters[a];
                            if (ally && ally.team === attacker.team && !ally.isDead && ally.hp > 0) {
                                ally.charges = Math.min(20, (ally.charges||0) + 1);
                            }
                        }
                        addLog('🔥 Tigre de Fuego: equipo gana 1 carga (objetivo tenía Quemadura)', 'buff');
                        break; // one bonus per cast
                    }
                }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                applyAOEToSummons(enemyTeamTF, finalDamage, gameState.selectedCharacter);
                addLog('🐯 Tigre de Fuego: ' + finalDamage + ' daño AOE + Quemadura', 'damage');

            // ── PURGATORIO V2 (Rengoku Over - ST + Mega Aturdimiento) ──
            } else if (ability.effect === 'purgatorio_v2') {
                applyDamageWithShield(targetName, finalDamage, charName);
                applyStun(targetName, 2); // Mega Aturdimiento
                addLog('🔥 Purgatorio: ' + finalDamage + ' daño + Megaaturdimiento a ' + targetName, 'damage');
                const tgt = gameState.characters[targetName];
                if (tgt && (tgt.isDead || tgt.hp <= 0)) {
                    // Apply burn 30% x5 to all enemies
                    const purgTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === purgTeam && !c.isDead && c.hp > 0) applyFlatBurn(n, 6, 5);
                    }
                    addLog('🔥 Purgatorio: ¡objetivo eliminado! Quemadura 30% x5 a todos los enemigos', 'damage');
                }

            // ── GARRAS DEL FÉNIX (Ikki básico: daño + aplica Quemadura) ──
            } else if (ability.effect === 'garras_fenix') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtGF = gameState.characters[targetName];
                if (tgtGF && !tgtGF.isDead && tgtGF.hp > 0) {
                    applyFlatBurn(targetName, ability.burnAmount || 1, ability.burnDuration || 1);
                }
                addLog(`🔥 ${gameState.selectedCharacter} usa Garras del Fénix en ${targetName}: ${finalDamage} daño + Quemadura ${ability.burnPercent||5}%`, 'damage');

            } else if (ability.effect === 'extend_burn') {
                // Tigre de Fuego: AOE + extiende duración de quemaduras
                const enemyTeamExt = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeamExt && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        const burnEff = c.statusEffects && c.statusEffects.find(e => e.name === 'Quemadura');
                        if (burnEff) { burnEff.duration += 1; addLog(`🔥 Quemadura de ${n} extendida 1 turno`, 'damage'); }
                    }
                }

            } else if (ability.effect === 'random_burn_aoe') {
                // Purgatorio: AOE + quemadura a N enemigos aleatorios
                const enemyTeamPurg = attacker.team === 'team1' ? 'team2' : 'team1';
                const aliveEnemies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c.team === enemyTeamPurg && !c.isDead && c.hp > 0; });
                for (let n of aliveEnemies) applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                const burnTargets = aliveEnemies.sort(() => Math.random() - 0.5).slice(0, ability.burnTargets || 3);
                for (let n of burnTargets) applyFlatBurn(n, ability.burnAmount || 6, ability.burnDuration || 2);
                
            } else if (ability.effect === 'summon_shadows') {
                // Ejército de las Sombras — 2 invocaciones con probabilidades ponderadas
                try {
                    const shadowWeights = { 'Igris': 25, 'Iron': 25, 'Tusk': 15, 'Beru': 12, 'Bellion': 5, 'Kaisel': 10 };
                    const shadowPool = ['Igris', 'Iron', 'Tusk', 'Beru', 'Bellion', 'Kaisel'];

                    const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    const existingNames = new Set(myShadows.filter(s => s && s.name).map(s => s.name));
                    const available = shadowPool.filter(n => !existingNames.has(n));

                    if (available.length === 0) {
                        addLog(`❌ ${gameState.selectedCharacter} ya tiene todas las sombras invocadas`, 'info');
                    } else {
                        // Calcular probabilidades redistribuidas
                        const blockedWeight = shadowPool
                            .filter(n => existingNames.has(n))
                            .reduce((sum, n) => sum + shadowWeights[n], 0);
                        const redistrib = available.length > 0 ? blockedWeight / available.length : 0;
                        const adjustedWeights = {};
                        available.forEach(n => { adjustedWeights[n] = shadowWeights[n] + redistrib; });

                        // Función para elegir 1 sombra por ruleta
                        function pickWeighted(pool, weights) {
                            const total = pool.reduce((s, n) => s + weights[n], 0);
                            let rand = Math.random() * total;
                            for (const n of pool) { rand -= weights[n]; if (rand <= 0) return n; }
                            return pool[pool.length - 1];
                        }

                        // Invocar SOLO 1 sombra aleatoria (según Arise!)
                        const chosen = pickWeighted(available, adjustedWeights);
                        summonShadow(chosen, gameState.selectedCharacter);
                        addLog(`👻 ${gameState.selectedCharacter} invoca: ${chosen}`, 'buff');
                    }
                } catch (error) {
                    console.error('Error en summon_shadows:', error);
                    addLog(`❌ Error al invocar sombras`, 'info');
                }
                
            } else if (ability.effect === 'sacrifice_shadow') {
                // Extracción de Sombras: Sacrifica 1 sombra aleatoria (excepto Kamish)
                // → Limpia todos los debuffs de todos los aliados
                // → Limpia todos los buffs de todos los enemigos
                try {
                    const allMyShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    const sacrificeable = allMyShadows.filter(s => s && s.name !== 'Kamish');
                    if (sacrificeable.length === 0) {
                        addLog('❌ Extracción de Sombras: No hay sombras para sacrificar (Kamish no cuenta)', 'info');
                    } else {
                        // Pick a random sacrificeable shadow
                        const toSac = sacrificeable[Math.floor(Math.random() * sacrificeable.length)];
                        const sacName = toSac.name;
                        delete gameState.summons[toSac.id];
                        addLog('💨 Extracción de Sombras: ' + sacName + ' es sacrificada', 'buff');
                        // Limpia todos los debuffs de todos los aliados
                        let totalDebuffs = 0;
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (!c || c.team !== attacker.team || c.isDead) continue;
                            const cDebuffs = (c.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                            totalDebuffs += cDebuffs.length;
                            c.statusEffects = (c.statusEffects || []).filter(e => !e || e.type !== 'debuff' || e.permanent);
                        }
                        addLog('✨ Extracción de Sombras: ' + totalDebuffs + ' debuffs eliminados del equipo aliado', 'buff');
                        // Limpia todos los buffs de todos los enemigos
                        const sacEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                        let totalBuffs = 0;
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (!c || c.team !== sacEnemyTeam || c.isDead) continue;
                            const cBuffs = (c.statusEffects || []).filter(e => e && e.type === 'buff' && !e.permanent);
                            totalBuffs += cBuffs.length;
                            c.statusEffects = (c.statusEffects || []).filter(e => !e || e.type !== 'buff' || e.permanent);
                        }
                        addLog('✨ Extracción de Sombras: ' + totalBuffs + ' buffs eliminados de todos los enemigos', 'debuff');
                        // SJW passive: +2 cargas when shadow eliminated
                        attacker.charges = Math.min(20, (attacker.charges || 0) + 2);
                        addLog('👻 Arise! (Pasiva): +2 cargas por sombra sacrificada', 'buff');
                        renderSummons();
                    }
                } catch (error) {
                    console.error('Error en sacrifice_shadow:', error);
                    addLog('❌ Error en Extracción de Sombras', 'info');
                }

            
            } else if (ability.effect === 'sjw_sigilo') {
                // Sigilo de la Sombras (Sun Jin Woo basic): aplica Buff Sigilo 1 turno
                const sjwChar = attacker;
                const existingSigilo = (sjwChar.statusEffects || []).find(e => e && normAccent(e.name||'') === 'sigilo');
                if (existingSigilo) {
                    existingSigilo.duration = Math.max(existingSigilo.duration || 1, 1);
                } else {
                    sjwChar.statusEffects = sjwChar.statusEffects || [];
                    sjwChar.statusEffects.push({ name: 'Sigilo', type: 'buff', duration: 2, emoji: '👤' });
                }
                if (ability.chargeGain) {
                    attacker.charges = Math.min(20, (attacker.charges || 0) + ability.chargeGain);
                }
                addLog(`👤 Sigilo de las Sombras: ${charName} gana Sigilo por 1 turno`, 'buff');

            } else if (ability.effect === 'summon_kamish') {
                // Check if this is Purgatorio de las Sombras (Over) or simple Kamish summon
                if (ability.type === 'over' || ability.cost >= 10) {
                    // Purgatorio de las Sombras: Sacrifica todas las sombras (excepto Kamish) y causa 3 daño AOE por sombra
                    const purEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    // Recoger IDs a sacrificar (sombras del invocador, excluyendo Kamish)
                    const purIdsToSacrifice = Object.keys(gameState.summons).filter(function(sid) {
                        const s = gameState.summons[sid];
                        return s && s.summoner === gameState.selectedCharacter && s.name !== 'Kamish' && s.hp > 0;
                    });
                    if (purIdsToSacrifice.length === 0) {
                        addLog('❌ Purgatorio: No hay sombras para sacrificar (excepto Kamish)', 'info');
                    } else {
                        let purTotalDmg = 0;
                        // Sacrificar cada sombra y acumular daño
                        for (const purSid of purIdsToSacrifice) {
                            const purS = gameState.summons[purSid];
                            if (!purS) continue;
                            addLog('💀 Purgatorio: ' + purS.name + ' sacrificada (+3 daño)', 'damage');
                            purTotalDmg += 3;
                            delete gameState.summons[purSid];
                        }
                        // Aplicar daño AOE a todos los enemigos (personajes)
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (!c || c.team !== purEnemyTeam || c.isDead || c.hp <= 0) continue;
                            if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                            applyDamageWithShield(n, purTotalDmg, charName);
                        }
                        // Aplicar daño AOE a invocaciones enemigas
                        for (let sid in gameState.summons) {
                            const s = gameState.summons[sid];
                            if (s && s.team === purEnemyTeam && s.hp > 0) applySummonDamage(sid, purTotalDmg, charName);
                        }
                        addLog('💀 Purgatorio de las Sombras: ' + purTotalDmg + ' daño total (' + purIdsToSacrifice.length + ' sombras × 3) a todos los enemigos', 'damage');
                        renderSummons();
                    }
                } else {
                    // Invocar Kamish directamente
                    try {
                        const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                        const hasKamish = myShadows.some(s => s && s.name === 'Kamish');
                        if (hasKamish) {
                            addLog('❌ ' + gameState.selectedCharacter + ' ya tiene a Kamish invocado', 'info');
                        } else {
                            summonShadow('Kamish', gameState.selectedCharacter);
                            addLog('🐉 ' + gameState.selectedCharacter + ' invoca al poderoso KAMISH!', 'buff');
                        }
                    } catch (error) {
                        console.error('Error en summon_kamish:', error);
                        addLog('❌ Error al invocar Kamish', 'info');
                    }
                }
                
            } else if (ability.effect === 'heal_ally') {
                // Curación Mágica
                const target = gameState.characters[targetName];
                const oldHp = target.hp;
                target.hp = Math.min(target.maxHp, target.hp + ability.heal);
                const actualHeal = target.hp - oldHp;
                
                addLog(`💚 ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} recuperando ${actualHeal} HP`, 'heal');
                
                // Activar pasiva de Min Byung
                if (actualHeal > 0) {
                    triggerBendicionSagrada(attacker.team, actualHeal);
                }
                
            } else if (ability.effect === 'shield_ally') {
                // Escudo Celestial
                const target = gameState.characters[targetName];
                applyShield(targetName, ability.shieldAmount, null);
                target.charges += 1;
                addLog(`⚡ ${targetName} recibe 1 carga adicional`, 'buff');
                
            } else if (ability.effect === 'regen_team') {
                // Sanación Heroica - AOE de regeneración
                const team = attacker.team;
                for (let name in gameState.characters) {
                    const char = gameState.characters[name];
                    if (char.team === team && char.hp > 0 && !char.isDead) {
                        applyRegeneration(name, ability.regenAmount, ability.regenDuration);
                    }
                }
                
            } else if (ability.effect === 'revive_ally') {
                // Milagro de la vida
                reviveAlly(targetName);
                
            } else if (ability.effect === 'damage_and_heal') {
                // Great Horn - Daño + Curación
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                
                const healAmount = ability.heal || 3; // Great Horn cura 3 HP por defecto
                const oldHp = attacker.hp;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmount);
                const actualHeal = attacker.hp - oldHp;
                
                if (actualHeal > 0) {
                    addLog(`💚 ${gameState.selectedCharacter} recupera ${actualHeal} HP`, 'heal');
                    triggerBendicionSagrada(attacker.team, actualHeal);
                }
                
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${finalDamage} de daño`, 'damage');
                
            // ── ESCUDO CELESTIAL (Min Byung actualizado) ──
            } else if (ability.effect === 'escudo_celestial') {
                applyShield(targetName, ability.shieldAmount || 4, null);
                gameState.characters[targetName].charges = (gameState.characters[targetName].charges || 0) + 2;
                addLog('🛡️✨ ' + targetName + ' recibe Escudo 4 HP y +2 cargas (Escudo Celestial)', 'buff');

            // ── ESPINAS DE HIELO (Ymir) ──
            } else if (ability.effect === 'espinas_hielo') {
                const ymirChar = gameState.characters[charName];
                // NON-STACKABLE: Refresh duration instead of stacking
                // duration 2 = lasts through next turn (decrements at end of own turn)
                const existingEspinas = ymirChar.statusEffects.find(e => e && normAccent(e.name||'') === 'espinas');
                if (existingEspinas) {
                    existingEspinas.duration = 2;
                } else {
                    ymirChar.statusEffects.push({ name: 'Espinas', type: 'buff', duration: 2, emoji: '🌵' });
                }
                const existingProv = ymirChar.statusEffects.find(e => e && !e.passiveHidden && normAccent(e.name||'') === 'provocacion');
                if (existingProv) {
                    existingProv.duration = 2;
                } else {
                    ymirChar.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                }
                addLog('🌵 ' + charName + ' activa Buff Espinas (1 turno) y Buff Provocación (1 turno)', 'buff');

            // ── HACHA DEL CAOS PRIMIGENIO (Ymir) ──
            } else if (ability.effect === 'hacha_caos') {
                // AOE: daño a todos los enemigos
                const enemyTeamHC = attacker.team === 'team1' ? 'team2' : 'team1';
                let totalHCCharges = 0;
                addLog(`🪓 ${charName} usa Hacha del Caos Primigenio — ${finalDamage} de daño AOE`, 'damage');
                checkAndRemoveStealth(enemyTeamHC);
                for (let hcName in gameState.characters) {
                    const hcTarget = gameState.characters[hcName];
                    if (!hcTarget || hcTarget.team !== enemyTeamHC || hcTarget.isDead || hcTarget.hp <= 0) continue;
                    const hasSangrado = hcTarget.statusEffects && hcTarget.statusEffects.some(function(e) { return e && normAccent(e.name||'') === 'sangrado'; });
                    let hcDmg = finalDamage;
                    // 50% crit si objetivo tiene Sangrado
                    if (hasSangrado && Math.random() < 0.5) {
                        hcDmg = hcDmg * 2;
                        addLog('💥 Hacha del Caos: ¡Crítico contra ' + hcName + '! (tiene Sangrado)', 'damage');
                    }
                    applyDamageWithShield(hcName, hcDmg, charName);
                    // Si tenía Sangrado, acumula 3 cargas
                    if (hasSangrado) {
                        totalHCCharges += 3;
                    }
                }
                // También afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeamHC && _s.hp > 0) {
                        applySummonDamage(_sid, finalDamage, charName);
                    }
                }
                if (totalHCCharges > 0) {
                    attacker.charges = Math.min(20, (attacker.charges || 0) + totalHCCharges);
                    addLog('⚔️ Hacha del Caos: ' + charName + ' genera ' + totalHCCharges + ' cargas (enemigos con Sangrado)', 'buff');
                }
                // Charge gain del ability
                finalChargeGain = ability.chargeGain || 0;

            // ── ALIENTO DE GINNUNGAGAP (Ymir) ──
            } else if (ability.effect === 'aliento_ginnungagap') {
                const enemyTeamAG = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamAG || c.isDead || c.hp <= 0) continue;
                    applyDamageWithShield(n, finalDamage, charName);
                    // 50% Megacongelación
                    if (Math.random() < 0.5) {
                        applyMegaFreeze(n, 1);
                        addLog('❄️ Aliento de Ginnungagap: ' + n + ' recibe Megacongelación', 'damage');
                    }
                    // Si tiene Sangrado: reducir 2 cargas
                    const cPost = gameState.characters[n];
                    if (cPost && cPost.statusEffects && cPost.statusEffects.some(function(e) { return e && normAccent(e.name||'') === 'sangrado'; })) {
                        cPost.charges = Math.max(0, (cPost.charges||0) - 2);
                        addLog('🩸 Aliento Ginnungagap: ' + n + ' pierde 2 cargas (tenía Sangrado)', 'damage');
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);

            // ── NIEBLA DE NIFLHEIM (Ymir Over) ──
            } else if (ability.effect === 'niebla_niflheim') {
                const allyTeamNN = attacker.team;
                const enemyTeamNN = allyTeamNN === 'team1' ? 'team2' : 'team1';
                // Daño AOE enemigos
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamNN || c.isDead || c.hp <= 0) continue;
                    applyDamageWithShield(n, finalDamage, charName);
                    // Congelación a cada enemigo
                    applyFreeze(n, 2);
                    addLog('❄️ Niebla de Niflheim: ' + n + ' recibe Congelación', 'damage');
                }
                // Limpiar debuffs aliados + aplicar Esquivar 3 turnos
                // Also hit enemy summons
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== allyTeamNN || c.isDead || c.hp <= 0) continue;
                    c.statusEffects = c.statusEffects.filter(function(e) { return !e || e.type !== 'debuff'; });
                    c.statusEffects.push({ name: 'Esquivar', type: 'buff', duration: 4, emoji: '💨' });
                    addLog('💨 Niebla de Niflheim: ' + n + ' limpiado de debuffs y gana Esquivar 3 turnos', 'buff');
                }

            // ── FURIA VIKINGA (Ragnar) ──
            } else if (ability.effect === 'furia_vikinga') {
                applyDamageWithShield(targetName, finalDamage, charName);
                applyBleed(targetName, 2);
                addLog('🩸 Furia Vikinga: ' + targetName + ' recibe Sangrado (1 turno)', 'damage');

            // ── TORMENTA DEL NORTE (Ragnar AOE) ──
            } else if (ability.effect === 'tormenta_norte') {
                const enemyTeamTN = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamTN || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    // 50% aplicar Sangrado
                    if (Math.random() < 0.5) {
                        applyBleed(n, 2);
                        addLog('🩸 Tormenta del Norte: ' + n + ' recibe Sangrado', 'damage');
                    } else {
                        // Si ya tenía Sangrado: Frenesí a Ragnar
                        const cPost = gameState.characters[n];
                        if (cPost && cPost.statusEffects && cPost.statusEffects.some(function(e) { return e && normAccent(e.name||'') === 'sangrado'; })) {
                            gameState.characters[charName].statusEffects.push({ name: 'Frenesi', type: 'buff', duration: 4, emoji: '🔥' });
                            addLog('🔥 Tormenta del Norte: ' + charName + ' gana Frenesí 3 turnos (objetivo tenía Sangrado)', 'buff');
                        }
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);

            // ── TORMENTA DEL NORTE V2 (Ragnar - updated) ──
            } else if (ability.effect === 'tormenta_norte_v2') {
                const enemyTeamTNv2 = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamTNv2 || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    const hadBleed = hasStatusEffect(n, 'Sangrado');
                    if (Math.random() < 0.5) applyBleed(n, 1);
                    if (hadBleed) { attacker.charges = Math.min(20, (attacker.charges||0) + 2); addLog('⚡ Tormenta del Norte: +2 cargas a ' + charName + ' (objetivo tenía Sangrado)', 'buff'); }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('🪓 Tormenta del Norte: ' + finalDamage + ' daño AOE', 'damage');

            // ── REY PAGANO (Ragnar AOE) ──
            } else if (ability.effect === 'rey_pagano') {
                const enemyTeamRP = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamRP || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    const hadBleedRP = hasStatusEffect(n, 'Sangrado');
                    applyDamageWithShield(n, finalDamage, charName);
                    applyBleed(n, 2);
                    if (hadBleedRP) { applyFear(n, 2); addLog('😱 Rey Pagano: ' + n + ' tenía Sangrado → aplica Miedo', 'damage'); }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('👑 Rey Pagano: ' + finalDamage + ' daño AOE + Sangrado', 'damage');

            // ── DJEM SO (Anakin básico) ──
            } else if (ability.effect === 'corte_agua') {
                // GIYU — Corte de Agua: 1 dmg + Escudo 2HP en Giyu
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const _giyuName = gameState.selectedCharacter;
                applyShield(_giyuName, ability.shieldAmount || 2);
                addLog('💧 Corte de Agua: ' + finalDamage + ' daño a ' + targetName + ' + Escudo 2HP en ' + _giyuName, 'buff');

            } else if (ability.effect === 'postura_calma') {
                // GIYU — Onceava Postura: Mega Provocación + Escudo 3HP en Giyu
                const _giyuPC = gameState.selectedCharacter;
                // Apply MegaProv buff
                const _giyuChar = gameState.characters[_giyuPC];
                if (_giyuChar) {
                    _giyuChar.statusEffects = (_giyuChar.statusEffects || []).filter(e => e && e.name !== 'MegaProvocacion');
                    _giyuChar.statusEffects.push({ name: 'MegaProvocacion', type: 'buff', duration: 3, emoji: '🎯', permanent: false });
                }
                applyShield(_giyuPC, ability.shieldAmount || 3);
                addLog('🎯 Onceava Postura: ' + _giyuPC + ' activa Mega Provocación + Escudo 3HP', 'buff');

            } else if (ability.effect === 'superficie_muerta') {
                // GIYU — Superficie Muerta: 1-3 AOE + Escudo a Giyu por daño causado
                const _sdTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const _sdDmg = Math.floor(Math.random() * 3) + 1; // 1-3
                let _sdTotalDmg = 0;
                if (checkAndRedirectAOEMegaProv(_sdTeam, _sdDmg, gameState.selectedCharacter)) {
                    _sdTotalDmg = _sdDmg;
                    addLog('🌊 Superficie Muerta redirigida por Mega Provocación', 'damage');
                } else {
                    for (let _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _sdTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, _sdDmg, gameState.selectedCharacter);
                        _sdTotalDmg += _sdDmg;
                    }
                }
                // Giyu gains shield equal to damage dealt
                if (_sdTotalDmg > 0) {
                    applyShield(gameState.selectedCharacter, _sdTotalDmg);
                    addLog('🌊 Superficie Muerta: ' + gameState.selectedCharacter + ' gana Escudo ' + _sdTotalDmg + ' HP', 'buff');
                }
                applyAOEToSummons(_sdTeam, finalDamage, gameState.selectedCharacter);
                addLog('🌊 Superficie Muerta: ' + _sdDmg + ' daño AOE', 'damage');

            } else if (ability.effect === 'marca_cazador') {
                // GIYU — Marca del Cazador: 1 dmg AOE por cada punto de Escudo de Giyu
                const _mcGiyu = gameState.characters[gameState.selectedCharacter];
                const _mcShield = _mcGiyu ? (_mcGiyu.shield || 0) : 0;
                const _mcDmgPerTarget = Math.max(1, _mcShield);
                const _mcTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (_mcShield === 0) {
                    addLog('🌊 Marca del Cazador: Giyu no tiene escudo activo (1 daño base)', 'info');
                }
                if (checkAndRedirectAOEMegaProv(_mcTeam, _mcDmgPerTarget, gameState.selectedCharacter)) {
                    addLog('🌊 Marca del Cazador redirigida por Mega Provocación', 'damage');
                } else {
                    for (let _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _mcTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, _mcDmgPerTarget, gameState.selectedCharacter);
                    }
                }
                addLog('🌊 Marca del Cazador: ' + _mcDmgPerTarget + ' daño AOE (' + _mcShield + ' HP de escudo)', 'damage');
            } else if (ability.effect === 'galick_gun') {
                // VEGETA — Galick Gun: 2 dmg + Frenesí 1T + Príncipe triple damage 20%
                const _ggAttacker = gameState.characters[gameState.selectedCharacter];
                let _ggDmg = finalDamage;
                if (_ggAttacker && _ggAttacker.passive && _ggAttacker.passive.name === 'Príncipe de los Sayajins' && Math.random() < 0.20) {
                    _ggDmg = finalDamage * 3;
                    addLog('💥 Príncipe de los Sayajins: ¡Daño Triple!', 'damage');
                }
                applyDamageWithShield(targetName, _ggDmg, gameState.selectedCharacter);
                applyFrenesi(gameState.selectedCharacter, 1);
                addLog('💥 Galick Gun: ' + _ggDmg + ' daño + Frenesí a ' + gameState.selectedCharacter, 'damage');

            } else if (ability.effect === 'big_bang_attack') {
                // VEGETA — Big Bang Attack: 3 dmg + 2 cargas por cada buff/debuff del objetivo
                const _bbaAttacker = gameState.characters[gameState.selectedCharacter];
                let _bbaDmg = finalDamage;
                if (_bbaAttacker && _bbaAttacker.passive && _bbaAttacker.passive.name === 'Príncipe de los Sayajins' && Math.random() < 0.20) {
                    _bbaDmg = finalDamage * 3;
                    addLog('💥 Príncipe de los Sayajins: ¡Daño Triple!', 'damage');
                }
                applyDamageWithShield(targetName, _bbaDmg, gameState.selectedCharacter);
                const _bbaTarget = gameState.characters[targetName];
                if (_bbaTarget) {
                    const _bbaEffects = (_bbaTarget.statusEffects || []).filter(e => e && e.name).length;
                    const _bbaGain = _bbaEffects * 2;
                    if (_bbaGain > 0) {
                        _bbaAttacker.charges = Math.min(20, (_bbaAttacker.charges || 0) + _bbaGain);
                        addLog('💥 Big Bang Attack: ' + gameState.selectedCharacter + ' gana ' + _bbaGain + ' cargas (' + _bbaEffects + ' efectos en ' + targetName + ')', 'buff');
                    }
                }
                applyAOEToSummons(_rkTeam, finalDamage, gameState.selectedCharacter);
                addLog('💥 Big Bang Attack: ' + _bbaDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'rafagas_ki') {
                // VEGETA — Ráfagas de Ki: 2 AOE + 50% 0-2 bonus. Daño DIRECTO (bypasses shields)
                const _rkTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_rkTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('💥 Ráfagas de Ki redirigidas por Mega Provocación', 'damage');
                } else {
                    for (let _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _rkTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        let _rkDmg = finalDamage;
                        if (Math.random() < 0.50) _rkDmg += Math.floor(Math.random() * 3); // 0-2 bonus
                        // Daño directo — bypass shields, go straight to HP
                        const _vegPrinceTriple = attacker.passive && attacker.passive.name === 'Príncipe de los Sayajins' && Math.random() < 0.20;
                        if (_vegPrinceTriple) { _rkDmg *= 3; addLog('💥 Príncipe de los Sayajins: ¡Daño Triple!', 'damage'); }
                        _c.hp = Math.max(0, _c.hp - _rkDmg);
                        if (_c.hp <= 0) { _c.isDead = true; }
                        addLog('💥 Ráfagas de Ki: ' + _n + ' recibe ' + _rkDmg + ' daño directo', 'damage');
                    }
                }
                applyAOEToSummons(_rkETeam, finalDamage, gameState.selectedCharacter);
                addLog('💥 Ráfagas de Ki: AOE completado', 'damage');

            } else if (ability.effect === 'final_flash') {
                // VEGETA — Final Flash: 12 dmg, ignora prov/megaprov/sigilo, +10 cargas si mata
                // Bypass all taunt/stealth — attack targetName directly regardless of buffs
                const _ffAttacker = gameState.characters[gameState.selectedCharacter];
                let _ffDmg = finalDamage;
                if (_ffAttacker && _ffAttacker.passive && _ffAttacker.passive.name === 'Príncipe de los Sayajins' && Math.random() < 0.20) {
                    _ffDmg = finalDamage * 3;
                    addLog('💥 Príncipe de los Sayajins: ¡Daño Triple!', 'damage');
                }
                const _ffTarget = gameState.characters[targetName];
                const _ffWasAlive = _ffTarget && !_ffTarget.isDead && _ffTarget.hp > 0;
                applyDamageWithShield(targetName, _ffDmg, gameState.selectedCharacter);
                if (_ffWasAlive && _ffTarget && (_ffTarget.isDead || _ffTarget.hp <= 0)) {
                    _ffAttacker.charges = Math.min(20, (_ffAttacker.charges || 0) + 10);
                    addLog('💥 Final Flash: ¡' + targetName + ' derrotado! ' + gameState.selectedCharacter + ' gana 10 cargas', 'buff');
                }
                applyAOEToSummons(_efTeam, finalDamage, gameState.selectedCharacter);
                addLog('⚡ Final Flash: ' + _ffDmg + ' daño ignorando Provocación/Sigilo a ' + targetName, 'damage');
            } else if (ability.effect === 'intimidacion_sith') {
                // DARTH VADER — Intimidación Sith: 4dmg + 3 per buff on target
                const _isTarget = gameState.characters[targetName];
                let _isDmg = finalDamage;
                if (_isTarget) {
                    const _isBuffs = (_isTarget.statusEffects || []).filter(e => e && e.type === 'buff').length;
                    _isDmg += _isBuffs * 3;
                    if (_isBuffs > 0) addLog('🌑 Intimidación Sith: +' + (_isBuffs*3) + ' daño por ' + _isBuffs + ' buff' + (_isBuffs>1?'s':'') + ' activos', 'damage');
                }
                applyDamageWithShield(targetName, _isDmg, gameState.selectedCharacter);
                addLog('🌑 Intimidación Sith: ' + _isDmg + ' daño total a ' + targetName, 'damage');
            } else if (ability.effect === 'explosion_fuerza_dv') {
                // DARTH VADER — Explosión de la Fuerza: 2 AOE + 50% stun + 50% debilitar
                const _efTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_efTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🌑 Explosión de la Fuerza redirigida por Mega Provocación', 'damage');
                } else {
                    for (let _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _efTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        if (Math.random() < 0.50) { applyStun(_n, 1); addLog('⭐ ' + _n + ' recibe Aturdimiento (Explosión de la Fuerza)', 'debuff'); }
                        if (Math.random() < 0.50) { applyDebuff(_n, { name: 'Debilitar', type: 'debuff', duration: 2, emoji: '💔' }); addLog('💔 ' + _n + ' recibe Debilitar (Explosión de la Fuerza)', 'debuff'); }
                    }
                }
                applyAOEToSummons(_efTeam, finalDamage, gameState.selectedCharacter);
                addLog('🌑 Explosión de la Fuerza: ' + finalDamage + ' AOE a todos los enemigos', 'damage');
            } else if (ability.effect === 'djem_so') {
                let djemDmg = finalDamage + (attacker.djemSoBonus || 0); // +1 per Estrangular use
                if (attacker.darkSideAwakened) {
                    djemDmg += 1;
                    if (Math.random() < 0.5) { djemDmg += djemDmg; addLog('💥 Lado Oscuro: ¡Crítico en Djem So!', 'damage'); }
                }
                applyDamageWithShield(targetName, djemDmg, charName);
                // CORTE OSCURO (Darth Vader): 50% Miedo
                if (ability.fearChance && Math.random() < ability.fearChance) {
                    applyFear(targetName, 1);
                    addLog('😱 Corte Oscuro: ' + targetName + ' recibe Miedo (50%)', 'debuff');
                }
                addLog('⚔️ Djem So / Corte Oscuro: ' + djemDmg + ' daño a ' + targetName, 'damage');

            // ── ESTRANGULAR (Anakin - Debilitar, nueva versión) ──
            // estrangular viejo eliminado — usar handler nuevo más abajo

            } else if (ability.effect === 'apply_stun_dmg') {
                let stunDmg = finalDamage;
                if (attacker.darkSideAwakened) {
                    stunDmg += 1;
                    if (Math.random() < 0.5) { stunDmg *= 2; addLog('💥 Lado Oscuro: ¡Crítico en Estrangular!', 'damage'); }
                }
                applyDamageWithShield(targetName, stunDmg, charName);
                applyStun(targetName, 2);
                addLog('⭐ ' + targetName + ' recibe Aturdimiento (Estrangular)', 'damage');

            // ── ONDA DE FUERZA (Anakin AOE) ──
            } else if (ability.effect === 'onda_fuerza') {
                const enemyTeamOF = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamOF || c.isDead || c.hp <= 0) continue;
                    let ofDmg = finalDamage;
                    if (attacker.darkSideAwakened) {
                        ofDmg += 2;
                        if (Math.random() < 0.5) { ofDmg *= 2; addLog('💥 Lado Oscuro: ¡Crítico en Onda de Fuerza vs ' + n + '!', 'damage'); }
                    }
                    applyDamageWithShield(n, ofDmg, charName);
                    // Eliminar 3 cargas (actualizado)
                    c.charges = Math.max(0, (c.charges||0) - 3);
                    addLog('💫 Onda de Fuerza: ' + n + ' pierde 3 cargas', 'damage');
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);

            // ── DESPERTAR DEL LADO OSCURO (Anakin Over — transformación permanente) ──
            } else if (ability.effect === 'despertar_lado_oscuro') {
                attacker.darkSideAwakened = true;
                if (attacker.transformPortrait) { attacker.portrait = attacker.transformPortrait; }
                addLog('🌑 ¡' + charName + ' despierta el Lado Oscuro! +1 daño permanente y 50% crítico en todas sus habilidades.', 'buff');

            // ── CAMBIO DE ENERGÍA v2 (Nakime — jugador elige enemigo, luego aliado) ──
            } else if (ability.effect === 'cambio_energia_v2') {
                // targetName = enemigo seleccionado; luego pedir segundo target (aliado)
                gameState.nakimePendingSwap = { type: 'energia', enemy: targetName };
                // Show second target selection (ally)
                showNakimeSecondTarget('energia', targetName);
                return; // endTurn se llama desde el segundo handler

            // ── CAMBIO DE VIDA v2 (Nakime — jugador elige enemigo, luego aliado) ──
            } else if (ability.effect === 'cambio_vida_v2') {
                // Colapso (Nakime OVER, target:'self'): 
                // - Elimina 50% de cargas actuales de CADA enemigo
                // - Genera el 50% de las cargas actuales de CADA aliado (para ese mismo aliado)
                const colEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const colAllyTeam = attacker.team;
                let totalEnemyChargesRemoved = 0;
                let totalAllyChargesGenerated = 0;
                // Drain 50% from each enemy
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== colEnemyTeam || c.isDead || c.hp <= 0) continue;
                    const drain = Math.floor((c.charges || 0) * 0.5);
                    c.charges = Math.max(0, (c.charges || 0) - drain);
                    totalEnemyChargesRemoved += drain;
                    if (drain > 0) addLog('🎵 Colapso: ' + n + ' pierde ' + drain + ' cargas (-50%)', 'debuff');
                }
                // Generate 50% more for each ally
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== colAllyTeam || c.isDead || c.hp <= 0) continue;
                    const gain = Math.floor((c.charges || 0) * 0.5);
                    c.charges = Math.min(20, (c.charges || 0) + gain);
                    totalAllyChargesGenerated += gain;
                    if (gain > 0) addLog('🎵 Colapso: ' + n + ' gana ' + gain + ' cargas (+50%)', 'buff');
                }
                addLog('🎵 Colapso: Drenado ' + totalEnemyChargesRemoved + ' cargas enemigas. Generado ' + totalAllyChargesGenerated + ' cargas aliadas', 'buff');

            // ── COLAPSO v2 (Nakime Over — intercambia HP y Cargas por pares según orden de turno) ──

            // ══════════════════════════════════════════════
            // SAURON NEW EFFECTS
            // ══════════════════════════════════════════════
            } else if (ability.effect === 'voluntad_mordor') {
                // Voluntad de Mordor: damage + bonus charges if target has Silencio
                applyDamageWithShield(targetName, finalDamage, charName);
                if (hasStatusEffect(targetName, 'Silencio')) {
                    attacker.charges = Math.min(20, (attacker.charges||0) + 2);
                    addLog('⚡ Voluntad de Mordor: +2 cargas bonus (objetivo tenía Silencio)', 'buff');
                }
                addLog('🌑 Voluntad de Mordor: ' + finalDamage + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'mano_negra') {
                // Mano Negra: AOE, crit if target has Provocacion/Megaprovocacion/Sigilo
                const enemyTeamMN = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamMN || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    const hasProv = hasStatusEffect(n, 'Provocacion') || hasStatusEffect(n, 'MegaProvocacion') || hasStatusEffect(n, 'Sigilo');
                    const mnDmg = hasProv ? finalDamage * 2 : finalDamage;
                    if (hasProv) addLog('💥 Mano Negra: ¡Crítico vs ' + n + ' (tiene Provoc/Sigilo)!', 'damage');
                    applyDamageWithShield(n, mnDmg, charName);
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('🖤 Mano Negra: ' + finalDamage + ' daño AOE', 'damage');

            } else if (ability.effect === 'senor_oscuro') {
                // Señor Oscuro: daño ST, si objetivo tiene Prov/MegaProv → elimina buff y crit
                const tgtSO = gameState.characters[targetName];
                const hasTaunt = tgtSO && (hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion'));
                let soDmg = finalDamage;
                if (hasTaunt) {
                    // Remove taunt
                    tgtSO.statusEffects = tgtSO.statusEffects.filter(e => !e || (normAccent(e.name||'') !== 'provocacion' && normAccent(e.name||'') !== 'megaprovocacion'));
                    soDmg = finalDamage * 2;
                    addLog('👑 Señor Oscuro: ¡Crítico! Provocación eliminada de ' + targetName, 'damage');
                }
                applyDamageWithShield(targetName, soDmg, charName);
                addLog('👑 Señor Oscuro: ' + soDmg + ' daño a ' + targetName, 'damage');

            // ══════════════════════════════════════════════
            // PADME AMIDALA EFFECTS
            // ══════════════════════════════════════════════
            } else if (ability.effect === 'orden_de_fuego') {
                // Genera 1 carga a los 4 aliados
                const padmeTeam = attacker.team;
                let count = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === padmeTeam && !c.isDead && c.hp > 0 && n !== charName) {
                        c.charges = Math.min(20, (c.charges||0) + 1);
                        count++;
                    }
                }
                attacker.charges = Math.min(20, (attacker.charges||0) + 1);
                addLog('🌟 Orden de Fuego: ' + (count+1) + ' aliados ganan 1 carga', 'buff');

            } else if (ability.effect === 'solucion_diplomatica') {
                // Elimina todos los debuffs de aliado seleccionado; Padme +2 por debuff eliminado
                const tgtSD = gameState.characters[targetName];
                if (tgtSD) {
                    const removedDebuffs = tgtSD.statusEffects.filter(e => e && e.type === 'debuff').length;
                    tgtSD.statusEffects = tgtSD.statusEffects.filter(e => !e || e.type !== 'debuff');
                    attacker.charges = Math.min(20, (attacker.charges||0) + removedDebuffs * 2);
                    addLog('🕊️ Solución Diplomática: ' + removedDebuffs + ' debuffs eliminados de ' + targetName + ' (+' + (removedDebuffs*2) + ' cargas a Padme)', 'buff');
                }

            } else if (ability.effect === 'invocar_senuelo') {
                // Invoca un Señuelo (5HP). Al morir genera 2 cargas al equipo aliado
                const sId = 'Señuelo_' + Date.now();
                gameState.summons[sId] = {
                    name: 'Señuelo', summoner: charName, team: attacker.team,
                    hp: 5, maxHp: 5, isDead: false,
                    statusEffects: []
                };
                // Padme gana Sigilo 2 turnos
                applyBuff(charName, { name: 'Sigilo', type: 'buff', duration: 2, emoji: '👤' });
                renderSummons();
                addLog('🎭 Padme invoca un Señuelo (5HP) y gana Sigilo 2 turnos', 'buff');

            } else if (ability.effect === 'reina_de_naboo') {
                // Escudo + 4 cargas a los 4 aliados
                const nabooTeam = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === nabooTeam && !c.isDead && c.hp > 0) {
                        c.shield = (c.shield||0) + 3;
                        c.charges = Math.min(20, (c.charges||0) + 4);
                    }
                }
                addLog('👑 Reina de Naboo: Escudo 3HP + 4 cargas a todo el equipo aliado', 'buff');

            // ══════════════════════════════════════════════
            // DAENERYS TARGARYEN EFFECTS
            // ══════════════════════════════════════════════
            } else if (ability.effect === 'madre_dragones') {
                const dragonPool = ['Drogon','Rhaegal','Viserion'];
                const existingDragons = new Set(Object.values(gameState.summons).filter(s => s && s.summoner === charName).map(s => s.name));
                const available = dragonPool.filter(d => !existingDragons.has(d));
                if (available.length === 0) {
                    addLog('🐉 Daenerys ya tiene todos los dragones invocados', 'info');
                } else {
                    const chosen = available[Math.floor(Math.random() * available.length)];
                    summonDragon(chosen, charName, attacker.team);
                }

            } else if (ability.effect === 'vuelo_dragon') {
                applyHolyShield(charName, 2);
                addLog('🐉 Vuelo del Dragón: ' + charName + ' gana Escudo Sagrado 2 turnos', 'buff');

            } else if (ability.effect === 'locura_targaryen') {
                const enemyTeamLT = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamLT || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                // Count burns on enemies
                let burnCount = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === enemyTeamLT && !c.isDead && c.hp > 0 && hasStatusEffect(n, 'Quemadura')) burnCount++;
                }
                for (let a in gameState.characters) {
                    const c = gameState.characters[a];
                    if (c && c.team === attacker.team && !c.isDead && c.hp > 0) c.charges = Math.min(20, (c.charges||0) + burnCount);
                }
                addLog('🐉 Locura Targaryen: ' + finalDamage + ' AOE + ' + burnCount + ' carga(s) al equipo aliado', 'buff');

            } else if (ability.effect === 'dracarys') {
                const enemyTeamDC = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamDC || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    applyFlatBurn(n, 4, 2);
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                ['Drogon','Rhaegal','Viserion'].forEach(function(d) { summonDragon(d, charName, attacker.team); });
                addLog('🔥 ¡DRACARYS! ' + finalDamage + ' daño AOE + Quemadura 20% + 3 dragones invocados', 'damage');

            // ══════════════════════════════════════════════
            // TAMAYO EFFECTS
            // ══════════════════════════════════════════════
            } else if (ability.effect === 'aguja_medicinal') {
                const tgtAM = gameState.characters[targetName];
                if (tgtAM) {
                    const oldHpAM = tgtAM.hp;
                    tgtAM.hp = Math.min(tgtAM.maxHp, tgtAM.hp + 1);
                    const debuffIdx = tgtAM.statusEffects.findIndex(e => e && e.type === 'debuff');
                    if (debuffIdx !== -1) {
                        addLog('🌿 Aguja Medicinal: elimina Debuff ' + tgtAM.statusEffects[debuffIdx].name + ' de ' + targetName, 'buff');
                        tgtAM.statusEffects.splice(debuffIdx, 1);
                    }
                    if (tgtAM.hp > oldHpAM) addLog('🌿 Aguja Medicinal: +1 HP a ' + targetName, 'heal');
                }

            } else if (ability.effect === 'aroma_curativo') {
                const tamTeam = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== tamTeam || c.isDead || c.hp <= 0) continue;
                    const debIdx = c.statusEffects.findIndex(e => e && e.type === 'debuff');
                    if (debIdx !== -1) { addLog('🌸 Aroma Curativo: elimina ' + c.statusEffects[debIdx].name + ' de ' + n, 'buff'); c.statusEffects.splice(debIdx, 1); }
                }
                addLog('🌸 Aroma Curativo: 1 Debuff eliminado de cada aliado', 'buff');

            } else if (ability.effect === 'medicina_demoniaca') {
                const tamTeam2 = attacker.team;
                let totalRemoved = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== tamTeam2 || c.isDead || c.hp <= 0) continue;
                    const removed = c.statusEffects.filter(e => e && e.type === 'debuff').length;
                    c.statusEffects = c.statusEffects.filter(e => !e || e.type !== 'debuff');
                    totalRemoved += removed;
                }
                // Heal team by totalRemoved HP
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== tamTeam2 || c.isDead || c.hp <= 0) continue;
                    c.hp = Math.min(c.maxHp, c.hp + totalRemoved);
                }
                addLog('💊 Medicina Demoníaca: ' + totalRemoved + ' Debuffs eliminados → +' + totalRemoved + ' HP al equipo', 'heal');

            } else if (ability.effect === 'hechizo_sangre') {
                // Hechizo de Sangre (Tamayo OVER): Regen 20% x3T a aliados + Confusión a 2 enemigos aleatorios
                const tamTeam3 = attacker.team;
                const tamEnemyTeam3 = tamTeam3 === 'team1' ? 'team2' : 'team1';
                // Apply Regen 20% x3T to all allies
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== tamTeam3 || c.isDead || c.hp <= 0) continue;
                    c.statusEffects = (c.statusEffects || []).filter(e => e && !(e.name === 'Regeneracion' && e.hechizoDeSangre));
                    c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, percent: 20, hechizoDeSangre: true, emoji: '💖' });
                }
                addLog('🩸 Hechizo de Sangre: Regeneración 20% x3T aplicada a todo el equipo aliado', 'buff');
                // Apply Confusion to 2 random enemies
                const tamEnemies3 = Object.keys(gameState.characters).filter(function(n) {
                    const c = gameState.characters[n];
                    return c && c.team === tamEnemyTeam3 && !c.isDead && c.hp > 0;
                });
                const tamShuffled3 = tamEnemies3.slice().sort(function() { return Math.random() - 0.5; });
                tamShuffled3.slice(0, 2).forEach(function(n) {
                    applyConfusion(n, 2);
                    addLog('🩸 Hechizo de Sangre: Confusión 2T aplicada a ' + n, 'debuff');
                });

            
            } else if (ability.effect === 'relampago_sith') {
                applyDamageWithShield(targetName, finalDamage, charName);
                // Remove 1 debuff from target (triggers passive)
                const tgtRS = gameState.characters[targetName];
                if (tgtRS) {
                    const debIdx = tgtRS.statusEffects.findIndex(e => e && e.type === 'debuff');
                    if (debIdx !== -1) {
                        addLog('⚡ Relámpago Sith: limpia ' + tgtRS.statusEffects[debIdx].name + ' de ' + targetName + ' (activa pasiva)', 'damage');
                        tgtRS.statusEffects.splice(debIdx, 1);
                        // Trigger passive: 50% chance stun on the enemy
                        if (Math.random() < 0.5) applyStun(targetName, 1);
                    }
                }

            } else if (ability.effect === 'orden_sith') {
                // AOE 1 dmg + clean 3 debuffs from ENEMY team (activates passive per debuff) + heal Palpatine + random ally
                const enemyTeamOS = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamOS || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) continue;
                    applyDamageWithShield(n, finalDamage, charName);
                }
                let debuffsCleared = 0;
                for (let n in gameState.characters) {
                    if (debuffsCleared >= 3) break;
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamOS || c.isDead || c.hp <= 0) continue;
                    while (debuffsCleared < 3) {
                        const idx2 = c.statusEffects.findIndex(e => e && e.type === 'debuff');
                        if (idx2 === -1) break;
                        addLog('⚡ Orden Sith: limpia ' + c.statusEffects[idx2].name, 'damage');
                        c.statusEffects.splice(idx2, 1);
                        debuffsCleared++;
                        // Passive: 50% stun on n for each debuff cleared
                        if (Math.random() < 0.5) applyStun(n, 1);
                    }
                }
                // Heal Palpatine and a random ally 3 HP
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + 3);
                const orderAllies = Object.keys(gameState.characters).filter(a => { const c = gameState.characters[a]; return c && c.team === attacker.team && a !== charName && !c.isDead && c.hp > 0; });
                if (orderAllies.length > 0) {
                    const healed = orderAllies[Math.floor(Math.random() * orderAllies.length)];
                    gameState.characters[healed].hp = Math.min(gameState.characters[healed].maxHp, gameState.characters[healed].hp + 3);
                    addLog('⚡ Orden Sith: +3 HP a ' + charName + ' y ' + healed, 'heal');
                }
                addLog('⚡ Orden Sith: ' + debuffsCleared + ' Debuffs limpiados del equipo enemigo', 'damage');

            } else if (ability.effect === 'poder_ilimitado') {
                // AOE 4 + 50% mega stun
                const enemyTeamPL = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamPL || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    if (Math.random() < 0.5) applyStun(n, 2);
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('⚡ ¡PODER ILIMITADO! ' + finalDamage + ' daño AOE + 50% Megaaturdimiento', 'damage');

            // ══════════════════════════════════════════════
            // GANDALF EFFECTS
            // ══════════════════════════════════════════════
            } else if (ability.effect === 'resplandor') {
                const gandalfTeam = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== gandalfTeam || c.isDead || c.hp <= 0) continue;
                    // Stack with existing Regeneration: merge percent, keep longest duration
                    const existingRegen = c.statusEffects.find(e => e && normAccent(e.name||'') === 'regeneracion' && e.percent);
                    if (existingRegen) {
                        existingRegen.percent = (existingRegen.percent || 0) + 10;
                        addLog(`💖 ${n}: Regeneración aumenta a ${existingRegen.percent}% (stackeo)`, 'buff');
                    } else {
                        c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 2, percent: 10, emoji: '💖' });
                    }
                }
                addLog('💖 Resplandor: Regeneración 10% a todo el equipo aliado', 'buff');

            } else if (ability.effect === 'rayo_de_luz') {
                const tgtRDL = gameState.characters[targetName];
                if (tgtRDL) {
                    const oldHpRDL = tgtRDL.hp;
                    tgtRDL.hp = Math.min(tgtRDL.maxHp, tgtRDL.hp + 5);
                    tgtRDL.shield = (tgtRDL.shield||0) + 5;
                    // Apply Provocacion buff
                    applyBuff(targetName, { name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                    addLog('💫 Rayo de Luz: +' + (tgtRDL.hp - oldHpRDL) + ' HP + Escudo 5HP + Provocación 2t a ' + targetName, 'buff');
                }

            } else if (ability.effect === 'el_mago_blanco') {
                const gandalfTeam2 = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== gandalfTeam2 || c.isDead || c.hp <= 0) continue;
                    c.hp = Math.min(c.maxHp, c.hp + 5);
                }
                applyHolyProtection(charName, 1);
                // Apply Proteccion Sagrada to whole team
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === gandalfTeam2 && !c.isDead && c.hp > 0 && n !== charName) {
                        applyHolyProtection(n, 1);
                    }
                }
                addLog('🤍 El Mago Blanco: +5 HP + Protección Sagrada 1t a todo el equipo', 'heal');

            } else if (ability.effect === 'no_puedes_pasar') {
                // Escudo Sagrado 2t a los 4 aliados
                const gandalfTeam3 = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== gandalfTeam3 || c.isDead || c.hp <= 0) continue;
                    applyHolyShield(n, 2);
                }
                addLog('🤍 ¡NO PUEDES PASAR! Escudo Sagrado 2 turnos a todo el equipo aliado', 'buff');

            } else if (ability.effect === 'apply_poison_2') {
                const allyTeamC = attacker.team;
                const enemyTeamC = allyTeamC === 'team1' ? 'team2' : 'team1';
                const allyOrder = gameState.turnOrder.filter(function(n) { const c = gameState.characters[n]; return c && c.team === allyTeamC && !c.isDead && c.hp > 0; });
                const enemyOrder = gameState.turnOrder.filter(function(n) { const c = gameState.characters[n]; return c && c.team === enemyTeamC && !c.isDead && c.hp > 0; });
                const pairs = Math.min(allyOrder.length, enemyOrder.length);
                for (let i = 0; i < pairs; i++) {
                    const a = gameState.characters[allyOrder[i]];
                    const e = gameState.characters[enemyOrder[i]];
                    const tmpHp = a.hp; a.hp = Math.min(a.maxHp, e.hp); e.hp = Math.min(e.maxHp, tmpHp);
                    const tmpCh = a.charges; a.charges = e.charges; e.charges = tmpCh;
                    addLog('🔄 Colapso: HP y Cargas intercambiados entre ' + allyOrder[i] + ' y ' + enemyOrder[i], 'damage');
                }

            // ── CORAZÓN EN LLAMAS (Thestalos básico: self-heal + burn last attacker) ──
            } else if (ability.effect === 'corazon_llamas') {
                // Mar de Fuego (Rengoku): AOE 3 dmg, 100% crítico a enemigos con Quemadura
                const mfTeam2 = attacker.team === 'team1' ? 'team2' : 'team1';
                                // MEGA PROVOCACIÓN
                if (checkAndRedirectAOEMegaProv(mfTeam2, finalDamage, gameState.selectedCharacter)) {
                    addLog('⛓️ corazon_llamas: AOE redirigido por Mega Provocación', 'damage');
                } else {
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== mfTeam2 || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true) || checkMinatoAOEImmunity(n)) {
                        addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff');
                        continue;
                    }
                    let mfDmg2 = finalDamage;
                    const hasBurn2 = (c.statusEffects || []).some(e => e && normAccent(e.name||'') === 'quemadura');
                    if (hasBurn2) {
                        mfDmg2 *= 2; // 100% critical = double damage
                        addLog('🔥💥 Mar de Fuego: ¡CRÍTICO sobre ' + n + ' (tiene Quemadura)!', 'damage');
                    }
                    applyDamageWithShield(n, mfDmg2, charName);
                }
                }
            } else if (ability.effect === 'expiacion_incandescente') {
                const enemyTeamEI = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamEI || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    // If burning: steal 1 charge
                    const cAfter = gameState.characters[n];
                    const hasBurn = cAfter && cAfter.statusEffects && cAfter.statusEffects.some(function(e) {
                        const nm = e && (e.name||'').toLowerCase().replace(/[áéíóú]/g, function(ch){return {á:'a',é:'e',í:'i',ó:'o',ú:'u'}[ch]||ch;});
                        return nm === 'quemadura' || nm === 'quemadura solar';
                    });
                    if (hasBurn && cAfter.charges > 0) {
                        cAfter.charges = Math.max(0, cAfter.charges - 1);
                        gameState.characters[charName].charges += 1;
                        addLog('🔥 Expiación: ' + n + ' pierde 1 carga (tenía Quemadura)', 'buff');
                    }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);

            // ── MAGMA STRENGTH (Thestalos: heal + Holy Shield) ──
            } else if (ability.effect === 'magma_strength') {
                const msChar = gameState.characters[charName];
                msChar.hp = Math.min(msChar.maxHp, msChar.hp + 8);
                addLog('🔥 ' + charName + ' recupera 8 HP (Magma Strength)', 'heal');
                triggerBendicionSagrada(msChar.team, 8);
                applyHolyShield(charName, 2); // duration 2 = lasts through end of next turn

            // ── CÓLERA DE THESTALOS (Over: ST + bonus per burning enemy + lifesteal) ──
            } else if (ability.effect === 'colera_thestalos') {
                const enemyTeamCT = attacker.team === 'team1' ? 'team2' : 'team1';
                let ctDmg = finalDamage;
                // Count enemies with Quemadura (any kind)
                let burningCount = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamCT || c.isDead || c.hp <= 0) continue;
                    if (c.statusEffects && c.statusEffects.some(function(e) {
                        const nm = (e && e.name || '').toLowerCase().replace(/[áéíóú]/g, function(ch){return {á:'a',é:'e',í:'i',ó:'o',ú:'u'}[ch]||ch;});
                        return nm === 'quemadura' || nm === 'quemadura solar';
                    })) burningCount++;
                }
                ctDmg += burningCount * 2;
                if (burningCount > 0) addLog('🔥 Cólera de Thestalos: +' + (burningCount*2) + ' daño bonus (' + burningCount + ' enemigos en llamas)', 'damage');
                const actualDmg = applyDamageWithShield(targetName, ctDmg, charName);
                // Lifesteal 50%
                const lifesteal = Math.ceil(actualDmg * 0.5);
                if (lifesteal > 0) {
                    gameState.characters[charName].hp = Math.min(gameState.characters[charName].maxHp, gameState.characters[charName].hp + lifesteal);
                    addLog('🔥 Cólera de Thestalos: ' + charName + ' recupera ' + lifesteal + ' HP (50% del daño)', 'heal');
                    triggerBendicionSagrada(attacker.team, lifesteal);
                }

            } else if (ability.effect === 'golden_shield') {
                // Golden Shield - Escudo con efecto especial
                applyShield(gameState.selectedCharacter, ability.shieldAmount, 'golden_shield');
                
            } else if (ability.effect === 'double_if_shield') {
                // Huge Collision - Daño doble si tiene escudo
                let damage = finalDamage;
                if (attacker.shield > 0) {
                    damage *= 2;
                    addLog(`🛡️ ${gameState.selectedCharacter} tiene escudo activo, ¡daño duplicado!`, 'buff');
                }
                applyDamageWithShield(targetName, damage, gameState.selectedCharacter);
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${damage} de daño`, 'damage');
                
            } else if (ability.effect === 'double_if_low_hp') {
                // Great Supernova - Daño doble si tiene 25% o menos de HP
                let damage = finalDamage;
                const hpPercentage = (attacker.hp / attacker.maxHp) * 100;
                
                if (hpPercentage <= 25) {
                    damage *= 2;
                    addLog(`💥 ${gameState.selectedCharacter} tiene 25% de HP o menos, ¡daño duplicado!`, 'buff');
                }
                applyDamageWithShield(targetName, damage, gameState.selectedCharacter);
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${damage} de daño`, 'damage');
                
            } else if (ability.effect === 'burn') {
                if (ability.target === 'aoe') {
                    // Hō Yoku Ten Shō y otros AOE con quemadura
                    const burnAoeTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    checkAndRemoveStealth(burnAoeTeam);
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === burnAoeTeam && !c.isDead && c.hp > 0) {
                            applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                            if (gameState.characters[n] && gameState.characters[n].hp > 0 && !gameState.characters[n].isDead) {
                                applyFlatBurn(n, ability.burnAmount || 2, ability.burnDuration || 1);
                            }
                        }
                    }
                    for (let sId in gameState.summons) {
                        const s = gameState.summons[sId];
                        if (s && s.team === burnAoeTeam && s.hp > 0) applySummonDamage(sId, finalDamage, gameState.selectedCharacter);
                    }
                    addLog(`🔥 ${gameState.selectedCharacter} usa ${ability.name} causando ${finalDamage} daño AOE + Quemadura ${ability.burnPercent}% a todos los enemigos`, 'damage');
                } else {
                    // Katon: Gōka Mekkyaku - ST Daño + Quemadura
                    applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                    // Solo aplicar quemadura si el objetivo sigue vivo tras recibir el daño
                    if (gameState.characters[targetName] && gameState.characters[targetName].hp > 0 && !gameState.characters[targetName].isDead) {
                        applyFlatBurn(targetName, ability.burnAmount || 2, ability.burnDuration || 1);
                    }
                    addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${finalDamage} de daño`, 'damage');
                }
                
            } else if (ability.effect === 'mangekyou_madara_new') {
                // MADARA — Mangekyō Sharingan (nuevo): 2 daño directo + Silenciar 2T + genera 2 cargas
                const _mmAtk = gameState.characters[gameState.selectedCharacter];
                const _mmTgt = gameState.characters[targetName];
                // Daño directo (attackerName=null: ignora escudo)
                if (_mmTgt && !_mmTgt.isDead && _mmTgt.hp > 0) {
                    let _mmDmg = 2;
                    if (_mmAtk && _mmAtk.rikudoMode) _mmDmg *= 2;
                    _mmTgt.hp = Math.max(0, (_mmTgt.hp||0) - _mmDmg);
                    if (_mmTgt.hp <= 0) _mmTgt.isDead = true;
                    addLog('👁️ Mangekyō Sharingan: ' + _mmDmg + ' daño directo a ' + targetName, 'damage');
                }
                applySilenciar(targetName, 2);
                addLog('👁️ Mangekyō Sharingan: Silenciar 2T a ' + targetName, 'debuff');

            } else if (ability.effect === 'susanoo_madara_new') {
                // MADARA — Susanoo (nuevo): 4 daño + Buff Escudo igual al daño causado + contraataque al perder escudo
                const _smAtk = gameState.characters[gameState.selectedCharacter];
                let _smDmg = finalDamage;
                if (_smAtk && _smAtk.rikudoMode) _smDmg *= 2;
                const _smTgt = gameState.characters[targetName];
                const _smBefore = _smTgt ? _smTgt.hp : 0;
                applyDamageWithShield(targetName, _smDmg, gameState.selectedCharacter);
                const _smAfter = _smTgt ? _smTgt.hp : 0;
                const _smActualDmg = Math.max(0, _smBefore - _smAfter);
                if (_smActualDmg > 0 && _smAtk) {
                    _smAtk.shield = (_smAtk.shield||0) + _smActualDmg;
                    _smAtk.shieldEffect = 'susanoo_counter_madara';
                    addLog('🛡️ Susanoo: ' + gameState.selectedCharacter + ' obtiene Escudo ' + _smActualDmg + ' HP (= daño causado)', 'buff');
                }
                addLog('👁️ Susanoo: ' + _smDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'tengai_shinsei_madara') {
                // MADARA — Tengai Shinsei: 10 AOE + 25% daño extra a objetivos con Esquiva Área
                const _tsAtk = gameState.characters[gameState.selectedCharacter];
                const _tsETeam = _tsAtk ? (_tsAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                let _tsDmg = finalDamage;
                if (_tsAtk && _tsAtk.rikudoMode) _tsDmg *= 2;
                if (checkAndRedirectAOEMegaProv(_tsETeam, _tsDmg, gameState.selectedCharacter)) {
                    addLog('☄️ Tengai Shinsei redirigido por Mega Provocación', 'damage');
                } else {
                    if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(gameState.selectedCharacter);
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _tsETeam || _c.isDead || _c.hp <= 0) continue;
                        let _nDmg = _tsDmg;
                        // +25% daño si tiene EA activa (buff o pasiva)
                        const _hasEA = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'esquiva area'; }) || _c.esquivaAreaPassive;
                        if (_hasEA) {
                            _nDmg = Math.ceil(_tsDmg * 1.25);
                            addLog('☄️ Tengai Shinsei: +25% daño en ' + _n + ' (Esquiva Área activa) → ' + _nDmg, 'damage');
                        }
                        applyDamageWithShield(_n, _nDmg, gameState.selectedCharacter);
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _tsETeam && _s.hp > 0) applySummonDamage(_sid, _tsDmg, gameState.selectedCharacter); }
                }
                addLog('☄️ Tengai Shinsei: 10 AOE completado', 'damage');

            } else if (ability.effect === 'sharingan_aoe') {
                // Mangekyō Sharingan (Madara): SINGLE TARGET 3 daño + Buff Contraataque + Buff Concentración
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                // Buff Contraataque al atacante
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.name !== 'Contraataque');
                attacker.statusEffects.push({ name: 'Contraataque', type: 'buff', duration: 2, emoji: '⚔️' });
                // Buff Provocación 2T al atacante (reemplaza Concentración)
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && normAccent(e.name||'') !== 'provocacion');
                attacker.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                addLog('👁️ Mangekyō Sharingan: ' + finalDamage + ' daño a ' + targetName + ' + Contraataque + Provocación 2T a ' + charName, 'damage');

            
            } else if (ability.effect === 'rikudo_transformation') {
                // Modo Rikudō - Transformación permanente
                attacker.rikudoMode = true;
                if (attacker.transformPortrait) { attacker.portrait = attacker.transformPortrait; }
                ability.used = true;
                audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                addLog(`✨ ${gameState.selectedCharacter} activa el ${ability.name}! Poder duplicado, costos reducidos a la mitad`, 'buff');
                
            } else if (ability.effect === 'double_on_burn') {
                // Susanoo (Madara): AOE con 50% critico + Escudo +3HP por critico acertado
                const susEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const susKamish = checkKamishMegaProvocation(susEnemyTeam);
                let susShieldGain = 0;
                if (susKamish) {
                    let susCnt = 0;
                    for (let n in gameState.characters) { const c = gameState.characters[n]; if (c && c.team === susEnemyTeam && !c.isDead && c.hp > 0) susCnt++; }
                    for (let sid in gameState.summons) { const s = gameState.summons[sid]; if (s && s.team === susEnemyTeam && s.hp > 0 && sid !== susKamish.id) susCnt++; }
                    const susTotDmg = finalDamage * susCnt;
                    if (susKamish.isCharacter) applyDamageWithShield(susKamish.characterName, susTotDmg, charName);
                    else applySummonDamage(susKamish.id, susTotDmg, charName);
                    addLog('🐉 Kamish absorbe ' + susTotDmg + ' daño AOE de Susanoo', 'buff');
                } else {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== susEnemyTeam || c.isDead || c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(n, true)) { addLog('🌟 ' + n + ' es inmune al AOE', 'buff'); continue; }
                        let susDmg = finalDamage;
                        if (Math.random() < 0.50) {
                            susDmg *= 2; // critical
                            susShieldGain += 3;
                            addLog('💥 Susanoo: ¡Crítico! +3 escudo sobre ' + charName, 'damage');
                        }
                        applyDamageWithShield(n, susDmg, charName);
                    }
                    for (let sid in gameState.summons) { const s = gameState.summons[sid]; if (s && s.team === susEnemyTeam && s.hp > 0) applySummonDamage(sid, finalDamage, charName); }
                }
                if (susShieldGain > 0) applyShield(charName, susShieldGain);
                addLog('🛡️ Susanoo: ' + charName + ' gana ' + susShieldGain + ' HP de escudo total', 'buff');

            
            } else if (ability.effect === 'multi_hit') {
                // Gudōdama - Múltiples golpes con probabilidad
                let hitsLanded = 0;
                let totalDamage = 0;
                const maxHits = ability.hits || 5;
                const hitChancePct = ability.hitChance || 50;
                const chargePerHitVal = ability.chargePerHit || 1;
                
                for (let i = 0; i < maxHits; i++) {
                    const hitChance = Math.random() * 100;
                    if (hitChance <= hitChancePct) {
                        hitsLanded++;
                        const dmg = applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                        totalDamage += dmg;
                        
                        // Ganar cargas por cada golpe acertado
                        let chargesGained = chargePerHitVal;
                        if (attacker.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                            chargesGained *= 2;
                        }
                        attacker.charges += chargesGained;
                        
                        // Activar pasiva de Igris por cada carga ganada
                        if (chargesGained > 0) {
                            triggerIgrisPassive(gameState.selectedCharacter);
                        }
                    }
                }
                
                addLog(`🌀 ${gameState.selectedCharacter} usa ${ability.name} en ${targetName}! ${hitsLanded}/${maxHits} golpes acertados causando ${totalDamage} de daño total`, 'damage');
                
            } else if (ability.effect === 'lifesteal_basic') {
                // Madara básico: daño + roba HP equivalente al daño causado (no doble daño)
                const lsActualDmg = applyDamageWithShield(targetName, finalDamage, charName);
                if (lsActualDmg > 0) {
                    const lsOldHp = attacker.hp;
                    attacker.hp = Math.min(attacker.maxHp, attacker.hp + lsActualDmg);
                    const lsHealed = attacker.hp - lsOldHp;
                    if (lsHealed > 0) addLog('🌀 Gakidō: ' + charName + ' roba ' + lsHealed + ' HP de ' + targetName, 'heal');
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'purificacion_solar') {
                // Thestalos básico: daño + cura 2 HP a sí mismo + Quemadura 2 HP al objetivo
                applyDamageWithShield(targetName, finalDamage, charName);
                const psOldHp = attacker.hp;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + 2);
                if (attacker.hp > psOldHp) addLog('💛 Purificación Solar: ' + charName + ' recupera ' + (attacker.hp - psOldHp) + ' HP', 'heal');
                applyFlatBurn(targetName, 2, 1);
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'great_horn') {
                // Aldebaran básico: daño + cura 3 HP + Escudo 2 HP a sí mismo
                applyDamageWithShield(targetName, finalDamage, charName);
                const ghOldHp = attacker.hp;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + (ability.heal || 3));
                if (attacker.hp > ghOldHp) addLog('🐂 Great Horn: ' + charName + ' recupera ' + (attacker.hp - ghOldHp) + ' HP', 'heal');
                applyShield(charName, ability.shieldAmount || 2);
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'proteccion_astro_rey') {
                // Thestalos especial: Provocación + Escudo 4 HP en sí mismo
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && normAccent(e.name||'') !== 'provocacion');
                attacker.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 2, emoji: '🛡️' });
                addLog('🛡️ Protección del Astro Rey: ' + charName + ' gana Provocación', 'buff');
                applyShield(charName, ability.shieldAmount || 4);

            } else if (ability.effect === 'magma_strength') {
                // Thestalos especial: cura 8 HP + Escudo Sagrado
                const msOldHp = attacker.hp;
                attacker.hp = Math.min(attacker.maxHp, attacker.hp + (ability.heal || 8));
                addLog('🔥 Magma Strength: ' + charName + ' recupera ' + (attacker.hp - msOldHp) + ' HP', 'heal');
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.name !== 'Escudo Sagrado');
                attacker.statusEffects.push({ name: 'Escudo Sagrado', type: 'buff', duration: 2, emoji: '✝️' });
                addLog('✝️ Magma Strength: ' + charName + ' gana Escudo Sagrado', 'buff');

            } else if (ability.effect === 'apply_weaken_basic') {
                // Saitama Golpe Normal: daño + Debilitar 2T
                applyDamageWithShield(targetName, finalDamage, charName);
                applyWeaken(targetName, 2);
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'genma_ken') {
                // Aspros básico: daño + Confusión + elimina buffs del objetivo
                applyDamageWithShield(targetName, finalDamage, charName);
                applyConfusion(targetName, 1);
                const tgtGK = gameState.characters[targetName];
                if (tgtGK && tgtGK.statusEffects) {
                    const gkBufRem = tgtGK.statusEffects.filter(e => e && e.type === 'buff' && !e.permanent).length;
                    tgtGK.statusEffects = tgtGK.statusEffects.filter(e => !e || e.type !== 'buff' || e.permanent);
                    if (gkBufRem > 0) addLog('🌀 Genma Ken: Eliminados ' + gkBufRem + ' buffs de ' + targetName, 'debuff');
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'heal_all_allies') {
                // Min Byung Sanación Heroica: sacrifica 50% HP propio, cura esa cantidad al equipo + Regeneracion 25% 2T a Min Byung
                const haTeam = attacker.team;
                const _haMinHP = Math.floor((attacker.hp||1) * 0.50);
                attacker.hp = Math.max(1, (attacker.hp||1) - _haMinHP);
                addLog('💚 Sanación Heroica: Min Byung sacrifica ' + _haMinHP + ' HP', 'damage');
                // Curar la cantidad sacrificada a todos los aliados (excepto Min Byung)
                for (let haName in gameState.characters) {
                    const haC = gameState.characters[haName];
                    if (!haC || haC.team !== haTeam || haC.isDead || haC.hp <= 0) continue;
                    if (haName === gameState.selectedCharacter) continue; // excluir a Min Byung
                    const haOld = haC.hp;
                    if (typeof applyHeal === 'function') applyHeal(haName, _haMinHP, 'Sanación Heroica');
                    else haC.hp = Math.min(haC.maxHp, haC.hp + _haMinHP);
                    const _haActual = haC.hp - haOld;
                    if (_haActual > 0) {
                        addLog('💚 ' + haName + ' recupera ' + _haActual + ' HP (Sanación Heroica)', 'heal');
                        if (typeof triggerBendicionSagrada === 'function') triggerBendicionSagrada(haTeam, _haActual);
                    }
                }
                // Buff Regeneracion 25% por 2T a Min Byung
                const _haRegen = Math.ceil((attacker.maxHp||20) * 0.25);
                if (typeof applyBuff === 'function') applyBuff(gameState.selectedCharacter, { name: 'Regeneracion', type: 'buff', duration: 2, emoji: '💖', amount: _haRegen });
                addLog('💖 Sanación Heroica: Min Byung obtiene Regeneración 25% por 2T', 'buff');

            } else if (ability.effect === 'dispel_ally_charges') {
                // Min Byung Protección Celestial: limpia 1 debuff de cada aliado
                // Por cada debuff limpiado: +1 HP y +1 carga a todo el equipo aliado
                const _pcAtk = gameState.characters[gameState.selectedCharacter];
                const _pcTeam = _pcAtk ? _pcAtk.team : 'team1';
                let _pcTotalDis = 0;
                for (const _pn in gameState.characters) {
                    const _pc = gameState.characters[_pn];
                    if (!_pc || _pc.team !== _pcTeam || _pc.isDead || _pc.hp <= 0) continue;
                    const _pcDebuffs = (_pc.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff' && !e.permanent; });
                    if (_pcDebuffs.length > 0) {
                        const _pcIdx = _pc.statusEffects.indexOf(_pcDebuffs[0]);
                        if (_pcIdx !== -1) { _pc.statusEffects.splice(_pcIdx, 1); _pcTotalDis++; }
                        addLog('✨ Protección Celestial: 1 debuff limpiado de ' + _pn, 'buff');
                    }
                }
                if (_pcTotalDis > 0) {
                    // +1 HP y +1 carga al equipo aliado por cada debuff limpiado
                    for (const _an in gameState.characters) {
                        const _ac = gameState.characters[_an];
                        if (!_ac || _ac.team !== _pcTeam || _ac.isDead || _ac.hp <= 0) continue;
                        if (typeof applyHeal === 'function') applyHeal(_an, _pcTotalDis, 'Protección Celestial');
                        else _ac.hp = Math.min(_ac.maxHp, (_ac.hp||0) + _pcTotalDis);
                        _ac.charges = Math.min(20, (_ac.charges||0) + _pcTotalDis);
                    }
                    addLog('✨ Protección Celestial: ' + _pcTotalDis + ' debuff(s) limpiados → +' + _pcTotalDis + ' HP y +' + _pcTotalDis + ' cargas al equipo aliado', 'buff');
                } else {
                    addLog('✨ Protección Celestial: ningún aliado tenía debuffs activos', 'info');
                }

            } else if (ability.effect === 'gilgamesh_enuma') {
                // Gilgamesh OVER: daño + roba TODAS las cargas del objetivo
                applyDamageWithShield(targetName, finalDamage, charName);
                const enTgt = gameState.characters[targetName];
                if (enTgt) {
                    const enStolen = enTgt.charges || 0;
                    if (enStolen > 0) {
                        enTgt.charges = 0;
                        attacker.charges = Math.min(20, (attacker.charges || 0) + enStolen);
                        addLog('✨ Enuma Elish: ' + charName + ' roba ' + enStolen + ' cargas de ' + targetName, 'buff');
                    }
                }

            } else if (ability.effect === 'sangre_esparta') {
                // Leonidas: Sacrifica 10 HP y genera 10 cargas
                if (attacker.hp <= 10) {
                    addLog('❌ Sangre de Esparta: ' + charName + ' no tiene suficiente HP', 'info');
                } else {
                    attacker.hp -= 10;
                    attacker.charges = Math.min(20, (attacker.charges || 0) + 10);
                    addLog('⚔️ Sangre de Esparta: ' + charName + ' sacrifica 10 HP y gana 10 cargas', 'buff');
                }

            
            } else if (ability.effect === 'summon_señuelo') {
                // PADME: Invoca un Señuelo + aplica Sigilo a Padmé por 2 turnos
                const _senName = gameState.selectedCharacter;
                const _senAtt = gameState.characters[_senName];
                if (!_senAtt) { addLog('❌ No se encontró el personaje', 'info'); }
                const _teamSummons = Object.values(gameState.summons).filter(s => s && s.team === _senAtt.team);
                if (_teamSummons.length >= 5) {
                    addLog('❌ Límite de invocaciones alcanzado (máx 5)', 'info');
                } else {
                    const _seExists = Object.values(gameState.summons).some(s => s && s.name === 'Señuelo' && s.team === _senAtt.team);
                    if (_seExists) {
                        addLog('❌ El Señuelo ya está en el campo', 'info');
                    } else {
                        // Create Señuelo from summonData
                        const _seData = summonData['Señuelo'];
                        if (_seData) {
                            const _seId = 'Señuelo_' + Date.now();
                            gameState.summons[_seId] = {
                                id: _seId,
                                name: 'Señuelo',
                                hp: _seData.hp || 5,
                                maxHp: _seData.maxHp || 5,
                                team: _senAtt.team,
                                summoner: _senName,
                                passive: _seData.passive || 'Distraccion de emergencia: Al morir genera 2 puntos de carga al equipo aliado',
                                img: _seData.img || 'https://i.postimg.cc/1tbCn5Xm/Captura_de_pantalla_2026_03_15_004506.png',
                                effect: '',
                                statusEffects: []
                            };
                            renderSummons();
                            addLog('🎭 ' + _senName + ' invoca un Señuelo', 'buff');
                        } else {
                            addLog('❌ No se encontró la plantilla del Señuelo en summonData', 'info');
                        }
                    }
                }
                // Aplicar Sigilo a Padmé por 2 turnos
                applyStealthBuff(_senName, 2);
                addLog('👤 ' + _senName + ' se oculta en Sigilo (2 turnos)', 'buff');
} else if (ability.effect === 'dispel_target_padme_charges') {
                // Solución Diplomática (Padmé): elimina TODOS los debuffs del aliado objetivo
                // Padmé gana 2 cargas por cada debuff eliminado
                const _dispelChar = gameState.characters[targetName];
                if (!_dispelChar) { addLog('❌ Objetivo no encontrado', 'info'); }
                const _debuffs = (_dispelChar.statusEffects || []).filter(e => e && e.type === 'debuff');
                const _count = _debuffs.length;
                if (_count === 0) {
                    addLog('🌸 Solución Diplomática: ' + targetName + ' no tiene debuffs activos', 'info');
                } else {
                    _dispelChar.statusEffects = (_dispelChar.statusEffects || []).filter(e => !e || e.type !== 'debuff');
                    if (typeof triggerRinneganCleanse === 'function') triggerRinneganCleanse(targetName, _count);
                    addLog('🌸 Solución Diplomática: ' + _count + ' debuff' + (_count>1?'s':'') + ' eliminado' + (_count>1?'s':'') + ' de ' + targetName, 'buff');
                    const _padmeChar = gameState.characters[gameState.selectedCharacter];
                    if (_padmeChar) {
                        const _gained = _count * 2;
                        _padmeChar.charges = Math.min(20, (_padmeChar.charges || 0) + _gained);
                        addLog('🌸 Padmé gana ' + _gained + ' cargas por ' + _count + ' debuffs eliminados', 'buff');
                    }
                }
                addLog('⚔️ ' + gameState.selectedCharacter + ' usa Solución Diplomática en ' + targetName, 'damage');
            } else if (ability.effect === 'summon_dragon') {
                // Daenerys: Invoca un Dragón aleatorio — solo de los que NO están en el campo
                const dragonPoolFull = [
                    { name: 'Drogon', weight: 10 },
                    { name: 'Rhaegal', weight: 45 },
                    { name: 'Viserion', weight: 45 }
                ];
                // Filter out dragons already on the field
                const activeDragons = new Set(
                    Object.values(gameState.summons)
                        .filter(s => s && s.team === attacker.team)
                        .map(s => s.name)
                );
                const dragonPool = dragonPoolFull.filter(d => !activeDragons.has(d.name));
                if (dragonPool.length === 0) {
                    addLog('🐉 Madre de Dragones: Todos los dragones ya están en el campo', 'info');
                } else {
                    const totalW = dragonPool.reduce((s, d) => s + d.weight, 0);
                    let drRand = Math.random() * totalW, drChosen = dragonPool[dragonPool.length-1].name;
                    for (const d of dragonPool) { drRand -= d.weight; if (drRand <= 0) { drChosen = d.name; break; } }
                    const drData = summonData[drChosen];
                    if (drData) {
                        const drId = drChosen + '_' + Date.now();
                        gameState.summons[drId] = {
                            id: drId, name: drChosen,
                            hp: drData.hp, maxHp: drData.hp,
                            team: attacker.team, summoner: charName,
                            passive: drData.passive, img: drData.img || '',
                            effect: drData.effect || '',
                            megaProvocation: drChosen === 'Drogon',
                            statusEffects: []
                        };
                        addLog('🐉 Madre de Dragones: ' + charName + ' invoca a ' + drChosen, 'buff');
                        renderSummons();
                    }
                }

            } else if (ability.effect === 'heal_aura_luz') {
                // El Mago Blanco (Gandalf) / similar: cura 3HP a todos los aliados + Buff Aura de Luz
                const _halTeam = attacker.team;
                let _healed = 0;
                for (let _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (_c && _c.team === _halTeam && !_c.isDead && _c.hp > 0) {
                        const _heal = ability.heal || 3;
                        const _before = _c.hp;
                        _c.hp = Math.min(_c.maxHp, _c.hp + _heal);
                        const _actualHeal = _c.hp - _before;
                        if (_actualHeal > 0) {
                            _healed += _actualHeal;
                            triggerBendicionSagrada(_halTeam, _actualHeal);
                            addLog('✨ ' + _n + ' recupera ' + _actualHeal + ' HP (Aura de Luz)', 'heal');
                        }
                        // Apply Aura de Luz buff to this ally
                        if (!hasStatusEffect(_n, 'Aura de Luz') && !hasStatusEffect(_n, 'Aura de luz')) {
                            applyBuff(_n, { name: 'Aura de Luz', type: 'buff', duration: 3, emoji: '✨', description: 'Aura de Luz: aliado brillante' });
                        }
                    }
                }
                addLog('✨ ' + gameState.selectedCharacter + ' usa ' + ability.name + ' — Curación + Aura de Luz al equipo aliado', 'heal');
            } else if (ability.effect === 'team_regen') {
                // Gandalf Resplandor: Buff Regeneración 10% x1 a todo el equipo aliado
                const trTeam = attacker.team;
                for (let trName in gameState.characters) {
                    const trC = gameState.characters[trName];
                    if (!trC || trC.team !== trTeam || trC.isDead || trC.hp <= 0) continue;
                    trC.statusEffects = (trC.statusEffects || []).filter(e => e && !(e.name === 'Regeneracion' && !e.permanent));
                    trC.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 1, percent: 10, emoji: '💖' });
                }
                addLog('✨ Resplandor: Regeneración 10% x1T aplicada a todo el equipo aliado', 'buff');

            } else if (ability.effect === 'escudo_sagrado_self') {
                // Vuelo del Dragón (Daenerys): gana Buff Escudo Sagrado
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.name !== 'Escudo Sagrado');
                attacker.statusEffects.push({ name: 'Escudo Sagrado', type: 'buff', duration: 2, emoji: '✝️' });
                addLog('✝️ Vuelo del Dragón: ' + charName + ' gana Escudo Sagrado', 'buff');

            } else if (ability.effect === 'heal_shield_prov') {
                // Rayo de Luz (Gandalf): aliado objetivo recupera 5 HP + Escudo 5 HP + Provocación
                const hspC = gameState.characters[targetName];
                if (hspC) {
                    const hspOld = hspC.hp;
                    const _hspOldHp = hspC.hp;
                hspC.hp = Math.min(hspC.maxHp, hspC.hp + 5);
                const _hspHeal = hspC.hp - _hspOldHp;
                if (_hspHeal > 0) triggerBendicionSagrada(hspC.team, _hspHeal);
                    addLog('💫 Rayo de Luz: ' + targetName + ' recupera ' + (hspC.hp - hspOld) + ' HP', 'heal');
                    applyShield(targetName, 5);
                    hspC.statusEffects = (hspC.statusEffects || []).filter(e => e && normAccent(e.name||'') !== 'provocacion');
                    hspC.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 2, emoji: '🛡️' });
                    addLog('🛡️ Rayo de Luz: ' + targetName + ' gana Provocación', 'buff');
                }

            } else if (ability.effect === 'dispel_heal_allies') {
                // Medicina Demoniaca (Tamayo): disipar debuffs aliados + 1 HP por debuff eliminado
                const dhaTeam = attacker.team;
                let dhaTotalDebuffs = 0;
                for (let dhaName in gameState.characters) {
                    const dhaC = gameState.characters[dhaName];
                    if (!dhaC || dhaC.team !== dhaTeam || dhaC.isDead || dhaC.hp <= 0) continue;
                    const dhaD = (dhaC.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    dhaTotalDebuffs += dhaD.length;
                    dhaC.statusEffects = (dhaC.statusEffects || []).filter(e => !e || e.type !== 'debuff' || e.permanent);
                }
                if (dhaTotalDebuffs > 0) {
                    // Heal ALL alive allies 1HP per total debuff removed
                    for (let dhaName in gameState.characters) {
                        const dhaC = gameState.characters[dhaName];
                        if (!dhaC || dhaC.team !== dhaTeam || dhaC.isDead || dhaC.hp <= 0) continue;
                        const dhaHealOld = dhaC.hp;
                        dhaC.hp = Math.min(dhaC.maxHp, dhaC.hp + dhaTotalDebuffs);
                        const dhaActualHeal = dhaC.hp - dhaHealOld;
                        if (dhaActualHeal > 0) {
                            addLog('💚 Medicina Demoniaca: ' + dhaName + ' recupera ' + dhaActualHeal + ' HP (' + dhaTotalDebuffs + ' debuffs eliminados)', 'heal');
                            triggerBendicionSagrada(dhaTeam, dhaActualHeal);
                        }
                    }
                    addLog('🌿 Medicina Demoniaca: ' + dhaTotalDebuffs + ' debuffs eliminados del equipo aliado', 'buff');
                } else {
                    addLog('🌿 Medicina Demoniaca: No había debuffs activos en el equipo', 'info');
                }

            } else if (ability.effect === 'apply_aura_oscura') {
                // Aplica Buff Aura Oscura al personaje activo
                const _aoName = gameState.selectedCharacter;
                if (!hasStatusEffect(_aoName, 'Aura oscura') && !hasStatusEffect(_aoName, 'Aura Oscura')) {
                    applyBuff(_aoName, { name: 'Aura oscura', type: 'buff', duration: 4, emoji: '🌑', permanent: false });
                    addLog('🌑 ' + _aoName + ' activa Aura Oscura (los enemigos que le ataquen pierden cargas)', 'buff');
                } else {
                    addLog('🌑 ' + _aoName + ' ya tiene Aura Oscura activa', 'info');
                }
            } else if (ability.effect === 'aoe_cleanse_allies') {
                // Aroma Curativo (Tamayo): Limpia 1 debuff de todos los aliados
                const acTeam = attacker.team;
                let acCleansed = 0;
                for (let acName in gameState.characters) {
                    const acC = gameState.characters[acName];
                    if (!acC || acC.team !== acTeam || acC.isDead || acC.hp <= 0) continue;
                    const acDebuffs = (acC.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (acDebuffs.length > 0) {
                        acC.statusEffects = acC.statusEffects.filter(e => e !== acDebuffs[0]);
                        addLog('🌸 Aroma Curativo: Limpia ' + (acDebuffs[0].name||'debuff') + ' de ' + acName, 'buff');
                        acCleansed++;
                    }
                }
                if (acCleansed === 0) addLog('🌸 Aroma Curativo: Ningún aliado tenía debuffs', 'info');

            } else if (ability.effect === 'cleanse_enemy_debuff') {
                // Relámpago Sith (Palpatine): daño + limpia 1 debuff del objetivo enemigo
                applyDamageWithShield(targetName, finalDamage, charName);
                const rsTgt = gameState.characters[targetName];
                if (rsTgt && rsTgt.statusEffects) {
                    const rsD = (rsTgt.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (rsD.length > 0) {
                        rsTgt.statusEffects = rsTgt.statusEffects.filter(e => e !== rsD[0]);
                        addLog('⚡ Relámpago Sith: Limpia ' + (rsD[0].name||'debuff') + ' de ' + targetName, 'buff');
                        // Palpatine passive: 50% stun on debuff cleared
                        if (Math.random() < 0.5) {
                            applyStun(targetName, 1);
                            addLog('⚡ Palpatine: 50% Aturdimiento sobre ' + targetName, 'debuff');
                        }
                    }
                }
                generateChargesInline(charName, ability.chargeGain);


            // ══════════════════════════════════════════════════════
            // FLASH — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'patada_relampago') {
                // FLASH — Patada Relámpago: 2 daño + Esquivar 2T + 50% crit
                const _plAtk = gameState.characters[gameState.selectedCharacter];
                let _plDmg = finalDamage;
                const _plCrit = Math.random() < 0.50;
                if (_plCrit) {
                    _plDmg *= 2;
                    // Pasiva: crit → Flash recupera 2 HP
                    if (_plAtk && _plAtk.passive && _plAtk.passive.name === 'Aceleración Constante') {
                        if (typeof canHeal === 'function' ? canHeal(gameState.selectedCharacter) : true) {
                            _plAtk.hp = Math.min(_plAtk.maxHp, (_plAtk.hp || 0) + 2);
                            addLog('⚡ Aceleración Constante: Flash recupera 2 HP (crítico)', 'heal');
                        }
                    }
                    addLog('💥 Patada Relámpago: ¡Crítico! ' + _plDmg + ' daño', 'damage');
                }
                applyDamageWithShield(targetName, _plDmg, gameState.selectedCharacter);
                // Buff Esquivar 2T
                if (_plAtk) {
                    _plAtk.statusEffects = (_plAtk.statusEffects || []).filter(e => !e || normAccent(e.name||'') !== 'esquivar');
                    _plAtk.statusEffects.push({ name: 'Esquivar', type: 'buff', duration: 2, emoji: '💨' });
                }
                addLog('⚡ Patada Relámpago: ' + _plDmg + ' daño + Esquivar 2T a ' + gameState.selectedCharacter, 'damage');

            } else if (ability.effect === 'electroquinesis_flash') {
                // FLASH — Electroquinesis: 3 AOE + 50% robar 2 cargas + 50% crit por objetivo
                const _eqAtk = gameState.characters[gameState.selectedCharacter];
                const _eqETeam = _eqAtk ? (_eqAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_eqETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⚡ Electroquinesis redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _eqETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        let _eqDmg = finalDamage;
                        const _eqCrit = Math.random() < 0.50;
                        if (_eqCrit) {
                            _eqDmg *= 2;
                            if (_eqAtk && _eqAtk.passive && _eqAtk.passive.name === 'Aceleración Constante') {
                                if (typeof canHeal === 'function' ? canHeal(gameState.selectedCharacter) : true) {
                                    _eqAtk.hp = Math.min(_eqAtk.maxHp, (_eqAtk.hp||0) + 2);
                                }
                            }
                            addLog('💥 Electroquinesis: ¡Crítico en ' + _n + '!', 'damage');
                        }
                        applyDamageWithShield(_n, _eqDmg, gameState.selectedCharacter);
                        // 50% robar 2 cargas
                        if (Math.random() < 0.50 && _c.charges > 0 && _eqAtk) {
                            const stolen = Math.min(2, _c.charges);
                            _c.charges = Math.max(0, _c.charges - stolen);
                            _eqAtk.charges = Math.min(20, (_eqAtk.charges||0) + stolen);
                            addLog('⚡ Electroquinesis: roba ' + stolen + ' cargas de ' + _n, 'buff');
                        }
                    }
                    for (let _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _eqETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                applyAOEToSummons(_eqETeam, finalDamage, _eqAtk);
                addLog('⚡ Electroquinesis: ' + finalDamage + ' AOE', 'damage');

            } else if (ability.effect === 'golpe_masa_infinita') {
                // FLASH — Golpe de Masa Infinita: 2 daño + turno adicional + 50% crit
                const _gmiAtk = gameState.characters[gameState.selectedCharacter];
                let _gmiDmg = finalDamage;
                const _gmiCrit = Math.random() < 0.50;
                if (_gmiCrit) {
                    _gmiDmg *= 2;
                    if (_gmiAtk && _gmiAtk.passive && _gmiAtk.passive.name === 'Aceleración Constante') {
                        if (typeof canHeal === 'function' ? canHeal(gameState.selectedCharacter) : true) {
                            _gmiAtk.hp = Math.min(_gmiAtk.maxHp, (_gmiAtk.hp||0) + 2);
                        }
                    }
                    addLog('💥 Golpe de Masa Infinita: ¡Crítico! ' + _gmiDmg + ' daño', 'damage');
                }
                applyDamageWithShield(targetName, _gmiDmg, gameState.selectedCharacter);
                addLog('⚡ Golpe de Masa Infinita: ' + _gmiDmg + ' daño a ' + targetName + ' + turno adicional', 'damage');
                if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _gmiAtk ? _gmiAtk.team : 'team1');
                renderCharacters();
                renderSummons();
                showContinueButton();
                return;

            } else if (ability.effect === 'singularidad_escarlata') {
                // FLASH — Singularidad Escarlata: 10 daño + turno adicional + cooldown 3T
                const _seAtk = gameState.characters[gameState.selectedCharacter];
                // Cooldown check
                if (_seAtk && _seAtk._singularidadCooldown > 0) {
                    addLog('⚡ Singularidad Escarlata en cooldown: ' + _seAtk._singularidadCooldown + ' turno(s) restante(s) — habilidad bloqueada', 'info');
                    endTurn();
                    return;
                }
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                // Generar 20 cargas a Flash
                if (_seAtk) {
                    _seAtk.charges = Math.min(20, (_seAtk.charges || 0) + 20);
                    addLog('🔴 Singularidad Escarlata: Flash gana 20 cargas', 'buff');
                }
                addLog('🔴 Singularidad Escarlata: ' + finalDamage + ' daño a ' + targetName + ' + turno adicional', 'damage');
                // Activar cooldown de 3 turnos
                if (_seAtk) _seAtk._singularidadCooldown = 3;
                if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _seAtk ? _seAtk.team : 'team1');
                renderCharacters();
                renderSummons();
                showContinueButton();
                return;


            // ══════════════════════════════════════════════════════
            // NARUTO — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'kage_bunshin_naruto') {
                // NARUTO — Kage Bunshin: 1-4 golpes, 1 carga por golpe
                const _kbN = gameState.characters[gameState.selectedCharacter];
                const hits = Math.floor(Math.random() * 4) + 1;
                let _kbTotal = 0;
                for (let _i = 0; _i < hits; _i++) {
                    const _tgt = gameState.characters[targetName];
                    if (!_tgt || _tgt.isDead || _tgt.hp <= 0) break;
                    let _kbDmg = ability.damage || 1;
                    // Baryon: daño doble
                    if (_kbN && _kbN.narutoForm === 'baryon') _kbDmg *= 2;
                    applyDamageWithShield(targetName, _kbDmg, gameState.selectedCharacter);
                    _kbTotal += _kbDmg;
                    // 1 carga por golpe
                    if (_kbN) _kbN.charges = Math.min(20, (_kbN.charges||0) + 1);
                    // Baryon: cargas adicionales = daño causado
                    if (_kbN && _kbN.narutoForm === 'baryon') {
                        _kbN.charges = Math.min(20, (_kbN.charges||0) + _kbDmg);
                    }
                    addLog('🌀 Kage Bunshin golpe ' + (_i+1) + '/' + hits + ': ' + _kbDmg + ' daño a ' + targetName, 'damage');
                }
                addLog('🌀 Kage Bunshin: ' + hits + ' golpes, ' + _kbTotal + ' daño total', 'damage');

            } else if (ability.effect === 'rasengan_naruto') {
                // NARUTO — Rasengan: 3 daño + Mega Aturdimiento 2T si tiene buffs
                const _rsN = gameState.characters[gameState.selectedCharacter];
                let _rsDmg = finalDamage;
                if (_rsN && _rsN.narutoForm === 'baryon') _rsDmg *= 2;
                applyDamageWithShield(targetName, _rsDmg, gameState.selectedCharacter);
                addLog('💠 Rasengan: ' + _rsDmg + ' daño a ' + targetName, 'damage');
                const _rsTgt = gameState.characters[targetName];
                if (_rsTgt && !_rsTgt.isDead && _rsTgt.hp > 0) {
                    const _hasBuff = (_rsTgt.statusEffects||[]).some(function(e){ return e && e.type === 'buff'; });
                    if (_hasBuff) {
                        applyStun(targetName, 2);
                        addLog('💠 Rasengan: Mega Aturdimiento 2T aplicado a ' + targetName + ' (tenía buffs)', 'debuff');
                    }
                    // Baryon: cargas = daño causado
                    if (_rsN && _rsN.narutoForm === 'baryon') {
                        _rsN.charges = Math.min(20, (_rsN.charges||0) + _rsDmg);
                    }
                }

            } else if (ability.effect === 'rasenshuriken_naruto') {
                // NARUTO — Futon Rasenshuriken: 5 AOE + Debilitar + Sangrado + turno adicional
                const _rnN = gameState.characters[gameState.selectedCharacter];
                const _rnETeam = _rnN ? (_rnN.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_rnETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🌪️ Rasenshuriken redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _rnETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' esquiva Rasenshuriken', 'buff'); continue; }
                        let _rnDmg = finalDamage;
                        if (_rnN && _rnN.narutoForm === 'baryon') _rnDmg *= 2;
                        applyDamageWithShield(_n, _rnDmg, gameState.selectedCharacter);
                        applyWeaken(_n, 2);
                        applyBleed(_n, 2);
                        addLog('🌪️ Rasenshuriken: ' + _rnDmg + ' daño + Debilitar + Sangrado a ' + _n, 'damage');
                        if (_rnN && _rnN.narutoForm === 'baryon') {
                            _rnN.charges = Math.min(20, (_rnN.charges||0) + _rnDmg);
                        }
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _rnETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                applyAOEToSummons(_rnETeam, finalDamage, gameState.selectedCharacter);
                addLog('🌪️ Futon Rasenshuriken: AOE completado', 'damage');
                if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _rnN ? _rnN.team : 'team1');
                renderCharacters(); renderSummons(); showContinueButton(); return;

            } else if (ability.effect === 'voluntad_hoja_naruto') {
                // NARUTO — Voluntad de la Hoja: 50% HP + Quemadura 5HP 2T
                const _vlTgt = gameState.characters[targetName];
                if (_vlTgt && !_vlTgt.isDead && _vlTgt.hp > 0) {
                    const _vlDmg = Math.ceil(_vlTgt.hp * 0.50);
                    applyDamageWithShield(targetName, _vlDmg, gameState.selectedCharacter);
                    addLog('🔥 Voluntad de la Hoja: ' + _vlDmg + ' daño (50% HP) a ' + targetName, 'damage');
                    if (!_vlTgt.isDead && _vlTgt.hp > 0) {
                        applyFlatBurn(targetName, 5, 2);
                        addLog('🔥 Voluntad de la Hoja: Quemadura 5HP 2T a ' + targetName, 'debuff');
                    }
                }

            // ══════════════════════════════════════════════════════
            // JON SNOW — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'garra_bastarda_jon') {
                // JON SNOW — Garra Bastarda: 2 daño + 1 por cada buff en objetivo
                const _gbTgt = gameState.characters[targetName];
                let _gbDmg = finalDamage;
                if (_gbTgt) {
                    const _buffCount = (_gbTgt.statusEffects||[]).filter(function(e){ return e && e.type === 'buff'; }).length;
                    if (_buffCount > 0) {
                        _gbDmg += _buffCount;
                        addLog('⚔️ Garra Bastarda: +' + _buffCount + ' daño por buffs del objetivo', 'damage');
                    }
                }
                applyDamageWithShield(targetName, _gbDmg, gameState.selectedCharacter);
                addLog('⚔️ Garra Bastarda: ' + _gbDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'summon_ghost') {
                // JON SNOW — invoca a Ghost
                const existingGhost = Object.values(gameState.summons).find(function(s) {
                    return s && s.name === 'Ghost' && s.summoner === gameState.selectedCharacter;
                });
                if (existingGhost) {
                    addLog('❌ Ghost ya está invocado', 'info');
                } else {
                    summonShadow('Ghost', gameState.selectedCharacter);
                    addLog('🐺 Jon Snow invoca a Ghost', 'buff');
                }

            } else if (ability.effect === 'carga_lobo_jon') {
                // JON SNOW — Carga del Lobo: 5 daño + 30% Mega Aturdimiento
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🐺 Carga del Lobo: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _clTgt = gameState.characters[targetName];
                if (_clTgt && !_clTgt.isDead && _clTgt.hp > 0 && Math.random() < 0.30) {
                    applyStun(targetName, 1);
                    addLog('🐺 Carga del Lobo: Mega Aturdimiento aplicado a ' + targetName, 'debuff');
                }

            } else if (ability.effect === 'rey_del_norte_jon') {
                // JON SNOW — El Rey del Norte: todos los ALIADOS ejecutan su Over con cinemática secuencial
                const _rjAtk = gameState.characters[gameState.selectedCharacter];
                if (!_rjAtk) { endTurn(); return; }
                const _rjAllyTeam  = _rjAtk.team;
                const _rjEnemyTeam = _rjAllyTeam === 'team1' ? 'team2' : 'team1';
                addLog('👑 El Rey del Norte: ¡todos los aliados ejecutan su Over!', 'buff');

                // Recopilar aliados con Over ANTES de cambiar selectedCharacter
                const _rjOrigChar    = gameState.selectedCharacter;
                const _rjOrigAbility = gameState.selectedAbility;
                const _rjOrigCost    = gameState.adjustedCost;

                const _rjQueue = [];
                for (const _aln in gameState.characters) {
                    const _alc = gameState.characters[_aln];
                    if (!_alc || _alc.isDead || _alc.hp <= 0) continue;
                    if (_alc.team !== _rjAllyTeam) continue;
                    if (_aln === _rjOrigChar) continue;
                    const _overAb = (_alc.abilities||[]).find(function(ab){ return ab && ab.type === 'over'; });
                    if (!_overAb) continue;
                    _rjQueue.push({ name: _aln, char: _alc, over: _overAb });
                }

                if (_rjQueue.length === 0) {
                    // Sin aliados con Over — terminar normal
                    endTurn();
                    return;
                }

                // Parchear endTurn para que no interrumpa la secuencia
                const _rjEndOrig  = endTurn;
                const _rjContOrig = typeof showContinueButton !== 'undefined' ? showContinueButton : null;
                endTurn = function() {};
                if (_rjContOrig) showContinueButton = function() {};

                // Marcar que estamos en el loop de Jon Snow
                gameState._jonSnowLoopActive = true;
                gameState._jonSnowPendingWinner = null;

                // Ejecutar secuencia async: cinemática → Over → siguiente
                (async function() {
                    for (const _entry of _rjQueue) {
                        // Detener si el juego terminó durante el loop
                        if (gameState.gameOver) break;

                        const _aln   = _entry.name;
                        const _alc   = _entry.char;
                        const _overAb = _entry.over;

                        // Verificar que el aliado siga vivo
                        if (_alc.isDead || _alc.hp <= 0) continue;

                        // Determinar target
                        const _rjAliveEnemies = Object.keys(gameState.characters).filter(function(n) {
                            const c = gameState.characters[n];
                            return c && c.team === _rjEnemyTeam && !c.isDead && c.hp > 0;
                        });
                        let _rjTarget = null;
                        if (_overAb.target === 'single' && _rjAliveEnemies.length > 0) {
                            _rjTarget = _rjAliveEnemies[Math.floor(Math.random() * _rjAliveEnemies.length)];
                        } else if (_overAb.target === 'self' || _overAb.target === 'ally_single') {
                            _rjTarget = _aln;
                        } else if (_overAb.target === 'aoe' || _overAb.target === 'ally_aoe') {
                            _rjTarget = _rjAliveEnemies.length > 0 ? _rjAliveEnemies[0] : _aln;
                        } else if (_overAb.target === 'ally_dead') {
                            const _deadAlly = Object.keys(gameState.characters).find(function(n) {
                                const c = gameState.characters[n];
                                return c && c.team === _rjAllyTeam && (c.isDead || c.hp <= 0);
                            });
                            if (!_deadAlly) { addLog('👑 ' + _aln + ': no hay aliados caídos', 'info'); continue; }
                            _rjTarget = _deadAlly;
                        }

                        // Setear contexto para este aliado
                        gameState.selectedCharacter = _aln;
                        gameState.selectedAbility   = _overAb;
                        gameState.adjustedCost      = 0;

                        // ── Mostrar cinemática y esperar que termine ──
                        if (typeof _showOverCinematicAsync === 'function') {
                            await _showOverCinematicAsync(_aln, _overAb.name, _overAb.effect, _rjAllyTeam);
                        }

                        // ── Ejecutar el Over del aliado (sin cinemática de nuevo) ──
                        try {
                            _executeAbilityCore(_rjTarget);
                        } catch(e) {
                            addLog('👑 Error en Over de ' + _aln + ': ' + e.message, 'info');
                        }

                        // Sanear cargas
                        _alc.charges = Math.max(0, Math.min(20, _alc.charges || 0));
                    }

                    // Limpiar flag del loop
                    gameState._jonSnowLoopActive = false;

                    // Restaurar todo al terminar la secuencia
                    gameState.selectedCharacter = _rjOrigChar;
                    gameState.selectedAbility   = _rjOrigAbility;
                    gameState.adjustedCost      = _rjOrigCost;
                    endTurn = _rjEndOrig;
                    if (_rjContOrig) showContinueButton = _rjContOrig;

                    // Sanear cargas de todo el equipo
                    for (const _safen in gameState.characters) {
                        const _safec = gameState.characters[_safen];
                        if (_safec && _safec.team === _rjAllyTeam) {
                            _safec.charges = Math.max(0, Math.min(20, _safec.charges || 0));
                        }
                    }

                    // Renderizar
                    if (typeof renderCharacters === 'function') renderCharacters();

                    // Si el juego terminó durante el loop, mostrar ahora el resultado
                    if (gameState._jonSnowPendingWinner) {
                        showGameOver(gameState._jonSnowPendingWinner);
                        gameState._jonSnowPendingWinner = null;
                    } else {
                        _rjEndOrig();
                    }
                })();

                // Retornar inmediatamente — la secuencia async maneja el endTurn
                return;


            // ══════════════════════════════════════════════════════
            // ANTARES — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'dragons_fear_antares') {
                const _dfAnt = gameState.characters[gameState.selectedCharacter];
                const _dfETeam = _dfAnt ? (_dfAnt.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_dfETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog("🐉 Dragon's Fear redirigido por Mega Provocación", 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _dfETeam || _c.isDead || _c.hp <= 0) continue;
                        // Verificar Esquiva Área (buff o pasiva permanente como Mente Brillante)
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' esquiva Dragon\'s Fear (Esquiva Área)', 'buff'); continue; }
                        // También verificar directamente la pasiva Mente Brillante (Ivar)
                        if (_c.passive && _c.passive.name === 'Mente Brillante') { addLog('💨 ' + _n + ' esquiva Dragon\'s Fear (Mente Brillante)', 'buff'); continue; }
                        let _dfDmg = finalDamage;
                        const _hasMiedoOrBurn = (_c.statusEffects||[]).some(function(e){
                            if (!e) return false; const _nn = normAccent(e.name||'').toLowerCase();
                            return _nn === 'miedo' || _nn.includes('quemadura');
                        });
                        if (_hasMiedoOrBurn && Math.random() < 0.30) {
                            _dfDmg *= 3;
                            addLog("💥 Dragon's Fear: ¡Triple daño en " + _n + "!", 'damage');
                        }
                        applyDamageWithShield(_n, _dfDmg, gameState.selectedCharacter);
                        if (Math.random() < 0.50) { applyFear(_n, 2); addLog("😱 Dragon's Fear: Miedo 2T a " + _n, 'debuff'); }
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _dfETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                addLog("🐉 Dragon's Fear: 2 AOE completado", 'damage');

            } else if (ability.effect === 'tormenta_fuego_antares') {
                // ANTARES — Tormenta de Fuego (ST): 3 daño + Quemadura 2HP a todos enemigos; si Buff → 5HP
                const _tfAnt = gameState.characters[gameState.selectedCharacter];
                const _tfETeam = _tfAnt ? (_tfAnt.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Daño ST al objetivo seleccionado
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🔥 Tormenta de Fuego: ' + finalDamage + ' daño a ' + targetName, 'damage');
                // Quemadura a TODOS los enemigos vivos
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _tfETeam || _c.isDead || _c.hp <= 0) continue;
                    const _hasBuff = (_c.statusEffects||[]).some(function(e){ return e && e.type === 'buff'; });
                    const _burnAmt = _hasBuff ? 5 : 2;
                    applyFlatBurn(_n, _burnAmt, 2);
                    addLog('🔥 Tormenta de Fuego: Quemadura ' + _burnAmt + 'HP a ' + _n + (_hasBuff ? ' (Buff activo → 5HP)' : ''), 'debuff');
                }
                addLog('🔥 Tormenta de Fuego completada', 'damage');

            } else if (ability.effect === 'dragon_destruccion_antares') {
                const _ddAnt = gameState.characters[gameState.selectedCharacter];
                const _ddETeam = _ddAnt ? (_ddAnt.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_ddETeam, 4, gameState.selectedCharacter)) {
                    addLog('🐉 Dragon de la Destruccion AOE redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ddETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, 4, gameState.selectedCharacter);
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _ddETeam && _s.hp > 0) applySummonDamage(_sid, 4, gameState.selectedCharacter);
                    }
                }
                if (_ddAnt) {
                    _ddAnt.antaresTransformed = true;
                    _ddAnt.antaresTransformTurns = 3;
                    _ddAnt.basePortrait = _ddAnt.basePortrait || _ddAnt.portrait;
                    _ddAnt.portrait = _ddAnt.transformPortrait || _ddAnt.portrait;
                    audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                    addLog('🐉 Antares se transforma en Dragon de la Destruccion (3 turnos)', 'buff');
                }
                renderCharacters();

            } else if (ability.effect === 'aliento_destruccion_antares') {
                const _adAnt = gameState.characters[gameState.selectedCharacter];
                const _adETeam = _adAnt ? (_adAnt.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _adTrans = _adAnt && _adAnt.antaresTransformed;
                if (checkAndRedirectAOEMegaProv(_adETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🐉 Aliento de la Destruccion redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _adETeam || _c.isDead || _c.hp <= 0) continue;
                        // IGNORA Esquiva Area (buff Y pasiva) — aplicar sin checkear inmunidad
                        // Desactivar temporalmente esquivaAreaPassive para este ataque
                        const _savedEAP = _c.esquivaAreaPassive;
                        const _savedEABuff = (_c.statusEffects||[]).find(function(e){ return e && normAccent(e.name||'') === 'esquiva area'; });
                        const _savedEADur = _savedEABuff ? _savedEABuff.duration : null;
                        _c.esquivaAreaPassive = false;
                        if (_savedEABuff) _savedEABuff.duration = 0; // ocultar temporalmente
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        // Restaurar
                        _c.esquivaAreaPassive = _savedEAP;
                        if (_savedEABuff && _savedEADur !== null) _savedEABuff.duration = _savedEADur;
                        if (_adTrans) { applyFlatBurn(_n, 5, 2); addLog('🐉 Aliento: Quemadura 5HP a ' + _n, 'debuff'); }
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _adETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                addLog('🐉 Aliento de la Destruccion: ' + finalDamage + ' AOE completado', 'damage');

            // ══════════════════════════════════════════════════════
            // SASUKE UCHIHA — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'kusanagi_sasuke') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyAgotamiento(targetName, 3);
                addLog('⚡ Corte Kusanagi: ' + finalDamage + ' daño + Agotamiento 3T a ' + targetName, 'damage');

            } else if (ability.effect === 'chidori_sasuke') {
                // SASUKE — Chidori: 4 daño + roba hasta 4 cargas; si queda en 0 → crítico
                const _chTgt = gameState.characters[targetName];
                const _chAtk = gameState.characters[gameState.selectedCharacter];
                let _chDmg = finalDamage;
                // Primero robar las cargas
                let _chGotCrit = false;
                if (_chTgt) {
                    const _stolen = Math.min(4, _chTgt.charges || 0);
                    if (_stolen > 0) {
                        _chTgt.charges = Math.max(0, (_chTgt.charges||0) - _stolen);
                        if (_chAtk) _chAtk.charges = Math.min(20, (_chAtk.charges||0) + _stolen);
                        addLog('⚡ Chidori: roba ' + _stolen + ' cargas de ' + targetName, 'buff');
                    }
                    // Si tras el robo el objetivo tiene 0 cargas → crítico
                    if ((_chTgt.charges || 0) === 0) {
                        _chDmg *= 2;
                        _chGotCrit = true;
                        addLog('⚡ Chidori: ¡Crítico! ' + targetName + ' quedó en 0 cargas', 'damage');
                    }
                }
                applyDamageWithShield(targetName, _chDmg, gameState.selectedCharacter);
                addLog('⚡ Chidori: ' + _chDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'kirin_sasuke') {
                const _kirTgt = gameState.characters[targetName];
                let _kirDmg = finalDamage;
                if (_kirTgt && (_kirTgt.charges || 0) < 5 && Math.random() < 0.50) { _kirDmg *= 2; addLog('⚡ Kirin: ¡Crítico! (<5 cargas)', 'damage'); }
                applyDamageWithShield(targetName, _kirDmg, gameState.selectedCharacter);
                addLog('⚡ Kirin: ' + _kirDmg + ' daño a ' + targetName + ' (ignora Provocación)', 'damage');
                if (_kirTgt && (_kirTgt.isDead || _kirTgt.hp <= 0)) {
                    const _kirMyTeam = (gameState.characters[gameState.selectedCharacter]||{}).team;
                    const _kirDefTeam = _kirMyTeam === 'team1' ? 'team2' : 'team1';
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (_c && _c.team === _kirDefTeam && !_c.isDead && _c.hp > 0) _c.charges = Math.max(0, (_c.charges||0) - 10);
                    }
                    addLog('⚡ Kirin: ¡Eliminado! Todos los enemigos pierden 10 cargas', 'debuff');
                }

            } else if (ability.effect === 'flecha_indra_sasuke') {
                const _fiAtk = gameState.characters[gameState.selectedCharacter];
                const _fiETeam = _fiAtk ? (_fiAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('⚡ Flecha de Indra: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (Math.random() < 0.50) {
                    const _fiAlive = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _fiETeam && !c.isDead && c.hp > 0;
                    });
                    if (_fiAlive.length > 0) {
                        const _fiRand = _fiAlive[Math.floor(Math.random() * _fiAlive.length)];
                        applyDamageWithShield(_fiRand, finalDamage, gameState.selectedCharacter);
                        addLog('⚡ Flecha de Indra: ¡Se divide! ' + finalDamage + ' daño adicional a ' + _fiRand, 'damage');
                    }
                }
                addLog('⚡ Flecha de Indra: Sasuke gana turno adicional', 'buff');
                if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _fiAtk ? _fiAtk.team : 'team1');
                renderCharacters(); renderSummons(); showContinueButton(); return;


            // ══════════════════════════════════════════════════════
            // VEGETA — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'rafagas_ki_vegeta') {
                // VEGETA — Ráfagas de Ki: 1 AOE + 50% triple
                const _rkV = gameState.characters[gameState.selectedCharacter];
                const _rkETeam = _rkV ? (_rkV.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_rkETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('💥 Ráfagas de Ki redirigido por Mega Provocación', 'damage');
                } else {
                    // Activar Jon Snow PRIMERO para que aplique EA, luego la pasiva de Vegeta la limpia
                    if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(gameState.selectedCharacter);
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _rkETeam || _c.isDead || _c.hp <= 0) continue;
                        // Pasiva Vegeta: elimina buffs (incluyendo EA temporal de Jon Snow) ANTES del daño
                        triggerVegetaPasiva(_n, gameState.selectedCharacter);
                        // Respetar EA permanente (pasiva) O buff Esquiva Area activo
                        const _hasEAPassive = _c.esquivaAreaPassive;
                        const _hasEABuff    = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'esquiva area'; });
                        if (_hasEAPassive || _hasEABuff) {
                            addLog('💨 ' + _n + ' es inmune al AOE (Esquiva Área)', 'buff');
                            continue;
                        }
                        let _rkDmg = finalDamage;
                        if (Math.random() < 0.50) { _rkDmg *= 3; addLog('💥 ¡Triple daño! Ráfagas de Ki en ' + _n, 'damage'); }
                        applyDamageWithShield(_n, _rkDmg, gameState.selectedCharacter);
                        // SSBlue Evo: +cargas del objetivo
                        if (_rkV && _rkV.vegetaForm === 'ssblue_evo') {
                            const _stolen = _c.charges || 0;
                            if (_stolen > 0) { _rkV.charges = Math.min(20, (_rkV.charges||0) + _stolen); addLog('💠 SS Blue Evo: Vegeta gana ' + _stolen + ' cargas de ' + _n, 'buff'); }
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _rkETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('💥 Ráfagas de Ki: 1 AOE completado', 'damage');

            } else if (ability.effect === 'big_bang_attack_vegeta') {
                // VEGETA — Big Bang Attack: 4 daño + Debilitar + Sangrado 3T
                triggerVegetaPasiva(targetName, gameState.selectedCharacter);
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyWeaken(targetName, 3);
                applyBleed(targetName, 3);
                addLog('💥 Big Bang Attack: ' + finalDamage + ' daño + Debilitar + Sangrado 3T a ' + targetName, 'damage');
                // SSBlue Evo: cargas del objetivo
                const _bbV = gameState.characters[gameState.selectedCharacter];
                const _bbTgt = gameState.characters[targetName];
                if (_bbV && _bbV.vegetaForm === 'ssblue_evo' && _bbTgt) {
                    const _stolen = _bbTgt.charges || 0;
                    if (_stolen > 0) { _bbV.charges = Math.min(20, (_bbV.charges||0) + _stolen); addLog('💠 SS Blue Evo: Vegeta gana ' + _stolen + ' cargas de ' + targetName, 'buff'); }
                }

            } else if (ability.effect === 'resplandor_final_vegeta') {
                // VEGETA — Resplandor Final: 10 daño; si elimina → 4 daño directo AOE
                const _rfV = gameState.characters[gameState.selectedCharacter];
                const _rfETeam = _rfV ? (_rfV.team === 'team1' ? 'team2' : 'team1') : 'team2';
                triggerVegetaPasiva(targetName, gameState.selectedCharacter);
                const _rfTgtBefore = gameState.characters[targetName];
                const _rfAlive = _rfTgtBefore && !_rfTgtBefore.isDead && _rfTgtBefore.hp > 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('💥 Resplandor Final: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _rfTgtAfter = gameState.characters[targetName];
                if (_rfAlive && _rfTgtAfter && (_rfTgtAfter.isDead || _rfTgtAfter.hp <= 0)) {
                    // Eliminó al objetivo → 4 daño directo AOE
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _rfETeam || _c.isDead || _c.hp <= 0) continue;
                        applyDamageWithShield(_n, 4, null); // daño directo
                        addLog('💥 Resplandor Final: 4 daño directo a ' + _n, 'damage');
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _rfETeam && _s.hp > 0) { _s.hp = Math.max(0, _s.hp - 4); if (_s.hp <= 0) { addLog('💀 ' + _s.name + ' eliminado (Resplandor Final)', 'damage'); delete gameState.summons[_sid]; } } }
                }

            } else if (ability.effect === 'explosion_final_vegeta') {
                // VEGETA — Explosión Final: daño base 5 + bonus por % HP al usar
                const _efV = gameState.characters[gameState.selectedCharacter];
                const _efETeam = _efV ? (_efV.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _efHP = _efV ? _efV.hp : 0;
                const _efMaxHP = _efV ? (_efV.maxHp || 20) : 20;
                const _efPct = _efMaxHP > 0 ? (_efHP / _efMaxHP) : 0;
                // Tabla de daño adicional por % HP
                let _efBonus = 0;
                if (_efPct > 0.89) _efBonus = 1;
                else if (_efPct > 0.59) _efBonus = 3;
                else if (_efPct > 0.29) _efBonus = 5;
                else if (_efPct > 0.09) _efBonus = 8;
                else if (_efPct > 0) _efBonus = 15;
                const _efDmg = 5 + _efBonus;
                // Eliminar a Vegeta ANTES de ejecutar el AOE
                if (_efV) {
                    _efV.hp = 0;
                    _efV.isDead = true;
                    _efV._vegetaRevivePending = 3;
                    addLog('💥 Explosión Final: Vegeta (' + Math.round(_efPct*100) + '% HP) → ' + _efDmg + ' daño AOE (5 base + ' + _efBonus + ' bonus)!', 'damage');
                }
                if (checkAndRedirectAOEMegaProv(_efETeam, _efDmg, gameState.selectedCharacter)) {
                    addLog('💥 Explosión Final redirigida por Mega Provocación', 'damage');
                } else {
                    // ── PASO 1: activar Jon Snow PRIMERO para que aplique EA ──
                    if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(gameState.selectedCharacter);
                    // ── PASO 2: por cada enemigo, limpiar buffs con pasiva de Vegeta ANTES del daño ──
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _efETeam || _c.isDead || _c.hp <= 0) continue;
                        // Pasiva Vegeta elimina todos los buffs (incluyendo EA aplicado por Jon Snow)
                        triggerVegetaPasiva(_n, gameState.selectedCharacter);
                        // Solo bloquear si tiene EA como pasiva permanente (no como buff temporal)
                        if (_c.esquivaAreaPassive) continue;
                        applyDamageWithShield(_n, _efDmg, gameState.selectedCharacter);
                        // SSBlue Evo: cargas del objetivo
                        if (_efV && _efV.vegetaForm === 'ssblue_evo') {
                            const _stolen = _c.charges || 0;
                            if (_stolen > 0) { _efV.charges = Math.min(20, (_efV.charges||0) + _stolen); addLog('💠 SS Blue Evo: Vegeta gana ' + _stolen + ' cargas de ' + _n, 'buff'); }
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _efETeam && _s.hp > 0) applySummonDamage(_sid, _efDmg, gameState.selectedCharacter); }
                }
                renderCharacters(); renderSummons();
                checkGameOver();

            // ══════════════════════════════════════════════════════
            // DOUMA — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'abanicos_hielo_douma') {
                // DOUMA — Abanicos de Hielo: 3 daño + 10% Megacongelacion
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('❄️ Abanicos de Hielo: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (Math.random() < 0.10) {
                    applyFreeze(targetName, 2, true); // Megacongelacion
                    addLog('🧊 Abanicos de Hielo: ¡Megacongelacion! a ' + targetName, 'debuff');
                }

            } else if (ability.effect === 'summon_douma_hielo') {
                // DOUMA — Estatua de Hielo: invoca Douma de Hielo
                const existingDH = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Douma de Hielo' && s.hp > 0; });
                if (existingDH) {
                    addLog('❌ Douma de Hielo ya está activa', 'info');
                    endTurn(); return;
                }
                summonShadow('Douma de Hielo', gameState.selectedCharacter);
                addLog('❄️ Douma invoca una Estatua de Hielo', 'buff');

            } else if (ability.effect === 'niebla_congelante_douma') {
                // DOUMA — Niebla Congelante: 5 AOE + crit garantizado si congelado + 50% aturdir
                const _ncD = gameState.characters[gameState.selectedCharacter];
                const _ncETeam = _ncD ? (_ncD.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_ncETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('❄️ Niebla Congelante redirigida', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ncETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        const _isFrozen = (_c.statusEffects||[]).some(function(e){
                            if (!e) return false; const _nn = normAccent(e.name||'');
                            return _nn === 'congelacion' || _nn === 'mega congelacion';
                        });
                        let _ncDmg = finalDamage;
                        if (_isFrozen) { _ncDmg *= 2; addLog('💥 Niebla Congelante: ¡Crítico! (congelado) ' + _n, 'damage'); }
                        applyDamageWithShield(_n, _ncDmg, gameState.selectedCharacter);
                        if (Math.random() < 0.50) { applyStun(_n, 1); addLog('❄️ Niebla Congelante: Aturdimiento a ' + _n, 'debuff'); }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _ncETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('❄️ Niebla Congelante: 5 AOE completado', 'damage');

            } else if (ability.effect === 'summon_gigante_hielo') {
                // DOUMA — Loto de Hielo Celestial: invoca Gigante de Hielo
                const existingGH = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Gigante de Hielo' && s.hp > 0; });
                if (existingGH) {
                    addLog('❌ Gigante de Hielo ya está activo', 'info');
                    endTurn(); return;
                }
                summonShadow('Gigante de Hielo', gameState.selectedCharacter);
                addLog('🧊 Douma invoca al Gigante de Hielo', 'buff');

            // ══════════════════════════════════════════════════════
            // JAINA PROUDMOORE — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'descarga_hielo_jaina') {
                // JAINA — Descarga de Hielo: 2 daño + Congelacion; si ya congelado → 50% triple
                const _dhTgt = gameState.characters[targetName];
                const _hadFreeze = _dhTgt && (_dhTgt.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'congelacion'; });
                let _dhDmg = finalDamage;
                if (_hadFreeze && Math.random() < 0.50) { _dhDmg *= 3; addLog('💥 Descarga de Hielo: ¡Triple daño! (ya congelado)', 'damage'); }
                applyDamageWithShield(targetName, _dhDmg, gameState.selectedCharacter);
                applyFreeze(targetName, 1);
                addLog('❄️ Descarga de Hielo: ' + _dhDmg + ' daño + Congelacion a ' + targetName, 'damage');

            } else if (ability.effect === 'anillo_escarcha_jaina') {
                // JAINA — Anillo de Escarcha: 2 AOE + Congelacion; si Congelado → Megacongelacion; si MegaCongelado → triple
                const _aeJ = gameState.characters[gameState.selectedCharacter];
                const _aeETeam = _aeJ ? (_aeJ.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_aeETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('❄️ Anillo de Escarcha redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _aeETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        const _hadCongelacion = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'congelacion'; });
                        const _hadMegaCongelacion = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'mega congelacion'; });
                        let _aeDmg = finalDamage;
                        if (_hadMegaCongelacion) { _aeDmg *= 3; addLog('💥 Anillo de Escarcha: ¡Triple! (Megacongelacion activa en ' + _n + ')', 'damage'); }
                        applyDamageWithShield(_n, _aeDmg, gameState.selectedCharacter);
                        if (_hadCongelacion && !_hadMegaCongelacion) {
                            // Reemplazar Congelacion por Megacongelacion
                            _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'congelacion'; });
                            applyFreeze(_n, 2, true);
                            addLog('🧊 Anillo de Escarcha: Congelacion → Megacongelacion en ' + _n, 'debuff');
                        } else if (!_hadCongelacion) {
                            applyFreeze(_n, 1);
                            addLog('❄️ Anillo de Escarcha: Congelacion a ' + _n, 'debuff');
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _aeETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('❄️ Anillo de Escarcha: 2 AOE completado', 'damage');

            } else if (ability.effect === 'bloque_hielo_jaina') {
                // JAINA — Bloque de Hielo: disipar debuffs aliados + Proteccion Sagrada 2T
                const _bjAtk = gameState.characters[gameState.selectedCharacter];
                const _bjTeam = _bjAtk ? _bjAtk.team : 'team1';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _bjTeam || _c.isDead || _c.hp <= 0) continue;
                    // Disipar debuffs
                    _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || e.type !== 'debuff'; });
                    // Proteccion Sagrada 2T
                    _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'proteccion sagrada'; });
                    _c.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '🛡️' });
                    addLog('🛡️ Bloque de Hielo: Debuffs disipados + Proteccion Sagrada 2T a ' + _n, 'buff');
                }

            } else if (ability.effect === 'invierno_jaina') {
                // JAINA — Invierno sin Remordimientos: 2 AOE + Megacongelacion; efectos según estado previo
                const _iwJ = gameState.characters[gameState.selectedCharacter];
                const _iwETeam = _iwJ ? (_iwJ.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_iwETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🧊 Invierno sin Remordimientos redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _iwETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        const _hadCong = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'congelacion'; });
                        const _hadMega = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'mega congelacion'; });
                        let _iwDmg = finalDamage;
                        if (_hadMega) {
                            _iwDmg *= 3;
                            _c.speed = Math.max(1, (_c.speed||80) - 20);
                            addLog('🧊 Invierno: ¡Triple daño! -20 vel permanente a ' + _n, 'debuff');
                        }
                        applyDamageWithShield(_n, _iwDmg, gameState.selectedCharacter);
                        if (_hadCong && !_hadMega) {
                            _c.charges = 0;
                            addLog('🧊 Invierno: Cargas a 0 (' + _n + ' tenía Congelacion)', 'debuff');
                        }
                        // Aplicar Megacongelacion a todos
                        _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || (normAccent(e.name||'') !== 'congelacion' && normAccent(e.name||'') !== 'mega congelacion'); });
                        applyFreeze(_n, 2, true);
                        addLog('🧊 Invierno sin Remordimientos: Megacongelacion a ' + _n, 'debuff');
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _iwETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('🧊 Invierno sin Remordimientos: 2 AOE completado', 'damage');

            // ══════════════════════════════════════════════════════
            // GAARA — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'garra_arena_gaara') {
                // GAARA — Garra de Arena: 2 daño + 50% Aturdimiento + 1 carga extra por debuff en objetivo
                const _gaAtk = gameState.characters[gameState.selectedCharacter];
                const _gaTgt = gameState.characters[targetName];
                const _gaDebuffs = _gaTgt ? (_gaTgt.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff'; }).length : 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🏜️ Garra de Arena: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_gaDebuffs > 0 && _gaAtk) {
                    _gaAtk.charges = Math.min(20, (_gaAtk.charges||0) + _gaDebuffs);
                    addLog('🏜️ Garra de Arena: +' + _gaDebuffs + ' cargas bonus por ' + _gaDebuffs + ' debuff(s) en ' + targetName, 'buff');
                }
                if (Math.random() < 0.50) {
                    applyStun(targetName, 1);
                    addLog('🏜️ Garra de Arena: Aturdimiento a ' + targetName + ' (50%)', 'debuff');
                }

            } else if (ability.effect === 'arenas_movedizas_gaara') {
                // GAARA — Arenas Movedizas: 2 AOE + -10% vel 3 rondas + si vel<=80 roba 2 cargas
                const _amAtk = gameState.characters[gameState.selectedCharacter];
                const _amETeam = _amAtk ? (_amAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_amETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🏜️ Arenas Movedizas redirigida', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _amETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        // -10% vel por 3 rondas
                        const _velRed = Math.max(1, Math.floor((_c.speed||80) * 0.10));
                        _c.speed = Math.max(1, (_c.speed||80) - _velRed);
                        _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || e.name !== 'Arena_VelDebuff'; });
                        _c.statusEffects.push({ name: 'Arena_VelDebuff', type: 'debuff', duration: 999, _roundsLeft: 3, emoji: '🏜️', _velRestored: _velRed, passiveHidden: true });
                        addLog('🏜️ Arenas Movedizas: ' + _n + ' pierde -' + _velRed + ' vel por 3 rondas', 'debuff');
                        // Si vel<=80 roba 2 cargas
                        if ((_c.speed||0) <= 80 && _amAtk) {
                            const _stolen = Math.min(2, _c.charges||0);
                            if (_stolen > 0) {
                                _amAtk.charges = Math.min(20, (_amAtk.charges||0) + _stolen);
                                _c.charges = Math.max(0, (_c.charges||0) - _stolen);
                                addLog('⚡ Arenas Movedizas: Gaara roba ' + _stolen + ' carga(s) de ' + _n + ' (vel ≤ 80)', 'buff');
                            }
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _amETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('🏜️ Arenas Movedizas: 2 AOE completado', 'damage');

            } else if (ability.effect === 'granizo_arena_gaara') {
                // GAARA — Granizo de Arena Imperial: 3 AOE, ignora EA y MegaProv, triple si vel<=70, 50% eliminar invocaciones sin pasiva
                const _grAtk = gameState.characters[gameState.selectedCharacter];
                const _grETeam = _grAtk ? (_grAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (typeof triggerElReyPrometido === 'function') triggerElReyPrometido(gameState.selectedCharacter);
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _grETeam || _c.isDead || _c.hp <= 0) continue;
                    let _grDmg = finalDamage;
                    if ((_c.speed||80) <= 70) {
                        _grDmg *= 3;
                        addLog('💥 Granizo Imperial: ¡Triple daño! en ' + _n + ' (vel=' + _c.speed + ' ≤ 70)', 'damage');
                    }
                    applyDamageWithShield(_n, _grDmg, gameState.selectedCharacter);
                }
                // Invocaciones enemigas: 50% de eliminarlas sin activar pasiva
                for (const _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (!_s || _s.team !== _grETeam || _s.hp <= 0) continue;
                    if (Math.random() < 0.50) {
                        addLog('🏜️ Granizo Imperial: elimina invocación ' + _s.name + ' sin activar pasiva (50%)', 'damage');
                        _s._skipDeathPassive = true;
                        applySummonDamage(_sid, _s.hp + 1, gameState.selectedCharacter);
                    } else {
                        applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                addLog('🏜️ Granizo de Arena Imperial: AOE completado (ignora EA/MegaProv)', 'damage');

            } else if (ability.effect === 'sabaku_taiso_gaara') {
                // GAARA — Sabaku Taisō: elimina al objetivo; revive con 50% HP y 0 cargas en 2 rondas
                const _stTgt = gameState.characters[targetName];
                if (_stTgt && !_stTgt.isDead && _stTgt.hp > 0) {
                    addLog('🏜️ Sabaku Taisō: Gaara aplasta a ' + targetName + ' — ¡eliminado!', 'damage');
                    _stTgt.hp = 0;
                    _stTgt.isDead = true;
                    _stTgt._sabakuRevivePending = 2;
                    _stTgt._sabakuReviveHp = Math.ceil(_stTgt.maxHp * 0.50);
                    addLog('⏳ Sabaku Taisō: ' + targetName + ' revivirá con ' + _stTgt._sabakuReviveHp + ' HP y 0 cargas en 2 rondas', 'info');
                }

                        // ══════════════════════════════════════════════════════
            // REY DE LA NOCHE — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'lanza_hielo_rdn') {
                // RDN — Lanza de Hielo: 1 daño. Si Prov/MegaProv/Sigilo: -5 vel. Si Congelado antes: -2 cargas. Si invocación: el equipo aliado la controla.
                const _lhAtk = gameState.characters[gameState.selectedCharacter];
                // Comprobar si el objetivo es una invocación
                const _lhSummon = (typeof targetName === 'string' && targetName.startsWith('__summon__:'))
                    ? gameState.summons[targetName.slice(11)] : null;
                if (_lhSummon) {
                    // Tomar control de la invocación
                    addLog('❄️ Lanza de Hielo: ¡El Rey de la Noche toma control de ' + _lhSummon.name + '!', 'buff');
                    _lhSummon.team = _lhAtk ? _lhAtk.team : 'team1';
                    _lhSummon.summoner = gameState.selectedCharacter;
                } else {
                    const _lhTgt = gameState.characters[targetName];
                    const _hadFreezeLH = _lhTgt && (_lhTgt.statusEffects||[]).some(function(e){
                        if (!e) return false; const _nn = normAccent(e.name||'');
                        return _nn === 'congelacion' || _nn === 'mega congelacion';
                    });
                    const _hasTauntLH = _lhTgt && (_lhTgt.statusEffects||[]).some(function(e){
                        if (!e) return false; const _nn = normAccent(e.name||'');
                        return _nn === 'provocacion' || _nn === 'megaprovocacion' || _nn === 'sigilo';
                    });
                    applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                    addLog('❄️ Lanza de Hielo: ' + finalDamage + ' daño a ' + targetName, 'damage');
                    if (_hasTauntLH && _lhTgt) {
                        _lhTgt.speed = Math.max(1, (_lhTgt.speed||80) - 5);
                        addLog('❄️ Lanza de Hielo: ' + targetName + ' pierde 5 vel (tenía Prov/MegaProv/Sigilo)', 'debuff');
                    }
                    if (_hadFreezeLH && _lhTgt) {
                        _lhTgt.charges = Math.max(0, (_lhTgt.charges||0) - 2);
                        addLog('❄️ Lanza de Hielo: ' + targetName + ' pierde 2 cargas (estaba congelado)', 'debuff');
                    }
                }

            } else if (ability.effect === 'tormenta_invernal_rdn') {
                // RDN — Tormenta Invernal: 2 AOE + Congelacion + 50% Posesion
                const _tiAtk = gameState.characters[gameState.selectedCharacter];
                const _tiETeam = _tiAtk ? (_tiAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_tiETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('❄️ Tormenta Invernal redirigida', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _tiETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        applyFreeze(_n, 1);
                        addLog('❄️ Tormenta Invernal: Congelacion a ' + _n, 'debuff');
                        if (Math.random() < 0.50) {
                            _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'posesion'; });
                            _c.statusEffects.push({ name: 'Posesion', type: 'debuff', duration: 1, emoji: '👁️' });
                            addLog('👁️ Tormenta Invernal: Posesion a ' + _n + ' (50%)', 'debuff');
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _tiETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                addLog('❄️ Tormenta Invernal: 2 AOE + Congelacion completado', 'damage');

            } else if (ability.effect === 'toque_muerte_rdn') {
                // RDN — Toque de la Muerte: 8 daño + Megacongelacion. Si muere → revive como aliado con 50% HP y 0 cargas.
                const _tdAtk = gameState.characters[gameState.selectedCharacter];
                const _tdTgt = gameState.characters[targetName];
                const _tdWasAlive = _tdTgt && !_tdTgt.isDead && _tdTgt.hp > 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (_tdTgt && !_tdTgt.isDead) {
                    applyFreeze(targetName, 2, true);
                    addLog('🧊 Toque de la Muerte: Megacongelacion a ' + targetName, 'debuff');
                }
                if (_tdWasAlive && _tdTgt && (_tdTgt.isDead || _tdTgt.hp <= 0)) {
                    // Revivir como aliado
                    _tdTgt.isDead = false;
                    _tdTgt.hp = Math.ceil(_tdTgt.maxHp * 0.50);
                    _tdTgt.charges = 0;
                    _tdTgt.statusEffects = [];
                    const _rdnTeam = _tdAtk ? _tdAtk.team : 'team1';
                    _tdTgt.team = _rdnTeam;
                    addLog('☠️ Toque de la Muerte: ¡' + targetName + ' revive como aliado del Rey de la Noche con ' + _tdTgt.hp + ' HP!', 'buff');
                    renderCharacters();
                }
                addLog('❄️ Toque de la Muerte: ' + finalDamage + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'frio_eterno_rdn') {
                // RDN — Frío Eterno: 5 AOE. Crit sobre Congelacion. Triple daño sobre Megacongelacion. Si muere → aliado 50% HP 0 cargas.
                const _feAtk = gameState.characters[gameState.selectedCharacter];
                const _feETeam = _feAtk ? (_feAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_feETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🧊 Frío Eterno redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _feETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        const _hadCongFE = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'congelacion'; });
                        const _hadMegaFE = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'mega congelacion'; });
                        let _feDmg = finalDamage;
                        if (_hadMegaFE) {
                            _feDmg *= 3;
                            addLog('🧊 Frío Eterno: ¡Triple daño! sobre ' + _n + ' (Megacongelacion)', 'damage');
                        } else if (_hadCongFE) {
                            _feDmg *= 2;
                            addLog('❄️ Frío Eterno: ¡Crítico! sobre ' + _n + ' (Congelacion)', 'damage');
                        }
                        const _feWasAlive = !_c.isDead && _c.hp > 0;
                        applyDamageWithShield(_n, _feDmg, gameState.selectedCharacter);
                        // Si muere → revivir como aliado
                        if (_feWasAlive && (_c.isDead || _c.hp <= 0) && _feAtk) {
                            _c.isDead = false;
                            _c.hp = Math.ceil(_c.maxHp * 0.50);
                            _c.charges = 0;
                            _c.statusEffects = [];
                            _c.team = _feAtk.team;
                            addLog('☠️ Frío Eterno: ¡' + _n + ' revive como aliado del Rey de la Noche con ' + _c.hp + ' HP!', 'buff');
                        }
                    }
                    for (const _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _feETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                    renderCharacters();
                }
                addLog('🧊 Frío Eterno: 5 AOE completado', 'damage');

            // ══════════════════════════════════════════════
            // DARKSEID — handlers
            // ══════════════════════════════════════════════

            } else if (ability.effect === 'toque_antivida_darkseid') {
                // DARKSEID — Toque de la Antivida: roba 0-4 HP y genera 0-4 cargas
                const _taAtk = gameState.characters[gameState.selectedCharacter];
                const _taTgt = gameState.characters[targetName];
                if (_taTgt && !_taTgt.isDead && _taTgt.hp > 0) {
                    const _taSteal = Math.floor(Math.random() * 5); // 0-4
                    const _taCharges = Math.floor(Math.random() * 5); // 0-4
                    if (_taSteal > 0) {
                        const _taActual = Math.min(_taSteal, _taTgt.hp);
                        _taTgt.hp = Math.max(0, _taTgt.hp - _taActual);
                        if (_taTgt.hp <= 0) _taTgt.isDead = true;
                        if (_taAtk) _taAtk.hp = Math.min(_taAtk.maxHp, (_taAtk.hp||0) + _taActual);
                        addLog('🔥 Toque de la Antivida: Darkseid roba ' + _taActual + ' HP de ' + targetName, 'heal');
                    }
                    if (_taCharges > 0 && _taAtk) {
                        _taAtk.charges = Math.min(20, (_taAtk.charges||0) + _taCharges);
                        addLog('🔥 Toque de la Antivida: +' + _taCharges + ' cargas adicionales', 'buff');
                    }
                    if (_taSteal === 0 && _taCharges === 0) addLog('🔥 Toque de la Antivida: sin efecto esta vez', 'info');
                }

            } else if (ability.effect === 'rayo_desintegracion_darkseid') {
                // DARKSEID — Rayo de la Desintegración: 3 daño + 50% crit → 2 cargas por cada enemigo
                const _rdAtk = gameState.characters[gameState.selectedCharacter];
                const _rdETeam = _rdAtk ? (_rdAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _isCrit = Math.random() < 0.50;
                let _rdDmg = finalDamage;
                if (_isCrit) {
                    _rdDmg *= 2;
                    addLog('💥 ¡Crítico! Rayo de la Desintegración en ' + targetName, 'damage');
                    // 2 cargas por cada enemigo (personajes + invocaciones)
                    const _enemyCount = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _rdETeam && !c.isDead && c.hp > 0;
                    }).length;
                    const _summonCount = Object.keys(gameState.summons).filter(function(sid){
                        const s = gameState.summons[sid]; return s && s.team === _rdETeam && s.hp > 0;
                    }).length;
                    const _rdCharges = (_enemyCount + _summonCount) * 2;
                    if (_rdAtk && _rdCharges > 0) {
                        _rdAtk.charges = Math.min(20, (_rdAtk.charges||0) + _rdCharges);
                        addLog('⚡ Rayo Desintegración: +' + _rdCharges + ' cargas (' + (_enemyCount + _summonCount) + ' enemigos)', 'buff');
                    }
                }
                applyDamageWithShield(targetName, _rdDmg, gameState.selectedCharacter);

            } else if (ability.effect === 'sancion_omega_darkseid') {
                // DARKSEID — Sanción Omega: elimina hasta 3 invocaciones + 3 daño directo por invocación a enemigo aleatorio
                const _soAtk = gameState.characters[gameState.selectedCharacter];
                const _soETeam = _soAtk ? (_soAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _soSummonIds = Object.keys(gameState.summons).filter(function(sid){
                    const s = gameState.summons[sid]; return s && s.team === _soETeam && s.hp > 0;
                }).slice(0, 3);
                let _soTotalDmg = 0;
                _soSummonIds.forEach(function(sid) {
                    const _s = gameState.summons[sid];
                    addLog('⚡ Sanción Omega: elimina invocación ' + _s.name, 'damage');
                    _s._skipDeathPassive = true;
                    delete gameState.summons[sid];
                    _soTotalDmg += 3;
                });
                if (_soTotalDmg > 0) {
                    const _soAliveEnemies = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _soETeam && !c.isDead && c.hp > 0;
                    });
                    if (_soAliveEnemies.length > 0) {
                        const _soRandTarget = _soAliveEnemies[Math.floor(Math.random() * _soAliveEnemies.length)];
                        const _soTgt = gameState.characters[_soRandTarget];
                        _soTgt.hp = Math.max(0, (_soTgt.hp||0) - _soTotalDmg);
                        if (_soTgt.hp <= 0) _soTgt.isDead = true;
                        addLog('⚡ Sanción Omega: ' + _soTotalDmg + ' daño directo a ' + _soRandTarget + ' (' + _soSummonIds.length + ' invocaciones)', 'damage');
                    }
                } else {
                    addLog('⚡ Sanción Omega: no hay invocaciones enemigas', 'info');
                }

            } else if (ability.effect === 'ecuacion_antivida_darkseid') {
                // DARKSEID — Ecuación de la Antivida: reduce 50%-90% HP + lifesteal
                const _eaAtk = gameState.characters[gameState.selectedCharacter];
                const _eaTgt = gameState.characters[targetName];
                if (_eaTgt && !_eaTgt.isDead && _eaTgt.hp > 0 && _eaAtk) {
                    const _eaPct = 0.50 + Math.random() * 0.40; // 50-90%
                    const _eaLost = Math.ceil(_eaTgt.hp * _eaPct);
                    _eaTgt.hp = Math.max(0, _eaTgt.hp - _eaLost);
                    if (_eaTgt.hp <= 0) _eaTgt.isDead = true;
                    _eaAtk.hp = Math.min(_eaAtk.maxHp, (_eaAtk.hp||0) + _eaLost);
                    addLog('🔥 Ecuación de la Antivida: ' + targetName + ' pierde ' + _eaLost + ' HP (' + Math.round(_eaPct*100) + '%), Darkseid recupera ' + _eaLost + ' HP', 'heal');
                }

            // ══════════════════════════════════════════════
            // ESCANOR — handlers
            // ══════════════════════════════════════════════

            } else if (ability.effect === 'cruel_sun_escanor') {
                // ESCANOR — Cruel Sun: 2 daño + QS 2T. Si ya tenía QS, aplica QS a 2 enemigos aleatorios más
                const _csAtk = gameState.characters[gameState.selectedCharacter];
                const _csETeam = _csAtk ? (_csAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _csTgt = gameState.characters[targetName];
                const _hadQS = _csTgt && hasStatusEffect(targetName, 'Quemadura Solar');
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applySolarBurn(targetName, 2, 2);
                if (_hadQS) {
                    // Aplicar QS a 2 enemigos aleatorios adicionales
                    const _otherEnemies = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n];
                        return c && c.team === _csETeam && !c.isDead && c.hp > 0 && n !== targetName;
                    });
                    for (let _i = 0; _i < Math.min(2, _otherEnemies.length); _i++) {
                        const _idx = Math.floor(Math.random() * _otherEnemies.length);
                        const _extra = _otherEnemies.splice(_idx, 1)[0];
                        applySolarBurn(_extra, 2, 2);
                        addLog('☀️ Cruel Sun: QS extendida a ' + _extra + ' (objetivo ya tenía QS)', 'debuff');
                    }
                }
                // Pasiva Orgullo del León: 50% ganar 1 carga al aplicar QS
                if (_csAtk && Math.random() < 0.50) {
                    _csAtk.charges = Math.min(20, (_csAtk.charges||0) + 1);
                    addLog('🦁 Orgullo del León: Escanor gana 1 carga (QS aplicada)', 'buff');
                }

            } else if (ability.effect === 'pride_flare_escanor') {
                // ESCANOR — Pride Flare: 3 daño + daño directo x QS activas a 3 aleatorios + cargas x QS
                const _pfAtk = gameState.characters[gameState.selectedCharacter];
                const _pfETeam = _pfAtk ? (_pfAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                // Contar QS activas en equipo enemigo
                const _qsCount = Object.keys(gameState.characters).filter(function(n){
                    const c = gameState.characters[n];
                    return c && c.team === _pfETeam && !c.isDead && c.hp > 0 && hasStatusEffect(n, 'Quemadura Solar');
                }).length;
                if (_qsCount > 0) {
                    // +1 daño directo a 3 enemigos aleatorios por cada QS
                    const _pfEnemies = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _pfETeam && !c.isDead && c.hp > 0;
                    });
                    const _pfTargets = _pfEnemies.sort(function(){ return Math.random()-0.5; }).slice(0, 3);
                    _pfTargets.forEach(function(n){
                        applyDamageWithShield(n, _qsCount, gameState.selectedCharacter);
                        addLog('☀️ Pride Flare: ' + _qsCount + ' daño directo a ' + n + ' (' + _qsCount + ' QS activas)', 'damage');
                    });
                    // +3 cargas por cada QS
                    if (_pfAtk) {
                        _pfAtk.charges = Math.min(20, (_pfAtk.charges||0) + (_qsCount * 3));
                        addLog('☀️ Pride Flare: +' + (_qsCount*3) + ' cargas (' + _qsCount + ' QS activas)', 'buff');
                    }
                }

            } else if (ability.effect === 'the_one_escanor') {
                // ESCANOR — The One: transforma 2 rondas, +50% HP, -50% daño recibido, absorbe daño de aliados
                const _toAtk = gameState.characters[gameState.selectedCharacter];
                if (_toAtk) {
                    _toAtk.escanorTheOneActive = true;
                    _toAtk.escanorTheOneRoundsLeft = 2;
                    if (_toAtk.transformPortrait) _toAtk.portrait = _toAtk.transformPortrait;
                    const _toHeal = Math.ceil(_toAtk.maxHp * 0.50);
                    _toAtk.hp = Math.min(_toAtk.maxHp, (_toAtk.hp||0) + _toHeal);
                    addLog('🌟 The One: Escanor se transforma por 2 rondas. Recupera ' + _toHeal + ' HP. -50% daño recibido. Absorbe daño de aliados.', 'buff');
                    audioManager.playTransformSfx();
                    if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700);
                    if (typeof _triggerPowerUp === 'function') { const _pu = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _pu ? _pu.team : 'team1'); }
                }

            } else if (ability.effect === 'final_prominence_escanor') {
                // ESCANOR — Final Prominence: +5 HP luego causa 5 + HP actual de Escanor. 50% del daño a 2 aleatorios
                const _fpAtk = gameState.characters[gameState.selectedCharacter];
                const _fpETeam = _fpAtk ? (_fpAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (_fpAtk) {
                    _fpAtk.hp = Math.min(_fpAtk.maxHp, (_fpAtk.hp||0) + 5);
                    addLog('🌟 Final Prominence: Escanor recupera 5 HP (' + _fpAtk.hp + '/' + _fpAtk.maxHp + ')', 'heal');
                    const _fpDmg = finalDamage + (_fpAtk.hp||0);
                    applyDamageWithShield(targetName, _fpDmg, gameState.selectedCharacter);
                    addLog('🌟 Final Prominence: ' + _fpDmg + ' daño a ' + targetName + ' (5 + ' + _fpAtk.hp + ' HP de Escanor)', 'damage');
                    // 50% del daño sobre 2 enemigos aleatorios
                    const _fpSplash = Math.ceil(_fpDmg * 0.50);
                    const _fpOthers = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n];
                        return c && c.team === _fpETeam && !c.isDead && c.hp > 0 && n !== targetName;
                    }).sort(function(){ return Math.random()-0.5; }).slice(0,2);
                    _fpOthers.forEach(function(n){
                        applyDamageWithShield(n, _fpSplash, gameState.selectedCharacter);
                        addLog('🌟 Final Prominence: ' + _fpSplash + ' daño adicional a ' + n + ' (50%)', 'damage');
                    });
                }

            // ══════════════════════════════════════════════
            // YORICHI — handlers
            // ══════════════════════════════════════════════

            } else if (ability.effect === 'corte_solar_yorichi') {
                // YORICHI — Corte Solar: 2 daño + 50% QS. Si ya tenía QS, crit 100%
                const _cyAtk = gameState.characters[gameState.selectedCharacter];
                const _cyTgt = gameState.characters[targetName];
                const _cyHadQS = _cyTgt && hasStatusEffect(targetName, 'Quemadura Solar');
                // MUNDO TRANSPARENTE: crit 100% si objetivo tiene QS
                let _cyDmg = finalDamage;
                if (_cyHadQS) {
                    _cyDmg *= 2;
                    gameState._isCritHit = true;
                    addLog('🌅 Mundo Transparente: ¡Crítico 100%! Yorichi golpea objetivo con QS', 'buff');
                }
                applyDamageWithShield(targetName, _cyDmg, gameState.selectedCharacter);
                // MUNDO TRANSPARENTE: aplicar debuff Silenciar si objetivo tiene QS
                if (_cyHadQS && _cyTgt && !_cyTgt.isDead && _cyTgt.hp > 0) {
                    if (typeof applySilenciar === 'function') {
                        applySilenciar(targetName, 2);
                        addLog('🌅 Mundo Transparente: ' + targetName + ' recibe Silenciar 2T (tenía QS)', 'debuff');
                    }
                }
                // 50% de aplicar QS si no tenía
                if (Math.random() < 0.50) {
                    applySolarBurn(targetName, 2, 2);
                }
                // Si objetivo tenía QS: Yorichi gana 2 cargas y cura 2 HP a aliado aleatorio
                if (_cyHadQS && _cyAtk) {
                    _cyAtk.charges = Math.min(20, (_cyAtk.charges||0) + 2);
                    addLog('🌅 Mundo Transparente: Yorichi gana 2 cargas (objetivo tenía QS)', 'buff');
                    const _cyAllyTeam = _cyAtk.team;
                    const _cyAllies = Object.keys(gameState.characters).filter(function(n){
                        const _c = gameState.characters[n];
                        return _c && _c.team === _cyAllyTeam && !_c.isDead && _c.hp > 0;
                    });
                    if (_cyAllies.length > 0) {
                        const _cyHealTarget = _cyAllies[Math.floor(Math.random() * _cyAllies.length)];
                        if (typeof applyHeal === 'function') {
                            applyHeal(_cyHealTarget, 2, 'Mundo Transparente');
                        } else if (typeof canHeal === 'function' ? canHeal(_cyHealTarget) : true) {
                            gameState.characters[_cyHealTarget].hp = Math.min(
                                gameState.characters[_cyHealTarget].maxHp,
                                gameState.characters[_cyHealTarget].hp + 2
                            );
                            addLog('🌅 Mundo Transparente: ' + _cyHealTarget + ' cura 2 HP', 'heal');
                        }
                    }
                }

            } else if (ability.effect === 'respiracion_solar_yorichi') {
                // YORICHI — Respiración Solar Pura: ANTES de golpear disipar buffs, luego 2 AOE + Quemadura 2HP
                const _rsAtk = gameState.characters[gameState.selectedCharacter];
                const _rsETeam = _rsAtk ? (_rsAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // PASO 1: Disipar todos los buffs ANTES de golpear
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _rsETeam || _c.isDead || _c.hp <= 0) continue;
                    const _buffs = (_c.statusEffects||[]).filter(function(e){ return e && e.type === 'buff' && !e.permanent && !e.passiveHidden; });
                    if (_buffs.length > 0) {
                        _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || e.type !== 'buff' || e.permanent || e.passiveHidden; });
                        addLog('🌅 Respiración Solar: ' + _buffs.length + ' buff(s) disipados de ' + _n + ' (antes de golpear)', 'debuff');
                    }
                }
                // PASO 2: AOE + Quemadura
                if (checkAndRedirectAOEMegaProv(_rsETeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🌅 Respiración Solar redirigida', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _rsETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' esquiva (EA)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        applyFlatBurn(_n, 2, 2);
                    }
                }
                addLog('🌅 Respiración Solar Pura: buffs disipados + 2 AOE + Quemadura 2HP completado', 'damage');

            } else if (ability.effect === 'diosa_sol_yorichi') {
                // YORICHI — Diosa del Sol: 6 ataques básicos con todos sus efectos (QS, Silenciar, cargas, crit)
                const _dsAtk = gameState.characters[gameState.selectedCharacter];
                const _dsETeam = _dsAtk ? (_dsAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _dsBasic = (_dsAtk.abilities||[]).find(function(ab){ return ab && ab.type === 'basic'; });
                const _dsDmgBase = _dsBasic ? (_dsBasic.damage || 2) : 2;
                for (let _di = 0; _di < 6; _di++) {
                    const _dsEnemies = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _dsETeam && !c.isDead && c.hp > 0;
                    });
                    if (_dsEnemies.length === 0) break;
                    const _dsRand = _dsEnemies[Math.floor(Math.random() * _dsEnemies.length)];
                    const _dsTgt = gameState.characters[_dsRand];
                    const _hadQSDs = hasStatusEffect(_dsRand, 'Quemadura Solar');
                    // Crit 100% si objetivo tiene QS (Mundo Transparente)
                    let _dsHitDmg = _dsDmgBase;
                    if (_hadQSDs) {
                        _dsHitDmg *= 2;
                        addLog('🌅 Mundo Transparente: ¡Crítico! golpe ' + (_di+1) + ' en ' + _dsRand + ' (QS)', 'buff');
                    }
                    applyDamageWithShield(_dsRand, _dsHitDmg, gameState.selectedCharacter);
                    // 50% de aplicar QS
                    if (Math.random() < 0.50) {
                        applySolarBurn(_dsRand, 2, 2);
                    }
                    // Si tenía QS: aplicar Silenciar
                    if (_hadQSDs && _dsTgt && !_dsTgt.isDead && _dsTgt.hp > 0) {
                        if (typeof applySilenciar === 'function') applySilenciar(_dsRand, 2);
                    }
                    // Generar cargas del básico
                    if (_dsBasic && (_dsBasic.chargeGain||0) > 0) {
                        _dsAtk.charges = Math.min(20, (_dsAtk.charges||0) + (_dsBasic.chargeGain||1));
                    }
                }
                addLog('🌅 Diosa del Sol: 6 ataques básicos completados', 'damage');

            } else if (ability.effect === 'trece_formas_sol_yorichi') {
                // YORICHI — Las Trece Formas del Sol: 13 daño. Si tenía QS: +12 cargas + turno adicional
                const _tfAtk = gameState.characters[gameState.selectedCharacter];
                const _tfTgt = gameState.characters[targetName];
                const _tfHadQS = _tfTgt && hasStatusEffect(targetName, 'Quemadura Solar');
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('☀️ Las Trece Formas del Sol: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_tfHadQS && _tfAtk) {
                    _tfAtk.charges = Math.min(20, (_tfAtk.charges||0) + 6);
                    addLog('☀️ Las Trece Formas: ¡QS activa! +6 cargas + turno adicional', 'buff');
                    triggerAnticipacion(gameState.selectedCharacter, _tfAtk.team);
                    renderCharacters(); renderSummons();
                    showContinueButton();
                    return;
                }

            // ══════════════════════════════════════════════
            // MARIK ISHTAR — handlers
            // ══════════════════════════════════════════════

            } else if (ability.effect === 'orden_cuidatumba_marik') {
                // MARIK — Orden de los Cuidatumba: 1 daño (+7 a invocaciones, ya aplicado en finalDamage)
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('💀 Orden de los Cuidatumba: ' + finalDamage + ' daño a ' + targetName + (finalDamage > 1 ? ' (incluye +7 vs invocación)' : ''), 'damage');

            } else if (ability.effect === 'canto_sol_marik') {
                // MARIK — Canto del Sol: invoca Huevo del Sol en el equipo enemigo
                const _cantAtk = gameState.characters[gameState.selectedCharacter];
                const _cantETeam = _cantAtk ? (_cantAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Bloquear si el Huevo del Sol ya está activo en el equipo enemigo
                const _huesoActivo = Object.values(gameState.summons||{}).some(function(s){
                    return s && s.hp > 0 && (s.name === 'Huevo del Sol' || s.name === 'Huevo del Ra') && s.team === _cantETeam;
                });
                if (_huesoActivo) {
                    addLog('🌞 Canto del Sol: el Huevo del Sol ya está activo en el campo enemigo', 'info');
                    endTurn(); return;
                }
                const _cantId = 'huevo_sol_' + Date.now();
                gameState.summons[_cantId] = Object.assign({}, summonData['Huevo del Sol'] || {
                    name: 'Huevo del Sol', hp: 20, maxHp: 20, statusEffects: [],
                    img: 'https://i.ibb.co/9mv8MDbJ/Whats-App-Image-2026-04-14-at-2-56-01-PM.jpg'
                });
                gameState.summons[_cantId].team = _cantETeam;
                gameState.summons[_cantId].summoner = gameState.selectedCharacter;
                if (typeof registerSummon === 'function') registerSummon(gameState.selectedCharacter);
                gameState.summons[_cantId].id = _cantId;
                addLog('🌞 Canto del Sol: ¡Huevo del Sol invocado en el equipo enemigo!', 'buff');
                if (typeof registerSummon === 'function') registerSummon(gameState.selectedCharacter);
                if (typeof renderSummons === 'function') renderSummons();

            } else if (ability.effect === 'profecia_faraon_marik') {
                // MARIK — Profecia del Faraon: 4 AOE + QS + bonus por invocaciones activas
                const _pfAtk = gameState.characters[gameState.selectedCharacter];
                const _pfETeam = _pfAtk ? (_pfAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Contar invocaciones activas en ambos equipos
                const _pfSummons = Object.values(gameState.summons||{}).filter(function(s){ return s && s.hp > 0; }).length;
                const _pfDmg = finalDamage + _pfSummons;
                addLog('🌞 Profecia del Faraon: ' + _pfDmg + ' daño (' + finalDamage + ' base +' + _pfSummons + ' por invocaciones)', 'info');
                if (checkAndRedirectAOEMegaProv(_pfETeam, _pfDmg, gameState.selectedCharacter)) {
                    addLog('🌞 Profecia del Faraon redirigida por MegaProvocacion', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _pfETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, _pfDmg, gameState.selectedCharacter);
                        applySolarBurn(_n, 2, 2);
                    }
                }
                addLog('🌞 Profecia del Faraon: AOE + Quemadura Solar completado', 'damage');

            // Backward compat: dios_dioses_marik no se usa pero mantener por si hay saves
            } else if (ability.effect === 'dios_dioses_marik') {
                addLog('💀 Dios de Dioses ya no está disponible — usa Profecia del Faraon', 'info');

            } else if (ability.effect === 'inmortal_fenix_marik') {
                // MARIK — Inmortal Fénix: requiere Dragon de Ra, lo elimina e invoca Dragon Modo Fénix
                const _ifAtk = gameState.characters[gameState.selectedCharacter];
                const _ifMyTeam = _ifAtk ? _ifAtk.team : 'team1';
                const _ifDragonId = Object.keys(gameState.summons).find(function(sid){
                    const s = gameState.summons[sid];
                    return s && s.team === _ifMyTeam && s.hp > 0 && s.name === 'Dragon Alado de Ra';
                });
                if (!_ifDragonId) {
                    addLog('🐉 Inmortal Fénix: se necesita al Dragon Alado de Ra en campo', 'info');
                    renderCharacters(); endTurn(); return;
                }
                delete gameState.summons[_ifDragonId];
                const _fenixId = 'dragon_fenix_' + Date.now();
                gameState.summons[_fenixId] = Object.assign({}, summonData['Ra Modo Fenix'] || {
                    name: 'Ra Modo Fenix', hp: 40, maxHp: 40, statusEffects: [],
                    img: 'https://i.ibb.co/xSxps7gW/Captura-de-pantalla-2026-04-14-174255.png'
                });
                gameState.summons[_fenixId].team = _ifMyTeam;
                gameState.summons[_fenixId].summoner = gameState.selectedCharacter;
                if (typeof registerSummon === 'function') registerSummon(gameState.selectedCharacter);
                gameState.summons[_fenixId].id = _fenixId;
                addLog('🔥 ¡Inmortal Fénix! Dragon Alado de Ra Modo Fénix invocado', 'buff');
                if (typeof registerSummon === 'function') registerSummon(gameState.selectedCharacter);
                if (typeof renderSummons === 'function') renderSummons();

                        } else if (ability.effect === 'vals_tanjiro') {
                // TANJIRO — Básico: daño + 50% de generar 1 carga al equipo aliado (Olor de la Brecha)
                const _tjAtk = gameState.characters[gameState.selectedCharacter];
                let _tjDmg = finalDamage;
                applyDamageWithShield(targetName, _tjDmg, gameState.selectedCharacter);
                addLog('🌊 Vals: ' + _tjDmg + ' daño a ' + targetName, 'damage');
                // Olor de la Brecha: siempre intentar 50% — activo independientemente de si el golpe fue esquivado
                if (_tjAtk) {
                    if (Math.random() < 0.50) {
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _tjAtk.team) continue;
                            _alc.charges = Math.min(20, (_alc.charges || 0) + 1);
                        }
                        addLog('🌊 Olor de la Brecha: +1 carga al equipo aliado (50%)', 'buff');
                    }
                }

            } else if (ability.effect === 'cascada_agua_tanjiro') {
                // TANJIRO — Cascada de Agua: 2 AOE + 50% robar 1 carga de cada objetivo
                const _caAtk = gameState.characters[gameState.selectedCharacter];
                const _caTeam = _caAtk ? (_caAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_caTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🌊 Cascada de Agua redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _caTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('💨 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        // 50% robar 1 carga del objetivo
                        if (Math.random() < 0.50 && _c.charges > 0 && _caAtk) {
                            _c.charges = Math.max(0, (_c.charges||0) - 1);
                            _caAtk.charges = Math.min(20, (_caAtk.charges||0) + 1);
                            addLog('🌊 Cascada de Agua: roba 1 carga de ' + _n + ' (50%)', 'buff');
                        }
                    }
                    for (let _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (_s && _s.team === _caTeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                addLog('🌊 Cascada de Agua: ' + finalDamage + ' AOE', 'damage');

            } else if (ability.effect === 'danza_fuego_tanjiro') {
                // TANJIRO — Danza del Dios del Fuego: 5 ataques básicos
                // Cada golpe aplica daño, efectos y chargeGain del básico + activa Olor de la Brecha (50%)
                const _dfAtk = gameState.characters[gameState.selectedCharacter];
                const _dfEnemyTeam = _dfAtk ? (_dfAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _dfBasic = (_dfAtk && _dfAtk.abilities) ? _dfAtk.abilities[0] : null;
                const _dfBasicDmg = _dfBasic ? (_dfBasic.damage || 1) : 1;
                const _dfBasicCg = _dfBasic ? (_dfBasic.chargeGain || 0) : 0;
                for (let _i = 0; _i < 5; _i++) {
                    const _alive = Object.keys(gameState.characters).filter(function(n) {
                        const c = gameState.characters[n]; return c && c.team === _dfEnemyTeam && !c.isDead && c.hp > 0;
                    });
                    if (_alive.length === 0) break;
                    const _tgt = _alive[Math.floor(Math.random() * _alive.length)];
                    applyDamageWithShield(_tgt, _dfBasicDmg, gameState.selectedCharacter);
                    addLog('🔥 Danza del Fuego golpe ' + (_i+1) + ': ' + _dfBasicDmg + ' daño a ' + _tgt, 'damage');
                    // Chargesgain del básico por cada golpe
                    if (_dfBasicCg > 0 && _dfAtk) {
                        _dfAtk.charges = Math.min(20, (_dfAtk.charges||0) + _dfBasicCg);
                    }
                    // Olor de la Brecha: 50% genera 1 carga al equipo aliado por cada golpe acertado
                    if (_dfAtk && Math.random() < 0.50) {
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _dfAtk.team) continue;
                            _alc.charges = Math.min(20, (_alc.charges||0) + 1);
                        }
                        addLog('🌊 Olor de la Brecha (golpe ' + (_i+1) + '): +1 carga al equipo aliado', 'buff');
                    }
                }

            } else if (ability.effect === 'decimotercera_tanjiro') {
                // TANJIRO — Decimotercera Postura: 13 ataques básicos aleatorios
                // Cada golpe aplica daño + chargeGain del básico + Olor de la Brecha (50%) + 50% -1 carga al objetivo
                const _dpAtk = gameState.characters[gameState.selectedCharacter];
                const _dpEnemyTeam = _dpAtk ? (_dpAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _dpBasic = (_dpAtk && _dpAtk.abilities) ? _dpAtk.abilities[0] : null;
                const _dpBasicDmg = _dpBasic ? (_dpBasic.damage || 1) : 1;
                const _dpBasicCg = _dpBasic ? (_dpBasic.chargeGain || 0) : 0;
                for (let _i = 0; _i < 13; _i++) {
                    const _alive = Object.keys(gameState.characters).filter(function(n) {
                        const c = gameState.characters[n]; return c && c.team === _dpEnemyTeam && !c.isDead && c.hp > 0;
                    });
                    if (_alive.length === 0) break;
                    const _tgt = _alive[Math.floor(Math.random() * _alive.length)];
                    const _tgtChar = gameState.characters[_tgt];
                    applyDamageWithShield(_tgt, _dpBasicDmg, gameState.selectedCharacter);
                    addLog('🌊 Decimotercera Postura golpe ' + (_i+1) + ': ' + _dpBasicDmg + ' daño a ' + _tgt, 'damage');
                    // ChargeGain del básico por cada golpe
                    if (_dpBasicCg > 0 && _dpAtk) {
                        _dpAtk.charges = Math.min(20, (_dpAtk.charges||0) + _dpBasicCg);
                    }
                    // 50% -1 carga al objetivo
                    if (_tgtChar && !_tgtChar.isDead && Math.random() < 0.50 && _tgtChar.charges > 0) {
                        _tgtChar.charges = Math.max(0, _tgtChar.charges - 1);
                        addLog('⚡ Decimotercera Postura: ' + _tgt + ' pierde 1 carga', 'damage');
                    }
                    // Olor de la Brecha: 50% genera 1 carga al equipo aliado por cada golpe
                    if (_dpAtk && Math.random() < 0.50) {
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _dpAtk.team) continue;
                            _alc.charges = Math.min(20, (_alc.charges||0) + 1);
                        }
                        addLog('🌊 Olor de la Brecha (golpe ' + (_i+1) + '): +1 carga al equipo aliado', 'buff');
                    }
                }
                addLog('🌊 Decimotercera Postura: 13 golpes completados', 'damage');
            } else if (ability.effect === 'ryusui_garou') {
                // GAROU — Ryusui Gansai-ken: 2 dmg + Garou se aplica Veneno 2T + Infectar 2T
                const _rgAtk = gameState.characters[gameState.selectedCharacter];
                // Check passive: double damage if Garou has poison/burn/bleed
                let _rgDmg = finalDamage;
                if (_rgAtk) {
                    const _rgHasDoT = (_rgAtk.statusEffects||[]).some(function(e) {
                        const n = normAccent(e && e.name||'').toLowerCase();
                        return n.includes('veneno') || n.includes('quemadura') || n.includes('sangrado');
                    });
                    if (_rgHasDoT) {
                        _rgDmg *= 2;
                        addLog('💪 Cazador de Héroes: ¡Daño doble por DoT activo!', 'buff');
                    }
                    // Saitama Mode bonus
                    if (_rgAtk.garouSaitamaMode) _rgDmg += 2;
                }
                applyDamageWithShield(targetName, _rgDmg, gameState.selectedCharacter);
                // Garou self-applies Veneno 2T and Infectar 2T
                applyDebuff(gameState.selectedCharacter, { name: 'Veneno', type: 'debuff', duration: 2, emoji: '☠️' });
                applyBuff(gameState.selectedCharacter, { name: 'Infectar', type: 'buff', duration: 2, emoji: '🦠', description: 'Infectar: golpes aplican Veneno al atacante' });
                addLog('🐆 Ryusui: ' + _rgDmg + ' daño + Veneno 2T + Infectar 2T sobre ' + gameState.selectedCharacter, 'buff');

            } else if (ability.effect === 'cross_fang_garou') {
                // GAROU — Cross Fang: 4 dmg + 2 per dead char
                const _cfAtk = gameState.characters[gameState.selectedCharacter];
                const _cfDeadCount = Object.values(gameState.characters).filter(function(c) { return c && c.isDead; }).length;
                let _cfDmg = finalDamage + _cfDeadCount * 2;
                if (_cfAtk) {
                    const _cfHasDoT = (_cfAtk.statusEffects||[]).some(function(e) {
                        const n = normAccent(e && e.name||'').toLowerCase();
                        return n.includes('veneno') || n.includes('quemadura') || n.includes('sangrado');
                    });
                    if (_cfHasDoT) { _cfDmg *= 2; addLog('💪 Cazador de Héroes: ¡Daño doble por DoT activo!', 'buff'); }
                    if (_cfAtk.garouSaitamaMode) _cfDmg += 2;
                }
                applyDamageWithShield(targetName, _cfDmg, gameState.selectedCharacter);
                addLog('🐉 Cross Fang: ' + _cfDmg + ' daño (' + finalDamage + ' base + ' + (_cfDeadCount*2) + ' por ' + _cfDeadCount + ' derrotados)', 'damage');

            } else if (ability.effect === 'gamma_ray_garou') {
                // GAROU — Gamma Ray Burst: 2 AOE + 1 per target's charges
                const _grAtk = gameState.characters[gameState.selectedCharacter];
                const _grTeam = _grAtk ? (_grAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _grHasDoT = _grAtk && (_grAtk.statusEffects||[]).some(function(e) {
                    const n = normAccent(e && e.name||'').toLowerCase();
                    return n.includes('veneno') || n.includes('quemadura') || n.includes('sangrado');
                });
                if (checkAndRedirectAOEMegaProv(_grTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🐉 Gamma Ray redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _grTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        let _grDmg = finalDamage + (_c.charges || 0);
                        if (_grHasDoT) { _grDmg *= 2; }
                        if (_grAtk && _grAtk.garouSaitamaMode) _grDmg += 2;
                        applyDamageWithShield(_n, _grDmg, gameState.selectedCharacter);
                applyAOEToSummons(_grTeam, finalDamage, gameState.selectedCharacter);
                        addLog('☢️ Gamma Ray: ' + _grDmg + ' daño a ' + _n, 'damage');
                    }
                }

            } else if (ability.effect === 'saitama_mode_garou') {
                // GAROU — Saitama Mode: transformación permanente
                const _smGarou = gameState.characters[gameState.selectedCharacter];
                if (_smGarou) {
                    _smGarou.garouSaitamaMode = true;
                    ability.used = true;
                    if (_smGarou.transformPortrait) _smGarou.portrait = _smGarou.transformPortrait;
                    audioManager.playTransformSfx(); if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700); if (typeof _triggerPowerUp === 'function') { const _puChar = gameState.characters[gameState.selectedCharacter]; _triggerPowerUp(gameState.selectedCharacter, _puChar ? _puChar.team : 'team1'); }
                    addLog('💪 ¡SAITAMA MODE! ' + gameState.selectedCharacter + ' activa -2 daño recibido y +2 daño en todos los ataques permanente', 'buff');
                }
            } else if (ability.effect === 'golpe_serio_saitama') {
                // SAITAMA — Golpe Serio: 6 dmg, triple if target has Prov or MegaProv
                const _gsTgt = gameState.characters[targetName];
                let _gsDmg = finalDamage;
                const _gsHasProv = _gsTgt && (_gsTgt.statusEffects||[]).some(function(e){
                    return e && (normAccent(e.name||'') === 'provocacion' || normAccent(e.name||'') === 'megaprovocacion');
                });
                const _gsHasMegaProv = typeof checkKamishMegaProvocation === 'function' &&
                    checkKamishMegaProvocation(_gsTgt ? _gsTgt.team : 'team2');
                if (_gsHasProv || _gsHasMegaProv) {
                    _gsDmg *= 3;
                    addLog('💥 Golpe Serio: ¡DAÑO TRIPLE por Provocación!', 'damage');
                } else if (Math.random() < 0.50) {
                    // crit_50_serious still has 50% crit
                }
                applyDamageWithShield(targetName, _gsDmg, gameState.selectedCharacter);
                addLog('💥 Golpe Serio: ' + _gsDmg + ' daño a ' + targetName, 'damage');
            } else if (ability.effect === 'golpe_normal_saitama') {
                // SAITAMA — Golpe Normal: 4 dmg + Furia 2T + escalating charge bonus (pasiva)
                const _gnSaitama = gameState.characters[gameState.selectedCharacter];
                let _gnDmg = finalDamage;
                applyDamageWithShield(targetName, _gnDmg, gameState.selectedCharacter);
                applyFuria(gameState.selectedCharacter, 2);
                // ESPÍRITU DEL HÉROE pasiva: each basic use adds +2 chargeGain next time
                if (_gnSaitama) {
                    _gnSaitama.saitamaBasicChargeBonus = (_gnSaitama.saitamaBasicChargeBonus || 0) + 2;
                    const _totalCharge = (ability.chargeGain || 1) + (_gnSaitama.saitamaBasicChargeBonus - 2); // -2 because we already added 2
                    // Actually: current usage gains the bonus from PREVIOUS uses
                    // The bonus earned NOW applies NEXT time
                    addLog('💥 Golpe Normal: ' + _gnDmg + ' daño + Furia 2T. Próximo básico generará ' + (1 + _gnSaitama.saitamaBasicChargeBonus) + ' cargas', 'buff');
                }
            } else if (ability.effect === 'naipes_joker') {
                // JOKER — Naipes Impregnados: 1 dmg + Veneno 2T
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPoison(targetName, 2);
                addLog('🃏 Naipes Impregnados: ' + finalDamage + ' daño + Veneno 2T a ' + targetName, 'damage');

            } else if (ability.effect === 'granada_joker') {
                // JOKER — Granada de Humo Púrpura: 1 AOE + Veneno 3T
                const _gjTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_gjTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🃏 Granada redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _gjTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        applyPoison(_n, 3);
                    }
                }
                applyAOEToSummons(_gjTeam, finalDamage, gameState.selectedCharacter);
                addLog('🃏 Granada de Humo Púrpura: 1 AOE + Veneno 3T a todos los enemigos', 'damage');

            } else if (ability.effect === 'detonador_joker') {
                // JOKER — Detonador del Caos: 3 AOE + 50% drain cargas si tiene Veneno/Aturdimiento
                const _djTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_djTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🃏 Detonador redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _djTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        const _hasVenAturd = (_c.statusEffects||[]).some(function(e){
                            const nm = normAccent(e&&e.name||'').toLowerCase();
                            return nm.includes('veneno') || nm.includes('aturdimiento');
                        });
                        if (_hasVenAturd && Math.random() < 0.50) {
                            addLog('🃏 Detonador del Caos: ' + _n + ' pierde todas sus cargas (' + _c.charges + ')', 'damage');
                            _c.charges = 0;
                        }
                    }
                }
                addLog('🃏 Detonador del Caos: 3 AOE completado', 'damage');

            } else if (ability.effect === 'por_que_serio_joker') {
                // JOKER — ¿Por qué tan serio?: 2 dmg + si tiene Veneno → -60% HP actual
                const _pqTgt = gameState.characters[targetName];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (_pqTgt && !_pqTgt.isDead && _pqTgt.hp > 0) {
                    const _hasVeneno = (_pqTgt.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'').toLowerCase().includes('veneno'); });
                    if (_hasVeneno) {
                        const _pqLoss = Math.floor(_pqTgt.hp * 0.60);
                        _pqTgt.hp = Math.max(0, _pqTgt.hp - _pqLoss);
                        if (_pqTgt.hp <= 0) { _pqTgt.isDead = true; if (typeof checkGameOver === 'function') checkGameOver(); }
                        addLog('🃏 ¿Por qué tan serio? -60% HP: ' + targetName + ' pierde ' + _pqLoss + ' HP', 'damage');
                    }
                }
                addLog('🃏 ¿Por qué tan serio?: ' + finalDamage + ' daño a ' + targetName, 'damage');
            } else if (ability.effect === 'batarang_batman') {
                // BATMAN — Batarang Táctico: 2 dmg + 50% stun + 50% steal 2 cargas
                const _bbAtk = gameState.characters[gameState.selectedCharacter];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (Math.random() < 0.50) { applyStun(targetName, 1); addLog('🦇 Batarang: ' + targetName + ' aturdido', 'debuff'); }
                const _bbTgt = gameState.characters[targetName];
                if (Math.random() < 0.50 && _bbTgt && _bbTgt.charges >= 2) {
                    _bbTgt.charges -= 2;
                    if (_bbAtk) _bbAtk.charges = Math.min(20, (_bbAtk.charges||0) + 2);
                    addLog('🦇 Batarang: Batman roba 2 cargas de ' + targetName, 'buff');
                }

            } else if (ability.effect === 'bomba_humo_batman') {
                // BATMAN — Bomba de Humo: Esquiva Área 2T a aliados + 50% Sigilo a cada uno
                const _bhTeam = attacker.team;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.isDead || _c.hp <= 0 || _c.team !== _bhTeam) continue;
                    // Apply Esquiva Área buff 2 turns
                    applyBuff(_n, { name: 'Esquiva Area', type: 'buff', duration: 2, emoji: '🌟', description: 'Esquiva Área: inmune a AOE del enemigo' });
                    // 50% Sigilo
                    if (Math.random() < 0.50) {
                        applyStealth(_n, 1);
                        addLog('🦇 Bomba de Humo: ' + _n + ' entra en Sigilo', 'buff');
                    }
                }
                addLog('🦇 Bomba de Humo: Esquiva Área 2T aplicada al equipo aliado', 'buff');

            } else if (ability.effect === 'analisis_batman') {
                // BATMAN — Análisis de Puntos Débiles: 3 AOE + bloquea 1 movimiento por 2T
                const _anTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_anTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🦇 Análisis redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _anTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        // Block 1 random ability for 2 turns (apply Silenciar on random category)
                        if (!(_c.statusEffects||[]).some(function(e){return e&&normAccent(e.name||'')==='silenciar';})) {
                            const cats = ['basic','special','over'];
                            const cat = cats[Math.floor(Math.random()*cats.length)];
                            applyDebuff(_n, { name: 'Silenciar', type: 'debuff', duration: 2, silencedCategory: cat, emoji: '🔇' });
                            addLog('🦇 Análisis: ' + _n + ' bloqueado en categoría ' + cat + ' (2T)', 'debuff');
                        }
                    }
                }
                addLog('🦇 Análisis de Puntos Débiles: 3 AOE + bloqueo de movimiento', 'damage');

            } else if (ability.effect === 'contingencia_batman') {
                // BATMAN — Planes de Contingencia: 5 dmg + drain all cargas + 1 per drained + no-charge 3T
                const _conTgt = gameState.characters[targetName];
                const _conBatman = gameState.characters[gameState.selectedCharacter];
                const _conStolen = _conTgt ? (_conTgt.charges || 0) : 0;
                const _conDmg = finalDamage + _conStolen;
                applyDamageWithShield(targetName, _conDmg, gameState.selectedCharacter);
                if (_conTgt) {
                    _conTgt.charges = 0;
                    _conTgt.noChargeGenTurns = 3; // checked in endTurn/startTurn
                    addLog('🦇 Planes de Contingencia: ' + _conDmg + ' daño (' + finalDamage + '+' + _conStolen + ' cargas drenadas). ' + targetName + ' no puede generar cargas por 3 turnos', 'damage');
                }
            } else if (ability.effect === 'punio_justicia_superman') {
                // SUPERMAN — Puño de la Justicia: 3 dmg (x2 si Prime) + recover 2 HP
                const _pjS = gameState.characters[gameState.selectedCharacter];
                let _pjDmg = _pjS && _pjS.supermanPrimeMode ? finalDamage * 2 : finalDamage;
                applyDamageWithShield(targetName, _pjDmg, gameState.selectedCharacter);
                if (_pjS) {
                    if (typeof canHeal === 'function' && !canHeal(gameState.selectedCharacter)) {
                        addLog('☀️ Quemadura Solar: ' + gameState.selectedCharacter + ' no puede recuperar HP (Puño de la Justicia)', 'debuff');
                    } else {
                        const _pjOldHp = _pjS.hp;
                        _pjS.hp = Math.min(_pjS.maxHp, _pjS.hp + 2);
                        const _pjHealed = _pjS.hp - _pjOldHp;
                        if (_pjHealed > 0) {
                            addLog('🦸 Puño de la Justicia: ' + _pjDmg + ' daño + ' + _pjHealed + ' HP recuperados', 'buff');
                            if (typeof triggerPresenciaOscura === 'function') triggerPresenciaOscura(gameState.selectedCharacter);
                            if (typeof triggerBendicionSagrada === 'function') triggerBendicionSagrada(_pjS.team, _pjHealed);
                        }
                    }
                }

            } else if (ability.effect === 'vision_calor_superman') {
                // SUPERMAN — Visión de Calor: 6 dmg (x2 Prime) + dispel buffs+shield + QS 3T
                const _vcS = gameState.characters[gameState.selectedCharacter];
                let _vcDmg = _vcS && _vcS.supermanPrimeMode ? finalDamage * 2 : finalDamage;
                applyDamageWithShield(targetName, _vcDmg, gameState.selectedCharacter);
                const _vcTgt = gameState.characters[targetName];
                if (_vcTgt) {
                    // Dispel all buffs and shield
                    const _vcDispelled = (_vcTgt.statusEffects||[]).filter(function(e){return e&&e.type==='buff';}).length;
                    _vcTgt.statusEffects = (_vcTgt.statusEffects||[]).filter(function(e){return !e||e.type!=='buff';});
                    _vcTgt.shield = 0; _vcTgt.shieldEffect = null;
                    if (_vcDispelled > 0) addLog('🔥 Visión de Calor: ' + _vcDispelled + ' buff(s) disipados de ' + targetName, 'debuff');
                    applySolarBurn(targetName, 15, 3);
                applyAOEToSummons(_agTeam, finalDamage, gameState.selectedCharacter);
                    addLog('🔥 Visión de Calor: ' + _vcDmg + ' daño + Quemadura Solar 3T a ' + targetName, 'damage');
                }

            } else if (ability.effect === 'aliento_gelido_superman') {
                // SUPERMAN — Aliento Gélido: 3 AOE + 50% freeze + 50% weaken per target + kill summons
                const _agS = gameState.characters[gameState.selectedCharacter];
                const _agTeam = _agS ? (_agS.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_agTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('❄️ Aliento Gélido redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _agTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        let _agDmg = _agS && _agS.supermanPrimeMode ? finalDamage * 2 : finalDamage;
                        applyDamageWithShield(_n, _agDmg, gameState.selectedCharacter);
                        if (Math.random() < 0.50) applyFreeze(_n, 2);
                        if (Math.random() < 0.50) applyWeaken(_n, 2);
                    }
                    // Eliminate enemy summons
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (!_s || _s.team !== _agTeam || _s.hp <= 0) continue;
                        addLog('❄️ Aliento Gélido: ¡' + _s.name + ' congelada y eliminada!', 'damage');
                        delete gameState.summons[_sid];
                    }
                    renderSummons();
                applyAOEToSummons(_agTeam, finalDamage, gameState.selectedCharacter);
                    addLog('❄️ Aliento Gélido: 3 AOE completado', 'damage');
                }

            } else if (ability.effect === 'forma_prime_superman') {
                // SUPERMAN — Forma Prime: HP Max 30 + full heal + daño doble + debuff immunity
                const _fpS = gameState.characters[gameState.selectedCharacter];
                if (_fpS) {
                    _fpS.supermanPrimeMode = true;
                    _fpS.maxHp = 30;
                    _fpS.hp = 30;
                    _fpS.immuneToDebuffs = true;
                    ability.used = true;
                    if (_fpS.transformPortrait) _fpS.portrait = _fpS.transformPortrait;
                    addLog('🦸 ¡FORMA PRIME! Superman: HP Max 30, HP restaurado, daño doble, inmunidad a debuffs', 'buff');
                }

            } else if (ability.effect === 'ciclon_caos_kratos') {
                // KRATOS — Ciclón del Caos: 1 AOE + 50% sangrado + 20% triple dmg
                const _ccK = gameState.characters[gameState.selectedCharacter];
                const _ccTeam = _ccK ? (_ccK.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_ccTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⚔️ Ciclón del Caos redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ccTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        let _ccDmg = finalDamage;
                        if (Math.random() < 0.20) { _ccDmg *= 3; addLog('💥 ¡Daño Triple! Ciclón del Caos en ' + _n, 'damage'); }
                        applyDamageWithShield(_n, _ccDmg, gameState.selectedCharacter);
                        // Check bleed BEFORE hit for passive charge gen
                        const _ccHadBleed = (_c.statusEffects||[]).some(function(e){
                            return e && normAccent(e.name||'').toLowerCase() === 'sangrado';
                        });
                        if (Math.random() < 0.50) {
                            applyBleed(_n, 2);
                        }
                        // PASIVA Dios de la Guerra: +2 cargas si el objetivo YA TENÍA Sangrado antes del golpe
                        if (_ccHadBleed && _ccK) {
                            _ccK.charges = Math.min(20, (_ccK.charges || 0) + 2);
                            addLog('⚔️ Dios de la Guerra: ' + gameState.selectedCharacter + ' genera 2 cargas (Sangrado previo en ' + _n + ')', 'buff');
                        }
                    }
                    // Daño a invocaciones enemigas
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (!_s || _s.team !== _ccTeam || _s.hp <= 0) continue;
                        let _ccSDmg = finalDamage;
                        if (Math.random() < 0.20) { _ccSDmg *= 3; addLog('💥 ¡Daño Triple! Ciclón del Caos en ' + _s.name, 'damage'); }
                        applySummonDamage(_sid, _ccSDmg, gameState.selectedCharacter);
                    }
                    addLog('⚔️ Ciclón del Caos: 1 AOE completado', 'damage');
                }

            } else if (ability.effect === 'ira_tartaro_kratos') {
                // KRATOS — Ira del Tártaro: 3 dmg + Sangrado; si ya tenía Sangrado → Mega Aturdimiento
                const _itK = gameState.characters[gameState.selectedCharacter];
                const _itTgt = gameState.characters[targetName];
                const _hadBleed = _itTgt && (_itTgt.statusEffects||[]).some(function(e){
                    return e && normAccent(e.name||'').toLowerCase() === 'sangrado';
                });
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                // Check bleed for charge gen before applying new bleed
                if (_hadBleed && _itK) {
                    _itK.charges = Math.min(20, (_itK.charges || 0) + 2);
                    addLog('⚔️ Dios de la Guerra: ' + gameState.selectedCharacter + ' genera 2 cargas (Sangrado previo en ' + targetName + ')', 'buff');
                }
                applyBleed(targetName, 2);
                if (_hadBleed) {
                    applyStun(targetName, 2); // Mega Aturdimiento
                    addLog('⚔️ Ira del Tártaro: ¡' + targetName + ' ya tenía Sangrado → Mega Aturdimiento!', 'debuff');
                }
                addLog('⚔️ Ira del Tártaro: ' + finalDamage + ' daño + Sangrado a ' + targetName, 'damage');

            } else if (ability.effect === 'tempestad_jord_kratos') {
                // KRATOS — Tempestad de Jord: 2 dmg (triple si Sangrado) + 50% crit
                const _tjK = gameState.characters[gameState.selectedCharacter];
                const _tjTgt = gameState.characters[targetName];
                const _tjHasBleed = _tjTgt && (_tjTgt.statusEffects||[]).some(function(e){
                    return e && normAccent(e.name||'').toLowerCase() === 'sangrado';
                });
                let _tjDmg = finalDamage;
                if (_tjHasBleed) { _tjDmg *= 3; addLog('⚔️ Tempestad de Jord: ¡Daño TRIPLE por Sangrado!', 'damage'); }
                if (Math.random() < 0.50) { _tjDmg *= 2; addLog('💥 ¡Crítico! Tempestad de Jord', 'damage'); }
                applyDamageWithShield(targetName, _tjDmg, gameState.selectedCharacter);
                // Charge gen if target had bleed
                if (_tjHasBleed && _tjK) {
                    _tjK.charges = Math.min(20, (_tjK.charges || 0) + 2);
                    addLog('⚔️ Dios de la Guerra: ' + gameState.selectedCharacter + ' genera 2 cargas (Sangrado)', 'buff');
                }
                applyAOEToSummons(_ikTeam, finalDamage, gameState.selectedCharacter);
                addLog('⚔️ Tempestad de Jord: ' + _tjDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'ira_kratos') {
                // KRATOS — Ira de Kratos: 7 AOE + 10% instant kill per target
                const _ikK = gameState.characters[gameState.selectedCharacter];
                const _ikTeam = _ikK ? (_ikK.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_ikTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('⚔️ Ira de Kratos redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ikTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        // Check bleed for charge gen
                        const _cHasBleed = (_c.statusEffects||[]).some(function(e){
                            return e && normAccent(e.name||'').toLowerCase() === 'sangrado';
                        });
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        if (_cHasBleed && _ikK) {
                            _ikK.charges = Math.min(20, (_ikK.charges || 0) + 2);
                            addLog('⚔️ Dios de la Guerra: ' + gameState.selectedCharacter + ' genera 2 cargas (Sangrado previo en ' + _n + ')', 'buff');
                        }
                        // 10% instant kill
                        const _cNow = gameState.characters[_n];
                        if (_cNow && !_cNow.isDead && _cNow.hp > 0 && Math.random() < 0.10) {
                            _cNow.hp = 0; _cNow.isDead = true;
                            addLog('💀 Ira de Kratos: ¡' + _n + ' eliminado (10%)!', 'damage');
                            if (typeof checkGameOver === 'function') checkGameOver();
                        }
                    }
                applyAOEToSummons(_ikTeam, finalDamage, gameState.selectedCharacter);
                    addLog('⚔️ Ira de Kratos: 7 AOE completado', 'damage');
                }
            // ══════════════════════════════════════════════════════
            // SUN JIN WOO — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'sigilo_sombras_sjw') {
                applyStealth(gameState.selectedCharacter, 2);
                addLog('👤 Sigilo de las Sombras: ' + charName + ' entra en Sigilo 2T', 'buff');

            } else if (ability.effect === 'autoridad_gobernante') {
                const _agAtk = gameState.characters[gameState.selectedCharacter];
                if (_agAtk) {
                    _agAtk.statusEffects = (_agAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'esquiva area');
                    _agAtk.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 3, emoji: '💨' });
                    _agAtk.statusEffects = (_agAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'regeneracion');
                    _agAtk.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, percent: 20, emoji: '💖' });
                    addLog('👑 Autoridad del Gobernante: ' + charName + ' gana Esquiva Área 3T + Regeneración 20% 3T', 'buff');
                }

            // ══════════════════════════════════════════════════════
            // LEONIDAS — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'precepto') {
                applyDamageWithShield(targetName, finalDamage, charName);
                addLog('⚔️ Precepto: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (Math.random() < 0.50) { applyStun(targetName, 1); addLog('⚔️ Precepto: Aturdimiento aplicado', 'debuff'); }

            } else if (ability.effect === 'grito_de_esparta') {
                const _geAtk = gameState.characters[gameState.selectedCharacter];
                const _geMyTeam = _geAtk ? _geAtk.team : 'team1';
                for (const _an in gameState.characters) {
                    const _a = gameState.characters[_an];
                    if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _geMyTeam) continue;
                    const _debuffs = (_a.statusEffects||[]).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (_debuffs.length > 0) {
                        _a.statusEffects = (_a.statusEffects||[]).filter(e => e !== _debuffs[0]);
                        addLog('⚔️ Grito de Esparta: limpiado ' + _debuffs[0].name + ' de ' + _an, 'buff');
                    }
                    applyFrenesi(_an, 2);
                }
                addLog('⚔️ Grito de Esparta: Frenesi aplicado al equipo aliado', 'buff');

            } else if (ability.effect === 'sangre_de_esparta') {
                const _seAtk = gameState.characters[gameState.selectedCharacter];
                if (_seAtk) {
                    _seAtk.hp = Math.max(1, (_seAtk.hp||0) - 10);
                    addLog('⚔️ Sangre de Esparta: ' + charName + ' sacrifica 10 HP', 'damage');
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _seAtk.team || _an === charName) continue;
                        _a.charges = Math.min(20, (_a.charges||0) + 6);
                        addLog('⚔️ Sangre de Esparta: ' + _an + ' genera 6 cargas', 'buff');
                    }
                }

            } else if (ability.effect === 'gloria_300') {
                const _g3Atk = gameState.characters[gameState.selectedCharacter];
                const _g3EnemyTeam = _g3Atk ? (_g3Atk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_g3EnemyTeam, finalDamage, charName)) {
                    addLog('⚔️ Gloria de los 300: AOE redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _g3EnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, finalDamage, charName);
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _g3EnemyTeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, charName); }
                }
                // Regen 25% 2T + limpiar debuffs aliados
                const _g3MyTeam = _g3Atk ? _g3Atk.team : 'team1';
                for (const _an in gameState.characters) {
                    const _a = gameState.characters[_an];
                    if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _g3MyTeam) continue;
                    _a.statusEffects = (_a.statusEffects||[]).filter(e => !e || e.type !== 'debuff' || e.permanent);
                    _a.statusEffects = (_a.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'regeneracion');
                    _a.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 2, percent: 25, emoji: '💖' });
                    addLog('⚔️ Gloria de los 300: ' + _an + ' gana Regen 25% 2T, debuffs limpiados', 'buff');
                }
                addLog('⚔️ Gloria de los 300: ' + finalDamage + ' AOE', 'damage');

            // ══════════════════════════════════════════════════════
            // ANAKIN SKYWALKER — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'djem_so') {
                let _djDmg = finalDamage;
                if (attacker.darkSideAwakened) _djDmg *= 2;
                if (Math.random() < 0.50) { _djDmg *= 2; addLog('⚡ Djem So: ¡Crítico!', 'buff'); }
                applyDamageWithShield(targetName, _djDmg, charName);
                addLog('⚡ Djem So: ' + _djDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'estrangular') {
                const _estETeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_estETeam, finalDamage, charName)) {
                    addLog('⚡ Estrangular: redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _estETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, finalDamage, charName);
                        _c.charges = Math.max(0, (_c.charges||0) - 1);
                        if (Math.random() < 0.50) applyStun(_n, 1);
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _estETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, charName); }
                }
                addLog('⚡ Estrangular: ' + finalDamage + ' AOE + -1 carga al equipo enemigo', 'damage');

            } else if (ability.effect === 'general_501') {
                const _g501ETeam = attacker.team === 'team1' ? 'team2' : 'team1';
                const _g501Enemies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _g501ETeam && !c.isDead && c.hp > 0; });
                if (_g501Enemies.length === 0) { addLog('⚡ General de la 501: No hay objetivos', 'info'); }
                else {
                    for (let _i = 0; _i < 4; _i++) {
                        const _tn = _g501Enemies[Math.floor(Math.random() * _g501Enemies.length)];
                        const _tc = gameState.characters[_tn];
                        if (!_tc || _tc.isDead || _tc.hp <= 0) continue;
                        let _g501Dmg = attacker.abilities[0] ? attacker.abilities[0].damage : 2;
                        if (attacker.darkSideAwakened) _g501Dmg *= 2;
                        if (Math.random() < 0.50) { _g501Dmg *= 2; }
                        applyDamageWithShield(_tn, _g501Dmg, charName);
                        attacker.charges = Math.min(20, (attacker.charges||0) + (attacker.abilities[0] ? attacker.abilities[0].chargeGain : 2));
                        if (Math.random() < 0.50) applyFear(_tn, 1);
                        addLog('⚡ General de la 501: ' + _g501Dmg + ' daño a ' + _tn, 'damage');
                    }
                }

            } else if (ability.effect === 'dark_side_anakin') {
                const _dsAtk = gameState.characters[charName];
                if (_dsAtk) {
                    _dsAtk.darkSideAwakened = true;
                    const _dsTP = _dsAtk.transformPortrait || _dsAtk.transformationPortrait;
                    if (_dsTP) _dsAtk.portrait = _dsTP;
                    _dsAtk.speed = (_dsAtk.speed||0) + 10;
                    // Concentración permanente
                    if (!(_dsAtk.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'concentracion')) {
                        _dsAtk.statusEffects = (_dsAtk.statusEffects||[]);
                        _dsAtk.statusEffects.push({ name: 'Concentracion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🎯' });
                    }
                    addLog('🌑 Despertar del Lado Oscuro: Anakin transformado. +10 vel, Concentración permanente', 'buff');
                }

            // ══════════════════════════════════════════════════════
            // OZYMANDIAS — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'animacion_ozymandias') {
                const _aoTgt = gameState.characters[targetName];
                const _aoHadQS = _aoTgt && (_aoTgt.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'quemadura solar');
                applyDamageWithShield(targetName, finalDamage, charName);
                applySolarBurn(targetName, 0, 999); // Quemadura Solar permanente hasta limpiarse
                addLog('☀️ Animación: ' + finalDamage + ' daño + Quemadura Solar a ' + targetName, 'damage');
                if (_aoHadQS && Math.random() < 0.50) {
                    applyDebuff(targetName, { name: 'Mega Aturdimiento', type: 'debuff', duration: 2, emoji: '💫', stun: true });
                    addLog('☀️ Animación: Mega Aturdimiento (objetivo ya tenía QS)', 'debuff');
                }

            } else if (ability.effect === 'sentencia_del_sol') {
                // OZYMANDIAS — Sentencia del Sol: 2 AOE + 2 daño adicional POR CADA enemigo con QS
                const _ssAtk = gameState.characters[charName];
                const _ssETeam = _ssAtk ? (_ssAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Contar enemigos con QS para calcular bonus
                let _ssQsCount = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _ssETeam || _c.isDead || _c.hp <= 0) continue;
                    if ((_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'quemadura solar'; })) _ssQsCount++;
                }
                const _ssBonus = _ssQsCount * 2;
                const _ssTotalDmg = finalDamage + _ssBonus;
                if (checkAndRedirectAOEMegaProv(_ssETeam, _ssTotalDmg, charName)) {
                    addLog('☀️ Sentencia del Sol: AOE redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ssETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, _ssTotalDmg, charName);
                        addLog('☀️ Sentencia del Sol: ' + _ssTotalDmg + ' daño a ' + _n + ' (' + finalDamage + '+' + _ssBonus + ')', 'damage');
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _ssETeam && _s.hp > 0) applySummonDamage(_sid, _ssTotalDmg, charName); }
                }
                if (_ssQsCount > 0) addLog('☀️ Sentencia del Sol: +' + _ssBonus + ' bonus (' + _ssQsCount + ' enemigos con QS)', 'damage');

            // ══════════════════════════════════════════════════════
            // GOKU BLACK — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'espada_ki') {
                applyDamageWithShield(targetName, finalDamage, charName);
                addLog('⚫ Espada de Ki: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (Math.random() < 0.50) {
                    const _ekTgt = gameState.characters[targetName];
                    if (_ekTgt && (_ekTgt.charges||0) > 0) {
                        _ekTgt.charges = Math.max(0, (_ekTgt.charges||0) - 1);
                        attacker.charges = Math.min(20, (attacker.charges||0) + 1);
                        addLog('⚫ Espada de Ki: roba 1 carga de ' + targetName, 'buff');
                    }
                }

            } else if (ability.effect === 'kamehame_oscuro') {
                let _kmDmg = finalDamage;
                if (Math.random() < 0.50) { _kmDmg *= 2; addLog('⚫ Kamehame Ha Oscuro: ¡Crítico!', 'buff'); }
                applyDamageWithShield(targetName, _kmDmg, charName);
                addLog('⚫ Kamehame Ha Oscuro: ' + _kmDmg + ' daño a ' + targetName, 'damage');
                if (Math.random() < 0.50) applyStun(targetName, 1);

            } else if (ability.effect === 'lazo_divino') {
                applyDamageWithShield(targetName, finalDamage, charName);
                addLog('⚫ Lazo Divino: ' + finalDamage + ' daño a ' + targetName, 'damage');
                // Invocar 3 Fake Black
                for (let _i = 0; _i < 3; _i++) {
                    summonFakeBlack(charName);
                }
                addLog('⚫ Lazo Divino: 3 Fake Black invocados', 'buff');

            } else if (ability.effect === 'guadania_divina') {
                const _gdETeam = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_gdETeam, finalDamage, charName)) {
                    addLog('⚫ Guadaña Divina: AOE redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _gdETeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        const _hadNoCharges = (_c.charges||0) === 0;
                        let _gdDmg = finalDamage;
                        if (_hadNoCharges) { _gdDmg *= 2; addLog('⚫ Guadaña Divina: ¡Crítico en ' + _n + ' (sin cargas)!', 'buff'); }
                        _c.charges = 0;
                        applyDamageWithShield(_n, _gdDmg, charName);
                        addLog('⚫ Guadaña Divina: ' + _gdDmg + ' daño a ' + _n + ' (cargas eliminadas)', 'damage');
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _gdETeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, charName); }
                }

            // ══════════════════════════════════════════════════════
            // DOOMSDAY — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'rugido_devastador') {
                const _rdAtk = gameState.characters[charName];
                if (_rdAtk) {
                    _rdAtk.statusEffects = (_rdAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'provocacion');
                    _rdAtk.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                    _rdAtk.statusEffects = (_rdAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'cuerpo perfecto');
                    _rdAtk.statusEffects.push({ name: 'Cuerpo Perfecto', type: 'buff', duration: 2, emoji: '💠' });
                    addLog('💥 Rugido del Devastador: Provocación + Cuerpo Perfecto aplicados', 'buff');
                }

            } else if (ability.effect === 'smashing_strike') {
                const _ssETeam2 = attacker.team === 'team1' ? 'team2' : 'team1';
                const _ssEnemies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _ssETeam2 && !c.isDead && c.hp > 0; });
                if (_ssEnemies.length === 0) { addLog('💥 Smashing Strike: Sin objetivos', 'info'); }
                else {
                    for (let _i = 0; _i < 2; _i++) {
                        const _tn = _ssEnemies[Math.floor(Math.random() * _ssEnemies.length)];
                        applyDamageWithShield(_tn, finalDamage, charName);
                        addLog('💥 Smashing Strike: ' + finalDamage + ' daño a ' + _tn, 'damage');
                        if (Math.random() < 0.50) applyStun(_tn, 1);
                    }
                }

            } else if (ability.effect === 'skill_drain') {
                // Skill Drain: 3 AOE + roba 1-5 HP por enemigo golpeado (siempre)
                const _sdETeam2 = attacker.team === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_sdETeam2, finalDamage, charName)) {
                    addLog('💥 Skill Drain: AOE redirigido por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _sdETeam2 || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, finalDamage, charName);
                        // Robo garantizado: 1-5 HP
                        const _steal = Math.floor(Math.random() * 5) + 1;
                        const _cNow = gameState.characters[_n];
                        if (_cNow && !_cNow.isDead && _cNow.hp > 0) {
                            const _stolen = Math.min(_steal, _cNow.hp);
                            _cNow.hp = Math.max(0, _cNow.hp - _stolen);
                            attacker.hp = Math.min(attacker.maxHp, (attacker.hp||0) + _stolen);
                            addLog('💥 Skill Drain: roba ' + _stolen + ' HP de ' + _n, 'heal');
                        }
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _sdETeam2 && _s.hp > 0) applySummonDamage(_sid, finalDamage, charName); }
                }
                addLog('💥 Skill Drain: ' + finalDamage + ' AOE + robo de HP completado', 'damage');

            } else if (ability.effect === 'devastator_punish') {
                // Nuevo: 5 daño. 10% de eliminar al objetivo. Si lo elimina: disipar buffs enemigos + mega aturdimiento a todos
                const _dpTgt = gameState.characters[targetName];
                const _dpWasAlive = _dpTgt && !_dpTgt.isDead && _dpTgt.hp > 0;
                const _dpET = attacker.team === 'team1' ? 'team2' : 'team1';
                // 10% de probabilidad de ejecutar al objetivo
                const _dpExecute = Math.random() < 0.10;
                let _dpDmg = finalDamage;
                if (_dpExecute && _dpTgt && _dpTgt.hp > 0) {
                    _dpDmg = _dpTgt.hp; // daño suficiente para eliminar
                    addLog('💥 Devastator Punish: ¡EJECUCIÓN! 10% activado', 'buff');
                }
                applyDamageWithShield(targetName, _dpDmg, charName);
                addLog('💥 Devastator Punish: ' + _dpDmg + ' daño a ' + targetName, 'damage');
                // Si el objetivo fue eliminado
                const _dpTgtNow = gameState.characters[targetName];
                if (_dpWasAlive && _dpTgtNow && (_dpTgtNow.isDead || _dpTgtNow.hp <= 0)) {
                    // Disipar buffs de todo el equipo enemigo
                    let _dpTotalBufs = 0;
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc || _cc.team !== _dpET || _cc.isDead) continue;
                        const _bufs = (_cc.statusEffects||[]).filter(e => e && e.type === 'buff' && !e.permanent && !e.passiveHidden);
                        _cc.statusEffects = (_cc.statusEffects||[]).filter(e => !e || e.type !== 'buff' || e.permanent || e.passiveHidden);
                        _dpTotalBufs += _bufs.length;
                    }
                    addLog('💥 Devastator Punish: ' + _dpTotalBufs + ' buffs disipados del equipo enemigo', 'debuff');
                    // Mega Aturdimiento a todos los enemigos vivos
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc || _cc.team !== _dpET || _cc.isDead || _cc.hp <= 0 || _n === targetName) continue;
                        applyStun(_n, 2);
                    }
                    addLog('💥 Devastator Punish: Mega Aturdimiento a todo el equipo enemigo', 'debuff');
                }

            // ══════════════════════════════════════════════════════
            // ITACHI UCHIHA — handlers actualizados
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'kan_shaka') {
                // SHAKA — Kān: Buff Provocación 2T + Buff Regeneración 10% 2T sobre sí mismo
                const _kanShaka = gameState.characters[gameState.selectedCharacter];
                if (_kanShaka) {
                    _kanShaka.statusEffects = (_kanShaka.statusEffects || []).filter(e => !e || normAccent(e.name||'') !== 'provocacion');
                    _kanShaka.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                    _kanShaka.statusEffects = (_kanShaka.statusEffects || []).filter(e => !e || normAccent(e.name||'') !== 'regeneracion');
                    _kanShaka.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 2, percent: 10, emoji: '💖' });
                    addLog('✨ Kān: ' + charName + ' gana Provocación 2T y Regeneración 10% 2T', 'buff');
                }

            } else if (ability.effect === 'octavo_sentido_shaka') {
                // SHAKA — Octavo Sentido: 1 carga por cada 2 debuffs activos en AMBOS equipos
                const _osShaka = gameState.characters[gameState.selectedCharacter];
                if (_osShaka) {
                    const _osMyTeam = _osShaka.team;
                    let _osTotalDebuffs = 0;
                    for (const _osN in gameState.characters) {
                        const _osC = gameState.characters[_osN];
                        if (!_osC || _osC.isDead || _osC.hp <= 0) continue;
                        _osTotalDebuffs += (_osC.statusEffects || []).filter(e => e && e.type === 'debuff').length;
                    }
                    const _osCharges = Math.floor(_osTotalDebuffs / 2);
                    if (_osCharges === 0) {
                        addLog('✨ Octavo Sentido: No suficientes debuffs (' + _osTotalDebuffs + ' debuffs, mínimo 2)', 'info');
                    } else {
                        for (const _osAllyN in gameState.characters) {
                            const _osAlly = gameState.characters[_osAllyN];
                            if (!_osAlly || _osAlly.isDead || _osAlly.hp <= 0 || _osAlly.team !== _osMyTeam) continue;
                            _osAlly.charges = Math.min(20, (_osAlly.charges || 0) + _osCharges);
                            addLog('✨ Octavo Sentido: ' + _osAllyN + ' genera ' + _osCharges + ' carga(s) (' + _osTotalDebuffs + ' debuffs / 2)', 'buff');
                        }
                    }
                }

            } else if (ability.effect === 'ohm_shaka') {
                // SHAKA — Ohm: equipo aliado recupera 2 HP por cada debuff activo en AMBOS equipos
                const _ohmShaka = gameState.characters[gameState.selectedCharacter];
                if (_ohmShaka) {
                    const _ohmMyTeam = _ohmShaka.team;
                    let _ohmTotalDebuffs = 0;
                    for (const _ohmN in gameState.characters) {
                        const _ohmC = gameState.characters[_ohmN];
                        if (!_ohmC || _ohmC.isDead || _ohmC.hp <= 0) continue;
                        _ohmTotalDebuffs += (_ohmC.statusEffects || []).filter(e => e && e.type === 'debuff').length;
                    }
                    if (_ohmTotalDebuffs === 0) {
                        addLog('✨ Ohm: No hay debuffs activos en ningún equipo', 'info');
                    } else {
                        const _ohmHealAmt = _ohmTotalDebuffs * 1;
                        for (const _ohmAllyN in gameState.characters) {
                            const _ohmAlly = gameState.characters[_ohmAllyN];
                            if (!_ohmAlly || _ohmAlly.isDead || _ohmAlly.hp <= 0 || _ohmAlly.team !== _ohmMyTeam) continue;
                            if (typeof canHeal === 'function' && !canHeal(_ohmAllyN)) { addLog('☀️ QS bloquea curación de ' + _ohmAllyN + ' (Ohm)', 'debuff'); continue; }
                            const _ohmOldHp = _ohmAlly.hp;
                            _ohmAlly.hp = Math.min(_ohmAlly.maxHp, _ohmAlly.hp + _ohmHealAmt);
                            const _ohmHealed = _ohmAlly.hp - _ohmOldHp;
                            if (_ohmHealed > 0) {
                                addLog('✨ Ohm: ' + _ohmAllyN + ' recupera ' + _ohmHealed + ' HP (' + _ohmTotalDebuffs + ' debuffs × 1)', 'heal');
                                if (_ohmAllyN === charName && typeof triggerShakaHealDebuff === 'function') {
                                    triggerShakaHealDebuff(charName);
                                }
                            }
                        }
                    }
                }

            } else if (ability.effect === 'tenmaku_horin_shaka') {
                // SHAKA — Tenmaku Hōrin: 8 daño + Mega Posesión + Agotamiento 3T
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('✨ Tenmaku Hōrin: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _thTarget = gameState.characters[targetName];
                if (_thTarget && !_thTarget.isDead && _thTarget.hp > 0) {
                    // Mega Posesión 3T
                    applyDebuff(targetName, { name: 'Mega Posesion', type: 'debuff', duration: 3, emoji: '👁️', megaPossession: true });
                    // Agotamiento 3T
                    applyAgotamiento(targetName, 3);
                    addLog('✨ Tenmaku Hōrin: ' + targetName + ' recibe Mega Posesión 3T + Agotamiento 3T', 'debuff');
                }

            // ══════════════════════════════════════════════════════
            // VARIAN WRYNN
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'filotormenta_varian') {
                // AOE — daño base + bonus consecutivo + 50% crit
                const _fvAtk = gameState.characters[gameState.selectedCharacter];
                const _fvEnemyTeam = _fvAtk ? (_fvAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Bonus acumulado por usos PREVIOS consecutivos (se lee antes de incrementar)
                const _fvDmgBonus = (_fvAtk ? (_fvAtk.varianBasicDmgBonus || 0) : 0);
                const _fvChargeBonus = (_fvAtk ? (_fvAtk.varianBasicChargeBonus || 0) : 0);
                let _fvDmg = finalDamage + _fvDmgBonus;
                // 50% crit (Lo'gosh)
                if (Math.random() < 0.50) { _fvDmg *= 2; addLog('⚔️ Lo\'gosh: ¡Crítico! Filotormenta daño doble', 'buff'); }
                // Daño doble si transformado
                if (_fvAtk && _fvAtk.varianTransformed) { _fvDmg *= 2; }
                if (checkAndRedirectAOEMegaProv(_fvEnemyTeam, _fvDmg, gameState.selectedCharacter)) {
                    addLog('⚔️ Filotormenta redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _fvEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        applyDamageWithShield(_n, _fvDmg, gameState.selectedCharacter);
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _fvEnemyTeam && _s.hp > 0) applySummonDamage(_sid, _fvDmg, gameState.selectedCharacter); }
                }
                // Cargas del turno actual: base (1) + bonus consecutivo acumulado
                const _fvTotalCharge = (ability.chargeGain || 1) + _fvChargeBonus;
                if (_fvAtk) {
                    _fvAtk.charges = Math.min(20, (_fvAtk.charges || 0) + _fvTotalCharge);
                }
                addLog('⚔️ Filotormenta: ' + _fvDmg + ' AOE | +' + _fvTotalCharge + ' cargas (uso consecutivo #' + (_fvDmgBonus + 1) + ')', 'damage');
                // Incrementar bonus para el PRÓXIMO uso consecutivo
                if (_fvAtk) {
                    _fvAtk.varianBasicDmgBonus = (_fvAtk.varianBasicDmgBonus || 0) + 1;
                    _fvAtk.varianBasicChargeBonus = (_fvAtk.varianBasicChargeBonus || 0) + 1;
                    _fvAtk.varianConsecutiveBasic = (_fvAtk.varianConsecutiveBasic || 0) + 1;
                }

            } else if (ability.effect === 'grito_guerra_varian') {
                // AOE aliados — 1 carga por enemigo con Sangrado
                const _ggAtk = gameState.characters[gameState.selectedCharacter];
                const _ggMyTeam = _ggAtk ? _ggAtk.team : 'team1';
                const _ggEnemyTeam = _ggMyTeam === 'team1' ? 'team2' : 'team1';
                let _ggBleeding = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _ggEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                    if ((_c.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'sangrado')) _ggBleeding++;
                }
                if (_ggBleeding === 0) { addLog('⚔️ Grito de Guerra: Ningún enemigo tiene Sangrado', 'info'); }
                else {
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _ggMyTeam) continue;
                        _a.charges = Math.min(20, (_a.charges || 0) + _ggBleeding);
                        addLog('⚔️ Grito de Guerra: ' + _an + ' genera ' + _ggBleeding + ' carga(s)', 'buff');
                    }
                }
                // Resetear consecutivos porque usó especial
                if (_ggAtk) { _ggAtk.varianConsecutiveBasic = 0; _ggAtk.varianBasicDmgBonus = 0; _ggAtk.varianBasicChargeBonus = 0; }

            } else if (ability.effect === 'alianza_varian') {
                // ST — 4 daño + si Sangrado: 50% Miedo al equipo enemigo
                const _avAtk = gameState.characters[gameState.selectedCharacter];
                const _avTgt = gameState.characters[targetName];
                let _avDmg = finalDamage;
                if (Math.random() < 0.50) { _avDmg *= 2; addLog('⚔️ Lo\'gosh: ¡Crítico!', 'buff'); }
                if (_avAtk && _avAtk.varianTransformed) _avDmg *= 2;
                applyDamageWithShield(targetName, _avDmg, gameState.selectedCharacter);
                addLog('⚔️ Por la Alianza: ' + _avDmg + ' daño a ' + targetName, 'damage');
                if (_avTgt && (_avTgt.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'sangrado')) {
                    if (Math.random() < 0.50) {
                        const _avETeam = _avTgt.team;
                        for (const _en in gameState.characters) {
                            const _ec = gameState.characters[_en];
                            if (!_ec || _ec.team !== _avETeam || _ec.isDead || _ec.hp <= 0) continue;
                            applyFear(_en, 1);
                        }
                        addLog('⚔️ Por la Alianza: Miedo aplicado al equipo enemigo', 'debuff');
                    }
                }
                if (_avAtk) { _avAtk.varianConsecutiveBasic = 0; _avAtk.varianBasicDmgBonus = 0; _avAtk.varianBasicChargeBonus = 0; }

            } else if (ability.effect === 'alto_rey_varian') {
                // TRANSFORMACIÓN — daño doble, +10 vel aliados, +1 dmgBonus y chargeBonus en básico
                const _akAtk = gameState.characters[gameState.selectedCharacter];
                if (_akAtk) {
                    _akAtk.varianTransformed = true;
                    const _akTP = _akAtk.transformPortrait || _akAtk.transformationPortrait;
                    if (_akTP) _akAtk.portrait = _akTP;
                    ability.used = true;
                    const _akMyTeam = _akAtk.team;
                    // +10 vel al equipo aliado
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _akMyTeam) continue;
                        _a.speed = (_a.speed || 0) + 10;
                    }
                    // +1 bonus daño y carga al básico permanente
                    _akAtk.varianBasicDmgBonus = (_akAtk.varianBasicDmgBonus || 0) + 1;
                    _akAtk.varianBasicChargeBonus = (_akAtk.varianBasicChargeBonus || 0) + 1;
                    addLog('👑 Alto Rey de la Alianza: Transformación activa. Daño doble, +10 vel aliados, Filotormenta mejorada', 'buff');
                }

            // ══════════════════════════════════════════════════════
            // IVAR THE BONELESS
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'subestimacion_ivar') {
                // ST — ignora Prov/MegaProv/Sigilo. Daño triple si Sangrado
                const _siAtk = gameState.characters[gameState.selectedCharacter];
                const _siTgt = gameState.characters[targetName];
                let _siDmg = finalDamage;
                if (_siTgt && (_siTgt.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'sangrado')) {
                    _siDmg *= 3;
                    addLog('🪓 Subestimación: DAÑO TRIPLE por Sangrado', 'damage');
                }
                // Ataca directamente ignorando provocaciones (targetName ya fue elegido sin filtro de prov)
                applyDamageWithShield(targetName, _siDmg, gameState.selectedCharacter);
                addLog('🪓 Subestimación: ' + _siDmg + ' daño a ' + targetName + ' (ignora Prov/Sigilo)', 'damage');

            } else if (ability.effect === 'estrategia_ivar') {
                // AOE — 4 efectos con 50% de prob cada uno
                const _eiAtk = gameState.characters[gameState.selectedCharacter];
                const _eiMyTeam = _eiAtk ? _eiAtk.team : 'team1';
                const _eiEnemyTeam = _eiMyTeam === 'team1' ? 'team2' : 'team1';
                // 50% eliminar 2 cargas al equipo enemigo
                if (Math.random() < 0.50) {
                    for (const _n in gameState.characters) { const _c = gameState.characters[_n]; if (_c && _c.team === _eiEnemyTeam && !_c.isDead && _c.hp > 0) { _c.charges = Math.max(0, (_c.charges||0) - 2); } }
                    addLog('🪓 Estrategia: -2 cargas al equipo enemigo', 'debuff');
                }
                // 50% reducir 10% velocidad al equipo enemigo
                if (Math.random() < 0.50) {
                    for (const _n in gameState.characters) { const _c = gameState.characters[_n]; if (_c && _c.team === _eiEnemyTeam && !_c.isDead && _c.hp > 0) { _c.speed = Math.max(1, Math.floor((_c.speed||1) * 0.9)); } }
                    addLog('🪓 Estrategia: -10% velocidad al equipo enemigo', 'debuff');
                }
                // 50% generar 2 cargas al equipo aliado
                if (Math.random() < 0.50) {
                    for (const _n in gameState.characters) { const _c = gameState.characters[_n]; if (_c && _c.team === _eiMyTeam && !_c.isDead && _c.hp > 0) { _c.charges = Math.min(20, (_c.charges||0) + 2); } }
                    addLog('🪓 Estrategia: +2 cargas al equipo aliado', 'buff');
                }
                // 50% aumentar 10% velocidad al equipo aliado
                if (Math.random() < 0.50) {
                    for (const _n in gameState.characters) { const _c = gameState.characters[_n]; if (_c && _c.team === _eiMyTeam && !_c.isDead && _c.hp > 0) { _c.speed = Math.ceil((_c.speed||1) * 1.1); } }
                    addLog('🪓 Estrategia: +10% velocidad al equipo aliado', 'buff');
                }

            } else if (ability.effect === 'ragnarson_ivar') {
                // ST aliado — genera cargas según buffs+debuffs activos en ambos equipos
                const _riAtk = gameState.characters[gameState.selectedCharacter];
                const _riTgt = gameState.characters[targetName];
                if (_riTgt) {
                    let _riTotal = 0;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.isDead || _c.hp <= 0) continue;
                        _riTotal += (_c.statusEffects||[]).filter(e => e).length;
                    }
                    _riTgt.charges = Math.min(20, (_riTgt.charges||0) + _riTotal);
                    addLog('🪓 Ragnarson: ' + targetName + ' genera ' + _riTotal + ' cargas (' + _riTotal + ' efectos activos en ambos equipos)', 'buff');
                }

            } else if (ability.effect === 'furia_serpiente_ivar') {
                // AOE 5 daño + buff aleatorio a aliados por cada debuff enemigo + 50% MegaPosesión
                const _fsiAtk = gameState.characters[gameState.selectedCharacter];
                const _fsiMyTeam = _fsiAtk ? _fsiAtk.team : 'team1';
                const _fsiEnemyTeam = _fsiMyTeam === 'team1' ? 'team2' : 'team1';
                // AOE daño
                if (checkAndRedirectAOEMegaProv(_fsiEnemyTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🐍 Furia de la Serpiente redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _fsiEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        // 50% MegaPosesión por enemigo
                        if (Math.random() < 0.50) applyMegaPosesion(_n, 1);
                    }
                    for (let _sid in gameState.summons) { const _s = gameState.summons[_sid]; if (_s && _s.team === _fsiEnemyTeam && _s.hp > 0) applySummonDamage(_sid, finalDamage, gameState.selectedCharacter); }
                }
                // Contar debuffs enemigos y aplicar buffs aleatorios a aliados
                let _fsiDebuffs = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _fsiEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                    _fsiDebuffs += (_c.statusEffects||[]).filter(e => e && e.type === 'debuff').length;
                }
                if (_fsiDebuffs > 0) {
                    const _fsiBuffPool = ['Frenesi','Furia','Concentracion','Contraataque','Celeridad'];
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _fsiMyTeam) continue;
                        for (let _bi = 0; _bi < _fsiDebuffs; _bi++) {
                            const _chosen = _fsiBuffPool[Math.floor(Math.random() * _fsiBuffPool.length)];
                            applyBuff(_an, { name: _chosen, type: 'buff', duration: 2, emoji: '✨' });
                        }
                        addLog('🐍 Furia de la Serpiente: ' + _an + ' recibe ' + _fsiDebuffs + ' buff(s)', 'buff');
                    }
                }
                addLog('🐍 Furia de la Serpiente: ' + finalDamage + ' AOE completado', 'damage');

            // ══════════════════════════════════════════════════════
            // LAGERTHA
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'hacha_escudo_lagertha') {
                // ST — 1 daño + Provocación a Lagertha + 50% Reflejar
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const _hlAtk = gameState.characters[gameState.selectedCharacter];
                if (_hlAtk) {
                    // Provocación
                    _hlAtk.statusEffects = (_hlAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'provocacion');
                    _hlAtk.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 2, emoji: '🛡️' });
                    // 50% Reflejar
                    if (Math.random() < 0.50) {
                        _hlAtk.statusEffects = (_hlAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'reflejar');
                        _hlAtk.statusEffects.push({ name: 'Reflejar', type: 'buff', duration: 2, emoji: '🪞' });
                        addLog('🪓 Hacha y Escudo: Lagertha gana Reflejar', 'buff');
                    }
                }
                addLog('🪓 Hacha y Escudo: ' + finalDamage + ' daño + Provocación', 'damage');

            } else if (ability.effect === 'muro_escudo_lagertha') {
                // AOE aliados — Escudo 5 HP + Protección Sagrada 2T
                const _mlAtk = gameState.characters[gameState.selectedCharacter];
                const _mlMyTeam = _mlAtk ? _mlAtk.team : 'team1';
                for (const _an in gameState.characters) {
                    const _a = gameState.characters[_an];
                    if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _mlMyTeam) continue;
                    _a.shield = (_a.shield || 0) + 5;
                    _a.statusEffects = (_a.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'proteccion sagrada');
                    _a.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '✝️' });
                    addLog('🛡️ Muro de Escudo: ' + _an + ' recibe Escudo 5 HP + Protección Sagrada 2T', 'buff');
                }

            } else if (ability.effect === 'furia_freya_lagertha') {
                // ST — daño directo: 2 + 1 por cada punto de escudo del objetivo
                const _ffTgt = gameState.characters[targetName];
                const _ffShield = _ffTgt ? (_ffTgt.shield || 0) : 0;
                const _ffDmg = finalDamage + _ffShield;
                // Daño directo (attackerName = null bypasea escudo y Escudo Sagrado)
                applyDamageWithShield(targetName, _ffDmg, null);
                addLog('🪓 Furia de Freya: ' + _ffDmg + ' daño directo (' + finalDamage + ' base + ' + _ffShield + ' por escudo del objetivo)', 'damage');

            } else if (ability.effect === 'valquiria_lagertha') {
                // ST — equipo aliado usa su básico sobre el objetivo + Buff Asistir 3T
                const _vlAtk = gameState.characters[gameState.selectedCharacter];
                const _vlMyTeam = _vlAtk ? _vlAtk.team : 'team1';
                const _vlTgt = gameState.characters[targetName];
                if (_vlTgt) {
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _vlMyTeam || _an === gameState.selectedCharacter) continue;
                        const _basic = _a.abilities && _a.abilities[0];
                        if (_basic && _basic.damage > 0) {
                            passiveExecuting = true;
                            const _savedSel = gameState.selectedCharacter;
                            const _savedAb = gameState.selectedAbility;
                            gameState.selectedCharacter = _an;
                            gameState.selectedAbility = _basic;
                            applyDamageWithShield(targetName, _basic.damage, _an);
                            _a.charges = Math.min(20, (_a.charges||0) + (_basic.chargeGain||0));
                            addLog('⚔️ Valquiria: ' + _an + ' ataca a ' + targetName + ' con ' + _basic.name + ' (' + _basic.damage + ' daño)', 'damage');
                            gameState.selectedCharacter = _savedSel;
                            gameState.selectedAbility = _savedAb;
                            passiveExecuting = false;
                        }
                    }
                }
                // Buff Asistir 3T al equipo aliado
                for (const _an in gameState.characters) {
                    const _a = gameState.characters[_an];
                    if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _vlMyTeam) continue;
                    applyBuff(_an, { name: 'Asistir', type: 'buff', duration: 3, emoji: '🤝' });
                }
                addLog('⚔️ Valquiria: Equipo aliado atacó. Buff Asistir 3T aplicado', 'buff');

            // ══════════════════════════════════════════════════════
            // SHINOBU KOCHO
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'danza_mariposa_shinobu') {
                // SELF — Veneno 2T + Concentración 2T a sí misma
                applyPoison(gameState.selectedCharacter, 2);
                applyConcentracion(gameState.selectedCharacter, 2);
                addLog('🦋 Danza de la Mariposa: Shinobu se aplica Veneno 2T y Concentración 2T', 'buff');

            } else if (ability.effect === 'aguijon_abeja_shinobu') {
                // AOE aliados — cura 2 HP + 2 adicionales por cada Veneno enemigo
                const _aaAtk = gameState.characters[gameState.selectedCharacter];
                const _aaMyTeam = _aaAtk ? _aaAtk.team : 'team1';
                const _aaEnemyTeam = _aaMyTeam === 'team1' ? 'team2' : 'team1';
                let _aaVenenos = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _aaEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                    if ((_c.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'veneno')) _aaVenenos++;
                }
                const _aaHealAmt = 2 + (_aaVenenos * 2);
                for (const _an in gameState.characters) {
                    const _a = gameState.characters[_an];
                    if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _aaMyTeam) continue;
                    if (typeof canHeal === 'function' && !canHeal(_an)) { addLog('☀️ QS bloquea curación de ' + _an + ' (Aguijón de Abeja)', 'debuff'); continue; }
                    _a.hp = Math.min(_a.maxHp, (_a.hp||0) + _aaHealAmt);
                    addLog('🐝 Aguijón de Abeja: ' + _an + ' recupera ' + _aaHealAmt + ' HP (2 base + ' + (_aaVenenos*2) + ' por venenos)', 'heal');
                }

            } else if (ability.effect === 'ojo_hexagonal_shinobu') {
                // MT 5 golpes a enemigos aleatorios — si tiene Veneno: cura 1 HP y genera 1 carga al equipo
                const _ohAtk = gameState.characters[gameState.selectedCharacter];
                const _ohMyTeam = _ohAtk ? _ohAtk.team : 'team1';
                const _ohEnemyTeam = _ohMyTeam === 'team1' ? 'team2' : 'team1';
                const _ohEnemies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _ohEnemyTeam && !c.isDead && c.hp > 0; });
                if (_ohEnemies.length === 0) { addLog('👁️ Ojo Hexagonal: No hay objetivos', 'info'); }
                else {
                    for (let _i = 0; _i < 5; _i++) {
                        const _tn = _ohEnemies[Math.floor(Math.random() * _ohEnemies.length)];
                        const _tc = gameState.characters[_tn];
                        if (!_tc || _tc.isDead || _tc.hp <= 0) continue;
                        const _hasVen = (_tc.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'veneno');
                        applyDamageWithShield(_tn, 1, gameState.selectedCharacter);
                        if (_hasVen) {
                            for (const _an in gameState.characters) {
                                const _a = gameState.characters[_an];
                                if (_a && _a.team === _ohMyTeam && !_a.isDead && _a.hp > 0) {
                                    _a.hp = Math.min(_a.maxHp, (_a.hp||0) + 1);
                                    _a.charges = Math.min(20, (_a.charges||0) + 1);
                                }
                            }
                            addLog('👁️ Ojo Hexagonal: Golpe a ' + _tn + ' (con Veneno) — equipo aliado +1 HP y +1 carga', 'heal');
                        } else { addLog('👁️ Ojo Hexagonal: 1 daño a ' + _tn, 'damage'); }
                    }
                }

            } else if (ability.effect === 'danza_ciempies_shinobu') {
                // MT 10 golpes — aplica Veneno 3T por golpe + cura 3 HP y genera 3 cargas a aliado aleatorio por Veneno aplicado
                const _dcAtk = gameState.characters[gameState.selectedCharacter];
                const _dcMyTeam = _dcAtk ? _dcAtk.team : 'team1';
                const _dcEnemyTeam = _dcMyTeam === 'team1' ? 'team2' : 'team1';
                const _dcEnemies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _dcEnemyTeam && !c.isDead && c.hp > 0; });
                if (_dcEnemies.length === 0) { addLog('🐛 Danza del Ciempiés: No hay objetivos', 'info'); }
                else {
                    for (let _i = 0; _i < 10; _i++) {
                        const _tn = _dcEnemies[Math.floor(Math.random() * _dcEnemies.length)];
                        const _tc = gameState.characters[_tn];
                        if (!_tc || _tc.isDead || _tc.hp <= 0) continue;
                        applyDamageWithShield(_tn, 1, gameState.selectedCharacter);
                        applyPoison(_tn, 3);
                        addLog('🐛 Danza del Ciempiés: Veneno 3T aplicado a ' + _tn, 'debuff');
                        // Cura 3 HP y genera 3 cargas a un aliado aleatorio
                        const _allies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _dcMyTeam && !c.isDead && c.hp > 0; });
                        if (_allies.length > 0) {
                            const _randAlly = _allies[Math.floor(Math.random() * _allies.length)];
                            const _ra = gameState.characters[_randAlly];
                            if (typeof canHeal === 'function' && !canHeal(_randAlly)) { addLog('☀️ QS bloquea curación (Danza del Ciempiés)', 'debuff'); } else {
                            _ra.hp = Math.min(_ra.maxHp, (_ra.hp||0) + 3);
                            addLog('🐛 Danza del Ciempiés: ' + _randAlly + ' +3 HP y +3 cargas', 'heal'); }
                            _ra.charges = Math.min(20, (_ra.charges||0) + 3);
                        }
                    }
                }

            // ══════════════════════════════════════════════════════
            // REY BRUJO DE ANGMAR
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'espada_morgul_rba') {
                // ST — 2 daño + Veneno 1T + si ya tenía Veneno: Esquiva Área 2T al Rey Brujo
                const _emAtk = gameState.characters[gameState.selectedCharacter];
                const _emTgt = gameState.characters[targetName];
                const _emHadVenom = _emTgt && (_emTgt.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'veneno');
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyPoison(targetName, 1);
                addLog('⚔️ Espada Morgul: ' + finalDamage + ' daño + Veneno 1T a ' + targetName, 'damage');
                if (_emHadVenom && _emAtk) {
                    _emAtk.statusEffects = (_emAtk.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'esquiva area');
                    _emAtk.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 2, emoji: '💨' });
                    addLog('⚔️ Espada Morgul: Rey Brujo gana Esquiva Área 2T (objetivo tenía Veneno)', 'buff');
                }

            } else if (ability.effect === 'grito_mordor_rba') {
                // AOE — Silenciar + 50% eliminar 2 cargas si tiene Veneno
                const _gmAtk = gameState.characters[gameState.selectedCharacter];
                const _gmEnemyTeam = _gmAtk ? (_gmAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _gmEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                    applySilenciar(_n, 1);
                    const _hasVen = (_c.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'veneno');
                    if (_hasVen && Math.random() < 0.50) {
                        _c.charges = Math.max(0, (_c.charges||0) - 2);
                        addLog('💀 Grito de Mordor: ' + _n + ' pierde 2 cargas (tenía Veneno)', 'debuff');
                    }
                }
                addLog('💀 Grito de Mordor: Silenciar AOE aplicado', 'debuff');

            } else if (ability.effect === 'corona_hierro_rba') {
                // SELF — cura 2 HP por cada Veneno activo en ambos equipos a Rey Brujo y aliado aleatorio
                const _chAtk = gameState.characters[gameState.selectedCharacter];
                if (_chAtk) {
                    let _chVenenos = 0;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.isDead || _c.hp <= 0) continue;
                        if ((_c.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'veneno')) _chVenenos++;
                    }
                    const _chHeal = _chVenenos * 2;
                    if (_chHeal === 0) { addLog('👑 Corona de Hierro: No hay Venenos activos', 'info'); }
                    else {
                        _chAtk.hp = Math.min(_chAtk.maxHp, (_chAtk.hp||0) + _chHeal);
                        addLog('👑 Corona de Hierro: Rey Brujo recupera ' + _chHeal + ' HP', 'heal');
                        // Aliado aleatorio
                        const _chAllies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === _chAtk.team && !c.isDead && c.hp > 0 && n !== gameState.selectedCharacter; });
                        if (_chAllies.length > 0) {
                            const _rAlly = _chAllies[Math.floor(Math.random() * _chAllies.length)];
                            gameState.characters[_rAlly].hp = Math.min(gameState.characters[_rAlly].maxHp, (gameState.characters[_rAlly].hp||0) + _chHeal);
                            addLog('👑 Corona de Hierro: ' + _rAlly + ' recupera ' + _chHeal + ' HP', 'heal');
                        }
                    }
                }

            } else if (ability.effect === 'mano_sauron_rba') {
                // AOE — limpia todos los Venenos enemigos y causa daño = turnos restantes de cada Veneno
                const _msAtk = gameState.characters[gameState.selectedCharacter];
                const _msEnemyTeam = _msAtk ? (_msAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _msEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                    const _venEffects = (_c.statusEffects||[]).filter(e => e && normAccent(e.name||'') === 'veneno');
                    if (_venEffects.length > 0) {
                        let _msDmg = 0;
                        _venEffects.forEach(e => { _msDmg += (e.duration || 0); });
                        _c.statusEffects = (_c.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'veneno');
                        if (_msDmg > 0) {
                            applyDamageWithShield(_n, _msDmg, gameState.selectedCharacter);
                            addLog('🖐️ Mano de Sauron: ' + _n + ' recibe ' + _msDmg + ' daño (turnos de Veneno restantes) y Veneno limpiado', 'damage');
                        }
                    }
                }
                addLog('🖐️ Mano de Sauron: Todos los Venenos enemigos eliminados', 'debuff');

            } else if (ability.effect === 'susanoo_totsuka') {
                const _stTarget = gameState.characters[targetName];
                const _stAtk = gameState.characters[gameState.selectedCharacter];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                if (_stTarget && _stAtk) {
                    const _stStolen = _stTarget.charges || 0;
                    _stTarget.charges = 0;
                    _stAtk.charges = Math.min(20, (_stAtk.charges || 0) + _stStolen);
                    if (_stStolen > 0) addLog('Susanoo: roba ' + _stStolen + ' cargas de ' + targetName, 'buff');
                }
                applyDebuff(targetName, { name: 'Mega Aturdimiento', type: 'debuff', duration: 2, emoji: '💫', stun: true });
                applyWeaken(targetName, 2);
                addLog('Susanoo, Espada de Totsuka: ' + finalDamage + ' dano + Mega Aturdimiento + Debilitar', 'damage');

                     } else if (ability.effect === 'genjutsu_itachi') {
                // Nuevo: 1 daño + Posesión al objetivo + 1 carga por cada Buff activo del objetivo
                const _gjTgt = gameState.characters[targetName];
                // Contar buffs ANTES del golpe
                const _gjBuffs = _gjTgt ? (_gjTgt.statusEffects||[]).filter(function(e){
                    return e && e.type === 'buff' && !e.passiveHidden;
                }).length : 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('👁️ Genjutsu: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _gjTgtNow = gameState.characters[targetName];
                if (_gjTgtNow && !_gjTgtNow.isDead && _gjTgtNow.hp > 0) {
                    applyPossession(targetName, 1);
                    addLog('👁️ Genjutsu: Posesión aplicada a ' + targetName, 'debuff');
                }
                if (_gjBuffs > 0 && attacker) {
                    attacker.charges = Math.min(20, (attacker.charges||0) + _gjBuffs);
                    addLog('👁️ Genjutsu: +' + _gjBuffs + ' cargas (objetivo tenía ' + _gjBuffs + ' buff(s) activos)', 'buff');
                }

            } else if (ability.effect === 'tsukuyomi_itachi') {
                let _tsCount = 0;
                for (let _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.isDead) continue;
                    const _dbs = (_c.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    _tsCount += _dbs.length;
                    _c.statusEffects = (_c.statusEffects || []).filter(e => !e || e.type !== 'debuff' || e.permanent);
                    if (_dbs.length > 0 && typeof triggerRinneganCleanse === 'function') triggerRinneganCleanse(_n, _dbs.length);
                }
                const _tsTotalDmg = finalDamage + _tsCount;
                applyDamageWithShield(targetName, _tsTotalDmg, gameState.selectedCharacter);
                addLog('Tsukuyomi: ' + _tsTotalDmg + ' dano (' + finalDamage + ' base + ' + _tsCount + ' por debuffs disipados en ambos equipos)', 'damage');

            } else if (ability.effect === 'amaterasu_itachi') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFlatBurn(targetName, 4, 2);
                addLog('Amaterasu: ' + finalDamage + ' dano + Quemadura 4HP 2T a ' + targetName, 'damage');

            // vals_tanjiro viejo eliminado — usar handler nuevo más arriba

            } else if (ability.effect === 'cascada_agua') {
                // TANJIRO — Cascada de Agua: 2 AOE + 1 carga al equipo aliado por crit
                const _caAtk = gameState.characters[gameState.selectedCharacter];
                const _caTeam = _caAtk ? _caAtk.team : attacker.team;
                const _caEnemyTeam = _caTeam === 'team1' ? 'team2' : 'team1';
                if (checkAndRedirectAOEMegaProv(_caEnemyTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('💧 Cascada de Agua redirigida por Mega Provocación', 'damage');
                } else {
                    let _caCritCount = 0;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _caEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        const _caCrit = _caAtk && _caAtk.passive && _caAtk.passive.name === 'Olor de la Brecha' && Math.random() < 0.20;
                        let _caDmg = finalDamage;
                        if (_caCrit) { _caDmg *= 2; _caCritCount++; addLog('💥 ¡Crítico! Cascada de Agua en ' + _n, 'damage'); }
                        applyDamageWithShield(_n, _caDmg, gameState.selectedCharacter);
                    }
                    if (_caCritCount > 0) {
                        // +1 carga al equipo por cada crítico
                        for (const _n in gameState.characters) {
                            const _c = gameState.characters[_n];
                            if (_c && !_c.isDead && _c.hp > 0 && _c.team === _caTeam) {
                                _c.charges = Math.min(20, (_c.charges||0) + _caCritCount);
                            }
                        }
                        addLog('💧 Cascada de Agua: el equipo gana ' + _caCritCount + ' carga' + (_caCritCount>1?'s':'') + ' por críticos', 'buff');
                    }
                    applyAOEToSummons(_caEnemyTeam, finalDamage, gameState.selectedCharacter);
                addLog('💧 Cascada de Agua: ' + finalDamage + ' AOE', 'damage');
                }

            } else if (ability.effect === 'danza_dios_fuego') {
                // TANJIRO — Danza del Dios del Fuego: 5 ataques básicos aleatorios
                const _ddfAtk = gameState.characters[gameState.selectedCharacter];
                const _ddfEnemyTeam = _ddfAtk ? (_ddfAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _ddfBaseDmg = ((_ddfAtk && _ddfAtk.abilities && _ddfAtk.abilities[0]) ? (_ddfAtk.abilities[0].damage || 1) : 1);
                for (let _i = 0; _i < 5; _i++) {
                    const _enemies = Object.keys(gameState.characters).filter(function(n) {
                        const c = gameState.characters[n]; return c && c.team === _ddfEnemyTeam && !c.isDead && c.hp > 0;
                    });
                    if (_enemies.length === 0) break;
                    const _tgt = _enemies[Math.floor(Math.random() * _enemies.length)];
                    let _ddfDmg = _ddfBaseDmg;
                    const _ddfCrit = _ddfAtk && _ddfAtk.passive && _ddfAtk.passive.name === 'Olor de la Brecha' && Math.random() < 0.20;
                    if (_ddfCrit) { _ddfDmg *= 2; if (_ddfAtk) _ddfAtk.charges = Math.min(20, (_ddfAtk.charges||0)+1); addLog('💥 ¡Crítico! Danza golpe ' + (_i+1), 'damage'); }
                    applyDamageWithShield(_tgt, _ddfDmg, gameState.selectedCharacter);
                    addLog('🔥 Danza del Dios del Fuego golpe ' + (_i+1) + ': ' + _ddfDmg + ' daño a ' + _tgt, 'damage');
                }

            } else if (ability.effect === 'decimotercera_postura') {
                // TANJIRO — Decimotercera Postura (alias) — misma lógica nueva
                const _dpAtk = gameState.characters[gameState.selectedCharacter];
                const _dpEnemyTeam = _dpAtk ? (_dpAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _dpBasic = (_dpAtk && _dpAtk.abilities) ? _dpAtk.abilities[0] : null;
                const _dpBaseDmg = _dpBasic ? (_dpBasic.damage || 1) : 1;
                const _dpBaseCg = _dpBasic ? (_dpBasic.chargeGain || 0) : 0;
                for (let _i = 0; _i < 13; _i++) {
                    const _enemies = Object.keys(gameState.characters).filter(function(n) {
                        const c = gameState.characters[n]; return c && c.team === _dpEnemyTeam && !c.isDead && c.hp > 0;
                    });
                    if (_enemies.length === 0) break;
                    const _tgt = _enemies[Math.floor(Math.random() * _enemies.length)];
                    const _tgtChar = gameState.characters[_tgt];
                    applyDamageWithShield(_tgt, _dpBaseDmg, gameState.selectedCharacter);
                    addLog('🌊 Decimotercera Postura golpe ' + (_i+1) + ': ' + _dpBaseDmg + ' daño a ' + _tgt, 'damage');
                    if (_dpBaseCg > 0 && _dpAtk) _dpAtk.charges = Math.min(20, (_dpAtk.charges||0) + _dpBaseCg);
                    if (_tgtChar && !_tgtChar.isDead && Math.random() < 0.50 && _tgtChar.charges > 0) {
                        _tgtChar.charges = Math.max(0, _tgtChar.charges - 1);
                        addLog('⚡ Decimotercera Postura: ' + _tgt + ' pierde 1 carga', 'damage');
                    }
                    if (_dpAtk && Math.random() < 0.50) {
                        for (const _aln in gameState.characters) {
                            const _alc = gameState.characters[_aln];
                            if (!_alc || _alc.isDead || _alc.hp <= 0 || _alc.team !== _dpAtk.team) continue;
                            _alc.charges = Math.min(20, (_alc.charges||0) + 1);
                        }
                        addLog('🌊 Olor de la Brecha (golpe ' + (_i+1) + '): +1 carga al equipo aliado', 'buff');
                    }
                }
                addLog('🌊 Decimotercera Postura: 13 golpes completados', 'damage');
            } else if (ability.effect === 'ryusui_garou') {
                // GAROU — Ryusui Gansai-ken: 2 daño + reduce 2 cargas + Garou recupera 2 HP
                const _rgAtk = gameState.characters[gameState.selectedCharacter];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const _rgTarget = gameState.characters[targetName];
                if (_rgTarget) {
                    const _rgDrain = Math.min(2, _rgTarget.charges || 0);
                    _rgTarget.charges = Math.max(0, (_rgTarget.charges||0) - 2);
                    if (_rgDrain > 0) addLog('⚡ Ryusui: ' + targetName + ' pierde ' + _rgDrain + ' cargas', 'debuff');
                }
                // Garou heals 2 HP (basic attack heal from passive context — done here)
                if (_rgAtk) {
                    const _rgOldHp = _rgAtk.hp;
                    _rgAtk.hp = Math.min(_rgAtk.maxHp, (_rgAtk.hp||0) + 2);
                    if (_rgAtk.hp > _rgOldHp) addLog('🐾 Cazador de Héroes: Garou recupera ' + (_rgAtk.hp - _rgOldHp) + ' HP', 'heal');
                }
                addLog('🐾 Ryusui Gansai-ken: ' + finalDamage + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'cross_fang_garou') {
                // GAROU — Cross Fang Dragon Slayer Fist: 4 + 2 por cada personaje derrotado
                let _cfBonus = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n]; if (_c && _c.isDead) _cfBonus += 2;
                }
                const _cfTotal = finalDamage + _cfBonus;
                if (_cfBonus > 0) addLog('🐾 Cross Fang: +' + _cfBonus + ' daño por personajes derrotados', 'damage');
                applyDamageWithShield(targetName, _cfTotal, gameState.selectedCharacter);
                addLog('🐾 Cross Fang Dragon Slayer Fist: ' + _cfTotal + ' daño total a ' + targetName, 'damage');

            } else if (ability.effect === 'gamma_ray_garou') {
                // GAROU — Gamma Ray Burst: 1 AOE + bonus por cargas del objetivo
                const _grAtk = gameState.characters[gameState.selectedCharacter];
                const _grEnemyTeam = _grAtk ? (_grAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                if (checkAndRedirectAOEMegaProv(_grEnemyTeam, finalDamage, gameState.selectedCharacter)) {
                    addLog('🐾 Gamma Ray Burst redirigida por Mega Provocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _grEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) { addLog('🌟 ' + _n + ' es inmune (Esquiva Área)', 'buff'); continue; }
                        const _grDmg = finalDamage + (_c.charges || 0);
                        applyDamageWithShield(_n, _grDmg, gameState.selectedCharacter);
                        applyAOEToSummons(_grEnemyTeam, finalDamage, gameState.selectedCharacter);
                addLog('🐾 Gamma Ray Burst: ' + _grDmg + ' daño a ' + _n + ' (' + (_c.charges||0) + ' cargas)', 'damage');
                    }
                }

            } else if (ability.effect === 'saitama_mode_garou') {
                // GAROU — Saitama Mode: inmunidad a debuffs + 50% reducción de daño recibido
                const _smAtk = gameState.characters[gameState.selectedCharacter];
                if (_smAtk) {
                    _smAtk.garouSaitamaMode = true;
                    _smAtk.immuneToDebuffs = true; // used by isImmuneToDebuff
                    // Apply a permanent damage reduction buff (checked in applyDamageWithShield)
                    applyBuff(gameState.selectedCharacter, {
                        name: 'Saitama Mode', type: 'buff', duration: 999, permanent: true, emoji: '💀',
                        damageReduction: 0.50, description: 'Inmune a debuffs. Recibe 50% menos daño.'
                    });
                    addLog('💀 Saitama Mode: Garou activa inmunidad y reducción de daño 50%', 'buff');
                }
            } else if (ability.effect === 'campo_atraccion') {
                // LINTERNA VERDE — Campo de Atracción: Provocación + Esquivar, 1 turno cada uno
                // Ambos buffs expiran al inicio del siguiente turno del personaje (duration:1)
                const _lgName = gameState.selectedCharacter;
                // Remove existing copies first to avoid stacking
                const _lgChar = gameState.characters[_lgName];
                if (_lgChar) {
                    _lgChar.statusEffects = (_lgChar.statusEffects || []).filter(function(e){
                        return e && e.name !== 'Provocacion' && e.name !== 'Esquivar';
                    });
                }
                applyBuff(_lgName, { name: 'Provocacion', type: 'buff', duration: 2, emoji: '⚠️', description: 'Provocación: enemigos deben atacarte (expira en el próximo turno de Linterna Verde)' });
                applyBuff(_lgName, { name: 'Esquivar', type: 'buff', duration: 2, emoji: '💨', description: 'Esquivar: 50% de esquivar cualquier ataque (expira en el próximo turno de Linterna Verde)' });
                addLog('💚 Campo de Atracción: ' + _lgName + ' activa Provocación + Esquivar (hasta el próximo turno)', 'buff');

            } else if (ability.effect === 'sincronia_esmeralda') {
                // LINTERNA VERDE — Sincronía Esmeralda: limpia 1 debuff del aliado + 3 cargas
                const _seChar = gameState.characters[targetName];
                if (_seChar) {
                    const _seDebuffs = (_seChar.statusEffects || []).filter(e => e && e.type === 'debuff');
                    if (_seDebuffs.length > 0) {
                        // Remove oldest debuff (first in array)
                        const _seRemoved = _seDebuffs[0];
                        _seChar.statusEffects = (_seChar.statusEffects || []).filter(e => e !== _seRemoved);
                        addLog('💚 Sincronía Esmeralda: Debuff ' + _seRemoved.name + ' eliminado de ' + targetName, 'buff');
                    } else {
                        addLog('💚 Sincronía Esmeralda: ' + targetName + ' no tiene debuffs activos', 'info');
                    }
                    _seChar.charges = Math.min(20, (_seChar.charges || 0) + 3);
                    addLog('💚 ' + targetName + ' genera 3 cargas (Sincronía Esmeralda)', 'buff');
                }

            } else if (ability.effect === 'soporte_vital') {
                // LINTERNA VERDE — Soporte Vital Autónomo: ambos recuperan 5 HP + limpian debuffs
                const _svLG = gameState.characters[gameState.selectedCharacter];
                const _svAlly = gameState.characters[targetName];
                // Heal + cleanse both
                [{ name: gameState.selectedCharacter, char: _svLG }, { name: targetName, char: _svAlly }].forEach(function(obj) {
                    if (!obj.char) return;
                    const _svOld = obj.char.hp;
                    obj.char.hp = Math.min(obj.char.maxHp, obj.char.hp + 5);
                    const _svHeal = obj.char.hp - _svOld;
                    if (_svHeal > 0) {
                        addLog('💚 ' + obj.name + ' recupera ' + _svHeal + ' HP (Soporte Vital)', 'heal');
                        triggerBendicionSagrada(obj.char.team, _svHeal);
                    }
                    const _svBefore = (obj.char.statusEffects || []).filter(e => e && e.type === 'debuff').length;
                    obj.char.statusEffects = (obj.char.statusEffects || []).filter(e => !e || e.type !== 'debuff');
                    if (_svBefore > 0) addLog('💚 ' + obj.name + ': ' + _svBefore + ' debuff' + (_svBefore>1?'s':'') + ' disipado' + (_svBefore>1?'s':'') + ' (Soporte Vital)', 'buff');
                });

            } else if (ability.effect === 'lanza_de_oa') {
                // LINTERNA VERDE — La Lanza de Oa: 2 + 5~10 daño + Mega Aturdimiento + lifesteal total
                const _loaBase = finalDamage; // 2
                const _loaBonus = Math.floor(Math.random() * 6) + 5; // 5-10
                const _loaTotal = _loaBase + _loaBonus;
                applyDamageWithShield(targetName, _loaTotal, gameState.selectedCharacter);
                applyStun(gameState.selectedCharacter === targetName ? targetName : targetName, 2); // Mega Aturdimiento
                // Lifesteal: Linterna Verde recovers HP equal to total damage dealt
                const _lgLoa = gameState.characters[gameState.selectedCharacter];
                if (_lgLoa) {
                    const _loaHealOld = _lgLoa.hp;
                    _lgLoa.hp = Math.min(_lgLoa.maxHp, _lgLoa.hp + _loaTotal);
                    const _loaHeal = _lgLoa.hp - _loaHealOld;
                    if (_loaHeal > 0) {
                        addLog('💚 Linterna Verde recupera ' + _loaHeal + ' HP (Lanza de Oa)', 'heal');
                        triggerBendicionSagrada(_lgLoa.team, _loaHeal);
                    }
                }
                addLog('💚 La Lanza de Oa: ' + _loaTotal + ' daño (' + _loaBase + '+' + _loaBonus + ') + Mega Aturdimiento a ' + targetName, 'damage');
            } else if (ability.effect === 'heal_cleanse') {
                // Tamayo básico Aguja Medicinal: cura 1 HP + limpia 1 debuff del aliado objetivo
                const hcC = gameState.characters[targetName];
                if (hcC) {
                    const hcOld = hcC.hp;
                    hcC.hp = Math.min(hcC.maxHp, hcC.hp + (ability.heal || 1));
                    if (hcC.hp > hcOld) addLog('💚 Aguja Medicinal: ' + targetName + ' recupera ' + (hcC.hp - hcOld) + ' HP', 'heal');
                    const hcD = (hcC.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (hcD.length > 0) {
                        hcC.statusEffects = hcC.statusEffects.filter(e => e !== hcD[0]);
                        addLog('💚 Aguja Medicinal: Limpia ' + (hcD[0].name||'debuff') + ' de ' + targetName, 'buff');
                    }
                    triggerBendicionSagrada(attacker.team, hcC.hp - hcOld);
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'colapso_dimensional') {
                // Aspros Colapso Dimensional: daño + 2 debuffs aleatorios, +1 carga
                applyDamageWithShield(targetName, finalDamage, charName);
                const cdPool = [
                    function() { applyConfusion(targetName, 1); },
                    function() { applyWeaken(targetName, 2); },
                    function() { applyFreeze(targetName, 1); },
                    function() { applyFear(targetName, 1); },
                    function() { applyBleed(targetName, 1); },
                    function() { applyStun(targetName, 1); },
                ];
                cdPool.sort(() => Math.random() - 0.5).slice(0, 2).forEach(f => f());
                addLog('🌀 Colapso Dimensional: ' + targetName + ' sufre 2 debuffs aleatorios', 'debuff');
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'another_dimension') {
                // Aspros Another Dimension: daño + roba mitad de cargas, +1 carga
                applyDamageWithShield(targetName, finalDamage, charName);
                const adTgt = gameState.characters[targetName];
                if (adTgt) {
                    const adSteal = Math.floor((adTgt.charges || 0) / 2);
                    if (adSteal > 0) {
                        adTgt.charges -= adSteal;
                        attacker.charges = Math.min(20, (attacker.charges || 0) + adSteal);
                        addLog('🌀 Another Dimension: ' + charName + ' roba ' + adSteal + ' cargas de ' + targetName, 'buff');
                    }
                }
                generateChargesInline(charName, ability.chargeGain);

            } else if (ability.effect === 'arc_geminga') {
                // Aspros OVER: daño doble si enemigo tiene debuffs
                const agTgt = gameState.characters[targetName];
                let agDmg = finalDamage;
                if (agTgt && (agTgt.statusEffects || []).some(e => e && e.type === 'debuff')) {
                    agDmg *= 2;
                    addLog('💥 Arc Geminga: ¡Daño doble! (' + targetName + ' tiene debuffs)', 'damage');
                }
                applyDamageWithShield(targetName, agDmg, charName);

                        } else if (ability.target === 'single' &&
                           ability.effect !== 'rinbo_hengoku_madara' &&
                           ability.effect !== 'susanoo_madara' &&
                           ability.effect !== 'rikudo_mode_madara' &&
                           ability.effect !== 'chibaku_tensei_madara' &&
                           ability.effect !== 'voluntad_mordor_sauron' &&
                           ability.effect !== 'mano_negra_sauron' &&
                           ability.effect !== 'senor_oscuro_sauron' &&
                           ability.effect !== 'poder_anillo_sauron' &&
                           ability.effect !== 'devastator_punish' &&
                           ability.effect !== 'senor_oscuro' &&
                           ability.effect !== 'hermana_oscura_daemon' &&
                           ability.effect !== 'furia_caraxes_daemon' &&
                           ability.effect !== 'ojo_dioses_daemon' &&
                           ability.effect !== 'ilusion_diabolica_ikki' &&
                           ability.effect !== 'despertar_fenix_ikki') {
                // Daño a un solo objetivo (genérico — solo para ataques SIN handler propio)
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${finalDamage} de daño`, 'damage');
                
            } else if (ability.target === 'aoe' && ability.effect !== 'luz_del_alba_tirion' &&
                       ability.effect !== 'portador_cenizas_tirion' &&
                       ability.effect !== 'respiracion_solar_yorichi' &&
                       ability.effect !== 'sol_ascendente' &&
                       ability.effect !== 'profecia_faraon_marik' &&
                       ability.effect !== 'hou_yoku_tenshou_ikki' &&
                       ability.effect !== 'skill_drain') {
                // ── GENÉRICO AOE: con Mega Provocación y Esquiva Área ──
                const attackerTeam = attacker.team;
                const targetTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(targetTeam);

                const _genMPData = checkKamishMegaProvocation(targetTeam);
                if (_genMPData) {
                    // MEGA PROVOCACIÓN activa — holder absorbe daño × total aliados
                    const _genMult = countMegaProvMultiplier(targetTeam, _genMPData);
                    const _genTotalDmg = finalDamage * _genMult;
                    const _genHolderName = _genMPData.isCharacter ? _genMPData.characterName : null;
                    if (_genMPData.isCharacter) {
                        applyDamageWithShield(_genHolderName, _genTotalDmg, gameState.selectedCharacter);
                        addLog('🎯 ' + _genHolderName + ' (Mega Provocación) absorbe ' + _genTotalDmg + ' daño AOE (' + finalDamage + '×' + _genMult + ')', 'damage');
                    } else {
                        applySummonDamage(_genMPData.id, _genTotalDmg, gameState.selectedCharacter);
                        addLog('🎯 ' + (_genMPData.holder ? _genMPData.holder.name : 'Invocación') + ' (Mega Provocación) absorbe ' + _genTotalDmg + ' daño AOE (' + finalDamage + '×' + _genMult + ')', 'damage');
                    }
                } else {
                    // Sin Mega Provocación — AOE normal con Esquiva Área
                    for (let _gn in gameState.characters) {
                        const _gc = gameState.characters[_gn];
                        if (!_gc || _gc.team !== targetTeam || _gc.isDead || _gc.hp <= 0) continue;
                        if (checkAsprosAOEImmunity(_gn) || checkMinatoAOEImmunity(_gn)) {
                            addLog('🌟 ' + _gn + ' es inmune al AOE (Esquiva Área)', 'buff'); continue;
                        }
                        applyDamageWithShield(_gn, finalDamage, gameState.selectedCharacter);
                    }
                    for (let _gSId in gameState.summons) {
                        const _gS = gameState.summons[_gSId];
                        if (_gS && _gS.team === targetTeam && _gS.hp > 0)
                            applySummonDamage(_gSId, finalDamage, gameState.selectedCharacter);
                    }
                    addLog('💥 AOE: ' + finalDamage + ' daño a todos los enemigos', 'damage');
                }
            } else if (ability.target === 'self') {
                // Efecto en uno mismo (genérico)
                if (ability.effect === 'attack_buff') {
                    addLog(`🔥 ${gameState.selectedCharacter} usa ${ability.name} aumentando su poder de ataque`, 'buff');
                } else if (ability.effect === 'defense_buff') {
                    addLog(`🛡️ ${gameState.selectedCharacter} usa ${ability.name} aumentando su defensa`, 'buff');
                } else {
                    addLog(`✨ ${gameState.selectedCharacter} usa ${ability.name}`, 'buff');
                }
                
            } else if (ability.target === 'team') {
                // Efecto en todo el equipo (genérico)
                if (ability.effect === 'heal') {
                    const team = attacker.team;
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === team && char.hp > 0 && !char.isDead) {
                            const oldHp = char.hp;
                            char.hp = Math.min(char.maxHp, char.hp + 5);
                            const actualHeal = char.hp - oldHp;
                            if (actualHeal > 0) {
                                triggerBendicionSagrada(team, actualHeal);
                            }
                        }
                    }
                    addLog(`💚 ${gameState.selectedCharacter} usa ${ability.name} curando 5 HP a su equipo`, 'heal');
                } else {
                    addLog(`🛡️ ${gameState.selectedCharacter} usa ${ability.name} en su equipo`, 'buff');
                }
            }
            
            // Ganar cargas después de la habilidad (excepto multi_hit que ya lo hace)
            // MIEDO: no puede generar cargas
            const hasFear = hasStatusEffect(gameState.selectedCharacter, 'Miedo');
            if (ability.effect !== 'multi_hit') {
                if (finalChargeGain > 0 && !hasFear) {
                    let gainConc2 = finalChargeGain;
                    if (hasStatusEffect(gameState.selectedCharacter, 'Concentracion')) {
                        gainConc2 *= 2;
                        addLog(`🎯 Concentración: ${gameState.selectedCharacter} duplica cargas (${gainConc2})`, 'buff');
                    }
                    attacker.charges = Math.min(20, (attacker.charges || 0) + gainConc2);
                    addLog(`⚡ ${gameState.selectedCharacter} genera ${gainConc2} carga${finalChargeGain > 1 ? 's' : ''}`, 'buff');
                    // MVP: registrar cargas generadas para sí mismo
                    if (typeof registerChargeGen === 'function') registerChargeGen(gameState.selectedCharacter, gainConc2, true);
                    if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-charge', 500);
                    if (typeof _triggerChargePop === 'function') _triggerChargePop(gameState.selectedCharacter);
                    triggerIgrisPassive(gameState.selectedCharacter);
                } else if (finalChargeGain > 0 && hasFear) {
                    addLog(`😱 ${gameState.selectedCharacter} no puede generar cargas (Miedo)`, 'damage');
                }

                // ── GOKU PASIVA: Entrenamiento de los Dioses ──
                // +2 cargas si tiene Furia Y Frenesi al atacar
                if ((gameState.selectedCharacter === 'Goku' || gameState.selectedCharacter === 'Goku v2') && !hasFear && finalDamage > 0) {
                    const hasFuria = hasStatusEffect('Goku', 'Furia');
                    const hasFrenesi = hasStatusEffect('Goku', 'Frenesi');
                    if (hasFuria && hasFrenesi) {
                        attacker.charges = Math.min(20, attacker.charges + 2);
                        addLog(`🔥 Entrenamiento de los Dioses: Goku genera +2 cargas (Furia+Frenesí)`, 'buff');
                    }
                }
                // ── MINATO PASIVA: +1 carga por enemigo golpeado más lento ──
                if ((gameState.selectedCharacter === 'Minato Namikaze' || gameState.selectedCharacter === 'Minato Namikaze v2') && !hasFear && finalDamage > 0 && targetName) {
                    const tgtMinato = gameState.characters[targetName];
                    if (tgtMinato && !tgtMinato.isDead && tgtMinato.speed < attacker.speed) {
                        attacker.charges = Math.min(20, attacker.charges + 2);
                        addLog(`⚡ Hiraishin no Jutsu: Minato genera +2 cargas (enemigo más lento: ${tgtMinato.speed} vs ${attacker.speed})`, 'buff');
                    }
                }
            }
            
            // ── MINATO PASIVA (AOE): +1 carga por CADA enemigo golpeado más lento ──
            if ((gameState.selectedCharacter === 'Minato Namikaze' || gameState.selectedCharacter === 'Minato Namikaze v2') && ability.target === 'aoe') {
                const hasFearM = hasStatusEffect('Minato Namikaze', 'Miedo');
                if (!hasFearM) {
                    const enemyTeamM = attacker.team === 'team1' ? 'team2' : 'team1';
                    let bonusChargesM = 0;
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === enemyTeamM && !c.isDead && c.hp > 0 && c.speed < attacker.speed) {
                            bonusChargesM += 2;
                        }
                    }
                    if (bonusChargesM > 0) {
                        attacker.charges = Math.min(20, attacker.charges + bonusChargesM);
                        addLog(`⚡ Hiraishin no Jutsu: Minato genera +${bonusChargesM} cargas (enemigos más lentos)`, 'buff');
                    }
                }
} else if (ability.effect === 'fuego_fatuo_manigoldo') {
                const _ffA=gameState.characters[gameState.selectedCharacter],_ffT=gameState.characters[targetName];
                applyDamageWithShield(targetName,finalDamage,gameState.selectedCharacter);
                if(_ffA&&_ffT&&!_ffT.isDead&&_ffT.hp>0){const _ffL=_ffA.hp<=Math.floor(_ffA.maxHp*0.50);if(_ffL||Math.random()<0.25){const _s=Math.min(2,_ffT.hp);_ffT.hp=Math.max(0,_ffT.hp-_s);if(_ffT.hp<=0)_ffT.isDead=true;if(typeof applyHeal==='function')applyHeal(gameState.selectedCharacter,_s,'Fuego Fatuo');else _ffA.hp=Math.min(_ffA.maxHp,(_ffA.hp||0)+_s);addLog('☠️ Fuego Fatuo: roba '+_s+' HP','heal');}if(_ffL||Math.random()<0.25){const _sc=Math.min(2,_ffT.charges||0);if(_sc>0){_ffT.charges-=_sc;_ffA.charges=Math.min(20,(_ffA.charges||0)+_sc);addLog('☠️ Fuego Fatuo: roba '+_sc+' cargas','buff');}}}
            } else if (ability.effect === 'explosion_almas_manigoldo') {
                const _eaA=gameState.characters[gameState.selectedCharacter],_eaE=_eaA?(_eaA.team==='team1'?'team2':'team1'):'team2';
                let _eaB=0,_eaD=0;
                for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.isDead)continue;(_c.statusEffects||[]).forEach(function(e){if(!e)return;if(e.type==='buff'&&!e.passiveHidden)_eaB++;if(e.type==='debuff')_eaD++;});}
                // Usar applyDamageWithShield para registrar kills, daño y daño recibido correctamente
                if(_eaB>0) {
                    for(const _n in gameState.characters){
                        const _c=gameState.characters[_n];
                        if(!_c||_c.team!==_eaE||_c.isDead||_c.hp<=0)continue;
                        applyDamageWithShield(_n, _eaB, gameState.selectedCharacter);
                        addLog('☠️ Explosión de Almas: '+_eaB+' daño a '+_n,'damage');
                    }
                }
                if(_eaD>0&&_eaA){_eaA.charges=Math.min(20,(_eaA.charges||0)+_eaD);addLog('☠️ Explosión de Almas: +'+_eaD+' cargas','buff');}
            } else if (ability.effect === 'prision_yomotsu_manigoldo') {
                applyDamageWithShield(targetName,finalDamage,gameState.selectedCharacter);
                addLog('☠️ Prisión del Yomotsu: '+finalDamage+' daño','damage');
                if(Math.random()<0.50){const _pp=['congelacion','megacongelacion','aturdimiento','mega_aturdimiento','posesion','mega_posesion','miedo','silenciar'].sort(()=>Math.random()-0.5);const _pn=1+Math.floor(Math.random()*3);for(let _pi=0;_pi<_pn;_pi++){const _pt=gameState.characters[targetName];if(!_pt||_pt.isDead||_pt.hp<=0)break;const _d=_pp[_pi];if(_d==='congelacion')applyFreeze(targetName,2);else if(_d==='megacongelacion')applyFreeze(targetName,2,true);else if(_d==='aturdimiento')applyStun(targetName,1);else if(_d==='mega_aturdimiento')applyStun(targetName,2);else if(_d==='posesion'||_d==='mega_posesion')applyStun(targetName,_d==='mega_posesion'?2:1);else if(_d==='miedo')applyFear(targetName,2);else if(_d==='silenciar')applySilenciar(targetName,2);}addLog('☠️ Prisión del Yomotsu: '+_pn+' debuffs','debuff');}
            } else if (ability.effect === 'ondas_infernales_manigoldo') {
                const _oi=gameState.characters[targetName],_oiA=_oi&&!_oi.isDead&&_oi.hp>0;
                applyDamageWithShield(targetName,finalDamage,gameState.selectedCharacter);
                addLog('☠️ Ondas Infernales: '+finalDamage+' daño','damage');
                if(_oiA&&_oi&&!_oi.isDead&&_oi.hp>0){applyStun(targetName,2);const _oiC=_oi.charges||0;if(_oiC>0){attacker.charges=Math.min(20,(attacker.charges||0)+_oiC);_oi.charges=0;addLog('☠️ Ondas Infernales: roba '+_oiC+' cargas + Mega Aturdimiento','buff');}}
            } else if (ability.effect === 'luz_del_alba_tirion') {
                const _ld=gameState.characters[gameState.selectedCharacter],_ldE=_ld?(_ld.team==='team1'?'team2':'team1'):'team2',_ldA=_ld?_ld.team:'team1';
                if(checkAndRedirectAOEMegaProv(_ldE,finalDamage,gameState.selectedCharacter)){addLog('🌟 Luz del Alba redirigida','damage');}else{for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.team!==_ldE||_c.isDead||_c.hp<=0)continue;if(checkAsprosAOEImmunity(_n,true)||checkMinatoAOEImmunity(_n))continue;applyDamageWithShield(_n,finalDamage,gameState.selectedCharacter);}}
                for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.team!==_ldA||_c.isDead||_c.hp<=0)continue;if(typeof applyHeal==='function')applyHeal(_n,1,'Luz del Alba');else if(typeof canHeal==='function'?canHeal(_n):true)_c.hp=Math.min(_c.maxHp,(_c.hp||0)+1);if(!hasStatusEffect(_n,'Aura de Luz')&&!hasStatusEffect(_n,'Aura de luz')){if(typeof applyBuff==='function')applyBuff(_n,{name:'Aura de Luz',type:'buff',duration:2,emoji:'✨'});}}
                addLog('🌟 Luz del Alba: 1 AOE + 1 HP cura + Aura de Luz al equipo aliado','buff');
            } else if (ability.effect === 'proteccion_luz_tirion') {
                const _pl=gameState.characters[targetName];
                if(_pl){if(typeof applyHeal==='function')applyHeal(targetName,3,'Protección de la Luz');else if(typeof canHeal==='function'?canHeal(targetName):true)_pl.hp=Math.min(_pl.maxHp,(_pl.hp||0)+3);const _pld=(_pl.statusEffects||[]).filter(function(e){return e&&e.type==='debuff'&&!e.permanent;});_pl.statusEffects=(_pl.statusEffects||[]).filter(function(e){return !e||e.type!=='debuff'||e.permanent;});if(_pld.length>0){_pl.charges=Math.min(20,(_pl.charges||0)+_pld.length*2);addLog('🌟 Protección: '+_pld.length+' debuffs → +'+((_pld.length*2))+' cargas a '+targetName,'buff');}}
            } else if (ability.effect === 'portador_cenizas_tirion') {
                const _pc=gameState.characters[gameState.selectedCharacter],_pcE=_pc?(_pc.team==='team1'?'team2':'team1'):'team2',_pcA=_pc?_pc.team:'team1';
                if(checkAndRedirectAOEMegaProv(_pcE,finalDamage,gameState.selectedCharacter)){addLog('🌟 Portador redirigido','damage');}else{for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.team!==_pcE||_c.isDead||_c.hp<=0)continue;if(checkAsprosAOEImmunity(_n,true)||checkMinatoAOEImmunity(_n))continue;applyDamageWithShield(_n,finalDamage,gameState.selectedCharacter);}}
                const _pcH=Math.ceil((_pc?_pc.hp:1)*0.50);
                for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.team!==_pcA||_c.isDead||_c.hp<=0)continue;if(typeof applyHeal==='function')applyHeal(_n,_pcH,'Portador');else if(typeof canHeal==='function'?canHeal(_n):true)_c.hp=Math.min(_c.maxHp,(_c.hp||0)+_pcH);}
                addLog('🌟 Portador de Cenizas: cura '+_pcH+' HP','heal');
                for(const _n in gameState.characters){const _c=gameState.characters[_n];if(!_c||_c.team!==_pcE||_c.isDead||_c.hp<=0||!_c._wasRevived)continue;_c.team=_pcA;delete _c._wasRevived;addLog('🌟 '+_n+' cambia de bando','buff');}
            } else if (ability.effect === 'luz_oscuridad_tirion') {
                // Solo usable si Tirion es el UNICO aliado vivo
                const _lu = gameState.characters[gameState.selectedCharacter];
                const _luA = _lu ? _lu.team : 'team1';
                const _luAliveAllies = Object.keys(gameState.characters).filter(function(n) {
                    const _c = gameState.characters[n];
                    return _c && _c.team === _luA && !_c.isDead && _c.hp > 0 && n !== gameState.selectedCharacter;
                });
                if (_luAliveAllies.length > 0) {
                    addLog('🌟 Una Luz en la Oscuridad: Tirion no esta solo - habilidad bloqueada', 'info');
                    if (_lu) _lu.charges = Math.min(20, (_lu.charges || 0) + (ability.cost || 15));
                } else {
                    let _luR = 0;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _luA || _n === gameState.selectedCharacter) continue;
                        _c.isDead = false; _c.hp = 20; _c.charges = 10; _c.statusEffects = []; _c._wasRevived = true;
                        _luR++;
                        addLog('🌟 Una Luz en la Oscuridad: ' + _n + ' revive con 20 HP y 10 cargas!', 'buff');
                    }
                    if (_luR === 0) addLog('🌟 Una Luz en la Oscuridad: no hay aliados caidos', 'info');
                    renderCharacters(); renderSummons();
                }

            // ══════════════════════════════════════════════════════
            // KYO KUSANAGI — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'yami_barai_kyo') {
                // KYO — Yami Barai: 1 daño + bloquea AOE del objetivo 1T
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🔥 Yami Barai: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _ybTgt = gameState.characters[targetName];
                if (_ybTgt && !_ybTgt.isDead && _ybTgt.hp > 0) {
                    _ybTgt.statusEffects = _ybTgt.statusEffects || [];
                    // Bloquear categoría AOE durante 1 turno (usando mismo mecanismo que Silenciar)
                    if (!(_ybTgt.statusEffects||[]).some(function(e){ return e && e.name === 'Silenciar' && e.silencedCategory === 'aoe'; })) {
                        if (typeof applyDebuff === 'function') {
                            applyDebuff(targetName, { name: 'Silenciar', type: 'debuff', duration: 1, silencedCategory: 'aoe', emoji: '🔥', description: 'Movimientos AOE bloqueados (Yami Barai)' });
                        }
                        addLog('🔥 Yami Barai: movimientos AOE de ' + targetName + ' bloqueados 1T', 'debuff');
                    }
                }

            } else if (ability.effect === 'oniyaki_kyo') {
                // KYO — Oniyaki: 1 daño + roba 2 HP y 2 cargas de todos los enemigos con Quemaduras
                const _okAtk = gameState.characters[gameState.selectedCharacter];
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🔥 Oniyaki: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _okETeam = _okAtk ? (_okAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _okETeam || _c.isDead || _c.hp <= 0) continue;
                    const _hasBurn = (_c.statusEffects||[]).some(function(e){ return e && (e.name === 'Quemadura' || e.name === 'Quemadura Solar'); });
                    if (!_hasBurn) continue;
                    // Robar 2 HP
                    const _hpSteal = Math.min(2, _c.hp);
                    _c.hp = Math.max(0, _c.hp - _hpSteal);
                    if (_c.hp <= 0) _c.isDead = true;
                    if (_okAtk && typeof applyHeal === 'function') applyHeal(gameState.selectedCharacter, _hpSteal, 'Oniyaki');
                    else if (_okAtk) _okAtk.hp = Math.min(_okAtk.maxHp, (_okAtk.hp||0) + _hpSteal);
                    // Robar 2 cargas
                    const _chSteal = Math.min(2, _c.charges || 0);
                    _c.charges = Math.max(0, (_c.charges||0) - _chSteal);
                    if (_okAtk) _okAtk.charges = Math.min(20, (_okAtk.charges||0) + _chSteal);
                    addLog('🔥 Oniyaki: roba ' + _hpSteal + ' HP y ' + _chSteal + ' cargas de ' + _n + ' (tiene Quemaduras)', 'buff');
                }

            } else if (ability.effect === 'aragami_kyo') {
                // KYO — Aragami: 4 daño a todos los objetivos con Quemaduras activo
                const _arAtk = gameState.characters[gameState.selectedCharacter];
                const _arETeam = _arAtk ? (_arAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                let _arHit = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _arETeam || _c.isDead || _c.hp <= 0) continue;
                    const _hasBurn = (_c.statusEffects||[]).some(function(e){ return e && (e.name === 'Quemadura' || e.name === 'Quemadura Solar'); });
                    if (!_hasBurn) continue;
                    applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                    addLog('🔥 Aragami: ' + finalDamage + ' daño a ' + _n + ' (tiene Quemaduras)', 'damage');
                    _arHit++;
                }
                if (_arHit === 0) addLog('🔥 Aragami: ningun enemigo tiene Quemaduras activo', 'info');

            } else if (ability.effect === 'dokugami_kyo') {
                // KYO — Dokugami: 3 daño a todos con Quemaduras + 3 daño directo por cada Quemadura en equipo enemigo
                const _dkAtk = gameState.characters[gameState.selectedCharacter];
                const _dkETeam = _dkAtk ? (_dkAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Contar Quemaduras activas en equipo enemigo
                let _dkBurnCount = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _dkETeam || _c.isDead || _c.hp <= 0) continue;
                    _dkBurnCount += (_c.statusEffects||[]).filter(function(e){ return e && (e.name === 'Quemadura' || e.name === 'Quemadura Solar'); }).length;
                }
                addLog('🔥 Dokugami: ' + _dkBurnCount + ' Quemaduras activas en equipo enemigo (+' + (_dkBurnCount * 3) + ' daño directo)', 'info');
                let _dkHit = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _dkETeam || _c.isDead || _c.hp <= 0) continue;
                    const _hasBurn = (_c.statusEffects||[]).some(function(e){ return e && (e.name === 'Quemadura' || e.name === 'Quemadura Solar'); });
                    if (!_hasBurn) continue;
                    // Daño por golpe
                    applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                    // Daño directo adicional por Quemaduras activas
                    if (_dkBurnCount > 0) {
                        const _dkBonus = _dkBurnCount * 3;
                        _c.hp = Math.max(0, (_c.hp||0) - _dkBonus);
                        if (_c.hp <= 0) _c.isDead = true;
                        addLog('🔥 Dokugami: +' + _dkBonus + ' daño directo a ' + _n + ' (' + _dkBurnCount + ' Quemaduras x3)', 'damage');
                    }
                    _dkHit++;
                }
                if (_dkHit === 0) addLog('🔥 Dokugami: ningun enemigo tiene Quemaduras activo', 'info');

            // ══════════════════════════════════════════════════════
            // IORI YAGAMI — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'llamas_purpuras_iori') {
                // IORI — Llamas Purpuras: 1 daño + 50% cada aliado roba 1 carga del objetivo
                const _lpAtk = gameState.characters[gameState.selectedCharacter];
                const _lpAllyTeam = _lpAtk ? _lpAtk.team : 'team1';
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('💜 Llamas Purpuras: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _lpTgt = gameState.characters[targetName];
                if (_lpTgt && !_lpTgt.isDead && _lpTgt.hp > 0) {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _lpAllyTeam || _c.isDead || _c.hp <= 0) continue;
                        if (Math.random() < 0.50) {
                            const _stolen = Math.min(1, _lpTgt.charges || 0);
                            if (_stolen > 0) {
                                _lpTgt.charges = Math.max(0, (_lpTgt.charges||0) - _stolen);
                                _c.charges = Math.min(20, (_c.charges||0) + _stolen);
                                addLog('💜 Llamas Purpuras: ' + _n + ' roba 1 carga de ' + targetName, 'buff');
                            }
                        }
                    }
                }

            } else if (ability.effect === 'yuri_ori_iori') {
                // IORI — Yuri Ori: 5 daño (x2 si objetivo tiene Provocacion/MegaProvocacion) + 3 cargas al equipo aliado
                const _yoAtk = gameState.characters[gameState.selectedCharacter];
                const _yoTgt = gameState.characters[targetName];
                const _yoAllyTeam = _yoAtk ? _yoAtk.team : 'team1';
                // Verificar Provocacion / MegaProvocacion en objetivo
                const _yoHasProv = _yoTgt && (
                    hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                    hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocación') ||
                    (_yoTgt.passive && (_yoTgt.passive.name === 'Provocacion' || _yoTgt.passive.name === 'MegaProvocacion'))
                );
                let _yoDmg = finalDamage;
                if (_yoHasProv) {
                    _yoDmg *= 2;
                    addLog('💜 Yuri Ori: daño doble! ' + targetName + ' tiene Provocacion', 'buff');
                }
                applyDamageWithShield(targetName, _yoDmg, gameState.selectedCharacter);
                addLog('💜 Yuri Ori: ' + _yoDmg + ' daño a ' + targetName, 'damage');
                // +3 cargas al equipo aliado
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _yoAllyTeam || _c.isDead || _c.hp <= 0) continue;
                    _c.charges = Math.min(20, (_c.charges||0) + 3);
                }
                addLog('💜 Yuri Ori: +3 cargas al equipo aliado', 'buff');

            } else if (ability.effect === 'aoi_hana_iori') {
                // IORI — Aoi Hana: 5 daño + elimina 1 carga del equipo enemigo por cada buff/debuff en objetivo + 3 cargas al equipo aliado
                const _ahAtk = gameState.characters[gameState.selectedCharacter];
                const _ahTgt = gameState.characters[targetName];
                const _ahAllyTeam = _ahAtk ? _ahAtk.team : 'team1';
                const _ahETeam = _ahAllyTeam === 'team1' ? 'team2' : 'team1';
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('💜 Aoi Hana: ' + finalDamage + ' daño a ' + targetName, 'damage');
                // Contar buffs + debuffs activos en el objetivo
                const _ahEffects = (_ahTgt ? _ahTgt.statusEffects || [] : []).filter(function(e){ return e && !e.passiveHidden; }).length;
                if (_ahEffects > 0) {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ahETeam || _c.isDead || _c.hp <= 0) continue;
                        _c.charges = Math.max(0, (_c.charges||0) - _ahEffects);
                    }
                    addLog('💜 Aoi Hana: equipo enemigo pierde ' + _ahEffects + ' cargas (' + _ahEffects + ' efectos en ' + targetName + ')', 'debuff');
                }
                // +3 cargas al equipo aliado
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _ahAllyTeam || _c.isDead || _c.hp <= 0) continue;
                    _c.charges = Math.min(20, (_c.charges||0) + 3);
                }
                addLog('💜 Aoi Hana: +3 cargas al equipo aliado', 'buff');

            } else if (ability.effect === 'ya_otome_iori') {
                // IORI — Ya Otome: 5 daño + ejecuta Yuri Ori + Aoi Hana con cinematica Over
                const _yomAtk = gameState.characters[gameState.selectedCharacter];
                const _yomTgt = gameState.characters[targetName];
                const _yomAlly = _yomAtk ? _yomAtk.team : 'team1';
                const _yomETeam = _yomAlly === 'team1' ? 'team2' : 'team1';
                // 1. Daño inicial del Over
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('💜 Ya Otome: ' + finalDamage + ' daño a ' + targetName, 'damage');
                // 2. Ejecutar Yuri Ori
                const _yomHasProv = _yomTgt && (
                    hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                    hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocación')
                );
                let _yomYuriDmg = 5;
                if (_yomHasProv) { _yomYuriDmg *= 2; addLog('💜 Ya Otome → Yuri Ori: daño doble! ' + targetName + ' tiene Provocacion', 'buff'); }
                const _yomTgtNow = gameState.characters[targetName];
                if (_yomTgtNow && !_yomTgtNow.isDead && _yomTgtNow.hp > 0) {
                    applyDamageWithShield(targetName, _yomYuriDmg, gameState.selectedCharacter);
                    addLog('💜 Ya Otome → Yuri Ori: ' + _yomYuriDmg + ' daño a ' + targetName, 'damage');
                }
                // Yuri Ori cargas
                for (const _n in gameState.characters) { const _c=gameState.characters[_n]; if(!_c||_c.team!==_yomAlly||_c.isDead||_c.hp<=0)continue; _c.charges=Math.min(20,(_c.charges||0)+3); }
                addLog('💜 Ya Otome → Yuri Ori: +3 cargas al equipo aliado', 'buff');
                // 3. Ejecutar Aoi Hana
                const _yomTgtNow2 = gameState.characters[targetName];
                if (_yomTgtNow2 && !_yomTgtNow2.isDead && _yomTgtNow2.hp > 0) {
                    applyDamageWithShield(targetName, 5, gameState.selectedCharacter);
                    addLog('💜 Ya Otome → Aoi Hana: 5 daño a ' + targetName, 'damage');
                    const _yomEffects = (_yomTgtNow2.statusEffects||[]).filter(function(e){return e&&!e.passiveHidden;}).length;
                    if (_yomEffects > 0) {
                        for (const _n in gameState.characters) { const _c=gameState.characters[_n]; if(!_c||_c.team!==_yomETeam||_c.isDead||_c.hp<=0)continue; _c.charges=Math.max(0,(_c.charges||0)-_yomEffects); }
                        addLog('💜 Ya Otome → Aoi Hana: equipo enemigo pierde ' + _yomEffects + ' cargas', 'debuff');
                    }
                }
                // Aoi Hana cargas
                for (const _n in gameState.characters) { const _c=gameState.characters[_n]; if(!_c||_c.team!==_yomAlly||_c.isDead||_c.hp<=0)continue; _c.charges=Math.min(20,(_c.charges||0)+3); }
                addLog('💜 Ya Otome → Aoi Hana: +3 cargas al equipo aliado', 'buff');
                renderCharacters(); renderSummons();

            // ══════════════════════════════════════════════════════
            // DAEMON TARGARYEN — handlers
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'hermana_oscura_daemon') {
                // DAEMON — Hermana Oscura: 2 daño + Debilitar. Crit 100% si objetivo tiene Provocacion
                const _hdAtk = gameState.characters[gameState.selectedCharacter];
                const _hdTgt = gameState.characters[targetName];
                const _hdHasProv = _hdTgt && (
                    hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                    hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocación') ||
                    (_hdTgt.passive && (_hdTgt.passive.name === 'Efecto Omega' || _hdTgt.passive.name === 'Hombre de Acero'))
                );
                // Activar Jinete de Dragones ANTES del golpe para que el daño triple aplique
                if (_hdHasProv && _hdAtk) {
                    _hdAtk.daemonJineteTurns = 2;
                    addLog('🐉 Principe Rebelde: ¡Jinete de Dragones activado! Daño triple por 2T', 'buff');
                    renderCharacters(); // actualizar portrait inmediatamente
                }
                let _hdDmg = finalDamage;
                if (_hdHasProv) {
                    _hdDmg *= 2;
                    gameState._isCritHit = true;
                    addLog('🗡️ Hermana Oscura: ¡Crítico 100%! objetivo tiene Provocacion', 'buff');
                }
                applyDamageWithShield(targetName, _hdDmg, gameState.selectedCharacter);
                addLog('🗡️ Hermana Oscura: ' + _hdDmg + ' daño a ' + targetName, 'damage');
                if (_hdTgt && !_hdTgt.isDead && _hdTgt.hp > 0) {
                    if (typeof applyDebuff === 'function') applyDebuff(targetName, { name: 'Debilitar', type: 'debuff', duration: 2, emoji: '⬇️' });
                    addLog('🗡️ Hermana Oscura: Debilitar aplicado a ' + targetName, 'debuff');
                }

            } else if (ability.effect === 'furia_caraxes_daemon') {
                // DAEMON — Furia de Caraxes: 4 daño. Si objetivo tiene Provocacion → Quemaduras 3HP a todos los enemigos
                const _fcAtk = gameState.characters[gameState.selectedCharacter];
                const _fcTgt = gameState.characters[targetName];
                const _fcETeam = _fcAtk ? (_fcAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                const _fcHasProv = _fcTgt && (
                    hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                    hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocación') ||
                    (_fcTgt.passive && (_fcTgt.passive.name === 'Efecto Omega' || _fcTgt.passive.name === 'Hombre de Acero'))
                );
                // Activar Jinete de Dragones ANTES del golpe
                if (_fcHasProv && _fcAtk) {
                    _fcAtk.daemonJineteTurns = 2;
                    addLog('🐉 Principe Rebelde: ¡Jinete de Dragones activado! Daño triple por 2T', 'buff');
                    renderCharacters();
                }
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🐉 Furia de Caraxes: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_fcHasProv) {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _fcETeam || _c.isDead || _c.hp <= 0) continue;
                        applyFlatBurn(_n, 3, 2);
                    }
                    addLog('🐉 Furia de Caraxes: Quemaduras 3HP a todo el equipo enemigo (objetivo tenía Provocacion)', 'debuff');
                }


            } else if (ability.effect === 'provocacion_principe_daemon') {
                // DAEMON — Provocacion del Principe: disipa buffs del equipo enemigo + 2 daño al objetivo
                const _ppAtk = gameState.characters[gameState.selectedCharacter];
                const _ppETeam = _ppAtk ? (_ppAtk.team === 'team1' ? 'team2' : 'team1') : 'team2';
                // Disipar buffs primero
                let _ppTotalBufDis = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _ppETeam || _c.isDead || _c.hp <= 0) continue;
                    const _bufs = (_c.statusEffects||[]).filter(function(e){ return e && e.type === 'buff' && !e.permanent && !e.passiveHidden; });
                    if (_bufs.length > 0) {
                        _c.statusEffects = (_c.statusEffects||[]).filter(function(e){ return !e || e.type !== 'buff' || e.permanent || e.passiveHidden; });
                        _ppTotalBufDis += _bufs.length;
                    }
                }
                addLog('🗡️ Provocacion del Principe: ' + _ppTotalBufDis + ' buff(s) disipados del equipo enemigo', 'debuff');
                // Luego 2 daño al objetivo
                applyDamageWithShield(targetName, 2, gameState.selectedCharacter);
                addLog('🗡️ Provocacion del Principe: 2 daño a ' + targetName, 'damage');

            } else if (ability.effect === 'ojo_dioses_daemon') {
                // DAEMON — Ojo de Dioses: 5 daño. Crit 100% si objetivo tiene Provocacion/MegaProvocacion
                const _odTgt = gameState.characters[targetName];
                const _odAtk = gameState.characters[gameState.selectedCharacter];
                const _odHasProv = _odTgt && (
                    hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                    hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocación') ||
                    (_odTgt.passive && (_odTgt.passive.name === 'Efecto Omega' || _odTgt.passive.name === 'Hombre de Acero'))
                );
                let _odDmg = finalDamage;
                if (_odHasProv) {
                    _odDmg *= 2;
                    gameState._isCritHit = true;
                    addLog('🐉 Ojo de Dioses: ¡Crítico 100%! objetivo tiene Provocacion', 'buff');
                }
                // Activar Jinete de Dragones ANTES del golpe
                if (_odHasProv && _odAtk) {
                    _odAtk.daemonJineteTurns = 2;
                    addLog('🐉 Principe Rebelde: ¡Jinete de Dragones activado! Daño triple por 2T', 'buff');
                    renderCharacters();
                }
                applyDamageWithShield(targetName, _odDmg, gameState.selectedCharacter);
                addLog('🐉 Ojo de Dioses: ' + _odDmg + ' daño a ' + targetName, 'damage');


            // ══════════════════════════════════════════════════════
            // REY BRUJO DE ANGMAR — skills
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'espada_morgul_rey') {
                const _emAtk = gameState.characters[gameState.selectedCharacter];
                const _emTgt = gameState.characters[targetName];
                const _emHadPoison = _emTgt && hasStatusEffect(targetName, 'Veneno');
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('⚔️ Espada Morgul: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_emTgt && !_emTgt.isDead && _emTgt.hp > 0) applyPoison(targetName, 1);
                if (_emHadPoison && _emAtk) {
                    const _emET = _emAtk.team === 'team1' ? 'team2' : 'team1';
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc||_cc.team!==_emET||_cc.isDead||_cc.hp<=0||_n===targetName) continue;
                        applyPoison(_n, 1);
                    }
                    addLog('⚔️ Espada Morgul: Veneno propagado a todo el equipo enemigo', 'debuff');
                }

            } else if (ability.effect === 'grito_mordor_rey') {
                const _gmAtk = gameState.characters[gameState.selectedCharacter];
                const _gmET = _gmAtk ? (_gmAtk.team==='team1'?'team2':'team1') : 'team2';
                for (const _n in gameState.characters) {
                    const _cc = gameState.characters[_n];
                    if (!_cc||_cc.team!==_gmET||_cc.isDead||_cc.hp<=0) continue;
                    _cc.charges = Math.max(0, (_cc.charges||0) - 3);
                    if (hasStatusEffect(_n,'Veneno') && Math.random() < 0.50) applyStun(_n, 1);
                }
                addLog('💀 Grito de Mordor: -3 cargas a todos + 50% Aturdimiento con Veneno', 'debuff');

            } else if (ability.effect === 'corona_hierro_rey') {
                const _chAtk = gameState.characters[gameState.selectedCharacter];
                const _chAlly = _chAtk ? _chAtk.team : 'team1';
                const _chET = _chAlly === 'team1' ? 'team2' : 'team1';
                const _buffPool = ['Aura oscura','Furia','Frenesi','Celeridad','Armadura'];
                let _chHits = 0;
                for (let _ci = 0; _ci < 5; _ci++) {
                    const _enems = Object.keys(gameState.characters).filter(function(n){
                        const _c=gameState.characters[n]; return _c&&_c.team===_chET&&!_c.isDead&&_c.hp>0;
                    });
                    if (!_enems.length) break;
                    const _tgt2 = _enems[Math.floor(Math.random()*_enems.length)];
                    applyDamageWithShield(_tgt2, 2, gameState.selectedCharacter);
                    applyPoison(_tgt2, 1);
                    _chHits++;
                    for (const _an in gameState.characters) {
                        const _ac = gameState.characters[_an];
                        if (!_ac||_ac.team!==_chAlly||_ac.isDead||_ac.hp<=0) continue;
                        const _bf = _buffPool[Math.floor(Math.random()*_buffPool.length)];
                        if (typeof applyBuff==='function') applyBuff(_an, {name:_bf,type:'buff',duration:2,emoji:'✨'});
                    }
                }
                addLog('👑 Corona de Hierro: ' + _chHits + ' ataques + buffs aleatorios al equipo', 'buff');

            } else if (ability.effect === 'mano_sauron_rey') {
                const _msAtk = gameState.characters[gameState.selectedCharacter];
                const _msET = _msAtk ? (_msAtk.team==='team1'?'team2':'team1') : 'team2';
                let _msTotalDmg = 0;
                for (const _n in gameState.characters) {
                    const _cc = gameState.characters[_n];
                    if (!_cc||_cc.team!==_msET||_cc.isDead) continue;
                    const _venenos = (_cc.statusEffects||[]).filter(function(e){
                        return e && (e.name==='Veneno'||e.name==='veneno');
                    });
                    if (_venenos.length > 0) {
                        let _vDmg = 0;
                        _venenos.forEach(function(v){ _vDmg += (v.duration||1); });
                        _cc.statusEffects = (_cc.statusEffects||[]).filter(function(e){
                            return !e||(e.name!=='Veneno'&&e.name!=='veneno');
                        });
                        applyDamageWithShield(_n, _vDmg, gameState.selectedCharacter);
                        _msTotalDmg += _vDmg;
                        addLog('🖐️ Mano de Sauron: ' + _vDmg + ' daño a ' + _n + ' ('+_venenos.length+' veneno/s disipado/s)', 'damage');
                    }
                }
                if (_msTotalDmg === 0) addLog('🖐️ Mano de Sauron: ningún enemigo tenía Veneno', 'info');

            // ══════════════════════════════════════════════════════
            // IKKI DE FENIX — skills nuevos
            // ══════════════════════════════════════════════════════

            } else if (ability.effect === 'phoenix_genma_ken_ikki') {
                const _pgAtk = gameState.characters[gameState.selectedCharacter];
                const _pgTgt = gameState.characters[targetName];
                const _pgHadBurn = _pgTgt && hasStatusEffect(targetName, 'Quemadura');
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🔥 Phoenix Genma Ken: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_pgTgt && !_pgTgt.isDead && _pgTgt.hp > 0) applyFlatBurn(targetName, 2, 2);
                if (_pgHadBurn && Math.random() < 0.50 && _pgTgt && _pgAtk) {
                    const _stolen = _pgTgt.charges||0;
                    if (_stolen > 0) {
                        _pgAtk.charges = Math.min(20, (_pgAtk.charges||0) + _stolen);
                        _pgTgt.charges = 0;
                        addLog('🔥 Phoenix Genma Ken: roba ' + _stolen + ' cargas a ' + targetName, 'buff');
                    }
                }

            } else if (ability.effect === 'hou_yoku_tenshou_ikki') {
                const _hyAtk = gameState.characters[gameState.selectedCharacter];
                const _hyET = _hyAtk ? (_hyAtk.team==='team1'?'team2':'team1') : 'team2';
                const _hyHit = new Set();
                if (checkAndRedirectAOEMegaProv(_hyET, finalDamage, gameState.selectedCharacter)) {
                    addLog('🔥 Hou Yoku Tenshou redirigido por MegaProvocacion', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc||_cc.team!==_hyET||_cc.isDead||_cc.hp<=0) continue;
                        if (checkAsprosAOEImmunity(_n,true)||checkMinatoAOEImmunity(_n)) continue;
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        _hyHit.add(_n);
                        if (hasStatusEffect(_n,'Quemadura')) {
                            gameState.characters[_n].charges = Math.max(0, (gameState.characters[_n].charges||0) - 3);
                            addLog('🔥 Hou Yoku Tenshou: -3 cargas a ' + _n + ' (tiene Quemadura)', 'debuff');
                        }
                    }
                }
                // Quemadura 5HP a los NO golpeados
                for (const _n in gameState.characters) {
                    const _cc = gameState.characters[_n];
                    if (!_cc||_cc.team!==_hyET||_cc.isDead||_cc.hp<=0||_hyHit.has(_n)) continue;
                    applyFlatBurn(_n, 5, 2);
                }
                addLog('🔥 Hou Yoku Tenshou: AOE + Quemadura 5HP a no golpeados', 'damage');

            } else if (ability.effect === 'ilusion_diabolica_ikki') {
                const _idAtk = gameState.characters[gameState.selectedCharacter];
                const _idAlly = _idAtk ? _idAtk.team : 'team1';
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🔥 Ilusión Diabólica: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _idTgt2 = gameState.characters[targetName];
                if (_idTgt2) {
                    const _idBufs = (_idTgt2.statusEffects||[]).filter(function(e){return e&&e.type==='buff'&&!e.permanent&&!e.passiveHidden;});
                    _idTgt2.statusEffects = (_idTgt2.statusEffects||[]).filter(function(e){return !e||e.type!=='buff'||e.permanent||e.passiveHidden;});
                    if (_idBufs.length > 0) {
                        const _cg = _idBufs.length * 3;
                        for (const _an in gameState.characters) {
                            const _ac = gameState.characters[_an];
                            if (!_ac||_ac.team!==_idAlly||_ac.isDead||_ac.hp<=0) continue;
                            _ac.charges = Math.min(20, (_ac.charges||0) + _cg);
                        }
                        addLog('🔥 Ilusión Diabólica: ' + _idBufs.length + ' buffs disipados → +' + _cg + ' cargas al equipo', 'buff');
                    }
                }

            } else if (ability.effect === 'despertar_fenix_ikki') {
                const _dfAtk = gameState.characters[gameState.selectedCharacter];
                const _dfET = _dfAtk ? (_dfAtk.team==='team1'?'team2':'team1') : 'team2';
                if (!_dfAtk || _dfAtk.hp <= 1) {
                    addLog('🔥 El Despertar del Fénix: HP insuficiente para sacrificar', 'info');
                    endTurn(); return;
                }
                const _dfPct = 0.50 + Math.random() * 0.40;
                const _dfSac = Math.floor(_dfAtk.hp * _dfPct);
                _dfAtk.hp = Math.max(1, _dfAtk.hp - _dfSac);
                addLog('🔥 El Despertar del Fénix: Ikki sacrifica ' + _dfSac + ' HP (' + Math.round(_dfPct*100) + '%)', 'damage');
                const _dfDmg = _dfSac * 2;
                const _dfWasAlive = gameState.characters[targetName] && !gameState.characters[targetName].isDead;
                applyDamageWithShield(targetName, _dfDmg, gameState.selectedCharacter);
                addLog('🔥 El Despertar del Fénix: ' + _dfDmg + ' daño a ' + targetName, 'damage');
                const _dfTgtDied = _dfWasAlive && gameState.characters[targetName] && (gameState.characters[targetName].isDead || gameState.characters[targetName].hp <= 0);
                if (_dfTgtDied) {
                    const _dfAOE = Math.floor(_dfDmg * 0.50);
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc||_cc.team!==_dfET||_cc.isDead||_cc.hp<=0||_n===targetName) continue;
                        applyDamageWithShield(_n, _dfAOE, gameState.selectedCharacter);
                        addLog('🔥 El Despertar del Fénix: ' + _dfAOE + ' AOE a ' + _n + ' (objetivo eliminado)', 'damage');
                    }
                }
            }
            
            // ASISTIR (Anakin): when ally uses Special/Over ST, execute basic on same target
            if (ability && (ability.type === 'special' || ability.type === 'over') && 
                ability.target === 'single' && targetName) {
                triggerAsistir(gameState.selectedCharacter, targetName, ability.type);
            }

            // EL ELEGIDO (Anakin): 50% Frenesi + Furia 2T cuando un enemigo usa especial/over sobre un aliado
            if (ability && (ability.type === 'special' || ability.type === 'over') && !passiveExecuting) {
                const _elAtk = gameState.characters[gameState.selectedCharacter];
                if (_elAtk) {
                    const _elEnemyTeam = _elAtk.team;
                    // Buscar Anakin en el equipo que recibe el ataque
                    for (const _an in gameState.characters) {
                        const _ac = gameState.characters[_an];
                        if (!_ac || _ac.isDead || _ac.hp <= 0) continue;
                        if (_ac.team === _elEnemyTeam) continue; // Anakin debe estar en el equipo que recibe
                        if (!_ac.passive || _ac.passive.name !== 'El Elegido') continue;
                        // Solo activar si Anakin no tiene ya Frenesi Y Furia activos
                        const _hasFrenesi = (_ac.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'frenesi');
                        const _hasFuria = (_ac.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'furia');
                        if (!(_hasFrenesi && _hasFuria) && Math.random() < 0.50) {
                            passiveExecuting = true;
                            applyFrenesi(_an, 2);
                            applyFuria(_an, 2);
                            addLog('El Elegido: Anakin gana Frenesi + Furia 2T', 'buff');
                            passiveExecuting = false;
                        }
                        break;
                    }
                }
            }

            // PALADÍN DE LA MANO DE PLATA (Tirion): cuando enemigo usa Over → +5 HP y +5 cargas al equipo aliado
            if (ability && ability.type === 'over' && !passiveExecuting) {
                const _tirOvAtk = gameState.characters[gameState.selectedCharacter];
                if (_tirOvAtk) {
                    const _tirOvDefTeam = _tirOvAtk.team === 'team1' ? 'team2' : 'team1';
                    for (const _tn in gameState.characters) {
                        const _tc = gameState.characters[_tn];
                        if (!_tc || _tc.isDead || _tc.hp <= 0 || _tc.team !== _tirOvDefTeam) continue;
                        if (!_tc.passive || _tc.passive.name !== 'Paladín de la Mano de Plata') continue;
                        passiveExecuting = true;
                        for (const _an in gameState.characters) {
                            const _ac = gameState.characters[_an];
                            if (!_ac || _ac.isDead || _ac.hp <= 0 || _ac.team !== _tirOvDefTeam) continue;
                            if (typeof applyHeal === 'function') applyHeal(_an, 3, 'Paladín de la Mano de Plata');
                            else if (typeof canHeal === 'function' ? canHeal(_an) : true) _ac.hp = Math.min(_ac.maxHp, (_ac.hp||0) + 3);
                            _ac.charges = Math.min(20, (_ac.charges||0) + 3);
                        }
                        addLog('🌟 Paladín de la Mano de Plata: equipo aliado +3 HP y +3 cargas (enemigo usó Over)', 'buff');
                        passiveExecuting = false;
                        break;
                    }
                }
            }

            // PHALANX (Leonidas): recupera 3 HP cuando un enemigo usa especial/over
            if (ability && (ability.type === 'special' || ability.type === 'over') && !passiveExecuting) {
                const _plAtk = gameState.characters[gameState.selectedCharacter];
                if (_plAtk) {
                    const _plDefTeam = _plAtk.team === 'team1' ? 'team2' : 'team1';
                    for (const _ln in gameState.characters) {
                        const _lc = gameState.characters[_ln];
                        if (!_lc || _lc.isDead || _lc.hp <= 0 || _lc.team !== _plDefTeam) continue;
                        if (!_lc.passive || _lc.passive.name !== 'Phalanx') continue;
                        if (typeof canHeal === 'function' && !canHeal(_ln)) {
                            addLog('☀️ QS bloquea curación de Leonidas (Phalanx)', 'debuff'); break;
                        }
                        passiveExecuting = true;
                        _lc.hp = Math.min(_lc.maxHp, (_lc.hp||0) + 3);
                        addLog('⚔️ Phalanx: Leonidas recupera 3 HP (enemigo usó ' + ability.type + ')', 'heal');
                        passiveExecuting = false;
                        break;
                    }
                }
            }


            // ── LLAMARADA KUSANAGI (Kyo): disparar pasiva al finalizar cualquier AOE ──
            if (ability && (ability.target === 'aoe' || ability.target === 'enemy_team') && !passiveExecuting) {
                if (gameState._kyoAOEHitsByAttacker && gameState.selectedCharacter) {
                    const _kyoHits = gameState._kyoAOEHitsByAttacker[gameState.selectedCharacter] || 0;
                    if (_kyoHits > 0 && typeof triggerKyoAOEPassive === 'function') {
                        triggerKyoAOEPassive(gameState.selectedCharacter, _kyoHits);
                    }
                    delete gameState._kyoAOEHitsByAttacker;
                }

            // ══ MADARA UCHIHA — handlers ══

            } else if (ability.effect === 'rinbo_hengoku_madara') {
                const _rhAtk = gameState.characters[gameState.selectedCharacter];
                let _rhDmg = finalDamage;
                const _rhCrit = Math.random() < 0.50;
                if (_rhCrit) { _rhDmg *= 2; gameState._isCritHit = true; addLog('🌀 Rinbo Hengoku: ¡Crítico!', 'buff'); }
                applyDamageWithShield(targetName, _rhDmg, gameState.selectedCharacter);
                addLog('🌀 Rinbo: Hengoku: ' + _rhDmg + ' daño a ' + targetName, 'damage');
                if (_rhCrit && _rhAtk) {
                    if (_rhAtk.rikudoMode) _rhAtk.charges = Math.min(20, (_rhAtk.charges||0) + 3);
                    addLog('🌀 Gakido: turno adicional por crítico', 'buff');
                    if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _rhAtk.team);
                    renderCharacters(); renderSummons(); showContinueButton(); return;
                }

            } else if (ability.effect === 'susanoo_madara') {
                const _suAtk = gameState.characters[gameState.selectedCharacter];
                let _suDmg = finalDamage;
                const _suCrit = Math.random() < 0.50;
                if (_suCrit) { _suDmg *= 2; gameState._isCritHit = true; addLog('🌀 Susanoo: ¡Crítico!', 'buff'); }
                applyDamageWithShield(targetName, _suDmg, gameState.selectedCharacter);
                addLog('🌀 Susanoo: ' + _suDmg + ' daño a ' + targetName, 'damage');
                // Escudo al propio Madara (el atacante), no al objetivo
                const _suSelf = gameState.characters[gameState.selectedCharacter];
                if (_suSelf) {
                    _suSelf.shield = (_suSelf.shield||0) + _suDmg;
                    addLog('🌀 Susanoo: Escudo de ' + _suDmg + ' HP aplicado a ' + gameState.selectedCharacter, 'buff');
                }
                if (_suCrit && _suAtk) {
                    if (_suAtk.rikudoMode) _suAtk.charges = Math.min(20, (_suAtk.charges||0) + 3);
                    addLog('🌀 Gakido: turno adicional por crítico', 'buff');
                    if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _suAtk.team);
                    renderCharacters(); renderSummons(); showContinueButton(); return;
                }

            } else if (ability.effect === 'rikudo_mode_madara') {
                const _rmAtk = gameState.characters[gameState.selectedCharacter];
                // Bloquear si ya está en Modo Rikudō
                if (_rmAtk && _rmAtk.rikudoMode) {
                    addLog('🌀 Modo Rikudō: Madara ya está transformado', 'info');
                    endTurn(); return;
                }
                if (_rmAtk) {
                    _rmAtk.rikudoMode = true;
                    _rmAtk.basePortrait = _rmAtk.basePortrait || _rmAtk.portrait;
                    if (_rmAtk.transformPortrait) _rmAtk.portrait = _rmAtk.transformPortrait;
                    audioManager.playTransformSfx();
                    if (typeof _animCard === 'function') _animCard(gameState.selectedCharacter, 'anim-transform', 700);
                    if (typeof _triggerPowerUp === 'function') _triggerPowerUp(gameState.selectedCharacter, _rmAtk.team);
                    addLog('🌀 Modo Rikudō: costos /2, daño x2, +3 cargas por turno adicional', 'buff');
                    renderCharacters(); renderSummons(); endTurn(); return;
                }

            } else if (ability.effect === 'chibaku_tensei_madara') {
                const _ctAtk = gameState.characters[gameState.selectedCharacter];
                const _ctET = _ctAtk ? (_ctAtk.team==='team1'?'team2':'team1') : 'team2';
                const _ctCrit = Math.random() < 0.50;
                const _ctDmg = _ctCrit ? finalDamage * 2 : finalDamage;
                if (_ctCrit) { gameState._isCritHit = true; addLog('🌑 Chibaku Tensei: ¡Crítico!', 'buff'); }
                if (checkAndRedirectAOEMegaProv(_ctET, _ctDmg, gameState.selectedCharacter)) {
                    addLog('🌑 Chibaku Tensei: AOE redirigido', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc||_cc.team!==_ctET||_cc.isDead||_cc.hp<=0) continue;
                        if (checkAsprosAOEImmunity(_n,true)||checkMinatoAOEImmunity(_n)) continue;
                        const _stl = _cc.charges||0; _cc.charges = 0;
                        if (_ctAtk) _ctAtk.charges = Math.min(20, (_ctAtk.charges||0) + _stl);
                        applyDamageWithShield(_n, _ctDmg, gameState.selectedCharacter);
                        addLog('🌑 Chibaku Tensei: ' + _ctDmg + ' daño a ' + _n + ' (-' + _stl + ' cargas)', 'damage');
                    }
                }
                if (_ctCrit && _ctAtk) {
                    if (_ctAtk.rikudoMode) _ctAtk.charges = Math.min(20, (_ctAtk.charges||0) + 3);
                    addLog('🌀 Gakido: turno adicional por crítico', 'buff');
                    if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, _ctAtk.team);
                    renderCharacters(); renderSummons(); showContinueButton(); return;
                }

            // ══ SAURON — handlers ══

            } else if (ability.effect === 'voluntad_mordor_sauron') {
                const _vmTgt = gameState.characters[targetName];
                const _vmHadBuff = _vmTgt && (_vmTgt.statusEffects||[]).some(e => e && e.type==='buff' && !e.passiveHidden);
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('🌑 Voluntad de Mordor: ' + finalDamage + ' daño a ' + targetName, 'damage');
                if (_vmHadBuff && _vmTgt && !_vmTgt.isDead && _vmTgt.hp > 0) {
                    const _vmBufs = (_vmTgt.statusEffects||[]).filter(e => e && e.type==='buff' && !e.passiveHidden);
                    if (_vmBufs.length > 0) { const _vmi = _vmTgt.statusEffects.indexOf(_vmBufs[0]); if (_vmi !== -1) _vmTgt.statusEffects.splice(_vmi, 1); }
                    applyDebuff(targetName, { name: 'Silencio', type: 'debuff', duration: 2, emoji: '🔇' });
                    attacker.charges = Math.min(20, (attacker.charges||0) + 2);
                    addLog('🌑 Voluntad de Mordor: buff limpiado + Silencio + 2 cargas', 'buff');
                }

            } else if (ability.effect === 'mano_negra_sauron') {
                const _mnAtk = gameState.characters[gameState.selectedCharacter];
                const _mnET = _mnAtk ? (_mnAtk.team==='team1'?'team2':'team1') : 'team2';
                const _mnAlly = _mnAtk ? _mnAtk.team : 'team1';
                let _mnBufHits = 0, _mnEvades = 0;
                addLog('🖤 Mano Negra: ejecutando AOE ' + finalDamage + ' daño', 'damage');
                if (checkAndRedirectAOEMegaProv(_mnET, finalDamage, gameState.selectedCharacter)) {
                    addLog('🖤 Mano Negra: AOE redirigido por MegaProvocación', 'damage');
                } else {
                    for (const _n in gameState.characters) {
                        const _cc = gameState.characters[_n];
                        if (!_cc||_cc.team!==_mnET||_cc.isDead||_cc.hp<=0) continue;
                        // Verificar buff ANTES del daño
                        const _hb = (_cc.statusEffects||[]).some(function(e){ return e && e.type==='buff' && !e.passiveHidden; });
                        // Verificar esquiva
                        if (checkAsprosAOEImmunity(_n, true) || checkMinatoAOEImmunity(_n)) {
                            _mnEvades++;
                            addLog('🖤 Mano Negra: ' + _n + ' esquiva', 'buff');
                            continue;
                        }
                        applyDamageWithShield(_n, finalDamage, gameState.selectedCharacter);
                        if (_hb) {
                            _mnBufHits++;
                            addLog('🖤 Mano Negra: ' + _n + ' tenía Buff (+2 cargas a Sauron)', 'buff');
                        }
                    }
                    // Daño a invocaciones enemigas también
                    for (const _sid in gameState.summons) {
                        const _ss = gameState.summons[_sid];
                        if (!_ss || _ss.team !== _mnET || _ss.hp <= 0) continue;
                        applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                if (_mnBufHits > 0 && _mnAtk) {
                    _mnAtk.charges = Math.min(20, (_mnAtk.charges||0) + _mnBufHits * 2);
                    addLog('🖤 Mano Negra: Sauron gana +' + (_mnBufHits*2) + ' cargas (' + _mnBufHits + ' enemigos con Buff golpeados)', 'buff');
                }
                if (_mnEvades > 0) {
                    for (const _an in gameState.characters) {
                        const _ac = gameState.characters[_an];
                        if (!_ac||_ac.isDead||_ac.hp<=0||_ac.team!==_mnAlly) continue;
                        _ac.charges = Math.min(20, (_ac.charges||0) + _mnEvades * 3);
                    }
                    addLog('🖤 Mano Negra: equipo aliado +' + (_mnEvades*3) + ' cargas (' + _mnEvades + ' enemigos esquivaron)', 'buff');
                }

            } else if (ability.effect === 'senor_oscuro_sauron') {
                const _soAtk = gameState.characters[gameState.selectedCharacter];
                const _soET = _soAtk ? (_soAtk.team==='team1'?'team2':'team1') : 'team2';
                const _soTgt = gameState.characters[targetName];
                const _soHasProv = _soTgt && (hasStatusEffect(targetName,'Provocacion')||hasStatusEffect(targetName,'MegaProvocacion')||
                    (_soTgt.passive&&['Efecto Omega','Hombre de Acero','Señor de los Nazgul'].includes(_soTgt.passive.name)));
                const _soWas = _soTgt && !_soTgt.isDead;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog('👑 Señor Oscuro: ' + finalDamage + ' daño a ' + targetName, 'damage');
                const _soNow = gameState.characters[targetName];
                const _soDied = _soWas && _soNow && (_soNow.isDead||_soNow.hp<=0);
                if (_soHasProv && _soAtk) {
                    const _splash = Math.floor((_soAtk.hp||0)*0.50);
                    Object.keys(gameState.characters).filter(n=>{const _c=gameState.characters[n];return _c&&_c.team===_soET&&!_c.isDead&&_c.hp>0&&n!==targetName;}).sort(()=>Math.random()-0.5).slice(0,2).forEach(n=>{applyDamageWithShield(n,_splash,gameState.selectedCharacter);addLog('👑 Señor Oscuro: '+_splash+' daño a '+n,'damage');});
                }
                if (_soDied && _soAtk) {
                    const _soH = Math.floor((_soAtk.maxHp||25)*0.50);
                    if (typeof applyHeal==='function') applyHeal(gameState.selectedCharacter,_soH,'Señor Oscuro');
                    else _soAtk.hp = Math.min(_soAtk.maxHp,(_soAtk.hp||0)+_soH);
                    addLog('👑 Señor Oscuro: Sauron +' + _soH + ' HP',  'heal');
                }

            } else if (ability.effect === 'poder_anillo_sauron') {
                const _paAtk = gameState.characters[gameState.selectedCharacter];
                if (_paAtk) {
                    const _paH = Math.floor((_paAtk.hp||0)*0.50);
                    _paAtk.maxHp = (_paAtk.maxHp||25) + 10;
                    _paAtk.hp = Math.min(_paAtk.maxHp, (_paAtk.hp||0) + _paH);
                    applyBuff(gameState.selectedCharacter, {name:'Proteccion Sagrada',type:'buff',duration:3,emoji:'🛡️'});
                    // Agregar MegaProvocación directamente a statusEffects para garantizar que funcione
                    const _paMegaExists = (_paAtk.statusEffects||[]).some(function(e){ return e && (e.name==='Mega Provocacion'||e.name==='MegaProvocacion'); });
                    if (!_paMegaExists) {
                        (_paAtk.statusEffects = _paAtk.statusEffects||[]).push({name:'Mega Provocacion',type:'buff',duration:3,emoji:'🌑'});
                    }
                    _paAtk.sauronTransformed = true;
                    addLog('🌑 Poder del Anillo: +' + _paH + ' HP, HP máx +10, Prot Sagrada + MegaProvocación 3T activa', 'buff');
                    renderCharacters(); renderSummons(); endTurn(); return;
                }            }

            // Actualizar UI
            renderCharacters();
            renderSummons();
            
            // Verificar fin del juego
            if (checkGameOver()) {
                return;
            }
            
            // Finalizar turno
            endTurn();
        } catch (error) {
            const errMsg = error && error.message ? error.message : String(error);
            const errAbility = (gameState.selectedAbility && gameState.selectedAbility.name) || 'desconocida';
            console.error('Error en executeAbility [' + errAbility + ']:', error);
            addLog('❌ Error al ejecutar ' + errAbility + ': ' + errMsg, 'info');
            try {
                renderCharacters();
                renderSummons();
                endTurn();
            } catch (e) {
                console.error('Error crítico en executeAbility:', e);
            }
        }
        }

        // ==================== VERIFICACIÓN FIN DEL JUEGO ====================
        function checkGameOver() {
            let team1Alive = 0;
            let team2Alive = 0;
            
            // Limpiar invocaciones de personajes muertos SIN activar pasivas
            const toRemove = [];
            for (let summonId in gameState.summons) {
                const summon = gameState.summons[summonId];
                if (!summon) continue;
                const summoner = gameState.characters[summon.summoner];
                if (summoner && summoner.isDead) {
                    toRemove.push(summonId);
                }
            }
            toRemove.forEach(summonId => {
                const summon = gameState.summons[summonId];
                if (summon) {
                    addLog(`💨 ${summon.name} desaparece porque ${summon.summoner} fue derrotado`, 'damage');
                    delete gameState.summons[summonId];
                }
            });
            
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (!char.isDead && char.hp > 0) {
                    if (char.team === 'team1') team1Alive++;
                    else team2Alive++;
                }
            }

            // Contar invocaciones vivas — Kamish y otras con MegaProvocación
            // mantienen al equipo vivo mientras tengan HP
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (!s || s.hp <= 0) continue;
                // Solo invocaciones que tienen MegaProvocación mantienen vivo al equipo
                // Kamish mantiene vivo al equipo si su summoner sigue vivo
                const _kamSumAlive = s.summoner && gameState.characters[s.summoner] &&
                    !gameState.characters[s.summoner].isDead && gameState.characters[s.summoner].hp > 0;
                if (s.megaProvocation || s.name === 'Drogon' ||
                    s.name === 'Sindragosa' || s.name === 'Caballero de la Muerte' ||
                    (s.name === 'Kamish' && _kamSumAlive)) {
                    if (s.team === 'team1') team1Alive++;
                    else team2Alive++;
                }
            }

            if (team1Alive === 0) {
                // Si estamos en medio del loop async de Jon Snow, solo marcar y dejar que el loop lo detecte
                if (gameState._jonSnowLoopActive) {
                    gameState.gameOver = true;
                    gameState._jonSnowPendingWinner = '🔶 REAPERS GANAN!';
                    return true;
                }
                showGameOver('🔶 REAPERS GANAN!');
                return true;
            } else if (team2Alive === 0) {
                if (gameState._jonSnowLoopActive) {
                    gameState.gameOver = true;
                    gameState._jonSnowPendingWinner = '🔷 HUNTERS GANAN!';
                    return true;
                }
                showGameOver('🔷 HUNTERS GANAN!');
                return true;
            }
            
            return false;
        }

        // ── SUMMON INFO CATALOGUE ──

        function showSummonInfo(summonName, event) {
            if (event) { event.stopPropagation(); }
            const data = SUMMON_CATALOGUE[summonName];
            // Also check summonData for image
            const sData = (typeof summonData !== 'undefined') ? summonData[summonName] : null;
            const imgUrl = (data && data.img) || (sData && sData.img) || '';
            if (!data) return;
            const modal = document.getElementById('summonInfoModal');
            document.getElementById('summonInfoTitle').textContent = '🔮 ' + summonName;
            const imgHtml = imgUrl ? '<div style="text-align:center;margin-bottom:12px;"><img src="' + imgUrl + '" alt="' + summonName + '" style="width:80px;height:80px;object-fit:cover;border-radius:10px;border:2px solid #a855f7;" onerror="this.style.display=\'none\'"></div>' : '';
            document.getElementById('summonInfoContent').innerHTML =
                imgHtml +
                '<div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:10px;padding:14px;margin-bottom:12px;">' +
                '<div style="color:#a855f7;font-weight:700;margin-bottom:6px;">❤️ HP</div>' +
                '<div style="color:#fff;font-size:1.1rem;">' + data.hp + '</div>' +
                '</div>' +
                '<div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:10px;padding:14px;">' +
                '<div style="color:#a855f7;font-weight:700;margin-bottom:6px;">⚡ Efecto / Pasiva</div>' +
                '<div style="color:#ccc;line-height:1.6;">' + data.passive + '</div>' +
                '</div>';
            modal.style.display = 'block';
        }

        const BUFF_DEBUFF_DATA = [
            // ── BUFFS ──────────────────────────────────────────────────────────
            { type: 'buff', name: '⚡ Furia', effect: 'Incrementa un 50% el daño causado a los enemigos.' },
            { type: 'buff', name: '🔥 Frenesí', effect: 'Incrementa un 50% la probabilidad de golpe crítico.' },
            { type: 'buff', name: '🛡️ Escudo', effect: 'Genera un Escudo con HP que absorbe exclusivamente el daño por golpe recibido. Se rompe cuando pierde todos sus HP; el daño residual pasa al portador. El daño por efectos de estado (veneno, quemadura, sangrado, etc.) no es absorbido por el escudo.' },
            { type: 'buff', name: '✝️ Escudo Sagrado', effect: 'Inmunidad al daño por golpes. El daño por efectos de estado se aplica normalmente.' },
            { type: 'buff', name: '🛡️✨ Protección Sagrada', effect: 'Otorga inmunidad a nuevos debuffs mientras esté activo.' },
            { type: 'buff', name: '💖 Regeneración', effect: 'Recupera un % de HP al inicio de cada turno.' },
            { type: 'buff', name: '👤 Sigilo', effect: 'No puede ser seleccionado como objetivo de ataques Single Target ni Multi Target, pero sí es afectado por ataques AOE. Sigilo se pierde al recibir daño o al realizar un ataque que golpee a un enemigo (excepto en el mismo turno que se aplica). Si Sigilo sigue activo al finalizar la ronda, genera 1 carga.' },
            { type: 'buff', name: '🛡️ Provocación', effect: 'Los movimientos Single Target del enemigo solo pueden seleccionarlo a él.' },
            { type: 'buff', name: '🌑 Mega Provocación', effect: 'Los movimientos Single Target, Multi Target y AOE del enemigo solo pueden seleccionarlo a él. El daño AOE recibido es la suma del daño total que habrían recibido todos los miembros del equipo enemigo activos en el campo (personajes e invocaciones).' },
            { type: 'buff', name: '💨 Esquivar', effect: 'Gana un 50% de probabilidad de esquivar cualquier ataque del enemigo.' },
            { type: 'buff', name: '🌟 Esquiva Área', effect: 'No es afectado por ataques AOE del enemigo.' },
            { type: 'buff', name: '🔄 Contraataque', effect: 'Cada vez que recibe un golpe de un ataque del enemigo, ejecuta su ataque básico sobre el atacante. El ataque básico genera el daño, efecto y cargas correspondientes.' },
            { type: 'buff', name: '🌵 Espinas', effect: 'Cada vez que recibe un golpe de un ataque del enemigo, causa 1 de daño al atacante. Si el enemigo tiene el debuff Sangrado, causa +2 de daño adicional.' },
            { type: 'buff', name: '🛡️ Armadura', effect: 'Reduce un 50% el daño recibido por golpe.' },
            { type: 'buff', name: '⚡ Celeridad', effect: 'Incrementa un 10% la velocidad del portador.' },
            { type: 'buff', name: '👁️‍🗨️ Anticipación', effect: 'Cuando un enemigo gana un turno adicional, realiza 3 golpes básicos sobre ese enemigo. Cada ataque básico genera el daño, efecto y cargas correspondientes.' },
            { type: 'buff', name: '🎯 Concentración', effect: 'Duplica cualquier cantidad de cargas generadas por el portador.' },
            { type: 'buff', name: '💠 Cuerpo Perfecto', effect: 'Al finalizar la ronda, elimina todos los debuffs activos del portador.' },
            { type: 'buff', name: '✨ Divinidad', effect: 'Cada vez que el enemigo aplica un debuff sobre el portador, hay un 50% de probabilidad de limpiarlo. Por cada debuff limpiado genera 2 cargas.' },
            { type: 'buff', name: '🔥 Aura de Fuego', effect: 'Cuando el portador es golpeado por un enemigo, aplica Quemadura de 2 HP al atacante.' },
            { type: 'buff', name: '❄️ Aura Gélida', effect: 'Cuando el portador es golpeado por un enemigo, aplica Congelación de 1 turno al atacante.' },
            { type: 'buff', name: '🌑 Aura Oscura', effect: 'Cuando el portador es golpeado por un enemigo, elimina 1 carga del atacante. 30% de probabilidad de eliminar 2 cargas adicionales.' },
            { type: 'buff', name: '✨ Aura de Luz', effect: 'Duplica la cantidad de recuperación de HP del portador.' },
            { type: 'buff', name: '🦠 Infectar', effect: 'Cuando el portador es golpeado, aplica el debuff Veneno de 2 turnos sobre el atacante.' },
            { type: 'buff', name: '🤝 Asistir', effect: 'Cuando un aliado realiza un ataque Especial u Over (Single Target), ejecuta un ataque básico sobre el enemigo atacado. El ataque básico causa el daño, efecto y cargas correspondientes.' },
            { type: 'buff', name: '🪞 Reflejar', effect: 'Cuando el portador recibe un ataque básico, especial u over, el atacante recibe el mismo daño que causó.' },
            // ── DEBUFFS ────────────────────────────────────────────────────────
            { type: 'debuff', name: '🔥 Quemadura', effect: 'Causa daño directo a los HP del portador cada turno. No es absorbido por el escudo.' },
            { type: 'debuff', name: '☀️ Quemadura Solar', effect: 'El portador no puede recuperar HP de ninguna fuente (curación, regeneración, robo de vida, etc.) mientras esté activo.' },
            { type: 'debuff', name: '☠️ Veneno', effect: 'Causa daño por tick. El daño incrementa +1 cada turno que el veneno permanezca activo (tick 1 = 1 dmg, tick 2 = 2 dmg, etc.). No es absorbido por el escudo.' },
            { type: 'debuff', name: '🩸 Sangrado', effect: 'El portador recibe +1 o +2 (aleatorio) de daño adicional por cada golpe recibido. No es absorbido por el escudo.' },
            { type: 'debuff', name: '⭐ Aturdimiento', effect: 'El portador pierde su próximo turno.' },
            { type: 'debuff', name: '💫 Mega Aturdimiento', effect: 'El portador pierde sus próximos 2 turnos.' },
            { type: 'debuff', name: '❄️ Congelación', effect: '50% de probabilidad de perder su próximo turno. Reduce la velocidad del portador un 10%.' },
            { type: 'debuff', name: '🧊 Megacongelación', effect: 'Pierde su próximo turno. Reduce la velocidad del portador un 20%.' },
            { type: 'debuff', name: '😱 Miedo', effect: '30% de probabilidad de perder su próximo turno. No puede generar cargas.' },
            { type: 'debuff', name: '😵 Confusión', effect: 'Los ataques no pueden seleccionar objetivo — el enemigo atacado es seleccionado aleatoriamente. 20% de probabilidad de atacar a un aliado en lugar de a un enemigo.' },
            { type: 'debuff', name: '👁️ Posesión', effect: 'En su próximo turno, ejecutará cualquier movimiento disponible sobre sus aliados.' },
            { type: 'debuff', name: '👁️👁️ Mega Posesión', effect: 'Durante sus próximos 2 turnos, ejecutará cualquier movimiento disponible sobre sus aliados.' },
            { type: 'debuff', name: '💔 Debilitar', effect: 'Recibe un 50% más de daño de todos los golpes recibidos.' },
            { type: 'debuff', name: '🔇 Silenciar', effect: 'Bloquea una categoría de movimientos (Básico, Especial u Over) del portador de manera aleatoria.' },
            { type: 'debuff', name: '😴 Agotamiento', effect: 'Reduce de 1 a 3 cargas del portador de manera aleatoria.' },
        ];

        function showBuffDebuffGuide() {
            const modal = document.getElementById('buffDebuffModal');
            const content = document.getElementById('buffDebuffContent');
            content.innerHTML = '';
            BUFF_DEBUFF_DATA.forEach(function(entry) {
                const card = document.createElement('div');
                const color = entry.type === 'buff' ? '#00c4ff' : '#ff4466';
                const bg = entry.type === 'buff' ? 'rgba(0,196,255,0.08)' : 'rgba(255,68,102,0.08)';
                card.style.cssText = 'background:' + bg + ';border:1px solid ' + color + ';border-radius:10px;padding:12px;';
                card.innerHTML = '<div style="font-weight:700;color:' + color + ';margin-bottom:6px;font-size:.9rem;">' + entry.name + '</div>' +
                    '<div style="color:#ccc;font-size:.8rem;line-height:1.5;">' + entry.effect + '</div>';
                content.appendChild(card);
            });
            modal.style.display = 'block';
        }

        function goToMainMenu() {
            // Stop battle music, clean up online state
            audioManager.stopBattleMusic();
            if (onlineMode && currentRoomId) {
                try { db.ref('rooms/' + currentRoomId).remove(); } catch(e) {}
                if (gameStateListener) { try { db.ref('rooms/' + currentRoomId + '/gameState').off(); } catch(e) {} }
                onlineMode = false;
                currentRoomId = null;
            }
            // Hide game over modal and game container
            document.getElementById('gameOverModal').classList.remove('show');
            document.querySelector('.game-container').style.display = 'none';
            // Reset csState
            csState.team1 = []; csState.team2 = [];
            csState.phase = 'team1'; csState.gameMode = 'multi';
            // Go to lobby if logged in, else mode select
            if (currentUser) {
                showScreen('lobbyScreen');
                trackOnlinePresence();
                refreshRooms();
            } else {
                document.getElementById('modeSelectScreen').style.display = 'flex';
            }
            audioManager.play('audioMenu');
        }

        function showGameOver(message) {
            gameState.gameOver = true;
            gameState.winner = message;
            hideContinueButton();
            updateWaitingIndicator('', false);
            audioManager.stopBattleMusic();
            audioManager.play('audioMenu');

            // ══ RANKED STATS ══
            if (typeof saveRankedResult === 'function' && window._rankedMode) {
                try {
                    const isDraw = message.includes('EMPATE');
                    const winnerTeam = isDraw ? 'draw' : message.includes('HUNTERS') ? 'team1' : 'team2';
                    const playerTeam = window._rankedPlayerTeam || 'team1';
                    const playerChars = Object.keys(gameState.characters || {}).filter(function(n){ const c=gameState.characters[n]; return c && c.team===playerTeam; });
                    const opponentTeam = playerTeam === 'team1' ? 'team2' : 'team1';
                    const opponentChars = Object.keys(gameState.characters || {}).filter(function(n){ const c=gameState.characters[n]; return c && c.team===opponentTeam; });
                    const opponentName = window._rankedOpponentName || window._rankedFakeOpponent || 'Oponente';
                    var _bs = {}, _chars = gameState.characters || {};
                    var _allAlly = Object.keys(_chars).filter(function(n){ var c=_chars[n]; return c && c.team===playerTeam; });
                    var _allOpp  = Object.keys(_chars).filter(function(n){ var c=_chars[n]; return c && c.team===opponentTeam; });
                    _bs.survivingAllies    = _allAlly.filter(function(n){ var c=_chars[n]; return c && !c.isDead && c.hp>0; }).length;
                    _bs.totalAllies        = _allAlly.length || 3;
                    _bs.survivingDefenders = _allOpp.filter(function(n){ var c=_chars[n]; return c && !c.isDead && c.hp>0; }).length;
                    _bs.totalDefenders     = _allOpp.length || 3;
                    _bs.enemiesEliminated  = _allOpp.filter(function(n){ var c=_chars[n]; return c && (c.isDead || c.hp<=0); }).length;
                    _bs.attackersEliminated= _allAlly.filter(function(n){ var c=_chars[n]; return c && (c.isDead || c.hp<=0); }).length;
                    _bs.totalEnemies       = _allOpp.length || 3;
                    _bs.totalAttackers     = _allAlly.length || 3;
                    _bs.roundsElapsed      = gameState.currentRound || 5;
                    _bs.defHpRemaining = _allOpp.reduce(function(s,n){ var c=_chars[n]; return s+(c&&!c.isDead?c.hp:0); }, 0);
                    _bs.defHpMax       = _allOpp.reduce(function(s,n){ var c=_chars[n]; return s+(c?c.maxHp||0:0); }, 0) || 1;
                    saveRankedResult(winnerTeam, playerTeam, playerChars, opponentName, opponentChars, _bs);
                } catch(e) { console.error('[RANKED] Error saving ranked result:', e); }
            }

            // Online: push game over — incluir mvpChar para que el guest pueda usarlo
            if (onlineMode && currentRoomId) {
                var _goMvp = null;
                if (typeof window._calculateMvpScore === 'function') {
                    var _goMvpBest = -1;
                    var _goWinTeam = message.includes('HUNTERS') ? 'team1' : (message.includes('REAPERS') ? 'team2' : null);
                    if (_goWinTeam) {
                        for (var _goN in gameState.characters) {
                            var _goC = gameState.characters[_goN];
                            if (!_goC || _goC.team !== _goWinTeam) continue;
                            var _goS = window._calculateMvpScore(_goN);
                            if (_goS > _goMvpBest) { _goMvpBest = _goS; _goMvp = _goN; }
                        }
                        if (_goMvp) _goMvp = _goMvp.replace(/\s+v\d+$/i, '').trim();
                    }
                }
                db.ref('rooms/' + currentRoomId + '/gameState').update({
                    gameOver: true,
                    winner: message,
                    mvpChar: _goMvp || null,
                    pushedBy: currentUser ? currentUser.uid : 'unknown'
                });
            }

            // ══ PANTALLA ÉPICA DE RESULTADO ══
            _showEpicResultScreen(message);
        }

        // Exponer globalmente para firebase-auth.js
        window._calculateMvpScore = function _calculateMvpScore(charName) {
            // Determinar si el personaje es tanque
            const _ch = gameState.characters[charName];
            if (!_ch) return 0;
            const _isTank = (_ch.maxHp >= 30) ||
                (_ch.passive && (_ch.passive.name === 'Hombre de Acero' || _ch.passive.name === 'Mega Provocacion' ||
                    _ch.passive.name === 'Efecto Omega' || _ch.passive.name === 'Señor de los Nazgul' ||
                    _ch.passive.name === 'Aura de Hielo')) ||
                (_ch.abilities||[]).some(function(ab){
                    return ab && (ab.effect === 'rugido_devastador' || (ab.description||'').toLowerCase().includes('provocac'));
                });
            const bs = gameState.battleStats || {};
            let score = 0;
            // 1. Kills × 10
            score += (bs.killMap && bs.killMap[charName] || 0) * 10;
            // 2. Cargas propias × 0.5
            score += (bs.chargesGenSelf && bs.chargesGenSelf[charName] || 0) * 0.5;
            // 3. Cargas a aliados × 1.5
            score += (bs.chargesGenAllies && bs.chargesGenAllies[charName] || 0) * 1.5;
            // 4. Daño causado (cualquier tipo) × 0.15
            score += (bs.damageDone && bs.damageDone[charName] || 0) * 0.15;
            // 5. Daño recibido × 1 (tanque × 1.5)
            score += (bs.damageReceived && bs.damageReceived[charName] || 0) * (_isTank ? 1.5 : 1);
            // 6. Debuffs aplicados × 2
            score += (bs.debuffsApplied && bs.debuffsApplied[charName] || 0) * 2;
            // 7. Buffs aplicados × 2
            score += (bs.buffsApplied && bs.buffsApplied[charName] || 0) * 2;
            // 8. Invocaciones × 3
            score += (bs.summonsDone && bs.summonsDone[charName] || 0) * 3;
            // 9. Kills por invocación +5
            score += (bs.summonKills && bs.summonKills[charName] || 0) * 5;
            // 10. HP curado a aliados × 1
            score += (bs.healingDone && bs.healingDone[charName] || 0) * 1;
            // 11. CC aplicado × 1.5
            score += (bs.ccApplied && bs.ccApplied[charName] || 0) * 1.5;
            // 12. Dotters: veneno y quemadura dividido entre aplicadores
            const _poisonAppliers = Array.from(bs.poisonAppliers || []);
            const _burnAppliers = Array.from(bs.burnAppliers || []);
            if (_poisonAppliers.includes(charName) && _poisonAppliers.length > 0) {
                score += (bs._totalPoisonDmg || 0) / _poisonAppliers.length;
            }
            if (_burnAppliers.includes(charName) && _burnAppliers.length > 0) {
                score += (bs._totalBurnDmg || 0) / _burnAppliers.length;
            }
            // 13. Crits × 2
            score += (bs.critsByChar && bs.critsByChar[charName] || 0) * 2;
            return Math.round(score * 10) / 10;
        }


        function _showEpicResultScreen(message) {
            const isDraw   = message.includes('EMPATE');
            const team1Win = message.includes('HUNTERS');
            const winTeam  = isDraw ? null : (team1Win ? 'team1' : 'team2');
            const loseTeam = isDraw ? null : (team1Win ? 'team2' : 'team1');

            // ── TOP 3 del equipo GANADOR por puntuación MVP ──
            const _top3 = [];
            if (winTeam) {
                const _allScored = [];
                for (const n in gameState.characters) {
                    const _ch = gameState.characters[n];
                    if (!_ch || _ch.team !== winTeam) continue;
                    _allScored.push({ name: n, score: _calculateMvpScore(n), char: _ch });
                }
                _allScored.sort(function(a,b){ return b.score - a.score; });
                _top3.push(..._allScored.slice(0,3));
            }
            const mvpName    = _top3.length > 0 ? _top3[0].name  : null;
            const mvpScore   = _top3.length > 0 ? _top3[0].score : 0;
            const mvpPortrait = mvpName ? (_top3[0].char.portrait || _top3[0].char.transformPortrait || '') : '';
            const mvpKills   = mvpName ? ((gameState.battleStats && gameState.battleStats.killMap && gameState.battleStats.killMap[mvpName]) || 0) : 0;

            // Función que genera el desglose de métricas de un personaje
            function _mvpBreakdown(charName, score, pos) {
                const _ch = gameState.characters[charName];
                const bs = gameState.battleStats || {};
                const medals = ['🥇','🥈','🥉'];
                const colors = ['#ffd700','#c0c0c0','#cd7f32'];
                const col = colors[pos] || '#888';
                const portrait = _ch ? (_ch.portrait || _ch.transformPortrait || '') : '';
                const kills   = (bs.killMap && bs.killMap[charName]) || 0;
                const dmgDone = (bs.damageDone && bs.damageDone[charName]) || 0;
                const dmg     = (bs.totalDamage && bs.totalDamage[charName]) || 0;
                const dmgRec  = (bs.damageReceived && bs.damageReceived[charName]) || 0;
                const crgSelf= (bs.chargesGenSelf && bs.chargesGenSelf[charName]) || 0;
                const crgAlly= (bs.chargesGenAllies && bs.chargesGenAllies[charName]) || 0;
                const debuffs= (bs.debuffsApplied && bs.debuffsApplied[charName]) || 0;
                const buffs  = (bs.buffsApplied && bs.buffsApplied[charName]) || 0;
                const summons= (bs.summonsDone && bs.summonsDone[charName]) || 0;
                const sumKills=(bs.summonKills && bs.summonKills[charName]) || 0;
                const heals  = (bs.healingDone && bs.healingDone[charName]) || 0;
                const cc     = (bs.ccApplied && bs.ccApplied[charName]) || 0;
                const crits  = (bs.critsByChar && bs.critsByChar[charName]) || 0;
                // Dotters
                const pAppliers = Array.from(bs.poisonAppliers||[]);
                const bAppliers = Array.from(bs.burnAppliers||[]);
                const poisonPts = pAppliers.includes(charName) && pAppliers.length > 0 ? Math.round((bs._totalPoisonDmg||0)/pAppliers.length * 10)/10 : 0;
                const burnPts   = bAppliers.includes(charName) && bAppliers.length > 0 ? Math.round((bs._totalBurnDmg||0)/bAppliers.length * 10)/10 : 0;
                // IsTank
                const _isTank = _ch && ((_ch.maxHp||0) >= 30 || (_ch.passive && ['Hombre de Acero','Mega Provocacion','Efecto Omega','Señor de los Nazgul','Aura de Hielo'].includes(_ch.passive.name)));

                function _row(icon, label, raw, pts) {
                    if (!raw && raw !== 0) return '';
                    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
                        '<span style="font-size:.68rem;color:#aaa;">' + icon + ' ' + label + ' <span style="color:#555;">(' + raw + ')</span></span>' +
                        '<span style="font-size:.68rem;color:' + col + ';font-weight:700;">+' + pts.toFixed(1) + '</span>' +
                    '</div>';
                }

                const rows = [
                    kills   > 0 ? _row('💀','Kills',          kills,   kills * 10)          : '',
                    dmgDone > 0 ? _row('⚔️','Daño causado',   Math.round(dmgDone), Math.round(dmgDone * 0.15 * 10)/10) : '',
                    crgSelf > 0 ? _row('⚡','Cargas propias',  crgSelf, crgSelf * 0.5)       : '',
                    crgAlly > 0 ? _row('⚡','Cargas a aliados',crgAlly, crgAlly * 1.5)       : '',
                    dmgRec  > 0 ? _row('🛡️','Daño recibido' + (_isTank?' (×1.5)':''), dmgRec, Math.round(dmgRec * (_isTank?1.5:1) * 10)/10) : '',
                    debuffs > 0 ? _row('💀','Debuffs aplicados',debuffs, debuffs * 2)        : '',
                    buffs   > 0 ? _row('✨','Buffs aplicados',  buffs,   buffs * 2)          : '',
                    summons > 0 ? _row('🐉','Invocaciones',     summons, summons * 3)        : '',
                    sumKills> 0 ? _row('🐉','Kills por invoc.', sumKills,sumKills * 5)       : '',
                    heals   > 0 ? _row('💚','HP curado',        heals,   heals * 1)          : '',
                    cc      > 0 ? _row('🔒','CC aplicado',      cc,      cc * 1.5)           : '',
                    poisonPts>0 ? _row('☠️','Veneno (dotter)',  Math.round(bs._totalPoisonDmg||0), poisonPts) : '',
                    burnPts >0  ? _row('🔥','Quemadura (dotter)',Math.round(bs._totalBurnDmg||0), burnPts)   : '',
                    crits   > 0 ? _row('💥','Crits',            crits,   crits * 2)          : '',
                ].filter(Boolean).join('');

                return '<div style="background:rgba(255,255,255,0.03);border:1px solid ' + col + '44;border-radius:14px;padding:14px;flex:1;min-width:220px;">' +
                    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
                        (portrait ? '<img src="' + portrait + '" style="width:48px;height:48px;border-radius:8px;object-fit:cover;border:2px solid ' + col + ';" onerror="this.style.display=\'none\'">' : '') +
                        '<div>' +
                            '<div style="font-size:.65rem;color:' + col + ';letter-spacing:.15em;">' + medals[pos] + ' ' + (pos===0?'MVP':'TOP '+(pos+1)) + '</div>' +
                            '<div style="font-size:.85rem;font-weight:700;color:#fff;">' + charName + '</div>' +
                        '</div>' +
                        '<div style="margin-left:auto;text-align:right;">' +
                            '<div style="font-family:Orbitron,sans-serif;font-size:1rem;font-weight:900;color:' + col + ';">' + score.toFixed(1) + '</div>' +
                            '<div style="font-size:.6rem;color:#555;">pts MVP</div>' +
                        '</div>' +
                    '</div>' +
                    (rows ? '<div style="max-height:160px;overflow-y:auto;scrollbar-width:thin;">' + rows + '</div>' : '<div style="font-size:.7rem;color:#555;text-align:center;">Sin métricas registradas</div>') +
                '</div>';
            }

            // ── STATS ──
            const bs = gameState.battleStats || {};
            const totalDmgAll = Object.values(bs.totalDamage || {}).reduce((a,b)=>a+b,0);
            const rounds = gameState.currentRound || 1;
            const team1Alive = Object.values(gameState.characters).filter(c=>c&&c.team==='team1'&&!c.isDead&&c.hp>0).length;
            const team2Alive = Object.values(gameState.characters).filter(c=>c&&c.team==='team2'&&!c.isDead&&c.hp>0).length;

            // Top 3 causantes de daño
            const dmgEntries = Object.entries(bs.totalDamage||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);

            // ── COLORES por equipo ──
            const winColor  = team1Win ? '#00c4ff' : '#ff4466';
            const winLabel  = isDraw ? '⚔️ EMPATE' : (team1Win ? '🔷 HUNTERS GANAN' : '🔶 REAPERS GANAN');
            const glowColor = team1Win ? 'rgba(0,196,255,0.6)' : 'rgba(255,68,102,0.6)';

            // ── HTML DE LA PANTALLA ──
            const html = `
<div id="epicResultOverlay" style="
    position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;
    background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;
    animation:epicFadeIn 0.6s ease;">
  <div style="
      max-width:860px;width:95%;background:linear-gradient(135deg,rgba(5,8,20,0.98),rgba(10,5,25,0.98));
      border:2px solid ${winColor};border-radius:24px;padding:32px 28px;
      box-shadow:0 0 60px ${glowColor},0 0 120px ${glowColor.replace('0.6','0.2')};
      animation:epicSlideUp 0.55s cubic-bezier(.22,1,.36,1);">

    <!-- TÍTULO -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-family:'Orbitron',sans-serif;font-size:clamp(1.5rem,4vw,2.6rem);font-weight:900;
          color:${winColor};text-shadow:0 0 30px ${winColor};letter-spacing:.08em;
          animation:epicTitlePop 0.7s 0.3s both;">
        ${winLabel}
      </div>
      <div style="color:#666;font-size:.85rem;margin-top:6px;letter-spacing:.15em;">RONDAS JUGADAS: ${rounds}</div>
    </div>

    <!-- STATS ROW (compacto, arriba) -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px;">
      ${_epicStat('⚔️','Daño Total',totalDmgAll)}
      ${_epicStat('💥','Crits',bs.crits||0)}
      ${_epicStat('💫','Overs',bs.oversUsed||0)}
      ${_epicStat('💚','HP Curado',bs.healsGiven||0)}
      ${_epicStat('🏆','Sobrevivientes',team1Win?team1Alive:team2Alive)}
      ${_epicStat('🔄','Rondas',rounds)}
    </div>

    <!-- TOP 3 MVP -->
    ${_top3.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:.7rem;color:#888;letter-spacing:.15em;margin-bottom:12px;text-align:center;">⭐ TOP 3 — EQUIPO GANADOR</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${_top3.map(function(entry,i){ return _mvpBreakdown(entry.name, entry.score, i); }).join('')}
      </div>
    </div>` : ''}

    <!-- TOP DAÑO -->
    ${dmgEntries.length > 0 ? `
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
        border-radius:12px;padding:14px;margin-bottom:20px;">
      <div style="font-size:.7rem;color:#888;letter-spacing:.15em;margin-bottom:10px;">📊 TOP CAUSANTES DE DAÑO</div>
      ${dmgEntries.map(function(e,i){
          const medals=['🥇','🥈','🥉'];
          const c = gameState.characters[e[0]];
          const pct = totalDmgAll > 0 ? Math.round(e[1]/totalDmgAll*100) : 0;
          const barColor = i===0 ? '#ffcc00' : i===1 ? '#aaaaaa' : '#cc7700';
          return '<div style="margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">' +
              '<span style="font-size:.8rem;color:#ddd;">' + medals[i] + ' ' + e[0] + '</span>' +
              '<span style="font-size:.75rem;color:' + barColor + ';font-weight:700;">' + e[1] + ' dmg</span>' +
            '</div>' +
            '<div style="height:4px;background:rgba(255,255,255,0.08);border-radius:4px;">' +
              '<div style="height:4px;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width .8s ease;"></div>' +
            '</div></div>';
      }).join('')}
    </div>` : ''}

    <!-- BOTONES -->
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
      <button onclick="_epicGoMenu()" style="
          padding:12px 28px;font-family:'Orbitron',sans-serif;font-size:.85rem;font-weight:700;
          background:linear-gradient(135deg,rgba(0,196,255,0.15),rgba(0,196,255,0.08));
          color:#00c4ff;border:2px solid #00c4ff;border-radius:50px;cursor:pointer;
          transition:all .2s;" onmouseover="this.style.boxShadow='0 0 20px #00c4ff'" onmouseout="this.style.boxShadow='none'">
        🏠 Menú Principal
      </button>
      <button onclick="location.reload()" style="
          padding:12px 28px;font-family:'Orbitron',sans-serif;font-size:.85rem;font-weight:700;
          background:linear-gradient(135deg,rgba(255,68,102,0.15),rgba(255,68,102,0.08));
          color:#ff4466;border:2px solid #ff4466;border-radius:50px;cursor:pointer;
          transition:all .2s;" onmouseover="this.style.boxShadow='0 0 20px #ff4466'" onmouseout="this.style.boxShadow='none'">
        ⚔️ Nueva Batalla
      </button>
      <button id="epicRevanchaBtn" onclick="_epicRevancha()" style="
          display:none;padding:12px 28px;font-family:'Orbitron',sans-serif;font-size:.85rem;font-weight:700;
          background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.08));
          color:#a855f7;border:2px solid #a855f7;border-radius:50px;cursor:pointer;
          transition:all .2s;" onmouseover="this.style.boxShadow='0 0 20px #a855f7'" onmouseout="this.style.boxShadow='none'">
        🔄 Revancha
      </button>
    </div>
  </div>
</div>`;

            // Insertar en el DOM
            const _existing = document.getElementById('epicResultOverlay');
            if (_existing) _existing.remove();
            document.body.insertAdjacentHTML('beforeend', html);

            // Mostrar botón revancha si aplica
            if (typeof handleRevancha === 'function' && (onlineMode || gameState.gameMode === 'multi')) {
                const rb = document.getElementById('epicRevanchaBtn');
                if (rb) rb.style.display = 'inline-block';
            }

            // Animar barras de daño después de un tick
            setTimeout(function() {
                const bars = document.querySelectorAll('#epicResultOverlay [data-bar]');
                bars.forEach(function(b) { b.style.width = b.dataset.bar + '%'; });
            }, 100);
        }

        function _epicStat(emoji, label, value) {
            return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
                'border-radius:10px;padding:10px;text-align:center;">' +
                '<div style="font-size:1.2rem;margin-bottom:2px;">' + emoji + '</div>' +
                '<div style="font-size:1.1rem;font-weight:700;color:#fff;">' + value + '</div>' +
                '<div style="font-size:.65rem;color:#666;margin-top:2px;">' + label + '</div>' +
            '</div>';
        }

        function _epicGoMenu() {
            const ov = document.getElementById('epicResultOverlay');
            if (ov) ov.remove();
            goToMainMenu();
        }

        function _epicRevancha() {
            const ov = document.getElementById('epicResultOverlay');
            if (ov) ov.remove();
            if (typeof handleRevancha === 'function') handleRevancha();
        }

        // ==================== BATTLE LOG ====================
        function addLog(message, type = 'info') {
            const logContent = document.getElementById('battleLogContent');
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = message;
            logContent.insertBefore(entry, logContent.firstChild);
            
            // Mantener hasta 200 mensajes (scroll permite ver todos)
            while (logContent.children.length > 200) {
                logContent.removeChild(logContent.lastChild);
            }
            // Asegurar scroll habilitado en el contenedor
            if (logContent.style.overflowY !== 'auto' && logContent.style.overflowY !== 'scroll') {
                logContent.style.overflowY = 'auto';
                logContent.style.maxHeight = logContent.style.maxHeight || '420px';
                logContent.style.scrollbarWidth = 'thin';
            }
        }

        // ==================== INICIO DEL JUEGO ====================
        window.onload = function() {
            csInit();
            // Add floating mute/unmute button
            const muteBtn = document.createElement('button');
            muteBtn.id = 'audioToggleBtn';
            muteBtn.textContent = '🔊';
            muteBtn.title = 'Silenciar/Activar música';
            muteBtn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:9999;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:1.2rem;padding:6px 10px;border-radius:8px;cursor:pointer;transition:all .2s;';
            muteBtn.onmouseover = function() { this.style.background = 'rgba(0,196,255,0.3)'; };
            muteBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.6)'; };
            muteBtn.onclick = function() { audioManager.toggleMute(); };
            document.body.appendChild(muteBtn);
        };
