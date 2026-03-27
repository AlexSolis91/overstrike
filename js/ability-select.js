// ==================== SELECCIÓN DE HABILIDAD ====================
        function selectAbility(charName, abilityIndex) {
            audioManager.playSelect();
            if (gameState.selectedCharacter !== charName) {
                addLog('❌ No es el turno de este personaje', 'info');
                return;
            }
            
            const char = gameState.characters[charName];
            const ability = char.abilities[abilityIndex];
            
            // Calcular costo ajustado por modo Rikudō
            let adjustedCost = ability.cost;
            if (char.rikudoMode && (charName === 'Madara Uchiha' || charName === 'Madara Uchiha v2')) {
                adjustedCost = Math.ceil(ability.cost / 2);
            }
            // PODER DEL ANILLO (Sauron): habilidades cuestan 3 menos
            if (charName === 'Sauron' && char.sauronTransformed && ability.type !== 'basic') {
                adjustedCost = Math.max(0, adjustedCost - 3);
            }
            
            if (char.charges < adjustedCost) {
                addLog('❌ No tienes suficientes cargas', 'info');
                return;
            }
            // Verificar invocaciones (Arise! y similares)
            if (ability.effect === 'arise_summon' || ability.effect === 'summon_shadows') {
                const _myShd = getSummonsBySummoner(charName).filter(s => ['Igris','Iron','Tusk','Beru','Bellion'].includes(s.name));
                if (_myShd.length >= 5) {
                    addLog('❌ Ya tienes todas las Sombras invocadas', 'info');
                    return;
                }
            }
            // ANOTHER DIMENSION cooldown check
            if (ability.effect === 'another_dimension' && ability.cooldown > 0) {
                addLog(`❌ Another Dimension en cooldown (${ability.cooldown} turno${ability.cooldown > 1 ? 's' : ''} restante${ability.cooldown > 1 ? 's' : ''})`, 'info');
                return;
            }
            
            gameState.selectedAbility = ability;
            gameState.adjustedCost = adjustedCost;
            
            // Mostrar selector de objetivo
            showTargetSelection(ability);
        }

        // ==================== SELECCIÓN DE OBJETIVO ====================
        // Returns transformation portrait if active, else base portrait
        function getActivePortrait(name, char) {
            if (!char) return null;
            const isTransf = (char.rikudoMode && (name === 'Madara Uchiha' || name === 'Madara Uchiha v2')) ||
                             (char.fenixArmorActive && (name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2')) ||
                             (char.kuramaMode && (name === 'Minato Namikaze' || name === 'Minato Namikaze v2')) ||
                             ((name === 'Alexstrasza' || name === 'Alexstrasza v2') && char.dragonFormActive) ||
                             ((name === 'Goku' || name === 'Goku v2') && char.ultraInstinto) ||
                             ((name === 'Anakin Skywalker' || name === 'Anakin Skywalker v2') && char.darkSideAwakened) ||
                             ((name === 'Muzan Kibutsuji' || name === 'Muzan Kibutsuji v2') && char.muzanTransformed) ||
                             (char.garouSaitamaMode && (name === 'Garou' || name === 'Garou v2')) ||
                             (char.supermanPrimeMode && (name === 'Superman' || name === 'Superman v2'));
            return (isTransf && (char.transformPortrait || char.transformationPortrait)) ? (char.transformPortrait || char.transformationPortrait) : (char.portrait || null);
        }

                function showTargetSelection(ability) {
            const modal = document.getElementById('targetModal');
            const grid = document.getElementById('targetGrid');
            const title = document.getElementById('targetModalTitle');
            
            grid.innerHTML = '';
            
            if (ability.target === 'self') {
                executeAbility(gameState.selectedCharacter);
                return;
            }
            
            const attackerTeam = gameState.characters[gameState.selectedCharacter].team;
            const enemyTeam = attackerTeam === 'team1' ? 'team2' : 'team1';

            // ── PRE-CHECK: si todos los enemigos tienen Sigilo y la habilidad es ST,
            //    no abrir el modal — reportar en log y terminar el turno ──
            if (ability.target === 'single') {
                const sauronBypass = sauronIgnoresRestrictions();
                // SUBESTIMACION (Ivar): ignora Provocacion, MegaProvocacion y Sigilo
                const ivarBypass = ability.effect === 'subestimacion_ivar';
                const hasMegaProv = !sauronBypass && !ivarBypass && typeof checkKamishMegaProvocation === 'function' && checkKamishMegaProvocation(enemyTeam);
                const hasProvocacion = !sauronBypass && !ivarBypass && !hasMegaProv && Object.keys(gameState.characters).some(function(n) {
                    const c = gameState.characters[n];
                    return c && c.team === enemyTeam && !c.isDead && c.hp > 0 &&
                        (c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'provocacion'; });
                });
                if (!hasMegaProv && !hasProvocacion && !sauronBypass && !ivarBypass) {
                    // Check if every alive enemy has Sigilo
                    const aliveEnemies = Object.keys(gameState.characters).filter(function(n) {
                        const c = gameState.characters[n];
                        return c && c.team === enemyTeam && !c.isDead && c.hp > 0;
                    });
                    const aliveSummons = Object.values(gameState.summons).filter(function(s) {
                        return s && s.team === enemyTeam && s.hp > 0;
                    });
                    const allInSigilo = aliveEnemies.length > 0 && aliveEnemies.every(function(n) {
                        const c = gameState.characters[n];
                        return (c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'sigilo'; });
                    }) && aliveSummons.length === 0;
                    if (allInSigilo) {
                        addLog('👤 ' + gameState.selectedCharacter + ' usa ' + ability.name + ' pero todos los enemigos están en Sigilo — el ataque no puede conectar', 'info');
                        if (typeof endTurn === 'function') endTurn();
                        return;
                    }
                }
            }
            
            if (ability.target === 'ally_team') {
                executeAbility(null);
                return;
            }
            
            if (ability.target === 'team') {
                executeAbility(null);
                return;
            }
            
            if (ability.target === 'aoe') {
                const targetTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
                title.textContent = '🎯 Ataque AOE — Todos los Enemigos';
                
                // MEGA PROVOCACIÓN: mostrar solo al portador como objetivo
                const _aoeMP = checkKamishMegaProvocation(targetTeam);
                if (_aoeMP && !sauronIgnoresRestrictions()) {
                    title.textContent = '🎯 MEGA PROVOCACIÓN — AOE absorbido por ' + (_aoeMP.isCharacter ? _aoeMP.characterName : (_aoeMP.holder ? _aoeMP.holder.name : 'Invocación'));
                    if (_aoeMP.isCharacter) {
                        const _mpChar = gameState.characters[_aoeMP.characterName];
                        grid.innerHTML = makeTargetBtn(
                            `executeAbility(null)`,
                            getActivePortrait(_aoeMP.characterName, _mpChar),
                            _aoeMP.characterName,
                            `<strong>🎯 ${_aoeMP.characterName}</strong><br><small>HP: ${_mpChar ? _mpChar.hp : '?'}/${_mpChar ? _mpChar.maxHp : '?'}</small><br><small style="color:#ffaa00;">🎯 MEGA PROVOCACIÓN — absorbe todo</small>`,
                            'border-color:#ffaa00; background:linear-gradient(135deg,rgba(255,170,0,0.3),rgba(255,140,0,0.2));'
                        );
                    } else {
                        const _mpS = _aoeMP.holder;
                        const _mpSName = _mpS ? _mpS.name : 'Invocación';
                        grid.innerHTML = makeTargetBtn(
                            `executeAbility(null)`,
                            null, _mpSName,
                            `<strong>🎯 ${_mpSName}</strong><br><small>HP: ${_mpS ? _mpS.hp : '?'}/${_mpS ? _mpS.maxHp : '?'}</small><br><small style="color:#ffaa00;">🎯 MEGA PROVOCACIÓN</small>`,
                            'border-color:#ffaa00;'
                        );
                    }
                    modal.classList.add('show');
                    return;
                }
                
                // Sin MegaProv — preview normal + botón de confirmación
                for (let name in gameState.characters) {
                    const char = gameState.characters[name];
                    if (char.team === targetTeam && char.hp > 0 && !char.isDead) {
                        grid.innerHTML += makeTargetBtn(
                            `executeAbility(null)`,
                            getActivePortrait(name, char),
                            name,
                            `<strong>${name}</strong><br><small>HP: ${char.hp}/${char.maxHp}</small>`,
                            'opacity:0.85; pointer-events:none;'
                        );
                    }
                }
                // Botón de confirmación real
                grid.innerHTML += `
                    <button class="target-btn" onclick="executeAbility(null)" style="border-color: var(--danger); background: linear-gradient(135deg, rgba(255,51,102,0.3), rgba(255,0,80,0.2)); min-height:80px;">
                        <div class="target-btn-info" style="padding:20px;">
                            💥 Confirmar AOE<br>
                            <small>${'🔷🔶'.split('')[targetTeam === 'team2' ? 1 : 0]} ${typeof getTeamLabel === 'function' ? getTeamLabel(targetTeam) : (targetTeam === 'team2' ? 'REAPERS' : 'HUNTERS')}</small>
                        </div>
                    </button>
                `;

            } else if (ability.target === 'ally_single') {
                // ALLY SINGLE: siempre muestra TODOS los aliados vivos sin excepción
                // (Provocación/Sigilo/Taunt NUNCA filtra aliados — son mecánicas ofensivas)
                title.textContent = '💚 Selecciona un Aliado';
                grid.innerHTML = ''; // reset explícito
                let hasAllyTargets = false;
                const allyNames = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === attackerTeam && c.hp > 0 && !c.isDead;
                });
                allyNames.forEach(name => {
                    const char = gameState.characters[name];
                    hasAllyTargets = true;
                    grid.innerHTML += makeTargetBtn(
                        `executeAbility('${name}')`,
                        getActivePortrait(name, char),
                        name,
                        `<strong>${name}</strong><br><small>HP: ${char.hp}/${char.maxHp}</small>`
                    );
                });
                if (!hasAllyTargets) {
                    grid.innerHTML = `<div style="text-align:center;padding:20px;color:var(--warning);">⚠️ No hay aliados disponibles</div>`;
                }

            } else if (ability.target === 'ally_dead') {
                title.textContent = '✨ Selecciona un Aliado Caído para Revivir';
                for (let name in gameState.characters) {
                    const char = gameState.characters[name];
                    if (char.team === attackerTeam && char.isDead) {
                        grid.innerHTML += makeTargetBtn(
                            `executeAbility('${name}')`,
                            getActivePortrait(name, char),
                            name,
                            `<strong>${name}</strong><br><small>💀 Caído</small>`,
                            'filter: grayscale(0.7);'
                        );
                    }
                }

            } else {
                // Single target — enemigos
                const targetTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
                
                // EL OJO QUE TODO LO VE (Sauron): ignora Provocación, MegaProv y Sigilo
                const sauronActive = sauronIgnoresRestrictions();
                // SUBESTIMACION (Ivar): ignora Provocación, MegaProvocación y Sigilo
                const ivarActive = gameState.selectedAbility && gameState.selectedAbility.effect === 'subestimacion_ivar';

                // VERIFICAR MEGA PROVOCACIÓN DE KAMISH/DROGON/ETC PRIMERO
                const kamishData = checkKamishMegaProvocation(targetTeam);
                if (kamishData && !sauronActive && !ivarActive) {
                    if (kamishData.isCharacter) {
                        // MegaProv is on a CHARACTER (Darth Vader, Sauron, etc.)
                        const mpName = kamishData.characterName;
                        const mpChar = gameState.characters[mpName];
                        title.textContent = '🌑 MEGA PROVOCACIÓN — Debes Atacar a ' + mpName;
                        grid.innerHTML = makeTargetBtn(
                            `executeAbility('${mpName}')`,
                            getActivePortrait(mpName, mpChar),
                            mpName,
                            `<strong>${mpName}</strong><br><small>HP: ${mpChar.hp}/${mpChar.maxHp}</small><br><small style="color:#ff6600;">🌑 MEGA PROVOCACIÓN</small>`,
                            'border-color:#ff6600; background: linear-gradient(135deg, rgba(255,102,0,0.3), rgba(255,68,0,0.2));'
                        );
                    } else {
                        // MegaProv is on a SUMMON (Kamish, Drogon, Sindragosa, Tirion)
                        const mpSummon = kamishData.kamish;
                        const mpSummonName = mpSummon.name || 'Invocación';
                        title.textContent = '🐉 MEGA PROVOCACIÓN — Debes Atacar a ' + mpSummonName;
                        grid.innerHTML = makeTargetBtn(
                            `executeAbilitySummon('${kamishData.id}')`,
                            null,
                            mpSummonName,
                            `<strong>🐉 ${mpSummonName}</strong><br><small>HP: ${mpSummon.hp}/${mpSummon.maxHp}</small><br><small style="color:#ff6600;">🐉 MEGA PROVOCACIÓN</small>`,
                            'border-color:#ff6600; background: linear-gradient(135deg, rgba(255,102,0,0.3), rgba(255,68,0,0.2));'
                        );
                    }
                    modal.classList.add('show');
                    return;
                }
                
                // MEGA PROVOCACIÓN tiene prioridad sobre Provocación
                // Verificar MegaProv PRIMERO — si existe, Provocación se ignora
                const megaProvFirst = !sauronActive && !ivarActive ? checkKamishMegaProvocation(targetTeam) : null;

                // VERIFICAR PROVOCACIÓN — solo si NO hay Mega Provocación activa
                let tauntTarget = null;

                if (!sauronActive && !ivarActive && !megaProvFirst) {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== targetTeam || c.isDead || c.hp <= 0) continue;
                        if (c.statusEffects && c.statusEffects.some(e => e && normAccent(e.name||'') === 'provocacion')) {
                            tauntTarget = n;
                            break;
                        }
                    }
                }

                if (tauntTarget && !sauronActive && !ivarActive && !megaProvFirst) {
                    const tauntChar = gameState.characters[tauntTarget];

                    title.textContent = '⚠️ Provocación Activa — Debes Atacar a ' + tauntTarget;
                    const tauntPortrait = getActivePortrait(tauntTarget, tauntChar);
                    grid.innerHTML = makeTargetBtn(
                        `executeAbility('${tauntTarget}')`,
                        tauntPortrait,
                        tauntTarget,
                        `<strong>${tauntTarget}</strong><br><small>HP: ${tauntChar.hp}/${tauntChar.maxHp}</small><br><small style="color:var(--warning);">⚠️ PROVOCACIÓN</small>`,
                        'border-color:var(--warning); background: linear-gradient(135deg, rgba(255,170,0,0.3), rgba(255,140,0,0.2));'
                    );
                } else {
                    title.textContent = '🎯 Selecciona Objetivo';
                    let hasTargets = false;
                    const ivarIgnoresStealth = ability && ability.effect === 'subestimacion_ivar';
                    
                    // Personajes enemigos
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === targetTeam && char.hp > 0 && !char.isDead) {
                            const hasStealth = !sauronActive && !ivarIgnoresStealth && char.statusEffects && char.statusEffects.some(e => e && normAccent(e.name) === 'sigilo');
                            if (!hasStealth) {
                                hasTargets = true;
                                grid.innerHTML += makeTargetBtn(
                                    `executeAbility('${name}')`,
                                    getActivePortrait(name, char),
                                    name,
                                    `<strong>${name}</strong><br><small>HP: ${char.hp}/${char.maxHp}</small>`
                                );
                            }
                        }
                    }
                    
                    // Invocaciones enemigas
                    for (let summonId in gameState.summons) {
                        const summon = gameState.summons[summonId];
                        if (summon && summon.team === targetTeam && summon.hp > 0) {
                            hasTargets = true;
                            grid.innerHTML += makeTargetBtn(
                                `executeAbilitySummon('${summonId}')`,
                                null,
                                summon.name,
                                `<strong>👻 ${summon.name}</strong><br><small>HP: ${summon.hp}/${summon.maxHp}</small><br><small style="opacity:0.7;">de ${summon.summoner}</small>`,
                                'border-color: rgba(138, 43, 226, 0.6);'
                            );
                        }
                    }
                    
                    if (!hasTargets) {
                        // All enemies in Sigilo — auto-resolve: fire the move but it misses
                        // This prevents getting stuck on the "no targets" screen
                        const sigiloChar = Object.keys(gameState.characters).find(function(n) {
                            const c = gameState.characters[n];
                            return c && c.team === targetTeam && !c.isDead && c.hp > 0 &&
                                c.statusEffects && c.statusEffects.some(function(e) {
                                    return e && normAccent(e.name || '') === 'sigilo';
                                });
                        });
                        if (sigiloChar) {
                            // Auto-execute: the move fires but misses due to Sigilo
                            const abilityName = ability ? (ability.name || 'El movimiento') : 'El movimiento';
                            addLog('👤 ' + abilityName + ' no afectó a ' + sigiloChar + ' ya que tiene Sigilo activo', 'info');
                            modal.classList.remove('show');
                            if (typeof endTurn === 'function') endTurn();
                        } else {
                            grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--warning);">' +
                                '<div style="font-size:1.2rem;margin-bottom:12px;">⚠️ No hay objetivos válidos</div>' +
                                '<div style="font-size:.85rem;color:#888;margin-bottom:16px;">Todos los enemigos están en Sigilo</div>' +
                                '<button onclick="document.getElementById(\'targetModal\').classList.remove(\'show\')" ' +
                                'style="background:rgba(255,170,0,0.15);border:2px solid rgba(255,170,0,0.5);color:#ffaa00;' +
                                'padding:10px 24px;border-radius:10px;cursor:pointer;font-family:Orbitron,sans-serif;' +
                                'font-size:.85rem;letter-spacing:.05em;">↩ VOLVER</button>' +
                                '</div>';
                        }
                    }
                }
            }
            
            modal.classList.add('show');
        }

        // ── HOOK POST-DAÑO: pasivas que se activan DESPUÉS de recibir daño ──
        function triggerOnHitPassives(targetName, attackerName, abilityUsed) {
            // CAZADOR DE HÉROES (Garou): counter-attack when enemy passive activates
            if (!passiveExecuting && targetName && attackerName && targetName !== attackerName) {
                const _tgtOH = gameState.characters[targetName];
                const _atkOH = gameState.characters[attackerName];
                if (_tgtOH && _atkOH && _tgtOH.team !== _atkOH.team) {
                    if (typeof triggerGarouCazadorPassive === 'function') triggerGarouCazadorPassive(targetName);
                }
            }
            // CADENAS DE HIELO (Lich King): reduce 5% velocidad del atacante si Provocación activa
            if ((targetName === 'Lich King' || targetName === 'Lich King v2') && attackerName && !passiveExecuting) {
                const lk = gameState.characters['Lich King'];
                if (lk && !lk.isDead && lk.hp > 0 && lk.lichKingCadenasActive && hasStatusEffect('Lich King', 'Provocación')) {
                    const atker = gameState.characters[attackerName];
                    if (atker && !atker.isDead) {
                        const speedReduction = Math.floor(atker.speed * 0.05);
                        atker.speed = Math.max(1, atker.speed - speedReduction);
                        addLog(`❄️ Cadenas de Hielo: ${attackerName} pierde ${speedReduction} de velocidad permanentemente`, 'damage');
                    }
                }
            }
            if (passiveExecuting) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead || target.hp <= 0) return;

            // PASIVA EL ELEGIDO (Anakin): 50% contraataque con básico
            if ((targetName === 'Anakin Skywalker' || targetName === 'Anakin Skywalker v2') && attackerName && attackerName !== gameState.selectedCharacter) {
                if (Math.random() < 0.5) {
                    const basic = target.abilities[0];
                    if (basic && attackerName) {
                        passiveExecuting = true;
                        addLog(`⚔️ El Elegido: ${targetName} contraataca a ${attackerName}`, 'buff');
                        const atk = gameState.characters[attackerName];
                        if (atk && !atk.isDead && atk.hp > 0) applyDamageWithShield(attackerName, basic.damage || 1, targetName);
                        passiveExecuting = false;
                    }
                }
            }
        
            // CUERPO DIVINO (Goku Black): 50% apply Debilitar on target when GB deals damage
            if ((attackerName === 'Goku Black' || attackerName === 'Goku Black v2') && targetName && !passiveExecuting) {
                const gb = gameState.characters['Goku Black'];
                if (gb && !gb.isDead && gb.hp > 0 && Math.random() < 0.5) {
                    passiveExecuting = true;
                    applyWeaken(targetName, 2);
                    addLog('💀 Cuerpo Divino: Goku Black aplica Debilitar a ' + targetName, 'debuff');
                    passiveExecuting = false;
                }
            }
        }

        // ── PASIVA FALANGE (Leonidas): 2 cargas a aliado aleatorio cuando enemigo usa Special ──
        
        function triggerAnticipacion(attackerName, attackerTeam) {
            // Anticipacion: when enemy gains extra turn, chars with this buff fire 3 basics on attacker
            const defenderTeam = attackerTeam === 'team1' ? 'team2' : 'team1';
            Object.keys(gameState.characters).forEach(function(n) {
                const c = gameState.characters[n];
                if (!c || c.isDead || c.hp <= 0) return;
                if (c.team !== defenderTeam) return;
                if (!hasStatusEffect(n, 'Anticipacion')) return;
                const basic = c.abilities && c.abilities.find(function(a) { return a.type === 'basic'; });
                if (!basic) return;
                if (passiveExecuting) return;
                passiveExecuting = true;
                addLog('⚡ Anticipación: ' + n + ' ejecuta 3 ataques básicos sobre ' + attackerName, 'buff');
                for (let hit = 0; hit < 3; hit++) {
                    applyDamageWithShield(attackerName, basic.damage || 1, n);
                    c.charges = Math.min(20, (c.charges || 0) + (basic.chargeGain || 1));
                }
                passiveExecuting = false;
            });
        }
