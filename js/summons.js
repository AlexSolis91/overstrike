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
            // ── BATTLE STATS: contar invocación destruida ──
            if (reason === 'derrotado' && gameState.battleStats) {
                gameState.battleStats.summonsKilled++;
                // REINO DE LAS SOMBRAS (Marik): +3 cargas por invocación eliminada
                for (const _mkN in gameState.characters) {
                    const _mkC = gameState.characters[_mkN];
                    if (!_mkC || _mkC.isDead || !_mkC.passive || _mkC.passive.name !== 'Reino de las Sombras') continue;
                    _mkC.charges = Math.min(20, (_mkC.charges||0) + 3);
                    addLog('🌑 Reino de las Sombras: Marik genera 3 cargas (invocación eliminada)', 'buff');
                }
            }

            // GRANIZO DE ARENA IMPERIAL (Gaara): si la invocación tiene el flag, no activar pasiva
            if (summon._skipDeathPassive) {
                delete gameState.summons[summonId];
                return;
            }

            // ── SLIME TOKEN (Marik): 100% de revivir al morir ──
            if (summon.name === 'Slime Token' && reason === 'derrotado' && !passiveExecuting) {
                addLog('💀 Maquina de Tokens: ¡Slime Token revive!', 'buff');
                summon.hp = summon.maxHp;
                if (typeof renderSummons === 'function') renderSummons();
                return; // no eliminar, simplemente revive
            }

            // ── HUEVO DEL SOL (Marik): al morir invoca Dragon Alado de Ra en el mismo equipo ──
            if (summon.name === 'Huevo del Sol' && reason === 'derrotado' && !passiveExecuting) {
                delete gameState.summons[summonId];
                const _draId = 'dragon_ra_' + Date.now();
                gameState.summons[_draId] = Object.assign({}, summonData['Dragon Alado de Ra'] || {
                    name: 'Dragon Alado de Ra', hp: 20, maxHp: 20, statusEffects: [],
                    img: 'https://i.ibb.co/wrxj370t/Captura-de-pantalla-2026-04-14-174235.png'
                });
                gameState.summons[_draId].team = summon.summoner
                    ? (gameState.characters[summon.summoner] ? gameState.characters[summon.summoner].team : summon.team)
                    : summon.team;
                gameState.summons[_draId].summoner = summon.summoner;
                gameState.summons[_draId].id = _draId;
                addLog('🌞 Nacimiento Solar: ¡Huevo del Sol eclosiona en Dragon Alado de Ra!', 'buff');
                if (typeof renderSummons === 'function') renderSummons();
                // Notificar a Marik de la invocación (genera 3 cargas)
                _triggerMarikSummonKill(summon.summoner);
                return;
            }
            
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
            // ── REINO DE LAS SOMBRAS (Marik): genera 3 cargas por invocación eliminada ──
            if (reason !== 'summoner_dead' && typeof _triggerMarikSummonKill === 'function') {
                _triggerMarikSummonKill(summon.summoner);
            }
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
            
            // SINDRAGOSA Dragon de la Muerte: pasiva se activa cuando el ATACANTE golpea a Lich King (en applyDamageWithShield)
            // (la lógica está en applyDamageWithShield para Lich King)

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
                            const _beruTgtC = gameState.characters[randomEnemy.name];
                            const _beruBonus = _beruTgtC ? (_beruTgtC.charges||0) : 0;
                            const _beruDmg = 5 + _beruBonus;
                            applyDamageWithShield(randomEnemy.name, _beruDmg, 'Beru');
                            addLog(`⚔️ Beru (Garras del Abismo): ${_beruDmg} daño a ${randomEnemy.name} (5 base + ${_beruBonus} por sus cargas)`, 'damage');
                        } else {
                            const _beruTgtS = gameState.summons[randomEnemy.id];
                            const _beruBonus = _beruTgtS ? (_beruTgtS.charges||0) : 0;
                            const _beruDmg = 5 + _beruBonus;
                            applySummonDamage(randomEnemy.id, _beruDmg, 'Beru');
                            addLog(`⚔️ Beru (Garras del Abismo): ${_beruDmg} daño a ${randomEnemy.name} (5 base + ${_beruBonus} por sus cargas)`, 'damage');
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
                // 1. CHARACTER with MegaProvocacion buff active OR pasiva Provocación
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (!c || c.team !== targetTeam || c.isDead || c.hp <= 0) continue;
                    // Buff activo de MegaProvocacion
                    if (c.statusEffects && c.statusEffects.some(e => {
                        if (!e) return false;
                        const _nn = normAccent(e.name || '');
                        return _nn === 'megaprovocacion' || _nn === 'mega provocacion';
                    })) {
                        return { id: null, holder: c, isCharacter: true, characterName: n, kamish: c };
                    }
                    // NOTA: 'Señor de los Nazgul' es Provocación regular (no MegaProvocación)
                    // Se maneja en el bloque de tauntTarget en ability-select.js
                }
                // 2. SUMMON with megaProvocation flag (Drogon, Sindragosa, Caballero de la Muerte)
                // NOTA: Kamish ya NO tiene MegaProvocación (nueva pasiva Terror de las Sombras)
                for (let summonId in gameState.summons) {
                    const s = gameState.summons[summonId];
                    if (s && s.team === targetTeam && s.hp > 0 &&
                        (s.megaProvocation || s.name === 'Caballero de la Muerte' ||
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

        // ==================== ANIMACIONES DE BATALLA ====================
        function _animCard(charName, animClass, durationMs) {
            const id = 'char-' + (charName || '').replace(/\s+/g, '-');
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.remove('anim-shake','anim-hit','anim-crit','anim-heal','anim-charge','anim-debuff','anim-over','anim-transform','anim-defeat');
            void el.offsetWidth; // reflow para reiniciar
            el.classList.add(animClass);
            setTimeout(function() { el.classList.remove(animClass); }, durationMs || 600);
        }

        function _spawnDmgNumber(charName, text, type) {
            const id = 'char-' + (charName || '').replace(/\s+/g, '-');
            const el = document.getElementById(id);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const num = document.createElement('div');
            num.className = 'damage-number ' + (type || 'dmg');
            num.textContent = text;
            num.style.left = (rect.left + rect.width * 0.3 + Math.random() * rect.width * 0.4) + 'px';
            num.style.top  = (rect.top  + rect.height * 0.2) + 'px';
            document.body.appendChild(num);
            setTimeout(function() { if (num.parentNode) num.parentNode.removeChild(num); }, 1050);
        }
        // ==================== END ANIMACIONES ====================

        // ── MARIK ISHTAR: genera 3 cargas cuando una invocación es eliminada ──
        function _triggerMarikSummonKill(summonerName) {
            for (const _mn in gameState.characters) {
                const _mc = gameState.characters[_mn];
                if (!_mc || _mc.isDead || _mc.hp <= 0) continue;
                if (!_mc.passive || _mc.passive.name !== 'Reino de las Sombras') continue;
                _mc.charges = Math.min(20, (_mc.charges||0) + 3);
                addLog('💀 Reino de las Sombras: ' + _mn + ' gana 3 cargas (invocación eliminada)', 'buff');
                break;
            }
        }

        function applyDamageWithShield(targetName, damage, attackerName = null) {
            // Si el targetName es un summon especial (__summon__:id), redirigir a applySummonDamage
            if (typeof targetName === 'string' && targetName.startsWith('__summon__:')) {
                const _sumId = targetName.slice(11);
                return applySummonDamage(_sumId, damage, attackerName);
            }

            const target = gameState.characters[targetName];
            if (!target) return 0;

            // ── MUNDO TRANSPARENTE (Yorichi): limpiar flag si el objetivo ya no tiene QS ──
            if (target._passiveBlockedByYorichi) {
                const _hasQSNow = (target.statusEffects||[]).some(function(e){
                    return e && (e.name === 'Quemadura Solar' || normAccent(e.name||'') === 'quemadura solar');
                });
                if (!_hasQSNow) {
                    target._passiveBlockedByYorichi = false;
                }
            }

            // ── THE ONE (Escanor): en forma The One absorbe daño dirigido a aliados ──
            if (!passiveExecuting && damage > 0 && attackerName && attackerName !== targetName) {
                const _targetChar = target;
                if (_targetChar && !_targetChar.isDead && _targetChar.hp > 0) {
                    // Buscar Escanor activo en The One en el mismo equipo que el objetivo
                    for (const _esN in gameState.characters) {
                        const _esC = gameState.characters[_esN];
                        if (!_esC || _esC.isDead || _esC.hp <= 0 || _esN === targetName) continue;
                        if (_esC.team !== _targetChar.team) continue;
                        if (!_esC.escanorTheOneActive) continue;
                        // Redirigir el daño a Escanor con -50%
                        const _esAbsorbed = Math.ceil(damage / 2);
                        addLog('🌟 The One: Escanor absorbe el daño de ' + targetName + ' (' + _esAbsorbed + ' HP)', 'buff');
                        passiveExecuting = true;
                        applyDamageWithShield(_esN, _esAbsorbed, attackerName);
                        passiveExecuting = false;
                        return 0; // objetivo original no recibe daño
                    }
                }
            }

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

            // PROTECCIÓN SAGRADA: bloquea daño directo (attackerName === null), NO bloquea golpes
            if (!attackerName && !passiveExecuting) {
                const _psC = gameState.characters[targetName];
                if (_psC && !_psC.isDead && _psC.hp > 0 &&
                    (hasStatusEffect(targetName, 'Proteccion Sagrada') || hasStatusEffect(targetName, 'Protección Sagrada'))) {
                    addLog('✝️ Protección Sagrada: ' + targetName + ' es inmune a daño directo', 'buff');
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

            // ── DEFENSA ABSOLUTA (Gaara): consume cargas equivalentes al daño que fuera a recibir ──
            if (!passiveExecuting && damage > 0) {
                const _gaC = gameState.characters[targetName];
                if (_gaC && !_gaC.isDead && _gaC.hp > 0 && _gaC.passive && _gaC.passive.name === 'Defensa Absoluta') {
                    if ((_gaC.charges || 0) > 0) {
                        // Consumir hasta 'damage' cargas; el daño que queda es lo que supera las cargas
                        const _gaConsumed = Math.min(_gaC.charges, damage);
                        _gaC.charges = Math.max(0, (_gaC.charges||0) - _gaConsumed);
                        damage = damage - _gaConsumed;
                        addLog('🏜️ Defensa Absoluta: Gaara absorbe ' + _gaConsumed + ' daño con cargas (restante: ' + damage + ')', 'buff');
                        if (damage <= 0) return 0; // todo absorbido por cargas
                    }
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
                    if (_sasukeAtk.hp <= 0) { _sasukeAtk.isDead = true; if (typeof registerKill === 'function') registerKill('Goku', attackerName, false); }
                    passiveExecuting = false;
                    addLog('⚡ Venganza Eterna: ' + targetName + ' esquiva el ' + gameState.selectedAbility.type + ' de ' + attackerName + ' y responde con 5 daño', 'buff');
                    return 0;
                }
            }

            // ── THE ONE (Escanor): -50% daño recibido mientras esté en forma The One ──
            if (!passiveExecuting && damage > 0 && target.escanorTheOneActive) {
                damage = Math.ceil(damage / 2);
                addLog('🌟 The One: Escanor reduce 50% el daño recibido (' + damage + ' HP)', 'buff');
            }

            // ── MUNDO TRANSPARENTE: si la pasiva del objetivo está bloqueada por Yorichi, saltar pasivas reactivas ──
            const _yorichiPassiveBlocked = !!(target && target._passiveBlockedByYorichi);

            // ── LLAMARADA KUSANAGI (Kyo): AOE enemigo → Quemaduras al atacante por cada aliado golpeado ──
            // Se rastrea en triggerKyoAOEPassive() llamado después de cada AOE completo

            // ── JINETE DE DRAGONES (Daemon): daño triple mientras esté transformado ──
            if (damage > 0 && attackerName) {
                const _djAtk = gameState.characters[attackerName];
                if (_djAtk && _djAtk.passive && _djAtk.passive.name === 'Principe Rebelde' &&
                    (_djAtk.daemonJineteTurns||0) > 0) {
                    damage *= 3;
                    addLog('🐉 Jinete de Dragones: ¡Daño triple! (' + (damage/3) + ' → ' + damage + ')', 'buff');
                }
            }

            // ── REINO DE LAS SOMBRAS (Marik): inmune a daño por golpe mientras Ra/Fénix activo ──
            if (damage > 0 && attackerName && attackerName !== targetName &&
                target.passive && target.passive.name === 'Reino de las Sombras') {
                const _mkRaActive = Object.values(gameState.summons||{}).some(function(s){
                    return s && s.hp > 0 && s.team === target.team &&
                           (s.name === 'Dragon Alado de Ra' || s.name === 'Ra Modo Fenix');
                });
                if (_mkRaActive) {
                    addLog('🌞 Reino de las Sombras: Marik es inmune a golpes mientras Ra/Fénix está activo', 'buff');
                    return 0;
                }
            }

            // ── RÉQUIEM DE LOS CAÍDOS (Manigoldo): inmune a daño directo (attackerName === null) ──
            if (damage > 0 && attackerName === null &&
                target.passive && target.passive.name === 'Réquiem de los Caídos') {
                addLog('☠️ Réquiem de los Caídos: Manigoldo es inmune al daño directo', 'buff');
                return 0;
            }

            // EFECTO OMEGA (Darkseid): AOE recibido reducido 50%
            if (!passiveExecuting && !_yorichiPassiveBlocked && damage > 0 && target.passive && target.passive.name === 'Efecto Omega') {
                const _atkAbOmega = gameState.selectedAbility;
                if (_atkAbOmega && _atkAbOmega.target === 'aoe') {
                    damage = Math.ceil(damage / 2);
                    addLog('⚡ Efecto Omega: Darkseid reduce 50% el daño AOE (' + damage + ' HP)', 'buff');
                }
            }

            // SEÑOR DE LOS NAZGUL: -50% daño de ataques AOE de enemigos con Veneno activo
            if (!passiveExecuting && !_yorichiPassiveBlocked && damage > 0 && attackerName &&
                target.passive && target.passive.name === 'Señor de los Nazgul') {
                const _atkAbNaz = gameState.selectedAbility;
                if (_atkAbNaz && _atkAbNaz.target === 'aoe') {
                    const _atkHasPoison = (gameState.characters[attackerName]
                        ? (gameState.characters[attackerName].statusEffects||[])
                            .some(e => e && normAccent(e.name||'').includes('veneno'))
                        : false);
                    if (_atkHasPoison) {
                        damage = Math.ceil(damage / 2);
                        addLog('💀 Señor de los Nazgul: -50% daño AOE de ' + attackerName + ' (tiene Veneno)', 'buff');
                    }
                }
            }

            // PRESENCIA OSCURA (Darth Vader): 20% de esquivar — respeta bloqueo Yorichi
            if (attackerName !== null && !passiveExecuting && (targetName === 'Darth Vader' || targetName === 'Darth Vader v2')) {
                const atkAbility = gameState.selectedAbility;
                if (atkAbility && (atkAbility.type === 'special' || atkAbility.type === 'over')) {
                    if (Math.random() < 0.20) {
                        addLog(`🌑 Presencia Oscura: Darth Vader esquiva el ataque especial de ${attackerName}`, 'buff');
                        return 0;
                    }
                }
            }

            // CÉLULAS DE HASHIRAMA (Madara en Modo Rikudō): -50% daño recibido
            if ((targetName === 'Madara Uchiha' || targetName === 'Madara Uchiha v2') && target.rikudoMode) {
                const reduced = Math.ceil(damage / 2);
                addLog(`🌀 Modo Rikudō: Madara absorbe ${damage - reduced} de daño (50% reducción)`, 'buff');
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

                    // SUSANOO (Madara): contraataca con básico cada vez que el escudo pierde HP
                    if (target.shieldEffect === 'susanoo_counter_madara' && !passiveExecuting && attackerName && damage > 0) {
                        passiveExecuting = true;
                        const _susAtk = gameState.characters[targetName];
                        const _susBasic = _susAtk && _susAtk.abilities ? _susAtk.abilities[0] : null;
                        const _susDmg = (_susBasic ? (_susBasic.damage || 2) : 2) * (_susAtk && _susAtk.rikudoMode ? 2 : 1);
                        if (_susDmg > 0) {
                            applyDamageWithShield(attackerName, _susDmg, targetName);
                            addLog('👁️ Susanoo: Madara contraataca a ' + attackerName + ' con ' + _susDmg + ' daño (escudo golpeado)', 'damage');
                        }
                        passiveExecuting = false;
                    }

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

            // ── SINDRAGOSA Dragon de la Muerte: cuando Lich King recibe daño → 5 dmg al atacante ──
            if (remainingDamage > 0 && attackerName && !passiveExecuting &&
                (targetName === 'Lich King' || targetName === 'Lich King v2') &&
                target.hp > 0 && !target.isDead) {
                const _sindExists = Object.values(gameState.summons).some(function(s){
                    return s && s.name === 'Sindragosa' && s.team === target.team && s.hp > 0;
                });
                if (_sindExists) {
                    const _sindAtk = gameState.characters[attackerName];
                    if (_sindAtk && !_sindAtk.isDead && _sindAtk.hp > 0) {
                        passiveExecuting = true;
                        const _sindWasAlive = _sindAtk.hp > 0;
                        _sindAtk.hp = Math.max(0, (_sindAtk.hp||0) - 5);
                        addLog('🐉 Dragon de la Muerte: Sindragosa inflige 5 daño a ' + attackerName, 'damage');
                        if (_sindWasAlive && _sindAtk.hp <= 0) {
                            _sindAtk.isDead = true;
                            // Revivir como aliado de Lich King
                            _sindAtk.isDead = false;
                            _sindAtk.hp = Math.ceil(_sindAtk.maxHp * 0.50);
                            _sindAtk.charges = 0;
                            _sindAtk.statusEffects = [];
                            _sindAtk.team = target.team;
                            addLog('💀➡️👻 Dragon de la Muerte: ¡' + attackerName + ' revive como aliado de Lich King con ' + _sindAtk.hp + ' HP!', 'buff');
                        }
                        passiveExecuting = false;
                    }
                }
            }

            // ── EFECTO OMEGA (Darkseid): roba 1 HP del atacante SOLO SI SOBREVIVE al daño ──
            if (remainingDamage > 0 && attackerName && !_yorichiPassiveBlocked &&
                target.passive && target.passive.name === 'Efecto Omega' &&
                target.hp > 0 && !target.isDead) {  // solo si sobrevivió
                const _atkOmega = gameState.characters[attackerName];
                if (_atkOmega && !_atkOmega.isDead && _atkOmega.hp > 0) {
                    _atkOmega.hp = Math.max(0, (_atkOmega.hp||0) - 1);
                    if (_atkOmega.hp <= 0) { _atkOmega.isDead = true; if (typeof registerKill === 'function') registerKill(targetName, attackerName, false); }
                    target.hp = Math.min(target.maxHp, (target.hp||0) + 1);
                    addLog('⚡ Efecto Omega: Darkseid roba 1 HP de ' + attackerName, 'heal');
                }
            }

            // ── EL OJO QUE TODO LO VE (Sauron): reducción 50% con MegaProv/ProtSagrada + Aturdimiento al atacante ──
            if (damage > 0 && attackerName && attackerName !== targetName &&
                target.passive && target.passive.name === 'El Ojo que Todo lo Ve') {
                // Reducir 50% si Sauron tiene MegaProvocacion o Proteccion Sagrada
                const _saHasMegaProv = hasStatusEffect(targetName, 'Mega Provocacion') ||
                                       hasStatusEffect(targetName, 'MegaProvocacion');
                const _saHasProt    = hasStatusEffect(targetName, 'Proteccion Sagrada') ||
                                      hasStatusEffect(targetName, 'Protección Sagrada');
                if (_saHasMegaProv || _saHasProt) {
                    damage = Math.ceil(damage * 0.5);
                    addLog('🌑 El Ojo que Todo lo Ve: ' + targetName + ' reduce 50% el daño recibido (' + damage + ' HP)', 'buff');
                }
                // Aturdimiento al atacante si Sauron tiene MegaProvocacion activa
                if (_saHasMegaProv && !passiveExecuting) {
                    passiveExecuting = true;
                    if (typeof applyStun === 'function') applyStun(attackerName, 1);
                    addLog('🌑 El Ojo que Todo lo Ve: ' + attackerName + ' queda Aturdido (atacó a Sauron con MegaProvocación)', 'debuff');
                    passiveExecuting = false;
                }
            }

            // ── TERROR DE LAS SOMBRAS (Kamish): aliados ganan cargas = daño recibido ──
            if (remainingDamage > 0 && attackerName && attackerName !== targetName) {
                // Verificar si Kamish está activo en el equipo del objetivo
                const _kamTeam = target.team;
                const _kamActive = _kamTeam && Object.values(gameState.summons).some(function(s){
                    return s && s.hp > 0 && s.name === 'Kamish' && s.team === _kamTeam;
                });
                if (_kamActive) {
                    target.charges = Math.min(20, (target.charges||0) + remainingDamage);
                    addLog('👁️ Terror de las Sombras: ' + targetName + ' genera ' + remainingDamage + ' cargas (Kamish activo)', 'buff');
                }
            }

            // ── SEÑOR DE LOS NAZGUL (Rey Brujo): Infectar — veneno 2T al atacante al recibir daño ──
            if (remainingDamage > 0 && attackerName && !passiveExecuting && !_yorichiPassiveBlocked &&
                target.passive && target.passive.name === 'Señor de los Nazgul' &&
                target.hp > 0 && !target.isDead) {
                passiveExecuting = true;
                if (typeof applyPoison === 'function') applyPoison(attackerName, 2);
                addLog('🦠 Infectar: ' + attackerName + ' recibe Veneno 2T al atacar al Rey Brujo', 'debuff');
                passiveExecuting = false;
            }

            // ── MUNDO TRANSPARENTE (Yorichi): aliados que golpean enemigo con QS ──
            // Cuando enemigo con QS recibe daño → Yorichi gana 2 cargas + cura 2 HP a aliado aleatorio
            if (remainingDamage > 0 && attackerName && !passiveExecuting) {
                const _wtTgtHasQS = (target.statusEffects||[]).some(function(e){
                    return e && normAccent(e.name||'') === 'quemadura solar';
                });
                if (_wtTgtHasQS) {
                    const _wtAtk = gameState.characters[attackerName];
                    if (_wtAtk && !_wtAtk.isDead) {
                        const _wtTeam = _wtAtk.team;
                        // Buscar Yorichi en el equipo atacante
                        for (const _yrN in gameState.characters) {
                            const _yrC = gameState.characters[_yrN];
                            if (!_yrC || _yrC.isDead || _yrC.team !== _wtTeam) continue;
                            if (!_yrC.passive || _yrC.passive.name !== 'Mundo Transparente') continue;
                            passiveExecuting = true;
                            // +2 cargas a Yorichi
                            _yrC.charges = Math.min(20, (_yrC.charges||0) + 2);
                            addLog('🌅 Mundo Transparente: Yorichi gana 2 cargas (enemigo con QS recibió daño)', 'buff');
                            // Aplicar Silenciar al objetivo si no lo tiene ya
                            if (!target.isDead && target.hp > 0 && typeof applySilenciar === 'function') {
                                passiveExecuting = false;
                                applySilenciar(targetName, 2);
                                passiveExecuting = true;
                            }
                            // Curar 2 HP a aliado aleatorio
                            const _wtAllies = Object.keys(gameState.characters).filter(function(n){
                                const _c = gameState.characters[n];
                                return _c && _c.team === _wtTeam && !_c.isDead && _c.hp > 0;
                            });
                            if (_wtAllies.length > 0) {
                                const _wtHealT = _wtAllies[Math.floor(Math.random() * _wtAllies.length)];
                                if (typeof applyHeal === 'function') {
                                    applyHeal(_wtHealT, 2, 'Mundo Transparente');
                                } else if (typeof canHeal === 'function' ? canHeal(_wtHealT) : true) {
                                    gameState.characters[_wtHealT].hp = Math.min(
                                        gameState.characters[_wtHealT].maxHp,
                                        (gameState.characters[_wtHealT].hp||0) + 2
                                    );
                                    addLog('🌅 Mundo Transparente: ' + _wtHealT + ' cura 2 HP', 'heal');
                                }
                            }
                            passiveExecuting = false;
                            break;
                        }
                    }
                }
            }

            // Sangre Maldita v2: inicio de ronda en turn-logic.js

            // ── PRINCIPE REBELDE (Daemon): al llegar a 0 HP, elimina un enemigo aleatorio ──
            if (remainingDamage > 0 && !passiveExecuting &&
                target.passive && target.passive.name === 'Principe Rebelde' &&
                target.hp <= 0 && !target.isDead) {
                passiveExecuting = true;
                // Eliminar un enemigo aleatorio (no el atacante para evitar loops)
                const _daemonTeam = target.team;
                const _daemonETeam = _daemonTeam === 'team1' ? 'team2' : 'team1';
                const _daemonEnemies = Object.keys(gameState.characters).filter(function(n){
                    const _c = gameState.characters[n];
                    return _c && _c.team === _daemonETeam && !_c.isDead && _c.hp > 0;
                });
                if (_daemonEnemies.length > 0) {
                    const _daemonVictim = _daemonEnemies[Math.floor(Math.random() * _daemonEnemies.length)];
                    const _daemonVc = gameState.characters[_daemonVictim];
                    if (_daemonVc) {
                        _daemonVc.isDead = true;
                        _daemonVc.hp = 0;
                        addLog('🐉 Principe Rebelde: ¡Daemon cae pero elimina a ' + _daemonVictim + ' antes de morir!', 'buff');
                        if (typeof registerKill === 'function') registerKill(targetName, _daemonVictim, false);
                    }
                }
                passiveExecuting = false;
            }

            // ── PALADÍN DE LA MANO DE PLATA (Tirion): al llegar a 10 HP → Protección Sagrada + Escudo Sagrado + 20 cargas ──
            if (remainingDamage > 0 && !passiveExecuting &&
                target.passive && target.passive.name === 'Paladín de la Mano de Plata' &&
                !target.tirionLowHpTriggered && target.hp > 0 && !target.isDead &&
                target.hp <= 10) {
                target.tirionLowHpTriggered = true;
                passiveExecuting = true;
                // Protección Sagrada
                if (typeof hasStatusEffect === 'function' && !hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                    target.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration: 999, permanent: true, emoji: '🛡️' });
                }
                // Escudo Sagrado
                target.statusEffects = (target.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'escudo sagrado'; });
                target.statusEffects.push({ name: 'Escudo Sagrado', type: 'buff', duration: 2, emoji: '✝️' });
                // 20 cargas
                target.charges = Math.min(20, (target.charges||0) + 20);
                addLog('🌟 Paladín de la Mano de Plata: ¡Tirion activa Protección Sagrada + Escudo Sagrado + 20 cargas al llegar a ' + target.hp + ' HP!', 'buff');
                passiveExecuting = false;
            }

            // ── ANIMACIÓN: shake + flash rojo + número flotante al recibir daño ──
            if (remainingDamage > 0 && typeof _animCard === 'function') {
                const _isCrit = remainingDamage >= 6; // daño alto = crítico visual
                _animCard(targetName, _isCrit ? 'anim-crit' : 'anim-hit', 500);
                _animCard(targetName, 'anim-shake', 450);
                _spawnDmgNumber(targetName, (_isCrit ? '💥 ' : '-') + remainingDamage, _isCrit ? 'crit' : 'dmg');
            }

            // ── LLAMARADA KUSANAGI (Kyo): detectar AOE enemigo y acumular contador de aliados golpeados ──
            if (remainingDamage > 0 && attackerName && attackerName !== targetName) {
                const _kyoSel = gameState.selectedAbility;
                const _kyoIsAOE = _kyoSel && (_kyoSel.target === 'aoe' || _kyoSel.target === 'enemy_team');
                if (_kyoIsAOE) {
                    // Acumular contador de hits AOE para disparar la pasiva de Kyo al final
                    gameState._kyoAOEHitsByAttacker = gameState._kyoAOEHitsByAttacker || {};
                    gameState._kyoAOEHitsByAttacker[attackerName] = (gameState._kyoAOEHitsByAttacker[attackerName] || 0) + 1;
                }
            }

            // ── BATTLE STATS: acumular daño, crits y daño recibido ──
            if (remainingDamage > 0 && gameState.battleStats) {
                // Daño por atacante
                if (attackerName) {
                    gameState.battleStats.totalDamage[attackerName] = (gameState.battleStats.totalDamage[attackerName] || 0) + remainingDamage;
                    const _atkChar = gameState.characters[attackerName];
                    if (_atkChar) {
                        if (_atkChar.team === 'team1') gameState.battleStats.team1Damage += remainingDamage;
                        else gameState.battleStats.team2Damage += remainingDamage;
                    }
                    // Crítico: SOLO si el flag _isCritHit está activo (daño real = 2× base garantizado)
                    // O si remainingDamage es exactamente el doble del damage base de la habilidad
                    if (gameState._isCritHit) {
                        registerCrit(attackerName);
                        gameState._isCritHit = false;
                    } else {
                        const _abDmg = gameState.selectedAbility ? (gameState.selectedAbility.damage || 0) : 0;
                        // Solo crit si el daño es exactamente 2× el base (no buffs de 1.8× u otros)
                        if (_abDmg > 0 && remainingDamage >= _abDmg * 2) {
                            registerCrit(attackerName);
                        }
                    }
                }
                // Daño recibido por el objetivo
                registerDamageReceived(targetName, remainingDamage);
                // Daño CAUSADO por el atacante (nueva métrica ×0.15)
                if (attackerName && typeof _mvp === 'function') {
                    _mvp('damageDone', attackerName, remainingDamage);
                }
            }
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
                        _mc2.charges = Math.min(20, (_mc2.charges||0) + 1);
                        addLog('🔥 Monarca de la Destruccion: ' + _mn2 + ' gana 1 carga (daño directo a ' + targetName + ')', 'buff');
                        break;
                    }
                }
            }

            // Verificar si fue derrotado
            if (target.hp <= 0 && oldHp > 0) {
                target.isDead = true;
                if (typeof _animCard === 'function') _animCard(targetName, 'anim-defeat', 700);
                // ── BATTLE STATS: registrar kill usando función centralizada ──
                const _killer = attackerName || gameState._currentTurnAttacker || null;
                if (_killer) registerKill(_killer, targetName, false);
                // ── REINO DE LAS SOMBRAS (Marik): 3 cargas cuando una invocación es eliminada ──
            // (se maneja en triggerSummonDeath que se llama desde applySummonDamage)

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
                            triggerAdaptacionReactivaHeal(targetName);
                            const _ddAtkObj = gameState.characters[attackerName];
                            if (_ddAtkObj) {
                                const _ddEnms = Object.keys(gameState.characters).filter(n => {
                                    const c = gameState.characters[n];
                                    return c && c.team === _ddAtkObj.team && !c.isDead && c.hp > 0 && (c.charges||0) > 0;
                                });
                                if (_ddEnms.length > 0) {
                                    const _ddR = _ddEnms[Math.floor(Math.random() * _ddEnms.length)];
                                    gameState.characters[_ddR].charges = Math.max(0, (gameState.characters[_ddR].charges||0) - 2);
                                    addLog('Adaptacion Reactiva: ' + _ddR + ' pierde 2 cargas', 'debuff');
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
                // BUFF REFLEJAR: cuando el portador recibe un ataque, refleja el daño al atacante y NO recibe daño
                if (!passiveExecuting && hasStatusEffect(targetName, 'Reflejar') && attackerName && attackerName !== targetName && damage > 0) {
                    passiveExecuting = true;
                    // Nuevo Reflejar: el portador NO recibe daño ni efectos.
                    // Refleja el daño y efectos del movimiento sobre el atacante.
                    // 50% de disiparse después de reflejar.
                    const reflectDmg = damage;
                    applyDamageWithShield(attackerName, reflectDmg, targetName);
                    addLog('🪞 Reflejar: ' + targetName + ' refleja ' + reflectDmg + ' daño a ' + attackerName + ' (sin daño al portador)', 'buff');
                    // También aplicar efectos del movimiento al atacante (debuffs que el movimiento iba a causar)
                    if (gameState.selectedAbility) {
                        const _refAb = gameState.selectedAbility;
                        if (_refAb.effect && typeof applyDebuff === 'function') {
                            // Aplicar veneno si el movimiento lo causaría
                            if (_refAb.description && (_refAb.description.toLowerCase().includes('veneno') || _refAb.description.toLowerCase().includes('poison'))) {
                                applyPoison(attackerName, 1);
                                addLog('🪞 Reflejar: Veneno reflejado a ' + attackerName, 'debuff');
                            }
                            // Aplicar quemadura si el movimiento lo causaría
                            if (_refAb.description && _refAb.description.toLowerCase().includes('quemadura')) {
                                applyFlatBurn(attackerName, 2, 1);
                                addLog('🪞 Reflejar: Quemadura reflejada a ' + attackerName, 'debuff');
                            }
                        }
                    }
                    // 50% de disiparse el Reflejar
                    if (Math.random() < 0.50) {
                        const _refTgtC = gameState.characters[targetName];
                        if (_refTgtC) {
                            _refTgtC.statusEffects = (_refTgtC.statusEffects||[]).filter(e => !e || e.name !== 'Reflejar');
                            addLog('🪞 Reflejar: el buff se disipó (50%)', 'info');
                        }
                    }
                    passiveExecuting = false;
                    return 0; // El portador NO recibe el daño
                }
                // AURA DE FUEGO: atacante recibe Quemadura 2HP por 2 turnos
                if (attackerName && (hasStatusEffect(targetName, 'Aura de fuego') || hasStatusEffect(targetName, 'Aura de Fuego'))) {
                    const _prevPE = passiveExecuting;
                    passiveExecuting = true;
                    applyFlatBurn(attackerName, 2, 2);
                    addLog('🔥 Aura de Fuego: ' + attackerName + ' recibe Quemadura 2HP (2T) por atacar a ' + targetName, 'debuff');
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
                        if (attackerChar.hp <= 0) { attackerChar.isDead = true; if (typeof registerKill === 'function') registerKill(targetName, attackerName, false); }
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

        // MONARCA DE LA DESTRUCCION: 3 daño directo por cada Buff aplicado a un enemigo de Antares
        // ══════════════════════════════════════════════════════
        // MVP TRACKING — funciones centralizadas
        // ══════════════════════════════════════════════════════

        // Suma 1 al contador indicado para el personaje
        function _mvp(stat, charName, amount) {
            if (!charName || !gameState.battleStats) return;
            amount = amount || 1;
            gameState.battleStats[stat] = gameState.battleStats[stat] || {};
            gameState.battleStats[stat][charName] = (gameState.battleStats[stat][charName] || 0) + amount;
        }

        // Registrar kill para un personaje (por golpe, por efecto, por invocación)
        // ── ADAPTACION REACTIVA: disparar cuando Doomsday recupera HP por cualquier medio ──
        function triggerAdaptacionReactivaHeal(doomsdayName) {
            const _ddC = gameState.characters[doomsdayName];
            if (!_ddC || _ddC.isDead || !_ddC.passive || _ddC.passive.name !== 'Adaptacion Reactiva') return;
            // Eliminar 2 cargas de un enemigo aleatorio
            const _ddET = _ddC.team === 'team1' ? 'team2' : 'team1';
            const _ddEnms = Object.keys(gameState.characters).filter(function(n){
                const _ec = gameState.characters[n];
                return _ec && _ec.team === _ddET && !_ec.isDead && _ec.hp > 0 && (_ec.charges||0) > 0;
            });
            if (_ddEnms.length > 0) {
                const _r = _ddEnms[Math.floor(Math.random() * _ddEnms.length)];
                gameState.characters[_r].charges = Math.max(0, (gameState.characters[_r].charges||0) - 2);
                addLog('💪 Adaptacion Reactiva: ' + _r + ' pierde 2 cargas (Doomsday recuperó HP)', 'debuff');
            }
        }

        function triggerKamishEndOfRound() {
            // Kamish: al final de cada ronda, 4 daño a todos los enemigos
            Object.keys(gameState.summons).forEach(function(sid) {
                const kamish = gameState.summons[sid];
                if (!kamish || kamish.name !== 'Kamish' || kamish.hp <= 0) return;
                const enemyTeam = kamish.team === 'team1' ? 'team2' : 'team1';
                addLog('👁️ Kamish (Terror de las Sombras): 4 daño a todos los enemigos', 'damage');
                for (const n in gameState.characters) {
                    const ch = gameState.characters[n];
                    if (!ch || ch.team !== enemyTeam || ch.isDead || ch.hp <= 0) continue;
                    applyDamageWithShield(n, 4, 'Kamish');
                }
                // También a invocaciones enemigas
                for (const sid2 in gameState.summons) {
                    const s = gameState.summons[sid2];
                    if (!s || s.team !== enemyTeam || s.hp <= 0) continue;
                    applySummonDamage(sid2, 4, 'Kamish');
                }
            });
        }

        function registerKill(killerName, victimName, byInvocation) {
            if (!killerName || !gameState.battleStats) return;
            _mvp('killMap', killerName);
            if (byInvocation) {
                // +5 puntos extra por kill via invocación
                _mvp('summonKills', killerName);
            }
        }

        // Registrar daño recibido (para puntuación de tanques y todos los personajes)
        function registerDamageReceived(targetName, amount) {
            if (!targetName || !amount || !gameState.battleStats) return;
            _mvp('damageReceived', targetName, amount);
        }

        // Registrar CC aplicado
        function registerCC(attackerName) {
            if (!attackerName || !gameState.battleStats) return;
            _mvp('ccApplied', attackerName);
        }

        // Registrar carga generada
        function registerChargeGen(charName, amount, forSelf) {
            if (!charName || !amount || !gameState.battleStats) return;
            // Pulso dorado: cargas otorgadas a aliados por efecto de habilidad
            if (!forSelf && amount > 0 && typeof _animCard === 'function') {
                _animCard(charName, 'anim-pulse-gold', 550);
            }
            if (forSelf) {
                _mvp('chargesGenSelf', charName, amount);
            } else {
                _mvp('chargesGenAllies', charName, amount);
            }
        }

        // Registrar healing dado a aliados
        function registerHealing(healerName, amount) {
            if (!healerName || !amount || !gameState.battleStats) return;
            _mvp('healingDone', healerName, amount);
        }

        // Registrar buff aplicado sobre aliado
        function registerBuff(casterName) {
            if (!casterName || !gameState.battleStats) return;
            _mvp('buffsApplied', casterName);
        }

        // Registrar debuff aplicado sobre enemigo
        function registerDebuff(casterName) {
            if (!casterName || !gameState.battleStats) return;
            _mvp('debuffsApplied', casterName);
        }

        // Registrar invocación realizada
        function registerSummon(summoner) {
            if (!summoner || !gameState.battleStats) return;
            _mvp('summonsDone', summoner);
        }

        // Registrar daño por veneno
        function registerPoisonDamage(amount) {
            if (!amount || !gameState.battleStats) return;
            gameState.battleStats.poisonDamage = gameState.battleStats.poisonDamage || {};
            gameState.battleStats._totalPoisonDmg = (gameState.battleStats._totalPoisonDmg || 0) + amount;
        }

        // Registrar daño por quemadura
        function registerBurnDamage(amount) {
            if (!amount || !gameState.battleStats) return;
            gameState.battleStats._totalBurnDmg = (gameState.battleStats._totalBurnDmg || 0) + amount;
        }

        // Registrar crítico por personaje
        function registerCrit(charName) {
            if (!charName || !gameState.battleStats) return;
            _mvp('critsByChar', charName);
            gameState.battleStats.crits = (gameState.battleStats.crits || 0) + 1;
        }

        // Llamar después de cada AOE para aplicar pasiva de Kyo
        function triggerKyoAOEPassive(attackerName, alliesHit) {
            if (!attackerName || !alliesHit || alliesHit <= 0) return;
            const _attacker = gameState.characters[attackerName];
            if (!_attacker) return;
            const _defTeam = _attacker.team === 'team1' ? 'team2' : 'team1';
            // Buscar Kyo Kusanagi en el equipo defensor
            for (const _n in gameState.characters) {
                const _c = gameState.characters[_n];
                if (!_c || _c.isDead || _c.hp <= 0 || _c.team !== _defTeam) continue;
                if (!_c.passive || _c.passive.name !== 'Llamarada Kusanagi') continue;
                // Aplicar quemaduras al atacante: 2 HP por cada aliado golpeado
                const _burnDmg = alliesHit * 2;
                if (typeof applyFlatBurn === 'function') {
                    for (let _bi = 0; _bi < alliesHit; _bi++) {
                        applyFlatBurn(attackerName, 2, 2);
                    }
                }
                addLog('🔥 Llamarada Kusanagi: ' + attackerName + ' recibe ' + alliesHit + ' Quemadura(s) de 2HP (AOE golpeo ' + alliesHit + ' aliados)', 'debuff');
                break;
            }
        }

        function triggerMonarcaDestruccion(buffTargetName) {
            // Flag dedicado para Antares para evitar recursión sin interferir con otras pasivas
            if (gameState._antaresExecuting) return;
            if (passiveExecuting) return;
            const _btC = gameState.characters[buffTargetName];
            if (!_btC || _btC.isDead || _btC.hp <= 0) return;
            // Buscar Antares en el equipo CONTRARIO al objetivo del buff
            const _antTeam = _btC.team === 'team1' ? 'team2' : 'team1';
            for (const _an in gameState.characters) {
                const _ac = gameState.characters[_an];
                if (!_ac || _ac.isDead || _ac.hp <= 0 || _ac.team !== _antTeam) continue;
                if (!_ac.passive || _ac.passive.name !== 'Monarca de la Destruccion') continue;
                // 2 daño directo al objetivo
                gameState._antaresExecuting = true;
                passiveExecuting = true;
                const _btOldHp = _btC.hp;
                _btC.hp = Math.max(0, (_btC.hp||0) - 2);
                const _btDmgDone = _btOldHp - _btC.hp;
                // Registrar daño causado en battleStats
                if (_btDmgDone > 0 && gameState.battleStats) {
                    if (!gameState.battleStats.damageDone) gameState.battleStats.damageDone = {};
                    gameState.battleStats.damageDone[_an] = (gameState.battleStats.damageDone[_an]||0) + _btDmgDone;
                    registerDamageReceived(buffTargetName, _btDmgDone);
                }
                // Registrar kill si eliminó al objetivo
                if (_btC.hp <= 0) {
                    _btC.isDead = true;
                    if (typeof registerKill === 'function') registerKill(_an, buffTargetName, false);
                    if (typeof _animCard === 'function') _animCard(buffTargetName, 'anim-defeat', 700);
                }
                addLog('🔥 Monarca de la Destruccion: 2 daño directo a ' + buffTargetName + ' (Buff aplicado sobre enemigo)', 'damage');
                // Generar 1 carga por el daño directo causado
                if (_btDmgDone > 0) {
                    _ac.charges = Math.min(20, (_ac.charges||0) + 1);
                    addLog('🔥 Monarca de la Destruccion: ' + _an + ' gana 1 carga (daño directo)', 'buff');
                }
                passiveExecuting = false;
                gameState._antaresExecuting = false;
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
                if (typeof _animCard === 'function') {
                    _animCard(charName, 'anim-heal', 500);
                    _spawnDmgNumber(charName, '+' + _hcActual, 'heal');
                }
                if (gameState.battleStats) gameState.battleStats.healsGiven += _hcActual;
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
