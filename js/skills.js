// ==================== EJECUCIÓN DE HABILIDAD ====================

        // Aplicar daño AOE a TODOS los enemigos (personajes + invocaciones)
        function applyAOEDamageToTeam(enemyTeam, damage, attackerName) {
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (c && c.team === enemyTeam && !c.isDead && c.hp > 0) {
                    if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) {
                        addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff');
                        continue;
                    }
                    applyDamageWithShield(n, damage, attackerName);
                }
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

        function executeAbility(targetName) {
            audioManager.playSelect(); // SFX on every ability/action
            try {
                closeTargetModal();
                
                const attacker = gameState.characters[gameState.selectedCharacter];
                const charName = gameState.selectedCharacter;
                const ability = gameState.selectedAbility;
                const adjustedCost = gameState.adjustedCost || ability.cost;
                
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
            
            if (attacker.rikudoMode && gameState.selectedCharacter === 'Madara Uchiha') {
                finalDamage *= 2;
                finalChargeGain *= 2;
            }

            // BUFF FURIA: +50% daño
            if (finalDamage > 0 && hasStatusEffect(gameState.selectedCharacter, 'Furia')) {
                finalDamage = Math.ceil(finalDamage * 1.5);
            }
            // BUFF FRENESÍ: 50% de crítico en este ataque (daño doble)
            if (finalDamage > 0 && hasStatusEffect(gameState.selectedCharacter, 'Frenesi')) {
                if (Math.random() < 0.50) {
                    finalDamage *= 2;
                    addLog(`⚡ ¡FRENESÍ CRÍTICO! ${gameState.selectedCharacter}`, 'buff');
                }
            }
            // GOKU: bonus daño de Entrenamiento de los Dioses
            if (gameState.selectedCharacter === 'Goku' && attacker.gokuBonusDamage > 0 && finalDamage > 0) {
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
            const bolvar = Object.values(gameState.summons).find(s => s && s.name === 'Bolvar Fordragon' && s.team === attacker.team);
            if (bolvar && finalDamage > 0 && (ability.type === 'special' || ability.type === 'over')) {
                finalDamage *= 2;
                addLog(`🔱 Bolvar Fordragon: daño de habilidad duplicado`, 'buff');
            }
            // DARION MORGRAINE: +50% prob crit (se aplica a critChance del ability inline)
            // REGLA DE ORO (Gilgamesh): +10% crit base sobre cualquier critChance (NO mutar ability)
            // Se aplica inline en cada handler como gilgameshCritBonus = 0.10

            // MODO KURAMA (Minato): +3 daño en todos los ataques
            if (attacker.kuramaMode && gameState.selectedCharacter === 'Minato Namikaze' && finalDamage > 0) {
                finalDamage += 3;
            }
            // MODO KURAMA: +1 carga base en todos los ataques
            if (attacker.kuramaMode && gameState.selectedCharacter === 'Minato Namikaze') {
                finalChargeGain += 1;
            }

            // ARMADURA DIVINA DEL FÉNIX (Ikki): daño triple en enemigos con Quemadura
            if (attacker.fenixArmorActive && gameState.selectedCharacter === 'Ikki de Fenix' && finalDamage > 0) {
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
                if (attacker.darkSideAwakened) kiDmg += 2; // reuse darkSide check if ever applicable
                applyDamageWithShield(targetName, kiDmg, charName);
                addLog('⚔️ Espada de Ki: ' + kiDmg + ' daño a ' + targetName, 'damage');

            } else if (ability.effect === 'teleportacion_confusion') {
                applyConfusion(targetName, 2);
                const stolen = Math.min(2, gameState.characters[targetName] ? gameState.characters[targetName].charges : 0);
                if (gameState.characters[targetName]) gameState.characters[targetName].charges = Math.max(0, (gameState.characters[targetName].charges||0) - 2);
                attacker.charges = Math.min(20, (attacker.charges||0) + stolen);
                addLog('🌀 Teletransportación: Confusión + roba ' + stolen + ' cargas de ' + targetName, 'damage');

            } else if (ability.effect === 'lazo_divino') {
                applyDamageWithShield(targetName, finalDamage, charName);
                // Poison with 50% chance to drain 2 charges per tick
                applyDebuff(targetName, { name: 'Veneno', type: 'debuff', duration: ability.poisonDuration || 4, emoji: '☠️', poisonPercent: 5, poisonChargeDrain: true, poisonChargeDrainAmount: 2 });
                addLog('☠️ Lazo Divino: ' + finalDamage + ' daño + Veneno 4t a ' + targetName + ' (50% -2 cargas/tick)', 'damage');

            } else if (ability.effect === 'guadana_divina') {
                const enemyTeamGD = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamGD || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    c.charges = 0;
                    addLog('⚰️ Guadaña Divina: ' + n + ' pierde todas sus cargas', 'damage');
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
                applyBleed(targetName, ability.bleedDuration || 3);
                addLog(`🩸 ${gameState.selectedCharacter} provoca Sangrado en ${targetName}`, 'damage');

            } else if (ability.effect === 'apply_fear') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                applyFear(targetName, ability.fearDuration || 2);
                addLog(`😱 ${gameState.selectedCharacter} infunde Miedo en ${targetName}`, 'damage');

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
                // Precepto (Leonidas): daño + Phalanx permanent bonus
                const leonBonus = attacker.phalanxBonusDmg || 0;
                const leonCgBonus = attacker.phalanxBonusCg || 0;
                applyDamageWithShield(targetName, finalDamage + leonBonus, gameState.selectedCharacter);
                if (leonCgBonus > 0) {
                    attacker.charges = Math.min(20, (attacker.charges || 0) + leonCgBonus);
                }
                const allies = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c.team === attacker.team && n !== gameState.selectedCharacter && !c.isDead && c.hp > 0; });
                if (allies.length > 0) {
                    const lucky = allies[Math.floor(Math.random() * allies.length)];
                    gameState.characters[lucky].charges += 1;
                    addLog(`⚡ ${lucky} recibe 1 carga (Precepto)`, 'buff');
                }

            } else if (ability.effect === 'grito_de_esparta') {
                // Grito de Esparta: limpia debuffs de aliados + Protección Sagrada 2 turnos
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === attacker.team && !c.isDead && c.hp > 0) {
                        c.statusEffects = c.statusEffects.filter(e => e.type === 'buff');
                        applyHolyProtection(n, 3); // 3 = dura 2 turnos reales (se decrementa al fin de su turno)
                    }
                }
                addLog(`⚔️ ¡Grito de Esparta! Debuffs limpiados y Escudo Sagrado aplicado a todos los aliados`, 'buff');


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
                    { name:'quemadura',  fn: function(){ applyBurn(targetName, 10, 2); } },
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
                const darionBuff = Object.values(gameState.summons).find(s => s && s.name === 'Darion Morgraine' && s.team === attacker.team);
                const critBonusFromDarion = darionBuff ? 0.50 : 0;
                const gilgameshBonus = (gameState.selectedCharacter === 'Gilgamesh') ? 0.10 : 0;
                const muzanCritB = (gameState.selectedCharacter === 'Muzan Kibutsuji') ? (attacker.muzanCritBonus || 0) : 0;
                const isCritBasic = Math.random() < Math.min(1, (ability.critChance || 0) + critBonusFromDarion + gilgameshBonus + muzanCritB);
                if (isCritBasic) {
                    baseDmgCrit *= 2;
                    addLog(`💥 ¡CRÍTICO! ${gameState.selectedCharacter} usa ${ability.name}`, 'damage');
                    triggerGokuCrit(gameState.selectedCharacter);
                    triggerGilgameshCrit(gameState.selectedCharacter);
                    // ESPÍRITU DEL HÉROE (Saitama): cargas = mitad del daño en crítico
                    if (gameState.selectedCharacter === 'Saitama') {
                        const critCharges = Math.floor(baseDmgCrit / 2);
                        attacker.charges += critCharges;
                        addLog(`💪 Espíritu del Héroe: Saitama gana ${critCharges} cargas por crítico`, 'buff');
                    }
                }
                if (ability.target === 'aoe' || targetName === null) {
                    // AOE: dañar a todos los enemigos (p.ej. Gate of Babylon de Gilgamesh)
                    const critAoeTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    checkAndRemoveStealth(critAoeTeam);
                    let critAoeLog = [];
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === critAoeTeam && !c.isDead && c.hp > 0) {
                            // Each enemy gets its own crit roll
                            const darionB2 = Object.values(gameState.summons).find(s => s && s.name === 'Darion Morgraine' && s.team === attacker.team);
                            const criB2 = darionB2 ? 0.50 : 0;
                            const gilB2 = (gameState.selectedCharacter === 'Gilgamesh') ? 0.10 : 0;
                            const mzB2 = (gameState.selectedCharacter === 'Muzan Kibutsuji') ? (attacker.muzanCritBonus || 0) : 0;
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

            } else if (ability.effect === 'kaio_ken') {
                // GOKU - Kaio Ken: aplica Furia + Frenesí 2 turnos
                applyFuria(gameState.selectedCharacter, 2);
                applyFrenesi(gameState.selectedCharacter, 2);
                addLog(`🔥 ${gameState.selectedCharacter} activa Kaio Ken (Furia + Frenesí 2 turnos)`, 'buff');

            } else if (ability.effect === 'genkidama') {
                // GOKU - Genkidama: AOE, críticos reducen cargas a 0
                const gkTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(gkTeam);
                const darionGk = Object.values(gameState.summons).find(s => s && s.name === 'Darion Morgraine' && s.team === attacker.team);
                const critBonusGk = darionGk ? 0.50 : 0;
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
                // SAITAMA - Golpe Grave: 20 daño, si mata genera turno adicional
                const tgtGrave = gameState.characters[targetName];
                const wasAliveBefore = tgtGrave && !tgtGrave.isDead && tgtGrave.hp > 0;
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog(`💀 ${gameState.selectedCharacter} usa Golpe Grave en ${targetName} causando ${finalDamage} daño`, 'damage');
                if (wasAliveBefore && tgtGrave && (tgtGrave.isDead || tgtGrave.hp <= 0)) {
                    addLog(`💪 ¡DERROTA! Saitama gana un turno adicional`, 'buff');
                    // ANTICIPACION: chars with this buff fire 3 basics on the attacker
                    triggerAnticipacion(gameState.selectedCharacter, attacker.team);
                    // Turno adicional: no incrementar turno, abrir selección de habilidades
                    renderCharacters();
                    renderSummons();
                    showContinueButton();
                    return; // No llamar endTurn
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
                const myTeamCS = attacker.team;
                const enemyTeamCS = myTeamCS === 'team1' ? 'team2' : 'team1';
                const alliesCS = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === myTeamCS && !c.isDead && c.hp > 0; });
                const enemiesCS = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === enemyTeamCS && !c.isDead && c.hp > 0; });
                if (alliesCS.length > 0 && enemiesCS.length > 0) {
                    const allyNameCS = alliesCS[Math.floor(Math.random() * alliesCS.length)];
                    const enemyNameCS = enemiesCS[Math.floor(Math.random() * enemiesCS.length)];
                    const allyCS = gameState.characters[allyNameCS];
                    const enemyCS = gameState.characters[enemyNameCS];
                    const allyDebuffsCS = allyCS.statusEffects.filter(e => e && e.type === 'debuff');
                    allyCS.statusEffects = allyCS.statusEffects.filter(e => e && e.type !== 'debuff');
                    allyDebuffsCS.forEach(d => enemyCS.statusEffects.push(d));
                    addLog('🎵 Cambio de Sangre: Debuffs de ' + allyNameCS + ' transferidos a ' + enemyNameCS, 'buff');
                }

            // ── CAMBIO DEMONÍACO (Nakime - cargas y buffs bidireccional) ──
            } else if (ability.effect === 'cambio_demoniaco') {
                const myTeamCD = attacker.team;
                const enemyTeamCD = myTeamCD === 'team1' ? 'team2' : 'team1';
                const alliesCD = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === myTeamCD && !c.isDead && c.hp > 0; });
                const enemiesCD = Object.keys(gameState.characters).filter(n => { const c = gameState.characters[n]; return c && c.team === enemyTeamCD && !c.isDead && c.hp > 0; });
                if (alliesCD.length > 0 && enemiesCD.length > 0) {
                    const allyNameCD = alliesCD[Math.floor(Math.random() * alliesCD.length)];
                    const enemyNameCD = enemiesCD[Math.floor(Math.random() * enemiesCD.length)];
                    const allyCD = gameState.characters[allyNameCD];
                    const enemyCD = gameState.characters[enemyNameCD];
                    // Swap charges
                    const tmpCharges = allyCD.charges;
                    allyCD.charges = Math.min(20, enemyCD.charges);
                    enemyCD.charges = Math.min(20, tmpCharges);
                    // Swap buffs bidirectionally
                    const allyBuffsCD = allyCD.statusEffects.filter(e => e && e.type === 'buff');
                    const enemyBuffsCD = enemyCD.statusEffects.filter(e => e && e.type === 'buff');
                    allyCD.statusEffects = allyCD.statusEffects.filter(e => e && e.type !== 'buff').concat(enemyBuffsCD);
                    enemyCD.statusEffects = enemyCD.statusEffects.filter(e => e && e.type !== 'buff').concat(allyBuffsCD);
                    addLog('🎵 Cambio Demoníaco: Cargas y Buffs intercambiados entre ' + allyNameCD + ' y ' + enemyNameCD, 'buff');
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
                // MUZAN - Sombra de la Noche: AOE daño + Sigilo 2 rondas + veneno AOE 3 turnos
                const snTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(snTeam);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === snTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        applyPoison(n, 3);
                    }
                }
                applyStealth(gameState.selectedCharacter, 2);
                addLog(`🌑 Sombra de la Noche: ${finalDamage} daño AOE + Veneno + Sigilo 2 rondas`, 'damage');

            } else if (ability.effect === 'muzan_transform') {
                // MUZAN - Rey de los Demonios Definitivo
                attacker.muzanTransformed = true;
                const mzTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(mzTeam);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === mzTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        applyPoison(n, 5);
                    }
                }
                // Regen 30% x5 turnos en sí mismo
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 5, amount: Math.ceil(attacker.maxHp * 0.30), emoji: '💖' });
                // +20% velocidad
                attacker.speed = Math.ceil(attacker.speed * 1.20);
                // +70% crit chance (almacenado en el personaje)
                attacker.muzanCritBonus = (attacker.muzanCritBonus || 0) + 0.70;
                ability.used = true;
                addLog(`👹 ¡Rey de los Demonios Definitivo! Daño AOE, Veneno 5t, Regen 30%, +20% VEL, +70% crit`, 'buff');

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
                attacker.statusEffects.push({ name: 'MegaProvocacion', type: 'buff', duration: 4, emoji: '🌑' });
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 4, percent: 20, emoji: '💖' });
                addLog('💍 ¡Poder del Anillo! Sauron activa MegaProvocación 4t + Regeneración 20% 4t', 'buff');

            } else if (ability.effect === 'apply_counterattack') {
                // DARTH VADER - Puño del Imperio: Buff Contraataque
                applyCounterattackBuff(gameState.selectedCharacter, ability.counterDuration || 4);
                addLog(`⚔️ ${gameState.selectedCharacter} activa Contraataque por ${ability.counterDuration || 4} turnos`, 'buff');

            } else if (ability.effect === 'apply_megaprovocation_buff') {
                // DARTH VADER - Lado Oscuro de la Fuerza: Mega Provocación 4 turnos
                // Use Kamish-style mega provocation as a character buff
                attacker.statusEffects.push({ name: 'MegaProvocacion', type: 'buff', duration: ability.provDuration || 4, emoji: '🌑' });
                addLog(`🌑 ${gameState.selectedCharacter} activa Mega Provocación por ${ability.provDuration || 4} turnos (absorbe todo el daño del equipo)`, 'buff');

            } else if (ability.effect === 'ira_elegido') {
                // DARTH VADER - Ira del Elegido Caído: 2 AOE + 1 por HP perdido
                const iraBonusDmg = attacker.maxHp - attacker.hp;
                const iraTotal = finalDamage + iraBonusDmg;
                const iraTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(iraTeam);
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === iraTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, iraTotal, gameState.selectedCharacter);
                    }
                }
                for (let sId in gameState.summons) {
                    const s = gameState.summons[sId];
                    if (s && s.team === iraTeam && s.hp > 0) applySummonDamage(sId, iraTotal, gameState.selectedCharacter);
                }
                addLog(`⚡ Ira del Elegido Caído: ${iraTotal} daño AOE (${finalDamage} base + ${iraBonusDmg} por HP perdido)`, 'damage');

            } else if (ability.effect === 'agonia_escarcha') {
                // LICH KING - Agonía de Escarcha: 1 daño + roba 1 HP adicional del objetivo + cura 1 HP a LK
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                // Robo de vida: elimina 1 HP adicional del objetivo (si sigue vivo)
                const tgtAE = gameState.characters[targetName];
                if (tgtAE && !tgtAE.isDead && tgtAE.hp > 0) {
                    tgtAE.hp = Math.max(0, tgtAE.hp - 1);
                    if (tgtAE.hp <= 0) { tgtAE.isDead = true; addLog(`💀 ${targetName} fue derrotado`, 'damage'); }
                    else { addLog(`❄️ Agonía de Escarcha: roba 1 HP adicional de ${targetName}`, 'damage'); }
                }
                // Curar 1 HP a Lich King
                const lkHeal = Math.min(1, attacker.maxHp - attacker.hp);
                if (lkHeal > 0) { attacker.hp = Math.min(attacker.maxHp, attacker.hp + lkHeal); addLog(`❄️ Lich King recupera 1 HP (robo de vida)`, 'heal'); }
                addLog(`❄️ Agonía de Escarcha: ${finalDamage} daño a ${targetName}`, 'damage');

            } else if (ability.effect === 'cadenas_hielo') {
                // LICH KING - Cadenas de Hielo: Provocación 3 turnos
                attacker.statusEffects = attacker.statusEffects.filter(e => normAccent(e.name || '') !== 'provocacion');
                attacker.statusEffects.push({ name: 'Provocación', type: 'buff', duration: 3, emoji: '🛡️' });
                attacker.lichKingCadenasActive = true;
                addLog(`🛡️ Lich King activa Provocación por 3 turnos (reduce celeridad atacante 5% si recibe daño)`, 'buff');

            } else if (ability.effect === 'segador_almas') {
                // LICH KING - Segador de Almas: 5 daño, si mata revive como aliado
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
                const lichPool = ['Sindragosa', 'Kel Thuzad', 'Darion Morgraine', 'Bolvar Fordragon', 'Tirion Fordring'];
                const lichWeights = { 'Sindragosa': 24, 'Kel Thuzad': 24, 'Darion Morgraine': 24, 'Bolvar Fordragon': 24, 'Tirion Fordring': 4 };
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
                    const toSummonLich = Math.min(3, availableLich.length);
                    const remainingLich = [...availableLich];
                    const selectedLich = [];
                    for (let i = 0; i < toSummonLich; i++) {
                        if (remainingLich.length === 0) break;
                        const chosen = pickWeightedLich(remainingLich, lichWeights);
                        selectedLich.push(chosen);
                        remainingLich.splice(remainingLich.indexOf(chosen), 1);
                        summonShadow(chosen, gameState.selectedCharacter);
                        // Invocaciones especiales con Mega Provocación permanente
                        if (chosen === 'Sindragosa' || chosen === 'Tirion Fordring') {
                            const newSummon = Object.values(gameState.summons).find(s => s && s.name === chosen && s.summoner === gameState.selectedCharacter);
                            if (newSummon) newSummon.megaProvocation = true;
                        }
                    }
                    addLog(`👑 El Rey Caído: Lich King invoca ${selectedLich.join(', ')}`, 'buff');
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

            } else if (ability.effect === 'sentencia_del_sol') {
                // OZYMANDIAS - Sentencia del Sol
                const tgtSen = gameState.characters[targetName];
                let dmgSen = finalDamage;
                if (tgtSen && tgtSen.statusEffects && tgtSen.statusEffects.some(e => e && e.name === 'Quemadura Solar')) {
                    const bonusSen = Math.floor(Math.random() * 3) + 1;
                    dmgSen += bonusSen;
                    addLog(`☀️ Sentencia del Sol: +${bonusSen} daño adicional (Quemadura Solar activa)`, 'damage');
                }
                applyDamageWithShield(targetName, dmgSen, gameState.selectedCharacter);
                addLog(`⚔️ Sentencia del Sol: ${dmgSen} daño a ${targetName}`, 'damage');

            } else if (ability.effect === 'summon_sphinx') {
                // OZYMANDIAS - The Sphinx Wehem-Mesut
                const existingSphinx = Object.values(gameState.summons).find(s => s && s.name === 'Sphinx Wehem-Mesut' && s.summoner === gameState.selectedCharacter);
                if (existingSphinx) {
                    addLog(`❌ Sphinx Wehem-Mesut ya está invocada`, 'info');
                } else {
                    summonShadow('Sphinx Wehem-Mesut', gameState.selectedCharacter);
                    addLog(`🦁 Ozymandias invoca a Sphinx Wehem-Mesut`, 'buff');
                }

            } else if (ability.effect === 'summon_ramesseum') {
                // OZYMANDIAS - Ramesseum Tentyris
                const existingRam = Object.values(gameState.summons).find(s => s && s.name === 'Ramesseum Tentyris' && s.summoner === gameState.selectedCharacter);
                if (existingRam) {
                    addLog(`❌ Ramesseum Tentyris ya está invocado`, 'info');
                } else {
                    summonShadow('Ramesseum Tentyris', gameState.selectedCharacter);
                    addLog(`🏛️ Ozymandias invoca a Ramesseum Tentyris`, 'buff');
                }

            } else if (ability.effect === 'espada_merodach') {
                // GILGAMESH - Espada Merodach: AOE daño + elimina 3 cargas, crítico posible
                const emTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                checkAndRemoveStealth(emTeam);
                const darionEM = Object.values(gameState.summons).find(s => s && s.name === 'Darion Morgraine' && s.team === attacker.team);
                const muzanEM = (gameState.selectedCharacter === 'Muzan Kibutsuji') ? (attacker.muzanCritBonus || 0) : 0;
                const critBonusEM = (darionEM ? 0.50 : 0) + 0.10 + muzanEM; // +10% regla de oro + Muzan bonus
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== emTeam || c.isDead || c.hp <= 0) continue;
                    const isCritEM = Math.random() < ((ability.critChance || 0.10) + critBonusEM);
                    let dmgEM = finalDamage;
                    if (isCritEM) {
                        dmgEM *= 2;
                        addLog(`💥 ¡CRÍTICO! Espada Merodach en ${n}`, 'damage');
                        triggerGilgameshCrit(gameState.selectedCharacter);
                    }
                    applyDamageWithShield(n, dmgEM, gameState.selectedCharacter);
                    c.charges = Math.max(0, c.charges - 3);
                    addLog(`👑 ${n} pierde 3 cargas (Espada Merodach)`, 'damage');
                }
                for (let sId in gameState.summons) {
                    const s = gameState.summons[sId];
                    if (s && s.team === emTeam && s.hp > 0) applySummonDamage(sId, finalDamage, gameState.selectedCharacter);
                }
                addLog(`⚔️ Espada Merodach: ${finalDamage} daño AOE a todos los enemigos`, 'damage');

            } else if (ability.effect === 'enkidu') {
                // GILGAMESH - Enkidu Cadenas del Cielo: cancela invocaciones + Mega Stun a >5 cargas
                const enkTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                // Cancelar todas las invocaciones enemigas
                const enemySummons = Object.keys(gameState.summons).filter(id => gameState.summons[id] && gameState.summons[id].team === enkTeam);
                enemySummons.forEach(id => {
                    addLog(`⛓️ Enkidu cancela ${gameState.summons[id].name}`, 'damage');
                    delete gameState.summons[id];
                });
                // Mega Aturdimiento a enemigos con >5 cargas
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === enkTeam && !c.isDead && c.hp > 0 && c.charges > 5) {
                        applyStun(n, 2); // Mega Aturdimiento
                        addLog(`⛓️ Enkidu: ${n} queda Mega Aturdido (tenía ${c.charges} cargas)`, 'damage');
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
                // Sangre de Esparta: sacrifica 10 HP, gana 10 cargas
                const sacrifice = Math.min(attacker.hp - 1, 10);
                attacker.hp -= sacrifice;
                attacker.charges += 10;
                addLog(`🩸 ${gameState.selectedCharacter} sacrifica ${sacrifice} HP y gana 10 cargas`, 'buff');

            } else if (ability.effect === 'gloria_300') {
                // Gloria de los 300: AOE + regen + escudo a aliados
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                }
                // Daño AOE también a invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === attacker.team && !c.isDead && c.hp > 0) {
                        c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 2, emoji: '💖', amount: Math.ceil(c.maxHp * 0.25) });
                        c.shield = 5; c.shieldEffect = null;
                        addLog(`💖 ${n} recibe Regeneración 25% y +5 escudo (Gloria 300)`, 'heal');
                    }
                }

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
                generateCharges(charName, ability.chargeGain || 1);

            } else if (ability.effect === 'aoe_stun_chance') {
                // Smashing Strike: AOE + 50% stun
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c.team === enemyTeam && !c.isDead && c.hp > 0) {
                        applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                        if (Math.random() < (ability.stunChance || 0.5)) applyStun(n, 1);
                    }
                }
                // AOE: también afecta invocaciones enemigas
                for (let _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (_s && _s.team === enemyTeam && _s.hp > 0) {
                        applySummonDamage(_sid, finalDamage, gameState.selectedCharacter);
                    }
                }

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

            } else if (ability.effect === 'devastator_punish') {
                const isCrit = Math.random() < (ability.critChance || 0.3);
                const dmg = isCrit ? finalDamage * 2 : finalDamage;
                applyDamageWithShield(targetName, dmg, gameState.selectedCharacter);
                if (isCrit) addLog(`💥 ¡CRÍTICO! Devastator Punish: ${dmg} daño`, 'damage');

            } else if (ability.effect === 'speed_up_self') {
                // Shingun Ken: daño + +1 velocidad propia
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                attacker.speed += 1;
                addLog(`⚡ ${gameState.selectedCharacter} aumenta su velocidad en 1 (ahora ${attacker.speed})`, 'buff');

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
                const gilBonus = (gameState.selectedCharacter === 'Gilgamesh') ? 0.10 : 0;
                const muzanBonus = (gameState.selectedCharacter === 'Muzan Kibutsuji') ? (attacker.muzanCritBonus || 0) : 0;
                const darionBonus = Object.values(gameState.summons).find(s => s && s.name === 'Darion Morgraine' && s.team === attacker.team) ? 0.50 : 0;
                const totalCritBonus = gilBonus + muzanBonus + darionBonus;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeam || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n)) { addLog(`🌌 Esquiva Área: Aspros es inmune al ataque AOE`, 'buff'); continue; }
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
                // Armadura Divina del Fénix: transformación
                attacker.fenixArmorActive = true;
                attacker.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 99, emoji: '💖', amount: Math.ceil(attacker.maxHp * 0.20) });
                addLog(`🦅 ${gameState.selectedCharacter} equipa la Armadura Divina del Fénix`, 'buff');
                ability.used = true;

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
                // ALEXSTRAZA - Fuego Vital: Escudo 2 HP + represalia quemadura 10% al atacante mientras escudo activo
                const tgtFV = gameState.characters[targetName];
                if (tgtFV) {
                    tgtFV.shield = (ability.shieldAmount || 2);
                    tgtFV.shieldEffect = 'fire_retaliation_fuego';
                    addLog(`🔥 ${targetName} recibe Escudo ${ability.shieldAmount || 2} HP con represalia de Quemadura 10% (Fuego Vital)`, 'buff');
                }

            } else if (ability.effect === 'llama_preservadora') {
                // ALEXSTRAZA - Llama Preservadora: Escudo 5 HP + represalia quemadura + genera carga por daño absorbido
                const tgtLP = gameState.characters[targetName];
                if (tgtLP) {
                    tgtLP.shield = (ability.shieldAmount || 5);
                    tgtLP.shieldEffect = 'fire_charge_regen';
                    addLog(`🔥 ${targetName} recibe Escudo ${ability.shieldAmount || 5} HP con represalia Quemadura 10% + Cargas por absorción (Llama Preservadora)`, 'buff');
                }

            } else if (ability.effect === 'don_de_la_vida') {
                // Don de la Vida (Alexstrasza actualizado): cura 4 HP al objetivo
                const tgtDV = gameState.characters[targetName];
                if (tgtDV) {
                    const oldHpDV = tgtDV.hp;
                    tgtDV.hp = Math.min(tgtDV.maxHp, tgtDV.hp + 4);
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
                    if (c.team === eTeam && !c.isDead && c.hp > 0) applyBurn(n, 30, 2);
                    if (c.team === myTeam && !c.isDead && c.hp > 0) c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, emoji: '💖', amount: Math.ceil(c.maxHp * 0.30) });
                }
                applyHolyShield(gameState.selectedCharacter, 3); // dur=3 → activo 2 turnos reales
                attacker.dragonFormActive = true;
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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, gameState.selectedCharacter);
                    if (c.speed < attacker.speed) {
                        // Enemigo más lento: debuff aleatorio 2 turnos
                        const debuffPool = ['Quemadura','Veneno','Sangrado','Confusion','Debilitar','Congelacion','Silenciar'];
                        const chosen = debuffPool[Math.floor(Math.random() * debuffPool.length)];
                        if (chosen === 'Quemadura') applyBurn(n, 10, 3);
                        else if (chosen === 'Veneno') { c.statusEffects.push({ name: 'Veneno', type: 'debuff', duration: 3, emoji: '🐍', poisonTick: 0 }); }
                        else if (chosen === 'Sangrado') applyBleed(n, 3);
                        else if (chosen === 'Confusion') applyConfusion(n, 3);
                        else if (chosen === 'Debilitar') applyDebuff(n, { name: 'Debilitar', type: 'debuff', duration: 3, emoji: '💔' });
                        else if (chosen === 'Congelacion') { c.statusEffects.push({ name: 'Congelacion', type: 'debuff', duration: 3, emoji: '❄️', speedPenalty: 0.10 }); c.speed = Math.round(c.speed * 0.90); }
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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
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
                applyDamageWithShield(targetName, finalDamage, charName);
                applyBurn(targetName, 10, 2);
                addLog('☀️ Sol Ascendente: ' + targetName + ' recibe Quemadura 10% por 2 turnos', 'damage');

            // ── TIGRE DE FUEGO V2 (Rengoku updated) ──
            } else if (ability.effect === 'tigre_fuego_v2') {
                const enemyTeamTF = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamTF || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    const hadBurn = hasStatusEffect(n, 'Quemadura');
                    applyDamageWithShield(n, finalDamage, charName);
                    applyBurn(n, 10, 2);
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
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
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
                        if (c && c.team === purgTeam && !c.isDead && c.hp > 0) applyBurn(n, 30, 5);
                    }
                    addLog('🔥 Purgatorio: ¡objetivo eliminado! Quemadura 30% x5 a todos los enemigos', 'damage');
                }

            // ── GARRAS DEL FÉNIX (Ikki básico: daño + aplica Quemadura) ──
            } else if (ability.effect === 'garras_fenix') {
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                const tgtGF = gameState.characters[targetName];
                if (tgtGF && !tgtGF.isDead && tgtGF.hp > 0) {
                    applyBurn(targetName, ability.burnPercent || 5, ability.burnDuration || 3);
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
                for (let n of burnTargets) applyBurn(n, ability.burnPercent || 30, ability.burnDuration || 2);
                
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
                // Extracción de sombras - Sacrificar una sombra
                try {
                    const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    
                    if (myShadows.length === 0) {
                        addLog(`❌ ${gameState.selectedCharacter} no tiene sombras para sacrificar`, 'info');
                    } else {
                        // Sacrificar la primera sombra disponible
                        const shadowToSacrifice = myShadows[0];
                        if (shadowToSacrifice && shadowToSacrifice.id) {
                            const sacrificedName = shadowToSacrifice.name;
                            // Eliminar la sombra ANTES de generar cargas para evitar que Igris
                            // (si fuera el sacrificado) intente atacar desde un estado ya eliminado
                            delete gameState.summons[shadowToSacrifice.id];
                            addLog(`💨 ${sacrificedName} ha sido sacrificado`, 'damage');
                            
                            attacker.charges += 3;
                            addLog(`⚡ ${gameState.selectedCharacter} sacrifica ${sacrificedName} y genera 3 cargas`, 'buff');
                            
                            // Activar pasiva de Sun Jin Woo si la sombra era suya (ya se eliminó, sin loop)
                            const jinWoo = gameState.characters['Sun Jin Woo'];
                            if (jinWoo && !jinWoo.isDead && shadowToSacrifice.summoner === 'Sun Jin Woo') {
                                jinWoo.charges += 1;
                                addLog(`⚡ Sun Jin Woo genera 1 carga (pasiva: Sombra sacrificada)`, 'buff');
                            }
                            
                            // Activar pasiva de Igris SOLO si Igris sigue existiendo (no fue el sacrificado)
                            triggerIgrisPassive(gameState.selectedCharacter);
                        } else {
                            addLog(`❌ Error al sacrificar sombra`, 'info');
                        }
                    }
                } catch (error) {
                    console.error('Error en sacrifice_shadow:', error);
                    addLog(`❌ Error al sacrificar sombra`, 'info');
                }
                
            } else if (ability.effect === 'sjw_sigilo') {
                // Sigilo de la Sombras (Sun Jin Woo basic): aplica Buff Sigilo 1 turno
                const sjwChar = attacker;
                const existingSigilo = (sjwChar.statusEffects || []).find(e => e && normAccent(e.name||'') === 'sigilo');
                if (existingSigilo) {
                    existingSigilo.duration = Math.max(existingSigilo.duration || 1, 1);
                } else {
                    sjwChar.statusEffects = sjwChar.statusEffects || [];
                    sjwChar.statusEffects.push({ name: 'Sigilo', type: 'buff', duration: 1, emoji: '👤' });
                }
                generateCharges(charName, ability.chargeGain || 1);
                addLog(`👤 Sigilo de las Sombras: ${charName} gana Sigilo por 1 turno`, 'buff');

            } else if (ability.effect === 'summon_kamish') {
                // Kamish Arise - Invocar a Kamish (solo uno)
                try {
                    const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    const hasKamish = myShadows.some(s => s && s.name === 'Kamish');
                    
                    if (hasKamish) {
                        addLog(`❌ ${gameState.selectedCharacter} ya tiene a Kamish invocado`, 'info');
                    } else {
                        summonShadow('Kamish', gameState.selectedCharacter);
                        addLog(`🐉 ${gameState.selectedCharacter} invoca al poderoso KAMISH!`, 'buff');
                    }
                } catch (error) {
                    console.error('Error en summon_kamish:', error);
                    addLog(`❌ Error al invocar Kamish`, 'info');
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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
                    const hadBleedRP = hasStatusEffect(n, 'Sangrado');
                    applyDamageWithShield(n, finalDamage, charName);
                    applyBleed(n, 2);
                    if (hadBleedRP) { applyFear(n, 2); addLog('😱 Rey Pagano: ' + n + ' tenía Sangrado → aplica Miedo', 'damage'); }
                }
                applyAOEDamageToSummons(attacker.team, finalDamage, charName);
                addLog('👑 Rey Pagano: ' + finalDamage + ' daño AOE + Sangrado', 'damage');

            // ── DJEM SO (Anakin básico) ──
            } else if (ability.effect === 'djem_so') {
                let djemDmg = finalDamage;
                if (attacker.darkSideAwakened) {
                    djemDmg += 1;
                    if (Math.random() < 0.5) { djemDmg += djemDmg; addLog('💥 Lado Oscuro: ¡Crítico en Djem So!', 'damage'); }
                }
                applyDamageWithShield(targetName, djemDmg, charName);

            // ── ESTRANGULAR (Anakin - Debilitar, nueva versión) ──
            } else if (ability.effect === 'estrangular') {
                let stDmg = finalDamage;
                if (attacker.darkSideAwakened) {
                    stDmg += 2;
                    if (Math.random() < 0.5) { stDmg *= 2; addLog('💥 Lado Oscuro: ¡Crítico en Estrangular!', 'damage'); }
                }
                applyDamageWithShield(targetName, stDmg, charName);
                applyDebuff(targetName, { name: 'Debilitar', type: 'debuff', duration: 1, emoji: '💔' });
                addLog('💔 Estrangular: ' + targetName + ' recibe Debilitar 1 turno', 'damage');

            // ── APPLY_STUN_DMG (Anakin Estrangular - legacy) ──
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
                gameState.nakimePendingSwap = { type: 'vida', enemy: targetName };
                showNakimeSecondTarget('vida', targetName);
                return;

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
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
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
                    if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
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
                    if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
                    applyDamageWithShield(n, finalDamage, charName);
                    applyBurn(n, 20, 2);
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
                const tamTeam3 = attacker.team;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== tamTeam3 || c.isDead || c.hp <= 0) continue;
                    c.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, percent: 20, hechizoDeSangre: true, emoji: '💖' });
                }
                addLog('🩸 Hechizo de Sangre: Regeneración 20% x3 a todo el equipo aliado (50% confusión enemiga por tick)', 'buff');

            // ══════════════════════════════════════════════
            // EMPERADOR PALPATINE EFFECTS
            // ══════════════════════════════════════════════
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
                    if (checkAsprosAOEImmunity(n)) continue;
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
                    if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Esquiva Área)', 'buff'); continue; }
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
                // Purificación Solar: damage (already applied by generic ST path if damage>0)
                // but effect=corazon_llamas means we handle manually: deal damage, self-heal, burn target
                // Damage to target
                applyDamageWithShield(targetName, finalDamage, charName);
                // Self-heal
                const tChar = gameState.characters[charName];
                const clOldHp = tChar.hp;
                tChar.hp = Math.min(tChar.maxHp, tChar.hp + 2);
                const clActualHeal = tChar.hp - clOldHp;
                if (clActualHeal > 0) {
                    addLog('☀️ ' + charName + ' recupera ' + clActualHeal + ' HP (Purificación Solar)', 'heal');
                    triggerBendicionSagrada(tChar.team, clActualHeal);
                }
                // Burn the selected target
                if (targetName && gameState.characters[targetName] && !gameState.characters[targetName].isDead) {
                    applyBurn(targetName, 10, 2);
                    addLog('🔥 Purificación Solar: ' + targetName + ' recibe Quemadura 10%', 'damage');
                }
                // Track for counterattack auto-use
                if (!gameState._lastAttacker) gameState._lastAttacker = {};
                gameState._lastAttacker[charName] = targetName;

            // ── EXPIACIÓN INCANDESCENTE (Thestalos AOE + charge steal on burn) ──
            } else if (ability.effect === 'expiacion_incandescente') {
                const enemyTeamEI = attacker.team === 'team1' ? 'team2' : 'team1';
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== enemyTeamEI || c.isDead || c.hp <= 0) continue;
                    if (checkAsprosAOEImmunity(n)) { addLog('🌟 ' + n + ' es inmune al AOE (Aspros)', 'buff'); continue; }
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
                                applyBurn(n, ability.burnPercent, ability.burnDuration);
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
                        applyBurn(targetName, ability.burnPercent, ability.burnDuration);
                    }
                    addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${finalDamage} de daño`, 'damage');
                }
                
            } else if (ability.effect === 'sharingan_aoe') {
                // Mangekyō Sharingan (Madara): AOE damage + Contraataque + Concentración on self
                const madaraTeam = attacker.team;
                const shaEnemyTeam = madaraTeam === 'team1' ? 'team2' : 'team1';
                let hitCount = 0;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === shaEnemyTeam && !c.isDead && c.hp > 0) {
                        if (!checkMegaProvocation(shaEnemyTeam) || c.statusEffects.some(e => e && (e.name === 'Mega Provocación' || e.name === 'Mega Provocacion'))) {
                            applyDamageWithShield(n, finalDamage, charName);
                            hitCount++;
                        }
                    }
                }
                if (hitCount === 0) applyAOEDamageToTeam(shaEnemyTeam, finalDamage, charName);
                attacker.statusEffects = (attacker.statusEffects || []).filter(e => e && e.name !== 'Contraataque' && e.name !== 'Concentración');
                attacker.statusEffects.push({ name: 'Contraataque', type: 'buff', duration: 2, emoji: '⚔️' });
                attacker.statusEffects.push({ name: 'Concentración', type: 'buff', duration: 2, emoji: '🎯' });
                addLog(`👁️ Mangekyō Sharingan: Madara causa ${finalDamage} AOE y gana Contraataque + Concentración`, 'buff');

            } else if (ability.effect === 'rikudo_transformation') {
                // Modo Rikudō - Transformación permanente
                attacker.rikudoMode = true;
                ability.used = true; // Marcar como usada para no poder usarla de nuevo
                addLog(`✨ ${gameState.selectedCharacter} activa el ${ability.name}! Poder duplicado, costos reducidos a la mitad`, 'buff');
                
            } else if (ability.effect === 'double_on_burn') {
                // Susanoo - AOE con daño doble si tiene quemaduras
                const attackerTeam = attacker.team;
                const targetTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
                
                // VERIFICAR MEGA PROVOCACIÓN DE KAMISH
                const kamishData = checkKamishMegaProvocation(targetTeam);
                if (kamishData) {
                    // Kamish absorbe TODO el daño AOE
                    // Contar personajes E invocaciones enemigas vivas
                    let targetCount = 0;
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === targetTeam && !char.isDead && char.hp > 0) targetCount++;
                    }
                    for (let sId in gameState.summons) {
                        const s = gameState.summons[sId];
                        if (s && s.team === targetTeam && s.hp > 0 && sId !== kamishData.id) targetCount++;
                    }
                    
                    const totalDamage = finalDamage * targetCount;
                    applySummonDamage(kamishData.id, totalDamage, gameState.selectedCharacter);
                    addLog(`🐉 Kamish (Mega Provocación) absorbe ${totalDamage} de daño AOE`, 'buff');
                } else {
                    // Suspender Sigilo antes de atacar
                    checkAndRemoveStealth(targetTeam);
                    
                    // Dañar personajes
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === targetTeam && char.hp > 0 && !char.isDead) {
                            let damage = finalDamage;
                            if (hasStatusEffect(name, 'Quemadura')) {
                                damage *= 2;
                                addLog(`🔥 ${name} recibe daño doble por tener Quemaduras`, 'damage');
                            }
                            applyDamageWithShield(name, damage, gameState.selectedCharacter);
                        }
                    }
                    
                    // Dañar invocaciones
                    for (let summonId in gameState.summons) {
                        const summon = gameState.summons[summonId];
                        if (summon && summon.team === targetTeam && summon.hp > 0) {
                            applySummonDamage(summonId, finalDamage, gameState.selectedCharacter);
                        }
                    }
                    
                    addLog(`💥 ${gameState.selectedCharacter} usa ${ability.name} causando ${finalDamage} de daño a todos los enemigos`, 'damage');
                }
                
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
                        if (attacker.rikudoMode && gameState.selectedCharacter === 'Madara Uchiha') {
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
                
            } else if (ability.target === 'single') {
                // Daño a un solo objetivo (genérico)
                applyDamageWithShield(targetName, finalDamage, gameState.selectedCharacter);
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} en ${targetName} causando ${finalDamage} de daño`, 'damage');
                
            } else if (ability.target === 'aoe') {
                // Daño a todos los enemigos (genérico) - INCLUYENDO INVOCACIONES
                const attackerTeam = attacker.team;
                const targetTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
                
                // VERIFICAR MEGA PROVOCACIÓN DE KAMISH
                const kamishData = checkKamishMegaProvocation(targetTeam);
                if (kamishData) {
                    // Kamish absorbe TODO el daño AOE
                    // Contar cuántos personajes E invocaciones del equipo objetivo están vivos
                    let targetCount = 0;
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === targetTeam && !char.isDead && char.hp > 0) targetCount++;
                    }
                    for (let sId in gameState.summons) {
                        const s = gameState.summons[sId];
                        if (s && s.team === targetTeam && s.hp > 0 && sId !== kamishData.id) targetCount++;
                    }
                    
                    const totalDamage = finalDamage * targetCount;
                    applySummonDamage(kamishData.id, totalDamage, gameState.selectedCharacter);
                    addLog(`🐉 Kamish (Mega Provocación) absorbe ${totalDamage} de daño AOE (${finalDamage} × ${targetCount} objetivos)`, 'buff');
                } else {
                    // Sin Mega Provocación - daño normal
                    // Suspender Sigilo antes de atacar
                    checkAndRemoveStealth(targetTeam);
                    
                    // Dañar personajes
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === targetTeam && char.hp > 0 && !char.isDead) {
                            if (checkAsprosAOEImmunity(name) || checkMinatoAOEImmunity(name)) { addLog(`🌟 ${name} es inmune al daño AOE (Esquiva Área)`, 'buff'); continue; }
                            applyDamageWithShield(name, finalDamage, gameState.selectedCharacter);
                        }
                    }
                    
                    // Dañar invocaciones
                    for (let summonId in gameState.summons) {
                        const summon = gameState.summons[summonId];
                        if (summon && summon.team === targetTeam && summon.hp > 0) {
                            applySummonDamage(summonId, finalDamage, gameState.selectedCharacter);
                        }
                    }
                    
                    addLog(`💥 ${gameState.selectedCharacter} usa ${ability.name} causando ${finalDamage} de daño a todos los enemigos`, 'damage');
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
                    triggerIgrisPassive(gameState.selectedCharacter);
                } else if (finalChargeGain > 0 && hasFear) {
                    addLog(`😱 ${gameState.selectedCharacter} no puede generar cargas (Miedo)`, 'damage');
                }

                // ── GOKU PASIVA: Entrenamiento de los Dioses ──
                // +2 cargas si tiene Furia Y Frenesi al atacar
                if (gameState.selectedCharacter === 'Goku' && !hasFear && finalDamage > 0) {
                    const hasFuria = hasStatusEffect('Goku', 'Furia');
                    const hasFrenesi = hasStatusEffect('Goku', 'Frenesi');
                    if (hasFuria && hasFrenesi) {
                        attacker.charges = Math.min(20, attacker.charges + 2);
                        addLog(`🔥 Entrenamiento de los Dioses: Goku genera +2 cargas (Furia+Frenesí)`, 'buff');
                    }
                }
                // ── MINATO PASIVA: +1 carga por enemigo golpeado más lento ──
                if (gameState.selectedCharacter === 'Minato Namikaze' && !hasFear && finalDamage > 0 && targetName) {
                    const tgtMinato = gameState.characters[targetName];
                    if (tgtMinato && !tgtMinato.isDead && tgtMinato.speed < attacker.speed) {
                        attacker.charges = Math.min(20, attacker.charges + 1);
                        addLog(`⚡ Hiraishin no Jutsu: Minato genera +1 carga (enemigo más lento: ${tgtMinato.speed} vs ${attacker.speed})`, 'buff');
                    }
                }
            }
            
            // ── MINATO PASIVA (AOE): +1 carga por CADA enemigo golpeado más lento ──
            if (gameState.selectedCharacter === 'Minato Namikaze' && ability.target === 'aoe') {
                const hasFearM = hasStatusEffect('Minato Namikaze', 'Miedo');
                if (!hasFearM) {
                    const enemyTeamM = attacker.team === 'team1' ? 'team2' : 'team1';
                    let bonusChargesM = 0;
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === enemyTeamM && !c.isDead && c.hp > 0 && c.speed < attacker.speed) {
                            bonusChargesM += 1;
                        }
                    }
                    if (bonusChargesM > 0) {
                        attacker.charges = Math.min(20, attacker.charges + bonusChargesM);
                        addLog(`⚡ Hiraishin no Jutsu: Minato genera +${bonusChargesM} cargas (enemigos más lentos)`, 'buff');
                    }
                }
            }
            
            // ASISTIR (Anakin): when ally uses Special/Over ST, execute basic on same target
            if (ability && (ability.type === 'special' || ability.type === 'over') && 
                ability.target === 'single' && targetName) {
                triggerAsistir(gameState.selectedCharacter, targetName, ability.type);
            }

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
                if (!summon) continue; // Saltar si summon no existe
                
                const summoner = gameState.characters[summon.summoner];
                
                if (summoner && summoner.isDead) {
                    toRemove.push(summonId);
                }
            }
            
            // Remover las invocaciones marcadas
            toRemove.forEach(summonId => {
                const summon = gameState.summons[summonId];
                if (summon) {
                    addLog(`💨 ${summon.name} desaparece porque ${summon.summoner} fue derrotado`, 'damage');
                    delete gameState.summons[summonId];
                }
            });
            
            // NO renderSummons aquí - ya se hace en executeAbility
            
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (!char.isDead && char.hp > 0) {
                    if (char.team === 'team1') team1Alive++;
                    else team2Alive++;
                }
            }
            
            if (team1Alive === 0) {
                showGameOver('🔶 REAPERS GANAN!');
                return true;
            } else if (team2Alive === 0) {
                showGameOver('🔷 HUNTERS GANAN!');
                return true;
            }
            
            return false;
        }

        // ── SUMMON INFO CATALOGUE ──

        function showSummonInfo(summonName, event) {
            if (event) { event.stopPropagation(); }
            const data = SUMMON_CATALOGUE[summonName];
            if (!data) return;
            const modal = document.getElementById('summonInfoModal');
            document.getElementById('summonInfoTitle').textContent = '🔮 ' + summonName;
            document.getElementById('summonInfoContent').innerHTML =
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
            // BUFFS
            { type: 'buff', name: '🛡️ Escudo', effect: 'Absorbe daño de golpes directos. El daño por efectos de estado (quemadura, veneno, sangrado, etc.) se aplica directamente al HP y no es absorbido por el escudo. Los escudos no son acumulables — un nuevo escudo siempre reemplaza al anterior.' },
            { type: 'buff', name: '✝️ Escudo Sagrado', effect: 'Bloquea completamente cualquier golpe directo. No bloquea daño de efectos de estado.' },
            { type: 'buff', name: '🛡️✨ Protección Sagrada', effect: 'El portador es completamente inmune a todos los debuffs mientras esté activo.' },
            { type: 'buff', name: '💖 Regeneración', effect: 'Al inicio de cada ronda, el portador recupera HP equivalente al % indicado de su HP máximo.' },
            { type: 'buff', name: '👤 Sigilo', effect: 'El portador no puede ser seleccionado como objetivo de ataques Single Target. Se pierde al recibir cualquier daño (los ataques AOE también rompen el Sigilo). Si el Buff Sigilo sigue activo al finalizar la ronda, genera 1 carga.' },
            { type: 'buff', name: '🛡️ Provocación', effect: 'Obliga al equipo enemigo a dirigir todos sus ataques Single Target contra el portador.' },
            { type: 'buff', name: '🌑 MegaProvocación', effect: 'Absorbe TODO el daño (ST y AOE) destinado al equipo aliado. Todos los ataques son redirigidos al portador de este buff.' },
            { type: 'buff', name: '💨 Esquivar', effect: '50% de probabilidad de esquivar cualquier ataque directo recibido.' },
            { type: 'buff', name: '🔄 Contraataque', effect: 'Al recibir un golpe directo, el portador contraataca automáticamente con su ataque básico.' },
            { type: 'buff', name: '🌵 Espinas', effect: 'Al recibir un golpe directo, causa 1 de daño al atacante. Si el atacante tiene el debuff Sangrado activo, causa 2 de daño en su lugar.' },
            { type: 'buff', name: '🔥 Frenesí', effect: 'Incrementa en 50% la probabilidad de golpe crítico en todos los ataques del portador.' },
            { type: 'buff', name: '⚡ Furia', effect: 'Incrementa un 50% el daño por golpe que causan todos los ataques del portador.' },
            // DEBUFFS
            { type: 'debuff', name: '🔥 Quemadura', effect: 'Cada ronda, causa daño equivalente al % indicado del HP máximo del objetivo. No es absorbido por el escudo.' },
            { type: 'debuff', name: '☀️ Quemadura Solar', effect: 'Causa daño por % del HP máximo del objetivo cada ronda (igual que Quemadura). Adicionalmente, el objetivo tiene 50% de probabilidad de perder 1 carga por cada tick. No es absorbido por el escudo.' },
            { type: 'debuff', name: '🐍 Veneno', effect: 'Causa daño gradual: 1 de daño en el primer tick, incrementando en +1 por cada turno adicional que el veneno permanezca activo. No es absorbido por el escudo.' },
            { type: 'debuff', name: '🩸 Sangrado', effect: 'El objetivo recibe +1 daño adicional en cada golpe directo que reciba. No es absorbido por el escudo.' },
            { type: 'debuff', name: '⭐ Aturdimiento', effect: 'El portador pierde su próximo turno completamente.' },
            { type: 'debuff', name: '💫 Mega Aturdimiento', effect: 'El portador pierde sus próximos 2 turnos.' },
            { type: 'debuff', name: '❄️ Congelación', effect: '50% de probabilidad de perder el próximo turno. Reduce un 10% la velocidad del portador mientras el debuff esté activo. La duración varía según la habilidad o pasiva que lo aplique.' },
            { type: 'debuff', name: '🧊 Megacongelación', effect: 'El portador pierde su próximo turno y sufre una reducción del 20% de velocidad mientras el debuff esté activo. Siempre dura 1 turno.' },
            { type: 'debuff', name: '😱 Miedo', effect: '25% de probabilidad de perder el turno. No puede generar cargas. Reduce un 50% el daño de sus ataques.' },
            { type: 'debuff', name: '😵 Confusión', effect: 'El portador no puede seleccionar su objetivo: ataca de forma aleatoria. 20% de probabilidad de atacar a un aliado en lugar de un enemigo.' },
            { type: 'debuff', name: '👁️ Posesión', effect: 'El portador ataca automáticamente a un aliado aleatorio de su propio equipo durante su turno.' },
            { type: 'debuff', name: '💔 Debilitar', effect: 'El portador recibe 50% más de daño de todos los ataques directos recibidos.' },
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
            document.getElementById('gameOverText').textContent = message;
            document.getElementById('gameOverModal').classList.add('show');
            audioManager.stopBattleMusic();
            audioManager.play('audioMenu');
            // Online: push game over so the loser also sees the modal
            if (onlineMode && currentRoomId) {
                db.ref('rooms/' + currentRoomId + '/gameState').update({
                    gameOver: true,
                    winner: message,
                    pushedBy: currentUser ? currentUser.uid : 'unknown'
                });
            }
        }

        // ==================== BATTLE LOG ====================
        function addLog(message, type = 'info') {
            const logContent = document.getElementById('battleLogContent');
            const entry = document.createElement('div');
            entry.className = `log-entry ${type}`;
            entry.textContent = message;
            logContent.insertBefore(entry, logContent.firstChild);
            
            // Mantener solo los últimos 15 mensajes
            while (logContent.children.length > 15) {
                logContent.removeChild(logContent.lastChild);
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
