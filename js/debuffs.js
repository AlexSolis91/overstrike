// ── HELPER: triggerIzanamiPartB ──
        // Called by applyFlatBurn, applyPoison, applyConfusion, and applyDebuff
        // when a trigger debuff (Quemadura/Veneno/Posesion/Confusion) hits any character.
        // If Itachi is on that character's team, he cleanses up to 2 debuffs + 2 charges each.
        function triggerIzanamiPartB(targetName) {
            if (passiveExecuting) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead || target.hp <= 0) return;
            const _izAllyTeam = target.team;
            for (const _izn in gameState.characters) {
                const _izc = gameState.characters[_izn];
                if (!_izc || _izc.isDead || _izc.hp <= 0 || _izc.team !== _izAllyTeam) continue;
                if (!_izc.passive || _izc.passive.name !== 'Izanami') continue;
                passiveExecuting = true;
                let _izCleaned = 0;
                const _allies = Object.keys(gameState.characters).filter(function(n) {
                    const c = gameState.characters[n];
                    return c && !c.isDead && c.hp > 0 && c.team === _izAllyTeam;
                });
                for (let i = 0; i < _allies.length && _izCleaned < 2; i++) {
                    const _alc = gameState.characters[_allies[i]];
                    const _dbs = (_alc.statusEffects || []).filter(function(e) {
                        return e && e.type === 'debuff' && !e.permanent;
                    });
                    if (_dbs.length === 0) continue;
                    const _rem = _dbs[0];
                    _alc.statusEffects = (_alc.statusEffects || []).filter(function(e) { return e !== _rem; });
                    addLog('👁️ Izanami: Debuff ' + _rem.name + ' limpiado de ' + _allies[i], 'buff');
                    if (typeof triggerRinneganCleanse === 'function') triggerRinneganCleanse(_allies[i], 1);
                    _izCleaned++;
                }
                if (_izCleaned > 0) {
                    _izc.charges = Math.min(20, (_izc.charges || 0) + _izCleaned * 2);
                    addLog('👁️ Izanami: ' + _izn + ' genera ' + (_izCleaned * 2) + ' cargas (' + _izCleaned + ' debuff' + (_izCleaned > 1 ? 's' : '') + ' limpiados)', 'buff');
                }
                passiveExecuting = false;
                break;
            }
        }


        // ── PASIVA RINNEGAN (Madara): genera 3 cargas cuando un debuff es limpiado/disipado ──
        function triggerRinneganCleanse(targetName, count) {
            if (!count || count <= 0) return;
            const c = gameState.characters[targetName];
            if (!c || c.isDead || !c.passive || c.passive.name !== 'Rinnegan') return;
            const gained = count * 3;
            c.charges = Math.min(20, (c.charges || 0) + gained);
            addLog('👁️ Rinnegan: ' + targetName + ' genera ' + gained + ' cargas (' + count + ' debuff' + (count>1?'s':'') + ' disipado' + (count>1?'s':'') + ')', 'buff');
        }
function triggerMaboroshi(targetTeam, debuffName) {
            if (!debuffName) return;
            const norm = (debuffName || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
            if (norm !== 'posesion' && norm !== 'mega posesion') return;
            // Find any character with Maboroshi no Shinkiro passive on the OPPOSING team
            for (const sagaName in gameState.characters) {
                const saga = gameState.characters[sagaName];
                if (!saga || saga.isDead || saga.hp <= 0) continue;
                if (saga.team === targetTeam) continue; // Must be on the ATTACKER's team
                if (!saga.passive || saga.passive.name !== 'Maboroshi no Shinkiro') continue;
                saga.charges = Math.min(20, (saga.charges || 0) + 3);
                addLog('🌌 Maboroshi no Shinkiro: ' + sagaName + ' genera 3 cargas (' + debuffName + ' aplicado a enemigo)', 'buff');
                break;
            }
        }        // ==================== APLICADORES DE DEBUFFS ====================

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
            const _mpTgt = gameState.characters[targetName];
            if (_mpTgt && _mpTgt.passive && _mpTgt.passive.name === 'Mente Brillante') {
                addLog('🪓 Mente Brillante: Ivar es inmune a Mega Posesión', 'buff'); return;
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


        function isImmuneToDebuff(targetName) {
            // Saitama: total debuff immunity
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) return true;
            // Superman Forma Prime: debuff immunity
            const _spChar = gameState.characters[targetName];
            if (_spChar && _spChar.supermanPrimeMode) return true;

            // Proteccion Sagrada: immune to new debuffs
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) return true;
            // LIMBO (Madara Uchiha): Divinidad = inmune a debuffs en Modo Rikudō
            const limboChar = gameState.characters[targetName];
            if (limboChar && limboChar.passive && limboChar.passive.name === 'Limbo' && limboChar.rikudoMode) return true;
            return false;
        }
        function isImmuneToBurn(targetName) {
            // Daenerys: immune to Quemadura and Quemadura Solar
            if ((targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2')) return true;
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) return true;
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) return true;
            return false;
        }
