// ==================== APLICADORES DE DEBUFFS ====================

        // Debuffs that cannot stack on the same target (must expire first)
        const NON_STACKABLE_DEBUFFS = ['aturdimiento', 'mega aturdimiento', 'congelacion', 'mega congelacion', 'posesion', 'mega posesion', 'silenciar', 'concentracion', 'esquivar', 'esquiva area', 'contraataque', 'espinas', 'armadura', 'escudo sagrado', 'proteccion sagrada', 'anticipacion'];

        
        // ═══════════════════════════════════════════════════════════
        // NUEVOS BUFFS/DEBUFFS - HELPERS
        // ═══════════════════════════════════════════════════════════

        function applyArmadura(targetName, duration) {
            applyBuff(targetName, { name: 'Armadura', type: 'buff', duration, emoji: '🛡️' });
            addLog(`🛡️ ${targetName} gana Buff Armadura (${duration} turno${duration>1?'s':''})`, 'buff');
        }

        function applyConcentracion(targetName, duration) {
            if (hasStatusEffect(targetName, 'Concentracion')) {
                addLog(`🎯 ${targetName} ya tiene Concentración activo`, 'info'); return;
            }
            applyBuff(targetName, { name: 'Concentracion', type: 'buff', duration, emoji: '🎯' });
            addLog(`🎯 ${targetName} gana Buff Concentración (${duration} turno${duration>1?'s':''})`, 'buff');
        }

        function applyAgotamiento(targetName, duration) {
            applyDebuff(targetName, { name: 'Agotamiento', type: 'debuff', duration, emoji: '😩' });
            addLog(`😩 ${targetName} sufre Agotamiento (${duration} turno${duration>1?'s':''})`, 'damage');
        }

        function applyMegaPosesion(targetName, duration) {
            if (hasStatusEffect(targetName, 'Mega Posesion')) {
                addLog(`👁️ ${targetName} ya tiene Mega Posesión activo`, 'info'); return;
            }
            applyDebuff(targetName, { name: 'Mega Posesion', type: 'debuff', duration, emoji: '👁️' });
            addLog(`👁️ ${targetName} sufre Mega Posesión (${duration} turno${duration>1?'s':''})`, 'damage');
        }

        function applySilenciar(targetName, duration) {
            if (hasStatusEffect(targetName, 'Silenciar')) {
                addLog(`🔇 ${targetName} ya tiene Silenciar activo`, 'info'); return;
            }
            // Determinar categoría silenciada aleatoriamente
            const cats = ['basic', 'special', 'over'];
            const cat = cats[Math.floor(Math.random() * cats.length)];
            applyDebuff(targetName, { name: 'Silenciar', type: 'debuff', duration, silencedCategory: cat, emoji: '🔇' });
            addLog(`🔇 ${targetName} es Silenciado — categoría ${cat} bloqueada por ${duration} turno${duration>1?'s':''}`, 'damage');
        }

        function triggerAntipacion(extraTurnCharName) {
            // Cuando alguien gana turno extra, aliados ENEMIGOS con Anticipación golpean 3 veces
            const extraChar = gameState.characters[extraTurnCharName];
            if (!extraChar) return;
            const enemyTeam = extraChar.team === 'team1' ? 'team2' : 'team1';
            for (const name in gameState.characters) {
                const c = gameState.characters[name];
                if (!c || c.isDead || c.hp <= 0 || c.team !== enemyTeam) continue;
                if (!hasStatusEffect(name, 'Anticipacion')) continue;
                addLog(`⚡ Anticipación: ${name} reacciona al turno extra con 3 ataques básicos sobre ${extraTurnCharName}!`, 'buff');
                const basic = c.abilities && c.abilities[0];
                if (!basic) continue;
                for (let i = 0; i < 3; i++) {
                    passiveExecuting = true;
                    const savedSelected = gameState.selectedCharacter;
                    const savedAbility = gameState.selectedAbility;
                    gameState.selectedCharacter = name;
                    gameState.selectedAbility = basic;
                    gameState.adjustedCost = 0;
                    if (basic.damage > 0) {
                        applyDamageWithShield(extraTurnCharName, basic.damage, name);
                        addLog(`  ⚔️ Anticipación golpe ${i+1}: ${name} → ${extraTurnCharName} (${basic.damage} daño)`, 'damage');
                    }
                    gameState.selectedCharacter = savedSelected;
                    gameState.selectedAbility = savedAbility;
                    passiveExecuting = false;
                }
            }
        }


        function applyBuff(targetName, effectObj) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // No stackeable si ya existe (salvo stackeables explícitos)
            const stackable = ['furia', 'frenesi', 'regeneracion', 'escudo', 'celeridad', 'armadura', 'anticipacion', 'sangrado', 'debilitar', 'confusion', 'miedo', 'agotamiento', 'veneno', 'quemadura', 'quemadura solar'];
            const effNorm = normAccent(effectObj.name || '');
            if (!stackable.includes(effNorm)) {
                if (target.statusEffects.some(e => e && normAccent(e.name || '') === effNorm)) {
                    addLog(`✨ ${targetName} ya tiene ${effectObj.name} activo`, 'info');
                    return;
                }
            }
            target.statusEffects.push(effectObj);
        }

