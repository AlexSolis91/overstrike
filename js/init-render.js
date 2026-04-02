// ==================== INICIALIZACIÓN ====================
        function initGame(selectedCharacters) {
            // Reset full game state for new game
            gameState.selectedCharacter = null;
            gameState.selectedAbility = null;
            gameState.currentTurnIndex = 0;
            gameState.currentRound = 1;
            gameState.turnsInRound = 0;
            gameState.aliveCountAtRoundStart = 0;
            gameState.turnOrder = [];
            gameState.gameOver = false;
            gameState.winner = null;
            gameState._attackedThisTurn = false;
            gameState._miedoActive = false;
            gameState.summons = {};
            // Clear all summons completely
            // Clear battle log
            const logEl = document.getElementById('battleLogContent');
            if (logEl) {
                logEl.innerHTML = '';
                // Scroll habilitado desde inicio
                logEl.style.overflowY = 'auto';
                logEl.style.maxHeight = '420px';
                logEl.style.scrollbarWidth = 'thin';
            }
            gameState.battleLog = [];
            for (let k in gameState.summons) { delete gameState.summons[k]; }
            // Usar personajes seleccionados o todos por defecto
            const source = selectedCharacters || characterData;
            gameState.characters = JSON.parse(JSON.stringify(source));
            
            // ── PASIVAS PERMANENTES (buffs que no expiran ni pueden limpiarse) ──
            for (const charName in gameState.characters) {
                const ch = gameState.characters[charName];
                if (!ch || !ch.passive) continue;
                const passiveName = ch.passive.name || '';
                const baseName = ch.baseName || charName; // baseName handles duplicates like "Aldebaran #2"
                
                // Thestalos: solo Contraataque permanente (sin Provocacion — Excel v5)
                if (baseName === 'Thestalos') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Contraataque', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚔️' });
                }
                // Aldebaran: Provocación permanente
                if (baseName === 'Aldebaran') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                }
                // Anakin Skywalker: Contraataque permanente
                if (baseName === 'Anakin Skywalker') {
                    ch.anakinAsistir = true; // Asistir: fires basic when ally uses Special/Over ST
                }
                // Aspros de Gemini: Esquiva Área permanente
                if (baseName === 'Aspros de Gemini') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '✨' });
                }
                // Minato Namikaze: Esquiva Área permanente
                if (baseName === 'Minato Namikaze') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                }
                // Darth Vader: inmune a Miedo y Confusión + Aura Oscura permanente
                if (baseName === 'Darth Vader') {
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && normAccent(e.name||'') === 'aura oscura'; })) {
                        ch.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                    }
                }
                // Gandalf: inmune a Posesión, Confusión y Miedo (flag)
                if (baseName === 'Gandalf') {
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.immuneToPosesion = true;
                }
                // Lich King: inmune a Miedo, Posesión y Congelación (flag)
                if (charName === 'Lich King') {
                    ch.immuneToMiedo = true;
                    ch.immuneToPosesion = true;
                    ch.immuneToCongelacion = true;
                }
                // Rey Brujo de Angmar: Mega Provocacion permanente + inmunidades
                if (passiveName === 'Señor de los Nazgul') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Mega Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                }
                // Flash: Esquiva Area permanente
                if (passiveName === 'Aceleración Constante') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(e => e && normAccent(e.name||'').replace(/\s/g,'') === 'esquivaarea')) {
                        ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                    }
                    ch.esquivaAreaPassive = true;
                }
                // Ivar the Boneless: Esquiva Area permanente + inmunidades
                if (passiveName === 'Mente Brillante') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(e => e && (e.name||'').toLowerCase().replace(/[^a-z]/g,'') === 'esquivaarea')) {
                        ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '💨' });
                    }
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.immuneToPosesion = true;
                }
            }

            // Calcular orden de turnos
            calculateTurnOrder();
            
            // Snapshot de vivos al inicio de la primera ronda
            gameState.aliveCountAtRoundStart = Object.values(gameState.characters).filter(c => c && !c.isDead && c.hp > 0).length;
            // Snapshot HP inicial para Aspecto de la Vida
            for (let n in gameState.characters) {
                const c = gameState.characters[n];
                if (c && !c.isDead) c.hpAtRoundStart = c.hp;
            }
            
            // Renderizar UI
            renderCharacters();
            renderTurnOrder();
            
            // Comenzar el primer turno
            startTurn();
        }

        // ==================== CÁLCULO DE ORDEN DE TURNOS ====================
        function calculateTurnOrder() {
            let allCharacters = [];
            for (let name in gameState.characters) {
                allCharacters.push({ name: name, speed: gameState.characters[name].speed });
            }
            
            // Ordenar por velocidad (mayor a menor)
            allCharacters.sort((a, b) => b.speed - a.speed);
            
            gameState.turnOrder = allCharacters.map(c => c.name);
        }

        // ==================== RENDERIZADO ====================

        // ── Build collapsed/summed display list from raw statusEffects ──
        function buildDisplayEffects(statusEffects) {
            if (!statusEffects || statusEffects.length === 0) return [];
            const display = [];
            let burnPct = 0, burnFlat = 0, burnDur = 0, burnAdded = false;
            let solarPct = 0, solarDur = 0, solarAdded = false;
            let bleedStack = 0, bleedAdded = false;
            let poisonMaxDur = 0, poisonStacks = 0, poisonAdded = false;

            statusEffects.forEach(function(e) {
                if (!e || !e.name) return;
                if (e.passiveHidden) return; // Pasivas permanentes no muestran icono
                const nn = normAccent(e.name);

                if (nn === 'quemadura') {
                    burnPct += (e.percent || 0);
                    burnFlat += (e.flatHp || 0);
                    if (e.duration !== undefined) burnDur = Math.max(burnDur, e.duration);
                    burnAdded = true;
                } else if (nn === 'quemadura solar') {
                    solarPct += (e.percent || 0);
                    solarDur = Math.max(solarDur, e.duration || 0);
                    solarAdded = true;
                } else if (nn === 'sangrado') {
                    bleedStack += 1;
                    bleedAdded = true;
                } else if (nn === 'veneno') {
                    poisonStacks++;
                    poisonMaxDur = Math.max(poisonMaxDur, e.duration || 0);
                    poisonAdded = true;
                } else {
                    // Normal single display — con manejo especial para Sigilo y Regeneracion
                    let _sub = '';
                    let _label = e.name;
                    const _nn = normAccent ? normAccent(e.name||'') : (e.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                    if (_nn === 'sigilo') {
                        // Sigilo: mostrar rondas reales, no 999
                        _sub = (e.sigiloRoundsLeft !== undefined ? e.sigiloRoundsLeft : (e.duration !== 999 ? e.duration : '?')) + 'R';
                    } else if (_nn === 'regeneracion') {
                        // Regeneracion: mostrar % y turnos
                        const _pct = e.percent || (e.amount ? Math.round(e.amount) : null);
                        _label = 'Regeneracion' + (_pct ? ' ' + _pct + '%' : '');
                        _sub = (e.duration !== undefined && e.duration !== 999) ? e.duration + 'T' : '';
                    } else if (e.permanent || e.duration === 999) {
                        _sub = '';
                    } else {
                        _sub = e.duration !== undefined ? e.duration + 'T' : '';
                    }
                    display.push({ emoji: e.emoji || '✨', label: _label, sub: _sub, type: e.type });
                }
            });

            if (burnAdded) {
                if (burnFlat > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnFlat + ' HP', sub: burnDur + 'T', type: 'debuff' });
                else if (burnPct > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnPct + '%', sub: '', type: 'debuff' });
                else display.push({ emoji: '🔥', label: 'Quemadura', sub: '', type: 'debuff' });
            }
            if (solarAdded) {
                const _qsLabel = solarDur > 0 && solarDur < 990 ? 'Quemadura Solar ' + solarDur + 'T' : 'Quemadura Solar';
                display.push({ emoji: '☀️', label: _qsLabel, sub: '', type: 'debuff' });
            }
            if (bleedAdded)  display.push({ emoji: '🩸', label: 'Sangrado ' + bleedStack,        sub: '', type: 'debuff' });
            if (poisonAdded) display.push({ emoji: '☠️', label: 'Veneno',                        sub: poisonMaxDur + 'T', type: 'debuff' });

            return display;
        }

        function renderCharacters() {
            const team1Container = document.getElementById('team1Characters');
            const team2Container = document.getElementById('team2Characters');
            
            if (!team1Container || !team2Container) {
                console.error('Error: Contenedores de equipos no encontrados');
                return;
            }
            
            team1Container.innerHTML = '';
            team2Container.innerHTML = '';
            
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (!char) continue; // Skip si el personaje no existe
                
                const container = char.team === 'team1' ? team1Container : team2Container;
                
                const isDefeated = char.hp <= 0;
                const isTransformed = (char.rikudoMode && name === 'Madara Uchiha') ||
                                      (char.fenixArmorActive && name === 'Ikki de Fenix') ||
                                      (char.kuramaMode && name === 'Minato Namikaze') ||
                                      (name === 'Alexstrasza' && char.dragonFormActive) ||
                                      (name === 'Goku' && (char.ultraInstinto || char.gokuForm)) ||
                                      (name === 'Anakin Skywalker' && char.darkSideAwakened) ||
                                      (name === 'Muzan Kibutsuji' && char.muzanTransformed) ||
                                      (name === 'Garou' && char.garouSaitamaMode) ||
                                      (name === 'Superman' && char.supermanPrimeMode) ||
                                      (name === 'Varian Wrynn' && char.varianTransformed);
                // Seleccionar portrait correcto según forma de Goku
                let _gokuPortrait = char.portrait;
                if (name === 'Goku' && char.gokuForm) {
                    if (char.gokuForm === 'ss1' && char.portraitSS1) _gokuPortrait = char.portraitSS1;
                    else if (char.gokuForm === 'ss3' && char.portraitSS3) _gokuPortrait = char.portraitSS3;
                    else if (char.gokuForm === 'ssblue' && char.portraitSSBlue) _gokuPortrait = char.portraitSSBlue;
                    else if (char.gokuForm === 'ui' && char.portraitUI) _gokuPortrait = char.portraitUI;
                }
                // Seleccionar portrait correcto según forma de Naruto
                let _naruPortrait = char.portrait;
                if (name === 'Naruto' && char.narutoForm) {
                    if (char.narutoForm === 'sabio' && char.portraitSabio) _naruPortrait = char.portraitSabio;
                    else if (char.narutoForm === 'kyubi' && char.portraitKyubi) _naruPortrait = char.portraitKyubi;
                    else if (char.narutoForm === 'baryon' && char.portraitBaryon) _naruPortrait = char.portraitBaryon;
                }
                const activePortrait = (name === 'Goku' && char.gokuForm) ? _gokuPortrait :
                                       (name === 'Naruto' && char.narutoForm) ? _naruPortrait :
                                       (char.portrait || char.transformPortrait || char.transformationPortrait || '');
                const portraitHTML = activePortrait
                    ? `<img class="character-portrait${isDefeated ? ' defeated-img' : ''}" src="${activePortrait}" alt="${name}" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="character-portrait-placeholder" style="display:none">⚔️</div>`
                    : `<div class="character-portrait-placeholder">⚔️</div>`;

                const cardHTML = `
                    <div class="character-card ${isDefeated ? 'defeated' : ''} ${isTransformed ? 'transformed-mode' : ''}" id="char-${name.replace(/\s+/g, '-')}" data-charname="${name}" style="cursor:pointer;" title="Ver ficha de ${name}">
                        <div class="character-header">
                            <div class="character-name">
                                ${name}
                                ${isTransformed ? ' <span style="font-size: 0.65em; color: #ff9900;">⚡TRANSFORMADO⚡</span>' : ''}
                            </div>
                            <div class="character-speed">⚡${char.speed}</div>
                        </div>

                        <div class="character-portrait-row">
                            ${portraitHTML}
                            <div class="character-info-col">
                                <div class="stat-bars">
                                    <div class="stat-bar">
                                        <div class="stat-label">
                                            <span>💚 HP ${char.shield > 0 ? `<span class="shield-indicator">🛡️${char.shield}</span>` : ''}</span>
                                            <span>${char.hp}/${char.maxHp}</span>
                                        </div>
                                        <div class="bar-container">
                                            <div class="bar-fill hp-bar" style="width: ${(char.hp / char.maxHp) * 100}%"></div>
                                        </div>
                                    </div>
                                    
                                    <div class="stat-bar">
                                        <div class="stat-label">
                                            <span>⚡ CARGAS</span>
                                            <span>${char.charges}</span>
                                        </div>
                                        <div class="bar-container">
                                            <div class="bar-fill charge-bar" style="width: ${(char.charges / 20) * 100}%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        ${renderStatusEffects(char)}
                    </div>
                `;
                
                container.innerHTML += cardHTML;
            }
        }

        function renderAbilities(charName, char) {
            let html = '';
            char.abilities.forEach((ability, index) => {
                // Calcular costo ajustado por modo Rikudō
                let adjustedCost = ability.cost;
                if (char.rikudoMode && charName === 'Madara Uchiha') {
                    adjustedCost = Math.ceil(ability.cost / 2);
                }
                
                const canUse = char.charges >= adjustedCost;
                // Verificar Silenciar
                const silEffect2 = (char.statusEffects||[]).find(e => e && normAccent(e.name||'')==='silenciar');
                const blockedBySilence = silEffect2 && ability.type === silEffect2.silencedCategory;
                const disabled = !canUse || char.hp <= 0 || blockedBySilence;
                
                html += `
                    <button class="ability-btn" 
                            onclick="selectAbility('${charName}', ${index})"
                            ${disabled ? 'disabled' : ''}>
                        ${ability.name}
                        <span class="ability-cost">💎 ${adjustedCost}</span>
                    </button>
                `;
            });
            return html;
        }

        function renderStatusEffects(char) {
            if (!char || !char.statusEffects || char.statusEffects.length === 0) {
                return '';
            }
            
            const displayEffects = buildDisplayEffects(char.statusEffects);
            let html = '<div class="status-effects">';
            displayEffects.forEach(function(d) {
                const className = d.type === 'buff' ? 'buff' : 'debuff';
                const subLabel = d.sub !== '' ? ' <span style="opacity:0.7;font-size:0.85em;">(' + d.sub + ')</span>' : '';
                html += '<span class="status-effect ' + className + '">' + d.emoji + ' ' + d.label + subLabel + '</span>';
            });
            html += '</div>';
            return html;
        }

        function renderTurnOrder() {
            const turnOrderList = document.getElementById('turnOrderList');
            if (!turnOrderList) return; // Ya no existe en el nuevo layout
            
            turnOrderList.innerHTML = '';
            
            gameState.turnOrder.forEach((charName, index) => {
                const char = gameState.characters[charName];
                const isActive = index === gameState.currentTurnIndex;
                const isDead = char.hp <= 0 || char.isDead;
                
                if (!isDead) {
                    turnOrderList.innerHTML += `
                        <div class="turn-order-item ${isActive ? 'active' : ''}">
                            <div style="font-size: 0.9em; opacity: 0.8;">#${index + 1}</div>
                            <div>${charName}</div>
                            <div style="font-size: 0.85em; color: var(--warning);">⚡${char.speed}</div>
                        </div>
                    `;
                }
            });
        }
