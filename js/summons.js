// ── GLOBAL FLAG: prevents infinite passive cascade loops ──
        let passiveExecuting = false;

        // ==================== ROBO DE CARGAS ====================
        function stealCharges(attackerName, targetName, amount) {
            const attacker = gameState.characters[attackerName];
            const target = gameState.characters[targetName];
            if (!attacker || !target) return 0;
            const stolen = Math.min(target.charges, amount);
            target.charges -= stolen;
            attacker.charges += stolen;
            if (stolen > 0) addLog(`⚡ ${attackerName} roba ${stolen} carga${stolen > 1 ? 's' : ''} a ${targetName}`, 'buff');
            else addLog(`⚡ ${targetName} no tiene cargas que robar`, 'info');
            return stolen;
        }

        // ==================== SISTEMA DE INVOCACIONES ====================
        function checkAndRemoveStealth(targetTeam) {
            // Remover Sigilo de todos los personajes del equipo objetivo en ataques AOE
            // El Sigilo se suspende pero el personaje SÍ recibe el daño AOE
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (char.team === targetTeam && !char.isDead && char.statusEffects) {
                    const sigiloIndex = char.statusEffects.findIndex(e => e.name === 'Sigilo');
                    if (sigiloIndex !== -1) {
                        char.statusEffects.splice(sigiloIndex, 1);
                        addLog(`👤 El Sigilo de ${name} fue suspendido por un ataque AOE (recibirá daño)`, 'damage');
                    }
                }
            }
        }

        function summonShadow(shadowName, summonerName) {
            try {
                const summoner = gameState.characters[summonerName];
                const shadowTemplate = summonData[shadowName];
                
                if (!summoner) {
                    console.error('Summoner not found:', summonerName);
                    return;
                }
                
                if (!shadowTemplate) {
                    console.error('Shadow template not found:', shadowName);
                    return;
                }
                
                // UNICIDAD: verificar que no haya otra invocación con el mismo nombre del mismo invocador
                const alreadyExists = Object.values(gameState.summons).some(
                    s => s && s.name === shadowName && s.team === summoner.team
                );
                if (alreadyExists) {
                    addLog('❌ ' + shadowName + ' ya está en el campo (no se puede invocar dos veces)', 'info');
                    return;
                }
                // Crear copia de la invocación
                const summonId = `${shadowName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                gameState.summons[summonId] = {
                    ...JSON.parse(JSON.stringify(shadowTemplate)),
                    id: summonId,
                    summoner: summonerName,
                    team: summoner.team,
                    // Copy effect as dragonEffect for legacy EOR checks
                    dragonEffect: shadowTemplate.effect || null,
                    // Drogon gets megaProvocation from summonData template
                    megaProvocation: shadowTemplate.megaProvocation || (shadowName === 'Drogon') || false
                };
                
                addLog(`👻 ${summonerName} invoca a ${shadowName}!`, 'buff');
                // NO llamar renderSummons aquí - se llama al final del turno
            } catch (error) {
                console.error('Error en summonShadow:', error);
                addLog(`❌ Error al invocar ${shadowName}`, 'info');
            }
        }

        function removeSummon(summonId, reason = 'derrotado') {
            const summon = gameState.summons[summonId];
            if (!summon) return;
            
            addLog(`💨 ${summon.name} ha ${reason === 'sacrificed' ? 'sido sacrificado' : 'sido derrotado'}`, 'damage');
            
            // Activar pasiva de Sun Jin Woo si es su sombra - SOLO si no estamos en otra pasiva
            if ((summon.summoner === 'Sun Jin Woo' || summon.summoner === 'Sun Jin Woo v2') && reason !== 'summoner_dead' && !passiveExecuting) {
                const jinWoo = gameState.characters[summon.summoner] || gameState.characters['Sun Jin Woo'];
                if (jinWoo && !jinWoo.isDead) {
                    jinWoo.charges += 2;
                    addLog(`⚡ Sun Jin Woo genera 2 cargas (pasiva: Sombra derrotada)`, 'buff');
                    // Activar pasiva de Igris SOLO si no estamos en cascada
                    triggerIgrisPassive(summon.summoner || 'Sun Jin Woo');
                }
            }
            
            // SEÑUELO de Padme: al morir genera 2 cargas al equipo aliado
            if (summon.name === 'Señuelo' && reason !== 'summoner_dead') {
                const alliedChars = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === summon.team && !c.isDead && c.hp > 0;
                });
                alliedChars.forEach(n => {
                    gameState.characters[n].charges = Math.min(20, (gameState.characters[n].charges || 0) + 2);
                });
                addLog(`🎭 Señuelo derrotado: todo el equipo aliado gana 2 cargas`, 'buff');
            }
            
            // FAKE BLACK: al morir causa 3 AOE + 2 cargas al equipo aliado
            if (summon.name === 'Fake Black' && reason !== 'summoner_dead' && !passiveExecuting) {
                passiveExecuting = true;
                const _fbETeam = summon.team === 'team1' ? 'team2' : 'team1';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _fbETeam || _c.isDead || _c.hp <= 0) continue;
                    if (typeof checkAsprosAOEImmunity === 'function' && checkAsprosAOEImmunity(_n, true)) continue;
                    applyDamageWithShield(_n, 3, 'Fake Black');
                }
                for (const _sid in gameState.summons) {
                    const _s = gameState.summons[_sid];
                    if (!_s || _s.team !== _fbETeam || _s.hp <= 0 || _sid === summonId) continue;
                    applySummonDamage(_sid, 3, 'Fake Black');
                }
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== summon.team || _c.isDead || _c.hp <= 0) continue;
                    _c.charges = Math.min(20, (_c.charges||0) + 2);
                }
                addLog('Fake Black: Explosion - 3 dano AOE + 2 cargas al equipo aliado', 'damage');
                passiveExecuting = false;
            }

            delete gameState.summons[summonId];
            // NO llamar renderSummons aquí - se llama al final del turno
        }

        function getSummonsByTeam(team) {
            return Object.keys(gameState.summons)
                .map(id => gameState.summons[id])
                .filter(summon => summon && summon.team === team);
        }

        function getSummonsBySummoner(summonerName) {
            return Object.keys(gameState.summons)
                .map(id => gameState.summons[id])
                .filter(summon => summon && summon.summoner === summonerName);
        }

        // ── Helper: damage all enemy summons (used by AOE handlers) ──
        function applyAOEDamageToSummons(attackerTeam, damage, attackerName) {
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (!s || s.team === attackerTeam || s.hp <= 0) continue;
                applySummonDamage(sid, damage, attackerName);
            }
        }

        function applySummonDamage(summonId, damage, attackerName = null) {
            const summon = gameState.summons[summonId];
            if (!summon) return 0;
            
            const oldHp = summon.hp;
            summon.hp = Math.max(0, summon.hp - damage);
            
            // SINDRAGOSA: genera 1 carga a todo el equipo aliado cuando recibe daño
            if (summon.name === 'Sindragosa' && damage > 0 && !passiveExecuting) {
                passiveExecuting = true;
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === summon.team && !c.isDead && c.hp > 0) {
                        c.charges += 1;
                    }
                }
                addLog(`❄️ Sindragosa: Todo el equipo aliado genera 1 carga al recibir daño`, 'buff');
                passiveExecuting = false;
            }

            // Si es Kamish y fue golpeado, aplicar quemaduras al atacante
            if (summon.name === 'Kamish' && attackerName) {
                const attacker = gameState.characters[attackerName];
                if (attacker && !attacker.isDead) {
                    applyFlatBurn(attackerName, 4, 1); // 4 HP por 1 turno (spec: 4 HP)
                    addLog('🔥 Kamish: ' + attackerName + ' recibe Quemadura de 4 HP (1 turno)', 'damage');
                }
            }
            
            if (summon.hp <= 0 && oldHp > 0) {
                if (attackerName) {
                    addLog(`💀 ${summon.name} fue derrotado por ${attackerName}`, 'damage');
                }
                removeSummon(summonId, 'derrotado');
            } else if (summon.hp > 0 && damage > 0) {
                // COPIA DE HIELO (Douma de Hielo): si la estatua sobrevive → Douma gana turno adicional
                if (summon.name === 'Douma de Hielo' && summon.summoner) {
                    const _dSummoner = summon.summoner;
                    const _dSummonerChar = gameState.characters[_dSummoner];
                    if (_dSummonerChar && !_dSummonerChar.isDead && _dSummonerChar.hp > 0) {
                        if (!gameState._sasukeRevengeQueue) gameState._sasukeRevengeQueue = [];
                        if (!gameState._sasukeRevengeQueue.includes(_dSummoner)) {
                            gameState._sasukeRevengeQueue.push(_dSummoner);
                            addLog('❄️ Copia de Hielo: ' + _dSummoner + ' gana turno adicional (estatua recibió daño y sobrevivió)', 'buff');
                        }
                    }
                }
            }
            
            renderSummons();
            return damage;
        }


        function summonFakeBlack(summonerName) {
            const summoner = gameState.characters[summonerName];
            if (!summoner) return;
            const summonId = 'FakeBlack_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            gameState.summons[summonId] = {
                id: summonId, name: 'Fake Black',
                hp: 2, maxHp: 2, summoner: summonerName, team: summoner.team,
                statusEffects: [], img: '',
                passive: 'Explosion: Al morir causa 3 puntos de dano AOE y genera 2 puntos de carga en el equipo aliado',
                dragonEffect: 'fake_black_explosion', megaProvocation: false
            };
            addLog('Fake Black invocado por ' + summonerName, 'buff');
        }

        function summonDragon(dragonName, summoner, team) {
            // Check if already summoned
            const alreadySummoned = Object.values(gameState.summons).some(s => s && s.name === dragonName && s.summoner === summoner);
            if (alreadySummoned) { addLog('🐉 ' + dragonName + ' ya está invocado', 'info'); return; }
            const dragonStats = {
                'Drogon':  { hp: 15, maxHp: 15, effect: 'mega_prov_aoe_dmg', passive: '🔴 Megaprovoción activa. Inflige 3 de daño AOE al equipo enemigo al final de cada ronda.' },
                'Rhaegal': { hp: 8, maxHp: 8, effect: 'burn_team', passive: '🟢 Al final de cada ronda aplica Quemadura 1 HP por 1 turno a todo el equipo enemigo.' },
                'Viserion': { hp: 6, maxHp: 6, effect: 'heal_team', passive: '⚪ Al final de cada ronda cura 2 HP a todo el equipo aliado.' }
            };
            const stats = dragonStats[dragonName] || { hp: 8, maxHp: 8, effect: '' };
            const sId = dragonName + '_' + Date.now();
            gameState.summons[sId] = {
                name: dragonName, summoner: summoner, team: team,
                hp: stats.hp, maxHp: stats.maxHp, isDead: false, statusEffects: [],
                dragonEffect: stats.effect, passive: stats.passive || 'Pasiva especial de dragón',
                megaProvocation: dragonName === 'Drogon' // Drogon tiene Megaprovocación
            };
            renderSummons();
            addLog('🐉 ' + summoner + ' invoca a ' + dragonName + ' (' + stats.hp + ' HP)', 'buff');
        }

        function renderSummons() {
            const team1Container = document.getElementById('team1Summons');
            const team2Container = document.getElementById('team2Summons');
            
            if (!team1Container || !team2Container) return;
            
            team1Container.innerHTML = '';
            team2Container.innerHTML = '';
            
            const team1Summons = [];
            const team2Summons = [];
            
            // Separar invocaciones por equipo
            Object.keys(gameState.summons).forEach(summonId => {
                const summon = gameState.summons[summonId];
                if (summon) {
                    if (summon.team === 'team1') {
                        team1Summons.push({ id: summonId, ...summon });
                    } else {
                        team2Summons.push({ id: summonId, ...summon });
                    }
                }
            });
            
            // Renderizar team1 summons
            team1Summons.forEach(summon => {
                team1Container.innerHTML += renderSummonCard(summon);
            });
            
            // Renderizar team2 summons
            team2Summons.forEach(summon => {
                team2Container.innerHTML += renderSummonCard(summon);
            });
        }

        function renderSummonCard(summon) {
            const teamClass = summon.team === 'team1' ? 'team1' : 'team2';
            const hpPct = Math.max(0, (summon.hp / summon.maxHp) * 100);
            const borderColor = summon.team === 'team1' ? '#00c4ff' : '#ff4466';
            // Get image from summonData
            const sData = summonData[summon.name] || {};
            const imgUrl = sData.img || '';
            const imgHtml = imgUrl
                ? `<img src="${imgUrl}" alt="${summon.name}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;border:1px solid ${borderColor};flex-shrink:0;" onerror="this.style.display='none'">`
                : `<div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">👻</div>`;
            
            return `
                <div class="summon-card-mini ${teamClass}" onclick="showSummonDetail('${summon.id}')" style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.6); border:2px solid ${borderColor}; border-radius:8px; padding:4px 6px; margin:2px; cursor:pointer; max-width:170px; transition:all 0.2s;" onmouseover="this.style.boxShadow='0 0 12px ${borderColor}'" onmouseout="this.style.boxShadow='none'">
                    ${imgHtml}
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:0.65rem; font-weight:700; color:${borderColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${summon.name}</div>
                        <div style="background:rgba(0,0,0,0.6); border-radius:3px; height:5px; overflow:hidden; margin-top:2px;">
                            <div style="width:${hpPct}%; height:100%; background:linear-gradient(90deg,#00ff66,#00cc55); border-radius:3px; transition:width 0.3s;"></div>
                        </div>
                        <div style="font-size:0.55rem; color:#aaa; text-align:center;">${summon.hp}/${summon.maxHp} HP</div>
                    </div>
                </div>
            `;
        }

        function showSummonDetail(summonId) {
            const summon = gameState.summons[summonId];
            if (!summon) return;
            const modal = document.getElementById('summonInfoModal');
            const content = document.getElementById('summonInfoContent');
            if (!modal || !content) return;
            const borderColor = summon.team === 'team1' ? '#00c4ff' : '#ff4466';
            let statusHTML = '';
            if (summon.statusEffects && summon.statusEffects.length > 0) {
                statusHTML = summon.statusEffects.filter(e => e && e.name).map(e =>
                    '<span style="background:rgba(255,170,0,0.2);border:1px solid #ffaa00;padding:2px 6px;border-radius:5px;font-size:0.75em;margin:2px;">' + (e.emoji||'✨') + ' ' + e.name + '</span>'
                ).join(' ');
            }
            // Get image from summonData (Bug 10 fix: show image in in-game summon modal)
            const _sDetail = (typeof summonData !== 'undefined') ? (summonData[summon.name] || {}) : {};
            const _imgUrl = _sDetail.img || summon.img || '';
            const _imgHtml = _imgUrl
                ? '<div style="text-align:center;margin-bottom:14px;"><img src="' + _imgUrl + '" alt="' + summon.name + '" style="width:120px;height:120px;object-fit:cover;border-radius:12px;border:3px solid ' + borderColor + ';box-shadow:0 0 20px ' + borderColor + '66;" onerror="this.style.opacity=0.2"></div>'
                : '';
            content.innerHTML = '<div style="text-align:center;max-width:400px;margin:0 auto;">' +
                _imgHtml +
                '<div style="font-family:Orbitron,sans-serif;font-size:1.3rem;color:' + borderColor + ';margin-bottom:8px;">👻 ' + summon.name + '</div>' +
                '<div style="font-size:1rem;color:#fff;margin-bottom:6px;">❤️ HP: ' + summon.hp + ' / ' + summon.maxHp + '</div>' +
                '<div style="background:rgba(0,0,0,0.4);border-radius:8px;height:12px;overflow:hidden;margin:8px auto;max-width:200px;">' +
                    '<div style="width:' + Math.max(0,(summon.hp/summon.maxHp)*100) + '%;height:100%;background:linear-gradient(90deg,#00ff66,#00cc55);border-radius:8px;"></div>' +
                '</div>' +
                '<div style="color:#a855f7;font-weight:700;margin:12px 0 6px;">⚡ Pasiva</div>' +
                '<div style="color:#ccc;line-height:1.5;font-size:0.9rem;">' + (summon.passive || 'Sin pasiva') + '</div>' +
                '<div style="color:#888;font-size:0.8rem;margin-top:10px;">Invocado por: ' + (summon.summoner || '?') + '</div>' +
                (statusHTML ? '<div style="margin-top:8px;">' + statusHTML + '</div>' : '') +
            '</div>';
            modal.style.display = 'block';
        }
        function triggerIgrisPassive(summonerName) {
            try {
                if (passiveExecuting) return;
                const igrisSummons = Object.keys(gameState.summons).filter(id => {
                    const s = gameState.summons[id];
                    return s && s.name === 'Igris' && s.summoner === summonerName && s.hp > 0;
                });
                if (igrisSummons.length === 0) return;
                passiveExecuting = true;
                igrisSummons.forEach(igrisId => {
                    const igris = gameState.summons[igrisId];
                    if (!igris) return;
                    const enemyTeam = igris.team === 'team1' ? 'team2' : 'team1';
                    // Comandante Rojo Sangriento: 2 dano AOE a TODOS los enemigos
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                        applyDamageWithShield(_n, 2, 'Igris');
                    }
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (!_s || _s.team !== enemyTeam || _s.hp <= 0 || _sid === igrisId) continue;
                        applySummonDamage(_sid, 2, 'Igris');
                    }
                    addLog('Igris (Comandante Rojo): 2 dano AOE a todos los enemigos', 'damage');
                    // Eliminar 1 invocacion enemiga aleatoria
                    const enemySummonIds = Object.keys(gameState.summons).filter(sid => {
                        const _s = gameState.summons[sid];
                        return _s && _s.team === enemyTeam && _s.hp > 0;
                    });
                    if (enemySummonIds.length > 0) {
                        const toElim = enemySummonIds[Math.floor(Math.random() * enemySummonIds.length)];
                        const elimName = gameState.summons[toElim] ? gameState.summons[toElim].name : 'Invocacion';
                        delete gameState.summons[toElim];
                        addLog('Igris: Elimina a ' + elimName + ' del campo enemigo', 'damage');
                    }
                });
                passiveExecuting = false;
            } catch (error) {
                console.error('Error en triggerIgrisPassive:', error);
                passiveExecuting = false;
            }
        }
        
        // Pasiva de Tusk: duplica daño de quemaduras
        function applyTuskPassive(targetName, baseBurnDamage) {
            const summoner = gameState.characters[targetName];
            if (!summoner) return baseBurnDamage;
            
            // Buscar si hay un Tusk en el equipo contrario
            const enemyTeam = summoner.team === 'team1' ? 'team2' : 'team1';
            const hasTusk = Object.keys(gameState.summons).some(id => {
                const summon = gameState.summons[id];
                return summon.name === 'Tusk' && summon.team === enemyTeam && summon.hp > 0;
            });
            
            if (hasTusk) {
                addLog(`🔥 Himno de Fuego (Tusk): El daño de quemadura se duplica`, 'damage');
                return baseBurnDamage * 2;
            }
            
            return baseBurnDamage;
        }
        
        // Pasiva de Beru: daño al final de ronda
        function triggerBeruPassive() {
            if (passiveExecuting) return;
            passiveExecuting = true;
            
            Object.keys(gameState.summons).forEach(summonId => {
                const beru = gameState.summons[summonId];
                if (beru && beru.name === 'Beru' && beru.hp > 0) {
                    const enemyTeam = beru.team === 'team1' ? 'team2' : 'team1';
                    
                    // Buscar enemigos vivos
                    const enemies = [];
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === enemyTeam && !char.isDead && char.hp > 0) {
                            enemies.push({ type: 'character', name: name });
                        }
                    }
                    
                    for (let sumId in gameState.summons) {
                        const summon = gameState.summons[sumId];
                        if (summon.team === enemyTeam && summon.hp > 0) {
                            enemies.push({ type: 'summon', id: sumId, name: summon.name });
                        }
                    }
                    
                    if (enemies.length > 0) {
                        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
                        
                        if (randomEnemy.type === 'character') {
                            applyDamageWithShield(randomEnemy.name, 5, 'Beru');
                            addLog(`⚔️ Beru (Pasiva - Fin de Ronda) ataca a ${randomEnemy.name} causando 5 de daño`, 'damage');
                        } else {
                            applySummonDamage(randomEnemy.id, 5, 'Beru');
                            addLog(`⚔️ Beru (Pasiva - Fin de Ronda) ataca a ${randomEnemy.name} causando 5 de daño`, 'damage');
                        }
                    }
                }
            });
            
            passiveExecuting = false;
        }

        // Pasiva de Kaisel: aplica debuff aleatorio a 2 enemigos al final de ronda
        function triggerKaiselPassive() {
            if (passiveExecuting) return;
            Object.keys(gameState.summons).forEach(function(kaisId) {
                const kais = gameState.summons[kaisId];
                if (!kais || kais.name !== 'Kaisel' || kais.hp <= 0) return;
                passiveExecuting = true;
                const enemyTeam = kais.team === 'team1' ? 'team2' : 'team1';
                // Maldicion de Kaisel: reduce 3 cargas a TODOS los enemigos
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                    _c.charges = Math.max(0, (_c.charges||0) - 3);
                    addLog('Kaisel (Maldicion): ' + _n + ' pierde 3 cargas', 'debuff');
                }
                passiveExecuting = false;
            });
        }

        // Pasiva de Bellion: cancelar Special/Over una vez por ronda
        function checkBellionCounter(attackerName, abilityType) {
            try {
                // Solo cancelar Special u Over
                if (abilityType !== 'special' && abilityType !== 'over') {
                    return false;
                }
                
                // Prevenir cascadas
                if (passiveExecuting) return false;
                
                const attacker = gameState.characters[attackerName];
                if (!attacker) return false;
                
                const enemyTeam = attacker.team === 'team1' ? 'team2' : 'team1';
                
                // Buscar Bellion enemigo que no haya usado su pasiva esta ronda
                for (let summonId in gameState.summons) {
                    const bellion = gameState.summons[summonId];
                    if (bellion && bellion.name === 'Bellion' && bellion.team === enemyTeam && 
                        bellion.hp > 0 && !bellion.usedThisRound) {
                        
                        // Activar pasiva de Bellion
                        bellion.usedThisRound = true;
                        
                        passiveExecuting = true;
                        // Causar daño al atacante
                        applyDamageWithShield(attackerName, 4, 'Bellion');
                        passiveExecuting = false;
                        
                        addLog(`🛡️ Bellion (Pasiva) cancela ${abilityType} de ${attackerName} y causa 4 de daño`, 'buff');
                        
                        return true; // Habilidad cancelada
                    }
                }
                
                return false; // No se canceló
            } catch (error) {
                console.error('Error en checkBellionCounter:', error);
                passiveExecuting = false;
                return false;
            }
        }

        // Resetear pasiva de Bellion al inicio de ronda
        function resetBellionPassives() {
            try {
                for (let summonId in gameState.summons) {
                    const summon = gameState.summons[summonId];
                    if (summon && summon.name === 'Bellion') {
                        summon.usedThisRound = false;
                    }
                }
            } catch (error) {
                console.error('Error en resetBellionPassives:', error);
            }
        }

        // Verificar si hay Kamish con Mega Provocación
        function checkKamishMegaProvocation(targetTeam) {
            // Returns { id, kamish/char obj, isCharacter, characterName } if MegaProv active
            // Priority: character buff > summon megaProvocation flag > Kamish by name
            try {
                // 1. CHARACTER with MegaProvocacion buff active
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== targetTeam || c.isDead || c.hp <= 0) continue;
                    if (c.statusEffects && c.statusEffects.some(e => {
                        if (!e) return false;
                        const _nn = normAccent(e.name || '');
                        return _nn === 'megaprovocacion' || _nn === 'mega provocacion';
                    })) {
                        return { id: null, holder: c, isCharacter: true, characterName: n, kamish: c };
                    }
                }
                // 2. SUMMON with megaProvocation flag (Drogon, Sindragosa, Tirion, Kamish)
                for (let summonId in gameState.summons) {
                    const s = gameState.summons[summonId];
                    if (s && s.team === targetTeam && s.hp > 0 &&
                        (s.megaProvocation || s.name === 'Kamish' || s.name === 'Tirion Fordring' ||
                         s.name === 'Sindragosa' || s.name === 'Drogon')) {
                        return { id: summonId, holder: s, isCharacter: false, kamish: s };
                    }
                }
                return null;
            } catch (error) {
                console.error('Error en checkKamishMegaProvocation:', error);
                return null;
            }
        }

        // ── HELPER: Count total alive team members (chars + summons) excluding MegaProv holder ──
        function countMegaProvMultiplier(team, mpData) {
            let count = 0;
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (!c || c.team !== team || c.isDead || c.hp <= 0) continue;
                // Include EVERYONE including the MegaProv holder themselves
                count++;
            }
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (!s || s.team !== team || s.hp <= 0) continue;
                count++;
            }
            return Math.max(1, count);
        }

        // Pasiva de Iron: absorbe daño del invocador
        function checkIronProtection(targetName) {
            // Buscar si el objetivo tiene un Iron que lo protege
            const ironSummons = Object.keys(gameState.summons).filter(id => {
                const summon = gameState.summons[id];
                return summon.name === 'Iron' && summon.summoner === targetName && summon.hp > 0;
            });
            
            if (ironSummons.length > 0) {
                return ironSummons[0]; // Devolver el ID del Iron
            }
            
            return null;
        }

        function redirectDamageToIron(ironId, damage, attackerName) {
            const iron = gameState.summons[ironId];
            if (!iron) return damage;
            
            addLog(`🛡️ Iron (Pasiva - Iron Strength) absorbe el daño dirigido a ${iron.summoner}`, 'buff');
            applySummonDamage(ironId, damage, attackerName);
            return 0; // El invocador no recibe daño
        }

        function applyDamageWithShield(targetName, damage, attackerName = null) {
            // Si el targetName es un summon especial (__summon__:id), redirigir a applySummonDamage
            if (typeof targetName === 'string' && targetName.startsWith('__summon__:')) {
                const _sumId = targetName.slice(11);
                return applySummonDamage(_sumId, damage, attackerName);
            }

            const target = gameState.characters[targetName];
            if (!target) return 0;

            // ── PASIVA IZANAMI (Itachi Uchiha): esquiva primer golpe de 3+ daño por ronda ──
            if (!passiveExecuting && damage >= 3 && attackerName && attackerName !== targetName) {
                if (!target.isDead && target.hp > 0 &&
                    target.passive && target.passive.name === 'Izanami' &&
                    !target.izanamiUsedThisRound) {
                    target.izanamiUsedThisRound = true;
                    const _izAtk = gameState.characters[attackerName];
                    const _izStolen = _izAtk ? Math.min(5, _izAtk.charges || 0) : 0;
                    if (_izAtk && _izStolen > 0) {
                        _izAtk.charges = Math.max(0, (_izAtk.charges || 0) - _izStolen);
                        target.charges = Math.min(20, (target.charges || 0) + _izStolen);
                    }
                    addLog('👁️ Izanami: ' + targetName + ' esquiva el golpe de ' + damage + ' daño' +
                        (_izStolen > 0 ? ' y roba ' + _izStolen + ' cargas de ' + attackerName : ''), 'buff');
                    return 0; // Golpe esquivado completamente
                }
            }

            // ── CAZADOR DE HÉROES (Garou): daño DIRECTO (attackerName=null) → cargas ──
            // Solo se activa con daño directo (quemaduras, veneno, sangrado, efectos)
            // NO se activa con daño por golpe del enemigo (attackerName = personaje)
            if (!passiveExecuting && damage > 0 && attackerName === null &&
                target.passive && target.passive.name === 'Cazador de Héroes') {
                const _garouChargesGained = damage;
                target.charges = Math.min(20, (target.charges || 0) + _garouChargesGained);
                addLog('🐆 Cazador de Héroes: ' + targetName + ' convierte ' + damage + ' de daño directo en ' + _garouChargesGained + ' cargas', 'buff');
                return 0; // No HP damage — converted to charges
            }
            // ── CABALLERO DE LA NOCHE (Batman): inmune a daño de ataques especiales ──
            if (!passiveExecuting && attackerName && attackerName !== targetName &&
                target.passive && target.passive.name === 'Caballero de la Noche') {
                const _atkrBat = gameState.characters[attackerName];
                const _selAbBat = gameState.selectedAbility;
                if (_atkrBat && _atkrBat.team !== target.team && _selAbBat && _selAbBat.type === 'special') {
                    addLog('🦇 Caballero de la Noche: ' + targetName + ' es inmune al ataque especial de ' + attackerName, 'buff');
                    // Also give Batman +3 charges
                    target.charges = Math.min(20, (target.charges || 0) + 3);
                    addLog('🦇 Caballero de la Noche: ' + targetName + ' genera 3 cargas', 'buff');
                    return 0;
                }
            }

            // ── PRIVILEGIO IMPERIAL (Ozymandias): reduce 50% daño si atacante tiene QS ──
            if (!passiveExecuting && attackerName && attackerName !== targetName && damage > 0 &&
                target.passive && target.passive.name === 'Privilegio Imperial') {
                const _ozAtk = gameState.characters[attackerName];
                if (_ozAtk && (_ozAtk.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'quemadura solar')) {
                    damage = Math.max(1, Math.floor(damage * 0.5));
                    addLog('Privilegio Imperial: Ozymandias reduce dano al 50% (atacante tiene QS)', 'buff');
                }
            }

            // ── HOMBRE DE ACERO (Superman): reduce 50% daño por GOLPE (attackerName ≠ null) ──
            if (!passiveExecuting && attackerName && attackerName !== targetName && damage > 0 &&
                target.passive && target.passive.name === 'Hombre de Acero' && !target.supermanPrimeMode) {
                damage = Math.max(1, Math.floor(damage * 0.5));
                addLog('🦸 Hombre de Acero: ' + targetName + ' reduce daño a ' + damage + ' (-50%)', 'buff');
            }
            // Prime Mode: also -50%
            if (!passiveExecuting && attackerName && attackerName !== targetName && damage > 0 &&
                target.supermanPrimeMode) {
                damage = Math.max(1, Math.floor(damage * 0.5));
                addLog('🦸 Forma Prime: ' + targetName + ' reduce daño a ' + damage + ' (-50%)', 'buff');
            }

            // ── SAITAMA MODE (Garou): reduce -2 daño recibido ──
            if (target.garouSaitamaMode && damage > 0) {
                damage = Math.max(0, damage - 2);
                if (damage === 0) { addLog('💪 Saitama Mode: ' + targetName + ' bloquea el golpe (-2)', 'buff'); return 0; }
                addLog('💪 Saitama Mode: ' + targetName + ' reduce daño a ' + damage + ' (-2)', 'buff');
            }

            // CASTILLO INFINITO (Nakime): redirigir primer ataque ST de la ronda al equipo atacante
            if (attackerName !== null && attackerName !== targetName && !passiveExecuting) {
                const attacker = gameState.characters[attackerName];
                if (attacker && checkNakimeRedirect(attacker.team)) {
                    const attackerTeam = attacker.team;
                    const selfAttackTargets = Object.keys(gameState.characters).filter(n => {
                        const c = gameState.characters[n];
                        return c && c.team === attackerTeam && !c.isDead && c.hp > 0 && n !== attackerName;
                    });
                    if (selfAttackTargets.length > 0) {
                        const newTarget = selfAttackTargets[Math.floor(Math.random() * selfAttackTargets.length)];
                        const nakimeChar = Object.values(gameState.characters).find(c => c && c.passive && c.passive.name === 'Castillo Infinito');
                        if (nakimeChar) {
                            // Find Nakime's name
                            const nakimeName = Object.keys(gameState.characters).find(n => gameState.characters[n] === nakimeChar);
                            if (nakimeName) nakimeChar.nakimeRedirectUsed = true;
                        }
                        addLog(`🏯 Castillo Infinito: El ataque de ${attackerName} es redirigido a ${newTarget} (equipo enemigo)`, 'buff');
                        passiveExecuting = true;
                        const redirected = applyDamageWithShield(newTarget, damage, attackerName);
                        passiveExecuting = false;
                        return redirected;
                    }
                }
            }

            // CASTILLO INFINITO (Nakime): inmune a daño ST directo
            if (attackerName !== null && (targetName === 'Nakime' || targetName === 'Nakime v2') && !passiveExecuting) {
                // Check if this is a single-target ability (not AOE, not a debuff tick)
                if (gameState.selectedAbility && gameState.selectedAbility.target === 'single') {
                    addLog(`🏯 Castillo Infinito: Nakime es inmune al daño ST`, 'buff');
                    return 0;
                }
            }

            // VERIFICAR IRON PRIMERO - Iron absorbe TODO el daño, pero NUNCA se protege a sí mismo
            // ni protege cuando el daño proviene de efectos de estado (attackerName === null indica burn/regen)
            if (attackerName !== null) {
                const ironId = checkIronProtection(targetName);
                if (ironId) {
                    return redirectDamageToIron(ironId, damage, attackerName);
                }
            }
            
            // ESCUDO SAGRADO: bloquea daño de golpe (no efectos de estado)
            if (attackerName !== null && hasStatusEffect(targetName, 'Escudo Sagrado')) {
                addLog('✝️ Escudo Sagrado: ' + targetName + ' bloqueó el golpe de ' + attackerName, 'buff');
                return 0;
            }
            // PROTECCION SAGRADA: solo bloquea debuffs (gestionado en applyDebuff), NO bloquea daño

            // PASIVA JIKUUKAN KEKKAI: Minato esquiva el primer golpe por ronda
            if (attackerName !== null && checkMinatoDodge(targetName)) {
                return 0; // golpe esquivado
            }

            // SANGRADO STACKEABLE: +1 daño por cada stack activo
            if (attackerName !== null) {
                const sangradoStacks = (target.statusEffects || []).filter(e => e && normAccent(e.name || '') === 'sangrado').length;
                if (sangradoStacks > 0) {
                    damage += sangradoStacks;
                    addLog(`🩸 Sangrado x${sangradoStacks}: ${targetName} recibe +${sangradoStacks} daño`, 'damage');
                }
            }

            // DEBILITAR STACKEABLE: +50% daño por cada stack activo
            if (attackerName !== null) {
                const debilitarStacks = (target.statusEffects || []).filter(e => e && normAccent(e.name || '') === 'debilitar').length;
                if (debilitarStacks > 0) {
                    damage = Math.ceil(damage * (1 + 0.5 * debilitarStacks));
                    addLog(`💔 Debilitar x${debilitarStacks}: ${targetName} recibe +${50*debilitarStacks}% daño`, 'damage');
                }
            }

            // INMUNIDAD POR INVOCACIONES DE OZYMANDIAS
            // Ramesseum Tentyris activa: Ozymandias inmune a daño por golpes
            if (attackerName && attackerName !== targetName) {
                const _tgtC = gameState.characters[targetName];
                const _atkC = gameState.characters[attackerName];
                if (_tgtC && _atkC && _atkC.team !== _tgtC.team) {
                    const _hasRam = Object.values(gameState.summons).some(function(s) {
                        return s && s.name === 'Ramesseum Tentyris' && s.summoner === targetName && s.hp > 0;
                    });
                    if (_hasRam) {
                        addLog('🏛️ Ramesseum Tentyris: ' + targetName + ' es inmune al daño por golpes', 'buff');
                        return 0;
                    }
                }
            }

            // ULTRA EGO (Vegeta): 50% menos daño por golpe y se reduce a la mitad
            if (attackerName && attackerName !== targetName && !passiveExecuting) {
                const _ueC = gameState.characters[targetName];
                if (_ueC && !_ueC.isDead && _ueC.vegetaForm === 'ultra_ego') {
                    damage = Math.max(1, Math.ceil(damage * 0.50));
                    addLog('👁️ Ultra Ego: ' + targetName + ' recibe solo el 50% del daño por golpe', 'buff');
                }
            }
            // ULTRA EGO: inmune a daño directo
            if (!attackerName && !passiveExecuting) {
                const _ueDir = gameState.characters[targetName];
                if (_ueDir && !_ueDir.isDead && _ueDir.vegetaForm === 'ultra_ego') {
                    addLog('👁️ Ultra Ego: ' + targetName + ' es inmune a daño directo', 'buff');
                    return 0;
                }
            }

            // ARCHIMAGA DEL KIRIN TOR (Jaina): crítico garantizado sobre congelados
            if (attackerName && attackerName !== targetName && !passiveExecuting) {
                const _jainaAtkC = gameState.characters[attackerName];
                const _jainaTgtC = gameState.characters[targetName];
                if (_jainaAtkC && _jainaTgtC && _jainaAtkC.passive && _jainaAtkC.passive.name === 'Archimaga del Kirin Tor') {
                    const _isFrozen = (_jainaTgtC.statusEffects||[]).some(function(e){
                        if (!e) return false; const _nn = normAccent(e.name||'');
                        return _nn === 'congelacion' || _nn === 'mega congelacion';
                    });
                    if (_isFrozen) { damage *= 2; addLog('❄️ Archimaga del Kirin Tor: ¡Crítico! ' + targetName + ' está congelado', 'damage'); }
                }
            }

            // BUFF ESQUIVAR (Goku UI, Sauron, etc): 50% de esquivar
            if (attackerName !== null && !passiveExecuting) {
                if (target.hasDodge || hasStatusEffect(targetName, 'Esquivar')) {
                    if (Math.random() < 0.50) {
                        addLog('💨 ' + targetName + ' esquiva el ataque de ' + attackerName + '!', 'buff');
                        // Activar pasivas de esquiva (ej: Flash +2 cargas)
                        if (typeof triggerDodgePassives === 'function') triggerDodgePassives(targetName);
                        // MODO KYUBI (Naruto): al esquivar, gana prioridad de turno
                        if (target.narutoForm === 'kyubi') {
                            if (!gameState._kyubiPriorityQueue) gameState._kyubiPriorityQueue = [];
                            gameState._kyubiPriorityQueue.push(targetName);
                            addLog('🦊 Modo Kyubi: ' + targetName + ' esquiva y gana prioridad de turno', 'buff');
                        }
                        // Si es Goku con Ultra Instinto, contraataca
                        if ((targetName === 'Goku' || targetName === 'Goku v2') && target.ultraInstinto) {
                            triggerCounterattack(targetName, attackerName);
                        }
                        return 0;
                    }
                }
            }

            // SUPERACION DE LIMITES (Goku SSBlue): contraataca con 3 básicos al recibir golpe
            if (attackerName && attackerName !== targetName && !passiveExecuting) {
                const _gokuSSB = gameState.characters[targetName];
                const _atkrSSB = gameState.characters[attackerName];
                if (_gokuSSB && !_gokuSSB.isDead && _gokuSSB.hp > 0 &&
                    _gokuSSB.gokuForm === 'ssblue' && _atkrSSB && _atkrSSB.team !== _gokuSSB.team) {
                    passiveExecuting = true;
                    const _gokuBasic = (_gokuSSB.abilities && _gokuSSB.abilities[0]) ? _gokuSSB.abilities[0] : null;
                    const _gokuBDmg = _gokuBasic ? (_gokuBasic.damage || 3) : 3;
                    addLog('🔵 SS Blue: ' + targetName + ' contraataca con 3 ataques básicos a ' + attackerName, 'buff');
                    for (let _ci = 0; _ci < 3; _ci++) {
                        if (!_atkrSSB || _atkrSSB.isDead || _atkrSSB.hp <= 0) break;
                        applyDamageWithShield(attackerName, _gokuBDmg, targetName);
                        addLog('🔵 SS Blue contraataque ' + (_ci+1) + ': ' + _gokuBDmg + ' daño a ' + attackerName, 'damage');
                        // SS1 bonus cargas por golpe
                        if (_gokuSSB.gokuForm === 'ss1') _gokuSSB.charges = Math.min(20, (_gokuSSB.charges||0)+3);
                    }
                    passiveExecuting = false;
                }
            }

            // VENGANZA ETERNA (Sasuke): esquiva primer Special/OVER por ronda y contraataca con 5 daño
            if (attackerName && attackerName !== targetName && !passiveExecuting) {
                const _sasukeC = gameState.characters[targetName];
                const _sasukeAtk = gameState.characters[attackerName];
                if (_sasukeC && !_sasukeC.isDead && _sasukeC.hp > 0 &&
                    _sasukeC.passive && _sasukeC.passive.name === 'Venganza Eterna' &&
                    !_sasukeC.sasukeEvasionUsedThisRound && _sasukeAtk &&
                    gameState.selectedAbility && (gameState.selectedAbility.type === 'special' || gameState.selectedAbility.type === 'over')) {
                    _sasukeC.sasukeEvasionUsedThisRound = true;
                    passiveExecuting = true;
                    _sasukeAtk.hp = Math.max(0, (_sasukeAtk.hp||0) - 5);
                    if (_sasukeAtk.hp <= 0) _sasukeAtk.isDead = true;
                    passiveExecuting = false;
                    addLog('⚡ Venganza Eterna: ' + targetName + ' esquiva el ' + gameState.selectedAbility.type + ' de ' + attackerName + ' y responde con 5 daño', 'buff');
                    return 0;
                }
            }

            // PRESENCIA OSCURA (Darth Vader): 20% de esquivar ataques especiales/over
            if (attackerName !== null && !passiveExecuting && (targetName === 'Darth Vader' || targetName === 'Darth Vader v2')) {
                const atkAbility = gameState.selectedAbility;
                if (atkAbility && (atkAbility.type === 'special' || atkAbility.type === 'over')) {
                    if (Math.random() < 0.20) {
                        addLog(`🌑 Presencia Oscura: Darth Vader esquiva el ataque especial de ${attackerName}`, 'buff');
                        return 0;
                    }
                }
            }

            // PASIVA LIMBO: Madara en Modo Rikudō recibe 50% menos de daño
            if ((targetName === 'Madara Uchiha' || targetName === 'Madara Uchiha v2') && target.rikudoMode) {
                const reduced = Math.ceil(damage / 2);
                addLog(`🌀 Limbo: Madara absorbe ${damage - reduced} de daño (50% reducción)`, 'buff');
                damage = reduced;
            }

            // PASIVA CUERPO DIVINO: Goku Black roba 1 carga al atacante con 50%
            if ((targetName === 'Goku Black' || targetName === 'Goku Black v2') && attackerName && attackerName !== null && !passiveExecuting) {
                if (Math.random() < 0.5) {
                    passiveExecuting = true;
                    stealCharges('Goku Black', attackerName, 1);
                    passiveExecuting = false;
                }
            }

            // PASIVA DOOMSDAY (Adaptación Reactiva): recupera 2 HP cada vez que recibe un golpe
            // Solo se activa si el daño no lo mata (lo baja a <= 0)
            if (attackerName && attackerName !== null && !passiveExecuting && damage > 0) {
                const tgtCharDoom = gameState.characters[targetName];
                if (tgtCharDoom && tgtCharDoom.hp > 0 && !tgtCharDoom.isDead &&
                    tgtCharDoom.passive && normAccent(tgtCharDoom.passive.name || '') === 'adaptacion reactiva') {
                    // Heal AFTER damage (will be applied once remainingDamage is processed)
                    // Schedule post-damage heal with a small flag
                    tgtCharDoom._doomsdayHealPending = true;
                }
            }

            // REPRESALIA DE LLAMA (fire_retaliation / fire_retaliation_fuego / fire_charge_regen)
            if (attackerName && attackerName !== null && !passiveExecuting) {
                if (target.shieldEffect === 'fire_retaliation' || target.shieldEffect === 'fire_retaliation_fuego' || target.shieldEffect === 'fire_charge_regen') {
                    passiveExecuting = true;
                    applyFlatBurn(attackerName, 2, 2); // 2 = dura hasta fin del siguiente turno del atacante
                    addLog(`🔥 Represalia de Llama: ${attackerName} recibe Quemadura 10%`, 'damage');
                    passiveExecuting = false;
                }
            }
            
            let remainingDamage = damage;
            
            // DOT damage (burns, poison, solar burn) bypasses shields — goes directly to HP
            // attackerName === null means this is DOT/status effect damage
            if (target.shield > 0 && attackerName !== null) {
                // Activar efecto especial del escudo si existe (como Golden Shield)
                if (target.shieldEffect === 'golden_shield') {
                    target.charges += 1;
                    addLog(`⚡ Golden Shield: ${targetName} genera 1 carga al ser atacado`, 'buff');
                }
                
                if (target.shield >= damage) {
                    // Escudo absorbe todo el daño
                    const shieldBefore = target.shield;
                    target.shield -= damage;
                    addLog(`🛡️ El escudo de ${targetName} absorbe ${damage} de daño (Escudo restante: ${target.shield})`, 'buff');
                    

                    // fire_charge_regen (Llama Preservadora): genera 1 carga a Alexstrasza por punto absorbido (escudo debe seguir activo)
                    if (target.shieldEffect === 'fire_charge_regen' && target.shield > 0 && !passiveExecuting) {
                        const alexChar = gameState.characters['Alexstrasza'];
                        if (alexChar && !alexChar.isDead && alexChar.hp > 0) {
                            alexChar.charges = Math.min(20, (alexChar.charges || 0) + damage);
                            addLog(`🔥 Llama Preservadora: Alexstrasza genera ${damage} carga${damage > 1 ? 's' : ''} por daño absorbido por escudo`, 'buff');
                        }
                    }

                    // Si el escudo se agota completamente, eliminar el efecto
                    if (target.shield === 0) {
                        target.shieldEffect = null;
                    }
                    
                    return 0;
                } else {
                    // Escudo se rompe y pasa daño residual
                    const shieldHP = target.shield;
                    remainingDamage = damage - target.shield;
                    addLog(`🛡️ El escudo de ${targetName} se rompe absorbiendo ${shieldHP} de daño`, 'damage');

                    // HIJO DE ODIN (Ragnar): escudo se rompe → NO genera cargas (escudo no sigue activo)
                    // fire_charge_regen: escudo se rompe → NO genera cargas (escudo no sigue activo)

                    target.shield = 0;
                    target.shieldEffect = null;
                    // GANDALF PASSIVE: Istari - ally shield breaks → +3 charges to that ally
                    const gandalfChar = gameState.characters['Gandalf'];
                    if (gandalfChar && !gandalfChar.isDead && gandalfChar.hp > 0 && gandalfChar.team === target.team) {
                        target.charges = Math.min(20, (target.charges||0) + 3);
                        addLog(`✨ Istari (Gandalf): ${targetName} gana 3 cargas por escudo roto`, 'buff');
                    }
                    // FORTALEZA DE TAURO (Aldebaran): escudo roto → genera 2 cargas
                    if (target.passive && target.passive.name === 'Fortaleza de Tauro') {
                        target.charges = Math.min(20, (target.charges || 0) + 2);
                        addLog('🐂 Fortaleza de Tauro: ' + targetName + ' genera 2 cargas (escudo roto)', 'buff');
                    }
                }
            }
            
            // Sanitize HP values to prevent NaN
            if (isNaN(target.hp)) target.hp = 0;
            if (isNaN(remainingDamage)) remainingDamage = 0;
            const oldHp = target.hp;
            target.hp = Math.max(0, target.hp - remainingDamage);
            // DOOMSDAY Adaptación Reactiva: recover 2HP after taking damage (if still alive)
            if (target._doomsdayHealPending) {
                target._doomsdayHealPending = false;
                if (target.hp > 0 && !target.isDead) {
                    target.hp = Math.min(target.maxHp, target.hp + 2);
                    addLog('💪 Adaptación Reactiva: ' + targetName + ' recupera 2 HP tras recibir el golpe', 'heal');
                }
            }

            // HIJO DE ODIN (Ragnar): genera 1 carga por cada HP perdido (cualquier fuente)
            if (remainingDamage > 0 && !passiveExecuting) {
                const ragnarCheck = gameState.characters[targetName];
                if (ragnarCheck && ragnarCheck.passive && ragnarCheck.passive.name === 'Hijo de Odin') {
                    const hpLost = oldHp - ragnarCheck.hp;
                    if (hpLost > 0) {
                        passiveExecuting = true;
                        ragnarCheck.charges = Math.min(20, (ragnarCheck.charges || 0) + hpLost);
                        addLog('⚔️ Hijo de Odin: Ragnar genera ' + hpLost + ' carga' + (hpLost > 1 ? 's' : '') + ' (daño recibido)', 'buff');
                        passiveExecuting = false;
                    }
                }
            }

            // SIGILO: se pierde al recibir cualquier daño
            if (remainingDamage > 0 && target.statusEffects) {
                const sigiloIdx = target.statusEffects.findIndex(e => e && normAccent(e.name || '') === 'sigilo');
                if (sigiloIdx !== -1) {
                    target.statusEffects.splice(sigiloIdx, 1);
                    addLog(`👤 Sigilo de ${targetName} se pierde al recibir daño`, 'damage');
                }
            }
            
            // MONARCA DE LA DESTRUCCION: +2 cargas cuando enemigo recibe daño directo (por efectos)
            if (!passiveExecuting && attackerName === null && remainingDamage > 0) {
                const _mdTgtDir = gameState.characters[targetName];
                if (_mdTgtDir) {
                    const _mdAntTeam2 = _mdTgtDir.team === 'team1' ? 'team2' : 'team1';
                    for (const _mn2 in gameState.characters) {
                        const _mc2 = gameState.characters[_mn2];
                        if (!_mc2 || _mc2.isDead || _mc2.hp <= 0 || _mc2.team !== _mdAntTeam2) continue;
                        if (!_mc2.passive || _mc2.passive.name !== 'Monarca de la Destruccion') continue;
                        _mc2.charges = Math.min(20, (_mc2.charges||0) + 2);
                        addLog('🔥 Monarca de la Destruccion: ' + _mn2 + ' gana 2 cargas (daño directo a ' + targetName + ')', 'buff');
                        break;
                    }
                }
            }

            // Verificar si fue derrotado
            if (target.hp <= 0 && oldHp > 0) {
                target.isDead = true;
                // Immediate game-over check after every kill
                if (typeof checkGameOver === 'function') checkGameOver();
                
                if (attackerName) {
                    addLog(`💀 ${targetName} fue derrotado por ${attackerName}`, 'damage');
                } else {
                    addLog(`💀 ${targetName} fue derrotado`, 'damage');
                }
                // VENGANZA ETERNA (Sasuke): +20 cargas + turno adicional cuando aliado cae
                if (!passiveExecuting) {
                    for (const _sn in gameState.characters) {
                        const _sc = gameState.characters[_sn];
                        if (!_sc || _sc.isDead || _sc.hp <= 0 || _sc.team !== target.team || _sn === targetName) continue;
                        if (!_sc.passive || _sc.passive.name !== 'Venganza Eterna') continue;
                        _sc.charges = Math.min(20, (_sc.charges||0) + 20);
                        addLog('⚡ Venganza Eterna: ' + _sn + ' gana 20 cargas (' + targetName + ' cayó)', 'buff');
                        if (!gameState._sasukeRevengeQueue) gameState._sasukeRevengeQueue = [];
                        gameState._sasukeRevengeQueue.push(_sn);
                        break;
                    }
                }

                // PASIVA CORAZÓN ARDIENTE (Rengoku): al morir aturde a todos los enemigos
                if ((targetName === 'Rengoku' || targetName === 'Rengoku v2') && !passiveExecuting) {
                    passiveExecuting = true;
                    const enemyTeam = target.team === 'team1' ? 'team2' : 'team1';
                    addLog(`🔥 Corazón Ardiente: ¡Rengoku aturde a todos los enemigos al morir!`, 'damage');
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c.team === enemyTeam && !c.isDead && c.hp > 0) applyStun(n, 1);
                    }
                    passiveExecuting = false;
                }

                // PASIVA IKKI: registrar ronda de muerte
                if ((targetName === 'Ikki de Fenix' || targetName === 'Ikki de Fenix v2')) {
                    target.deathRound = gameState.currentRound;
                    target.fenixRevived = false;
                }

                // PASIVA PILAR DEL INSECTO (Shinobu Kocho): al morir aplica Veneno 10T al equipo enemigo
                if ((targetName === 'Shinobu Kocho' || targetName === 'Shinobu Kocho v2') && !passiveExecuting) {
                    passiveExecuting = true;
                    const _shinEnemyTeam = target.team === 'team1' ? 'team2' : 'team1';
                    for (const _sn in gameState.characters) {
                        const _sc = gameState.characters[_sn];
                        if (!_sc || _sc.isDead || _sc.hp <= 0 || _sc.team !== _shinEnemyTeam) continue;
                        applyPoison(_sn, 10);
                        addLog('🦋 Pilar del Insecto: ' + _sn + ' recibe Veneno 10T al morir Shinobu', 'debuff');
                    }
                    passiveExecuting = false;
                }
            }

            // PASIVA DONCELLA ESCUDERA (Lagertha): cuando un enemigo con Sangrado recibe golpe, Lagertha gana Escudo 1 HP
            if (remainingDamage > 0 && attackerName && !passiveExecuting) {
                const _ldTarget = gameState.characters[targetName];
                if (_ldTarget && !_ldTarget.isDead) {
                    const _ldHasBleeding = (_ldTarget.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'sangrado');
                    if (_ldHasBleeding) {
                        // Buscar Lagertha en el equipo atacante
                        const _ldAttacker = gameState.characters[attackerName];
                        if (_ldAttacker) {
                            for (const _lgn in gameState.characters) {
                                const _lgc = gameState.characters[_lgn];
                                if (!_lgc || _lgc.isDead || _lgc.hp <= 0) continue;
                                if (_lgc.team !== _ldAttacker.team) continue;
                                if (!_lgc.passive || _lgc.passive.name !== 'Doncella Escudera') continue;
                                _lgc.shield = (_lgc.shield || 0) + 1;
                                addLog('🛡️ Doncella Escudera: Lagertha gana +1 Escudo (enemigo con Sangrado golpeado)', 'buff');
                                break;
                            }
                        }
                    }
                }
            }

            // PASIVA CUERPO DIVINO (Goku Black): genera 2 cargas al recibir dano
            if (remainingDamage > 0 && !passiveExecuting) {
                const _gbChar = gameState.characters[targetName];
                if (_gbChar && !_gbChar.isDead && _gbChar.passive && _gbChar.passive.name === 'Cuerpo Divino') {
                    _gbChar.charges = Math.min(20, (_gbChar.charges||0) + 2);
                    addLog('Cuerpo Divino: Goku Black genera 2 cargas al recibir dano', 'buff');
                }
            }

            // PASIVA ADAPTACION REACTIVA (Doomsday): recupera 2 HP al recibir golpe
            if (remainingDamage > 0 && attackerName && !passiveExecuting) {
                const _ddChar = gameState.characters[targetName];
                if (_ddChar && !_ddChar.isDead && _ddChar.passive && _ddChar.passive.name === 'Adaptación Reactiva') {
                    if (typeof canHeal !== 'function' || canHeal(targetName)) {
                        passiveExecuting = true;
                        const _ddOld = _ddChar.hp;
                        _ddChar.hp = Math.min(_ddChar.maxHp, (_ddChar.hp||0) + 2);
                        const _ddHealed = _ddChar.hp - _ddOld;
                        if (_ddHealed > 0) {
                            addLog('Adaptacion Reactiva: Doomsday recupera ' + _ddHealed + ' HP', 'heal');
                            const _ddAtkObj = gameState.characters[attackerName];
                            if (_ddAtkObj) {
                                const _ddEnms = Object.keys(gameState.characters).filter(n => {
                                    const c = gameState.characters[n];
                                    return c && c.team === _ddAtkObj.team && !c.isDead && c.hp > 0 && (c.charges||0) > 0;
                                });
                                if (_ddEnms.length > 0) {
                                    const _ddR = _ddEnms[Math.floor(Math.random() * _ddEnms.length)];
                                    gameState.characters[_ddR].charges = Math.max(0, (gameState.characters[_ddR].charges||0) - 1);
                                    addLog('Adaptacion Reactiva: ' + _ddR + ' pierde 1 carga', 'debuff');
                                }
                            }
                        }
                        passiveExecuting = false;
                    }
                }
            }


            // MODO SABIO (Naruto): cargas = daño recibido
            if (remainingDamage > 0 && !passiveExecuting) {
                const _naruSabio = gameState.characters[targetName];
                if (_naruSabio && !_naruSabio.isDead && _naruSabio.narutoForm === 'sabio') {
                    _naruSabio.charges = Math.min(20, (_naruSabio.charges||0) + remainingDamage);
                    addLog('🐸 Modo Sabio: ' + targetName + ' gana ' + remainingDamage + ' cargas (daño recibido)', 'buff');
                }
            }
            // CADENAS DE HIELO (Lich King): +1 carga al recibir daño con Provocacion activa
            if (remainingDamage > 0 && !passiveExecuting) {
                const _lichTgt = gameState.characters[targetName];
                if (_lichTgt && !_lichTgt.isDead && _lichTgt.lichKingCadenasActive &&
                    (_lichTgt.statusEffects||[]).some(function(e) {
                        if (!e) return false;
                        var _nn = normAccent(e.name||'');
                        return _nn === 'provocacion' || _nn === 'mega provocacion';
                    })) {
                    _lichTgt.charges = Math.min(20, (_lichTgt.charges||0) + 1);
                    addLog('Cadenas de Hielo: Lich King gana 1 carga (recibio danio con Provocacion)', 'buff');
                }
            }
            // MUZAN muzanVenomOnHit: sus ataques activan el tick de veneno del objetivo
            if (remainingDamage > 0 && attackerName && !passiveExecuting) {
                const _mzAtk = gameState.characters[attackerName];
                if (_mzAtk && _mzAtk.muzanVenomOnHit && !_mzAtk.isDead) {
                    const _mzTgt = gameState.characters[targetName];
                    if (_mzTgt && !_mzTgt.isDead && _mzTgt.hp > 0) {
                        const _mzPoison = (_mzTgt.statusEffects||[]).find(e => e && normAccent(e.name||'') === 'veneno');
                        if (_mzPoison && _mzPoison.poisonTick > 0) {
                            passiveExecuting = true;
                            applyDamageWithShield(targetName, _mzPoison.poisonTick, null);
                            addLog('🩸 Muzan (Progenitor Demoniaco): ataque activa tick de veneno (' + _mzPoison.poisonTick + ' daño) en ' + targetName, 'damage');
                            passiveExecuting = false;
                        }
                    }
                }
            }

            // Track last attacker for abilities like Corazón en Llamas
            if (attackerName && remainingDamage > 0) {
                if (!gameState._lastAttacker) gameState._lastAttacker = {};
                gameState._lastAttacker[targetName] = attackerName;
            }

            // PASIVA TESORO DEL CIELO (Shaka de Virgo): SOLO cuando SHAKA recibe daño, cura 1 HP a todos los aliados
            if (remainingDamage > 0 && !passiveExecuting) {
                const _stkDmgTarget = gameState.characters[targetName];
                // Verificar que el objetivo ES Shaka (tiene la pasiva Tesoro del Cielo)
                if (_stkDmgTarget && !_stkDmgTarget.isDead &&
                    _stkDmgTarget.passive && _stkDmgTarget.passive.name === 'Tesoro del Cielo') {
                    // Shaka recibió daño — curar 1 HP a todos sus aliados
                    passiveExecuting = true;
                    const _stkTeam = _stkDmgTarget.team;
                    // Encontrar nombre de Shaka para el trigger del sub-pasiva
                    const _stkName = targetName;
                    { // bloque de curación
                        for (const _stkAllyName in gameState.characters) {
                            const _stkAlly = gameState.characters[_stkAllyName];
                            if (!_stkAlly || _stkAlly.isDead || _stkAlly.hp <= 0 || _stkAlly.team !== _stkTeam) continue;
                            if (typeof canHeal === 'function' && !canHeal(_stkAllyName)) { addLog('Tesoro del Cielo: QS bloquea curacion de ' + _stkAllyName, 'debuff'); continue; }
                            const _stkHpBefore = _stkAlly.hp;
                            _stkAlly.hp = Math.min(_stkAlly.maxHp, _stkAlly.hp + 1);
                            if (_stkAlly.hp > _stkHpBefore) {
                                addLog('✨ Tesoro del Cielo: ' + _stkAllyName + ' recupera 1 HP', 'heal');
                                if (_stkAllyName === _stkName) {
                                    if (typeof triggerShakaHealDebuff === 'function') triggerShakaHealDebuff(_stkName);
                                }
                            }
                        }
                        passiveExecuting = false;
                    } // fin bloque curación
                }
            }

            // Disparar pasivas post-golpe si el objetivo sigue vivo
            if (target.hp > 0 && !target.isDead && attackerName) {
                // VISIÓN ESMERALDA (Linterna Verde): genera 2 cargas al recibir un golpe
                if (!passiveExecuting && target.passive && target.passive.name === 'Visión Esmeralda') {
                    target.charges = Math.min(20, (target.charges || 0) + 2);
                    addLog('💚 Visión Esmeralda: ' + targetName + ' genera 2 cargas al recibir golpe', 'buff');
                }
                triggerOnHitPassives(targetName, attackerName, null);
                // AURA DE HIELO (Lich King): congela al atacante
                triggerLichKingAura(targetName, attackerName);
                // CADENAS DE HIELO (Lich King): genera 1 carga cuando recibe daño con Provocación
                if (targetName === 'Lich King' || targetName === 'Lich King v2') {
                    const lichChar = gameState.characters[targetName];
                    if (lichChar && !lichChar.isDead && lichChar.hp > 0 &&
                        (hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'Provocacion'))) {
                        lichChar.charges = Math.min(20, (lichChar.charges || 0) + 1);
                        addLog('🔗 Cadenas de Hielo: ' + targetName + ' genera 1 carga al recibir daño con Provocación', 'buff');
                    }
                }
                // PRIVILEGIO IMPERIAL (Ozymandias): aplica QS al atacante
                triggerOzyPassive(targetName, attackerName);
                // CONTRAATAQUE (Darth Vader, Goku UI, cualquier personaje con buff)
                if (!passiveExecuting) triggerCounterattack(targetName, attackerName);
                // BUFF REFLEJAR: cuando el portador recibe un ataque, el atacante recibe el mismo daño
                if (!passiveExecuting && hasStatusEffect(targetName, 'Reflejar') && attackerName && damage > 0) {
                    passiveExecuting = true;
                    const reflectDmg = damage;
                    applyDamageWithShield(attackerName, reflectDmg, targetName);
                    addLog('🪞 Reflejar: ' + attackerName + ' recibe ' + reflectDmg + ' de daño reflejado', 'damage');
                    passiveExecuting = false;
                }
                // AURA DE FUEGO: atacante recibe Quemadura 2HP (independiente de passiveExecuting)
                if (attackerName && (hasStatusEffect(targetName, 'Aura de fuego') || hasStatusEffect(targetName, 'Aura de Fuego'))) {
                    const _prevPE = passiveExecuting;
                    passiveExecuting = true;
                    applyFlatBurn(attackerName, 2, 1);
                    addLog('🔥 Aura de Fuego: ' + attackerName + ' recibe Quemadura 2HP por atacar a ' + targetName, 'debuff');
                    passiveExecuting = _prevPE;
                }
                // AURA GELIDA: atacante recibe Congelación 1T
                if (!passiveExecuting && hasStatusEffect(targetName, 'Aura gelida') && attackerName) {
                    passiveExecuting = true;
                    applyFreeze(attackerName, 1);
                    addLog('❄️ Aura Gélida: ' + attackerName + ' es Congelado al atacar', 'debuff');
                    passiveExecuting = false;
                }
                // AURA OSCURA: atacante pierde 1 carga, 30% pierde 2 adicionales
                if (!passiveExecuting && hasStatusEffect(targetName, 'Aura oscura') && attackerName) {
                    passiveExecuting = true;
                    const atkrAura = gameState.characters[attackerName];
                    if (atkrAura) {
                        atkrAura.charges = Math.max(0, (atkrAura.charges || 0) - 1);
                        if (Math.random() < 0.30) {
                            atkrAura.charges = Math.max(0, atkrAura.charges - 2);
                            addLog('🌑 Aura Oscura: ' + attackerName + ' pierde 3 cargas', 'debuff');
                        } else {
                            addLog('🌑 Aura Oscura: ' + attackerName + ' pierde 1 carga', 'debuff');
                        }
                    }
                    passiveExecuting = false;
                }
                // BUFF INFECTAR: cuando el portador recibe un golpe, aplica Veneno 2T al atacante
                if (!passiveExecuting && hasStatusEffect(targetName, 'Infectar') && attackerName) {
                    passiveExecuting = true;
                    applyDebuff(attackerName, { name: 'Veneno', type: 'debuff', duration: 2, emoji: '☠️', poisonPercent: 10 });
                    addLog('🦠 Infectar: ' + attackerName + ' recibe Veneno 2T por atacar a ' + targetName, 'debuff');
                    passiveExecuting = false;
                }
                // BUFF ESPINAS: al recibir un golpe, causa 1 daño al atacante (+1 si atacante tiene Sangrado)
                if (!passiveExecuting && hasStatusEffect(targetName, 'Espinas')) {
                    passiveExecuting = true;
                    let espinasDmg = 1;
                    if (attackerName && hasStatusEffect(attackerName, 'Sangrado')) {
                        espinasDmg = 2;
                        addLog('🌵🩸 Espinas: ' + targetName + ' contraataca con 2 de daño a ' + attackerName + ' (Sangrado activo)', 'damage');
                    } else {
                        addLog('🌵 Espinas: ' + targetName + ' contraataca con 1 de daño a ' + attackerName, 'damage');
                    }
                    const attackerChar = gameState.characters[attackerName];
                    if (attackerChar && !attackerChar.isDead && attackerChar.hp > 0) {
                        attackerChar.hp = Math.max(0, attackerChar.hp - espinasDmg);
                        if (attackerChar.hp <= 0) attackerChar.isDead = true;
                        // SANGRE DE YMIR pasiva: 30% Megacongelación, 50% Sangrado al atacante
                        triggerSangreDeYmir(attackerName, targetName);
                    }
                    passiveExecuting = false;
                }
            }
            
            return remainingDamage;
        }

        function applyShield(targetName, shieldAmount, specialEffect = null) {
            const target = gameState.characters[targetName];
            if (!target) return;
            // Escudos son ACUMULABLES — se suma al escudo existente
            const prevShield = target.shield || 0;
            target.shield = prevShield + shieldAmount;
            if (specialEffect) target.shieldEffect = specialEffect;
            addLog('🛡️ ' + targetName + ' recibe Escudo +' + shieldAmount + ' HP (total: ' + target.shield + ' HP)', 'buff');
        }

        
        // Helper: El Rey Prometido (Jon Snow) — activar cuando enemigo usa AOE
        function triggerElReyPrometido(attackerName) {
            if (!attackerName) return;
            const _attC = gameState.characters[attackerName];
            if (!_attC) return;
            const _defTeam = _attC.team === 'team1' ? 'team2' : 'team1';
            // Buscar Jon Snow en el equipo defensor
            for (const _jsN in gameState.characters) {
                const _jsC = gameState.characters[_jsN];
                if (!_jsC || _jsC.isDead || _jsC.hp <= 0 || _jsC.team !== _defTeam) continue;
                if (!_jsC.passive || _jsC.passive.name !== 'El Rey Prometido') continue;
                // Aplicar Esquiva Area 2T a todo el equipo aliado
                for (const _an in gameState.characters) {
                    const _ac = gameState.characters[_an];
                    if (!_ac || _ac.isDead || _ac.hp <= 0 || _ac.team !== _defTeam) continue;
                    _ac.statusEffects = (_ac.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'esquiva area'; });
                    // Usar applyBuff para activar Monarca de la Destruccion
                    if (typeof applyBuff === 'function') {
                        applyBuff(_an, { name: 'Esquiva Area', type: 'buff', duration: 2, emoji: '🛡️' });
                    } else {
                        _ac.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 2, emoji: '🛡️' });
                    }
                    _ac.charges = Math.min(20, (_ac.charges||0) + 1);
                }
                addLog('⚔️ El Rey Prometido: equipo aliado gana Esquiva Área 2T + 1 carga (AOE enemigo)', 'buff');
                break;
            }
        }

        // Helper: activar Presencia Oscura (Darth Vader) cuando un personaje del equipo ENEMIGO recupera HP
        function triggerPresenciaOscura(healedCharName) {
            if (!healedCharName) return;
            const healedChar = gameState.characters[healedCharName];
            if (!healedChar) return;
            const _dvEnemyTeam = healedChar.team === 'team1' ? 'team2' : 'team1';
            for (const _dvn in gameState.characters) {
                const _dvc = gameState.characters[_dvn];
                if (!_dvc || _dvc.isDead || _dvc.hp <= 0 || _dvc.team !== _dvEnemyTeam) continue;
                if (!_dvc.passive || _dvc.passive.name !== 'Presencia Oscura') continue;
                _dvc.charges = Math.min(20, (_dvc.charges || 0) + 1);
                addLog('🌑 Presencia Oscura: ' + _dvn + ' gana 1 carga (' + healedCharName + ' recuperó HP)', 'buff');
                break;
            }
        }

        // MONARCA DE LA DESTRUCCION: 3 daño directo por cada Buff aplicado a un enemigo
        function triggerMonarcaDestruccion(buffTargetName) {
            const _btC = gameState.characters[buffTargetName];
            if (!_btC || _btC.isDead || _btC.hp <= 0) return;
            const _antTeam = _btC.team === 'team1' ? 'team2' : 'team1';
            for (const _an in gameState.characters) {
                const _ac = gameState.characters[_an];
                if (!_ac || _ac.isDead || _ac.hp <= 0 || _ac.team !== _antTeam) continue;
                if (!_ac.passive || _ac.passive.name !== 'Monarca de la Destruccion') continue;
                // 3 daño directo al objetivo
                const _btOldHp = _btC.hp;
                _btC.hp = Math.max(0, (_btC.hp||0) - 3);
                if (_btC.hp <= 0) _btC.isDead = true;
                addLog('🔥 Monarca de la Destruccion: 3 daño directo a ' + buffTargetName + ' (Buff aplicado sobre enemigo)', 'damage');
                // Generar 2 cargas por el daño directo causado
                if (_btOldHp > _btC.hp) {
                    _ac.charges = Math.min(20, (_ac.charges||0) + 2);
                    addLog('🔥 Monarca de la Destruccion: ' + _an + ' gana 2 cargas (daño directo)', 'buff');
                }
                break;
            }
        }

        // VEGETA — Príncipe de los Sayajins: eliminar buffs del enemigo antes del daño
        function triggerVegetaPasiva(targetName, vegetaName) {
            const _vtgt = gameState.characters[targetName];
            const _vatk = gameState.characters[vegetaName];
            if (!_vtgt || !_vatk) return;
            const buffs = (_vtgt.statusEffects||[]).filter(function(e){ return e && e.type === 'buff' && !e.permanent; });
            if (buffs.length === 0) return;
            // Eliminar buffs no permanentes
            _vtgt.statusEffects = (_vtgt.statusEffects||[]).filter(function(e){ return !e || e.type !== 'buff' || e.permanent; });
            // +2 cargas por cada buff eliminado
            const gained = buffs.length * 2;
            _vatk.charges = Math.min(20, (_vatk.charges||0) + gained);
            addLog('⚡ Príncipe de los Sayajins: ' + buffs.length + ' buff(s) eliminados de ' + targetName + ' → Vegeta +' + gained + ' cargas', 'buff');
        }

        // LUNA SUPERIOR DOS (Douma): trigger al aplicar Congelacion/Megacongelacion
        function triggerLunaSuperiorDos(targetName, isMega) {
            if (!targetName) return;
            const _tgt = gameState.characters[targetName];
            if (!_tgt) return;
            // Buscar Douma en el mismo equipo del atacante (equipo contrario al objetivo)
            const _doumaTeam = _tgt.team === 'team1' ? 'team2' : 'team1';
            for (const _dn in gameState.characters) {
                const _dc = gameState.characters[_dn];
                if (!_dc || _dc.isDead || _dc.hp <= 0 || _dc.team !== _doumaTeam) continue;
                if (!_dc.passive || _dc.passive.name !== 'Luna Superior Dos') continue;
                // Curar aliado aleatorio
                const healAmt = isMega ? 4 : 2;
                const _allies = Object.keys(gameState.characters).filter(function(n){
                    const c = gameState.characters[n]; return c && c.team === _doumaTeam && !c.isDead && c.hp > 0 && c.hp < c.maxHp;
                });
                if (_allies.length > 0) {
                    const _healed = _allies[Math.floor(Math.random() * _allies.length)];
                    if (typeof healCharacter === 'function') healCharacter(_healed, healAmt);
                    else gameState.characters[_healed].hp = Math.min(gameState.characters[_healed].maxHp, gameState.characters[_healed].hp + healAmt);
                    addLog('❄️ Luna Superior Dos: ' + _healed + ' recupera ' + healAmt + ' HP (' + (isMega ? 'Megacongelacion' : 'Congelacion') + ' aplicada)', 'heal');
                }
                break;
            }
        }

        function healCharacter(charName, amount) {
            const c = gameState.characters[charName];
            if (!c || c.isDead) return 0;
            // AURA DE LUZ: doubles HP recovery
            let finalHeal = amount;
            if (hasStatusEffect(charName, 'Aura de Luz')) {
                finalHeal = amount * 2;
                addLog('✨ Aura de Luz: curación de ' + charName + ' duplicada (' + amount + '→' + finalHeal + ' HP)', 'heal');
            }
            // QUEMADURA SOLAR: no puede recuperar HP
            if (hasStatusEffect(charName, 'Quemadura Solar')) {
                addLog('☀️ Quemadura Solar: ' + charName + ' no puede recuperar HP', 'debuff');
                return 0;
            }
            const before = c.hp;
            c.hp = Math.min(c.maxHp, c.hp + finalHeal);
            const _hcActual = c.hp - before;
            if (_hcActual > 0) {
                triggerBendicionSagrada(c.team, _hcActual);
                // PRESENCIA OSCURA (Darth Vader): +1 carga cuando un enemigo recupera HP
                triggerPresenciaOscura(charName);
            }
            return _hcActual;
        }
