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
                logEl.style.overflowY = 'auto';
                logEl.style.maxHeight = '420px';
                logEl.style.scrollbarWidth = 'thin';
            }
            gameState.battleLog = [];
            for (let k in gameState.summons) { delete gameState.summons[k]; }
            // Usar personajes seleccionados o todos por defecto
            const source = selectedCharacters || characterData;
            gameState.characters = JSON.parse(JSON.stringify(source));

            // ── BATTLE STATS: contadores para la pantalla de resultado épica ──
            gameState.battleStats = {
                // Existentes
                totalDamage: {},
                crits: 0,
                summonsKilled: 0,
                oversUsed: 0,
                healsGiven: 0,
                team1Damage: 0,
                team2Damage: 0,
                killMap: {},
                // MVP tracking — nuevos contadores
                critsByChar: {},       // crits por personaje × 2pts
                damageDone: {},        // daño causado × 0.15pts (nueva métrica)
                chargesGenSelf: {},    // cargas generadas para sí mismo × 0.5pts
                chargesGenAllies: {},  // cargas generadas para aliados × 1.5pts
                damageReceived: {},    // daño recibido por personaje × 1-2pts
                debuffsApplied: {},    // debuffs aplicados × 2pts
                buffsApplied: {},      // buffs aplicados × 2pts
                summonsDone: {},       // invocaciones realizadas × 3pts
                summonKills: {},       // kills causadas por invocación (+5pts al invocador)
                healingDone: {},       // HP curado a aliados × 1pt
                ccApplied: {},         // CC aplicado × 1.5pts
                poisonDamage: {},      // daño por veneno (para Dotters)
                burnDamage: {},        // daño por quemadura (para Dotters)
                // Quién puede aplicar veneno/quemadura (para dividir Dotters equitativamente)
                poisonAppliers: new Set(),
                burnAppliers: new Set(),
            };

            // ── PROXY: interceptar statusEffects.push para activar Monarca de la Destruccion ──
            // Esto garantiza que CUALQUIER buff aplicado (con push directo) active la pasiva
            function _wrapStatusEffects(charName) {
                const ch = gameState.characters[charName];
                if (!ch || !Array.isArray(ch.statusEffects)) return;
                const _origArr = ch.statusEffects;
                const _proxied = new Proxy(_origArr, {
                    get(target, prop) {
                        if (prop === '__isProxied') return true;
                        if (prop === 'push') {
                            return function(...items) {
                                const result = Array.prototype.push.apply(target, items);
                                // Activar Monarca si se agrega un buff a un personaje enemigo de Antares
                                items.forEach(function(item) {
                                    if (item && item.type === 'buff' && !item.passiveHidden &&
                                        typeof triggerMonarcaDestruccion === 'function') {
                                        triggerMonarcaDestruccion(charName);
                                    }
                                });
                                return result;
                            };
                        }
                        return target[prop];
                    }
                });
                ch.statusEffects = _proxied;
            }
            for (const _cn in gameState.characters) { _wrapStatusEffects(_cn); }

            // ── PATCH: interceptar asignaciones directas a statusEffects para mantener el Proxy ──
            // Cuando el código hace char.statusEffects = [...].filter(...), el Proxy se pierde.
            // Usamos un setter en cada personaje para re-envolverlo automáticamente.
            (function() {
                for (const _cn in gameState.characters) {
                    const _ch = gameState.characters[_cn];
                    if (!_ch) continue;
                    let _arr = _ch.statusEffects;
                    Object.defineProperty(_ch, 'statusEffects', {
                        get: function() { return _arr; },
                        set: function(newVal) {
                            _arr = newVal;
                            // Re-envolver con Proxy si es un array plano (no ya proxied)
                            if (Array.isArray(newVal) && !newVal.__isProxied) {
                                const _pArr = newVal;
                                const _name = _cn;
                                const _proxied2 = new Proxy(_pArr, {
                                    get(target2, prop2) {
                                        if (prop2 === '__isProxied') return true;
                                        if (prop2 === 'push') {
                                            return function(...items2) {
                                                const r = Array.prototype.push.apply(target2, items2);
                                                items2.forEach(function(item2) {
                                                    if (item2 && item2.type === 'buff' && !item2.passiveHidden &&
                                                        typeof triggerMonarcaDestruccion === 'function') {
                                                        triggerMonarcaDestruccion(_name);
                                                    }
                                                });
                                                return r;
                                            };
                                        }
                                        return target2[prop2];
                                    }
                                });
                                _arr = _proxied2;
                            }
                        },
                        configurable: true,
                        enumerable: true
                    });
                }
            })();
            
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
                // Darth Vader: Aura Oscura permanente (Presencia Oscura)
                if (baseName === 'Darth Vader') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && e.name === 'Aura oscura'; })) {
                        ch.statusEffects.push({ name: 'Aura oscura', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🌑' });
                    }
                }
                // Rey Brujo de Angmar: Provocación + Infectar permanentes (Señor de los Nazgul)
                if (baseName === 'Rey Brujo de Angmar') {
                    ch.statusEffects = ch.statusEffects || [];
                    ch.statusEffects.push({ name: 'Provocacion', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🛡️' });
                    ch.statusEffects.push({ name: 'Infectar', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '🦠' });
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
                // Flash: Esquiva Área permanente (Aceleración Constante)
                if (baseName === 'Flash') {
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && (e.name||'').toLowerCase().replace(/\s/g,'') === 'esquivaarea'; })) {
                        ch.statusEffects.push({ name: 'Esquiva Area', type: 'buff', duration: 999, permanent: true, passiveHidden: true, emoji: '⚡' });
                    }
                    ch.esquivaAreaPassive = true;
                }
                // Darth Vader: inmune a Miedo y Confusión + Aura Oscura permanente
                if (baseName === 'Darth Vader') {
                    ch.immuneToMiedo = true;
                    ch.immuneToConfusion = true;
                    ch.statusEffects = ch.statusEffects || [];
                    if (!ch.statusEffects.some(function(e){ return e && (e.name||'').toLowerCase().replace(/\s/g,'') === 'auraoscura'; })) {
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
            let solarPct = 0, solarAdded = false;
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
                    solarPct += (e.duration || 1); // acumular turnos en lugar de %
                    solarAdded = true;
                } else if (nn === 'sangrado') {
                    bleedStack += 1;
                    bleedAdded = true;
                } else if (nn === 'veneno') {
                    poisonStacks++;
                    poisonMaxDur = Math.max(poisonMaxDur, e.duration || 0);
                    poisonAdded = true;
                } else {
                    // Normal single display
                    display.push({ emoji: e.emoji || '✨', label: e.name, sub: e.duration !== undefined ? e.duration : '', type: e.type });
                }
            });

            if (burnAdded) {
                if (burnFlat > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnFlat + ' HP', sub: burnDur + 'T', type: 'debuff' });
                else if (burnPct > 0) display.push({ emoji: '🔥', label: 'Quemadura ' + burnPct + '%', sub: '', type: 'debuff' });
                else display.push({ emoji: '🔥', label: 'Quemadura', sub: '', type: 'debuff' });
            }
            if (solarAdded)  display.push({ emoji: '☀️', label: 'QS',  sub: solarPct + 'T', type: 'debuff' });
            if (bleedAdded)  display.push({ emoji: '🩸', label: 'Sangrado ' + bleedStack,        sub: '', type: 'debuff' });
            if (poisonAdded) display.push({ emoji: '☠️', label: 'Veneno',                        sub: poisonMaxDur + 'T', type: 'debuff' });

            return display;
        }

        // ── HP tick animation helper ──────────────────────────────────────
        function showHpTick(charName, delta) {
            if (!delta || delta === 0) return;
            const cardEl = document.getElementById('char-' + charName.replace(/\s+/g, '-'));
            if (!cardEl) return;
            const tick = document.createElement('div');
            tick.className = 'hp-tick ' + (delta > 0 ? 'heal' : 'dmg');
            tick.textContent = (delta > 0 ? '+' : '') + delta;
            const rect = cardEl.getBoundingClientRect();
            tick.style.cssText = 'left:' + (rect.left + rect.width/2 - 20) + 'px;top:' + (rect.top + rect.height * 0.3) + 'px;position:fixed;';
            document.body.appendChild(tick);
            setTimeout(function(){ tick.remove(); }, 1500);
        }
        window.showHpTick = showHpTick;

        // Track previous HP to detect changes for tick animation
        var _prevHpMap = {};

        function renderCharacters() {
            const team1Container = document.getElementById('team1Characters');
            const team2Container = document.getElementById('team2Characters');
            
            if (!team1Container || !team2Container) {
                console.error('Error: Contenedores de equipos no encontrados');
                return;
            }

            // Snapshot current HP for tick detection
            var _newHpMap = {};
            for (let _hn in gameState.characters) {
                const _hc = gameState.characters[_hn];
                if (_hc) _newHpMap[_hn] = _hc.hp;
            }
            
            team1Container.innerHTML = '';
            team2Container.innerHTML = '';
            
            for (let name in gameState.characters) {
                const char = gameState.characters[name];
                if (!char) continue;
                
                const container = char.team === 'team1' ? team1Container : team2Container;
                
                const isDefeated = char.hp <= 0;
                const isTransformed = (char.rikudoMode && (name === 'Madara Uchiha' || name === 'Madara Uchiha v2')) ||
                                      (char.fenixArmorActive && (name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2')) ||
                                      (char.kuramaMode && (name === 'Minato Namikaze' || name === 'Minato Namikaze v2')) ||
                                      ((name === 'Alexstrasza' || name === 'Alexstrasza v2') && char.dragonFormActive) ||
                                      ((name === 'Goku' || name === 'Goku v2') && (char.ultraInstinto || char.gokuForm)) ||
                                      ((name === 'Naruto' || name === 'Naruto v2') && char.narutoForm) ||
                                      ((name === 'Antares' || name === 'Antares v2') && char.antaresTransformed) ||
                                      ((name === 'Vegeta' || name === 'Vegeta v2') && char.vegetaForm) ||
                                      ((name === 'Anakin Skywalker' || name === 'Anakin Skywalker v2') && char.darkSideAwakened) ||
                                      ((name === 'Muzan Kibutsuji' || name === 'Muzan Kibutsuji v2') && char.muzanTransformed) ||
                                      (name === 'Garou' && char.garouSaitamaMode) ||
                                      ((name === 'Superman' || name === 'Superman v2') && char.supermanPrimeMode) ||
                                      ((name === 'Varian Wrynn' || name === 'Varian Wrynn v2') && char.varianTransformed) ||
                                      ((name === 'Escanor' || name === 'Escanor v2') && char.escanorTheOneActive) ||
                                      (name === 'Daemon Targaryen' && (char.daemonJineteTurns||0) > 0) ||
                                      ((name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2') && char.fenixArmorActive);

                // Portrait dinámico por forma (Goku y Naruto)
                let _dynPortrait = char.portrait || char.transformPortrait || char.transformationPortrait || '';
                if ((name === 'Goku' || name === 'Goku v2') && char.gokuForm) {
                    if (char.gokuForm === 'ss1' && char.portraitSS1) _dynPortrait = char.portraitSS1;
                    else if (char.gokuForm === 'ss3' && char.portraitSS3) _dynPortrait = char.portraitSS3;
                    else if (char.gokuForm === 'ssblue' && char.portraitSSBlue) _dynPortrait = char.portraitSSBlue;
                    else if (char.gokuForm === 'ui' && char.portraitUI) _dynPortrait = char.portraitUI;
                } else if ((name === 'Naruto' || name === 'Naruto v2') && char.narutoForm) {
                    if (char.narutoForm === 'sabio' && char.portraitSabio) _dynPortrait = char.portraitSabio;
                    else if (char.narutoForm === 'kyubi' && char.portraitKyubi) _dynPortrait = char.portraitKyubi;
                    else if (char.narutoForm === 'baryon' && char.portraitBaryon) _dynPortrait = char.portraitBaryon;
                }
                // Portrait Escanor The One
                if ((name === 'Escanor' || name === 'Escanor v2') && char.escanorTheOneActive && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Daemon Targaryen — Jinete de Dragones
                if (name === 'Daemon Targaryen' && (char.daemonJineteTurns||0) > 0 && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Ikki de Fenix — Armadura Divina
                if ((name === 'Ikki de Fenix' || name === 'Ikki de Fenix v2') && char.fenixArmorActive && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Antares transformado
                if ((name === 'Antares' || name === 'Antares v2') && char.antaresTransformed && char.transformPortrait) {
                    _dynPortrait = char.transformPortrait;
                }
                // Portrait Vegeta por forma
                if ((name === 'Vegeta' || name === 'Vegeta v2') && char.vegetaForm) {
                    if (char.vegetaForm === 'ssblue_evo' && char.portraitSSBlueEvo) _dynPortrait = char.portraitSSBlueEvo;
                    else if (char.vegetaForm === 'ultra_ego' && char.portraitUltraEgo) _dynPortrait = char.portraitUltraEgo;
                }
                const activePortrait = _dynPortrait;
                const portraitHTML = activePortrait
                    ? `<img class="character-portrait${isDefeated ? ' defeated-img' : ''}" src="${activePortrait}" alt="${name}" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="character-portrait-placeholder" style="display:none">⚔️</div>`
                    : `<div class="character-portrait-placeholder">⚔️</div>`;

                // Build relic icons HTML
                const _relics = char.equippedRelics || [];
                let _relicIconsHTML = '';
                if (_relics.length > 0 && typeof RELICS_DATA !== 'undefined') {
                    _relics.forEach(function(rname) {
                        const _rd = RELICS_DATA[rname];
                        const _tierColor = { Raro:'#aaa', Especial:'#4fc3f7', Epico:'#c864ff', Legendario:'#ffd700' };
                        const _tc = _rd ? (_tierColor[_rd.tier]||'#aaa') : '#aaa';
                        if (_rd && _rd.img) {
                            _relicIconsHTML += '<img class="char-relic-icon" src="' + _rd.img + '" title="' + rname + '" style="border-color:' + _tc + '44;" onerror="this.style.display=\'none\'">'; 
                        } else {
                            _relicIconsHTML += '<div class="char-relic-dot" style="border-color:' + _tc + ';" title="' + rname + '">💎</div>';
                        }
                    });
                }

                const _hpPct = char.maxHp > 0 ? char.hp / char.maxHp : 0;
                const _hpClass = _hpPct > 0.6 ? 'hp' : (_hpPct > 0.3 ? 'hp med' : 'hp low');
                const _chPct = Math.min(1, (char.charges || 0) / 20);
                const _chClass = (char.charges || 0) >= 20 ? 'ch full' : 'ch';

                // Status effects for this card
                const _sfx = renderStatusEffects(char);

                const cardHTML = `
                    <div class="character-card ${isDefeated ? 'defeated' : ''} ${isTransformed ? 'transformed-mode' : ''}" 
                         id="char-${name.replace(/\s+/g, '-')}" 
                         data-charname="${name}" 
                         onclick="window._showCharInfoPanel && window._showCharInfoPanel('${name}')"
                         title="${name}">
                        ${char.shield > 0 ? '<div class="char-shield-bar" style="background:linear-gradient(90deg,rgba(100,200,255,0.6),rgba(0,150,255,0.3));height:3px;"></div>' : ''}
                        <div class="char-inner">
                            <div class="char-portrait-wrap">
                                ${activePortrait
                                    ? `<img class="character-portrait${isDefeated ? ' defeated-img' : ''}" src="${activePortrait}" alt="${name}" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
                                    : `<div class="character-portrait-placeholder">⚔️</div>`}
                                <div class="char-hp-overlay">${char.hp}/${char.maxHp}${char.shield > 0 ? ' 🛡️'+char.shield : ''}</div>
                            </div>
                            <div class="char-body">
                                <div class="char-toprow">
                                    <span class="char-name-badge">${name}${isTransformed ? ' ⚡' : ''}</span>
                                    <span class="char-speed-badge">⚡${char.speed}</span>
                                </div>
                                <div class="char-bars">
                                    <div class="char-bar-row">
                                        <span class="char-bar-label" style="color:#55ff99;">💚</span>
                                        <div class="char-bar-track">
                                            <div class="char-bar-fill ${_hpClass}" style="width:${Math.max(0,_hpPct*100).toFixed(1)}%"></div>
                                        </div>
                                        <span class="char-bar-val" id="hpval-${name.replace(/\s+/g,'-')}">${char.hp}/${char.maxHp}</span>
                                    </div>
                                    <div class="char-bar-row">
                                        <span class="char-bar-label" style="color:#00c8ff;">⚡</span>
                                        <div class="char-bar-track">
                                            <div class="char-bar-fill ${_chClass}" style="width:${(_chPct*100).toFixed(1)}%"></div>
                                        </div>
                                        <span class="char-bar-val" id="chval-${name.replace(/\s+/g,'-')}">${char.charges}</span>
                                    </div>
                                </div>
                                ${_relicIconsHTML ? '<div class="char-relics">' + _relicIconsHTML + '</div>' : ''}
                            </div>
                        </div>
                        ${_sfx ? '<div class="char-effects-row">' + _sfx.replace(/<div class="status-effects">|<\/div>$/g,'') + '</div>' : ''}
                    </div>
                `;
                
                container.innerHTML += cardHTML;
            }

            // Fire HP tick animations for changes since last render
            for (let _tn in _newHpMap) {
                const _prev = _prevHpMap[_tn];
                if (_prev !== undefined && _prev !== _newHpMap[_tn]) {
                    const _delta = _newHpMap[_tn] - _prev;
                    if (_delta > 0) showHpTick(_tn, _delta); // heal
                    // damage ticks are handled separately for better UX
                }
            }
            _prevHpMap = _newHpMap;
        }

        function renderAbilities(charName, char) {
            let html = '';
            // Mapeo de effect → nombre de la invocación única que genera
            const SINGLE_SUMMON_MAP = {
                'summon_sphinx':       'Abu el-Hol Sphinx',
                'summon_ramesseum':    'Ramesseum Tentyris',
                'summon_douma_hielo':  'Douma de Hielo',
                'summon_gigante_hielo':'Gigante de Hielo',
                'summon_señuelo':      'Señuelo',
                'summon_ghost':        'Ghost',
            };
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

                // Verificar si es invocación única ya activa en campo
                let blockedBySummon = false;
                const _summonName = SINGLE_SUMMON_MAP[ability.effect];
                if (_summonName && typeof gameState !== 'undefined' && gameState.summons) {
                    blockedBySummon = Object.values(gameState.summons).some(function(s) {
                        return s && s.name === _summonName && s.hp > 0 &&
                               s.summoner === charName;
                    });
                }

                const disabled = !canUse || char.hp <= 0 || blockedBySilence || blockedBySummon ||
                    // Piel de Acero Legendaria: bloqueada durante cooldown
                    (ability.effect === 'piel_acero_bjorn' && (char._pielAceroCooldown||0) > 0);
                const _disabledTitle = blockedBySummon ? ' title="' + _summonName + ' ya está en campo"' :
                    (ability.effect === 'piel_acero_bjorn' && (char._pielAceroCooldown||0) > 0) ? ' title="Cooldown: ' + char._pielAceroCooldown + ' turno(s)"' : '';
                // Over listo: el Over es usable y no está bloqueado
                const isOverReady = ability.type === 'over' && !disabled;
                
                html += `
                    <button class="ability-btn${isOverReady ? ' over-ready' : ''}" 
                            onclick="selectAbility('${charName}', ${index})"
                            ${disabled ? 'disabled' : ''}${_disabledTitle}>
                        ${ability.name}
                        <span class="ability-cost">💎 ${adjustedCost}</span>
                    </button>
                `;
            });
            return html;
        }

        function renderStatusEffects(char) {
            if (!char || !char.statusEffects || char.statusEffects.length === 0) return '';
            const displayEffects = buildDisplayEffects(char.statusEffects);
            if (!displayEffects.length) return '';
            let html = '';
            displayEffects.forEach(function(d) {
                const cn = d.type === 'buff' ? 'buff' : 'debuff';
                const sub = d.sub ? ' <span style="opacity:.65;font-size:.82em;">('+d.sub+')</span>' : '';
                html += '<span class="status-effect ' + cn + '">' + d.emoji + ' ' + d.label + sub + '</span>';
            });
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