function triggerFalange(attackerTeam) {
            if (passiveExecuting) return;
            const leonidas = gameState.characters['Leonidas'];
            if (!leonidas || leonidas.isDead || leonidas.hp <= 0) return;
            if (leonidas.team === attackerTeam) return; // Solo si Leonidas es del equipo contrario al atacante
            const allies = Object.keys(gameState.characters).filter(n => {
                const c = gameState.characters[n]; return c.team === leonidas.team && !c.isDead && c.hp > 0;
            });
            if (allies.length === 0) return;
            const lucky = allies[Math.floor(Math.random() * allies.length)];
            passiveExecuting = true;
            gameState.characters[lucky].charges += 2;
            addLog(`⚔️ Falange: ${lucky} recibe 2 cargas (Leonidas)`, 'buff');
            passiveExecuting = false;
        }

        // ── PASIVA MABOROSHI (Saga de Geminis): 1 carga al aplicar debuff ──
        
        function triggerAsistir(attackerName, targetName, abilityType) {
            // ASISTIR (Anakin): when ally uses Special/Over ST, execute basic on same target
            if (abilityType !== 'special' && abilityType !== 'over') return;
            if (!targetName) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead || target.hp <= 0) return;
            // Find Anakin on same team as attacker
            const attacker = gameState.characters[attackerName];
            if (!attacker) return;
            const anakin = gameState.characters['Anakin Skywalker'];
            if (!anakin || anakin.isDead || anakin.hp <= 0) return;
            if (anakin.team !== attacker.team) return;
            if ((attackerName === 'Anakin Skywalker' || attackerName === 'Anakin Skywalker v2')) return; // Don't trigger on own attacks
            if (!anakin.anakinAsistir) return;
            if (passiveExecuting) return;
            // Execute Anakin's basic attack
            const basic = anakin.abilities && anakin.abilities.find(function(a) { return a.type === 'basic'; });
            if (!basic) return;
            passiveExecuting = true;
            const basicDmg = basic.damage || 1;
            applyDamageWithShield(targetName, basicDmg, 'Anakin Skywalker');
            anakin.charges = Math.min(20, (anakin.charges || 0) + (basic.chargeGain || 2));
            addLog('⚔️ El Elegido (Asistir): Anakin ejecuta ataque básico sobre ' + targetName + ' (' + basicDmg + ' dmg)', 'buff');
            passiveExecuting = false;
        }
