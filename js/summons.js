// ── GLOBAL FLAG: prevents infinite passive cascade loops ──
        let passiveExecuting = false;
        let passiveHealExecuting = false; // Prevents Bendición Sagrada ↔ Explosión de Sangre loops

        // ==================== ROBO DE CARGAS ====================
        function stealCharges(attackerName, targetName, amount) {
            const attacker = gameState.characters[attackerName];
            const target = gameState.characters[targetName];
            if (!attacker || !target) return 0;
            const stolen = Math.min(target.charges, amount);
            target.charges = Math.max(0, (target.charges||0) - (stolen));
            attacker.charges += stolen;
            // Six Paths: Mega Aturdimiento if target lost 5+ charges
            if (stolen >= 5) checkSixPathsMegaStun(targetName, stolen);
            if (stolen > 0) addLog(`⚡ ${attackerName} roba ${stolen} carga${stolen > 1 ? 's' : ''} a ${targetName}`, 'buff');
            else addLog(`⚡ ${targetName} no tiene cargas que robar`, 'info');
            return stolen;
        }

        // ── SIX PATHS: trigger Mega Aturdimiento when enemy loses 5+ charges ──
        function checkSixPathsMegaStun(targetName, chargesLost) {
            if (!targetName || chargesLost < 5) return;
            const target = gameState.characters[targetName];
            if (!target || target.isDead) return;
            // Find Pain alive on the enemy team of the target
            const painTeam = target.team === 'team1' ? 'team2' : 'team1';
            for (const pn in gameState.characters) {
                const pain = gameState.characters[pn];
                if (!pain || pain.isDead || pain.team !== painTeam) continue;
                if (!pain.passive || pain.passive.name !== 'Six Paths') continue;
                // Apply Mega Aturdimiento directly (bypass applyDebuff to avoid loops)
                const already = (target.statusEffects||[]).some(function(e){
                    return e && e.name === 'Mega Aturdimiento';
                });
                if (!already) {
                    (target.statusEffects = target.statusEffects||[]).push({
                        name: 'Mega Aturdimiento', type: 'debuff', duration: 2, emoji: '💫', stun: true, mega: true
                    });
                    addLog('👁️ Six Paths: ' + targetName + ' recibe Mega Aturdimiento (perdió ' + chargesLost + ' cargas)', 'debuff');
                }
                break;
            }
        }
        window.checkSixPathsMegaStun = checkSixPathsMegaStun;

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
                console.log('[DIAGNÓSTICO Horda] summonShadow(' + shadowName + ', ' + summonerName + ') llamada. Invocaciones actuales:', JSON.stringify(Object.keys(gameState.summons).map(function(sid){ var s=gameState.summons[sid]; return s.name+'('+sid+') team='+s.team+' summoner='+s.summoner+' hp='+s.hp; })));
                
                if (!summoner) {
                    console.error('Summoner not found:', summonerName);
                    return;
                }
                
                if (!shadowTemplate) {
                    console.error('Shadow template not found:', shadowName);
                    return;
                }
                
                // UNICIDAD: verificar que no haya otra invocación VIVA con el mismo nombre,
                // ya sea del mismo equipo O del mismo invocador — antes solo comparaba por
                // equipo, y en ciertos modos (Horda) un desajuste de la referencia de equipo
                // entre rondas podía hacer que el chequeo nunca encontrara a la invocación ya
                // existente, generando duplicados sin límite (visto con Nagini: 30 copias).
                const alreadyExists = Object.values(gameState.summons).some(
                    s => s && s.name === shadowName && !s.isDead && (s.hp === undefined || s.hp > 0) &&
                         (s.team === summoner.team || s.summoner === summonerName)
                );
                if (alreadyExists) {
                    console.log('[DIAGNÓSTICO Horda] summonShadow(' + shadowName + ') BLOQUEADO — ya existe una viva');
                    addLog('❌ ' + shadowName + ' ya está en el campo (no se puede invocar dos veces)', 'info');
                    return;
                }

                // LÍMITE GENERAL: máximo 5 invocaciones vivas por equipo al mismo tiempo,
                // sin importar el origen — red de seguridad universal para cualquier fuente
                // de invocación (pasivas, habilidades, reliquias, etc.)
                const _teamSummonCount = Object.values(gameState.summons).filter(
                    s => s && s.team === summoner.team && !s.isDead && (s.hp === undefined || s.hp > 0)
                ).length;
                if (_teamSummonCount >= 5) {
                    addLog('❌ ' + shadowName + ' no pudo invocarse — límite de 5 invocaciones por equipo alcanzado', 'info');
                    return;
                }
                console.log('[DIAGNÓSTICO Horda] summonShadow(' + shadowName + ') va a CREAR una nueva invocación');
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
                    megaProvocation: shadowTemplate.megaProvocation || false // Drogon ya no tiene megaProv
                };

                // Orbe de las Sombras: +3 HP máx al invocar si el invocador tiene esta reliquia
                // Si equippedRelics aún no cargó (condición de carrera con la carga async de reliquias),
                // verificar también en Firebase directamente para no perder el bono.
                const _orbeSummonId = summonId;
                const _orbeCheck = function(relicsArr) {
                    if ((relicsArr||[]).some(function(r){ return r === 'Orbe de las Sombras'; })) {
                        if (gameState.summons[_orbeSummonId]) {
                            gameState.summons[_orbeSummonId].maxHp = (gameState.summons[_orbeSummonId].maxHp||15) + 3;
                            gameState.summons[_orbeSummonId].hp = Math.min(gameState.summons[_orbeSummonId].maxHp, (gameState.summons[_orbeSummonId].hp||0) + 3);
                            addLog('🔮 Orbe de las Sombras: ' + shadowName + ' gana +3 HP máx', 'buff');
                            if (typeof renderCharacters === 'function') renderCharacters();
                        }
                    }
                };
                if ((summoner.equippedRelics||[]).length > 0) {
                    _orbeCheck(summoner.equippedRelics);
                } else {
                    // Reliquias aún no cargadas — leer de Firebase
                    const _orbeUid = typeof currentUser !== 'undefined' && currentUser ? currentUser.uid : null;
                    const _orbeBase = summonerName.replace(/ v\d+$/, '');
                    if (_orbeUid && typeof db !== 'undefined') {
                        db.ref('users/' + _orbeUid + '/characters/' + _orbeBase + '/slots_v2').once('value').then(function(snap) {
                            const slots = snap.val() || {};
                            const relicNames = Object.values(slots).filter(Boolean);
                            if (summoner) summoner.equippedRelics = relicNames; // cachear para futuras invocaciones
                            _orbeCheck(relicNames);
                        });
                    }
                }

                // Huevo de Dragón: la invocación gana Esquiva Área permanente si el invocador tiene esta reliquia
                if ((summoner.equippedRelics||[]).some(function(r){ return r === 'Huevo de Dragon'; })) {
                    const _hdSummon = gameState.summons[summonId];
                    _hdSummon.statusEffects = _hdSummon.statusEffects || [];
                    _hdSummon.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: false, emoji: '💨' });
                    addLog('🐲 Huevo de Dragón: ' + shadowName + ' gana Esquiva Área', 'buff');
                }

                addLog(`👻 ${summonerName} invoca a ${shadowName}!`, 'buff');
                // ── EL CARCELERO DE LOS MALDITOS (Bolvar PERSONAJE): +5 cargas al invocarse cualquier invocación ──
                // Sin guardia passiveExecuting — debe dispararse siempre, incluyendo invocaciones del equipo enemigo
                for (const _bpIN in gameState.characters) {
                    const _bpIC = gameState.characters[_bpIN];
                    if (!_bpIC || _bpIC.isDead || _bpIC.hp <= 0 || !_bpIC.passive) continue;
                    if (_bpIC.passive.name !== 'El Carcelero de los Malditos') continue;
                    _bpIC.charges = Math.min(20, (_bpIC.charges||0) + 5);
                    addLog('⚔️ El Carcelero de los Malditos: ' + _bpIN + ' genera 5 cargas (invocación realizada)', 'buff');
                    break;
                }
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

            // ── ANILLO DEL TIEMPO: al morir → revivir UNA VEZ con 100% HP + 20 cargas + turno adicional ──
            // (Character death check is in applyDamageWithShield — handled below)

            // ── MORDEDURA (Cría de Dragón): al morir → Rhaenyra genera 3 cargas ──
            if (summon.name === 'Cría de Dragón' && reason === 'derrotado' && summon.summoner) {
                const _criaRhae = gameState.characters[summon.summoner];
                if (_criaRhae && !_criaRhae.isDead && _criaRhae.hp > 0) {
                    _criaRhae.charges = Math.min(20, (_criaRhae.charges||0) + 3);
                    addLog('🐉 Mordedura: ' + summon.summoner + ' genera 3 cargas (Cría de Dragón eliminada)', 'buff');
                }
            }

            // ── EXPLOSIÓN (Fake Black): al morir → 3 daño a 3 enemigos aleatorios + 3 cargas al equipo aliado ──
            if (summon.name === 'Fake Black' && reason === 'derrotado') {
                const _fbETeam = summon.team === 'team1' ? 'team2' : 'team1';
                const _fbEnemies = Object.keys(gameState.characters).filter(function (n) {
                    const c = gameState.characters[n];
                    return c && c.team === _fbETeam && !c.isDead && c.hp > 0;
                });
                const _fbTargets = _fbEnemies.sort(function () { return Math.random() - 0.5; }).slice(0, 3);
                _fbTargets.forEach(function (n) {
                    if (typeof applyDamageWithShield === 'function') applyDamageWithShield(n, 3, null); // daño directo
                });
                if (_fbTargets.length > 0) addLog('⚫ Explosión: Fake Black causa 3 daño a ' + _fbTargets.join(', ') + ' al morir', 'damage');
                for (const _fbAn in gameState.characters) {
                    const _fbAc = gameState.characters[_fbAn];
                    if (!_fbAc || _fbAc.isDead || _fbAc.hp <= 0 || _fbAc.team !== summon.team) continue;
                    _fbAc.charges = Math.min(20, (_fbAc.charges || 0) + 3);
                }
                addLog('⚫ Explosión: equipo aliado gana 3 cargas (Fake Black eliminado)', 'buff');
            }

            // ── VÍNCULO DORADO (Syrax): al morir → retirar buffs de Rhaenyra ──
            if (summon.name === 'Syrax' && summon.summoner) {
                addLog('🔥 Syrax ha caído — los buffs de Vínculo Dorado expiran', 'info');
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

            // ── MIN BYUNG: al ser eliminada genera 3 cargas a todos los aliados ──
            if (summon.name === 'MinByung' && typeof triggerMinByungOnDeath === 'function') {
                triggerMinByungOnDeath(summon.team);
            }
            // ── ANIMA VORAX: al morir una invocación del portador, drena 5 cargas de todos los enemigos ──
            if (summon.summoner) {
                const _avOwner = gameState.characters[summon.summoner];
                if (_avOwner && (_avOwner.equippedRelics||[]).includes('Anima Vorax')) {
                    const _avOwnerETeam = _avOwner.team === 'team1' ? 'team2' : 'team1';
                    let _avDrained = 0;
                    for (const _avEn in gameState.characters) {
                        const _avEc = gameState.characters[_avEn];
                        if (!_avEc || _avEc.team !== _avOwnerETeam || _avEc.isDead || _avEc.hp <= 0) continue;
                        const _avSteal = Math.min(5, _avEc.charges || 0);
                        if (_avSteal > 0) { _avEc.charges -= _avSteal; _avDrained += _avSteal; }
                    }
                    if (_avDrained > 0) {
                        _avOwner.charges = Math.min(20, (_avOwner.charges||0) + _avDrained);
                        addLog('🗡️ Anima Vorax: ' + summon.summoner + ' drena ' + _avDrained + ' cargas del equipo enemigo (' + summon.name + ' eliminada)', 'buff');
                    }
                }
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
            // Limpiar cualquier invocación que quedó con hp <= 0 sin ser removida
            for (let sid in gameState.summons) {
                const s = gameState.summons[sid];
                if (s && s.hp <= 0 && !s._skipDeathPassive) {
                    removeSummon(sid, 'derrotado');
                }
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

            // ── VÍNCULO DORADO (Syrax): al recibir ataque → aplica Quemadura Solar al atacante ──
            if (summon.name === 'Syrax' && attackerName && damage > 0 && !passiveExecuting) {
                if (typeof applySolarBurn === 'function') {
                    passiveExecuting = true;
                    applySolarBurn(attackerName, 10, 2);
                    addLog('🔥 Vínculo Dorado (Syrax): ' + attackerName + ' recibe Quemadura Solar', 'debuff');
                    passiveExecuting = false;
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
            // LÍMITE: máximo 5 invocaciones vivas por equipo (mismo límite universal que aplica
            // a cualquier invocación del juego, sin importar el origen)
            const _fbTeamCount = Object.values(gameState.summons).filter(function (s) {
                return s && s.team === summoner.team && !s.isDead && (s.hp === undefined || s.hp > 0);
            }).length;
            if (_fbTeamCount >= 5) {
                addLog('⚫ Fake Black no pudo invocarse — límite de 5 invocaciones por equipo alcanzado', 'info');
                return;
            }
            const summonId = 'FakeBlack_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            gameState.summons[summonId] = {
                id: summonId, name: 'Fake Black',
                hp: 2, maxHp: 2, summoner: summonerName, team: summoner.team,
                statusEffects: [], img: 'https://i.ibb.co/V0N5r6WR/Whats-App-Image-2026-03-31-at-1-22-44-PM.jpg',
                passive: 'Explosión: Al inicio de cada ronda, cura 3 HP a Goku Black y a un aliado aleatorio. Al morir, causa 3 puntos de daño a 3 enemigos aleatorios y genera 3 puntos de carga en el equipo aliado.',
                dragonEffect: 'fake_black_explosion', megaProvocation: false
            };
            addLog('Fake Black invocado por ' + summonerName, 'buff');
        }

        function summonDragon(dragonName, summoner, team) {
            // Check if already summoned
            const alreadySummoned = Object.values(gameState.summons).some(s => s && s.name === dragonName && s.summoner === summoner && !s.isDead && (s.hp === undefined || s.hp > 0));
            if (alreadySummoned) { addLog('🐉 ' + dragonName + ' ya está invocado', 'info'); return; }
            // LÍMITE GENERAL: máximo 5 invocaciones vivas por equipo (mismo límite que summonShadow)
            const _drTeamCount = Object.values(gameState.summons).filter(s => s && s.team === team && !s.isDead && (s.hp === undefined || s.hp > 0)).length;
            if (_drTeamCount >= 5) { addLog('🐉 ' + dragonName + ' no pudo invocarse — límite de 5 invocaciones por equipo alcanzado', 'info'); return; }
            const dragonStats = {
                'Drogon':  { hp: 15, maxHp: 15, effect: 'mega_prov_aoe_dmg', passive: '🔥 Sombra de Fuego: Inflige 3 daño AOE al equipo enemigo al final de cada ronda. Cada vez que Daenerys recibe daño, causa el mismo daño al atacante.' },
                'Rhaegal': { hp: 8, maxHp: 8, effect: 'burn_team', passive: '🟢 Al final de cada ronda aplica Quemadura 1 HP por 1 turno a todo el equipo enemigo.' },
                'Viserion': { hp: 6, maxHp: 6, effect: 'heal_team', passive: '⚪ Al final de cada ronda cura 2 HP a todo el equipo aliado.' }
            };
            const stats = dragonStats[dragonName] || { hp: 8, maxHp: 8, effect: '' };
            const sId = dragonName + '_' + Date.now();
            gameState.summons[sId] = {
                name: dragonName, summoner: summoner, team: team,
                hp: stats.hp, maxHp: stats.maxHp, isDead: false, statusEffects: [],
                dragonEffect: stats.effect, passive: stats.passive || 'Pasiva especial de dragón',
                megaProvocation: false // Drogon ya no tiene Megaprovocación
            };
            // ── HUEVO DE DRAGÓN: si el invocador lleva esta reliquia equipada, el dragón gana
            //    Esquiva Área permanente. El check vive aquí (summonDragon) y en summonShadow —
            //    los dragones de Daenerys usan summonDragon, NO summonShadow, por eso el buff
            //    nunca se aplicaba a pesar del check que ya existía en la otra función. ──
            const _summonerChar = gameState.characters[summoner];
            if (_summonerChar && (_summonerChar.equippedRelics || []).includes('Huevo de Dragon')) {
                gameState.summons[sId].statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: false, emoji: '💨' });
                addLog('🐲 Huevo de Dragón: ' + dragonName + ' gana Esquiva Área', 'buff');
            }
            renderSummons();
            addLog('🐉 ' + summoner + ' invoca a ' + dragonName + ' (' + stats.hp + ' HP)', 'buff');
        }

        function renderSummons() {
            const team1Container = document.getElementById('team1Summons');
            const team2Container = document.getElementById('team2Summons');
            
            if (!team1Container || !team2Container) return;
            
            team1Container.innerHTML = '';
            team2Container.innerHTML = '';

            // Limpiar invocaciones con hp <= 0 que no fueron eliminadas correctamente
            Object.keys(gameState.summons).forEach(function(sid) {
                const s = gameState.summons[sid];
                if (s && (s.hp <= 0 || s.isDead)) {
                    console.warn('[renderSummons] limpiando invocación fantasma:', s.name, sid);
                    delete gameState.summons[sid];
                }
            });
            
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
        // Activa las pasivas de todas las invocaciones vivas del equipo del portador — usada por
        // la reliquia Anima Vorax. Replica el mismo conjunto de disparos que ya usa "Dominio del
        // activateOwnerSummonPassives: activa las pasivas de TODAS las invocaciones del portador.
        // Universal para cualquier invocador (SJW, Marik, Ozymandias, Rhaenyra, etc.)
        // y para invocaciones nuevas que se agreguen en el futuro.
        function activateOwnerSummonPassives(ownerName) {
            const owner = gameState.characters[ownerName];
            if (!owner) return;
            const _avShadows = Object.entries(gameState.summons || {}).filter(function(e){
                return e[1] && e[1].team === owner.team && e[1].hp > 0;
            });
            if (_avShadows.length === 0) return;
            const enemyTeam = owner.team === 'team1' ? 'team2' : 'team1';

            _avShadows.forEach(function(entry) {
                const summon = entry[1];
                switch (summon.name) {
                    case 'Igris':
                        if (typeof triggerIgrisPassive === 'function') triggerIgrisPassive(ownerName);
                        break;
                    case 'Beru':
                        if (typeof triggerBeruPassive === 'function') triggerBeruPassive();
                        break;
                    case 'Kaisel':
                        if (typeof triggerKaiselPassive === 'function') triggerKaiselPassive();
                        if (typeof triggerKaiselStartOfRound === 'function') triggerKaiselStartOfRound();
                        break;
                    case 'MinByung':
                        if (typeof triggerMinByungStartOfRound === 'function') triggerMinByungStartOfRound();
                        break;
                    case 'Jima':
                        if (typeof triggerJimaStartOfRound === 'function') triggerJimaStartOfRound();
                        break;
                    case 'Greed':
                        if (typeof triggerGreedEndOfRound === 'function') triggerGreedEndOfRound();
                        break;
                    case 'Bellion': {
                        const _bellEn = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c&&c.team===enemyTeam&&!c.isDead&&c.hp>0; });
                        if (_bellEn.length > 0) {
                            const _bt = _bellEn[Math.floor(Math.random()*_bellEn.length)];
                            const _bd = 2 * _avShadows.length;
                            applyDamageWithShield(_bt, _bd, 'Bellion');
                            addLog('Bellion (General de Ashborn): ' + _bd + ' dano a ' + _bt + ' (2 x ' + _avShadows.length + ' sombras)', 'damage');
                        }
                        break;
                    }
                    case 'Iron':
                        for (const _ian in gameState.characters) { const _iac=gameState.characters[_ian]; if(!_iac||_iac.team!==owner.team||_iac.isDead||_iac.hp<=0) continue; generateChargesInline(_ian,3); }
                        addLog('Iron (Voluntad de Acero): equipo aliado gana 3 cargas', 'buff');
                        break;
                    case 'Tusk': {
                        const _tEn = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c&&c.team===enemyTeam&&!c.isDead&&c.hp>0; }).sort(function(){ return Math.random()-0.5; }).slice(0,2);
                        _tEn.forEach(function(_te){ if(typeof applyFlatBurn==='function') applyFlatBurn(_te,2,1); addLog('Tusk (Himno de Fuego): Quemaduras 2HP 1T a '+_te,'debuff'); });
                        break;
                    }
                    default:
                        // Invocacion generica: el log general al final es suficiente
                        break;
                }
            });

            addLog('Anima Vorax: pasivas de las invocaciones de ' + ownerName + ' activadas', 'buff');
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

                    // NUEVO: elimina Buff Reflejar, Escudo Sagrado y Protección Sagrada de todos los enemigos
                    const _igrisRemoveNames = ['reflejar', 'escudo sagrado', 'proteccion sagrada'];
                    for (const _rn in gameState.characters) {
                        const _rc = gameState.characters[_rn];
                        if (!_rc || _rc.team !== enemyTeam || _rc.isDead || _rc.hp <= 0 || !_rc.statusEffects) continue;
                        const _beforeLen = _rc.statusEffects.length;
                        _rc.statusEffects = _rc.statusEffects.filter(function(e) {
                            return !(e && _igrisRemoveNames.indexOf(normAccent(e.name||'')) !== -1);
                        });
                        if (_rc.statusEffects.length < _beforeLen) {
                            addLog('Igris (Comandante Rojo): elimina Reflejar/Escudo Sagrado/Protección Sagrada de ' + _rn, 'debuff');
                        }
                    }

                    // Comandante Rojo Sangriento: 2 dano AOE base + 3 adicional por cada invocación
                    // que ESTE Igris haya eliminado en la partida (contador acumulado)
                    const _igrisDmg = 2 + 3 * (igris.summonsEliminatedCount || 0);
                    // Temporarily disable passiveExecuting so Garou's counter can trigger
                    passiveExecuting = false;
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                        applyDamageWithShield(_n, _igrisDmg, 'Igris');
                    }
                    passiveExecuting = true;
                    for (const _sid in gameState.summons) {
                        const _s = gameState.summons[_sid];
                        if (!_s || _s.team !== enemyTeam || _s.hp <= 0 || _sid === igrisId) continue;
                        applySummonDamage(_sid, _igrisDmg, 'Igris');
                    }
                    addLog('Igris (Comandante Rojo): ' + _igrisDmg + ' daño AOE a todos los enemigos' + (igris.summonsEliminatedCount ? ' (base 2 + 3×' + igris.summonsEliminatedCount + ' invocaciones eliminadas)' : ''), 'damage');
                    // Eliminar 1 invocacion enemiga aleatoria
                    const enemySummonIds = Object.keys(gameState.summons).filter(sid => {
                        const _s = gameState.summons[sid];
                        return _s && _s.team === enemyTeam && _s.hp > 0;
                    });
                    if (enemySummonIds.length > 0) {
                        const toElim = enemySummonIds[Math.floor(Math.random() * enemySummonIds.length)];
                        const elimName = gameState.summons[toElim] ? gameState.summons[toElim].name : 'Invocacion';
                        delete gameState.summons[toElim];
                        igris.summonsEliminatedCount = (igris.summonsEliminatedCount || 0) + 1;
                        addLog('Igris: Elimina a ' + elimName + ' del campo enemigo (total eliminadas por este Igris: ' + igris.summonsEliminatedCount + ')', 'damage');
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

        // Pasiva de Kaisel: fin de ronda → reduce 3 cargas a todos los enemigos
        function triggerKaiselPassive() {
            if (passiveExecuting) return;
            Object.keys(gameState.summons).forEach(function(kaisId) {
                const kais = gameState.summons[kaisId];
                if (!kais || kais.name !== 'Kaisel' || kais.hp <= 0) return;
                passiveExecuting = true;
                const enemyTeam = kais.team === 'team1' ? 'team2' : 'team1';
                // Maldición de Kaisel: reduce 3 cargas a TODOS los enemigos
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                    _c.charges = Math.max(0, (_c.charges||0) - 3);
                    addLog('🐉 Kaisel (Maldición): ' + _n + ' pierde 3 cargas', 'debuff');
                }
                passiveExecuting = false;
            });
        }

        // Kaisel: inicio de ronda → 2 stacks de Veneno a todos los enemigos
        function triggerKaiselStartOfRound() {
            Object.keys(gameState.summons).forEach(function(kaisId) {
                const kais = gameState.summons[kaisId];
                if (!kais || kais.name !== 'Kaisel' || kais.hp <= 0) return;
                const enemyTeam = kais.team === 'team1' ? 'team2' : 'team1';
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                    if (typeof applyPoison === 'function') applyPoison(_n, 2);
                }
                addLog('🐉 Kaisel (Maldición): 2 stacks de Veneno aplicados a todos los enemigos', 'debuff');
            });
        }

        // Greed: fin de ronda → 50% Sangrado 1T + 50% Miedo 1T a cada enemigo + 1 daño por debuff del equipo enemigo
        function triggerGreedEndOfRound() {
            Object.keys(gameState.summons).forEach(function(gid) {
                const greed = gameState.summons[gid];
                if (!greed || greed.name !== 'Greed' || greed.hp <= 0) return;
                const enemyTeam = greed.team === 'team1' ? 'team2' : 'team1';
                // 50% Sangrado + 50% Miedo a cada enemigo
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                    if (Math.random() < 0.50) {
                        if (typeof applyBleed === 'function') applyBleed(_n, 1);
                        else if (typeof applyDebuff === 'function') applyDebuff(_n, { name: 'Sangrado', type: 'debuff', duration: 1, emoji: '🩸' });
                        addLog('🩸 Greed (Sed de Sangre): Sangrado 1T aplicado a ' + _n + ' (50%)', 'debuff');
                    }
                    if (Math.random() < 0.50) {
                        if (typeof applyDebuff === 'function') applyDebuff(_n, { name: 'Miedo', type: 'debuff', duration: 1, emoji: '😱' });
                        addLog('😱 Greed (Sed de Sangre): Miedo 1T aplicado a ' + _n + ' (50%)', 'debuff');
                    }
                }
                // 1 daño directo a cada enemigo por cada debuff activo en el equipo enemigo
                let totalDebuffs = 0;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                    totalDebuffs += (_c.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff'; }).length;
                }
                if (totalDebuffs > 0) {
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== enemyTeam || _c.isDead || _c.hp <= 0) continue;
                        _c.hp = Math.max(0, _c.hp - totalDebuffs); // daño directo
                        if (_c.hp <= 0 && !_c.isDead) { _c.isDead = true; if (typeof checkGameOver === 'function') checkGameOver(); }
                    }
                    addLog('🩸 Greed (Sed de Sangre): ' + totalDebuffs + ' daño directo a cada enemigo (' + totalDebuffs + ' debuffs activos en el equipo enemigo)', 'damage');
                }
            });
        }

        // Jima: inicio de ronda → +2 velocidad permanente a cada aliado jugable + Escudo 10 HP a 2 aliados aleatorios
        function triggerJimaStartOfRound() {
            Object.keys(gameState.summons).forEach(function(jid) {
                const jima = gameState.summons[jid];
                if (!jima || jima.name !== 'Jima' || jima.hp <= 0) return;
                const allyTeam = jima.team;
                // +2 velocidad permanente a cada aliado jugable
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== allyTeam || _c.isDead || _c.hp <= 0) continue;
                    _c.speed = (_c.speed||80) + 2;
                }
                addLog('🌊 Jima (Recluse of the Deep Sea): todos los aliados ganan +2 velocidad permanente', 'buff');
                // Escudo 10 HP a 2 aliados aleatorios
                const _jimaAllies = Object.keys(gameState.characters).filter(function(_n){
                    const _c = gameState.characters[_n]; return _c && _c.team === allyTeam && !_c.isDead && _c.hp > 0;
                }).sort(function(){ return Math.random()-0.5; }).slice(0, 2);
                _jimaAllies.forEach(function(_n){
                    const _c = gameState.characters[_n];
                    if (_c) { _c.shield = (_c.shield||0) + 10; }
                    addLog('🌊 Jima (Recluse of the Deep Sea): Escudo 10 HP aplicado a ' + _n, 'buff');
                });
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
                        
                        // Bellion: cancels the move — enemy keeps spending charges (loses them)
                        addLog('🛡️ Bellion (General de Ashborn): cancela ' + abilityType + ' de ' + attackerName + ' (las cargas gastadas se pierden)', 'buff');
                        
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
                        (s.megaProvocation || s.name === 'Caballero de la Muerte')) {
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

        // PASIVA CLON DE KURUMI: absorbe todo el daño dirigido a Kurumi
        function checkKurumiClonProtection(targetName) {
            return Object.keys(gameState.summons).find(function(id) {
                const s = gameState.summons[id];
                return s && s.name === 'Clon de Kurumi' && s.summoner === targetName && !s.isDead && s.hp > 0;
            }) || null;
        }

        function redirectDamageToKurumiClon(clonId, damage, attackerName) {
            const clon = gameState.summons[clonId];
            if (!clon) return damage;
            addLog('🕑 Sombra Protectora: Clon de Kurumi absorbe ' + damage + ' daño dirigido a ' + clon.summoner, 'buff');
            applySummonDamage(clonId, damage, attackerName);
            // Si el Clon murió tras absorber: distribuir 8 daño entre enemigos
            if (gameState.summons[clonId] && (gameState.summons[clonId].isDead || gameState.summons[clonId].hp <= 0)) {
                _onKurumiClonDeath(clonId, clon.team, clon.summoner);
            }
            return 0;
        }

        function _onKurumiClonDeath(clonId, team, summoner) {
            const enemyTeam = team === 'team1' ? 'team2' : 'team1';
            const enemies = Object.keys(gameState.characters).filter(function(n){
                const c = gameState.characters[n]; return c && c.team === enemyTeam && !c.isDead && c.hp > 0;
            });
            if (enemies.length === 0) return;
            // Repartir 8 puntos de daño de forma aleatoria entre los enemigos
            let remaining = 8;
            for (let _i = 0; _i < remaining; _i++) {
                const _target = enemies[Math.floor(Math.random() * enemies.length)];
                applyDamageWithShield(_target, 1, summoner);
            }
            addLog('🕑 Clon de Kurumi eliminado: 8 daño repartido entre los enemigos', 'damage');
        }

        // PASIVA DE IRON: absorbe daño del invocador
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
            el.classList.remove('anim-shake','anim-hit','anim-crit','anim-heal','anim-charge','anim-debuff',
                'anim-over','anim-transform','anim-defeat','anim-pulse-red','anim-pulse-green','anim-pulse-gold',
                'anim-pulse-blue','anim-charge-glow','anim-fire','anim-poison','anim-bleed');
            void el.offsetWidth; // reflow para reiniciar
            el.classList.add(animClass);
            setTimeout(function() { el.classList.remove(animClass); }, durationMs || 600);
        }

        // ── Spawner de partículas visuales (fuego 🔥, veneno ☠️, sangre 🩸) ──
        function _spawnParticles(charName, emoji, count) {
            const id = 'char-' + (charName || '').replace(/\s+/g, '-');
            const el = document.getElementById(id);
            if (!el) return;
            const rect = el.getBoundingClientRect();
            count = count || 3;
            for (var i = 0; i < count; i++) {
                (function(idx) {
                    setTimeout(function() {
                        var p = document.createElement('div');
                        p.className = 'vfx-particle';
                        var px = (Math.random() - 0.5) * 30;
                        p.style.setProperty('--px', px + 'px');
                        p.style.left = (rect.left + rect.width  * 0.15 + Math.random() * rect.width  * 0.70) + 'px';
                        p.style.top  = (rect.top  + rect.height * 0.10 + Math.random() * rect.height * 0.60) + 'px';
                        p.textContent = emoji;
                        document.body.appendChild(p);
                        setTimeout(function() { if (p.parentNode) p.remove(); }, 950);
                    }, idx * 100);
                })(i);
            }
        }
        window._spawnParticles = _spawnParticles;

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

        // ══════════════════════════════════════════════════════════════════════
        // TAJO DE ESPADA — efecto visual de ataque (🗡️), estilo Yu-Gi-Oh.
        // Se dispara desde _executeAbilityCore / applyDamageWithShield según el `target` de la
        // habilidad (single/aoe/mt) — solo en Básicos y Especiales, nunca en Over.
        // ══════════════════════════════════════════════════════════════════════

        // ST: la espada viaja de la tarjeta del atacante a la del objetivo, apuntando hacia él
        function _spawnSwordSlashST(attackerName, targetName) {
            const elA = document.getElementById('char-' + (attackerName || '').replace(/\s+/g, '-'));
            const elT = document.getElementById('char-' + (targetName || '').replace(/\s+/g, '-'));
            if (!elA || !elT) return;
            const rA = elA.getBoundingClientRect();
            const rT = elT.getBoundingClientRect();
            const sx = rA.left + rA.width / 2;
            const sy = rA.top + rA.height / 2;
            const ex = rT.left + rT.width / 2;
            const ey = rT.top + rT.height / 2;
            // 🗡️ (daga) en reposo tiene la punta apuntando hacia ABAJO ≈ 90° en coordenadas de
            // pantalla (0°=derecha, 90°=abajo); se resta ese offset para que la PUNTA quede
            // orientada hacia el objetivo real, sin importar en qué dirección esté.
            const ang = (Math.atan2(ey - sy, ex - sx) * 180 / Math.PI) - 90;
            const el = document.createElement('div');
            el.className = 'sword-slash sword-st';
            el.textContent = '🗡️';
            el.style.setProperty('--sx', sx + 'px');
            el.style.setProperty('--sy', sy + 'px');
            el.style.setProperty('--ex', ex + 'px');
            el.style.setProperty('--ey', ey + 'px');
            el.style.setProperty('--ang', ang + 'deg');
            document.body.appendChild(el);
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 680);
        }
        window._spawnSwordSlashST = _spawnSwordSlashST;

        // AOE: la espada aparece al centro de pantalla, se desplaza hacia la primera tarjeta
        // (izquierda) del equipo objetivo, y luego barre de izquierda a derecha sobre toda la fila
        function _spawnSwordSlashAOE(targetTeam) {
            const containerId = targetTeam === 'team1' ? 'team1Characters' : 'team2Characters';
            const container = document.getElementById(containerId);
            if (!container) return;
            const r = container.getBoundingClientRect();
            const sy = r.top + r.height / 2;
            const sx = r.left + 20; // posición de la primera tarjeta (izquierda) de la fila
            const ex = r.right - 20; // posición de la última tarjeta (derecha) de la fila
            const ey = sy;
            const cx = window.innerWidth / 2; // punto de aparición: centro de la pantalla
            const cy = window.innerHeight / 2;
            // La fila objetivo puede estar ARRIBA o ABAJO del punto de aparición (depende de qué
            // jugador ataca a quién). El 🗡️ en reposo apunta hacia ABAJO (0°) — si el objetivo
            // está arriba, se le suma 180° a toda la secuencia de rotación para invertir la punta
            // (apuntando hacia arriba) manteniendo el mismo barrido de izquierda a derecha.
            const _flip = (sy < cy) ? 180 : 0;
            const rotSteps = [-60, -15, 5, 15, 25, 30].map(function (d) { return (d + _flip) + 'deg'; });
            const el = document.createElement('div');
            el.className = 'sword-slash sword-aoe';
            el.textContent = '🗡️';
            el.style.setProperty('--cx', cx + 'px');
            el.style.setProperty('--cy', cy + 'px');
            el.style.setProperty('--sx', sx + 'px');
            el.style.setProperty('--sy', sy + 'px');
            el.style.setProperty('--ex', ex + 'px');
            el.style.setProperty('--ey', ey + 'px');
            el.style.setProperty('--r0', rotSteps[0]);
            el.style.setProperty('--r1', rotSteps[1]);
            el.style.setProperty('--r2', rotSteps[2]);
            el.style.setProperty('--r3', rotSteps[3]);
            el.style.setProperty('--r4', rotSteps[4]);
            el.style.setProperty('--r5', rotSteps[5]);
            document.body.appendChild(el);
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
        }
        window._spawnSwordSlashAOE = _spawnSwordSlashAOE;

        // MT: tajo en el sitio, solo sobre la tarjeta del objetivo golpeado — secuencial vía
        // `hitIndex` (cada golpe se retrasa un poco más que el anterior, sin frenar la lógica real)
        function _spawnSwordSlashMT(targetName, hitIndex) {
            const el2 = document.getElementById('char-' + (targetName || '').replace(/\s+/g, '-'));
            if (!el2) return;
            const r = el2.getBoundingClientRect();
            const sx = r.left + r.width / 2;
            const sy = r.top + r.height / 2;
            const delay = (hitIndex || 0) * 400;
            setTimeout(function () {
                const el = document.createElement('div');
                el.className = 'sword-slash sword-mt';
                el.textContent = '🗡️';
                el.style.setProperty('--sx', sx + 'px');
                el.style.setProperty('--sy', sy + 'px');
                document.body.appendChild(el);
                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 620);
            }, delay);
        }
        window._spawnSwordSlashMT = _spawnSwordSlashMT;
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
            // Capturar y consumir el flag de fuente de daño por debuff (Visión Esmeralda) — se setea antes
            // de la llamada desde los procesadores de fin de ronda de Quemadura/Veneno/Sangrado/Hemorragia
            const _debuffDamageSource = gameState._currentDamageSource || null;
            gameState._currentDamageSource = null;
            // ── SFX: Hit sound — only for direct hits, not DOT (Veneno/Quemadura/Sangrado/Hemorragia) ──
            if (damage > 0 && !_debuffDamageSource && !passiveExecuting) {
                var _sfxHit = document.getElementById('sfxHit');
                if (_sfxHit && typeof audioManager !== 'undefined' && !audioManager.muted) {
                    _sfxHit.currentTime = 0; _sfxHit.volume = 0.5; _sfxHit.play().catch(function(){});
                }
            }
            // ── EL OJO QUE TODO LO VE (Sauron): consumir banderas puestas en skills.js —
            //    3 Raras → Mega Posesión al objetivo golpeado; Capa → roba 8 HP del objetivo.
            //    NO se resetean aquí — un AOE golpea a varios objetivos con applyDamageWithShield
            //    varias veces seguidas, y el efecto debe aplicar a TODOS los golpeados, no solo al
            //    primero. El reset real vive en skills.js, al inicio de cada ejecución de habilidad.
            if (damage > 0 && attackerName !== null && !passiveExecuting) {
                const _saAtkChar = gameState.characters[attackerName];
                const _saTgtChar = gameState.characters[targetName];
                if (gameState._sauronAppliesMegaPosesion && _saTgtChar && !_saTgtChar.isDead && _saTgtChar.hp > 0) {
                    if (typeof applyMegaPosesion === 'function') applyMegaPosesion(targetName, 2);
                    addLog('👁️ El Ojo que Todo lo Ve: Mega Posesión aplicada a ' + targetName + ' (3 Raras)', 'debuff');
                }
                if (gameState._sauronCapaSteal && _saTgtChar && !_saTgtChar.isDead && _saTgtChar.hp > 0 && _saAtkChar) {
                    const _saStealAmt = Math.min(gameState._sauronCapaSteal, _saTgtChar.hp);
                    _saTgtChar.hp = Math.max(0, _saTgtChar.hp - _saStealAmt);
                    if (typeof applyHeal === 'function') applyHeal(attackerName, _saStealAmt, 'El Ojo que Todo lo Ve (Capa)');
                    else _saAtkChar.hp = Math.min(_saAtkChar.maxHp, (_saAtkChar.hp || 0) + _saStealAmt);
                    addLog('👁️ El Ojo que Todo lo Ve: ' + attackerName + ' roba ' + _saStealAmt + ' HP de ' + targetName + ' (Capa)', 'heal');
                }
            }
            // ── GUANTE DE SCORPIO: todos los ataques del portador aplican 1-5 stacks de Veneno
            //    por cada golpe acertado sobre el objetivo ──
            if (damage > 0 && attackerName !== null && !passiveExecuting) {
                const _gsAtk = gameState.characters[attackerName];
                const _gsTgt = gameState.characters[targetName];
                if (_gsAtk && (_gsAtk.equippedRelics || []).includes('Guante de Scorpio') && _gsTgt && !_gsTgt.isDead && _gsTgt.hp > 0) {
                    const _gsStacks = Math.floor(Math.random() * 5) + 1; // 1 a 5
                    if (typeof applyPoison === 'function') applyPoison(targetName, _gsStacks);
                }
            }
            // ── KAMA: acumular daño total causado por el portador (se consume al final de
            //    _executeAbilityCore en skills.js para robar ese total de HP a un enemigo) ──
            if (damage > 0 && attackerName !== null && !passiveExecuting &&
                attackerName === gameState._kamaAttackerName) {
                const _kamaAtkC = gameState.characters[attackerName];
                if (_kamaAtkC && (_kamaAtkC.equippedRelics || []).some(function (rn) {
                    const rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[rn] : null;
                    return rd && rd.effect === 'kama';
                })) {
                    gameState._kamaDmgTotal = (gameState._kamaDmgTotal || 0) + damage;
                }
            }
            // ── GUNBAI: bloqueo de categoría aleatoria en el objetivo golpeado por el portador ──
            if (damage > 0 && attackerName !== null && !passiveExecuting) {
                const _gbAtkC = gameState.characters[attackerName];
                const _gbTgtC = gameState.characters[targetName];
                if (_gbAtkC && _gbTgtC && !_gbTgtC.isDead && _gbTgtC.hp > 0 &&
                    (_gbAtkC.equippedRelics || []).some(function (rn) {
                        const rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[rn] : null;
                        return rd && rd.effect === 'gunbai';
                    })) {
                    // Sortear categoría aleatoria: ST, MT, AOE o SELF
                    const _gbCats = ['single', 'mt', 'aoe', 'self'];
                    const _gbCatChosen = _gbCats[Math.floor(Math.random() * _gbCats.length)];
                    const _gbCatLabel = { single: 'ST', mt: 'MT', aoe: 'AOE', self: 'SELF' }[_gbCatChosen];
                    // Solo aplica si el objetivo no tiene ya ese bloqueo activo
                    const _gbAlreadyBlocked = (_gbTgtC.statusEffects || []).some(function (e) {
                        return e && e.gunbaiBlockCategory === _gbCatChosen;
                    });
                    if (!_gbAlreadyBlocked) {
                        (_gbTgtC.statusEffects = _gbTgtC.statusEffects || []).push({
                            name: 'Bloqueo: ' + _gbCatLabel, type: 'debuff', duration: 2,
                            emoji: '🌀', permanent: false, gunbaiBlockCategory: _gbCatChosen
                        });
                        addLog('🌀 Gunbai: ' + targetName + ' pierde acceso a habilidades ' + _gbCatLabel + ' por 2 turnos', 'debuff');
                    }
                }
            }
            // ── YAUTJA HONOR CODE (Depredador): dos ganchos independientes al inicio del
            //    procesamiento de daño ──
            if (damage > 0 && attackerName !== null && !passiveExecuting) {
                const _ycTgt = gameState.characters[targetName];
                const _ycAtkC = gameState.characters[attackerName];
                // 1) Reducción de daño 50%: si QUIEN ATACA tiene marca (de cualquier tipo) y el
                //    OBJETIVO es Depredador
                if (_ycTgt && _ycTgt.passive && _ycTgt.passive.name === 'Yautja Honor Code' && _ycAtkC) {
                    const _ycAtkMarked = ((_ycAtkC._marcaCazadorPermanente || 0) + (_ycAtkC._marcaCazadorTemporal || 0)) > 0;
                    if (_ycAtkMarked) {
                        damage = Math.ceil(damage * 0.5);
                        addLog('🎯 Yautja Honor Code: ' + attackerName + ' está marcado — daño reducido 50% contra Depredador', 'buff');
                    }
                }
                // 2) La marca del cazador TEMPORAL se elimina de quien la lleva (el objetivo) al
                //    recibir un golpe de un ataque enemigo
                if (_ycTgt && (_ycTgt._marcaCazadorTemporal || 0) > 0) {
                    addLog('🎯 Yautja Honor Code: marca del cazador temporal de ' + targetName + ' se elimina al recibir un golpe', 'debuff');
                    _ycTgt._marcaCazadorTemporal = 0;
                }
            }
            // ── TAJO DE ESPADA (MT): un tajo por cada golpe real de una habilidad MT, escalonado
            //    de forma secuencial. No aplica a daño directo (attackerName===null) ni a Over. ──
            if (damage > 0 && attackerName !== null && !passiveExecuting && gameState.selectedAbility &&
                gameState.selectedAbility.target === 'mt' && gameState.selectedAbility.type !== 'over' &&
                typeof window._spawnSwordSlashMT === 'function') {
                window._spawnSwordSlashMT(targetName, gameState._mtHitCounter || 0);
                gameState._mtHitCounter = (gameState._mtHitCounter || 0) + 1;
            }
            // ── ESPADA NICHIRIN NEGRA: daño doble a objetivos con Quemadura Solar ──
            // Vive AQUÍ (no en el bloque de "bonos pre-ataque" de un solo objetivo) para que
            // funcione en CADA golpe individual, sea un ataque de un solo objetivo o AOE/multi-golpe
            // (antes solo se revisaba una vez contra un único objetivo, así que en un AOE como
            // "Dragon's Fear" de Antares nunca se aplicaba a ninguno de los enemigos golpeados).
            if (!passiveExecuting && attackerName && damage > 0) {
                const _ennAtk = gameState.characters[attackerName];
                if (_ennAtk && (_ennAtk.equippedRelics||[]).includes('Espada Nichirin Negra')) {
                    const _ennTgt0 = gameState.characters[targetName];
                    const _ennHasQS = _ennTgt0 && (_ennTgt0.statusEffects||[]).some(function(e){ return e && e.name && e.name.toLowerCase().includes('solar'); });
                    if (_ennHasQS) {
                        damage = damage * 2;
                        addLog('🗡️ Espada Nichirin Negra: daño doble vs Quemadura Solar (' + damage + ')', 'buff');
                    }
                }
            }
            // ── HI NO ISHI (Tsunade): si un aliado (no ella misma) va a recibir daño por golpe
            //    (attackerName !== null, no aplica a daño directo de debuffs/habilidades), la
            //    mitad del daño la absorbe Tsunade en su lugar ──
            if (!passiveExecuting && attackerName !== null && damage > 0) {
                const _tsTgtChar = gameState.characters[targetName];
                if (_tsTgtChar && !_tsTgtChar.isDead) {
                    for (const _tsN in gameState.characters) {
                        const _tsC = gameState.characters[_tsN];
                        if (!_tsC || _tsC.isDead || _tsC.hp <= 0 || _tsN === targetName) continue;
                        if (_tsC.team !== _tsTgtChar.team) continue;
                        if (!_tsC.passive || _tsC.passive.name !== 'Hi no Ishi') continue;
                        const _tsHalfTarget = Math.floor(damage / 2);
                        const _tsHalfTsunade = damage - _tsHalfTarget;
                        damage = _tsHalfTarget;
                        addLog('🩹 Hi no Ishi: ' + _tsN + ' absorbe ' + _tsHalfTsunade + ' del daño dirigido a ' + targetName, 'buff');
                        passiveExecuting = true;
                        applyDamageWithShield(_tsN, _tsHalfTsunade, attackerName);
                        passiveExecuting = false;
                        break;
                    }
                }
            }
            // ── CABALLERO DE LA NOCHE (Batman): inmune a daño de movimientos especiales ──
            if (!passiveExecuting && gameState.selectedAbility && gameState.selectedAbility.type === 'special') {
                const _batTarget = gameState.characters[targetName];
                if (_batTarget && _batTarget.passive && _batTarget.passive.name === 'Caballero de la Noche') {
                    addLog('🦇 Caballero de la Noche: Batman es inmune al especial de ' + (attackerName||'enemigo'), 'buff');
                    return;
                }
            }
            // ── ÚLTIMO HÉROE DE AMÉRICA (Soldier Boy): inmune a daño de movimientos básicos ──
            if (!passiveExecuting && gameState.selectedAbility && gameState.selectedAbility.type === 'basic') {
                const _sbTarget = gameState.characters[targetName];
                if (_sbTarget && _sbTarget.passive && _sbTarget.passive.name === 'Ultimo Heroe de America') {
                    addLog('🎖️ Último Héroe de América: Soldier Boy es inmune al básico de ' + (attackerName||'enemigo'), 'buff');
                    return;
                }
            }
            // ── CEGUERA: 50% de fallar el ataque ──
            if (!passiveExecuting && attackerName && damage > 0) {
                const _blindAtk = gameState.characters[attackerName];
                if (_blindAtk && (_blindAtk.statusEffects||[]).some(function(e){
                    return e && e.name === 'Ceguera' && e.type === 'debuff';
                })) {
                    if (Math.random() < 0.5) {
                        addLog('👁️ Ceguera: ' + attackerName + ' falla el ataque (50%)', 'debuff');
                        // DESTELLO DE FAWKES: el atacante falló por Ceguera → Fawkes +3HP + 1 daño a cada enemigo
                        const _fwSummon = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Fawkes' && s.hp > 0; });
                        if (_fwSummon && _blindAtk.team !== _fwSummon.team) {
                            passiveExecuting = true;
                            _fwSummon.hp = Math.min(_fwSummon.maxHp, (_fwSummon.hp||0) + 3);
                            addLog('🔥 Destello de Fawkes: Fawkes recupera 3 HP (ataque fallido por Ceguera)', 'heal');
                            const _fwETeam = _fwSummon.team === 'team1' ? 'team2' : 'team1';
                            for (const _fwn in gameState.characters) {
                                const _fwc = gameState.characters[_fwn];
                                if (!_fwc || _fwc.isDead || _fwc.hp <= 0 || _fwc.team !== _fwETeam) continue;
                                applyDamageWithShield(_fwn, 1, null);
                            }
                            addLog('🔥 Destello de Fawkes: 1 daño a cada enemigo', 'damage');
                            passiveExecuting = false;
                        }
                        return; // Miss — no damage applied
                    }
                }
            }
            // Si el targetName es un summon especial (__summon__:id), redirigir a applySummonDamage
            if (typeof targetName === 'string' && targetName.startsWith('__summon__:')) {
                const _sumId = targetName.slice(11);
                return applySummonDamage(_sumId, damage, attackerName);
            }

            const target = gameState.characters[targetName];
            if (!target) return 0;

            // ── SABIDURÍA ANTIGUA (Yoda): INMUNE A TODO DAÑO (directo, DOT, AOE, etc.) ──
            if (target.passive && target.passive.name === 'Sabiduría Antigua') {
                return 0;
            }
            // ── HORROCRUX VIVIENTE (Voldemort): inmune a daño en la ronda que sobrevivió ──
            if (target.passive && target.passive.name === 'Horrocrux Viviente' &&
                target._naginiImmuneRound === gameState.currentRound) {
                addLog('🐍 Horrocrux Viviente: Voldemort es inmune al daño esta ronda (Nagini activa)', 'buff');
                return 0;
            }

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
                // CLON DE KURUMI: absorbe todo el daño dirigido a Kurumi
                const kurumiClonId = checkKurumiClonProtection(targetName);
                if (kurumiClonId) {
                    return redirectDamageToKurumiClon(kurumiClonId, damage, attackerName);
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

            // (Sangrado ahora se procesa al final de ronda — ver processEndOfRoundEffects en turn-logic.js. Ya no se suma al golpe en curso.)

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
            if (attackerName !== null && !passiveExecuting && !gameState._ignoreDodgeActive) {
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

            // ── PECHERA DE MITRIL: si el ataque causa 5+ daño → 50% de no recibirlo ──
            if (!passiveExecuting && damage >= 5 && (target.equippedRelics||[]).includes('Pechera de Mitril')) {
                if (Math.random() < 0.50) {
                    addLog('⚔️ Pechera de Mitril: ' + targetName + ' evita ' + damage + ' de daño (50%)', 'buff');
                    return 0;
                }
            }

            // ── FILO DEL ABISMO: ataques AOE +5 daño en enemigos con buffs activos ──
            if (!passiveExecuting && damage > 0 && attackerName) {
                const _fdaAb = gameState.selectedAbility;
                if (_fdaAb && _fdaAb.target === 'aoe') {
                    const _fdaAtk = gameState.characters[attackerName];
                    if (_fdaAtk && (_fdaAtk.equippedRelics||[]).includes('Filo del Abismo')) {
                        const _tgtBufs = (target.statusEffects||[]).filter(function(e){ return e&&e.type==='buff'; }).length;
                        if (_tgtBufs > 0) { damage += 5; addLog('🪓 Filo del Abismo: +5 daño a ' + targetName + ' (tiene ' + _tgtBufs + ' buffs)', 'buff'); }
                    }
                }
            }

            // ── NARSIL: +2 daño por reliquia Legendaria enemiga, +1 por Épica ──
            if (!passiveExecuting && damage > 0 && attackerName) {
                const _narA = gameState.characters[attackerName];
                if (_narA && (_narA.equippedRelics||[]).includes('Narsil')) {
                    const _narETeam = _narA.team === 'team1' ? 'team2' : 'team1';
                    let _narBonus = 0;
                    for (const _en in gameState.characters) {
                        const _ec = gameState.characters[_en];
                        if (!_ec || _ec.team !== _narETeam) continue;
                        (_ec.equippedRelics||[]).forEach(function(rn) {
                            const rd = typeof RELICS_DATA!=='undefined' ? RELICS_DATA[rn] : null;
                            if (!rd) return;
                            if (rd.tier==='Legendario') _narBonus += 2;
                            else if (rd.tier==='Epico') _narBonus += 1;
                        });
                    }
                    if (_narBonus > 0) { damage += _narBonus; addLog('⚔️ Narsil: +' + _narBonus + ' daño (reliquias enemigas)', 'buff'); }
                }
            }

            // ── SANGRE DE NUMENOR (Aragorn): bono crítico acumulado por contadores de Grito ──
            // El bono se aplica como probabilidad adicional de doblar el daño
            if (!passiveExecuting && damage > 0 && attackerName && (gameState._aragornCritBonus||0) > 0) {
                const _aragAtk = gameState.characters[attackerName];
                if (_aragAtk) {
                    // Buscar si el atacante es del equipo de Aragorn
                    const _aragN = Object.keys(gameState.characters).find(function(_n){
                        const _c = gameState.characters[_n]; return _c && _c.team === _aragAtk.team && _c.passive && _c.passive.name === 'Sangre de Numenor';
                    });
                    if (_aragN && Math.random() < (gameState._aragornCritBonus||0)) {
                        damage *= 2;
                        addLog('⚔️ Sangre de Numenor: ¡CRÍTICO! (+' + Math.round((gameState._aragornCritBonus||0)*100) + '% bonus)', 'buff');
                        // Bono de +2 daño al equipo aliado
                        const _aragTeam = _aragAtk.team;
                        for (const _an in gameState.characters) {
                            const _ac = gameState.characters[_an];
                            if (!_ac || _ac.team !== _aragTeam || _ac.isDead) continue;
                            _ac._aragornDmgBonus = Math.min(1.0, ((_ac._aragornDmgBonus||0) + 0.02)); // máx 100%
                        }
                    }
                }
            }

            // ── BUFF ARMADURA: reduce 50% el daño recibido ──
            if (!passiveExecuting && damage > 0 && hasStatusEffect(targetName, 'Armadura')) {
                damage = Math.ceil(damage / 2);
                addLog('🛡️ Armadura: ' + targetName + ' reduce 50% el daño recibido (' + damage + ' HP)', 'buff');
            }

            // ── THE ONE (Escanor): -50% daño recibido mientras esté en forma The One ──
            if (!passiveExecuting && damage > 0 && target.escanorTheOneActive) {
                damage = Math.ceil(damage / 2);
                addLog('🌟 The One: Escanor reduce 50% el daño recibido (' + damage + ' HP)', 'buff');
            }

            // ── ORGULLO DEL LEÓN (Escanor): -2 daño recibido por cada Quemadura Solar activa en el equipo atacante ──
            if (!passiveExecuting && damage > 0 && target.passive && target.passive.name === 'Orgullo del León') {
                const _olgAtkerTeam = attackerName ? (gameState.characters[attackerName] ? gameState.characters[attackerName].team : null) : null;
                if (_olgAtkerTeam && _olgAtkerTeam !== target.team) {
                    const _olgQsActive = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n];
                        return c && c.team === _olgAtkerTeam && !c.isDead && c.hp > 0 &&
                               (c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'quemadura solar'; });
                    }).length;
                    if (_olgQsActive > 0) {
                        const _olgReduc = _olgQsActive * 2;
                        damage = Math.max(0, damage - _olgReduc);
                        addLog('🦁 Orgullo del León: daño reducido -' + _olgReduc + ' (' + _olgQsActive + ' QS activas → ' + damage + ' daño restante)', 'buff');
                    }
                }
            }

            // ── ORGULLO DEL LEÓN (Escanor): enemigo con QS ataca a Escanor → Mega Provocación 3T sobre Escanor ──
            // (convierte a Escanor en el único objetivo posible los 3 turnos siguientes)
            if (!passiveExecuting && damage > 0 && target.passive && target.passive.name === 'Orgullo del León' && attackerName) {
                const _olgAtk = gameState.characters[attackerName];
                const _olgAtkHasQS = _olgAtk && ((_olgAtk.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'quemadura solar'; }));
                if (_olgAtkHasQS) {
                    const _alreadyMegaProv = (target.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'mega provocacion'; });
                    if (!_alreadyMegaProv) {
                        if (typeof applyBuff === 'function') applyBuff(targetName, { name: 'Mega Provocacion', type: 'buff', duration: 3, emoji: '🔥🦁', megaProvocacion: true });
                        addLog('🦁 Orgullo del León: ' + attackerName + ' tiene QS y ataca a Escanor → Mega Provocación 3T', 'buff');
                    }
                }
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

            // ── ESCUDO DE ESPEJO: 25% de reflejar el ataque al atacante ──
            if (remainingDamage > 0 && attackerName && !passiveExecuting) {
                const _emPortador = gameState.characters[targetName];
                if (_emPortador && (_emPortador.equippedRelics||[]).includes('Escudo de Espejo')) {
                    if (Math.random() < 0.25) {
                        passiveExecuting = true;
                        applyDamageWithShield(attackerName, remainingDamage, targetName);
                        addLog('🪞 Escudo de Espejo: ' + remainingDamage + ' daño reflejado a ' + attackerName, 'damage');
                        passiveExecuting = false;
                    }
                }
            }

            // ── REGLA DE ORO (Gilgamesh): no recibe daño de atacantes con debuffs activos ──
            if (remainingDamage > 0 && attackerName && attackerName !== targetName) {
                const _gilTgt = gameState.characters[targetName];
                const _gilAtk = gameState.characters[attackerName];
                if (_gilTgt && _gilTgt.passive && _gilTgt.passive.name === 'Regla de Oro' && _gilAtk) {
                    const _gilAtkDebuffs = (_gilAtk.statusEffects||[]).filter(e => e && e.type === 'debuff').length;
                    if (_gilAtkDebuffs > 0) {
                        addLog('👑 Regla de Oro: ' + attackerName + ' tiene ' + _gilAtkDebuffs + ' debuff(s) — Gilgamesh no recibe daño', 'buff');
                        return;
                    }
                }
            }

            // ── ZENIT: reduce 50% el daño recibido ───────────────────────────
            if (remainingDamage > 0 && attackerName !== null) {
                const _zenTgt = gameState.characters[targetName];
                if (_zenTgt && (_zenTgt.equippedRelics||[]).indexOf('Zenit') >= 0) {
                    remainingDamage = Math.ceil(remainingDamage * 0.5);
                    damage = remainingDamage; // keep in sync
                }
            }
            
            // AURA DE LATVERIA (Doctor Doom): si es atacado mientras tiene Protección Sagrada
            // o Escudo Sagrado activo, roba 3 cargas de CADA enemigo (sin límite por ronda)
            if (attackerName !== null && target.passive && target.passive.name === 'Aura de Latveria') {
                const _doomHasSagrado = (target.statusEffects||[]).some(function(e) {
                    if (!e || !e.name) return false;
                    const _n = e.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
                    return _n === 'proteccion sagrada' || _n === 'escudo sagrado';
                });
                if (_doomHasSagrado) {
                    const _doomEnemyTeam = target.team === 'team1' ? 'team2' : 'team1';
                    let _doomStolen = 0;
                    Object.keys(gameState.characters).forEach(function (n) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== _doomEnemyTeam || c.isDead || c.hp <= 0) return;
                        const steal = Math.min(3, c.charges || 0);
                        if (steal > 0) {
                            c.charges -= steal;
                            target.charges = Math.min(20, (target.charges || 0) + steal);
                            _doomStolen += steal;
                        }
                    });
                    if (_doomStolen > 0) {
                        addLog('🌩️ Aura de Latveria: Doctor Doom roba ' + _doomStolen + ' cargas del equipo enemigo (atacado con Protección Sagrada/Escudo Sagrado)', 'buff');
                    }
                }
            }

            // ARMADURA DE BRONCE: cada vez que el portador recibe un ataque, +1 HP máximo
            if (attackerName !== null && (target.equippedRelics || []).includes('Armadura de Bronce')) {
                target.maxHp = (target.maxHp || 0) + 1;
                addLog('🛡️ Armadura de Bronce: ' + targetName + ' +1 HP máximo (' + target.maxHp + ')', 'buff');
            }

            // NANOGUANTE DE IRON MAN: si es golpeado por un Over enemigo, gana Escudo Sagrado 2T
            if (attackerName !== null && gameState.selectedAbility && gameState.selectedAbility.type === 'over' &&
                (target.equippedRelics || []).includes('Nanoguante de Iron Man')) {
                if (typeof applyBuff === 'function') {
                    applyBuff(targetName, { name: 'Escudo Sagrado', type: 'buff', duration: 2, emoji: '✝️' });
                    addLog('🦾 Nanoguante de Iron Man: ' + targetName + ' gana Escudo Sagrado (2T) — atacado con un Over', 'buff');
                }
            }

            // ── ÚLTIMO HÉROE DE AMÉRICA (Soldier Boy): si es atacado mientras tiene buff
            //    Armadura activo, ejecuta su básico Golpe de Escudo sobre el atacante
            //    (daño, efectos y generación de cargas completos) — sin límite por ronda ──
            if (attackerName !== null && target.passive && target.passive.name === 'Ultimo Heroe de America') {
                const _sbHasArmadura = (target.statusEffects || []).some(function (e) { return e && normAccent(e.name || '') === 'armadura'; });
                if (_sbHasArmadura && !passiveExecuting) {
                    const _sbAttacker = gameState.characters[attackerName];
                    if (_sbAttacker && !_sbAttacker.isDead && _sbAttacker.hp > 0) {
                        addLog('🎖️ Último Héroe de América: Soldier Boy contraataca con Golpe de Escudo (Armadura activa)', 'buff');
                        if (typeof window._executeBasicForced === 'function') window._executeBasicForced(targetName, attackerName);
                    }
                }
            }

            // DOT damage (burns, poison, solar burn) bypasses shields — goes directly to HP
            // attackerName === null means this is DOT/status effect damage
            // DESTREZA DE LOS HUARGOS (Horda): todos los ataques del portador ignoran el buff Escudo
            const _attackerIgnoresShield = attackerName && gameState.characters[attackerName] &&
                gameState.characters[attackerName].passive && gameState.characters[attackerName].passive.name === 'Destreza de los Huargos';
            if (target.shield > 0 && attackerName !== null && !_attackerIgnoresShield) {
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

                    // FORTALEZA DE TAURO (Aldebaran): escudo absorbe un golpe → 2 cargas
                    if (target.passive && target.passive.name === 'Fortaleza de Tauro') {
                        target.charges = Math.min(20, (target.charges||0) + 2);
                        addLog('🐂 Fortaleza de Tauro: Aldebaran genera 2 cargas (escudo absorbió golpe)', 'buff');
                    }

                    // ── DONCELLA ESCUDERA (Lagertha): al perder HP de escudo → recupera 2 HP ──
                    if (target.passive && target.passive.name === 'Doncella Escudera') {
                        if (typeof applyHeal === 'function') applyHeal(targetName, 2, 'Doncella Escudera');
                        addLog('🛡️ Doncella Escudera: Lagertha recupera 2 HP (perdió HP de escudo)', 'heal');
                    }

                    // ── ESTRATEGA DE ODIN (Ragnar): 50% de Sangrado al atacante cuando aliado pierde HP de escudo ──
                    if (attackerName && !passiveExecuting) {
                        const _rShAtk = gameState.characters[targetName];
                        if (_rShAtk) {
                            for (const _rShN in gameState.characters) {
                                const _rShC = gameState.characters[_rShN];
                                if (!_rShC || _rShC.isDead || !_rShC.passive || _rShC.passive.name !== 'Estratega de Odin') continue;
                                if (_rShC.team !== _rShAtk.team) continue;
                                if (Math.random() < 0.50) {
                                    if (typeof applyBleed === 'function') applyBleed(attackerName, 2);
                                    addLog('🪓 Estratega de Odin: ' + attackerName + ' recibe Sangrado (aliado perdió escudo)', 'debuff');
                                }
                                break;
                            }
                        }
                    }

                    // ÚLTIMO REY DE LOS MUERTOS (Bolvar BOSS): genera 3 cargas por cada punto de escudo HP perdido
                    if (target.passive && target.passive.name === 'Último Rey de los Muertos') {
                        const _brvCharges = damage * 3; // 3 cargas por cada HP de escudo absorbido
                        target.charges = Math.min(20, (target.charges||0) + _brvCharges);
                        addLog('💀 Último Rey de los Muertos: Bolvar genera ' + _brvCharges + ' cargas (' + damage + ' HP escudo absorbido)', 'buff');
                    }

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

                    // ── PROTECCIÓN DE KATSUYU: cada vez que un aliado pierde HP de Escudo → cura 3 HP a todo el equipo aliado ──
                    (function () {
                        const _ktSum = Object.values(gameState.summons||{}).find(function(s){ return s && s.name === 'Katsuyu' && !s.isDead && s.hp > 0 && s.team === target.team; });
                        if (_ktSum) {
                            for (const _ktN in gameState.characters) {
                                const _ktC = gameState.characters[_ktN];
                                if (!_ktC || _ktC.isDead || _ktC.hp <= 0 || _ktC.team !== target.team) continue;
                                if (typeof applyHeal === 'function') applyHeal(_ktN, 3, 'Protección de Katsuyu');
                                else _ktC.hp = Math.min(_ktC.maxHp, (_ktC.hp||0) + 3);
                            }
                            addLog('🐌 Protección de Katsuyu: equipo aliado cura 3 HP (' + targetName + ' perdió HP de Escudo)', 'heal');
                        }
                    })();

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

                    // DONCELLA ESCUDERA (Lagertha): al perder HP de escudo (aunque se rompa) → recupera 2 HP
                    if (target.passive && target.passive.name === 'Doncella Escudera') {
                        if (typeof applyHeal === 'function') applyHeal(targetName, 2, 'Doncella Escudera');
                        addLog('🛡️ Doncella Escudera: Lagertha recupera 2 HP (escudo roto)', 'heal');
                    }
                    // ESTRATEGA DE ODIN (Ragnar): 50% Sangrado al atacante cuando escudo de aliado se rompe
                    if (attackerName && !passiveExecuting) {
                        for (const _rShBN in gameState.characters) {
                            const _rShBC = gameState.characters[_rShBN];
                            if (!_rShBC || _rShBC.isDead || !_rShBC.passive || _rShBC.passive.name !== 'Estratega de Odin') continue;
                            if (_rShBC.team !== target.team) continue;
                            if (Math.random() < 0.50) {
                                if (typeof applyBleed === 'function') applyBleed(attackerName, 2);
                                addLog('🪓 Estratega de Odin: ' + attackerName + ' recibe Sangrado (escudo de aliado roto)', 'debuff');
                            }
                            break;
                        }
                    }

                    // ÚLTIMO REY DE LOS MUERTOS (Bolvar BOSS): genera 3 cargas por HP de escudo absorbido incluso al romperse
                    if (target.passive && target.passive.name === 'Último Rey de los Muertos') {
                        const _brvC2 = shieldHP * 3;
                        target.charges = Math.min(20, (target.charges||0) + _brvC2);
                        addLog('💀 Último Rey de los Muertos: Bolvar genera ' + _brvC2 + ' cargas (' + shieldHP + ' HP escudo roto)', 'buff');
                    }

                    // ── PROTECCIÓN DE KATSUYU: cada vez que un aliado pierde HP de Escudo → cura 3 HP a todo el equipo aliado ──
                    (function () {
                        const _ktSum2 = Object.values(gameState.summons||{}).find(function(s){ return s && s.name === 'Katsuyu' && !s.isDead && s.hp > 0 && s.team === target.team; });
                        if (_ktSum2) {
                            for (const _kt2N in gameState.characters) {
                                const _kt2C = gameState.characters[_kt2N];
                                if (!_kt2C || _kt2C.isDead || _kt2C.hp <= 0 || _kt2C.team !== target.team) continue;
                                if (typeof applyHeal === 'function') applyHeal(_kt2N, 3, 'Protección de Katsuyu');
                                else _kt2C.hp = Math.min(_kt2C.maxHp, (_kt2C.hp||0) + 3);
                            }
                            addLog('🐌 Protección de Katsuyu: equipo aliado cura 3 HP (' + targetName + ' perdió HP de Escudo)', 'heal');
                        }
                    })();

                    target.shield = 0;
                    target.shieldEffect = null;
                    // GANDALF PASSIVE: Istari - ally shield breaks → +3 charges + +3 HP to that ally
                    (function() {
                        for (const _gfN in gameState.characters) {
                            const _gfC = gameState.characters[_gfN];
                            if (!_gfC || _gfC.isDead || !_gfC.passive) continue;
                            if (_gfC.passive.name !== 'Istari') continue;
                            if (_gfC.team !== target.team) continue;
                            target.charges = Math.min(20, (target.charges||0) + 3);
                            if (typeof applyHeal === 'function') applyHeal(targetName, 3, 'Istari');
                            else { const _ssOld=target.hp; target.hp = Math.min(target.maxHp, (target.hp||0) + 3); if(typeof notifyHeal==='function') notifyHeal(targetName, target.hp-_ssOld, 'Escudo Sagrado'); }
                            addLog('✨ Istari (Gandalf): ' + targetName + ' +3 cargas y +3 HP (escudo roto)', 'buff');
                            break;
                        }
                    })();
                    // FORTALEZA DE TAURO (Aldebaran): escudo roto - el trigger de cargas ya está en el bloque de absorbe
                }
            }
            
            // Sanitize HP values to prevent NaN
            if (isNaN(target.hp)) target.hp = 0;
            if (isNaN(remainingDamage)) remainingDamage = 0;
            const oldHp = target.hp;
            // ── BUFF REFLEJAR: interceptar ANTES de aplicar el daño (portador no recibe daño)
            {
                const _refIsSTAttack = gameState.selectedAbility &&
                    (gameState.selectedAbility.target === 'single' ||
                     gameState.selectedAbility.type === 'basic');
                if (!passiveExecuting && _refIsSTAttack && remainingDamage > 0 &&
                    hasStatusEffect(targetName, 'Reflejar') &&
                    attackerName && attackerName !== targetName) {
                    passiveExecuting = true;
                    // Reflejar daño al atacante — portador NO recibe nada
                    applyDamageWithShield(attackerName, remainingDamage, targetName);
                    addLog('🪞 Reflejar: ' + targetName + ' refleja ' + remainingDamage + ' daño a ' + attackerName + ' (portador protegido)', 'buff');
                    // Reflejar debuffs del movimiento al atacante
                    if (gameState.selectedAbility) {
                        const _desc = ((gameState.selectedAbility.description)||'').toLowerCase();
                        if (_desc.includes('veneno') || _desc.includes('poison')) { applyPoison(attackerName, 1); addLog('🪞 Reflejar: Veneno reflejado a ' + attackerName, 'debuff'); }
                        if (_desc.includes('quemadura')) { applyFlatBurn(attackerName, 2, 1); addLog('🪞 Reflejar: Quemadura reflejada a ' + attackerName, 'debuff'); }
                        if (_desc.includes('aturdimiento') || _desc.includes('stun')) { if (typeof applyStun === 'function') applyStun(attackerName, 1); addLog('🪞 Reflejar: Aturdimiento reflejado a ' + attackerName, 'debuff'); }
                    }
                    // 50% de disiparse
                    if (Math.random() < 0.50) {
                        target.statusEffects = (target.statusEffects||[]).filter(function(e){ return !e || e.name !== 'Reflejar'; });
                        addLog('🪞 Reflejar: el buff se disipó (50%)', 'info');
                    }
                    passiveExecuting = false;
                    return 0; // Portador NO recibe daño
                }
            }

            // ── VARITA DE SAÚCO: 30% de reflejar CUALQUIER ataque recibido (daño, debuffs y efecto) ──
            {
                if (!passiveExecuting && remainingDamage > 0 &&
                    (target.equippedRelics||[]).includes('Varita de Saúco') &&
                    attackerName && attackerName !== targetName &&
                    Math.random() < 0.30) {
                    passiveExecuting = true;
                    applyDamageWithShield(attackerName, remainingDamage, targetName);
                    addLog('🪄 Varita de Saúco: ' + targetName + ' refleja ' + remainingDamage + ' daño a ' + attackerName, 'buff');
                    if (gameState.selectedAbility) {
                        const _wandDesc = ((gameState.selectedAbility.description)||'').toLowerCase();
                        if (_wandDesc.includes('veneno') || _wandDesc.includes('poison')) { applyPoison(attackerName, 1); addLog('🪄 Varita de Saúco: Veneno reflejado a ' + attackerName, 'debuff'); }
                        if (_wandDesc.includes('quemadura')) { applyFlatBurn(attackerName, 2, 1); addLog('🪄 Varita de Saúco: Quemadura reflejada a ' + attackerName, 'debuff'); }
                        if (_wandDesc.includes('aturdimiento') || _wandDesc.includes('stun')) { if (typeof applyStun === 'function') applyStun(attackerName, 1); addLog('🪄 Varita de Saúco: Aturdimiento reflejado a ' + attackerName, 'debuff'); }
                        if (_wandDesc.includes('sangrado')) { if (typeof applyBleed === 'function') applyBleed(attackerName, 1); addLog('🪄 Varita de Saúco: Sangrado reflejado a ' + attackerName, 'debuff'); }
                        if (_wandDesc.includes('congelaci')) { if (typeof applyFreeze === 'function') applyFreeze(attackerName, 1); addLog('🪄 Varita de Saúco: Congelación reflejada a ' + attackerName, 'debuff'); }
                    }
                    passiveExecuting = false;
                    return 0; // Portador NO recibe daño — reflejado completamente
                }
            }

            target.hp = Math.max(0, target.hp - remainingDamage);
            if (remainingDamage > 0) target._dmgAnimatedThisFrame = true; // evita doble animación en renderCharacters

            // ── MODO KAIJU (Garou): mientras transformado, cada vez que recibe daño → +1 daño base adicional permanente (mientras dure) ──
            if (remainingDamage > 0 && targetName === 'Garou' && target.garouKaijuMode && !passiveExecuting) {
                target.garouKaijuBonusDmg = (target.garouKaijuBonusDmg || 0) + 1;
                addLog('🦖 Modo Kaiju: Garou +1 daño base permanente (total +' + target.garouKaijuBonusDmg + ')', 'buff');
            }

            // ── PROGENITOR DEMONIACO (Muzan transformado): al recibir golpe → 5 stacks Veneno al atacante + Muzan +5 HP ──
            if (remainingDamage > 0 && targetName && attackerName && !passiveExecuting) {
                const _mzDef = gameState.characters[targetName];
                if (_mzDef && _mzDef.muzanTransformed && _mzDef.passive && _mzDef.passive.name === 'Progenitor Demoniaco') {
                    passiveExecuting = true;
                    if (typeof applyPoison === 'function') applyPoison(attackerName, 5);
                    if (typeof applyHeal === 'function') applyHeal(targetName, 5, 'Progenitor Demoniaco');
                    addLog('👹 Progenitor Demoniaco: 5 stacks Veneno a ' + attackerName + ' + Muzan +5 HP', 'buff');
                    passiveExecuting = false;
                }
            }

            // ── CAZADOR DE HÉROES (Garou): si recibe 2 o menos de daño → contraataca gratis con Ryusui Gansai-ken ──
            // Usa un guard DEDICADO (gameState._garouCounterActive) en lugar de passiveExecuting (variable global
            // compartida entre todas las pasivas) para evitar que se resetee prematuramente por código anidado
            // y cause recursión infinita.
            // Check by passive name so it works for any version/rename of Garou
            const _isGarouTarget = target && target.passive && target.passive.name === 'Cazador de Héroes';
            if (remainingDamage > 0 && remainingDamage <= 2 && _isGarouTarget && !target.isDead && target.hp > 0 &&
                !gameState._garouCounterActive) {
                gameState._garouCounterActive = true;
                const _ghEnemyTeam = target.team === 'team1' ? 'team2' : 'team1';
                const _ghEnemies = Object.keys(gameState.characters).filter(function(n) {
                    const c = gameState.characters[n];
                    return c && c.team === _ghEnemyTeam && !c.isDead && c.hp > 0 && n !== 'Garou';
                });
                if (_ghEnemies.length > 0 && typeof _executeAbilityCore === 'function') {
                    const _ghTarget = _ghEnemies[Math.floor(Math.random()*_ghEnemies.length)];
                    const _ghAbility = (target.abilities||[]).find(function(a){ return a.effect === 'ryusui_garou'; });
                    if (_ghAbility) {
                        addLog('🐾 Cazador de Héroes: ¡Garou contraataca con Ryusui Gansai-ken!', 'buff');
                        const _prevSelected = gameState.selectedCharacter;
                        const _prevAbility = gameState.selectedAbility;
                        const _prevExecuting = gameState._abilityExecuting;
                        const _prevSuppress = gameState._suppressAutoEndTurn;
                        gameState.selectedCharacter = 'Garou';
                        gameState.selectedAbility = _ghAbility;
                        gameState._abilityExecuting = false;
                        gameState._suppressAutoEndTurn = true;
                        try {
                            _executeAbilityCore(_ghTarget);
                        } finally {
                            gameState.selectedCharacter = _prevSelected;
                            gameState.selectedAbility = _prevAbility;
                            gameState._abilityExecuting = _prevExecuting;
                            gameState._suppressAutoEndTurn = _prevSuppress;
                        }
                    }
                }
                gameState._garouCounterActive = false;
            }

            // ── VISIÓN ESMERALDA (Linterna Verde): un aliado recibe daño por Quemadura/Veneno/Sangrado/Hemorragia → cura 3 HP a todo el equipo aliado ──
            if (remainingDamage > 0 && !passiveExecuting && _debuffDamageSource) {
                for (const _lvn in gameState.characters) {
                    const _lvc = gameState.characters[_lvn];
                    if (!_lvc || _lvc.isDead || _lvc.hp <= 0 || !_lvc.passive) continue;
                    if (_lvc.passive.name !== 'Visión Esmeralda') continue;
                    if (_lvc.team !== target.team) continue; // el objetivo dañado debe ser aliado de Linterna Verde
                    passiveExecuting = true;
                    for (const _ln in gameState.characters) {
                        const _lc = gameState.characters[_ln];
                        if (!_lc || _lc.isDead || _lc.hp <= 0 || _lc.team !== _lvc.team) continue;
                        if (typeof applyHeal === 'function') applyHeal(_ln, 3, 'Visión Esmeralda');
                        else { const _lcOld=_lc.hp; _lc.hp = Math.min(_lc.maxHp, (_lc.hp||0) + 3); if(typeof notifyHeal==='function') notifyHeal(targetName, _lc.hp-_lcOld, 'El Carcelero'); }
                    }
                    addLog('💚 Visión Esmeralda: el equipo aliado recupera 3 HP (' + targetName + ' recibió daño por ' + _debuffDamageSource + ')', 'heal');
                    passiveExecuting = false;
                    break;
                }
            }

            // ── DESTELLO DE PEGASO (Seiya): trackear daño recibido en la ronda → Escudo Sagrado si ≥5 HP perdidos ──
            if (remainingDamage > 0 && attackerName && attackerName !== targetName) {
                const _seiyaChar = gameState.characters[targetName];
                if (_seiyaChar && _seiyaChar.passive && _seiyaChar.passive.name === 'Destello de Pegaso') {
                    _seiyaChar._hpLostThisRound = (_seiyaChar._hpLostThisRound || 0) + remainingDamage;
                    if (_seiyaChar._hpLostThisRound >= 5 && !_seiyaChar._seiyaShieldApplied) {
                        _seiyaChar._seiyaShieldApplied = true;
                        if (typeof applyBuff === 'function') applyBuff(targetName, { name: 'Escudo Sagrado', type: 'buff', duration: 1, emoji: '✝️' });
                        addLog('🌟 Destello de Pegaso: Seiya recibe Escudo Sagrado (perdió ≥5 HP esta ronda)', 'buff');
                    }
                }
            }

            // ── PASIVAS DINÁMICAS: AL_RECIBIR_DANIO ──
            if (remainingDamage > 0 && !passiveExecuting && typeof runDynamicPassives === 'function') {
                const _dynRDChar = gameState.characters[targetName];
                if (_dynRDChar) {
                    runDynamicPassives('AL_RECIBIR_DANIO', {
                        charName: targetName, targetName,
                        allyTeam: _dynRDChar.team,
                        enemyTeam: _dynRDChar.team === 'team1' ? 'team2' : 'team1'
                    });
                }
            }

            // ── CAPA ÉLFICA DE RIVENDELL: 25% de aplicar Congelación al objetivo al atacar ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _ceAtk = gameState.characters[attackerName];
                if (_ceAtk && (_ceAtk.equippedRelics||[]).includes('Capa Élfica de Rivendell')) {
                    if (Math.random() < 0.25) {
                        const _ceTgt = gameState.characters[targetName];
                        if (_ceTgt && !_ceTgt.isDead && _ceTgt.hp > 0) {
                            addLog('🌿 Capa Élfica: ' + targetName + ' queda Congelado 2T (25%)', 'debuff');
                            if (typeof applyFreeze === 'function') applyFreeze(targetName, 2, false);
                        }
                    }
                }
            }

            // ── ARMADURA SAIYAN: buff Armadura permanente (aplica reducción de 50%) ──
            // La reducción de daño ya se aplica más arriba via hasStatusEffect('Armadura').
            // Aquí solo aseguramos que el buff esté activo al inicio de cada combate.

            // ── REACTOR NUCLEAR (Gipsy Danger): al recibir daño → +2 cargas ──
            if (remainingDamage > 0 && !passiveExecuting) {
                if (target && target.passive && target.passive.name === 'Reactor Nuclear' && !target.isDead && target.hp > 0) {
                    target.charges = Math.min(20, (target.charges||0) + 2);
                    addLog('⚙️ Reactor Nuclear: Gipsy genera 2 cargas al recibir daño', 'buff');
                }
            }

            // ── CADENA DE GYOMEI: al recibir daño → gana Escudo igual al daño recibido ──
            if (remainingDamage > 0 && !passiveExecuting) {
                if ((target.equippedRelics||[]).includes('Cadena de Gyomei')) {
                    target.shield = (target.shield||0) + remainingDamage;
                    addLog('⛓️ Cadena de Gyomei: ' + targetName + ' gana ' + remainingDamage + ' HP de Escudo', 'buff');
                }
            }

            // ── SANGRE DE SANEMI: al recibir golpe → Confusión al atacante + 25% Aturdimiento a cada enemigo ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                if ((target.equippedRelics||[]).includes('Sangre de Sanemi')) {
                    // Confusión al atacante
                    if (typeof applyDebuff==='function') applyDebuff(attackerName, {name:'Confusion',type:'debuff',duration:1,emoji:'💫'});
                    addLog('🩸 Sangre de Sanemi: Confusión aplicada a ' + attackerName, 'debuff');
                    // 25% Aturdimiento independiente a cada enemigo
                    const _ssETeam = target.team === 'team1' ? 'team2' : 'team1';
                    for (const _ssN in gameState.characters) {
                        const _ssC = gameState.characters[_ssN];
                        if (!_ssC || _ssC.team !== _ssETeam || _ssC.isDead || _ssC.hp <= 0) continue;
                        if (Math.random() < 0.25) {
                            if (typeof applyDebuff==='function') applyDebuff(_ssN, {name:'Aturdimiento',type:'debuff',duration:1,emoji:'⭐'});
                            addLog('🩸 Sangre de Sanemi: Aturdimiento aplicado a ' + _ssN + ' (25%)', 'debuff');
                        }
                    }
                }
            }

            // ── MABOROSHI NO SHINKIRŌ (Saga): 50% de aplicar Posesión en cada ataque ──
            if (!passiveExecuting && targetName && attackerName) {
                const _msAtker = gameState.characters[attackerName];
                if (_msAtker && _msAtker.passive && _msAtker.passive.name === 'Maboroshi no Shinkirō') {
                    if (Math.random() < 0.50) {
                        const _tgtNow = gameState.characters[targetName];
                        if (_tgtNow && !_tgtNow.isDead && _tgtNow.hp > 0 && typeof applyDebuff === 'function') {
                            applyDebuff(targetName, {name:'Posesion', type:'debuff', duration:2, emoji:'🟣'});
                            addLog('⛓️ Maboroshi no Shinkirō: Posesión aplicada a ' + targetName + ' (50%)', 'debuff');
                        }
                    }
                }
            }

            // ── CASCO MANDALORIANO: al recibir ataque → atacante pierde 2 cargas ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                if ((target.equippedRelics||[]).includes('Casco Mandaloriano')) {
                    const _cmAtk = gameState.characters[attackerName];
                    if (_cmAtk) {
                        _cmAtk.charges = Math.max(0, (_cmAtk.charges||0) - 2);
                        addLog('🪖 Casco Mandaloriano: ' + attackerName + ' pierde 2 cargas', 'debuff');
                    }
                }
            }

            // ── TRAJE DE SAIYAMAN: al recibir daño → disipa propios debuffs ──
            if (remainingDamage > 0 && !passiveExecuting) {
                if ((target.equippedRelics||[]).includes('Traje de Saiyaman')) {
                    const _tsDebuffs = (target.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff'; });
                    if (_tsDebuffs.length > 0) {
                        target.statusEffects = (target.statusEffects||[]).filter(function(e){ return !e || e.type !== 'debuff'; });
                        addLog('🦸 Traje de Saiyaman: ' + targetName + ' disipa ' + _tsDebuffs.length + ' debuffs al recibir daño', 'buff');
                    }
                }
            }

            // ── TRAJE DE SAIYAMAN: al causar daño → Confusión a un enemigo aleatorio ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _tsAtk = gameState.characters[attackerName];
                if (_tsAtk && (_tsAtk.equippedRelics||[]).includes('Traje de Saiyaman')) {
                    const _tsETeam = _tsAtk.team === 'team1' ? 'team2' : 'team1';
                    const _tsEnemies = Object.keys(gameState.characters).filter(function(n){
                        const c = gameState.characters[n]; return c && c.team === _tsETeam && !c.isDead && c.hp > 0;
                    });
                    if (_tsEnemies.length > 0) {
                        const _tsTarget = _tsEnemies[Math.floor(Math.random() * _tsEnemies.length)];
                        if (typeof applyDebuff === 'function') applyDebuff(_tsTarget, { name: 'Confusion', type: 'debuff', duration: 1, emoji: '💫' });
                        addLog('🦸 Traje de Saiyaman: Confusión aplicada a ' + _tsTarget, 'debuff');
                    }
                }
            }

            // ── COLMILLO DE VASILISCO: ataques básicos aplican 1 stack de Veneno por golpe real ──
            // Movido aquí (applyDamageWithShield) por el mismo motivo que Espada Nichirin Negra:
            // en AOEs con bucle propio (Gate of Babylon de Gilgamesh, Dragon's Fear de Antares, etc.)
            // el bloque post-ataque de skills.js solo ve targetName = el primer objetivo clickeado,
            // no cada enemigo golpeado, así que el Veneno nunca se aplicaba a los otros.
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _cvAtk = gameState.characters[attackerName];
                if (_cvAtk && (_cvAtk.equippedRelics||[]).includes('Colmillo de Vasilisco')) {
                    const _lastAbType = gameState._lastAbilityType || (gameState.selectedAbility && gameState.selectedAbility.type);
                    if (_lastAbType === 'basic') {
                        const _cvTgt = gameState.characters[targetName];
                        if (_cvTgt && !_cvTgt.isDead && _cvTgt.hp > 0) {
                            if (typeof applyPoison === 'function') applyPoison(targetName, 1);
                            addLog('🗡️ Colmillo de Vasilisco: 1 stack de Veneno aplicado a ' + targetName, 'debuff');
                        }
                    }
                }
            }

            // ── ESPADA NICHIRIN NEGRA: aplica Quemadura Solar tras cada golpe real (ST o AOE) ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _ennAtk2 = gameState.characters[attackerName];
                if (_ennAtk2 && (_ennAtk2.equippedRelics||[]).includes('Espada Nichirin Negra')) {
                    const _ennTgt2 = gameState.characters[targetName];
                    if (_ennTgt2 && !_ennTgt2.isDead) {
                        if (typeof applySolarBurn === 'function') applySolarBurn(targetName, 10, 2);
                        addLog('🗡️ Espada Nichirin Negra: Quemadura Solar aplicada a ' + targetName, 'debuff');
                    }
                }
            }

            // ── ALABARDA DEL SOL: si el objetivo golpeado tiene Quemaduras o Quemadura Solar → portador +8 cargas ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _alsAtk = gameState.characters[attackerName];
                if (_alsAtk && (_alsAtk.equippedRelics||[]).includes('Alabarda del Sol')) {
                    const _alsTgt = gameState.characters[targetName];
                    const _alsHasBurn = _alsTgt && (_alsTgt.statusEffects||[]).some(function(e){
                        if (!e || !e.name) return false;
                        const _n2 = normAccent(e.name);
                        return _n2 === 'quemadura' || _n2 === 'quemaduras' || _n2.indexOf('quemadura solar') !== -1;
                    });
                    if (_alsHasBurn) {
                        _alsAtk.charges = Math.min(20, (_alsAtk.charges||0) + 8);
                        addLog('☀️ Alabarda del Sol: ' + attackerName + ' genera 8 cargas (objetivo con Quemaduras/Quemadura Solar)', 'buff');
                    }
                }
            }

            // ── ANIMA VORAX: cada vez que el portador causa daño, activa las pasivas de sus invocaciones ──
            if (remainingDamage > 0 && !passiveExecuting && attackerName) {
                const _avAtk = gameState.characters[attackerName];
                if (_avAtk && (_avAtk.equippedRelics||[]).includes('Anima Vorax')) {
                    if (typeof activateOwnerSummonPassives === 'function') activateOwnerSummonPassives(attackerName);
                }
            }

            // ── TORMENTA ROJA: al recibir daño por Quemadura o Veneno → 3 daño AOE al equipo enemigo ──
            // _debuffDamageSource ya fue capturado al inicio de esta función (antes de limpiar el flag
            // global) — usar esa variable local, no gameState._currentDamageSource (ya está en null aquí).
            if (remainingDamage > 0 && !passiveExecuting) {
                var _trSrc = _debuffDamageSource || null;
                var _trIsDOT = (_trSrc === 'Quemadura' || _trSrc === 'Veneno');
                // También detectar por attackerName===null para compatibilidad con otros daños de debuff
                if (!_trIsDOT && attackerName === null) {
                    // Si no tiene source marcado pero attackerName es null, verificar debuffs activos
                    var _trTgt2 = gameState.characters[targetName];
                    if (_trTgt2) {
                        _trIsDOT = (_trTgt2.statusEffects||[]).some(function(e){
                            return e && (normAccent(e.name||'')==='quemadura' || normAccent(e.name||'')==='veneno');
                        });
                    }
                }
                if (_trIsDOT) {
                    var _trChar = gameState.characters[targetName];
                    if (_trChar && (_trChar.equippedRelics||[]).indexOf('Tormenta Roja') >= 0) {
                        var _trTeam = _trChar.team;
                        var _trETeam = _trTeam === 'team1' ? 'team2' : 'team1';
                        var _trHit = false;
                        passiveExecuting = true;
                        Object.keys(gameState.characters).forEach(function(n){
                            var _c = gameState.characters[n];
                            if (_c && _c.team === _trETeam && !_c.isDead && _c.hp > 0) {
                                applyDamageWithShield(n, 3, targetName);
                                _trHit = true;
                            }
                        });
                        if (_trHit) addLog('⚡ Tormenta Roja: ' + targetName + ' recibió daño de ' + (_trSrc||'debuff') + ' → 3 daño a todo el equipo enemigo', 'damage');
                        passiveExecuting = false;
                    }
                }
            }

            // ── LEGENDARIO SUPER SAYAJIN (Broly): genera 3 cargas cada vez que recibe daño ──
            if (remainingDamage > 0 && !passiveExecuting && target.isBoss &&
                target.passive && target.passive.name === 'Legendario Super Sayajin') {
                target.charges = Math.min(20, (target.charges || 0) + 3);
                addLog('💚 Legendario Super Sayajin: Broly genera 3 cargas al recibir daño (' + target.charges + '/20)', 'buff');
            }
            // ── SOMBRA DE FUEGO (Drogon): cuando Daenerys recibe daño → mismo daño al atacante ──
            if (remainingDamage > 0 && attackerName && !passiveExecuting &&
                (targetName === 'Daenerys Targaryen' || targetName === 'Daenerys Targaryen v2') &&
                target.hp > 0 && !target.isDead) {
                const _dragonAlive = Object.values(gameState.summons).some(function(s){
                    return s && s.name === 'Drogon' && s.team === target.team && s.hp > 0;
                });
                if (_dragonAlive) {
                    const _daeAtk = gameState.characters[attackerName];
                    if (_daeAtk && !_daeAtk.isDead && _daeAtk.hp > 0) {
                        passiveExecuting = true;
                        _daeAtk.hp = Math.max(0, (_daeAtk.hp||0) - remainingDamage);
                        if (_daeAtk.hp <= 0) { _daeAtk.isDead = true; if (typeof registerKill === 'function') registerKill(targetName, attackerName, false); }
                        addLog('🔥 Sombra de Fuego: Drogon inflige ' + remainingDamage + ' daño a ' + attackerName + ' (atacó a Daenerys)', 'damage');
                        passiveExecuting = false;
                    }
                }
            }
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
                        _sindAtk.hp = Math.max(0, (_sindAtk.hp||0) - 5);
                        addLog('🐉 Dragon de la Muerte: Sindragosa inflige 5 daño a ' + attackerName, 'damage');
                        if (_sindAtk.hp <= 0) {
                            _sindAtk.isDead = true;
                            if (typeof registerKill === 'function') registerKill('Sindragosa', attackerName, false);
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
                    const _omOld = target.hp;
                    { const _esOld=target.hp; target.hp = Math.min(target.maxHp, (target.hp||0) + 1); if(typeof notifyHeal==='function') notifyHeal(targetName, target.hp-_esOld, 'relic heal'); }
                    if (target.hp > _omOld && typeof showHpTick === 'function') showHpTick(targetName, target.hp - _omOld); if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting) { var _bsC = gameState.characters[targetName]; if (_bsC) triggerBendicionSagrada(_bsC.team, 0); }
                    addLog('⚡ Efecto Omega: Darkseid roba 1 HP de ' + attackerName, 'heal');
                }
            }

            // ── EFECTOS DE RELIQUIAS DEL ATACANTE ──────────────────────────────
            // _relicEffectsActive previene recursión DENTRO de una sola cadena de llamadas.
            // Se resetea aquí para que cada ataque nuevo pueda disparar reliquias fresca.
            // Solo bloqueamos si YA estamos dentro del procesamiento de reliquias (recursión).
            if (remainingDamage > 0 && attackerName && attackerName !== targetName && !passiveExecuting) {
                if (!gameState._relicEffectsActive) {
                    gameState._relicEffectsActive = true;
                    const _atkChar = gameState.characters[attackerName];
                    // NOTA: _ignoreTauntNextAttack se consume DESPUÉS del primer ataque del turno extra
                    // (se resetea en endTurn al finalizar el turno extra, no aquí)
                const _relics  = _atkChar ? (_atkChar.equippedRelics || []) : [];
                const _tgtChar = gameState.characters[targetName];

                _relics.forEach(function(relicName) {
                    if (!relicName) return;
                    const _rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[relicName] : null;
                    if (!_rd || !_rd.effect) return;

                    switch (_rd.effect) {

                        // 15% Sangrado al atacar. Si aplica → +2 cargas
                        case 'bleed_on_hit':
                            if (Math.random() < 0.15) {
                                if (typeof applyDebuff === 'function')
                                    applyDebuff(targetName, { name:'Sangrado', type:'debuff', duration:3, emoji:'🩸', dotDamage:1 });
                                if (_atkChar) _atkChar.charges = Math.min(20, (_atkChar.charges||0) + 2);
                                addLog('🩸 Garras Lacerantes: Sangrado aplicado a ' + targetName + ' +2 cargas', 'debuff');
                            }
                            break;

                        // +10% probabilidad crítico (applied in finalDamage calc, here we log)
                        case 'crit_chance_bonus': break; // handled in executeAbility pre-phase

                        // Básico +50% daño — handled in executeAbility
                        case 'basic_dmg_50pct': break;

                        // Básico +2 daño — handled in executeAbility
                        case 'basic_dmg_plus2': break;

                        // Especial +2 daño — handled in executeAbility
                        case 'special_dmg_plus2': break;

                        // 50% Aturdimiento al atacar
                        case 'stun_on_hit_50':
                            if (Math.random() < 0.50) {
                                if (typeof applyStun === 'function') applyStun(targetName, 1);
                                else if (typeof applyDebuff === 'function')
                                    applyDebuff(targetName, { name:'Aturdimiento', type:'debuff', duration:1, emoji:'⭐' });
                                addLog('⭐ Mistic Hammer: Aturdimiento a ' + targetName, 'debuff');
                            }
                            break;

                        // Especial → objetivo pierde 50% cargas
                        case 'special_drain_50':
                            if ((gameState._lastAbilityType === 'special' || gameState._lastAbilityType === 'over') && _tgtChar) {
                                const _drain = Math.floor((_tgtChar.charges||0) * 0.50);
                                if (_drain > 0) {
                                    _tgtChar.charges = Math.max(0, (_tgtChar.charges||0) - _drain);
                                    addLog('🌀 Nullum: ' + targetName + ' pierde ' + _drain + ' cargas (ataque especial)', 'debuff');
                                } else if ((_tgtChar.charges||0) > 0) {
                                    // Siempre drena al menos 1 si tiene alguna carga
                                    _tgtChar.charges = Math.max(0, (_tgtChar.charges||0) - 1);
                                    addLog('🌀 Nullum: ' + targetName + ' pierde 1 carga', 'debuff');
                                }
                            }
                            break;

                        // Básico aplica Quemadura 2HP
                        case 'basic_burn_2hp':
                            if (gameState._lastAbilityType === 'basic') {
                                if (typeof applyFlatBurn === 'function') applyFlatBurn(targetName, 2, 2);
                                else if (typeof applyDebuff === 'function') applyDebuff(targetName, { name:'Quemadura', type:'debuff', duration:2, emoji:'🔥', flatHp:2 });
                                addLog('🔥 Maza Ignea: Quemadura 2HP a ' + targetName, 'debuff');
                            }
                            break;

                        // ST sobre enemigo con Quemadura → añade una copia de cada Quemadura activa y +3 daño
                        case 'pyro_st_burn':
                            if (_tgtChar && !passiveExecuting) {
                                const _burns = (_tgtChar.statusEffects||[]).filter(function(e){ return e && (e.name === 'Quemadura' || e.name === 'quemadura'); });
                                if (_burns.length > 0) {
                                    // Tope de 1000 stacks de Quemadura en Jefes de Sala (evita crecimiento
                                    // exponencial 1→2→4→8... que puede trabar el juego con relíquias como esta)
                                    const _pyBurnCapMax = 1000;
                                    const _pyBurnsToAdd = _tgtChar.isBoss
                                        ? Math.max(0, Math.min(_burns.length, _pyBurnCapMax - _burns.length))
                                        : _burns.length;
                                    // Duplicar: añadir una copia de cada Quemadura existente (hasta el tope)
                                    for (let _pyI = 0; _pyI < _pyBurnsToAdd; _pyI++) {
                                        const b = _burns[_pyI];
                                        if (typeof applyDebuff === 'function') {
                                            applyDebuff(targetName, Object.assign({}, b, { duration: b.duration || 2 }));
                                        } else {
                                            _tgtChar.statusEffects.push(Object.assign({}, b));
                                        }
                                    }
                                    addLog('🔥 Pyrophagos: Quemaduras de ' + targetName + ' duplicadas (+' + _pyBurnsToAdd + ' stack(s))', 'debuff');
                                    // +3 daño adicional
                                    passiveExecuting = true;
                                    applyDamageWithShield(targetName, 3, attackerName);
                                    addLog('🔥 Pyrophagos: +3 daño adicional a ' + targetName, 'damage');
                                    passiveExecuting = false;
                                }
                            }
                            break;

                        // 25% turno adicional — la tirada se hace UNA SOLA VEZ por ataque,
                        // aunque el movimiento golpee a varios enemigos (AOE). Sin este flag,
                        // un AOE de 5 objetivos hacía 5 tiradas independientes, dando ~76% de
                        // probabilidad real en vez del 25% que dice la descripción.
                        case 'extra_turn_25':
                            if (!gameState._nishanExtraTurnRolledThisTurn && Math.random() < 0.25 && !gameState._skeggoxExtraTurn) {
                                gameState._nishanExtraTurnRolledThisTurn = true;
                                gameState._skeggoxExtraTurn = attackerName;
                                addLog('✨ Sable Nishant: turno adicional para ' + attackerName + ' (25%)', 'buff');
                            } else if (!gameState._nishanExtraTurnRolledThisTurn) {
                                gameState._nishanExtraTurnRolledThisTurn = true; // marcar como intentado aunque no salió
                            }
                            break;

                        // Crítico → equipo aliado +3 cargas
                        case 'crit_team_charges':
                            if (gameState._isCritHit) {
                                const _ctTeam = _atkChar.team;
                                Object.keys(gameState.characters).forEach(function(n) {
                                    const _c = gameState.characters[n];
                                    if (_c && _c.team === _ctTeam && !_c.isDead) _c.charges = Math.min(20, (_c.charges||0) + 3);
                                });
                                addLog('⚡ Colmillo de Agron: equipo gana 3 cargas por crítico', 'buff');
                            }
                            break;

                        // Duplica generación de cargas del básico + equipo genera igual + ST aplica Megacongelación
                        case 'ergonos_basic':
                            if (gameState._lastAbilityType === 'basic' && (gameState._lastAbilityChargeGain||0) > 0 && _atkChar) {
                                var _ergGain1 = gameState._lastAbilityChargeGain;
                                _atkChar.charges = Math.min(20, (_atkChar.charges||0) + _ergGain1);
                                // El equipo aliado genera las MISMAS cargas que el portador (ya duplicadas: 2x base)
                                var _ergTeamGain = _ergGain1 * 2;
                                const _ergTeam1 = _atkChar.team;
                                Object.keys(gameState.characters).forEach(function(n) {
                                    const _c = gameState.characters[n];
                                    if (_c && _c.team === _ergTeam1 && n !== attackerName && !_c.isDead)
                                        _c.charges = Math.min(20, (_c.charges||0) + _ergTeamGain);
                                });
                                addLog('⚡ Ergonos: +' + _ergTeamGain + ' cargas a todo el equipo (básico)', 'buff');
                            }
                            // ST (cualquier tipo — básico, especial u Over): Megacongelación al objetivo
                            // + Congelación a 2 enemigos aleatorios.
                            // Usa applyFreeze() (no applyDebuff) para que efectos reactivos legítimos
                            // como el Yelmo de Caballero de la Muerte sí se activen correctamente —
                            // antes usaba applyDebuff() y esos efectos nunca se disparaban.
                            if (gameState._lastAbilityTarget === 'single' && _atkChar && !passiveExecuting) {
                                if (typeof applyFreeze === 'function') {
                                    addLog('⚡ Ergonos: Megacongelación aplicada a ' + targetName, 'debuff');
                                    applyFreeze(targetName, 2, true);
                                    // 2 enemigos aleatorios reciben Congelación
                                    const _ergETeam = _atkChar.team === 'team1' ? 'team2' : 'team1';
                                    const _ergOthers = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c&&c.team===_ergETeam&&!c.isDead&&c.hp>0&&n!==targetName; });
                                    const _ergShuffle = _ergOthers.sort(function(){ return Math.random()-0.5; }).slice(0,2);
                                    _ergShuffle.forEach(function(n){
                                        addLog('⚡ Ergonos: Congelación aplicada a ' + n, 'debuff');
                                        applyFreeze(n, 1, false);
                                    });
                                }
                            }
                            break;

                        // HACHA DE FLOKI: aplica 1 stack de Veneno; si ya tenía Veneno, aplica Ponzoña en su lugar
                        case 'hacha_floki':
                            if (_tgtChar && !_tgtChar.isDead && _tgtChar.hp > 0 && !passiveExecuting) {
                                const _hfHadVeneno = (_tgtChar.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'')==='veneno'; });
                                if (_hfHadVeneno) {
                                    if (typeof applyDebuff === 'function') {
                                        applyDebuff(targetName, { name:'Ponzona', type:'debuff', duration:2, emoji:'☠️' });
                                        addLog('🪓 Hacha de Floki: ' + targetName + ' ya tenía Veneno — se aplica Ponzoña', 'debuff');
                                    }
                                } else if (typeof applyDebuff === 'function') {
                                    applyDebuff(targetName, { name:'Veneno', type:'debuff', duration:2, emoji:'☣️' });
                                    addLog('🪓 Hacha de Floki: 1 stack de Veneno aplicado a ' + targetName, 'debuff');
                                }
                            }
                            break;

                        // ARCO DE ATILA: aplica Ceguera 2 turnos sobre el objetivo golpeado
                        case 'arco_atila':
                            if (_tgtChar && !_tgtChar.isDead && _tgtChar.hp > 0 && !passiveExecuting && typeof applyDebuff === 'function') {
                                applyDebuff(targetName, { name:'Ceguera', type:'debuff', duration:2, emoji:'🙈' });
                                addLog('🏹 Arco de Atila: Ceguera (2T) aplicada a ' + targetName, 'debuff');
                            }
                            break;

                        // LLAVE NEGRA DE KIREI: al ejecutar un especial, limpia 1 buff de cada enemigo golpeado
                        case 'llave_kirei':
                            if (_tgtChar && !_tgtChar.isDead && gameState._lastAbilityType === 'special' && !passiveExecuting) {
                                const _lkBuffs = (_tgtChar.statusEffects||[]).filter(function(e){ return e && e.type==='buff'; });
                                if (_lkBuffs.length > 0) {
                                    const _lkIdx = _tgtChar.statusEffects.indexOf(_lkBuffs[0]);
                                    if (_lkIdx > -1) {
                                        _tgtChar.statusEffects.splice(_lkIdx, 1);
                                        addLog('🗝️ Llave Negra de Kirei: 1 buff limpiado de ' + targetName, 'debuff');
                                    }
                                }
                            }
                            break;

                        // ESPADA DE ACERO VALYRIO: el Over ST tiene 1% de eliminar al objetivo
                        case 'espada_valyrio':
                            if (_tgtChar && !_tgtChar.isDead && _tgtChar.hp > 0 && gameState._lastAbilityType === 'over' &&
                                gameState._lastAbilityTarget === 'single' && !passiveExecuting) {
                                if (Math.random() < 0.01) {
                                    _tgtChar.hp = 0; _tgtChar.isDead = true;
                                    addLog('⚔️ Espada de Acero Valyrio: ¡' + targetName + ' eliminado! (1% de probabilidad, Over ST)', 'damage');
                                    if (typeof registerKill === 'function') registerKill(attackerName, targetName, false);
                                    if (typeof checkGameOver === 'function') checkGameOver();
                                }
                            }
                            break;

                        // HILOS DE CHAKRA DE SASORI: los ataques del portador aplican Posesión
                        case 'hilos_sasori':
                            if (_tgtChar && !_tgtChar.isDead && _tgtChar.hp > 0 && !passiveExecuting && typeof applyDebuff === 'function') {
                                applyDebuff(targetName, { name:'Posesion', type:'debuff', duration:2, emoji:'👁️' });
                                addLog('🕸️ Hilos de Chakra de Sasori: Posesión aplicada a ' + targetName, 'debuff');
                            }
                            break;

                        // FROSTMOURNE (Legendario): daño doble + roba cargas = daño causado + revive víctima
                        case 'frostmourne':
                            if (_tgtChar && remainingDamage > 0 && !passiveExecuting) {
                                // El daño ya fue aplicado. Robar cargas = daño causado
                                var _frostSteal = Math.min((_tgtChar.charges||0), remainingDamage);
                                if (_frostSteal > 0) {
                                    _tgtChar.charges = Math.max(0, (_tgtChar.charges||0) - _frostSteal);
                                    if (_atkChar) _atkChar.charges = Math.min(20, (_atkChar.charges||0) + _frostSteal);
                                    addLog('❄️ Frostmourne: robadas ' + _frostSteal + ' cargas de ' + targetName, 'buff');
                                }
                                // Revivir como aliado si el objetivo muere — incluido Modo Horda: los Orcos
                                // conservan su bandera `isHordaOrc`, así que `startTurn()` los sigue
                                // reconociendo y los hace jugar su turno vía IA de Orcos aunque ahora estén
                                // en el equipo del jugador (ver startTurn en turn-logic.js).
                                if (_tgtChar.hp <= 0 || _tgtChar.isDead) {
                                    // Capturar el equipo del atacante Y el equipo original de la víctima AHORA
                                    // (de forma síncrona), no dentro del setTimeout — en una partida online
                                    // cada cliente sincroniza su propia copia del estado, y para cuando el
                                    // setTimeout diferido corre (400ms después), la referencia al atacante
                                    // (_atkChar) podía ya no resolverse igual en el cliente de la víctima,
                                    // haciendo que el código cayera a "mantener el equipo original" — el
                                    // bug exacto reportado: la víctima revivía en su PROPIO equipo en vez
                                    // del equipo de quien la eliminó.
                                    var _frostAttackerTeam = _atkChar ? _atkChar.team : null;
                                    var _frostVictimOriginalTeam = _tgtChar.team;
                                    // Respaldo robusto: si no se pudo resolver el equipo del atacante,
                                    // usar el equipo OPUESTO al de la víctima — en una batalla de 2
                                    // equipos, quien la eliminó siempre pertenece al equipo contrario.
                                    var _frostRevivedTeam = _frostAttackerTeam || (_frostVictimOriginalTeam === 'team1' ? 'team2' : 'team1');
                                    setTimeout(function() {
                                        var _ft = gameState.characters[targetName];
                                        if (!_ft) return;
                                        _ft.isDead = false;
                                        _ft.hp = _ft.maxHp || 20;
                                        _ft.charges = 20;
                                        _ft.statusEffects = [];
                                        _ft.team = _frostRevivedTeam;
                                        addLog('❄️ Frostmourne: ' + targetName + ' revive como aliado con 100% HP y 20 cargas!', 'buff');
                                        if (typeof renderCharacters === 'function') renderCharacters();
                                        if (typeof pushGameState === 'function' && typeof onlineMode !== 'undefined' && onlineMode) pushGameState();
                                        // Notificar al sistema centralizado de revivificación (dispara, entre
                                        // otras cosas, el Over automático de Skeletor si está en la partida)
                                        if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(targetName);
                                        // SALVAGUARDA (Modo Horda): esta revivificación es asíncrona (400ms de
                                        // retraso) — si en ese lapso checkGameOver() ya había cerrado la oleada
                                        // (porque en el momento del AOE el equipo enemigo ya estaba en 0), no
                                        // reabrir nada; y si por alguna razón el estado quedó inconsistente,
                                        // este re-chequeo garantiza que la oleada nunca se quede trabada.
                                        if (gameState.gameMode === 'horda' && typeof checkGameOver === 'function') checkGameOver();
                                    }, 400);
                                }
                            }
                            break;

                        // MÁSCARA DE TYRAEL: +3 cargas al final de ronda (handled in turn-logic round-end block)
                        case 'tyrael_mask': break;

                        // IGNIFUGOZ: inmune a quemaduras y debuffs de quemadura (handled in applyDebuff + DOT)
                        case 'ignifugoz_immunity': break;

                        // Ignora Esquiva Área, daño doble + 2 cargas por enemigo con Esquiva Área (buff o pasiva)
                        case 'vortex_pierce':
                            if (_tgtChar && !passiveExecuting) {
                                const _vxHasEA = (typeof hasStatusEffect === 'function' &&
                                    (hasStatusEffect(targetName, 'Esquiva Área') || hasStatusEffect(targetName, 'Esquiva Area'))) ||
                                    (_tgtChar.esquivaAreaPassive) ||
                                    (_tgtChar.passive && _tgtChar.passive.description && _tgtChar.passive.description.toLowerCase().includes('esquiva') && _tgtChar.passive.description.toLowerCase().includes('area'));
                                if (_vxHasEA) {
                                    passiveExecuting = true;
                                    // Daño doble adicional (el daño base ya fue aplicado antes de llegar aquí)
                                    applyDamageWithShield(targetName, remainingDamage, attackerName);
                                    // +2 cargas al portador por este enemigo
                                    if (_atkChar) _atkChar.charges = Math.min(20, (_atkChar.charges||0) + 2);
                                    addLog('🌀 Vortex: daño doble a ' + targetName + ' (Esquiva Área) + 2 cargas al portador', 'damage');
                                    passiveExecuting = false;
                                }
                            }
                            break;

                        // Al congelar → +1 carga
                        case 'freeze_charge': break; // handled in applyFreeze

                        // Golpear enemigo sin cargas → +2 cargas
                        case 'no_charge_bonus':
                            if (_tgtChar && (_tgtChar.charges||0) === 0) {
                                _atkChar.charges = Math.min(20, (_atkChar.charges||0) + 2);
                                addLog('⚡ Ballesta de Cristal: +2 cargas (objetivo sin cargas)', 'buff');
                            }
                            break;

                        // Sable Nishant: 25% turno extra — una sola tirada por ataque (ver primer bloque)
                        case 'extra_turn_25':
                            if (!gameState._nishanExtraTurnRolledThisTurn && Math.random() < 0.25 && !gameState._skeggoxExtraTurn) {
                                gameState._nishanExtraTurnRolledThisTurn = true;
                                gameState._skeggoxExtraTurn = attackerName;
                                addLog('✨ Sable Nishant: ' + attackerName + ' gana turno adicional (25%)', 'buff');
                            } else if (!gameState._nishanExtraTurnRolledThisTurn) {
                                gameState._nishanExtraTurnRolledThisTurn = true;
                            }
                            break;

                        // Colmillo de Agron: golpe crítico → equipo aliado +3 cargas
                        case 'crit_team_charges':
                            if (gameState._isCritHit && _atkChar) {
                                var _ctTeam = _atkChar.team;
                                Object.keys(gameState.characters).forEach(function(n) {
                                    var _c = gameState.characters[n];
                                    if (_c && _c.team === _ctTeam && !_c.isDead) _c.charges = Math.min(20, (_c.charges||0) + 3);
                                });
                                addLog('⚡ Colmillo de Agron: equipo ' + _ctTeam + ' gana 3 cargas por crítico', 'buff');
                            }
                            break;

                        // ergonos_basic: handled above (no duplicate)

                        // Zenit: +3 cargas al recibir golpe (handled in defender section below)
                        case 'zenit_tank': break;

                        // Regen +2HP por turno (handled in turn start)
                        case 'regen_2hp_turn': break;

                        // 25% aplicar Miedo al atacante al recibir golpe (defender relic)
                        case 'fear_on_hit_25': break;

                        // Vestidura Arcana: daño recibido → mismas cargas + fin ronda +4HP (handled elsewhere)
                        case 'vestidura_arcana': break;

                        // Golpear con Provocación/MegaProv → 1 turno adicional por ronda + ignorar Provocación en ese turno
                        case 'taunt_extra_turn':
                            if (_tgtChar && (hasStatusEffect(targetName, 'Provocacion') || hasStatusEffect(targetName, 'Mega Provocacion') ||
                                            hasStatusEffect(targetName, 'Provocación') || hasStatusEffect(targetName, 'MegaProvocacion') ||
                                            // Also check passive-based Provocacion (Aldebaran, Nazgul)
                                            (_tgtChar.passive && (_tgtChar.passive.name === 'Fortaleza de Tauro' || _tgtChar.passive.name === 'Señor de los Nazgul' || _tgtChar.passive.name === 'Primogénito del Sol' || _tgtChar.passive.name === 'Primogenito del Sol')))) {
                                // Solo 1 vez por ronda por personaje
                                var _skRoundKey = '_skeggoxUsedRound_' + (gameState.selectedCharacter || attackerName).replace(/\s/g,'_');
                                var _skAlreadyUsed = gameState[_skRoundKey] === gameState.currentRound;
                                if (!_skAlreadyUsed) {
                                    gameState[_skRoundKey] = gameState.currentRound; // marcar como usada esta ronda
                                    // Marcar turno adicional pendiente — endTurn lo leerá
                                    gameState._skeggoxExtraTurn = gameState.selectedCharacter || attackerName;
                                    // El bypass de provocacion se activa y se consume DESPUÉS del ataque del turno extra
                                    // No se consume en ability-select, sino en summons.js al completar el turno extra
                                    if (_atkChar) _atkChar._ignoreTauntNextAttack = true;
                                    addLog('🪓 Skeggöx: ' + (gameState.selectedCharacter || attackerName) + ' gana turno adicional + ignora Provocación en ese turno (1x por ronda)', 'buff');
                                }
                            }
                            break;

                    }
                });

                // ── EFECTOS DE RELIQUIAS DEL DEFENSOR ──
                const _defRelics = _tgtChar ? (_tgtChar.equippedRelics || []) : [];
                _defRelics.forEach(function(relicName) {
                    if (!relicName) return;
                    const _rd2 = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[relicName] : null;
                    if (!_rd2) return;

                    if (_rd2.effect === 'zenit_tank' && remainingDamage > 0) {
                        // 50% reducción de daño recibido + 3 cargas
                        var _zenitReduce = Math.floor(remainingDamage * 0.5);
                        if (_zenitReduce > 0 && _tgtChar) {
                            const _znOld = _tgtChar.hp;
                            _tgtChar.hp = Math.min(_tgtChar.maxHp, (_tgtChar.hp||0) + _zenitReduce);
                            if (_tgtChar.hp > _znOld && typeof showHpTick === 'function') showHpTick(targetName, _tgtChar.hp - _znOld); if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting) { var _bsC = gameState.characters[targetName]; if (_bsC) triggerBendicionSagrada(_bsC.team, 0); }
                            addLog('🛡️ Zenit: ' + targetName + ' reduce ' + _zenitReduce + ' daño (50%)', 'buff');
                        }
                        if (_tgtChar) {
                            _tgtChar.charges = Math.min(20, (_tgtChar.charges||0) + 3);
                            addLog('🛡️ Zenit: ' + targetName + ' gana 3 cargas al recibir daño', 'buff');
                        }
                    }
                    if (_rd2.effect === 'fear_on_hit_25' && Math.random() < 0.25 && _atkChar) {
                        if (typeof applyDebuff === 'function')
                            applyDebuff(attackerName, { name:'Miedo', type:'debuff', duration:2, emoji:'😨' });
                        addLog('😨 Brazalete Demoniaco: Miedo aplicado a ' + attackerName, 'debuff');
                    }
                    if (_rd2.effect === 'vestidura_arcana' && remainingDamage > 0 && _tgtChar) {
                        _tgtChar.charges = Math.min(20, (_tgtChar.charges||0) + remainingDamage);
                        addLog('🔮 Vestidura Arcana: ' + targetName + ' gana ' + remainingDamage + ' cargas', 'buff');
                    }
                    if (_rd2.effect === 'hp_on_basic_hit' && _tgtChar) {
                        // Yelmo de Ork: +2HP al recibir cualquier ataque básico
                        // Detectamos básico si chargeGain <= 2 y damage <= 3 (heurística segura)
                        // o si gameState._lastAbilityType está marcado como 'basic'
                        var _isBasicAtk = (typeof ability !== 'undefined' && ability && ability.type === 'basic') ||
                                          (gameState._lastAbilityType === 'basic');
                        if (_isBasicAtk) {
                            // Usar applyHeal para respetar canHeal() — bloquea si QS activa
                            if (typeof applyHeal === 'function') {
                                const _ykHealed = applyHeal(targetName, 2, 'Yelmo de Ork');
                                if (_ykHealed > 0) addLog('🪖 Yelmo de Ork: ' + targetName + ' recupera 2HP (recibió básico)', 'heal');
                            }
                        }
                    }
                    if (_rd2.effect === 'debuff_resist_15' && Math.random() < 0.15) {
                        // Remove a random debuff from defender (called externally on debuff apply)
                        // This is best-effort here: try to remove one
                        const _deBufDebuffs = (_tgtChar.statusEffects||[]).filter(function(e){ return e && e.type === 'debuff'; });
                        if (_deBufDebuffs.length > 0 && _tgtChar) {
                            const _toRemove = _deBufDebuffs[0];
                            _tgtChar.statusEffects = _tgtChar.statusEffects.filter(function(e){ return e !== _toRemove; });
                            addLog('🛡️ Anillo de la Verdad: ' + targetName + ' limpia un debuff', 'buff');
                        }
                    }
                    // Daga de Kaisel: trigger movido a applyDebuff() en debuffs.js (activación correcta al RECIBIR debuff)
                });
                gameState._relicEffectsActive = false;
                } // end if (!gameState._relicEffectsActive)
            } // end if (remainingDamage > 0 && attackerName...)

            // ── EL OJO QUE TODO LO VE (Sauron) — efectos activos cuando SAURON ES EL OBJETIVO
            //    que recibe daño (los efectos del lado "atacante" — bono +5 daño por Anillo,
            //    robo de HP por Capa, Mega Posesión por 3 Raras — viven en el bucle de bonos de
            //    reliquia del atacante en skills.js, junto a Puño de Obsidiana). ──
            if (damage > 0 && target.passive && target.passive.name === 'El Ojo que Todo lo Ve') {
                const _saCounts = { tier: {}, subtype: {} };
                (target.equippedRelics || []).forEach(function (rn) {
                    const rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[rn] : null;
                    if (!rd) return;
                    _saCounts.tier[rd.tier] = (_saCounts.tier[rd.tier] || 0) + 1;
                    _saCounts.subtype[rd.subtype] = (_saCounts.subtype[rd.subtype] || 0) + 1;
                });
                // 6 Legendarias: inmune a TODO daño mientras haya otro aliado vivo
                const _saOtherAllyAlive = Object.values(gameState.characters).some(function (c) {
                    return c && c !== target && c.team === target.team && !c.isDead && c.hp > 0;
                });
                if ((_saCounts.tier['Legendario'] || 0) >= 6 && _saOtherAllyAlive) {
                    damage = 0;
                    addLog('👁️ El Ojo que Todo lo Ve: Sauron es inmune a todo daño (6 Legendarias, hay otro aliado vivo)', 'buff');
                }
                // 2 Épicas: solo puede recibir daño de ataques REALES (no directo) de enemigos con
                // al menos 1 reliquia Legendaria de tipo Arma
                else if ((_saCounts.tier['Epico'] || 0) >= 2 && attackerName !== null) {
                    const _saAttacker = gameState.characters[attackerName];
                    const _saAttackerHasLegArma = _saAttacker && (_saAttacker.equippedRelics || []).some(function (rn) {
                        const rd = (typeof RELICS_DATA !== 'undefined') ? RELICS_DATA[rn] : null;
                        return rd && rd.tier === 'Legendario' && rd.slotCategory === 'Arma';
                    });
                    if (!_saAttackerHasLegArma) {
                        damage = 0;
                        addLog('👁️ El Ojo que Todo lo Ve: Sauron ignora el daño (2 Épicas — atacante sin Arma Legendaria)', 'buff');
                    }
                }
                // Yelmo equipado: regenera 10 HP cada vez que recibe un golpe (ataque real)
                if ((_saCounts.subtype['Yelmo'] || 0) >= 1 && attackerName !== null && !target.isDead && target.hp > 0) {
                    if (typeof applyHeal === 'function') applyHeal(targetName, 10, 'El Ojo que Todo lo Ve (Yelmo)');
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

            // ── SEÑOR DE LOS NAZGUL (Rey Brujo): Infectar — 2 stacks de Veneno al atacante al recibir daño ──
            if (remainingDamage > 0 && attackerName && !passiveExecuting && !_yorichiPassiveBlocked &&
                target.passive && target.passive.name === 'Señor de los Nazgul' &&
                target.hp > 0 && !target.isDead) {
                passiveExecuting = true;
                if (typeof applyPoison === 'function') applyPoison(attackerName, 2);
                addLog('🦠 Infectar: ' + attackerName + ' recibe Veneno 2S al atacar al Rey Brujo', 'debuff');
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

            // ── PIEL DE NANOOK (Bjorn): al recibir daño → Miedo 2T al atacante + roba 1 carga de todos los enemigos ──
            // Fires after damage applied, uses oldHp-target.hp to confirm real damage received
            (function() {
                if (passiveExecuting) return;
                const _bjornChar = gameState.characters[targetName];
                if (!_bjornChar || !_bjornChar.passive || _bjornChar.passive.name !== 'Piel de Nanook') return;
                if (!attackerName || attackerName === targetName) return;
                const _realDmg = oldHp - _bjornChar.hp;
                if (_realDmg <= 0) return; // no real damage received
                const _bjTeam = _bjornChar.team;
                const _bjETeam = _bjTeam === 'team1' ? 'team2' : 'team1';
                passiveExecuting = true;
                // Apply Miedo 2T to attacker
                if (typeof applyDebuff === 'function') {
                    applyDebuff(attackerName, { name:'Miedo', type:'debuff', duration:2, emoji:'😨' });
                } else {
                    const _atk = gameState.characters[attackerName];
                    if (_atk && typeof applyDebuff === 'function') applyDebuff(attackerName, { name:'Miedo', type:'debuff', duration:2, emoji:'😱' });
                }
                addLog('🐻 Piel de Nanook: ' + attackerName + ' recibe Miedo 2T', 'debuff');
                // Steal 1 charge from EACH enemy → Bjorn gains total stolen
                let _stolen = 0;
                Object.values(gameState.characters).forEach(function(ec) {
                    if (!ec || ec.team !== _bjETeam || ec.isDead || (ec.charges||0) <= 0) return;
                    ec.charges = Math.max(0, ec.charges - 1);
                    _stolen++;
                });
                if (_stolen > 0) {
                    _bjornChar.charges = Math.min(20, (_bjornChar.charges||0) + _stolen);
                    addLog('🐻 Piel de Nanook: roba 1 carga de ' + _stolen + ' enemigos (+' + _stolen + ' cargas a Bjorn)', 'buff');
                }
                passiveExecuting = false;
            })();

            // ── MODO HORDA: gancho genérico "al recibir daño" (Agresion, Rugido Provocador, Fuerza descomunal, etc.) ──
            (function() {
                if (passiveExecuting) return;
                const _realDmgHorda = oldHp - target.hp;
                if (_realDmgHorda <= 0) return;
                if (typeof window.hordaOnDamageReceived === 'function') {
                    window.hordaOnDamageReceived(targetName, _realDmgHorda, attackerName);
                }
            })();

            // ── CAMPO: SENDERO DE LOS DIOSES (Thanatos) — al recibir daño de un golpe enemigo,
            // cura la mitad del daño recibido y contraataca al doble de ese daño ──
            (function() {
                if (passiveExecuting) return;
                if (!gameState.activeField || gameState.activeField.name !== 'Sendero de los Dioses') return;
                if (targetName !== gameState.activeField.ownerName) return;
                if (!attackerName || attackerName === targetName) return;
                const _sdDmg = oldHp - target.hp;
                if (_sdDmg <= 0) return;
                const _sdHeal = Math.floor(_sdDmg / 2);
                const _sdCounter = _sdDmg * 2;
                if (_sdHeal > 0 && typeof applyHeal === 'function') applyHeal(targetName, _sdHeal, 'Sendero de los Dioses');
                passiveExecuting = true;
                applyDamageWithShield(attackerName, _sdCounter, targetName);
                passiveExecuting = false;
                addLog('🌌 Sendero de los Dioses: ' + targetName + ' recupera ' + _sdHeal + ' HP y contraataca a ' + attackerName + ' por ' + _sdCounter + ' daño', 'buff');
            })();

            // ── ARMADURA DE CRIXO: al recibir golpe enemigo → Ceguera 2T al atacante + portador +5 velocidad
            // hasta el final de la próxima ronda ──
            (function() {
                if (passiveExecuting) return;
                if (!attackerName || attackerName === targetName) return;
                const _crixoDmg = oldHp - target.hp;
                if (_crixoDmg <= 0) return;
                if (!(target.equippedRelics || []).includes('Armadura de Crixo')) return;
                if (typeof applyDebuff === 'function') applyDebuff(attackerName, { name: 'Ceguera', type: 'debuff', duration: 2, emoji: '👁️' });
                if (!target._crixoSpeedRoundsLeft) {
                    target.speed = (target.speed || 0) + 5;
                }
                target._crixoSpeedRoundsLeft = 2; // se revierte al final de la PRÓXIMA ronda (ver processEndOfRoundEffects)
                addLog('🛡️ Armadura de Crixo: ' + targetName + ' aplica Ceguera 2T a ' + attackerName + ' y gana +5 velocidad', 'buff');
            })();

            // ── ICE CLON: absorb damage meant for Sub-Zero ──
            (function() {
                if (passiveExecuting) return;
                const _szC2 = gameState.characters[targetName];
                if (!_szC2 || !_szC2.passive || _szC2.passive.name !== 'Absolute Zero') return;
                if (!_szC2._iceClonActive) return;
                // Find ICE CLON summoned by this Sub-Zero
                let _iceClonId = null;
                for (const _icId in gameState.summons||{}) {
                    const _ic = gameState.summons[_icId];
                    if (_ic && _ic.name === 'ICE CLON' && _ic.summoner === targetName && _ic.hp > 0) {
                        _iceClonId = _icId; break;
                    }
                }
                if (!_iceClonId) { _szC2._iceClonActive = false; return; } // ICE CLON gone
                const _ic2 = gameState.summons[_iceClonId];
                // Redirect damage to ICE CLON
                const _icOldHp = _ic2.hp;
                _ic2.hp = Math.max(0, _ic2.hp - (remainingDamage||0));
                const _icDmgTaken = _icOldHp - _ic2.hp;
                addLog('🧊 ICE CLON absorbe ' + _icDmgTaken + ' daño de ' + targetName, 'buff');
                // Apply Megacongelación to random enemy when ICE CLON loses HP
                if (_icDmgTaken > 0) {
                    const _icETeam = _szC2.team === 'team1' ? 'team2' : 'team1';
                    const _icEnemies = Object.keys(gameState.characters).filter(function(n){
                        const _cc=gameState.characters[n]; return _cc&&_cc.team===_icETeam&&!_cc.isDead&&_cc.hp>0;
                    });
                    if (_icEnemies.length) {
                        passiveExecuting = true;
                        const _rndE = _icEnemies[Math.floor(Math.random()*_icEnemies.length)];
                        if (typeof applyFreeze === 'function') applyFreeze(_rndE, 2, true);
                        passiveExecuting = false;
                        addLog('🧊 ICE CLON: Megacongelación aplicada a ' + _rndE, 'debuff');
                    }
                    if (_ic2.hp <= 0) {
                        delete gameState.summons[_iceClonId];
                        _szC2._iceClonActive = false;
                        addLog('🧊 ICE CLON destruido — Sub-Zero pierde inmunidad a debuffs', 'damage');
                        if (typeof renderSummons === 'function') renderSummons();
                    }
                }
                // Block original damage to Sub-Zero
                remainingDamage = 0;
            })();

            // ── CABALLERO DE LA NOCHE (Batman): al recibir daño → Ceguera 2T a enemigo aleatorio sin Ceguera ──
            (function() {
                if (passiveExecuting) return;
                const _batC = gameState.characters[targetName];
                if (!_batC || !_batC.passive || _batC.passive.name !== 'Caballero de la Noche') return;
                const _batDmg = oldHp - _batC.hp;
                if (_batDmg <= 0) return;
                const _batETeam = _batC.team === 'team1' ? 'team2' : 'team1';
                // Find random enemy without Ceguera
                const _batTargets = Object.keys(gameState.characters).filter(function(n){
                    const _c = gameState.characters[n];
                    if (!_c || _c.team !== _batETeam || _c.isDead || _c.hp <= 0) return false;
                    return !(_c.statusEffects||[]).some(function(e){ return e && e.name === 'Ceguera'; });
                });
                if (!_batTargets.length) return;
                const _rnd = _batTargets[Math.floor(Math.random() * _batTargets.length)];
                passiveExecuting = true;
                if (typeof applyDebuff === 'function') {
                    applyDebuff(_rnd, { name:'Ceguera', type:'debuff', duration:2, emoji:'👁️', blind:true });
                } else {
                    (gameState.characters[_rnd].statusEffects = gameState.characters[_rnd].statusEffects||[]).push({ name:'Ceguera', type:'debuff', duration:2, emoji:'👁️', blind:true });
                }
                passiveExecuting = false;
                addLog('🦇 Caballero de la Noche: ' + _rnd + ' recibe Ceguera 2T (Batman recibió daño)', 'debuff');
            })();

            // ── EXPLOSIÓN DE SANGRE (Nezuko): al recibir daño → cura 3 HP al aliado con menos HP ──
            (function() {
                if (passiveExecuting) return;
                const _nezC = gameState.characters[targetName];
                if (!_nezC || !_nezC.passive || _nezC.passive.name !== 'Explosión de Sangre') return;
                const _realDmg2 = oldHp - _nezC.hp;
                if (_realDmg2 <= 0) return;
                const _nezTeam = _nezC.team;
                let _lowestName = null, _lowestHpPct = 2;
                for (const _an in gameState.characters) {
                    const _ac = gameState.characters[_an];
                    if (!_ac || _ac.team !== _nezTeam || _ac.isDead || _ac.hp <= 0) continue;
                    const _pct = _ac.hp / (_ac.maxHp || 1);
                    if (_pct < _lowestHpPct) { _lowestHpPct = _pct; _lowestName = _an; }
                }
                if (_lowestName && typeof applyHeal === 'function') {
                    passiveExecuting = true;
                    applyHeal(_lowestName, 3, 'Explosión de Sangre');
                    passiveExecuting = false;
                    addLog('🌸 Explosión de Sangre: ' + _lowestName + ' recupera 3 HP (Nezuko recibió daño)', 'heal');
                }
            })();

            // ── PIEL DE NANOOK (Bjorn): inmune a Congelación y MegaCongelación ──
            // (handled in applyFreeze/applyDebuff)

            // ── PALADÍN DE LA MANO DE PLATA (Tirion): al llegar a 10 HP → Protección Sagrada + Escudo Sagrado + 20 cargas ──
            if (remainingDamage > 0 && !passiveExecuting &&
                target.passive && target.passive.name === 'Paladín de la Mano de Plata' &&
                !target.tirionLowHpTriggered && target.hp > 0 && !target.isDead &&
                target.hp <= 10) {
                target.tirionLowHpTriggered = true;
                passiveExecuting = true;
                // Disipar los debuffs activos en Tirion (no permanentes)
                const _tirDebuffsCleared = (target.statusEffects || []).filter(function (e) { return e && e.type === 'debuff' && !e.permanent; }).length;
                target.statusEffects = (target.statusEffects || []).filter(function (e) { return !e || e.type !== 'debuff' || e.permanent; });
                if (_tirDebuffsCleared > 0) addLog('🌟 Paladín de la Mano de Plata: ' + _tirDebuffsCleared + ' debuff(s) disipado(s) de Tirion', 'buff');
                // Protección Sagrada — 2 turnos, limpiable por habilidades de disipación
                if (typeof hasStatusEffect === 'function' && !hasStatusEffect(targetName, 'Proteccion Sagrada')) {
                    target.statusEffects.push({ name: 'Proteccion Sagrada', type: 'buff', duration: 2, emoji: '🛡️' });
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
                    const _tauroOld = target.hp;
                    { const _ph2Old=target.hp; target.hp = Math.min(target.maxHp, target.hp + 2); if(typeof notifyHeal==='function') notifyHeal(targetName, target.hp-_ph2Old, 'passive heal'); }
                    if (target.hp > _tauroOld && typeof showHpTick === 'function') showHpTick(targetName, target.hp - _tauroOld); if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting) { var _bsC = gameState.characters[targetName]; if (_bsC) triggerBendicionSagrada(_bsC.team, 0); }
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

            // ── HORROCRUX VIVIENTE (Voldemort): interceptar muerte si Nagini activa → sobrevive con 1 HP ──
            if (target && target.hp <= 0 && !target.isDead && target.passive && target.passive.name === 'Horrocrux Viviente') {
                const _voldTeam = target.team;
                const _naginiActive = Object.values(gameState.summons||{}).some(function(s){
                    return s && s.name === 'Nagini' && s.team === _voldTeam && !s.isDead && s.hp > 0;
                });
                if (_naginiActive) {
                    target.hp = 1;
                    target.isDead = false;
                    target._naginiSurvivedRound = gameState.currentRound;
                    addLog('🐍 Horrocrux Viviente: Voldemort sobrevive con 1 HP — no puede recibir más daño esta ronda', 'buff');
                    // Mark as immune until next round
                    target._naginiImmuneRound = gameState.currentRound;
                }
            }

            // Verificar si fue derrotado
            // Damage tick animation removed

            if (target.hp <= 0 && oldHp > 0) {
                // ── ANILLO DEL TIEMPO: revivir UNA VEZ con 100% HP + 20 cargas + turno adicional ──
                if (!target._anilloUsed && (target.equippedRelics||[]).includes('Anillo del Tiempo')) {
                    target._anilloUsed = true;
                    target.hp = target.maxHp;
                    target.charges = Math.min(20, (target.charges||0) + 20);
                    gameState._skeggoxExtraTurn = targetName;
                    addLog('⌛ Anillo del Tiempo: ' + targetName + ' revive con ' + target.hp + ' HP y 20 cargas + turno adicional', 'buff');
                    if (typeof _animCard === 'function') _animCard(targetName, 'anim-transform', 700);
                // ── COLLAR DE TSUNADE: una vez por combate, restaura 40% de HP en vez de morir ──
                } else if (!target._tsunadeUsed && (target.equippedRelics||[]).includes('Collar de Tsunade')) {
                    target._tsunadeUsed = true;
                    target.hp = Math.max(1, Math.ceil(target.maxHp * 0.40));
                    addLog('💚 Collar de Tsunade: ' + targetName + ' restaura ' + target.hp + ' HP en vez de ser eliminado (única vez)', 'buff');
                    if (typeof _animCard === 'function') _animCard(targetName, 'anim-transform', 700);
                } else {
                    target.isDead = true;
                    // ── SQUADS: registro acumulativo de muertes durante la batalla — un personaje
                    //    revivido (por Frostmourne u otro efecto) no estaría marcado como isDead
                    //    al finalizar, así que el conteo por estado final lo perdería. Con este
                    //    set, cualquier personaje que haya muerto en ALGÚN MOMENTO de la batalla
                    //    queda registrado para el cómputo de fragmentos de alma. ──
                    if (window._squadsMode) {
                        gameState._killedThisBattle = gameState._killedThisBattle || {};
                        const _kbName = targetName.replace(/\s+v\d+$/i, '').trim();
                        gameState._killedThisBattle[_kbName] = true;
                    }
                    if (typeof _animCard === 'function') _animCard(targetName, 'anim-defeat', 700);

                    // ── MODO HORDA: gancho genérico "al morir" (Sed de Sangre, Aniquilacion, etc.) ──
                    if (typeof window.hordaOnCharacterDeath === 'function') {
                        window.hordaOnCharacterDeath(targetName);
                    }

                    // ── ESTRATEGA DE ODIN (Ragnar): si aliado muere mientras Ragnar está muerto → Ragnar revive ──
                    if (targetName !== 'Ragnar Lothbrok') { // Don't trigger on Ragnar's own death
                        const _diedTeam = target.team;
                        for (const _rN in gameState.characters) {
                            const _rC = gameState.characters[_rN];
                            if (!_rC || !_rC.passive || _rC.passive.name !== 'Estratega de Odin') continue;
                            if (_rC.team !== _diedTeam) continue;
                            if (!_rC.isDead || _rC.hp > 0) continue; // Ragnar must already be dead
                            // Ragnar revives
                            _rC.isDead = false; _rC.hp = 15; _rC.charges = 20;
                            addLog('🪓 Estratega de Odin: ¡Ragnar revive con 15 HP y 20 cargas!', 'buff');
                            if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(_rN);
                            const _rETeam = _rC.team === 'team1' ? 'team2' : 'team1';
                            const _rEnemies = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c&&c.team===_rETeam&&!c.isDead&&c.hp>0; });
                            if (_rEnemies.length > 0) {
                                const _rEnemy = _rEnemies[Math.floor(Math.random()*_rEnemies.length)];
                                const _rEnemyC = gameState.characters[_rEnemy];
                                const _rHpLost = Math.floor(_rEnemyC.hp * 0.50);
                                applyDamageWithShield(_rEnemy, _rHpLost, _rN);
                                addLog('🪓 Estratega de Odin: ' + _rEnemy + ' pierde 50% HP (' + _rHpLost + ')', 'damage');
                            }
                            if (typeof renderCharacters === 'function') renderCharacters();
                        }
                    }

                    // ── GOGETA: al morir → Goku y Vegeta se unen al equipo ──
                    if (targetName === 'Gogeta' && !target._fusionExpired) {
                        target._fusionExpired = true;
                        addLog('💥 Fusión Perfecta: Gogeta ha caído — ¡Goku y Vegeta se unen al equipo!', 'info');
                        var _goTeam = target.team;
                        ['Goku', 'Vegeta'].forEach(function(charName) {
                            if (!gameState.characters[charName] && window.characterData && window.characterData[charName]) {
                                var d = window.characterData[charName];
                                gameState.characters[charName] = Object.assign({}, d, {
                                    hp: d.hp||20, maxHp: d.hp||20, charges: 0, team: _goTeam,
                                    statusEffects: [], shield: 0, isDead: false
                                });
                                if (!gameState.turnOrder.includes(charName)) gameState.turnOrder.push(charName);
                                addLog('👊 ' + charName + ' se une al combate por la Fusión Perfecta', 'buff');
                            }
                        });
                        gameState.turnOrder = gameState.turnOrder.filter(function(n){ return n !== 'Gogeta'; });
                        if (typeof calculateTurnOrder === 'function') calculateTurnOrder();
                    }
                    // ── BATTLE STATS: registrar kill usando función centralizada ──
                    const _killer = attackerName || gameState._currentTurnAttacker || null;
                    if (_killer) registerKill(_killer, targetName, false);
                }
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

                // TALISMÁN DE HERMES: al morir un enemigo → equipo aliado +1 velocidad
                if (!passiveExecuting) {
                    const _deadC = gameState.characters[targetName];
                    const _deadTeam = _deadC ? _deadC.team : null;
                    if (_deadTeam) {
                        const _allyTeam = _deadTeam === 'team1' ? 'team2' : 'team1';
                        for (const _thN in gameState.characters) {
                            const _thC = gameState.characters[_thN];
                            if (!_thC || _thC.team !== _allyTeam || _thC.isDead || _thC.hp <= 0) continue;
                            if (!(_thC.equippedRelics||[]).includes('Talismán de Hermes')) continue;
                            // +1 velocidad a todo el equipo aliado
                            for (const _an in gameState.characters) {
                                const _ac = gameState.characters[_an];
                                if (_ac && _ac.team === _allyTeam && !_ac.isDead) _ac.speed = (_ac.speed||80) + 1;
                            }
                            addLog('⚡ Talismán de Hermes: equipo aliado +1 velocidad (' + targetName + ' eliminado)', 'buff');
                            break;
                        }
                    }
                }

                // CIUDAD DE LA DEVASTACIÓN (Kurumi): al morir cualquier personaje → Kurumi gana 10 cargas
                if (!passiveExecuting) {
                    for (const _kuN in gameState.characters) {
                        const _kuC = gameState.characters[_kuN];
                        if (!_kuC || _kuC.isDead || _kuC.hp <= 0) continue;
                        if (!_kuC.passive || _kuC.passive.name !== 'Ciudad de la Devastación') continue;
                        _kuC.charges = Math.min(20, (_kuC.charges||0) + 10);
                        addLog('🕑 Ciudad de la Devastación: Kurumi gana 10 cargas (' + targetName + ' eliminado)', 'buff');
                        break;
                    }
                }

                // SANGRE DE NUMENOR (Aragorn): cuando un ALIADO muere → Aragorn y un aliado aleatorio ejecutan su Over
                // NOTA: a propósito NO se filtra por !passiveExecuting — la pasiva debe activarse
                // "cuando un aliado muere" sin importar si la muerte ocurrió durante un ataque
                // automático de otro personaje (ej. Baran ejecutando Frenzied Slash al inicio de
                // ronda, envuelto en passiveExecuting=true durante sus 3 golpes). Si esos 3 golpes
                // matan a varios aliados de Aragorn, cada muerte debe programar su propio disparo
                // (el setTimeout de 500ms ya desacopla la ejecución real del estado de
                // passiveExecuting en el momento en que ocurrió la muerte).
                {
                    const _deadChar = gameState.characters[targetName];
                    const _deadTeam = _deadChar ? _deadChar.team : null;
                    if (_deadTeam) {
                        // Buscar Aragorn en el mismo equipo que el muerto
                        const _aragornN = Object.keys(gameState.characters).find(function(_n){
                            const _c = gameState.characters[_n];
                            return _c && !_c.isDead && _c.hp > 0 && _c.team === _deadTeam && _c.passive && _c.passive.name === 'Sangre de Numenor';
                        });
                        if (_aragornN && _aragornN !== targetName) {
                            setTimeout(function() {
                                if (typeof _triggerAragornOverOnDeath === 'function') _triggerAragornOverOnDeath(_aragornN, _deadTeam);
                            }, 500);
                        }
                    }
                }

                // SOBERANO DE LA DESTRUCCIÓN (Skeletor): al morir un aliado jugable (no invocación),
                // 50% de revivir a ese aliado OR 50% de revivir al propio Skeletor si está eliminado.
                if (!passiveExecuting && !target.isSummon && !target.isBoss) {
                    const _skDeadTeam = target.team;
                    for (const _skN in gameState.characters) {
                        const _skC = gameState.characters[_skN];
                        if (!_skC || !_skC.passive || _skC.passive.name !== 'Soberano de la Destrucción') continue;
                        if (_skC.team !== _skDeadTeam) continue; // Skeletor en el mismo equipo

                        if (_skC.isDead || _skC.hp <= 0) {
                            // Skeletor también está muerto: 50% de que Skeletor reviva
                            if (Math.random() < 0.50) {
                                _skC.isDead = false; _skC.hp = _skC.maxHp; _skC.charges = 0; _skC.statusEffects = [];
                                addLog('💀 Soberano de la Destrucción: ¡Skeletor revive con 100% HP!', 'buff');
                                if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(_skN);
                                if (typeof renderCharacters === 'function') renderCharacters();
                            }
                        } else {
                            // Skeletor vivo: 50% de revivir al aliado recién eliminado
                            if (Math.random() < 0.50 && (target.isDead || target.hp <= 0)) {
                                target.isDead = false; target.hp = target.maxHp; target.charges = 0; target.statusEffects = [];
                                addLog('💀 Soberano de la Destrucción: ' + targetName + ' revive con 100% HP (Skeletor)', 'buff');
                                if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(targetName);
                                if (typeof renderCharacters === 'function') renderCharacters();
                            }
                        }
                        break;
                    }
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

            // ── HI NO ISHI (Tsunade): cada vez que ELLA recibe daño (de cualquier fuente,
            //    incluido el daño absorbido de un aliado), gana 1 contador Senju: +2 HP y +2 HP
            //    máx. Vive DESPUÉS de toda la resolución de muerte (no antes) — así, si el golpe
            //    es letal, la bonificación de HP nunca puede "revivirla" impidiendo su muerte real.
            //    Solo aplica si sigue viva al llegar aquí (por sí misma, o por otra reliquia de
            //    revivificación legítima que ya se haya procesado arriba). ──
            if (remainingDamage > 0 && target && !target.isDead && target.hp > 0 &&
                target.passive && target.passive.name === 'Hi no Ishi') {
                target._senjuCounters = (target._senjuCounters || 0) + 1;
                target.maxHp = (target.maxHp || 0) + 2;
                target.hp = Math.min(target.maxHp, target.hp + 2);
                addLog('💪 Hi no Ishi: Tsunade gana un contador Senju (' + target._senjuCounters + ') — +2 HP y +2 HP máx', 'buff');
            }

            // ── DEIDAD DE MORTALES (Goku Black): dos ganchos independientes ──
            if (remainingDamage > 0 && target && !target.isDead && target.hp > 0 &&
                target.passive && target.passive.name === 'Deidad de Mortales') {
                // 1) Cada vez que recibe un GOLPE (no daño directo) → +3 cargas
                if (attackerName !== null) {
                    target.charges = Math.min(20, (target.charges || 0) + 3);
                    addLog('⚫ Deidad de Mortales: Goku Black genera 3 cargas al recibir un golpe', 'buff');
                }
                // 2) Cada vez que recibe daño de CUALQUIER fuente (incluido daño directo) → 10% de
                //    ejecutar su Over automáticamente, con cinemática (mismo patrón que Soldier Boy)
                if (Math.random() < 0.10 && !passiveExecuting) {
                    const _gbOver = (target.abilities || []).find(function (a) { return a && a.type === 'over'; });
                    if (_gbOver) {
                        const _gbName = targetName, _gbTeam = target.team;
                        addLog('⚫ Deidad de Mortales: Goku Black ejecuta ' + _gbOver.name + ' automáticamente (10%)', 'buff');
                        if (typeof _showOverCinematic === 'function') {
                            _showOverCinematic(_gbName, _gbOver.name, _gbOver.effect, _gbTeam, function () {
                                const _gbPrev = gameState.selectedCharacter;
                                const _gbPrevAb = gameState.selectedAbility;
                                const _gbPrevSuppress = gameState._suppressAutoEndTurn;
                                gameState.selectedCharacter = _gbName;
                                gameState.selectedAbility = _gbOver;
                                passiveExecuting = true;
                                gameState._suppressAutoEndTurn = true;
                                try { _executeAbilityCore(null); } catch (e) { console.error('[Deidad de Mortales]', e); }
                                passiveExecuting = false;
                                gameState.selectedCharacter = _gbPrev;
                                gameState.selectedAbility = _gbPrevAb;
                                gameState._suppressAutoEndTurn = _gbPrevSuppress;
                            });
                        }
                    }
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
                        { const _ddOld=_ddChar.hp; _ddChar.hp = Math.min(_ddChar.maxHp, (_ddChar.hp||0) + 2); if(typeof notifyHeal==='function') notifyHeal(targetName, _ddChar.hp-_ddOld, 'passive'); }
                        if (_ddChar.hp > _ddOld && typeof showHpTick === 'function') showHpTick(_ddChar.name||'', _ddChar.hp - _ddOld); if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting && _ddChar) triggerBendicionSagrada(_ddChar.team, 0);
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
                            const _stkOld = _stkAlly.hp;
                    applyHeal(_stkAllyName, 1, 'Tesoro del Cielo');
                    if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting) { var _bsC = gameState.characters[_stkAllyName]; if (_bsC) triggerBendicionSagrada(_bsC.team, 0); }
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
                // ── PECADO DE LA IRA (Meliodas): contraataque → Meliodas +2 cargas ──
                if (!passiveExecuting && attackerName && (hasStatusEffect(targetName, 'Contraataque') || hasStatusEffect(targetName, 'Reflejar'))) {
                    for (const _mn in gameState.characters) {
                        const _mel = gameState.characters[_mn];
                        if (!_mel || _mel.isDead || _mel.team !== gameState.characters[targetName].team) continue;
                        if (!_mel.passive || _mel.passive.name !== 'Pecado de la Ira') continue;
                        _mel.charges = Math.min(20, (_mel.charges||0) + 2);
                        addLog('⚔️ Pecado de la Ira: Meliodas gana 2 cargas (contraataque)', 'buff');
                        break;
                    }
                }
                // BUFF REFLEJAR: interceptado antes del daño (ver arriba en applyDamageWithShield)
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
                // BUFF INFECTAR: cuando el portador recibe un golpe, aplica 2 stacks de Veneno al atacante
                if (!passiveExecuting && hasStatusEffect(targetName, 'Infectar') && attackerName) {
                    passiveExecuting = true;
                    if (typeof applyPoison === 'function') applyPoison(attackerName, 2);
                    addLog('🦠 Infectar: ' + attackerName + ' recibe Veneno 2S por atacar a ' + targetName, 'debuff');
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
            // La animación 🛡️ ahora la dispara la detección genérica de cambios de escudo
            // en renderCharacters() (init-render.js) — así cubre TAMBIÉN los casos donde el
            // escudo se asigna directo (.shield = ...) sin pasar por esta función, como
            // Resplandor de Gandalf o la pasiva Estratega de Odin de Ragnar (multi-target).
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

        // ── MIN BYUNG: Shadow Healing — inicio de ronda aplica Regeneración 20% 1T a todos los aliados ──
        function triggerMinByungStartOfRound() {
            Object.keys(gameState.summons).forEach(function(sid) {
                const _mb = gameState.summons[sid];
                if (!_mb || _mb.name !== 'MinByung' || _mb.hp <= 0) return;
                const _mbTeam = _mb.team;
                for (const _n in gameState.characters) {
                    const _c = gameState.characters[_n];
                    if (!_c || _c.team !== _mbTeam || _c.isDead || _c.hp <= 0) continue;
                    // Buff Regeneración 20% HP máximo 1 turno
                    if (typeof applyBuff === 'function') {
                        applyBuff(_n, { name: 'Regeneracion', type: 'buff', duration: 1, percent: 20, emoji: '💚' });
                    }
                    // Cura 2 HP (applyheal)
                    if (typeof applyHeal === 'function') applyHeal(_n, 2);
                }
                addLog('💚 MinByung (Shadow Healing): Regeneración 20% 1T + cura 2 HP a todos los aliados', 'buff');
            });
        }

        // ── MIN BYUNG: Al ser eliminada, genera 3 cargas a todos los aliados ──
        function triggerMinByungOnDeath(minByungTeam) {
            for (const _n in gameState.characters) {
                const _c = gameState.characters[_n];
                if (!_c || _c.team !== minByungTeam || _c.isDead || _c.hp <= 0) continue;
                generateChargesInline(_n, 3);
            }
            addLog('💚 MinByung (Shadow Healing): equipo aliado gana 3 cargas (MinByung fue eliminada)', 'buff');
        }

        function triggerKamishEndOfRound() {
            // Kamish: al final de cada ronda, 50 daño repartido ALEATORIAMENTE entre todos los enemigos
            Object.keys(gameState.summons).forEach(function(sid) {
                const kamish = gameState.summons[sid];
                if (!kamish || kamish.name !== 'Kamish' || kamish.hp <= 0) return;
                const enemyTeam = kamish.team === 'team1' ? 'team2' : 'team1';
                addLog('👁️ Kamish (Terror de las Sombras): 50 daño repartido aleatoriamente entre todos los enemigos', 'damage');
                let dmgLeft = 50;
                for (let _ki = 0; _ki < 50 && dmgLeft > 0; _ki++) {
                    // Build pool of living enemies (chars + summons)
                    const pool = [];
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (_c && _c.team === enemyTeam && !_c.isDead && _c.hp > 0) pool.push({ type:'char', id:_n });
                    }
                    for (const _sid2 in gameState.summons) {
                        const _s = gameState.summons[_sid2];
                        if (_s && _s.team === enemyTeam && _s.hp > 0) pool.push({ type:'summon', id:_sid2 });
                    }
                    if (pool.length === 0) break;
                    const pick = pool[Math.floor(Math.random() * pool.length)];
                    if (pick.type === 'char') {
                        applyDamageWithShield(pick.id, 1, 'Kamish');
                    } else {
                        applySummonDamage(pick.id, 1, 'Kamish');
                    }
                    dmgLeft--;
                }
            });
        }

        function registerKill(killerName, victimName, byInvocation) {
            // ── DIREBOUNDS: cada vez que CUALQUIER personaje (aliado o enemigo) es eliminado,
            // el portador gana 1 turno adicional y genera 15 cargas — se revisa ANTES del return
            // temprano de abajo para que nunca se salte por falta de killerName. ──
            if (victimName) {
                for (const _dbN in gameState.characters) {
                    const _dbC = gameState.characters[_dbN];
                    if (!_dbC || _dbC.isDead || _dbC.hp <= 0) continue;
                    if (!(_dbC.equippedRelics||[]).includes('Direbounds')) continue;
                    _dbC.charges = Math.min(20, (_dbC.charges||0) + 15);
                    gameState._skeggoxExtraTurn = _dbN;
                    addLog('🥊 Direbounds: ' + _dbN + ' gana turno adicional y 15 cargas (' + victimName + ' eliminado)', 'buff');
                }
            }
            if (!killerName || !gameState.battleStats) return;
            _mvp('killMap', killerName);
            if (byInvocation) {
                _mvp('summonKills', killerName);
            }

            // ── EXPLOSIÓN DE SOMBRAS (Extracción de Sombras pasiva): al morir causa daño = cargas al morir ──
            if (victimName) {
                const _esVictim = gameState.characters[victimName];
                if (_esVictim && _esVictim.passive && _esVictim.passive._explosionDeSombras) {
                    const _esCharges = _esVictim.charges || 0;
                    if (_esCharges > 0) {
                        const _esETeam = _esVictim.team === 'team1' ? 'team2' : 'team1';
                        const _esEnemies = Object.keys(gameState.characters).filter(function(n){ const c=gameState.characters[n]; return c && c.team===_esETeam && !c.isDead && c.hp>0; });
                        if (_esEnemies.length > 0) {
                            const _esTgt = _esEnemies[Math.floor(Math.random() * _esEnemies.length)];
                            gameState._currentDamageSource = 'ExplosionDeSombras';
                            applyDamageWithShield(_esTgt, _esCharges, victimName);
                            addLog('💀 Explosión de Sombras: ' + victimName + ' causa ' + _esCharges + ' daño a ' + _esTgt + ' al morir', 'damage');
                            gameState._currentDamageSource = null;
                        }
                    }
                }
            }

            // ── REY DE LA MUERTE (Lich King): si el Lich King mata a alguien → revive como aliado ──
            if (killerName && victimName) {
                const _lkKiller = gameState.characters[killerName];
                const _lkVictim = gameState.characters[victimName];
                if (_lkKiller && _lkVictim && _lkKiller.passive && _lkKiller.passive.name === 'Rey de la Muerte') {
                    setTimeout(function() {
                        const _v = gameState.characters[victimName];
                        if (!_v) return;
                        _v.isDead = false;
                        _v.hp = Math.ceil((_v.maxHp||20) * 0.50);
                        _v.charges = 10;
                        _v.statusEffects = [];
                        _v.team = _lkKiller.team; // cambia de equipo
                        addLog('💀 Rey de la Muerte: ' + victimName + ' revive como aliado del Lich King con ' + _v.hp + ' HP y 10 cargas!', 'buff');
                        if (typeof renderCharacters === 'function') renderCharacters();
                        if (typeof renderSummons === 'function') renderSummons();
                        if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(victimName);
                    }, 500);
                }
            }

            // ── SABIDURÍA ANTIGUA (Yoda): si todos sus aliados murieron, Yoda muere al instante ──
            if (victimName && victimName !== 'Sabiduría Antigua') {
                const _victim = gameState.characters[victimName];
                if (_victim) {
                    const _victimTeam = _victim.team;
                    // Find Yoda in the same team
                    for (const _yn in gameState.characters) {
                        const _yc = gameState.characters[_yn];
                        if (!_yc || _yc.isDead || !_yc.passive || _yc.passive.name !== 'Sabiduría Antigua') continue;
                        if (_yc.team !== _victimTeam) continue;
                        // Check if any other ally is still alive
                        const _anyAllyAlive = Object.keys(gameState.characters).some(function(n) {
                            const _c = gameState.characters[n];
                            return _c && _c.team === _victimTeam && !_c.isDead && _c.hp > 0 && n !== _yn;
                        });
                        if (!_anyAllyAlive) {
                            _yc.isDead = true; _yc.hp = 0;
                            addLog('☯️ Sabiduría Antigua: ' + _yn + ' muere al instante — sus aliados han caído', 'damage');
                            // Trigger checkGameOver after a brief delay
                            setTimeout(function() {
                                if (typeof checkGameOver === 'function') checkGameOver();
                                if (typeof renderCharacters === 'function') renderCharacters();
                            }, 100);
                        }
                    }
                }
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
            const _fhOld = c.hp;
            { const _rgOld=c.hp; c.hp = Math.min(c.maxHp, c.hp + finalHeal); if(typeof notifyHeal==='function') notifyHeal(charName, c.hp-_rgOld, 'Regeneración'); }
            if (c.hp > _fhOld && typeof showHpTick === 'function') showHpTick(charName, c.hp - _fhOld); if (typeof triggerBendicionSagrada === 'function' && !passiveExecuting) { var _bsC = gameState.characters[charName]; if (_bsC) triggerBendicionSagrada(_bsC.team, 0); }
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
            if (typeof window.onCharacterRevived === 'function') window.onCharacterRevived(targetName);

            // ── MORDEDURA (Cría de Dragón): al morir, Rhaenyra genera 3 cargas ──
            // Note: this fires whenever any summon dies — check inside
            // (Cría de Dragón death is checked in processEndOfRoundEffects and applySummonDamage)

            // ── EL CARCELERO DE LOS MALDITOS (Bolvar PERSONAJE): +5 cargas al revivir cualquier personaje ──
            if (typeof triggerBolvarCarcelero === 'function') triggerBolvarCarcelero('revive de ' + targetName);
            else {
                for (const _bpRN in gameState.characters) {
                    const _bpRC = gameState.characters[_bpRN];
                    if (!_bpRC || _bpRC.isDead || _bpRC.hp <= 0 || !_bpRC.passive) continue;
                    if (_bpRC.passive.name !== 'El Carcelero de los Malditos') continue;
                    _bpRC.charges = Math.min(20, (_bpRC.charges||0) + 5);
                    addLog('⚔️ El Carcelero de los Malditos: ' + _bpRN + ' genera 5 cargas (personaje revivido)', 'buff');
                    break;
                }
            }
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
                'Igris': 0.25, 'MinByung': 0.20, 'Iron': 0.20, 'Tusk': 0.15,
                'Beru': 0.13, 'Kaisel': 0.05, 'Bellion': 0.015, 'Kamish': 0.005
            };
            // ── Nombres ya presentes EN VIVO para este equipo — antes esta lista no filtraba
            // por isDead/hp>0, así que una sombra muerta seguía "ocupando" su nombre para
            // siempre, y (más grave) la creación final del objeto no pasaba por summonShadow(),
            // que es la única función con el chequeo de unicidad+límite realmente confiable
            // (filtrado correcto por vivo). Esa duplicación de lógica es lo que dejaba pasar
            // sombras repetidas (2 Igris, 3 Tusk) y superar las 5 invocaciones por equipo. ──
            const existingNames = new Set(
                Object.values(gameState.summons)
                    .filter(s => s && s.team === sjwChar.team && !s.isDead && (s.hp === undefined || s.hp > 0))
                    .map(s => s.name)
            );
            const _teamAliveTotal = existingNames.size;
            if (_teamAliveTotal >= 5) {
                addLog('👻 Arise! (Pasiva): equipo al límite de 5 invocaciones — no se puede invocar esta ronda', 'info');
                return;
            }
            // Pick random shadow by weight
            let rand = Math.random();
            let cumulative = 0;
            let chosen = 'Igris';
            for (const [name, weight] of Object.entries(shadowPool)) {
                cumulative += weight;
                if (rand < cumulative) { chosen = name; break; }
            }
            if (!summonData[chosen]) {
                console.warn('[Arise!] summonData sin entrada para "' + chosen + '" — reintentando con otra sombra');
                const _fallbackPool = Object.keys(shadowPool).filter(function(n){ return summonData[n]; });
                if (_fallbackPool.length === 0) { addLog('👻 Arise! (Pasiva): error interno — sin datos de sombras disponibles', 'info'); return; }
                chosen = _fallbackPool[Math.floor(Math.random() * _fallbackPool.length)];
            }
            // Si la sombra elegida ya está viva en el campo, buscar otra disponible
            if (existingNames.has(chosen)) {
                const allPool = ['Igris', 'MinByung', 'Iron', 'Tusk', 'Beru', 'Bellion', 'Kaisel', 'Kamish'];
                const available = allPool.filter(n => !existingNames.has(n) && summonData[n]);
                if (available.length === 0) {
                    addLog('👻 Arise! (Pasiva): ' + charName + ' ya tiene todas las sombras invocadas', 'info');
                    return;
                }
                const availableWeights = available.map(n => ({ name: n, w: shadowPool[n] || 0.01 }));
                const totalW = availableWeights.reduce((s, x) => s + x.w, 0);
                let r2 = Math.random() * totalW;
                chosen = availableWeights[availableWeights.length - 1].name;
                for (const x of availableWeights) { r2 -= x.w; if (r2 <= 0) { chosen = x.name; break; } }
            }
            // La creación real pasa por summonShadow() — única fuente de verdad para unicidad y
            // límite de 5 por equipo, ya con el filtrado correcto por invocaciones vivas.
            summonShadow(chosen, charName);
        }

        function triggerLichKingInvocation(charName) {
            // EL PRÍNCIPE CAÍDO (Lich King): al inicio de su turno, invoca aleatoriamente según
            // los pesos de probabilidad definidos. Si la elegida ya está viva en el campo, se
            // vuelve a tirar (sin repetición) hasta encontrar una disponible o agotar el pool.
            const lkChar = gameState.characters[charName];
            if (!lkChar || lkChar.isDead || lkChar.hp <= 0) return;
            const lkPool = ['Sindragosa', 'Banshee', 'Valkyr', 'Necrofago', 'Caballero de la Muerte'];
            const lkWeights = { 'Sindragosa': 4, 'Banshee': 24, 'Valkyr': 24, 'Necrofago': 24, 'Caballero de la Muerte': 24 };
            const lkExisting = new Set(
                Object.values(gameState.summons)
                    .filter(function (s) { return s && s.team === lkChar.team && !s.isDead && (s.hp === undefined || s.hp > 0); })
                    .map(function (s) { return s.name; })
            );
            const lkAvailable = lkPool.filter(function (n) { return !lkExisting.has(n); });
            if (lkAvailable.length === 0) {
                addLog('👑 El Príncipe Caído: ' + charName + ' ya tiene todas sus invocaciones activas', 'info');
                return;
            }
            const lkAvailWeights = lkAvailable.map(function (n) { return { name: n, w: lkWeights[n] || 1 }; });
            const lkTotalW = lkAvailWeights.reduce(function (s, x) { return s + x.w; }, 0);
            let lkRand = Math.random() * lkTotalW;
            let lkChosen = lkAvailWeights[lkAvailWeights.length - 1].name;
            for (const x of lkAvailWeights) { lkRand -= x.w; if (lkRand <= 0) { lkChosen = x.name; break; } }
            summonShadow(lkChosen, charName);
            // Invocaciones con Mega Provocación permanente (mismo comportamiento que antes)
            if (lkChosen === 'Sindragosa' || lkChosen === 'Caballero de la Muerte') {
                const lkNewSummon = Object.values(gameState.summons).find(function (s) { return s && s.name === lkChosen && s.summoner === charName; });
                if (lkNewSummon) lkNewSummon.megaProvocation = true;
            }
            addLog('👑 El Príncipe Caído: ' + charName + ' invoca a ' + lkChosen + ' (inicio de turno)', 'buff');
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