function applyDebuff(targetName, effectObj) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // Proteccion Sagrada bloquea todos los debuffs
            if (hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a debuffs (Protección Sagrada)`, 'buff');
                return;
            }
            // IMMUNIDADES POR PERSONAJE (pasivas)
            const targetChar = gameState.characters[targetName];
            if (targetChar) {
                // Saitama: inmune a todos los debuffs
                if (targetName === 'Saitama' && effectObj.type === 'debuff') {
                    addLog(`🦸 Saitama es inmune a ${effectObj.name} (Espíritu del Héroe)`, 'buff');
                    return;
                }
                const effN = normAccent(effectObj.name || '');
                // Inmune a Miedo
                if (targetChar.immuneToMiedo && (effN === 'miedo')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Confusión
                if (targetChar.immuneToConfusion && (effN === 'confusion')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Posesión y Mega Posesión
                if (targetChar.immuneToPosesion && (effN === 'posesion' || effN === 'mega posesion')) {
                    addLog(`🛡️ ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
                // Inmune a Congelación
                if (targetChar.immuneToCongelacion && (effN === 'congelacion' || effN === 'mega congelacion')) {
                    addLog(`❄️ Aura de Hielo: ${targetName} es inmune a ${effectObj.name}`, 'buff');
                    return;
                }
            }
            // NON-STACKABLE debuffs: block if target already has this debuff active
            const effNorm = normAccent(effectObj.name || '');
            if (NON_STACKABLE_DEBUFFS.includes(effNorm)) {
                const alreadyHas = target.statusEffects.some(e => e && normAccent(e.name || '') === effNorm);
                if (alreadyHas) {
                    addLog('⚠️ ' + targetName + ' ya tiene ' + effectObj.name + ' activo — no se puede aplicar de nuevo', 'info');
                    return;
                }
            }
            target.statusEffects.push(effectObj);
            // PASIVA MABOROSHI: Saga gana 1 carga al aplicar debuff en enemigo
            triggerMaboroshi(target.team, effectObj.name);
            // PASIVA NEGOCIACIONES HOSTILES (Padme): aliado recibe debuff → Padme +1 carga
            {
                const padme = gameState.characters['Padme Amidala'];
                if (padme && !padme.isDead && padme.hp > 0 && effectObj.type === 'debuff') {
                    // Check if target is an ally of Padme (same team)
                    if (target.team === padme.team) {
                        padme.charges = Math.min(20, (padme.charges || 0) + 1);
                        addLog('🌹 Negociaciones Hostiles: Padme gana 1 carga', 'buff');
                    }
                }
            }
        }

        function applyStun(targetName, duration = 1) {
            const name = duration >= 2 ? 'Mega Aturdimiento' : 'Aturdimiento';
            const emoji = duration >= 2 ? '💫' : '⭐';
            applyDebuff(targetName, { name, type: 'debuff', duration, emoji });
            addLog(`${emoji} ${targetName} queda aturdido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyBleed(targetName, duration) {
            applyDebuff(targetName, { name: 'Sangrado', type: 'debuff', duration, emoji: '🩸' });
            addLog(`🩸 ${targetName} sufre Sangrado por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyFear(targetName, duration) {
            applyDebuff(targetName, { name: 'Miedo', type: 'debuff', duration, emoji: '😱' });
            addLog(`😱 ${targetName} siente Miedo por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyPossession(targetName, duration) {
            applyDebuff(targetName, { name: 'Posesion', type: 'debuff', duration, emoji: '👁️' });
            addLog(`👁️ ${targetName} queda Poseído por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyHolyShield(targetName, duration) {
            // Es un buff, no requiere verificación de Protección Sagrada
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Escudo Sagrado', type: 'buff', duration, emoji: '✝️' });
            addLog(`✝️ ${targetName} recibe Escudo Sagrado por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        function applyHolyProtection(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration, emoji: '🛡️' });
            addLog(`🛡️ ${targetName} recibe Protección Sagrada (inmune a debuffs) por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        function applyMegaFreeze(targetName, duration) {
            applyFreeze(targetName, duration, true);
        }

        function applyFreeze(targetName, duration, mega = false) {
            const name = mega ? 'Mega Congelacion' : 'Congelacion';
            const emoji = mega ? '🧊❄️' : '❄️';
            const speedPenalty = mega ? 0.20 : 0.10;
            const target = gameState.characters[targetName];
            if (!target) return;
            applyDebuff(targetName, { name, type: 'debuff', duration, emoji, speedPenalty });
            // Reducir velocidad
            target.speed = Math.floor(target.speed * (1 - speedPenalty));
            addLog(`${emoji} ${targetName} queda ${mega ? 'Mega Congelado' : 'Congelado'} (vel -${speedPenalty*100}%) por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyPoison(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            // Veneno es stackeable: cada aplicación es una instancia independiente
            applyDebuff(targetName, { name: 'Veneno', type: 'debuff', duration, emoji: '☠️', poisonTick: 0 });
            const stackCount = target.statusEffects.filter(e => e && normAccent(e.name||'') === 'veneno').length;
            addLog(`☠️ ${targetName} es envenenado por ${duration} turno${duration > 1 ? 's' : ''} (${stackCount} stack${stackCount > 1 ? 's' : ''})`, 'damage');
        }


        function applyWeaken(targetName, duration) {
            applyDebuff(targetName, { name: 'Debilitar', type: 'debuff', duration, emoji: '💔' });
            addLog(`💔 ${targetName} sufre Debilitar por ${duration} turno${duration > 1 ? 's' : ''} (recibe 50% más de daño)`, 'damage');
        }

        function applyConfusion(targetName, duration) {
            const tgtConf = gameState.characters[targetName];
            if (!tgtConf) return;
            // Reemplazar confusion existente en lugar de apilar
            if (tgtConf.statusEffects) {
                tgtConf.statusEffects = tgtConf.statusEffects.filter(e => !e || normAccent(e.name || '') !== 'confusion');
            }
            applyDebuff(targetName, { name: 'Confusion', type: 'debuff', duration, emoji: '😵' });
            addLog(`😵 ${targetName} queda Confundido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        // Quemadura Solar: stackeable (a diferencia de Quemadura normal)
        function applySolarBurn(targetName, percent, duration) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            if (hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a Quemadura Solar (Protección Sagrada)`, 'buff');
                return;
            }
            // Stackear: cada aplicación se agrega como efecto separado
            target.statusEffects.push({ name: 'Quemadura Solar', type: 'debuff', percent, duration, emoji: '☀️' });
            addLog(`☀️ ${targetName} recibe Quemadura Solar ${percent}% por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyFuria(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Furia', type: 'buff', duration, emoji: '🔥', untilRoundEnd: false });
            addLog(`🔥 ${targetName} activa Furia por ${duration} turno${duration > 1 ? 's' : ''} (50% más de daño)`, 'buff');
        }

        function applyFrenesi(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Frenesi', type: 'buff', duration, emoji: '⚡', untilRoundEnd: false });
            addLog(`⚡ ${targetName} activa Frenesí por ${duration} turno${duration > 1 ? 's' : ''} (50% chance crit)`, 'buff');
        }

        // Aplica buff Esquivar permanente (50% chance de esquivar cualquier ataque)
        function applyDodge(targetName) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.hasDodge = true;
            target.statusEffects.push({ name: 'Esquivar', type: 'buff', duration: 9999, emoji: '💨' });
            addLog(`💨 ${targetName} obtiene Buff Esquivar permanente (50% de esquivar ataques)`, 'buff');
        }

        // Contraataque buff: responde automáticamente con básico tras recibir un ataque
        function applyCounterattackBuff(targetName, duration) {
            const target = gameState.characters[targetName];
            if (!target) return;
            target.statusEffects.push({ name: 'Contraataque', type: 'buff', duration, emoji: '⚔️' });
            addLog(`⚔️ ${targetName} obtiene Buff Contraataque por ${duration} turno${duration > 1 ? 's' : ''}`, 'buff');
        }

        // Sigilo por N rondas (untilRoundEnd se decrementa manualmente en processEndOfRound)
        function applyStealth(targetName, rounds) {
            const target = gameState.characters[targetName];
            if (!target) return;
            // Limpiar sigilo previo
            target.statusEffects = target.statusEffects.filter(e => !(e && normAccent(e.name || '') === 'sigilo'));
            target.statusEffects.push({
                name: 'Sigilo', emoji: '👤', type: 'buff',
                duration: 999, untilRoundEnd: true, sigiloRoundsLeft: rounds
            });
            addLog(`👤 ${targetName} activa Sigilo por ${rounds} ronda${rounds > 1 ? 's' : ''}`, 'buff');
        }

