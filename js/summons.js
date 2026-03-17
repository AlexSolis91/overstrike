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
                    applyFlatBurn(attackerName, 5, 1); // 25% por 1 turno per Excel spec
                    addLog(`🔥 ${attackerName} recibe Quemaduras permanentes del 20% por golpear a Kamish`, 'damage');
                }
            }
            
            if (summon.hp <= 0 && oldHp > 0) {
                if (attackerName) {
                    addLog(`💀 ${summon.name} fue derrotado por ${attackerName}`, 'damage');
                }
                removeSummon(summonId, 'derrotado');
            }
            
            renderSummons();
            return damage;
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
                // Prevenir cascadas de pasivas
                if (passiveExecuting) return;
                
                const igrisSummons = Object.keys(gameState.summons).filter(id => {
                    const summon = gameState.summons[id];
                    return summon && summon.name === 'Igris' && summon.summoner === summonerName && summon.hp > 0;
                });
                
                if (igrisSummons.length === 0) return;
                
                passiveExecuting = true;
                
                igrisSummons.forEach(igrisId => {
                    const igris = gameState.summons[igrisId];
                    if (!igris) return;
                    
                    const enemyTeam = igris.team === 'team1' ? 'team2' : 'team1';
                    
                    // Buscar enemigos vivos (personajes e invocaciones)
                    const enemies = [];
                    
                    // Agregar personajes enemigos
                    for (let name in gameState.characters) {
                        const char = gameState.characters[name];
                        if (char.team === enemyTeam && !char.isDead && char.hp > 0) {
                            enemies.push({ type: 'character', name: name });
                        }
                    }
                    
                    // Agregar invocaciones enemigas
                    for (let summonId in gameState.summons) {
                        const summon = gameState.summons[summonId];
                        if (summon && summon.team === enemyTeam && summon.hp > 0 && summonId !== igrisId) {
                            enemies.push({ type: 'summon', id: summonId, name: summon.name });
                        }
                    }
                    
                    if (enemies.length > 0) {
                        const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
                        
                        if (randomEnemy.type === 'character') {
                            applyDamageWithShield(randomEnemy.name, 2, 'Igris');
                            addLog(`⚔️ Igris (Pasiva) ataca a ${randomEnemy.name} causando 2 de daño`, 'damage');
                        } else {
                            applySummonDamage(randomEnemy.id, 2, 'Igris');
                            addLog(`⚔️ Igris (Pasiva) ataca a ${randomEnemy.name} causando 2 de daño`, 'damage');
                        }
                    }
                });
                
                passiveExecuting = false;
            } catch (error) {
                console.error('Error en triggerIgrisPassive:', error);
                passiveExecuting = false; // Asegurar que se resetea incluso si hay error
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
            Object.keys(gameState.summons).forEach(function(sid) {
                const kais = gameState.summons[sid];
                if (!kais || kais.name !== 'Kaisel' || kais.hp <= 0) return;
                passiveExecuting = true;
                const enemyTeam = kais.team === 'team1' ? 'team2' : 'team1';
                const enemies = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === enemyTeam && !c.isDead && c.hp > 0;
                });
                if (enemies.length === 0) { passiveExecuting = false; return; }
                // Pick 2 random enemies (or 1 if only 1)
                const shuffled = enemies.slice().sort(() => Math.random() - 0.5);
                const targets = shuffled.slice(0, Math.min(2, shuffled.length));
                const debuffs = ['applyBurn', 'applyPoison', 'applyBleed', 'applyFreeze', 'applyStun', 'applyFear', 'applyWeaken'];
                targets.forEach(function(tgt) {
                    const rand = Math.floor(Math.random() * 5);
                    if (rand === 0) applyFlatBurn(tgt, 2, 1);
                    else if (rand === 1) applyPoison(tgt, 1);
                    else if (rand === 2) applyBleed(tgt, 1);
                    else if (rand === 3) applyFreeze(tgt, 1);
                    else applyFear(tgt, 1);
                    addLog(`🐲 Kaisel (Maldición): aplica debuff aleatorio a ${tgt}`, 'damage');
                });
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
            try {
                // Buscar Kamish por nombre
                for (let summonId in gameState.summons) {
                    const s = gameState.summons[summonId];
                    if (s && s.name === 'Kamish' && s.team === targetTeam && s.hp > 0) {
                        return { id: summonId, kamish: s };
                    }
                }
                // Buscar invocaciones con megaProvocation flag (Sindragosa, Tirion Fordring)
                for (let summonId in gameState.summons) {
                    const s = gameState.summons[summonId];
                    if (s && s.megaProvocation && s.team === targetTeam && s.hp > 0) {
                        return { id: summonId, kamish: s };
                    }
                }
                // Buscar personaje con buff MegaProvocacion activo (Darth Vader)
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.team === targetTeam && !c.isDead && c.hp > 0) {
                        if (c.statusEffects && c.statusEffects.some(e => e && normAccent(e.name || '') === 'megaprovocacion')) {
                            return { id: null, kamish: c, isCharacter: true, characterName: n };
                        }
                    }
                }
                return null;
            } catch (error) {
                console.error('Error en checkKamishMegaProvocation:', error);
                return null;
            }
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
            const target = gameState.characters[targetName];
            if (!target) return 0;

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
            if (attackerName !== null && targetName === 'Nakime' && !passiveExecuting) {
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
            
            // PROTECCION SAGRADA: inmune a nuevos debuffs (handled in applyDebuff)
            // Also: blocks incoming HP DAMAGE from golpes (physical hits)
            if (attackerName !== null && hasStatusEffect(targetName, 'Proteccion Sagrada') || 
                (attackerName !== null && hasStatusEffect(targetName, 'Protección Sagrada'))) {
                addLog('🛡️ Protección Sagrada: ' + targetName + ' es inmune al daño de golpe', 'buff');
                return 0;
            }
            // ESCUDO SAGRADO: bloquea todo el daño de golpes (no efectos de estado)
            if (attackerName !== null && hasStatusEffect(targetName, 'Escudo Sagrado')) {
                addLog(`✝️ Escudo Sagrado de ${targetName} bloqueó el golpe de ${attackerName}`, 'buff');
                return 0;
            }

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

            // BUFF ESQUIVAR (Goku UI, Sauron, etc): 50% de esquivar
            if (attackerName !== null && !passiveExecuting) {
                if (target.hasDodge || hasStatusEffect(targetName, 'Esquivar')) {
                    if (Math.random() < 0.50) {
                        addLog(`💨 ${targetName} esquiva el ataque de ${attackerName}!`, 'buff');
                        // Si es Goku con Ultra Instinto, contraataca
                        if (targetName === 'Goku' && target.ultraInstinto) {
                            triggerCounterattack(targetName, attackerName);
                        }
                        return 0;
                    }
                }
            }

            // PRESENCIA OSCURA (Darth Vader): 20% de esquivar ataques especiales/over
            if (attackerName !== null && !passiveExecuting && targetName === 'Darth Vader') {
                const atkAbility = gameState.selectedAbility;
                if (atkAbility && (atkAbility.type === 'special' || atkAbility.type === 'over')) {
                    if (Math.random() < 0.20) {
                        addLog(`🌑 Presencia Oscura: Darth Vader esquiva el ataque especial de ${attackerName}`, 'buff');
                        return 0;
                    }
                }
            }

            // PASIVA LIMBO: Madara en Modo Rikudō recibe 50% menos de daño
            if (targetName === 'Madara Uchiha' && target.rikudoMode) {
                const reduced = Math.ceil(damage / 2);
                addLog(`🌀 Limbo: Madara absorbe ${damage - reduced} de daño (50% reducción)`, 'buff');
                damage = reduced;
            }

            // PASIVA CUERPO DIVINO: Goku Black roba 1 carga al atacante con 50%
            if (targetName === 'Goku Black' && attackerName && attackerName !== null && !passiveExecuting) {
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
            
            // Verificar si fue derrotado
            if (target.hp <= 0 && oldHp > 0) {
                target.isDead = true;
                
                if (attackerName) {
                    addLog(`💀 ${targetName} fue derrotado por ${attackerName}`, 'damage');
                } else {
                    addLog(`💀 ${targetName} fue derrotado`, 'damage');
                }

                // PASIVA CORAZÓN ARDIENTE (Rengoku): al morir aturde a todos los enemigos
                if (targetName === 'Rengoku' && !passiveExecuting) {
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
                if (targetName === 'Ikki de Fenix') {
                    target.deathRound = gameState.currentRound;
                    target.fenixRevived = false;
                }
            }

            // Track last attacker for abilities like Corazón en Llamas
            if (attackerName && remainingDamage > 0) {
                if (!gameState._lastAttacker) gameState._lastAttacker = {};
                gameState._lastAttacker[targetName] = attackerName;
            }

            // Disparar pasivas post-golpe si el objetivo sigue vivo
            if (target.hp > 0 && !target.isDead && attackerName) {
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
                // AURA DE FUEGO: atacante recibe Quemadura 2HP
                if (!passiveExecuting && hasStatusEffect(targetName, 'Aura de fuego') && attackerName) {
                    passiveExecuting = true;
                    applyFlatBurn(attackerName, 2, 1);
                    addLog('🔥 Aura de Fuego: ' + attackerName + ' recibe Quemadura al atacar', 'debuff');
                    passiveExecuting = false;
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
            // Escudos NO son acumulables — el nuevo escudo siempre reemplaza al anterior
            if (target.shield > 0) {
                addLog('🛡️ El escudo anterior de ' + targetName + ' (' + target.shield + ' HP) es reemplazado por uno nuevo', 'info');
            }
            target.shield = shieldAmount;
            target.shieldEffect = specialEffect;
            addLog('🛡️ ' + targetName + ' recibe Escudo de ' + shieldAmount + ' HP', 'buff');
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
            return c.hp - before;
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
