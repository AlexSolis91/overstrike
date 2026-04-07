// ==================== LÓGICA DE TURNOS ====================
        function startTurn() {
            // VENGANZA ETERNA (Sasuke): procesar turno adicional pendiente
            if (gameState._sasukeRevengeQueue && gameState._sasukeRevengeQueue.length > 0) {
                const _saTurnChar = gameState._sasukeRevengeQueue.shift();
                const _saC = gameState.characters[_saTurnChar];
                if (_saC && !_saC.isDead && _saC.hp > 0) {
                    gameState.selectedCharacter = _saTurnChar;
                    addLog('⚡ Venganza Eterna: ¡' + _saTurnChar + ' gana turno adicional!', 'buff');
                    if (typeof renderCharacters === 'function') renderCharacters();
                    if (typeof showActionModal === 'function') showActionModal();
                    return;
                }
            }
            if (gameState.gameOver) return;

            // ONLINE MODE: Only run startTurn if it will be my team's turn
            // The other player will handle their own turn after receiving Firebase push
            
            try {
                // Encontrar el siguiente personaje vivo
                let attempts = 0;
                while (attempts < gameState.turnOrder.length) {
                    const currentCharName = gameState.turnOrder[gameState.currentTurnIndex];
                    const currentChar = gameState.characters[currentCharName];
                    
                    if (!currentChar) {
                        // Personaje no existe, pasar al siguiente
                        gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
                        attempts++;
                        continue;
                    }
                    
                    if (currentChar.hp > 0 && !currentChar.isDead) {
                        // Personaje vivo encontrado
                        gameState.selectedCharacter = currentCharName;
                        
                        // Procesar efectos de estado al inicio del turno
                        // 1. Regeneración y quemaduras (ticks de daño/cura) -- SE APLICAN ANTES DE ACTUAR
                        processRegenerationEffects(currentCharName);
                        // NOTA: updateStatusEffectDurations se llama dentro de continueTurn
                        // para que el decremento ocurra DESPUÉS de verificar stun/freeze/etc.
                        // SUN JIN WOO PASIVA: Sigilo al inicio de su turno, dura hasta fin de ronda (no es permanente)
                        if ((currentCharName === 'Sun Jin Woo' || currentCharName.startsWith('Sun Jin Woo')) || currentCharName === 'Sun Jin Woo v2') {
                            const sjw = gameState.characters['Sun Jin Woo'];
                            if (sjw && !sjw.isDead && sjw.hp > 0) {
                                // ARISE! passive: at start of turn, perform random invocation from shadow pool
                                triggerSJWArisePassive(currentCharName); // supports v2 names
                            }
                        }

                        // ONLINE MODE: Solo procesar efectos del turno si el personaje es de MI equipo
                        // (evita procesamiento doble — cada cliente procesa solo sus propios personajes)
                        const _isMyCharOnline = !onlineMode || (isRoomHost ? currentChar.team === 'team1' : currentChar.team === 'team2');
                        if (_isMyCharOnline) {
                            // Resetear flags de pasivas de un disparo por turno
                            gameState._izanamiUsedThisTurn = false;
                            // FLASH — decrementar cooldown Singularidad Escarlata
                            const _flashCd = gameState.characters[currentCharName];
                            if (_flashCd && _flashCd._singularidadCooldown > 0) {
                                _flashCd._singularidadCooldown--;
                                if (_flashCd._singularidadCooldown === 0) addLog('⚡ Singularidad Escarlata: cooldown listo', 'buff');
                            }
                            // VENENO: aplica al INICIO del turno del personaje con el debuff
                            processNewDebuffEffects(currentCharName);
                        }
                        
                        // VEGETA — Check transformación por HP
                        if (currentChar.passive && currentChar.passive.name === 'Principe de los Sayajins' && !currentChar.isDead && currentChar.hp > 0) {
                            const _vHpPct = (currentChar.hp / currentChar.maxHp) * 100;
                            if (_vHpPct >= 40 && _vHpPct <= 70 && currentChar.vegetaForm !== 'ssblue_evo') {
                                currentChar.vegetaForm = 'ssblue_evo';
                                if (currentChar.portraitSSBlueEvo) currentChar.portrait = currentChar.portraitSSBlueEvo;
                                addLog('💠 Vegeta → Super Sayajin Blue Evolution (HP 40-70%)', 'buff');
                                renderCharacters();
                            } else if (_vHpPct >= 1 && _vHpPct < 40 && currentChar.vegetaForm !== 'ultra_ego') {
                                currentChar.vegetaForm = 'ultra_ego';
                                if (currentChar.portraitUltraEgo) currentChar.portrait = currentChar.portraitUltraEgo;
                                addLog('👁️ Vegeta → Ultra Ego (HP < 40%)', 'buff');
                                renderCharacters();
                            } else if (_vHpPct > 70 && currentChar.vegetaForm !== null) {
                                currentChar.vegetaForm = null;
                                currentChar.portrait = 'https://i.postimg.cc/C55Ssj7Q/Whats_App_Image_2026_03_17_at_2_07_04_AM.jpg';
                                renderCharacters();
                            }
                        }
                        // DRAGON DE LA DESTRUCCION (Antares): regen 5HP/turno mientras transformado
                        if (currentChar.antaresTransformed && currentChar.antaresTransformTurns > 0) {
                            if (typeof canHeal !== 'function' || canHeal(currentCharName)) {
                                const _antOldHp = currentChar.hp;
                                currentChar.hp = Math.min(currentChar.maxHp, currentChar.hp + 5);
                                if (currentChar.hp > _antOldHp) addLog('🐉 Dragon de la Destruccion: ' + currentCharName + ' recupera 5 HP', 'heal');
                            }
                            currentChar.antaresTransformTurns--;
                            if (currentChar.antaresTransformTurns <= 0) {
                                currentChar.antaresTransformed = false;
                                if (currentChar.basePortrait) currentChar.portrait = currentChar.basePortrait;
                                addLog('🐉 Dragon de la Destruccion: ' + currentCharName + ' vuelve a su forma base', 'info');
                                renderCharacters();
                            }
                        }
                        // PASIVA LIMBO: Madara en Modo Rikudō regenera 1 HP por turno
                        if (((currentCharName === 'Madara Uchiha' || currentCharName.startsWith('Madara Uchiha')) || currentCharName === 'Madara Uchiha v2') && currentChar.rikudoMode && currentChar.hp > 0) {
                            const oldHp = currentChar.hp;
                            currentChar.hp = Math.min(currentChar.maxHp, currentChar.hp + 1);
                            if (currentChar.hp > oldHp) {
                                addLog(`🌀 Limbo: Madara recupera 1 HP (${currentChar.hp}/${currentChar.maxHp})`, 'heal');
                                triggerBendicionSagrada(currentChar.team, 1);
                            }
                        }
                        
                        // NOTA: updateStatusEffectDurations se llama al FINAL del turno en endTurnEffects()
                        
                        // Verificar si murió por quemadura
                        if (currentChar.hp <= 0) {
                            currentChar.isDead = true;
                            addLog(`💀 ${currentCharName} ha sido derrotado por las quemaduras`, 'damage');
                            renderCharacters();
                            
                            if (checkGameOver()) {
                                return;
                            }
                            
                            // Pasar al siguiente turno
                            gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
                            attempts++;
                            continue;
                        }
                        
                        updateCurrentTurnDisplay();
                        highlightActiveCharacter();
                        renderCharacters();
                        renderTurnOrder();
                        addLog(`🎯 Turno de ${currentCharName}`, 'info');
                        
                        // Mostrar botón flotante para continuar — NO modal que bloquea la pantalla
                        showContinueButton();
                        // Online: si saltamos personajes muertos (attempts > 0), volver a pushear
                        // el estado correcto. El push de endTurn apuntaba a un personaje muerto;
                        // ahora que encontramos al personaje vivo real, notificamos al otro jugador.
                        if (onlineMode && attempts > 0) {
                            pushGameState();
                        }
                        return;
                    }
                    
                    // Personaje muerto, pasar al siguiente
                    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
                    attempts++;
                }
                
                // Si llegamos aquí, todos están muertos (no debería pasar)
                checkGameOver();
            } catch (error) {
                console.error('Error en startTurn:', error);
                // Intentar continuar
                try {
                    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
                    setTimeout(() => startTurn(), 1000);
                } catch (e) {
                    console.error('Error crítico en startTurn:', e);
                }
            }
        }

        function showTurnConfirmModal() {
            // Ya no se usa para inicio de turno — solo queda como helper interno
            const modal = document.getElementById('turnConfirmModal');
            document.getElementById('turnConfirmRound').textContent = `⏱️ RONDA ${gameState.currentRound}`;
            document.getElementById('turnConfirmChar').textContent = `🎯 ${gameState.selectedCharacter}`;
            modal.classList.add('show');
        }

        function showContinueButton() {
            let btn = document.getElementById('floatingContinueBtn');
            if (!btn) {
                btn = document.createElement('button');
                btn.id = 'floatingContinueBtn';
                btn.innerHTML = '▶ Continuar Turno';
                btn.style.cssText = [
                    'position:fixed',
                    'bottom:28px',
                    'right:28px',
                    'background:linear-gradient(135deg,var(--primary-glow),var(--secondary-glow))',
                    'border:none',
                    'color:#0a0e17',
                    "font-family:'Orbitron',sans-serif",
                    'font-size:1.1em',
                    'font-weight:700',
                    'padding:16px 32px',
                    'border-radius:50px',
                    'cursor:pointer',
                    'z-index:996',
                    'box-shadow:0 0 28px rgba(0,217,255,0.55)',
                    'transition:all 0.2s ease',
                    'letter-spacing:0.05em'
                ].join(';');
                btn.onmouseover = function() {
                    this.style.transform = 'scale(1.07)';
                    this.style.boxShadow = '0 0 44px rgba(0,217,255,0.85)';
                };
                btn.onmouseout = function() {
                    this.style.transform = 'scale(1)';
                    this.style.boxShadow = '0 0 28px rgba(0,217,255,0.55)';
                };
                btn.onclick = function() {
                    hideContinueButton();
                    continueTurn();
                };
                document.body.appendChild(btn);
            }
            // Actualizar texto con personaje y ronda
            const charName = gameState.selectedCharacter || '';
            btn.innerHTML = '▶ Continuar Turno<br><span style="font-size:0.65em;opacity:0.75;font-weight:400;">RONDA ' + gameState.currentRound + ' · ' + charName + '</span>';

            // En modo online: mostrar botón solo si es el turno de MI equipo
            if (onlineMode) {
                const myTeam = isRoomHost ? 'team1' : 'team2';
                const currentChar = gameState.characters[charName];
                const charTeam = currentChar ? currentChar.team : null;
                if (charTeam !== myTeam) {
                    btn.style.display = 'none';
                    updateWaitingIndicator(charName, true);
                    return;
                } else {
                    updateWaitingIndicator(charName, false);
                }
            }
            btn.style.display = 'block';
        }

        function updateWaitingIndicator(charName, visible) {
            let w = document.getElementById('waitingOpponentTurn');
            if (!w) {
                w = document.createElement('div');
                w.id = 'waitingOpponentTurn';
                w.style.cssText = 'position:fixed;bottom:28px;right:28px;background:rgba(10,14,23,0.92);border:2px solid rgba(255,68,102,0.5);color:#ff4466;font-family:Orbitron,sans-serif;font-size:.85em;font-weight:700;padding:14px 26px;border-radius:50px;z-index:996;letter-spacing:.05em;box-shadow:0 0 20px rgba(255,68,102,0.3);pointer-events:none;';
                if (!document.getElementById('waitPulseStyle')) {
                    const st = document.createElement('style');
                    st.id = 'waitPulseStyle';
                    st.textContent = '@keyframes waitPulse{0%,100%{opacity:1;box-shadow:0 0 20px rgba(255,68,102,0.3);}50%{opacity:0.6;box-shadow:0 0 35px rgba(255,68,102,0.7);}}';
                    document.head.appendChild(st);
                }
                document.body.appendChild(w);
            }
            if (visible) {
                w.style.animation = 'waitPulse 1.5s ease-in-out infinite';
                w.textContent = '⏳ Turno de ' + (charName || 'Oponente');
                w.style.display = 'block';
            } else {
                w.style.display = 'none';
            }
        }

        function showWaitingForOpponent() { updateWaitingIndicator(gameState.selectedCharacter, true); }

        function hideWaitingForOpponent() { updateWaitingIndicator('', false); }

        function hideContinueButton() {
            const btn = document.getElementById('floatingContinueBtn');
            if (btn) btn.style.display = 'none';
            hideWaitingForOpponent();
        }

        // ══════════════════════════════════════════════════
        // ONLINE GAME STATE SYNC
        // ══════════════════════════════════════════════════
        let gameStateListener = null;
        let isSyncingState = false;

        let lastPushTs = 0;

        function pushGameState() {
            if (!onlineMode || !currentRoomId) return;
            try {
                lastPushTs = Date.now();
                // Determine which team goes next (after turn advance)
                const nextCharName = gameState.turnOrder ? gameState.turnOrder[(gameState.currentTurnIndex + 1) % gameState.turnOrder.length] : null;
                const nextChar = nextCharName ? gameState.characters[nextCharName] : null;
                const nextTeam = nextChar ? nextChar.team : null;

                // activeTeam = which team's turn it will be AFTER this push
                // We push BEFORE calling startTurn locally, so currentTurnIndex is already advanced
                const curCharName = gameState.turnOrder ? gameState.turnOrder[gameState.currentTurnIndex] : null;
                const curChar = curCharName ? gameState.characters[curCharName] : null;
                const activeTeam = curChar ? curChar.team : null;

                // Deep clean characters before push (remove any non-serializable data)
                function cleanForFirebase(obj) {
                    if (obj === null || obj === undefined) return null;
                    if (typeof obj === 'function') return undefined;
                    if (Array.isArray(obj)) return obj.map(cleanForFirebase).filter(x => x !== undefined);
                    if (typeof obj === 'object') {
                        const clean = {};
                        for (let k in obj) {
                            if (typeof obj[k] !== 'function') {
                                const v = cleanForFirebase(obj[k]);
                                if (v !== undefined) clean[k] = v;
                            }
                        }
                        return clean;
                    }
                    return obj;
                }

                const snapshot = {
                    characters: cleanForFirebase(gameState.characters),
                    summons: cleanForFirebase(gameState.summons || {}),
                    currentTurnIndex: gameState.currentTurnIndex,
                    currentRound: gameState.currentRound,
                    turnsInRound: gameState.turnsInRound,
                    aliveCountAtRoundStart: gameState.aliveCountAtRoundStart,
                    turnOrder: gameState.turnOrder,
                    selectedCharacter: curCharName,
                    activeTeam: activeTeam,
                    gameOver: gameState.gameOver,
                    winner: gameState.winner || null,
                    battleLog: gameState.battleLog ? cleanForFirebase(gameState.battleLog.slice(-30)) : [],
                    _attackedThisTurn: false,
                    pushedBy: currentUser ? currentUser.uid : 'unknown',
                    ts: lastPushTs
                };
                console.log('[SYNC] pushing state: activeTeam=' + activeTeam + ' char=' + curCharName);
                db.ref('rooms/' + currentRoomId + '/gameState').set(snapshot);
            } catch(e) {
                console.error('[SYNC] pushGameState error:', e);
            }
        }

        function listenGameState() {
            if (!onlineMode || !currentRoomId) return;
            gameStateListener = db.ref('rooms/' + currentRoomId + '/gameState').on('value', function(snap) {
                const data = snap.val();
                if (!data) return;
                if (isSyncingState) return;
                // Skip if I pushed this state
                if (data.pushedBy && currentUser && data.pushedBy === currentUser.uid) return;
                isSyncingState = true;
                try {
                    // Apply remote state - deep-restore arrays
                    gameState.characters = data.characters;
                    // Ensure statusEffects are proper arrays (Firebase may convert sparse arrays to objects)
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c) continue;
                        if (c.statusEffects && !Array.isArray(c.statusEffects)) {
                            c.statusEffects = Object.values(c.statusEffects).filter(Boolean);
                        }
                        if (!c.statusEffects) c.statusEffects = [];
                    }
                    gameState.currentTurnIndex = data.currentTurnIndex;
                    gameState.currentRound = data.currentRound;
                    gameState.turnsInRound = data.turnsInRound;
                    gameState.aliveCountAtRoundStart = data.aliveCountAtRoundStart;
                    gameState.turnOrder = data.turnOrder;
                    gameState.selectedCharacter = data.selectedCharacter;
                    gameState.gameOver = data.gameOver;
                    gameState._attackedThisTurn = data._attackedThisTurn || false;
                    // Restore summons from sync
                    if (data.summons) {
                        gameState.summons = data.summons;
                    }

                    // Apply battle log
                    if (data.battleLog && Array.isArray(data.battleLog)) {
                        const logEl = document.getElementById('battleLogContent');
                        if (logEl) {
                            logEl.innerHTML = '';
                            data.battleLog.forEach(function(entry) {
                                const div = document.createElement('div');
                                div.className = 'log-entry ' + (entry.type || '');
                                div.textContent = entry.text || entry;
                                logEl.appendChild(div);
                            });
                            logEl.scrollTop = logEl.scrollHeight;
                        }
                    }

                    renderCharacters();
                    renderSummons();
                    renderTurnOrder();

                    if (data.gameOver) {
                        showGameOver(data.winner);
                        return;
                    }

                    const myTeam = isRoomHost ? 'team1' : 'team2';
                    const activeTeam = data.activeTeam;
                    const charName = data.selectedCharacter || '';

                    console.log('[SYNC] Received. activeTeam=' + activeTeam + ' myTeam=' + myTeam + ' char=' + charName);

                    // Update turn display
                    const turnDisp = document.getElementById('currentTurnDisplay');
                    if (turnDisp) {
                        const teamLabel = (typeof getTeamLabel === 'function') ? getTeamLabel(activeTeam) : (activeTeam === 'team1' ? 'HUNTERS' : 'REAPERS');
                        turnDisp.textContent = 'TURNO: ' + charName + ' (' + teamLabel + ')';
                        turnDisp.style.color = activeTeam === 'team1' ? 'var(--team1)' : 'var(--team2)';
                    }

                    const activeChar2 = gameState.characters[charName];
                    const charIsDead = activeChar2 && (activeChar2.isDead || activeChar2.hp <= 0);

                    if (charIsDead) {
                        // El personaje notificado ya está muerto — el otro jugador va a hacer
                        // un segundo push con el personaje vivo real. Solo esperar.
                        hideContinueButton();
                        updateWaitingIndicator('...', true);
                    } else if (activeTeam === myTeam) {
                        updateWaitingIndicator('', false);
                        const btn = createContinueBtn();
                        btn.innerHTML = '▶ Continuar Turno<br><span style="font-size:0.65em;opacity:0.75;font-weight:400;">RONDA ' + gameState.currentRound + ' · ' + charName + '</span>';
                        btn.style.display = 'block';
                    } else {
                        hideContinueButton();
                        updateWaitingIndicator(charName, true);
                    }
                } catch(e) {
                    console.error('[SYNC] listenGameState error:', e);
                } finally {
                    isSyncingState = false;
                }
            });
        }

        function createContinueBtn() {
            let btn = document.getElementById('floatingContinueBtn');
            if (btn) return btn;
            btn = document.createElement('button');
            btn.id = 'floatingContinueBtn';
            btn.style.cssText = ['position:fixed','bottom:28px','right:28px',
                'background:linear-gradient(135deg,var(--primary-glow),var(--secondary-glow))',
                'border:none','color:#0a0e17',"font-family:'Orbitron',sans-serif",
                'font-size:1.1em','font-weight:700','padding:16px 32px','border-radius:50px',
                'cursor:pointer','z-index:996','box-shadow:0 0 28px rgba(0,217,255,0.55)',
                'transition:all 0.2s ease','letter-spacing:0.05em'].join(';');
            btn.onmouseover = function() { this.style.transform='scale(1.07)'; };
            btn.onmouseout = function() { this.style.transform='scale(1)'; };
            btn.onclick = function() { hideContinueButton(); continueTurn(); };
            document.body.appendChild(btn);
            return btn;
        }

        function continueTurn() {
            // ── ENFORCE PERMANENT PASSIVES AT TURN START ──
            for (const _epn in gameState.characters) {
                const _epc = gameState.characters[_epn];
                if (!_epc || _epc.isDead || !_epc.passive) continue;
                // Darth Vader: Aura Oscura permanente
                if (_epc.passive.name === 'Presencia Oscura' && !hasStatusEffect(_epn, 'Aura oscura')) {
                    _epc.statusEffects = (_epc.statusEffects || []);
                    _epc.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                }
                // Giyu Tomioka: Armadura permanente
                if (_epc.passive.name === 'Pilar del Agua' && !hasStatusEffect(_epn, 'Armadura')) {
                    _epc.statusEffects = (_epc.statusEffects || []);
                    _epc.statusEffects.push({ name: 'Armadura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                }
                // Superman: Provocación + Cuerpo Perfecto permanentes
                if (_epc.passive && _epc.passive.name === 'Hombre de Acero') {
                    if (!hasStatusEffect(_epn, 'Provocacion')) {
                        _epc.statusEffects = (_epc.statusEffects || []);
                        _epc.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚠️' });
                    }
                    if (!hasStatusEffect(_epn, 'Cuerpo Perfecto')) {
                        _epc.statusEffects = (_epc.statusEffects || []);
                        _epc.statusEffects.push({ name: 'Cuerpo Perfecto', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '💠' });
                    }
                }
            }
            // ── CAZADOR DE HÉROES PASSIVE B (Garou): Buff Armadura 2T al inicio de su turno ──
            if (gameState.selectedCharacter) {
                const _garouTurn = gameState.characters[gameState.selectedCharacter];
                if (_garouTurn && !_garouTurn.isDead && _garouTurn.hp > 0 &&
                    _garouTurn.passive && _garouTurn.passive.name === 'Cazador de Héroes') {
                    // Apply Armadura 2 turns (refresh each turn)
                    _garouTurn.statusEffects = (_garouTurn.statusEffects || []).filter(function(e) {
                        return e && normAccent(e.name||'') !== 'armadura';
                    });
                    _garouTurn.statusEffects.push({ name: 'Armadura', type: 'buff', duration: 2, emoji: '🛡️' });
                    addLog('🐆 Cazador de Héroes: ' + gameState.selectedCharacter + ' activa Armadura 2 turnos', 'buff');
                }
            }
            // ── VARIAN WRYNN: resetear bonus consecutivos si el turno activo NO es de Varian ──
            // (si Varian ya jugó pero no usó Filotormenta, el endTurn lo resetea; aquí cubrimos el caso
            //  en que otro personaje juega su turno y luego vuelve el turno a Varian)
            if (gameState.selectedCharacter) {
                const _curChar = gameState.characters[gameState.selectedCharacter];
                // Si el personaje activo es Varian, no resetear aquí (se resetea al usar habilidad no-básica)
                // El reset de "turno interrumpido" se maneja en endTurn vía _varianUsedBasicThisTurn
            }
            // Resetear bonus de Varian si NO usó básico en su último turno
            for (const _vrn in gameState.characters) {
                const _vrc = gameState.characters[_vrn];
                if (!_vrc || !_vrc.passive || _vrc.passive.name !== 'Lo\'gosh') continue;
                if (_vrn !== gameState.selectedCharacter && _vrc._varianLastAbilityWasBasic === false) {
                    _vrc.varianBasicDmgBonus = 0;
                    _vrc.varianBasicChargeBonus = 0;
                    _vrc.varianConsecutiveBasic = 0;
                    _vrc._varianLastAbilityWasBasic = null;
                }
            }
            // Online mode: only the player whose team is active can continue
            if (onlineMode) {
                const myTeam = isRoomHost ? 'team1' : 'team2';
                const currentChar = gameState.characters[gameState.selectedCharacter];
                if (!currentChar || currentChar.team !== myTeam) {
                    console.log('[OVERSTRIKE] continueTurn bloqueado — no es tu equipo');
                    return;
                }
            }

            hideContinueButton();
            // Ocultar el modal de turno si por alguna razón estuviera visible
            document.getElementById('turnConfirmModal').classList.remove('show');

            const charName = gameState.selectedCharacter;
            const char = gameState.characters[charName];

            // ── ATURDIMIENTO / MEGA ATURDIMIENTO ──────────────────────────
            const stunEffect = char.statusEffects && char.statusEffects.find(
                e => e && (normAccent(e.name) === 'aturdimiento' || normAccent(e.name) === 'mega aturdimiento')
            );
            if (stunEffect) {
                addLog(`${stunEffect.emoji || '⭐'} ${charName} está aturdido y pierde su turno`, 'damage');
                renderCharacters();
                endTurn();
                return;
            }

            // ── CONGELACIÓN: 50% de probabilidad de perder turno ─────────
            if (hasStatusEffect(charName, 'Congelacion')) {
                if (Math.random() < 0.5) {
                    addLog(`❄️ ${charName} está Congelado y pierde su turno (50% de prob.)`, 'damage');
                    renderCharacters();
                    endTurn();
                    return;
                } else {
                    addLog(`❄️ ${charName} resiste la Congelación este turno`, 'info');
                }
            }

            // ── MEGA CONGELACIÓN: pierde turno siempre ─────────────────────
            if (hasStatusEffect(charName, 'Mega Congelacion')) {
                addLog(`🧊 ${charName} está Mega Congelado y pierde su turno`, 'damage');
                renderCharacters();
                endTurn();
                return;
            }

            // ── MIEDO: 25% de prob de perder turno + no genera cargas + 50% menos daño ──────
            if (hasStatusEffect(charName, 'Miedo')) {
                if (Math.random() < 0.25) {
                    addLog(`😱 ${charName} está paralizado por el Miedo y pierde su turno`, 'damage');
                    renderCharacters();
                    endTurn();
                    return;
                } else {
                    addLog(`😱 ${charName} siente Miedo pero actúa (sin cargas, -50% daño este turno)`, 'info');
                    gameState._miedoActive = true;
                }
            }

            // ── SILENCIAR: bloquea una categoría aleatoria de movimientos ──────
            if (hasStatusEffect(charName, 'Silenciar')) {
                const silEffect = (char.statusEffects || []).find(e => e && normAccent(e.name||'') === 'silenciar');
                if (silEffect && !silEffect.silencedCategory) {
                    const cats = ['basic', 'special', 'over'];
                    silEffect.silencedCategory = cats[Math.floor(Math.random() * cats.length)];
                }
                const cat = silEffect ? silEffect.silencedCategory : 'special';
                addLog(`🔇 ${charName} tiene Silenciado — no puede usar habilidades de tipo ${cat}`, 'damage');
                gameState._silencedCategory = cat;
            } else {
                gameState._silencedCategory = null;
            }

            // ── CONFUSIÓN: ataca a un enemigo aleatorio automáticamente ──────
            if (hasStatusEffect(charName, 'Confusion')) {
                addLog(`😵 ${charName} está Confundido — atacará a un enemigo aleatorio automáticamente`, 'damage');
                executeConfusionAttack(charName);
                return;
            }

            // ── AGOTAMIENTO: reduce 1-3 cargas al portador ──────────────
            {
                const agotStacks = (char.statusEffects || []).filter(e => e && normAccent(e.name||'') === 'agotamiento');
                if (agotStacks.length > 0) {
                    let totalDrain = 0;
                    agotStacks.forEach(() => { totalDrain += Math.floor(Math.random() * 3) + 1; });
                    char.charges = Math.max(0, (char.charges || 0) - totalDrain);
                    addLog(`😩 Agotamiento x${agotStacks.length}: ${charName} pierde ${totalDrain} cargas`, 'damage');
                }
            }

            // ── POSESIÓN / MEGA POSESIÓN: ejecuta ataque aleatorio contra aliado ──────────
            if (hasStatusEffect(charName, 'Posesion') || hasStatusEffect(charName, 'Mega Posesion')) {
                addLog(`👁️ ${charName} está Poseído — atacará a un aliado automáticamente`, 'damage');
                executePossessionAttack(charName);
                return;
            }

            // ── IA: Si el personaje activo es del equipo de la IA, ejecutar automáticamente ──
            if ((gameState.gameMode === 'solo' || gameState.gameMode === 'ranked') && gameState.aiTeam) {
                const activeChar = gameState.characters[charName];
                if (activeChar && activeChar.team === gameState.aiTeam) {
                    // AI also fully passes through the same debuff checks above
                    // (stun, freeze, megafreeze, fear, confusion, possession already handled above)
                    setTimeout(function() { executeAITurn(charName); }, 700);
                    return;
                }
            }

            // Sin debuffs bloqueantes → mostrar modal de acción normal
            showActionModal();
        }

        function executePossessionAttack(charName) {
            // POSESIÓN / MEGA POSESIÓN: ataque genérico de 1-5 daño a un aliado aleatorio
            const char = gameState.characters[charName];
            if (!char) { endTurn(); return; }
            // Elegir aliado aleatorio vivo (excluye al propio personaje)
            const allies = Object.keys(gameState.characters).filter(function(n) {
                const c = gameState.characters[n];
                return c && c.team === char.team && n !== charName && !c.isDead && c.hp > 0;
            });
            if (allies.length === 0) {
                addLog('👁️ Posesión: ' + charName + ' no tiene aliados a quien atacar', 'info');
                endTurn();
                return;
            }
            const target = allies[Math.floor(Math.random() * allies.length)];
            const dmg = Math.floor(Math.random() * 5) + 1; // 1-5 daño
            // Ataque genérico — no usa ni consume cargas ni habilidades
            if (typeof applyDamageWithShield === 'function') {
                applyDamageWithShield(target, dmg, charName);
            } else {
                const tgtC = gameState.characters[target];
                if (tgtC) tgtC.hp = Math.max(0, tgtC.hp - dmg);
            }
            addLog('👁️ Posesión: ' + charName + ' realiza Ataque a Aliado — ' + dmg + ' daño a ' + target, 'damage');
            if (typeof renderCharacters === 'function') renderCharacters();
            if (typeof renderSummons === 'function') renderSummons();
            endTurn();
        }

        function executeConfusionAttack(charName) {
            const char = gameState.characters[charName];
            // Confusión: ataca con básico a un objetivo aleatorio
            // 20% probabilidad de atacar a un aliado, 80% a un enemigo
            const basicAbility = char.abilities ? char.abilities.find(a => a.type === 'basic') : null;
            if (!basicAbility) { endTurn(); return; }

            const allyTeam = char.team;
            const enemyTeam = allyTeam === 'team1' ? 'team2' : 'team1';

            let targetName = null;
            const hitAlly = Math.random() < 0.20;

            if (hitAlly) {
                // 20% chance: attack a random ally
                const allies = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === allyTeam && !c.isDead && c.hp > 0 && n !== charName;
                });
                if (allies.length > 0) {
                    targetName = allies[Math.floor(Math.random() * allies.length)];
                    addLog('😵 ¡Confusión! ' + charName + ' ataca a su aliado ' + targetName, 'damage');
                }
            }

            if (!targetName) {
                // 80% chance (or fallback): attack random enemy
                const enemies = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === enemyTeam && !c.isDead && c.hp > 0;
                });
                if (enemies.length > 0) {
                    targetName = enemies[Math.floor(Math.random() * enemies.length)];
                }
            }

            if (!targetName) { endTurn(); return; }

            const damage = basicAbility.damage || 0;
            if (damage > 0) {
                applyDamageWithShield(targetName, damage, charName);
                addLog('😵 ' + charName + ' (Confundido) usa ' + basicAbility.name + ' en ' + targetName + ' causando ' + damage + ' de daño', 'damage');
            }
            
            // Generar cargas del básico
            let chargeGain = basicAbility.chargeGain || 0;
            if (!hasStatusEffect(charName, 'Miedo') && chargeGain > 0) {
                char.charges = Math.min(20, (char.charges || 0) + chargeGain);
            }

            gameState._attackedThisTurn = true;
            renderCharacters();
            if (checkGameOver()) return;
            endTurn();
        }


        function closeBattleStatus() {
            document.getElementById('battleStatusModal').classList.remove('show');
        }

        function showBattleStatus() {
            // Cerrar modal de confirmación
            document.getElementById('turnConfirmModal').classList.remove('show');
            
            // Actualizar información del modal de estado
            const modal = document.getElementById('battleStatusModal');
            document.getElementById('battleStatusRound').textContent = `⏱️ RONDA ${gameState.currentRound}`;
            
            // Renderizar equipo 1
            const team1Container = document.getElementById('statusTeam1');
            team1Container.innerHTML = '';
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (char.team === 'team1') {
                    team1Container.innerHTML += renderStatusCharacterCard(name, char);
                }
            }
            
            // Renderizar equipo 2
            const team2Container = document.getElementById('statusTeam2');
            team2Container.innerHTML = '';
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (char.team === 'team2') {
                    team2Container.innerHTML += renderStatusCharacterCard(name, char);
                }
            }
            
            modal.classList.add('show');
        }

        function renderStatusCharacterCard(name, char) {
            const isDead = char.isDead || char.hp <= 0;
            
            // Generar badges de efectos de estado
            let statusBadges = '';
            if (char.statusEffects && char.statusEffects.length > 0) {
                buildDisplayEffects(char.statusEffects).forEach(function(d) {
                    const bg = d.type === 'buff' ? 'rgba(0,255,136,0.2)' : 'rgba(255,51,102,0.2)';
                    const subStr = d.sub !== '' ? ' (' + d.sub + ')' : '';
                    statusBadges += '<span class="status-stat-badge" style="background:' + bg + ';">' + d.emoji + ' ' + d.label + subStr + '</span>';
                });
            }
            
            return `
                <div class="status-character-card ${isDead ? 'dead' : ''}">
                    <div class="status-char-name">
                        <span>${name} ${char.rikudoMode ? '⚡RIKUDŌ⚡' : ''}</span>
                        <span style="font-size: 0.8em; color: var(--warning);">⚡${char.speed}</span>
                    </div>
                    <div class="status-char-stats">
                        <span class="status-stat-badge" style="background: rgba(0, 255, 102, 0.2); border-color: var(--hp-bar);">
                            💚 HP: ${isNaN(char.hp) ? 0 : char.hp}/${char.maxHp}
                        </span>
                        <span class="status-stat-badge" style="background: rgba(255, 170, 0, 0.2); border-color: var(--charge-bar);">
                            ⚡ Cargas: ${char.charges}
                        </span>
                        ${char.shield > 0 ? `<span class="status-stat-badge" style="background: rgba(0, 217, 255, 0.2); border-color: var(--primary-glow);">🛡️ Escudo: ${char.shield}</span>` : ''}
                        ${isDead ? '<span class="status-stat-badge" style="background: rgba(0, 0, 0, 0.5); border-color: #666;">💀 CAÍDO</span>' : ''}
                    </div>
                    <div class="stat-bar" style="margin-top: 10px;">
                        <div class="bar-container">
                            <div class="bar-fill hp-bar" style="width: ${(char.hp / char.maxHp) * 100}%"></div>
                        </div>
                    </div>
                    <div class="stat-bar" style="margin-top: 5px;">
                        <div class="bar-container">
                            <div class="bar-fill charge-bar" style="width: ${(char.charges / 20) * 100}%"></div>
                        </div>
                    </div>
                    ${statusBadges ? `<div style="margin-top: 10px; display: flex; gap: 5px; flex-wrap: wrap;">${statusBadges}</div>` : ''}
                    ${char.passive ? `<div style="margin-top: 10px; font-size: 0.85em; opacity: 0.8;">✨ ${char.passive.name}</div>` : ''}
                </div>
            `;
        }

        function closeActionModal() {
            // Cierra el modal de acción y vuelve a mostrar el botón flotante
            document.getElementById('actionModal').classList.remove('show');
            showContinueButton();
        }

        function showCharInfo(name) {
            const char = gameState.characters[name];
            if (!char) return;
            const panel = document.getElementById('charInfoPanel');
            const content = document.getElementById('charInfoContent');
            content.innerHTML = '';

            // Colores por equipo
            const teamColor = char.team === 'team1' ? 'var(--team1)' : 'var(--team2)';
            const teamLabel = (typeof getTeamLabel === 'function') ? ((char.team === 'team1' ? '🔷 ' : '🔶 ') + getTeamLabel(char.team)) : (char.team === 'team1' ? '🔷 HUNTERS' : '🔶 REAPERS');

            // Portrait
            const isTransformed = (char.rikudoMode && (name === 'Madara Uchiha' || name === 'Madara Uchiha v2')) ||
                                   (char.fenixArmorActive && (name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2')) ||
                                   (char.kuramaMode && (name === 'Minato Namikaze' || name === 'Minato Namikaze v2')) ||
                                   ((name === 'Alexstrasza' || name === 'Alexstrasza v2') && char.dragonFormActive) ||
                                   ((name === 'Goku' || name.startsWith('Goku')) && char.ultraInstinto) ||
                                  ((name === 'Anakin Skywalker' || name === 'Anakin Skywalker v2') && char.darkSideAwakened) ||
                                  ((name === 'Muzan Kibutsuji' || name === 'Muzan Kibutsuji v2') && char.muzanTransformed);
            const portrait = char.portrait || char.transformPortrait || char.transformationPortrait || '';

            // Header row
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;gap:16px;align-items:flex-start;margin-bottom:16px;';

            if (portrait) {
                const img = document.createElement('img');
                img.src = portrait; img.alt = name;
                img.style.cssText = 'width:80px;height:80px;object-fit:contain;border-radius:10px;border:2px solid ' + teamColor + ';flex-shrink:0;';
                img.onerror = function() { this.style.display='none'; };
                header.appendChild(img);
            }

            const meta = document.createElement('div');
            meta.style.flex = '1';
            const nameEl = document.createElement('div');
            nameEl.textContent = name;
            nameEl.style.cssText = 'font-family:Orbitron,sans-serif;font-size:1.1em;font-weight:700;color:' + teamColor + ';margin-bottom:6px;';
            meta.appendChild(nameEl);

            const teamTag = document.createElement('div');
            teamTag.textContent = teamLabel;
            teamTag.style.cssText = 'font-size:0.75em;opacity:0.7;margin-bottom:8px;';
            meta.appendChild(teamTag);

            // Stats grid
            const stats = [
                ['❤️ HP', char.hp + ' / ' + char.maxHp, (char.hp/char.maxHp)*100, '#00ff88'],
                ['⚡ VEL', char.speed, null, null],
                ['💎 CARGAS', char.charges, null, null],
                char.shield > 0 ? ['🛡️ ESCUDO', char.shield + ' HP', null, null] : null
            ].filter(Boolean);

            stats.forEach(([label, val, pct, barColor]) => {
                const row = document.createElement('div');
                row.style.cssText = 'margin-bottom:4px;';
                const lbl = document.createElement('div');
                lbl.style.cssText = 'display:flex;justify-content:space-between;font-size:0.8em;';
                lbl.innerHTML = '<span style="opacity:0.75">' + label + '</span><span style="font-weight:600">' + val + '</span>';
                row.appendChild(lbl);
                if (pct !== null) {
                    const barWrap = document.createElement('div');
                    barWrap.style.cssText = 'height:4px;background:rgba(255,255,255,0.1);border-radius:2px;margin-top:2px;';
                    const bar = document.createElement('div');
                    bar.style.cssText = 'height:100%;width:' + Math.max(0,Math.min(100,pct)) + '%;background:' + barColor + ';border-radius:2px;transition:width 0.3s;';
                    barWrap.appendChild(bar); row.appendChild(barWrap);
                }
                meta.appendChild(row);
            });
            header.appendChild(meta);
            content.appendChild(header);

            // Estado (debuffs/buffs activos)
            if (char.statusEffects && char.statusEffects.length > 0) {
                const fx = document.createElement('div');
                fx.style.cssText = 'margin-bottom:12px;';
                const fxTitle = document.createElement('div');
                fxTitle.textContent = '⚡ EFECTOS ACTIVOS';
                fxTitle.style.cssText = 'font-size:0.7em;opacity:0.6;letter-spacing:0.1em;margin-bottom:6px;';
                fx.appendChild(fxTitle);
                const fxWrap = document.createElement('div');
                fxWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
                buildDisplayEffects(char.statusEffects).forEach(function(d) {
                    const tag = document.createElement('span');
                    const subStr = d.sub !== '' ? ' (' + d.sub + ')' : '';
                    tag.textContent = d.emoji + ' ' + d.label + subStr;
                    tag.style.cssText = 'font-size:0.7em;padding:3px 8px;border-radius:12px;border:1px solid ' + (d.type==='buff'?'rgba(0,255,136,0.4)':'rgba(255,60,60,0.4)') + ';background:' + (d.type==='buff'?'rgba(0,255,136,0.1)':'rgba(255,60,60,0.1)') + ';';
                    fxWrap.appendChild(tag);
                });
                fx.appendChild(fxWrap);
                content.appendChild(fx);
            }

            // Pasiva
            if (char.passive && char.passive.name) {
                const pBox = document.createElement('div');
                pBox.style.cssText = 'background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.3);border-radius:10px;padding:10px;margin-bottom:12px;';
                const pTitle = document.createElement('div');
                pTitle.textContent = '✨ PASIVA: ' + char.passive.name;
                pTitle.style.cssText = 'font-size:0.8em;color:var(--warning);font-weight:600;margin-bottom:4px;';
                pBox.appendChild(pTitle);
                const pDesc = document.createElement('div');
                pDesc.textContent = char.passive.description || '';
                pDesc.style.cssText = 'font-size:0.75em;opacity:0.8;line-height:1.4;';
                pBox.appendChild(pDesc);
                content.appendChild(pBox);
            }

            // Movimientos
            const movTitle = document.createElement('div');
            movTitle.textContent = '⚔️ MOVIMIENTOS';
            movTitle.style.cssText = 'font-size:0.7em;opacity:0.6;letter-spacing:0.1em;margin-bottom:8px;';
            content.appendChild(movTitle);

            (char.abilities || []).forEach(ab => {
                const abDiv = document.createElement('div');
                abDiv.style.cssText = 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;margin-bottom:8px;';
                const abHeader = document.createElement('div');
                abHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';
                const abName = document.createElement('span');
                abName.textContent = ab.name || '';
                abName.style.cssText = 'font-weight:600;font-size:0.85em;';
                const abType = document.createElement('span');
                abType.textContent = (ab.type||'').toUpperCase();
                const typeColors = {basic:'rgba(0,217,255,0.7)',special:'rgba(170,0,255,0.7)',over:'rgba(255,140,0,0.7)'};
                abType.style.cssText = 'font-size:0.65em;padding:2px 8px;border-radius:10px;background:' + (typeColors[ab.type]||'rgba(255,255,255,0.2)') + ';letter-spacing:0.05em;';
                abHeader.appendChild(abName); abHeader.appendChild(abType);
                abDiv.appendChild(abHeader);
                const abCost = document.createElement('div');
                abCost.textContent = '💎 ' + (ab.cost || 0) + ' cargas';
                abCost.style.cssText = 'font-size:0.72em;opacity:0.6;margin-bottom:4px;';
                abDiv.appendChild(abCost);
                if (ab.description) {
                    const abDesc = document.createElement('div');
                    abDesc.textContent = ab.description;
                    abDesc.style.cssText = 'font-size:0.75em;opacity:0.8;line-height:1.4;';
                    abDiv.appendChild(abDesc);
                }
                content.appendChild(abDiv);
            });

            // Botón cerrar
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕ Cerrar';
            closeBtn.style.cssText = 'width:100%;margin-top:8px;padding:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:rgba(255,255,255,0.7);font-family:Orbitron,sans-serif;font-size:0.8em;cursor:pointer;';
            closeBtn.onclick = closeCharInfo;
            content.appendChild(closeBtn);

            panel.style.display = 'flex';
        }

        function closeCharInfo() {
            document.getElementById('charInfoPanel').style.display = 'none';
        }

        // Cerrar panel al hacer click en el fondo
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('charInfoPanel').addEventListener('click', function(e) {
                if (e.target === this) closeCharInfo();
            });
            // Event delegation para fichas de personaje en batalla
            document.addEventListener('click', function(e) {
                const card = e.target.closest('[data-charname]');
                if (card && card.dataset.charname && !e.target.closest('.action-modal') && !e.target.closest('.turn-confirm-modal')) {
                    showCharInfo(card.dataset.charname);
                }
            });
        });

        function showActionModal() {
            const char = gameState.characters[gameState.selectedCharacter];
            const modal = document.getElementById('actionModal');
            
            // Inyectar portrait (usa transformación si está activa)
            const portraitImg = document.getElementById('actionPortraitImg');
            const portraitFallback = document.getElementById('actionPortraitFallback');
            const charName = gameState.selectedCharacter;
            const isTransformedModal = (char.rikudoMode && (charName === 'Madara Uchiha' || charName === 'Madara Uchiha v2')) ||
                                       (char.fenixArmorActive && (charName === 'Ikki de Fenix' || charName === 'Ikki de Fenix v2')) ||
                                       (char.kuramaMode && (charName === 'Minato Namikaze' || charName === 'Minato Namikaze v2')) ||
                                       (char.dragonFormActive && (charName === 'Alexstrasza' || charName === 'Alexstrasza v2')) ||
                                       (char.ultraInstinto && (charName === 'Goku' || charName.startsWith('Goku'))) ||
                                       (char.darkSideAwakened && (charName === 'Anakin Skywalker' || charName === 'Anakin Skywalker v2')) ||
                                       (char.muzanTransformed && (charName === 'Muzan Kibutsuji' || charName === 'Muzan Kibutsuji v2'));
                        const modalPortrait = char.portrait || char.transformPortrait || char.transformationPortrait || '';
            if (modalPortrait) {
                portraitImg.src = modalPortrait;
                portraitImg.alt = charName;
                portraitImg.style.display = 'block';
                portraitFallback.style.display = 'none';
            } else {
                portraitImg.style.display = 'none';
                portraitFallback.style.display = 'flex';
            }
            
            // Actualizar título y stats
            document.getElementById('actionModalTitle').textContent = `Turno de ${gameState.selectedCharacter}`;
            document.getElementById('roundCounter').textContent = `⏱️ RONDA ${gameState.currentRound}`;
            document.getElementById('actionHP').textContent = `${char.hp}/${char.maxHp}`;
            document.getElementById('actionCharges').textContent = char.charges;
            
            // Mostrar escudo si existe
            const shieldStat = document.getElementById('actionShield');
            if (char.shield > 0) {
                shieldStat.style.display = 'block';
                document.getElementById('actionShieldValue').textContent = char.shield;
            } else {
                shieldStat.style.display = 'none';
            }
            
            // Mostrar pasiva si existe
            const passiveContainer = document.getElementById('actionPassive');
            if (char.passive) {
                const isLimboActive = (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2') && char.rikudoMode;
                const borderColor = isLimboActive ? 'rgba(255,153,0,0.5)' : 'rgba(255,170,0,0.35)';
                const titleColor = isLimboActive ? '#ff9900' : 'var(--warning)';
                const activeTag = isLimboActive ? ' <span style="background:rgba(255,153,0,0.3);border:1px solid #ff9900;border-radius:6px;padding:1px 7px;font-size:0.75em;color:#ff9900;">⚡ ACTIVA</span>' : '';
                passiveContainer.innerHTML = `
                    <div class="passive-indicator" style="border-color:${borderColor};">
                        <div class="passive-title" style="color:${titleColor};">✨ PASIVA: ${char.passive.name}${activeTag}</div>
                        <div style="font-size: 0.85em;">${char.passive.description}</div>
                    </div>
                `;
            } else {
                passiveContainer.innerHTML = '';
            }
            
            // Mostrar efectos de estado
            const statusContainer = document.getElementById('actionStatusEffects');
            if (char.statusEffects && char.statusEffects.length > 0) {
                let statusHTML = '<div style="margin-top: 10px; text-align: center;">';
                char.statusEffects.forEach(effect => {
                    let emoji = '';
                    if (effect.name === 'Quemadura') emoji = '🔥';
                    else if (effect.name === 'Regeneracion') emoji = '💖';
                    else emoji = '✨';
                    statusHTML += `<span class="status-effect ${effect.type === 'buff' ? 'buff' : 'debuff'}" style="margin: 5px;">${emoji} ${effect.name} (${effect.duration})</span>`;
                });
                statusHTML += '</div>';
                statusContainer.innerHTML = statusHTML;
            } else {
                statusContainer.innerHTML = '';
            }
            
            // Renderizar habilidades
            renderActionAbilities();
            
            modal.classList.add('show');
        }

        function renderActionAbilities() {
            const char = gameState.characters[gameState.selectedCharacter];
            const container = document.getElementById('actionAbilities');
            container.innerHTML = '';
            
            char.abilities.forEach((ability, index) => {
                // Verificar si la habilidad ya fue usada (transformaciones)
                if (ability.used) {
                    return; // No mostrar habilidades ya usadas
                }
                
                // Calcular costo ajustado
                let adjustedCost = ability.cost;
                if (char.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                    adjustedCost = Math.ceil(ability.cost / 2);
                }
                
                const canUse = char.charges >= adjustedCost;
                
                // SILENCIAR: bloquear la categoría silenciada
                const silencedCat = gameState._silencedCategory;
                const blockedBySilence = silencedCat && ability.type === silencedCat;
                
                // CONGELACIÓN: 50% chance de perder turno (se evalúa en continueTurn, no aquí)
                const isFrozen = false; // No bloquea habilidades en el modal
                const blockedByFreeze = false;
                
                // Verificar si puede revivir (solo para Milagro de la vida)
                let canRevive = true;
                if (ability.effect === 'revive_ally') {
                    const deadAllies = Object.keys(gameState.characters).filter(name => {
                        const c = gameState.characters[name];
                        return c.team === char.team && c.isDead;
                    });
                    canRevive = deadAllies.length > 0;
                }
                
                // Verificar si puede sacrificar sombras
                let canSacrifice = true;
                if (ability.effect === 'sacrifice_shadow') {
                    const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                    canSacrifice = myShadows.length > 0;
                }
                
                // Verificar si puede invocar más sombras
                let canSummon = true;
                if (ability.effect === 'summon_shadows' || ability.effect === 'arise_summon') {
                    try {
                        const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                        const shadowPool = ['Igris', 'Iron', 'Tusk', 'Beru', 'Bellion'];
                        const existingShadowNames = myShadows.filter(s => s && s.name).map(s => s.name);
                        const availableShadows = shadowPool.filter(name => !existingShadowNames.includes(name));
                        canSummon = availableShadows.length > 0;
                    } catch (error) {
                        console.error('Error verificando summon_shadows:', error);
                        canSummon = true; // Permitir intento
                    }
                }
                
                // Verificar si Kamish ya está invocado
                let canSummonKamish = true;
                if (ability.effect === 'summon_kamish') {
                    try {
                        const myShadows = getSummonsBySummoner(gameState.selectedCharacter);
                        canSummonKamish = !myShadows.some(s => s && s.name === 'Kamish');
                    } catch (error) {
                        console.error('Error verificando summon_kamish:', error);
                        canSummonKamish = true; // Permitir intento
                    }
                }
                
                // (Sigilo no bloquea ninguna habilidad — la restricción era de apertura_camino que ya no existe)
                const blockedBySigilo = false;
                // Bloquear habilidades marcadas con lockedWhenTransformed (ej: Despertar del Lado Oscuro)
                let blockedByTransform = false;
                if (ability.lockedWhenTransformed) {
                    const _charName = gameState.selectedCharacter;
                    const _c = gameState.characters[_charName];
                    if (_c && (_c.darkSideAwakened || _c.rikudoMode || _c.ultraInstinto || _c.muzanTransformed ||
                        _c.varianTransformed || _c.garouSaitamaMode || _c.supermanPrimeMode ||
                        _c.dragonFormActive || _c.fenixArmorActive || _c.kuramaMode)) {
                        blockedByTransform = true;
                    }
                }
                // Bloquear habilidades con cooldown activo (ej: Singularidad Escarlata)
                let blockedByCooldown = false;
                let cooldownLabel = '';
                if (ability.effect === 'singularidad_escarlata') {
                    const _cdChar = gameState.characters[gameState.selectedCharacter];
                    if (_cdChar && _cdChar._singularidadCooldown > 0) {
                        blockedByCooldown = true;
                        cooldownLabel = '⏳ Cooldown: ' + _cdChar._singularidadCooldown + 'T';
                    }
                }
                const disabled = !canUse || !canRevive || !canSacrifice || !canSummon || !canSummonKamish || blockedByFreeze || blockedBySigilo || blockedByTransform || blockedByCooldown;
                
                const button = document.createElement('button');
                button.className = 'action-ability-btn';
                button.disabled = disabled;
                button.onclick = () => selectAbilityFromModal(index);

                let reasonTag = '';
                if (blockedByCooldown && cooldownLabel) {
                    reasonTag = '<div style="font-size:.65rem;color:#ff8844;margin-top:4px;font-weight:700;">' + cooldownLabel + '</div>';
                }
                
                const SMAP_ACTION = { 'summon_shadows': ['Igris','Tusk','Beru'], 'summon_kamish': ['Kamish'], 'el_rey_caido': ['Sindragosa','Kel Thuzad','Darion Morgraine','Bolvar Fordragon','Tirion Fordring'], 'summon_sphinx': ['Abu el-Hol Sphinx'], 'summon_ramesseum': ['Ramesseum Tentyris'], 'enkidu': ['Enkidu'] };
                const sSummonList = SMAP_ACTION[ability.effect];
                const sSummonBtns = sSummonList ? sSummonList.map(n => '<button onclick="showSummonInfo(\'' + n.replace(/'/g,"\'") + '\',event)" style="background:rgba(168,85,247,0.2);border:1px solid #a855f7;color:#a855f7;border-radius:6px;cursor:pointer;padding:2px 7px;font-size:.65rem;margin:2px 2px 0 0;display:inline-block;" title="Info invocación">🔮 ' + n + '</button>').join('') : '';
                button.innerHTML = `
                    <span class="action-ability-name">${ability.name}</span>
                    <div class="action-ability-desc">${ability.description || 'Sin descripción disponible.'}${sSummonList ? '<div style="margin-top:5px;">' + sSummonBtns + '</div>' : ''}</div>
                    ${reasonTag}
                    <div class="action-ability-footer">
                        <span class="action-ability-cost">💎 ${adjustedCost}</span>
                        <span class="action-ability-type">${ability.type}</span>
                    </div>
                `;
                
                container.appendChild(button);
            });
        }

        function selectAbilityFromModal(abilityIndex) {
            const char = gameState.characters[gameState.selectedCharacter];
            const ability = char.abilities[abilityIndex];
            
            // Calcular costo ajustado
            let adjustedCost = ability.cost;
            if (char.rikudoMode && (gameState.selectedCharacter === 'Madara Uchiha' || gameState.selectedCharacter === 'Madara Uchiha v2')) {
                adjustedCost = Math.ceil(ability.cost / 2);
            }
            
            gameState.selectedAbility = ability;
            gameState.adjustedCost = adjustedCost;
            
            // Cerrar modal de acción
            document.getElementById('actionModal').classList.remove('show');
            
            // Mostrar selector de objetivo
            showTargetSelection(ability);
        }

        function updateCurrentTurnDisplay() {
            const currentCharName = gameState.selectedCharacter;
            const currentChar = gameState.characters[currentCharName];
            document.getElementById('currentTurnDisplay').textContent = 
                `🎯 TURNO: ${currentCharName} (${typeof getTeamLabel === 'function' ? getTeamLabel(currentChar.team) : (currentChar.team === 'team1' ? 'HUNTERS' : 'REAPERS')})`;
        }

        function highlightActiveCharacter() {
            // Remover highlight anterior
            document.querySelectorAll('.character-card').forEach(card => {
                card.classList.remove('active-turn');
            });
            
            // Agregar highlight al personaje actual
            const cardId = `char-${gameState.selectedCharacter.replace(/\s+/g, '-')}`;
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.add('active-turn');
            }
        }

        function endTurn() {
            gameState._miedoActive = false; // Limpiar flag de Miedo
            // Cap all character charges at 20 and HP at maxHp
            for (let n in gameState.characters) {
                const _c = gameState.characters[n];
                if (_c && _c.charges > 20) _c.charges = 20;
                if (_c && _c.hp > _c.maxHp) _c.hp = _c.maxHp; // HP no puede superar el máximo
            }
            try {
                // Decrementar duraciones al FINAL del turno activo
                // (buffs/debuffs expiran al finalizar el turno del personaje que los tiene)
                if (gameState.selectedCharacter) {
                    // QUEMADURA: aplica daño al FINAL del turno del personaje con el debuff
                    processBurnEffects(gameState.selectedCharacter);
                    processSolarBurnEffects(gameState.selectedCharacter);
                    // Check if burn killed the character
                    const _burnVictim = gameState.characters[gameState.selectedCharacter];
                    if (_burnVictim && _burnVictim.hp <= 0 && !_burnVictim.isDead) {
                        _burnVictim.isDead = true;
                        addLog('💀 ' + gameState.selectedCharacter + ' ha sido derrotado por quemaduras', 'damage');
                        renderCharacters();
                    }
                    updateStatusEffectDurations(gameState.selectedCharacter);
                    // Decrementar cooldowns de habilidades (Another Dimension, etc.)
                    const actorChar = gameState.characters[gameState.selectedCharacter];
                    if (actorChar && actorChar.abilities) {
                        actorChar.abilities.forEach(ab => {
                            if (ab.cooldown > 0) ab.cooldown--;
                        });
                    }
                }

                // ESPÍRITU DEL HÉROE (Saitama): genera 3 cargas al final del turno si HP <= 50%
                if ((gameState.selectedCharacter === 'Saitama' || gameState.selectedCharacter === 'Saitama v2')) {
                    const saitama = gameState.characters['Saitama'];
                    if (saitama && !saitama.isDead && saitama.hp <= Math.floor(saitama.maxHp * 0.5)) {
                        saitama.charges += 3;
                        addLog(`💪 Espíritu del Héroe: Saitama genera 3 cargas (HP bajo 50%)`, 'buff');
                    }
                }

                // SIGILO: se rompe si el personaje activo realizó un ataque (al ponerse al descubierto)
                if (gameState.selectedCharacter) {
                    const activeChar = gameState.characters[gameState.selectedCharacter];
                    if (activeChar && activeChar.statusEffects && gameState._attackedThisTurn) {
                        const sigiloIdx = activeChar.statusEffects.findIndex(e => e && normAccent(e.name || '') === 'sigilo');
                        if (sigiloIdx !== -1) {
                            const sigiloEff = activeChar.statusEffects[sigiloIdx];
                            if (sigiloEff.appliedThisTurn) {
                                // Sigilo aplicado en ESTE turno — sobrevive, solo limpiar flag
                                sigiloEff.appliedThisTurn = false;
                                addLog('👤 Sigilo de ' + gameState.selectedCharacter + ' se mantiene (aplicado este turno)', 'buff');
                            } else {
                                activeChar.statusEffects.splice(sigiloIdx, 1);
                                addLog('👤 Sigilo de ' + gameState.selectedCharacter + ' se pierde al atacar', 'damage');
                            }
                        }
                    }
                    gameState._attackedThisTurn = false;
                }
                
                // Incrementar contador de turnos en la ronda
                gameState.turnsInRound++;
                
                // Usar el snapshot tomado al inicio de la ronda para no desincronizar
                if (gameState.turnsInRound >= gameState.aliveCountAtRoundStart) {
                    // Procesar efectos de final de ronda ANTES de incrementar la ronda
                    processEndOfRoundEffects();
                    
                    gameState.currentRound++;
                    gameState.turnsInRound = 0;

                    // ── EMPATE: ronda 30 sin ganador ──
                    if (gameState.currentRound > 30 && !gameState.gameOver) {
                        gameState.gameOver = true;
                        gameState.winner = 'EMPATE';
                        addLog('⚖️ ¡RONDA 30! La batalla termina en EMPATE.', 'info');
                        if (typeof showGameOver === 'function') {
                            showGameOver('⚖️ ¡EMPATE! — La batalla llegó a la ronda 30');
                        }
                        return;
                    }
                    // IZANAMI (Itachi): reset dodge flag each round
                    for (const _in in gameState.characters) {
                        const _ic = gameState.characters[_in];
                        if (_ic && _ic.passive && _ic.passive.name === 'Izanami') {
                            _ic.izanamiUsedThisRound = false;
                        }
                    }
                    // PILAR DEL AGUA (Giyu Tomioka): inicio de nueva ronda → Escudo 1HP a aliados
                    for (const _gn in gameState.characters) {
                        const _gc = gameState.characters[_gn];
                        if (!_gc || _gc.isDead || !_gc.passive || _gc.passive.name !== 'Pilar del Agua') continue;
                        for (const _an in gameState.characters) {
                            const _ac = gameState.characters[_an];
                            if (_ac && !_ac.isDead && _ac.hp > 0 && _ac.team === _gc.team) {
                                _ac.shield = (_ac.shield || 0) + 1;
                            }
                        }
                        addLog('🌊 Pilar del Agua: Escudo 1HP aplicado al equipo aliado', 'buff');
                    }
                    // Nuevo snapshot de vivos para la ronda que comienza
                    gameState.aliveCountAtRoundStart = Object.values(gameState.characters).filter(c => c && !c.isDead && c.hp > 0).length;
                    addLog(`⏱️ ¡RONDA ${gameState.currentRound} COMIENZA!`, 'info');
                    // ── EXPLOSIÓN FINAL (Vegeta): countdown revivir ──
                    for (const _vn in gameState.characters) {
                        const _vc = gameState.characters[_vn];
                        if (!_vc || !_vc._vegetaRevivePending || _vc._vegetaRevivePending <= 0) continue;
                        _vc._vegetaRevivePending--;
                        if (_vc._vegetaRevivePending <= 0) {
                            _vc.isDead = false; _vc.hp = Math.ceil(_vc.maxHp * 0.50); _vc.charges = 10; _vc.statusEffects = [];
                            addLog('💥 Explosión Final: ¡' + _vn + ' revive con ' + _vc.hp + ' HP y 10 cargas!', 'buff');
                            renderCharacters();
                        }
                    }
                    // RESET EVASIÓN SASUKE al inicio de ronda
                    for (const _sn in gameState.characters) {
                        const _sc = gameState.characters[_sn];
                        if (_sc && _sc.passive && _sc.passive.name === 'Venganza Eterna') _sc.sasukeEvasionUsedThisRound = false;
                    }

                    // ── GIGANTE DE HIELO: 50% Congelacion + 50% Megacongelacion al inicio de ronda ──
                    const _gH = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Gigante de Hielo' && s.hp > 0; });
                    if (_gH) {
                        const _gHETeam = _gH.team === 'team1' ? 'team2' : 'team1';
                        for (const _n in gameState.characters) {
                            const _c = gameState.characters[_n];
                            if (!_c || _c.team !== _gHETeam || _c.isDead || _c.hp <= 0) continue;
                            if (Math.random() < 0.50) { applyFreeze(_n, 1); addLog('❄️ Gigante de Hielo: Congelacion a ' + _n + ' (inicio ronda)', 'debuff'); }
                            if (Math.random() < 0.50) { applyFreeze(_n, 2, true); addLog('🧊 Gigante de Hielo: Megacongelacion a ' + _n + ' (inicio ronda)', 'debuff'); }
                        }
                    }
                    // ── CAMINO NINJA (Naruto): transformación al inicio de ronda ──
                    for (const _naruN in gameState.characters) {
                        const _naruC = gameState.characters[_naruN];
                        if (!_naruC || _naruC.isDead || _naruC.hp <= 0) continue;
                        if (!_naruC.passive || _naruC.passive.name !== 'Camino Ninja') continue;
                        const _naruRoll = Math.random();
                        let _naruForm = null, _naruFormName = '', _naruPortrait = _naruC.portrait;
                        if (_naruRoll < 0.20) {
                            _naruForm = 'baryon'; _naruFormName = 'Modo Baryon';
                            _naruPortrait = _naruC.portraitBaryon || _naruC.portrait;
                            _naruC.speed = (_naruC.speed || 87) + 10;
                            addLog('🟠 Camino Ninja: ' + _naruN + ' entra en Modo Baryon (vel+10, daño doble, cargas=daño)', 'buff');
                        } else if (_naruRoll < 0.60) {
                            _naruForm = 'kyubi'; _naruFormName = 'Modo Kyubi';
                            _naruPortrait = _naruC.portraitKyubi || _naruC.portrait;
                            addLog('🦊 Camino Ninja: ' + _naruN + ' entra en Modo Kyubi (50% esquivar, prioridad al esquivar)', 'buff');
                        } else if (_naruRoll < 1.00) {
                            _naruForm = 'sabio'; _naruFormName = 'Modo Sabio';
                            _naruPortrait = _naruC.portraitSabio || _naruC.portrait;
                            addLog('🐸 Camino Ninja: ' + _naruN + ' entra en Modo Sabio (cargas=daño recibido)', 'buff');
                        }
                        if (_naruForm) {
                            // Resetear velocidad si cambia de Baryon
                            if (_naruC.narutoForm === 'baryon' && _naruForm !== 'baryon') {
                                _naruC.speed = Math.max(87, (_naruC.speed||87) - 10);
                            }
                            _naruC.narutoForm = _naruForm;
                            _naruC.portrait = _naruPortrait;
                            _naruC.currentPortrait = _naruPortrait;
                            // Kyubi: buff Esquivar 999T
                            if (_naruForm === 'kyubi') {
                                _naruC.hasDodge = true;
                                if (!(_naruC.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'esquivar'; })) {
                                    _naruC.statusEffects.push({ name: 'Esquivar', type: 'buff', duration: 999, permanent: true, emoji: '💨' });
                                }
                            } else {
                                _naruC.hasDodge = false;
                                _naruC.statusEffects = (_naruC.statusEffects||[]).filter(function(e){ return !e || normAccent(e.name||'') !== 'esquivar'; });
                            }
                        }
                    }
                    // ── EL REY PROMETIDO (Jon Snow): revivir al inicio de ronda ──
                    for (const _jsN in gameState.characters) {
                        const _jsC = gameState.characters[_jsN];
                        if (!_jsC || !_jsC.isDead || _jsC.jonSnowReviveUsed) continue;
                        if (!_jsC.passive || _jsC.passive.name !== 'El Rey Prometido') continue;
                        if (Math.random() < 0.50) {
                            _jsC.isDead = false;
                            _jsC.hp = 15;
                            _jsC.charges = 18;
                            _jsC.statusEffects = [];
                            _jsC.jonSnowReviveUsed = true;
                            addLog('⚔️ El Rey Prometido: ¡' + _jsN + ' revive con 15 HP y 18 cargas!', 'buff');
                            renderCharacters();
                        }
                    }
                    // Snapshot HP de todos los personajes al inicio de ronda (para Aspecto de la Vida)
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && !c.isDead && c.hp > 0) c.hpAtRoundStart = c.hp;
                    }
                }
                
                gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;

                if (onlineMode) {
                    // Capture battle log for sync
                    const logEl = document.getElementById('battleLogContent');
                    if (logEl) {
                        gameState.battleLog = Array.from(logEl.children).map(function(el) {
                            return { text: el.textContent, type: el.className.replace('log-entry','').trim() };
                        });
                    }
                    // Push AFTER index advance so activeTeam reflects the NEXT character
                    pushGameState();
                    setTimeout(() => { startTurn(); }, 1000);
                } else {
                    setTimeout(() => { startTurn(); }, 1000);
                }
            } catch (error) {
                console.error('Error en endTurn:', error);
                // Intentar continuar de todas formas
                try {
                    gameState.currentTurnIndex = (gameState.currentTurnIndex + 1) % gameState.turnOrder.length;
                    setTimeout(() => startTurn(), 1000);
                } catch (e) {
                    console.error('Error crítico en endTurn:', e);
                }
            }
        }

        function processEndOfRoundEffects() {
            try {
                // ── ENFORCE PERMANENT PASSIVES (run at start of each round) ──
                for (const _pn in gameState.characters) {
                    const _pc = gameState.characters[_pn];
                    if (!_pc || _pc.isDead || !_pc.passive) continue;
                    const _pname = _pc.passive.name;
                    // Darth Vader: Aura Oscura permanente
                    if (_pname === 'Presencia Oscura') {
                        if (!hasStatusEffect(_pn, 'Aura oscura')) {
                            _pc.statusEffects = (_pc.statusEffects || []);
                            _pc.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                        }
                    }
                    // Goku Black: Cuerpo Divino — el efecto de Aura Oscura se aplica
                    // directamente en applyDamageWithShield (summons.js), no como buff visible
                    // NO se agrega a statusEffects para que no aparezca en la barra de efectos
                    // Anakin Skywalker: Asistir permanente (El Elegido)
                    if (_pname === 'El Elegido') {
                        if (!(_pc.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'asistir')) {
                            _pc.statusEffects = (_pc.statusEffects || []);
                            _pc.statusEffects.push({ name: 'Asistir', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                            _pc.anakinAsistir = true;
                        }
                    }
                    // Anakin transformado: Concentración permanente + 50% Reflejar cada ronda
                    if (_pname === 'El Elegido' && _pc.darkSideAwakened) {
                        if (!hasStatusEffect(_pn, 'Concentracion')) {
                            _pc.statusEffects = (_pc.statusEffects || []);
                            _pc.statusEffects.push({ name: 'Concentracion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🎯' });
                        }
                        if (Math.random() < 0.50) {
                            _pc.statusEffects = (_pc.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'reflejar');
                            _pc.statusEffects.push({ name: 'Reflejar', type: 'buff', duration: 2, emoji: '🪞' });
                            addLog('🌑 Despertar del Lado Oscuro: Anakin gana Reflejar 2T (50%)', 'buff');
                        }
                    }
                    // Giyu Tomioka: Armadura permanente
                    if (_pname === 'Pilar del Agua') {
                        if (!hasStatusEffect(_pn, 'Armadura')) {
                            _pc.statusEffects = (_pc.statusEffects || []);
                            _pc.statusEffects.push({ name: 'Armadura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                        }
                    }
                }
            } catch(e) { console.warn('Permanent passive enforcement error:', e); }
            // ── TAMAYO PASIVA: Curandera de las Sombras (1 vez por ronda) ──
            for (let tamName in gameState.characters) {
                if (!tamName.startsWith('Tamayo')) continue;
                const tamayo = gameState.characters[tamName];
                if (!tamayo || tamayo.isDead || tamayo.hp <= 0) continue;
                const passiveName = tamayo.passive && tamayo.passive.name ? tamayo.passive.name : '';
                if (passiveName !== 'Curandera de las Sombras') continue;
                const tamAllies = Object.keys(gameState.characters).filter(n => {
                    const c = gameState.characters[n];
                    return c && c.team === tamayo.team && !c.isDead && c.hp > 0 && n !== tamName;
                });
                if (tamAllies.length > 0) {
                    // Eliminar hasta 2 debuffs de un aliado aleatorio (si tiene debuffs)
                    const shuffled = tamAllies.slice().sort(() => Math.random() - 0.5);
                    let debuffRemoved = false;
                    for (let i = 0; i < shuffled.length; i++) {
                        const ally = gameState.characters[shuffled[i]];
                        const debuffs = ally.statusEffects.filter(e => e && e.type === 'debuff' && !e.permanent);
                        if (debuffs.length > 0) {
                            const toRemove = debuffs.slice(0, 2);
                            ally.statusEffects = ally.statusEffects.filter(e => !toRemove.includes(e));
                            addLog(`🌿 Curandera de las Sombras: Tamayo elimina ${toRemove.length} debuff${toRemove.length > 1 ? 's' : ''} de ${shuffled[i]}`, 'buff');
                            debuffRemoved = true;
                            break;
                        }
                    }
                    // Siempre aplica Escudo 3HP a un aliado aleatorio
                    const shieldTarget = tamAllies[Math.floor(Math.random() * tamAllies.length)];
                    gameState.characters[shieldTarget].shield = (gameState.characters[shieldTarget].shield || 0) + 3;
                    addLog(`🌿 Curandera de las Sombras: Tamayo da Escudo 3HP a ${shieldTarget}`, 'buff');
                }
            }
            try {
                // Resetear pasiva de Bellion
                resetBellionPassives();
                
                // Resetear esquive de Minato al inicio de nueva ronda
                const minato = gameState.characters['Minato Namikaze'];
                if (minato && !minato.isDead && minato.hp > 0) {
                    minato.dodgedThisRound = false;
                }

                // ASPECTO DE LA VIDA (Alexstrasza): cura 3 HP al aliado con menos HP al final de ronda
                const alexRound = gameState.characters['Alexstrasza'];
                if (alexRound && !alexRound.isDead && alexRound.hp > 0) {
                    let lowestAlly = null, lowestHpVal = Infinity;
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== alexRound.team || c.isDead || c.hp <= 0) continue;
                        if (c.hp < c.maxHp && c.hp < lowestHpVal) { lowestHpVal = c.hp; lowestAlly = n; }
                    }
                    if (lowestAlly) {
                        const c = gameState.characters[lowestAlly];
                        const healAV = Math.min(3, c.maxHp - c.hp);
                        if (healAV > 0) {
                            c.hp = Math.min(c.maxHp, c.hp + healAV);
                            addLog('💚 Aspecto de la Vida: ' + lowestAlly + ' recupera ' + healAV + ' HP', 'heal');
                            triggerBendicionSagrada(alexRound.team, healAV);
                        }
                    }
                }

                // PASIVA CENIZAS DEL FÉNIX (Ikki): rastrear rondas post-muerte
                const ikki = gameState.characters['Ikki de Fenix'];
                if (ikki && ikki.isDead) {
                    if (!ikki.deathRound) ikki.deathRound = gameState.currentRound;
                    const roundsSinceDeath = gameState.currentRound - ikki.deathRound;
                    if (roundsSinceDeath >= 2 && !ikki.fenixRevived) {
                        ikki.fenixRevived = true;
                        ikki.hp = Math.ceil(ikki.maxHp * 0.5);
                        ikki.charges = 5;
                        ikki.isDead = false;
                        ikki.statusEffects = [];
                        if (!gameState.turnOrder.includes('Ikki de Fenix')) gameState.turnOrder.push('Ikki de Fenix');
                        gameState.aliveCountAtRoundStart = Math.max(gameState.aliveCountAtRoundStart, Object.values(gameState.characters).filter(c => c && !c.isDead && c.hp > 0).length);
                        addLog(`🦅 ¡Cenizas del Fénix! Ikki de Fénix revive con ${ikki.hp} HP y 5 cargas`, 'heal');
                    }
                }
                
                // Procesar buff Sigilo — multi-ronda
                for (let name in gameState.characters) {
                    const char = gameState.characters[name];
                    if (!char || char.isDead || char.hp <= 0 || !char.statusEffects) continue;
                    const sigiloIdx = char.statusEffects.findIndex(e => e && normAccent(e.name || '') === 'sigilo');
                    if (sigiloIdx !== -1) {
                        const sigiloEff = char.statusEffects[sigiloIdx];
                        char.charges += 1;
                        addLog(`👤 ${name} genera 1 carga por Sigilo (fin de ronda)`, 'buff');
                        triggerIgrisPassive(name);
                        // Decrementar rondas restantes
                        sigiloEff.sigiloRoundsLeft = (sigiloEff.sigiloRoundsLeft || 1) - 1;
                        if (sigiloEff.sigiloRoundsLeft <= 0) {
                            char.statusEffects.splice(sigiloIdx, 1);
                            addLog(`👤 Sigilo de ${name} expira al finalizar la ronda`, 'info');
                        }
                    }
                }
                
                // Activar pasiva de Beru
                triggerBeruPassive();
                
                // Activar pasiva de Kaisel
                triggerKaiselPassive();


                // PHALANX (Leonidas): al inicio de ronda, limpia 2 debuffs aleatorios del equipo aliado
                (function() {
                    const leon = gameState.characters['Leonidas'];
                    if (!leon || leon.isDead || leon.hp <= 0) return;
                    let cleaned = 0;
                    // Recoger todos los debuffs de todos los aliados (no permanentes)
                    const allDebuffPairs = [];
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== leon.team) continue;
                        (_a.statusEffects||[]).forEach(function(e) {
                            if (e && e.type === 'debuff' && !e.permanent) allDebuffPairs.push({ charName: _an, effect: e });
                        });
                    }
                    if (allDebuffPairs.length === 0) return;
                    // Mezclar y tomar hasta 2
                    allDebuffPairs.sort(function() { return Math.random() - 0.5; });
                    const toClean = allDebuffPairs.slice(0, 2);
                    toClean.forEach(function(pair) {
                        const _a = gameState.characters[pair.charName];
                        if (!_a) return;
                        _a.statusEffects = (_a.statusEffects||[]).filter(function(e) { return e !== pair.effect; });
                        addLog('⚔️ Phalanx: Leonidas limpia ' + (pair.effect.name || 'Debuff') + ' de ' + pair.charName, 'buff');
                        cleaned++;
                    });
                })();

                // CUERPO PERFECTO: al final de la ronda, elimina debuffs del usuario
                // Limbo (Madara Uchiha) también incluye este efecto
                Object.keys(gameState.characters).forEach(function(n) {
                    const c = gameState.characters[n];
                    if (!c || c.isDead || c.hp <= 0) return;
                    const hasCuerpoPerfecto = hasStatusEffect(n, 'Cuerpo Perfecto') ||
                        (c.passive && c.passive.name === 'Limbo'); // Madara Limbo = Divinidad + Cuerpo Perfecto
                    if (!hasCuerpoPerfecto) return;
                    const debuffsBefore = (c.statusEffects || []).filter(e => e && e.type === 'debuff' && !e.permanent);
                    if (debuffsBefore.length === 0) return;
                    c.statusEffects = (c.statusEffects || []).filter(e => !e || e.type !== 'debuff' || e.permanent);
                    addLog('💠 Cuerpo Perfecto: ' + n + ' elimina sus debuffs (' + debuffsBefore.length + ')', 'buff');
                });
                // PASIVA PROGENITOR DEMONIACO (Muzan): cura al inicio de cada ronda
                triggerMuzanPassive();

                // PASIVA MENTE BRILLANTE (Ivar the Boneless): buff aleatorio a cada aliado al inicio de ronda
                (function() {
                    const _ivar = gameState.characters['Ivar the Boneless'];
                    if (!_ivar || _ivar.isDead || _ivar.hp <= 0) return;
                    // Esquiva Área permanente
                    if (!(_ivar.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'esquiva area')) {
                        _ivar.statusEffects = (_ivar.statusEffects||[]);
                        _ivar.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '💨' });
                    }
                    // Mente Brillante: usar funciones específicas para que cada buff funcione correctamente
                    function _applyMenteBrillanteBuff(allyName) {
                        const _pool = ['Frenesi','Furia','Concentracion','Contraataque','Celeridad'];
                        const _chosen = _pool[Math.floor(Math.random() * _pool.length)];
                        const _a = gameState.characters[allyName];
                        if (_chosen === 'Frenesi') {
                            if (typeof applyFrenesi === 'function') applyFrenesi(allyName, 1);
                            else applyBuff(allyName, { name: 'Frenesi', type: 'buff', duration: 1, emoji: '🔥' });
                        } else if (_chosen === 'Furia') {
                            if (typeof applyFuria === 'function') applyFuria(allyName, 1);
                            else applyBuff(allyName, { name: 'Furia', type: 'buff', duration: 1, emoji: '⚡' });
                        } else if (_chosen === 'Concentracion') {
                            if (typeof applyConcentracion === 'function') applyConcentracion(allyName, 1);
                            else applyBuff(allyName, { name: 'Concentracion', type: 'buff', duration: 1, emoji: '🎯' });
                        } else if (_chosen === 'Contraataque') {
                            applyBuff(allyName, { name: 'Contraataque', type: 'buff', duration: 1, emoji: '🔄' });
                        } else if (_chosen === 'Celeridad') {
                            // Celeridad: aumenta velocidad real +10% del speed base
                            const _speedBonus = _a ? Math.ceil((_a.speed||80) * 0.10) : 8;
                            if (_a) _a.speed = (_a.speed||80) + _speedBonus;
                            applyBuff(allyName, { name: 'Celeridad', type: 'buff', duration: 1, emoji: '💨', speedBonus: _speedBonus });
                        }
                        return _chosen;
                    }
                    for (const _an in gameState.characters) {
                        const _a = gameState.characters[_an];
                        if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _ivar.team) continue;
                        const _b1 = _applyMenteBrillanteBuff(_an);
                        addLog('Mente Brillante: ' + _an + ' recibe ' + _b1, 'buff');
                        if (Math.random() < 0.50) {
                            const _b2 = _applyMenteBrillanteBuff(_an);
                            addLog('Mente Brillante (50%): ' + _an + ' recibe ' + _b2 + ' extra', 'buff');
                        }
                    }
                })();

                // PASIVA SEÑOR DE LOS NAZGUL (Rey Brujo): Megaprovoción permanente + Infectar permanente
                (function() {
                    for (const _rbn in gameState.characters) {
                        const _rb = gameState.characters[_rbn];
                        if (!_rb || _rb.isDead || _rb.hp <= 0) continue;
                        if (!_rb.passive || _rb.passive.name !== 'Señor de los Nazgul') continue;
                        // MegaProvocación permanente
                        if (!(_rb.statusEffects||[]).some(e => e && normAccent(e.name||'') === 'megaprovocacion')) {
                            _rb.statusEffects = (_rb.statusEffects||[]);
                            _rb.statusEffects.push({ name: 'Megaprovocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                        }
                        // Infectar permanente: al inicio de ronda aplica Veneno 1T a todos los enemigos
                        const _rbEnemyTeam = _rb.team === 'team1' ? 'team2' : 'team1';
                        for (const _en in gameState.characters) {
                            const _ec = gameState.characters[_en];
                            if (!_ec || _ec.isDead || _ec.hp <= 0 || _ec.team !== _rbEnemyTeam) continue;
                            applyPoison(_en, 1);
                        }
                        addLog('💀 Infectar (Rey Brujo): Veneno 1T aplicado a todos los enemigos', 'debuff');
                    }
                })();

                // PASIVA LO'GOSH (Varian Wrynn): al caer bajo 30% HP activa Regen 10% 3T al equipo
                (function() {
                    for (const _vrn in gameState.characters) {
                        const _vr = gameState.characters[_vrn];
                        if (!_vr || _vr.isDead || _vr.hp <= 0) continue;
                        if (!_vr.passive || _vr.passive.name !== 'Lo\'gosh') continue;
                        if (_vr.varianLowHpBuffTriggered) continue;
                        if (_vr.hp / _vr.maxHp < 0.30) {
                            _vr.varianLowHpBuffTriggered = true;
                            for (const _an in gameState.characters) {
                                const _a = gameState.characters[_an];
                                if (!_a || _a.isDead || _a.hp <= 0 || _a.team !== _vr.team) continue;
                                _a.statusEffects = (_a.statusEffects||[]).filter(e => !e || normAccent(e.name||'') !== 'regeneracion');
                                _a.statusEffects.push({ name: 'Regeneracion', type: 'buff', duration: 3, percent: 10, emoji: '💖' });
                            }
                            addLog('⚔️ Lo\'gosh: ¡Varian bajo 30% HP! Equipo aliado recibe Regeneración 10% 3T', 'buff');
                        }
                        // Resetear flag si sube de HP (por curación)
                        if (_vr.hp / _vr.maxHp >= 0.30 && _vr.varianLowHpBuffTriggered) {
                            _vr.varianLowHpBuffTriggered = false;
                        }
                    }
                })();

                // RAMESSEUM TENTYRIS: aplica QS a enemigos sin QS + cura 2 HP aliados por cada QS aplicada
                (function triggerRamesseumPassive() {
                    const ram = Object.values(gameState.summons).find(function(s) {
                        return s && s.name === 'Ramesseum Tentyris' && s.hp > 0;
                    });
                    if (!ram) return;
                    const ramAllyTeam  = ram.team;
                    const ramEnemyTeam = ram.team === 'team1' ? 'team2' : 'team1';
                    let qsApplied = 0;
                    for (const n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== ramEnemyTeam || c.isDead || c.hp <= 0) continue;
                        const hasQS = (c.statusEffects || []).some(function(e) {
                            return e && normAccent(e.name || '') === 'quemadura solar';
                        });
                        if (!hasQS) {
                            if (typeof applySolarBurn === 'function') {
                                applySolarBurn(n, 0, 2);
                            } else {
                                c.statusEffects = c.statusEffects || [];
                                c.statusEffects.push({ name: 'Quemadura Solar', type: 'debuff', duration: 2, emoji: '☀️' });
                                addLog('☀️ Ramesseum Tentyris: ' + n + ' recibe Quemadura Solar 2T', 'debuff');
                            }
                            qsApplied++;
                        }
                    }
                    if (qsApplied > 0) {
                        // Curar 2 HP a cada aliado por cada QS aplicada
                        const healPerAlly = qsApplied * 2;
                        for (const n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (!c || c.team !== ramAllyTeam || c.isDead || c.hp <= 0) continue;
                            if (typeof canHeal === 'function' && !canHeal(n)) continue;
                            const oldHp = c.hp;
                            c.hp = Math.min(c.maxHp, c.hp + healPerAlly);
                            const healed = c.hp - oldHp;
                            if (healed > 0) {
                                addLog('🏛️ Ramesseum Tentyris: ' + n + ' recupera ' + healed + ' HP (' + qsApplied + ' QS aplicadas)', 'heal');
                                if (typeof triggerBendicionSagrada === 'function') triggerBendicionSagrada(ramAllyTeam, healed);
                                if (typeof triggerPresenciaOscura === 'function') triggerPresenciaOscura(n);
                            }
                        }
                    }
                })();

                // ABU EL-HOL SPHINX: todos los enemigos con QS pierden 2 cargas
                const sphinx = Object.values(gameState.summons).find(s => s && (s.name === 'Abu el-Hol Sphinx' || s.name === 'Sphinx Wehem-Mesut') && s.hp > 0);
                if (sphinx) {
                    const sphinxEnemyTeam = sphinx.team === 'team1' ? 'team2' : 'team1';
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (!c || c.team !== sphinxEnemyTeam || c.isDead || c.hp <= 0) continue;
                        const hasQS = (c.statusEffects || []).some(e => e && normAccent(e.name||'') === 'quemadura solar');
                        if (hasQS) {
                            c.charges = Math.max(0, (c.charges || 0) - 2);
                            addLog('🦁 Sphinx: ' + n + ' pierde 2 cargas (tiene Quemadura Solar)', 'debuff');
                        }
                    }
                }

                // Resetear redirect de Nakime para nueva ronda
                for (let n in gameState.characters) {
                    const c = gameState.characters[n];
                    if (c && c.passive && c.passive.name === 'Castillo Infinito') {
                        c.nakimeRedirectUsed = false;
                    }
                }

                // LICH KING INVOCACIONES PASIVAS por ronda
                // Kel Thuzad (Aliado de la Muerte): cura 2 HP flat al equipo aliado al final de ronda
                const kelThuzad = Object.values(gameState.summons).find(s => s && s.name === 'Kel Thuzad');
                if (kelThuzad) {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === kelThuzad.team && !c.isDead && c.hp > 0) {
                            c.hp = Math.min(c.maxHp, c.hp + 2);
                            addLog('❄️ Kel Thuzad (Aliado de la Muerte): ' + n + ' recupera 2 HP', 'heal');
                        }
                    }
                }
                // Darion Morgraine: Sirviente de la Muerte — +10 velocidad al equipo aliado
                const darion = Object.values(gameState.summons).find(function(s) { return s && s.name === 'Darion Morgraine' && s.hp > 0; });
                if (darion) {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === darion.team && !c.isDead && c.hp > 0) {
                            c.speed = (c.speed || 80) + 10;
                            addLog('⚔️ Darion Morgraine (Sirviente de la Muerte): ' + n + ' gana +10 velocidad', 'buff');
                        }
                    }
                }
                // Bolvar Fordragon: Castigo de la Muerte — 3 daño al equipo enemigo
                const bolvar = Object.values(gameState.summons).find(function(s) { return s && s.name === 'Bolvar Fordragon' && s.hp > 0; });
                if (bolvar) {
                    const bolvarETeam = bolvar.team === 'team1' ? 'team2' : 'team1';
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === bolvarETeam && !c.isDead && c.hp > 0) {
                            applyDamageWithShield(n, 3, null);
                            addLog('🔥 Bolvar Fordragon (Castigo de la Muerte): ' + n + ' recibe 3 daño', 'damage');
                        }
                    }
                    // Daño a invocaciones enemigas también
                    for (let sid in gameState.summons) {
                        const s = gameState.summons[sid];
                        if (s && s.team === bolvarETeam && s.hp > 0 && s.name !== 'Bolvar Fordragon') {
                            applySummonDamage(sid, 3, null);
                        }
                    }
                }
                // Tirion Fordring: cura 5 HP y 5 cargas al equipo
                const tirion = Object.values(gameState.summons).find(s => s && s.name === 'Tirion Fordring');
                if (tirion) {
                    for (let n in gameState.characters) {
                        const c = gameState.characters[n];
                        if (c && c.team === tirion.team && !c.isDead && c.hp > 0) {
                            c.hp = Math.min(c.maxHp, c.hp + 5);
                            c.charges += 5;
                            addLog(`⚔️ Tirion Fordring: ${n} recupera 5 HP y 5 cargas`, 'heal');
                        }
                    }
                }
                // GIGANTE DE HIELO (Douma): al inicio de ronda congelaciones + al final daño
                // Al inicio de ronda se maneja abajo — aquí el daño al final de ronda
                const _gigante = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Gigante de Hielo' && s.hp > 0; });
                if (_gigante) {
                    const _gETeam = _gigante.team === 'team1' ? 'team2' : 'team1';
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _gETeam || _c.isDead || _c.hp <= 0) continue;
                        const _isCong = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'congelacion'; });
                        const _isMega = (_c.statusEffects||[]).some(function(e){ return e && normAccent(e.name||'') === 'mega congelacion'; });
                        if (_isMega) { applyDamageWithShield(_n, 10, null); addLog('🧊 Gigante de Hielo: 10 daño a ' + _n + ' (Megacongelacion)', 'damage'); }
                        else if (_isCong) { applyDamageWithShield(_n, 5, null); addLog('❄️ Gigante de Hielo: 5 daño a ' + _n + ' (Congelacion)', 'damage'); }
                    }
                }
                // GHOST (Jon Snow): al final de ronda — 1 daño + Veneno 1T a cada enemigo + elimina 1 invocación enemiga
                const _ghostS = Object.values(gameState.summons).find(function(s){ return s && s.name === 'Ghost' && s.hp > 0; });
                if (_ghostS) {
                    const _ghostETeam = _ghostS.team === 'team1' ? 'team2' : 'team1';
                    // 1 daño + Veneno 1T a cada enemigo
                    for (const _n in gameState.characters) {
                        const _c = gameState.characters[_n];
                        if (!_c || _c.team !== _ghostETeam || _c.isDead || _c.hp <= 0) continue;
                        applyDamageWithShield(_n, 1, null);
                        applyPoison(_n, 1);
                        addLog('🐺 Ghost (Huargo Bastardo): ' + _n + ' recibe 1 daño + Veneno 1T', 'damage');
                    }
                    // Eliminar 1 invocación enemiga aleatoria
                    const _enemySummons = Object.entries(gameState.summons).filter(function(e){
                        return e[1] && e[1].team === _ghostETeam && e[1].hp > 0 && e[1].name !== 'Ghost';
                    });
                    if (_enemySummons.length > 0) {
                        const _toKill = _enemySummons[Math.floor(Math.random() * _enemySummons.length)];
                        addLog('🐺 Ghost: elimina la invocación ' + _toKill[1].name + ' del equipo enemigo', 'damage');
                        delete gameState.summons[_toKill[0]];
                        if (typeof renderSummons === 'function') renderSummons();
                    }
                }

                // ═══ PASIVAS DE DRAGONES (Daenerys) AL FINAL DE RONDA ═══
                for (let sid in gameState.summons) {
                    const s = gameState.summons[sid];
                    if (!s || s.hp <= 0) continue;
                    
                    if (s.effect === 'mega_prov_aoe_dmg' || s.dragonEffect === 'mega_prov_aoe_dmg') {
                        // Drogon: inflige 3 daño AOE al equipo enemigo
                        const drogTeam = s.team === 'team1' ? 'team2' : 'team1';
                        addLog(`🔴 Drogon (Pasiva): inflige 3 de daño AOE al equipo ${typeof getTeamLabel === 'function' ? getTeamLabel(drogTeam) : (drogTeam === 'team1' ? 'HUNTERS' : 'REAPERS')}`, 'damage');
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (c && c.team === drogTeam && !c.isDead && c.hp > 0) {
                                if (checkAsprosAOEImmunity(n) || checkMinatoAOEImmunity(n)) { addLog('🌟 ' + n + ' esquiva el AOE de Drogon (Esquiva Área)', 'buff'); continue; }
                                applyDamageWithShield(n, 3, null);
                            }
                        }
                        // Drogon AOE también daña invocaciones enemigas
                        for (let sid in gameState.summons) {
                            const ds = gameState.summons[sid];
                            if (ds && ds.team === drogTeam && ds.hp > 0) {
                                ds.hp = Math.max(0, ds.hp - 3);
                                addLog('🔴 Drogon: ' + ds.name + ' recibe 3 daño', 'damage');
                                if (ds.hp <= 0) { delete gameState.summons[sid]; addLog('💨 ' + ds.name + ' fue derrotado por Drogon', 'damage'); }
                            }
                        }
                        // Drogon también tiene Megaprovocacion activa (se maneja en target selection)
                    } else if (s.effect === 'burn_team' || s.dragonEffect === 'burn_team') {
                        // Rhaegal: aplica Quemadura 10% por 1 turno a todo el equipo enemigo
                        const rhTeam = s.team === 'team1' ? 'team2' : 'team1';
                        addLog(`🟢 Rhaegal (Pasiva): aplica Quemadura 10% al equipo ${typeof getTeamLabel === 'function' ? getTeamLabel(rhTeam) : (rhTeam === 'team1' ? 'HUNTERS' : 'REAPERS')}`, 'damage');
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (c && c.team === rhTeam && !c.isDead && c.hp > 0) {
                                applyFlatBurn(n, 1, 1); // 1 HP per spec
                            }
                        }
                        // Rhaegal también aplica quemadura a invocaciones enemigas
                        for (let rhsid in gameState.summons) {
                            const rhs = gameState.summons[rhsid];
                            if (rhs && rhs.team === rhTeam && rhs.hp > 0) {
                                rhs.hp = Math.max(0, rhs.hp - 1);
                                if (rhs.hp <= 0) { delete gameState.summons[rhsid]; addLog('💨 ' + rhs.name + ' fue derrotado por Rhaegal', 'damage'); }
                            }
                        }
                    } else if (s.effect === 'heal_team' || s.dragonEffect === 'heal_team') {
                        // Viserion: cura 2 HP a todo el equipo aliado (personajes + invocaciones)
                        addLog('⚪ Viserion (Pasiva): cura 2 HP al equipo aliado', 'heal');
                        for (let n in gameState.characters) {
                            const c = gameState.characters[n];
                            if (c && c.team === s.team && !c.isDead && c.hp > 0) {
                                const vHeal = Math.min(2, c.maxHp - c.hp);
                                if (vHeal > 0) {
                                    c.hp += vHeal;
                                    triggerBendicionSagrada(s.team, vHeal); // per-char trigger
                                }
                            }
                        }
                        // También cura invocaciones aliadas
                        for (let vsid in gameState.summons) {
                            const vs = gameState.summons[vsid];
                            if (vs && vs.team === s.team && vs.hp > 0 && vs.maxHp) {
                                const vsHeal = Math.min(2, vs.maxHp - vs.hp);
                                if (vsHeal > 0) { vs.hp += vsHeal; }
                            }
                        }
                    }
                }

            // Final check after all EOR effects — catches kills from burns, dragons, etc.
            if (typeof checkGameOver === 'function' && checkGameOver()) return;
            renderCharacters();
            renderSummons();
            } catch (error) {
                console.error('Error en processEndOfRoundEffects:', error);
            }
        }
