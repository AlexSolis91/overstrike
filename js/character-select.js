// ==================== CHARACTER SELECT ====================
        const CS_TEAM_SIZE = 5;

        let csState = {
            team1: [],   // nombres seleccionados para hunters
            team2: [],   // nombres seleccionados para reapers
            phase: 'team1', // 'team1' | 'team2' | 'done'
            pendingChar: null, // nombre del personaje en revisión
            gameMode: 'multi' // 'multi' | 'solo'
        };

        function csSelectMode(mode) {
            csState.gameMode = mode;
            audioManager.playSelect();
            // Do NOT restart menu music — it's already playing from the mode screen
            document.getElementById('modeSelectScreen').style.display = 'none';
            document.getElementById('charSelectScreen').style.display = 'block';
            if (mode === 'solo') {
                // En modo solitario solo HUNTERS (team1) elige; la IA elige team2 automáticamente
                const lbl = document.getElementById('csPhaseLabel');
                lbl.textContent = '🔷 HUNTERS — Elige tus 5 personajes (vs IA)';
                lbl.className = 'cs-phase-label team1';
            }
            csInit();
        }

        function csRemoveChar(team, index) {
            audioManager.playSelect();
            if (team === 'team1') {
                csState.team1.splice(index, 1);
                if (csState.gameMode !== 'online') {
                    if (csState.phase === 'team2' || csState.phase === 'done') csState.phase = 'team1';
                }
            } else {
                csState.team2.splice(index, 1);
                if (csState.gameMode !== 'online') {
                    if (csState.phase === 'done') csState.phase = 'team2';
                }
            }
            // In online mode: hide ready button if my team now has < 5
            if (csState.gameMode === 'online') {
                const myTeam = isRoomHost ? 'team1' : 'team2';
                if (csState[myTeam].length < CS_TEAM_SIZE) {
                    const btn = document.getElementById('onlineReadyBtn');
                    if (btn) btn.style.display = 'none';
                }
            }
            csRenderSlots();
            csRenderGrid();
            // Actualizar label de fase
            if (csState.phase === 'team1') {
                const lbl = document.getElementById('csPhaseLabel');
                const suffix = csState.gameMode === 'solo' ? ' (vs IA)' : '';
                lbl.textContent = '🔷 HUNTERS — Elige tus 5 personajes' + suffix;
                lbl.className = 'cs-phase-label team1';
            } else if (csState.phase === 'team2') {
                const lbl = document.getElementById('csPhaseLabel');
                lbl.textContent = '🔶 REAPERS — Elige tus 5 personajes';
                lbl.className = 'cs-phase-label team2';
            }
        }

        // ──────────────────────────────────────────────────────────────
        // HELPER: crea un elemento con clase y texto/HTML de forma segura
        // ──────────────────────────────────────────────────────────────
        function el(tag, cls, text) {
            const e = document.createElement(tag);
            if (cls) e.className = cls;
            if (text !== undefined) e.textContent = text;
            return e;
        }
        function elHTML(tag, cls, html) {
            const e = document.createElement(tag);
            if (cls) e.className = cls;
            if (html !== undefined) e.innerHTML = html;
            return e;
        }
        function imgEl(src, alt, cls) {
            const i = document.createElement('img');
            i.src = src; i.alt = alt; i.loading = 'eager';
            i.referrerPolicy = 'no-referrer';
            if (cls) i.className = cls;
            i.onerror = function() {
                this.style.display = 'none';
                if (this.nextElementSibling) this.nextElementSibling.style.display = 'flex';
            };
            return i;
        }
        function portraitEl(portrait, altText, cls, placeholderText) {
            const wrap = document.createElement('div');
            wrap.style.position = 'relative';
            if (portrait) {
                const img = imgEl(portrait, altText, cls);
                wrap.appendChild(img);
                const ph = el('div', cls ? cls + '-placeholder' : 'portrait-placeholder', placeholderText || '⚔️');
                ph.style.display = 'none';
                wrap.appendChild(ph);
            } else {
                const ph = el('div', cls ? cls + '-placeholder' : 'portrait-placeholder', placeholderText || '⚔️');
                wrap.appendChild(ph);
            }
            return wrap;
        }

        function csInit() {
            csRenderSlots();
            csRenderGrid();
        }

        function csRenderSlots() {
            const t1 = document.getElementById('csTeam1Slots');
            const t2 = document.getElementById('csTeam2Slots');
            if (!t1 || !t2) { console.warn('[OVERSTRIKE] csRenderSlots: slots not found in DOM'); return; }
            t1.innerHTML = '';
            t2.innerHTML = '';

            for (let i = 0; i < CS_TEAM_SIZE; i++) {
                const name1 = csState.team1[i];
                const name2 = csState.team2[i];

                // ── Slot Team 1 ──
                const slot1 = document.createElement('div');
                slot1.className = 'cs-slot' + (name1 ? ' filled team1' : '');
                slot1.style.position = 'relative';
                if (name1) {
                    const char = characterData[name1];
                    if (char && char.portrait) {
                        const img = imgEl(char.portrait, name1, '');
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                        slot1.appendChild(img);
                    } else {
                        const ico = document.createElement('span');
                        ico.style.fontSize = '1.4em'; ico.textContent = '⚔️';
                        slot1.appendChild(ico);
                    }
                    slot1.appendChild(el('div', 'cs-slot-name', name1.split(' ')[0]));
                    // X button: show if local multi, or online host (team1 owner)
                    const canRemove1 = csState.gameMode !== 'solo' && (csState.gameMode !== 'online' || isRoomHost);
                    if (canRemove1) {
                        const xBtn = document.createElement('button');
                        xBtn.textContent = '✕';
                        xBtn.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:#ff4466;color:#fff;font-size:.65rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:10;';
                        xBtn.title = 'Quitar ' + name1;
                        (function(idx) { xBtn.onclick = function(e) { e.stopPropagation(); csRemoveChar('team1', idx); }; })(i);
                        slot1.appendChild(xBtn);
                    }
                } else {
                    slot1.textContent = String(i + 1);
                }
                t1.appendChild(slot1);

                // ── Slot Team 2 ──
                const slot2 = document.createElement('div');
                slot2.className = 'cs-slot' + (name2 ? ' filled team2' : '');
                slot2.style.position = 'relative';
                if (name2) {
                    const char = characterData[name2];
                    if (char && char.portrait) {
                        const img = imgEl(char.portrait, name2, '');
                        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
                        slot2.appendChild(img);
                    } else {
                        const ico = document.createElement('span');
                        ico.style.fontSize = '1.4em'; ico.textContent = '⚔️';
                        slot2.appendChild(ico);
                    }
                    slot2.appendChild(el('div', 'cs-slot-name', name2.split(' ')[0]));
                    // X button: show if local multi, or online guest (team2 owner)
                    const canRemove2 = csState.gameMode !== 'solo' && (csState.gameMode !== 'online' || !isRoomHost);
                    if (canRemove2) {
                        const xBtn2 = document.createElement('button');
                        xBtn2.textContent = '✕';
                        xBtn2.style.cssText = 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:none;background:#ff4466;color:#fff;font-size:.65rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:10;';
                        xBtn2.title = 'Quitar ' + name2;
                        (function(idx) { xBtn2.onclick = function(e) { e.stopPropagation(); csRemoveChar('team2', idx); }; })(i);
                        slot2.appendChild(xBtn2);
                    }
                } else {
                    slot2.textContent = csState.gameMode === 'solo' ? '🤖' : String(i + 1);
                }
                t2.appendChild(slot2);
            }
        }

        function csRenderGrid() {
            const grid = document.getElementById('csGrid');
            grid.innerHTML = '';

            for (const name in characterData) {
                try {
                    const char = characterData[name];
                    if (!char || !char.abilities) continue;

                    // Count how many times this char appears in each team
                    const countT1 = csState.team1.filter(n => n === name).length;
                    const countT2 = csState.team2.filter(n => n === name).length;
                    const inT1 = countT1 > 0;
                    const inT2 = countT2 > 0;

                    const card = document.createElement('div');
                    card.className = 'cs-char-card' + (inT1 && inT2 ? ' selected-both' : inT1 ? ' selected-team1' : inT2 ? ' selected-team2' : '');

                    // Portrait
                    if (char.portrait) {
                        const img = imgEl(char.portrait, name, 'cs-char-img');
                        card.appendChild(img);
                        const ph = el('div', 'cs-char-img-placeholder', '⚔️');
                        ph.style.display = 'none';
                        card.appendChild(ph);
                    } else {
                        card.appendChild(el('div', 'cs-char-img-placeholder', '⚔️'));
                    }

                    // Info row
                    const info = el('div', 'cs-char-info');
                    info.appendChild(el('div', 'cs-char-name', name));
                    info.appendChild(el('div', 'cs-char-speed', '⚡ ' + (char.speed || '?')));
                    // Show badges for how many times selected
                    if (inT1) {
                        const badge = el('span', 'cs-team-badge team1', '🔷' + (countT1 > 1 ? ' x' + countT1 : ''));
                        info.appendChild(badge);
                    }
                    if (inT2) {
                        const badge = el('span', 'cs-team-badge team2', '🔶' + (countT2 > 1 ? ' x' + countT2 : ''));
                        info.appendChild(badge);
                    }
                    card.appendChild(info);

                    // Always clickable (duplicates allowed)
                    card.onclick = (function(n) { return function() { csShowDetail(n); }; })(name);
                    grid.appendChild(card);
                } catch (err) {
                    console.error('Error renderizando carta de', name, err);
                }
            }
        }

        const SUMMON_CATALOGUE = {
            'Igris': { hp: 10, passive: 'Ataca con 3 de daño a un enemigo aleatorio al inicio de cada ronda.' },
            'Tusk': { hp: 8, passive: 'Aplica Debuff Sangrado a un enemigo aleatorio por 2 turnos al inicio de cada ronda.' },
            'Beru': { hp: 12, passive: 'Ataca con 5 de daño y aplica Veneno a un enemigo aleatorio al inicio de cada ronda.' },
            'Kamish': { hp: 30, passive: 'Mega Provocación: absorbe todo el daño ST y AOE del equipo. Los atacantes reciben Quemadura 20% permanente.' },
            'Sindragosa': { hp: 10, passive: 'Se invoca con Mega Provocación. Genera 1 carga a todo el equipo aliado cada vez que recibe daño.' },
            'Kel Thuzad': { hp: 8, passive: 'Aplica Regeneración 20% al equipo aliado cada turno.' },
            'Darion Morgraine': { hp: 6, passive: 'Aumenta la probabilidad de Crítico del equipo aliado en un 50%.' },
            'Bolvar Fordragon': { hp: 6, passive: 'Duplica el daño de las habilidades del equipo aliado.' },
            'Tirion Fordring': { hp: 3, passive: 'Mega Provocación permanente. Cura 5 HP y genera 5 cargas al equipo aliado por turno.' },
            'Sphinx Wehem-Mesut': { hp: 8, passive: 'Cada vez que un enemigo recibe daño por Quemadura Solar, pierde 2 cargas.' },
            'Ramesseum Tentyris': { hp: 20, passive: 'Al final de cada ronda, aplica Quemadura Solar 5% a enemigos sin ese debuff. Cuando un enemigo recibe daño por QS, todos los aliados recuperan 1 HP.' },
            'Enkidu': { hp: 15, passive: 'Cancela todas las invocaciones activas del enemigo. Aplica Mega Aturdimiento a todos los enemigos con más de 5 cargas.' },
        };


        function csShowDetail(name) {
            try {
                const char = characterData[name];
                if (!char) { console.error('Character not found:', name); return; }
                csState.pendingChar = name;

                // In online mode, always use the player's assigned team
                const currentTeam = (csState.gameMode === 'online' && csState.onlineTeam) ? csState.onlineTeam : csState.phase;
                const isT1 = currentTeam === 'team1';
                const teamLabel = isT1 ? '🔷 HUNTERS' : '🔶 REAPERS';
                const teamColor = isT1 ? 'var(--team1)' : 'var(--team2)';

                const modal = document.getElementById('csDetailContent');
                modal.innerHTML = '';

                // ── Hero section ──────────────────────────────────────────
                const hero = el('div', 'cs-detail-hero');

                // Portrait
                const portraitWrap = el('div', 'cs-detail-portrait-wrap');
                if (char.portrait) {
                    const img = imgEl(char.portrait, name, 'cs-detail-portrait');
                    portraitWrap.appendChild(img);
                    const ph = el('div', 'cs-detail-portrait-fallback', '⚔️');
                    ph.style.display = 'none';
                    portraitWrap.appendChild(ph);
                } else {
                    portraitWrap.appendChild(el('div', 'cs-detail-portrait-fallback', '⚔️'));
                }
                hero.appendChild(portraitWrap);

                // Meta
                const meta = el('div', 'cs-detail-meta');
                meta.appendChild(el('div', 'cs-detail-name', name));

                const stats = el('div', 'cs-detail-stats');
                stats.appendChild(el('div', 'cs-detail-stat', '⚡ Velocidad: ' + (char.speed || '?')));
                stats.appendChild(el('div', 'cs-detail-stat', '💚 HP: ' + (char.hp || '?')));
                meta.appendChild(stats);

                if (char.passive) {
                    const passiveBox = el('div', 'cs-detail-passive');
                    passiveBox.appendChild(el('div', 'cs-detail-passive-title', '✨ PASIVA: ' + char.passive.name));
                    const pdesc = el('div', '', char.passive.description);
                    pdesc.style.opacity = '0.85';
                    passiveBox.appendChild(pdesc);
                    meta.appendChild(passiveBox);
                }
                hero.appendChild(meta);
                modal.appendChild(hero);

                // ── Abilities ─────────────────────────────────────────────
                const abilitiesWrap = el('div', 'cs-detail-abilities');
                const SUMMON_EFFECT_MAP = {
                    'summon_shadows': ['Igris', 'Tusk', 'Beru'],
                    'summon_kamish': ['Kamish'],
                    'el_rey_caido': ['Sindragosa', 'Kel Thuzad', 'Darion Morgraine', 'Bolvar Fordragon', 'Tirion Fordring'],
                    'summon_sphinx': ['Sphinx Wehem-Mesut'],
                    'summon_ramesseum': ['Ramesseum Tentyris'],
                    'enkidu': ['Enkidu'],
                };
                (char.abilities || []).forEach(ab => {
                    const abilDiv = el('div', 'cs-detail-ability');
                    const nameRow = el('div', '', '');
                    nameRow.style.display = 'flex'; nameRow.style.alignItems = 'center'; nameRow.style.gap = '6px';
                    nameRow.appendChild(el('div', 'cs-detail-ability-name', ab.name || ''));
                    // Summon info button
                    const summonList = SUMMON_EFFECT_MAP[ab.effect];
                    if (summonList) {
                        summonList.forEach(function(sName) {
                            const btn = document.createElement('button');
                            btn.textContent = '🔮';
                            btn.title = 'Ver info de invocación: ' + sName;
                            btn.style.cssText = 'background:rgba(168,85,247,0.2);border:1px solid #a855f7;color:#a855f7;border-radius:6px;cursor:pointer;padding:2px 6px;font-size:.75rem;';
                            btn.onclick = (function(n) { return function(e) { e.stopPropagation(); e.preventDefault(); showSummonInfo(n, e); }; })(sName);
                            nameRow.appendChild(btn);
                        });
                    }
                    abilDiv.appendChild(nameRow);
                    abilDiv.appendChild(el('div', 'cs-detail-ability-desc', ab.description || 'Sin descripcion.'));
                    const footer = el('div', 'cs-detail-ability-footer');
                    footer.appendChild(el('span', 'cs-detail-ability-cost', '💎 ' + (ab.cost || 0)));
                    footer.appendChild(el('span', 'cs-detail-ability-type', ab.type || ''));
                    abilDiv.appendChild(footer);
                    abilitiesWrap.appendChild(abilDiv);
                });
                modal.appendChild(abilitiesWrap);

                // ── Question ──────────────────────────────────────────────
                const question = el('div', 'cs-detail-question');
                question.appendChild(document.createTextNode('¿Añadir '));
                const nameSpan = el('span', '', name);
                nameSpan.style.color = teamColor;
                nameSpan.style.fontWeight = '700';
                question.appendChild(nameSpan);
                question.appendChild(document.createTextNode(' a '));
                const teamSpan = el('span', '', teamLabel);
                teamSpan.style.color = teamColor;
                question.appendChild(teamSpan);
                question.appendChild(document.createTextNode('?'));
                modal.appendChild(question);

                // ── Buttons ───────────────────────────────────────────────
                const btns = el('div', 'cs-detail-btns');
                const btnYes = el('button', 'cs-confirm-btn yes', '✅ Sí, seleccionar');
                btnYes.onclick = function() { csConfirm(true); };
                const btnNo = el('button', 'cs-confirm-btn no', '❌ No, cancelar');
                btnNo.onclick = function() { csConfirm(false); };
                btns.appendChild(btnYes);
                btns.appendChild(btnNo);
                modal.appendChild(btns);

                document.getElementById('csDetailModal').classList.add('show');

            } catch(err) {
                console.error('Error en csShowDetail para', name, err);
                // Fallback seguro
                try {
                    const modal = document.getElementById('csDetailContent');
                    modal.innerHTML = '';
                    const errDiv = el('div', '', '');
                    errDiv.style.cssText = 'padding:20px;text-align:center;';
                    errDiv.appendChild(el('div', '', '⚠️ Error cargando ' + name));
                    const btnClose = el('button', 'cs-confirm-btn no', '❌ Cerrar');
                    btnClose.onclick = function() { csConfirm(false); };
                    errDiv.appendChild(btnClose);
                    modal.appendChild(errDiv);
                    document.getElementById('csDetailModal').classList.add('show');
                } catch(e2) {}
            }
        }

        function csConfirm(yes) {
            try {
                document.getElementById('csDetailModal').classList.remove('show');

                if (!yes || !csState.pendingChar) {
                    csState.pendingChar = null;
                    return;
                }

                const name = csState.pendingChar;
                csState.pendingChar = null;
                audioManager.playSelect();

                // Determine which team to add to
                let effectivePhase;
                if (csState.gameMode === 'online') {
                    effectivePhase = csState.onlineTeam; // always use assigned team
                } else {
                    effectivePhase = csState.phase;
                }
                console.log('[OVERSTRIKE DEBUG] csConfirm:', name, '| gameMode:', csState.gameMode, '| onlineTeam:', csState.onlineTeam, '| effectivePhase:', effectivePhase, '| team1:', csState.team1.length, '| team2:', csState.team2.length);

                if (effectivePhase === 'team1') {
                    // Prevent same character twice in same team
                    if (csState.team1.includes(name)) {
                        alert('⚠️ ' + name + ' ya está en tu equipo. Cada personaje solo puede aparecer una vez por equipo.');
                        return;
                    }
                    csState.team1.push(name);
                    if (csState.team1.length >= CS_TEAM_SIZE) {
                        if (csState.gameMode === 'solo') {
                            csState.phase = 'done';
                            csAIPickTeam();
                            csRenderSlots();
                            setTimeout(function() { csStartGame(); }, 800);
                            return;
                        } else if (csState.gameMode === 'online') {
                            csState.phase = 'done';
                            csRenderSlots();
                            csRenderGrid();
                            showOnlineReadyBtn();
                            return;
                        } else {
                            csState.phase = 'team2';
                            const lbl = document.getElementById('csPhaseLabel');
                            lbl.textContent = '🔶 REAPERS — Elige tus 5 personajes';
                            lbl.className = 'cs-phase-label team2';
                        }
                    }
                } else if (effectivePhase === 'team2') {
                    if (csState.team2.includes(name)) {
                        alert('⚠️ ' + name + ' ya está en tu equipo. Cada personaje solo puede aparecer una vez por equipo.');
                        return;
                    }
                    csState.team2.push(name);
                    if (csState.team2.length >= CS_TEAM_SIZE) {
                        if (csState.gameMode === 'online') {
                            csState.phase = 'done';
                            csRenderSlots();
                            csRenderGrid();
                            showOnlineReadyBtn();
                            return;
                        }
                        csState.phase = 'done';
                        csStartGame();
                        return;
                    }
                }

                csRenderSlots();
                csRenderGrid();
            } catch(err) {
                console.error('Error en csConfirm:', err);
            }
        }

        function csAIPickTeam() {
            // Si hay revancha con equipo IA pre-cargado, usarlo tal cual
            if (window._revanchaAITeamFixed && csState.team2 && csState.team2.length === CS_TEAM_SIZE) {
                window._revanchaAITeamFixed = false;
                addLog('🤖 La IA repite su equipo anterior.', 'info');
                return;
            }
            window._revanchaAITeamFixed = false;
            // IA elige 5 personajes aleatorios
            const allNames = Object.keys(characterData).filter(n => characterData[n] && characterData[n].abilities);
            const shuffled = allNames.slice().sort(() => Math.random() - 0.5);
            csState.team2 = shuffled.slice(0, CS_TEAM_SIZE);
            addLog('🤖 La IA ha seleccionado su equipo.', 'info');
        }

        function csStartGame() {
            try {
                const selectedChars = {};
                // Handle duplicate names: add suffix for duplicates
                const nameCount = {};
                const allSelected = csState.team1.map(n=>({name:n,team:'team1'})).concat(csState.team2.map(n=>({name:n,team:'team2'})));
                allSelected.forEach(function(entry) {
                    const base = entry.name;
                    nameCount[base] = (nameCount[base] || 0) + 1;
                    // NOTE: Firebase keys cannot contain '#' — use 'v2', 'v3' suffix instead
                    const key = nameCount[base] > 1 ? base + ' v' + nameCount[base] : base;
                    const charCopy = JSON.parse(JSON.stringify(characterData[base]));
                    charCopy.team = entry.team;
                    charCopy.baseName = base; // keep reference to original name for data
                    selectedChars[key] = charCopy;
                });

                document.getElementById('charSelectScreen').style.display = 'none';
                document.querySelector('.game-container').style.display = 'block';

                initGame(selectedChars);
                const modeLabel = csState.gameMode === 'solo' ? '🤖 Modo Solitario — ¡Buena suerte contra la IA!' : '👥 Modo Multijugador';
                addLog('🎮 ¡Batalla iniciada! ' + modeLabel, 'info');
                // In online mode: start syncing game state
                if (csState.gameMode === 'online') {
                    // Push initial state so both players see the first turn
                    setTimeout(function() {
                        if (isRoomHost) {
                            // Host pushes initial game state so guest knows whose turn it is
                            pushGameState();
                        }
                        listenGameState();
                    }, 500);
                }
                // Store game mode in gameState so AI loop can check
                gameState.gameMode = csState.gameMode;
                gameState.aiTeam = 'team2';
                // Ranked mode: mark for stats tracking
                if (window._rankedMode) {
                    gameState.gameMode = 'ranked';
                    // Show fake opponent name in logs if vs IA
                    if (window._rankedFakeOpponent) {
                        addLog('🏆 RANKED: ' + (currentUser ? currentUser.displayName || 'Jugador' : 'Jugador') + ' vs ' + window._rankedFakeOpponent, 'info');
                    }
                }
                audioManager.playRandomBattle();
            } catch(err) {
                console.error('Error en csStartGame:', err);
            }
        }