function applyRegeneration(targetName, amount, duration) {
            const target = gameState.characters[targetName];
            if (!target.statusEffects) {
                target.statusEffects = [];
            }
            
            target.statusEffects.push({
                name: 'Regeneracion',
                type: 'buff',
                amount: amount,
                duration: duration
            });
            
            addLog(`💖 ${targetName} recibe Regeneración de ${amount} HP por ${duration} ronda${duration > 1 ? 's' : ''}`, 'buff');
        }

        function reviveAlly(targetName) {
            const target = gameState.characters[targetName];
            target.hp = target.maxHp;
            target.charges = 10;
            target.isDead = false;
            target.statusEffects = [];
            target.shield = 0;
            target.shieldEffect = null;
            
            // Reintegrar al personaje en turnOrder si no está ya
            if (!gameState.turnOrder.includes(targetName)) {
                // Insertar en posición correcta según velocidad
                let inserted = false;
                for (let i = 0; i < gameState.turnOrder.length; i++) {
                    const other = gameState.characters[gameState.turnOrder[i]];
                    if (other && target.speed > other.speed) {
                        gameState.turnOrder.splice(i, 0, targetName);
                        inserted = true;
                        break;
                    }
                }
                if (!inserted) gameState.turnOrder.push(targetName);
            }
            
            // Actualizar snapshot de vivos para que la ronda no termine antes de tiempo
            gameState.aliveCountAtRoundStart = Math.max(gameState.aliveCountAtRoundStart, 
                Object.values(gameState.characters).filter(c => c && !c.isDead && c.hp > 0).length);
            
            addLog(`✨ ${targetName} ha sido revivido con ${target.maxHp} HP y 10 cargas!`, 'heal');
        }

        // ── SANGRE DE YMIR: aplica efectos cuando Espinas causa daño ──

        // ── HELPER: get base character name (strips v2/v3 suffix) ──
        function getBaseName(charName) {
            if (!charName) return charName;
            return charName.replace(/ v\d+$/, '').trim();
        }
        // ── HELPER: find character by base name ──
        function findCharByBaseName(baseName) {
            return Object.keys(gameState.characters).find(function(n) {
                return n === baseName || n.startsWith(baseName + ' v');
            });
        }
        function triggerSJWArisePassive(charName) {
            // Arise! passive: at start of SJW's turn, invoke a random shadow
            const sjwChar = gameState.characters[charName];
            if (!sjwChar || sjwChar.isDead || sjwChar.hp <= 0) return;
            const shadowPool = gameState._sjwShadowWeights || {
                'Igris': 0.25, 'Iron': 0.25, 'Tusk': 0.20,
                'Beru': 0.10, 'Bellion': 0.06, 'Kaisel': 0.10, 'Kamish': 0.04
            };
            // Check if we already have max summons (5 per team)
            const teamSummons = Object.values(gameState.summons).filter(s => s && s.team === sjwChar.team);
            if (teamSummons.length >= 5) return;
            // Pick random shadow by weight
            let rand = Math.random();
            let cumulative = 0;
            let chosen = 'Igris';
            for (const [name, weight] of Object.entries(shadowPool)) {
                cumulative += weight;
                if (rand < cumulative) { chosen = name; break; }
            }
            // Get summon data
            const sData = summonData[chosen];
            if (!sData) return;
            // Get names of summons already on the field for this summoner
            const existingNames = new Set(
                Object.values(gameState.summons)
                    .filter(s => s && s.team === sjwChar.team)
                    .map(s => s.name)
            );
            // If chosen shadow is already on field, try to find another available one
            if (existingNames.has(chosen)) {
                const allPool = ['Igris', 'Iron', 'Tusk', 'Beru', 'Bellion', 'Kaisel', 'Kamish'];
                const available = allPool.filter(n => !existingNames.has(n));
                if (available.length === 0) {
                    addLog('👻 Arise! (Pasiva): ' + charName + ' ya tiene todas las sombras invocadas', 'info');
                    return;
                }
                // Pick random from available (weighted if possible)
                const availableWeights = available.map(n => ({ name: n, w: shadowPool[n] || 0.01 }));
                const totalW = availableWeights.reduce((s, x) => s + x.w, 0);
                let r2 = Math.random() * totalW;
                chosen = availableWeights[availableWeights.length - 1].name;
                for (const x of availableWeights) { r2 -= x.w; if (r2 <= 0) { chosen = x.name; break; } }
            }
            const sData2 = summonData[chosen];
            if (!sData2) return;
            // Create the summon (guaranteed unique)
            const summonId = chosen + '_' + Date.now();
            gameState.summons[summonId] = {
                id: summonId,
                name: chosen,
                hp: sData2.hp || 5,
                maxHp: sData2.hp || 5,
                team: sjwChar.team,
                summoner: charName,
                passive: sData2.passive || '',
                img: sData2.img || '',
                effect: sData2.effect || '',
                dragonEffect: sData2.effect || null,
                statusEffects: []
            };
            addLog('👻 Arise! (Pasiva): ' + charName + ' invoca a ' + chosen, 'buff');
            renderSummons();
        }

        function triggerSangreDeYmir(attackerName, ymirAllyName) {
            // Find Ymir in the same team as ymirAllyName
            const ymirAllyChar = gameState.characters[ymirAllyName];
            if (!ymirAllyChar) return;
            // Ymir has the passive 'Sangre de Ymir'
            const ymirName = Object.keys(gameState.characters).find(function(n) {
                const c = gameState.characters[n];
                return c && c.passive && c.passive.name === 'Sangre de Ymir' && c.team === ymirAllyChar.team && !c.isDead && c.hp > 0;
            });
            if (!ymirName) return;
            const atk = gameState.characters[attackerName];
            if (!atk || atk.isDead || atk.hp <= 0) return;
            // SANGRE DE YMIR: Siempre aplica Sangrado 1 turno + 50% Megacongelación
            // duration 2 = survives through next turn (decrements at end of attacker's turn)
            applyBleed(attackerName, 2);
            addLog('🩸 Sangre de Ymir: ' + attackerName + ' recibe Sangrado (1 turno)', 'damage');
            if (Math.random() < 0.50) {
                applyMegaFreeze(attackerName, 2);
                addLog('❄️ Sangre de Ymir: ' + attackerName + ' recibe Megacongelación (50%)', 'damage');
            }
        }

                function triggerBendicionSagrada(team, healAmount) {
            // Min Byung pasiva: cada vez que un aliado recupera HP, genera 2 cargas en un aliado aleatorio del equipo
            const hasMinByung = Object.keys(gameState.characters).some(function(n) {
                const c = gameState.characters[n];
                return c && c.team === team && c.passive && normAccent(c.passive.name || '') === normAccent('Bendición Sagrada') && !c.isDead && c.hp > 0;
            });
            if (!hasMinByung) return;
            // Pick a random alive ally
            const aliveAllies = Object.keys(gameState.characters).filter(function(n) {
                const c = gameState.characters[n];
                return c && c.team === team && !c.isDead && c.hp > 0;
            });
            if (aliveAllies.length === 0) return;
            const randomAlly = aliveAllies[Math.floor(Math.random() * aliveAllies.length)];
            gameState.characters[randomAlly].charges = Math.min(20, (gameState.characters[randomAlly].charges || 0) + 2);
            addLog('✨ Bendición Sagrada: ' + randomAlly + ' genera 2 cargas (aliado recuperó HP)', 'buff');
        }

        function triggerShakaHealDebuff(shakaName) {
            const shaka = gameState.characters[shakaName];
            if (!shaka || shaka.isDead || shaka.hp <= 0) return;
            const enemyTeam = shaka.team === 'team1' ? 'team2' : 'team1';
            const enemies = Object.keys(gameState.characters).filter(function(n) {
                const c = gameState.characters[n];
                return c && c.team === enemyTeam && !c.isDead && c.hp > 0;
            });
            if (enemies.length === 0) return;
            const target = enemies[Math.floor(Math.random() * enemies.length)];
            applyRandomDebuffShaka(target);
        }

        function applyRandomDebuffShaka(targetName) {
            const _stkDebuffPool = [
                function() { applyFlatBurn(targetName, 2, 2); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Quemadura', 'debuff'); },
                function() { applyPoison(targetName, 2); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Veneno', 'debuff'); },
                function() { applyBleed(targetName, 2); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Sangrado', 'debuff'); },
                function() { applyWeaken(targetName, 2); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Debilitar', 'debuff'); },
                function() { applyFear(targetName, 1); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Miedo', 'debuff'); },
                function() { applyConfusion(targetName, 1); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Confusión', 'debuff'); },
                function() { applyStun(targetName, 1); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Aturdimiento', 'debuff'); },
                function() { applyFreeze(targetName, 1); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Congelación', 'debuff'); },
                function() { applyAgotamiento(targetName, 2); addLog('✨ Tesoro del Cielo: ' + targetName + ' recibe Agotamiento', 'debuff'); },
            ];
            const chosen = _stkDebuffPool[Math.floor(Math.random() * _stkDebuffPool.length)];
            chosen();
        }