function triggerMaboroshi(targetTeam, debuffName) {
            // Only fires for Posesion and Mega Posesion → 3 cargas each
            if (!debuffName) return;
            const norm = (debuffName || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
            if (norm !== 'posesion' && norm !== 'mega posesion') return;
            const saga = gameState.characters['Saga de Geminis'];
            if (!saga || saga.isDead || saga.hp <= 0) return;
            if (saga.team === targetTeam) return;
            saga.charges = Math.min(20, (saga.charges || 0) + 3);
            addLog('🌌 Maboroshi: Saga de Géminis genera 3 cargas (' + debuffName + ' aplicado)', 'buff');
        }


        // ── PASIVA ESQUIVA AREA (Aspros): no recibe daño AOE ──
        function checkAsprosAOEImmunity(targetName, triggerPassive) {
            // Esquiva Area: el personaje ESQUIVA (no es inmune), activa pasivas de esquiva si triggerPassive=true
            const c = gameState.characters[targetName];
            if (!c || c.isDead || c.hp <= 0) return false;
            // 1. Check passive flag (set by initGame using baseName)
            if (c.esquivaAreaPassive) {
                if (triggerPassive) triggerDodgePassives(targetName);
                return true;
            }
            // 2. Check Esquiva Area buff
            if (hasStatusEffect(targetName, 'Esquiva Area') || hasStatusEffect(targetName, 'Esquiva Área')) {
                if (triggerPassive) triggerDodgePassives(targetName);
                return true;
            }
            // 3. Check passive.name — covers v2 variants automatically
            //    Esquiva Area passives: Bendicion Sagrada (Min Byung), Face of Geminga (Aspros), Hiraishin no Jutsu (Minato)
            const ESQUIVA_PASSIVE_NAMES = ['Bendicion Sagrada', 'Bendición Sagrada', 'Face of Geminga', 'Hiraishin no Jutsu'];
            if (c.passive && c.passive.name && ESQUIVA_PASSIVE_NAMES.includes(c.passive.name)) {
                if (triggerPassive) triggerDodgePassives(targetName);
                return true;
            }
            // 4. Check passive description for 'Esquiva' keyword (catch-all for future chars)
            if (c.passive && c.passive.description && c.passive.description.includes('Esquiva') && 
                c.passive.description.toLowerCase().includes('area')) {
                if (triggerPassive) triggerDodgePassives(targetName);
                return true;
            }
            // 5. Legacy hardcoded names (for exact match safety)
            const baseName = targetName.replace(/ v\d+$/, '').trim();
            if (baseName === 'Aspros de Gemini' || baseName === 'Min Byung' || (baseName === 'Minato Namikaze' || baseName === 'Minato Namikaze v2')) {
                if (triggerPassive) triggerDodgePassives(targetName);
                return true;
            }
            return false;
        }

        // Llamar cuando un personaje esquiva para activar pasivas de esquiva
        function triggerDodgePassives(charName) {
            const c = gameState.characters[charName];
            if (!c || c.isDead) return;
            // ACELERACIÓN CONSTANTE (Flash): +3 cargas al esquivar
            if (c.passive && c.passive.name === 'Aceleración Constante') {
                c.charges = Math.min(20, (c.charges || 0) + 3);
                addLog('⚡ Aceleración Constante: Flash esquiva y gana 3 cargas', 'buff');
            }
        }

        // ── PASIVA EL OJO QUE TODO LO VE (Sauron): ignora Provocación/Sigilo ──
        function sauronIgnoresRestrictions() {
            const sauron = gameState.characters['Sauron'];
            return sauron && !sauron.isDead && sauron.hp > 0 && gameState.selectedCharacter === 'Sauron';
        }

        // ── PASIVA AURA DE HIELO (Lich King): congela al atacante al recibir daño ──
        function triggerLichKingAura(targetName, attackerName) {
            if ((targetName !== 'Lich King' && targetName !== 'Lich King v2')) return;
            const lk = gameState.characters['Lich King'];
            if (!lk || lk.isDead || lk.hp <= 0) return;
            if (!attackerName || (attackerName === 'Lich King' || attackerName === 'Lich King v2')) return;
            if (passiveExecuting) return;
            passiveExecuting = true;
            applyFreeze(attackerName, 2); // 2 = dura hasta fin del SIGUIENTE turno del atacante
            passiveExecuting = false;
        }

        // ── PASIVA PRIVILEGIO IMPERIAL (Ozymandias): aplica QS al atacante ──
        function triggerOzyPassive(targetName, attackerName) {
            if ((targetName !== 'Ozymandias' && targetName !== 'Ozymandias v2')) return;
            const ozy = gameState.characters['Ozymandias'];
            if (!ozy || ozy.isDead || ozy.hp <= 0) return;
            if (!attackerName || (attackerName === 'Ozymandias' || attackerName === 'Ozymandias v2')) return;
            if (passiveExecuting) return;
            passiveExecuting = true;
            applySolarBurn(attackerName, 5, 2); // 2 = dura hasta fin del siguiente turno del atacante
            addLog(`☀️ Privilegio Imperial: Ozymandias aplica Quemadura Solar 5% a ${attackerName}`, 'buff');
            passiveExecuting = false;
        }

        // ── PASIVA REGLA DE ORO (Gilgamesh): +2 cargas en crítico ──
        function triggerGilgameshCrit(attackerName) {
            if ((attackerName !== 'Gilgamesh' && attackerName !== 'Gilgamesh v2')) return;
            const gil = gameState.characters['Gilgamesh'];
            if (!gil || gil.isDead || gil.hp <= 0) return;
            // 50% de probabilidad de generar 1 carga por crítico
            if (Math.random() < 0.50) {
                gil.charges = Math.min(20, (gil.charges || 0) + 1);
                addLog('👑 Regla de Oro: Gilgamesh gana 1 carga por golpe crítico (50%)', 'buff');
            }
        }

        // ── PASIVA ENTRENAMIENTO DE LOS DIOSES (Goku): +1 vel y +1 daño en crítico ──
        function triggerGokuCrit(attackerName) {
            if ((attackerName !== 'Goku' && attackerName !== 'Goku v2')) return;
            const goku = gameState.characters['Goku'];
            if (!goku || goku.isDead || goku.hp <= 0) return;
            goku.speed += 1;
            goku.gokuBonusDamage = (goku.gokuBonusDamage || 0) + 1;
            // NO mutamos ab.damage — gokuBonusDamage se suma en finalDamage dentro de executeAbility
            addLog(`🐉 Entrenamiento de los Dioses: Goku +1 VEL y +1 daño a todos sus ataques (acum: +${goku.gokuBonusDamage})`, 'buff');
        }

        // ── PASIVA CASTILLO INFINITO (Nakime): redirigir primer ataque de ronda al enemigo ──
        // Esta se activa en startTurn al inicio de ronda
        function checkNakimeRedirect(attackerTeam) {
            const nakime = gameState.characters['Nakime'];
            if (!nakime || nakime.isDead || nakime.hp <= 0) return false;
            if (nakime.team === attackerTeam) return false; // solo aplica vs ataques enemigos
            if (nakime.nakimeRedirectUsed) return false;
            return true;
        }

        // ── PASIVA PROGENITOR DEMONIACO (Muzan): cura al inicio de ronda ──
        function triggerMuzanPassive() {
            const muzan = gameState.characters['Muzan Kibutsuji'];
            if (!muzan || muzan.isDead || muzan.hp <= 0) return;
            // Curar 2 HP a Muzan (Excel v5: 2HP a Muzan)
            if (muzan.hp < muzan.maxHp) {
                const healedM = Math.min(muzan.maxHp - muzan.hp, 2);
                muzan.hp = Math.min(muzan.maxHp, muzan.hp + 2);
                addLog('🩸 Progenitor Demoniaco: Muzan recupera 2 HP', 'heal');
                triggerBendicionSagrada(muzan.team, healedM);
            }
            // Curar 1 HP a un aliado aleatorio
            const allies = Object.keys(gameState.characters).filter(function(n) {
                const c = gameState.characters[n];
                return c && c.team === muzan.team && n !== 'Muzan Kibutsuji' && !c.isDead && c.hp > 0 && c.hp < c.maxHp;
            });
            if (allies.length > 0) {
                const lucky = allies[Math.floor(Math.random() * allies.length)];
                gameState.characters[lucky].hp = Math.min(gameState.characters[lucky].maxHp, gameState.characters[lucky].hp + 1);
                addLog('🩸 Progenitor Demoniaco: ' + lucky + ' recupera 1 HP', 'heal');
                triggerBendicionSagrada(muzan.team, 1);
            }
        }

        // ── PASIVA PRESENCIA OSCURA (Darth Vader): 20% esquivar ataques especiales ──
        function checkVaderDodge(targetName, abilityType) {
            if ((targetName !== 'Darth Vader' && targetName !== 'Darth Vader v2')) return false;
            const vader = gameState.characters['Darth Vader'];
            if (!vader || vader.isDead || vader.hp <= 0) return false;
            if (abilityType !== 'special' && abilityType !== 'over') return false;
            return Math.random() < 0.20;
        }

        // ── CONTRAATAQUE GENÉRICO (Goku UI, Darth Vader, etc.) ──
        function triggerCounterattack(targetName, attackerName) {
            if (passiveExecuting) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead || target.hp <= 0) return;
            if (!attackerName) return;

            // Buff Contraataque activo
            const hasCounterBuff = target.statusEffects && target.statusEffects.some(e => e && e.name === 'Contraataque');
            // Ultra Instinto de Goku
            const isGokuUI = (targetName === 'Goku' || targetName === 'Goku v2') && target.ultraInstinto;
            // Pasiva Thestalos: Contraataque permanente hardcoded
            const isThestalos = (targetName === 'Thestalos' || targetName === 'Thestalos v2');

            if (!hasCounterBuff && !isGokuUI && !isThestalos) return;

            const attacker = gameState.characters[attackerName];
            if (!attacker || attacker.isDead || attacker.hp <= 0) return;

            passiveExecuting = true;
            const basic = target.abilities && target.abilities[0];
            const baseDmg = (basic ? (basic.damage || 0) : 0) + (target.gokuBonusDamage || 0);
            const chGain = basic ? (basic.chargeGain || 0) : 0;

            addLog('⚔️ [CONTRAATAQUE] ' + targetName + ' usa ' + (basic ? basic.name : 'Básico') + ' contra ' + attackerName, 'buff');

            // ── Daño del básico ──
            if (baseDmg > 0) {
                applyDamageWithShield(attackerName, baseDmg, targetName);
                addLog('  💥 [CONTRAATAQUE] ' + targetName + ' causa ' + baseDmg + ' de daño a ' + attackerName, 'damage');
            }

            // ── Efectos específicos del básico por personaje ──
            // Thestalos — Corazón en Llamas: self-heal 2 HP + Quemadura 10% al atacante
            if (isThestalos) {
                const oldHp = target.hp;
                target.hp = Math.min(target.maxHp, target.hp + 2);
                const healed = target.hp - oldHp;
                if (healed > 0) {
                    addLog('  💖 [CONTRAATAQUE] ' + targetName + ' recupera ' + healed + ' HP', 'heal');
                    triggerBendicionSagrada(target.team, healed);
                }
                applyFlatBurn(attackerName, 2, 2);
                addLog('  🔥 [CONTRAATAQUE] ' + attackerName + ' recibe Quemadura 10%', 'damage');
                if (!gameState._lastAttacker) gameState._lastAttacker = {};
                gameState._lastAttacker[targetName] = attackerName;
            }
            // Darth Vader — básico aplica Miedo
            if ((targetName === 'Darth Vader' || targetName === 'Darth Vader v2')) {
                applyFear(attackerName, 1);
                addLog('  😱 [CONTRAATAQUE] ' + attackerName + ' recibe Miedo (Darth Vader)', 'damage');
            }
            // Furia Vikinga (Ragnar) — básico aplica Sangrado
            if ((targetName === 'Ragnar Lothbrok' || targetName === 'Ragnar Lothbrok v2')) {
                applyBleed(attackerName, 2);
                addLog('  🩸 [CONTRAATAQUE] ' + attackerName + ' recibe Sangrado (Ragnar)', 'damage');
            }
            // Goku UI — básico (Kamehameha base, sin efectos extra por contraataque)

            // ── Generación de cargas ──
            if (chGain > 0) {
                target.charges = Math.min(20, (target.charges || 0) + chGain);
                addLog('  ⚡ [CONTRAATAQUE] ' + targetName + ' genera ' + chGain + ' carga(s)', 'buff');
            }

            passiveExecuting = false;
        }

        // ── PASIVA SPHINX: robo de cargas cuando enemigo recibe daño de QS ──
        function triggerSphinxPassive(victimTeam) {
            const sphinxSummon = Object.values(gameState.summons).find(s => s && s.name === 'Sphinx Wehem-Mesut' && s.team !== victimTeam);
            if (!sphinxSummon) return;
            // Quitar 2 cargas a cada enemigo afectado — se llama desde processSolarBurnEffects
        }

        // ── PASIVA RAMESSEUM: end of round apply QS to enemies without QS ──
        function triggerRamesseumPassive() {
            const ram = Object.values(gameState.summons).find(s => s && s.name === 'Ramesseum Tentyris');
            if (!ram) return;
            const enemyTeam = ram.team === 'team1' ? 'team2' : 'team1';
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (!c || c.team !== enemyTeam || c.isDead || c.hp <= 0) continue;
                const hasSolar = c.statusEffects && c.statusEffects.some(e => e && e.name === 'Quemadura Solar');
                if (!hasSolar) {
                    applySolarBurn(n, 5, 2);
                    addLog(`🏛️ Ramesseum Tentyris aplica Quemadura Solar 5% a ${n}`, 'buff');
                }
            }
        }

        // ── PASIVA JIKUUKAN KEKKAI (Minato): esquiva primer golpe por ronda ──
        function checkMinatoDodge(targetName) {
            // New passive: AOE immunity (handled in AOE loop), not a dodge
            return false;
        }
        function checkMinatoAOEImmunity(targetName) {
            if ((targetName !== 'Minato Namikaze' && targetName !== 'Minato Namikaze v2')) return false;
            const minato = gameState.characters['Minato Namikaze'];
            if (!minato || minato.isDead || minato.hp <= 0) return false;
            return true; // indica que se esquivó
        }

        // ── PASIVA ASPECTO DE LA VIDA (Alexstrasza): cura 2 HP a aliados que recibieron daño en la ronda ──
        // Esta lógica ahora está en processEndOfRoundEffects directamente
        function triggerAspectoDeLaVida(healedTeam) {
            // Deprecated: lógica movida a processEndOfRoundEffects
        }

        function closeTargetModal() {
            document.getElementById('targetModal').classList.remove('show');
        }

        // Helper: genera HTML de un botón de objetivo con portrait
        function makeTargetBtn(onclick, portrait, name, infoHTML, extraStyle = '') {
            const imgHTML = portrait
                ? `<img class="target-btn-portrait" src="${portrait}" alt="${name}" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="target-btn-portrait-placeholder" style="display:none">⚔️</div>`
                : `<div class="target-btn-portrait-placeholder">⚔️</div>`;
            return `
                <button class="target-btn" onclick="${onclick}" style="${extraStyle}">
                    ${imgHTML}
                    <div class="target-btn-info">${infoHTML}</div>
                </button>
            `;
        }

        // Ejecutar habilidad sobre una invocación (usado para Kamish con Mega Provocación)
        // ── NAKIME: second target picker (ally) for Cambio de Energía/Vida ──
        function showNakimeSecondTarget(swapType, enemyName) {
            const nakimeChar = gameState.characters[gameState.selectedCharacter];
            if (!nakimeChar) { endTurn(); return; }
            const allyTeam = nakimeChar.team;

            const modal = document.getElementById('targetModal');
            const grid = document.getElementById('targetGrid');
            const title = document.getElementById('targetModalTitle');
            grid.innerHTML = '';
            const labelMap = { 'sangre': 'Cambio de Sangre', 'demoniaco': 'Cambio Demoniaco', 'energia': 'Cambio de Energía', 'vida': 'Cambio de Vida' };
            const label = labelMap[swapType] || 'Cambio';
            title.textContent = '🎯 ' + label + ' — Selecciona el ALIADO para el intercambio';

            for (let name in gameState.characters) {
                const c = gameState.characters[name];
                if (!c || c.team !== allyTeam || c.isDead || c.hp <= 0) continue;
                // Use single quotes inside onclick to avoid HTML attribute conflicts
                const safeSwap = swapType.replace(/'/g, "\'");
                const safeEnemy = enemyName.replace(/'/g, "\'");
                const safeName = name.replace(/'/g, "\'");
                grid.innerHTML += makeTargetBtn(
                    "executeNakimeSwap('" + safeSwap + "','" + safeEnemy + "','" + safeName + "')",
                    getActivePortrait(name, c), name,
                    '<strong>' + name + '</strong><br><small>HP: ' + c.hp + '/' + c.maxHp + ' | Cargas: ' + c.charges + '</small>'
                );
            }
            modal.classList.add('show');
        }

        function executeNakimeSwap(swapType, enemyName, allyName) {
            document.getElementById('targetModal').classList.remove('show');
            try {
                const enemy = gameState.characters[enemyName];
                const ally = gameState.characters[allyName];
                if (!enemy || !ally) { endTurn(); return; }

                if (swapType === 'sangre') {
                    // Cambio de Sangre: intercambiar HP entre enemigo y aliado
                    const tmpHp = enemy.hp;
                    const tmpMaxHp = enemy.maxHp;
                    // Clamp HP to respective maxHp
                    enemy.hp = Math.min(enemy.maxHp, ally.hp);
                    ally.hp = Math.min(ally.maxHp, tmpHp);
                    addLog('🎵 Cambio de Sangre: HP de ' + enemyName + ' (' + tmpHp + ') ↔ ' + allyName + ' (' + ally.hp + ')', 'buff');
                } else if (swapType === 'demoniaco') {
                    // Cambio Demoniaco: intercambiar CARGAS entre enemigo y aliado
                    const tmpCharges = enemy.charges || 0;
                    enemy.charges = Math.min(20, ally.charges || 0);
                    ally.charges = Math.min(20, tmpCharges);
                    addLog('🎵 Cambio Demoniaco: Cargas de ' + enemyName + ' (' + tmpCharges + ') ↔ ' + allyName + ' (' + ally.charges + ')', 'buff');
                } else if (swapType === 'energia') {
                    // Intercambiar Debuffs (Cambio de Energía legacy)
                    const enemyDebuffs = (enemy.statusEffects || []).filter(function(e) { return e && e.type === 'debuff'; });
                    const allyDebuffs = (ally.statusEffects || []).filter(function(e) { return e && e.type === 'debuff'; });
                    enemy.statusEffects = (enemy.statusEffects || []).filter(function(e) { return !e || e.type !== 'debuff'; }).concat(allyDebuffs);
                    ally.statusEffects = (ally.statusEffects || []).filter(function(e) { return !e || e.type !== 'debuff'; }).concat(enemyDebuffs);
                    addLog('🎵 Cambio de Energía: Debuffs intercambiados entre ' + enemyName + ' y ' + allyName, 'buff');
                } else {
                    // Fallback: swap charges only
                    const tmpCh = enemy.charges || 0;
                    enemy.charges = Math.min(20, ally.charges || 0);
                    ally.charges = Math.min(20, tmpCh);
                    addLog('🎵 Intercambio: Cargas intercambiadas entre ' + enemyName + ' y ' + allyName, 'buff');
                }
                renderCharacters();
                if (checkGameOver()) return;
                endTurn();
            } catch(err) {
                console.error('Error en executeNakimeSwap:', err);
                endTurn();
            }
        }

        function triggerPalpatinePassive(charNameWhoLostDebuff) {
            // 50% stun on character who had debuff expire/cleared, if Palpatine is on enemy team
            const palChar = gameState.characters['Emperador Palpatine'];
            const victim = gameState.characters[charNameWhoLostDebuff];
            if (!palChar || palChar.isDead || palChar.hp <= 0) return;
            if (!victim || victim.isDead || victim.hp <= 0) return;
            if (palChar.team === victim.team) return; // same team, no trigger
            if (Math.random() < 0.5) {
                applyStun(charNameWhoLostDebuff, 1);
                addLog('⚡ Palpatine - Emperador de la Galaxia: ' + charNameWhoLostDebuff + ' aturdido al perder un debuff', 'debuff');
            }
        }

        function executeAbilitySummon(summonId) {
            try {
                closeTargetModal();
                
                const attacker = gameState.characters[gameState.selectedCharacter];
                const charName = gameState.selectedCharacter; // alias used by ability handlers
                const ability = gameState.selectedAbility;
                const adjustedCost = gameState.adjustedCost || ability.cost;
                
                if (!attacker || !ability) {
                    console.error('executeAbilitySummon: Missing attacker or ability');
                    endTurn();
                    return;
                }
                
                // VERIFICAR BELLION - también aplica a ataques sobre invocaciones
                if (checkBellionCounter(gameState.selectedCharacter, ability.type)) {
                    // La habilidad fue cancelada por Bellion
                    renderCharacters();
                    renderSummons();
                    if (checkGameOver()) return;
                    endTurn();
                    return;
                }
                
                // Calcular daño ajustado
                let finalDamage = ability.damage || 0;
                if (attacker.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                    finalDamage *= 2;
                }
                
                // Consumir cargas
                attacker.charges -= adjustedCost;
                
                // Aplicar daño a la invocación
                applySummonDamage(summonId, finalDamage, gameState.selectedCharacter);
                addLog(`⚔️ ${gameState.selectedCharacter} usa ${ability.name} causando ${finalDamage} de daño`, 'damage');

                // AMATERASU (Itachi): si el objetivo es una invocación — elimínala + Quemadura 6HP AOE a todos los enemigos
                if (ability.effect === 'amaterasu_itachi') {
                    const _amSummon = gameState.summons[summonId];
                    const _amEnemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                    if (_amSummon) {
                        addLog('🔥 Amaterasu: ¡' + _amSummon.name + ' consumida por el fuego negro!', 'damage');
                        delete gameState.summons[summonId];
                        renderSummons();
                    }
                    // AOE Quemadura 6HP a todos los personajes enemigos
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _amEnemyTeam || _c.isDead || _c.hp <= 0) continue;
                        applyFlatBurn(_n, 6, 2);
                        addLog('🔥 Amaterasu AOE: ' + _n + ' recibe Quemadura 6HP', 'debuff');
                    }
                }
                
                // Ganar cargas
                let finalChargeGain = ability.chargeGain || 0;
                if (attacker.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                    finalChargeGain *= 2;
                }
                
                // MIEDO: bloquea generación de cargas
                if (hasStatusEffect(gameState.selectedCharacter, 'Miedo')) {
                    if (finalChargeGain > 0) {
                        addLog(`😱 Miedo: ${gameState.selectedCharacter} no puede generar cargas`, 'damage');
                    }
                    finalChargeGain = 0;
                }
                
                if (finalChargeGain > 0) {
                    let gainConc = finalChargeGain;
                    if (hasStatusEffect(gameState.selectedCharacter, 'Concentracion')) {
                        gainConc *= 2;
                        addLog(`🎯 Concentración: ${gameState.selectedCharacter} duplica cargas generadas (${gainConc})`, 'buff');
                    }
                    attacker.charges = Math.min(20, (attacker.charges || 0) + gainConc);
                    addLog(`⚡ ${gameState.selectedCharacter} genera ${gainConc} carga${gainConc > 1 ? 's' : ''}`, 'buff');
                    triggerIgrisPassive(gameState.selectedCharacter);
                }
                
                // Actualizar UI
                renderCharacters();
                renderSummons();
                
                // Verificar fin del juego
                if (checkGameOver()) {
                    return;
                }

                // Habilidades con turno adicional (ej: Singularidad Escarlata, Golpe de Masa Infinita)
                const _extraTurnEffects = ['singularidad_escarlata', 'golpe_masa_infinita'];
                if (ability && _extraTurnEffects.includes(ability.effect)) {
                    // Singularidad: aplicar lógica específica
                    if (ability.effect === 'singularidad_escarlata') {
                        if (attacker._singularidadCooldown > 0) {
                            addLog('⚡ Singularidad Escarlata en cooldown: ' + attacker._singularidadCooldown + ' turno(s) restante(s)', 'info');
                            endTurn();
                            return;
                        }
                        attacker.charges = Math.min(20, (attacker.charges || 0) + 20);
                        addLog('🔴 Singularidad Escarlata: Flash gana 20 cargas', 'buff');
                        attacker._singularidadCooldown = 3;
                    }
                    if (typeof triggerAnticipacion === 'function') triggerAnticipacion(gameState.selectedCharacter, attacker.team);
                    renderCharacters();
                    renderSummons();
                    showContinueButton();
                    return;
                }

                // Finalizar turno
                endTurn();
            } catch (error) {
                console.error('Error en executeAbilitySummon:', error);
                addLog(`❌ Error al ejecutar habilidad en invocación`, 'info');
                // Intentar terminar el turno de todas formas
                try {
                    endTurn();
                } catch (e) {
                    console.error('Error crítico:', e);
                }
            }
        }