function applyDebuff(targetName, effectObj) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            // ESQUIVA ÁREA + MEGA PROVOCACIÓN: inmune a debuffs AOE de enemigos
            if (gameState.selectedAbility && (gameState.selectedAbility.target === 'aoe' || gameState.selectedAbility.target === 'team')) {
                const _attacker = gameState.characters[gameState.selectedCharacter];
                if (_attacker && _attacker.team !== target.team) {
                    // Esquiva Área check
                    if (checkAsprosAOEImmunity(targetName) || checkMinatoAOEImmunity(targetName)) {
                        addLog('🌟 ' + targetName + ' es inmune al debuff AOE (Esquiva Área)', 'buff');
                        return;
                    }
                    // MEGA PROVOCACIÓN: solo el portador de MegaProv puede recibir debuffs/buffs AOE del enemigo
                    const _mpDebData = (typeof checkKamishMegaProvocation === 'function')
                        ? checkKamishMegaProvocation(target.team)
                        : null;
                    if (_mpDebData) {
                        // Determine if targetName is the MegaProv holder
                        let _isHolder = false;
                        if (_mpDebData.isCharacter && targetName === _mpDebData.characterName) _isHolder = true;
                        // For summon holders: the debuff would go to the summon (handled by applyDebuff on summon)
                        // For character holders: only they can receive the debuff
                        if (!_isHolder && _mpDebData.isCharacter) {
                            addLog('🎯 Mega Provocación: ' + targetName + ' es inmune al debuff/buff AOE (solo ' + _mpDebData.characterName + ' puede ser afectado)', 'buff');
                            return;
                        }
                    }
                }
            }
            // Proteccion Sagrada bloquea todos los debuffs
            if (hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a debuffs (Protección Sagrada)`, 'buff');
                return;
            }
            // IMMUNIDADES POR PERSONAJE (pasivas)
            const targetChar = gameState.characters[targetName];
            if (targetChar) {
                // Saitama: inmune a todos los debuffs
                if ((targetName === 'Saitama' || targetName === 'Saitama v2') && effectObj.type === 'debuff') {
                    addLog(`🦸 Saitama es inmune a ${effectObj.name} (Espíritu del Héroe)`, 'buff');
                    return;
                }
                // DIVINIDAD: 50% limpiar debuff entrante, +2 cargas por limpiado
                if (effectObj.type === 'debuff' && hasStatusEffect(targetName, 'Divinidad') && Math.random() < 0.5) {
                    targetChar.charges = Math.min(20, (targetChar.charges || 0) + 2);
                    addLog('✨ Divinidad: ' + targetName + ' limpia ' + (effectObj.name || 'debuff') + ' y gana 2 cargas', 'buff');
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
            // PASIVA PRÍNCIPE DE LOS SAYAJINS (Vegeta): 50% debuff miss chance
            {
                const _vegDebTarget = gameState.characters[targetName];
                if (_vegDebTarget && !_vegDebTarget.isDead && _vegDebTarget.hp > 0 &&
                    _vegDebTarget.passive && _vegDebTarget.passive.name === 'Príncipe de los Sayajins' &&
                    effectObj.type === 'debuff') {
                    if (Math.random() < 0.50) {
                        addLog('👑 Príncipe de los Sayajins: ' + targetName + ' evade el debuff ' + effectObj.name + ' (50%)', 'buff');
                        return; // debuff blocked
                    }
                }
            }

            // PASIVA RINNEGAN (Madara Uchiha): 70% chance debuff is cleansed + 3 charges
            {
                const _rinTarget = gameState.characters[targetName];
                if (_rinTarget && !_rinTarget.isDead && _rinTarget.hp > 0 &&
                    _rinTarget.passive && _rinTarget.passive.name === 'Rinnegan' &&
                    effectObj.type === 'debuff') {
                    if (Math.random() < 0.70) {
                        // Cleanse: remove the debuff that was just added
                        _rinTarget.statusEffects = (_rinTarget.statusEffects || []).filter(e => e !== effectObj);
                        _rinTarget.charges = Math.min(20, (_rinTarget.charges || 0) + 3);
                        addLog('👁️ Rinnegan: ' + targetName + ' disipa ' + effectObj.name + ' y genera 3 cargas (70%)', 'buff');
                        return; // debuff was removed
                    }
                }
            }

            // PASIVA NEGOCIACIONES HOSTILES (Padme): aliado recibe debuff → Padme +1 carga
            {
                const padme = gameState.characters['Padme Amidala'] ||
                    Object.values(gameState.characters).find(c => c && (c.passive && c.passive.name === 'Negociaciones Hostiles') && c.team === target.team && !c.isDead && c.hp > 0);
                if (padme && !padme.isDead && padme.hp > 0 && effectObj.type === 'debuff') {
                    // Check if target is an ally of Padme (same team)
                    if (target.team === padme.team) {
                        padme.charges = Math.min(20, (padme.charges || 0) + 1);
                        addLog('🌹 Negociaciones Hostiles: Padmé gana 1 carga (' + padme.charges + ')', 'buff');
                    }
                }
            }

            // ── PASIVA DIOS DE LA GUERRA (Kratos): 50% limpia debuff + 2 buffs aleatorios ──
            if (!passiveExecuting && effectObj && effectObj.type === 'debuff') {
                const _kratosChar = gameState.characters[targetName];
                if (_kratosChar && !_kratosChar.isDead && _kratosChar.hp > 0 &&
                    _kratosChar.passive && _kratosChar.passive.name === 'Dios de la Guerra') {
                    if (Math.random() < 0.50) {
                        // Remove the debuff that was just applied
                        _kratosChar.statusEffects = (_kratosChar.statusEffects || []).filter(function(e){ return e !== effectObj; });
                        addLog('⚔️ Dios de la Guerra: ' + targetName + ' limpia ' + (effectObj.name||'debuff'), 'buff');
                        // Apply 2 random buffs
                        const KRATOS_BUFFS = [
                            { name: 'Furia', type: 'buff', duration: 2, emoji: '🔥' },
                            { name: 'Frenesi', type: 'buff', duration: 2, emoji: '⚡' },
                            { name: 'Armadura', type: 'buff', duration: 2, emoji: '🛡️' },
                            { name: 'Concentracion', type: 'buff', duration: 2, emoji: '🎯' },
                            { name: 'Contraataque', type: 'buff', duration: 2, emoji: '⚔️' },
                            { name: 'Celeridad', type: 'buff', duration: 2, emoji: '💨', speedBonus: 5 }
                        ];
                        var _shuffled = KRATOS_BUFFS.slice().sort(function(){ return Math.random()-0.5; });
                        for (var _ki = 0; _ki < 2; _ki++) {
                            var _kb = Object.assign({}, _shuffled[_ki]);
                            _kratosChar.statusEffects.push(_kb);
                            if (_kb.speedBonus) _kratosChar.speed = (_kratosChar.speed||88) + _kb.speedBonus;
                            addLog('⚔️ Dios de la Guerra: ' + targetName + ' gana buff ' + _kb.name, 'buff');
                        }
                        return; // debuff removed, no further processing
                    }
                }
            }

            // ── PASIVA IZANAMI PARTE B: via triggerIzanamiPartB helper ──
            if (effectObj && effectObj.type === 'debuff') {
                const _izTriggers2 = ['posesion', 'posesión', 'veneno', 'quemadura', 'quemaduras', 'confusion', 'confusión'];
                if (_izTriggers2.some(function(t){ return normAccent(effectObj.name||'').toLowerCase().includes(t); })) {
                    triggerIzanamiPartB(targetName);
                }
            }
        }

        function applyStun(targetName, duration = 1) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            const name = duration >= 2 ? 'Mega Aturdimiento' : 'Aturdimiento';
            const emoji = duration >= 2 ? '💫' : '⭐';
            applyDebuff(targetName, { name, type: 'debuff', duration, emoji });
            addLog(`${emoji} ${targetName} queda aturdido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyBleed(targetName, duration) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            applyDebuff(targetName, { name: 'Sangrado', type: 'debuff', duration, emoji: '🩸' });
            addLog(`🩸 ${targetName} sufre Sangrado por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyFear(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const _fearTgt = gameState.characters[targetName];
            if (_fearTgt && _fearTgt.passive && _fearTgt.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Miedo', 'buff'); return; }
            if (_fearTgt && _fearTgt.passive && _fearTgt.passive.name === 'Señor de los Nazgul') { addLog('💀 Señor de los Nazgul: Rey Brujo es inmune a Miedo', 'buff'); return; }
            applyDebuff(targetName, { name: 'Miedo', type: 'debuff', duration, emoji: '😱' });
            addLog(`😱 ${targetName} siente Miedo por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
        }

        function applyPossession(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const _posTgt = gameState.characters[targetName];
            if (_posTgt && _posTgt.passive && _posTgt.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Posesión', 'buff'); return; }
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

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            const name = mega ? 'Mega Congelacion' : 'Congelacion';
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
            // DONCELLA ESCUDERA (Lagertha): 50% de esquivar Veneno
            if (target.passive && target.passive.name === 'Doncella Escudera') {
                if (Math.random() < 0.50) {
                    addLog('🛡️ Doncella Escudera: Lagertha esquiva Veneno (50%)', 'buff');
                    return;
                }
            }
            // Veneno acumulable por duración: si ya existe un stack activo, solo suma turnos
            // El poisonTick NO se reinicia para mantener el daño progresivo continuo
            const existing = (target.statusEffects || []).find(e => e && normAccent(e.name||'') === 'veneno');
            if (existing) {
                existing.duration = (existing.duration || 0) + duration;
                addLog(`☠️ ${targetName} acumula +${duration} turnos de Veneno (total: ${existing.duration}t, tick actual: ${existing.poisonTick || 0})`, 'damage');
            } else {
                applyDebuff(targetName, { name: 'Veneno', type: 'debuff', duration, emoji: '☠️', poisonTick: 0 });
                addLog(`☠️ ${targetName} es envenenado por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
            }
            if (typeof triggerIzanamiPartB === 'function') triggerIzanamiPartB(targetName);
        }


        function applyWeaken(targetName, duration) {

            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }            applyDebuff(targetName, { name: 'Debilitar', type: 'debuff', duration, emoji: '💔' });
            addLog(`💔 ${targetName} sufre Debilitar por ${duration} turno${duration > 1 ? 's' : ''} (recibe 50% más de daño)`, 'damage');
        }

        function applyConfusion(targetName, duration) {
            if (isImmuneToDebuff(targetName)) { addLog('🛡️ ' + targetName + ' es inmune a debuffs', 'buff'); return; }
            const tgtConf = gameState.characters[targetName];
            if (!tgtConf) return;
            // MENTE BRILLANTE (Ivar): inmune a Confusión
            if (tgtConf.passive && tgtConf.passive.name === 'Mente Brillante') { addLog('🪓 Mente Brillante: Ivar es inmune a Confusión', 'buff'); return; }
            // SEÑOR DE LOS NAZGUL (Rey Brujo): inmune a Confusión
            if (tgtConf.passive && tgtConf.passive.name === 'Señor de los Nazgul') { addLog('💀 Señor de los Nazgul: Rey Brujo es inmune a Confusión', 'buff'); return; }
            if (tgtConf.statusEffects) {
                tgtConf.statusEffects = tgtConf.statusEffects.filter(e => !e || normAccent(e.name || '') !== 'confusion');
            }
            applyDebuff(targetName, { name: 'Confusion', type: 'debuff', duration, emoji: '😵' });
            addLog(`😵 ${targetName} queda Confundido por ${duration} turno${duration > 1 ? 's' : ''}`, 'damage');
            if (typeof triggerIzanamiPartB === 'function') triggerIzanamiPartB(targetName);
        }
        // Quemadura Solar: stackeable (a diferencia de Quemadura normal)
        function applySolarBurn(targetName, percent, duration) {
            const target = gameState.characters[targetName];
            if (!target || !target.statusEffects) return;
            if (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada')) {
                addLog(`🛡️ ${targetName} es inmune a Quemadura Solar (Protección Sagrada)`, 'buff');
                return;
            }
            if ((targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2')) {
                addLog('🐉 Dynastía del Dragón: Daenerys es inmune a Quemadura Solar', 'buff');
                if (typeof triggerDaenerysPassiveBurnHeal === 'function') triggerDaenerysPassiveBurnHeal('Daenerys Targaryen');
                return;
            }
            if ((targetName === 'Saitama' || targetName === 'Saitama v2')) {
                addLog('🦸 Saitama es inmune a Quemadura Solar', 'buff');
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
        function applyAuraBuff(targetName, auraType) {
            // auraType: 'fuego'|'gelida'|'oscura'|'luz'
            const target = gameState.characters[targetName];
            if (!target) return;
            const auraMap = {
                'fuego':  { name: 'Aura de fuego',  emoji: '🔥', duration: 2 },
                'gelida': { name: 'Aura gelida',     emoji: '❄️', duration: 2 },
                'oscura': { name: 'Aura oscura',     emoji: '🌑', duration: 2 },
                'luz':    { name: 'Aura de Luz',     emoji: '✨', duration: 2 },
                'infectar': { name: 'Infectar',      emoji: '🦠', duration: 2 },
                'reflejar': { name: 'Reflejar',      emoji: '🪞', duration: 2 },
            };
            const aura = auraMap[auraType];
            if (!aura) return;
            // Remove old instance and apply new
            target.statusEffects = (target.statusEffects || []).filter(e => e && e.name !== aura.name);
            target.statusEffects.push({ name: aura.name, type: 'buff', duration: aura.duration, emoji: aura.emoji });
            addLog(aura.emoji + ' ' + targetName + ' recibe ' + aura.name + ' (' + aura.duration + ' turnos)', 'buff');
        }

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
