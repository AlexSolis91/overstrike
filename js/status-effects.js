// ==================== PROCESAMIENTO DE EFECTOS DE ESTADO ====================
        function processRegenerationEffects(charName) {
            const char = gameState.characters[charName];
            if (!char || !char.statusEffects) return;
            
            // QUEMADURA SOLAR: no puede recuperar HP de ninguna fuente
            if ((char.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'quemadura solar')) {
                addLog('☀️ Quemadura Solar: ' + charName + ' no puede recuperar HP (Regeneración bloqueada)', 'debuff');
                return;
            }

            // ── ANILLO DE LA VIDA (Reliquia): +2HP al inicio de cada turno propio ──
            if ((char.equippedRelics||[]).some(function(r){ return r === 'Anillo de la Vida'; })) {
                const _anilloOld = char.hp;
                char.hp = Math.min(char.maxHp, (char.hp||0) + 2);
                const _anilloGained = char.hp - _anilloOld;
                if (_anilloGained > 0 && typeof showHpTick === 'function') showHpTick(charName, _anilloGained);
                addLog('💍 Anillo de la Vida: ' + charName + ' recupera 2HP', 'heal');
                // Trigger heal-based passives (Bendición Sagrada, Explosión de Sangre)
                if (_anilloGained > 0 && !passiveExecuting) {
                    if (typeof triggerBendicionSagrada === 'function') triggerBendicionSagrada(char.team, _anilloGained);
                    // Nezuko passive: 5 dmg to enemies
                    (function() {
                        var _nzTeam = char.team, _nzETeam = _nzTeam === 'team1' ? 'team2' : 'team1';
                        var _nzFound = false;
                        for (var _nk in gameState.characters) { var _nc = gameState.characters[_nk]; if (_nc && !_nc.isDead && _nc.team === _nzTeam && _nc.passive && _nc.passive.name === 'Explosión de Sangre') { _nzFound = true; break; } }
                        if (!_nzFound) return;
                        var _nzEnemies = Object.keys(gameState.characters).filter(function(n){ var _c=gameState.characters[n]; return _c&&_c.team===_nzETeam&&!_c.isDead&&_c.hp>0; });
                        if (!_nzEnemies.length) return;
                        passiveExecuting = true;
                        for (var _ni=0; _ni<5; _ni++) { var _al=_nzEnemies.filter(function(n){var _c=gameState.characters[n];return _c&&!_c.isDead&&_c.hp>0;}); if(!_al.length)break; var _r=_al[Math.floor(Math.random()*_al.length)]; applyDamageWithShield(_r,1,charName); }
                        passiveExecuting = false;
                        addLog('🌸 Explosión de Sangre: 5 daño al equipo enemigo (' + charName + ' curó HP por Anillo)', 'damage');
                    })();
                }
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
                    // AURA DE LUZ: duplica la curación
                    const _regenAura = (typeof hasStatusEffect === 'function') &&
                        (hasStatusEffect(charName, 'Aura de Luz') || hasStatusEffect(charName, 'Aura de luz'));
                    if (_regenAura) healAmount *= 2;
                    const oldHp = char.hp;
                    char.hp = Math.min(char.maxHp, char.hp + healAmount);
                    const actualHeal = char.hp - oldHp;
                    
                    if (actualHeal > 0) {
                        if (typeof showHpTick === 'function') showHpTick(charName, actualHeal);
                        addLog(`💖 ${charName} recuperó ${actualHeal} HP por Regeneración${_regenAura ? ' (x2 Aura de Luz)' : ''}`, 'heal');
                        // BENDICIÓN SAGRADA
                        if (typeof triggerBendicionSagrada === 'function') triggerBendicionSagrada(char.team, actualHeal);
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
            // MVP: registrar quién aplica quemadura
            if (gameState.battleStats && gameState.selectedCharacter) {
                gameState.battleStats.burnAppliers = gameState.battleStats.burnAppliers || new Set();
                gameState.battleStats.burnAppliers.add(gameState.selectedCharacter);
            }
            if (targetName === 'Antares' || targetName === 'Antares v2') {
                addLog('🐉 Monarca de la Destruccion: Antares es inmune a Quemadura', 'buff');
                return;
            }
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
            // INVIERNO ETERNO (Rey de la Noche): inmune a Quemaduras
            if (target.passive && target.passive.name === 'Invierno Eterno') {
                addLog('☠️ Invierno Eterno: Rey de la Noche es inmune a Quemadura', 'buff');
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
                if (typeof _animCard === 'function') _animCard(charName, 'anim-pulse-red', 600);
                // MVP: registrar daño por quemadura + daño causado al aplicador
                if (typeof registerBurnDamage === 'function') registerBurnDamage(damage);
                // Atribuir daño causado a los aplicadores de quemadura
                if (gameState.battleStats && gameState.battleStats.burnAppliers) {
                    const _bApp = Array.from(gameState.battleStats.burnAppliers);
                    if (_bApp.length > 0 && typeof _mvp === 'function') {
                        const _share = damage / _bApp.length;
                        _bApp.forEach(function(n){ _mvp('damageDone', n, _share); });
                    }
                }
                // RENGOKU PASIVA: genera 1 carga por tick de quemadura en enemigo
                const rengoku = gameState.characters['Rengoku'];
                if (rengoku && !rengoku.isDead && rengoku.hp > 0 && rengoku.team !== char.team) {
                    rengoku.charges = Math.min(20, (rengoku.charges || 0) + 1);
                    addLog('🔥 Corazón Ardiente: Rengoku genera 1 carga', 'buff');
                }
                // MAESTRÍA DE LA VARITA DE SAÚCO (Albus Dumbledore): +5 cargas cuando un enemigo recibe daño por Quemadura
                for (const _adn in gameState.characters) {
                    const _adc = gameState.characters[_adn];
                    if (!_adc || _adc.isDead || _adc.hp <= 0 || _adc.team === char.team) continue;
                    if (!_adc.passive || _adc.passive.name !== 'Maestría de la Varita de Saúco') continue;
                    _adc.charges = Math.min(20, (_adc.charges||0) + 5);
                    addLog('✨ Maestría de la Varita de Saúco: ' + _adn + ' genera 5 cargas (Quemadura en ' + charName + ')', 'buff');
                    break;
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
                if (typeof _animCard === 'function') _animCard(charName, 'anim-pulse-green', 600);
                // MVP: registrar daño por veneno + daño causado al aplicador
                if (typeof registerPoisonDamage === 'function') registerPoisonDamage(totalVenenoDmg);
                if (gameState.battleStats && gameState.battleStats.poisonAppliers) {
                    const _pApp = Array.from(gameState.battleStats.poisonAppliers);
                    if (_pApp.length > 0 && typeof _mvp === 'function') {
                        const _share = totalVenenoDmg / _pApp.length;
                        _pApp.forEach(function(n){ _mvp('damageDone', n, _share); });
                    }
                }

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
            if (charName === 'Antares' || charName === 'Antares v2') {
                const _antC = gameState.characters[charName];
                if (_antC) _antC.statusEffects = (_antC.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'quemadura solar');
                return;
            }
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
                    // DESTELLO DE PEGASO (Seiya): cuando expira un buff en un aliado, Seiya gana 1 carga
                    if (effect.type === 'buff') {
                        const _seChar = gameState.characters[charName];
                        if (_seChar) {
                            const _seTeam = _seChar.team;
                            for (const _sn in gameState.characters) {
                                const _sc = gameState.characters[_sn];
                                if (!_sc || _sc.isDead || _sc.hp <= 0 || _sc.team !== _seTeam) continue;
                                if (!_sc.passive || _sc.passive.name !== 'Destello de Pegaso') continue;
                                _sc.charges = Math.min(20, (_sc.charges||0) + 1);
                                addLog('🌟 Destello de Pegaso: Seiya +1 carga (buff expiró en ' + charName + ')', 'buff');
                                break;
                            }
                        }
                    }
                    const nname = normAccent(effect.name || '');
                    // Limpiar Forma Dragón de Alexstrasza cuando Escudo Sagrado expira
                    if (nname === 'escudo sagrado' && (charName === 'Alexstrasza' || charName === 'Alexstrasza v2')) {
                        char.dragonFormActive = false;
                        addLog(`🐉 Alexstrasza vuelve a su forma normal`, 'info');
                    }
                    // LUNA SUPERIOR DOS (Douma): cargas al expirar Congelacion
                    if (nname === 'congelacion' || nname === 'mega congelacion') {
                        const _lsdChar = gameState.characters[charName];
                        if (_lsdChar) {
                            const _lsdETeam = _lsdChar.team === 'team1' ? 'team2' : 'team1';
                            const _chargesGain = (nname === 'mega congelacion') ? 3 : 1;
                            for (const _dn in gameState.characters) {
                                const _dc = gameState.characters[_dn];
                                if (!_dc || _dc.isDead || _dc.hp <= 0 || _dc.team !== _lsdETeam) continue;
                                if (!_dc.passive || _dc.passive.name !== 'Luna Superior Dos') continue;
                                // +cargas a todo el equipo aliado de Douma
                                for (const _an in gameState.characters) {
                                    const _ac = gameState.characters[_an];
                                    if (_ac && !_ac.isDead && _ac.hp > 0 && _ac.team === _lsdETeam) {
                                        _ac.charges = Math.min(20, (_ac.charges||0) + _chargesGain);
                                    }
                                }
                                addLog('❄️ Luna Superior Dos: equipo aliado +' + _chargesGain + ' cargas (' + (nname === 'mega congelacion' ? 'Megacongelacion' : 'Congelacion') + ' expiró en ' + charName + ')', 'buff');
                                break;
                            }
                        }
                    }
                    // Restaurar velocidad si era congelacion
                    if ((nname === 'congelacion' || nname === 'mega congelacion') && (effect.speedPenalty || effect.speedPenaltyFlat)) {
                        if (effect.speedPenaltyFlat) {
                            // Nuevo sistema: suma plana
                            char.speed = Math.min(char.baseSpeed || 999, char.speed + effect.speedPenaltyFlat);
                        } else {
                            // Sistema viejo: multiplicativo (compatibilidad)
                            char.speed = Math.round(char.speed / (1 - effect.speedPenalty));
                        }
                        addLog((effect.emoji || '❄️') + ' ' + charName + ' se descongela (velocidad restaurada)', 'buff');
                    }
                    // Restaurar velocidad si era celeridad
                    if (nname === 'celeridad' && effect.speedBonus) {
                        // speedBonus ya es valor absoluto (normalizado al aplicar en applyBuff)
                        const _celRestore = effect.speedBonus >= 1 ? effect.speedBonus : Math.round((char.speed||80) * effect.speedBonus);
                        char.speed = Math.max(1, char.speed - _celRestore);
                        addLog('💨 Celeridad de ' + charName + ' expira (velocidad restaurada)', 'info');
                    }
                    // Restaurar velocidad si era Arena_VelDebuff (Gaara - Arenas Movedizas)
                    if (nname === 'arena_veldebuff' && effect._velRestored) {
                        char.speed = Math.min((char.baseSpeed || 999), char.speed + effect._velRestored);
                        addLog('🏜️ Arenas Movedizas: velocidad de ' + charName + ' restaurada', 'info');
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
            // INVIERNO ETERNO (Rey de la Noche): inmune a Quemaduras
            if (target.passive && target.passive.name === 'Invierno Eterno') {
                addLog('☠️ Invierno Eterno: Rey de la Noche es inmune a Quemadura', 'buff');
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
            // Quemadura Solar bloquea toda recuperación de HP
            if (char.statusEffects.some(e => e && normAccent(e.name||'') === 'quemadura solar')) {
                return false;
            }
            return true;
        }

        // Función centralizada de curación — respeta QS y aplica Aura de Luz automáticamente
        function applyHeal(charName, amount, logSource) {
            if (!canHeal(charName)) {
                if (logSource) addLog('☀️ QS bloquea la curación de ' + charName, 'debuff');
                return 0;
            }
            const _ch = gameState.characters[charName];
            if (!_ch || _ch.isDead || _ch.hp <= 0) return 0;
            // AURA DE LUZ: duplica la curación
            const _hasAuraLuz = (typeof hasStatusEffect === 'function') &&
                (hasStatusEffect(charName, 'Aura de Luz') || hasStatusEffect(charName, 'Aura de luz'));
            // ECO SANADOR (Reliquia): duplica la curación recibida
            const _hasEcoSanador = _ch._doubleHeal;
            const _healMult = (_hasAuraLuz ? 2 : 1) * (_hasEcoSanador ? 2 : 1);
            const _healAmt = Math.ceil(amount * _healMult);
            const _oldHp = _ch.hp;
            _ch.hp = Math.min(_ch.maxHp, _ch.hp + _healAmt);
            const _actual = _ch.hp - _oldHp;
            if (_actual > 0) {
                if (logSource) addLog('💚 ' + charName + ' recupera ' + _actual + ' HP' + (_hasAuraLuz ? ' (x2 Aura de Luz)' : '') + ' (' + logSource + ')', 'heal');
                // HP heal tick animation
                if (typeof showHpTick === 'function') showHpTick(charName, _actual);
                // MVP: registrar healing dado por el personaje activo
                if (!passiveExecuting && gameState.selectedCharacter && typeof registerHealing === 'function') {
                    const _healCaster = gameState.selectedCharacter;
                    const _healCasterC = gameState.characters[_healCaster];
                    const _healTarget = gameState.characters[charName];
                    // Solo cuenta si el sanador y el objetivo son aliados (no se cura a enemigos)
                    if (_healCasterC && _healTarget && _healCasterC.team === _healTarget.team && _healCaster !== charName) {
                        registerHealing(_healCaster, _actual);
                    }
                }
            }
            // ADAPTACION REACTIVA: disparar cuando Doomsday recupera HP por curación
            if (_actual > 0 && typeof triggerAdaptacionReactivaHeal === 'function') {
                triggerAdaptacionReactivaHeal(charName);
            }
            // BENDICIÓN SAGRADA (Min Byung): cualquier curación activa la pasiva
            // Uses passiveHealExecuting to block secondary chains (Bendición→Explosión→Bendición)
            // but still fires when passiveExecuting is true (e.g. Tesoro del Cielo)
            if (_actual > 0 && !passiveHealExecuting && typeof triggerBendicionSagrada === 'function') {
                const _healedChar = gameState.characters[charName];
                if (_healedChar) {
                    passiveHealExecuting = true;
                    triggerBendicionSagrada(_healedChar.team, _actual);
                    passiveHealExecuting = false;
                }
            }
            // EXPLOSIÓN DE SANGRE (Nezuko): cada vez que un aliado cura HP → 5 daño aleatorio al equipo enemigo
            if (_actual > 0 && !passiveHealExecuting) {
                const _nezHealedChar = gameState.characters[charName];
                if (_nezHealedChar) {
                    const _nezTeam2 = _nezHealedChar.team;
                    const _nezETeam = _nezTeam2 === 'team1' ? 'team2' : 'team1';
                    // Find Nezuko alive on the same team
                    let _nezFound = false;
                    for (const _nn in gameState.characters) {
                        const _nc = gameState.characters[_nn];
                        if (_nc && !_nc.isDead && _nc.team === _nezTeam2 && _nc.passive && _nc.passive.name === 'Explosión de Sangre') {
                            _nezFound = true; break;
                        }
                    }
                    if (_nezFound) {
                        // Deal 5 damage distributed randomly among enemies
                        const _nezEnemies = Object.keys(gameState.characters).filter(function(n){
                            const _c = gameState.characters[n];
                            return _c && _c.team === _nezETeam && !_c.isDead && _c.hp > 0;
                        });
                        if (_nezEnemies.length > 0) {
                            passiveHealExecuting = true;
                            passiveExecuting = true;
                            for (var _ni = 0; _ni < 5; _ni++) {
                                const _alive = _nezEnemies.filter(function(n){ const _c=gameState.characters[n]; return _c&&!_c.isDead&&_c.hp>0; });
                                if (!_alive.length) break;
                                const _rnd = _alive[Math.floor(Math.random()*_alive.length)];
                                if (typeof applyDamageWithShield === 'function') {
                                    applyDamageWithShield(_rnd, 1, charName);
                                } else {
                                    const _ec = gameState.characters[_rnd];
                                    if (_ec) { _ec.hp = Math.max(0, _ec.hp - 1); if (_ec.hp<=0&&!_ec.isDead){_ec.isDead=true;} }
                                }
                            }
                            passiveHealExecuting = false;
                            passiveExecuting = false;
                            addLog('🌸 Explosión de Sangre: 5 daño al equipo enemigo (' + charName + ' curó HP)', 'damage');
                        }
                    }
                }
            }
            return _actual;
        }
